// app/api/support/tickets/[id]/route.ts
// Customer-facing single-ticket endpoint.
// - GET:   fetch ticket + ordered messages, scoped to the current customer.
// - PATCH: allows the owner to close their own ticket. Customers cannot
//          re-open, reassign priority, or touch admin-side fields. Admins use
//          a separate /api/admin/support endpoint — not this route.

import { auth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { TicketStatus } from '@prisma/client';

export const runtime = 'nodejs';

function bad(error: string, message: string, status = 400) {
  return Response.json({ error, message }, { status });
}

async function resolveCustomerId(email: string | null | undefined) {
  if (!email) return null;
  const customer = await prisma.customer.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  return customer?.id ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return bad('UNAUTHENTICATED', 'Faça login para acessar o ticket.', 401);
  }

  const { id } = await params;
  const ticketId = Number.parseInt(id, 10);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    return bad('INVALID_ID', 'ID de ticket inválido.');
  }

  const customerId = await resolveCustomerId(session.user.email);
  if (!customerId) {
    return bad('CUSTOMER_NOT_FOUND', 'Perfil de cliente não encontrado.', 404);
  }

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, customerId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!ticket) {
    return bad('NOT_FOUND', 'Ticket não encontrado.', 404);
  }

  return Response.json({ ticket });
}

type PatchBody = { status?: unknown };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return bad('UNAUTHENTICATED', 'Faça login para atualizar o ticket.', 401);
  }

  const { id } = await params;
  const ticketId = Number.parseInt(id, 10);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    return bad('INVALID_ID', 'ID de ticket inválido.');
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return bad('INVALID_JSON', 'Corpo da requisição inválido.');
  }

  if (body.status !== TicketStatus.CLOSED) {
    return bad(
      'INVALID_STATUS',
      'Clientes só podem fechar seus próprios tickets.'
    );
  }

  const customerId = await resolveCustomerId(session.user.email);
  if (!customerId) {
    return bad('CUSTOMER_NOT_FOUND', 'Perfil de cliente não encontrado.', 404);
  }

  const existing = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, customerId: true, status: true },
  });
  if (!existing) {
    return bad('NOT_FOUND', 'Ticket não encontrado.', 404);
  }
  if (existing.customerId !== customerId) {
    return bad('FORBIDDEN', 'Você não pode modificar este ticket.', 403);
  }
  if (existing.status === TicketStatus.CLOSED) {
    return Response.json({ ok: true, alreadyClosed: true });
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status: TicketStatus.CLOSED,
      closedAt: new Date(),
    },
    select: { id: true, status: true, closedAt: true },
  });

  return Response.json({ ok: true, ticket: updated });
}
