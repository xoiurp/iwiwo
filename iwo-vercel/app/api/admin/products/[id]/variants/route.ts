// app/api/admin/products/[id]/variants/route.ts
// Admin variants for a product – list and create (Prisma ORM).

import { prisma } from '@/app/lib/prisma';
import type { Prisma } from '@prisma/client';
import { guardAdmin } from '@/app/admin/lib/verify';

function shapeVariant<T extends Record<string, unknown>>(v: T): Record<string, unknown> {
  const out: Record<string, unknown> = { ...v };
  for (const key of ['price', 'compareAtPrice'] as const) {
    const val = out[key];
    if (val != null && typeof val === 'object' && 'toString' in (val as object)) {
      const n = Number((val as { toString(): string }).toString());
      out[key] = Number.isFinite(n) ? n : null;
    }
  }
  return out;
}

// ── GET: List variants for a product ────────────────────────────────────────

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

    const variants = await prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });

    return Response.json({ variants: variants.map(shapeVariant) });
  } catch (error) {
    console.error('Erro ao buscar variantes:', error);
    return Response.json({ error: 'Erro ao buscar variantes' }, { status: 500 });
  }
}

// ── POST: Create a variant ───────────────────────────────────────────────────

export async function POST(
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

    const body = (await request.json()) as Record<string, unknown>;

    // Accept both camelCase and snake_case for compareAtPrice + isActive.
    const compareAtPrice = body.compareAtPrice ?? body.compare_at_price ?? null;
    const isActive = body.isActive ?? body.is_active ?? true;
    const { name, sku, price, stock, color, size, images } = body as {
      name?: unknown; sku?: unknown; price?: unknown; stock?: unknown;
      color?: unknown; size?: unknown; images?: unknown;
    };

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return Response.json({ error: 'Campo "name" é obrigatório' }, { status: 400 });
    }
    const nameTrim = name.trim();
    if (nameTrim.length > 255) {
      return Response.json(
        { error: 'Campo "name" excede 255 caracteres' },
        { status: 400 }
      );
    }

    // Optional price validation — only enforce if provided.
    let priceValue: number | null = null;
    if (price != null) {
      const n = Number(price);
      if (!Number.isFinite(n) || n < 0) {
        return Response.json(
          { error: 'Campo "price" deve ser número finito >= 0' },
          { status: 400 }
        );
      }
      priceValue = n;
    }

    let compareAtValue: number | null = null;
    if (compareAtPrice != null) {
      const n = Number(compareAtPrice);
      if (!Number.isFinite(n) || n < 0) {
        return Response.json(
          { error: 'Campo "compareAtPrice" deve ser número finito >= 0' },
          { status: 400 }
        );
      }
      compareAtValue = n;
    }

    // JsonB: pass array through directly (no JSON.stringify).
    const imagesValue: Prisma.InputJsonValue =
      Array.isArray(images) ? (images as Prisma.InputJsonValue) : [];

    const created = await prisma.productVariant.create({
      data: {
        product: { connect: { id: productId } },
        name: nameTrim,
        sku: typeof sku === 'string' ? sku : null,
        price: priceValue,
        compareAtPrice: compareAtValue,
        stock: typeof stock === 'number' ? stock : 0,
        color: typeof color === 'string' ? color : null,
        size: typeof size === 'string' ? size : null,
        images: imagesValue,
        isActive: Boolean(isActive),
      },
    });

    return Response.json({ variant: shapeVariant(created) }, { status: 201 });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2025') {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }
    console.error('Erro ao criar variante:', error);
    return Response.json({ error: 'Erro ao criar variante' }, { status: 500 });
  }
}
