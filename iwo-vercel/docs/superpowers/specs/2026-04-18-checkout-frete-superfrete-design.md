# Checkout com frete + integração SuperFrete — design

**Data:** 2026-04-18
**Autor:** Claude (brainstorming com @gubressan)
**Status:** aprovado, pronto para implementação

## Objetivo

Adicionar cotação de frete via SuperFrete (Correios: PAC, SEDEX, Mini Envios), formulário de endereço de entrega no checkout, soma do frete ao total pago via MercadoPago, e emissão automática de etiqueta SuperFrete quando o pagamento for aprovado. Expor painel admin para gerenciar as etiquetas (imprimir PDF, atualizar status, cancelar).

## Escopo

### Incluído

- Novos campos no `Order` para snapshot de endereço, serviço de frete, caixa e dados SuperFrete.
- Helper `app/lib/superfrete.ts` que encapsula os 5 endpoints SuperFrete usados.
- Endpoint `POST /api/shipping/quote` (cotação server-side) e `GET /api/shipping/cep/[cep]` (proxy ViaCEP).
- Atualização de `POST /api/checkout` para aceitar, revalidar e persistir frete + endereço + somar ao `transaction_amount` da MP.
- Atualização do webhook MP para criar automaticamente a etiqueta SuperFrete em status `pending` após pagamento aprovado.
- Refino completo de UX do `public/checkout.html`: visual alinhado à identidade Webflow da loja, etapas claras, loaders/erros contextuais, responsividade mobile, ViaCEP automático, cotação automática.
- Admin: lista `/admin/pedidos` e detalhe `/admin/pedidos/[id]` com gestão de etiqueta (imprimir, atualizar, cancelar, re-emitir).

### Fora do escopo

- Migrar `checkout.html` para rota Next.js `app/checkout/page.tsx` (fica para um PR futuro).
- Emissão de NF-e eletrônica (usamos declaração de conteúdo: `options.non_commercial: true`).
- Pagamento automático da etiqueta via saldo SuperFrete (etiquetas ficam em `pending`; pagamento é feito manualmente no painel web da SuperFrete). Campos `superfreteStatus` já preveem `released` para quando for pago.
- Jadlog e Loggi (só Correios).
- Tela `/conta/enderecos` para clientes gerenciarem endereços salvos (o upsert em `Customer.Address` acontece, mas não há UI de gestão neste PR).
- Cache de cotações em Redis/KV (cotação é stateless; pode ser adicionado depois se houver pressão por rate limit).

## Decisões e premissas

### Dimensões e peso fixos

- Peso por unidade: `0,3 kg`. Peso total = `0,3 × quantidade_total_de_itens`.
- Dimensões por unidade: `15 cm (length) × 10 cm (width) × 12 cm (height)`. Em pedidos com múltiplas unidades, o **comprimento** (`length`) é multiplicado pela quantidade total; largura e altura ficam fixas. Ex.: 3 unidades → `45 × 10 × 12 cm`, peso `0,9 kg`.
- Essas regras vivem em constantes em `app/lib/superfrete.ts` e podem ser parametrizadas por produto no futuro, caso necessário.

### Endereço de origem (remetente — fixo)

- Nome: `IWO Watch Brasil`
- CNPJ: `46601604000194`
- CEP: `13026137`
- Endereço: `Av Princesa Doeste, 1199 — Sala 92`
- Bairro: `NA` (doc SuperFrete: enviar `"NA"` quando não houver)
- Cidade/UF: `Campinas / SP`
- Guardado em env vars (`SHIPPING_FROM_*`) e montado no helper.

### Serviços de envio oferecidos ao cliente

- PAC (`service_id=1`), SEDEX (`service_id=2`), Mini Envios (`service_id=17`).
- Mini Envios tem limite máx. de `0,3 kg` → só aparece para pedidos com 1 unidade.
- Jadlog e Loggi não são oferecidos.

### Fluxo pós-pagamento

1. MercadoPago aprova pagamento → webhook `/api/webhook/mercadopago` marca `orders.status = 'paid'`.
2. Webhook chama `superfrete.createLabel(order)` → etiqueta criada em status `pending`.
3. Sucesso: salvamos `superfreteOrderId`, `superfreteStatus='pending'`, `superfreteCreatedAt`.
4. Falha: salvamos `superfreteError`; pagamento **não** é revertido. Admin pode re-emitir manualmente.
5. Pagamento da etiqueta acontece offline no painel web SuperFrete (por enquanto).
6. Admin consulta `getLabelInfo` sob demanda para atualizar `superfreteStatus` e `superfreteTracking`.

### Conteúdo do pacote

- Declaração de conteúdo: `options.non_commercial: true`, lista de produtos (`name`, `quantity`, `unitary_value`) montada a partir de `OrderItem`.
- Sem nota fiscal.

### Endereço do cliente (destinatário)

- Snapshot sempre no `Order` (congelado no momento da compra, mesmo que o cliente edite endereços depois).
- Se `auth()` tem sessão ativa durante o checkout, também faz `upsert` do endereço em `Customer.Address`:
  - Match pelo par (`customerId`, `cep`, `number`) — se já existe, atualiza; se não, cria com `isDefault=false`.
  - Guest checkout continua funcionando normalmente (sem tocar em `Address`).

### Ambiente e segredos

- `SUPERFRETE_API_URL="https://sandbox.superfrete.com"` (produção: `https://api.superfrete.com` — trocar quando validarmos sandbox).
- `SUPERFRET_APITOKEN` (nome escolhido pelo usuário — já inserido no `.env.local`).
- `SUPERFRETE_USER_AGENT="IWO Watch (gsbcommerceltda@gmail.com)"` (doc exige nome da aplicação + email técnico).
- Todas as env vars adicionadas ao `.env.example`.

## Arquitetura

### Estrutura de arquivos nova

```
iwo-vercel/
├── app/
│   ├── lib/
│   │   └── superfrete.ts                        # helper central (quote, createLabel, getInfo, getPrintUrl, cancel)
│   ├── api/
│   │   ├── shipping/
│   │   │   ├── quote/route.ts                   # POST — cotação
│   │   │   └── cep/[cep]/route.ts               # GET — proxy ViaCEP
│   │   └── admin/
│   │       └── orders/
│   │           └── [id]/
│   │               ├── shipping-label/route.ts  # GET → PDF URL
│   │               ├── shipping-refresh/route.ts
│   │               └── shipping-cancel/route.ts
│   └── admin/
│       └── pedidos/
│           ├── page.tsx                         # lista
│           └── [id]/page.tsx                    # detalhe com cards de entrega/etiqueta
└── prisma/
    └── schema.prisma                            # +17 campos no Order
```

### Arquivos alterados

- `app/api/checkout/route.ts` — aceitar `shipping` + `shipTo`, re-cotar, somar ao MP, persistir snapshot, upsert em `Customer.Address`.
- `app/api/webhook/mercadopago/route.ts` — após marcar `paid`, chamar `createLabel`.
- `public/checkout.html` — refino completo de UX (seção separada abaixo).
- `.env.example` — documentar novas env vars.
- `prisma/schema.prisma` — 17 campos aditivos.

### Helper `app/lib/superfrete.ts`

Exporta:

```ts
export const SHIPPING_ITEM = {
  weightKg: 0.3,
  height: 12,
  width: 10,
  length: 15,
} as const;

export function buildBox(totalQuantity: number): {
  weight: number;
  height: number;
  width: number;
  length: number;
};

export type ShippingOption = {
  serviceId: 1 | 2 | 17;
  name: string;
  price: number;        // valor final (já com desconto SuperFrete)
  deliveryMin: number;
  deliveryMax: number;
  box: { weight: number; height: number; width: number; length: number };
};

export async function quote(input: {
  toPostalCode: string;
  totalQuantity: number;
}): Promise<ShippingOption[]>;

export async function createLabel(order: OrderWithItems): Promise<{
  id: string;
  price: number;
  status: string;
}>;

export async function getLabelInfo(superfreteOrderId: string): Promise<{
  status: string;
  tracking: string | null;
  // ...
}>;

export async function getPrintUrl(superfreteOrderId: string): Promise<string>;

export async function cancelLabel(
  superfreteOrderId: string,
  reason: string,
): Promise<{ canceled: boolean }>;
```

Todas as chamadas:
- Base URL: `process.env.SUPERFRETE_API_URL`.
- Headers: `Authorization: Bearer ${SUPERFRET_APITOKEN}`, `User-Agent: ${SUPERFRETE_USER_AGENT}`, `Content-Type: application/json`.
- Timeout: 15s (AbortController).
- Erros HTTP (≥400) → throw com `SuperFreteError` contendo status + corpo. Callers decidem o que fazer (checkout: 502; webhook: salva em `superfreteError`).

### Contrato dos endpoints novos

**`POST /api/shipping/quote`**

Request:
```json
{
  "toPostalCode": "01153000",
  "items": [
    { "productId": 26, "quantity": 2 },
    { "productId": 30, "quantity": 1 }
  ]
}
```

Server re-conta `totalQuantity = sum(item.quantity)`, chama `quote({ toPostalCode, totalQuantity })`, devolve:

```json
{
  "options": [
    {
      "serviceId": 1,
      "name": "PAC",
      "price": 18.61,
      "deliveryMin": 5,
      "deliveryMax": 5,
      "box": { "weight": 0.9, "height": 12, "width": 10, "length": 45 }
    },
    { "serviceId": 2, "name": "SEDEX", "price": 24.20, "deliveryMin": 1, "deliveryMax": 1, "box": { ... } }
  ]
}
```

Opções com `has_error: true` são filtradas silenciosamente. Se a lista final ficar vazia, retorna 422 com mensagem `"Nenhum serviço disponível para este CEP"`.

**`GET /api/shipping/cep/[cep]`**

- Valida que `cep` tem 8 dígitos, faz `fetch('https://viacep.com.br/ws/${cep}/json/')`.
- Devolve o payload original do ViaCEP (campos `logradouro`, `bairro`, `localidade`, `uf`). Se ViaCEP retorna `{ "erro": true }`, devolve 404.
- Propósito: evitar problemas de CORS do navegador e permitir cache no futuro.

### Contrato alterado: `POST /api/checkout`

Novos campos no body (além do que já aceita):

```json
{
  "items": [...],
  "payer": {...},
  "payment_method": {...},
  "shipping": {
    "serviceId": 1,
    "toPostalCode": "01153000",
    "quotedPrice": 18.61
  },
  "shipTo": {
    "name": "João Silva",
    "document": "12345678909",
    "postalCode": "01153000",
    "address": "Av. Paulista",
    "number": "1000",
    "complement": "Apto 42",
    "district": "Bela Vista",
    "city": "São Paulo",
    "state": "SP"
  }
}
```

Validações server-side (em ordem):

1. Validar `shipTo`: campos obrigatórios não-vazios, CEP 8 dígitos, UF 2 letras maiúsculas, CPF 11 dígitos.
2. `quote({ toPostalCode: shipTo.postalCode, totalQuantity })` → opções atuais.
3. Encontrar `serviceId` pedido na lista; se não existir, 422.
4. Comparar `option.price` com `shipping.quotedPrice`: se `|diff| > 0.05 × quotedPrice`, retornar **409** com `{ error: 'SHIPPING_QUOTE_STALE', newOptions }`. UI re-renderiza opções.
5. `totalAmount = subtotalProdutos + option.price` (arredondado a 2 casas).
6. Cria `Order` com snapshot completo (shipTo + shipping fields + box da opção escolhida).
7. Chama MP com `transaction_amount = totalAmount` e `additional_info.shipments` preenchido.
8. Se logado (via `auth()`), `Customer.Address.upsert` por `(customerId, cep, number)`.

### Contrato alterado: webhook MP

Após o `prisma.order.update({ status: 'paid' })`, em `try/catch` independente:

```ts
try {
  const { id, status } = await superfrete.createLabel(order);
  await prisma.order.update({
    where: { id: order.id },
    data: {
      superfreteOrderId: id,
      superfreteStatus: status,
      superfreteCreatedAt: new Date(),
      superfreteError: null,
    },
  });
} catch (err) {
  await prisma.order.update({
    where: { id: order.id },
    data: { superfreteError: String(err?.message ?? err).slice(0, 1000) },
  });
  console.error('[webhook] superfrete createLabel failed', err);
  // não propagar — webhook MP precisa responder 200 para não entrar em retry
}
```

### Endpoints admin

Todos exigem `guardAdmin(request)` (JWT HS256 existente).

- `GET /api/admin/orders/[id]/shipping-label` → busca `superfreteOrderId` no DB, chama `getPrintUrl`, devolve `{ url }`.
- `POST /api/admin/orders/[id]/shipping-refresh` → chama `getLabelInfo`, atualiza `superfreteStatus` e `superfreteTracking`, devolve ordem atualizada.
- `POST /api/admin/orders/[id]/shipping-cancel` → body `{ reason }`, chama `cancelLabel`, atualiza `superfreteStatus='cancelled'`.

## UX do checkout

### Estrutura final (desktop)

Layout em 2 colunas (mantém o grid atual 1fr × 380px). Coluna esquerda ganha **4 cards** sequenciais (em vez dos 2 atuais) + botão Pagar:

1. **Dados do cliente** — Nome, Sobrenome, E-mail, CPF, Telefone (como hoje).
2. **Endereço de entrega** — CEP (com máscara e auto-foco no próximo), Rua (read-only após ViaCEP, editável se vier vazio), Número, Complemento, Bairro, Cidade, UF.
3. **Frete** — radio cards com logo dos Correios, nome do serviço, preço destacado, prazo ("chega em 5 dias úteis"). Só aparece após cotação retornar; enquanto carrega, mostra skeleton.
4. **Forma de pagamento** — Pix / Cartão / Boleto (como hoje, mas **sem** o bloco de endereço de boleto — endereço de entrega é reutilizado).

Resumo (coluna direita):
- Lista de itens (já existe).
- Linha "Subtotal" (produtos).
- Linha "Frete — PAC/SEDEX/Mini Envios" (dinâmica — fica `—` até selecionar).
- Linha "Total" em destaque (recalcula ao mudar frete).
- Botão "Pagar R$ X,XX" embaixo do card no desktop; no mobile, o resumo fica colapsável no topo.

### Mobile

Grid 1 coluna; o resumo do pedido fica num card retrátil fixo no topo mostrando apenas "Total R$ X,XX — X itens ▾". Clicando expande a lista completa.

### Visual

- Puxar tokens do Webflow existente (`public/css/iwo-watch.webflow.css`, `webflow.css`, `normalize.css`):
  - Tipografia principal (provavelmente uma sans-serif aplicada globalmente no body do Webflow).
  - Paleta primária da marca (a extrair do CSS antes de aplicar).
  - Radius/shadow coerentes com o resto do site.
- Manter o CSS do checkout inline/embedded no próprio `checkout.html` (como já está hoje) para não criar dependência cruzada com os arquivos do Webflow.

### Interações

- **CEP blur:** dispara dois fetches em paralelo — `GET /api/shipping/cep/{cep}` e `POST /api/shipping/quote`. CEP inválido → mostra `"CEP não encontrado"` embaixo do campo; mantém campos editáveis.
- **Cotação carregando:** card Frete mostra 3 skeleton rows; botão "Pagar" fica desabilitado com texto "Aguardando frete...".
- **Seleção de frete:** atualiza resumo, habilita botão Pagar com texto "Pagar R$ X,XX".
- **Mudança de CEP após selecionar frete:** descarta seleção anterior, re-cota.
- **409 no checkout (cotação defasada):** modal com "O valor do frete mudou. Nova cotação carregada." → UI atualiza opções e o cliente reescolhe.
- **Erro 4xx/5xx na cotação:** mostra mensagem inline com botão "Tentar novamente".
- **Validação client-side antes do Pagar:** CEP 8 dígitos, número preenchido, serviço selecionado, CPF ≥ 11 dígitos.

## Admin UI

### `/admin/pedidos` (lista)

- Tabela com: `#`, Cliente (nome + email), Total, Status pagamento, Status etiqueta (badge), Tracking (se houver), Data.
- Filtros no topo: combobox "Status pagamento" e "Status etiqueta".
- Paginação simples (server-side com `take`/`skip`).
- Linha clicável → leva ao detalhe.

### `/admin/pedidos/[id]` (detalhe)

4 cards:

1. **Dados do pedido** — #, data, status MP, valor, items (lista).
2. **Cliente** — nome, email, CPF, telefone.
3. **Entrega** — endereço completo, serviço escolhido, preço do frete, prazo estimado, dimensões da caixa.
4. **Etiqueta SuperFrete** — status (badge colorido), ID SuperFrete, tracking (se houver), botões:
   - **Baixar etiqueta (PDF)** — se status ∈ {`pending`, `released`, `posted`, `delivered`}; abre `getPrintUrl` em nova aba.
   - **Atualizar status** — sempre visível; chama `shipping-refresh`.
   - **Cancelar etiqueta** — se status ∈ {`pending`, `released`}; abre modal pedindo motivo.
   - **Emitir etiqueta** — aparece apenas se `superfreteOrderId` for null (webhook falhou). Mostra `superfreteError`.

## Tratamento de erros e edge cases

| Situação | Comportamento |
|---|---|
| ViaCEP 404 ou offline | UI mantém campos editáveis manualmente; cotação ainda tenta com o CEP digitado. |
| Cotação sem opções (`options=[]`) | 422 no `/api/shipping/quote`; UI mostra "Nenhum serviço disponível para este CEP". Cliente pode corrigir CEP. |
| Cotação defasada no checkout (>5% diff) | 409 com `newOptions`; UI pede ao cliente reescolher. |
| SuperFrete offline no `/api/checkout` | 502; mensagem ao cliente: "Não foi possível calcular o frete agora. Tente novamente em instantes." |
| SuperFrete falha ao criar etiqueta no webhook MP | Pagamento **fica aprovado**; `superfreteError` é salvo; admin vê card "Emitir etiqueta" com erro; webhook responde 200 normalmente. |
| Pedido com 0 itens ou produto archived/draft | Já tratado no `/api/checkout` atual — mantém mesma lógica. |
| Endereço sem bairro (ViaCEP devolve vazio) | Usa `"NA"` (padrão SuperFrete) no envio; UI permite ao usuário editar antes. |
| CPF ausente ou inválido no checkout | 400 antes de chamar SuperFrete — `shipTo.document` é obrigatório (doc SuperFrete: "documento obrigatório para todas as transportadoras"). |

## Testes e validação

Projeto não tem framework de testes configurado. Validação será manual:

1. **Sandbox end-to-end happy path:** produto → carrinho → checkout com CEP válido → ViaCEP preenche → cotação retorna 2-3 opções → seleciona PAC → paga via Pix → webhook marca `paid` → etiqueta criada em `pending` → admin vê pedido e baixa PDF.
2. **Divergência de cotação:** simular mudando timestamp ou mockando `quote()` server-side.
3. **ViaCEP inválido:** CEP `00000000` → UI mostra erro mas permite digitar manualmente.
4. **SuperFrete falhando:** desligar token → webhook salva erro → admin re-emite após corrigir.
5. **Multi-qty:** carrinho com 3 unidades de mesmo produto e carrinho misto com 4 itens no total → verificar que `totalQuantity` e `box.length` escalam corretamente.
6. **Guest vs logado:** fazer um checkout guest e um logado; confirmar que o logado criou `Customer.Address` e o guest não.

## Migração / deploy

1. `npx prisma db push` — adiciona colunas aditivas (seguro em produção: zero risco para dados existentes).
2. Adicionar env vars em Vercel (sandbox primeiro).
3. Deploy — checkout antigo continua funcionando para pedidos abertos antes do deploy (Order fields são todos opcionais).
4. Testar sandbox end-to-end.
5. Trocar `SUPERFRETE_API_URL` e `SUPERFRET_APITOKEN` para produção quando validado.

## Referências

- Docs SuperFrete locais: `iwo-vercel/docs/superfrete/`
- ViaCEP: https://viacep.com.br/
- Prisma schema: `iwo-vercel/prisma/schema.prisma`
- Checkout atual: `iwo-vercel/public/checkout.html`
- `/api/checkout` atual: `iwo-vercel/app/api/checkout/route.ts`
- Webhook MP atual: `iwo-vercel/app/api/webhook/mercadopago/route.ts`
