// Server Component. Injects the trusted Webflow template HTML
// (authored in this repo under public/templates/product.html) and wires up
// the slug hooks consumed by the legacy products.js frontend script.
//
// The template is trusted content, so we do NOT sanitize here — just
// interpolate {{slug}} placeholders and inject window.__PRODUCT_SLUG__
// before </head> (mirrors the original route.ts behaviour).

type Props = {
  html: string;
  slug: string;
};

export function ProductTemplate({ html, slug }: Props) {
  if (!html) return null;

  const slugJson = JSON.stringify(slug);
  const injected = html
    .replace(/\{\{\s*slug\s*\}\}/g, slug)
    .replace(
      "</head>",
      `<script>window.__PRODUCT_SLUG__ = ${slugJson};</script>\n</head>`,
    );

  return (
    <div
      className="iwo-product-template"
      dangerouslySetInnerHTML={{ __html: injected }}
    />
  );
}
