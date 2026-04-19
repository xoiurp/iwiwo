'use client';

import { formatBRL } from '@/app/lib/format';
import type { CSSProperties } from 'react';

export type ShippingOption = {
  serviceId: 1 | 2 | 17;
  name: string;
  price: number;
  deliveryMin: number;
  deliveryMax: number;
  box: { weight: number; height: number; width: number; length: number };
};

type Props = {
  loading?: boolean;
  options: ShippingOption[] | null;
  selectedId: number | null;
  onSelect: (opt: ShippingOption) => void;
};

const styles: Record<string, CSSProperties> = {
  wrapper: { display: 'grid', gap: 10 },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    border: '2px solid #e4e7ec',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all .25s cubic-bezier(0.4,0,0.2,1)',
    background: '#fff',
  },
  optionSelected: { borderColor: '#0a0a0f', background: 'rgba(10,10,15,.02)' },
  info: { flex: 1 },
  name: { fontWeight: 600, fontSize: 14 },
  eta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  price: { fontWeight: 700, fontSize: 15 },
  skeleton: { height: 56, borderRadius: 10 },
  empty: { fontSize: 13, color: '#dc2626' },
};

export function ShippingOptions({ loading, options, selectedId, onSelect }: Props) {
  if (loading) {
    return (
      <div style={styles.wrapper}>
        <div className="checkout-skeleton" style={styles.skeleton} />
        <div className="checkout-skeleton" style={styles.skeleton} />
      </div>
    );
  }
  if (!options || options.length === 0) {
    return <div style={styles.empty}>Nenhum serviço disponível para este CEP.</div>;
  }
  return (
    <div style={styles.wrapper} role="radiogroup" aria-label="Opções de frete">
      {options.map((opt) => {
        const selected = opt.serviceId === selectedId;
        return (
          <label key={opt.serviceId} style={{ ...styles.option, ...(selected ? styles.optionSelected : {}) }}>
            <input
              type="radio"
              name="shipping-option"
              checked={selected}
              onChange={() => onSelect(opt)}
            />
            <div style={styles.info}>
              <div style={styles.name}>{opt.name}</div>
              <div style={styles.eta}>
                Chega em{' '}
                {opt.deliveryMin === opt.deliveryMax
                  ? `${opt.deliveryMin} dias úteis`
                  : `${opt.deliveryMin}${'\u2013'}${opt.deliveryMax} dias úteis`}
              </div>
            </div>
            <div style={styles.price}>{formatBRL(opt.price)}</div>
          </label>
        );
      })}
    </div>
  );
}
