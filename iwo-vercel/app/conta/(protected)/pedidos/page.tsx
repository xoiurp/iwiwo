// app/conta/(protected)/pedidos/page.tsx
// Customer-facing order list (Server Component). proxy.ts should redirect
// unauthenticated users upstream, but we re-check session defensively.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { formatBRL, formatDateBR } from "@/app/lib/format";
import { StatusBadge } from "./_components/StatusBadge";
import styles from "./_components/OrderList.module.css";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const session = await auth();
  const userId = session?.user
    ? (session.user as typeof session.user & { id?: string }).id
    : undefined;
  const userEmail = session?.user?.email ?? undefined;

  if (!session?.user || (!userId && !userEmail)) {
    redirect("/conta/login?from=/conta/pedidos");
  }

  // Locate the Customer row linked to the session. userId is the primary
  // lookup; fall back to email for any edge case where the Customer row
  // was created by a different flow (legacy import, manual seed).
  const customer = userId
    ? await prisma.customer.findUnique({ where: { userId } })
    : userEmail
      ? await prisma.customer.findUnique({ where: { email: userEmail } })
      : null;

  const fallbackByEmail =
    !customer && userEmail
      ? await prisma.customer.findUnique({ where: { email: userEmail } })
      : null;

  const resolvedCustomer = customer ?? fallbackByEmail;

  const orders = resolvedCustomer
    ? await prisma.order.findMany({
        where: { customerId: resolvedCustomer.id },
        orderBy: { createdAt: "desc" },
        include: { orderItems: { take: 3 } },
      })
    : [];

  if (orders.length === 0) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Meus Pedidos</h1>
        <div className={styles.empty}>
          <p className={styles.emptyText}>Você ainda não tem pedidos.</p>
          <Link href="/" className={styles.emptyCta}>
            Ir pra loja
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Meus Pedidos</h1>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Data</th>
              <th>Itens</th>
              <th>Status</th>
              <th>Total</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const itemCount = Array.isArray(order.items)
                ? (order.items as unknown[]).length
                : order.orderItems.length;
              const extra = Math.max(0, itemCount - order.orderItems.length);

              return (
                <tr key={order.id}>
                  <td data-label="Pedido">
                    <span className={styles.orderId}>#{order.id}</span>
                  </td>
                  <td data-label="Data">
                    <span className={styles.date}>
                      {formatDateBR(order.createdAt ?? new Date())}
                    </span>
                  </td>
                  <td data-label="Itens">
                    <span className={styles.thumbs}>
                      {order.orderItems.map((item) =>
                        item.image ? (
                          <img
                            key={item.id}
                            className={styles.thumb}
                            src={item.image}
                            alt={item.productName}
                            loading="lazy"
                          />
                        ) : (
                          <span
                            key={item.id}
                            className={styles.thumb}
                            aria-hidden="true"
                          />
                        )
                      )}
                      {extra > 0 ? (
                        <span className={styles.thumbMore}>+{extra}</span>
                      ) : null}
                    </span>
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={order.status} />
                  </td>
                  <td data-label="Total">
                    <span className={styles.total}>
                      {formatBRL(order.total ?? 0)}
                    </span>
                  </td>
                  <td data-label="">
                    <Link
                      href={`/conta/pedidos/${order.id}`}
                      className={styles.detailLink}
                    >
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
