'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCheckoutState } from '@/app/lib/checkoutState';
import { PaymentMethodTabs, PayMethod } from '@/app/components/checkout/PaymentMethodTabs';
import { CardForm } from '@/app/components/checkout/CardForm';
import { formatBRL } from '@/app/lib/format';
import type { CSSProperties } from 'react';

const styles: Record<string, CSSProperties> = {
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  info: { padding: 14, color: '#4b5563', fontSize: 13, background: '#f9fafb', borderRadius: 8 },
  actions: { display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24 },
};

type CardFormHandle = {
  getCardFormData: () => { token?: string; paymentMethodId?: string };
  createCardToken: () => Promise<{ id: string; payment_method_id?: string }>;
};

export default function PagamentoPage() {
  const router = useRouter();
  const { state, total } = useCheckoutState();
  const [method, setMethod] = useState<PayMethod>('pix');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState(state.shipTo?.document ?? '');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const cardHandleRef = useRef<CardFormHandle | null>(null);
  // "Seed" tracking as state (not a ref) — React 19 forbids ref access
  // during render. Comparing prev state during render and calling setters
  // is the idiomatic React pattern for "reset state when props change".
  const [seededShipName, setSeededShipName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Espera primeiro tick de hidratação antes dos guards — useSyncExternalStore
  // retorna EMPTY do server snapshot no 1º render; sem esse flag os guards
  // redirecionariam antes do localStorage ser lido.
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!state.shipTo || !state.shipping || state.cart.length === 0) {
      router.replace('/checkout/endereco');
    }
  }, [hydrated, state, router]);

  // Pré-preenche dados do pagador com o perfil do cliente logado.
  // Se for guest, /api/customer/profile retorna 401 e mantemos os
  // campos vazios (usuário preenche manualmente). Só dispara uma vez
  // e nunca sobrescreve o que o usuário já digitou.
  const [profileSeeded, setProfileSeeded] = useState(false);
  useEffect(() => {
    if (!hydrated || profileSeeded) return;
    setProfileSeeded(true);
    (async () => {
      try {
        const res = await fetch('/api/customer/profile');
        if (!res.ok) return;
        const { user } = (await res.json()) as {
          user?: {
            email?: string;
            customer?: { name?: string; phone?: string; cpf?: string };
          };
        };
        if (!user) return;
        const fullName = user.customer?.name ?? '';
        setFirstName((prev) => {
          if (prev) return prev;
          const parts = fullName.trim().split(/\s+/);
          return parts[0] ?? '';
        });
        setLastName((prev) => {
          if (prev) return prev;
          const parts = fullName.trim().split(/\s+/);
          return parts.slice(1).join(' ');
        });
        setEmail((prev) => prev || user.email || '');
        setCpf((prev) => prev || user.customer?.cpf || '');
        setPhone((prev) => prev || user.customer?.phone || '');
      } catch {
        /* silent — guest ou rede instável; usuário preenche à mão */
      }
    })();
  }, [hydrated, profileSeeded]);

  const shipName = state.shipTo?.name ?? null;
  if (shipName && seededShipName !== shipName) {
    setSeededShipName(shipName);
    const parts = shipName.trim().split(/\s+/);
    setFirstName(parts[0] ?? '');
    setLastName(parts.slice(1).join(' '));
  }

  async function handlePay() {
    if (processing) return;
    setErr(null);
    setProcessing(true);

    try {
      const cpfDigits = cpf.replace(/\D/g, '');
      if (!firstName.trim() || !lastName.trim()) {
        setErr('Preencha nome e sobrenome.');
        setProcessing(false);
        return;
      }
      if (!email.includes('@')) {
        setErr('E-mail inválido.');
        setProcessing(false);
        return;
      }
      if (cpfDigits.length !== 11) {
        setErr('CPF inválido.');
        setProcessing(false);
        return;
      }

      const payer: Record<string, unknown> = {
        email,
        first_name: firstName,
        last_name: lastName,
        identification: { type: 'CPF', number: cpfDigits },
      };

      let payment_method: Record<string, unknown> = {};
      if (method === 'pix') {
        payment_method = { id: 'pix', type: 'bank_transfer' };
      } else if (method === 'boleto') {
        payment_method = { id: 'boleto', type: 'ticket' };
        payer.address = {
          street_name: state.shipTo!.address,
          street_number: state.shipTo!.number,
          zip_code: state.shipTo!.postalCode,
          neighborhood: state.shipTo!.district,
          city: state.shipTo!.city,
          state: state.shipTo!.state,
        };
      } else if (method === 'credit_card') {
        const handle = cardHandleRef.current;
        if (!handle) {
          setErr('Formulário de cartão ainda carregando. Aguarde...');
          setProcessing(false);
          return;
        }
        const tokenResult = await handle.createCardToken();
        if (!tokenResult?.id) {
          setErr('Falha ao tokenizar cartão. Verifique os dados.');
          setProcessing(false);
          return;
        }
        payment_method = {
          id: tokenResult.payment_method_id ?? 'master',
          type: 'credit_card',
          token: tokenResult.id,
          installments: 1,
        };
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: state.cart,
          payer,
          payment_method,
          shipping: {
            serviceId: state.shipping!.serviceId,
            toPostalCode: state.shipTo!.postalCode,
            quotedPrice: state.shipping!.price,
          },
          shipTo: {
            name: `${firstName.trim()} ${lastName.trim()}`,
            document: cpfDigits,
            postalCode: state.shipTo!.postalCode,
            address: state.shipTo!.address,
            number: state.shipTo!.number,
            complement: state.shipTo!.complement,
            district: state.shipTo!.district,
            city: state.shipTo!.city,
            state: state.shipTo!.state,
          },
          couponCode: state.coupon?.code ?? null,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        if (data.error === 'COUPON_INVALID') {
          router.replace('/checkout/carrinho?msg=coupon_invalid');
          return;
        }
        if (
          data.error === 'SHIPPING_QUOTE_STALE' ||
          data.error === 'SHIPPING_OPTION_UNAVAILABLE'
        ) {
          router.replace('/checkout/endereco?msg=quote_stale');
          return;
        }
      }

      if (!res.ok) {
        setErr(data.error ?? 'Erro ao processar pagamento');
        setProcessing(false);
        return;
      }

      // Gravar detalhes do meio de pagamento (Pix QR, boleto) em sessionStorage
      // para a tela de confirmação exibir sem re-fetchar MP.
      const payDetails: Record<string, unknown> = {};
      if (data.pix) payDetails.pix = data.pix;
      if (data.boleto) payDetails.boleto = data.boleto;
      try {
        sessionStorage.setItem('iwo_payment_details', JSON.stringify(payDetails));
      } catch {
        /* ignore quota */
      }

      router.push(`/checkout/confirmacao/${data.orderId}?token=${data.token}`);
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
      setProcessing(false);
    }
  }

  if (!hydrated) return <div className="checkout-card">Carregando...</div>;
  if (!state.shipTo || !state.shipping) return null;

  return (
    <>

      <div className="checkout-card">
        <h2>Dados do pagador</h2>
        <div style={styles.row}>
          <div className="checkout-field">
            <label>Nome *</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="checkout-field">
            <label>Sobrenome *</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="checkout-field">
          <label>E-mail *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div style={styles.row}>
          <div className="checkout-field">
            <label>CPF *</label>
            <input
              value={cpf}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, '').slice(0, 11);
                const fmt =
                  d.length > 9
                    ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
                    : d.length > 6
                    ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
                    : d.length > 3
                    ? `${d.slice(0, 3)}.${d.slice(3)}`
                    : d;
                setCpf(fmt);
              }}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>
          <div className="checkout-field">
            <label>Telefone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="checkout-card">
        <h2>Forma de pagamento</h2>
        <PaymentMethodTabs value={method} onChange={setMethod} />
        {method === 'pix' ? (
          <div style={styles.info}>
            Ao clicar em Pagar, você receberá um QR Code Pix para pagamento instantâneo.
          </div>
        ) : method === 'boleto' ? (
          <div style={styles.info}>
            O boleto será gerado e poderá ser pago em qualquer banco ou app.
          </div>
        ) : (
          <CardForm
            amount={total}
            onReady={(h) => {
              cardHandleRef.current = h;
            }}
          />
        )}
      </div>

      {err ? (
        <div className="checkout-banner checkout-banner--error">{err}</div>
      ) : null}

      <div style={styles.actions}>
        <button
          type="button"
          onClick={() => router.push('/checkout/endereco')}
          className="checkout-btn-secondary"
        >
          {'\u2190'} Voltar
        </button>
        <button
          type="button"
          onClick={handlePay}
          disabled={processing}
          className="checkout-btn-primary"
          style={{ maxWidth: 280 }}
        >
          {processing ? 'Processando...' : `Pagar ${formatBRL(total)}`}
        </button>
      </div>
    </>
  );
}
