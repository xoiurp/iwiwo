// Downloads each Figma MCP asset URL and uploads to Cloudflare R2 via the
// AWS SDK v3 S3 client.  Uses `requestChecksumCalculation: 'WHEN_REQUIRED'`
// so the flexible-checksums middleware does not inject checksum headers R2
// would otherwise reject.
//
// Uploads land at `landing/<productId>/<uuid>.<ext>` — same key shape the
// admin presign endpoint emits.

import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
};

function makeClient() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials missing from environment.');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

export async function mirrorAssetsToR2({ assets, productId, variant = 'desktop' }) {
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBase = process.env.R2_PUBLIC_URL;
  if (!bucket || !publicBase) {
    throw new Error('R2_BUCKET_NAME / R2_PUBLIC_URL missing from environment.');
  }
  const client = makeClient();
  const mapping = {};
  const seenUrls = new Set();

  for (const [name, url] of Object.entries(assets)) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${name} (${url}): HTTP ${res.status}`);
    }
    const contentType = (res.headers.get('content-type') || '')
      .toLowerCase().split(';')[0].trim();
    const ext = MIME_EXT[contentType];
    if (!ext) {
      throw new Error(`Unsupported content-type "${contentType}" for ${name} (${url}).`);
    }
    const buf = Buffer.from(await res.arrayBuffer());

    const key = `landing/${productId}/${variant}/${randomUUID()}.${ext}`;
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buf,
      ContentType: contentType,
    }));

    const publicUrl = `${publicBase.replace(/\/$/, '')}/${key}`;
    mapping[url] = publicUrl;
    console.log(`  [r2] ${name.padEnd(45)} → ${key} (${buf.byteLength}B, ${contentType})`);
  }

  return mapping;
}

// Replace every occurrence of a Figma MCP URL in `html` with its R2 equivalent
// (straight string replace — URLs are unique and contain no regex metachars).
export function rewriteAssetUrls(html, mapping) {
  let out = html;
  for (const [from, to] of Object.entries(mapping)) {
    out = out.split(from).join(to);
  }
  return out;
}
