// app/api/newsletter/subscribe/route.ts
// Newsletter opt-in endpoint.
// - Single-opt-in: inscreve direto (sem confirmação double-opt-in por ora).
// - Idempotente: reinscrever o mesmo email retorna sucesso sem criar duplicata.
// - Envia welcome email via Resend (falha no send não bloqueia inscrição).
// - TODO rate limit antes de produção.

import { prisma } from "@/app/lib/prisma";
import { sendEmail } from "@/app/lib/email";
import { newsletterWelcomeEmail } from "@/app/lib/email-templates";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = { email?: unknown; source?: unknown; name?: unknown };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json(
      { error: "INVALID_JSON", message: "Corpo inválido." },
      { status: 400 },
    );
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const source =
    typeof body.source === "string" && body.source.trim().length > 0
      ? body.source.trim().slice(0, 255)
      : null;
  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim().slice(0, 255)
      : null;

  if (!EMAIL_RE.test(email)) {
    return Response.json(
      { error: "INVALID_EMAIL", message: "Informe um email válido." },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });

    let created = false;
    if (existing) {
      // Reativa se já existia mas estava inativo (descadastrado anteriormente).
      if (!existing.isActive) {
        await prisma.newsletterSubscriber.update({
          where: { email },
          data: { isActive: true, source: source ?? undefined, name: name ?? undefined },
        });
      }
    } else {
      await prisma.newsletterSubscriber.create({
        data: { email, name, source, isActive: true, confirmedAt: new Date() },
      });
      created = true;
    }

    // Só envia welcome pra novas inscrições (evitar spam em reinscrições).
    if (created) {
      const tmpl = newsletterWelcomeEmail({ name });
      try {
        await sendEmail({
          to: email,
          subject: tmpl.subject,
          html: tmpl.html,
          text: tmpl.text,
          tags: [{ name: "type", value: "newsletter_welcome" }],
        });
      } catch (e) {
        console.error("[newsletter/subscribe] welcome email failed:", e);
      }
    }

    console.info("[newsletter/subscribe] ok", { email, created, source });

    return Response.json({
      success: true,
      message: created
        ? "Inscrição confirmada. Obrigado!"
        : "Este email já está inscrito. Obrigado!",
      created,
    });
  } catch (error) {
    console.error("[newsletter/subscribe] unexpected error:", error);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "Não foi possível concluir agora." },
      { status: 500 },
    );
  }
}
