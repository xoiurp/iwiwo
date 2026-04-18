import { Prisma } from '@prisma/client';
import { prisma } from '@/app/lib/prisma';

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

    // Ignore client total/subtotal entirely
    const subtotal = priced.reduce((sum, it) => sum + it.totalPrice, 0);
    const totalAmount = Math.round(subtotal * 100) / 100;

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

      // Build response for frontend
      const result: Record<string, unknown> = {
        orderId: order.id,
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
