'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';

export type SavedAddress = {
  id: number;
  label: string | null;
  recipient: string;
  cep: string;               // formatted 00000-000
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
};

type Props = {
  address: SavedAddress;
  selected: boolean;
  onSelect: () => void;
  defaultOpen?: boolean;
};

const styles: Record<string, CSSProperties> = {
  wrapper: {
    border: '2px solid #e4e7ec',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    transition: 'border-color .25s cubic-bezier(0.4,0,0.2,1)',
    background: '#fff',
  },
  wrapperSelected: { borderColor: '#0a0a0f' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: 16, cursor: 'pointer' },
  radio: { width: 18, height: 18 },
  title: { flex: 1, fontWeight: 600, fontSize: 14 },
  badge: {
    background: '#0a0a0f',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chevron: { transition: 'transform .25s cubic-bezier(0.4,0,0.2,1)', fontSize: 14 },
  body: {
    overflow: 'hidden',
    transition: 'max-height .25s cubic-bezier(0.4,0,0.2,1), opacity .25s cubic-bezier(0.4,0,0.2,1)',
  },
  bodyInner: { padding: '0 16px 16px 46px', fontSize: 14, color: '#4b5563', lineHeight: 1.6 },
};

export function AddressAccordion({ address, selected, onSelect, defaultOpen }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);

  return (
    <div style={{ ...styles.wrapper, ...(selected ? styles.wrapperSelected : {}) }}>
      <div
        style={styles.header}
        onClick={() => {
          onSelect();
          setOpen(true);
        }}
      >
        <input
          type="radio"
          name="address-selected"
          checked={selected}
          onChange={onSelect}
          style={styles.radio}
        />
        <span style={styles.title}>{address.label ?? address.recipient}</span>
        {address.isDefault ? <span style={styles.badge}>padrão</span> : null}
        <span
          style={{ ...styles.chevron, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          {'\u25be'}
        </span>
      </div>
      <div style={{ ...styles.body, maxHeight: open ? 200 : 0, opacity: open ? 1 : 0 }}>
        <div style={styles.bodyInner}>
          <div>{address.recipient}</div>
          <div>
            {address.street}, {address.number}
            {address.complement ? ` \u2014 ${address.complement}` : ''}
          </div>
          <div>
            {address.neighborhood} {'\u2014'} {address.city}/{address.state} {'\u2014'} CEP {address.cep}
          </div>
        </div>
      </div>
    </div>
  );
}
