import { prisma } from '@/app/lib/prisma';
import { guardAdmin } from '@/app/admin/lib/verify';

export async function GET(request: Request) {
  const bad = await guardAdmin(request);
  if (bad) return bad;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      total: true,
      status: true,
      payerName: true,
      payerEmail: true,
      shippingServiceName: true,
      superfreteStatus: true,
      superfreteTracking: true,
    },
  });

  return Response.json({
    orders: orders.map((o) => ({
      ...o,
      total: o.total != null ? Number(o.total) : null,
      createdAt: o.createdAt?.toISOString() ?? null,
    })),
  });
}
