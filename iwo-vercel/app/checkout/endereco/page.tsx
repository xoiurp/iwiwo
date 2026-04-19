'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCheckoutState } from '@/app/lib/checkoutState';
import { Stepper } from '@/app/components/checkout/Stepper';
import { AddressForm, AddressFormValue } from '@/app/components/checkout/AddressForm';
import { AddressAccordion, SavedAddress } from '@/app/components/checkout/AddressAccordion';
import { ShippingOptions, ShippingOption } from '@/app/components/checkout/ShippingOptions';
import type { CSSProperties } from 'react';

const styles: Record<string, CSSProperties> = {
  actions: { display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24 },
  addNew: {
    padding: 14,
    border: '2px dashed #d1d5db',
    borderRadius: 10,
    cursor: 'pointer',
    background: 'transparent',
    width: '100%',
    textAlign: 'center',
    color: '#4b5563',
    fontWeight: 600,
    fontSize: 14,
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

function EnderecoPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, setShipTo, setSelectedAddressId, setShipping } = useCheckoutState();

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[] | null>(null);
  const [selectedSavedId, setSelectedSavedId] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newAddress, setNewAddress] = useState<AddressFormValue | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[] | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const msg = params.get('msg');

  // Espera primeiro tick de hidratação antes de ativar os guards —
  // useSyncExternalStore usa EMPTY do server snapshot inicialmente.
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Guard: sem cart → step 1
  useEffect(() => {
    if (hydrated && state.cart.length === 0) {
      router.replace('/checkout/carrinho');
    }
  }, [hydrated, state.cart.length, router]);

  // Carregar endereços do usuário logado
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/customer/addresses');
        if (res.ok) {
          const data = (await res.json()) as { addresses?: SavedAddress[] };
          setSavedAddresses(data.addresses ?? []);
          const def = (data.addresses ?? []).find((a) => a.isDefault);
          if (def) setSelectedSavedId(def.id);
        } else {
          setSavedAddresses([]);
        }
      } catch {
        setSavedAddresses([]);
      }
    })();
  }, []);

  const runQuote = useCallback(
    async (cep: string) => {
      setShippingLoading(true);
      setShippingError(null);
      try {
        const res = await fetch('/api/shipping/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toPostalCode: cep,
            items: state.cart.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setShippingError(data.error ?? 'Falha ao cotar frete');
          setShippingOptions(null);
          return;
        }
        setShippingOptions(data.options);
        if (data.options?.length > 0) {
          setShipping(data.options[0]);
        }
      } catch {
        setShippingError('Falha ao cotar frete');
        setShippingOptions(null);
      } finally {
        setShippingLoading(false);
      }
    },
    [state.cart, setShipping],
  );

  function pickSaved(addr: SavedAddress) {
    setSelectedSavedId(addr.id);
    setSelectedAddressId(addr.id);
    setShipTo({
      name: addr.recipient,
      document: '',
      postalCode: addr.cep.replace(/\D/g, ''),
      address: addr.street,
      number: addr.number,
      complement: addr.complement ?? null,
      district: addr.neighborhood,
      city: addr.city,
      state: addr.state,
    });
    runQuote(addr.cep.replace(/\D/g, ''));
  }

  function updateFormAddress(v: AddressFormValue) {
    setNewAddress(v);
    const cep = v.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;
    if (
      v.recipient.trim() &&
      v.street.trim() &&
      v.number.trim() &&
      v.city.trim() &&
      /^[A-Z]{2}$/.test(v.state)
    ) {
      setShipTo({
        name: v.recipient.trim(),
        document: (v.document ?? '').replace(/\D/g, ''),
        postalCode: cep,
        address: v.street.trim(),
        number: v.number.trim(),
        complement: v.complement.trim() || null,
        district: v.district.trim() || 'NA',
        city: v.city.trim(),
        state: v.state,
      });
      setSelectedAddressId(null);
      runQuote(cep);
    }
  }

  async function saveAndContinue() {
    setFormError(null);
    if (savedAddresses && addingNew && newAddress) {
      const v = newAddress;
      try {
        const res = await fetch('/api/customer/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: v.label || undefined,
            recipient: v.recipient,
            cep: v.cep,            // POST expects formatted "00000-000"
            street: v.street,
            number: v.number,
            complement: v.complement || undefined,
            neighborhood: v.district || 'NA',
            city: v.city,
            state: v.state,
            isDefault: savedAddresses.length === 0,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setFormError(data.message ?? data.error ?? 'Falha ao salvar endereço');
          return;
        }
      } catch {
        setFormError('Falha de rede ao salvar endereço');
        return;
      }
    }
    if (!state.shipTo || !state.shipping) {
      setFormError('Preencha endereço e escolha uma opção de frete.');
      return;
    }
    router.push('/checkout/pagamento');
  }

  const isLogged = savedAddresses !== null && savedAddresses.length > 0;

  return (
    <>
      <Stepper current={2} />
      <div className="checkout-card">
        <h2>Endereço de entrega</h2>
        {msg === 'quote_stale' ? (
          <div style={styles.banner}>
            O valor do frete foi atualizado. Por favor, confirme novamente.
          </div>
        ) : null}

        {savedAddresses === null ? (
          <div>Carregando...</div>
        ) : isLogged && !addingNew ? (
          <>
            {savedAddresses.map((addr) => (
              <AddressAccordion
                key={addr.id}
                address={addr}
                selected={selectedSavedId === addr.id}
                onSelect={() => pickSaved(addr)}
                defaultOpen={addr.isDefault}
              />
            ))}
            <button
              type="button"
              onClick={() => setAddingNew(true)}
              style={styles.addNew}
            >
              + Adicionar novo endereço
            </button>
          </>
        ) : (
          <AddressForm
            showDocument
            showLabel={savedAddresses !== null && savedAddresses.length > 0}
            onChange={updateFormAddress}
          />
        )}
      </div>

      <div className="checkout-card">
        <h2>Opções de frete</h2>
        <ShippingOptions
          loading={shippingLoading}
          options={shippingOptions}
          selectedId={state.shipping?.serviceId ?? null}
          onSelect={(opt) => setShipping(opt)}
        />
        {shippingError ? (
          <div style={{ marginTop: 12, fontSize: 13, color: '#dc2626' }}>
            {shippingError}
          </div>
        ) : null}
      </div>

      {formError ? (
        <div className="checkout-banner checkout-banner--error">{formError}</div>
      ) : null}

      <div style={styles.actions}>
        <button
          type="button"
          onClick={() => router.push('/checkout/carrinho')}
          className="checkout-btn-secondary"
        >
          {'\u2190'} Voltar
        </button>
        <button
          type="button"
          onClick={saveAndContinue}
          className="checkout-btn-primary"
          style={{ maxWidth: 280 }}
          disabled={!state.shipTo || !state.shipping}
        >
          Continuar {'\u2192'}
        </button>
      </div>
    </>
  );
}

export default function EnderecoPage() {
  return (
    <Suspense fallback={<Stepper current={2} />}>
      <EnderecoPageInner />
    </Suspense>
  );
}
