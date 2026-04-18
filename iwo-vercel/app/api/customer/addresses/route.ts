// app/api/customer/addresses/route.ts
// GET: list the caller's addresses (ordered default-first, then newest).
// POST: create a new address, demoting any existing default when isDefault=true.

import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

const CEP_RE = /^\d{5}-\d{3}$/;
const UF_RE = /^[A-Z]{2}$/;
const BR_UF = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

function bad(error: string, message: string, status = 400) {
  return Response.json({ error, message }, { status });
}

async function resolveCustomerId(email: string): Promise<number | null> {
  const c = await prisma.customer.findFirst({
    where: { user: { email } },
    select: { id: true },
  });
  return c?.id ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return bad("UNAUTHORIZED", "Não autenticado.", 401);
  }
  const customerId = await resolveCustomerId(session.user.email);
  if (!customerId) return Response.json({ addresses: [] });

  const addresses = await prisma.address.findMany({
    where: { customerId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return Response.json({ addresses });
}

type AddressBody = {
  label?: unknown;
  recipient?: unknown;
  cep?: unknown;
  street?: unknown;
  number?: unknown;
  complement?: unknown;
  neighborhood?: unknown;
  city?: unknown;
  state?: unknown;
  country?: unknown;
  isDefault?: unknown;
};

type ValidatedAddress = {
  label: string | null;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  isDefault: boolean;
};

export function validateAddressBody(
  body: AddressBody
): { ok: true; data: ValidatedAddress } | { ok: false; code: string; message: string } {
  const label =
    typeof body.label === "string" && body.label.trim().length > 0
      ? body.label.trim().slice(0, 50)
      : null;
  const recipient =
    typeof body.recipient === "string" ? body.recipient.trim() : "";
  if (!recipient) {
    return { ok: false, code: "INVALID_RECIPIENT", message: "Informe o destinatário." };
  }

  const cep = typeof body.cep === "string" ? body.cep.trim() : "";
  if (!CEP_RE.test(cep)) {
    return { ok: false, code: "INVALID_CEP", message: "CEP deve ter o formato 00000-000." };
  }

  const street = typeof body.street === "string" ? body.street.trim() : "";
  if (!street) {
    return { ok: false, code: "INVALID_STREET", message: "Informe a rua." };
  }

  const number = typeof body.number === "string" ? body.number.trim() : "";
  if (!number) {
    return { ok: false, code: "INVALID_NUMBER", message: "Informe o número." };
  }

  const complement =
    typeof body.complement === "string" && body.complement.trim().length > 0
      ? body.complement.trim()
      : null;

  const neighborhood =
    typeof body.neighborhood === "string" ? body.neighborhood.trim() : "";
  if (!neighborhood) {
    return { ok: false, code: "INVALID_NEIGHBORHOOD", message: "Informe o bairro." };
  }

  const city = typeof body.city === "string" ? body.city.trim() : "";
  if (!city) {
    return { ok: false, code: "INVALID_CITY", message: "Informe a cidade." };
  }

  const stateRaw = typeof body.state === "string" ? body.state.trim().toUpperCase() : "";
  if (!UF_RE.test(stateRaw) || !BR_UF.has(stateRaw)) {
    return { ok: false, code: "INVALID_STATE", message: "UF inválida." };
  }

  const country =
    typeof body.country === "string" && body.country.trim().length === 2
      ? body.country.trim().toUpperCase()
      : "BR";

  const isDefault =
    typeof body.isDefault === "boolean" ? body.isDefault : false;

  return {
    ok: true,
    data: {
      label,
      recipient,
      cep,
      street,
      number,
      complement,
      neighborhood,
      city,
      state: stateRaw,
      country,
      isDefault,
    },
  };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return bad("UNAUTHORIZED", "Não autenticado.", 401);
  }
  const customerId = await resolveCustomerId(session.user.email);
  if (!customerId) {
    return bad("NO_CUSTOMER", "Perfil de cliente não encontrado.", 404);
  }

  let body: AddressBody;
  try {
    body = (await request.json()) as AddressBody;
  } catch {
    return bad("INVALID_JSON", "Corpo da requisição inválido.");
  }

  const v = validateAddressBody(body);
  if (!v.ok) return bad(v.code, v.message);

  try {
    const address = await prisma.$transaction(async (tx) => {
      if (v.data.isDefault) {
        await tx.address.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: { ...v.data, customerId },
      });
    });

    return Response.json({ address }, { status: 201 });
  } catch (error) {
    console.error("[customer/addresses POST] unexpected error:", error);
    return Response.json(
      {
        error: "INTERNAL_ERROR",
        message: "Não foi possível criar o endereço.",
      },
      { status: 500 }
    );
  }
}
