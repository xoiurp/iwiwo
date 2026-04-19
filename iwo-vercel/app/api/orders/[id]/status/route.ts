// GET /api/orders/[id]/status?token=<hmac>
// Polling leve — só status (sem dados sensíveis).

import { prisma } from '@/app/lib/prisma';
import { verifyOrderToken } from '@/app/lib/orderToken';

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return Response.json({ error: 'ID inválido' }, { status: 400 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  if (!token) {
    return Response.json({ error: 'Token ausente' }, { status: 403 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      mpStatus: true,
      superfreteStatus: true,
      superfreteTracking: true,
      createdAt: true,
    },
  });
  if (!order) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
  if (!order.createdAt || !verifyOrderToken(orderId, order.createdAt, token)) {
    return Response.json({ error: 'Token inválido' }, { status: 403 });
  }

  return Response.json({
    status: order.status,
    mpStatus: order.mpStatus,
    superfreteStatus: order.superfreteStatus,
    superfreteTracking: order.superfreteTracking,
  });
}
