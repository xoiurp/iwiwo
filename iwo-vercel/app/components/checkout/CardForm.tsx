'use client';

import { useEffect, useRef, useState } from 'react';

type MP = {
  cardForm: (config: Record<string, unknown>) => CardFormHandle;
};

type CardFormHandle = {
  unmount: () => void;
  getCardFormData: () => { token?: string; paymentMethodId?: string };
  createCardToken: () => Promise<{ id: string; payment_method_id?: string }>;
};

declare global {
  interface Window {
    MercadoPago?: new (key: string, options: { locale: string }) => MP;
  }
}

type Props = {
  amount: number;
  onReady?: (handle: CardFormHandle) => void;
};

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? 'TEST-PUBLIC-KEY';

export function CardForm({ amount, onReady }: Props) {
  const handleRef = useRef<CardFormHandle | null>(null);
  // Lazy initializer — avoid synchronous setState-in-effect for the
  // already-loaded case. On first render `window` is undefined during SSR
  // but this component is client-only, so the initializer is safe.
  const [sdkReady, setSdkReady] = useState<boolean>(() =>
    typeof window !== 'undefined' && Boolean(window.MercadoPago),
  );

  useEffect(() => {
    if (sdkReady || window.MercadoPago) return;
    const s = document.createElement('script');
    s.src = 'https://sdk.mercadopago.com/js/v2';
    s.async = true;
    s.onload = () => setSdkReady(true);
    document.body.appendChild(s);
  }, [sdkReady]);

  useEffect(() => {
    if (!sdkReady || !window.MercadoPago) return;
    const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
    const handle = mp.cardForm({
      amount: String(amount),
      iframe: true,
      form: {
        id: 'mp-card-form',
        cardNumber: { id: 'mp-cardNumber', placeholder: '0000 0000 0000 0000' },
        expirationDate: { id: 'mp-expirationDate', placeholder: 'MM/AA' },
        securityCode: { id: 'mp-securityCode', placeholder: '123' },
        cardholderName: { id: 'mp-cardholderName', placeholder: 'Nome no cartão' },
        installments: { id: 'mp-installments' },
        identificationType: { id: 'mp-docType' },
        identificationNumber: { id: 'mp-docNumber' },
      },
      callbacks: {
        onFormMounted: () => {
          handleRef.current = handle;
          if (onReady) onReady(handle);
        },
      },
    });

    return () => {
      try { handle.unmount(); } catch { /* ignore */ }
      handleRef.current = null;
    };
  }, [sdkReady, amount, onReady]);

  return (
    <form id="mp-card-form">
      <div className="checkout-field">
        <label>Número do cartão *</label>
        <div id="mp-cardNumber" style={{ height: 44, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 10, background: '#fff' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="checkout-field">
          <label>Validade *</label>
          <div id="mp-expirationDate" style={{ height: 44, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 10, background: '#fff' }} />
        </div>
        <div className="checkout-field">
          <label>CVV *</label>
          <div id="mp-securityCode" style={{ height: 44, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 10, background: '#fff' }} />
        </div>
      </div>
      <div className="checkout-field">
        <label>Nome no cartão *</label>
        <input id="mp-cardholderName" placeholder="Como aparece no cartão" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="checkout-field">
          <label>Parcelas</label>
          <select id="mp-installments" />
        </div>
        <div className="checkout-field">
          <label>Documento</label>
          <select id="mp-docType" />
          <input id="mp-docNumber" style={{ marginTop: 8 }} />
        </div>
      </div>
    </form>
  );
}
