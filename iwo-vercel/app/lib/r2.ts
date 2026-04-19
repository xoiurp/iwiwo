import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export type PresignedUpload = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
};

// Overload A: legacy `products/<id>/<uuid>.<ext>` — used by /api/admin/upload.
// Overload B: `{ key, contentType }` — caller chooses the key (used for landing assets).
export async function createPresignedUpload(
  productId: number | string,
  fileName: string,
  contentType: string
): Promise<PresignedUpload>;
export async function createPresignedUpload(
  input: { key: string; contentType: string }
): Promise<PresignedUpload>;
export async function createPresignedUpload(
  a: number | string | { key: string; contentType: string },
  b?: string,
  c?: string
): Promise<PresignedUpload> {
  let key: string;
  let contentType: string;

  if (typeof a === 'object' && a !== null) {
    key = a.key;
    contentType = a.contentType;
  } else {
    const productId = a;
    const fileName = b ?? 'upload.jpg';
    contentType = c ?? 'application/octet-stream';
    const ext = fileName.split('.').pop() || 'jpg';
    key = `products/${productId}/${randomUUID()}.${ext}`;
  }

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(R2, command, { expiresIn: 600 });
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

  return { uploadUrl, publicUrl, key };
}
