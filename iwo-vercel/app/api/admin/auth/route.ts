// app/api/admin/auth/route.ts
// Uses env-based admin password per T2; no DB required.
// Admin authentication — issues a signed HS256 JWT (jose).
// Password verification prefers ADMIN_PASSWORD_HASH (bcrypt). Plaintext
// ADMIN_PASSWORD is a DEPRECATED fallback and emits a console.warn.

import bcrypt from 'bcryptjs';
import { signAdminToken } from '@/app/admin/lib/auth-server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password || typeof password !== 'string') {
      return Response.json({ error: 'Senha inválida' }, { status: 401 });
    }

    const hash = process.env.ADMIN_PASSWORD_HASH;
    const plain = process.env.ADMIN_PASSWORD;

    let ok = false;
    if (hash && hash.length > 0) {
      try {
        ok = await bcrypt.compare(password, hash);
      } catch (e) {
        console.error('bcrypt.compare failed:', e);
        ok = false;
      }
    } else if (plain && plain.length > 0) {
      console.warn(
        '[admin/auth] DEPRECATED: using plaintext ADMIN_PASSWORD. ' +
          'Migrate to ADMIN_PASSWORD_HASH (bcrypt) ASAP.'
      );
      // Constant-time compare via bcrypt-style length check + equality
      ok = password.length === plain.length && safeEqual(password, plain);
    } else {
      console.error(
        '[admin/auth] Neither ADMIN_PASSWORD_HASH nor ADMIN_PASSWORD is configured.'
      );
      return Response.json({ error: 'Servidor não configurado' }, { status: 503 });
    }

    if (!ok) {
      return Response.json({ error: 'Senha inválida' }, { status: 401 });
    }

    // Ensure JWT secret exists before issuing
    if (!process.env.ADMIN_JWT_SECRET || process.env.ADMIN_JWT_SECRET.length < 32) {
      console.error('[admin/auth] ADMIN_JWT_SECRET missing or too short.');
      return Response.json({ error: 'Servidor não configurado' }, { status: 503 });
    }

    const token = await signAdminToken('admin', 24);

    return Response.json({
      token,
      expiresIn: '24h',
    });
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return Response.json({ error: 'Erro na autenticação' }, { status: 500 });
  }
}

// Basic constant-time string compare for the deprecated plaintext path.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
