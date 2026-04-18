# Upload de Imagens para Produtos — Design Spec

## Objetivo

Permitir upload de ate 5 fotos por produto (1 principal + 4 galeria) via Cloudflare R2, com gerenciamento no admin e exibicao na pagina de produto.

## Schema

### Tabela `products` — nova coluna

- Adicionar coluna `images` do tipo `JSONB` (default `'[]'`)
- Manter coluna `image` (text) existente para retrocompatibilidade
- Ao salvar, `image` e atualizado automaticamente com a URL da imagem marcada como `is_principal`

### Formato do campo `images`

```json
[
  { "url": "https://pub-xxx.r2.dev/products/5/abc123.webp", "position": 0, "is_principal": true },
  { "url": "https://pub-xxx.r2.dev/products/5/def456.webp", "position": 1, "is_principal": false }
]
```

- `position`: inteiro, define ordem na galeria (0 = primeira)
- `is_principal`: boolean, exatamente uma imagem deve ser `true`
- Maximo 5 itens no array

## Infraestrutura R2

### Bucket

- Bucket existente: `iwo-assets`
- Estrutura de arquivos: `products/{product_id}/{uuid}.{ext}`
- Acesso publico via R2 public URL

### Variaveis de ambiente (`.env.local`)

```
R2_ACCOUNT_ID=ad41f4e2927a6daf25f7c7d6891e31bd
R2_ACCESS_KEY_ID=78dd905d63b734703d639b90b506d1e2
R2_SECRET_ACCESS_KEY=6702717d4e0203fd0aab556c5273977c41a668e7d513381a9f9f83f296d9e585
R2_BUCKET_NAME=iwo-assets
R2_PUBLIC_URL=https://pub-{hash}.r2.dev (habilitar public access no dashboard Cloudflare R2)
```

### SDK

- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- R2 e compativel com S3 API, endpoint: `https://{ACCOUNT_ID}.r2.cloudflarestorage.com`

### Fluxo de upload (presigned URL)

1. Admin seleciona arquivo no browser
2. Frontend chama `POST /api/admin/upload` com `{ fileName, contentType, productId }`
3. Backend gera presigned PUT URL (expira em 10 min) e retorna `{ uploadUrl, publicUrl }`
4. Frontend faz `PUT` direto do browser para o R2 com o binario do arquivo
5. Frontend adiciona a `publicUrl` ao array `images` local
6. Ao salvar o produto (`PUT /api/admin/products/[id]`), o array `images` completo e enviado

**Produto novo (sem ID ainda):** No fluxo de criacao, o upload acontece apos o POST criar o produto. O form primeiro salva o produto (recebe o ID), depois faz os uploads com o ID retornado, e por fim faz um PUT para salvar as imagens. Alternativa: usar `productId=temp` no path e renomear apos criacao — mas a primeira opcao e mais simples.

## API Routes

### `POST /api/admin/upload` (novo)

**Request:**
```json
{ "fileName": "foto.jpg", "contentType": "image/jpeg", "productId": 5 }
```

**Response:**
```json
{ "uploadUrl": "https://...r2.cloudflarestorage.com/...", "publicUrl": "https://pub-xxx.r2.dev/products/5/uuid.jpg" }
```

- Requer auth admin (mesmo padrao Bearer token existente)
- Gera UUID para o nome do arquivo
- Monta chave S3: `products/{productId}/{uuid}.{ext}`

### `PUT /api/admin/products/[id]` (modificar)

- Aceitar campo `images` (JSON array) no body
- Ao receber `images`, extrair a URL com `is_principal: true` e atualizar o campo `image` automaticamente
- Se nenhuma imagem marcada como principal, usar a primeira (`position: 0`)

### `GET /api/products/[slug]` (modificar)

- Incluir `images` no SELECT
- Retornar no response junto com os demais campos

### `GET /api/admin/products` e `GET /api/admin/products/[id]` (modificar)

- Incluir `images` no SELECT

## Admin UI

### Componente `ImageUploader.tsx`

- Area de drag & drop + botao "Selecionar arquivos"
- Tipos aceitos: JPEG, PNG, WebP
- Tamanho maximo: 5MB por arquivo
- Limite: 5 imagens

**Funcionalidades:**
- Preview com miniatura apos upload
- Indicador de progresso (spinner) durante upload
- Reordenar via drag (HTML5 Drag and Drop API nativa)
- Marcar principal: clique em icone de estrela na miniatura
- Remover: botao X na miniatura
- Contador visual: "3/5 fotos"

**Props:**
```typescript
interface ImageUploaderProps {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
  productId?: number; // necessario para o path no R2
  maxImages?: number; // default 5
}

interface ImageItem {
  url: string;
  position: number;
  is_principal: boolean;
}
```

### Integracao no `ProductForm.tsx`

- Substituir o campo `<input name="image">` pelo componente `<ImageUploader>`
- O form state passa a ter `images: ImageItem[]` em vez de `image: string`
- Ao salvar, envia `images` no body do PUT/POST

## Galeria na pagina de produto

### Template `product.html`

- Container `#product-main-image` permanece (ja existe)
- JS preenche dinamicamente

### Logica no `products.js`

- Se produto tem `images` (array com itens): renderiza galeria
- Se nao (so tem `image` string): renderiza imagem unica (retrocompativel)

**Galeria renderizada:**
```html
<div id="product-main-image">
  <img id="gallery-main" src="(imagem principal)" style="width:100%;height:100%;object-fit:contain;">
  <div id="gallery-thumbs" style="display:flex;gap:8px;margin-top:12px;">
    <img src="(thumb 1)" class="gallery-thumb active" style="...">
    <img src="(thumb 2)" class="gallery-thumb" style="...">
    ...
  </div>
</div>
```

- Clicar em thumbnail troca a `src` da imagem principal
- Thumbnail ativa recebe borda de destaque (#2563eb)
- CSS inline, sem lib externa

## Retrocompatibilidade

- Produtos existentes com so `image` (string) continuam funcionando
- Campo `images` default `[]` — nao quebra nada
- Cards da loja (`products.js` → `renderSmartwatch`/`renderSimpleCard`) continuam usando `product.image`
- Nenhuma mudanca nos cards da loja

## Fora de escopo (etapa 2)

- Tabela `product_variants` e suas imagens
- Componente de carrinho / adicionar ao carrinho
- Compressao/resize automatico de imagens
- Crop de imagens no admin
