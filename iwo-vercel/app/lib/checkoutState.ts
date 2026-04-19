// useCheckoutState — fonte central do estado do checkout multi-step.
// Persiste em localStorage sob a chave `iwo_checkout_state`; sincroniza
// entre componentes e abas via `storage` event.

'use client';

import { useCallback, useSyncExternalStore } from 'react';

type CartItem = {
  productId: number;
  variantId?: number;
  name: string;
  variantName?: string;
  price: number;
  quantity: number;
  image?: string;
  slug?: string;
};

type AppliedCoupon = {
  code: string;
  kind: 'PERCENT' | 'FIXED';
  discount: number;
  description: string | null;
};

type ShipTo = {
  name: string;
  document: string;
  postalCode: string;
  address: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
};

type ShippingOption = {
  serviceId: 1 | 2 | 17;
  name: string;
  price: number;
  deliveryMin: number;
  deliveryMax: number;
  box: { weight: number; height: number; width: number; length: number };
};

export type CheckoutState = {
  cart: CartItem[];
  coupon: AppliedCoupon | null;
  shipTo: ShipTo | null;
  selectedAddressId: number | null;
  shipping: ShippingOption | null;
};

const STORAGE_KEY = 'iwo_checkout_state';
const CART_KEY = 'iwo_cart'; // chave pré-existente do checkout.html antigo
const EMPTY: CheckoutState = {
  cart: [],
  coupon: null,
  shipTo: null,
  selectedAddressId: null,
  shipping: null,
};

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
}

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function getSnapshot(): CheckoutState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<CheckoutState>) : {};
    return {
      cart: readCart(), // cart é fonte separada — iwo_cart
      coupon: parsed.coupon ?? null,
      shipTo: parsed.shipTo ?? null,
      selectedAddressId: parsed.selectedAddressId ?? null,
      shipping: parsed.shipping ?? null,
    };
  } catch {
    return EMPTY;
  }
}

function writeState(patch: Partial<Omit<CheckoutState, 'cart'>>) {
  if (typeof window === 'undefined') return;
  const current = getSnapshot();
  const next = {
    coupon: patch.coupon !== undefined ? patch.coupon : current.coupon,
    shipTo: patch.shipTo !== undefined ? patch.shipTo : current.shipTo,
    selectedAddressId:
      patch.selectedAddressId !== undefined
        ? patch.selectedAddressId
        : current.selectedAddressId,
    shipping: patch.shipping !== undefined ? patch.shipping : current.shipping,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('storage'));
}

function writeCart(cart: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('storage'));
}

function clearCheckoutState() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  // NOTA: cart (iwo_cart) só é limpo depois do pagamento aprovado;
  // step 4 (confirmação) chama clearCart() explicitamente.
  window.dispatchEvent(new Event('storage'));
}

function clearCart() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event('storage'));
}

export function useCheckoutState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  const setCoupon = useCallback((coupon: AppliedCoupon | null) => {
    writeState({ coupon });
  }, []);

  const setShipTo = useCallback((shipTo: ShipTo | null) => {
    writeState({ shipTo });
  }, []);

  const setSelectedAddressId = useCallback((id: number | null) => {
    writeState({ selectedAddressId: id });
  }, []);

  const setShipping = useCallback((shipping: ShippingOption | null) => {
    writeState({ shipping });
  }, []);

  const setCart = useCallback((cart: CartItem[]) => {
    writeCart(cart);
  }, []);

  const clear = useCallback(() => {
    clearCheckoutState();
  }, []);

  const clearAll = useCallback(() => {
    clearCheckoutState();
    clearCart();
  }, []);

  const subtotal = state.cart.reduce((s, it) => s + it.price * it.quantity, 0);
  const couponDiscount = state.coupon?.discount ?? 0;
  const shippingCost = state.shipping?.price ?? 0;
  const total = Math.round((subtotal - couponDiscount + shippingCost) * 100) / 100;

  return {
    state,
    subtotal,
    couponDiscount,
    shippingCost,
    total,
    setCoupon,
    setShipTo,
    setSelectedAddressId,
    setShipping,
    setCart,
    clear,
    clearAll,
  };
}
