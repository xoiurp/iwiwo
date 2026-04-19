'use client';

import { useState } from 'react';
import { useCheckoutState } from '@/app/lib/checkoutState';
import { formatBRL } from '@/app/lib/format';
import type { CSSProperties } from 'react';

const styles: Record<string, CSSProperties> = {
  wrapper: { marginTop: 16 },
  row: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    padding: '12px 14px',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  button: {
    padding: '12px 20px',
    background: '#0a0a0f',
    color: '#fff',
    border: 0,
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  },
  applied: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 14px',
    background: '#ecfdf5',
    color: '#065f46',
    border: '1px solid #10b981',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
  },
  remove: {
    background: 'transparent',
    border: 0,
    color: '#065f46',
    fontSize: 18,
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
  error: { marginTop: 8, fontSize: 13, color: '#dc2626' },
};

export function CouponField() {
  const { state, subtotal, setCoupon } = useCheckoutState();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!code.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), subtotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.message ?? 'Cupom inválido');
        return;
      }
      setCoupon({
        code: data.code,
        kind: data.kind,
        discount: data.discount,
        description: data.description,
      });
      setCode('');
    } catch {
      setErr('Falha ao validar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  if (state.coupon) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.applied}>
          <span>
            {'\u2713'} {state.coupon.code} aplicado {'\u2014'} economia de{' '}
            {formatBRL(state.coupon.discount)}
          </span>
          <button
            type="button"
            onClick={() => setCoupon(null)}
            style={styles.remove}
            aria-label="Remover cupom"
          >
            {'\u00D7'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.row}>
        <input
          type="text"
          placeholder="Código do cupom"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
          style={styles.input}
          disabled={busy}
        />
        <button
          type="button"
          onClick={apply}
          disabled={busy || !code.trim()}
          style={styles.button}
        >
          {busy ? 'Validando...' : 'Aplicar'}
        </button>
      </div>
      {err ? <div style={styles.error}>{err}</div> : null}
    </div>
  );
}
