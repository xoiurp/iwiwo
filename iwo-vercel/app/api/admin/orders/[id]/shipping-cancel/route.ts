import { prisma } from '@/app/lib/prisma';
import { guardAdmin } from '@/app/admin/lib/verify';
import { cancelLabel, SuperFreteError } from '@/app/lib/superfrete';

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const bad = await guardAdmin(request);
  if (bad) return bad;

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return Response.json({ error: 'ID inválido' }, { status: 400 });
  }

  let body: { reason?: unknown };
  try {
    body = (await request.json()) as { reason?: unknown };
  } catch {
    body = {};
  }
  const reason = String(body.reason ?? '').trim() || 'Cancelado pela loja';

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { superfreteOrderId: true, superfreteStatus: true },
  });
  if (!order?.superfreteOrderId) {
    return Response.json({ error: 'Etiqueta não criada' }, { status: 404 });
  }
  if (order.superfreteStatus === 'posted' || order.superfreteStatus === 'delivered') {
    return Response.json(
      { error: 'Etiqueta já postada — não pode ser cancelada' },
      { status: 409 },
    );
  }

  try {
    await cancelLabel(order.superfreteOrderId, reason);
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { superfreteStatus: 'cancelled' },
    });
    return Response.json({ status: updated.superfreteStatus });
  } catch (err) {
    const status = err instanceof SuperFreteError ? err.status : 500;
    return Response.json(
      { error: 'Falha ao cancelar etiqueta' },
      { status: status >= 400 && status < 600 ? status : 502 },
    );
  }
}
