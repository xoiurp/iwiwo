// End-to-end Figma→landing import for product 26 (iwo-w11-gps-2gb).
// Pipeline (matches the brief in the session prompt):
//   1. Parse captured JSX (scripts/figma-import-26/source.jsx).
//   2. Mirror every Figma MCP asset into R2 at `landing/26/<uuid>.<ext>`.
//   3. Emit HTML via AST walker, rewriting asset URLs to their R2 equivalents.
//   4. Compile Tailwind v4 JIT over the collected class tokens.
//   5. Scope CSS with `.iwo-landing-26`.
//   6. Sanitize HTML with DOMPurify.
//   7. Swap placeholders `{Nome do Produto}` → `{{name}}`, etc.
//   8. PATCH /api/admin/products/26/landing with { figmaUrl, html, css, assetManifest }.

import 'dotenv/config';
import dotenv from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { SignJWT } from 'jose';
import DOMPurify from 'isomorphic-dompurify';
import postcss from 'postcss';
import prefixer from 'postcss-prefix-selector';

import {
  jsxToHtml,
  collectClassTokens,
  extractAssetMap,
} from './lib/jsx-to-html.mjs';
import { mirrorAssetsToR2, rewriteAssetUrls } from './lib/r2-mirror.mjs';
import { compileTailwind } from './lib/tailwind-compile.mjs';
import {
  PLACEHOLDER_MAP,
  FIGMA_TOKEN_RE,
} from '../../app/lib/landing-placeholders.mjs';

// Re-load env from .env.local (Next.js does this natively, but our script
// runs outside Next's env loader).
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');
dotenv.config({ path: join(projectRoot, '.env.local'), override: false });

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

// ── Config ───────────────────────────────────────────────────────────────────
const PRODUCT_ID = 26;
const FIGMA_URL =
  'https://www.figma.com/design/V5L6H0bq5bgM362Lclwbdd/Apple-Landing-Page-Prototype--Community-?node-id=103-952&t=xdUK5HQcl5SxWFK5-11';
const API_BASE = process.env.IWO_API_BASE || 'http://localhost:3000';
const SCOPE = `.iwo-landing-${PRODUCT_ID}${VARIANT === 'mobile' ? '-m' : ''}`;

// Matches the admin landing-pipeline allowlist.
const SANITIZE_OPTS = {
  ALLOWED_TAGS: [
    'div','span','section','article','header','footer','main','nav','aside',
    'p','a','h1','h2','h3','h4','h5','h6',
    'ul','ol','li','dl','dt','dd',
    'strong','em','b','i','u','s','mark','small','sub','sup','blockquote','cite','code','pre','hr','br',
    'img','picture','source','figure','figcaption',
    'video','audio','track',
    'table','thead','tbody','tfoot','tr','td','th','caption',
    'style',
    'details','summary','time',
  ],
  ALLOWED_ATTR: [
    'href','src','srcset','sizes','alt','title','class','id','style','rel','target','loading','decoding',
    'width','height','type','media','controls','poster','preload','playsinline','autoplay','muted','loop',
    'role',
  ],
  FORBID_TAGS: ['script','iframe','object','embed','form','input','button','select','textarea','link','meta','base'],
  FORBID_ATTR: [
    'onerror','onload','onclick','onmouseover','onfocus','onblur','onchange','oninput','onsubmit','onreset',
    'onkeydown','onkeyup','onkeypress','onanimationstart','onanimationend','ontransitionend',
    'onpointerdown','onpointerup','onpointermove','onwheel','onscroll','oncontextmenu',
  ],
  ALLOW_DATA_ATTR: true,
  ADD_ATTR: ['target'],
  USE_PROFILES: { html: true },
};

// ── Pipeline ─────────────────────────────────────────────────────────────────
async function main() {
  const sourcePath = join(__dirname, `source.${VARIANT}.jsx`);
  const artifactsDir = join(__dirname, 'artifacts', VARIANT);
  mkdirSync(artifactsDir, { recursive: true });

  const source = readFileSync(sourcePath, 'utf8');

  // [1] Walk JSX → HTML + extract assets + collect classes.
  console.log('[1/7] Parsing JSX and extracting assets…');
  let htmlRaw = jsxToHtml(source, { stripDataAttrs: true });

  // Pin the Figma root to its intrinsic frame size (1280×4794). The export
  // uses `size-full` on the root, which relies on a sized parent, but all
  // descendants are absolutely-positioned, so with no sized parent the root
  // collapses to 0 and the whole landing disappears. We inject an inline
  // `width/height/flex-shrink` into the existing `style=""` attribute on
  // the opening root tag. Inline style survives CSS scoping and beats any
  // class-based size rule.
  const FRAME_WIDTH = VARIANT === 'mobile' ? 390 : 1280;
  // Heights captured via `mcp__plugin_figma_figma__get_metadata` on each
  // variant's root node. Update when the Figma frame intrinsic height
  // changes (common during design iteration).
  const FRAME_HEIGHT = VARIANT === 'mobile' ? 3789 : 4698;

  // Wrap the Figma HTML in an outer pin div with the frame's intrinsic
  // size. Needed because the Figma export uses `size-full` on its root —
  // a 100%×100% declaration that collapses to 0 without a sized parent.
  // Wrapping is more robust than the previous inline-style injection
  // regex: that approach only matched a specific root signature
  // (`<div class="relative size-full" style="...">`) and silently failed
  // on mobile frames whose roots use different class combinations.
  htmlRaw = `<div style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px;flex-shrink:0">${htmlRaw}</div>`;

  // Strip `whitespace-nowrap` ONLY from the immediate wrapper `<div>` of
  // placeholders that can hold long dynamic text. Figma sizes each text
  // wrapper to fit the (short) placeholder literal with nowrap, which
  // breaks when the substituted value is longer — those specific wrappers
  // need to allow wrapping. Leave nowrap intact everywhere else so short
  // labels (ORIENTAÇÃO, button text, etc.) keep their single-line layout.
  {
    const longTextPlaceholders = [
      '{Descrição curta do produto}',
      '{Descrição longa do produto}',
    ];
    for (const ph of longTextPlaceholders) {
      let searchFrom = 0;
      while (true) {
        const phIdx = htmlRaw.indexOf(ph, searchFrom);
        if (phIdx === -1) break;
        const pTagStart = htmlRaw.lastIndexOf('<p', phIdx);
        if (pTagStart === -1) { searchFrom = phIdx + ph.length; continue; }

        // Walk back past whitespace to the preceding `<div ...>` close `>`.
        let pos = pTagStart;
        while (pos > 0 && /\s/.test(htmlRaw[pos - 1])) pos--;
        if (htmlRaw[pos - 1] !== '>') {
          searchFrom = phIdx + ph.length; continue;
        }
        const divEnd = pos - 1;
        const divStart = htmlRaw.lastIndexOf('<div', divEnd);
        if (divStart === -1) { searchFrom = phIdx + ph.length; continue; }

        const divTag = htmlRaw.slice(divStart, divEnd + 1);
        const cleanedDivTag = divTag
          .replace(/ whitespace-nowrap(?=[ "])/g, '')
          .replace(/whitespace-nowrap /g, '')
          .replace(/"whitespace-nowrap"/g, '""');
        if (cleanedDivTag !== divTag) {
          htmlRaw = htmlRaw.slice(0, divStart) + cleanedDivTag + htmlRaw.slice(divEnd + 1);
          searchFrom = divStart + cleanedDivTag.length;
        } else {
          searchFrom = phIdx + ph.length;
        }
      }
    }
  }

  const classTokens = collectClassTokens(htmlRaw);
  const assets = extractAssetMap(source);
  console.log(`      html=${htmlRaw.length}B  classes=${classTokens.length}  assets=${Object.keys(assets).length}`);
  writeFileSync(join(artifactsDir, '1-html-raw.html'), htmlRaw);

  // [2] Mirror assets to R2 via direct S3Client (checksum-compat with R2).
  console.log('[2/7] Mirroring assets to R2 (landing/26/…)…');
  const mapping = await mirrorAssetsToR2({ assets, productId: PRODUCT_ID, variant: VARIANT });
  writeFileSync(
    join(artifactsDir, '2-asset-mapping.json'),
    JSON.stringify(mapping, null, 2),
  );

  // [3] Rewrite asset URLs in HTML.
  console.log('[3/7] Rewriting asset URLs in HTML…');
  const htmlRewritten = rewriteAssetUrls(htmlRaw, mapping);
  writeFileSync(join(artifactsDir, '3-html-rewritten.html'), htmlRewritten);

  // [4] Compile Tailwind JIT.
  console.log('[4/7] Compiling Tailwind v4 JIT…');
  const tailwindCssLayered = compileTailwind({ classTokens, cwd: projectRoot });

  // Strip `@layer name { … }` wrappers from the output. Tailwind v4 emits
  // its utilities inside `@layer utilities` (and base/theme inside their
  // own layers).  CSS cascade layers have an absolute rule: UNLAYERED
  // rules beat LAYERED rules regardless of specificity or declaration
  // order. The Webflow template's CSS (/css/webflow.css, /css/normalize.css)
  // is entirely unlayered — so every utility class we emit loses to any
  // matching Webflow element selector, even though the utility has much
  // higher specificity.
  //
  // Unlayering Tailwind puts it back on the same cascade plane as Webflow,
  // at which point Tailwind's utility specificity (0,2,0 after scoping)
  // beats Webflow's element selectors (0,0,1) cleanly. @property atrules
  // (for Tailwind's registered CSS properties) and @keyframes / @media /
  // @supports are preserved.
  const tailwindRoot = postcss.parse(tailwindCssLayered);
  tailwindRoot.walkAtRules('layer', (atRule) => {
    if (!atRule.nodes) {
      atRule.remove(); // `@layer a, b, c;` declaration — drop it
    } else {
      atRule.replaceWith(atRule.nodes); // `@layer foo { ... }` — unwrap
    }
  });
  const tailwindCss = tailwindRoot.toString();
  console.log(`      css raw=${tailwindCss.length}B (unlayered)`);

  // Pre-scoped reset using `:where(.iwo-landing-26)` so each selector's
  // specificity is (0, 0, 1) — just the element selector, because
  // `:where()` contributes 0.
  //
  // Why this specific shape:
  //   - Webflow's `p { margin: 10px 0; font-size: 16px }` is UNLAYERED.
  //     Unlayered rules beat layered ones in the cascade regardless of
  //     specificity, so `@layer base {}` wrapping does NOT work here — an
  //     unlayered reset is required.
  //   - Tailwind v4 generates utility classes inside `@layer utilities`.
  //     At (0, 0, 1) we lose to every utility class (0, 1, 0 or more), so
  //     Tailwind's `.text-[12px]`, `.leading-[72px]`, etc. still win when
  //     present on the element.
  //   - At (0, 0, 1) we tie with Webflow's `p { ... }`, but we declare
  //     later in the cascade → we win.
  //
  // Selectors here are already prefixed with :where(.iwo-landing-26); we
  // concatenate them AFTER the scoped Tailwind output below and rely on
  // the server's scopeLandingCss (landing-pipeline.ts) to skip selectors
  // that already start with `:where(.iwo-landing-...)`.
  const resetCss = `
/* landing reset — unlayered, :where()-scoped, specificity (0,0,1) */
:where(${SCOPE}) p,
:where(${SCOPE}) span,
:where(${SCOPE}) blockquote,
:where(${SCOPE}) cite,
:where(${SCOPE}) figcaption,
:where(${SCOPE}) dl,
:where(${SCOPE}) dt,
:where(${SCOPE}) dd,
:where(${SCOPE}) ul,
:where(${SCOPE}) ol,
:where(${SCOPE}) li {
  margin: 0;
  padding: 0;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  color: inherit;
  font-family: inherit;
  text-align: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
}
:where(${SCOPE}) a { color: inherit; text-decoration: none; }

/* Cut the host page's text-align inheritance at the root: the Webflow
   product template has \`text-align: center\` on some ancestor
   (.section-especs / .container-large area), and because text-align is
   an inherited property, every descendant of the landing that doesn't
   explicitly override it ends up centered. Setting text-align: start at
   the scope root pins the default to left (for LTR), and Tailwind's
   \`text-center\` / \`text-right\` utilities still win where they're
   applied on a specific element. */
${SCOPE} { text-align: start; }

/* Webflow's \`/css/webflow.css\` defines global class names that COLLIDE
   with Tailwind utility class names, e.g.:
     .flex { display: flex; align-items: center; justify-content: flex-start;
             grid-column-gap: 3px; grid-row-gap: 3px; }
   Tailwind's \`.flex\` utility only sets \`display: flex\`, so Webflow's
   \`align-items: center\` and 3px grid-gap leak through every Tailwind
   flex container in the landing — that was the cause of the "everything
   is centered" bug.
   We neutralize the leaking properties back to the flexbox/grid defaults
   so the design system's intent is restored. Tailwind's explicit utility
   classes (\`.items-center\`, \`.justify-between\`, \`.gap-[8px]\`) still
   win because their specificity (0,2,0 after scoping) beats this rule
   (0,1,0). */
:where(${SCOPE}) .flex,
:where(${SCOPE}) .inline-flex,
:where(${SCOPE}) .grid,
:where(${SCOPE}) .inline-grid {
  align-items: normal;
  justify-content: normal;
  column-gap: normal;
  row-gap: normal;
}
`;

  writeFileSync(join(artifactsDir, '4-tailwind.css'), tailwindCss);
  const cssRaw = tailwindCss; // reset is spliced in AFTER scoping Tailwind

  // [5] Scope CSS with .iwo-landing-26.
  console.log(`[5/7] Scoping CSS with ${SCOPE}…`);
  const scopedResult = await postcss([
    prefixer({
      prefix: SCOPE,
      transform(prefix, selector, prefixedSelector) {
        const t = selector.trim();
        if (t === 'html' || t === 'body' || t === ':root' || t === '*') return prefix;
        return prefixedSelector;
      },
    }),
  ]).process(cssRaw, { from: undefined });
  // Root size is pinned via inline style on the root div (see step 1).
  // Prepend the pre-scoped reset so it appears BEFORE the scoped Tailwind
  // — the order doesn't matter for cascade (different specificities), but
  // keeping the reset up top makes the artifact easier to scan.
  const cssScoped = resetCss + scopedResult.css;
  writeFileSync(join(artifactsDir, '5-css-scoped.css'), cssScoped);

  // [6] Sanitize HTML (DOMPurify).
  console.log('[6/7] Sanitizing HTML with DOMPurify…');
  const htmlClean = DOMPurify.sanitize(htmlRewritten, SANITIZE_OPTS);
  writeFileSync(join(artifactsDir, '6-html-sanitized.html'), htmlClean);

  // [7a] Substitute placeholder tokens. The Figma-authored text wraps each
  // placeholder in single braces, e.g. `{Nome do Produto}`.  The app
  // renderer expects `{{camelCaseKey}}`. PLACEHOLDER_MAP is the single
  // source of truth for that translation.
  let htmlFinal = htmlClean;
  for (const [figmaText, varKey] of Object.entries(PLACEHOLDER_MAP)) {
    // Escape regex metacharacters in the Figma text (accents are literal
    // codepoints, but parens/braces etc. must be escaped).
    const escaped = figmaText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    htmlFinal = htmlFinal.replace(
      new RegExp(`\\{${escaped}\\}`, 'g'),
      `{{${varKey}}}`,
    );
  }

  // Warn about any surviving `{...}` tokens — those are likely authored in
  // Figma but missing from PLACEHOLDER_MAP (the import silently leaves
  // them in the HTML, which ships as literal `{Foo}` to end users).
  const unmapped = new Set();
  for (const m of htmlFinal.matchAll(FIGMA_TOKEN_RE)) {
    // Skip our own `{{…}}` tokens — the regex would otherwise match the
    // inner `{…}` of a `{{key}}`.
    const before = htmlFinal[m.index - 1];
    const after = htmlFinal[m.index + m[0].length];
    if (before === '{' || after === '}') continue;
    unmapped.add(m[1]);
  }
  if (unmapped.size > 0) {
    console.warn(
      `      ⚠  ${unmapped.size} placeholder(s) in the Figma HTML not in PLACEHOLDER_MAP:`,
    );
    for (const k of unmapped) console.warn(`         • {${k}}`);
    console.warn(
      '         Add them to app/lib/landing-placeholders.mjs + buildLandingVars().',
    );
  }

  writeFileSync(join(artifactsDir, '7-html-final.html'), htmlFinal);

  // assetManifest per API contract: array of R2 public URLs.
  const assetManifest = Array.from(new Set(Object.values(mapping))).sort();
  writeFileSync(
    join(artifactsDir, 'asset-manifest.json'),
    JSON.stringify(assetManifest, null, 2),
  );

  // [7b] Wrap HTML in the scope class so the scoped CSS actually applies.
  // (The API also re-scopes CSS server-side; wrapping here makes the stored
  // state self-contained.)
  const htmlWrapped = `<div class="${SCOPE.slice(1)}">${htmlFinal}</div>`;
  writeFileSync(join(artifactsDir, '7-html-wrapped.html'), htmlWrapped);

  // [7c] Standalone triage preview: a full HTML document with Inter/Sofia Pro
  // fonts + the scoped CSS + the wrapped body, so it can be opened in a
  // browser DIRECTLY (no dev server) to see the "pure Figma output".
  // If visual regressions appear here, the bug is Figma-side; if only when
  // embedded in the product page, the bug is embedding-side.
  const standalone = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Landing preview — product ${PRODUCT_ID}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
<style>body{margin:0;background:#fff;font-family:Inter,system-ui,sans-serif}</style>
<style>${cssScoped}</style>
</head>
<body>
${htmlWrapped
  .replace(/\{\{name\}\}/g, 'Iwo W11 GPS 2GB')
  .replace(/\{\{subtitle\}\}/g, 'A nova geração')
  .replace(/\{\{description\}\}/g, 'AMOLED 2.08" | GPS | 2GB | IA Integrada')}
</body>
</html>`;
  writeFileSync(join(artifactsDir, 'preview.html'), standalone);

  // [8] PATCH the API. Sign admin JWT.
  console.log('[7/7] PATCHing /api/admin/products/26/landing…');
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error('ADMIN_JWT_SECRET missing.');
  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject('figma-import-script')
    .setIssuedAt()
    .setExpirationTime('1h')
    .setIssuer('iwo-watch-admin')
    .setAudience('iwo-watch-admin')
    .sign(new TextEncoder().encode(secret));
  const payload = {
    figmaUrl: FIGMA_URL,
    html: htmlWrapped,
    css: cssScoped,
    assetManifest,
    variant: VARIANT,
  };
  writeFileSync(
    join(artifactsDir, 'patch-payload.json'),
    JSON.stringify({
      figmaUrl: payload.figmaUrl,
      assetManifest: payload.assetManifest,
      htmlBytes: Buffer.byteLength(payload.html, 'utf8'),
      cssBytes: Buffer.byteLength(payload.css, 'utf8'),
    }, null, 2),
  );

  const res = await fetch(`${API_BASE}/api/admin/products/${PRODUCT_ID}/landing`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`      PATCH failed: HTTP ${res.status}`);
    console.error(text);
    process.exit(1);
  }
  console.log(`      PATCH ${res.status}`);
  console.log(text);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
