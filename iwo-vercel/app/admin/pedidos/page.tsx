'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminFetch } from '@/app/admin/lib/auth';
import { formatBRL, formatDateBR } from '@/app/lib/format';

type OrderRow = {
  id: number;
  createdAt: string;
  total: number | null;
  status: string | null;
  payerName: string | null;
  payerEmail: string | null;
  shippingServiceName: string | null;
  superfreteStatus: string | null;
  superfreteTracking: string | null;
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
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
  },
  tableWrapper: {
    overflowX: 'auto',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  thead: {
    background: '#f9fafb',
  },
  th: {
    padding: 12,
    textAlign: 'left',
    fontWeight: 600,
    color: '#555',
  },
  thNumeric: {
    padding: 12,
    textAlign: 'right',
    fontWeight: 600,
    color: '#555',
  },
  thCenter: {
    padding: 12,
    textAlign: 'center',
    fontWeight: 600,
    color: '#555',
  },
  tr: {
    borderTop: '1px solid #e5e7eb',
  },
  td: {
    padding: 12,
    color: '#333',
    verticalAlign: 'middle',
  },
  tdNumeric: {
    padding: 12,
    textAlign: 'right',
    color: '#333',
    verticalAlign: 'middle',
  },
  tdCenter: {
    padding: 12,
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  tdMono: {
    padding: 12,
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
    verticalAlign: 'middle',
  },
  tdMuted: {
    padding: 12,
    fontSize: 12,
    color: '#6b7280',
    verticalAlign: 'middle',
  },
  link: {
    color: '#2563eb',
    textDecoration: 'none',
  },
  payerSub: {
    fontSize: 11,
    color: '#6b7280',
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
  empty: {
    padding: 32,
    textAlign: 'center',
    color: '#999',
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
  return (
    <span style={{ ...styles.badge, background: color }}>
      {status}
    </span>
  );
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/admin/orders');
        if (res.status === 401) {
          router.push('/admin');
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setOrders(data.orders ?? []);
      } catch (e) {
        setErr(String((e as Error)?.message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) return <div style={styles.loading}>Carregando...</div>;
  if (err) return <div style={styles.error}>Erro: {err}</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Pedidos</h1>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead style={styles.thead}>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Cliente</th>
              <th style={styles.thNumeric}>Total</th>
              <th style={styles.thCenter}>Pagamento</th>
              <th style={styles.th}>Frete</th>
              <th style={styles.thCenter}>Etiqueta</th>
              <th style={styles.th}>Tracking</th>
              <th style={styles.th}>Data</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={styles.tr}>
                <td style={styles.td}>
                  <Link href={`/admin/pedidos/${o.id}`} style={styles.link}>
                    #{o.id}
                  </Link>
                </td>
                <td style={styles.td}>
                  {o.payerName ?? '—'}
                  <div style={styles.payerSub}>{o.payerEmail ?? ''}</div>
                </td>
                <td style={styles.tdNumeric}>
                  {o.total != null ? formatBRL(o.total) : '—'}
                </td>
                <td style={styles.tdCenter}>
                  <Badge status={o.status} />
                </td>
                <td style={styles.td}>{o.shippingServiceName ?? '—'}</td>
                <td style={styles.tdCenter}>
                  <Badge status={o.superfreteStatus} />
                </td>
                <td style={styles.tdMono}>
                  {o.superfreteTracking ?? '—'}
                </td>
                <td style={styles.tdMuted}>
                  {formatDateBR(o.createdAt)}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} style={styles.empty}>
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
