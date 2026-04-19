# Mobile landing variant (CSS-only switch) — Design

Adds a second Figma-imported landing variant per product, rendered at `viewport ≤ 768px`. Mirrors the existing desktop landing end-to-end (schema, import pipeline, admin UI, render). Switching between variants is CSS-only (both HTMLs shipped, `display: none` toggles on media query) — no JS, no user-agent detection, no hydration flicker.

## Summary

Current state: each `Product` has **one** Figma-imported landing (`landingHtml` / `landingCss` / …) pinned to `width: 1280px`. Below ~768px the design overflows or center-clips.

Target state: each `Product` can have **up to two** Figma-imported landings — a desktop variant (1280px) and a mobile variant (375px). The public product page ships both in the same response; a short media-query stylesheet shows/hides them by viewport width.

Unchanged: import is dev-time via Claude Code + Figma MCP (see `project_iwo_watch_figma_landings.md`). Admin UI only displays status; no production Figma API calls.

## 1. Schema (Prisma)

Add five mirror columns to `Product`:

```prisma
landingMobileFigmaUrl      String?   @map("landing_mobile_figma_url") @db.VarChar(500)
landingMobileHtml          String?   @map("landing_mobile_html") @db.Text
landingMobileCss           String?   @map("landing_mobile_css") @db.Text
landingMobileAssetManifest Json?     @map("landing_mobile_asset_manifest") @db.JsonB
landingMobileImportedAt    DateTime? @map("landing_mobile_imported_at")
```

Rejected alternative: single JSON column `{ desktop: {...}, mobile: {...} }`. Loses Prisma's per-field validation and indexability; unbounded growth if we add breakpoints later.

## 2. Import pipeline

Single script at `scripts/figma-import-<id>/import.mjs` accepts a variant flag:

```bash
node scripts/figma-import-26/import.mjs                  # desktop (existing default)
node scripts/figma-import-26/import.mjs --variant=mobile
```

Per-variant files in the same folder:

```
scripts/figma-import-26/
  source.desktop.jsx       # was: source.jsx — renamed
  source.mobile.jsx        # new
  import.mjs               # reads correct source based on --variant
  lib/...                  # shared
```

Variant-aware behavior inside `import.mjs`:

- **R2 key prefix**: `landing/<id>/<variant>/<uuid>.<ext>`
- **Scope class**: `.iwo-landing-<id>-d` for desktop, `.iwo-landing-<id>-m` for mobile
- **Root inline-style pin**: `width: 1280px; height: <frame>px` (desktop) vs `width: 375px; height: <frame>px` (mobile)
- **Artifacts dir**: `artifacts/desktop/` / `artifacts/mobile/`
- **PATCH body**: adds `variant: 'desktop' | 'mobile'` field

The `resume-patch.mjs` script gains the same flag and routes artifacts to the correct directory.

Rejected alternative: duplicate `scripts/figma-import-26-mobile/`. Duplicates `lib/`, doubles maintenance surface, worse DX.

## 3. Admin API

`/api/admin/products/[id]/landing` route accepts the `variant` discriminator on PATCH and DELETE and returns both on GET.

- **GET**: response shape becomes `{ desktop: {...}, mobile: {...} }` each carrying `{ figmaUrl, html, css, assetManifest, importedAt }`.
- **PATCH**: body's `variant` field selects which set of five columns to write. `variant: 'desktop'` (or omitted, for backward compat) writes the existing columns; `variant: 'mobile'` writes the new mobile columns.
- **DELETE**: accepts `?variant=desktop|mobile` query param. Omitted → clears both.
- Server-side `sanitizeLandingHtml` and `scopeLandingCss` unchanged except `scopeLandingCss` gains a `variant` arg so the auto-applied prefix matches what the import pipeline emitted (`.iwo-landing-<id>-d|m`).

## 4. Admin UI

`app/admin/components/LandingManager.tsx` becomes a two-card layout — Desktop and Mobile side-by-side — each independently showing status + actions.

- Fetches new `{ desktop, mobile }` shape from GET.
- Each card shows: importado? / importedAt / figmaUrl / "Abrir Figma" link / "Limpar esta variante" button.
- If a variant is missing, the card shows a copyable CLI hint: `node scripts/figma-import-<id>/import.mjs --variant=<variant>`.
- Import is NOT triggered from the admin UI — remains a dev-time Claude-mediated flow (consistent with current desktop behavior).

Rejected alternative: desktop/mobile tabs. At-a-glance status across both variants matters more than screen density.

The product edit page (`/admin/produtos/[id]/page.tsx`) is unchanged — still renders `<LandingManager productId={id} />`.

## 5. Public render + CSS switch

`/p/[slug]/page.tsx` selects both variants and passes them:

```tsx
<LandingSection
  productId={product.id}
  desktop={{ html: product.landingHtml, css: product.landingCss }}
  mobile={{ html: product.landingMobileHtml, css: product.landingMobileCss }}
  variables={landingVars}
/>
```

`LandingSection` renders TWO sibling `<section>` wrappers — one per variant — each self-contained (own scope class, own inlined CSS, own full-bleed escape). A tiny injected `<style>` block toggles `display` by viewport:

```css
.iwo-landing-<id>-d { display: block; }
.iwo-landing-<id>-m { display: none; }
@media (max-width: 768px) {
  .iwo-landing-<id>-d { display: none; }
  .iwo-landing-<id>-m { display: block; }
}
```

Width of the inner Figma root is driven by the inline `style` the import pipeline pinned on the outer `<div>` — 1280px for desktop, 375px for mobile. `LandingSection`'s full-bleed wrapper carries only `width: 100vw; margin-left: calc(50% - 50vw); display: flex; justify-content: center; overflow-x: clip` and does NOT set inner width.

### Breakpoint

**768px** (standard mobile/tablet cutoff). Hardcoded as a `MOBILE_BREAKPOINT` constant in `LandingSection` — easy to change, out of scope to make configurable per-product.

### Mobile Figma frame width

**375px** (iPhone portrait) as the default. Decided up-front because the pipeline must pin it in the root's inline style at import time (Figma's `size-full` root collapses otherwise — see `feedback_figma_mcp_export_patterns.md`).

### Fallback matrix

| `landingHtml` | `landingMobileHtml` | Behavior |
|---|---|---|
| set | set | Switch via media query (happy path) |
| set | null | Desktop shown at every viewport; switch styles collapse `display: none` rule for mobile |
| null | set | Mobile shown at every viewport; switch styles collapse `display: none` rule for desktop |
| null | null | No `<section>` rendered (current behavior) |

In the single-variant cases, the switch styles emit only the rules needed — no media query at all, so the present variant is never hidden.

### CSS scoping collision

The two scoped stylesheets use distinct class prefixes (`.iwo-landing-<id>-d` vs `.iwo-landing-<id>-m`). The existing `scopeLandingCss` continues to prefix every selector and skip selectors already starting with `:where(.iwo-landing-<id>-<v>)`. A cosmetic consequence: R2 asset URLs and the `landing/<id>/<variant>/` path prefix are now per-variant — variants don't share asset blobs.

## Out of scope

- Responsive redesign of the desktop frame (we're still serving pixel-perfect, desktop-only per variant).
- Automatic generation of the mobile frame from the desktop one (Figma MCP doesn't do this — user creates the mobile frame manually).
- A tablet breakpoint (iPad ≥ 768px falls into the desktop bucket today — if we need tablet later, add it as a third variant).
- Admin-driven import (still dev-time Claude + MCP, infrequent).

## Migration

Database columns added via `prisma db push` against Neon (schema.prisma already matches production pattern). No data migration needed — all existing products keep their desktop landing; mobile columns default to null.

Existing `scripts/figma-import-26/source.jsx` gets renamed to `source.desktop.jsx` as part of the import-pipeline refactor.

## Non-goals acknowledged

- We're not eliminating the jsdom import from the admin PATCH path (`landing-pipeline.ts`) — only `/p/[slug]` was isolated from it. Keep as-is.
- We're not adding variant-aware metadata/OG images. The OG image stays `product.image` regardless of variant.
