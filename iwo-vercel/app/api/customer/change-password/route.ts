// app/api/customer/change-password/route.ts
// Authenticated password change: verifies current password with bcrypt,
// then hashes and stores the new one at cost 12. Does not rotate sessions.

import bcrypt from "bcryptjs";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const BCRYPT_COST = 12;

function bad(error: string, message: string, status = 400) {
  return Response.json({ error, message }, { status });
}

type Body = {
  currentPassword?: unknown;
  newPassword?: unknown;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return bad("UNAUTHORIZED", "Não autenticado.", 401);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("INVALID_JSON", "Corpo da requisição inválido.");
  }

  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword) {
    return bad("MISSING_CURRENT", "Informe sua senha atual.");
  }
  if (!PASSWORD_RE.test(newPassword)) {
    return bad(
      "INVALID_PASSWORD",
      "A nova senha precisa ter ao menos 8 caracteres, com letras e números."
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, passwordHash: true },
    });
    if (!user?.passwordHash) {
      return bad(
        "NO_PASSWORD",
        "Esta conta não possui senha definida.",
        400
      );
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return bad(
        "INVALID_CURRENT_PASSWORD",
        "Senha atual incorreta.",
        400
      );
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[customer/change-password] unexpected error:", error);
    return Response.json(
      {
        error: "INTERNAL_ERROR",
        message: "Não foi possível alterar a senha.",
      },
      { status: 500 }
    );
  }
}
