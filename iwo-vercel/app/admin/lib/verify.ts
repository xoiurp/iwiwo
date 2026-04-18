// app/admin/lib/verify.ts
// Shared server-side admin auth guard for API routes.

import { verifyAdminToken } from './auth-server';

export class UnauthorizedError extends Error {
  constructor(message = 'Não autorizado') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Verifies the Authorization: Bearer <jwt> header.
 * Throws UnauthorizedError on any failure. Callers should map that to 401.
 */
export async function verifyAdminOrThrow(request: Request): Promise<void> {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }
  const token = auth.slice(7).trim();
  if (!token) {
    throw new UnauthorizedError();
  }
  try {
    await verifyAdminToken(token);
  } catch {
    throw new UnauthorizedError();
  }
}

/**
 * Helper: returns a Response if auth fails, or null to continue.
 * Use: `const bad = await guardAdmin(request); if (bad) return bad;`
 */
export async function guardAdmin(request: Request): Promise<Response | null> {
  try {
    await verifyAdminOrThrow(request);
    return null;
  } catch {
    return Response.json({ error: 'Não autorizado' }, { status: 401 });
  }
}
