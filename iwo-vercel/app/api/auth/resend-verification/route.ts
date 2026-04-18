// app/api/auth/resend-verification/route.ts
// Reenvia o email de verificação pra contas ainda não confirmadas.
// - Sempre responde 200 com mensagem genérica (sem enumeration de emails).
// - Só gera novo token quando: user existe AND emailVerified é null.
// - Deleta tokens antigos do mesmo identifier pra evitar acúmulo.
// - TTL de 24h idêntico ao fluxo de registro.

import { randomBytes } from "node:crypto";
import { prisma } from "@/app/lib/prisma";
import { sendEmail, APP_URL } from "@/app/lib/email";
import { welcomeVerifyEmail } from "@/app/lib/email-templates";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_BYTES = 48;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const GENERIC_OK = {
  success: true,
  message:
    "Se existe uma conta pendente de confirmação com esse email, reenviamos o link.",
};

export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return Response.json(
      { error: "INVALID_JSON", message: "Corpo inválido." },
      { status: 400 },
    );
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return Response.json(
      { error: "INVALID_EMAIL", message: "Informe um email válido." },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, emailVerified: true },
    });

    // No enumeration: sempre mesma resposta pra "não existe" e "já verificado".
    if (!user || user.emailVerified) {
      return Response.json(GENERIC_OK);
    }

    const token = randomBytes(TOKEN_BYTES).toString("hex");
    const expires = new Date(Date.now() + TOKEN_TTL_MS);

    await prisma.$transaction([
      prisma.verificationToken.deleteMany({ where: { identifier: email } }),
      prisma.verificationToken.create({
        data: { identifier: email, token, expires },
      }),
    ]);

    const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    const tmpl = welcomeVerifyEmail({ name: user.name ?? "", verifyUrl });

    try {
      await sendEmail({
        to: email,
        subject: tmpl.subject,
        html: tmpl.html,
        text: tmpl.text,
        tags: [{ name: "type", value: "resend_verify" }],
      });
    } catch (e) {
      console.error("[auth/resend-verification] email send failed:", e);
      // Mesma resposta genérica — user pode tentar de novo depois.
    }

    return Response.json(GENERIC_OK);
  } catch (error) {
    console.error("[auth/resend-verification] unexpected error:", error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Não foi possível reenviar agora." },
      { status: 500 },
    );
  }
}
