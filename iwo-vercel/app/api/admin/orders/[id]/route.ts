import { prisma } from '@/app/lib/prisma';
import { guardAdmin } from '@/app/admin/lib/verify';

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  const bad = await guardAdmin(request);
  if (bad) return bad;

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return Response.json({ error: 'ID inválido' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderItems: true },
  });
  if (!order) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });

  const out = {
    ...order,
    total: order.total != null ? Number(order.total) : null,
    shippingCost: order.shippingCost != null ? Number(order.shippingCost) : null,
    shippingBoxWeight:
      order.shippingBoxWeight != null ? Number(order.shippingBoxWeight) : null,
    createdAt: order.createdAt?.toISOString() ?? null,
    updatedAt: order.updatedAt?.toISOString() ?? null,
    superfreteCreatedAt: order.superfreteCreatedAt?.toISOString() ?? null,
    orderItems: order.orderItems.map((it) => ({
      ...it,
      unitPrice: Number(it.unitPrice),
      totalPrice: Number(it.totalPrice),
      createdAt: it.createdAt?.toISOString(),
    })),
  };
  return Response.json({ order: out });
}
