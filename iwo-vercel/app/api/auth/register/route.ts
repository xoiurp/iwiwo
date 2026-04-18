// app/api/auth/register/route.ts
// Customer self-registration endpoint.
// - Creates User (with bcrypt passwordHash, emailVerified=null) + Customer in
//   a single transaction so we never end up with an orphaned User.
// - Issues a 24h verification token and emails it via Resend.
// - Leaves NextAuth session creation to the login flow (W1a).

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/app/lib/prisma';
import { sendEmail, APP_URL } from '@/app/lib/email';
import { welcomeVerifyEmail } from '@/app/lib/email-templates';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const BCRYPT_COST = 12;
const TOKEN_BYTES = 48;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type RegisterBody = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  cpf?: unknown;
  phone?: unknown;
};

function bad(error: string, message: string, status = 400) {
  return Response.json({ error, message }, { status });
}

export async function POST(request: Request) {
  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return bad('INVALID_JSON', 'Corpo da requisição inválido.');
  }

  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const cpf =
    typeof body.cpf === 'string' && body.cpf.trim().length > 0
      ? body.cpf.trim()
      : null;
  const phone =
    typeof body.phone === 'string' && body.phone.trim().length > 0
      ? body.phone.trim()
      : null;

  if (!EMAIL_RE.test(email)) {
    return bad('INVALID_EMAIL', 'Informe um email válido.');
  }
  if (name.length < 2) {
    return bad('INVALID_NAME', 'Informe seu nome (mínimo 2 caracteres).');
  }
  if (!PASSWORD_RE.test(password)) {
    return bad(
      'INVALID_PASSWORD',
      'A senha precisa ter ao menos 8 caracteres, com letras e números.'
    );
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return Response.json(
        {
          error: 'EMAIL_EXISTS',
          message: 'Este email já está cadastrado.',
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const expires = new Date(Date.now() + TOKEN_TTL_MS);

    // Create user + customer + verification token atomically. If the email
    // collides on Customer.email (unique) or User.email, the transaction
    // aborts and no partial rows are left behind.
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          emailVerified: null,
        },
        select: { id: true },
      });

      await tx.customer.create({
        data: {
          userId: user.id,
          email,
          name,
          cpf,
          phone,
        },
      });

      await tx.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires,
        },
      });
    });

    const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    const tmpl = welcomeVerifyEmail({ name, verifyUrl });

    try {
      await sendEmail({
        to: email,
        subject: tmpl.subject,
        html: tmpl.html,
        text: tmpl.text,
        tags: [{ name: 'type', value: 'welcome_verify' }],
      });
    } catch (e) {
      // Email send failed but user was created — log and let them request a
      // resend (or use forgot-password flow). Do not fail the registration.
      console.error('[auth/register] verification email failed:', e);
    }

    return Response.json({
      success: true,
      message: 'Enviamos um email pra confirmar seu cadastro.',
    });
  } catch (error) {
    console.error('[auth/register] unexpected error:', error);
    return Response.json(
      { error: 'INTERNAL_ERROR', message: 'Não foi possível concluir o cadastro.' },
      { status: 500 }
    );
  }
}
