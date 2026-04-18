// app/api/products/[slug]/route.ts
// Busca um produto público pelo slug + variantes ativas (Prisma ORM).

import { prisma } from '@/app/lib/prisma';
import { toPublicShape } from '@/app/lib/public-shape';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const row = await prisma.product.findUnique({
      where: { slug },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!row) {
      return Response.json(
        { error: 'Produto não encontrado' },
        { status: 404 }
      );
    }

    const { variants, ...product } = row;

    return Response.json({
      product: toPublicShape(product as Record<string, unknown>),
      variants: variants.map((v) => toPublicShape(v as Record<string, unknown>)),
    });
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    return Response.json(
      { error: 'Erro ao buscar produto' },
      { status: 500 }
    );
  }
}
