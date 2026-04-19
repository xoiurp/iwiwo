// app/api/admin/products/route.ts
// Admin products - list all and create new products (Prisma ORM).

import { prisma } from '@/app/lib/prisma';
import type { Prisma } from '@prisma/client';
import { guardAdmin } from '@/app/admin/lib/verify';

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

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

// Camel-case fields accepted on POST (mapped to DB columns via @map in schema).
// Kept explicit so we can safely forward only known-good keys.
const ALLOWED_FIELDS = [
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

type AllowedField = typeof ALLOWED_FIELDS[number];

// Accept both snake_case (legacy admin UI) and camelCase payloads.
const SNAKE_TO_CAMEL: Record<string, AllowedField> = {
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

// comGps / comNfc are stored as VARCHAR(255) (free-form descriptors like
// "Dual-band" or "Sim"), but the legacy admin form submits them as boolean
// checkboxes. Coerce booleans to "Sim"/null so Prisma accepts the write.
const STRING_FROM_BOOL_FIELDS = ['comGps', 'comNfc'] as const;

function coerceStringOrBoolFields(body: Record<string, unknown>): void {
  for (const field of STRING_FROM_BOOL_FIELDS) {
    const v = body[field];
    if (typeof v === 'boolean') {
      body[field] = v ? 'Sim' : null;
    }
  }
}

// ── GET: List all products ───────────────────────────────────────────────────

export async function GET(request: Request) {
  const unauthorized = await guardAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    const where: Prisma.ProductWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return Response.json({ products: products.map(shapeProduct) });
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    return Response.json(
      { error: 'Erro ao listar produtos' },
      { status: 500 }
    );
  }
}

// ── POST: Create a new product ──────────────────────────────────────────────

export async function POST(request: Request) {
  const unauthorized = await guardAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const raw = (await request.json()) as Record<string, unknown>;
    const body = normalizeKeys(raw);
    coerceStringOrBoolFields(body);

    // name required
    if (!body.name || typeof body.name !== 'string' || (body.name as string).trim() === '') {
      return Response.json(
        { error: 'Campo "name" é obrigatório' },
        { status: 400 }
      );
    }

    // Fix 5: coerce + length cap
    body.name = String(body.name).trim();
    if ((body.name as string).length > 255) {
      return Response.json(
        { error: 'Campo "name" excede 255 caracteres' },
        { status: 400 }
      );
    }

    // Fix 5: price must be finite non-negative number
    const priceNum = Number(body.price);
    if (body.price == null || !Number.isFinite(priceNum) || priceNum < 0) {
      return Response.json(
        { error: 'Campo "price" deve ser número finito >= 0' },
        { status: 400 }
      );
    }
    body.price = priceNum;

    // Auto-generate slug if not provided
    if (!body.slug) {
      body.slug = slugify(body.name as string);
    } else {
      body.slug = String(body.slug).trim();
    }

    // Fix 5: slug format
    if (!/^[a-z0-9-]+$/.test(body.slug as string)) {
      return Response.json(
        { error: 'Slug inválido (use apenas a-z, 0-9 e hífens)' },
        { status: 400 }
      );
    }

    // Auto-generate priceFormatted from price
    body.priceFormatted = formatBRL(priceNum);

    // Auto-generate compareAtPriceFormatted if compareAtPrice is set
    if (body.compareAtPrice != null && Number.isFinite(Number(body.compareAtPrice))) {
      body.compareAtPriceFormatted = formatBRL(Number(body.compareAtPrice));
    }

    // Auto-set image from images array (principal image). JsonB → pass through.
    if (body.images && Array.isArray(body.images) && body.images.length > 0) {
      const arr = body.images as Array<{ is_principal?: boolean; url?: string }>;
      const principal = arr.find((i) => i.is_principal) || arr[0];
      if (principal && principal.url) body.image = principal.url;
      // NOTE: no JSON.stringify – Prisma handles JsonB serialization natively.
    }

    // Build Prisma data object with only whitelisted fields
    const data: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return Response.json(
        { error: 'Nenhum campo válido fornecido' },
        { status: 400 }
      );
    }

    const created = await prisma.product.create({
      data: data as Prisma.ProductCreateInput,
    });

    return Response.json({ product: shapeProduct(created) }, { status: 201 });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2002') {
      return Response.json(
        { error: 'Slug já em uso por outro produto' },
        { status: 409 }
      );
    }
    console.error('Erro ao criar produto:', error);
    return Response.json(
      { error: 'Erro ao criar produto' },
      { status: 500 }
    );
  }
}
