// Pure `{{token}}` substitution for landing HTML. Split out from
// landing-pipeline.ts so the public product page (LandingSection) can
// import only this — WITHOUT pulling in jsdom (via isomorphic-dompurify)
// and postcss, which caused 500s on Vercel serverless for every /p/[slug]
// request. The write-time sanitize/scope path (admin PATCH route) still
// uses the full landing-pipeline.

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
