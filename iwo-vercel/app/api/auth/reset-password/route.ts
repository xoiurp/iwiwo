// app/api/auth/reset-password/route.ts
// Consumes a reset token and updates the user's password. The token is
// single-use: we delete it inside the same transaction as the password update
// so a replay attack cannot reuse a leaked link.

import bcrypt from 'bcryptjs';
import { prisma } from '@/app/lib/prisma';

export const runtime = 'nodejs';

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const BCRYPT_COST = 12;

type ResetBody = {
  token?: unknown;
  password?: unknown;
};

function bad(error: string, message: string, status = 400) {
  return Response.json({ error, message }, { status });
}

export async function POST(request: Request) {
  let body: ResetBody;
  try {
    body = (await request.json()) as ResetBody;
  } catch {
    return bad('INVALID_JSON', 'Corpo da requisição inválido.');
  }

  const token = typeof body.token === 'string' ? body.token : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!token) {
    return bad('INVALID_TOKEN', 'Token ausente ou inválido.');
  }
  if (!PASSWORD_RE.test(password)) {
    return bad(
      'INVALID_PASSWORD',
      'A senha precisa ter ao menos 8 caracteres, com letras e números.'
    );
  }

  try {
    const record = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!record || record.expires.getTime() < Date.now()) {
      if (record) {
        await prisma.verificationToken
          .delete({ where: { token } })
          .catch(() => undefined);
      }
      return bad('INVALID_TOKEN', 'Token expirado ou inválido.');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    await prisma.$transaction([
      prisma.user.update({
        where: { email: record.identifier },
        data: { passwordHash },
      }),
      prisma.verificationToken.delete({ where: { token } }),
    ]);

    return Response.json({
      success: true,
      message: 'Senha atualizada com sucesso.',
    });
  } catch (error) {
    console.error('[auth/reset-password] unexpected error:', error);
    return Response.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'Não foi possível redefinir a senha.',
      },
      { status: 500 }
    );
  }
}
