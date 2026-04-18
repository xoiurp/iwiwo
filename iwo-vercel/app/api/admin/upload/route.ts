import { createPresignedUpload } from '@/app/lib/r2';
import { guardAdmin } from '@/app/admin/lib/verify';

// Strict allowlist — SVG intentionally excluded (XSS vector via <script>).
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  const unauthorized = await guardAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { fileName, contentType, productId, size } = body as {
      fileName?: string;
      contentType?: string;
      productId?: number | string;
      size?: number;
    };

    if (!fileName || !contentType || !productId) {
      return Response.json(
        { error: 'fileName, contentType e productId sao obrigatorios' },
        { status: 400 }
      );
    }

    // Normalize + validate MIME
    const mime = String(contentType).toLowerCase().trim();
    const ext = MIME_EXT[mime];
    if (!ext) {
      return Response.json(
        { error: 'Tipo nao permitido. Aceitos: JPEG, PNG, WebP, AVIF' },
        { status: 415 }
      );
    }

    // Size cap (client-declared — enforced again at presign policy level in real deploys)
    if (typeof size === 'number') {
      if (!Number.isFinite(size) || size < 0) {
        return Response.json({ error: 'size invalido' }, { status: 400 });
      }
      if (size > MAX_BYTES) {
        return Response.json(
          { error: 'Arquivo excede 10MB' },
          { status: 413 }
        );
      }
    }

    // Derive file extension from MIME (ignore client fileName extension entirely).
    // Pass a synthetic name so the presigner uses our trusted extension.
    const safeName = `upload.${ext}`;

    const result = await createPresignedUpload(productId, safeName, mime);

    return Response.json({
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
    });
  } catch (error) {
    console.error('Erro ao gerar URL de upload:', error);
    return Response.json(
      { error: 'Erro ao gerar URL de upload' },
      { status: 500 }
    );
  }
}
