// app/api/products/route.ts
// Lista produtos públicos com filtros opcionais (Prisma ORM).
//
// Exemplos de uso:
//   GET /api/products              → todos os produtos (não-draft/arquivados)
//   GET /api/products?q=iwo        → busca por nome/descrição
//   GET /api/products?type=Relógio → filtra por product_type
//   GET /api/products?collection=smartwatch → filtra por coleção
//   GET /api/products?min=200&max=400 → faixa de preço
//   GET /api/products?limit=10&offset=0 → paginação

import { prisma } from '@/app/lib/prisma';
import type { Prisma } from '@prisma/client';
import { toPublicShape } from '@/app/lib/public-shape';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q');
    const type = searchParams.get('type');
    const collection = searchParams.get('collection');
    const minPrice = searchParams.get('min');
    const maxPrice = searchParams.get('max');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Prisma.ProductWhereInput = {
      draft: false,
      archived: false,
    };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { descricaoLonga: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (type) {
      where.productType = { equals: type, mode: 'insensitive' };
    }

    if (collection) {
      where.collections = { contains: collection, mode: 'insensitive' };
    }

    const priceFilter: Prisma.DecimalFilter = {};
    if (minPrice) {
      const min = parseFloat(minPrice);
      if (Number.isFinite(min)) priceFilter.gte = min;
    }
    if (maxPrice) {
      const max = parseFloat(maxPrice);
      if (Number.isFinite(max)) priceFilter.lte = max;
    }
    if (Object.keys(priceFilter).length > 0) {
      where.price = priceFilter;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.product.count({ where }),
    ]);

    return Response.json({
      products: products.map((p) => toPublicShape(p as Record<string, unknown>)),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return Response.json(
      { error: 'Erro ao buscar produtos' },
      { status: 500 }
    );
  }
}
