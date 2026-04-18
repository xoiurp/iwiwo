// app/api/support/tickets/[id]/messages/route.ts
// POST a new customer message onto an existing ticket the customer owns.
// Side effects:
//   - If the ticket was ANSWERED (awaiting customer input), transition to
//     WAITING_CUSTOMER to reflect that the customer just replied. Any other
//     status is left untouched (closed tickets reject the reply).
//   - Touch the ticket's updatedAt so the list view surfaces it first.
//   - Fire-and-forget admin notification email if ADMIN_NOTIFY_EMAIL is set.

import { auth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { sendEmail, APP_URL } from '@/app/lib/email';
import { ticketReplyAdminNotify } from '@/app/lib/email-templates';
import { AuthorType, TicketStatus } from '@prisma/client';

export const runtime = 'nodejs';

function bad(error: string, message: string, status = 400) {
  return Response.json({ error, message }, { status });
}

type PostBody = { body?: unknown };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return bad('UNAUTHENTICATED', 'Faça login para responder ao ticket.', 401);
  }

  const { id } = await params;
  const ticketId = Number.parseInt(id, 10);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    return bad('INVALID_ID', 'ID de ticket inválido.');
  }

  let payload: PostBody;
  try {
    payload = (await request.json()) as PostBody;
  } catch {
    return bad('INVALID_JSON', 'Corpo da requisição inválido.');
  }

  const messageBody =
    typeof payload.body === 'string' ? payload.body.trim() : '';
  if (messageBody.length < 1) {
    return bad('INVALID_BODY', 'A mensagem não pode ficar em branco.');
  }
  if (messageBody.length > 5000) {
    return bad('INVALID_BODY', 'A mensagem é muito longa (máx. 5000).');
  }

  const customer = await prisma.customer.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true, name: true, email: true },
  });
  if (!customer) {
    return bad('CUSTOMER_NOT_FOUND', 'Perfil de cliente não encontrado.', 404);
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      customerId: true,
      status: true,
      subject: true,
    },
  });
  if (!ticket) {
    return bad('NOT_FOUND', 'Ticket não encontrado.', 404);
  }
  if (ticket.customerId !== customer.id) {
    return bad('FORBIDDEN', 'Você não pode responder a este ticket.', 403);
  }
  if (ticket.status === TicketStatus.CLOSED) {
    return bad(
      'TICKET_CLOSED',
      'Este ticket foi fechado. Abra um novo para continuar.',
      409
    );
  }

  const authorName =
    customer.name?.trim() ||
    session.user.name?.trim() ||
    customer.email ||
    'Cliente';

  // Only escalate ANSWERED → WAITING_CUSTOMER. Leave OPEN/WAITING_CUSTOMER
  // as-is (customer is padding context before any admin has responded).
  const nextStatus =
    ticket.status === TicketStatus.ANSWERED
      ? TicketStatus.WAITING_CUSTOMER
      : ticket.status;

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        authorType: AuthorType.CUSTOMER,
        authorName,
        body: messageBody,
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
        updatedAt: new Date(),
      },
    }),
  ]);

  const adminTo = process.env.ADMIN_NOTIFY_EMAIL;
  if (adminTo) {
    const tmpl = ticketReplyAdminNotify({
      ticketId: ticket.id,
      subject: ticket.subject,
      customerName: customer.name,
      preview: messageBody,
      adminUrl: `${APP_URL}/admin/suporte/${ticket.id}`,
    });
    sendEmail({
      to: adminTo,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
      tags: [{ name: 'type', value: 'ticket_customer_reply' }],
    }).catch((e) =>
      console.error('[support/tickets/messages] admin email failed:', e)
    );
  }

  return Response.json({ message }, { status: 201 });
}
