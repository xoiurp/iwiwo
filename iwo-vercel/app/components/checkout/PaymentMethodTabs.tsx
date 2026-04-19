'use client';

import type { CSSProperties } from 'react';

export type PayMethod = 'pix' | 'credit_card' | 'boleto';

type Props = {
  value: PayMethod;
  onChange: (v: PayMethod) => void;
};

const METHODS: Array<{ id: PayMethod; label: string; iconSrc: string }> = [
  { id: 'pix', label: 'Pix', iconSrc: '/images/pix.svg' },
  { id: 'credit_card', label: 'Cartão', iconSrc: '/images/card.svg' },
  { id: 'boleto', label: 'Boleto', iconSrc: '/images/boleto.svg' },
];

const styles: Record<string, CSSProperties> = {
  wrapper: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 },
  card: {
    padding: 16,
    border: '2px solid #e4e7ec',
    borderRadius: 10,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    background: '#fff',
    transition: 'all .25s cubic-bezier(0.4,0,0.2,1)',
  },
  selected: { borderColor: '#0a0a0f', background: 'rgba(10,10,15,.02)' },
  icon: { width: 32, height: 32, objectFit: 'contain', display: 'block' },
  label: { fontWeight: 600, fontSize: 14 },
};

export function PaymentMethodTabs({ value, onChange }: Props) {
  return (
    <div style={styles.wrapper} role="radiogroup" aria-label="Forma de pagamento">
      {METHODS.map((m) => (
        <label key={m.id} style={{ ...styles.card, ...(value === m.id ? styles.selected : {}) }}>
          <input
            type="radio"
            name="payment-method"
            checked={value === m.id}
            onChange={() => onChange(m.id)}
            style={{ display: 'none' }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.iconSrc} alt="" aria-hidden="true" style={styles.icon as CSSProperties} />
          <span style={styles.label}>{m.label}</span>
        </label>
      ))}
    </div>
  );
}
