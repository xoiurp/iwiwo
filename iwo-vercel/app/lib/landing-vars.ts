// Maps a Product row into the flat vars object consumed by
// interpolateLandingHtml() to substitute `{{key}}` tokens in the stored
// landing HTML.
//
// Keys here must match the VALUES of PLACEHOLDER_MAP in
// landing-placeholders.mjs (that map translates Figma text into the key
// used at both storage and render time).

import { Prisma } from '@prisma/client';
import { PLACEHOLDER_MAP } from './landing-placeholders.mjs';

// ── Prisma select shape ─────────────────────────────────────────────────
// Every Product column the placeholder system can surface.  Used by
// app/p/[slug]/page.tsx to scope the findUnique select.

export const REQUIRED_PRODUCT_FIELDS = {
  // identity
  id: true,
  slug: true,
  name: true,
  seoTitle: true,
  description: true,
  descricaoLonga: true,

  // pricing
  priceFormatted: true,
  compareAtPriceFormatted: true,

  // display / size
  tipoDeTela: true,
  tamanhoDisplay: true,
  tamanhoDaCaixa: true,

  // battery
  capacidadeDaBateria: true,
  duracaoDaBateria: true,
  acompanhaCarregador: true,

  // memory
  memoriaInterna: true,

  // connectivity
  bluetooth: true,
  comGps: true,
  comWiFi: true,
  redeMovel: true,
  comNfc: true,

  // app / assistance
  aplicativo: true,
  comChatGpt: true,
  assistenteDeVoz: true,

  // entertainment
  musicaLocal: true,
  leitorDeEbooks: true,
  gravadorDeVoz: true,
  controleDeMusica: true,

  // health / fitness (booleans)
  ecg: true,
  pressaoArterial: true,
  frequenciaCardiaca: true,
  oxigenioNoSangue: true,
  saudeFeminina: true,
  monitoramentoDeSono: true,
  pedometro: true,

  // colors
  cor1: true,
  cor2: true,
  cor3: true,

  // landing state (needed by the page component itself)
  landingHtml: true,
  landingCss: true,
  landingImportedAt: true,
  image: true,
} as const satisfies Prisma.ProductSelect;

// Row returned by `prisma.product.findUnique({ select: REQUIRED_PRODUCT_FIELDS })`.
export type ProductForLanding = Prisma.ProductGetPayload<{
  select: typeof REQUIRED_PRODUCT_FIELDS;
}>;

// ── Value coercion helpers ──────────────────────────────────────────────

function str(v: string | null | undefined): string {
  return v ?? '';
}

// Nullable boolean Product columns: show "Sim" if true, "Não" otherwise
// (treating null as "not set" → "Não" to avoid empty strings in the UI).
function yn(v: boolean | null | undefined): string {
  return v ? 'Sim' : 'Não';
}

// ── Builder ─────────────────────────────────────────────────────────────

// Returns every placeholder value. Keys MUST stay in sync with the VALUES
// of PLACEHOLDER_MAP — the test below asserts that.
export function buildLandingVars(
  product: ProductForLanding,
): Record<string, string> {
  return {
    // identity
    name: str(product.name),
    subtitle: str(product.seoTitle),
    description: str(product.description),
    longDescription: str(product.descricaoLonga),

    // pricing
    price: str(product.priceFormatted),
    compareAtPrice: str(product.compareAtPriceFormatted),

    // display / size
    screenType: str(product.tipoDeTela),
    screenSize: str(product.tamanhoDisplay),
    caseSize: str(product.tamanhoDaCaixa),

    // battery
    batteryCapacity: str(product.capacidadeDaBateria),
    batteryLife: str(product.duracaoDaBateria),
    includesCharger: yn(product.acompanhaCarregador),

    // memory
    memory: str(product.memoriaInterna),

    // connectivity
    bluetooth: str(product.bluetooth),
    gps: str(product.comGps),
    wifi: yn(product.comWiFi),
    mobileNetwork: yn(product.redeMovel),
    nfc: str(product.comNfc),

    // app / assistance
    app: str(product.aplicativo),
    chatGpt: yn(product.comChatGpt),
    voiceAssistant: yn(product.assistenteDeVoz),

    // entertainment
    localMusic: yn(product.musicaLocal),
    ebookReader: yn(product.leitorDeEbooks),
    voiceRecorder: yn(product.gravadorDeVoz),
    musicControl: yn(product.controleDeMusica),

    // health / fitness
    ecg: yn(product.ecg),
    bloodPressure: yn(product.pressaoArterial),
    heartRate: yn(product.frequenciaCardiaca),
    bloodOxygen: yn(product.oxigenioNoSangue),
    womensHealth: yn(product.saudeFeminina),
    sleepTracking: yn(product.monitoramentoDeSono),
    pedometer: yn(product.pedometro),

    // colors
    color1: str(product.cor1),
    color2: str(product.cor2),
    color3: str(product.cor3),
  };
}

// ── Dev-time self-check ─────────────────────────────────────────────────
// Fails fast at module import time (dev + prod build) if a key defined in
// PLACEHOLDER_MAP has no matching entry in buildLandingVars (or vice
// versa).  Ensures the two files stay in sync.

if (process.env.NODE_ENV !== 'production') {
  const sample = buildLandingVars({
    id: 0, slug: '', name: '', seoTitle: null, description: null,
    descricaoLonga: null, priceFormatted: null, compareAtPriceFormatted: null,
    tipoDeTela: null, tamanhoDisplay: null, tamanhoDaCaixa: null,
    capacidadeDaBateria: null, duracaoDaBateria: null, acompanhaCarregador: null,
    memoriaInterna: null, bluetooth: null, comGps: null, comWiFi: null,
    redeMovel: null, comNfc: null, aplicativo: null, comChatGpt: null,
    assistenteDeVoz: null, musicaLocal: null, leitorDeEbooks: null,
    gravadorDeVoz: null, controleDeMusica: null, ecg: null, pressaoArterial: null,
    frequenciaCardiaca: null, oxigenioNoSangue: null, saudeFeminina: null,
    monitoramentoDeSono: null, pedometro: null, cor1: null, cor2: null,
    cor3: null, landingHtml: null, landingCss: null, landingImportedAt: null,
    image: null,
  } as ProductForLanding);

  const mapValues = new Set<string>(Object.values(PLACEHOLDER_MAP));
  const varKeys = new Set<string>(Object.keys(sample));

  const missingInVars: string[] = [];
  for (const v of mapValues) if (!varKeys.has(v)) missingInVars.push(v);

  const missingInMap: string[] = [];
  for (const k of varKeys) if (!mapValues.has(k)) missingInMap.push(k);

  if (missingInVars.length || missingInMap.length) {
    console.warn(
      '[landing-vars] PLACEHOLDER_MAP / buildLandingVars drift:',
      { missingInVars, missingInMap },
    );
  }
}
