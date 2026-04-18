// app/conta/(protected)/suporte/[id]/page.tsx
// Server component that renders the ticket header + chat thread. Interactive
// pieces (close ticket, reply form) are client components imported locally.
// Ownership is enforced at query time — we only match on (id, customerId)
// and render a 404 otherwise.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { TicketStatus, AuthorType } from "@prisma/client";
import StatusBadge from "../_components/StatusBadge";
import PriorityBadge from "../_components/PriorityBadge";
import CloseTicketButton from "../_components/CloseTicketButton";
import ReplyForm from "../_components/ReplyForm";
import styles from "../suporte.module.css";

export const dynamic = "force-dynamic";

const RELATIVE_FMT = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

function formatRelative(date: Date): string {
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
  ];
  let value = diffSec;
  for (const [unit, step] of units) {
    if (Math.abs(value) < step) return RELATIVE_FMT.format(value, unit);
    value = Math.round(value / step);
  }
  return RELATIVE_FMT.format(value, "year");
}

function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/conta/login");

  const { id } = await params;
  const ticketId = Number.parseInt(id, 10);
  if (!Number.isFinite(ticketId) || ticketId <= 0) notFound();

  const customer = await prisma.customer.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true },
  });
  if (!customer) redirect("/conta/login");

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, customerId: customer.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) notFound();

  const isClosed = ticket.status === TicketStatus.CLOSED;

  return (
    <div className={styles.wrap}>
      <Link href="/conta/suporte" className={styles.backLink}>
        ← Voltar para suporte
      </Link>

      <div className={styles.detailHeader}>
        <div className={styles.detailTop}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className={styles.detailSubject}>{ticket.subject}</h1>
            <div className={styles.detailMeta}>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <span style={{ fontSize: 12, color: "#666" }}>
                Ticket #{ticket.id}
              </span>
            </div>
            <p className={styles.detailCreated}>
              Aberto em {formatFullDate(ticket.createdAt)}
            </p>
          </div>
          {!isClosed ? <CloseTicketButton ticketId={ticket.id} /> : null}
        </div>
      </div>

      <div className={styles.thread}>
        {ticket.messages.map((msg) => {
          const isCustomer = msg.authorType === AuthorType.CUSTOMER;
          return (
            <div
              key={msg.id}
              className={`${styles.row} ${
                isCustomer ? styles.rowCustomer : styles.rowAdmin
              }`}
            >
              <div
                className={`${styles.bubble} ${
                  isCustomer ? styles.bubbleCustomer : styles.bubbleAdmin
                }`}
              >
                {msg.body}
              </div>
              <div className={styles.meta}>
                {!isCustomer ? (
                  <span className={styles.adminTag}>Suporte</span>
                ) : null}
                <span>{msg.authorName}</span>
                <span>·</span>
                <span title={formatFullDate(msg.createdAt)}>
                  {formatRelative(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {isClosed ? (
        <div className={styles.closedNotice}>
          <span>Este ticket foi fechado.</span>
          <Link href="/conta/suporte/novo">Abrir novo ticket →</Link>
        </div>
      ) : (
        <ReplyForm ticketId={ticket.id} />
      )}
    </div>
  );
}
