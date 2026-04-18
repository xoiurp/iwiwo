// app/api/auth/forgot-password/route.ts
// Request a password reset link. Always returns 200 with a generic message so
// this endpoint cannot be used to enumerate registered emails. Server-side
// logs expose the actual outcome for debugging without leaking to clients.

import { randomBytes } from "node:crypto";
import { prisma } from "@/app/lib/prisma";
import { sendEmail, APP_URL } from "@/app/lib/email";
import { passwordResetEmail } from "@/app/lib/email-templates";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_BYTES = 48;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

// TODO: add per-email + per-IP rate limiting (Upstash Redis or in-memory LRU
// with a 1/min cap) before public launch. Currently enumeration-safe but
// abuse-prone (attacker can mail-bomb a target).

type ForgotBody = { email?: unknown };

const GENERIC = {
  success: true,
  message:
    "Se este email estiver cadastrado, enviaremos um link para redefinir a senha.",
};

export async function POST(request: Request) {
  let body: ForgotBody;
  try {
    body = (await request.json()) as ForgotBody;
  } catch {
    console.warn("[auth/forgot-password] invalid JSON body");
    return Response.json(GENERIC);
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    console.warn("[auth/forgot-password] invalid email format:", email);
    return Response.json(GENERIC);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, emailVerified: true },
    });

    if (!user) {
      console.info(
        "[auth/forgot-password] no user for email (silent no-op):",
        email,
      );
      return Response.json(GENERIC);
    }

    const token = randomBytes(TOKEN_BYTES).toString("hex");
    const expires = new Date(Date.now() + TOKEN_TTL_MS);

    // Clean old tokens for this identifier so multiple requests don't pile up.
    await prisma.$transaction([
      prisma.verificationToken.deleteMany({ where: { identifier: email } }),
      prisma.verificationToken.create({
        data: { identifier: email, token, expires },
      }),
    ]);

    const resetUrl = `${APP_URL}/conta/redefinir-senha?token=${encodeURIComponent(token)}`;
    const tmpl = passwordResetEmail({ name: user.name, resetUrl });

    console.info("[auth/forgot-password] sending reset email to:", email, {
      emailVerified: user.emailVerified ? "verified" : "unverified",
      appUrl: APP_URL,
    });

    try {
      const result = await sendEmail({
        to: email,
        subject: tmpl.subject,
        html: tmpl.html,
        text: tmpl.text,
        tags: [{ name: "type", value: "password_reset" }],
      });
      console.info("[auth/forgot-password] reset email sent:", {
        email,
        resendId: "id" in result ? result.id : undefined,
        skipped: "skipped" in result ? result.skipped : undefined,
      });
    } catch (e) {
      console.error("[auth/forgot-password] email send failed:", e);
    }

    return Response.json(GENERIC);
  } catch (error) {
    console.error("[auth/forgot-password] unexpected error:", error);
    return Response.json(GENERIC);
  }
}
