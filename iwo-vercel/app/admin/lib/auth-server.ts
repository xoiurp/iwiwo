// app/admin/lib/auth-server.ts
// Server-only admin JWT helpers (HS256 via jose).
// Do NOT import this from client components.

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

function getSecret(): Uint8Array {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      'ADMIN_JWT_SECRET is missing or too short (min 32 chars). Set a strong secret in env.'
    );
  }
  return new TextEncoder().encode(s);
}

/**
 * Sign an admin JWT using HS256.
 * @param sub subject claim (e.g. 'admin')
 * @param hours lifetime in hours (default 24)
 */
export async function signAdminToken(sub: string, hours = 24): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + hours * 3600;

  return await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(sub)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setIssuer('iwo-watch-admin')
    .setAudience('iwo-watch-admin')
    .sign(getSecret());
}

/**
 * Verify an admin JWT. Returns the payload on success, or throws on
 * invalid/expired/tampered tokens.
 */
export async function verifyAdminToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ['HS256'],
    issuer: 'iwo-watch-admin',
    audience: 'iwo-watch-admin',
  });

  if (payload.role !== 'admin') {
    throw new Error('Token missing admin role');
  }

  return payload;
}
