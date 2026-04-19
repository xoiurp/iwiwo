// POST /api/coupons/validate
// Body: { code: string, subtotal: number }
// Retorna: 200 com cupom computado, ou 404/422 com error+message.

import { validateAndComputeCoupon } from '@/app/lib/coupon';

type Body = { code?: unknown; subtotal?: unknown };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const code = String(body.code ?? '').trim();
  const subtotalNum = Number(body.subtotal);
  if (!code) {
    return Response.json({ error: 'Código ausente' }, { status: 400 });
  }
  if (!Number.isFinite(subtotalNum) || subtotalNum <= 0) {
    return Response.json({ error: 'Subtotal inválido' }, { status: 400 });
  }

  const result = await validateAndComputeCoupon(code, subtotalNum);
  if (!result.ok) {
    const status = result.error === 'NOT_FOUND' ? 404 : 422;
    return Response.json(
      { error: result.error, message: result.message, minOrderTotal: result.minOrderTotal },
      { status },
    );
  }

  return Response.json({
    code: result.coupon.code,
    kind: result.coupon.kind,
    discount: result.discount,
    description: result.coupon.description,
  });
}
