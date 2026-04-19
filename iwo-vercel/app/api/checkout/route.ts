import { Prisma } from '@prisma/client';
import { prisma } from '@/app/lib/prisma';
import { quote, SuperFreteError } from '@/app/lib/superfrete';
import { auth } from '@/app/lib/auth';
import { validateAndComputeCoupon } from '@/app/lib/coupon';
import { signOrderToken } from '@/app/lib/orderToken';

interface CartItem {
  productId: number;
  variantId?: number;
  name: string;
  price?: number;       // IGNORED — server re-prices
  quantity: number;
  image?: string;
  slug?: string;
}

interface PricedItem {
  productId: number;
  variantId?: number;
  name: string;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  image?: string;
  slug?: string;
}

interface ShipTo {
  name: string;
  document: string;
  postalCode: string;
  address: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
}

interface ShippingRequest {
  serviceId: number;
  toPostalCode: string;
  quotedPrice: number;
}

function toInt(n: unknown): number | null {
  const x = Number(n);
  return Number.isFinite(x) && Number.isInteger(x) ? x : null;
}

// Prisma Decimal | number | null → number (NaN if not coercible)
function decimalToNumber(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  // Prisma.Decimal has .toNumber()
  try {
    return (v as Prisma.Decimal).toNumber();
  } catch {
    return Number(v as unknown as string);
  }
}

function sanitizeCep(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

function sanitizeDigits(v: unknown, max: number): string {
  return String(v ?? '').replace(/\D/g, '').slice(0, max);
}

function validateShipTo(s: unknown): { ok: true; data: ShipTo } | { ok: false; error: string } {
  if (!s || typeof s !== 'object') return { ok: false, error: 'shipTo ausente' };
  const src = s as Record<string, unknown>;
  const name = String(src.name ?? '').trim().slice(0, 255);
  const document = sanitizeDigits(src.document, 14);
  const postalCode = sanitizeCep(src.postalCode);
  const address = String(src.address ?? '').trim().slice(0, 255);
  const number = String(src.number ?? '').trim().slice(0, 20);
  const complement = String(src.complement ?? '').trim().slice(0, 100);
  const district = String(src.district ?? '').trim().slice(0, 100) || 'NA';
  const city = String(src.city ?? '').trim().slice(0, 100);
  const state = String(src.state ?? '').trim().toUpperCase().slice(0, 2);

  if (!name || name.split(/\s+/).length < 2) {
    return { ok: false, error: 'Nome completo do destinatário obrigatório' };
  }
  if (document.length !== 11) return { ok: false, error: 'CPF inválido' };
  if (postalCode.length !== 8) return { ok: false, error: 'CEP inválido' };
  if (!address) return { ok: false, error: 'Endereço obrigatório' };
  if (!number) return { ok: false, error: 'Número obrigatório' };
  if (!city) return { ok: false, error: 'Cidade obrigatória' };
  if (!/^[A-Z]{2}$/.test(state)) return { ok: false, error: 'UF inválida' };

  return { ok: true, data: { name, document, postalCode, address, number, complement, district, city, state } };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, payer, payment_method } = body as {
      items: CartItem[];
      payer: Record<string, unknown>;
      payment_method: Record<string, unknown>;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'Carrinho vazio' }, { status: 400 });
    }

    if (!payer?.email) {
      return Response.json({ error: 'Email do pagador é obrigatório' }, { status: 400 });
    }

    // ── Server-side re-pricing ──────────────────────────────────────────────
    const priced: PricedItem[] = [];

    for (const raw of items) {
      const productId = toInt(raw.productId);
      const quantity = toInt(raw.quantity);
      const variantId = raw.variantId != null ? toInt(raw.variantId) : undefined;

      if (productId == null || productId <= 0) {
        return Response.json({ error: 'productId inválido' }, { status: 400 });
      }
      if (quantity == null || !(quantity > 0 && quantity <= 100)) {
        return Response.json(
          { error: 'quantidade inválida (1..100, inteiro)' },
          { status: 400 }
        );
      }
      if (raw.variantId != null && (variantId == null || variantId <= 0)) {
        return Response.json({ error: 'variantId inválido' }, { status: 400 });
      }

      let unitPrice: number | null = null;
      let variantName: string | undefined;

      if (variantId != null) {
        const variant = await prisma.productVariant.findFirst({
          where: { id: variantId, productId },
          include: { product: true },
        });
        if (!variant) {
          return Response.json(
            { error: `Variante ${variantId} não encontrada` },
            { status: 400 }
          );
        }
        if (variant.isActive === false) {
          return Response.json(
            { error: `Variante ${variantId} inativa` },
            { status: 400 }
          );
        }
        if (variant.product.archived === true || variant.product.draft === true) {
          return Response.json(
            { error: `Produto ${productId} indisponível` },
            { status: 400 }
          );
        }
        variantName = variant.name;

        const p = decimalToNumber(variant.price);
        if (!Number.isFinite(p) || p <= 0) {
          // fall through to product price if variant has no override
          const pp = decimalToNumber(variant.product.price);
          if (!Number.isFinite(pp) || pp <= 0) {
            return Response.json({ error: `Preço inválido para ${productId}` }, { status: 400 });
          }
          unitPrice = pp;
        } else {
          unitPrice = p;
        }
      } else {
        const product = await prisma.product.findUnique({
          where: { id: productId },
        });
        if (!product) {
          return Response.json(
            { error: `Produto ${productId} não encontrado` },
            { status: 400 }
          );
        }
        if (product.archived === true || product.draft === true) {
          return Response.json(
            { error: `Produto ${productId} indisponível` },
            { status: 400 }
          );
        }
        const p = decimalToNumber(product.price);
        if (!Number.isFinite(p) || p <= 0) {
          return Response.json(
            { error: `Preço inválido para ${productId}` },
            { status: 400 }
          );
        }
        unitPrice = p;
      }

      // Round to 2 decimals
      unitPrice = Math.round(unitPrice * 100) / 100;
      const totalPrice = Math.round(unitPrice * quantity * 100) / 100;

      priced.push({
        productId,
        variantId: variantId ?? undefined,
        name: String(raw.name ?? '').slice(0, 255),
        variantName,
        unitPrice,
        quantity,
        totalPrice,
        image: raw.image,
        slug: raw.slug,
      });
    }

    // ── Validar shipTo e shipping ───────────────────────────────────────────
    const shipToRaw = (body as { shipTo?: unknown }).shipTo;
    const shipToValidation = validateShipTo(shipToRaw);
    if (!shipToValidation.ok) {
      return Response.json({ error: shipToValidation.error }, { status: 400 });
    }
    const shipTo = shipToValidation.data;

    const shippingRaw = (body as { shipping?: unknown }).shipping as ShippingRequest | undefined;
    if (
      !shippingRaw ||
      typeof shippingRaw !== 'object' ||
      typeof shippingRaw.serviceId !== 'number' ||
      ![1, 2, 17].includes(shippingRaw.serviceId) ||
      typeof shippingRaw.quotedPrice !== 'number' ||
      !Number.isFinite(shippingRaw.quotedPrice)
    ) {
      return Response.json({ error: 'Frete não selecionado' }, { status: 400 });
    }

    // Re-cota server-side (anti-tampering)
    const totalQuantity = priced.reduce((s, it) => s + it.quantity, 0);
    let shippingOptions;
    try {
      shippingOptions = await quote({
        toPostalCode: shipTo.postalCode,
        totalQuantity,
      });
    } catch (err) {
      if (err instanceof SuperFreteError) {
        console.error('[checkout] SuperFrete quote error', err.status, err.body);
        return Response.json(
          { error: 'Falha ao validar frete. Tente novamente.' },
          { status: 502 },
        );
      }
      throw err;
    }

    const selected = shippingOptions.find((o) => o.serviceId === shippingRaw.serviceId);
    if (!selected) {
      return Response.json(
        {
          error: 'SHIPPING_OPTION_UNAVAILABLE',
          message: 'O serviço escolhido não está mais disponível.',
          newOptions: shippingOptions,
        },
        { status: 409 },
      );
    }

    const tolerance = Math.max(0.5, shippingRaw.quotedPrice * 0.05);
    if (Math.abs(selected.price - shippingRaw.quotedPrice) > tolerance) {
      return Response.json(
        {
          error: 'SHIPPING_QUOTE_STALE',
          message: 'O valor do frete mudou.',
          newOptions: shippingOptions,
        },
        { status: 409 },
      );
    }

    const shippingCost = Math.round(selected.price * 100) / 100;

    // ── Validar cupom (se enviado) server-side ──────────────────────────────
    const couponCodeRaw = (body as { couponCode?: unknown }).couponCode;
    let couponResult: Awaited<ReturnType<typeof validateAndComputeCoupon>> | null = null;
    if (couponCodeRaw != null && String(couponCodeRaw).trim() !== '') {
      const subtotalPreview = priced.reduce((s, it) => s + it.totalPrice, 0);
      couponResult = await validateAndComputeCoupon(
        String(couponCodeRaw),
        subtotalPreview,
      );
      if (!couponResult.ok) {
        return Response.json(
          {
            error: 'COUPON_INVALID',
            message: couponResult.message,
            code: couponResult.error,
          },
          { status: 409 },
        );
      }
    }

    const subtotal = priced.reduce((sum, it) => sum + it.totalPrice, 0);
    const couponDiscount = couponResult?.ok ? couponResult.discount : 0;
    const totalAmount = Math.round((subtotal - couponDiscount + shippingCost) * 100) / 100;

    const description = priced
      .map(i => `${i.quantity}x ${i.name}`)
      .join(', ')
      .slice(0, 256);

    // Build additional_info.items for MP quality score — using server-trusted prices
    const mpItems = priced.map(item => ({
      id: String(item.productId),
      title: item.name,
      description: item.name,
      category_id: 'electronics',
      quantity: item.quantity,
      unit_price: item.unitPrice,
      picture_url: item.image || undefined,
    }));

    // Build MercadoPago Payments API payload
    const mpPayload: Record<string, unknown> = {
      transaction_amount: totalAmount,
      description,
      payment_method_id: payment_method.id,
      statement_descriptor: 'IWOWATCH',
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://iwowatch.com.br'}/api/webhook/mercadopago`,
      payer: {
        email: payer.email,
        first_name: payer.first_name || '',
        last_name: payer.last_name || '',
        identification: payer.identification || undefined,
      },
      additional_info: {
        items: mpItems,
        payer: {
          first_name: payer.first_name || '',
          last_name: payer.last_name || '',
        },
      },
    };

    // Card: add token and installments
    if (payment_method.type === 'credit_card' || payment_method.type === 'debit_card') {
      mpPayload.token = payment_method.token;
      mpPayload.installments = payment_method.installments || 1;
    }

    // Boleto: add payer address
    if (payment_method.type === 'ticket' && payer.address) {
      (mpPayload.payer as Record<string, unknown>).address = payer.address;
    }

    // ── Create the order + orderItems in DB FIRST so we can set external_reference ──
    const payerName =
      ((payer.first_name as string) || '') + ' ' + ((payer.last_name as string) || '');
    const payerCpf =
      ((payer.identification as Record<string, string>)?.number) || '';

    try {
      const order = await prisma.order.create({
        data: {
          status: 'pending',
          total: totalAmount,
          items: priced as unknown as Prisma.InputJsonValue,
          payerEmail: payer.email as string,
          payerName,
          payerCpf,
          shippingServiceId: selected.serviceId,
          shippingServiceName: selected.name,
          shippingCost,
          shippingDeliveryMin: selected.deliveryMin,
          shippingDeliveryMax: selected.deliveryMax,
          shipToName: shipTo.name,
          shipToDocument: shipTo.document,
          shipToPostalCode: shipTo.postalCode,
          shipToAddress: shipTo.address,
          shipToNumber: shipTo.number,
          shipToComplement: shipTo.complement || null,
          shipToDistrict: shipTo.district,
          shipToCity: shipTo.city,
          shipToState: shipTo.state,
          shippingBoxWeight: selected.box.weight,
          shippingBoxHeight: selected.box.height,
          shippingBoxWidth: selected.box.width,
          shippingBoxLength: selected.box.length,
          couponCode: couponResult?.ok ? couponResult.coupon.code : null,
          couponKind: couponResult?.ok ? couponResult.coupon.kind : null,
          couponDiscount: couponResult?.ok ? couponResult.discount : null,
          couponId: couponResult?.ok ? couponResult.coupon.id : null,
          orderItems: {
            create: priced.map(p => ({
              productId: p.productId,
              variantId: p.variantId ?? null,
              productName: p.name,
              variantName: p.variantName ?? null,
              unitPrice: p.unitPrice,
              quantity: p.quantity,
              totalPrice: p.totalPrice,
              image: p.image ?? null,
            })),
          },
        },
      });

      // Se cliente logado, salva/atualiza endereço em Customer.Address
      try {
        const session = await auth();
        const userId = (session?.user as { id?: string } | undefined)?.id;
        if (userId) {
          const customer = await prisma.customer.findUnique({ where: { userId } });
          if (customer) {
            const existing = await prisma.address.findFirst({
              where: {
                customerId: customer.id,
                cep: shipTo.postalCode,
                number: shipTo.number,
              },
            });
            const addressData = {
              recipient: shipTo.name,
              cep: shipTo.postalCode,
              street: shipTo.address,
              number: shipTo.number,
              complement: shipTo.complement || null,
              neighborhood: shipTo.district,
              city: shipTo.city,
              state: shipTo.state,
            };
            if (existing) {
              await prisma.address.update({ where: { id: existing.id }, data: addressData });
            } else {
              await prisma.address.create({
                data: { ...addressData, customerId: customer.id },
              });
            }
            await prisma.order.update({
              where: { id: order.id },
              data: { customerId: customer.id },
            });
          }
        }
      } catch (addrErr) {
        console.warn('[checkout] address upsert failed (non-fatal)', addrErr);
      }

      mpPayload.external_reference = `order_${order.id}`;

      const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          'X-Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(mpPayload),
      });

      const mpData = await mpResponse.json();

      if (!mpResponse.ok) {
        console.error('MercadoPago error:', JSON.stringify(mpData, null, 2));
        return Response.json({
          error: 'Erro ao processar pagamento',
          details: mpData,
        }, { status: 500 });
      }

      // Update order with MP data
      const mpPaymentId = String(mpData.id);
      const mpStatus = mpData.status;
      try {
        await prisma.order.update({
          where: { id: order.id },
          data: { mpOrderId: mpPaymentId, mpStatus },
        });
      } catch (updateErr) {
        if (updateErr instanceof Prisma.PrismaClientKnownRequestError) {
          console.error('[checkout] order.update failed', updateErr.code, updateErr.message);
        } else {
          console.error('[checkout] order.update failed', updateErr);
        }
        // Non-fatal — payment already created at MP; surface in response but do not throw
      }

      if (!order.createdAt) {
        // Invariant: Prisma @default(now()) guarantees createdAt is populated.
        // If this ever throws, schema or driver is misbehaving. Fail LOUD here at
        // checkout instead of silently at the confirmation page.
        throw new Error('Order.createdAt ausente pós-create');
      }
      const orderToken = signOrderToken(order.id, order.createdAt);

      // Build response for frontend
      const result: Record<string, unknown> = {
        orderId: order.id,
        token: orderToken,
        mpPaymentId,
        status: mpData.status,
        statusDetail: mpData.status_detail,
      };

      // Pix: QR code info
      if (mpData.payment_method_id === 'pix') {
        const txData = mpData.point_of_interaction?.transaction_data;
        result.pix = {
          qr_code: txData?.qr_code,
          qr_code_base64: txData?.qr_code_base64,
          ticket_url: txData?.ticket_url,
        };
      }

      // Boleto: barcode info
      if (mpData.payment_method_id === 'boleto') {
        result.boleto = {
          barcode_content: mpData.barcode?.content,
          digitable_line: mpData.transaction_details?.digitable_line,
          ticket_url: mpData.transaction_details?.external_resource_url,
        };
      }

      return Response.json(result);
    } catch (dbErr) {
      if (dbErr instanceof Prisma.PrismaClientKnownRequestError) {
        console.error('[checkout] Prisma error', dbErr.code, dbErr.message);
        if (dbErr.code === 'P2025') {
          return Response.json({ error: 'Registro não encontrado' }, { status: 404 });
        }
        if (dbErr.code === 'P2002') {
          return Response.json({ error: 'Conflito de dados' }, { status: 409 });
        }
      }
      throw dbErr;
    }

  } catch (error) {
    console.error('Checkout error:', error);
    return Response.json({ error: 'Erro interno no checkout' }, { status: 500 });
  }
}
