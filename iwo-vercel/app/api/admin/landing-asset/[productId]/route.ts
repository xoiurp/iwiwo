// app/api/admin/landing-asset/[productId]/route.ts
// Presigned R2 upload for landing assets (images, SVGs) used by Figma-imported
// landings. Keys are scoped under `landing/<productId>/<uuid>.<ext>`.
//
// SVG note: image/svg+xml is allowed here (landings use SVG icons). When
// rendered via <img src=".svg">, scripts inside the SVG do not execute.
// Any inline SVG that reaches landingHtml is additionally sanitized by
// DOMPurify (see landing-pipeline.sanitizeLandingHtml).

import { randomUUID } from 'crypto';
import { guardAdmin } from '@/app/admin/lib/verify';
import { prisma } from '@/app/lib/prisma';
import { createPresignedUpload } from '@/app/lib/r2';

export const runtime = 'nodejs';

// Strict MIME → extension allowlist for landing assets.
// image/x-* and other non-standard/experimental types are rejected.
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — parity with /api/admin/upload

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const unauthorized = await guardAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { productId: rawProductId } = await params;
    if (!/^\d+$/.test(rawProductId)) {
      return Response.json({ error: 'productId inválido' }, { status: 400 });
    }
    const productId = parseInt(rawProductId, 10);
    if (!Number.isInteger(productId) || productId <= 0) {
      return Response.json({ error: 'productId inválido' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    let body: { fileName?: unknown; contentType?: unknown; size?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return Response.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const { fileName, contentType, size } = body;

    if (typeof fileName !== 'string' || fileName.length === 0) {
      return Response.json(
        { error: 'fileName é obrigatório' },
        { status: 400 }
      );
    }
    if (typeof contentType !== 'string' || contentType.length === 0) {
      return Response.json(
        { error: 'contentType é obrigatório' },
        { status: 400 }
      );
    }

    const mime = contentType.toLowerCase().trim();
    // Explicit reject for image/x-* and other experimental subtypes.
    if (mime.startsWith('image/x-')) {
      return Response.json(
        { error: 'Tipo não permitido' },
        { status: 415 }
      );
    }
    const ext = MIME_EXT[mime];
    if (!ext) {
      return Response.json(
        {
          error:
            'Tipo não permitido. Aceitos: JPEG, PNG, WebP, AVIF, SVG, GIF',
        },
        { status: 415 }
      );
    }

    if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
      return Response.json({ error: 'size inválido' }, { status: 400 });
    }
    if (size > MAX_BYTES) {
      return Response.json({ error: 'Arquivo excede 10MB' }, { status: 413 });
    }

    // Key is derived server-side from trusted MIME → client fileName is
    // ignored for security (cannot smuggle ../, null bytes, or exe extensions).
    const key = `landing/${productId}/${randomUUID()}.${ext}`;
    const result = await createPresignedUpload({ key, contentType: mime });

    return Response.json({
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
      key: result.key,
    });
  } catch (error) {
    console.error('Erro ao gerar URL de upload (landing):', error);
    return Response.json(
      { error: 'Erro ao gerar URL de upload' },
      { status: 500 }
    );
  }
}
