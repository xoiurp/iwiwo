// Helper central para a SuperFrete.
//
// Responsabilidades:
//   - Encapsular autenticação (Authorization + User-Agent).
//   - Calcular a caixa a partir da quantidade total do carrinho.
//   - Cotação de frete (POST /api/v0/calculator) — este arquivo (Task 2).
//   - Criação/consulta/impressão/cancelamento de etiqueta — Task 6.
//
// Ref: iwo-vercel/docs/superfrete/*

const API_URL = process.env.SUPERFRETE_API_URL ?? 'https://sandbox.superfrete.com';
const TOKEN = process.env.SUPERFRET_APITOKEN ?? '';
const USER_AGENT = process.env.SUPERFRETE_USER_AGENT ?? 'IWO Watch';

// Timeout padrão para chamadas SuperFrete (ms).
const DEFAULT_TIMEOUT_MS = 15_000;

// Serviços oferecidos no checkout: PAC, SEDEX, Mini Envios.
export const OFFERED_SERVICES = '1,2,17' as const;
export type ServiceId = 1 | 2 | 17;

// Dimensões e peso fixos por unidade (ver spec — decisão do usuário).
export const SHIPPING_ITEM = {
  weightKg: 0.3,
  height: 12,   // cm
  width: 10,    // cm
  length: 15,   // cm
} as const;

export type Box = {
  weight: number; // kg
  height: number; // cm
  width: number;  // cm
  length: number; // cm
};

// Escala a caixa linearmente no eixo `length` conforme a quantidade total.
// Ex.: 3 unidades → 45 × 10 × 12 cm, 0.9 kg.
export function buildBox(totalQuantity: number): Box {
  if (!Number.isInteger(totalQuantity) || totalQuantity <= 0) {
    throw new Error(`totalQuantity inválido: ${totalQuantity}`);
  }
  return {
    weight: Math.round(SHIPPING_ITEM.weightKg * totalQuantity * 1000) / 1000,
    height: SHIPPING_ITEM.height,
    width: SHIPPING_ITEM.width,
    length: SHIPPING_ITEM.length * totalQuantity,
  };
}

export type ShippingOption = {
  serviceId: ServiceId;
  name: string;
  price: number;       // preço final (já com desconto SuperFrete)
  deliveryMin: number;
  deliveryMax: number;
  box: Box;
};

export class SuperFreteError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'SuperFreteError';
  }
}

async function sfFetch(path: string, init: RequestInit): Promise<unknown> {
  if (!TOKEN) {
    throw new SuperFreteError('SUPERFRET_APITOKEN não configurado', 503, null);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      throw new SuperFreteError(
        `SuperFrete ${init.method ?? 'GET'} ${path} → ${res.status}`,
        res.status,
        body,
      );
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

// ── Cotação ───────────────────────────────────────────────────────────────
// POST /api/v0/calculator — devolve opções por serviço. Filtra `has_error`.
// Enviamos `products` (a API devolve a caixa ideal em `packages[0]`).
type CalculatorRaw = Array<{
  id: number;
  name: string;
  price?: number;
  delivery_time?: number;
  delivery_range?: { min: number; max: number };
  has_error?: boolean;
  error?: string;
  packages?: Array<{
    weight?: string | number;
    dimensions?: { height?: string; width?: string; length?: string };
  }>;
}>;

function toNum(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

export async function quote(input: {
  toPostalCode: string;
  totalQuantity: number;
}): Promise<ShippingOption[]> {
  const cep = String(input.toPostalCode).replace(/\D/g, '');
  if (cep.length !== 8) {
    throw new SuperFreteError('CEP de destino inválido', 400, null);
  }
  const fromCep = (process.env.SHIPPING_FROM_POSTAL_CODE ?? '').replace(/\D/g, '');
  if (fromCep.length !== 8) {
    throw new SuperFreteError('CEP de origem não configurado', 503, null);
  }
  const body = {
    from: { postal_code: fromCep },
    to: { postal_code: cep },
    services: OFFERED_SERVICES,
    options: {
      own_hand: false,
      receipt: false,
      insurance_value: 0,
      use_insurance_value: false,
    },
    products: [
      {
        quantity: input.totalQuantity,
        weight: SHIPPING_ITEM.weightKg,
        height: SHIPPING_ITEM.height,
        width: SHIPPING_ITEM.width,
        length: SHIPPING_ITEM.length,
      },
    ],
  };

  const raw = (await sfFetch('/api/v0/calculator', {
    method: 'POST',
    body: JSON.stringify(body),
  })) as CalculatorRaw;

  if (!Array.isArray(raw)) return [];

  return raw
    .filter((r) => !r.has_error && typeof r.price === 'number' && r.price > 0)
    .map((r): ShippingOption => {
      const pkg = r.packages?.[0];
      const dims = pkg?.dimensions ?? {};
      return {
        serviceId: r.id as ServiceId,
        name: String(r.name),
        price: toNum(r.price),
        deliveryMin: r.delivery_range?.min ?? toNum(r.delivery_time),
        deliveryMax: r.delivery_range?.max ?? toNum(r.delivery_time),
        box: {
          weight: toNum(pkg?.weight),
          height: Math.round(toNum(dims.height)),
          width: Math.round(toNum(dims.width)),
          length: Math.round(toNum(dims.length)),
        },
      };
    });
}
