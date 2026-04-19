'use client';

import { useState, useEffect, useRef } from 'react';

export type AddressFormValue = {
  label?: string;
  recipient: string;
  cep: string;          // formatted 00000-000
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  document?: string;    // CPF do destinatário
};

type Props = {
  initial?: Partial<AddressFormValue>;
  showDocument?: boolean;
  showLabel?: boolean;
  onChange: (value: AddressFormValue) => void;
};

function formatCep(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
}

function formatCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function AddressForm({ initial, showDocument, showLabel, onChange }: Props) {
  const [value, setValue] = useState<AddressFormValue>({
    label: initial?.label ?? '',
    recipient: initial?.recipient ?? '',
    cep: initial?.cep ?? '',
    street: initial?.street ?? '',
    number: initial?.number ?? '',
    complement: initial?.complement ?? '',
    district: initial?.district ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    document: initial?.document ?? '',
  });
  const [cepLoading, setCepLoading] = useState(false);
  const [cepErr, setCepErr] = useState(false);
  const notifyRef = useRef(onChange);
  notifyRef.current = onChange;

  useEffect(() => {
    notifyRef.current(value);
  }, [value]);

  async function handleCepBlur() {
    const d = value.cep.replace(/\D/g, '');
    if (d.length !== 8) return;
    setCepLoading(true);
    setCepErr(false);
    try {
      const res = await fetch(`/api/shipping/cep/${d}`);
      if (!res.ok) {
        setCepErr(true);
        return;
      }
      const data = await res.json();
      setValue((v) => ({
        ...v,
        street: v.street || data.logradouro || '',
        district: v.district || data.bairro || '',
        city: v.city || data.cidade || '',
        state: v.state || String(data.uf ?? '').toUpperCase(),
      }));
    } finally {
      setCepLoading(false);
    }
  }

  return (
    <div>
      {showLabel ? (
        <div className="checkout-field">
          <label>Identificação (ex: Casa, Escritório)</label>
          <input
            type="text"
            value={value.label ?? ''}
            onChange={(e) => setValue({ ...value, label: e.target.value })}
            placeholder="opcional"
          />
        </div>
      ) : null}
      {showDocument ? (
        <div className="checkout-field">
          <label>CPF *</label>
          <input
            type="text"
            inputMode="numeric"
            value={value.document ?? ''}
            onChange={(e) => setValue({ ...value, document: formatCpf(e.target.value) })}
            placeholder="000.000.000-00"
            maxLength={14}
          />
        </div>
      ) : null}
      <div className="checkout-field">
        <label>Nome completo do destinatário *</label>
        <input
          type="text"
          value={value.recipient}
          onChange={(e) => setValue({ ...value, recipient: e.target.value })}
          placeholder="Nome e sobrenome"
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px', gap: 12 }}>
        <div className="checkout-field">
          <label>CEP *</label>
          <input
            type="text"
            inputMode="numeric"
            value={value.cep}
            onChange={(e) => setValue({ ...value, cep: formatCep(e.target.value) })}
            onBlur={handleCepBlur}
            placeholder="00000-000"
            maxLength={9}
          />
          {cepLoading ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Consultando CEP...</div>
          ) : null}
          {cepErr ? (
            <div style={{ fontSize: 12, color: '#dc2626' }}>CEP não encontrado</div>
          ) : null}
        </div>
        <div className="checkout-field">
          <label>Rua *</label>
          <input type="text" value={value.street} onChange={(e) => setValue({ ...value, street: e.target.value })} />
        </div>
        <div className="checkout-field">
          <label>Número *</label>
          <input type="text" value={value.number} onChange={(e) => setValue({ ...value, number: e.target.value })} />
        </div>
      </div>
      <div className="checkout-field">
        <label>Complemento</label>
        <input
          type="text"
          value={value.complement}
          onChange={(e) => setValue({ ...value, complement: e.target.value })}
          placeholder="Apto, bloco, referência..."
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 12 }}>
        <div className="checkout-field">
          <label>Bairro *</label>
          <input type="text" value={value.district} onChange={(e) => setValue({ ...value, district: e.target.value })} />
        </div>
        <div className="checkout-field">
          <label>Cidade *</label>
          <input type="text" value={value.city} onChange={(e) => setValue({ ...value, city: e.target.value })} />
        </div>
        <div className="checkout-field">
          <label>UF *</label>
          <input
            type="text"
            value={value.state}
            onChange={(e) => setValue({ ...value, state: e.target.value.toUpperCase().slice(0, 2) })}
            maxLength={2}
          />
        </div>
      </div>
    </div>
  );
}
