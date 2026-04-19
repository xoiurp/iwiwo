'use client';

import { useCheckoutState } from '@/app/lib/checkoutState';
import { formatBRL } from '@/app/lib/format';
import type { CSSProperties } from 'react';

const styles: Record<string, CSSProperties> = {
  card: {
    background: '#fff',
    border: '1px solid #e4e7ec',
    borderRadius: 12,
    boxShadow: '0 1px 2px rgba(10,10,15,.04), 0 8px 24px rgba(10,10,15,.06)',
    padding: 24,
    position: 'sticky',
    top: 24,
  },
  title: { fontSize: 18, fontWeight: 700, margin: '0 0 16px' },
  item: { display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' },
  itemImg: { width: 56, height: 56, borderRadius: 6, objectFit: 'cover', background: '#f3f4f6' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: 600 },
  itemVariant: { fontSize: 11, color: '#9ca3af' },
  itemPrice: { fontSize: 13, fontWeight: 600 },
  line: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, color: '#4b5563' },
  total: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0 4px',
    borderTop: '1px solid #e4e7ec',
    marginTop: 8,
  },
  totalLabel: { fontSize: 15, fontWeight: 700 },
  totalValue: { fontSize: 20, fontWeight: 800 },
};

export function CheckoutSummary() {
  const { state, subtotal, couponDiscount, shippingCost, total } = useCheckoutState();

  return (
    <aside style={styles.card} aria-label="Resumo do pedido">
      <h2 style={styles.title}>Resumo do pedido</h2>
      {state.cart.map((it, i) => (
        <div key={i} style={styles.item}>
          {it.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.image} alt={it.name} style={styles.itemImg as CSSProperties} />
          ) : (
            <div style={styles.itemImg as CSSProperties} />
          )}
          <div style={styles.itemInfo}>
            <div style={styles.itemName}>{it.name}</div>
            {it.variantName ? <div style={styles.itemVariant}>{it.variantName}</div> : null}
            <div style={styles.itemVariant}>Qtd: {it.quantity}</div>
          </div>
          <div style={styles.itemPrice}>{formatBRL(it.price * it.quantity)}</div>
        </div>
      ))}
      {state.cart.length === 0 ? (
        <div style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>Carrinho vazio.</div>
      ) : null}
      <div style={styles.line}>
        <span>Subtotal</span>
        <span>{formatBRL(subtotal)}</span>
      </div>
      {state.coupon ? (
        <div style={styles.line}>
          <span>Desconto ({state.coupon.code})</span>
          <span style={{ color: '#059669' }}>{'\u2212'}{formatBRL(couponDiscount)}</span>
        </div>
      ) : null}
      <div style={styles.line}>
        <span>Frete</span>
        <span>
          {state.shipping ? `${formatBRL(shippingCost)} \u2014 ${state.shipping.name}` : '\u2014'}
        </span>
      </div>
      <div style={styles.total}>
        <span style={styles.totalLabel}>Total</span>
        <span style={styles.totalValue}>{formatBRL(total)}</span>
      </div>
    </aside>
  );
}
