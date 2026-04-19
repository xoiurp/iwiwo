// app/api/admin/products/[id]/landing/route.ts
// Admin landing CRUD. Receives already-processed HTML+CSS+asset manifest from
// the Figma-import tooling and re-runs sanitize+scope on write (defense in
// depth). Does NOT perform template interpolation — this route stores raw
// landing state; the public renderer is responsible for interpolation.
//
// Endpoints:
//   GET    → full stored landing state (admin preview/edit fetch)
//   PATCH  → partial update of figmaUrl/html/css/assetManifest
//   DELETE → clear all landing fields (R2 assets are NOT deleted — manual)

import { prisma } from '@/app/lib/prisma';
import { Prisma } from '@prisma/client';
import { guardAdmin } from '@/app/admin/lib/verify';
import {
  sanitizeLandingHtml,
  scopeLandingCss,
} from '@/app/lib/landing-pipeline';

export const runtime = 'nodejs';

// ── Limits (documented) ──────────────────────────────────────────────────────
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_CSS_BYTES = 500 * 1024; // 500 KB
const MAX_MANIFEST_ENTRIES = 200;
const MAX_MANIFEST_URL_LEN = 1000;
const MAX_FIGMA_URL_LEN = 500;

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseProductId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function isValidFigmaUrl(url: string): boolean {
  if (url.length > MAX_FIGMA_URL_LEN) return false;
  return (
    url.startsWith('https://www.figma.com/') ||
    url.startsWith('https://figma.com/')
  );
}

function isValidManifest(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  if (value.length > MAX_MANIFEST_ENTRIES) return false;
  for (const entry of value) {
    if (typeof entry !== 'string') return false;
    if (entry.length === 0 || entry.length > MAX_MANIFEST_URL_LEN) return false;
  }
  return true;
}

// ── GET: Full landing state (admin-only) ────────────────────────────────────

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
        landingFigmaUrl: true,
        landingHtml: true,
        landingCss: true,
        landingAssetManifest: true,
        landingImportedAt: true,
      },
    });

    if (!product) {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    return Response.json({
      id: product.id,
      slug: product.slug,
      figmaUrl: product.landingFigmaUrl,
      html: product.landingHtml,
      css: product.landingCss,
      assetManifest: product.landingAssetManifest ?? null,
      importedAt: product.landingImportedAt,
    });
  } catch (error) {
    console.error('Erro ao buscar landing:', error);
    return Response.json({ error: 'Erro ao buscar landing' }, { status: 500 });
  }
}

// ── PATCH: Partial landing update ────────────────────────────────────────────

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

    const { figmaUrl, html, css, assetManifest } = body as {
      figmaUrl?: unknown;
      html?: unknown;
      css?: unknown;
      assetManifest?: unknown;
    };

    const data: Prisma.ProductUpdateInput = {};

    // ── figmaUrl ────────────────────────────────────────────────────────────
    if (figmaUrl !== undefined) {
      if (figmaUrl === null) {
        data.landingFigmaUrl = null;
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
        data.landingFigmaUrl = trimmed;
      }
    }

    // ── html (sanitize) ─────────────────────────────────────────────────────
    if (html !== undefined) {
      if (html === null) {
        data.landingHtml = null;
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
        // Empty-guard: if sanitize produced an empty string, store null.
        data.landingHtml = cleaned.trim().length === 0 ? null : cleaned;
      }
    }

    // ── css (scope to .iwo-landing-<productId>) ─────────────────────────────
    if (css !== undefined) {
      if (css === null) {
        data.landingCss = null;
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
        const scoped = await scopeLandingCss(css, product.id);
        data.landingCss = scoped.trim().length === 0 ? null : scoped;
      }
    }

    // ── assetManifest ───────────────────────────────────────────────────────
    if (assetManifest !== undefined) {
      if (assetManifest === null) {
        data.landingAssetManifest = Prisma.DbNull;
      } else if (!isValidManifest(assetManifest)) {
        return Response.json(
          {
            error: `assetManifest deve ser array de strings (máx ${MAX_MANIFEST_ENTRIES} entradas, cada ≤ ${MAX_MANIFEST_URL_LEN} chars)`,
          },
          { status: 400 }
        );
      } else {
        data.landingAssetManifest = assetManifest as Prisma.InputJsonValue;
      }
    }

    if (Object.keys(data).length === 0) {
      return Response.json(
        { error: 'Nenhum campo válido para atualizar' },
        { status: 400 }
      );
    }

    data.landingImportedAt = new Date();

    const updated = await prisma.product.update({
      where: { id: product.id },
      data,
      select: {
        id: true,
        slug: true,
        landingHtml: true,
        landingCss: true,
        landingImportedAt: true,
      },
    });

    return Response.json({
      success: true,
      product: {
        id: updated.id,
        slug: updated.slug,
        landingHtml: updated.landingHtml !== null && updated.landingHtml.length > 0,
        landingCss: updated.landingCss !== null && updated.landingCss.length > 0,
        landingImportedAt: updated.landingImportedAt,
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

// ── DELETE: Clear all landing fields ─────────────────────────────────────────
// TODO: R2 objects under landing/<productId>/ are NOT deleted here.
// Admins may want to retain them for re-import. Implement explicit cleanup
// (e.g. admin-triggered bulk purge) in a future task.

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

    await prisma.product.update({
      where: { id: productId },
      data: {
        landingFigmaUrl: null,
        landingHtml: null,
        landingCss: null,
        landingAssetManifest: Prisma.DbNull,
        landingImportedAt: null,
      },
      select: { id: true },
    });

    return Response.json({ success: true });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2025') {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }
    console.error('Erro ao excluir landing:', error);
    return Response.json({ error: 'Erro ao excluir landing' }, { status: 500 });
  }
}

