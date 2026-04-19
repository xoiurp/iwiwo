'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/app/admin/lib/auth';

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

function Badge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: '#999' }}>—</span>;
  const color = LABEL_STATUS_COLORS[status] ?? '#6b7280';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        background: color,
        color: '#fff',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {status}
    </span>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = '/admin';
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/admin/orders', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setOrders(data.orders ?? []);
      } catch (e) {
        setErr(String((e as Error)?.message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Carregando...</div>;
  if (err) return <div style={{ padding: 24, color: '#c00' }}>Erro: {err}</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Pedidos</h1>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={{ padding: 12, textAlign: 'left' }}>#</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Cliente</th>
              <th style={{ padding: 12, textAlign: 'right' }}>Total</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Pagamento</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Frete</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Etiqueta</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Tracking</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Data</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={{ padding: 12 }}>
                  <Link href={`/admin/pedidos/${o.id}`} style={{ color: '#2563eb' }}>
                    #{o.id}
                  </Link>
                </td>
                <td style={{ padding: 12 }}>
                  {o.payerName ?? '—'}
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{o.payerEmail ?? ''}</div>
                </td>
                <td style={{ padding: 12, textAlign: 'right' }}>
                  {o.total != null ? `R$ ${Number(o.total).toFixed(2).replace('.', ',')}` : '—'}
                </td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <Badge status={o.status} />
                </td>
                <td style={{ padding: 12 }}>{o.shippingServiceName ?? '—'}</td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  <Badge status={o.superfreteStatus} />
                </td>
                <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>
                  {o.superfreteTracking ?? '—'}
                </td>
                <td style={{ padding: 12, fontSize: 12, color: '#6b7280' }}>
                  {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#999' }}>
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
