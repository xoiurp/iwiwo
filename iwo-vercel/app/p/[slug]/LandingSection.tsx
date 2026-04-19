// Server Component. Renders the Figma-imported landing HTML + scoped CSS.
//
// CONTRACT (upheld by the Landing-B write pipeline in landing-pipeline.ts):
//   - `html` was already sanitized via sanitizeLandingHtml() on write.
//   - `css`  was already scoped to .iwo-landing-<productId> via scopeLandingCss().
// Therefore we DO NOT re-sanitize / re-scope here.
//
// Interpolation runs AFTER sanitize on write — DOMPurify with
// USE_PROFILES: { html: true } leaves text nodes untouched, so
// {{name}} / {{subtitle}} / {{description}} tokens survive sanitization
// and are replaced here at render time with HTML-escaped values.

import { interpolateLandingHtml } from "@/app/lib/landing-interpolate";

type Props = {
  productId: number;
  html: string;
  css: string | null;
  variables: Record<string, string>;
};

export function LandingSection({ productId, html, css, variables }: Props) {
  const interpolated = interpolateLandingHtml(html, variables);

  // Full-bleed escape: the Figma-exported design is a fixed 1280px desktop
  // frame, but the Webflow product template wraps content in a narrower
  // `.container-large`. Breaking out to 100vw lets the landing render at
  // its designed width. We also force `display: flex; justify-content:
  // center` so the 1280px Figma frame sits centered on wider viewports
  // (the exported Figma root is `flex items-center` on a row axis with no
  // justify, leaving its fixed-width child pinned to the left).
  //
  // `overflow-x: clip` (not `hidden`) contains horizontal overflow on
  // viewports < 1280px WITHOUT turning the section into a scroll container
  // on the Y axis — a quirk of the CSS spec means `overflow-x: hidden`
  // coerces `overflow-y` to `auto`, which captures mousewheel events and
  // looks like a page-scroll lock when the cursor is over the landing.
  const fullBleed: React.CSSProperties = {
    width: "100vw",
    marginLeft: "calc(50% - 50vw)",
    display: "flex",
    justifyContent: "center",
    overflowX: "clip",
  };

  // The direct child of our flex section is the wrapper that holds the
  // interpolated HTML.  Pin it to `width: 1280px; flex-shrink: 0` so that
  // (a) it doesn't collapse when the flex container is narrower than the
  // Figma frame, and (b) it doesn't stretch when the container is wider
  // (the Figma design is desktop-only 1280px).
  const inner: React.CSSProperties = {
    width: "1280px",
    flexShrink: 0,
  };

  return (
    <section
      id="product-landing"
      className={`iwo-landing-${productId}`}
      aria-label="Conteúdo do produto"
      style={fullBleed}
    >
      {css ? (
        // CSS is already scoped server-side. Inline it so the page does
        // not need a separate stylesheet round-trip.
        <style dangerouslySetInnerHTML={{ __html: css }} />
      ) : null}
      <div
        style={inner}
        dangerouslySetInnerHTML={{ __html: interpolated }}
      />
    </section>
  );
}
