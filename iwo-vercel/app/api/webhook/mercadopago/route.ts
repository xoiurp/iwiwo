import { Prisma } from '@prisma/client';
import { prisma } from '@/app/lib/prisma';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createLabel, SuperFreteError } from '@/app/lib/superfrete';

/**
 * MercadoPago webhook — v2 signed notifications.
 *
 * Header: x-signature: ts=<ts>,v1=<hex>
 * Header: x-request-id: <uuid>
 * Body:   { data: { id: <paymentId> }, ... }
 *
 * Manifest: `id:${dataId};request-id:${requestId};ts:${ts};`
 * v1 = HMAC_SHA256(MP_WEBHOOK_SECRET, manifest)
 *
 * We fail CLOSED: missing MP_WEBHOOK_SECRET → 503.
 * On signature/parse error → 401.
 * On downstream processing error → 500 (so MP retries).
 */

const SIG_TOLERANCE_SECONDS = 300;

function parseSignatureHeader(sig: string | null): { ts: string; v1: string } | null {
  if (!sig) return null;
  const parts = sig.split(',').map(s => s.trim());
  const out: Record<string, string> = {};
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    out[p.slice(0, idx).trim()] = p.slice(idx + 1).trim();
  }
  if (!out.ts || !out.v1) return null;
  return { ts: out.ts, v1: out.v1 };
}

function safeHexEqual(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length) return false;
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length === 0 || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function mapMpToInternal(mpStatus: string | undefined | null): string {
  switch (mpStatus) {
    case 'approved':
      return 'paid';
    case 'rejected':
      return 'failed';
    case 'in_process':
    case 'pending':
      return 'pending';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
    case 'charged_back':
      return 'refunded';
    default:
      return 'pending';
  }
}

export async function POST(request: Request) {
  // Fail CLOSED on missing secret — never accept unsigned webhooks.
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || secret.length < 16) {
    console.error('[mp-webhook] MP_WEBHOOK_SECRET missing or too short — refusing.');
    return Response.json({ error: 'Server misconfigured' }, { status: 503 });
  }

  // ── Phase 1: parse body + verify signature ──────────────────────────────
  let body: { type?: string; data?: { id?: string | number } };
  let paymentId: string | number | undefined;
  try {
    const rawText = await request.text();
    body = JSON.parse(rawText);

    const sigHeader = request.headers.get('x-signature');
    const requestId = request.headers.get('x-request-id');
    const parsed = parseSignatureHeader(sigHeader);

    if (!parsed || !requestId) {
      console.warn('[mp-webhook] missing signature or request-id header');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Timestamp freshness (±5 min)
    const tsNum = Number(parsed.ts);
    if (!Number.isFinite(tsNum)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const nowSec = Date.now() / 1000;
    // MP ts is milliseconds in v2 — normalize if it looks like ms
    const tsSec = tsNum > 1e12 ? tsNum / 1000 : tsNum;
    if (Math.abs(nowSec - tsSec) > SIG_TOLERANCE_SECONDS) {
      console.warn('[mp-webhook] signature timestamp outside tolerance');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dataId = body?.data?.id;
    if (dataId == null) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    paymentId = dataId;

    const manifest = `id:${dataId};request-id:${requestId};ts:${parsed.ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');

    if (!safeHexEqual(expected, parsed.v1)) {
      console.warn('[mp-webhook] HMAC mismatch');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch (err) {
    console.warn('[mp-webhook] parse/verify error:', err);
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Early return for non-payment events (after verification).
  if (body.type !== 'payment' || !paymentId) {
    return Response.json({ received: true });
  }

  // ── Phase 2: fetch payment + update order. 500 on error so MP retries. ──
  try {
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    if (!mpResponse.ok) {
      console.error('[mp-webhook] Failed to fetch MP payment:', paymentId, mpResponse.status);
      return Response.json({ error: 'Failed to fetch payment' }, { status: 500 });
    }

    const payment = await mpResponse.json();
    const status = payment.status;
    const mpPaymentIdStr = String(payment.id ?? paymentId);

    // Defense in depth: lookup by mpOrderId (what the checkout stored)
    const order = await prisma.order.findFirst({
      where: { mpOrderId: mpPaymentIdStr },
    });

    if (!order) {
      // Signature was valid but we don't know this order — log and 404.
      console.warn('[mp-webhook] order not found for mpOrderId', mpPaymentIdStr);
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    try {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          mpStatus: status,
          status: mapMpToInternal(status),
        },
      });
    } catch (dbErr) {
      if (dbErr instanceof Prisma.PrismaClientKnownRequestError) {
        console.error('[mp-webhook] Prisma error', dbErr.code, dbErr.message);
        if (dbErr.code === 'P2025') {
          return Response.json({ error: 'Order not found' }, { status: 404 });
        }
      }
      // Re-throw so MP retries
      throw dbErr;
    }

    // ── SuperFrete: criar etiqueta se o pagamento foi aprovado ─────────────
    // Execução best-effort. Falhas NÃO propagam — MP já confirmou o pagamento
    // e o webhook precisa devolver 200 para sair do retry.
    const internalStatus = mapMpToInternal(status);
    const shouldCreateLabel =
      internalStatus === 'paid' &&
      order.shippingServiceId != null &&
      order.superfreteOrderId == null;

    if (shouldCreateLabel) {
      try {
        // Recarrega o pedido com orderItems para montar a declaração de conteúdo.
        const fresh = await prisma.order.findUnique({
          where: { id: order.id },
          include: { orderItems: true },
        });
        if (!fresh) throw new Error('Order not found after update');

        const label = await createLabel({
          id: fresh.id,
          shipToName: fresh.shipToName,
          shipToDocument: fresh.shipToDocument,
          shipToPostalCode: fresh.shipToPostalCode,
          shipToAddress: fresh.shipToAddress,
          shipToNumber: fresh.shipToNumber,
          shipToComplement: fresh.shipToComplement,
          shipToDistrict: fresh.shipToDistrict,
          shipToCity: fresh.shipToCity,
          shipToState: fresh.shipToState,
          shippingServiceId: fresh.shippingServiceId,
          shippingBoxWeight: fresh.shippingBoxWeight,
          shippingBoxHeight: fresh.shippingBoxHeight,
          shippingBoxWidth: fresh.shippingBoxWidth,
          shippingBoxLength: fresh.shippingBoxLength,
          payerEmail: fresh.payerEmail,
          orderItems: fresh.orderItems.map((it) => ({
            productName: it.productName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          })),
        });

        await prisma.order.update({
          where: { id: order.id },
          data: {
            superfreteOrderId: label.id,
            superfreteStatus: label.status,
            superfreteCreatedAt: new Date(),
            superfreteError: null,
          },
        });
      } catch (sfErr) {
        const msg =
          sfErr instanceof SuperFreteError
            ? `${sfErr.message}: ${JSON.stringify(sfErr.body).slice(0, 500)}`
            : String((sfErr as Error)?.message ?? sfErr);
        console.error('[mp-webhook] SuperFrete createLabel failed', msg);
        await prisma.order
          .update({
            where: { id: order.id },
            data: { superfreteError: msg.slice(0, 1000) },
          })
          .catch((e) => console.error('[mp-webhook] failed to persist sfError', e));
        // não propagar — precisamos responder 200 para a MP.
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    // Return 500 (NOT 200) so MercadoPago retries.
    console.error('[mp-webhook] processing error:', error);
    return Response.json({ error: 'Processing error' }, { status: 500 });
  }
}
