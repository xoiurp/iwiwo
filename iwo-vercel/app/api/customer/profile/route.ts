// app/api/customer/profile/route.ts
// GET: returns the current user's profile (User + Customer, without passwordHash).
// PATCH: updates name, phone, cpf, birthDate on the Customer row.
//        Never mutates email or passwordHash.

import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

const CPF_RE = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const PHONE_DIGITS_RE = /^\d{10,11}$/;

function bad(error: string, message: string, status = 400) {
  return Response.json({ error, message }, { status });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return bad("UNAUTHORIZED", "Não autenticado.", 401);
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          cpf: true,
          birthDate: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!user) {
    return bad("NOT_FOUND", "Usuário não encontrado.", 404);
  }

  return Response.json({ user });
}

type PatchBody = {
  name?: unknown;
  phone?: unknown;
  cpf?: unknown;
  birthDate?: unknown;
};

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return bad("UNAUTHORIZED", "Não autenticado.", 401);
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return bad("INVALID_JSON", "Corpo da requisição inválido.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : null;
  if (name === null || name.length < 2) {
    return bad("INVALID_NAME", "Informe seu nome (mínimo 2 caracteres).");
  }

  let phone: string | null = null;
  if (typeof body.phone === "string" && body.phone.trim().length > 0) {
    const trimmed = body.phone.trim();
    const digits = trimmed.replace(/\D/g, "");
    if (!PHONE_DIGITS_RE.test(digits)) {
      return bad("INVALID_PHONE", "Telefone deve ter 10 ou 11 dígitos.");
    }
    phone = trimmed;
  } else if (body.phone === null || body.phone === "") {
    phone = null;
  }

  let cpf: string | null = null;
  if (typeof body.cpf === "string" && body.cpf.trim().length > 0) {
    const trimmed = body.cpf.trim();
    if (!CPF_RE.test(trimmed)) {
      return bad(
        "INVALID_CPF",
        "CPF deve estar no formato 000.000.000-00."
      );
    }
    cpf = trimmed;
  } else if (body.cpf === null || body.cpf === "") {
    cpf = null;
  }

  let birthDate: Date | null = null;
  if (typeof body.birthDate === "string" && body.birthDate.trim().length > 0) {
    const trimmed = body.birthDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return bad("INVALID_BIRTH", "Data de nascimento inválida.");
    }
    const d = new Date(`${trimmed}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      return bad("INVALID_BIRTH", "Data de nascimento inválida.");
    }
    birthDate = d;
  } else if (body.birthDate === null || body.birthDate === "") {
    birthDate = null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, customer: { select: { id: true } } },
    });
    if (!user) return bad("NOT_FOUND", "Usuário não encontrado.", 404);

    if (!user.customer) {
      // Create a customer row if one is missing (edge case for legacy users)
      const created = await prisma.customer.create({
        data: {
          userId: user.id,
          email: session.user.email,
          name,
          phone,
          cpf,
          birthDate,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          cpf: true,
          birthDate: true,
        },
      });
      // Keep User.name in sync with Customer.name when updated from this form
      await prisma.user.update({
        where: { id: user.id },
        data: { name },
      });
      return Response.json({ customer: created });
    }

    const updated = await prisma.customer.update({
      where: { id: user.customer.id },
      data: { name, phone, cpf, birthDate },
      select: {
        id: true,
        name: true,
        phone: true,
        cpf: true,
        birthDate: true,
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { name },
    });

    return Response.json({ customer: updated });
  } catch (error: unknown) {
    const err = error as { code?: string; meta?: { target?: string[] } };
    if (err?.code === "P2002") {
      const target = err.meta?.target?.join(",") || "";
      if (target.includes("cpf")) {
        return bad("CPF_EXISTS", "Este CPF já está em uso.", 409);
      }
    }
    console.error("[customer/profile PATCH] unexpected error:", error);
    return Response.json(
      {
        error: "INTERNAL_ERROR",
        message: "Não foi possível atualizar o perfil.",
      },
      { status: 500 }
    );
  }
}
