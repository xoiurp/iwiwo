'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCheckoutState } from '@/app/lib/checkoutState';
import { formatBRL } from '@/app/lib/format';
import type { CSSProperties } from 'react';

type OrderData = {
  id: number;
  status: string;
  mpStatus: string | null;
  total: number;
  subtotal: number;
  shippingCost: number;
  shippingServiceName: string | null;
  shippingDeliveryMin: number | null;
  shippingDeliveryMax: number | null;
  couponCode: string | null;
  couponDiscount: number;
  shipToName: string | null;
  shipToDocument: string;
  shipToPostalCode: string | null;
  shipToAddress: string | null;
  shipToNumber: string | null;
  shipToComplement: string | null;
  shipToDistrict: string | null;
  shipToCity: string | null;
  shipToState: string | null;
  superfreteStatus: string | null;
  superfreteTracking: string | null;
  orderItems: Array<{
    id: number;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    image: string | null;
  }>;
};

type PaymentDetails = {
  pix?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
  boleto?: { digitable_line?: string; ticket_url?: string };
};

const styles: Record<string, CSSProperties> = {
  heroCard: {
    background: '#fff',
    border: '1px solid #e4e7ec',
    borderRadius: 12,
    padding: 32,
    textAlign: 'center',
    marginBottom: 16,
  },
  check: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#059669',
    color: '#fff',
    fontSize: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: 800, margin: '0 0 8px' },
  subtitle: { fontSize: 14, color: '#4b5563', margin: 0 },
  qrWrapper: { padding: 16, textAlign: 'center' },
  qrImg: { maxWidth: 240, width: '100%', height: 'auto', margin: '12px auto' },
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
    padding: 10,
    background: '#f3f4f6',
    borderRadius: 6,
    wordBreak: 'break-all',
    cursor: 'pointer',
    userSelect: 'all',
  },
  line: { display: 'flex', justifyContent: 'space-between', padding: '6px 0' },
  actions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    marginTop: 16,
    flexWrap: 'wrap',
  },
};

export default function ConfirmacaoPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { clearAll } = useCheckoutState();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Lazy initial state: lê o payment details do sessionStorage no 1º render
  // (client component) — evita `setState` síncrono dentro de useEffect.
  const [payDetails] = useState<PaymentDetails>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = sessionStorage.getItem('iwo_payment_details');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as PaymentDetails;
      sessionStorage.removeItem('iwo_payment_details');
      return parsed;
    } catch {
      return {};
    }
  });

  // Limpa checkout state + carrinho ao montar (pedido já foi criado)
  useEffect(() => {
    clearAll();
  }, [clearAll]);

  // Load order data via HMAC token
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/orders/${orderId}?token=${encodeURIComponent(token)}`,
        );
        if (!res.ok) {
          setErr('Link inválido ou expirado');
          return;
        }
        const data = await res.json();
        setOrder(data.order);
      } catch {
        setErr('Falha ao carregar pedido');
      }
    })();
  }, [orderId, token]);

  // Polling do status enquanto pending
  useEffect(() => {
    if (!order || order.status !== 'pending') return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/orders/${orderId}/status?token=${encodeURIComponent(token)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        setOrder((o) =>
          o ? { ...o, status: data.status, mpStatus: data.mpStatus } : o,
        );
        if (data.status !== 'pending') clearInterval(timer);
      } catch {
        /* silent */
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [order, orderId, token]);

  if (err) {
    return (
      <div className="checkout-card" style={{ textAlign: 'center', padding: 40 }}>
        <h2>{err}</h2>
        <p style={{ color: '#6b7280', marginTop: 12 }}>
          Se você já fez o pagamento, consulte seu e-mail para acompanhar.
        </p>
        <a
          href="/loja.html"
          className="checkout-btn-secondary"
          style={{ marginTop: 16, display: 'inline-block' }}
        >
          {'\u2190'} Voltar para a loja
        </a>
      </div>
    );
  }

  if (!order) {
    return <div className="checkout-card">Carregando...</div>;
  }

  const paid = order.status === 'paid';

  return (
    <>
      <div style={styles.heroCard}>
        <div style={styles.check}>{'\u2713'}</div>
        <h1 style={styles.title}>Pedido #{order.id} confirmado!</h1>
        <p style={styles.subtitle}>
          {paid
            ? 'Pagamento aprovado! Você receberá os detalhes por e-mail.'
            : 'Aguardando pagamento. Use as informações abaixo para concluir.'}
        </p>
      </div>

      {payDetails.pix ? (
        <div className="checkout-card">
          <h2>Pague com Pix</h2>
          <div style={styles.qrWrapper}>
            {payDetails.pix.qr_code_base64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${payDetails.pix.qr_code_base64}`}
                alt="QR Code Pix"
                style={styles.qrImg}
              />
            ) : null}
            {payDetails.pix.qr_code ? (
              <div
                style={styles.code}
                onClick={() =>
                  navigator.clipboard?.writeText(payDetails.pix!.qr_code!)
                }
                title="Clique para copiar"
              >
                {payDetails.pix.qr_code}
              </div>
            ) : null}
            {payDetails.pix.ticket_url ? (
              <a
                href={payDetails.pix.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#2563eb', display: 'inline-block', marginTop: 12 }}
              >
                Abrir página de pagamento {'\u2192'}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {payDetails.boleto ? (
        <div className="checkout-card">
          <h2>Boleto</h2>
          {payDetails.boleto.digitable_line ? (
            <div
              style={styles.code}
              onClick={() =>
                navigator.clipboard?.writeText(payDetails.boleto!.digitable_line!)
              }
            >
              {payDetails.boleto.digitable_line}
            </div>
          ) : null}
          {payDetails.boleto.ticket_url ? (
            <a
              href={payDetails.boleto.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="checkout-btn-primary"
              style={{ marginTop: 16, display: 'inline-block', maxWidth: 280 }}
            >
              Abrir boleto {'\u2192'}
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="checkout-card">
        <h2>Resumo</h2>
        {order.orderItems.map((it) => (
          <div key={it.id} style={styles.line}>
            <span>
              {it.quantity}
              {'\u00d7'} {it.productName}
              {it.variantName ? (
                <>
                  {' \u2014 '}
                  {it.variantName}
                </>
              ) : null}
            </span>
            <span>{formatBRL(it.totalPrice)}</span>
          </div>
        ))}
        <hr style={{ border: 0, borderTop: '1px solid #e4e7ec', margin: '8px 0' }} />
        <div style={styles.line}>
          <span>Subtotal</span>
          <span>{formatBRL(order.subtotal)}</span>
        </div>
        {order.couponCode ? (
          <div style={styles.line}>
            <span>Desconto ({order.couponCode})</span>
            <span style={{ color: '#059669' }}>
              {'\u2212'}
              {formatBRL(order.couponDiscount)}
            </span>
          </div>
        ) : null}
        <div style={styles.line}>
          <span>Frete ({order.shippingServiceName ?? '\u2014'})</span>
          <span>{formatBRL(order.shippingCost)}</span>
        </div>
        <div
          style={{
            ...styles.line,
            borderTop: '1px solid #e4e7ec',
            paddingTop: 12,
            fontWeight: 800,
            fontSize: 16,
          }}
        >
          <span>Total</span>
          <span>{formatBRL(order.total)}</span>
        </div>
      </div>

      <div className="checkout-card">
        <h2>Endereço de entrega</h2>
        <p style={{ fontSize: 14, color: '#4b5563' }}>
          {order.shipToName ?? '\u2014'}
          <br />
          {order.shipToAddress}, {order.shipToNumber}
          {order.shipToComplement ? (
            <>
              {' \u2014 '}
              {order.shipToComplement}
            </>
          ) : null}
          <br />
          {order.shipToDistrict} {'\u2014'} {order.shipToCity}/{order.shipToState}{' '}
          {'\u2014'} CEP {order.shipToPostalCode}
        </p>
      </div>

      <div style={styles.actions}>
        <a href="/loja.html" className="checkout-btn-secondary">
          {'\u2190'} Continuar comprando
        </a>
        <Link
          href="/conta/pedidos"
          className="checkout-btn-primary"
          style={{ maxWidth: 240 }}
        >
          Meus pedidos
        </Link>
      </div>
    </>
  );
}
