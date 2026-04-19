import DOMPurify from "isomorphic-dompurify";
import postcss from "postcss";
import prefixer from "postcss-prefix-selector";

// ── Sanitize HTML (generous allowlist for landing pages) ─────────────────────
const ALLOWED_TAGS = [
  "div","span","section","article","header","footer","main","nav","aside",
  "p","a","h1","h2","h3","h4","h5","h6",
  "ul","ol","li","dl","dt","dd",
  "strong","em","b","i","u","s","mark","small","sub","sup","blockquote","cite","code","pre","hr","br",
  "img","picture","source","figure","figcaption",
  "video","audio","track",
  "table","thead","tbody","tfoot","tr","td","th","caption",
  "style",
  // Layout/semantic
  "details","summary","time",
];
const ALLOWED_ATTR = [
  "href","src","srcset","sizes","alt","title","class","id","style","rel","target","loading","decoding",
  "width","height","type","media","controls","poster","preload","playsinline","autoplay","muted","loop",
  "data-*",
  "role","aria-*",
];
const FORBID_TAGS = ["script","iframe","object","embed","form","input","button","select","textarea","link","meta","base"];
const FORBID_ATTR = [
  "onerror","onload","onclick","onmouseover","onfocus","onblur","onchange","oninput","onsubmit","onreset",
  "onkeydown","onkeyup","onkeypress","onanimationstart","onanimationend","ontransitionend",
  "onpointerdown","onpointerup","onpointermove","onwheel","onscroll","oncontextmenu",
];

export function sanitizeLandingHtml(raw: string): string {
  if (!raw) return "";
  // DOMPurify keeps ALLOWED_TAGS / strips everything else; FORBID_* lists add belt+suspenders
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_ATTR,
    ADD_ATTR: ["target"],
    ALLOW_DATA_ATTR: true,
    USE_PROFILES: { html: true },
  });
}

// ── Scope CSS to .iwo-landing-<productId> ────────────────────────────────────
// Every rule is prefixed. :root / html / body references get stripped since
// the landing lives in a sub-section. @keyframes and @font-face pass through.
export async function scopeLandingCss(raw: string, productId: number): Promise<string> {
  if (!raw) return "";
  const scope = `.iwo-landing-${productId}`;
  const result = await postcss([
    prefixer({
      prefix: scope,
      transform(prefix, selector, prefixedSelector) {
        // Normalize html/body/:root → drop them (landing is scoped)
        const trimmed = selector.trim();
        if (trimmed === "html" || trimmed === "body" || trimmed === ":root" || trimmed === "*") {
          return prefix;
        }
        // Selector already starts with `:where(.iwo-landing-<id>)` — leave
        // it alone. The Figma-import pipeline (scripts/figma-import-26)
        // emits a low-specificity :where()-scoped reset that we must NOT
        // re-prefix; doing so would push the specificity back up to (0,1,1)
        // and override Tailwind utilities inappropriately.
        if (trimmed.startsWith(`:where(${prefix})`)) {
          return selector;
        }
        // Selector already starts with the scope class — leave it alone
        // (defense in depth for clients that pre-scope manually).
        if (trimmed.startsWith(`${prefix} `) || trimmed === prefix) {
          return selector;
        }
        return prefixedSelector;
      },
    }),
  ]).process(raw, { from: undefined });
  return result.css;
}

// ── Interpolate {{name}} / {{subtitle}} / {{description}} / etc. ─────────────
// Only a strict allowlist of tokens. Unknown tokens pass through unchanged
// so the admin can catch typos during preview. HTML-escapes substituted values.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TOKEN_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export function interpolateLandingHtml(
  html: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  if (!html) return "";
  return html.replace(TOKEN_RE, (match, key: string) => {
    if (!(key in vars)) return match; // unknown token: leave as-is
    const value = vars[key];
    if (value === null || value === undefined) return "";
    return escapeHtml(String(value));
  });
}
