import { notFound } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { prisma } from "@/app/lib/prisma";
import {
  REQUIRED_PRODUCT_FIELDS,
  buildLandingVars,
} from "@/app/lib/landing-vars";
import { LandingSection } from "./LandingSection";
import { ProductTemplate } from "./ProductTemplate";

// Landings can change often via admin; the DB lookup is cheap so we opt out
// of static caching. Switch to ISR (revalidate) once landing edits are rare.
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

// Fields needed by the page itself (metadata, OG) on top of the ones
// already surfaced by the landing placeholder system.
const PRODUCT_SELECT = {
  ...REQUIRED_PRODUCT_FIELDS,
  seoDescription: true,
} as const;

async function loadProduct(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    select: PRODUCT_SELECT,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return { title: "Produto não encontrado" };

  const title = product.seoTitle ?? `${product.name} — IWO Watch`;
  const description = product.seoDescription ?? product.description ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: product.image ? [{ url: product.image }] : [],
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();

  // Load Webflow template HTML from public/templates/product.html.
  // If the file is missing we still render the landing (if present) alone.
  const templatePath = path.join(
    process.cwd(),
    "public",
    "templates",
    "product.html",
  );
  let templateHtml = "";
  try {
    templateHtml = await fs.readFile(templatePath, "utf8");
  } catch {
    templateHtml = "";
  }

  // Vars for `{{key}}` interpolation in the landing HTML. Source of truth
  // for the key set is PLACEHOLDER_MAP (app/lib/landing-placeholders.mjs).
  const landingVars = buildLandingVars(product);

  // Split the Webflow template immediately after the details/specs accordion
  // (`.section-especs`), so the landing renders between it and the "Conheça
  // também…" related-products block. Anchor is the opening tag of the next
  // section, which is stable across slugs.
  const LANDING_ANCHOR = '<section class="section-14">';
  const anchorIdx = templateHtml.indexOf(LANDING_ANCHOR);
  const templateBefore =
    anchorIdx >= 0 ? templateHtml.slice(0, anchorIdx) : templateHtml;
  // Strip the trailing `</body></html>` from the second half — rendering
  // those closing tags inside a `<div dangerouslySetInnerHTML>` triggers a
  // Next 16 / React 19 hydration error ("invalid HTML nesting"). Browsers
  // already auto-close documents, so dropping them has no visual effect.
  const templateAfter = anchorIdx >= 0
    ? templateHtml
        .slice(anchorIdx)
        .replace(/<\/body\s*>\s*$/i, "")
        .replace(/<\/html\s*>\s*$/i, "")
        .replace(/<\/body\s*>\s*<\/html\s*>\s*$/i, "")
    : "";

  return (
    <>
      <ProductTemplate html={templateBefore} slug={slug} />
      <LandingSection
        productId={product.id}
        desktop={{ html: product.landingHtml, css: product.landingCss }}
        mobile={{
          html: product.landingMobileHtml,
          css: product.landingMobileCss,
        }}
        variables={landingVars}
      />
      {templateAfter ? (
        <ProductTemplate html={templateAfter} slug={slug} />
      ) : null}
    </>
  );
}
