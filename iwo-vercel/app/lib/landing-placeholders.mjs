// Single source of truth for the Figma→landing placeholder system.
//
// Key = the exact text authored inside `{…}` in a Figma text node
//        (case-sensitive, accents preserved).
// Value = the placeholder key emitted to the stored HTML as `{{value}}`
//        and consumed by buildLandingVars() in landing-vars.ts.
//
// WORKFLOW to add a new placeholder:
//   1. In Figma, type the text `{<Chave em Português>}` in a text node.
//   2. Add the entry below: `'<Chave em Português>': '<camelCaseKey>'`.
//   3. Add a matching line in buildLandingVars() that returns the value.
//   4. Add the Product column to REQUIRED_PRODUCT_FIELDS in landing-vars.ts
//      (only if it isn't already selected).
//   5. Run `node scripts/figma-import-26/import.mjs` to re-import.
//
// This file is `.mjs` so both the TypeScript app (app/p/[slug]/page.tsx
// via landing-vars.ts) and the plain-ESM import script
// (scripts/figma-import-26/import.mjs) can consume the same map.

export const PLACEHOLDER_MAP = {
  // ── Hero / identity ────────────────────────────────────────────────────
  'Nome do Produto': 'name',
  'Subtítulo do produto': 'subtitle',
  'Descrição curta do produto': 'description',
  'Descrição longa do produto': 'longDescription',

  // ── Pricing ────────────────────────────────────────────────────────────
  'Preço': 'price',
  'Preço Comparativo': 'compareAtPrice',

  // ── Tela / display ─────────────────────────────────────────────────────
  'Tipo de Tela': 'screenType',
  'Tamanho da Tela': 'screenSize',
  'Tamanho da Caixa': 'caseSize',

  // ── Bateria ────────────────────────────────────────────────────────────
  'Capacidade da Bateria': 'batteryCapacity',
  'Duração da Bateria': 'batteryLife',
  'Acompanha Carregador': 'includesCharger',

  // ── Memória ────────────────────────────────────────────────────────────
  'Memória Interna': 'memory',

  // ── Conectividade ──────────────────────────────────────────────────────
  'Bluetooth': 'bluetooth',
  'GPS': 'gps',
  'Wi-Fi': 'wifi',
  'Rede Móvel': 'mobileNetwork',
  'NFC': 'nfc',

  // ── App / assistência ──────────────────────────────────────────────────
  'Aplicativo': 'app',
  'Chat GPT': 'chatGpt',
  'Assistente de Voz': 'voiceAssistant',

  // ── Entretenimento ─────────────────────────────────────────────────────
  'Música Local': 'localMusic',
  'Leitor de E-books': 'ebookReader',
  'Gravador de Voz': 'voiceRecorder',
  'Controle de Música': 'musicControl',

  // ── Saúde / fitness (booleanos → Sim/Não) ──────────────────────────────
  'ECG': 'ecg',
  'Pressão Arterial': 'bloodPressure',
  'Frequência Cardíaca': 'heartRate',
  'Oxigênio no Sangue': 'bloodOxygen',
  'Saúde Feminina': 'womensHealth',
  'Monitoramento de Sono': 'sleepTracking',
  'Pedômetro': 'pedometer',

  // ── Cores disponíveis ──────────────────────────────────────────────────
  'Cor 1': 'color1',
  'Cor 2': 'color2',
  'Cor 3': 'color3',
};

// Matches any `{...}` in a landing HTML. Used by the import script to
// detect Figma tokens that aren't in PLACEHOLDER_MAP yet (so we can warn
// about them instead of silently dropping them).
export const FIGMA_TOKEN_RE = /\{([^{}\n]+?)\}/g;
