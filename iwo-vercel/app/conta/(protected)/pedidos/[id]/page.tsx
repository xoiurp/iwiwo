// app/conta/(protected)/pedidos/[id]/page.tsx
// Order detail for the signed-in customer. Read-only view — direct Prisma
// query in a Server Component. Ownership is enforced by scoping the query
// to `customerId`, so a user can never open a pedido that isn't theirs
// even by guessing the numeric id.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { formatBRL, formatDateBR } from "@/app/lib/format";
import { StatusBadge } from "../_components/StatusBadge";
import styles from "../_components/OrderDetail.module.css";

export const dynamic = "force-dynamic";

function maskCpf(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  // Show only last 4 significant digits. Input can arrive as "123.456.789-00"
  // or raw digits — strip everything non-digit then re-mask.
  const digits = cpf.replace(/\D+/g, "");
  if (digits.length < 4) return "***";
  const last4 = digits.slice(-4);
  return `***.***.${last4.slice(0, 3)}-${last4.slice(3) || "*"}`;
}

type ShippingSnapshot = {
  shipping?: number | string;
  frete?: number | string;
  shippingPrice?: number | string;
} & Record<string, unknown>;

function extractShipping(items: unknown): number | null {
  if (!items || typeof items !== "object") return null;
  const bag = items as ShippingSnapshot;
  const raw = bag.shipping ?? bag.frete ?? bag.shippingPrice;
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) notFound();

  const session = await auth();
  const userId = session?.user
    ? (session.user as typeof session.user & { id?: string }).id
    : undefined;
  const userEmail = session?.user?.email ?? undefined;

  if (!session?.user || (!userId && !userEmail)) {
    redirect(`/conta/login?from=/conta/pedidos/${id}`);
  }

  const customer = userId
    ? await prisma.customer.findUnique({ where: { userId } })
    : userEmail
      ? await prisma.customer.findUnique({ where: { email: userEmail } })
      : null;

  if (!customer) notFound();

  const order = await prisma.order.findFirst({
    where: { id: numericId, customerId: customer.id },
    include: {
      orderItems: {
        include: {
          product: { select: { slug: true, image: true } },
          variant: { select: { name: true, images: true } },
        },
      },
    },
  });

  if (!order) notFound();

  const subtotal = order.orderItems.reduce(
    (acc, it) => acc + Number(it.totalPrice.toString()),
    0
  );
  const shipping = extractShipping(order.items);
  const total = Number((order.total ?? 0).toString());
  const statusKey = (order.status ?? "").toLowerCase().trim();

  return (
    <div className={styles.wrap}>
      <div className={styles.stickyBar}>
        <Link href="/conta/pedidos" className={styles.backLink}>
          ← Meus Pedidos
        </Link>
      </div>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.orderTitle}>Pedido #{order.id}</h1>
          <span className={styles.orderMeta}>
            {formatDateBR(order.createdAt ?? new Date())}
          </span>
        </div>
        <div className={styles.headerRight}>
          <StatusBadge status={order.status} />
          {order.mpStatus ? (
            <span className={styles.mpStatus}>MP: {order.mpStatus}</span>
          ) : null}
        </div>
      </div>

      <section className={styles.card} aria-label="Itens do pedido">
        <h2 className={styles.cardTitle}>Itens</h2>
        <table className={styles.itemsTable}>
          <thead>
            <tr>
              <th>Produto</th>
              <th className={styles.right}>Preço unit.</th>
              <th className={styles.right}>Qtd.</th>
              <th className={styles.right}>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.orderItems.map((item) => {
              const img = item.image ?? item.product?.image ?? null;
              const href = item.product?.slug
                ? `/produtos/${item.product.slug}`
                : null;
              return (
                <tr key={item.id}>
                  <td data-label="Produto">
                    <div className={styles.itemCell}>
                      {img ? (
                        <img
                          className={styles.itemImg}
                          src={img}
                          alt={item.productName}
                          loading="lazy"
                        />
                      ) : (
                        <span
                          className={styles.itemImg}
                          aria-hidden="true"
                        />
                      )}
                      <div>
                        <div className={styles.itemName}>
                          {href ? (
                            <Link href={href}>{item.productName}</Link>
                          ) : (
                            item.productName
                          )}
                        </div>
                        {item.variantName ? (
                          <div className={styles.variantName}>
                            {item.variantName}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className={styles.right} data-label="Preço unit.">
                    {formatBRL(item.unitPrice)}
                  </td>
                  <td className={styles.right} data-label="Qtd.">
                    {item.quantity}
                  </td>
                  <td className={styles.right} data-label="Total">
                    {formatBRL(item.totalPrice)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className={styles.card} aria-label="Resumo do pedido">
        <h2 className={styles.cardTitle}>Resumo</h2>
        <div className={styles.summary}>
          <div className={styles.summaryRow}>
            <span>Subtotal</span>
            <span>{formatBRL(subtotal)}</span>
          </div>
          {shipping !== null ? (
            <div className={styles.summaryRow}>
              <span>Frete</span>
              <span>{shipping === 0 ? "Grátis" : formatBRL(shipping)}</span>
            </div>
          ) : null}
          <div className={styles.summaryTotal}>
            <span>Total</span>
            <span>{formatBRL(total)}</span>
          </div>
        </div>
      </section>

      <section className={styles.card} aria-label="Dados do pagador">
        <h2 className={styles.cardTitle}>Dados do pagador</h2>
        <div className={styles.customerGrid}>
          <div>
            <div className={styles.customerLabel}>Nome</div>
            <div className={styles.customerValue}>
              {order.payerName ?? customer.name ?? "—"}
            </div>
          </div>
          <div>
            <div className={styles.customerLabel}>Email</div>
            <div className={styles.customerValue}>
              {order.payerEmail ?? customer.email}
            </div>
          </div>
          <div>
            <div className={styles.customerLabel}>CPF</div>
            <div className={styles.customerValue}>
              {maskCpf(order.payerCpf ?? customer.cpf)}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.next} aria-label="Próximos passos">
        <NextSteps statusKey={statusKey} orderId={order.id} />
      </section>
    </div>
  );
}

function NextSteps({
  statusKey,
  orderId,
}: {
  statusKey: string;
  orderId: number;
}) {
  const supportHref = `/conta/suporte/novo?pedido=${orderId}`;

  if (statusKey === "pending") {
    return (
      <>
        <p className={styles.nextText}>
          Aguardando pagamento. Se houver problemas, abra um chamado de
          suporte e nossa equipe irá te ajudar.
        </p>
        <Link href={supportHref} className={styles.nextCta}>
          Abrir suporte
        </Link>
      </>
    );
  }

  if (statusKey === "failed" || statusKey === "rejected") {
    return (
      <>
        <p className={styles.nextText}>
          Pagamento rejeitado. Você pode tentar novamente ou falar com a
          gente.
        </p>
        <Link href={supportHref} className={styles.nextCta}>
          Abrir suporte
        </Link>
      </>
    );
  }

  if (statusKey === "cancelled" || statusKey === "canceled") {
    return (
      <>
        <p className={styles.nextText}>
          Este pedido foi cancelado. Se não foi você, entre em contato.
        </p>
        <Link href={supportHref} className={styles.nextCta}>
          Abrir suporte
        </Link>
      </>
    );
  }

  if (statusKey === "paid" || statusKey === "shipped" || statusKey === "delivered") {
    return (
      <>
        <p className={styles.nextText}>
          {statusKey === "delivered"
            ? "Pedido entregue. Obrigado pela compra!"
            : statusKey === "shipped"
              ? "Seu pedido foi enviado. Assim que tivermos o código de rastreio, ele aparecerá aqui."
              : "Pagamento confirmado. Em breve enviaremos seu pedido."}
        </p>
        <Link href={supportHref} className={styles.nextCtaGhost}>
          Preciso de ajuda
        </Link>
      </>
    );
  }

  return (
    <>
      <p className={styles.nextText}>
        Precisa de ajuda com esse pedido? Fale com a gente.
      </p>
      <Link href={supportHref} className={styles.nextCta}>
        Abrir suporte
      </Link>
    </>
  );
}
