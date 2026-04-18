// app/api/customer/addresses/[id]/route.ts
// GET / PUT / DELETE for a single address, verifying ownership by joining
// through the caller's Customer row.

import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { validateAddressBody } from "../route";

export const runtime = "nodejs";

function bad(error: string, message: string, status = 400) {
  return Response.json({ error, message }, { status });
}

async function getCallerCustomerId(email: string): Promise<number | null> {
  const c = await prisma.customer.findFirst({
    where: { user: { email } },
    select: { id: true },
  });
  return c?.id ?? null;
}

function parseId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) {
    return bad("UNAUTHORIZED", "Não autenticado.", 401);
  }

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) return bad("INVALID_ID", "ID inválido.");

  const customerId = await getCallerCustomerId(session.user.email);
  if (!customerId) {
    return bad("NO_CUSTOMER", "Perfil de cliente não encontrado.", 404);
  }

  const address = await prisma.address.findUnique({ where: { id } });
  if (!address) return bad("NOT_FOUND", "Endereço não encontrado.", 404);
  if (address.customerId !== customerId) {
    return bad("FORBIDDEN", "Acesso negado.", 403);
  }

  return Response.json({ address });
}

export async function PUT(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) {
    return bad("UNAUTHORIZED", "Não autenticado.", 401);
  }

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) return bad("INVALID_ID", "ID inválido.");

  const customerId = await getCallerCustomerId(session.user.email);
  if (!customerId) {
    return bad("NO_CUSTOMER", "Perfil de cliente não encontrado.", 404);
  }

  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing) return bad("NOT_FOUND", "Endereço não encontrado.", 404);
  if (existing.customerId !== customerId) {
    return bad("FORBIDDEN", "Acesso negado.", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("INVALID_JSON", "Corpo da requisição inválido.");
  }

  const v = validateAddressBody(body as Parameters<typeof validateAddressBody>[0]);
  if (!v.ok) return bad(v.code, v.message);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (v.data.isDefault) {
        await tx.address.updateMany({
          where: { customerId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return tx.address.update({
        where: { id },
        data: v.data,
      });
    });

    return Response.json({ address: updated });
  } catch (error) {
    console.error("[customer/addresses PUT] unexpected error:", error);
    return Response.json(
      {
        error: "INTERNAL_ERROR",
        message: "Não foi possível atualizar o endereço.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) {
    return bad("UNAUTHORIZED", "Não autenticado.", 401);
  }

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) return bad("INVALID_ID", "ID inválido.");

  const customerId = await getCallerCustomerId(session.user.email);
  if (!customerId) {
    return bad("NO_CUSTOMER", "Perfil de cliente não encontrado.", 404);
  }

  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing) return bad("NOT_FOUND", "Endereço não encontrado.", 404);
  if (existing.customerId !== customerId) {
    return bad("FORBIDDEN", "Acesso negado.", 403);
  }

  try {
    await prisma.address.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("[customer/addresses DELETE] unexpected error:", error);
    return Response.json(
      {
        error: "INTERNAL_ERROR",
        message: "Não foi possível remover o endereço.",
      },
      { status: 500 }
    );
  }
}
