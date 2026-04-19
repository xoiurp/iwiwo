import { prisma } from '@/app/lib/prisma';
import { guardAdmin } from '@/app/admin/lib/verify';
import { getPrintUrl, SuperFreteError } from '@/app/lib/superfrete';

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
    select: { superfreteOrderId: true },
  });
  if (!order?.superfreteOrderId) {
    return Response.json({ error: 'Etiqueta não criada' }, { status: 404 });
  }

  try {
    const url = await getPrintUrl(order.superfreteOrderId);
    await prisma.order.update({
      where: { id: orderId },
      data: { superfreteLabelUrl: url },
    });
    return Response.json({ url });
  } catch (err) {
    const status = err instanceof SuperFreteError ? err.status : 500;
    return Response.json(
      { error: 'Falha ao obter URL da etiqueta' },
      { status: status >= 400 && status < 600 ? status : 502 },
    );
  }
}
