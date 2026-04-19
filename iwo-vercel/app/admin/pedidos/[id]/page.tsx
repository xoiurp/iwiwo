'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminFetch } from '@/app/admin/lib/auth';
import { formatBRL, formatDateBR } from '@/app/lib/format';

type Order = {
  id: number;
  total: number | null;
  status: string | null;
  payerName: string | null;
  payerEmail: string | null;
  payerCpf: string | null;
  createdAt: string | null;
  shippingServiceId: number | null;
  shippingServiceName: string | null;
  shippingCost: number | null;
  shippingDeliveryMin: number | null;
  shippingDeliveryMax: number | null;
  shipToName: string | null;
  shipToDocument: string | null;
  shipToPostalCode: string | null;
  shipToAddress: string | null;
  shipToNumber: string | null;
  shipToComplement: string | null;
  shipToDistrict: string | null;
  shipToCity: string | null;
  shipToState: string | null;
  shippingBoxWeight: number | null;
  shippingBoxHeight: number | null;
  shippingBoxWidth: number | null;
  shippingBoxLength: number | null;
  superfreteOrderId: string | null;
  superfreteStatus: string | null;
  superfreteTracking: string | null;
  superfreteCreatedAt: string | null;
  superfreteError: string | null;
  orderItems: Array<{
    id: number;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
};

const LABEL_STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  released: '#3b82f6',
  posted: '#8b5cf6',
  delivered: '#10b981',
  cancelled: '#ef4444',
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 24,
    maxWidth: 900,
    margin: '0 auto',
  },
  headerWrap: {
    marginBottom: 24,
  },
  backLink: {
    fontSize: 13,
    color: '#6b7280',
    textDecoration: 'none',
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: '8px 0 0',
  },
  card: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    margin: '0 0 12px',
    color: '#1a1a2e',
  },
  muted: {
    color: '#6b7280',
    fontSize: 14,
    margin: '4px 0',
  },
  strong: {
    margin: '4px 0',
    color: '#1a1a2e',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  itemVariant: {
    color: '#6b7280',
  },
  itemSub: {
    fontSize: 12,
    color: '#6b7280',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0 0',
    fontWeight: 600,
  },
  deliveryLine: {
    fontSize: 14,
    margin: '4px 0',
  },
  divider: {
    margin: '12px 0',
    border: 0,
    borderTop: '1px solid #f3f4f6',
  },
  errorBox: {
    background: '#fee2e2',
    color: '#991b1b',
    padding: 12,
    borderRadius: 4,
    marginBottom: 12,
    fontSize: 13,
  },
  errorPre: {
    whiteSpace: 'pre-wrap' as const,
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  actionsRow: {
    marginTop: 16,
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    color: '#fff',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dash: {
    color: '#999',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
  loading: {
    padding: 24,
  },
  error: {
    padding: 24,
    color: '#c00',
  },
};

function Badge({ status }: { status: string | null }) {
  if (!status) return <span style={styles.dash}>—</span>;
  const color = LABEL_STATUS_COLORS[status] ?? '#6b7280';
  return <span style={{ ...styles.badge, background: color }}>{status}</span>;
}

function btnStyle(bg: string, disabled: boolean): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    padding: '8px 14px',
    borderRadius: 4,
    border: 0,
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/orders/' + id);
      if (res.status === 401) {
        router.push('/admin');
        return;
      }
      if (!res.ok) {
        setErr('HTTP ' + res.status);
        return;
      }
      const data = await res.json();
      setOrder(data.order);
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function callAction(
    path: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    setBusy(path);
    try {
      const res = await adminFetch('/api/admin/orders/' + id + '/' + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (res.status === 401) {
        router.push('/admin');
        return null;
      }
      if (!res.ok) {
        alert(typeof data.error === 'string' ? data.error : 'Erro');
        return null;
      }
      return data;
    } catch (e) {
      alert(String((e as Error)?.message ?? e));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handlePrint() {
    const data = await callAction('shipping-label', 'GET');
    if (data?.url) window.open(String(data.url), '_blank');
  }
  async function handleRefresh() {
    const data = await callAction('shipping-refresh', 'POST');
    if (data) load();
  }
  async function handleCancel() {
    const reason = prompt('Motivo do cancelamento:') ?? '';
    if (!reason.trim()) return;
    const data = await callAction('shipping-cancel', 'POST', { reason });
    if (data) load();
  }

  if (err) return <div style={styles.error}>Erro: {err}</div>;
  if (!order) return <div style={styles.loading}>Carregando...</div>;

  const canCancel =
    order.superfreteStatus === 'pending' || order.superfreteStatus === 'released';
  const canPrint = !!order.superfreteOrderId && order.superfreteStatus !== 'cancelled';
  const showEmitirStub = !order.superfreteOrderId && !!order.superfreteError;

  return (
    <div style={styles.container}>
      <div style={styles.headerWrap}>
        <Link href="/admin/pedidos" style={styles.backLink}>
          ← Voltar
        </Link>
        <h1 style={styles.title}>Pedido #{order.id}</h1>
      </div>

      {/* Card 1: Cliente */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Cliente</h2>
        <p style={styles.strong}>
          <strong>{order.payerName ?? '—'}</strong>
        </p>
        <p style={styles.muted}>{order.payerEmail ?? '—'}</p>
        <p style={styles.muted}>CPF: {order.payerCpf ?? '—'}</p>
      </div>

      {/* Card 2: Itens */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Itens</h2>
        {order.orderItems.map((it) => (
          <div key={it.id} style={styles.itemRow}>
            <div>
              {it.productName}
              {it.variantName && (
                <span style={styles.itemVariant}> — {it.variantName}</span>
              )}
              <div style={styles.itemSub}>
                {it.quantity}x {formatBRL(it.unitPrice)}
              </div>
            </div>
            <div>{formatBRL(it.totalPrice)}</div>
          </div>
        ))}
        <div style={styles.totalRow}>
          <div>Total</div>
          <div>{formatBRL(order.total)}</div>
        </div>
      </div>

      {/* Card 3: Entrega */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Entrega</h2>
        <p style={styles.strong}>
          <strong>{order.shipToName ?? '—'}</strong> — CPF{' '}
          {order.shipToDocument ?? '—'}
        </p>
        <p style={styles.deliveryLine}>
          {order.shipToAddress ?? '—'}, {order.shipToNumber ?? '—'}
          {order.shipToComplement ? ` — ${order.shipToComplement}` : ''}
          <br />
          {order.shipToDistrict ?? '—'} — {order.shipToCity ?? '—'}/
          {order.shipToState ?? '—'} — CEP {order.shipToPostalCode ?? '—'}
        </p>
        <hr style={styles.divider} />
        <p style={styles.deliveryLine}>
          <strong>Serviço:</strong> {order.shippingServiceName ?? '—'} —{' '}
          {formatBRL(order.shippingCost)}
          <br />
          <strong>Prazo:</strong>{' '}
          {order.shippingDeliveryMin != null
            ? `${order.shippingDeliveryMin}–${order.shippingDeliveryMax ?? '?'} dias úteis`
            : '—'}
          <br />
          <strong>Caixa:</strong> {order.shippingBoxLength ?? '?'} ×{' '}
          {order.shippingBoxWidth ?? '?'} × {order.shippingBoxHeight ?? '?'} cm —{' '}
          {order.shippingBoxWeight ?? '?'} kg
        </p>
      </div>

      {/* Card 4: Etiqueta SuperFrete */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Etiqueta SuperFrete</h2>
        {order.superfreteError && !order.superfreteOrderId && (
          <div style={styles.errorBox}>
            <strong>Erro na emissão:</strong>
            <pre style={styles.errorPre}>{order.superfreteError}</pre>
          </div>
        )}
        <p style={styles.deliveryLine}>
          <strong>Status:</strong> <Badge status={order.superfreteStatus} />
          <br />
          <strong>ID SuperFrete:</strong>{' '}
          <code style={styles.mono}>{order.superfreteOrderId ?? '—'}</code>
          <br />
          <strong>Tracking:</strong>{' '}
          <code style={styles.mono}>{order.superfreteTracking ?? '—'}</code>
          <br />
          <strong>Criada em:</strong>{' '}
          {order.superfreteCreatedAt ? formatDateBR(order.superfreteCreatedAt) : '—'}
        </p>
        <div style={styles.actionsRow}>
          {canPrint && (
            <button
              onClick={handlePrint}
              disabled={busy === 'shipping-label'}
              style={btnStyle('#2563eb', busy === 'shipping-label')}
            >
              {busy === 'shipping-label' ? 'Abrindo...' : 'Baixar etiqueta (PDF)'}
            </button>
          )}
          {order.superfreteOrderId && (
            <button
              onClick={handleRefresh}
              disabled={busy === 'shipping-refresh'}
              style={btnStyle('#6b7280', busy === 'shipping-refresh')}
            >
              {busy === 'shipping-refresh' ? 'Atualizando...' : 'Atualizar status'}
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={busy === 'shipping-cancel'}
              style={btnStyle('#dc2626', busy === 'shipping-cancel')}
            >
              {busy === 'shipping-cancel' ? 'Cancelando...' : 'Cancelar etiqueta'}
            </button>
          )}
          {showEmitirStub && (
            <button
              onClick={() =>
                alert('Emissão manual ainda não implementada (stub).')
              }
              style={btnStyle('#059669', false)}
            >
              Emitir etiqueta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
