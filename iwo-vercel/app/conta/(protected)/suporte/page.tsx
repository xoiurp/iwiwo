// app/conta/(protected)/suporte/page.tsx
// Server component — lists the customer's support tickets.
// We hit Prisma directly instead of fetching the internal JSON API to avoid
// the extra round-trip + JSON serialization hop on every request.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import StatusBadge from "./_components/StatusBadge";
import PriorityBadge from "./_components/PriorityBadge";
import styles from "./suporte.module.css";

export const dynamic = "force-dynamic";

const RELATIVE_FMT = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

function formatRelative(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
  ];

  let value = diffSec;
  for (const [unit, step] of units) {
    if (Math.abs(value) < step) {
      return RELATIVE_FMT.format(value, unit);
    }
    value = Math.round(value / step);
  }
  return RELATIVE_FMT.format(value, "year");
}

export default async function SuportePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/conta/login");

  const customer = await prisma.customer.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true },
  });
  if (!customer) redirect("/conta/login");

  const tickets = await prisma.supportTicket.findMany({
    where: { customerId: customer.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Suporte</h1>
          <p className={styles.subtitle}>
            Acompanhe suas solicitações ou abra um novo ticket.
          </p>
        </div>
        <Link href="/conta/suporte/novo" className={styles.newCta}>
          Novo ticket
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>Nenhum ticket aberto.</p>
          <Link href="/conta/suporte/novo" className={styles.newCta}>
            Abrir novo
          </Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/conta/suporte/${t.id}`} className={styles.card}>
                <div className={styles.cardTop}>
                  <h2 className={styles.cardSubject}>{t.subject}</h2>
                  <div className={styles.cardMeta}>
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                  </div>
                </div>
                <div className={styles.cardBottom}>
                  <span>
                    {t._count.messages}{" "}
                    {t._count.messages === 1 ? "mensagem" : "mensagens"} ·
                    atualizado {formatRelative(t.updatedAt)}
                  </span>
                  <span className={styles.cardLink}>Ver thread →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
