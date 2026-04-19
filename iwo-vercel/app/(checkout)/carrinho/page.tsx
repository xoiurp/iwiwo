'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCheckoutState } from '@/app/lib/checkoutState';
import { Stepper } from '@/app/components/checkout/Stepper';
import { CouponField } from '@/app/components/checkout/CouponField';
import { formatBRL } from '@/app/lib/format';
import type { CSSProperties } from 'react';

const styles: Record<string, CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  img: {
    width: 64,
    height: 64,
    borderRadius: 8,
    objectFit: 'cover',
    background: '#f3f4f6',
  },
  name: { fontSize: 14, fontWeight: 600 },
  variant: { fontSize: 12, color: '#9ca3af' },
  qtyWrapper: { display: 'flex', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: '1px solid #d1d5db',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
  },
  price: { minWidth: 96, textAlign: 'right', fontWeight: 600 },
  remove: {
    background: 'transparent',
    border: 0,
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: 18,
    padding: 8,
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
  },
  banner: {
    padding: 14,
    borderRadius: 8,
    background: '#fef3c7',
    color: '#78350f',
    fontSize: 14,
    marginBottom: 16,
  },
};

function CarrinhoPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, setCart } = useCheckoutState();
  const msg = params.get('msg');

  useEffect(() => {
    if (state.cart.length === 0) {
      router.replace('/loja.html');
    }
  }, [state.cart.length, router]);

  function changeQty(idx: number, delta: number) {
    const next = state.cart.map((it, i) =>
      i === idx ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it,
    );
    setCart(next);
  }

  function removeItem(idx: number) {
    const next = state.cart.filter((_, i) => i !== idx);
    setCart(next);
    if (next.length === 0) router.replace('/loja.html');
  }

  return (
    <>
      <Stepper current={1} />
      <div className="checkout-card">
        <h2>Revisão do carrinho</h2>
        {msg === 'coupon_invalid' ? (
          <div style={styles.banner}>
            Cupom removido {'\u2014'} não é mais válido.
          </div>
        ) : null}
        {state.cart.map((it, idx) => (
          <div key={idx} style={styles.row}>
            {it.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image} alt={it.name} style={styles.img} />
            ) : (
              <div style={styles.img} />
            )}
            <div style={{ flex: 1 }}>
              <div style={styles.name}>{it.name}</div>
              {it.variantName ? (
                <div style={styles.variant}>{it.variantName}</div>
              ) : null}
              <div style={styles.variant}>{formatBRL(it.price)} unit.</div>
            </div>
            <div style={styles.qtyWrapper}>
              <button
                type="button"
                onClick={() => changeQty(idx, -1)}
                style={styles.qtyBtn}
                aria-label="Diminuir quantidade"
              >
                {'\u2212'}
              </button>
              <span style={{ minWidth: 20, textAlign: 'center' }}>
                {it.quantity}
              </span>
              <button
                type="button"
                onClick={() => changeQty(idx, +1)}
                style={styles.qtyBtn}
                aria-label="Aumentar quantidade"
              >
                +
              </button>
            </div>
            <div style={styles.price}>
              {formatBRL(it.price * it.quantity)}
            </div>
            <button
              type="button"
              onClick={() => removeItem(idx)}
              style={styles.remove}
              aria-label="Remover item"
            >
              {'\u00D7'}
            </button>
          </div>
        ))}
        <CouponField />
        <div style={styles.actions}>
          <a href="/loja.html" className="checkout-btn-secondary">
            {'\u2190'} Continuar comprando
          </a>
          <button
            type="button"
            className="checkout-btn-primary"
            style={{ maxWidth: 280 }}
            disabled={state.cart.length === 0}
            onClick={() => router.push('/checkout/endereco')}
          >
            Continuar {'\u2192'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function CarrinhoPage() {
  return (
    <Suspense fallback={<Stepper current={1} />}>
      <CarrinhoPageInner />
    </Suspense>
  );
}
