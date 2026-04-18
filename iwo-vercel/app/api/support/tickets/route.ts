// app/api/support/tickets/route.ts
// Customer-facing support tickets endpoint.
// - GET:  list tickets owned by the currently authenticated customer.
// - POST: create a new ticket + seed initial CUSTOMER message (transactional).
//
// Admin-side endpoints live under /api/admin/support (future W3a track) and
// are intentionally separate — this file must never return tickets belonging
// to another customer and must never accept status transitions other than the
// ones a customer is allowed to perform.

import { auth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { sendEmail, APP_URL } from '@/app/lib/email';
import {
  ticketCreatedEmail,
  ticketAdminCreatedNotify,
} from '@/app/lib/email-templates';
import {
  AuthorType,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';

export const runtime = 'nodejs';

function bad(error: string, message: string, status = 400) {
  return Response.json({ error, message }, { status });
}

function parsePriority(value: unknown): TicketPriority {
  if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH') {
    return value as TicketPriority;
  }
  return TicketPriority.MEDIUM;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return bad('UNAUTHENTICATED', 'Faça login para acessar o suporte.', 401);
  }

  const customer = await prisma.customer.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true },
  });
  if (!customer) {
    return bad('CUSTOMER_NOT_FOUND', 'Perfil de cliente não encontrado.', 404);
  }

  const tickets = await prisma.supportTicket.findMany({
    where: { customerId: customer.id },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { messages: true } } },
  });

  return Response.json({ tickets });
}

type CreateBody = {
  subject?: unknown;
  description?: unknown;
  priority?: unknown;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return bad('UNAUTHENTICATED', 'Faça login para abrir um ticket.', 401);
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return bad('INVALID_JSON', 'Corpo da requisição inválido.');
  }

  const subject =
    typeof body.subject === 'string' ? body.subject.trim() : '';
  const description =
    typeof body.description === 'string' ? body.description.trim() : '';
  const priority = parsePriority(body.priority);

  if (subject.length < 3 || subject.length > 255) {
    return bad(
      'INVALID_SUBJECT',
      'O assunto deve ter entre 3 e 255 caracteres.'
    );
  }
  if (description.length < 10) {
    return bad(
      'INVALID_DESCRIPTION',
      'A descrição deve ter ao menos 10 caracteres.'
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true, name: true, email: true },
  });
  if (!customer) {
    return bad('CUSTOMER_NOT_FOUND', 'Perfil de cliente não encontrado.', 404);
  }

  const authorName =
    customer.name?.trim() ||
    session.user.name?.trim() ||
    customer.email ||
    'Cliente';

  try {
    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: {
          customerId: customer.id,
          subject,
          description,
          priority,
          status: TicketStatus.OPEN,
        },
        select: { id: true, subject: true, priority: true },
      });

      await tx.supportMessage.create({
        data: {
          ticketId: created.id,
          authorType: AuthorType.CUSTOMER,
          authorName,
          body: description,
        },
      });

      return created;
    });

    // Fire-and-forget notifications. Never let email failures block the
    // response — we already persisted the ticket.
    const customerTmpl = ticketCreatedEmail({
      ticketId: ticket.id,
      subject: ticket.subject,
      customerName: customer.name,
    });
    sendEmail({
      to: customer.email,
      subject: customerTmpl.subject,
      html: customerTmpl.html,
      text: customerTmpl.text,
      tags: [{ name: 'type', value: 'ticket_created' }],
    }).catch((e) =>
      console.error('[support/tickets] customer email failed:', e)
    );

    const adminTo = process.env.ADMIN_NOTIFY_EMAIL;
    if (adminTo) {
      const adminTmpl = ticketAdminCreatedNotify({
        ticketId: ticket.id,
        subject: ticket.subject,
        customerName: customer.name,
        customerEmail: customer.email,
        priority: ticket.priority,
        description,
        adminUrl: `${APP_URL}/admin/suporte/${ticket.id}`,
      });
      sendEmail({
        to: adminTo,
        subject: adminTmpl.subject,
        html: adminTmpl.html,
        text: adminTmpl.text,
        tags: [{ name: 'type', value: 'ticket_admin_notify' }],
      }).catch((e) =>
        console.error('[support/tickets] admin email failed:', e)
      );
    }

    return Response.json({ id: ticket.id }, { status: 201 });
  } catch (error) {
    console.error('[support/tickets] create failed:', error);
    return bad(
      'INTERNAL_ERROR',
      'Não foi possível abrir o ticket. Tente novamente.',
      500
    );
  }
}
