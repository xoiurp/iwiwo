// app/api/admin/products/[id]/route.ts
// Admin single product - get, update, delete (Prisma ORM).

import { prisma } from '@/app/lib/prisma';
import type { Prisma } from '@prisma/client';
import { guardAdmin } from '@/app/admin/lib/verify';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function shapeProduct<T extends Record<string, unknown>>(p: T): Record<string, unknown> {
  const out: Record<string, unknown> = { ...p };
  for (const key of ['price', 'compareAtPrice'] as const) {
    const val = out[key];
    if (val != null && typeof val === 'object' && 'toString' in (val as object)) {
      const n = Number((val as { toString(): string }).toString());
      out[key] = Number.isFinite(n) ? n : null;
    }
  }
  return out;
}

// Fields that may be updated via PUT (all camelCase; Prisma maps to snake_case).
const UPDATABLE_FIELDS = [
  'name', 'slug', 'description', 'descricaoLonga', 'image',
  'productType', 'vendor', 'collections',
  'price', 'priceFormatted', 'compareAtPrice', 'compareAtPriceFormatted',
  'seoTitle', 'seoDescription',
  'tamanhoDaCaixa', 'tipoDeTela', 'tamanhoDisplay',
  'pedometro', 'monitoramentoDeSono', 'saudeFeminina', 'ecg',
  'pressaoArterial', 'frequenciaCardiaca', 'oxigenioNoSangue',
  'capacidadeDaBateria', 'duracaoDaBateria', 'acompanhaCarregador',
  'bluetooth', 'comGps', 'comWiFi', 'redeMovel', 'comNfc',
  'memoriaInterna', 'musicaLocal', 'leitorDeEbooks', 'gravadorDeVoz',
  'comChatGpt', 'assistenteDeVoz', 'controleDeMusica', 'aplicativo',
  'cor1', 'cor2', 'cor3', 'url', 'draft', 'archived', 'images',
] as const;

type UpdatableField = typeof UPDATABLE_FIELDS[number];

const SNAKE_TO_CAMEL: Record<string, UpdatableField> = {
  descricao_longa: 'descricaoLonga',
  product_type: 'productType',
  price_formatted: 'priceFormatted',
  compare_at_price: 'compareAtPrice',
  compare_at_price_formatted: 'compareAtPriceFormatted',
  seo_title: 'seoTitle',
  seo_description: 'seoDescription',
  tamanho_da_caixa: 'tamanhoDaCaixa',
  tipo_de_tela: 'tipoDeTela',
  tamanho_display: 'tamanhoDisplay',
  monitoramento_de_sono: 'monitoramentoDeSono',
  saude_feminina: 'saudeFeminina',
  pressao_arterial: 'pressaoArterial',
  frequencia_cardiaca: 'frequenciaCardiaca',
  oxigenio_no_sangue: 'oxigenioNoSangue',
  capacidade_da_bateria: 'capacidadeDaBateria',
  duracao_da_bateria: 'duracaoDaBateria',
  acompanha_carregador: 'acompanhaCarregador',
  com_gps: 'comGps',
  com_wi_fi: 'comWiFi',
  rede_movel: 'redeMovel',
  com_nfc: 'comNfc',
  memoria_interna: 'memoriaInterna',
  musica_local: 'musicaLocal',
  leitor_de_ebooks: 'leitorDeEbooks',
  gravador_de_voz: 'gravadorDeVoz',
  com_chat_gpt: 'comChatGpt',
  assistente_de_voz: 'assistenteDeVoz',
  controle_de_musica: 'controleDeMusica',
  cor_1: 'cor1',
  cor_2: 'cor2',
  cor_3: 'cor3',
};

function normalizeKeys(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    const target = SNAKE_TO_CAMEL[k] ?? k;
    out[target] = v;
  }
  return out;
}

// ── GET: Single product by ID ────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await guardAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const productId = parseInt(id, 10);

    if (isNaN(productId)) {
      return Response.json({ error: 'ID inválido' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });

    if (!product) {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    return Response.json({ product: shapeProduct(product) });
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    return Response.json({ error: 'Erro ao buscar produto' }, { status: 500 });
  }
}

// ── PUT: Update product by ID (partial update) ──────────────────────────────

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await guardAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const productId = parseInt(id, 10);

    if (isNaN(productId)) {
      return Response.json({ error: 'ID inválido' }, { status: 400 });
    }

    const raw = (await request.json()) as Record<string, unknown>;
    const body = normalizeKeys(raw);

    // Fix 5: validate name if present
    if (body.name !== undefined) {
      body.name = String(body.name).trim();
      if ((body.name as string).length === 0 || (body.name as string).length > 255) {
        return Response.json(
          { error: 'Campo "name" inválido (1..255 chars)' },
          { status: 400 }
        );
      }
    }

    // Fix 5: validate slug if present
    if (body.slug !== undefined) {
      body.slug = String(body.slug).trim();
      if (!/^[a-z0-9-]+$/.test(body.slug as string)) {
        return Response.json(
          { error: 'Slug inválido (use apenas a-z, 0-9 e hífens)' },
          { status: 400 }
        );
      }
    }

    // Normalize Decimal fields: "" | null → null; else validate finite >= 0.
    // Prisma rejects "" for Decimal columns, so empty strings must become null.
    const isEmptyDecimal = (v: unknown) => v === '' || v === null;

    if (body.price !== undefined) {
      if (isEmptyDecimal(body.price)) {
        return Response.json(
          { error: 'Campo "price" é obrigatório' },
          { status: 400 }
        );
      }
      const priceNum = Number(body.price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        return Response.json(
          { error: 'Campo "price" deve ser número finito >= 0' },
          { status: 400 }
        );
      }
      body.price = priceNum;
      body.priceFormatted = formatBRL(priceNum);
    }

    if (body.compareAtPrice !== undefined) {
      if (isEmptyDecimal(body.compareAtPrice)) {
        body.compareAtPrice = null;
        body.compareAtPriceFormatted = null;
      } else {
        const cmpNum = Number(body.compareAtPrice);
        if (!Number.isFinite(cmpNum) || cmpNum < 0) {
          return Response.json(
            { error: 'Campo "compareAtPrice" deve ser número finito >= 0' },
            { status: 400 }
          );
        }
        body.compareAtPrice = cmpNum;
        body.compareAtPriceFormatted = formatBRL(cmpNum);
      }
    }

    // Auto-set image from images array (principal image). JsonB → pass through.
    if (body.images && Array.isArray(body.images) && body.images.length > 0) {
      const arr = body.images as Array<{ is_principal?: boolean; url?: string }>;
      const principal = arr.find((i) => i.is_principal) || arr[0];
      if (principal && principal.url) body.image = principal.url;
    }

    // Build Prisma data object with only whitelisted fields
    const data: Record<string, unknown> = {};
    for (const field of UPDATABLE_FIELDS) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return Response.json(
        { error: 'Nenhum campo válido para atualizar' },
        { status: 400 }
      );
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: data as Prisma.ProductUpdateInput,
    });

    return Response.json({ product: shapeProduct(updated) });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2025') {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }
    if (code === 'P2002') {
      return Response.json(
        { error: 'Slug já em uso por outro produto' },
        { status: 409 }
      );
    }
    console.error('Erro ao atualizar produto:', error);
    return Response.json({ error: 'Erro ao atualizar produto' }, { status: 500 });
  }
}

// ── DELETE: Hard delete product by ID ────────────────────────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await guardAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const productId = parseInt(id, 10);

    if (isNaN(productId)) {
      return Response.json({ error: 'ID inválido' }, { status: 400 });
    }

    const deleted = await prisma.product.delete({
      where: { id: productId },
      select: { id: true, name: true },
    });

    return Response.json({
      message: 'Produto excluído com sucesso',
      deleted,
    });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2025') {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }
    console.error('Erro ao excluir produto:', error);
    return Response.json({ error: 'Erro ao excluir produto' }, { status: 500 });
  }
}
