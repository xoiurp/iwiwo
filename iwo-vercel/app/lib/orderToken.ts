// Token HMAC de um-uso para a URL de confirmação do pedido.
// Signed com NEXTAUTH_SECRET (já configurado).
// Payload: `${orderId}.${createdAtMs}` — invariante imutável após criação.

import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error('NEXTAUTH_SECRET ausente ou muito curto');
  }
  return s;
}

function payload(orderId: number, createdAtMs: number): string {
  return `${orderId}.${createdAtMs}`;
}

export function signOrderToken(orderId: number, createdAt: Date): string {
  const h = createHmac('sha256', secret());
  h.update(payload(orderId, createdAt.getTime()));
  return h.digest('hex');
}

export function verifyOrderToken(
  orderId: number,
  createdAt: Date,
  token: string,
): boolean {
  const expected = signOrderToken(orderId, createdAt);
  if (!token || token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
  } catch {
    return false;
  }
}
