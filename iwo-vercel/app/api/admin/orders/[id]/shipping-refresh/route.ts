import { prisma } from '@/app/lib/prisma';
import { guardAdmin } from '@/app/admin/lib/verify';
import { getLabelInfo, SuperFreteError } from '@/app/lib/superfrete';

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
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
    const info = await getLabelInfo(order.superfreteOrderId);
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        superfreteStatus: info.status,
        superfreteTracking: info.tracking,
      },
    });
    return Response.json({
      status: updated.superfreteStatus,
      tracking: updated.superfreteTracking,
    });
  } catch (err) {
    const status = err instanceof SuperFreteError ? err.status : 500;
    return Response.json(
      { error: 'Falha ao consultar SuperFrete' },
      { status: status >= 400 && status < 600 ? status : 502 },
    );
  }
}
