# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repo hosts two coexisting stacks:

- **Repo root** (`/`) — legacy Webflow static export (HTML/CSS/JS in `account/`, `blog/`, `product/`, `css/`, `js/`, `images/`, etc.) plus one-off Node scripts (`import-products.mjs`, `products.csv`). The root `package.json` only carries dependencies for those import scripts; it is **not** the application.
- **`iwo-vercel/`** — the live Next.js 16 + React 19 application. All app commands run from here. The static Webflow HTML pages have been copied into `iwo-vercel/public/` and are exposed at clean URLs via `next.config.ts` rewrites.

When working on the site, assume you are in `iwo-vercel/` unless a task explicitly targets the legacy tree.

## Critical: Next.js version

`iwo-vercel/AGENTS.md` (and the app-level `CLAUDE.md` which references it) declares:

> **This is NOT the Next.js you know.** APIs, conventions, and file structure may differ from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Concrete deviations already in the repo (do not "fix" them):

- The request-time middleware file is `iwo-vercel/proxy.ts`, **not** `middleware.ts`.
- Route handlers use the Web `Response` / `Request` types directly (no `NextResponse.json` unless a redirect is needed).
- Dynamic-route params are async: `{ params }: { params: Promise<{ slug: string }> }` — you must `await params`.
- Prisma 7 uses driver adapters: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`. There is no built-in query engine. Datasource URL lives in `prisma.config.ts`, not in `schema.prisma`.

## Commands

All run from `iwo-vercel/`:

```bash
npm install          # postinstall runs `prisma generate`
npm run dev          # Next dev server on :3000
npm run build        # Next production build
npm run start        # serve the production build
npm run lint         # eslint (eslint-config-next flat config)
```

Prisma (requires `POSTGRES_URL_NON_POOLING` in `.env.local`):

```bash
npx prisma generate
npx prisma db push               # push schema.prisma to Neon
npx prisma studio                # inspect DB
```

No test framework is configured. Do not add one without asking.

## Architecture

### Database — Neon Postgres via Prisma 7

Canonical schema: `iwo-vercel/prisma/schema.prisma`. Most tables were introspected from a pre-existing Neon DB; snake_case columns are mapped to camelCase models via `@map`. Legacy string fields (`orders.status`, `orders.mp_status`) are intentionally kept as `String` (validated at the app layer) to avoid destructive migrations against historical rows — **don't convert them to enums**.

Client is instantiated in `app/lib/prisma.ts` with a global singleton pattern. It prefers the pooled `POSTGRES_URL` and falls back to `POSTGRES_URL_NON_POOLING` / `DATABASE_URL`.

### Two separate auth systems

1. **Customer auth** — NextAuth v5 beta (Auth.js). Configured in `app/lib/auth.ts` with the Prisma adapter, JWT sessions, and a Credentials provider (bcrypt-hashed `User.passwordHash`). The middleware in `proxy.ts` protects `/conta/*` except public auth pages. Throws typed errors (`EmailNotVerifiedError`, `InvalidCredentialsError`) that the login UI discriminates on.
2. **Admin auth** — custom HS256 JWT signed with `ADMIN_JWT_SECRET`. Admin clients send `Authorization: Bearer <jwt>` and every `/api/admin/*` handler calls `guardAdmin(request)` from `app/admin/lib/verify.ts`. Password check uses `ADMIN_PASSWORD_HASH` (bcrypt), falling back to legacy plaintext `ADMIN_PASSWORD`.

Do not conflate the two — customer `User`/`Customer` rows live alongside a single admin identity that has no DB representation.

### Routing conventions

- `next.config.ts` maintains two maps:
  - `STATIC_PAGE_MAP` — rewrites clean URLs (`/loja`, `/carrinho`, `/checkout`, institutional pages, hardcoded product URLs) to `.html` files in `public/`. Dynamic app-router routes win over these rewrites; when a page migrates to `app/*`, delete its entry here.
  - `LEGACY_ACCOUNT_REDIRECTS` — permanent 301s from old Shopify/Smootify `/account/*` paths to the new `/conta/*` tree.
- The product detail route `app/p/[slug]/page.tsx` reads `public/templates/product.html` (a Webflow export), splits it at `<section class="section-14">`, and splices the DB-backed landing between the two halves. It strips trailing `</body></html>` from the second half to avoid React 19 "invalid HTML nesting" hydration errors inside `dangerouslySetInnerHTML`.

### Product landing pipeline (Figma → DB → page)

High-effort area; read these together before modifying:

- `app/lib/landing-pipeline.ts` — `sanitizeLandingHtml` (DOMPurify allowlist), `scopeLandingCss` (PostCSS `postcss-prefix-selector` scoping every rule under `.iwo-landing-<productId>`, with `:where()`-based resets left alone), and `interpolateLandingHtml` (`{{key}}` token replacement with HTML escaping).
- `app/lib/landing-placeholders.mjs` — single source of truth mapping Figma literal strings (e.g. `{Nome do Produto}`) to interpolation keys (e.g. `name`). Imported by both the runtime and the import script.
- `app/lib/landing-vars.ts` — `REQUIRED_PRODUCT_FIELDS` (Prisma `select` used by the `/p/[slug]` loader) and `buildLandingVars(product)` (flattens a Product row into the vars object consumed by `interpolateLandingHtml`).
- `app/p/[slug]/LandingSection.tsx` — renders the already-sanitized HTML and already-scoped CSS. **Contract: do not re-sanitize or re-scope here.** The server component performs interpolation only, then full-bleeds the fixed-width (1280px) Figma frame via inline `width: 100vw; margin-left: calc(50% - 50vw); overflow-x: clip`. `overflow-x: clip` is deliberate — `hidden` would coerce `overflow-y: auto` and create a mousewheel trap.
- `scripts/figma-import-26/import.mjs` — end-to-end importer: parses captured JSX, mirrors assets to R2 under `landing/<productId>/<uuid>.<ext>`, JIT-compiles Tailwind v4 over collected class tokens, scopes CSS, sanitizes HTML, swaps Figma placeholders to `{{token}}` form, and PATCHes `/api/admin/products/<id>/landing`. Note: this folder ships its own `CLAUDE.md`, but it is auto-generated boilerplate from an external tool (ruflo/claude-flow) and does **not** reflect house rules — treat only the pipeline code there as authoritative.

### Checkout + MercadoPago

- `app/api/checkout/route.ts` — **always re-prices server-side**. Client-submitted `price`/`total` are ignored; unit prices come from `ProductVariant.price` (falling back to `Product.price`). Products with `archived=true` or `draft=true` are rejected. An `Order` + `OrderItem` rows are created before calling MP so `external_reference = "order_<id>"` can be set; Pix and boleto responses surface QR/barcode data.
- `app/api/webhook/mercadopago/route.ts` — v2 signed notifications. Manifest is `id:${dataId};request-id:${requestId};ts:${ts};`; `v1` HMAC-SHA256 is compared with `timingSafeEqual` against a hex-decoded buffer. **Fails closed** on missing `MP_WEBHOOK_SECRET` (503). MP statuses map to internal via `mapMpToInternal` (`approved → paid`, `rejected → failed`, etc.).

### File uploads — Cloudflare R2

`app/lib/r2.ts` builds presigned PUT URLs via the AWS S3 SDK against R2's S3-compatible endpoint. `createPresignedUpload` is overloaded: the legacy `(productId, fileName, contentType)` form derives `products/<id>/<uuid>.<ext>`; the object form `({ key, contentType })` lets callers (landing asset import) choose their own key. `R2_PUBLIC_URL` is the CDN base used to build the returned `publicUrl`.

### Email — Resend

`app/lib/email.ts` wraps Resend. If `RESEND_API_KEY` is empty (local dev), messages are logged to stdout instead of sent. Templates live in `app/lib/email-templates.ts`. Every send is logged to `EmailLog`.

## Environment

Copy `iwo-vercel/.env.example` to `iwo-vercel/.env.local` for local dev. Required groups: admin JWT (`ADMIN_JWT_SECRET`, `ADMIN_PASSWORD_HASH`), MercadoPago (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`), Postgres (`POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`), R2 (`R2_*`), NextAuth (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST`), and Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`).

`prisma.config.ts` explicitly calls `dotenv.config({ path: '.env.local' })` so Prisma CLI picks up Neon creds.

## Conventions to preserve

- Path alias `@/*` resolves from the `iwo-vercel/` root (e.g. `@/app/lib/prisma`).
- Portuguese (pt-BR) is the user-facing language; routes like `/conta`, `/produtos`, `/carrinho` are customer-visible and must not be anglicized.
- Store Prisma `Decimal` values as `Decimal(10, 2)` and coerce to `number` at the edges (see `shapeProduct` in `app/api/admin/products/[id]/route.ts` and `decimalToNumber` in the checkout handler).
- When adding or changing API routes that write to the DB, handle `Prisma.PrismaClientKnownRequestError` with specific mappings for `P2025` (404) and `P2002` (409), matching the checkout handler's pattern.
