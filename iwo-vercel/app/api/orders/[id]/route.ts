// GET /api/orders/[id]?token=<hmac>
// Endpoint PÚBLICO protegido por token HMAC de um-uso (app/lib/orderToken).
// Retorna dados redigidos para a tela de confirmação do cliente.

import { prisma } from '@/app/lib/prisma';
import { verifyOrderToken } from '@/app/lib/orderToken';

type Params = Promise<{ id: string }>;

function maskCpf(cpf: string | null): string {
  if (!cpf) return '—';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return '—';
  return `***.***.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

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
    include: { orderItems: true },
  });
  if (!order || !order.createdAt || !verifyOrderToken(orderId, order.createdAt, token)) {
    return Response.json({ error: 'Token inválido' }, { status: 403 });
  }

  return Response.json({
    order: {
      id: order.id,
      status: order.status,
      mpStatus: order.mpStatus,
      total: order.total != null ? Number(order.total) : 0,
      subtotal:
        order.total != null && order.shippingCost != null && order.couponDiscount != null
          ? Number(order.total) - Number(order.shippingCost) + Number(order.couponDiscount)
          : order.orderItems.reduce((s, it) => s + Number(it.totalPrice), 0),
      shippingCost: order.shippingCost != null ? Number(order.shippingCost) : 0,
      shippingServiceName: order.shippingServiceName,
      shippingDeliveryMin: order.shippingDeliveryMin,
      shippingDeliveryMax: order.shippingDeliveryMax,
      couponCode: order.couponCode,
      couponDiscount: order.couponDiscount != null ? Number(order.couponDiscount) : 0,
      shipToName: order.shipToName,
      shipToDocument: maskCpf(order.shipToDocument),
      shipToPostalCode: order.shipToPostalCode,
      shipToAddress: order.shipToAddress,
      shipToNumber: order.shipToNumber,
      shipToComplement: order.shipToComplement,
      shipToDistrict: order.shipToDistrict,
      shipToCity: order.shipToCity,
      shipToState: order.shipToState,
      createdAt: order.createdAt.toISOString(),
      superfreteStatus: order.superfreteStatus,
      superfreteTracking: order.superfreteTracking,
      orderItems: order.orderItems.map((it) => ({
        id: it.id,
        productName: it.productName,
        variantName: it.variantName,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        totalPrice: Number(it.totalPrice),
        image: it.image,
      })),
    },
  });
}
