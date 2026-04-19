# Mobile Landing Variant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second Figma-imported landing variant (mobile, 375px) per product, switched via CSS `@media (max-width: 768px)`.

**Architecture:** Mirror the existing desktop landing columns/pipeline/UI. Two independent `<section>` wrappers in the public page; CSS media query toggles `display`. Scope classes diverge per variant (`.iwo-landing-<id>` for desktop, `.iwo-landing-<id>-m` for mobile) — zero cascade collision, zero JS, zero user-agent detection.

**Tech Stack:** Next.js 16 App Router + Prisma 7 (driver adapter) + Neon Postgres + Cloudflare R2 (S3 SDK) + PostCSS + DOMPurify + Figma MCP.

**Spec:** `iwo-vercel/docs/superpowers/specs/2026-04-19-mobile-landing-variant-design.md`

---

## File changes at a glance

| File | Change |
|---|---|
| `iwo-vercel/prisma/schema.prisma` | +5 mobile columns on `Product` |
| `iwo-vercel/app/lib/landing-vars.ts` | Add mobile columns to `REQUIRED_PRODUCT_FIELDS` |
| `iwo-vercel/app/lib/landing-pipeline.ts` | `scopeLandingCss(raw, productId, variant)` — new 3rd param |
| `iwo-vercel/app/api/admin/products/[id]/landing/route.ts` | GET returns `{ desktop, mobile }`; PATCH/DELETE accept `variant` |
| `iwo-vercel/scripts/figma-import-26/source.jsx` | Rename → `source.desktop.jsx` (git mv) |
| `iwo-vercel/scripts/figma-import-26/lib/r2-mirror.mjs` | Accept `variant` in key path |
| `iwo-vercel/scripts/figma-import-26/import.mjs` | `--variant` flag throughout |
| `iwo-vercel/scripts/figma-import-26/resume-patch.mjs` | `--variant` flag |
| `iwo-vercel/app/p/[slug]/LandingSection.tsx` | Dual render, switch styles, per-variant scope |
| `iwo-vercel/app/p/[slug]/page.tsx` | Pass both variants to `LandingSection` |
| `iwo-vercel/app/admin/components/LandingManager.tsx` | Two-card UI, per-variant actions |

---

## Task 1: Add mobile columns to Prisma schema

**Files:**
- Modify: `iwo-vercel/prisma/schema.prisma`

- [ ] **Step 1: Add 5 mirror columns on `Product`**

In `iwo-vercel/prisma/schema.prisma`, find the existing landing block:

```prisma
  // ── Landing (Figma-imported product landing page) ──────────────────────
  landingFigmaUrl      String?   @map("landing_figma_url") @db.VarChar(500)
  landingHtml          String?   @map("landing_html") @db.Text
  landingCss           String?   @map("landing_css") @db.Text
  landingAssetManifest Json?     @map("landing_asset_manifest") @db.JsonB
  landingImportedAt    DateTime? @map("landing_imported_at")
```

Add immediately below it:

```prisma
  // ── Landing Mobile variant (Figma-imported @ 375px) ────────────────────
  landingMobileFigmaUrl      String?   @map("landing_mobile_figma_url") @db.VarChar(500)
  landingMobileHtml          String?   @map("landing_mobile_html") @db.Text
  landingMobileCss           String?   @map("landing_mobile_css") @db.Text
  landingMobileAssetManifest Json?     @map("landing_mobile_asset_manifest") @db.JsonB
  landingMobileImportedAt    DateTime? @map("landing_mobile_imported_at")
```

- [ ] **Step 2: Push schema to Neon and regenerate client**

From `iwo-vercel/`:

```bash
cd E:/IWO/iwo-watch.webflow/iwo-vercel
npx prisma db push
npx prisma generate
```

Expected:
- `db push` prints "The database is now in sync with your Prisma schema" and lists the 5 new columns it added.
- `generate` prints "✔ Generated Prisma Client".

- [ ] **Step 3: Verify the columns exist**

```bash
cd E:/IWO/iwo-watch.webflow/iwo-vercel
node --input-type=module -e "
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const p = await prisma.product.findUnique({
  where: { id: 26 },
  select: {
    id: true,
    landingFigmaUrl: true,
    landingMobileFigmaUrl: true,
    landingMobileHtml: true,
    landingMobileImportedAt: true,
  },
});
console.log(JSON.stringify(p, null, 2));
await prisma.\$disconnect();
"
```

Expected: JSON with `landingFigmaUrl` populated (from current desktop import) and all `landingMobile*` fields `null`. No "Unknown column" error.

- [ ] **Step 4: Commit**

```bash
cd E:/IWO/iwo-watch.webflow
git add iwo-vercel/prisma/schema.prisma
git commit -m "feat(schema): add 5 mobile landing columns on Product"
```

---

## Task 2: Extend `scopeLandingCss` with variant parameter

**Files:**
- Modify: `iwo-vercel/app/lib/landing-pipeline.ts`

- [ ] **Step 1: Update signature + scope class per variant**

In `iwo-vercel/app/lib/landing-pipeline.ts`, replace the `scopeLandingCss` function (starts around line 48) with:

```ts
export async function scopeLandingCss(
  raw: string,
  productId: number,
  variant: "desktop" | "mobile" = "desktop",
): Promise<string> {
  if (!raw) return "";
  const scope =
    variant === "mobile"
      ? `.iwo-landing-${productId}-m`
      : `.iwo-landing-${productId}`;
  const result = await postcss([
    prefixer({
      prefix: scope,
      transform(prefix, selector, prefixedSelector) {
        const trimmed = selector.trim();
        if (
          trimmed === "html" ||
          trimmed === "body" ||
          trimmed === ":root" ||
          trimmed === "*"
        ) {
          return prefix;
        }
        // Selector already starts with `:where(<prefix>)` — leave it alone
        // (import pipeline emits a low-specificity :where()-scoped reset
        // that must NOT be re-prefixed).
        if (trimmed.startsWith(`:where(${prefix})`)) {
          return selector;
        }
        // Selector already starts with the scope class — leave it alone.
        if (trimmed.startsWith(`${prefix} `) || trimmed === prefix) {
          return selector;
        }
        return prefixedSelector;
      },
    }),
  ]).process(raw, { from: undefined });
  return result.css;
}
```

Key changes vs. old:
- 3rd param `variant` with default `'desktop'` (backward compat).
- `scope` derived from variant: desktop stays `.iwo-landing-<id>`, mobile is `.iwo-landing-<id>-m`.
- The `:where()` and prefix-already-present checks use the derived `prefix` value, so mobile CSS preserved under `:where(.iwo-landing-26-m)` is skipped correctly.

- [ ] **Step 2: Typecheck the file**

```bash
cd E:/IWO/iwo-watch.webflow/iwo-vercel
npx tsc --noEmit -p . 2>&1 | grep -E "landing-pipeline|error TS" | head -5
```

Expected: no errors referencing `landing-pipeline.ts`. Existing callers pass only 2 args; the default value keeps them working.

- [ ] **Step 3: Commit**

```bash
cd E:/IWO/iwo-watch.webflow
git add iwo-vercel/app/lib/landing-pipeline.ts
git commit -m "feat(landing): scopeLandingCss accepts variant param"
```

---

## Task 3: Add mobile fields to `REQUIRED_PRODUCT_FIELDS`

**Files:**
- Modify: `iwo-vercel/app/lib/landing-vars.ts`

- [ ] **Step 1: Add 5 mobile fields to the select shape**

In `iwo-vercel/app/lib/landing-vars.ts`, find the block inside `REQUIRED_PRODUCT_FIELDS` that has:

```ts
  // landing state (needed by the page component itself)
  landingHtml: true,
  landingCss: true,
  landingImportedAt: true,
  image: true,
```

Replace with:

```ts
  // landing desktop
  landingFigmaUrl: true,
  landingHtml: true,
  landingCss: true,
  landingAssetManifest: true,
  landingImportedAt: true,

  // landing mobile
  landingMobileFigmaUrl: true,
  landingMobileHtml: true,
  landingMobileCss: true,
  landingMobileAssetManifest: true,
  landingMobileImportedAt: true,

  image: true,
```

`buildLandingVars` itself does NOT change — the placeholder vars (`name`, `description`, etc.) are variant-agnostic.

- [ ] **Step 2: Typecheck**

```bash
cd E:/IWO/iwo-watch.webflow/iwo-vercel
npx tsc --noEmit -p . 2>&1 | grep -E "landing-vars|error TS" | head -10
```

Expected: no errors. `ProductForLanding` auto-derives from `REQUIRED_PRODUCT_FIELDS` so it gains the new fields.

- [ ] **Step 3: Commit**

```bash
cd E:/IWO/iwo-watch.webflow
git add iwo-vercel/app/lib/landing-vars.ts
git commit -m "feat(landing): select mobile landing columns in REQUIRED_PRODUCT_FIELDS"
```

---

## Task 4: Refactor admin API route — variant-aware GET/PATCH/DELETE

**Files:**
- Modify: `iwo-vercel/app/api/admin/products/[id]/landing/route.ts`

- [ ] **Step 1: Replace the GET handler**

Find the current `GET` function (starts around line 57) and replace its body with:

```ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await guardAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const productId = parseProductId(id);
    if (productId === null) {
      return Response.json({ error: 'ID inválido' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        slug: true,
        // desktop
        landingFigmaUrl: true,
        landingHtml: true,
        landingCss: true,
        landingAssetManifest: true,
        landingImportedAt: true,
        // mobile
        landingMobileFigmaUrl: true,
        landingMobileHtml: true,
        landingMobileCss: true,
        landingMobileAssetManifest: true,
        landingMobileImportedAt: true,
      },
    });

    if (!product) {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    return Response.json({
      id: product.id,
      slug: product.slug,
      desktop: {
        figmaUrl: product.landingFigmaUrl,
        html: product.landingHtml,
        css: product.landingCss,
        assetManifest: product.landingAssetManifest ?? null,
        importedAt: product.landingImportedAt,
      },
      mobile: {
        figmaUrl: product.landingMobileFigmaUrl,
        html: product.landingMobileHtml,
        css: product.landingMobileCss,
        assetManifest: product.landingMobileAssetManifest ?? null,
        importedAt: product.landingMobileImportedAt,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar landing:', error);
    return Response.json({ error: 'Erro ao buscar landing' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Replace the PATCH handler**

Find the current `PATCH` function and replace it with:

```ts
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await guardAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const productId = parseProductId(id);
    if (productId === null) {
      return Response.json({ error: 'ID inválido' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, slug: true },
    });
    if (!product) {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return Response.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const { figmaUrl, html, css, assetManifest, variant: rawVariant } = body as {
      figmaUrl?: unknown;
      html?: unknown;
      css?: unknown;
      assetManifest?: unknown;
      variant?: unknown;
    };

    // Discriminate: default 'desktop' for backward compatibility.
    const variant: 'desktop' | 'mobile' =
      rawVariant === 'mobile' ? 'mobile' : 'desktop';

    // Column name resolver.
    const col = {
      figmaUrl: variant === 'mobile' ? 'landingMobileFigmaUrl' : 'landingFigmaUrl',
      html: variant === 'mobile' ? 'landingMobileHtml' : 'landingHtml',
      css: variant === 'mobile' ? 'landingMobileCss' : 'landingCss',
      manifest: variant === 'mobile' ? 'landingMobileAssetManifest' : 'landingAssetManifest',
      importedAt: variant === 'mobile' ? 'landingMobileImportedAt' : 'landingImportedAt',
    } as const;

    const data: Record<string, unknown> = {};

    // figmaUrl
    if (figmaUrl !== undefined) {
      if (figmaUrl === null) {
        data[col.figmaUrl] = null;
      } else if (typeof figmaUrl !== 'string') {
        return Response.json(
          { error: 'figmaUrl deve ser string ou null' },
          { status: 400 }
        );
      } else {
        const trimmed = figmaUrl.trim();
        if (!isValidFigmaUrl(trimmed)) {
          return Response.json(
            {
              error: `figmaUrl inválido (deve começar com https://www.figma.com/ ou https://figma.com/, máx ${MAX_FIGMA_URL_LEN} chars)`,
            },
            { status: 400 }
          );
        }
        data[col.figmaUrl] = trimmed;
      }
    }

    // html (sanitize)
    if (html !== undefined) {
      if (html === null) {
        data[col.html] = null;
      } else if (typeof html !== 'string') {
        return Response.json(
          { error: 'html deve ser string ou null' },
          { status: 400 }
        );
      } else {
        if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
          return Response.json(
            { error: `html excede ${MAX_HTML_BYTES} bytes` },
            { status: 413 }
          );
        }
        const cleaned = sanitizeLandingHtml(html);
        data[col.html] = cleaned.trim().length === 0 ? null : cleaned;
      }
    }

    // css (scope, variant-aware)
    if (css !== undefined) {
      if (css === null) {
        data[col.css] = null;
      } else if (typeof css !== 'string') {
        return Response.json(
          { error: 'css deve ser string ou null' },
          { status: 400 }
        );
      } else {
        if (Buffer.byteLength(css, 'utf8') > MAX_CSS_BYTES) {
          return Response.json(
            { error: `css excede ${MAX_CSS_BYTES} bytes` },
            { status: 413 }
          );
        }
        const scoped = await scopeLandingCss(css, product.id, variant);
        data[col.css] = scoped.trim().length === 0 ? null : scoped;
      }
    }

    // assetManifest
    if (assetManifest !== undefined) {
      if (assetManifest === null) {
        data[col.manifest] = Prisma.DbNull;
      } else if (!isValidManifest(assetManifest)) {
        return Response.json(
          {
            error: `assetManifest deve ser array de strings (máx ${MAX_MANIFEST_ENTRIES} entradas, cada ≤ ${MAX_MANIFEST_URL_LEN} chars)`,
          },
          { status: 400 }
        );
      } else {
        data[col.manifest] = assetManifest as Prisma.InputJsonValue;
      }
    }

    if (Object.keys(data).length === 0) {
      return Response.json(
        { error: 'Nenhum campo válido para atualizar' },
        { status: 400 }
      );
    }

    data[col.importedAt] = new Date();

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: data as Prisma.ProductUpdateInput,
      select: {
        id: true,
        slug: true,
        landingHtml: true,
        landingCss: true,
        landingImportedAt: true,
        landingMobileHtml: true,
        landingMobileCss: true,
        landingMobileImportedAt: true,
      },
    });

    return Response.json({
      success: true,
      variant,
      product: {
        id: updated.id,
        slug: updated.slug,
        desktop: {
          hasHtml: (updated.landingHtml ?? '').length > 0,
          hasCss: (updated.landingCss ?? '').length > 0,
          importedAt: updated.landingImportedAt,
        },
        mobile: {
          hasHtml: (updated.landingMobileHtml ?? '').length > 0,
          hasCss: (updated.landingMobileCss ?? '').length > 0,
          importedAt: updated.landingMobileImportedAt,
        },
      },
    });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2025') {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }
    console.error('Erro ao atualizar landing:', error);
    return Response.json({ error: 'Erro ao atualizar landing' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Replace the DELETE handler**

Replace the current `DELETE` function with:

```ts
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await guardAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const productId = parseProductId(id);
    if (productId === null) {
      return Response.json({ error: 'ID inválido' }, { status: 400 });
    }

    const url = new URL(request.url);
    const variantParam = url.searchParams.get('variant');
    const variant: 'desktop' | 'mobile' | 'all' =
      variantParam === 'mobile'
        ? 'mobile'
        : variantParam === 'desktop'
          ? 'desktop'
          : 'all';

    const desktopClear = {
      landingFigmaUrl: null,
      landingHtml: null,
      landingCss: null,
      landingAssetManifest: Prisma.DbNull,
      landingImportedAt: null,
    };
    const mobileClear = {
      landingMobileFigmaUrl: null,
      landingMobileHtml: null,
      landingMobileCss: null,
      landingMobileAssetManifest: Prisma.DbNull,
      landingMobileImportedAt: null,
    };

    const data: Prisma.ProductUpdateInput =
      variant === 'desktop'
        ? desktopClear
        : variant === 'mobile'
          ? mobileClear
          : { ...desktopClear, ...mobileClear };

    await prisma.product.update({
      where: { id: productId },
      data,
      select: { id: true },
    });

    return Response.json({ success: true, variant });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2025') {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }
    console.error('Erro ao excluir landing:', error);
    return Response.json({ error: 'Erro ao excluir landing' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Smoke-test the route locally**

Start the dev server if not running (`npm run dev` in `iwo-vercel/`), then:

```bash
cd E:/IWO/iwo-watch.webflow/iwo-vercel
node --input-type=module -e "
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { SignJWT } from 'jose';
const token = await new SignJWT({ role: 'admin' })
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setSubject('test').setIssuedAt().setExpirationTime('5m')
  .setIssuer('iwo-watch-admin').setAudience('iwo-watch-admin')
  .sign(new TextEncoder().encode(process.env.ADMIN_JWT_SECRET));

const res = await fetch('http://localhost:3000/api/admin/products/26/landing', {
  headers: { Authorization: 'Bearer ' + token }
});
console.log('HTTP', res.status);
const body = await res.json();
console.log('keys:', Object.keys(body));
console.log('desktop keys:', body.desktop ? Object.keys(body.desktop) : 'missing');
console.log('mobile keys:', body.mobile ? Object.keys(body.mobile) : 'missing');
console.log('mobile values:', body.mobile);
"
```

Expected:
- `HTTP 200`
- `keys: [ 'id', 'slug', 'desktop', 'mobile' ]`
- `desktop keys: [ 'figmaUrl', 'html', 'css', 'assetManifest', 'importedAt' ]`
- `mobile keys: [ 'figmaUrl', 'html', 'css', 'assetManifest', 'importedAt' ]`
- `mobile values: { figmaUrl: null, html: null, css: null, assetManifest: null, importedAt: null }`

- [ ] **Step 5: Commit**

```bash
cd E:/IWO/iwo-watch.webflow
git add iwo-vercel/app/api/admin/products/[id]/landing/route.ts
git commit -m "feat(api): landing route supports desktop+mobile variants"
```

---

## Task 5: `r2-mirror.mjs` — variant-aware R2 key prefix

**Files:**
- Modify: `iwo-vercel/scripts/figma-import-26/lib/r2-mirror.mjs`

- [ ] **Step 1: Thread `variant` param through**

Find `mirrorAssetsToR2` function and change its signature + key construction:

```js
export async function mirrorAssetsToR2({ assets, productId, variant = 'desktop' }) {
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBase = process.env.R2_PUBLIC_URL;
  if (!bucket || !publicBase) {
    throw new Error('R2_BUCKET_NAME / R2_PUBLIC_URL missing from environment.');
  }
  const client = makeClient();
  const mapping = {};
  const seenUrls = new Set();

  for (const [name, url] of Object.entries(assets)) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${name} (${url}): HTTP ${res.status}`);
    }
    const contentType = (res.headers.get('content-type') || '')
      .toLowerCase().split(';')[0].trim();
    const ext = MIME_EXT[contentType];
    if (!ext) {
      throw new Error(`Unsupported content-type "${contentType}" for ${name} (${url}).`);
    }
    const buf = Buffer.from(await res.arrayBuffer());

    const key = `landing/${productId}/${variant}/${randomUUID()}.${ext}`;
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buf,
      ContentType: contentType,
    }));

    const publicUrl = `${publicBase.replace(/\/$/, '')}/${key}`;
    mapping[url] = publicUrl;
    console.log(`  [r2] ${name.padEnd(45)} → ${key} (${buf.byteLength}B, ${contentType})`);
  }

  return mapping;
}
```

Key line: `const key = \`landing/${productId}/${variant}/${randomUUID()}.${ext}\`;` (variant segment inserted).

- [ ] **Step 2: Commit**

```bash
cd E:/IWO/iwo-watch.webflow
git add iwo-vercel/scripts/figma-import-26/lib/r2-mirror.mjs
git commit -m "feat(import): r2-mirror includes variant in key prefix"
```

---

## Task 6: Rename `source.jsx` + parametrize `import.mjs`

**Files:**
- Rename: `iwo-vercel/scripts/figma-import-26/source.jsx` → `source.desktop.jsx`
- Modify: `iwo-vercel/scripts/figma-import-26/import.mjs`

- [ ] **Step 1: Rename the source file**

```bash
cd E:/IWO/iwo-watch.webflow/iwo-vercel
git mv scripts/figma-import-26/source.jsx scripts/figma-import-26/source.desktop.jsx
```

- [ ] **Step 2: Parse `--variant` flag + wire variant through the pipeline**

At the top of `iwo-vercel/scripts/figma-import-26/import.mjs`, after the `import` statements and before `// ── Config ──`, insert:

```js
// Parse --variant=<desktop|mobile> from argv (default: desktop).
function parseVariant() {
  const match = process.argv.find((a) => a.startsWith('--variant'));
  if (!match) return 'desktop';
  const value = match.includes('=')
    ? match.split('=')[1]
    : process.argv[process.argv.indexOf(match) + 1];
  if (value !== 'desktop' && value !== 'mobile') {
    throw new Error(`Invalid --variant "${value}". Use desktop or mobile.`);
  }
  return value;
}
const VARIANT = parseVariant();
```

Then replace the `SCOPE` constant line:

```js
const SCOPE = `.iwo-landing-${PRODUCT_ID}${VARIANT === 'mobile' ? '-m' : ''}`;
```

And replace the existing width pin (search for `;width:1280px;height:4698px;flex-shrink:0`):

```js
const FRAME_WIDTH = VARIANT === 'mobile' ? 375 : 1280;
// NOTE: height varies per Figma frame. Update this when the mobile frame
// intrinsic height changes. 4698 is the desktop frame height; 3000 is a
// safe placeholder for the first mobile import — refine to the actual
// Figma frame height after the first MCP metadata call.
const FRAME_HEIGHT = VARIANT === 'mobile' ? 3000 : 4698;

htmlRaw = htmlRaw.replace(
  /^<div class="relative size-full" style="([^"]*)"/,
  (_m, existing) =>
    `<div class="relative size-full" style="${existing};width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;flex-shrink:0"`,
);
```

Replace the `sourcePath` line:

```js
const sourcePath = join(__dirname, `source.${VARIANT}.jsx`);
```

Replace the `artifactsDir` line:

```js
const artifactsDir = join(__dirname, 'artifacts', VARIANT);
mkdirSync(artifactsDir, { recursive: true });
```

Replace the call to `mirrorAssetsToR2`:

```js
const mapping = await mirrorAssetsToR2({ assets, productId: PRODUCT_ID, variant: VARIANT });
```

Replace the PATCH call body — the `payload` object — to include the variant:

```js
const payload = {
  figmaUrl: FIGMA_URL,
  html: htmlWrapped,
  css: cssScoped,
  assetManifest,
  variant: VARIANT,
};
```

Replace the `htmlWrapped` construction to use variant-aware wrapper:

```js
const htmlWrapped = `<div class="${SCOPE.slice(1)}">${htmlFinal}</div>`;
```

(Uses `SCOPE.slice(1)` to drop the leading `.` — wrapper gets the class name directly.)

- [ ] **Step 3: Dry-run (desktop — no-op: same behavior as before)**

Make sure `next dev` is running on port 3000. Then from `iwo-vercel/`:

```bash
cd E:/IWO/iwo-watch.webflow/iwo-vercel
node scripts/figma-import-26/import.mjs 2>&1 | tail -10
```

Expected: pipeline completes with `PATCH 200`. R2 keys now have `/desktop/` segment (you'll see in the `[r2]` log lines: `landing/26/desktop/<uuid>.<ext>`).

- [ ] **Step 4: Commit**

```bash
cd E:/IWO/iwo-watch.webflow
git add iwo-vercel/scripts/figma-import-26/source.desktop.jsx iwo-vercel/scripts/figma-import-26/import.mjs
git commit -m "feat(import): --variant flag + variant-scoped artifacts/keys/CSS"
```

---

## Task 7: `resume-patch.mjs` — variant flag

**Files:**
- Modify: `iwo-vercel/scripts/figma-import-26/resume-patch.mjs`

- [ ] **Step 1: Parse variant + read from variant-specific artifacts dir**

Replace the top section of `resume-patch.mjs` (imports + constants + file reads) with:

```js
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { SignJWT } from 'jose';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');
dotenv.config({ path: join(projectRoot, '.env.local') });

function parseVariant() {
  const match = process.argv.find((a) => a.startsWith('--variant'));
  if (!match) return 'desktop';
  const value = match.includes('=')
    ? match.split('=')[1]
    : process.argv[process.argv.indexOf(match) + 1];
  if (value !== 'desktop' && value !== 'mobile') {
    throw new Error(`Invalid --variant "${value}". Use desktop or mobile.`);
  }
  return value;
}
const VARIANT = parseVariant();

const PRODUCT_ID = 26;
const FIGMA_URL =
  'https://www.figma.com/design/V5L6H0bq5bgM362Lclwbdd/Apple-Landing-Page-Prototype--Community-?node-id=103-952&t=xdUK5HQcl5SxWFK5-11';
const API_BASE = process.env.IWO_API_BASE || 'http://localhost:3000';

const artifactsDir = join(__dirname, 'artifacts', VARIANT);
const html = readFileSync(join(artifactsDir, '7-html-wrapped.html'), 'utf8');
const css = readFileSync(join(artifactsDir, '5-css-scoped.css'), 'utf8');
const assetManifest = JSON.parse(
  readFileSync(join(artifactsDir, 'asset-manifest.json'), 'utf8'),
);
```

Replace the `body: JSON.stringify(...)` line of the `fetch` call to include variant:

```js
  body: JSON.stringify({ figmaUrl: FIGMA_URL, html, css, assetManifest, variant: VARIANT }),
```

- [ ] **Step 2: Commit**

```bash
cd E:/IWO/iwo-watch.webflow
git add iwo-vercel/scripts/figma-import-26/resume-patch.mjs
git commit -m "feat(import): resume-patch reads artifacts per-variant"
```

---

## Task 8: `LandingSection.tsx` — dual render with media-query switch

**Files:**
- Modify: `iwo-vercel/app/p/[slug]/LandingSection.tsx`

- [ ] **Step 1: Replace the whole file**

Replace the entire contents of `iwo-vercel/app/p/[slug]/LandingSection.tsx` with:

```tsx
// Server Component. Renders the Figma-imported landing HTML + scoped CSS
// for BOTH desktop and mobile variants. A tiny media-query `<style>` block
// toggles which wrapper is visible at the 768px breakpoint. When only one
// variant is stored, it shows at every viewport (no hide rule emitted).
//
// CONTRACT (upheld by the import pipeline + admin PATCH):
//   - Each variant's `html` was sanitized via sanitizeLandingHtml() on write.
//   - Each variant's `css`  was scoped to its own class on write:
//       desktop → .iwo-landing-<id>     (unchanged for backward compat)
//       mobile  → .iwo-landing-<id>-m
// Therefore we do NOT re-sanitize or re-scope here.
//
// Interpolation runs AFTER sanitize — DOMPurify with USE_PROFILES:{html:true}
// leaves text nodes untouched, so {{name}} / {{subtitle}} / {{description}} /
// {{price}} / etc. tokens survive sanitization and are replaced here at
// render time with HTML-escaped values.

import { interpolateLandingHtml } from "@/app/lib/landing-interpolate";

const MOBILE_BREAKPOINT = 768;

type Variant = {
  html: string | null;
  css: string | null;
};

type Props = {
  productId: number;
  desktop: Variant;
  mobile: Variant;
  variables: Record<string, string>;
};

function buildSwitchCss(
  productId: number,
  hasDesktop: boolean,
  hasMobile: boolean,
): string {
  const d = `.iwo-landing-${productId}`;
  const m = `.iwo-landing-${productId}-m`;

  // Both variants present → full switch.
  if (hasDesktop && hasMobile) {
    return `
${d} { display: flex; }
${m} { display: none; }
@media (max-width: ${MOBILE_BREAKPOINT}px) {
  ${d} { display: none; }
  ${m} { display: flex; }
}
`.trim();
  }
  // Only one variant → always show it.
  if (hasDesktop) return `${d} { display: flex; }`;
  if (hasMobile) return `${m} { display: flex; }`;
  return "";
}

export function LandingSection({ productId, desktop, mobile, variables }: Props) {
  const hasDesktop = !!(desktop.html && desktop.html.trim());
  const hasMobile = !!(mobile.html && mobile.html.trim());

  if (!hasDesktop && !hasMobile) return null;

  // Full-bleed escape: break out of the Webflow .container-large to render
  // at the variant's designed width (1280px desktop, 375px mobile). Display
  // is intentionally NOT set here — the switch `<style>` block below owns
  // it so media-query rules can override.
  const fullBleed: React.CSSProperties = {
    width: "100vw",
    marginLeft: "calc(50% - 50vw)",
    justifyContent: "center",
    overflowX: "clip",
  };

  const switchCss = buildSwitchCss(productId, hasDesktop, hasMobile);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: switchCss }} />
      {hasDesktop && (
        <section
          id="product-landing-d"
          className={`iwo-landing-${productId}`}
          aria-label="Conteúdo do produto — desktop"
          data-variant="desktop"
          style={fullBleed}
        >
          {desktop.css ? (
            <style dangerouslySetInnerHTML={{ __html: desktop.css }} />
          ) : null}
          <div
            style={{ flexShrink: 0 }}
            dangerouslySetInnerHTML={{
              __html: interpolateLandingHtml(desktop.html!, variables),
            }}
          />
        </section>
      )}
      {hasMobile && (
        <section
          id="product-landing-m"
          className={`iwo-landing-${productId}-m`}
          aria-label="Conteúdo do produto — mobile"
          data-variant="mobile"
          style={fullBleed}
        >
          {mobile.css ? (
            <style dangerouslySetInnerHTML={{ __html: mobile.css }} />
          ) : null}
          <div
            style={{ flexShrink: 0 }}
            dangerouslySetInnerHTML={{
              __html: interpolateLandingHtml(mobile.html!, variables),
            }}
          />
        </section>
      )}
    </>
  );
}
```

Export remains the named `LandingSection` — consumers of this file will continue to destructure the new prop shape. The default export (if any was present) is removed.

- [ ] **Step 2: Typecheck**

```bash
cd E:/IWO/iwo-watch.webflow/iwo-vercel
npx tsc --noEmit -p . 2>&1 | grep -E "LandingSection|error TS" | head -10
```

Expected: errors about `page.tsx` passing the OLD prop shape (`html`/`css`/`variables` flat). Those will be fixed in Task 9.

- [ ] **Step 3: Commit**

```bash
cd E:/IWO/iwo-watch.webflow
git add iwo-vercel/app/p/[slug]/LandingSection.tsx
git commit -m "feat(render): LandingSection dual-renders desktop+mobile with media switch"
```

---

## Task 9: `page.tsx` — pass both variants

**Files:**
- Modify: `iwo-vercel/app/p/[slug]/page.tsx`

- [ ] **Step 1: Replace the `<LandingSection>` call**

Find this block in `iwo-vercel/app/p/[slug]/page.tsx`:

```tsx
      {product.landingHtml ? (
        <LandingSection
          productId={product.id}
          html={product.landingHtml}
          css={product.landingCss}
          variables={landingVars}
        />
      ) : null}
```

Replace with:

```tsx
      <LandingSection
        productId={product.id}
        desktop={{ html: product.landingHtml, css: product.landingCss }}
        mobile={{
          html: product.landingMobileHtml,
          css: product.landingMobileCss,
        }}
        variables={landingVars}
      />
```

(Removed the outer ternary — `LandingSection` now returns `null` internally when neither variant has HTML.)

- [ ] **Step 2: Typecheck**

```bash
cd E:/IWO/iwo-watch.webflow/iwo-vercel
npx tsc --noEmit -p . 2>&1 | grep "error TS" | head -10
```

Expected: no errors. `product.landingMobileHtml` / `landingMobileCss` are typed thanks to Task 3's `REQUIRED_PRODUCT_FIELDS` additions.

- [ ] **Step 3: Manual render test**

With `next dev` running, hit `http://localhost:3000/p/iwo-w11-gps-2gb`. Verify:
- Page returns 200
- Desktop landing visible at viewport ≥ 769px
- Resize to ≤ 768px → desktop hides, nothing shows in its place (mobile not imported yet; expected behavior per fallback matrix)

- [ ] **Step 4: Commit**

```bash
cd E:/IWO/iwo-watch.webflow
git add iwo-vercel/app/p/[slug]/page.tsx
git commit -m "feat(render): page.tsx passes desktop+mobile variants to LandingSection"
```

---

## Task 10: `LandingManager.tsx` — two-card admin UI

**Files:**
- Modify: `iwo-vercel/app/admin/components/LandingManager.tsx`

- [ ] **Step 1: Update types + prompt builder**

Near the top of `iwo-vercel/app/admin/components/LandingManager.tsx`, replace the `LandingStatus` + `UiState` types and the `buildPrompt` function:

```ts
interface VariantStatus {
  figmaUrl: string | null;
  importedAt: string | null;
  hasHtml: boolean;
  hasCss: boolean;
  assetCount: number;
}

interface LandingStatus {
  desktop: VariantStatus;
  mobile: VariantStatus;
}

type UiState = 'loading' | 'ready' | 'error';
type Variant = 'desktop' | 'mobile';

function buildPrompt(
  productId: number,
  productSlug: string,
  figmaUrl: string,
  variant: Variant,
): string {
  const variantFlag = variant === 'mobile' ? ' --variant=mobile' : '';
  return `Importe o Figma ${figmaUrl} para a landing ${variant} do produto ${productSlug} (id: ${productId}).
Use o MCP plugin:figma:figma.
Rode: node scripts/figma-import-${productId}/import.mjs${variantFlag}`;
}

function emptyVariant(): VariantStatus {
  return { figmaUrl: null, importedAt: null, hasHtml: false, hasCss: false, assetCount: 0 };
}

function readVariant(raw: unknown): VariantStatus {
  if (!raw || typeof raw !== 'object') return emptyVariant();
  const v = raw as Record<string, unknown>;
  const manifest = v.assetManifest;
  const assetCount = Array.isArray(manifest)
    ? manifest.length
    : manifest && typeof manifest === 'object'
      ? Object.keys(manifest).length
      : 0;
  return {
    figmaUrl: (v.figmaUrl as string | null) ?? null,
    importedAt: (v.importedAt as string | null) ?? null,
    hasHtml: Boolean(typeof v.html === 'string' && v.html.length > 0),
    hasCss: Boolean(typeof v.css === 'string' && v.css.length > 0),
    assetCount,
  };
}
```

- [ ] **Step 2: Replace the `load` function + state**

Replace the `useState` block and `load` callback:

```ts
  const [uiState, setUiState] = useState<UiState>('loading');
  const [status, setStatus] = useState<LandingStatus | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deletingVariant, setDeletingVariant] = useState<Variant | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setUiState('loading');
    try {
      const res = await adminFetch(`/api/admin/products/${productId}/landing`);
      if (!res.ok) {
        setUiState('error');
        return;
      }
      const body = await res.json();
      setStatus({
        desktop: readVariant(body?.desktop),
        mobile: readVariant(body?.mobile),
      });
      setUiState('ready');
    } catch {
      setUiState('error');
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  async function copyPrompt(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Clipboard API can fail in insecure contexts — no-op.
    }
  }

  async function handleDeleteVariant(variant: Variant) {
    const confirmed = window.confirm(
      `Remover a landing ${variant}? Os assets no R2 permanecem (limpeza manual).`
    );
    if (!confirmed) return;

    setDeletingVariant(variant);
    setDeleteError('');
    try {
      const res = await adminFetch(
        `/api/admin/products/${productId}/landing?variant=${variant}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body?.error || `Erro ao remover landing ${variant}.`);
        return;
      }
      await load();
    } catch {
      setDeleteError('Erro de conexão ao remover.');
    } finally {
      setDeletingVariant(null);
    }
  }
```

Remove the OLD `emptyPrompt` / `reimportPrompt` `useMemo`s, old `copied` / `deleting` state, and old `handleDelete`.

- [ ] **Step 3: Replace the render**

Replace everything from `// ── Render ──` to the end of the component with:

```tsx
  if (uiState === 'loading') {
    return (
      <div style={s.wrap}>
        <h3 style={s.heading}>Landing personalizada</h3>
        <div style={s.loadingText}>Carregando status da landing...</div>
      </div>
    );
  }

  if (uiState === 'error' || !status) {
    return (
      <div style={s.wrap}>
        <h3 style={s.heading}>Landing personalizada</h3>
        <div style={s.err}>
          <span>Não foi possível carregar o status da landing.</span>
          <button type="button" onClick={load} style={s.errBtn}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  function renderCard(variant: Variant, v: VariantStatus) {
    const label = variant === 'desktop' ? '💻 Desktop' : '📱 Mobile';
    const hasContent = v.hasHtml || v.figmaUrl;
    const importedAtRel = v.importedAt ? formatRelativeTimeBR(v.importedAt) : '';
    const prompt = buildPrompt(
      productId,
      productSlug,
      v.figmaUrl || '<URL_AQUI>',
      variant,
    );
    const copyKey = `prompt:${variant}`;

    return (
      <div style={s.card} key={variant}>
        <div style={s.cardLabel}>{label}</div>
        {hasContent ? (
          <>
            <div style={s.cardValue}>
              {v.figmaUrl ? (
                <a href={v.figmaUrl} target="_blank" rel="noopener noreferrer" style={s.link}>
                  Abrir no Figma
                </a>
              ) : (
                <span style={{ color: '#666' }}>—</span>
              )}
              <div style={{ color: '#666', marginTop: 6, fontSize: 12 }}>
                Última importação: {importedAtRel || '—'}
              </div>
              <div style={{ color: '#666', marginTop: 2, fontSize: 12 }}>
                {v.assetCount} asset(s) no R2 · HTML {v.hasHtml ? '✓' : '✗'} · CSS{' '}
                {v.hasCss ? '✓' : '✗'}
              </div>
            </div>
            <div style={s.actions}>
              <button type="button" style={s.btn} onClick={() => copyPrompt(copyKey, prompt)}>
                Reimportar (copiar prompt)
              </button>
              {copiedKey === copyKey && <span style={s.copyOk}>Copiado!</span>}
              <button
                type="button"
                style={{ ...s.btnDanger, opacity: deletingVariant === variant ? 0.7 : 1 }}
                onClick={() => handleDeleteVariant(variant)}
                disabled={deletingVariant !== null}
              >
                {deletingVariant === variant ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ ...s.cardValue, color: '#666', marginBottom: 8 }}>
              Ainda não importada.
            </div>
            <div style={s.promptBox}>{prompt}</div>
            <div style={s.actions}>
              <button type="button" style={s.copyBtn} onClick={() => copyPrompt(copyKey, prompt)}>
                Copiar prompt
              </button>
              {copiedKey === copyKey && <span style={s.copyOk}>Copiado!</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <h3 style={s.heading}>Landing personalizada</h3>
      <p style={s.sub}>
        Duas variantes independentes: desktop (≥ 769px) e mobile (≤ 768px). Cada uma é
        importada via Claude Code com o MCP do Figma autenticado.
      </p>
      <div style={s.grid2}>
        {renderCard('desktop', status.desktop)}
        {renderCard('mobile', status.mobile)}
      </div>
      <div style={s.actions}>
        <a
          href={`/p/${productSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={s.btnPrimary}
        >
          Ver preview
        </a>
      </div>
      {deleteError && (
        <div style={{ ...s.err, marginTop: 12 }}>
          <span>{deleteError}</span>
        </div>
      )}
    </div>
  );
}
```

(The closing `}` belongs to the component — don't forget it.)

Remove the old `<details>` expand block and the 3-column actions — replaced by per-card actions above.

- [ ] **Step 4: Smoke-test the UI locally**

Load `http://localhost:3000/admin`, log in, navigate to `/admin/produtos/26`. Verify:
- Two cards side-by-side: Desktop (should show imported) + Mobile (should show "Ainda não importada")
- Each card has its own "Copiar prompt" button
- Clicking "Remover" on Desktop asks for confirmation, references only desktop
- Network tab shows `DELETE /api/admin/products/26/landing?variant=desktop` (don't actually confirm — cancel)

- [ ] **Step 5: Commit**

```bash
cd E:/IWO/iwo-watch.webflow
git add iwo-vercel/app/admin/components/LandingManager.tsx
git commit -m "feat(admin): LandingManager renders desktop+mobile cards"
```

---

## Task 11: Full stack smoke test

No code changes — just end-to-end verification of what's been wired.

- [ ] **Step 1: Re-import desktop with the new pipeline**

```bash
cd E:/IWO/iwo-watch.webflow/iwo-vercel
node scripts/figma-import-26/import.mjs 2>&1 | tail -15
```

Expected:
- `PATCH 200`
- `[r2] ...` lines show keys under `landing/26/desktop/<uuid>.<ext>`
- `artifacts/desktop/*.html`, `*.css` written

- [ ] **Step 2: Confirm desktop landing still renders**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/p/iwo-w11-gps-2gb"
```

Expected: `200`. Open in browser, confirm design is identical to pre-refactor state.

- [ ] **Step 3: Fallback check (no mobile imported yet)**

In devtools, resize to ≤ 768px. Expected: desktop section hides; no content in its place (mobile variant is null, so its `<section>` isn't rendered). Resize back up — desktop returns.

- [ ] **Step 4: Admin status check**

Navigate to `/admin/produtos/26`. Expected:
- Desktop card: "Abrir no Figma" link + recent `Última importação` timestamp
- Mobile card: "Ainda não importada" + copyable prompt with `--variant=mobile`

- [ ] **Step 5: Commit verification notes (optional)**

No commit needed — this step is pure verification. Skip.

---

## Task 12: Document how to author + import the mobile frame

**Files:**
- (no code changes; this is a doc-touch task)

- [ ] **Step 1: Add a short note in the script README**

Check for an existing README at `scripts/figma-import-26/README.md`. If missing, skip this step — the memory notes + plan doc already cover the workflow. If present, add a "Mobile variant" section describing:

```
## Importing a mobile variant

1. In Figma, create a new frame (375×N) with the mobile design (same node structure
   as the desktop, but sized for iPhone portrait). Can be in the same file or
   different — what matters is the node ID.
2. Capture JSX via MCP `get_design_context` and save to
   `scripts/figma-import-26/source.mobile.jsx`.
3. Update FRAME_HEIGHT in `import.mjs` (the constant is a placeholder — refine to
   the actual mobile frame height from `get_metadata`).
4. Run: `node scripts/figma-import-26/import.mjs --variant=mobile`
5. Verify in the admin panel (`/admin/produtos/26`) that the Mobile card flips to
   "imported" with a fresh timestamp.
```

- [ ] **Step 2: Deploy to production**

```bash
cd E:/IWO/iwo-watch.webflow
git push origin main
```

Expected: Vercel auto-deploys. Build runs `prisma generate && next build` — the client now knows the new mobile columns, so the existing `/p/[slug]` continues to work and the new admin GET returns the `{ desktop, mobile }` shape.

- [ ] **Step 3: Confirm production**

After Vercel build finishes (~2–4 min), curl:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://iwowatch.com.br/p/iwo-w11-gps-2gb"
```

Expected: `200`. Open the URL, verify the landing renders the same as local.

- [ ] **Step 4: Done**

No further commits needed. The plan is complete.

---

## Self-Review

**Spec coverage:**
- Section 1 (Schema): Task 1 ✓
- Section 2 (Import pipeline): Tasks 5, 6, 7 ✓
- Section 3 (Admin API): Task 4 ✓
- Section 4 (Admin UI): Task 10 ✓
- Section 5 (Public render + CSS switch): Tasks 8, 9 ✓
- Fallback matrix: handled inside `buildSwitchCss` (Task 8) ✓
- Breakpoint 768px: `MOBILE_BREAKPOINT` constant in LandingSection (Task 8) ✓
- Mobile width 375px: `FRAME_WIDTH` branch in import.mjs (Task 6) ✓
- `scopeLandingCss` variant param: Task 2 ✓
- Rename `source.jsx` → `source.desktop.jsx`: Task 6 Step 1 ✓
- `REQUIRED_PRODUCT_FIELDS` includes mobile cols: Task 3 ✓

**Placeholder scan:** All code blocks contain actual code. No "TBD"/"TODO"/"similar to" references. FRAME_HEIGHT is documented as a placeholder for mobile with a clear "refine from get_metadata" instruction — acceptable because the first mobile import will establish the real value.

**Type consistency:**
- `Variant` type is `'desktop' | 'mobile'` in both `route.ts` (Task 4) and `LandingManager.tsx` (Task 10) ✓
- `scopeLandingCss` signature: `(raw, productId, variant?)` in Task 2, called with 3-arg in Task 4 ✓
- `mirrorAssetsToR2({ assets, productId, variant })` in Task 5, called with all 3 in Task 6 ✓
- `LandingSection` props shape `{ desktop, mobile, variables, productId }` in Task 8, passed correctly in Task 9 ✓

No gaps found.
