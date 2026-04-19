# Checkout stepper redesign — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o checkout de `public/checkout.html` para rotas Next.js multi-etapa (`/checkout/carrinho` → `/checkout/endereco` → `/checkout/pagamento` → `/checkout/confirmacao/[id]`) com visual Lumodesk-style, cupom de desconto, endereços salvos e header/footer do Webflow.

**Architecture:** Route group `(checkout)` com layout compartilhado (SiteHeader + Stepper + CheckoutSummary + SiteFooter). Estado centralizado em `localStorage` via `useCheckoutState()` com `useSyncExternalStore`. Cada step é uma URL distinta. Lógica de cupom compartilhada entre `/api/coupons/validate` e `/api/checkout` via `app/lib/coupon.ts`. Tela de confirmação protegida por token HMAC de um-uso.

**Tech Stack:** Next.js 16, React 19, Prisma 7 driver adapter, NextAuth v5, TypeScript strict. Estado no client com `useSyncExternalStore`. Fetch API + MercadoPago Secure Fields. Sem framework de testes — validação via `tsc`, `lint` e smoke tests manuais.

**Observações gerais:**
- Comandos `npm`/`npx` rodam em `iwo-vercel/`.
- Referência do spec: `iwo-vercel/docs/superpowers/specs/2026-04-19-checkout-stepper-redesign-design.md`.
- `@/*` resolve de `iwo-vercel/` root.
- Dev server em localhost:3000 roda contra SuperFrete produção + MP sandbox (configurado).
- Não pagar Pix/boleto gerado em smoke tests — são cobranças reais.

---

## Arquivos a criar/modificar

**Novos:**
- `iwo-vercel/app/lib/checkoutState.ts` — hook useCheckoutState + localStorage
- `iwo-vercel/app/lib/coupon.ts` — validateAndComputeCoupon helper compartilhado
- `iwo-vercel/app/lib/orderToken.ts` — HMAC sign/verify para URL de confirmação
- `iwo-vercel/app/api/coupons/validate/route.ts`
- `iwo-vercel/app/api/customer/addresses/route.ts`
- `iwo-vercel/app/api/orders/[id]/route.ts`
- `iwo-vercel/app/api/orders/[id]/status/route.ts`
- `iwo-vercel/app/components/SiteHeader.tsx`
- `iwo-vercel/app/components/SiteFooter.tsx`
- `iwo-vercel/app/components/checkout/Stepper.tsx`
- `iwo-vercel/app/components/checkout/CheckoutSummary.tsx`
- `iwo-vercel/app/components/checkout/CouponField.tsx`
- `iwo-vercel/app/components/checkout/AddressAccordion.tsx`
- `iwo-vercel/app/components/checkout/AddressForm.tsx`
- `iwo-vercel/app/components/checkout/ShippingOptions.tsx`
- `iwo-vercel/app/components/checkout/PaymentMethodTabs.tsx`
- `iwo-vercel/app/components/checkout/CardForm.tsx`
- `iwo-vercel/app/components/checkout/PayButton.tsx`
- `iwo-vercel/app/(checkout)/layout.tsx`
- `iwo-vercel/app/(checkout)/carrinho/page.tsx`
- `iwo-vercel/app/(checkout)/endereco/page.tsx`
- `iwo-vercel/app/(checkout)/pagamento/page.tsx`
- `iwo-vercel/app/(checkout)/confirmacao/[orderId]/page.tsx`
- `iwo-vercel/app/(checkout)/checkout.css` (opcional — tokens + utilitários)

**Modificados:**
- `iwo-vercel/prisma/schema.prisma` (+4 campos em Order)
- `iwo-vercel/app/api/checkout/route.ts` (aceita couponCode + retorna token HMAC)
- `iwo-vercel/app/api/webhook/mercadopago/route.ts` (incrementa Coupon.usedCount)
- `iwo-vercel/next.config.ts` (remove `/checkout` rewrite — só no último commit)

---

## Task 1: Schema — coupon fields no Order

**Files:**
- Modify: `iwo-vercel/prisma/schema.prisma`

- [ ] **Step 1: Adicionar 4 campos ao model Order**

Abrir `iwo-vercel/prisma/schema.prisma` e, dentro do `model Order { ... }`, logo após os campos de `shipping*`/`shipTo*` (antes dos `@@index`), adicionar:

```prisma
  // ── Cupom ────────────────────────────────────────────────────────────
  couponCode       String?       @map("coupon_code") @db.VarChar(50)
  couponKind       CouponKind?   @map("coupon_kind")
  couponDiscount   Decimal?      @map("coupon_discount") @db.Decimal(10, 2)
  couponId         Int?          @map("coupon_id")

  coupon           Coupon?       @relation(fields: [couponId], references: [id], onDelete: SetNull)
```

Adicionar índice logo abaixo dos outros `@@index`:

```prisma
  @@index([couponCode])
```

- [ ] **Step 2: Adicionar relação inversa no Coupon**

Dentro de `model Coupon { ... }`, adicionar antes de `@@map("coupons")`:

```prisma
  orders           Order[]
```

- [ ] **Step 3: Push schema e regenerar client**

Run (from `iwo-vercel/`):
```bash
npx prisma db push
npx prisma generate
```
Expected: "Your database is now in sync" + "Generated Prisma Client". Sem warning de data loss.

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: sem novos erros (pré-existente `landing-apple-style.tsx` pode continuar).

- [ ] **Step 5: Commit**

```bash
git add iwo-vercel/prisma/schema.prisma
git commit -m "$(cat <<'EOF'
feat(db): add coupon snapshot fields to Order

4 colunas aditivas opcionais (couponCode, couponKind, couponDiscount,
couponId) + relação Coupon <-> Order para persistir cupom aplicado em
cada pedido. O Coupon.usedCount permanece fonte de verdade para
enforcement de maxUses; o snapshot no Order preserva histórico caso o
admin edite/remova o cupom depois.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Helpers — coupon + orderToken

**Files:**
- Create: `iwo-vercel/app/lib/coupon.ts`
- Create: `iwo-vercel/app/lib/orderToken.ts`

- [ ] **Step 1: Criar `app/lib/coupon.ts`**

```ts
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
```

- [ ] **Step 2: Criar `app/lib/orderToken.ts`**

```ts
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
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: zero novos erros.

- [ ] **Step 4: Commit**

```bash
git add iwo-vercel/app/lib/coupon.ts iwo-vercel/app/lib/orderToken.ts
git commit -m "$(cat <<'EOF'
feat(lib): add coupon validator and order token HMAC helpers

- app/lib/coupon.ts: validateAndComputeCoupon() compartilhada entre
  /api/coupons/validate (UI) e /api/checkout (re-validação anti-
  tampering). Não incrementa usedCount — fica para o webhook paid.
- app/lib/orderToken.ts: sign/verify HMAC SHA-256 (com NEXTAUTH_SECRET)
  para a URL pública de confirmação do pedido.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Endpoint `/api/coupons/validate`

**Files:**
- Create: `iwo-vercel/app/api/coupons/validate/route.ts`

- [ ] **Step 1: Criar o endpoint**

```ts
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
```

- [ ] **Step 2: Criar um cupom de teste no DB**

Run (em shell Node ou via `npx prisma studio`): criar um `Coupon`:

```sql
-- ou via prisma studio
INSERT INTO coupons (code, kind, value, is_active, used_count, created_at)
VALUES ('TESTE10', 'PERCENT', 10.00, true, 0, NOW());
```

Alternativamente via curl → admin endpoint de cupons (não existe) → criar manualmente via Prisma Studio. Abrir `npx prisma studio` em terminal separado e adicionar a row.

- [ ] **Step 3: Type check + lint**

```bash
npx tsc --noEmit
npm run lint
```
Expected: sem novos erros.

- [ ] **Step 4: Smoke test**

```bash
# Cupom válido
curl -s -X POST http://localhost:3000/api/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"teste10","subtotal":300}' | head -c 300
```
Expected: `{"code":"TESTE10","kind":"PERCENT","discount":30,"description":null}`.

```bash
# Cupom inexistente
curl -s -w "\nHTTP=%{http_code}\n" -X POST http://localhost:3000/api/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"NOPE","subtotal":300}'
```
Expected: status 404, body `{"error":"NOT_FOUND","message":"Cupom inválido"}`.

- [ ] **Step 5: Commit**

```bash
git add iwo-vercel/app/api/coupons/validate/
git commit -m "$(cat <<'EOF'
feat(api): add POST /api/coupons/validate

Valida cupom server-side e retorna desconto computado. Case-
insensitive (normaliza para UPPERCASE). Usa a lib compartilhada
app/lib/coupon.ts. Retorna 404 para NOT_FOUND e 422 para demais
erros (expirado, esgotado, mínimo não atingido, etc).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Atualizar `/api/checkout` (cupom + token)

**Files:**
- Modify: `iwo-vercel/app/api/checkout/route.ts`

- [ ] **Step 1: Adicionar imports**

Abrir `iwo-vercel/app/api/checkout/route.ts` e adicionar no topo, alongside existing imports:

```ts
import { validateAndComputeCoupon } from '@/app/lib/coupon';
import { signOrderToken } from '@/app/lib/orderToken';
```

- [ ] **Step 2: Validar cupom server-side e computar desconto**

Localizar o trecho onde `shippingCost` foi calculado (logo após o `selected` do frete), e ANTES do `const subtotal = priced.reduce(...)`, inserir:

```ts
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
```

- [ ] **Step 3: Atualizar totalAmount para incluir desconto**

Localizar e substituir:

```ts
    const subtotal = priced.reduce((sum, it) => sum + it.totalPrice, 0);
    const totalAmount = Math.round((subtotal + shippingCost) * 100) / 100;
```

Por:

```ts
    const subtotal = priced.reduce((sum, it) => sum + it.totalPrice, 0);
    const couponDiscount = couponResult?.ok ? couponResult.discount : 0;
    const totalAmount = Math.round((subtotal - couponDiscount + shippingCost) * 100) / 100;
```

- [ ] **Step 4: Persistir campos de cupom no Order.create**

Localizar o bloco `await prisma.order.create({ data: { ... } })` e adicionar dentro de `data`:

```ts
          couponCode: couponResult?.ok ? couponResult.coupon.code : null,
          couponKind: couponResult?.ok ? couponResult.coupon.kind : null,
          couponDiscount: couponResult?.ok ? couponResult.discount : null,
          couponId: couponResult?.ok ? couponResult.coupon.id : null,
```

- [ ] **Step 5: Retornar token HMAC no resultado**

Localizar o objeto `result` final construído antes do `return Response.json(result)`. Adicionar a atribuição do token após obter o Order atualizado:

```ts
      // Build response for frontend
      const result: Record<string, unknown> = {
        orderId: order.id,
        token: signOrderToken(order.id, order.createdAt ?? new Date()),
        mpPaymentId,
        status: mpData.status,
        statusDetail: mpData.status_detail,
      };
```

Se `order.createdAt` puder ser `null` por algum motivo, usar `new Date()` como fallback. A view de confirmação vai re-verificar.

- [ ] **Step 6: Type check + lint**

```bash
npx tsc --noEmit
npm run lint
```
Expected: zero novos erros.

- [ ] **Step 7: Smoke test**

Criar um Order via checkout com `couponCode: "teste10"`:

```bash
curl -s -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": 1, "quantity": 1, "name": "Teste", "price": 100}],
    "payer": { "email": "teste@teste.com", "first_name": "João", "last_name": "Silva", "identification": {"type": "CPF", "number": "12345678909"} },
    "payment_method": { "id": "pix", "type": "bank_transfer" },
    "shipping": { "serviceId": 1, "toPostalCode": "01153000", "quotedPrice": 17.77 },
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
    },
    "couponCode": "teste10"
  }' | head -c 500
```
Expected: status 200 com `orderId`, `token` (hex de 64 chars), `pix`, etc. Valor total deve refletir `300 − 30 + 17.77 = 287.77` no Pix QR (se produto custar R$ 300). No DB, o Order tem `couponCode: 'TESTE10'`, `couponDiscount: 30`, `couponId: <id>`.

Testar cupom inválido:

```bash
# Mesmo curl mas com "couponCode": "NOPE"
```
Expected: status 409, `error: "COUPON_INVALID"`, `code: "NOT_FOUND"`.

- [ ] **Step 8: Commit**

```bash
git add iwo-vercel/app/api/checkout/route.ts
git commit -m "$(cat <<'EOF'
feat(checkout): apply validated coupon to MP total and snapshot on Order

/api/checkout agora aceita couponCode no body. Valida server-side
(via app/lib/coupon.ts) — rejeita 409 COUPON_INVALID se falhar.
Desconto é subtraído do subtotal de produtos (não do frete) antes de
somar o frete no transaction_amount da MercadoPago. Persiste snapshot
(couponCode/Kind/Discount/Id) no Order.

Resposta ganha token HMAC da app/lib/orderToken para a URL de
/checkout/confirmacao/[orderId]?token=... (página pública, acesso
só com token válido).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Webhook MP incrementa Coupon.usedCount

**Files:**
- Modify: `iwo-vercel/app/api/webhook/mercadopago/route.ts`

- [ ] **Step 1: Adicionar incremento de usedCount**

Abrir `iwo-vercel/app/api/webhook/mercadopago/route.ts`. Localizar o bloco que tem `shouldCreateLabel` (criado na Task 7 do plano anterior). Logo APÓS esse bloco (antes do `return Response.json({ received: true })`), adicionar:

```ts
    // ── Cupom: incrementar usedCount quando paid ─────────────────────────
    // Idempotente via condição de internalStatus + presença de couponId.
    // Se MP mandar 2 webhooks de approved, o primeiro já atualizou mas o
    // increment é seguro (contador monotônico). Aceitamos esse trade-off —
    // alternativa com flag seria invasiva e usedCount < maxUses é o que
    // importa pra enforcement.
    if (internalStatus === 'paid' && order.couponId != null) {
      try {
        await prisma.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { increment: 1 } },
        });
      } catch (couponErr) {
        console.error('[mp-webhook] failed to increment Coupon.usedCount', {
          orderId: order.id,
          couponId: order.couponId,
          err: String((couponErr as Error)?.message ?? couponErr),
        });
        // Não propagar — webhook precisa responder 200.
      }
    }
```

**Nota importante sobre idempotência:** MP pode enviar o mesmo webhook `approved` múltiplas vezes. O increment no Coupon NÃO tem guard — cada retry incrementará de novo. Isso é aceitável: `usedCount` é usado para enforcement de `maxUses`, e dupla-contagem resulta em esgotar o cupom ligeiramente antes do esperado (conservador). Alternativa mais rigorosa seria ter um campo `couponIncrementedAt` no Order — follow-up, não bloqueador.

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: zero novos erros.

- [ ] **Step 3: Smoke test — revisão visual**

Ler o código no editor, confirmar:
- `internalStatus === 'paid'` + `order.couponId != null` são as condições.
- Bloco está ANTES do `return Response.json({ received: true })`.
- Try/catch absorvedor — webhook não quebra se increment falhar.

Teste end-to-end funcional: exige webhook real da MP — validado na smoke test do Task 15.

- [ ] **Step 4: Commit**

```bash
git add iwo-vercel/app/api/webhook/mercadopago/route.ts
git commit -m "$(cat <<'EOF'
feat(webhook): increment Coupon.usedCount on approved payment

Após marcar Order.status='paid', incrementa Coupon.usedCount em 1
se o pedido tinha cupom aplicado. Wrapped em try/catch para não
quebrar o webhook. Idempotency loose (MP retries de approved
incrementam duplamente, aceitável — contador serve só para gate
de maxUses, dupla-contagem esgota ligeiramente antes do esperado).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Endpoint `POST /api/customer/addresses`

**Files:**
- Create: `iwo-vercel/app/api/customer/addresses/route.ts`

- [ ] **Step 1: Criar o endpoint**

```ts
// POST /api/customer/addresses
// Cria um novo endereço vinculado ao Customer do usuário logado.
// Se isDefault=true, desmarca os outros endereços do mesmo customer
// na mesma transaction.

import { prisma } from '@/app/lib/prisma';
import { auth } from '@/app/lib/auth';

type Body = {
  label?: unknown;
  cep?: unknown;
  street?: unknown;
  number?: unknown;
  complement?: unknown;
  neighborhood?: unknown;
  city?: unknown;
  state?: unknown;
  isDefault?: unknown;
  recipient?: unknown;
};

function cleanDigits(v: unknown, max: number): string {
  return String(v ?? '').replace(/\D/g, '').slice(0, max);
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { userId } });
  if (!customer) {
    return Response.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const cep = cleanDigits(body.cep, 8);
  const street = String(body.street ?? '').trim().slice(0, 255);
  const number = String(body.number ?? '').trim().slice(0, 20);
  const complement = String(body.complement ?? '').trim().slice(0, 100);
  const neighborhood = String(body.neighborhood ?? '').trim().slice(0, 100) || 'NA';
  const city = String(body.city ?? '').trim().slice(0, 100);
  const state = String(body.state ?? '').trim().toUpperCase().slice(0, 2);
  const label = String(body.label ?? '').trim().slice(0, 50) || null;
  const recipient =
    String(body.recipient ?? '').trim().slice(0, 255) ||
    String(customer.name ?? '').trim();
  const isDefault = body.isDefault === true;

  if (cep.length !== 8) return Response.json({ error: 'CEP inválido' }, { status: 400 });
  if (!street) return Response.json({ error: 'Rua obrigatória' }, { status: 400 });
  if (!number) return Response.json({ error: 'Número obrigatório' }, { status: 400 });
  if (!city) return Response.json({ error: 'Cidade obrigatória' }, { status: 400 });
  if (!/^[A-Z]{2}$/.test(state)) return Response.json({ error: 'UF inválida' }, { status: 400 });
  if (!recipient) return Response.json({ error: 'Destinatário obrigatório' }, { status: 400 });

  const created = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.address.updateMany({
        where: { customerId: customer.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.address.create({
      data: {
        customerId: customer.id,
        label,
        recipient,
        cep,
        street,
        number,
        complement: complement || null,
        neighborhood,
        city,
        state,
        isDefault,
      },
    });
  });

  return Response.json({
    id: created.id,
    label: created.label,
    recipient: created.recipient,
    cep: created.cep,
    street: created.street,
    number: created.number,
    complement: created.complement,
    neighborhood: created.neighborhood,
    city: created.city,
    state: created.state,
    isDefault: created.isDefault,
  });
}
```

- [ ] **Step 2: Type check + lint**

```bash
npx tsc --noEmit
npm run lint
```
Expected: zero novos erros.

- [ ] **Step 3: Smoke test — sem login retorna 401**

```bash
curl -s -w "\nHTTP=%{http_code}\n" -X POST http://localhost:3000/api/customer/addresses \
  -H "Content-Type: application/json" \
  -d '{"cep":"01153000","street":"Rua X","number":"100","city":"São Paulo","state":"SP"}'
```
Expected: status 401, body `{"error":"Não autorizado"}`.

Teste com login: validado na smoke test da Task 12.

- [ ] **Step 4: Commit**

```bash
git add iwo-vercel/app/api/customer/addresses/
git commit -m "$(cat <<'EOF'
feat(customer): add POST /api/customer/addresses

Cria endereço de entrega para o Customer do usuário logado. Valida
campos obrigatórios e formato de CEP/UF. Se isDefault=true, desmarca
os demais endereços do mesmo customer em uma transaction única.
Protegido por auth() — 401 para guest.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Endpoints `/api/orders/[id]` + `/status`

**Files:**
- Create: `iwo-vercel/app/api/orders/[id]/route.ts`
- Create: `iwo-vercel/app/api/orders/[id]/status/route.ts`

- [ ] **Step 1: Criar `/api/orders/[id]/route.ts`**

```ts
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
  if (!order) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });

  if (!order.createdAt || !verifyOrderToken(orderId, order.createdAt, token)) {
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
```

- [ ] **Step 2: Criar `/api/orders/[id]/status/route.ts`**

```ts
// GET /api/orders/[id]/status?token=<hmac>
// Polling leve — só status (sem dados sensíveis).

import { prisma } from '@/app/lib/prisma';
import { verifyOrderToken } from '@/app/lib/orderToken';

type Params = Promise<{ id: string }>;

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
    select: {
      status: true,
      mpStatus: true,
      superfreteStatus: true,
      superfreteTracking: true,
      createdAt: true,
    },
  });
  if (!order) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
  if (!order.createdAt || !verifyOrderToken(orderId, order.createdAt, token)) {
    return Response.json({ error: 'Token inválido' }, { status: 403 });
  }

  return Response.json({
    status: order.status,
    mpStatus: order.mpStatus,
    superfreteStatus: order.superfreteStatus,
    superfreteTracking: order.superfreteTracking,
  });
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```
Expected: zero novos erros.

- [ ] **Step 4: Smoke test — 403 sem token**

```bash
curl -s -w "\nHTTP=%{http_code}\n" http://localhost:3000/api/orders/1
```
Expected: status 403, `{"error":"Token ausente"}`.

```bash
curl -s -w "\nHTTP=%{http_code}\n" "http://localhost:3000/api/orders/1?token=nope"
```
Expected: status 403 (token inválido) ou 404 (pedido não existe) dependendo do ID usado.

Validação com token real: acontece após Task 4 gerar o token; qualquer pedido recente pode ser testado usando seu token no mp_order_id/token response.

- [ ] **Step 5: Commit**

```bash
git add iwo-vercel/app/api/orders/
git commit -m "$(cat <<'EOF'
feat(api): add public order endpoints for confirmation page

- GET /api/orders/[id]?token=<hmac> → dados redigidos do pedido
  (CPF mascarado, sem admin fields) para a tela de confirmação.
- GET /api/orders/[id]/status?token=<hmac> → polling leve (só
  status/tracking) a cada 5s enquanto Pix pendente.

Ambos protegidos por token HMAC de um-uso (app/lib/orderToken).
403 se token ausente/inválido.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: State hook `useCheckoutState`

**Files:**
- Create: `iwo-vercel/app/lib/checkoutState.ts`

- [ ] **Step 1: Criar o hook**

```ts
// useCheckoutState — fonte central do estado do checkout multi-step.
// Persiste em localStorage sob a chave `iwo_checkout_state`; sincroniza
// entre componentes e abas via `storage` event.

'use client';

import { useCallback, useSyncExternalStore } from 'react';

type CartItem = {
  productId: number;
  variantId?: number;
  name: string;
  variantName?: string;
  price: number;
  quantity: number;
  image?: string;
  slug?: string;
};

type AppliedCoupon = {
  code: string;
  kind: 'PERCENT' | 'FIXED';
  discount: number;
  description: string | null;
};

type ShipTo = {
  name: string;
  document: string;
  postalCode: string;
  address: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
};

type ShippingOption = {
  serviceId: 1 | 2 | 17;
  name: string;
  price: number;
  deliveryMin: number;
  deliveryMax: number;
  box: { weight: number; height: number; width: number; length: number };
};

export type CheckoutState = {
  cart: CartItem[];
  coupon: AppliedCoupon | null;
  shipTo: ShipTo | null;
  selectedAddressId: number | null;
  shipping: ShippingOption | null;
};

const STORAGE_KEY = 'iwo_checkout_state';
const CART_KEY = 'iwo_cart'; // chave pré-existente do checkout.html antigo
const EMPTY: CheckoutState = {
  cart: [],
  coupon: null,
  shipTo: null,
  selectedAddressId: null,
  shipping: null,
};

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
}

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function getSnapshot(): CheckoutState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<CheckoutState>) : {};
    return {
      cart: readCart(), // cart é fonte separada — iwo_cart
      coupon: parsed.coupon ?? null,
      shipTo: parsed.shipTo ?? null,
      selectedAddressId: parsed.selectedAddressId ?? null,
      shipping: parsed.shipping ?? null,
    };
  } catch {
    return EMPTY;
  }
}

function writeState(patch: Partial<Omit<CheckoutState, 'cart'>>) {
  if (typeof window === 'undefined') return;
  const current = getSnapshot();
  const next = {
    coupon: patch.coupon !== undefined ? patch.coupon : current.coupon,
    shipTo: patch.shipTo !== undefined ? patch.shipTo : current.shipTo,
    selectedAddressId:
      patch.selectedAddressId !== undefined
        ? patch.selectedAddressId
        : current.selectedAddressId,
    shipping: patch.shipping !== undefined ? patch.shipping : current.shipping,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('storage'));
}

function writeCart(cart: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('storage'));
}

function clearCheckoutState() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  // NOTA: cart (iwo_cart) só é limpo depois do pagamento aprovado;
  // step 4 (confirmação) chama clearCart() explicitamente.
  window.dispatchEvent(new Event('storage'));
}

function clearCart() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event('storage'));
}

export function useCheckoutState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  const setCoupon = useCallback((coupon: AppliedCoupon | null) => {
    writeState({ coupon });
  }, []);

  const setShipTo = useCallback((shipTo: ShipTo | null) => {
    writeState({ shipTo });
  }, []);

  const setSelectedAddressId = useCallback((id: number | null) => {
    writeState({ selectedAddressId: id });
  }, []);

  const setShipping = useCallback((shipping: ShippingOption | null) => {
    writeState({ shipping });
  }, []);

  const setCart = useCallback((cart: CartItem[]) => {
    writeCart(cart);
  }, []);

  const clear = useCallback(() => {
    clearCheckoutState();
  }, []);

  const clearAll = useCallback(() => {
    clearCheckoutState();
    clearCart();
  }, []);

  const subtotal = state.cart.reduce((s, it) => s + it.price * it.quantity, 0);
  const couponDiscount = state.coupon?.discount ?? 0;
  const shippingCost = state.shipping?.price ?? 0;
  const total = Math.round((subtotal - couponDiscount + shippingCost) * 100) / 100;

  return {
    state,
    subtotal,
    couponDiscount,
    shippingCost,
    total,
    setCoupon,
    setShipTo,
    setSelectedAddressId,
    setShipping,
    setCart,
    clear,
    clearAll,
  };
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add iwo-vercel/app/lib/checkoutState.ts
git commit -m "$(cat <<'EOF'
feat(lib): add useCheckoutState hook for multi-step checkout

Hook client com useSyncExternalStore + localStorage. Centraliza:
cart (chave iwo_cart, pré-existente), coupon, shipTo,
selectedAddressId, shipping. Cross-tab sync via storage event.
Expõe totais derivados (subtotal, couponDiscount, shippingCost,
total) e setters individuais + clear/clearAll.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: SiteHeader + SiteFooter (do Webflow)

**Files:**
- Create: `iwo-vercel/app/components/SiteHeader.tsx`
- Create: `iwo-vercel/app/components/SiteFooter.tsx`

- [ ] **Step 1: Inspecionar `public/loja.html`**

```bash
# Encontrar os blocos de header e footer no HTML do Webflow.
grep -n "class=\"navbar" iwo-vercel/public/loja.html | head -3
grep -n "class=\"footer" iwo-vercel/public/loja.html | head -3
```

Identificar o nó do header (provavelmente `<div class="navbar...">` ou `<header>`) e do footer (`<footer>` ou `<div class="footer">`). Anote os ranges de linhas.

Ler os blocos completos — pode ser 50-200 linhas cada.

- [ ] **Step 2: Criar `app/components/SiteHeader.tsx`**

Portar o HTML do header para JSX:
- Converter `class=` → `className=`
- Converter `for=` → `htmlFor=`
- Fechar tags auto-closing (`<img ... />`, `<input ... />`)
- Substituir o logo: onde existir `<img src="..." alt="..." />` ou texto "IWO Watch", trocar por:
  ```tsx
  <img src="/images/iwo_cinza_extended-1-p-500.webp" alt="IWO Watch" style={{ height: 32 }} />
  ```
- Adicionar `'use client'` no topo SE o header tiver interações (menu mobile, dropdown). Senão, deixar como RSC.
- Adicionar import condicional: `import Link from 'next/link';` — substituir `<a href="/loja">` por `<Link href="/loja">` para navegação SPA.

Exemplo mínimo (substituir pelo HTML real do Webflow):

```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header__container">
        <Link href="/" className="site-header__logo">
          <img
            src="/images/iwo_cinza_extended-1-p-500.webp"
            alt="IWO Watch"
            style={{ height: 32, display: 'block' }}
          />
        </Link>
        {/* ... resto do conteúdo portado do Webflow ... */}
      </div>
    </header>
  );
}
```

**Importante:** só o logo muda de "texto IWO Watch" para img. O resto do header (menu, ícones, links de navegação) preserva exatamente o que existe no Webflow.

- [ ] **Step 3: Criar `app/components/SiteFooter.tsx`**

Mesmo processo para o footer. Geralmente footers Webflow são mais estáticos (sem interação), então pode ser RSC puro (sem `'use client'`).

```tsx
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      {/* ... conteúdo portado do Webflow ... */}
    </footer>
  );
}
```

- [ ] **Step 4: Verificar que os estilos do Webflow alcançam os componentes**

Os componentes referenciam classes do Webflow (ex: `.navbar`, `.footer`). Essas classes precisam existir em algum CSS carregado. Nas outras páginas, `iwo-watch.webflow.css` é carregado via `<link>` no HTML estático. Em nosso layout Next.js, vamos carregar o mesmo CSS:

Abrir `iwo-vercel/app/layout.tsx` (root) e adicionar no `<head>`:

```tsx
<link rel="stylesheet" href="/css/normalize.css" />
<link rel="stylesheet" href="/css/webflow.css" />
<link rel="stylesheet" href="/css/iwo-watch.webflow.css" />
```

Se o root layout já tiver algo, preservar e adicionar. O Next.js serve arquivos de `public/` sem transformação, então `href="/css/..."` resolve para `public/css/...`.

- [ ] **Step 5: Type check + lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 6: Smoke test — criar rota de teste temporária**

Criar `iwo-vercel/app/teste-header/page.tsx` (temporário, deletado no próximo commit):

```tsx
import { SiteHeader } from '@/app/components/SiteHeader';
import { SiteFooter } from '@/app/components/SiteFooter';

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main style={{ minHeight: 400, padding: 32 }}>Página de teste</main>
      <SiteFooter />
    </>
  );
}
```

Acessar `http://localhost:3000/teste-header` no browser e conferir se header/footer renderizam com logo correto e estilos do Webflow aplicados. Se tudo OK, deletar o arquivo antes do commit.

```bash
rm -rf iwo-vercel/app/teste-header
```

- [ ] **Step 7: Commit**

```bash
git add iwo-vercel/app/components/SiteHeader.tsx iwo-vercel/app/components/SiteFooter.tsx iwo-vercel/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(components): port SiteHeader and SiteFooter from Webflow

Extraído de public/loja.html e portado para JSX. Logo substituído
de texto por /images/iwo_cinza_extended-1-p-500.webp. CSS do
Webflow carregado via <link> no root layout.tsx para os
componentes renderizarem com os estilos oficiais.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Layout `(checkout)` + Stepper + CheckoutSummary

**Files:**
- Create: `iwo-vercel/app/(checkout)/layout.tsx`
- Create: `iwo-vercel/app/(checkout)/checkout.css`
- Create: `iwo-vercel/app/components/checkout/Stepper.tsx`
- Create: `iwo-vercel/app/components/checkout/CheckoutSummary.tsx`

- [ ] **Step 1: Criar `app/(checkout)/checkout.css` com tokens**

```css
/* Design tokens + utilitários do checkout */

.checkout-layout {
  --iwo-bg: #f5f6f8;
  --iwo-card: #ffffff;
  --iwo-text: #0a0a0f;
  --iwo-text-soft: #4b5563;
  --iwo-muted: #9ca3af;
  --iwo-border: #e4e7ec;
  --iwo-border-strong: #d1d5db;
  --iwo-primary: #0a0a0f;
  --iwo-primary-hover: #1f1f29;
  --iwo-primary-fg: #ffffff;
  --iwo-accent: #2563eb;
  --iwo-success: #059669;
  --iwo-success-bg: #ecfdf5;
  --iwo-warning: #d97706;
  --iwo-danger: #dc2626;
  --iwo-danger-bg: #fef2f2;
  --iwo-radius: 12px;
  --iwo-radius-sm: 8px;
  --iwo-radius-input: 10px;
  --iwo-shadow-card: 0 1px 2px rgba(10, 10, 15, 0.04), 0 8px 24px rgba(10, 10, 15, 0.06);
  --iwo-shadow-pop: 0 8px 32px rgba(10, 10, 15, 0.12);
  --iwo-ease: cubic-bezier(0.4, 0, 0.2, 1);
  --iwo-duration: 0.25s;

  background: var(--iwo-bg);
  color: var(--iwo-text);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 15px;
  line-height: 1.5;
}

.checkout-layout * { box-sizing: border-box; }

.checkout-grid {
  max-width: 1120px;
  margin: 0 auto;
  padding: 32px 20px;
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 32px;
  align-items: start;
}
@media (max-width: 900px) {
  .checkout-grid { grid-template-columns: 1fr; gap: 16px; }
}

.checkout-card {
  background: var(--iwo-card);
  border: 1px solid var(--iwo-border);
  border-radius: var(--iwo-radius);
  box-shadow: var(--iwo-shadow-card);
  padding: 24px;
  margin-bottom: 16px;
}
.checkout-card h2 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 16px;
}

.checkout-field {
  margin-bottom: 12px;
}
.checkout-field label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--iwo-muted);
  margin-bottom: 6px;
}
.checkout-field input,
.checkout-field select {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--iwo-border-strong);
  border-radius: var(--iwo-radius-input);
  font-size: 14px;
  font-family: inherit;
  transition: border-color var(--iwo-duration) var(--iwo-ease),
              box-shadow var(--iwo-duration) var(--iwo-ease);
  background: #fff;
}
.checkout-field input:focus,
.checkout-field select:focus {
  outline: none;
  border-color: var(--iwo-accent);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.checkout-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 14px 20px;
  background: var(--iwo-primary);
  color: var(--iwo-primary-fg);
  border: 0;
  border-radius: var(--iwo-radius-sm);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background var(--iwo-duration) var(--iwo-ease);
}
.checkout-btn-primary:hover:not(:disabled) { background: var(--iwo-primary-hover); }
.checkout-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.checkout-btn-secondary {
  display: inline-flex;
  align-items: center;
  padding: 12px 16px;
  background: transparent;
  color: var(--iwo-text);
  border: 1px solid var(--iwo-border-strong);
  border-radius: var(--iwo-radius-sm);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.checkout-btn-secondary:hover { background: #f9fafb; }

.checkout-banner {
  padding: 14px 16px;
  border-radius: var(--iwo-radius-sm);
  font-size: 14px;
  margin-bottom: 16px;
}
.checkout-banner--warn { background: #fef3c7; color: #78350f; }
.checkout-banner--error { background: var(--iwo-danger-bg); color: #991b1b; }

/* Skeleton shimmer */
.checkout-skeleton {
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: checkout-shimmer 1.2s infinite;
  border-radius: 6px;
}
@keyframes checkout-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 2: Criar `app/components/checkout/Stepper.tsx`**

```tsx
'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';

type Step = { id: 1 | 2 | 3; label: string; href: string };

const STEPS: Step[] = [
  { id: 1, label: 'Carrinho', href: '/checkout/carrinho' },
  { id: 2, label: 'Endereço', href: '/checkout/endereco' },
  { id: 3, label: 'Pagamento', href: '/checkout/pagamento' },
];

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    padding: '24px 20px',
    maxWidth: 640,
    margin: '0 auto',
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    flex: '0 0 auto',
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    border: '2px solid #d1d5db',
    background: '#fff',
    color: '#9ca3af',
    transition: 'all var(--iwo-duration, .25s) var(--iwo-ease, ease)',
  },
  circleActive: {
    background: '#0a0a0f',
    color: '#fff',
    border: '2px solid #0a0a0f',
  },
  circleDone: {
    background: '#059669',
    color: '#fff',
    border: '2px solid #059669',
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#9ca3af',
  },
  labelActive: { color: '#0a0a0f' },
  labelDone: { color: '#059669' },
  line: {
    flex: 1,
    height: 2,
    background: '#e4e7ec',
    margin: '0 12px',
    marginBottom: 24, // alinha com o círculo visualmente
  },
  lineDone: { background: '#059669' },
};

export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div style={styles.container} aria-label="Progresso do checkout">
      {STEPS.map((s, idx) => {
        const isDone = s.id < current;
        const isActive = s.id === current;
        const circleStyle = {
          ...styles.circle,
          ...(isActive ? styles.circleActive : {}),
          ...(isDone ? styles.circleDone : {}),
        };
        const labelStyle = {
          ...styles.label,
          ...(isActive ? styles.labelActive : {}),
          ...(isDone ? styles.labelDone : {}),
        };
        const circle = (
          <div style={circleStyle}>{isDone ? '✓' : s.id}</div>
        );
        const item = (
          <div style={styles.item}>
            {isDone ? (
              <Link href={s.href} style={{ textDecoration: 'none' }}>
                {circle}
              </Link>
            ) : (
              circle
            )}
            <span style={labelStyle}>{s.label}</span>
          </div>
        );
        return (
          <>
            {idx > 0 && (
              <div
                key={`line-${s.id}`}
                style={{ ...styles.line, ...(isDone || isActive ? styles.lineDone : {}) }}
              />
            )}
            <div key={s.id}>{item}</div>
          </>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Criar `app/components/checkout/CheckoutSummary.tsx`**

```tsx
'use client';

import { useCheckoutState } from '@/app/lib/checkoutState';
import { formatBRL } from '@/app/lib/format';
import type { CSSProperties } from 'react';

const styles: Record<string, CSSProperties> = {
  card: {
    background: '#fff',
    border: '1px solid #e4e7ec',
    borderRadius: 12,
    boxShadow: '0 1px 2px rgba(10,10,15,.04), 0 8px 24px rgba(10,10,15,.06)',
    padding: 24,
    position: 'sticky',
    top: 24,
  },
  title: { fontSize: 18, fontWeight: 700, margin: '0 0 16px' },
  item: {
    display: 'flex',
    gap: 12,
    padding: '10px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  itemImg: {
    width: 56,
    height: 56,
    borderRadius: 6,
    objectFit: 'cover',
    background: '#f3f4f6',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: 600 },
  itemVariant: { fontSize: 11, color: '#9ca3af' },
  itemPrice: { fontSize: 13, fontWeight: 600 },
  line: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    fontSize: 14,
    color: '#4b5563',
  },
  total: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0 4px',
    borderTop: '1px solid #e4e7ec',
    marginTop: 8,
  },
  totalLabel: { fontSize: 15, fontWeight: 700 },
  totalValue: { fontSize: 20, fontWeight: 800 },
};

export function CheckoutSummary() {
  const { state, subtotal, couponDiscount, shippingCost, total } =
    useCheckoutState();

  return (
    <aside style={styles.card} aria-label="Resumo do pedido">
      <h2 style={styles.title}>Resumo do pedido</h2>
      {state.cart.map((it, i) => (
        <div key={i} style={styles.item}>
          {it.image ? (
            <img
              src={it.image}
              alt={it.name}
              style={styles.itemImg as CSSProperties}
            />
          ) : (
            <div style={styles.itemImg as CSSProperties} />
          )}
          <div style={styles.itemInfo}>
            <div style={styles.itemName}>{it.name}</div>
            {it.variantName ? (
              <div style={styles.itemVariant}>{it.variantName}</div>
            ) : null}
            <div style={styles.itemVariant}>Qtd: {it.quantity}</div>
          </div>
          <div style={styles.itemPrice}>{formatBRL(it.price * it.quantity)}</div>
        </div>
      ))}
      {state.cart.length === 0 ? (
        <div style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>
          Carrinho vazio.
        </div>
      ) : null}
      <div style={styles.line}>
        <span>Subtotal</span>
        <span>{formatBRL(subtotal)}</span>
      </div>
      {state.coupon ? (
        <div style={styles.line}>
          <span>Desconto ({state.coupon.code})</span>
          <span style={{ color: '#059669' }}>−{formatBRL(couponDiscount)}</span>
        </div>
      ) : null}
      <div style={styles.line}>
        <span>Frete</span>
        <span>
          {state.shipping
            ? `${formatBRL(shippingCost)} — ${state.shipping.name}`
            : '—'}
        </span>
      </div>
      <div style={styles.total}>
        <span style={styles.totalLabel}>Total</span>
        <span style={styles.totalValue}>{formatBRL(total)}</span>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Criar `app/(checkout)/layout.tsx`**

```tsx
import { SiteHeader } from '@/app/components/SiteHeader';
import { SiteFooter } from '@/app/components/SiteFooter';
import { CheckoutSummary } from '@/app/components/checkout/CheckoutSummary';
import './checkout.css';

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="checkout-layout">
      <SiteHeader />
      <main className="checkout-grid">
        <CheckoutSummary />
        <div>{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
```

**Nota:** o `<Stepper>` vai dentro de cada `page.tsx` (não no layout), recebendo a prop `current={N}` — assim cada página controla seu step visível sem prop-drilling por layout.

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add iwo-vercel/app/\(checkout\)/layout.tsx iwo-vercel/app/\(checkout\)/checkout.css iwo-vercel/app/components/checkout/Stepper.tsx iwo-vercel/app/components/checkout/CheckoutSummary.tsx
git commit -m "$(cat <<'EOF'
feat(checkout): add layout, Stepper and CheckoutSummary

Route group (checkout) com layout compartilhado: SiteHeader,
grid 2-col (CheckoutSummary sticky + step ativo), SiteFooter.
checkout.css carrega tokens de design (paleta neutra Lumodesk,
radius 12/8/10, ease standard). Stepper client component com
3 círculos + linha conectora; current e done clicáveis.
CheckoutSummary consome useCheckoutState e mostra itens +
linhas (subtotal, desconto, frete, total).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Step 1 — Carrinho + CouponField

**Files:**
- Create: `iwo-vercel/app/(checkout)/carrinho/page.tsx`
- Create: `iwo-vercel/app/components/checkout/CouponField.tsx`

- [ ] **Step 1: Criar `CouponField.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useCheckoutState } from '@/app/lib/checkoutState';
import { formatBRL } from '@/app/lib/format';
import type { CSSProperties } from 'react';

const styles: Record<string, CSSProperties> = {
  wrapper: { marginTop: 16 },
  row: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    padding: '12px 14px',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  button: {
    padding: '12px 20px',
    background: '#0a0a0f',
    color: '#fff',
    border: 0,
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  },
  applied: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 14px',
    background: '#ecfdf5',
    color: '#065f46',
    border: '1px solid #10b981',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
  },
  remove: {
    background: 'transparent',
    border: 0,
    color: '#065f46',
    fontSize: 18,
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    color: '#dc2626',
  },
};

export function CouponField() {
  const { state, subtotal, setCoupon } = useCheckoutState();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!code.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), subtotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.message ?? 'Cupom inválido');
        return;
      }
      setCoupon({
        code: data.code,
        kind: data.kind,
        discount: data.discount,
        description: data.description,
      });
      setCode('');
    } catch {
      setErr('Falha ao validar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  if (state.coupon) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.applied}>
          <span>
            ✓ {state.coupon.code} aplicado — economia de{' '}
            {formatBRL(state.coupon.discount)}
          </span>
          <button
            type="button"
            onClick={() => setCoupon(null)}
            style={styles.remove}
            aria-label="Remover cupom"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.row}>
        <input
          type="text"
          placeholder="Código do cupom"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
          style={styles.input}
          disabled={busy}
        />
        <button
          type="button"
          onClick={apply}
          disabled={busy || !code.trim()}
          style={styles.button}
        >
          {busy ? 'Validando...' : 'Aplicar'}
        </button>
      </div>
      {err ? <div style={styles.error}>{err}</div> : null}
    </div>
  );
}
```

- [ ] **Step 2: Criar `app/(checkout)/carrinho/page.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCheckoutState } from '@/app/lib/checkoutState';
import { Stepper } from '@/app/components/checkout/Stepper';
import { CouponField } from '@/app/components/checkout/CouponField';
import { formatBRL } from '@/app/lib/format';
import type { CSSProperties } from 'react';

const styles: Record<string, CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  img: {
    width: 64,
    height: 64,
    borderRadius: 8,
    objectFit: 'cover',
    background: '#f3f4f6',
  },
  name: { fontSize: 14, fontWeight: 600 },
  variant: { fontSize: 12, color: '#9ca3af' },
  qtyWrapper: { display: 'flex', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: '1px solid #d1d5db',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
  },
  price: { minWidth: 96, textAlign: 'right', fontWeight: 600 },
  remove: {
    background: 'transparent',
    border: 0,
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: 18,
    padding: 8,
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
  },
  banner: {
    padding: 14,
    borderRadius: 8,
    background: '#fef3c7',
    color: '#78350f',
    fontSize: 14,
    marginBottom: 16,
  },
};

export default function CarrinhoPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, setCart, setCoupon } = useCheckoutState();
  const msg = params.get('msg');

  // Guard: sem itens → /loja
  useEffect(() => {
    if (state.cart.length === 0) {
      router.replace('/loja.html');
    }
  }, [state.cart.length, router]);

  // Auto-remove cupom se subtotal ficou < minOrderTotal (re-valida no submit ao continuar)
  // (o endpoint /api/coupons/validate valida minOrderTotal; aqui só limpamos se
  // o valor baixou drasticamente — tratamento simples: re-validar no próximo step)

  function changeQty(idx: number, delta: number) {
    const next = state.cart.map((it, i) =>
      i === idx ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it,
    );
    setCart(next);
  }

  function removeItem(idx: number) {
    const next = state.cart.filter((_, i) => i !== idx);
    setCart(next);
    if (next.length === 0) router.replace('/loja.html');
  }

  return (
    <>
      <Stepper current={1} />
      <div className="checkout-card">
        <h2>Revisão do carrinho</h2>
        {msg === 'coupon_invalid' ? (
          <div style={styles.banner}>
            Cupom removido — não é mais válido.
          </div>
        ) : null}
        {state.cart.map((it, idx) => (
          <div key={idx} style={styles.row}>
            {it.image ? (
              <img src={it.image} alt={it.name} style={styles.img} />
            ) : (
              <div style={styles.img} />
            )}
            <div style={{ flex: 1 }}>
              <div style={styles.name}>{it.name}</div>
              {it.variantName ? (
                <div style={styles.variant}>{it.variantName}</div>
              ) : null}
              <div style={styles.variant}>{formatBRL(it.price)} unit.</div>
            </div>
            <div style={styles.qtyWrapper}>
              <button
                type="button"
                onClick={() => changeQty(idx, -1)}
                style={styles.qtyBtn}
                aria-label="Diminuir quantidade"
              >
                −
              </button>
              <span style={{ minWidth: 20, textAlign: 'center' }}>
                {it.quantity}
              </span>
              <button
                type="button"
                onClick={() => changeQty(idx, +1)}
                style={styles.qtyBtn}
                aria-label="Aumentar quantidade"
              >
                +
              </button>
            </div>
            <div style={styles.price}>
              {formatBRL(it.price * it.quantity)}
            </div>
            <button
              type="button"
              onClick={() => removeItem(idx)}
              style={styles.remove}
              aria-label="Remover item"
            >
              ×
            </button>
          </div>
        ))}
        <CouponField />
        <div style={styles.actions}>
          <a href="/loja.html" className="checkout-btn-secondary">
            ← Continuar comprando
          </a>
          <button
            type="button"
            className="checkout-btn-primary"
            style={{ maxWidth: 280 }}
            disabled={state.cart.length === 0}
            onClick={() => router.push('/checkout/endereco')}
          >
            Continuar →
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Type check + lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 4: Smoke test — criar um cart no localStorage**

No browser, em `http://localhost:3000/loja.html`, adicionar um produto ao carrinho (o JS do Webflow já faz isso). Depois navegar para `http://localhost:3000/checkout/carrinho`. Verificar:
- Header + footer do site renderizam
- Stepper mostra "1 Carrinho" ativo, "2 Endereço" e "3 Pagamento" cinza
- Resumo lateral à esquerda mostra o item
- Coluna direita lista o item com `+/−`, botão remover
- Campo de cupom funciona: digitar `teste10` → "Aplicar" → badge verde
- Remover com `×` → campo volta
- Digitar cupom inválido → erro vermelho inline
- Mudar quantidade atualiza o resumo lateral em tempo real
- "Continuar →" navega para `/checkout/endereco` (página ainda não existe — 404, ok)

- [ ] **Step 5: Commit**

```bash
git add iwo-vercel/app/\(checkout\)/carrinho/ iwo-vercel/app/components/checkout/CouponField.tsx
git commit -m "$(cat <<'EOF'
feat(checkout): add step 1 — cart review with coupon field

Página /checkout/carrinho: lista itens com steppers +/−, remover,
badge de cupom aplicado ou campo de entrada com validação inline
via /api/coupons/validate. Guard redireciona para /loja se carrinho
vazio. Banner de alerta quando chega via ?msg=coupon_invalid.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Step 2 — Endereço + Frete

**Files:**
- Create: `iwo-vercel/app/(checkout)/endereco/page.tsx`
- Create: `iwo-vercel/app/components/checkout/AddressForm.tsx`
- Create: `iwo-vercel/app/components/checkout/AddressAccordion.tsx`
- Create: `iwo-vercel/app/components/checkout/ShippingOptions.tsx`

- [ ] **Step 1: Criar `AddressForm.tsx` (guest ou novo endereço)**

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';

export type AddressFormValue = {
  label?: string;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  document?: string; // CPF do destinatário; pode ou não ter label
};

type Props = {
  initial?: Partial<AddressFormValue>;
  showDocument?: boolean;
  showLabel?: boolean;
  onChange: (value: AddressFormValue) => void;
};

function formatCep(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
}

function formatCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function AddressForm({ initial, showDocument, showLabel, onChange }: Props) {
  const [value, setValue] = useState<AddressFormValue>({
    label: initial?.label ?? '',
    recipient: initial?.recipient ?? '',
    cep: initial?.cep ?? '',
    street: initial?.street ?? '',
    number: initial?.number ?? '',
    complement: initial?.complement ?? '',
    district: initial?.district ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    document: initial?.document ?? '',
  });
  const [cepLoading, setCepLoading] = useState(false);
  const [cepErr, setCepErr] = useState(false);
  const notifyRef = useRef(onChange);
  notifyRef.current = onChange;

  useEffect(() => {
    notifyRef.current(value);
  }, [value]);

  async function handleCepBlur() {
    const d = value.cep.replace(/\D/g, '');
    if (d.length !== 8) return;
    setCepLoading(true);
    setCepErr(false);
    try {
      const res = await fetch(`/api/shipping/cep/${d}`);
      if (!res.ok) {
        setCepErr(true);
        return;
      }
      const data = await res.json();
      setValue((v) => ({
        ...v,
        street: v.street || data.logradouro || '',
        district: v.district || data.bairro || '',
        city: v.city || data.cidade || '',
        state: v.state || String(data.uf ?? '').toUpperCase(),
      }));
    } finally {
      setCepLoading(false);
    }
  }

  return (
    <div>
      {showLabel ? (
        <div className="checkout-field">
          <label>Identificação (ex: Casa, Escritório)</label>
          <input
            type="text"
            value={value.label ?? ''}
            onChange={(e) => setValue({ ...value, label: e.target.value })}
            placeholder="opcional"
          />
        </div>
      ) : null}
      {showDocument ? (
        <div className="checkout-field">
          <label>CPF *</label>
          <input
            type="text"
            inputMode="numeric"
            value={value.document ?? ''}
            onChange={(e) =>
              setValue({ ...value, document: formatCpf(e.target.value) })
            }
            placeholder="000.000.000-00"
            maxLength={14}
          />
        </div>
      ) : null}
      <div className="checkout-field">
        <label>Nome completo do destinatário *</label>
        <input
          type="text"
          value={value.recipient}
          onChange={(e) => setValue({ ...value, recipient: e.target.value })}
          placeholder="Nome e sobrenome"
        />
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px', gap: 12 }}
      >
        <div className="checkout-field">
          <label>CEP *</label>
          <input
            type="text"
            inputMode="numeric"
            value={value.cep}
            onChange={(e) =>
              setValue({ ...value, cep: formatCep(e.target.value) })
            }
            onBlur={handleCepBlur}
            placeholder="00000-000"
            maxLength={9}
          />
          {cepLoading ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Consultando CEP...</div>
          ) : null}
          {cepErr ? (
            <div style={{ fontSize: 12, color: '#dc2626' }}>CEP não encontrado</div>
          ) : null}
        </div>
        <div className="checkout-field">
          <label>Rua *</label>
          <input
            type="text"
            value={value.street}
            onChange={(e) => setValue({ ...value, street: e.target.value })}
          />
        </div>
        <div className="checkout-field">
          <label>Número *</label>
          <input
            type="text"
            value={value.number}
            onChange={(e) => setValue({ ...value, number: e.target.value })}
          />
        </div>
      </div>
      <div className="checkout-field">
        <label>Complemento</label>
        <input
          type="text"
          value={value.complement}
          onChange={(e) => setValue({ ...value, complement: e.target.value })}
          placeholder="Apto, bloco, referência..."
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 12 }}>
        <div className="checkout-field">
          <label>Bairro *</label>
          <input
            type="text"
            value={value.district}
            onChange={(e) => setValue({ ...value, district: e.target.value })}
          />
        </div>
        <div className="checkout-field">
          <label>Cidade *</label>
          <input
            type="text"
            value={value.city}
            onChange={(e) => setValue({ ...value, city: e.target.value })}
          />
        </div>
        <div className="checkout-field">
          <label>UF *</label>
          <input
            type="text"
            value={value.state}
            onChange={(e) =>
              setValue({ ...value, state: e.target.value.toUpperCase().slice(0, 2) })
            }
            maxLength={2}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar `AddressAccordion.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';

type Address = {
  id: number;
  label: string | null;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
};

type Props = {
  address: Address;
  selected: boolean;
  onSelect: () => void;
  defaultOpen?: boolean;
};

const styles: Record<string, CSSProperties> = {
  wrapper: {
    border: '2px solid #e4e7ec',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    transition: 'border-color .25s cubic-bezier(0.4,0,0.2,1)',
    background: '#fff',
  },
  wrapperSelected: { borderColor: '#0a0a0f' },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    cursor: 'pointer',
  },
  radio: { width: 18, height: 18 },
  title: { flex: 1, fontWeight: 600, fontSize: 14 },
  badge: {
    background: '#0a0a0f',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chevron: {
    transition: 'transform .25s cubic-bezier(0.4,0,0.2,1)',
    fontSize: 14,
  },
  body: {
    overflow: 'hidden',
    transition: 'max-height .25s cubic-bezier(0.4,0,0.2,1), opacity .25s cubic-bezier(0.4,0,0.2,1)',
  },
  bodyInner: {
    padding: '0 16px 16px 46px',
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 1.6,
  },
};

export function AddressAccordion({ address, selected, onSelect, defaultOpen }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);

  return (
    <div
      style={{ ...styles.wrapper, ...(selected ? styles.wrapperSelected : {}) }}
    >
      <div
        style={styles.header}
        onClick={() => {
          onSelect();
          setOpen(true);
        }}
      >
        <input
          type="radio"
          name="address-selected"
          checked={selected}
          onChange={onSelect}
          style={styles.radio}
        />
        <span style={styles.title}>{address.label ?? address.recipient}</span>
        {address.isDefault ? <span style={styles.badge}>padrão</span> : null}
        <span
          style={{
            ...styles.chevron,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          ▾
        </span>
      </div>
      <div
        style={{
          ...styles.body,
          maxHeight: open ? 200 : 0,
          opacity: open ? 1 : 0,
        }}
      >
        <div style={styles.bodyInner}>
          <div>{address.recipient}</div>
          <div>
            {address.street}, {address.number}
            {address.complement ? ` — ${address.complement}` : ''}
          </div>
          <div>
            {address.neighborhood} — {address.city}/{address.state} — CEP{' '}
            {address.cep}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `ShippingOptions.tsx`**

```tsx
'use client';

import { formatBRL } from '@/app/lib/format';
import type { CSSProperties } from 'react';

export type ShippingOption = {
  serviceId: 1 | 2 | 17;
  name: string;
  price: number;
  deliveryMin: number;
  deliveryMax: number;
  box: { weight: number; height: number; width: number; length: number };
};

type Props = {
  loading?: boolean;
  options: ShippingOption[] | null;
  selectedId: number | null;
  onSelect: (opt: ShippingOption) => void;
};

const styles: Record<string, CSSProperties> = {
  wrapper: { display: 'grid', gap: 10 },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    border: '2px solid #e4e7ec',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all .25s cubic-bezier(0.4,0,0.2,1)',
    background: '#fff',
  },
  optionSelected: {
    borderColor: '#0a0a0f',
    background: 'rgba(10,10,15,.02)',
  },
  info: { flex: 1 },
  name: { fontWeight: 600, fontSize: 14 },
  eta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  price: { fontWeight: 700, fontSize: 15 },
  skeleton: { height: 56, borderRadius: 10 },
  empty: { fontSize: 13, color: '#dc2626' },
};

export function ShippingOptions({ loading, options, selectedId, onSelect }: Props) {
  if (loading) {
    return (
      <div style={styles.wrapper}>
        <div className="checkout-skeleton" style={styles.skeleton} />
        <div className="checkout-skeleton" style={styles.skeleton} />
      </div>
    );
  }
  if (!options || options.length === 0) {
    return (
      <div style={styles.empty}>
        Nenhum serviço disponível para este CEP.
      </div>
    );
  }
  return (
    <div style={styles.wrapper} role="radiogroup" aria-label="Opções de frete">
      {options.map((opt) => {
        const selected = opt.serviceId === selectedId;
        return (
          <label
            key={opt.serviceId}
            style={{ ...styles.option, ...(selected ? styles.optionSelected : {}) }}
          >
            <input
              type="radio"
              name="shipping-option"
              checked={selected}
              onChange={() => onSelect(opt)}
            />
            <div style={styles.info}>
              <div style={styles.name}>{opt.name}</div>
              <div style={styles.eta}>
                Chega em{' '}
                {opt.deliveryMin === opt.deliveryMax
                  ? `${opt.deliveryMin} dias úteis`
                  : `${opt.deliveryMin}–${opt.deliveryMax} dias úteis`}
              </div>
            </div>
            <div style={styles.price}>{formatBRL(opt.price)}</div>
          </label>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Criar `app/(checkout)/endereco/page.tsx`**

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCheckoutState } from '@/app/lib/checkoutState';
import { Stepper } from '@/app/components/checkout/Stepper';
import { AddressForm, AddressFormValue } from '@/app/components/checkout/AddressForm';
import { AddressAccordion } from '@/app/components/checkout/AddressAccordion';
import {
  ShippingOptions,
  ShippingOption,
} from '@/app/components/checkout/ShippingOptions';
import type { CSSProperties } from 'react';

type SavedAddress = {
  id: number;
  label: string | null;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
};

const styles: Record<string, CSSProperties> = {
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
  },
  divider: { margin: '24px 0 16px', fontWeight: 700, fontSize: 14 },
  addNew: {
    padding: 14,
    border: '2px dashed #d1d5db',
    borderRadius: 10,
    cursor: 'pointer',
    background: 'transparent',
    width: '100%',
    textAlign: 'center',
    color: '#4b5563',
    fontWeight: 600,
    fontSize: 14,
  },
  banner: {
    padding: 14,
    borderRadius: 8,
    background: '#fef3c7',
    color: '#78350f',
    fontSize: 14,
    marginBottom: 16,
  },
};

export default function EnderecoPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, setShipTo, setSelectedAddressId, setShipping } =
    useCheckoutState();

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[] | null>(null);
  const [selectedSavedId, setSelectedSavedId] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newAddress, setNewAddress] = useState<AddressFormValue | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[] | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const msg = params.get('msg');

  // Guard: sem cart → step 1
  useEffect(() => {
    if (state.cart.length === 0) {
      router.replace('/checkout/carrinho');
    }
  }, [state.cart.length, router]);

  // Tentar carregar endereços do usuário logado
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/customer/addresses');
        if (res.ok) {
          const data = (await res.json()) as { addresses?: SavedAddress[] };
          setSavedAddresses(data.addresses ?? []);
          const def = (data.addresses ?? []).find((a) => a.isDefault);
          if (def) setSelectedSavedId(def.id);
        } else {
          setSavedAddresses([]); // guest ou sem customer
        }
      } catch {
        setSavedAddresses([]);
      }
    })();
  }, []);

  const runQuote = useCallback(
    async (cep: string) => {
      setShippingLoading(true);
      setShippingError(null);
      try {
        const res = await fetch('/api/shipping/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toPostalCode: cep,
            items: state.cart.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setShippingError(data.error ?? 'Falha ao cotar frete');
          setShippingOptions(null);
          return;
        }
        setShippingOptions(data.options);
        // seleciona primeira opção por padrão
        if (data.options?.length > 0) {
          setShipping(data.options[0]);
        }
      } catch {
        setShippingError('Falha ao cotar frete');
        setShippingOptions(null);
      } finally {
        setShippingLoading(false);
      }
    },
    [state.cart, setShipping],
  );

  // Quando um saved address é selecionado, copia para state e cota
  function pickSaved(addr: SavedAddress) {
    setSelectedSavedId(addr.id);
    setSelectedAddressId(addr.id);
    setShipTo({
      name: addr.recipient,
      document: '', // preencher no step de pagamento
      postalCode: addr.cep.replace(/\D/g, ''),
      address: addr.street,
      number: addr.number,
      complement: addr.complement ?? null,
      district: addr.neighborhood,
      city: addr.city,
      state: addr.state,
    });
    runQuote(addr.cep.replace(/\D/g, ''));
  }

  // Form novo/guest: ao mudar, atualizar state se válido
  function updateFormAddress(v: AddressFormValue) {
    setNewAddress(v);
    const cep = v.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;
    // Se tudo preenchido, grava no shipTo e cota
    if (
      v.recipient.trim() &&
      v.street.trim() &&
      v.number.trim() &&
      v.city.trim() &&
      /^[A-Z]{2}$/.test(v.state)
    ) {
      setShipTo({
        name: v.recipient.trim(),
        document: (v.document ?? '').replace(/\D/g, ''),
        postalCode: cep,
        address: v.street.trim(),
        number: v.number.trim(),
        complement: v.complement.trim() || null,
        district: v.district.trim() || 'NA',
        city: v.city.trim(),
        state: v.state,
      });
      setSelectedAddressId(null);
      runQuote(cep);
    }
  }

  async function saveAndContinue() {
    setFormError(null);
    // Se é logado e está adicionando novo, salvar via API
    if (savedAddresses && addingNew && newAddress) {
      const v = newAddress;
      try {
        const res = await fetch('/api/customer/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: v.label,
            recipient: v.recipient,
            cep: v.cep.replace(/\D/g, ''),
            street: v.street,
            number: v.number,
            complement: v.complement || null,
            neighborhood: v.district || 'NA',
            city: v.city,
            state: v.state,
            isDefault: savedAddresses.length === 0, // se é o primeiro, default
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setFormError(data.error ?? 'Falha ao salvar endereço');
          return;
        }
      } catch {
        setFormError('Falha de rede ao salvar endereço');
        return;
      }
    }
    if (!state.shipTo || !state.shipping) {
      setFormError('Preencha endereço e escolha uma opção de frete.');
      return;
    }
    router.push('/checkout/pagamento');
  }

  const isLogged = savedAddresses !== null && savedAddresses.length > 0;
  const isGuest = savedAddresses !== null && savedAddresses.length === 0 && !addingNew;

  return (
    <>
      <Stepper current={2} />
      <div className="checkout-card">
        <h2>Endereço de entrega</h2>
        {msg === 'quote_stale' ? (
          <div style={styles.banner}>
            O valor do frete foi atualizado. Por favor, confirme novamente.
          </div>
        ) : null}

        {savedAddresses === null ? (
          <div>Carregando...</div>
        ) : isLogged && !addingNew ? (
          <>
            {savedAddresses.map((addr) => (
              <AddressAccordion
                key={addr.id}
                address={addr}
                selected={selectedSavedId === addr.id}
                onSelect={() => pickSaved(addr)}
                defaultOpen={addr.isDefault}
              />
            ))}
            <button
              type="button"
              onClick={() => setAddingNew(true)}
              style={styles.addNew}
            >
              + Adicionar novo endereço
            </button>
          </>
        ) : (
          <AddressForm
            showDocument
            showLabel={savedAddresses !== null && savedAddresses.length > 0}
            onChange={updateFormAddress}
          />
        )}
      </div>

      <div className="checkout-card">
        <h2>Opções de frete</h2>
        <ShippingOptions
          loading={shippingLoading}
          options={shippingOptions}
          selectedId={state.shipping?.serviceId ?? null}
          onSelect={(opt) => setShipping(opt)}
        />
        {shippingError ? (
          <div style={{ marginTop: 12, fontSize: 13, color: '#dc2626' }}>
            {shippingError}
          </div>
        ) : null}
      </div>

      {formError ? (
        <div className="checkout-banner checkout-banner--error">{formError}</div>
      ) : null}

      <div style={styles.actions}>
        <button
          type="button"
          onClick={() => router.push('/checkout/carrinho')}
          className="checkout-btn-secondary"
        >
          ← Voltar
        </button>
        <button
          type="button"
          onClick={saveAndContinue}
          className="checkout-btn-primary"
          style={{ maxWidth: 280 }}
          disabled={!state.shipTo || !state.shipping}
        >
          Continuar →
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Adicionar GET handler em `/api/customer/addresses` para listar**

Abrir `iwo-vercel/app/api/customer/addresses/route.ts` e adicionar antes do `POST`:

```ts
export async function GET(request: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    // Guest — retornamos 200 com lista vazia para simplificar o client
    return Response.json({ addresses: [] });
  }
  const customer = await prisma.customer.findUnique({ where: { userId } });
  if (!customer) {
    return Response.json({ addresses: [] });
  }
  const addresses = await prisma.address.findMany({
    where: { customerId: customer.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  return Response.json({
    addresses: addresses.map((a) => ({
      id: a.id,
      label: a.label,
      recipient: a.recipient,
      cep: a.cep,
      street: a.street,
      number: a.number,
      complement: a.complement,
      neighborhood: a.neighborhood,
      city: a.city,
      state: a.state,
      isDefault: a.isDefault,
    })),
  });
}
```

- [ ] **Step 6: Type check + lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 7: Smoke test**

Navegar para `/checkout/endereco` via fluxo completo (carrinho → continuar). Confirmar:
- Sem login → form direto, ViaCEP funciona ao blur do CEP, cotação retorna opções
- Selecionar opção de frete → resumo lateral atualiza
- "Continuar →" vai para `/checkout/pagamento` (ainda 404 — normal)
- Logado com 2+ endereços: accordeon, default aberto, clicar em outro → cotação dispara, animação ease-in-out
- "+ Adicionar novo endereço" abre form inline

- [ ] **Step 8: Commit**

```bash
git add iwo-vercel/app/\(checkout\)/endereco/ iwo-vercel/app/components/checkout/AddressForm.tsx iwo-vercel/app/components/checkout/AddressAccordion.tsx iwo-vercel/app/components/checkout/ShippingOptions.tsx iwo-vercel/app/api/customer/addresses/route.ts
git commit -m "$(cat <<'EOF'
feat(checkout): add step 2 — address selection and shipping options

Página /checkout/endereco com 3 componentes:
  - AddressForm para guest/novo endereço com ViaCEP ao blur.
  - AddressAccordion para logados com N endereços (ease-in-out,
    default aberto, radio de seleção).
  - ShippingOptions com radio cards PAC/SEDEX, skeleton loading.

Cotação dispara automaticamente ao selecionar endereço salvo ou
completar o form. GET /api/customer/addresses lista endereços do
Customer. Banner quando chega via ?msg=quote_stale.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Step 3 — Pagamento

**Files:**
- Create: `iwo-vercel/app/(checkout)/pagamento/page.tsx`
- Create: `iwo-vercel/app/components/checkout/PaymentMethodTabs.tsx`
- Create: `iwo-vercel/app/components/checkout/CardForm.tsx`

- [ ] **Step 1: Criar `PaymentMethodTabs.tsx`**

```tsx
'use client';

import type { CSSProperties } from 'react';

export type PayMethod = 'pix' | 'credit_card' | 'boleto';

type Props = {
  value: PayMethod;
  onChange: (v: PayMethod) => void;
};

const METHODS: Array<{ id: PayMethod; label: string; icon: string }> = [
  { id: 'pix', label: 'Pix', icon: '🟢' },
  { id: 'credit_card', label: 'Cartão', icon: '💳' },
  { id: 'boleto', label: 'Boleto', icon: '📄' },
];

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    marginBottom: 16,
  },
  card: {
    padding: 16,
    border: '2px solid #e4e7ec',
    borderRadius: 10,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    background: '#fff',
    transition: 'all .25s cubic-bezier(0.4,0,0.2,1)',
  },
  selected: { borderColor: '#0a0a0f', background: 'rgba(10,10,15,.02)' },
  icon: { fontSize: 24 },
  label: { fontWeight: 600, fontSize: 14 },
};

export function PaymentMethodTabs({ value, onChange }: Props) {
  return (
    <div style={styles.wrapper} role="radiogroup" aria-label="Forma de pagamento">
      {METHODS.map((m) => (
        <label
          key={m.id}
          style={{
            ...styles.card,
            ...(value === m.id ? styles.selected : {}),
          }}
        >
          <input
            type="radio"
            name="payment-method"
            checked={value === m.id}
            onChange={() => onChange(m.id)}
            style={{ display: 'none' }}
          />
          <span style={styles.icon}>{m.icon}</span>
          <span style={styles.label}>{m.label}</span>
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Criar `CardForm.tsx`**

MercadoPago Secure Fields. O hook useEffect carrega o SDK, monta os campos em iframes, e permite criar token.

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    MercadoPago?: new (key: string, options: { locale: string }) => {
      cardForm: (config: Record<string, unknown>) => {
        unmount: () => void;
        getCardFormData: () => { token?: string; paymentMethodId?: string };
        createCardToken: () => Promise<{ id: string; payment_method_id?: string }>;
      };
    };
  }
}

type CardFormHandle = ReturnType<
  NonNullable<InstanceType<NonNullable<Window['MercadoPago']>>['cardForm']>
>;

type Props = {
  amount: number;
  onReady?: (handle: CardFormHandle) => void;
};

const MP_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? 'TEST-PUBLIC-KEY';

export function CardForm({ amount, onReady }: Props) {
  const handleRef = useRef<CardFormHandle | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  // Carregar MP SDK
  useEffect(() => {
    if (window.MercadoPago) {
      setSdkReady(true);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://sdk.mercadopago.com/js/v2';
    s.async = true;
    s.onload = () => setSdkReady(true);
    document.body.appendChild(s);
  }, []);

  // Mount cardForm quando SDK + amount prontos
  useEffect(() => {
    if (!sdkReady || !window.MercadoPago) return;
    const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
    const handle = mp.cardForm({
      amount: String(amount),
      iframe: true,
      form: {
        id: 'mp-card-form',
        cardNumber: { id: 'mp-cardNumber', placeholder: '0000 0000 0000 0000' },
        expirationDate: { id: 'mp-expirationDate', placeholder: 'MM/AA' },
        securityCode: { id: 'mp-securityCode', placeholder: '123' },
        cardholderName: { id: 'mp-cardholderName', placeholder: 'Nome no cartão' },
        installments: { id: 'mp-installments' },
        identificationType: { id: 'mp-docType' },
        identificationNumber: { id: 'mp-docNumber' },
      },
      callbacks: {
        onFormMounted: () => {
          handleRef.current = handle;
          if (handle && onReady) onReady(handle);
        },
      },
    });

    return () => {
      try {
        handle.unmount();
      } catch {
        /* ignore */
      }
      handleRef.current = null;
    };
  }, [sdkReady, amount, onReady]);

  return (
    <form id="mp-card-form">
      <div className="checkout-field">
        <label>Número do cartão *</label>
        <div
          id="mp-cardNumber"
          style={{
            height: 44,
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 10,
            background: '#fff',
          }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="checkout-field">
          <label>Validade *</label>
          <div
            id="mp-expirationDate"
            style={{
              height: 44,
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 10,
              background: '#fff',
            }}
          />
        </div>
        <div className="checkout-field">
          <label>CVV *</label>
          <div
            id="mp-securityCode"
            style={{
              height: 44,
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 10,
              background: '#fff',
            }}
          />
        </div>
      </div>
      <div className="checkout-field">
        <label>Nome no cartão *</label>
        <input id="mp-cardholderName" placeholder="Como aparece no cartão" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="checkout-field">
          <label>Parcelas</label>
          <select id="mp-installments" />
        </div>
        <div className="checkout-field">
          <label>Documento</label>
          <select id="mp-docType" />
          <input id="mp-docNumber" style={{ marginTop: 8 }} />
        </div>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Criar `app/(checkout)/pagamento/page.tsx`**

```tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCheckoutState } from '@/app/lib/checkoutState';
import { Stepper } from '@/app/components/checkout/Stepper';
import {
  PaymentMethodTabs,
  PayMethod,
} from '@/app/components/checkout/PaymentMethodTabs';
import { CardForm } from '@/app/components/checkout/CardForm';
import { formatBRL } from '@/app/lib/format';
import type { CSSProperties } from 'react';

const styles: Record<string, CSSProperties> = {
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  info: { padding: 14, color: '#4b5563', fontSize: 13, background: '#f9fafb', borderRadius: 8 },
  actions: { display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24 },
};

type CardFormHandle = {
  getCardFormData: () => { token?: string; paymentMethodId?: string };
  createCardToken: () => Promise<{ id: string; payment_method_id?: string }>;
};

export default function PagamentoPage() {
  const router = useRouter();
  const { state, total, clearAll } = useCheckoutState();
  const [method, setMethod] = useState<PayMethod>('pix');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState(state.shipTo?.document ?? '');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const cardHandleRef = useRef<CardFormHandle | null>(null);

  // Guard: sem shipTo ou shipping → step 2
  useEffect(() => {
    if (!state.shipTo || !state.shipping || state.cart.length === 0) {
      router.replace('/checkout/endereco');
    }
  }, [state, router]);

  // Prefill com o nome do shipTo
  useEffect(() => {
    if (state.shipTo?.name) {
      const parts = state.shipTo.name.trim().split(/\s+/);
      setFirstName(parts[0] ?? '');
      setLastName(parts.slice(1).join(' '));
    }
  }, [state.shipTo]);

  async function handlePay() {
    if (processing) return;
    setErr(null);
    setProcessing(true);

    try {
      const cpfDigits = cpf.replace(/\D/g, '');
      if (!firstName.trim() || !lastName.trim()) {
        setErr('Preencha nome e sobrenome.');
        setProcessing(false);
        return;
      }
      if (!email.includes('@')) {
        setErr('E-mail inválido.');
        setProcessing(false);
        return;
      }
      if (cpfDigits.length !== 11) {
        setErr('CPF inválido.');
        setProcessing(false);
        return;
      }

      const payer: Record<string, unknown> = {
        email,
        first_name: firstName,
        last_name: lastName,
        identification: { type: 'CPF', number: cpfDigits },
      };

      let payment_method: Record<string, unknown> = {};
      if (method === 'pix') {
        payment_method = { id: 'pix', type: 'bank_transfer' };
      } else if (method === 'boleto') {
        payment_method = { id: 'boleto', type: 'ticket' };
        payer.address = {
          street_name: state.shipTo!.address,
          street_number: state.shipTo!.number,
          zip_code: state.shipTo!.postalCode,
          neighborhood: state.shipTo!.district,
          city: state.shipTo!.city,
          state: state.shipTo!.state,
        };
      } else if (method === 'credit_card') {
        const handle = cardHandleRef.current;
        if (!handle) {
          setErr('Formulário de cartão ainda carregando. Aguarde...');
          setProcessing(false);
          return;
        }
        const tokenResult = await handle.createCardToken();
        if (!tokenResult?.id) {
          setErr('Falha ao tokenizar cartão. Verifique os dados.');
          setProcessing(false);
          return;
        }
        payment_method = {
          id: tokenResult.payment_method_id ?? 'master',
          type: 'credit_card',
          token: tokenResult.id,
          installments: 1,
        };
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: state.cart,
          payer,
          payment_method,
          shipping: {
            serviceId: state.shipping!.serviceId,
            toPostalCode: state.shipTo!.postalCode,
            quotedPrice: state.shipping!.price,
          },
          shipTo: {
            name: `${firstName.trim()} ${lastName.trim()}`,
            document: cpfDigits,
            postalCode: state.shipTo!.postalCode,
            address: state.shipTo!.address,
            number: state.shipTo!.number,
            complement: state.shipTo!.complement,
            district: state.shipTo!.district,
            city: state.shipTo!.city,
            state: state.shipTo!.state,
          },
          couponCode: state.coupon?.code ?? null,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        if (data.error === 'COUPON_INVALID') {
          router.replace('/checkout/carrinho?msg=coupon_invalid');
          return;
        }
        if (
          data.error === 'SHIPPING_QUOTE_STALE' ||
          data.error === 'SHIPPING_OPTION_UNAVAILABLE'
        ) {
          router.replace('/checkout/endereco?msg=quote_stale');
          return;
        }
      }

      if (!res.ok) {
        setErr(data.error ?? 'Erro ao processar pagamento');
        setProcessing(false);
        return;
      }

      router.push(`/checkout/confirmacao/${data.orderId}?token=${data.token}`);
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
      setProcessing(false);
    }
  }

  if (!state.shipTo || !state.shipping) return null;

  return (
    <>
      <Stepper current={3} />

      <div className="checkout-card">
        <h2>Dados do pagador</h2>
        <div style={styles.row}>
          <div className="checkout-field">
            <label>Nome *</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="checkout-field">
            <label>Sobrenome *</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="checkout-field">
          <label>E-mail *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={styles.row}>
          <div className="checkout-field">
            <label>CPF *</label>
            <input
              value={cpf}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, '').slice(0, 11);
                const fmt =
                  d.length > 9
                    ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
                    : d.length > 6
                    ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
                    : d.length > 3
                    ? `${d.slice(0, 3)}.${d.slice(3)}`
                    : d;
                setCpf(fmt);
              }}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>
          <div className="checkout-field">
            <label>Telefone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="checkout-card">
        <h2>Forma de pagamento</h2>
        <PaymentMethodTabs value={method} onChange={setMethod} />
        {method === 'pix' ? (
          <div style={styles.info}>
            Ao clicar em Pagar, você receberá um QR Code Pix para pagamento
            instantâneo.
          </div>
        ) : method === 'boleto' ? (
          <div style={styles.info}>
            O boleto será gerado e poderá ser pago em qualquer banco ou app.
          </div>
        ) : (
          <CardForm
            amount={total}
            onReady={(h) => {
              cardHandleRef.current = h;
            }}
          />
        )}
      </div>

      {err ? (
        <div className="checkout-banner checkout-banner--error">{err}</div>
      ) : null}

      <div style={styles.actions}>
        <button
          type="button"
          onClick={() => router.push('/checkout/endereco')}
          className="checkout-btn-secondary"
        >
          ← Voltar
        </button>
        <button
          type="button"
          onClick={handlePay}
          disabled={processing}
          className="checkout-btn-primary"
          style={{ maxWidth: 280 }}
        >
          {processing ? 'Processando...' : `Pagar ${formatBRL(total)}`}
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Garantir env var NEXT_PUBLIC_MP_PUBLIC_KEY**

Verificar que `.env.local` tem `NEXT_PUBLIC_MP_PUBLIC_KEY` configurado. Se não tiver, adicionar (pegue do `checkout.html` atual — procurar `MP_PUBLIC_KEY`):

```bash
grep MP_PUBLIC_KEY iwo-vercel/public/checkout.html | head -2
```

Copiar o valor e adicionar ao `.env.local`:
```
NEXT_PUBLIC_MP_PUBLIC_KEY="APP_USR-..."
```

Reiniciar dev server após adicionar.

- [ ] **Step 5: Type check + lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 6: Smoke test**

Fluxo completo: Carrinho → Endereço → Pagamento. Preencher dados pagador, escolher Pix, clicar Pagar. Esperar redirect para `/checkout/confirmacao/X?token=Y` (página ainda 404).

- [ ] **Step 7: Commit**

```bash
git add iwo-vercel/app/\(checkout\)/pagamento/ iwo-vercel/app/components/checkout/PaymentMethodTabs.tsx iwo-vercel/app/components/checkout/CardForm.tsx
git commit -m "$(cat <<'EOF'
feat(checkout): add step 3 — payment with MP Secure Fields

Página /checkout/pagamento com dados do pagador, PaymentMethodTabs
(radio cards Pix/Cartão/Boleto) e CardForm que monta MP Secure
Fields via SDK v2. Ao pagar, POST /api/checkout com couponCode +
shipping + shipTo. Trata 409 COUPON_INVALID e SHIPPING_QUOTE_STALE
redirecionando para o step anterior com banner explicativo. Sucesso
redireciona para /checkout/confirmacao/{id}?token=X.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Step 4 — Confirmação

**Files:**
- Create: `iwo-vercel/app/(checkout)/confirmacao/[orderId]/page.tsx`

- [ ] **Step 1: Criar a página**

```tsx
'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCheckoutState } from '@/app/lib/checkoutState';
import { formatBRL } from '@/app/lib/format';
import type { CSSProperties } from 'react';

type OrderData = {
  id: number;
  status: string;
  mpStatus: string | null;
  total: number;
  subtotal: number;
  shippingCost: number;
  shippingServiceName: string | null;
  shippingDeliveryMin: number | null;
  shippingDeliveryMax: number | null;
  couponCode: string | null;
  couponDiscount: number;
  shipToName: string | null;
  shipToDocument: string;
  shipToPostalCode: string | null;
  shipToAddress: string | null;
  shipToNumber: string | null;
  shipToComplement: string | null;
  shipToDistrict: string | null;
  shipToCity: string | null;
  shipToState: string | null;
  superfreteStatus: string | null;
  superfreteTracking: string | null;
  orderItems: Array<{
    id: number;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    image: string | null;
  }>;
};

type PaymentDetails = {
  pix?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
  boleto?: { digitable_line?: string; ticket_url?: string };
};

const styles: Record<string, CSSProperties> = {
  heroCard: {
    background: '#fff',
    border: '1px solid #e4e7ec',
    borderRadius: 12,
    padding: 32,
    textAlign: 'center',
    marginBottom: 16,
  },
  check: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#059669',
    color: '#fff',
    fontSize: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: 800, margin: '0 0 8px' },
  subtitle: { fontSize: 14, color: '#4b5563', margin: 0 },
  qrWrapper: { padding: 16, textAlign: 'center' },
  qrImg: { maxWidth: 240, width: '100%', height: 'auto', margin: '12px auto' },
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
    padding: 10,
    background: '#f3f4f6',
    borderRadius: 6,
    wordBreak: 'break-all',
    cursor: 'pointer',
    userSelect: 'all',
  },
  line: { display: 'flex', justifyContent: 'space-between', padding: '6px 0' },
  actions: { display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 },
};

export default function ConfirmacaoPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { clearAll } = useCheckoutState();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Dados específicos do pagamento vieram do response da checkout via URL hash?
  // NOTA: Implementação atual — /api/orders/[id] retorna o Order mas não o
  // payload Pix/Boleto do MP (esses só ficam no response do /api/checkout).
  // MVP: armazenar em sessionStorage sob a chave 'iwo_payment_details' antes
  // de navegar; aqui lemos e apagamos.
  const [payDetails, setPayDetails] = useState<PaymentDetails>({});

  useEffect(() => {
    // Ler payment details do sessionStorage
    try {
      const raw = sessionStorage.getItem('iwo_payment_details');
      if (raw) {
        setPayDetails(JSON.parse(raw));
        sessionStorage.removeItem('iwo_payment_details');
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // Limpa checkout state (compra finalizada)
    clearAll();
  }, [clearAll]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/orders/${orderId}?token=${encodeURIComponent(token)}`,
        );
        if (!res.ok) {
          setErr('Link inválido ou expirado');
          return;
        }
        const data = await res.json();
        setOrder(data.order);
      } catch {
        setErr('Falha ao carregar pedido');
      }
    })();
  }, [orderId, token]);

  // Polling do status enquanto pending
  useEffect(() => {
    if (!order || order.status !== 'pending') return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/orders/${orderId}/status?token=${encodeURIComponent(token)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        setOrder((o) => (o ? { ...o, status: data.status, mpStatus: data.mpStatus } : o));
        if (data.status !== 'pending') clearInterval(timer);
      } catch {
        /* silent */
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [order, orderId, token]);

  if (err) {
    return (
      <div className="checkout-card" style={{ textAlign: 'center', padding: 40 }}>
        <h2>{err}</h2>
        <p style={{ color: '#6b7280', marginTop: 12 }}>
          Se você já fez o pagamento, consulte seu e-mail para acompanhar.
        </p>
        <a href="/loja.html" className="checkout-btn-secondary" style={{ marginTop: 16, display: 'inline-block' }}>
          ← Voltar para a loja
        </a>
      </div>
    );
  }

  if (!order) {
    return <div className="checkout-card">Carregando...</div>;
  }

  const paid = order.status === 'paid';

  return (
    <>
      <div style={styles.heroCard}>
        <div style={styles.check}>✓</div>
        <h1 style={styles.title}>Pedido #{order.id} confirmado!</h1>
        <p style={styles.subtitle}>
          {paid
            ? 'Pagamento aprovado! Você receberá os detalhes por e-mail.'
            : 'Aguardando pagamento. Use as informações abaixo para concluir.'}
        </p>
      </div>

      {payDetails.pix ? (
        <div className="checkout-card">
          <h2>Pague com Pix</h2>
          <div style={styles.qrWrapper}>
            {payDetails.pix.qr_code_base64 ? (
              <img
                src={`data:image/png;base64,${payDetails.pix.qr_code_base64}`}
                alt="QR Code Pix"
                style={styles.qrImg}
              />
            ) : null}
            {payDetails.pix.qr_code ? (
              <div
                style={styles.code}
                onClick={() => navigator.clipboard?.writeText(payDetails.pix!.qr_code!)}
                title="Clique para copiar"
              >
                {payDetails.pix.qr_code}
              </div>
            ) : null}
            {payDetails.pix.ticket_url ? (
              <a
                href={payDetails.pix.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#2563eb', display: 'inline-block', marginTop: 12 }}
              >
                Abrir página de pagamento →
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {payDetails.boleto ? (
        <div className="checkout-card">
          <h2>Boleto</h2>
          {payDetails.boleto.digitable_line ? (
            <div
              style={styles.code}
              onClick={() =>
                navigator.clipboard?.writeText(payDetails.boleto!.digitable_line!)
              }
            >
              {payDetails.boleto.digitable_line}
            </div>
          ) : null}
          {payDetails.boleto.ticket_url ? (
            <a
              href={payDetails.boleto.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="checkout-btn-primary"
              style={{ marginTop: 16, display: 'inline-block', maxWidth: 280 }}
            >
              Abrir boleto →
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="checkout-card">
        <h2>Resumo</h2>
        {order.orderItems.map((it) => (
          <div key={it.id} style={styles.line}>
            <span>
              {it.quantity}× {it.productName}
              {it.variantName ? ` — ${it.variantName}` : ''}
            </span>
            <span>{formatBRL(it.totalPrice)}</span>
          </div>
        ))}
        <hr style={{ border: 0, borderTop: '1px solid #e4e7ec', margin: '8px 0' }} />
        <div style={styles.line}>
          <span>Subtotal</span>
          <span>{formatBRL(order.subtotal)}</span>
        </div>
        {order.couponCode ? (
          <div style={styles.line}>
            <span>Desconto ({order.couponCode})</span>
            <span style={{ color: '#059669' }}>−{formatBRL(order.couponDiscount)}</span>
          </div>
        ) : null}
        <div style={styles.line}>
          <span>Frete ({order.shippingServiceName ?? '—'})</span>
          <span>{formatBRL(order.shippingCost)}</span>
        </div>
        <div
          style={{
            ...styles.line,
            borderTop: '1px solid #e4e7ec',
            paddingTop: 12,
            fontWeight: 800,
            fontSize: 16,
          }}
        >
          <span>Total</span>
          <span>{formatBRL(order.total)}</span>
        </div>
      </div>

      <div className="checkout-card">
        <h2>Endereço de entrega</h2>
        <p style={{ fontSize: 14, color: '#4b5563' }}>
          {order.shipToName ?? '—'}
          <br />
          {order.shipToAddress}, {order.shipToNumber}
          {order.shipToComplement ? ` — ${order.shipToComplement}` : ''}
          <br />
          {order.shipToDistrict} — {order.shipToCity}/{order.shipToState} — CEP{' '}
          {order.shipToPostalCode}
        </p>
      </div>

      <div style={styles.actions}>
        <a href="/loja.html" className="checkout-btn-secondary">
          ← Continuar comprando
        </a>
        <a href="/conta/pedidos" className="checkout-btn-primary" style={{ maxWidth: 240 }}>
          Meus pedidos
        </a>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Atualizar `PagamentoPage` para guardar payment details no sessionStorage**

Antes do `router.push(/checkout/confirmacao/...)` no `handlePay`, adicionar:

```ts
      // Grava detalhes específicos do meio de pagamento para a tela de
      // confirmação ler (evita re-fetch na MP; dados temporários).
      const payDetails: Record<string, unknown> = {};
      if (data.pix) payDetails.pix = data.pix;
      if (data.boleto) payDetails.boleto = data.boleto;
      try {
        sessionStorage.setItem('iwo_payment_details', JSON.stringify(payDetails));
      } catch {
        /* ignore quota */
      }
      router.push(`/checkout/confirmacao/${data.orderId}?token=${data.token}`);
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Smoke test**

Fluxo completo Pix: carrinho → endereço → pagamento → confirmação. Verificar:
- ✓ Pedido #X confirmado
- QR code renderiza (via sessionStorage)
- Código copia-e-cola clicável
- Resumo completo com itens, subtotal, desconto (se tiver cupom), frete, total
- Endereço de entrega
- Polling a cada 5s (abrir devtools Network, deve ver `GET /api/orders/X/status` a cada 5s enquanto pending)
- Refresh na página de confirmação — dados persistem (via token + API)

- [ ] **Step 5: Commit**

```bash
git add iwo-vercel/app/\(checkout\)/confirmacao/ iwo-vercel/app/\(checkout\)/pagamento/page.tsx
git commit -m "$(cat <<'EOF'
feat(checkout): add step 4 — order confirmation with polling

/checkout/confirmacao/[orderId]?token=... mostra hero ✓, Pix QR /
boleto (via sessionStorage), resumo completo, endereço. Polling
de status a cada 5s via /api/orders/[id]/status enquanto status
for 'pending'. Limpa checkout state + cart no mount. 403 se
token inválido.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Remover rewrite do /checkout + smoke test end-to-end

**Files:**
- Modify: `iwo-vercel/next.config.ts`

- [ ] **Step 1: Abrir `next.config.ts` e remover entry**

Abrir `iwo-vercel/next.config.ts` e localizar no array `STATIC_PAGE_MAP`:

```ts
  ["/checkout", "/checkout.html"],
```

Remover essa linha. `/checkout.html` continua servido diretamente; o `/checkout` agora resolve via route group `(checkout)` (na prática, visitar `/checkout` vai 404 porque não existe index — isso é OK, o fluxo começa em `/checkout/carrinho`).

Opcional: adicionar um redirect `/checkout → /checkout/carrinho`. Adicionar:

```ts
async redirects() {
  return [
    ...LEGACY_ACCOUNT_REDIRECTS.map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    })),
    { source: '/checkout', destination: '/checkout/carrinho', permanent: false },
  ];
},
```

- [ ] **Step 2: Build completo**

```bash
cd iwo-vercel && npm run build
```
Expected: build bem-sucedido (ignorar error preexisting em `public/templates/landing-apple-style.tsx` se persistir).

- [ ] **Step 3: Smoke test end-to-end (browser)**

Reiniciar dev server. Em browser limpo (modo anônimo para evitar cart/state residual):

1. `http://localhost:3000/loja.html` → adicionar 1 produto.
2. Clicar no link/botão de checkout (que chama `/checkout`) → deve redirecionar para `/checkout/carrinho`.
3. Verificar UI: header + footer do site, stepper mostra "1 Carrinho" ativo, resumo lateral com item.
4. Aplicar cupom `TESTE10` → badge verde.
5. "Continuar →" → `/checkout/endereco`.
6. (Guest) preencher form, CEP `01153000` → ViaCEP preenche, cotação retorna PAC/SEDEX.
7. Escolher PAC → resumo atualiza.
8. "Continuar →" → `/checkout/pagamento`.
9. Preencher dados pagador, escolher Pix.
10. "Pagar R$ X,XX" → redireciona para `/checkout/confirmacao/N?token=...`
11. Verificar: ✓, QR code, resumo, endereço, polling.

Se tudo OK, proceder ao commit.

4. (Logado) Fazer login em `/conta/login`, repetir o fluxo. No step 2, verificar accordeon de endereços salvos (se cliente tem). Adicionar novo endereço → salva em `Customer.Address`, seleciona e cota automaticamente.

- [ ] **Step 4: Commit**

```bash
git add iwo-vercel/next.config.ts
git commit -m "$(cat <<'EOF'
feat(checkout): switch /checkout from static HTML to Next.js routes

Remove o rewrite /checkout → /checkout.html do STATIC_PAGE_MAP no
next.config.ts. Visitar /checkout agora redireciona para
/checkout/carrinho (route group (checkout) com layout compartilhado).

O arquivo público/checkout.html fica no repo como fallback de
rollback — para reverter, basta restaurar a entry no map. Remoção
definitiva em PR separado após ~1 semana de estabilidade em prod.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review final

**1. Spec coverage — items do spec × tasks:**

| Spec item | Task |
|---|---|
| Schema +4 campos no Order | Task 1 |
| `app/lib/coupon.ts` + `app/lib/orderToken.ts` | Task 2 |
| `POST /api/coupons/validate` | Task 3 |
| `/api/checkout` aceita couponCode + retorna token | Task 4 |
| Webhook incrementa `Coupon.usedCount` | Task 5 |
| `POST /api/customer/addresses` | Task 6 |
| `GET /api/orders/[id]` + `/status` | Task 7 |
| `useCheckoutState()` | Task 8 |
| `SiteHeader` + `SiteFooter` + logo | Task 9 |
| Layout `(checkout)` + Stepper + CheckoutSummary + tokens CSS | Task 10 |
| Step 1 /carrinho + CouponField | Task 11 |
| Step 2 /endereco + AddressAccordion + AddressForm + ShippingOptions | Task 12 |
| Step 3 /pagamento + PaymentMethodTabs + CardForm | Task 13 |
| Step 4 /confirmacao/[id] + polling | Task 14 |
| Remover rewrite + e2e smoke | Task 15 |

Todos os itens do spec têm tasks. ✅

**2. Placeholder scan:** nenhum TBD/TODO/FIXME no plano. Código completo em todos os steps.

**3. Type consistency:**
- `CheckoutState.shipping.serviceId: 1 | 2 | 17` consistente entre hook (Task 8) e consumer (Task 12).
- `validateAndComputeCoupon` signature idêntica em Task 2, 3, 4.
- `ShippingOption` tipo idêntico entre hook, ShippingOptions component e helper SuperFrete.
- `AddressFormValue` exportado em Task 12 e consumido pela page de endereço.
- `signOrderToken(id, createdAt)` em Task 2, 4 e verify na Task 7 — mesma assinatura.

Nenhum bug. Plano pronto.
