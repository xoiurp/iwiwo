import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

function formatBRL(value: unknown): string {
  // Prisma returns Decimal; stringify safely
  const n =
    typeof value === "number"
      ? value
      : value == null
      ? 0
      : Number(value.toString());
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function orderStatusLabel(status: string | null | undefined): {
  label: string;
  variant: "info" | "success" | "warn" | "error" | "default";
} {
  const s = (status ?? "").toLowerCase();
  switch (s) {
    case "paid":
    case "approved":
    case "completed":
      return { label: "Pago", variant: "success" };
    case "pending":
    case "awaiting_payment":
      return { label: "Aguardando pagamento", variant: "warn" };
    case "shipped":
    case "in_transit":
      return { label: "Enviado", variant: "info" };
    case "delivered":
      return { label: "Entregue", variant: "success" };
    case "cancelled":
    case "canceled":
      return { label: "Cancelado", variant: "error" };
    case "refunded":
      return { label: "Reembolsado", variant: "error" };
    default:
      return { label: status || "—", variant: "default" };
  }
}

function ticketStatusLabel(
  status: "OPEN" | "WAITING_CUSTOMER" | "ANSWERED" | "CLOSED"
): { label: string; variant: "info" | "success" | "warn" | "error" | "default" } {
  switch (status) {
    case "OPEN":
      return { label: "Aberto", variant: "info" };
    case "WAITING_CUSTOMER":
      return { label: "Aguardando você", variant: "warn" };
    case "ANSWERED":
      return { label: "Respondido", variant: "success" };
    case "CLOSED":
      return { label: "Fechado", variant: "default" };
    default:
      return { label: status, variant: "default" };
  }
}

function badgeClass(
  variant: "info" | "success" | "warn" | "error" | "default"
): string {
  switch (variant) {
    case "success":
      return "conta-badge conta-badge-success";
    case "warn":
      return "conta-badge conta-badge-warn";
    case "error":
      return "conta-badge conta-badge-error";
    case "info":
      return "conta-badge conta-badge-info";
    default:
      return "conta-badge";
  }
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/conta/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, emailVerified: true, name: true },
  });
  if (!user) redirect("/conta/login");

  const customer = await prisma.customer.findUnique({
    where: { userId: user.id },
    include: {
      orders: {
        take: 3,
        orderBy: { createdAt: "desc" },
        include: { orderItems: true },
      },
      supportTickets: {
        take: 3,
        orderBy: { updatedAt: "desc" },
      },
      _count: { select: { addresses: true } },
    },
  });

  const firstName = (customer?.name || user.name || user.email || "")
    .split(" ")[0]
    ?.trim();

  const orders = customer?.orders ?? [];
  const tickets = customer?.supportTickets ?? [];
  const addressCount = customer?._count.addresses ?? 0;

  return (
    <div>
      <h1 className="conta-heading">Olá, {firstName || "cliente"}</h1>
      <p className="conta-subheading">
        Acompanhe seus pedidos, tickets de suporte e dados da conta.
      </p>

      <div className="conta-grid">
        {/* Pedidos recentes */}
        <section className="conta-card" aria-labelledby="dash-orders-title">
          <div className="conta-card-header">
            <h2 id="dash-orders-title" className="conta-card-title">
              Pedidos recentes
            </h2>
            <Link href="/conta/pedidos" className="conta-card-link">
              Ver todos
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="conta-empty">Você ainda não tem pedidos.</p>
          ) : (
            <ul className="conta-list">
              {orders.map((o) => {
                const s = orderStatusLabel(o.status);
                return (
                  <li key={o.id} className="conta-list-item">
                    <div className="conta-list-main">
                      <span className="conta-list-title">#{o.id}</span>
                      <span className="conta-list-meta">
                        {formatDate(o.createdAt)} · {o.orderItems.length}{" "}
                        {o.orderItems.length === 1 ? "item" : "itens"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span className={badgeClass(s.variant)}>{s.label}</span>
                      <span className="conta-list-value">
                        {formatBRL(o.total)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Suporte */}
        <section className="conta-card" aria-labelledby="dash-support-title">
          <div className="conta-card-header">
            <h2 id="dash-support-title" className="conta-card-title">
              Suporte
            </h2>
            <Link href="/conta/suporte" className="conta-card-link">
              Ver todos
            </Link>
          </div>
          {tickets.length === 0 ? (
            <p className="conta-empty">Nenhum ticket aberto.</p>
          ) : (
            <ul className="conta-list">
              {tickets.map((t) => {
                const s = ticketStatusLabel(t.status);
                return (
                  <li key={t.id} className="conta-list-item">
                    <div className="conta-list-main">
                      <span className="conta-list-title">{t.subject}</span>
                      <span className="conta-list-meta">
                        Atualizado em {formatDate(t.updatedAt)}
                      </span>
                    </div>
                    <span className={badgeClass(s.variant)}>{s.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Quick stats do perfil */}
        <section className="conta-card" aria-labelledby="dash-profile-title">
          <div className="conta-card-header">
            <h2 id="dash-profile-title" className="conta-card-title">
              Seu perfil
            </h2>
            <Link href="/conta/perfil" className="conta-card-link">
              Editar
            </Link>
          </div>
          <div className="conta-stat-grid">
            <div className="conta-stat">
              <span className="conta-stat-label">Email</span>
              <span className="conta-stat-value">
                <span title={user.email ?? ""}>{user.email}</span>
                {user.emailVerified ? (
                  <span className="conta-badge conta-badge-success">
                    Verificado
                  </span>
                ) : (
                  <span className="conta-badge conta-badge-warn">
                    Não verificado
                  </span>
                )}
              </span>
            </div>
            <div className="conta-stat">
              <span className="conta-stat-label">Nome</span>
              <span className="conta-stat-value">
                {customer?.name || user.name || "—"}
              </span>
            </div>
            <div className="conta-stat">
              <span className="conta-stat-label">CPF</span>
              <span className="conta-stat-value">{customer?.cpf || "—"}</span>
            </div>
            <div className="conta-stat">
              <span className="conta-stat-label">Endereços</span>
              <span className="conta-stat-value">
                {addressCount}{" "}
                <Link href="/conta/enderecos" className="conta-card-link">
                  {addressCount > 0 ? "gerenciar" : "adicionar"}
                </Link>
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
