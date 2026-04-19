# Checkout stepper redesign — design

**Data:** 2026-04-19
**Autor:** Claude (brainstorming com @gubressan)
**Status:** aprovado, pronto para implementação

## Objetivo

Redesenhar o checkout atual (`public/checkout.html`, single-page vanilla JS) em um fluxo multi-etapa baseado em rotas Next.js, com 3 steps principais (Carrinho → Endereço → Pagamento) mais uma tela de Confirmação, visual inspirado em Lumodesk/Stripe, header/footer oficiais do site Webflow, logo oficial, accordeon de endereços salvos, cupom de desconto, e estado centralizado em `localStorage`.

## Escopo

### Incluído

- Migração do checkout de `public/checkout.html` para rotas Next.js em `app/(checkout)/*`.
- Layout compartilhado com `<SiteHeader />`, `<Stepper />`, `<CheckoutSummary />`, `<SiteFooter />`.
- 4 páginas de step: `/checkout/carrinho`, `/checkout/endereco`, `/checkout/pagamento`, `/checkout/confirmacao/[orderId]`.
- Novo endpoint `POST /api/coupons/validate` e integração com `/api/checkout` existente.
- Novo endpoint `POST /api/customer/addresses` para cadastrar/atualizar endereço de cliente logado.
- Novo endpoint `GET /api/orders/[id]` + `GET /api/orders/[id]/status` para a tela de confirmação (token HMAC de um-uso).
- Incremento de `Coupon.usedCount` no webhook MP quando pagamento vira `paid`.
- Adição de 4 campos aditivos no `model Order`: `couponCode`, `couponKind`, `couponDiscount`, `couponId`.
- Extração do header e footer do site Webflow (`public/loja.html`) para componentes React.
- Substituição do texto "IWO Watch" pelo logo oficial (`public/images/iwo_cinza_extended-1-p-500.webp`).
- Componentes: `<Stepper />`, `<CheckoutSummary />`, `<AddressAccordion />`, `<ShippingOptions />`, `<CouponField />`, `<PaymentMethodTabs />`, `<PayButton />`.
- Design tokens em CSS variables (paleta neutra estilo Lumodesk, radius 12/8/10, sombras suaves).
- Motion: accordeon `ease-in-out 0.25s`, step transitions, skeletons.

### Fora do escopo

- Remoção do `public/checkout.html` antigo (fica no repo; rewrite `/checkout → /checkout.html` é removido do `next.config.ts` para a rota Next.js vencer).
- Emissão de NF-e (já decidido em spec anterior — declaração de conteúdo).
- Pagamento automático da etiqueta SuperFrete via saldo da carteira.
- Jadlog/Loggi (apenas Correios).
- Tela `/conta/enderecos` dedicada para clientes gerenciarem endereços (upsert acontece inline no checkout apenas).
- Cache/throttle de `/api/coupons/validate`.
- Tracking de conversão/analytics (funnel events) — pode ser adicionado num PR seguinte.
- Idempotency reconciliation para etiqueta SuperFrete (follow-up já registrado).

## Decisões e premissas

### Arquitetura de rotas

- Route group `(checkout)` hospeda as 4 páginas com layout compartilhado.
- Cada step é uma URL distinta (`/checkout/carrinho`, `/checkout/endereco`, `/checkout/pagamento`, `/checkout/confirmacao/[orderId]`) — back/forward do browser funcionam intuitivamente, analytics rastreiam funil por URL, refresh preserva o step.
- Stepper é clicável **apenas nos passos já completos**, não em futuros.

### Estado entre steps

- Centralizado em `localStorage` chave `iwo_checkout_state`.
- Hook `useCheckoutState()` em `app/lib/checkoutState.ts` usa `useSyncExternalStore` para re-render consistente.
- Guards no `useEffect` de cada page redirecionam se pré-requisitos (cart, shipTo, shipping) não estiverem presentes.
- Após confirmação, `clear()` limpa o state.
- Cross-tab sync via `storage` event (edge case aceitável — duas abas no checkout refletem o mesmo estado).

### Validação server-side (anti-tampering)

- `/api/checkout` re-valida cupom (via lógica do `/api/coupons/validate`) e re-cota frete (já implementado na Task 5) no momento do pagamento.
- Se cupom ficou inválido → 409 `COUPON_INVALID` + redireciona para step 1.
- Se cotação defasou (>5% diff) → 409 `SHIPPING_QUOTE_STALE` + redireciona para step 2.

### Cupom

- `Coupon` model já existe no schema (`PERCENT`/`FIXED`, `minOrderTotal`, `maxUses`, `validFrom/Until`, `isActive`).
- Validação inline ao clicar "Aplicar" (não espera submit do step).
- Case-insensitive (normaliza para `UPPERCASE` no server).
- `usedCount` incrementa **apenas** no webhook MP quando `internalStatus === 'paid'`, evitando inflar com carrinhos abandonados.
- Desconto aplica **sobre subtotal de produtos**, não sobre frete. Frete protegido.
- Em produto com `compareAtPrice`, cupom aplica sobre `price` (preço de venda, acumulando com a promo embutida).
- Removível via botão `[x]` ao lado do badge.
- Auto-remove se subtotal cair abaixo do `minOrderTotal` depois de aplicado (toast explicativo).

### Endereço (step 2)

- **Logado sem endereços:** form guest equivalente; ao submeter, salva em `Customer.Address` com `isDefault: true`.
- **Logado com 1 endereço:** bloco expandido + botão "Usar este" + link "+ Adicionar outro".
- **Logado com N endereços:** accordeon (um por endereço), `isDefault` aberto, outros colapsados; chevron rotaciona 180° ao expandir; transição `max-height` + `opacity` com `ease-in-out 0.25s`. Cada item tem radio button. Ao final, "+ Adicionar novo endereço" abre form inline.
- **Guest:** form direto com ViaCEP ao blur + cotação automática em paralelo (mesma lógica da Task 11).
- **Cotação acontece inline no step 2** — opções PAC/SEDEX aparecem abaixo dos endereços assim que um for selecionado/confirmado; usuário escolhe frete antes de avançar.

### Confirmação (step 4)

- URL `/checkout/confirmacao/[orderId]`.
- Acessada com token HMAC de um-uso anexado via query param (gerado pelo `/api/checkout` ao responder sucesso).
- Polling opcional a cada 5s em `GET /api/orders/[id]/status` enquanto Pix estiver `pending`; para quando vira `paid` ou usuário navega.
- Ao montar, limpa `iwo_checkout_state`.

### Visual — tokens principais

| Token | Valor | Uso |
|---|---|---|
| `--iwo-bg` | `#f5f6f8` | fundo da página |
| `--iwo-card` | `#ffffff` | cards |
| `--iwo-text` | `#0a0a0f` | texto principal |
| `--iwo-muted` | `#9ca3af` | labels, metadados |
| `--iwo-border` | `#e4e7ec` | bordas suaves |
| `--iwo-primary` | `#0a0a0f` | botão Pagar, radio selected |
| `--iwo-accent` | `#2563eb` | links, focus ring |
| `--iwo-success` | `#059669` | cupom aplicado, ícone ✓ |
| `--iwo-danger` | `#dc2626` | erros inline |
| `--iwo-radius` | `12px` | cards |
| `--iwo-radius-sm` | `8px` | botões, badges |
| `--iwo-radius-input` | `10px` | inputs |
| `--iwo-shadow-card` | `0 1px 2px rgba(10,10,15,.04), 0 8px 24px rgba(10,10,15,.06)` | eleva cards |
| `--iwo-ease` | `cubic-bezier(0.4, 0, 0.2, 1)` | accordeon, transitions |
| `--iwo-duration` | `.25s` | accordeon, radio cards |

### Tipografia

- Font stack: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` (ajustar para a fonte principal do Webflow `public/css/iwo-watch.webflow.css` se divergir).
- `h1` 28px/700, `h2` 18px/700, body 15px/500, label 13px/600.
- Letter-spacing `-0.01em` em títulos grandes.

## Arquitetura

### Estrutura de arquivos nova

```
iwo-vercel/
├── app/
│   ├── (checkout)/
│   │   ├── layout.tsx                                 # grid 2 colunas, SiteHeader + Stepper + CheckoutSummary + SiteFooter
│   │   ├── carrinho/page.tsx                          # step 1
│   │   ├── endereco/page.tsx                          # step 2
│   │   ├── pagamento/page.tsx                         # step 3
│   │   └── confirmacao/[orderId]/page.tsx             # step 4
│   ├── components/
│   │   ├── SiteHeader.tsx                             # portado de /loja.html
│   │   ├── SiteFooter.tsx                             # portado de /loja.html
│   │   └── checkout/
│   │       ├── Stepper.tsx
│   │       ├── CheckoutSummary.tsx
│   │       ├── CouponField.tsx
│   │       ├── AddressAccordion.tsx
│   │       ├── AddressForm.tsx
│   │       ├── ShippingOptions.tsx
│   │       ├── PaymentMethodTabs.tsx
│   │       ├── CardForm.tsx
│   │       └── PayButton.tsx
│   ├── api/
│   │   ├── coupons/validate/route.ts                  # POST — valida cupom, devolve desconto
│   │   ├── customer/addresses/route.ts                # POST — cria endereço para customer logado
│   │   └── orders/
│   │       └── [id]/
│   │           ├── route.ts                           # GET — dados do pedido para confirmação (token HMAC)
│   │           └── status/route.ts                    # GET — polling leve de status
│   └── lib/
│       ├── checkoutState.ts                           # useCheckoutState + localStorage
│       ├── coupon.ts                                  # applyCoupon() — lógica compartilhada entre /api/coupons/validate e /api/checkout
│       └── orderToken.ts                              # assinatura/verificação HMAC para URL de confirmação
└── prisma/
    └── schema.prisma                                  # +4 campos em Order
```

### Arquivos alterados

- `app/api/checkout/route.ts` — aceitar `couponCode`, revalidar, persistir snapshot no Order, retornar orderId + token.
- `app/api/webhook/mercadopago/route.ts` — incrementar `Coupon.usedCount` quando `status` vira `paid` e `order.couponId` existe.
- `next.config.ts` — remover entry `["/checkout", "/checkout.html"]` do `STATIC_PAGE_MAP` (rota Next vence; `checkout.html` continua servido por `/checkout.html` apenas).
- `prisma/schema.prisma` — 4 campos aditivos em `Order`.

### Hook `useCheckoutState`

```ts
// app/lib/checkoutState.ts
type CheckoutState = {
  cart: CartItem[];
  coupon: { code: string; kind: 'PERCENT' | 'FIXED'; discount: number; description: string | null } | null;
  shipTo: ShipTo | null;
  selectedAddressId: number | null;
  shipping: ShippingOption | null;
};

const STORAGE_KEY = 'iwo_checkout_state';
const EMPTY: CheckoutState = { cart: [], coupon: null, shipTo: null, selectedAddressId: null, shipping: null };

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
}
function getSnapshot(): CheckoutState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch { return EMPTY; }
}

export function useCheckoutState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const update = useCallback((patch: Partial<CheckoutState>) => {
    const next = { ...getSnapshot(), ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('storage'));
  }, []);
  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('storage'));
  }, []);
  return { state, update, clear };
}
```

### Lógica compartilhada `app/lib/coupon.ts`

```ts
export type CouponValidationResult =
  | { ok: true; coupon: { id: number; code: string; kind: 'PERCENT' | 'FIXED'; value: number; description: string | null }; discount: number }
  | { ok: false; error: 'NOT_FOUND' | 'INACTIVE' | 'NOT_YET_VALID' | 'EXPIRED' | 'EXHAUSTED' | 'MIN_NOT_MET'; message: string; minOrderTotal?: number };

export async function validateAndCompute(code: string, subtotal: number): Promise<CouponValidationResult>;
```

Essa função é chamada por ambos `/api/coupons/validate` e `/api/checkout`. Garante consistência.

### Endpoints

**`POST /api/coupons/validate`**
- Body: `{ code: string, subtotal: number }`
- Chama `validateAndCompute`. Retorna 200 com `{code, kind, discount, description}` ou 404/422 com error code + message.

**`POST /api/customer/addresses`**
- Protegido por `auth()`; 401 se guest.
- Body: `{ label?, cep, street, number, complement?, neighborhood, city, state, isDefault? }`.
- Cria `Address` para o `Customer` do user logado. Se `isDefault=true`, desmarca os outros em uma transaction.
- Retorna o endereço criado.

**`GET /api/orders/[id]`**
- Query param `token` obrigatório. Verifica via `orderToken.verify(id, token)` (HMAC de `${id}.${createdAt.getTime()}` assinado com `NEXTAUTH_SECRET`).
- Retorna dados redigidos para o cliente: itens, totais, endereço, status pagamento, status SuperFrete, pix/boleto info, couponCode. Omite `payerCpf` completo (mostra mascarado `***.***.***-12`).
- 403 se token inválido ou `id` não bate.

**`GET /api/orders/[id]/status`**
- Mesmo token HMAC.
- Retorna apenas `{ status, mpStatus, superfreteStatus, superfreteTracking }`.

**`/api/checkout` (modificado)**
- Aceita `couponCode: string | null` no body.
- Se presente, chama `validateAndCompute(couponCode, subtotal)` após a re-cotação de frete. Se falhar, 409 com `error: 'COUPON_INVALID'` + `newSubtotal`.
- `totalAmount = subtotal − coupon?.discount + shippingCost`.
- Grava no Order: `couponCode`, `couponKind`, `couponDiscount`, `couponId`.
- Resposta sucesso: `{ orderId, token, mpPaymentId, status, pix?, boleto? }` (novo `token` para a URL de confirmação).

**Webhook MP (modificado)**
- Após marcar `Order.status = 'paid'`, se `order.couponId`:
  ```ts
  await prisma.coupon.update({
    where: { id: order.couponId },
    data: { usedCount: { increment: 1 } },
  });
  ```

### Schema changes

```prisma
enum CouponKind {
  PERCENT
  FIXED
}

model Order {
  // ... campos existentes ...

  couponCode      String?      @map("coupon_code") @db.VarChar(50)
  couponKind      CouponKind?  @map("coupon_kind")
  couponDiscount  Decimal?     @map("coupon_discount") @db.Decimal(10, 2)
  couponId        Int?         @map("coupon_id")

  coupon          Coupon?      @relation(fields: [couponId], references: [id], onDelete: SetNull)

  @@index([couponCode])
}

model Coupon {
  // ... campos existentes ...
  orders          Order[]
}
```

### Componentes principais

**`<Stepper current={1|2|3|4} />`**
- 3 círculos + linha conectora (o step 4 "confirmação" não aparece no stepper — é uma tela terminal separada).
- Círculo atual: `background: --iwo-primary`, `color: #fff`.
- Círculo completo: verde com `✓`.
- Círculo futuro: borda cinza, número em cinza.
- Clicável nos completos (renderiza como `<Link>` do Next); estáticos nos futuros.
- Mobile <640px: compacto, só ícones, label do atual embaixo.

**`<CheckoutSummary />`**
- Lista de itens com thumbnail.
- Linhas: Subtotal, Desconto (se coupon), Frete (se shipping), Total.
- Sticky no desktop (`position: sticky; top: 80px`).
- Mobile: colapsa para `<details>` com `<summary>Total R$ X,XX — N itens ▾</summary>` no topo.

**`<AddressAccordion address={...} selected={...} onSelect={...} />`**
- Header: radio button + label + badge "padrão" + chevron.
- Body: dados do endereço + botão "Editar" (abre `<AddressForm />` inline).
- Transição `max-height` + `opacity` com `var(--iwo-duration) var(--iwo-ease)`.

**`<CouponField />`**
- Input + botão "Aplicar".
- Em loading: spinner no botão, botão desabilitado.
- Em sucesso: badge verde com código + `[x]`, input limpo e oculto.
- Em erro: mensagem vermelha abaixo, input preserva valor digitado.

**`<ShippingOptions options={...} selectedId={...} onSelect={...} />`**
- Radio cards com logo Correios, nome serviço, prazo, preço.
- Skeleton durante cotação.
- Vazio: "Nenhum serviço disponível para este CEP".

**`<PaymentMethodTabs method={...} onChange={...} />`**
- 3 radio cards (Pix/Cartão/Boleto) com ícone + label.
- Selected: borda preta 2px + fundo levemente tingido.

## UX — fluxos

### Fluxo 1: guest sem cupom, Pix

1. `/loja` → adiciona produto.
2. `/checkout/carrinho`:
   - Lista de itens com steppers `− +` e remover.
   - Campo de cupom vazio (ignora).
   - "Continuar" → `/checkout/endereco`.
3. `/checkout/endereco`:
   - Sem sessão → form direto.
   - Digita CEP `01153000`, blur → ViaCEP auto-fill + cotação em paralelo.
   - Escolhe PAC → resumo lateral atualiza com "Frete PAC R$ 21,15".
   - "Continuar" → `/checkout/pagamento`.
4. `/checkout/pagamento`:
   - Preenche nome/sobrenome/email/CPF/telefone.
   - Seleciona Pix (default).
   - "Pagar R$ 321,15" → `/api/checkout`.
   - Redireciona para `/checkout/confirmacao/123?token=xyz`.
5. `/checkout/confirmacao/123`:
   - ✓ "Pedido #123 confirmado!".
   - QR code Pix + código copiável.
   - Resumo dos itens, totais, endereço.
   - Polling a cada 5s.

### Fluxo 2: logado com cupom, cartão, endereço salvo

1. Login → `/loja` → add produto.
2. `/checkout/carrinho`:
   - Aplica cupom `TESTE10` → "✓ TESTE10 aplicado — R$ 30,00".
   - "Continuar".
3. `/checkout/endereco`:
   - 2 endereços salvos em accordion; default aberto e pré-selecionado.
   - Cotação já disparou para o default selecionado.
   - Escolhe SEDEX.
   - "Continuar".
4. `/checkout/pagamento`:
   - Dados do pagador pré-preenchidos de `customer.name`, `customer.email`, `customer.cpf`.
   - Seleciona Cartão → `<CardForm />` monta MP Secure Fields.
   - "Pagar R$ XXX,XX".
   - Redireciona para `/checkout/confirmacao/124?token=abc`.
5. Confirmação: status `approved` imediatamente (cartão), mostra ✓.

### Fluxo 3: erro recuperável (cotação defasada)

1-3: igual fluxo 1.
4. Cliente fica muito tempo na tela → `/api/checkout` retorna 409 `SHIPPING_QUOTE_STALE`.
5. UI redireciona para `/checkout/endereco?msg=quote_stale` com banner amarelo topo: "O valor do frete foi atualizado. Por favor, confirme novamente."
6. `checkoutState.shipping` limpo; usuário reescolhe opção (preços possivelmente diferentes).
7. "Continuar" → `/checkout/pagamento` → "Pagar" novamente.

### Fluxo 4: erro recuperável (cupom expirado/esgotado)

1-3: igual.
4. `/api/checkout` retorna 409 `COUPON_INVALID`.
5. UI redireciona para `/checkout/carrinho?msg=coupon_invalid` com banner: "Cupom inválido: ..." com motivo.
6. `checkoutState.coupon` limpo; cliente pode tentar outro ou seguir sem.

## Error handling (resumo)

| Situação | Comportamento |
|---|---|
| Cart vazio no step 1 | Redireciona para `/loja` com toast. |
| Produto archived/draft | 400 do `/api/checkout` → toast + redireciona para step 1 destacando o item. |
| Cupom `minOrderTotal` parou de bater | Auto-remove no client ao alterar cart; toast explicativo. |
| Cupom expirou entre steps | 409 → redireciona para step 1 com banner. |
| ViaCEP 404/offline | Campos editáveis manualmente; cotação tenta mesmo assim. |
| Cotação sem opções | Card "Nenhum serviço disponível" + botão Continuar desabilitado. |
| SuperFrete 502 no step 2 | "Não foi possível calcular o frete. [Tentar novamente]". |
| Cotação defasada no step 3 | 409 → step 2 com banner; state de shipping limpo. |
| Token expirou durante checkout (logado) | 401 → salva state + redireciona `/conta/login?from=...`. |
| URL de step direto sem dados | Guard `useEffect` redireciona para step anterior. |
| Refresh durante pagamento | `sessionStorage.iwo_checkout_pending` previne duplo POST. UI mostra "Processando..." e polling em `/api/orders/recent?email=X`. Libera após 30s. |
| Token HMAC inválido em confirmação | 403 com página de erro. |
| Falha de polling no Pix | Silencioso; banner "Aguardando pagamento" permanece. |
| Divergência de preço de produto | 409 → step 1 com banner "Preços atualizados". |

## Testes e validação

Sem framework de testes. Validação manual:

### Happy paths

1. **Guest sem cupom, Pix** — fluxo 1 acima.
2. **Guest com cupom válido** — aplica `TESTE10` no step 1, conclui até confirmação; verifica no DB que `Order.couponCode`, `Order.couponDiscount` preenchidos e `Coupon.usedCount` **só incrementa** após o webhook MP.
3. **Logado com múltiplos endereços** — fluxo 2 acima; verifica accordeon, seleção, cotação.

### Edge cases

- Cupom inexistente → erro inline.
- Cupom expirado → mensagem correta.
- `minOrderTotal` não atingido → mensagem com valor mínimo.
- Remover item até subtotal ficar abaixo de `minOrderTotal` → cupom auto-removido + toast.
- CEP inválido → erro inline.
- SuperFrete 502 → botão "Tentar novamente".
- 409 `SHIPPING_QUOTE_STALE` → redirect.
- 409 `COUPON_INVALID` → redirect.
- Adicionar novo endereço logado → persiste em `Customer.Address`.
- Guard de step (acessar URL direta) → redireciona.
- Refresh preserva state.
- Cross-tab reflete mudanças.

### Pré-condições

- Pelo menos 1 `Coupon` ativo (`TESTE10`, `PERCENT`, `value: 10`, `isActive: true`).
- Outro com `validUntil` no passado para testar expirado.
- Outro com `minOrderTotal` alto para testar rejeição.
- Pelo menos 2 `Address` em um `Customer` logável.
- Produto ativo no loja.

## Migração / deploy

1. `npx prisma db push` — adiciona 4 colunas aditivas (zero risco).
2. Extrair header/footer de `public/loja.html` para `app/components/Site*.tsx` (inspeção manual do HTML primeiro).
3. Implementar layout + steps em ordem (seguindo o plano).
4. Remover entry `["/checkout", "/checkout.html"]` do `STATIC_PAGE_MAP` (`next.config.ts`) **apenas no último commit**, quando o fluxo estiver funcional end-to-end. Rollback fácil: restaurar a entry.
5. Testar em dev com SuperFrete de produção (já configurado).
6. Deploy. Smoke test em produção.
7. Após 1 semana de estabilidade, remoção definitiva do `public/checkout.html` em PR separado.

## Referências

- Spec anterior: `iwo-vercel/docs/superpowers/specs/2026-04-18-checkout-frete-superfrete-design.md`
- Plano anterior: `iwo-vercel/docs/superpowers/plans/2026-04-18-checkout-frete-superfrete.md`
- Inspiração: Lumodesk checkout (imagem anexada no brainstorming)
- Schema Prisma: `iwo-vercel/prisma/schema.prisma`
- Header/footer source: `iwo-vercel/public/loja.html`
- Logo: `iwo-vercel/public/images/iwo_cinza_extended-1-p-500.webp`
- CSS Webflow: `iwo-vercel/public/css/iwo-watch.webflow.css`
