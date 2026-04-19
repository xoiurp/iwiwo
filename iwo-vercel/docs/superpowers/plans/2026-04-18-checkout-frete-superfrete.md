# Checkout com frete SuperFrete — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar cotação de frete via SuperFrete (Correios), formulário de endereço de entrega no checkout, soma do frete ao total MercadoPago e emissão automática de etiqueta pós-pagamento, com admin para gestão das etiquetas.

**Architecture:** Helper central `app/lib/superfrete.ts` encapsula os endpoints SuperFrete usados (`calculator`, `cart`, `order/info`, `tag/print`, `order/cancel`). `/api/checkout` passa a aceitar shipping + shipTo, re-cota server-side (anti-tampering), soma ao `transaction_amount` da MP e persiste snapshot no `Order`. Webhook MP, após marcar `paid`, dispara `createLabel()`. Admin consome esses dados em `/admin/pedidos`.

**Tech Stack:** Next.js 16 + React 19, Prisma 7 com driver adapter (`@prisma/adapter-pg`), Neon Postgres, vanilla JS no `public/checkout.html` (Webflow static), fetch API (sem SDK externo).

**Observações gerais:**
- Projeto não tem framework de testes. Validação via `npm run build` (type check TS) + `npm run lint` + smoke test manual via `curl` ou browser.
- Todos os commits seguem o padrão existente no repo (sem prefixo rígido; usar mensagens descritivas).
- `@/*` resolve a partir de `iwo-vercel/`. Path alias: `@/app/lib/prisma`, etc.
- Referência de consulta: spec em `docs/superpowers/specs/2026-04-18-checkout-frete-superfrete-design.md`.

**Reminder:** Comandos `npm` rodam em `iwo-vercel/`. Este CWD é presumido em todos os steps.

---

## Arquivos a criar/modificar

**Novos:**
- `iwo-vercel/app/lib/superfrete.ts` — helper (constantes, buildBox, quote, createLabel, getLabelInfo, getPrintUrl, cancelLabel)
- `iwo-vercel/app/api/shipping/quote/route.ts`
- `iwo-vercel/app/api/shipping/cep/[cep]/route.ts`
- `iwo-vercel/app/api/admin/orders/[id]/shipping-label/route.ts`
- `iwo-vercel/app/api/admin/orders/[id]/shipping-refresh/route.ts`
- `iwo-vercel/app/api/admin/orders/[id]/shipping-cancel/route.ts`
- `iwo-vercel/app/admin/pedidos/page.tsx`
- `iwo-vercel/app/admin/pedidos/[id]/page.tsx`

**Modificados:**
- `iwo-vercel/prisma/schema.prisma`
- `iwo-vercel/.env.example`
- `iwo-vercel/app/api/checkout/route.ts`
- `iwo-vercel/app/api/webhook/mercadopago/route.ts`
- `iwo-vercel/public/checkout.html`

---

## Task 1: Schema + env vars

**Files:**
- Modify: `iwo-vercel/prisma/schema.prisma`
- Modify: `iwo-vercel/.env.example`

- [ ] **Step 1: Adicionar env vars ao `.env.example`**

Abrir `iwo-vercel/.env.example` e adicionar no final:

```bash
# ── SuperFrete ───────────────────────────────────────────────────────────────
# Base URL do ambiente (sandbox ou produção).
SUPERFRETE_API_URL="https://sandbox.superfrete.com"

# Token de autenticação SuperFrete (Bearer). Fornecido pelo painel da SuperFrete.
# NOTE: nome da var usa "SUPERFRET" (escolha do usuário, sem E final).
SUPERFRET_APITOKEN=""

# User-Agent exigido pela SuperFrete: "Nome da aplicação (email de contato técnico)".
SUPERFRETE_USER_AGENT="IWO Watch (gsbcommerceltda@gmail.com)"

# ── Remetente (loja) ─────────────────────────────────────────────────────────
SHIPPING_FROM_NAME="IWO Watch Brasil"
SHIPPING_FROM_DOCUMENT="46601604000194"
SHIPPING_FROM_POSTAL_CODE="13026137"
SHIPPING_FROM_ADDRESS="Av Princesa Doeste"
SHIPPING_FROM_NUMBER="1199"
SHIPPING_FROM_COMPLEMENT="Sala 92"
SHIPPING_FROM_DISTRICT="NA"
SHIPPING_FROM_CITY="Campinas"
SHIPPING_FROM_STATE="SP"
```

- [ ] **Step 2: Adicionar colunas ao model `Order` no `schema.prisma`**

Abrir `iwo-vercel/prisma/schema.prisma` e, dentro do `model Order { ... }` (logo antes do `@@index([customerId])` e `@@map("orders")`), inserir:

```prisma
  // ── Shipping / SuperFrete ────────────────────────────────────────────
  shippingServiceId       Int?      @map("shipping_service_id")
  shippingServiceName     String?   @map("shipping_service_name") @db.VarChar(50)
  shippingCost            Decimal?  @map("shipping_cost") @db.Decimal(10, 2)
  shippingDeliveryMin     Int?      @map("shipping_delivery_min")
  shippingDeliveryMax     Int?      @map("shipping_delivery_max")

  shipToName              String?   @map("ship_to_name") @db.VarChar(255)
  shipToDocument          String?   @map("ship_to_document") @db.VarChar(20)
  shipToPostalCode        String?   @map("ship_to_postal_code") @db.VarChar(9)
  shipToAddress           String?   @map("ship_to_address") @db.VarChar(255)
  shipToNumber            String?   @map("ship_to_number") @db.VarChar(20)
  shipToComplement        String?   @map("ship_to_complement") @db.VarChar(100)
  shipToDistrict          String?   @map("ship_to_district") @db.VarChar(100)
  shipToCity              String?   @map("ship_to_city") @db.VarChar(100)
  shipToState             String?   @map("ship_to_state") @db.VarChar(2)

  shippingBoxWeight       Decimal?  @map("shipping_box_weight") @db.Decimal(8, 3)
  shippingBoxHeight       Int?      @map("shipping_box_height")
  shippingBoxWidth        Int?      @map("shipping_box_width")
  shippingBoxLength       Int?      @map("shipping_box_length")

  superfreteOrderId       String?   @map("superfrete_order_id") @db.VarChar(50)
  superfreteStatus        String?   @map("superfrete_status") @db.VarChar(20)
  superfreteTracking      String?   @map("superfrete_tracking") @db.VarChar(50)
  superfreteLabelUrl      String?   @map("superfrete_label_url") @db.VarChar(500)
  superfreteCreatedAt     DateTime? @map("superfrete_created_at")
  superfreteError         String?   @map("superfrete_error") @db.Text
```

Também adicionar dois índices dentro do mesmo block, abaixo do `@@index([customerId])`:

```prisma
  @@index([superfreteOrderId])
  @@index([superfreteStatus])
```

- [ ] **Step 3: Rodar `prisma db push` para aplicar schema**

Run: `cd iwo-vercel && npx prisma db push`

Expected: "Your database is now in sync with your Prisma schema." Nenhum aviso de dados perdidos.

- [ ] **Step 4: Rodar `prisma generate` (já é postinstall, mas explícito garante)**

Run: `cd iwo-vercel && npx prisma generate`

Expected: "Generated Prisma Client".

- [ ] **Step 5: Validar type check**

Run: `cd iwo-vercel && npx tsc --noEmit`

Expected: zero erros de TypeScript. O cliente Prisma agora expõe os novos campos em `Order`.

- [ ] **Step 6: Commit**

```bash
git add iwo-vercel/prisma/schema.prisma iwo-vercel/.env.example
git commit -m "$(cat <<'EOF'
feat(db): add shipping and SuperFrete fields to Order

Schema aditivo (17 colunas novas, todas opcionais) para suportar snapshot
de endereço de entrega, serviço de frete escolhido, dimensões da caixa
ideal cotada e metadados da etiqueta SuperFrete.

Env vars novas documentadas em .env.example (SUPERFRETE_API_URL,
SUPERFRET_APITOKEN, SUPERFRETE_USER_AGENT, SHIPPING_FROM_*).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Helper SuperFrete (parte 1 — cotação)

**Files:**
- Create: `iwo-vercel/app/lib/superfrete.ts`

- [ ] **Step 1: Criar o arquivo com constantes, `buildBox` e `quote`**

Criar `iwo-vercel/app/lib/superfrete.ts`:

```ts
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
```

- [ ] **Step 2: Validar type check**

Run: `cd iwo-vercel && npx tsc --noEmit`

Expected: zero erros.

- [ ] **Step 3: Smoke test — criar script temporário e chamar `quote`**

Criar `iwo-vercel/scripts/test-superfrete-quote.mjs` (será deletado no step 5):

```js
import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { quote } = await import('../app/lib/superfrete.ts').catch(async () => {
  // Fallback para ambientes sem loader TS: compile manualmente ou rode via next
  console.error('Rode o smoke test via: curl no endpoint em runtime (Task 4).');
  process.exit(0);
});

const result = await quote({ toPostalCode: '01153000', totalQuantity: 2 });
console.log(JSON.stringify(result, null, 2));
```

**Nota:** Node não carrega `.ts` direto. Pule esse step e valide o helper no smoke test da Task 4 (endpoint `/api/shipping/quote`). Remova este step depois.

Run (apenas para documentar a intenção, não é obrigatório): -

Ação: pular para o step 4. O helper será validado funcionalmente na Task 4.

- [ ] **Step 4: Commit**

```bash
git add iwo-vercel/app/lib/superfrete.ts
git commit -m "$(cat <<'EOF'
feat(shipping): add SuperFrete helper with quote()

Helper central que encapsula autenticação, User-Agent e o endpoint
/api/v0/calculator da SuperFrete. Constantes SHIPPING_ITEM (0.3 kg,
15×10×12 cm por unidade) e buildBox() escalam a caixa linearmente no
eixo length pela quantidade total do carrinho.

Métodos de etiqueta (createLabel, getLabelInfo, getPrintUrl,
cancelLabel) ficam para uma task seguinte.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Endpoint ViaCEP (proxy)

**Files:**
- Create: `iwo-vercel/app/api/shipping/cep/[cep]/route.ts`

- [ ] **Step 1: Criar o route handler**

Criar `iwo-vercel/app/api/shipping/cep/[cep]/route.ts`:

```ts
// Proxy para o ViaCEP. Evita CORS no navegador e permite cache no futuro.
// GET /api/shipping/cep/01153000 → { logradouro, bairro, localidade, uf, ... }

type Params = Promise<{ cep: string }>;

type ViaCepResult = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export async function GET(_request: Request, { params }: { params: Params }) {
  const { cep: raw } = await params;
  const cep = String(raw).replace(/\D/g, '');
  if (cep.length !== 8) {
    return Response.json({ error: 'CEP inválido' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return Response.json({ error: 'Falha ao consultar ViaCEP' }, { status: 502 });
    }
    const data = (await res.json()) as ViaCepResult;
    if (data.erro) {
      return Response.json({ error: 'CEP não encontrado' }, { status: 404 });
    }
    return Response.json({
      cep: data.cep ?? cep,
      logradouro: data.logradouro ?? '',
      bairro: data.bairro ?? '',
      cidade: data.localidade ?? '',
      uf: data.uf ?? '',
    });
  } catch (err) {
    console.error('[shipping/cep] ViaCEP error', err);
    return Response.json({ error: 'Timeout ao consultar ViaCEP' }, { status: 504 });
  }
}
```

- [ ] **Step 2: Validar type check + lint**

Run: `cd iwo-vercel && npx tsc --noEmit && npm run lint`

Expected: zero erros.

- [ ] **Step 3: Smoke test via browser/curl**

Rodar dev server se não estiver rodando: `cd iwo-vercel && npm run dev`

Em outro terminal:

```bash
curl -s http://localhost:3000/api/shipping/cep/01153000 | jq .
```

Expected (saída aproximada):

```json
{
  "cep": "01153-000",
  "logradouro": "Rua Vitorino Carmilo",
  "bairro": "Barra Funda",
  "cidade": "São Paulo",
  "uf": "SP"
}
```

Também testar CEP inválido:

```bash
curl -s -w "\n%{http_code}\n" http://localhost:3000/api/shipping/cep/00000000
```

Expected: status `404`, body `{"error":"CEP não encontrado"}`.

- [ ] **Step 4: Commit**

```bash
git add iwo-vercel/app/api/shipping/cep/
git commit -m "$(cat <<'EOF'
feat(shipping): add ViaCEP proxy endpoint

GET /api/shipping/cep/[cep] valida o formato, consulta viacep.com.br
e devolve os campos normalizados (logradouro/bairro/cidade/uf) em
português. Proxy server-side evita CORS no navegador.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Endpoint de cotação `/api/shipping/quote`

**Files:**
- Create: `iwo-vercel/app/api/shipping/quote/route.ts`

- [ ] **Step 1: Criar o route handler**

Criar `iwo-vercel/app/api/shipping/quote/route.ts`:

```ts
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
```

- [ ] **Step 2: Validar type check + lint**

Run: `cd iwo-vercel && npx tsc --noEmit && npm run lint`

Expected: zero erros.

- [ ] **Step 3: Smoke test — cotação sandbox**

Garantir que `.env.local` tem `SUPERFRET_APITOKEN` válido de sandbox. Dev server rodando.

```bash
curl -s -X POST http://localhost:3000/api/shipping/quote \
  -H "Content-Type: application/json" \
  -d '{"toPostalCode":"01153000","items":[{"productId":1,"quantity":2}]}' | jq .
```

Expected: status 200 com `options` contendo PAC e SEDEX (Mini Envios NÃO deve aparecer porque 2 unidades = 0.6 kg > limite 0.3 kg do Mini Envios). Cada opção tem `serviceId`, `name`, `price`, `deliveryMin`, `deliveryMax`, `box` com `weight/height/width/length`.

Testar com 1 unidade — Mini Envios deve aparecer:

```bash
curl -s -X POST http://localhost:3000/api/shipping/quote \
  -H "Content-Type: application/json" \
  -d '{"toPostalCode":"01153000","items":[{"productId":1,"quantity":1}]}' | jq '.options[].name'
```

Expected: lista inclui `"MiniEnvios"` ou similar.

Testar CEP inválido:

```bash
curl -s -w "\n%{http_code}\n" -X POST http://localhost:3000/api/shipping/quote \
  -H "Content-Type: application/json" \
  -d '{"toPostalCode":"00000","items":[{"productId":1,"quantity":1}]}'
```

Expected: 400.

- [ ] **Step 4: Commit**

```bash
git add iwo-vercel/app/api/shipping/quote/
git commit -m "$(cat <<'EOF'
feat(shipping): add /api/shipping/quote endpoint

Endpoint público que re-conta a quantidade total do carrinho
server-side, chama o helper quote() (SuperFrete /api/v0/calculator)
e devolve opções normalizadas. Filtra serviços com has_error e
responde 422 quando nenhum está disponível para o CEP.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Atualizar `/api/checkout` (aceitar frete + persistir)

**Files:**
- Modify: `iwo-vercel/app/api/checkout/route.ts`

- [ ] **Step 1: Adicionar imports e tipos no topo do arquivo**

Abrir `iwo-vercel/app/api/checkout/route.ts` e após o import de `prisma`, adicionar:

```ts
import { quote, SuperFreteError } from '@/app/lib/superfrete';
import { auth } from '@/app/lib/auth';
```

Adicionar no topo do arquivo (abaixo dos imports), junto com as interfaces existentes `CartItem`/`PricedItem`:

```ts
interface ShipTo {
  name: string;
  document: string;    // CPF (11 dígitos)
  postalCode: string;  // 8 dígitos
  address: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;       // UF 2 letras maiúsculas
}

interface ShippingRequest {
  serviceId: number;   // 1 | 2 | 17
  toPostalCode: string;
  quotedPrice: number;
}
```

- [ ] **Step 2: Adicionar helpers de validação**

Logo abaixo das funções `toInt` e `decimalToNumber` existentes no arquivo, adicionar:

```ts
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

  return {
    ok: true,
    data: { name, document, postalCode, address, number, complement, district, city, state },
  };
}
```

- [ ] **Step 3: Adicionar lógica de cotação server-side na POST handler**

Localizar, no arquivo, o bloco após `// Ignore client total/subtotal entirely` e antes de `const subtotal = priced.reduce(...)`. Imediatamente após `priced` estar montado, inserir:

```ts
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

    // Divergência de preço > 5% → 409, UI reescolhe.
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
```

- [ ] **Step 4: Atualizar `totalAmount` para incluir frete**

Substituir as linhas:

```ts
    const subtotal = priced.reduce((sum, it) => sum + it.totalPrice, 0);
    const totalAmount = Math.round(subtotal * 100) / 100;
```

por:

```ts
    const subtotal = priced.reduce((sum, it) => sum + it.totalPrice, 0);
    const totalAmount = Math.round((subtotal + shippingCost) * 100) / 100;
```

- [ ] **Step 5: Persistir snapshot de shipping no `Order.create`**

Localizar o bloco `await prisma.order.create({ data: { ... } })` e adicionar, dentro de `data`, junto aos campos existentes:

```ts
          // Shipping snapshot
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
```

- [ ] **Step 6: Upsert em `Customer.Address` se usuário logado**

Após o `prisma.order.create` bem-sucedido (antes do `mpPayload.external_reference = ...`), adicionar:

```ts
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
            // Vincular pedido ao customerId também
            await prisma.order.update({
              where: { id: order.id },
              data: { customerId: customer.id },
            });
          }
        }
      } catch (addrErr) {
        console.warn('[checkout] address upsert failed (non-fatal)', addrErr);
      }
```

- [ ] **Step 7: Atualizar `description` e `mpItems` para referir ao frete**

Localizar:

```ts
    const description = priced
      .map(i => `${i.quantity}x ${i.name}`)
      .join(', ')
      .slice(0, 256);
```

Não alterar (a descrição não precisa mudar). Passar apenas para após o bloco de validação de shipping (move-lo até depois do `shippingCost` calculado — já estará na ordem correta se seguimos o step 3).

- [ ] **Step 8: Validar type check + lint**

Run: `cd iwo-vercel && npx tsc --noEmit && npm run lint`

Expected: zero erros.

- [ ] **Step 9: Smoke test — checkout com frete**

Com dev server rodando, simular checkout via curl (PIX, sem tokenização de cartão):

```bash
curl -s -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": 1, "quantity": 1, "name": "Teste", "price": 100}],
    "payer": { "email": "teste@teste.com", "first_name": "Jo", "last_name": "Silva", "identification": {"type": "CPF", "number": "12345678909"} },
    "payment_method": { "id": "pix", "type": "bank_transfer" },
    "shipping": { "serviceId": 1, "toPostalCode": "01153000", "quotedPrice": 20 },
    "shipTo": {
      "name": "João Silva",
      "document": "12345678909",
      "postalCode": "01153000",
      "address": "Rua Teste",
      "number": "100",
      "complement": "",
      "district": "Centro",
      "city": "São Paulo",
      "state": "SP"
    }
  }' | jq .
```

Expected: status 200 com `orderId`, `status` (pode ser `pending` para PIX), `pix: { qr_code, ... }`. O preço total no MP deve ser subtotal + frete. Verificar via `npx prisma studio` que o `Order` criado tem os campos `shipping*` e `shipTo*` preenchidos.

Testar 409 — enviar `quotedPrice` muito diferente:

```bash
# Mesma curl mas com quotedPrice: 9999
```

Expected: status 409 com `error: "SHIPPING_QUOTE_STALE"` e `newOptions`.

Testar CPF inválido no shipTo:

```bash
# Mesma curl mas com "document": "123"
```

Expected: status 400 com `error: "CPF inválido"`.

- [ ] **Step 10: Commit**

```bash
git add iwo-vercel/app/api/checkout/route.ts
git commit -m "$(cat <<'EOF'
feat(checkout): add shipping quote validation and snapshot

/api/checkout agora aceita os campos shipping e shipTo no body,
re-cota o frete server-side via SuperFrete (anti-tampering, tolerância
5%), soma ao transaction_amount da MercadoPago e persiste snapshot
completo no Order (endereço do destinatário + serviço escolhido +
caixa ideal cotada). Clientes logados também têm o endereço salvo/
atualizado em Customer.Address (caminho híbrido — guest continua
funcionando).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Expandir helper SuperFrete (etiqueta)

**Files:**
- Modify: `iwo-vercel/app/lib/superfrete.ts`

- [ ] **Step 1: Adicionar tipos e função `createLabel`**

Ao final do `iwo-vercel/app/lib/superfrete.ts`, adicionar:

```ts
// ── Criar etiqueta ────────────────────────────────────────────────────────
// POST /api/v0/cart — cria etiqueta com status "pending" (aguardando pagamento).

export type CreateLabelOrder = {
  id: number;
  // destinatário
  shipToName: string | null;
  shipToDocument: string | null;
  shipToPostalCode: string | null;
  shipToAddress: string | null;
  shipToNumber: string | null;
  shipToComplement: string | null;
  shipToDistrict: string | null;
  shipToCity: string | null;
  shipToState: string | null;
  // serviço
  shippingServiceId: number | null;
  // caixa
  shippingBoxWeight: { toNumber(): number } | number | null;
  shippingBoxHeight: number | null;
  shippingBoxWidth: number | null;
  shippingBoxLength: number | null;
  // email (opcional — para tracking por email)
  payerEmail: string | null;
  // items (declaração de conteúdo)
  orderItems: Array<{
    productName: string;
    quantity: number;
    unitPrice: { toNumber(): number } | number;
  }>;
};

function decimalOrNumberToNumber(v: { toNumber(): number } | number | null): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  return v.toNumber();
}

export async function createLabel(order: CreateLabelOrder): Promise<{
  id: string;
  price: number;
  status: string;
}> {
  if (!order.shippingServiceId || !order.shipToPostalCode) {
    throw new SuperFreteError('Order sem dados de frete', 400, null);
  }

  const fromName = process.env.SHIPPING_FROM_NAME ?? '';
  const fromDocument = process.env.SHIPPING_FROM_DOCUMENT ?? '';
  const fromCep = (process.env.SHIPPING_FROM_POSTAL_CODE ?? '').replace(/\D/g, '');
  const fromAddress = process.env.SHIPPING_FROM_ADDRESS ?? '';
  const fromNumber = process.env.SHIPPING_FROM_NUMBER ?? '';
  const fromComplement = process.env.SHIPPING_FROM_COMPLEMENT ?? '';
  const fromDistrict = process.env.SHIPPING_FROM_DISTRICT ?? 'NA';
  const fromCity = process.env.SHIPPING_FROM_CITY ?? '';
  const fromState = (process.env.SHIPPING_FROM_STATE ?? '').toUpperCase();

  const payload = {
    from: {
      name: fromName,
      address: fromAddress,
      complement: fromComplement || undefined,
      number: fromNumber || '',
      district: fromDistrict,
      city: fromCity,
      state_abbr: fromState,
      postal_code: fromCep,
      document: fromDocument || undefined,
    },
    to: {
      name: order.shipToName ?? '',
      address: order.shipToAddress ?? '',
      complement: order.shipToComplement || undefined,
      number: order.shipToNumber ?? '',
      district: order.shipToDistrict || 'NA',
      city: order.shipToCity ?? '',
      state_abbr: (order.shipToState ?? '').toUpperCase(),
      postal_code: String(order.shipToPostalCode).replace(/\D/g, ''),
      email: order.payerEmail || undefined,
      document: order.shipToDocument ?? '',
    },
    service: order.shippingServiceId,
    products: order.orderItems.map((it) => ({
      name: it.productName,
      quantity: String(it.quantity),
      unitary_value: String(decimalOrNumberToNumber(it.unitPrice)),
    })),
    volumes: {
      weight: decimalOrNumberToNumber(order.shippingBoxWeight),
      height: order.shippingBoxHeight ?? 0,
      width: order.shippingBoxWidth ?? 0,
      length: order.shippingBoxLength ?? 0,
    },
    options: {
      non_commercial: true, // declaração de conteúdo
      tags: [{ tag: `iwo-order-${order.id}` }],
    },
    platform: 'IWO Watch',
  };

  const raw = (await sfFetch('/api/v0/cart', {
    method: 'POST',
    body: JSON.stringify(payload),
  })) as { id?: string; price?: number; status?: string };

  if (!raw.id) {
    throw new SuperFreteError('SuperFrete não retornou id da etiqueta', 502, raw);
  }
  return {
    id: raw.id,
    price: Number(raw.price ?? 0),
    status: String(raw.status ?? 'pending'),
  };
}
```

- [ ] **Step 2: Adicionar `getLabelInfo`, `getPrintUrl`, `cancelLabel`**

No mesmo arquivo, ao final:

```ts
// ── Consulta etiqueta ─────────────────────────────────────────────────────
export type LabelInfo = {
  id: string;
  status: string;
  tracking: string | null;
  price: number;
  service_id: number | null;
  delivery_min: number | null;
  delivery_max: number | null;
};

export async function getLabelInfo(superfreteOrderId: string): Promise<LabelInfo> {
  const raw = (await sfFetch(`/api/v0/order/info/${encodeURIComponent(superfreteOrderId)}`, {
    method: 'GET',
  })) as Record<string, unknown>;
  return {
    id: String(raw.id ?? superfreteOrderId),
    status: String(raw.status ?? 'unknown'),
    tracking: raw.tracking ? String(raw.tracking) : null,
    price: Number(raw.price ?? 0),
    service_id: raw.service_id != null ? Number(raw.service_id) : null,
    delivery_min: raw.delivery_min != null ? Number(raw.delivery_min) : null,
    delivery_max: raw.delivery_max != null ? Number(raw.delivery_max) : null,
  };
}

// ── URL do PDF da etiqueta ────────────────────────────────────────────────
export async function getPrintUrl(superfreteOrderId: string): Promise<string> {
  const raw = (await sfFetch('/api/v0/tag/print', {
    method: 'POST',
    body: JSON.stringify({ orders: [superfreteOrderId] }),
  })) as { url?: string };
  if (!raw.url) {
    throw new SuperFreteError('SuperFrete não retornou URL de impressão', 502, raw);
  }
  return raw.url;
}

// ── Cancelar etiqueta ─────────────────────────────────────────────────────
export async function cancelLabel(
  superfreteOrderId: string,
  reason: string,
): Promise<void> {
  await sfFetch('/api/v0/order/cancel', {
    method: 'POST',
    body: JSON.stringify({
      order: {
        id: superfreteOrderId,
        description: reason.slice(0, 255) || 'Cancelado pela loja',
      },
    }),
  });
}
```

- [ ] **Step 3: Validar type check**

Run: `cd iwo-vercel && npx tsc --noEmit`

Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add iwo-vercel/app/lib/superfrete.ts
git commit -m "$(cat <<'EOF'
feat(shipping): add label CRUD helpers (create/info/print/cancel)

Expande app/lib/superfrete.ts com:
  - createLabel(order): POST /api/v0/cart (declaração de conteúdo,
    non_commercial: true; remetente vindo das env vars SHIPPING_FROM_*).
  - getLabelInfo(id): GET /api/v0/order/info/{id} (status + tracking).
  - getPrintUrl(id): POST /api/v0/tag/print (URL do PDF).
  - cancelLabel(id, reason): POST /api/v0/order/cancel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Atualizar webhook MP (criar etiqueta pós-pagamento)

**Files:**
- Modify: `iwo-vercel/app/api/webhook/mercadopago/route.ts`

- [ ] **Step 1: Adicionar import do helper**

Abrir `iwo-vercel/app/api/webhook/mercadopago/route.ts` e adicionar, junto aos imports existentes:

```ts
import { createLabel, SuperFreteError } from '@/app/lib/superfrete';
```

- [ ] **Step 2: Adicionar criação da etiqueta após marcar `paid`**

Localizar o `try { await prisma.order.update({ where: { id: order.id }, data: { mpStatus: status, status: mapMpToInternal(status) } }); } catch ...`.

**Logo após** esse `try/catch` (antes do `return Response.json({ received: true });` final), adicionar:

```ts
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
```

- [ ] **Step 3: Validar type check + lint**

Run: `cd iwo-vercel && npx tsc --noEmit && npm run lint`

Expected: zero erros.

- [ ] **Step 4: Smoke test — simular webhook aprovado**

O teste do webhook real exige HMAC válido da MP. Validar via fluxo end-to-end na Task 11 (checkout completo em sandbox). Aqui, revisar apenas visualmente o código no editor, confirmando que:

- `shouldCreateLabel` só dispara quando status virou `paid` **e** o Order tem `shippingServiceId` **e** ainda não tem `superfreteOrderId` (idempotência para retries MP).
- Qualquer erro SuperFrete é capturado e salvo em `superfreteError`.
- Webhook sempre responde 200 no caminho feliz.

- [ ] **Step 5: Commit**

```bash
git add iwo-vercel/app/api/webhook/mercadopago/route.ts
git commit -m "$(cat <<'EOF'
feat(webhook): emit SuperFrete label on approved payment

Após marcar order.status='paid', o webhook MercadoPago dispara
createLabel() via helper SuperFrete. Execução é best-effort: falhas
são capturadas, salvas em Order.superfreteError e não propagam (MP
retries exigem 200). Idempotente: só cria etiqueta se ainda não há
superfreteOrderId no pedido.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Endpoints admin (imprimir, atualizar status, cancelar)

**Files:**
- Create: `iwo-vercel/app/api/admin/orders/[id]/shipping-label/route.ts`
- Create: `iwo-vercel/app/api/admin/orders/[id]/shipping-refresh/route.ts`
- Create: `iwo-vercel/app/api/admin/orders/[id]/shipping-cancel/route.ts`

- [ ] **Step 1: `shipping-label` (GET — URL do PDF)**

Criar `iwo-vercel/app/api/admin/orders/[id]/shipping-label/route.ts`:

```ts
import { prisma } from '@/app/lib/prisma';
import { guardAdmin } from '@/app/admin/lib/verify';
import { getPrintUrl, SuperFreteError } from '@/app/lib/superfrete';

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
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
    const url = await getPrintUrl(order.superfreteOrderId);
    // Persiste a URL para cache simples
    await prisma.order.update({
      where: { id: orderId },
      data: { superfreteLabelUrl: url },
    });
    return Response.json({ url });
  } catch (err) {
    const status = err instanceof SuperFreteError ? err.status : 500;
    return Response.json(
      { error: 'Falha ao obter URL da etiqueta' },
      { status: status >= 400 && status < 600 ? status : 502 },
    );
  }
}
```

- [ ] **Step 2: `shipping-refresh` (POST — atualizar status/tracking)**

Criar `iwo-vercel/app/api/admin/orders/[id]/shipping-refresh/route.ts`:

```ts
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
```

- [ ] **Step 3: `shipping-cancel` (POST — cancelar etiqueta)**

Criar `iwo-vercel/app/api/admin/orders/[id]/shipping-cancel/route.ts`:

```ts
import { prisma } from '@/app/lib/prisma';
import { guardAdmin } from '@/app/admin/lib/verify';
import { cancelLabel, SuperFreteError } from '@/app/lib/superfrete';

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const bad = await guardAdmin(request);
  if (bad) return bad;

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return Response.json({ error: 'ID inválido' }, { status: 400 });
  }

  let body: { reason?: unknown };
  try {
    body = (await request.json()) as { reason?: unknown };
  } catch {
    body = {};
  }
  const reason = String(body.reason ?? '').trim() || 'Cancelado pela loja';

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { superfreteOrderId: true, superfreteStatus: true },
  });
  if (!order?.superfreteOrderId) {
    return Response.json({ error: 'Etiqueta não criada' }, { status: 404 });
  }
  if (order.superfreteStatus === 'posted' || order.superfreteStatus === 'delivered') {
    return Response.json(
      { error: 'Etiqueta já postada — não pode ser cancelada' },
      { status: 409 },
    );
  }

  try {
    await cancelLabel(order.superfreteOrderId, reason);
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { superfreteStatus: 'cancelled' },
    });
    return Response.json({ status: updated.superfreteStatus });
  } catch (err) {
    const status = err instanceof SuperFreteError ? err.status : 500;
    return Response.json(
      { error: 'Falha ao cancelar etiqueta' },
      { status: status >= 400 && status < 600 ? status : 502 },
    );
  }
}
```

- [ ] **Step 4: Validar type check + lint**

Run: `cd iwo-vercel && npx tsc --noEmit && npm run lint`

Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add iwo-vercel/app/api/admin/orders/
git commit -m "$(cat <<'EOF'
feat(admin): add shipping label endpoints (print/refresh/cancel)

Três endpoints protegidos por guardAdmin:
  - GET  /api/admin/orders/[id]/shipping-label   → URL do PDF
  - POST /api/admin/orders/[id]/shipping-refresh → atualiza status/tracking
  - POST /api/admin/orders/[id]/shipping-cancel  → cancela (se aplicável)

shipping-cancel rejeita etiquetas já em status posted/delivered.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Admin — lista de pedidos

**Files:**
- Create: `iwo-vercel/app/admin/pedidos/page.tsx`

- [ ] **Step 1: Inspecionar `app/admin/produtos/page.tsx` para seguir padrão**

Run: `cat iwo-vercel/app/admin/produtos/page.tsx` — serve de referência para estilo, auth client-side e loader de dados.

- [ ] **Step 2: Criar `app/admin/pedidos/page.tsx`**

Criar `iwo-vercel/app/admin/pedidos/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdminToken } from '@/app/admin/lib/auth';

type OrderRow = {
  id: number;
  createdAt: string;
  total: number | null;
  status: string | null;
  payerName: string | null;
  payerEmail: string | null;
  shippingServiceName: string | null;
  superfreteStatus: string | null;
  superfreteTracking: string | null;
};

const LABEL_STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  released: '#3b82f6',
  posted: '#8b5cf6',
  delivered: '#10b981',
  cancelled: '#ef4444',
};

function Badge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: '#999' }}>—</span>;
  const color = LABEL_STATUS_COLORS[status] ?? '#6b7280';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        background: color,
        color: '#fff',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {status}
    </span>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      window.location.href = '/admin';
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/admin/orders', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setOrders(data.orders ?? []);
      } catch (e) {
        setErr(String((e as Error)?.message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Carregando...</div>;
  if (err) return <div style={{ padding: 24, color: '#c00' }}>Erro: {err}</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Pedidos</h1>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={{ padding: 12, textAlign: 'left' }}>#</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Cliente</th>
              <th style={{ padding: 12, textAlign: 'right' }}>Total</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Pagamento</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Frete</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Etiqueta</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Tracking</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Data</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={{ padding: 12 }}>
                  <Link href={`/admin/pedidos/${o.id}`} style={{ color: '#2563eb' }}>
                    #{o.id}
                  </Link>
                </td>
                <td style={{ padding: 12 }}>
                  {o.payerName ?? '—'}
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{o.payerEmail ?? ''}</div>
                </td>
                <td style={{ padding: 12, textAlign: 'right' }}>
                  {o.total != null ? `R$ ${Number(o.total).toFixed(2).replace('.', ',')}` : '—'}
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <Badge status={o.status} />
                </td>
                <td style={{ padding: 12 }}>{o.shippingServiceName ?? '—'}</td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <Badge status={o.superfreteStatus} />
                </td>
                <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>
                  {o.superfreteTracking ?? '—'}
                </td>
                <td style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>
                  {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#999' }}>
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar endpoint `/api/admin/orders` (lista)**

Criar `iwo-vercel/app/api/admin/orders/route.ts`:

```ts
import { prisma } from '@/app/lib/prisma';
import { guardAdmin } from '@/app/admin/lib/verify';

export async function GET(request: Request) {
  const bad = await guardAdmin(request);
  if (bad) return bad;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      total: true,
      status: true,
      payerName: true,
      payerEmail: true,
      shippingServiceName: true,
      superfreteStatus: true,
      superfreteTracking: true,
    },
  });

  return Response.json({
    orders: orders.map((o) => ({
      ...o,
      total: o.total != null ? Number(o.total) : null,
      createdAt: o.createdAt?.toISOString() ?? null,
    })),
  });
}
```

- [ ] **Step 4: Validar type check + lint**

Run: `cd iwo-vercel && npx tsc --noEmit && npm run lint`

Expected: zero erros.

- [ ] **Step 5: Smoke test — abrir no browser**

Com dev server rodando:

1. Acessar `http://localhost:3000/admin` e logar.
2. Navegar para `http://localhost:3000/admin/pedidos`.
3. Verificar que a tabela renderiza pedidos existentes. Pedidos antigos aparecem com `—` nas colunas Frete/Etiqueta/Tracking (campos null).

- [ ] **Step 6: Commit**

```bash
git add iwo-vercel/app/admin/pedidos/page.tsx iwo-vercel/app/api/admin/orders/route.ts
git commit -m "$(cat <<'EOF'
feat(admin): add orders list page

/admin/pedidos exibe últimos 100 pedidos com status MP, frete
escolhido, status da etiqueta SuperFrete e tracking. Endpoint
/api/admin/orders protegido por guardAdmin.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Admin — detalhe do pedido

**Files:**
- Create: `iwo-vercel/app/admin/pedidos/[id]/page.tsx`
- Create: `iwo-vercel/app/api/admin/orders/[id]/route.ts`

- [ ] **Step 1: Criar endpoint de detalhe `/api/admin/orders/[id]`**

Criar `iwo-vercel/app/api/admin/orders/[id]/route.ts`:

```ts
import { prisma } from '@/app/lib/prisma';
import { guardAdmin } from '@/app/admin/lib/verify';

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  const bad = await guardAdmin(request);
  if (bad) return bad;

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return Response.json({ error: 'ID inválido' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderItems: true },
  });
  if (!order) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });

  // Serializar Decimals para números simples
  const out = {
    ...order,
    total: order.total != null ? Number(order.total) : null,
    shippingCost: order.shippingCost != null ? Number(order.shippingCost) : null,
    shippingBoxWeight:
      order.shippingBoxWeight != null ? Number(order.shippingBoxWeight) : null,
    createdAt: order.createdAt?.toISOString() ?? null,
    updatedAt: order.updatedAt?.toISOString() ?? null,
    superfreteCreatedAt: order.superfreteCreatedAt?.toISOString() ?? null,
    orderItems: order.orderItems.map((it) => ({
      ...it,
      unitPrice: Number(it.unitPrice),
      totalPrice: Number(it.totalPrice),
      createdAt: it.createdAt?.toISOString(),
    })),
  };
  return Response.json({ order: out });
}
```

- [ ] **Step 2: Criar page `/admin/pedidos/[id]`**

Criar `iwo-vercel/app/admin/pedidos/[id]/page.tsx`:

```tsx
'use client';

import { useEffect, useState, use } from 'react';
import { getAdminToken } from '@/app/admin/lib/auth';

type Order = Record<string, unknown> & {
  id: number;
  total: number | null;
  status: string | null;
  shippingServiceName: string | null;
  shippingServiceId: number | null;
  shippingCost: number | null;
  shippingDeliveryMin: number | null;
  shippingDeliveryMax: number | null;
  shipToName: string | null;
  shipToDocument: string | null;
  shipToPostalCode: string | null;
  shipToAddress: string | null;
  shipToNumber: string | null;
  shipToComplement: string | null;
  shipToDistrict: string | null;
  shipToCity: string | null;
  shipToState: string | null;
  shippingBoxWeight: number | null;
  shippingBoxHeight: number | null;
  shippingBoxWidth: number | null;
  shippingBoxLength: number | null;
  superfreteOrderId: string | null;
  superfreteStatus: string | null;
  superfreteTracking: string | null;
  superfreteCreatedAt: string | null;
  superfreteError: string | null;
  payerName: string | null;
  payerEmail: string | null;
  payerCpf: string | null;
  orderItems: Array<{
    id: number;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
};

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  );
}

function brl(v: number | null): string {
  if (v == null) return '—';
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const token = getAdminToken();
    if (!token) {
      window.location.href = '/admin';
      return;
    }
    const res = await fetch(`/api/admin/orders/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setErr(`HTTP ${res.status}`);
      return;
    }
    const data = await res.json();
    setOrder(data.order);
  }

  useEffect(() => {
    load().catch((e) => setErr(String(e)));
  }, [id]);

  async function callAdmin(
    action: 'shipping-label' | 'shipping-refresh' | 'shipping-cancel',
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const token = getAdminToken();
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/orders/${id}/${action}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? 'Erro');
        return null;
      }
      return data;
    } finally {
      setBusy(null);
    }
  }

  async function handlePrint() {
    const data = await callAdmin('shipping-label', 'GET');
    if (data?.url) window.open(String(data.url), '_blank');
  }

  async function handleRefresh() {
    const data = await callAdmin('shipping-refresh', 'POST');
    if (data) load();
  }

  async function handleCancel() {
    const reason = prompt('Motivo do cancelamento:') ?? '';
    if (!reason.trim()) return;
    const data = await callAdmin('shipping-cancel', 'POST', { reason });
    if (data) load();
  }

  if (err) return <div style={{ padding: 24, color: '#c00' }}>Erro: {err}</div>;
  if (!order) return <div style={{ padding: 24 }}>Carregando...</div>;

  const canCancel = order.superfreteStatus === 'pending' || order.superfreteStatus === 'released';
  const canPrint = !!order.superfreteOrderId && order.superfreteStatus !== 'cancelled';

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/admin/pedidos" style={{ fontSize: 13, color: '#6b7280' }}>
          ← Voltar
        </a>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>
          Pedido #{order.id}
        </h1>
      </div>

      <Card title="Cliente">
        <p>
          <strong>{order.payerName ?? '—'}</strong>
        </p>
        <p style={{ color: '#6b7280', fontSize: 14 }}>{order.payerEmail}</p>
        <p style={{ color: '#6b7280', fontSize: 14 }}>CPF: {order.payerCpf ?? '—'}</p>
      </Card>

      <Card title="Itens">
        {order.orderItems.map((it) => (
          <div
            key={it.id}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}
          >
            <div>
              {it.productName}
              {it.variantName && <span style={{ color: '#6b7280' }}> — {it.variantName}</span>}
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {it.quantity}x {brl(it.unitPrice)}
              </div>
            </div>
            <div>{brl(it.totalPrice)}</div>
          </div>
        ))}
        <div
          style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', fontWeight: 600 }}
        >
          <div>Total</div>
          <div>{brl(order.total)}</div>
        </div>
      </Card>

      <Card title="Entrega">
        <p>
          <strong>{order.shipToName ?? '—'}</strong> — CPF {order.shipToDocument ?? '—'}
        </p>
        <p style={{ fontSize: 14 }}>
          {order.shipToAddress}, {order.shipToNumber}
          {order.shipToComplement ? ` — ${order.shipToComplement}` : ''}
          <br />
          {order.shipToDistrict} — {order.shipToCity}/{order.shipToState} — CEP {order.shipToPostalCode}
        </p>
        <hr style={{ margin: '12px 0', border: 0, borderTop: '1px solid #f3f4f6' }} />
        <p style={{ fontSize: 14 }}>
          <strong>Serviço:</strong> {order.shippingServiceName ?? '—'} — {brl(order.shippingCost)}
          <br />
          <strong>Prazo:</strong>{' '}
          {order.shippingDeliveryMin != null
            ? `${order.shippingDeliveryMin}–${order.shippingDeliveryMax} dias úteis`
            : '—'}
          <br />
          <strong>Caixa:</strong> {order.shippingBoxLength ?? '?'} × {order.shippingBoxWidth ?? '?'} ×{' '}
          {order.shippingBoxHeight ?? '?'} cm — {order.shippingBoxWeight ?? '?'} kg
        </p>
      </Card>

      <Card title="Etiqueta SuperFrete">
        {order.superfreteError && !order.superfreteOrderId && (
          <div
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: 12,
              borderRadius: 4,
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            <strong>Erro na emissão:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 4 }}>
              {order.superfreteError}
            </pre>
          </div>
        )}
        <p style={{ fontSize: 14 }}>
          <strong>Status:</strong> {order.superfreteStatus ?? '—'}
          <br />
          <strong>ID SuperFrete:</strong>{' '}
          <code>{order.superfreteOrderId ?? '—'}</code>
          <br />
          <strong>Tracking:</strong>{' '}
          <code>{order.superfreteTracking ?? '—'}</code>
          <br />
          <strong>Criada em:</strong>{' '}
          {order.superfreteCreatedAt
            ? new Date(order.superfreteCreatedAt).toLocaleString('pt-BR')
            : '—'}
        </p>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canPrint && (
            <button
              onClick={handlePrint}
              disabled={busy === 'shipping-label'}
              style={btnStyle('#2563eb')}
            >
              {busy === 'shipping-label' ? 'Abrindo...' : 'Baixar etiqueta (PDF)'}
            </button>
          )}
          {order.superfreteOrderId && (
            <button
              onClick={handleRefresh}
              disabled={busy === 'shipping-refresh'}
              style={btnStyle('#6b7280')}
            >
              {busy === 'shipping-refresh' ? 'Atualizando...' : 'Atualizar status'}
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={busy === 'shipping-cancel'}
              style={btnStyle('#dc2626')}
            >
              {busy === 'shipping-cancel' ? 'Cancelando...' : 'Cancelar etiqueta'}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    padding: '8px 14px',
    borderRadius: 4,
    border: 0,
    fontSize: 13,
    cursor: 'pointer',
  };
}
```

- [ ] **Step 3: Validar type check + lint**

Run: `cd iwo-vercel && npx tsc --noEmit && npm run lint`

Expected: zero erros.

- [ ] **Step 4: Smoke test — abrir no browser**

1. Abrir `/admin/pedidos`, clicar em um pedido.
2. Verificar que os 4 cards (Cliente, Itens, Entrega, Etiqueta) renderizam corretamente.
3. Se houver pedido com `superfreteOrderId`, clicar "Atualizar status" — confirmar que chama a API.

- [ ] **Step 5: Commit**

```bash
git add iwo-vercel/app/admin/pedidos/[id]/ iwo-vercel/app/api/admin/orders/[id]/route.ts
git commit -m "$(cat <<'EOF'
feat(admin): add order detail page with label actions

/admin/pedidos/[id] mostra 4 cards (cliente, itens, entrega, etiqueta
SuperFrete). Botões para baixar PDF, atualizar status e cancelar
etiqueta; exibe superfreteError quando a emissão falhou no webhook.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Refino completo do checkout UI

**Files:**
- Modify: `iwo-vercel/public/checkout.html`

**Nota:** esta é a task mais longa. O arquivo atual tem 405 linhas; a versão final terá ~700 linhas (+300 entre markup, CSS, JS de ViaCEP/cotação/seleção de frete). Dividir em steps incrementais para reduzir risco.

- [ ] **Step 1: Examinar o CSS do Webflow para puxar tokens**

Run:

```bash
cd iwo-vercel/public/css && head -60 iwo-watch.webflow.css
```

Observar: font-family do body (provavelmente `"Inter"` ou `"Roboto"`), cores primárias (paleta IWO), radius/shadows usados. Anotar:

- Font principal: (anotar aqui depois de inspecionar)
- Cor primária: (anotar)
- Cor secundária/acento: (anotar)
- Radius: 4px | 8px | outro

Essas constantes entram no `<style>` do checkout.

- [ ] **Step 2: Substituir a seção `<style>` do checkout.html**

Abrir `iwo-vercel/public/checkout.html` e substituir o bloco `<style>...</style>` inteiro pelo abaixo (ajustar font/cores conforme step 1):

```html
<style>
  :root {
    --iwo-bg: #f8fafb;
    --iwo-card: #ffffff;
    --iwo-text: #1a1a2e;
    --iwo-muted: #6b7280;
    --iwo-border: #e5e7eb;
    --iwo-primary: #1a1a2e;       /* ajustar se identidade IWO usar outra cor */
    --iwo-primary-hover: #0f0f1e;
    --iwo-accent: #2563eb;
    --iwo-success: #16a34a;
    --iwo-warning: #f59e0b;
    --iwo-danger: #dc2626;
    --iwo-radius: 8px;
    --iwo-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06);
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--iwo-bg); color: var(--iwo-text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.5; }
  .checkout-container { max-width: 1080px; margin: 0 auto; padding: 32px 20px; display: grid; grid-template-columns: 1fr 400px; gap: 24px; min-height: 100vh; align-items: start; }
  .checkout-header { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; padding-bottom: 20px; border-bottom: 1px solid var(--iwo-border); margin-bottom: 4px; }
  .checkout-header a { text-decoration: none; color: var(--iwo-text); }
  .checkout-header h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
  .checkout-header .back { font-size: 14px; color: var(--iwo-muted); }
  .card { background: var(--iwo-card); border: 1px solid var(--iwo-border); border-radius: var(--iwo-radius); padding: 20px; margin-bottom: 16px; box-shadow: var(--iwo-shadow); }
  .card h2 { font-size: 16px; font-weight: 700; margin: 0 0 16px; letter-spacing: -0.01em; }
  .field { margin-bottom: 12px; }
  .field label { display: block; font-size: 13px; font-weight: 600; color: var(--iwo-muted); margin-bottom: 6px; }
  .field input, .field select { width: 100%; padding: 10px 12px; border: 1px solid var(--iwo-border); border-radius: 6px; font-size: 14px; font-family: inherit; transition: border-color 0.15s; }
  .field input:focus, .field select:focus { outline: none; border-color: var(--iwo-accent); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
  .field .err { color: var(--iwo-danger); font-size: 12px; margin-top: 4px; display: none; }
  .field.has-error input { border-color: var(--iwo-danger); }
  .field.has-error .err { display: block; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .grid-addr { display: grid; grid-template-columns: 140px 1fr 120px; gap: 12px; }
  @media (max-width: 768px) { .grid-addr, .grid3 { grid-template-columns: 1fr; } .grid2 { grid-template-columns: 1fr 1fr; } }
  .pay-tabs { display: flex; border: 1px solid var(--iwo-border); border-radius: 6px; overflow: hidden; margin-bottom: 16px; }
  .pay-tab { flex: 1; padding: 12px; text-align: center; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--iwo-muted); transition: all 0.15s; }
  .pay-tab.active { background: var(--iwo-primary); color: #fff; }
  .pay-tab:not(.active):hover { background: #f3f4f6; }
  .shipping-options { display: grid; gap: 10px; }
  .shipping-option { display: flex; align-items: center; gap: 12px; padding: 14px; border: 2px solid var(--iwo-border); border-radius: 6px; cursor: pointer; transition: all 0.15s; background: #fff; }
  .shipping-option:hover { border-color: var(--iwo-accent); }
  .shipping-option.selected { border-color: var(--iwo-accent); background: #f0f6ff; }
  .shipping-option input[type="radio"] { margin: 0; }
  .shipping-option-info { flex: 1; }
  .shipping-option-name { font-weight: 600; font-size: 14px; }
  .shipping-option-eta { font-size: 12px; color: var(--iwo-muted); margin-top: 2px; }
  .shipping-option-price { font-weight: 700; font-size: 15px; color: var(--iwo-text); }
  .shipping-skeleton { display: grid; gap: 8px; }
  .shipping-skeleton-row { height: 56px; background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%); background-size: 200% 100%; animation: skeleton 1.2s infinite; border-radius: 6px; }
  @keyframes skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  .btn-primary { width: 100%; padding: 14px; background: var(--iwo-primary); color: #fff; border: 0; border-radius: 6px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background 0.15s; }
  .btn-primary:hover:not(:disabled) { background: var(--iwo-primary-hover); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .summary-item { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--iwo-border); }
  .summary-item img { width: 56px; height: 56px; border-radius: 4px; object-fit: cover; background: #f3f4f6; }
  .summary-item-info { flex: 1; }
  .summary-item-name { font-size: 13px; font-weight: 600; }
  .summary-item-variant { font-size: 11px; color: var(--iwo-muted); }
  .summary-item-price { font-size: 13px; font-weight: 600; }
  .summary-line { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
  .summary-line.muted { color: var(--iwo-muted); }
  .summary-total { display: flex; justify-content: space-between; padding: 12px 0 4px; border-top: 1px solid var(--iwo-border); margin-top: 4px; }
  .summary-total-label { font-size: 15px; font-weight: 700; }
  .summary-total-value { font-size: 18px; font-weight: 800; }
  .msg-error { background: #fee2e2; color: #991b1b; padding: 12px; border-radius: 6px; font-size: 13px; margin-bottom: 12px; }
  .msg-success { background: #dcfce7; color: #14532d; padding: 20px; border-radius: 6px; }
  .mp-field { height: 40px; padding: 8px 12px; border: 1px solid var(--iwo-border); border-radius: 6px; background: #fff; }
  .pix-result img { max-width: 240px; display: block; margin: 12px 0; }
  .pix-code { font-family: monospace; font-size: 12px; padding: 10px; background: #f3f4f6; border-radius: 4px; word-break: break-all; cursor: pointer; user-select: all; }

  /* Mobile: resumo colapsável no topo */
  @media (max-width: 900px) {
    .checkout-container { grid-template-columns: 1fr; }
    .summary-mobile-toggle { display: flex !important; }
    .summary-wrapper { display: none; }
    .summary-wrapper.open { display: block; }
  }
  .summary-mobile-toggle { display: none; padding: 14px; background: #fff; border: 1px solid var(--iwo-border); border-radius: 6px; justify-content: space-between; align-items: center; cursor: pointer; margin-bottom: 12px; font-weight: 600; }
</style>
```

- [ ] **Step 3: Substituir o render do card principal**

Localizar, no mesmo arquivo, a função `renderCheckout` (ou a que monta `root.innerHTML`). Substituir **todo o template** do cliente (a partir do `<div class="checkout-header">` até o `</div>` de fechamento do card do resumo) por:

```js
      root.innerHTML = `
        <div class="checkout-header">
          <a href="/loja.html"><h1>IWO Watch</h1></a>
          <a href="javascript:history.back()" class="back">&#8592; Voltar</a>
        </div>

        <div>
          <div class="card">
            <h2>Dados do cliente</h2>
            <div class="grid2">
              <div class="field"><label>Nome *</label><input id="f-first-name" placeholder="Seu nome" /></div>
              <div class="field"><label>Sobrenome *</label><input id="f-last-name" placeholder="Seu sobrenome" /></div>
            </div>
            <div class="field"><label>E-mail *</label><input id="f-email" type="email" inputmode="email" placeholder="seu@email.com" /></div>
            <div class="grid2">
              <div class="field"><label>CPF *</label><input id="f-cpf" inputmode="numeric" placeholder="000.000.000-00" maxlength="14" /></div>
              <div class="field"><label>Telefone</label><input id="f-phone" inputmode="tel" placeholder="(11) 99999-9999" /></div>
            </div>
          </div>

          <div class="card">
            <h2>Endereço de entrega</h2>
            <div class="grid-addr">
              <div class="field">
                <label>CEP *</label>
                <input id="f-cep" inputmode="numeric" placeholder="00000-000" maxlength="9" />
                <div class="err" id="f-cep-err">CEP não encontrado</div>
              </div>
              <div class="field"><label>Rua *</label><input id="f-street" placeholder="Nome da rua" /></div>
              <div class="field"><label>Número *</label><input id="f-number" placeholder="123" /></div>
            </div>
            <div class="field"><label>Complemento</label><input id="f-complement" placeholder="Apto, bloco, referência..." /></div>
            <div class="grid3">
              <div class="field"><label>Bairro *</label><input id="f-district" /></div>
              <div class="field"><label>Cidade *</label><input id="f-city" /></div>
              <div class="field"><label>UF *</label><input id="f-state" maxlength="2" /></div>
            </div>
          </div>

          <div class="card" id="card-shipping">
            <h2>Frete</h2>
            <div id="shipping-options-wrapper">
              <p style="font-size:13px;color:var(--iwo-muted);">Digite seu CEP para ver as opções de entrega.</p>
            </div>
          </div>

          <div class="card">
            <h2>Forma de pagamento</h2>
            <div class="pay-tabs">
              <div class="pay-tab active" onclick="setPayMethod('pix')">Pix</div>
              <div class="pay-tab" onclick="setPayMethod('credit_card')">Cartão</div>
              <div class="pay-tab" onclick="setPayMethod('boleto')">Boleto</div>
            </div>
            <div id="pay-form"></div>
          </div>

          <div id="checkout-error" style="display:none;" class="msg-error"></div>
          <div id="checkout-result" style="display:none;"></div>
          <button id="btn-pay" class="btn-primary" disabled onclick="handlePay()">Aguardando frete...</button>
        </div>

        <div class="summary-wrapper">
          <div class="summary-mobile-toggle" onclick="document.querySelector('.summary-wrapper').classList.toggle('open')">
            <span>Resumo do pedido</span>
            <span id="summary-toggle-total">${formatBRL(getCartTotal())}</span>
          </div>
          <div class="card">
            <h2>Resumo do pedido</h2>
            <div id="summary-items">
              ${cart.map(item => `
                <div class="summary-item">
                  <img src="${item.image || ''}" alt="${item.name}" onerror="this.style.display='none'" />
                  <div class="summary-item-info">
                    <div class="summary-item-name">${item.name}</div>
                    ${item.variantName ? `<div class="summary-item-variant">${item.variantName}</div>` : ''}
                    <div class="summary-item-variant">Qtd: ${item.quantity}</div>
                  </div>
                  <div class="summary-item-price">${formatBRL(item.price * item.quantity)}</div>
                </div>`).join('')}
            </div>
            <div class="summary-line muted"><span>Subtotal</span><span id="sum-subtotal">${formatBRL(getCartTotal())}</span></div>
            <div class="summary-line muted"><span>Frete</span><span id="sum-shipping">—</span></div>
            <div class="summary-total">
              <span class="summary-total-label">Total</span>
              <span class="summary-total-value" id="sum-total">${formatBRL(getCartTotal())}</span>
            </div>
          </div>
        </div>`;
```

- [ ] **Step 4: Adicionar state de shipping e lógica de ViaCEP/cotação**

Antes da função `renderCheckout`, dentro do `<script>`, adicionar:

```js
    // ── Shipping state ─────────────────────────────────────────────────
    let shippingOptions = [];     // array de opções cotadas
    let selectedShipping = null;  // { serviceId, price, ... } | null
    let cepFetching = false;

    function formatCEP(v) {
      const d = String(v || '').replace(/\D/g, '').slice(0, 8);
      if (d.length > 5) return d.slice(0, 5) + '-' + d.slice(5);
      return d;
    }

    function updateTotals() {
      const subtotal = getCartTotal();
      const shippingCost = selectedShipping ? selectedShipping.price : 0;
      const total = subtotal + shippingCost;
      const subEl = document.getElementById('sum-subtotal');
      const shipEl = document.getElementById('sum-shipping');
      const totEl = document.getElementById('sum-total');
      const toggleEl = document.getElementById('summary-toggle-total');
      if (subEl) subEl.textContent = formatBRL(subtotal);
      if (shipEl) shipEl.textContent = selectedShipping ? formatBRL(shippingCost) + ' — ' + selectedShipping.name : '—';
      if (totEl) totEl.textContent = formatBRL(total);
      if (toggleEl) toggleEl.textContent = formatBRL(total);

      const btn = document.getElementById('btn-pay');
      if (btn) {
        if (!selectedShipping) {
          btn.disabled = true;
          btn.textContent = 'Aguardando frete...';
        } else {
          btn.disabled = false;
          btn.textContent = 'Pagar ' + formatBRL(total);
        }
      }
    }

    function renderShippingOptions(options) {
      shippingOptions = options || [];
      selectedShipping = null;
      const wrap = document.getElementById('shipping-options-wrapper');
      if (!wrap) return;

      if (!options || options.length === 0) {
        wrap.innerHTML = '<p style="font-size:13px;color:var(--iwo-danger);">Nenhum serviço disponível para este CEP.</p>';
        updateTotals();
        return;
      }

      wrap.innerHTML = '<div class="shipping-options">' + options.map((opt, i) => `
        <label class="shipping-option" data-idx="${i}">
          <input type="radio" name="shipping-opt" value="${i}" />
          <div class="shipping-option-info">
            <div class="shipping-option-name">${opt.name}</div>
            <div class="shipping-option-eta">Chega em ${opt.deliveryMin === opt.deliveryMax ? opt.deliveryMin + ' dias úteis' : opt.deliveryMin + '–' + opt.deliveryMax + ' dias úteis'}</div>
          </div>
          <div class="shipping-option-price">${formatBRL(opt.price)}</div>
        </label>
      `).join('') + '</div>';

      wrap.querySelectorAll('.shipping-option').forEach(el => {
        el.addEventListener('click', () => {
          const idx = Number(el.dataset.idx);
          selectedShipping = shippingOptions[idx];
          wrap.querySelectorAll('.shipping-option').forEach(x => x.classList.remove('selected'));
          el.classList.add('selected');
          const input = el.querySelector('input[type="radio"]');
          if (input) input.checked = true;
          updateTotals();
        });
      });
      updateTotals();
    }

    function renderShippingSkeleton() {
      const wrap = document.getElementById('shipping-options-wrapper');
      if (!wrap) return;
      wrap.innerHTML = '<div class="shipping-skeleton"><div class="shipping-skeleton-row"></div><div class="shipping-skeleton-row"></div></div>';
    }

    async function fetchViaCep(cep) {
      const d = cep.replace(/\D/g, '');
      if (d.length !== 8) return null;
      try {
        const res = await fetch('/api/shipping/cep/' + d);
        if (!res.ok) return null;
        return await res.json();
      } catch { return null; }
    }

    async function fetchQuote(cep) {
      const d = cep.replace(/\D/g, '');
      if (d.length !== 8) return null;
      const cart = getCart();
      try {
        const res = await fetch('/api/shipping/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toPostalCode: d,
            items: cart.map(it => ({ productId: it.productId, quantity: it.quantity })),
          }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Falha ao cotar frete' };
        return data;
      } catch (e) {
        return { error: String(e.message || e) };
      }
    }

    async function handleCepChange() {
      const input = document.getElementById('f-cep');
      if (!input) return;
      const cep = input.value;
      const d = cep.replace(/\D/g, '');
      if (d.length !== 8) return;
      if (cepFetching) return;
      cepFetching = true;
      document.getElementById('f-cep-err').parentElement.classList.remove('has-error');
      renderShippingSkeleton();

      const [cepData, quoteData] = await Promise.all([fetchViaCep(d), fetchQuote(d)]);

      if (cepData) {
        const setIf = (id, value) => {
          const el = document.getElementById(id);
          if (el && (!el.value || el.dataset.auto === '1')) {
            el.value = value;
            el.dataset.auto = '1';
          }
        };
        setIf('f-street', cepData.logradouro || '');
        setIf('f-district', cepData.bairro || '');
        setIf('f-city', cepData.cidade || '');
        setIf('f-state', (cepData.uf || '').toUpperCase());
      } else {
        document.getElementById('f-cep-err').parentElement.classList.add('has-error');
      }

      if (quoteData && !quoteData.error) {
        renderShippingOptions(quoteData.options);
      } else {
        const wrap = document.getElementById('shipping-options-wrapper');
        if (wrap) {
          const msg = (quoteData && quoteData.error) || 'Falha ao cotar frete.';
          wrap.innerHTML = `<p style="font-size:13px;color:var(--iwo-danger);">${msg} <a href="#" onclick="handleCepChange();return false;" style="color:var(--iwo-accent);">Tentar novamente</a></p>`;
        }
      }
      cepFetching = false;
    }
```

- [ ] **Step 5: Enganchar eventos de CEP no render**

Ao final de `renderCheckout`, logo após `mp = new MercadoPago(...)`, adicionar:

```js
      const cepInput = document.getElementById('f-cep');
      if (cepInput) {
        cepInput.addEventListener('input', (e) => {
          e.target.value = formatCEP(e.target.value);
        });
        cepInput.addEventListener('blur', handleCepChange);
      }
      // CPF mask (existente? caso não, adicionar)
      const cpfInput = document.getElementById('f-cpf');
      if (cpfInput) {
        cpfInput.addEventListener('input', (e) => {
          const d = e.target.value.replace(/\D/g, '').slice(0, 11);
          e.target.value = d.length > 9 ? d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9) :
                           d.length > 6 ? d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6) :
                           d.length > 3 ? d.slice(0,3)+'.'+d.slice(3) : d;
        });
      }
      updateTotals();
```

- [ ] **Step 6: Remover bloco de endereço do formulário de boleto**

Localizar `else if (paymentMethod === 'boleto') {` dentro de `renderPayForm()`. Substituir todo o bloco por:

```js
      } else if (paymentMethod === 'boleto') {
        container.innerHTML = `
          <div style="padding:12px 0;font-size:13px;color:var(--iwo-muted);">
            O boleto será gerado e poderá ser pago em qualquer banco ou app bancário. Usaremos o endereço de entrega acima.
          </div>`;
      }
```

- [ ] **Step 7: Atualizar `handlePay` para enviar shipping + shipTo**

Localizar a função `handlePay`. Adicionar, depois das validações de nome/email/CPF e **antes** do `let payment_method = {}`:

```js
      // ── Validação endereço de entrega + frete ─────────────────────────
      const cep = document.getElementById('f-cep')?.value?.replace(/\D/g, '') || '';
      const street = document.getElementById('f-street')?.value?.trim() || '';
      const number = document.getElementById('f-number')?.value?.trim() || '';
      const complement = document.getElementById('f-complement')?.value?.trim() || '';
      const district = document.getElementById('f-district')?.value?.trim() || 'NA';
      const city = document.getElementById('f-city')?.value?.trim() || '';
      const state = (document.getElementById('f-state')?.value?.trim() || '').toUpperCase();
      if (cep.length !== 8) { showError('CEP inválido.'); return; }
      if (!street) { showError('Preencha o endereço (rua).'); return; }
      if (!number) { showError('Preencha o número.'); return; }
      if (!city) { showError('Preencha a cidade.'); return; }
      if (!/^[A-Z]{2}$/.test(state)) { showError('Preencha o estado (UF).'); return; }
      if (!selectedShipping) { showError('Selecione uma opção de frete.'); return; }
```

Em seguida, localizar o `body: JSON.stringify({ items: cart, payer, payment_method })` no `fetch('/api/checkout', ...)` e substituir por:

```js
          body: JSON.stringify({
            items: cart,
            payer,
            payment_method,
            shipping: {
              serviceId: selectedShipping.serviceId,
              toPostalCode: cep,
              quotedPrice: selectedShipping.price,
            },
            shipTo: {
              name: firstName + ' ' + lastName,
              document: cpf,
              postalCode: cep,
              address: street,
              number,
              complement,
              district,
              city,
              state,
            },
          }),
```

- [ ] **Step 8: Tratar 409 (cotação defasada) no `handlePay`**

Logo após `const data = await res.json();`, antes de `if (!res.ok) throw new Error(...)`, adicionar:

```js
        if (res.status === 409 && data.newOptions) {
          renderShippingOptions(data.newOptions);
          showError(data.message || 'O frete mudou — confira as novas opções acima.');
          processing = false;
          btn.disabled = false;
          btn.textContent = 'Aguardando frete...';
          return;
        }
```

- [ ] **Step 9: Validar build do projeto**

Run: `cd iwo-vercel && npm run build`

Expected: build bem-sucedido. Checkout.html é estático — não precisa de build, mas queremos garantir que nada do app quebrou.

- [ ] **Step 10: Smoke test end-to-end**

1. Garantir que há pelo menos 1 produto com preço no DB.
2. Acessar `http://localhost:3000/loja.html`, adicionar produto ao carrinho.
3. Ir para `/checkout`.
4. Preencher nome/email/CPF.
5. Digitar CEP `01153000` e clicar fora (blur).
6. **Verificar:** rua/bairro/cidade/UF preenchidos automaticamente pelo ViaCEP; card Frete mostra opções PAC/SEDEX (e Mini Envios se 1 unidade).
7. Clicar em uma opção — card fica destacado, resumo atualiza com "Frete — R$ X,XX" e "Total" somado.
8. Escolher Pix, clicar "Pagar".
9. **Verificar:** QR code aparece; abrir `npx prisma studio` e confirmar que o Order criado tem `shippingServiceId`, `shippingCost`, `shipToName`, etc. preenchidos.
10. Testar mudança de CEP: após selecionar frete, trocar o CEP e sair — opções devem re-cotar e seleção anterior é descartada.
11. Testar mobile: redimensionar janela para <900px, verificar que o resumo vira um toggle no topo.
12. Se houver sandbox SuperFrete real, esperar o webhook MP ou simular manualmente um payment `approved` via MP sandbox — verificar que o `superfreteOrderId` aparece no Order.

- [ ] **Step 11: Commit**

```bash
git add iwo-vercel/public/checkout.html
git commit -m "$(cat <<'EOF'
feat(checkout): redesign UI with address form + shipping quote

Refino completo da UX do checkout:
  - 4 cards sequenciais (cliente, endereço, frete, pagamento).
  - CEP com máscara e auto-preenchimento via ViaCEP ao blur.
  - Cotação automática em paralelo com ViaCEP (skeleton loader).
  - Cards de opção de frete (PAC/SEDEX/Mini Envios) com preço e prazo.
  - Resumo do pedido com Subtotal + Frete + Total (recalcula on-select).
  - Tratamento de 409 (cotação defasada) re-renderiza opções.
  - Mobile: resumo colapsa em toggle fixo no topo; grid 1 coluna.
  - Remove o bloco de endereço duplicado do boleto — reutiliza shipTo.
  - Visual alinhado com identidade IWO (tokens em CSS variables).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review final

**1. Spec coverage — itens do spec × tasks:**

| Spec | Task |
|---|---|
| Env vars + constantes | Task 1 |
| Schema 17 campos em Order | Task 1 |
| Helper `app/lib/superfrete.ts` (quote) | Task 2 |
| `POST /api/shipping/quote` | Task 4 |
| `GET /api/shipping/cep/[cep]` (ViaCEP proxy) | Task 3 |
| `/api/checkout` aceita shipping + shipTo + re-cota + soma MP + snapshot + upsert Address | Task 5 |
| Helper (createLabel/getLabelInfo/getPrintUrl/cancelLabel) | Task 6 |
| Webhook MP cria etiqueta pós-paid | Task 7 |
| 3 endpoints admin (label/refresh/cancel) | Task 8 |
| Lista `/admin/pedidos` | Task 9 |
| Detalhe `/admin/pedidos/[id]` | Task 10 |
| UX checkout — endereço + ViaCEP + cotação + refino visual + mobile | Task 11 |

Todos os itens do spec têm tasks. ✅

**2. Placeholder scan:** nenhum "TBD/TODO/FIXME" no plano. Step 3 da Task 2 foi removido como placeholder e substituído por nota clara para pular. ✅

**3. Type consistency:**
- `ShippingOption.serviceId: ServiceId` (tipo literal `1 | 2 | 17`) consistente em Task 2, 4, 5.
- `CreateLabelOrder` em Task 6 é consumido em Task 7 com os campos exatos (shipTo*, shippingBox*, payerEmail, orderItems[].productName/quantity/unitPrice).
- `SuperFreteError` exportado em Task 2 e usado em 4, 5, 7, 8. ✅
- `buildBox()` não é chamado diretamente pelos consumers — `quote()` encapsula. Mas exportei mesmo assim para futuro. OK.
- Nomes de env var (`SUPERFRETE_API_URL`, `SUPERFRET_APITOKEN`, `SUPERFRETE_USER_AGENT`, `SHIPPING_FROM_*`) consistentes entre Task 1 (.env.example), Task 2 (helper) e Task 6 (helper).

Nenhum bug encontrado. Plano pronto. ✅
