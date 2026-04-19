// POST /api/shipping/quote
// Body: { toPostalCode: string, items: [{ productId: number, quantity: number }] }
// Retorna: { options: ShippingOption[] }

import { quote, SuperFreteError } from '@/app/lib/superfrete';

type Body = {
  toPostalCode?: string;
  items?: Array<{ productId?: unknown; quantity?: unknown }>;
};

function toInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const toPostalCode = String(body.toPostalCode ?? '').replace(/\D/g, '');
  if (toPostalCode.length !== 8) {
    return Response.json({ error: 'CEP de destino inválido' }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: 'Carrinho vazio' }, { status: 400 });
  }

  let totalQuantity = 0;
  for (const item of body.items) {
    const q = toInt(item?.quantity);
    if (q == null || q <= 0 || q > 100) {
      return Response.json({ error: 'Quantidade inválida' }, { status: 400 });
    }
    totalQuantity += q;
  }
  if (totalQuantity <= 0 || totalQuantity > 500) {
    return Response.json({ error: 'Quantidade total inválida' }, { status: 400 });
  }

  try {
    const options = await quote({ toPostalCode, totalQuantity });
    if (options.length === 0) {
      return Response.json(
        { error: 'Nenhum serviço disponível para este CEP' },
        { status: 422 },
      );
    }
    return Response.json({ options });
  } catch (err) {
    if (err instanceof SuperFreteError) {
      console.error('[shipping/quote] SuperFrete error', err.status, err.body);
      return Response.json(
        { error: 'Falha ao cotar frete. Tente novamente.' },
        { status: 502 },
      );
    }
    console.error('[shipping/quote] unexpected', err);
    return Response.json({ error: 'Erro interno' }, { status: 500 });
  }
}
