// Resume-only step: reads the artifacts produced by import.mjs and PATCHes
// /api/admin/products/26/landing.  Use when the full import already uploaded
// assets to R2 but the final PATCH failed (e.g. dev server was down).
//
// Does NOT re-upload assets — reads `asset-manifest.json` from artifacts/.

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { SignJWT } from 'jose';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');
dotenv.config({ path: join(projectRoot, '.env.local') });

const PRODUCT_ID = 26;
const FIGMA_URL =
  'https://www.figma.com/design/V5L6H0bq5bgM362Lclwbdd/Apple-Landing-Page-Prototype--Community-?node-id=103-952&t=xdUK5HQcl5SxWFK5-11';
const API_BASE = process.env.IWO_API_BASE || 'http://localhost:3000';

const artifactsDir = join(__dirname, 'artifacts');
const html = readFileSync(join(artifactsDir, '7-html-wrapped.html'), 'utf8');
const css = readFileSync(join(artifactsDir, '5-css-scoped.css'), 'utf8');
const assetManifest = JSON.parse(
  readFileSync(join(artifactsDir, 'asset-manifest.json'), 'utf8'),
);

const secret = process.env.ADMIN_JWT_SECRET;
if (!secret) throw new Error('ADMIN_JWT_SECRET missing.');
const token = await new SignJWT({ role: 'admin' })
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setSubject('figma-import-resume')
  .setIssuedAt()
  .setExpirationTime('1h')
  .setIssuer('iwo-watch-admin')
  .setAudience('iwo-watch-admin')
  .sign(new TextEncoder().encode(secret));

console.log(`PATCH ${API_BASE}/api/admin/products/${PRODUCT_ID}/landing`);
console.log(`  html:  ${html.length}B`);
console.log(`  css:   ${css.length}B`);
console.log(`  assets: ${assetManifest.length}`);

const res = await fetch(`${API_BASE}/api/admin/products/${PRODUCT_ID}/landing`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ figmaUrl: FIGMA_URL, html, css, assetManifest }),
});
const text = await res.text();
console.log(`← HTTP ${res.status}`);
console.log(text);
if (!res.ok) process.exit(1);
