// app/api/admin/products/[id]/variants/[variantId]/route.ts
// Admin single variant – get, update, delete (Prisma ORM).

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

// Fields that may be updated via PUT (camelCase; schema handles snake_case mapping).
const UPDATABLE_FIELDS = [
  'name', 'sku', 'price', 'compareAtPrice',
  'stock', 'color', 'size', 'images', 'isActive',
] as const;

const SNAKE_TO_CAMEL: Record<string, string> = {
  compare_at_price: 'compareAtPrice',
  is_active: 'isActive',
};

function normalizeKeys(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    const target = SNAKE_TO_CAMEL[k] ?? k;
    out[target] = v;
  }
  return out;
}

// ── GET: Single variant ──────────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const unauthorized = await guardAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { id, variantId } = await params;
    const productId = parseInt(id, 10);
    const vId = parseInt(variantId, 10);

    if (isNaN(productId) || isNaN(vId)) {
      return Response.json({ error: 'ID inválido' }, { status: 400 });
    }

    const variant = await prisma.productVariant.findFirst({
      where: { id: vId, productId },
    });

    if (!variant) {
      return Response.json({ error: 'Variante não encontrada' }, { status: 404 });
    }

    return Response.json({ variant: shapeVariant(variant) });
  } catch (error) {
    console.error('Erro ao buscar variante:', error);
    return Response.json({ error: 'Erro ao buscar variante' }, { status: 500 });
  }
}

// ── PUT: Partial update variant ──────────────────────────────────────────────

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const unauthorized = await guardAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { id, variantId } = await params;
    const productId = parseInt(id, 10);
    const vId = parseInt(variantId, 10);

    if (isNaN(productId) || isNaN(vId)) {
      return Response.json({ error: 'ID inválido' }, { status: 400 });
    }

    const raw = (await request.json()) as Record<string, unknown>;
    const body = normalizeKeys(raw);

    // Validate name if present
    if (body.name !== undefined) {
      body.name = String(body.name).trim();
      if ((body.name as string).length === 0 || (body.name as string).length > 255) {
        return Response.json(
          { error: 'Campo "name" inválido (1..255 chars)' },
          { status: 400 }
        );
      }
    }

    // Validate price if present (finite >= 0)
    if (body.price !== undefined && body.price !== null) {
      const n = Number(body.price);
      if (!Number.isFinite(n) || n < 0) {
        return Response.json(
          { error: 'Campo "price" deve ser número finito >= 0' },
          { status: 400 }
        );
      }
      body.price = n;
    }

    if (body.compareAtPrice !== undefined && body.compareAtPrice !== null) {
      const n = Number(body.compareAtPrice);
      if (!Number.isFinite(n) || n < 0) {
        return Response.json(
          { error: 'Campo "compareAtPrice" deve ser número finito >= 0' },
          { status: 400 }
        );
      }
      body.compareAtPrice = n;
    }

    // JsonB: pass array through directly.
    if (Array.isArray(body.images)) {
      body.images = body.images as Prisma.InputJsonValue;
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

    // Always bump updatedAt
    data.updatedAt = new Date();

    // Scope update to productId via updateMany so a bad productId→404s correctly.
    const { count } = await prisma.productVariant.updateMany({
      where: { id: vId, productId },
      data: data as Prisma.ProductVariantUpdateManyMutationInput,
    });

    if (count === 0) {
      return Response.json({ error: 'Variante não encontrada' }, { status: 404 });
    }

    const updated = await prisma.productVariant.findUnique({ where: { id: vId } });
    return Response.json({ variant: updated ? shapeVariant(updated) : null });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2025') {
      return Response.json({ error: 'Variante não encontrada' }, { status: 404 });
    }
    console.error('Erro ao atualizar variante:', error);
    return Response.json({ error: 'Erro ao atualizar variante' }, { status: 500 });
  }
}

// ── DELETE: Hard delete variant ──────────────────────────────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const unauthorized = await guardAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { id, variantId } = await params;
    const productId = parseInt(id, 10);
    const vId = parseInt(variantId, 10);

    if (isNaN(productId) || isNaN(vId)) {
      return Response.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await prisma.productVariant.findFirst({
      where: { id: vId, productId },
      select: { id: true, name: true },
    });

    if (!existing) {
      return Response.json({ error: 'Variante não encontrada' }, { status: 404 });
    }

    await prisma.productVariant.delete({ where: { id: vId } });

    return Response.json({
      message: 'Variante excluída',
      deleted: existing,
    });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2025') {
      return Response.json({ error: 'Variante não encontrada' }, { status: 404 });
    }
    console.error('Erro ao excluir variante:', error);
    return Response.json({ error: 'Erro ao excluir variante' }, { status: 500 });
  }
}
