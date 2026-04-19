// Lógica de validação + cálculo de desconto. Usado por:
//   - POST /api/coupons/validate (UI do step 1 do checkout)
//   - POST /api/checkout (re-validação server-side anti-tampering)
//
// NÃO incrementa usedCount — isso é responsabilidade do webhook MP
// quando o pedido vira status='paid'.

import { prisma } from '@/app/lib/prisma';
import type { CouponKind } from '@prisma/client';

export type CouponValidationResult =
  | {
      ok: true;
      coupon: {
        id: number;
        code: string;
        kind: CouponKind;
        value: number;
        description: string | null;
      };
      discount: number;
    }
  | {
      ok: false;
      error:
        | 'NOT_FOUND'
        | 'INACTIVE'
        | 'NOT_YET_VALID'
        | 'EXPIRED'
        | 'EXHAUSTED'
        | 'MIN_NOT_MET';
      message: string;
      minOrderTotal?: number;
    };

function roundCents(v: number): number {
  return Math.round(v * 100) / 100;
}

export async function validateAndComputeCoupon(
  rawCode: string,
  subtotal: number,
): Promise<CouponValidationResult> {
  const code = String(rawCode ?? '').trim().toUpperCase();
  if (!code) {
    return { ok: false, error: 'NOT_FOUND', message: 'Cupom inválido' };
  }

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) {
    return { ok: false, error: 'NOT_FOUND', message: 'Cupom inválido' };
  }
  if (!coupon.isActive) {
    return { ok: false, error: 'INACTIVE', message: 'Cupom inativo' };
  }
  const now = new Date();
  if (coupon.validFrom && coupon.validFrom > now) {
    return { ok: false, error: 'NOT_YET_VALID', message: 'Cupom ainda não é válido' };
  }
  if (coupon.validUntil && coupon.validUntil < now) {
    return { ok: false, error: 'EXPIRED', message: 'Cupom expirado' };
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, error: 'EXHAUSTED', message: 'Cupom esgotado' };
  }

  const minOrderTotal =
    coupon.minOrderTotal != null ? Number(coupon.minOrderTotal) : 0;
  if (minOrderTotal > 0 && subtotal < minOrderTotal) {
    return {
      ok: false,
      error: 'MIN_NOT_MET',
      message: `Valor mínimo de R$ ${minOrderTotal.toFixed(2).replace('.', ',')} não atingido`,
      minOrderTotal,
    };
  }

  const value = Number(coupon.value);
  let discount: number;
  if (coupon.kind === 'PERCENT') {
    discount = roundCents(subtotal * (value / 100));
  } else {
    discount = roundCents(Math.min(value, subtotal));
  }

  return {
    ok: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      kind: coupon.kind,
      value,
      description: coupon.description,
    },
    discount,
  };
}
