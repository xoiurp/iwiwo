# Upload de Imagens para Produtos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir upload de ate 5 fotos por produto via Cloudflare R2 com presigned URLs, gerenciamento no admin e galeria na pagina de produto.

**Architecture:** Presigned URL flow — browser pede URL assinada ao backend, faz upload direto para R2, salva URLs no campo `images` (JSONB) da tabela `products`. O campo `image` (text) existente e mantido e atualizado automaticamente com a imagem principal para retrocompatibilidade.

**Tech Stack:** @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, Cloudflare R2, @vercel/postgres, Next.js 16 App Router, React 19

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `app/lib/r2.ts` | S3 client config + presigned URL generation |
| Create | `app/api/admin/upload/route.ts` | API endpoint for presigned upload URLs |
| Create | `app/admin/components/ImageUploader.tsx` | Drag-drop upload component with reorder |
| Modify | `app/api/admin/products/route.ts` | Add `images` to ALL_COLUMNS, handle in POST |
| Modify | `app/api/admin/products/[id]/route.ts` | Add `images` to UPDATABLE_COLUMNS, handle in PUT |
| Modify | `app/api/products/[slug]/route.js` | Add `images` to SELECT |
| Modify | `app/api/products/route.js` | Add `images` to SELECT |
| Modify | `app/admin/components/ProductForm.tsx` | Replace image URL input with ImageUploader |
| Modify | `public/js/products.js` | Render gallery when `images` array exists |
| Modify | `.env.local` | Add R2 env vars |

---

### Task 1: Install dependencies and configure environment

**Files:**
- Modify: `.env.local`
- Modify: `package.json`

- [ ] **Step 1: Install AWS S3 SDK packages**

```bash
cd E:/IWO/iwo-watch.webflow/iwo-vercel
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: Add R2 environment variables to `.env.local`**

Append to the end of `.env.local`:

```
# Cloudflare R2
R2_ACCOUNT_ID=ad41f4e2927a6daf25f7c7d6891e31bd
R2_ACCESS_KEY_ID=78dd905d63b734703d639b90b506d1e2
R2_SECRET_ACCESS_KEY=6702717d4e0203fd0aab556c5273977c41a668e7d513381a9f9f83f296d9e585
R2_BUCKET_NAME=iwo-assets
R2_PUBLIC_URL=https://ad41f4e2927a6daf25f7c7d6891e31bd.r2.cloudflarestorage.com/iwo-assets
```

Note: `R2_PUBLIC_URL` must be updated after enabling public access on the R2 bucket dashboard. For now, use the S3 API URL.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.local
git commit -m "chore: add AWS S3 SDK for R2 integration"
```

---

### Task 2: Add `images` column to database

**Files:**
- No file changes — SQL executed against Neon

- [ ] **Step 1: Run ALTER TABLE to add images column**

Execute this SQL against the Neon database. Use the dev server API to run it:

Create a temporary file `scripts/add-images-column.js`:

```javascript
const { sql } = require('@vercel/postgres');

async function migrate() {
  try {
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'`;
    console.log('Column "images" added successfully');
  } catch (err) {
    console.error('Migration error:', err);
  }
  process.exit(0);
}

migrate();
```

Run:
```bash
cd E:/IWO/iwo-watch.webflow/iwo-vercel
node -e "require('dotenv').config({path:'.env.local'});process.env.POSTGRES_URL=process.env.POSTGRES_URL;require('@vercel/postgres').sql\`ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'\`.then(()=>{console.log('OK');process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})"
```

If the inline approach has issues, use the API route approach: create a one-time API route, call it via curl, then delete it.

- [ ] **Step 2: Verify column exists**

```bash
curl -s "http://localhost:3000/api/products/iwo-14-mini" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const p=JSON.parse(d).product;console.log('images:', p.images)})"
```

Expected: `images: []` or `images: null`

- [ ] **Step 3: Commit migration script**

```bash
git add scripts/
git commit -m "chore: add images JSONB column to products table"
```

---

### Task 3: Create R2 client library

**Files:**
- Create: `app/lib/r2.ts`

- [ ] **Step 1: Create the R2 client and presigned URL helper**

Create `app/lib/r2.ts`:

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function createPresignedUpload(
  productId: number | string,
  fileName: string,
  contentType: string
) {
  const ext = fileName.split('.').pop() || 'jpg';
  const key = `products/${productId}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(R2, command, { expiresIn: 600 });
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

  return { uploadUrl, publicUrl, key };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/r2.ts
git commit -m "feat: add R2 client with presigned URL generation"
```

---

### Task 4: Create upload API endpoint

**Files:**
- Create: `app/api/admin/upload/route.ts`

- [ ] **Step 1: Create the upload route**

Create `app/api/admin/upload/route.ts`:

```typescript
import { createPresignedUpload } from '@/app/lib/r2';

function verifyAdmin(request: Request): boolean {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const token = auth.slice(7);
    const data = JSON.parse(atob(token));
    return data.role === 'admin' && data.exp > Date.now();
  } catch {
    return false;
  }
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_LABEL = '5MB';

export async function POST(request: Request) {
  if (!verifyAdmin(request)) {
    return Response.json({ error: 'Nao autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { fileName, contentType, productId } = body;

    if (!fileName || !contentType || !productId) {
      return Response.json(
        { error: 'fileName, contentType e productId sao obrigatorios' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return Response.json(
        { error: `Tipo nao permitido. Aceitos: JPEG, PNG, WebP` },
        { status: 400 }
      );
    }

    const result = await createPresignedUpload(productId, fileName, contentType);

    return Response.json({
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
    });
  } catch (error) {
    console.error('Erro ao gerar URL de upload:', error);
    return Response.json(
      { error: 'Erro ao gerar URL de upload' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Test the endpoint**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/admin/auth -H "Content-Type: application/json" -d '{"password":"iwo2025admin"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).token))")

curl -s -X POST http://localhost:3000/api/admin/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"fileName":"test.jpg","contentType":"image/jpeg","productId":1}'
```

Expected: JSON with `uploadUrl` and `publicUrl` fields.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/upload/route.ts
git commit -m "feat: add presigned upload URL endpoint for R2"
```

---

### Task 5: Update admin product API routes to handle `images`

**Files:**
- Modify: `app/api/admin/products/route.ts`
- Modify: `app/api/admin/products/[id]/route.ts`

- [ ] **Step 1: Add `images` to ALL_COLUMNS in `route.ts`**

In `app/api/admin/products/route.ts`, add `'images'` to the `ALL_COLUMNS` array, after `'archived'`:

```typescript
const ALL_COLUMNS = [
  'name', 'slug', 'description', 'descricao_longa', 'image',
  'product_type', 'vendor', 'collections',
  'price', 'price_formatted', 'compare_at_price', 'compare_at_price_formatted',
  'seo_title', 'seo_description',
  'tamanho_da_caixa', 'tipo_de_tela', 'tamanho_display',
  'pedometro', 'monitoramento_de_sono', 'saude_feminina', 'ecg',
  'pressao_arterial', 'frequencia_cardiaca', 'oxigenio_no_sangue',
  'capacidade_da_bateria', 'duracao_da_bateria', 'acompanha_carregador',
  'bluetooth', 'com_gps', 'com_wi_fi', 'rede_movel', 'com_nfc',
  'memoria_interna', 'musica_local', 'leitor_de_ebooks', 'gravador_de_voz',
  'com_chat_gpt', 'assistente_de_voz', 'controle_de_musica', 'aplicativo',
  'cor_1', 'cor_2', 'cor_3', 'url', 'draft', 'archived', 'images',
] as const;
```

In the POST handler, after the `compare_at_price_formatted` auto-generation block, add logic to auto-set `image` from `images`:

```typescript
    // Auto-set image from images array (principal image)
    if (body.images && Array.isArray(body.images) && body.images.length > 0) {
      body.images = JSON.stringify(body.images);
      const imgs = JSON.parse(body.images as string);
      const principal = imgs.find((i: {is_principal: boolean}) => i.is_principal) || imgs[0];
      if (principal) body.image = principal.url;
    }
```

Note: the `images` value must be `JSON.stringify`'d before being sent as a SQL parameter for JSONB columns. Actually, `@vercel/postgres` handles JSON objects natively — pass the array directly and it will serialize. To be safe, stringify it:

Replace the logic with:

```typescript
    // Auto-set image from images array (principal image)
    if (body.images && Array.isArray(body.images) && body.images.length > 0) {
      const principal = body.images.find((i: {is_principal: boolean}) => i.is_principal) || body.images[0];
      if (principal) body.image = principal.url;
      body.images = JSON.stringify(body.images);
    }
```

- [ ] **Step 2: Add `images` to UPDATABLE_COLUMNS in `[id]/route.ts`**

In `app/api/admin/products/[id]/route.ts`, add `'images'` to the `UPDATABLE_COLUMNS` array, after `'archived'`:

```typescript
const UPDATABLE_COLUMNS = [
  'name', 'slug', 'description', 'descricao_longa', 'image',
  'product_type', 'vendor', 'collections',
  'price', 'price_formatted', 'compare_at_price', 'compare_at_price_formatted',
  'seo_title', 'seo_description',
  'tamanho_da_caixa', 'tipo_de_tela', 'tamanho_display',
  'pedometro', 'monitoramento_de_sono', 'saude_feminina', 'ecg',
  'pressao_arterial', 'frequencia_cardiaca', 'oxigenio_no_sangue',
  'capacidade_da_bateria', 'duracao_da_bateria', 'acompanha_carregador',
  'bluetooth', 'com_gps', 'com_wi_fi', 'rede_movel', 'com_nfc',
  'memoria_interna', 'musica_local', 'leitor_de_ebooks', 'gravador_de_voz',
  'com_chat_gpt', 'assistente_de_voz', 'controle_de_musica', 'aplicativo',
  'cor_1', 'cor_2', 'cor_3', 'url', 'draft', 'archived', 'images',
] as const;
```

In the PUT handler, after the `compare_at_price_formatted` auto-generation block, add:

```typescript
    // Auto-set image from images array (principal image)
    if (body.images && Array.isArray(body.images) && body.images.length > 0) {
      const principal = body.images.find((i: {is_principal: boolean}) => i.is_principal) || body.images[0];
      if (principal) body.image = principal.url;
      body.images = JSON.stringify(body.images);
    }
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/products/route.ts app/api/admin/products/[id]/route.ts
git commit -m "feat: add images JSONB support to admin product API"
```

---

### Task 6: Update public product API routes to return `images`

**Files:**
- Modify: `app/api/products/[slug]/route.js`
- Modify: `app/api/products/route.js`

- [ ] **Step 1: Add `images` to SELECT in `[slug]/route.js`**

In `app/api/products/[slug]/route.js`, add `images` to the SELECT column list:

```javascript
    const result = await sql`
      SELECT
        id, name, slug, description, descricao_longa, image, images,
        product_type, vendor, collections,
        ...rest stays the same
    `;
```

Add `images` right after `image` in the SELECT list on line 14.

- [ ] **Step 2: Add `images` to SELECT in `route.js`**

In `app/api/products/route.js`, add `images` to the SELECT column list in the main query:

```javascript
      SELECT
        id, name, slug, description, descricao_longa, image, images,
        product_type, vendor, collections,
        ...rest stays the same
    `;
```

Add `images` right after `image` on line 78.

- [ ] **Step 3: Test**

```bash
curl -s "http://localhost:3000/api/products/iwo-14-mini" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const p=JSON.parse(d).product;console.log('images field:', JSON.stringify(p.images))})"
```

Expected: `images field: []`

- [ ] **Step 4: Commit**

```bash
git add app/api/products/route.js app/api/products/[slug]/route.js
git commit -m "feat: include images field in public product API"
```

---

### Task 7: Create ImageUploader component

**Files:**
- Create: `app/admin/components/ImageUploader.tsx`

- [ ] **Step 1: Create the ImageUploader component**

Create `app/admin/components/ImageUploader.tsx`:

```tsx
'use client';

import { useState, useRef } from 'react';
import { adminFetch } from '../lib/auth';

export interface ImageItem {
  url: string;
  position: number;
  is_principal: boolean;
}

interface ImageUploaderProps {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
  productId?: number;
  maxImages?: number;
}

export default function ImageUploader({
  images,
  onChange,
  productId,
  maxImages = 5,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!productId) {
      setError('Salve o produto antes de enviar imagens.');
      return null;
    }

    const res = await adminFetch('/api/admin/upload', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        productId,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao gerar URL de upload');
    }

    const { uploadUrl, publicUrl } = await res.json();

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    if (!uploadRes.ok) {
      throw new Error('Erro ao enviar arquivo para R2');
    }

    return publicUrl;
  }

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const remaining = maxImages - images.length;

    if (remaining <= 0) {
      setError(`Limite de ${maxImages} imagens atingido.`);
      return;
    }

    const toUpload = fileArray.slice(0, remaining);
    setError('');
    setUploading(true);

    try {
      const newImages: ImageItem[] = [];

      for (const file of toUpload) {
        if (file.size > 5 * 1024 * 1024) {
          setError(`${file.name} excede 5MB.`);
          continue;
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          setError(`${file.name}: tipo nao permitido.`);
          continue;
        }

        const url = await uploadFile(file);
        if (url) {
          newImages.push({
            url,
            position: images.length + newImages.length,
            is_principal: images.length === 0 && newImages.length === 0,
          });
        }
      }

      if (newImages.length > 0) {
        onChange([...images, ...newImages]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleRemove(index: number) {
    const updated = images.filter((_, i) => i !== index)
      .map((img, i) => ({ ...img, position: i }));
    // If removed was principal, make first one principal
    if (updated.length > 0 && !updated.some(i => i.is_principal)) {
      updated[0].is_principal = true;
    }
    onChange(updated);
  }

  function handleSetPrincipal(index: number) {
    const updated = images.map((img, i) => ({
      ...img,
      is_principal: i === index,
    }));
    onChange(updated);
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOverItem(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    const updated = [...images];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    const reordered = updated.map((img, i) => ({ ...img, position: i }));
    onChange(reordered);
    setDragIndex(index);
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#2563eb' : '#d1d5db'}`,
          borderRadius: '10px',
          padding: '32px',
          textAlign: 'center',
          cursor: images.length >= maxImages ? 'not-allowed' : 'pointer',
          backgroundColor: dragOver ? '#eff6ff' : '#fafafa',
          transition: 'all 0.15s',
          opacity: images.length >= maxImages ? 0.5 : 1,
          marginBottom: '16px',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          disabled={images.length >= maxImages}
        />
        {uploading ? (
          <div style={{ color: '#2563eb', fontWeight: 500 }}>Enviando...</div>
        ) : (
          <div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
              Arraste imagens aqui ou clique para selecionar
            </div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              JPEG, PNG ou WebP - max 5MB - {images.length}/{maxImages} fotos
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          color: '#dc2626', fontSize: '13px', marginBottom: '12px',
          padding: '8px 12px', backgroundColor: '#fef2f2', borderRadius: '6px',
        }}>
          {error}
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '12px',
        }}>
          {images.map((img, i) => (
            <div
              key={img.url}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOverItem(e, i)}
              onDragEnd={handleDragEnd}
              style={{
                position: 'relative',
                borderRadius: '8px',
                overflow: 'hidden',
                border: img.is_principal ? '2px solid #2563eb' : '2px solid #e5e7eb',
                backgroundColor: '#f9fafb',
                cursor: 'grab',
                aspectRatio: '1',
              }}
            >
              <img
                src={img.url}
                alt={`Foto ${i + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              {/* Principal badge */}
              <button
                type="button"
                onClick={() => handleSetPrincipal(i)}
                title={img.is_principal ? 'Imagem principal' : 'Definir como principal'}
                style={{
                  position: 'absolute', top: 4, left: 4,
                  background: img.is_principal ? '#2563eb' : 'rgba(0,0,0,0.5)',
                  color: '#fff', border: 'none', borderRadius: '4px',
                  width: 24, height: 24, cursor: 'pointer',
                  fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {img.is_principal ? '\u2605' : '\u2606'}
              </button>
              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                title="Remover"
                style={{
                  position: 'absolute', top: 4, right: 4,
                  background: 'rgba(220,38,38,0.85)', color: '#fff',
                  border: 'none', borderRadius: '4px',
                  width: 24, height: 24, cursor: 'pointer',
                  fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                &times;
              </button>
              {/* Position indicator */}
              <div style={{
                position: 'absolute', bottom: 4, right: 4,
                background: 'rgba(0,0,0,0.5)', color: '#fff',
                borderRadius: '4px', padding: '2px 6px', fontSize: '11px',
              }}>
                {i + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/components/ImageUploader.tsx
git commit -m "feat: add ImageUploader component with drag-drop and reorder"
```

---

### Task 8: Integrate ImageUploader into ProductForm

**Files:**
- Modify: `app/admin/components/ProductForm.tsx`

- [ ] **Step 1: Add ImageItem type and images to ProductData**

In `ProductForm.tsx`, add the import at the top (after the existing `useState` import):

```typescript
import ImageUploader, { ImageItem } from './ImageUploader';
```

Add `images` to the `ProductData` interface — replace:

```typescript
  image: string;
```

with:

```typescript
  image: string;
  images: ImageItem[];
```

- [ ] **Step 2: Update getDefaultData to include images**

In `getDefaultData()`, add after `image: '',`:

```typescript
    images: [],
```

- [ ] **Step 3: Update productToFormData to parse images**

In `productToFormData()`, add special handling for `images` before the generic loop. After `const data = { ...defaults } as Record<string, unknown>;`, add:

```typescript
  // Parse images from JSON if needed
  if (product.images) {
    if (typeof product.images === 'string') {
      try { data.images = JSON.parse(product.images); } catch { data.images = []; }
    } else if (Array.isArray(product.images)) {
      data.images = product.images;
    }
  }
```

And in the loop, skip `images` since we handled it above:

```typescript
  for (const key of Object.keys(defaults) as (keyof ProductData)[]) {
    if (key === 'images') continue; // handled above
    ...
```

- [ ] **Step 4: Replace the image URL input with ImageUploader**

In the JSX, replace the "Imagem (URL)" field block:

```tsx
        <div style={s.field}>
          <label style={s.label}>Imagem (URL)</label>
          <input
            name="image"
            value={form.image}
            onChange={handleChange}
            style={s.input}
            placeholder="https://..."
          />
        </div>
```

with:

```tsx
        <div style={s.field}>
          <label style={s.label}>Imagens do Produto</label>
          <ImageUploader
            images={form.images}
            onChange={(imgs) => setForm(prev => ({ ...prev, images: imgs }))}
            productId={product?.id}
            maxImages={5}
          />
          {!product?.id && (
            <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
              Salve o produto primeiro para habilitar o upload de imagens.
            </div>
          )}
        </div>
```

- [ ] **Step 5: Verify build**

```bash
cd E:/IWO/iwo-watch.webflow/iwo-vercel && npx next build 2>&1 | tail -15
```

Expected: `Compiled successfully`

- [ ] **Step 6: Commit**

```bash
git add app/admin/components/ProductForm.tsx
git commit -m "feat: integrate ImageUploader into ProductForm"
```

---

### Task 9: Update product page gallery in products.js

**Files:**
- Modify: `public/js/products.js`

- [ ] **Step 1: Update the image rendering in `populateProductPage()`**

In `public/js/products.js`, replace the `// --- Imagem principal ---` section:

```javascript
    // --- Imagem principal ---
    const mainImageContainer = document.getElementById('product-main-image');
    if (mainImageContainer && p.image) {
      mainImageContainer.innerHTML = `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:contain;">`;
    }
```

with:

```javascript
    // --- Imagem / Galeria ---
    const mainImageContainer = document.getElementById('product-main-image');
    if (mainImageContainer) {
      const imgs = (p.images && p.images.length > 0)
        ? [...p.images].sort((a, b) => a.position - b.position)
        : (p.image ? [{ url: p.image, position: 0, is_principal: true }] : []);

      if (imgs.length === 0) return;

      const principalUrl = (imgs.find(i => i.is_principal) || imgs[0]).url;

      let html = `<img id="gallery-main" src="${principalUrl}" alt="${p.name}" style="width:100%;height:100%;object-fit:contain;">`;

      if (imgs.length > 1) {
        html += `<div id="gallery-thumbs" style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">`;
        imgs.forEach((img, i) => {
          const isActive = img.url === principalUrl;
          html += `<img
            src="${img.url}"
            alt="Foto ${i + 1}"
            onclick="document.getElementById('gallery-main').src='${img.url}';document.querySelectorAll('#gallery-thumbs img').forEach(t=>t.style.borderColor='#e5e7eb');this.style.borderColor='#2563eb';"
            style="width:64px;height:64px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid ${isActive ? '#2563eb' : '#e5e7eb'};transition:border-color 0.15s;"
          >`;
        });
        html += `</div>`;
      }

      mainImageContainer.innerHTML = html;
    }
```

- [ ] **Step 2: Commit**

```bash
git add public/js/products.js
git commit -m "feat: render image gallery on product page when multiple images exist"
```

---

### Task 10: End-to-end test

- [ ] **Step 1: Start dev server and test upload flow**

```bash
cd E:/IWO/iwo-watch.webflow/iwo-vercel && npm run dev
```

1. Go to `http://localhost:3000/admin`
2. Login with password `iwo2025admin`
3. Go to Produtos, click on a product (e.g., Iwo 14 Mini)
4. The "Imagens do Produto" section should show the ImageUploader
5. Upload a test image — should upload to R2 and show preview
6. Click save — product should update with `images` array
7. Go to `http://localhost:3000/p/iwo-14-mini` — image should display

- [ ] **Step 2: Test gallery with multiple images**

1. Go back to admin, edit the same product
2. Upload 2-3 more images
3. Drag to reorder, set a different one as principal (star icon)
4. Save
5. Go to `http://localhost:3000/p/iwo-14-mini`
6. Should show main image + thumbnails below
7. Click thumbnails — main image should swap

- [ ] **Step 3: Test retrocompatibility**

```bash
curl -s "http://localhost:3000/api/products/pulseira-silicone" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const p=JSON.parse(d).product;console.log('image:', p.image);console.log('images:', JSON.stringify(p.images))})"
```

Expected: `image` has the old CDN URL, `images` is `[]` — product page should show the single image as before.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete image upload system with R2, admin UI, and product gallery"
```
