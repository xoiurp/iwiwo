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
