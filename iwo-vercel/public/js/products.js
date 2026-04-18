// products.js — Carrega produtos da API Neon e renderiza nos layouts do Webflow
const API_BASE = '/api/products';

// =============================================
// SKELETON / LOADING STATE — evita flash de "Produto não encontrado"
// =============================================
(function injectSkeletonStyles() {
  if (typeof document === 'undefined' || document.getElementById('iwo-skeleton-styles')) return;
  const style = document.createElement('style');
  style.id = 'iwo-skeleton-styles';
  style.textContent = `
    @keyframes iwo-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .iwo-sk {
      background: linear-gradient(90deg, #eceef1 0%, #f5f6f8 50%, #eceef1 100%);
      background-size: 200% 100%;
      animation: iwo-shimmer 1.4s linear infinite;
      border-radius: 6px;
      color: transparent !important;
      user-select: none;
      pointer-events: none;
    }
    .iwo-sk-card {
      display: flex; flex-direction: column; gap: 10px;
      padding: 12px; background: transparent;
    }
    .iwo-sk-img { aspect-ratio: 1 / 1; width: 100%; }
    .iwo-sk-line { height: 14px; }
    .iwo-sk-line.sm { width: 35%; height: 11px; }
    .iwo-sk-line.md { width: 70%; }
    .iwo-sk-line.lg { width: 90%; }
    .iwo-sk-line.price { width: 50%; height: 18px; margin-top: 4px; }
    /* Product detail page shimmer while body.iwo-loading is set */
    body.iwo-loading .heading-style-h1,
    body.iwo-loading .heading-style-h5,
    body.iwo-loading .heading-style-h5-2,
    body.iwo-loading .text-block-18,
    body.iwo-loading .price_regular-price,
    body.iwo-loading .price_compare-at-price,
    body.iwo-loading .paragraph-2,
    body.iwo-loading .text-description,
    body.iwo-loading .text-center-2 {
      background: linear-gradient(90deg, #eceef1 0%, #f5f6f8 50%, #eceef1 100%);
      background-size: 200% 100%;
      animation: iwo-shimmer 1.4s linear infinite;
      color: transparent !important;
      border-radius: 4px;
    }
    body.iwo-loading #product-main-image {
      background: linear-gradient(90deg, #eceef1 0%, #f5f6f8 50%, #eceef1 100%);
      background-size: 200% 100%;
      animation: iwo-shimmer 1.4s linear infinite;
      border-radius: 8px;
      min-height: 320px;
    }
  `;
  document.head.appendChild(style);
})();

// Hide Webflow's native "No items found" state + flag product pages as loading,
// so these defaults never flash before our fetch resolves.
(function primeLoadingState() {
  if (typeof document === 'undefined') return;
  const run = () => {
    document.querySelectorAll('.w-dyn-empty').forEach((el) => {
      el.style.display = 'none';
      el.setAttribute('data-iwo-hidden', '1');
    });
    // Only flag pages that actually have a product detail layout
    if (document.querySelector('.heading-style-h1')) {
      document.body.classList.add('iwo-loading');
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();

// =============================================
// MENU DE CATEGORIAS — rewire links + destaque + filtro na loja
// =============================================

// Metadata das categorias. As `labels` incluem variações comuns de rotulagem.
const IWO_CATEGORIES = {
  smartwatch: {
    labels: ['smartwatch', 'smart watch'],
    gridIds: ['grid-smartwatch'],
  },
  audio: {
    labels: ['audio', 'áudio'],
    gridIds: ['grid-audio'],
  },
  pulseiras: {
    labels: ['acessorios', 'acessórios', 'pulseiras'],
    gridIds: ['grid-acessorios'],
  },
};

const LOJA_LABELS = ['loja'];

function normalizeLabel(text) {
  return (text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findCategoryKeyByLabel(text) {
  const norm = normalizeLabel(text);
  if (LOJA_LABELS.includes(norm)) return '';
  for (const [key, meta] of Object.entries(IWO_CATEGORIES)) {
    if (meta.labels.some((l) => normalizeLabel(l) === norm)) return key;
  }
  return null;
}

function isOnLojaPage() {
  const p = window.location.pathname;
  return p === '/loja' || p === '/loja/' || p.endsWith('/loja.html');
}

function getCurrentCollection() {
  return new URLSearchParams(window.location.search).get('collection') || '';
}

// Reescreve links antigos de `/account/*` (Shopify/Smootify legado) para as
// novas rotas Next.js `/conta/*`. Server-side há redirects 301 como fallback,
// mas aqui evitamos o roundtrip + atualiza visualmente (hover, contextmenu).
const ACCOUNT_LINK_MAP = [
  { pattern: /\/?(\.\.\/)*account\/login(?:\.html)?(?:\?.*)?(?:#.*)?$/i, to: '/conta/login' },
  { pattern: /\/?(\.\.\/)*account\/register(?:\.html)?(?:\?.*)?(?:#.*)?$/i, to: '/conta/registro' },
  { pattern: /\/?(\.\.\/)*account\/my-account(?:\.html)?(?:\?.*)?(?:#.*)?$/i, to: '/conta' },
  { pattern: /\/?(\.\.\/)*account\/orders(?:\.html)?(?:\?.*)?(?:#.*)?$/i, to: '/conta/pedidos' },
  { pattern: /\/?(\.\.\/)*account\/order(?:\.html)?(?:\?.*)?(?:#.*)?$/i, to: '/conta/pedidos' },
  // Absolute URLs apontando pro domínio de produção
  { pattern: /^https?:\/\/(www\.)?iwowatch\.com\.br\/account\/login\/?$/i, to: '/conta/login' },
  { pattern: /^https?:\/\/(www\.)?iwowatch\.com\.br\/account\/register\/?$/i, to: '/conta/registro' },
  { pattern: /^https?:\/\/(www\.)?iwowatch\.com\.br\/account\/my-account\/?$/i, to: '/conta' },
  { pattern: /^https?:\/\/(www\.)?iwowatch\.com\.br\/account\/orders\/?$/i, to: '/conta/pedidos' },
  { pattern: /^https?:\/\/(www\.)?iwowatch\.com\.br\/account\/order\/?$/i, to: '/conta/pedidos' },
];

// =============================================
// NEWSLETTER — intercepta forms do Webflow e POSTa pra /api/newsletter/subscribe
// =============================================
function wireNewsletterForms() {
  // Cada container .newsletter-form-block tem seu próprio form, .w-form-done e .w-form-fail.
  // Evita handler duplicado em submit via data-iwo-wired flag.
  const blocks = document.querySelectorAll('.newsletter-form-block');
  blocks.forEach((block) => {
    if (block.getAttribute('data-iwo-wired') === '1') return;
    const form = block.querySelector('form');
    if (!form) return;

    block.setAttribute('data-iwo-wired', '1');

    const emailInput = form.querySelector('input[type="email"]');
    const submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');
    const doneMsg = block.querySelector('.w-form-done');
    const failMsg = block.querySelector('.w-form-fail');

    // Evita o reload GET default do Webflow
    form.setAttribute('method', 'post');
    form.setAttribute('action', '/api/newsletter/subscribe');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const email = (emailInput && emailInput.value || '').trim();
      if (!email) return;

      const originalLabel = submitBtn ? (submitBtn.value || submitBtn.textContent) : null;
      if (submitBtn) {
        submitBtn.setAttribute('disabled', '');
        if ('value' in submitBtn) submitBtn.value = 'Aguarde...';
      }
      if (failMsg) failMsg.style.display = 'none';
      if (doneMsg) doneMsg.style.display = 'none';

      try {
        const res = await fetch('/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source: window.location.pathname }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          // Mostra o w-form-done nativo do Webflow (e esconde o form)
          if (doneMsg) {
            doneMsg.style.display = 'block';
            const inner = doneMsg.querySelector('div');
            if (inner && data && data.message) inner.textContent = data.message;
          }
          form.style.display = 'none';
        } else {
          if (failMsg) {
            failMsg.style.display = 'block';
            const inner = failMsg.querySelector('div');
            if (inner && data && data.message) inner.textContent = data.message;
          }
        }
      } catch (err) {
        console.error('[newsletter] submit failed:', err);
        if (failMsg) failMsg.style.display = 'block';
      } finally {
        if (submitBtn) {
          submitBtn.removeAttribute('disabled');
          if ('value' in submitBtn && originalLabel) submitBtn.value = originalLabel;
        }
      }
    });
  });
}

function rewireAccountLinks() {
  const anchors = document.querySelectorAll('a[href]');
  anchors.forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;
    for (const { pattern, to } of ACCOUNT_LINK_MAP) {
      if (pattern.test(href)) {
        a.setAttribute('href', to);
        // Remove aria-current/w--current herdados do HTML Webflow — podem
        // estar marcados como "page atual" errôneamente.
        a.classList.remove('w--current');
        if (a.getAttribute('aria-current') === 'page') {
          a.removeAttribute('aria-current');
        }
        return;
      }
    }
  });
}

// Reescreve hrefs dos links do menu para apontar pra /loja ou /loja?collection=X.
// Match por texto do link (tolerante a acento / case).
function rewireCategoryMenu() {
  const links = document.querySelectorAll(
    'a.w-nav-link, a.navlink-notselected'
  );
  links.forEach((link) => {
    const key = findCategoryKeyByLabel(link.textContent);
    if (key === null) return; // não é link de categoria
    const target = key === '' ? '/loja' : `/loja?collection=${key}`;
    link.setAttribute('href', target);
    link.setAttribute('data-iwo-category', key);
  });
}

// Aplica a classe `w--current` só no link que bate com a categoria atual.
// Na loja sem filtro → destaca "Loja". Com filtro → destaca a categoria.
// Fora da loja → remove destaque desses links (Webflow já lida via aria-current).
function applyCurrentCategoryHighlight() {
  const onLoja = isOnLojaPage();
  const current = onLoja ? getCurrentCollection() : null;

  document.querySelectorAll('[data-iwo-category]').forEach((link) => {
    const linkKey = link.getAttribute('data-iwo-category') || '';
    const shouldBeActive = onLoja && linkKey === current;
    if (shouldBeActive) {
      link.classList.add('w--current');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('w--current');
      if (link.getAttribute('aria-current') === 'page') {
        link.removeAttribute('aria-current');
      }
    }
  });
}

// Na loja, se houver ?collection=X, esconde as <section> que contêm os grids
// das outras categorias. Sem filtro, mostra tudo.
function filterLojaByCategory() {
  if (!isOnLojaPage()) return;
  const current = getCurrentCollection();
  if (!current || !IWO_CATEGORIES[current]) return; // fallback: mostra tudo

  Object.entries(IWO_CATEGORIES).forEach(([key, meta]) => {
    if (key === current) return;
    meta.gridIds.forEach((gridId) => {
      const grid = document.getElementById(gridId);
      if (!grid) return;
      const section =
        grid.closest('section') ||
        grid.closest('.section_product6') ||
        grid.parentElement;
      if (section) section.style.display = 'none';
    });
  });
}

function skeletonGridHTML(count = 6, colClass = 'w-col-4') {
  const card = `
    <div role="listitem" class="iwo-sk-card w-dyn-item w-col ${colClass}">
      <div class="iwo-sk iwo-sk-img"></div>
      <div class="iwo-sk iwo-sk-line md">.</div>
      <div class="iwo-sk iwo-sk-line sm">.</div>
      <div class="iwo-sk iwo-sk-line price">.</div>
    </div>`;
  return Array(count).fill(card).join('');
}

async function fetchProducts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.type) params.set('type', filters.type);
  if (filters.collection) params.set('collection', filters.collection);
  if (filters.min) params.set('min', filters.min);
  if (filters.max) params.set('max', filters.max);
  if (filters.limit) params.set('limit', filters.limit);
  if (filters.offset) params.set('offset', filters.offset);
  const res = await fetch(`${API_BASE}?${params.toString()}`);
  return res.json();
}

async function fetchProduct(slug) {
  const res = await fetch(`${API_BASE}/${slug}`);
  if (!res.ok) {
    // 404 ou 500: propaga pro catch do chamador pra não confundir com produto real
    throw new Error(`fetchProduct ${slug}: ${res.status}`);
  }
  return await res.json();
}

// =============================================
// LOJA — Grids por coleção
// =============================================

function renderSmartwatch(p) {
  return `
    <div role="listitem" class="collection-item-2 w-dyn-item w-col w-col-4">
      <div>
        <a href="/p/${p.slug}" class="product6_image-link w-inline-block">
          <div class="product6_image-wrapper">
            ${p.image ? `<img src="${p.image}" loading="lazy" alt="${p.name}" class="product6_image">` : ''}
          </div>
        </a>
      </div>
      <div class="asdadasdasd">
        <div class="product6_left">
          <a href="/p/${p.slug}" class="link-block-17 w-inline-block">
            <div class="div-block-73">
              <div class="text-size-medium text-weight-semibold">${p.name}</div>
              <div class="text-size-small">${p.product_type || ''}</div>
            </div>
          </a>
          ${p.tamanho_da_caixa ? `<div class="div-block-72"><img src="images/product_tile_icon_case_sizes__frpc80tcj9me_large.png" loading="lazy" alt="" class="image-45"><div class="text-size-small">Tamanho da Caixa:</div><div class="text-size-small">${p.tamanho_da_caixa}</div></div>` : ''}
          ${p.tamanho_display ? `<div class="div-block-72"><img src="images/tamanhodisplay.png" loading="lazy" alt="" class="image-45"><div class="text-size-small">Tamanho da Tela:</div><div class="text-size-small">${p.tamanho_display}</div></div>` : ''}
          ${p.tipo_de_tela ? `<div class="div-block-72"><img src="images/product_tile_icon_case_fill__fszn2l29zuy6_large.png" loading="lazy" alt="" class="image-44-copy"><div class="text-size-small">Display:</div><div class="text-size-small">${p.tipo_de_tela}</div></div>` : ''}
          ${p.capacidade_da_bateria ? `<div class="div-block-72"><img src="images/product_tile_icon_battery__cf9dxpv3s9iu_large.png" loading="lazy" alt="" class="image-44"><div class="text-size-small">Bateria:</div><div class="text-size-small">${p.capacidade_da_bateria}</div></div>` : ''}
          ${p.bluetooth ? `<div class="div-block-72"><img src="images/bluetooth.svg" loading="lazy" alt="" class="image-44"><div class="text-size-small">Bluetooth:</div><div class="text-size-small">${p.bluetooth}</div></div>` : ''}
          ${(p.cor_1 || p.cor_2 || p.cor_3) ? `<div class="div-block-72"><div class="text-size-small">Cores:</div>${p.cor_1 ? `<div class="div-block-74" style="background-color:${p.cor_1}"></div>` : ''}${p.cor_2 ? `<div class="cor2" style="background-color:${p.cor_2}"></div>` : ''}${p.cor_3 ? `<div class="cor3" style="background-color:${p.cor_3}"></div>` : ''}</div>` : ''}
        </div>
        <a href="/p/${p.slug}" class="product6_text-link w-inline-block">
          <div class="product-header6_price-wrapper-2">
            ${p.compare_at_price ? `<span class="text-style-strikethrough text-style-muted">${p.compare_at_price_formatted}</span>` : ''}
            <span class="text-size-large text-weight-semibold">${p.price_formatted}</span>
          </div>
        </a>
        <a href="/p/${p.slug}" class="link-block-16 w-inline-block">
          <div>Ver Detalhes</div>
        </a>
      </div>
    </div>`;
}

function renderSimpleCard(p) {
  return `
    <div role="listitem" class="collection-item-2 w-dyn-item w-col w-col-4">
      <div>
        <a href="/p/${p.slug}" class="product6_image-link w-inline-block">
          <div class="product6_image-wrapper">
            ${p.image ? `<img src="${p.image}" loading="lazy" alt="${p.name}" class="product6_image">` : ''}
          </div>
        </a>
      </div>
      <div class="asdadasdasd">
        <div class="product6_left">
          <a href="/p/${p.slug}" class="link-block-17 w-inline-block">
            <div class="div-block-73">
              <div class="text-size-medium text-weight-semibold">${p.name}</div>
              <div class="text-size-small">${p.product_type || ''}</div>
            </div>
          </a>
        </div>
        <a href="/p/${p.slug}" class="product6_text-link w-inline-block">
          <div class="product-header6_price-wrapper-2">
            ${p.compare_at_price ? `<span class="text-style-strikethrough text-style-muted">${p.compare_at_price_formatted}</span>` : ''}
            <span class="text-size-large text-weight-semibold">${p.price_formatted}</span>
          </div>
        </a>
        <a href="/p/${p.slug}" class="link-block-16 w-inline-block">
          <div>Ver Detalhes</div>
        </a>
      </div>
    </div>`;
}

// Card da home (estrutura original Webflow com product_card / product_image-cover)
function renderHomeCard(colClass) {
  return function(p) {
    return `
      <div role="listitem" class="collection-item w-dyn-item w-col ${colClass}">
        <div class="product-wrapper">
          <div class="product_card">
            <a href="/p/${p.slug}" class="product_images-wrapper relative w-inline-block">
              ${p.image ? `<img loading="lazy" alt="${p.name}" src="${p.image}" class="product_image-cover">` : ''}
              ${p.compare_at_price ? `<div class="discount-percentage-icon-2"><span>OFF</span></div>` : ''}
            </a>
            <div class="product-card_info-container-2">
              <div class="product-card_info-wrapper-4">
                <div class="product-card_title-wrapper">
                  <a href="/p/${p.slug}" class="product-info_title-link w-inline-block">
                    <h5 class="heading-style-h5-2">${p.name}</h5>
                  </a>
                </div>
                <div class="product-card_price-wrapper-2">
                  ${p.compare_at_price ? `<span class="price_compare-at-price-5 is-small">${p.compare_at_price_formatted}</span>` : ''}
                  <span class="price_regular-price-9 is-small">${p.price_formatted}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  };
}

async function fillGrid(gridId, collection, renderer, skeletonCol = 'w-col-4') {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  // Esconder a mensagem "Nenhum produto encontrado" do Webflow (fica fora do grid)
  const parent = grid.closest('.w-dyn-list');
  const emptyMsg = parent?.querySelector('.w-dyn-empty');
  if (emptyMsg) emptyMsg.style.display = 'none';

  // Skeleton cards enquanto carrega
  grid.innerHTML = skeletonGridHTML(6, skeletonCol);

  try {
    const data = await fetchProducts({ collection, limit: 50 });
    if (!data.products || data.products.length === 0) {
      grid.innerHTML = '';
      if (emptyMsg) emptyMsg.style.display = 'block';
      return;
    }
    grid.innerHTML = data.products.map(renderer).join('');
  } catch (err) {
    console.error(`Erro ao carregar ${collection}:`, err);
    grid.innerHTML = '<div style="padding:20px;color:#dc2626;">Erro ao carregar produtos.</div>';
  }
}

// =============================================
// PRODUTO — Preenche o HTML existente do Webflow
// =============================================

// Mapa: texto do label no HTML → campo do banco de dados
const SPEC_MAP = {
  'Tipo de tela':            p => p.tipo_de_tela,
  'Tamanho da tela':         p => p.tamanho_display,
  'Com Chat GPT':            p => p.com_chat_gpt ? 'Sim' : 'Não',
  'Gravador de Voz':         p => p.gravador_de_voz ? 'Sim' : 'Não',
  'Leitor de E-books':       p => p.leitor_de_ebooks ? 'Sim' : 'Não',
  'Música Local':            p => p.musica_local ? 'Sim' : 'Não',
  'Memória Interna':         p => p.memoria_interna,
  'Com GPS':                 p => p.com_gps,
  'Duração da bateria':      p => p.duracao_da_bateria,
  'Bluetooth':               p => p.bluetooth,
  'Tamanho da Caixa':        p => p.tamanho_da_caixa,
  'Bússola':                 p => p.com_gps ? 'Sim' : 'Não',
  'Capacidade da bateria':   p => p.capacidade_da_bateria,
  'Acompanha carregador':    p => p.acompanha_carregador ? 'Sim' : 'Não',
  'Oxigênio no Sangue':      p => p.oxigenio_no_sangue ? 'Sim' : 'Não',
  'Frequência Cardíaca':     p => p.frequencia_cardiaca ? 'Sim' : 'Não',
  'Pressão Arterial':        p => p.pressao_arterial ? 'Sim' : 'Não',
  'ECG':                     p => p.ecg ? 'Sim' : 'Não',
  'Saúde Feminina':          p => p.saude_feminina ? 'Sim' : 'Não',
  'Monitoramento de Sono':   p => p.monitoramento_de_sono ? 'Sim' : 'Não',
  'Pedômetro':               p => p.pedometro ? 'Sim' : 'Não',
  'Rede móvel':              p => p.rede_movel ? 'Sim' : 'Não',
  'Com Wi-Fi':               p => p.com_wi_fi ? 'Sim' : 'Não',
  'Com NFC':                 p => p.com_nfc,
  'Assistente de Voz':       p => p.assistente_de_voz ? 'Sim' : 'Não',
  'Aplicativo':              p => p.aplicativo,
  'Controle de Música':      p => p.controle_de_musica ? 'Sim' : 'Não',
};

function fillText(el, text) {
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('w-dyn-bind-empty');
}

function fillHTML(el, html) {
  if (!el) return;
  el.innerHTML = html || '';
  el.classList.remove('w-dyn-bind-empty');
}

async function populateProductPage() {
  // Usa slug injetado pela rota dinâmica, ou extrai da URL
  const path = window.location.pathname;
  const slug = window.__PRODUCT_SLUG__
    || path.split('/').pop().replace('.html', '');
  if (!slug || slug === 'loja' || slug === 'index') {
    document.body.classList.remove('iwo-loading');
    return;
  }

  // Checa se a página tem a estrutura de produto do Webflow
  const titleEl = document.querySelector('.heading-style-h1');
  if (!titleEl) {
    document.body.classList.remove('iwo-loading');
    return;
  }

  try {
    const data = await fetchProduct(slug);
    const p = data.product;
    const variants = data.variants || [];
    if (!p) {
      document.body.classList.remove('iwo-loading');
      titleEl.textContent = 'Produto não encontrado';
      return;
    }

    // --- Título ---
    fillText(titleEl, p.name);
    document.title = p.name + ' — IWO Watch';

    // --- Breadcrumb (nome do produto) ---
    const breadcrumbName = document.querySelector('.text-block-18');
    fillText(breadcrumbName, p.name);

    // --- Preços ---
    const comparePrice = document.querySelector('.price_compare-at-price');
    const regularPrice = document.querySelector('.price_regular-price');
    if (p.compare_at_price) {
      fillText(comparePrice, p.compare_at_price_formatted);
    }
    fillText(regularPrice, p.price_formatted);

    // --- Descrição curta ---
    const shortDesc = document.querySelector('.paragraph-2');
    fillHTML(shortDesc, p.descricao_longa || p.description || '');

    // --- Descrição longa (accordion) ---
    const longDesc = document.querySelector('.text-description');
    fillHTML(longDesc, p.descricao_longa || p.description || '');

    // --- Imagem / Galeria ---
    const mainImageContainer = document.getElementById('product-main-image');
    if (mainImageContainer) {
      const imgs = (p.images && p.images.length > 0)
        ? [...p.images].sort((a, b) => a.position - b.position)
        : (p.image ? [{ url: p.image, position: 0, is_principal: true }] : []);

      if (imgs.length > 0) {
        const principalUrl = (imgs.find(i => i.is_principal) || imgs[0]).url;

        let html = `<img id="gallery-main" src="${principalUrl}" alt="${p.name}" style="width:100%;height:100%;object-fit:contain;">`;

        if (imgs.length > 1) {
          html += `<div id="gallery-thumbs" style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">`;
          imgs.forEach((img, i) => {
            const isActive = img.url === principalUrl;
            html += `<img
              src="${img.url}"
              alt="Foto ${i + 1}"
              onclick="document.getElementById('gallery-main').src='${img.url}';document.querySelectorAll('#gallery-thumbs img').forEach(t=>t.style.borderColor='#e5e7eb');this.style.borderColor='#2563eb';"
              style="width:64px;height:64px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid ${isActive ? '#2563eb' : '#e5e7eb'};transition:border-color 0.15s;"
            >`;
          });
          html += `</div>`;
        }

        mainImageContainer.innerHTML = html;
      }
    }

    // --- Especificações técnicas ---
    const specItems = document.querySelectorAll('.list .list-item');
    specItems.forEach(li => {
      const labelEl = li.querySelector('.text-block-15');
      const valueEl = li.querySelector('.text-center-2');
      if (!labelEl || !valueEl) return;

      // Normaliza o label removendo ":" e espaços extras
      const rawLabel = labelEl.textContent.replace(/[:：]\s*$/, '').trim();

      // Procura no mapa
      const getter = SPEC_MAP[rawLabel];
      if (getter) {
        const val = getter(p);
        fillText(valueEl, val || '—');
      }
    });

    // --- Variantes ---
    renderVariantSelector(variants, p);

    // --- Botões de compra ---
    if (typeof renderBuyButtons === 'function') {
      renderBuyButtons(p, variants);
    }

    // --- Produtos relacionados ---
    await fillRelatedProducts(p);

    // Esconde o "No items found" das listas vazias
    document.querySelectorAll('.w-dyn-empty').forEach(el => el.style.display = 'none');

    // Remove shimmer — dados carregados
    document.body.classList.remove('iwo-loading');

  } catch (err) {
    console.error('Erro ao preencher página de produto:', err);
    document.body.classList.remove('iwo-loading');
    titleEl.textContent = 'Produto não encontrado';
  }
}

// =============================================
// VARIANTES — seletor de cor/tamanho
// =============================================

function renderVariantSelector(variants, product) {
  const container = document.getElementById('variant-selector');
  if (!container || !variants || variants.length === 0) return;

  let html = '<div style="margin-top:20px;">';

  // Seletor de variantes (botões com nome)
  html += '<div style="margin-bottom:16px;">';
  html += '<div style="font-size:13px;font-weight:600;color:#555;margin-bottom:8px;">Variações</div>';
  html += '<div id="variant-buttons" style="display:flex;gap:8px;flex-wrap:wrap;">';
  variants.forEach((v, i) => {
    html += `<button type="button" data-variant-index="${i}" onclick="selectVariantByIndex(${i})"
      style="padding:8px 16px;border-radius:6px;border:none;
      background:${i === 0 ? '#000' : '#333'};color:#fff;font-size:13px;cursor:pointer;
      transition:all 0.15s;opacity:${i === 0 ? '1' : '0.6'};">
      ${v.name}
    </button>`;
  });
  html += '</div></div>';

  // Info da variante selecionada
  html += '<div id="variant-info" style="margin-top:12px;"></div>';
  html += '</div>';

  container.innerHTML = html;

  // Guardar variantes em variável global para o seletor
  window.__VARIANTS__ = variants;
  window.__SELECTED_INDEX__ = 0;

  // Selecionar a primeira variante automaticamente
  updateSelectedVariant();
}

function selectVariantByIndex(index) {
  window.__SELECTED_INDEX__ = index;

  // Atualizar visual dos botões
  document.querySelectorAll('#variant-buttons button').forEach((btn, i) => {
    btn.style.background = i === index ? '#000' : '#333';
    btn.style.opacity = i === index ? '1' : '0.6';
  });

  updateSelectedVariant();
}

function updateSelectedVariant() {
  const variants = window.__VARIANTS__ || [];
  if (variants.length === 0) return;

  const match = variants[window.__SELECTED_INDEX__] || variants[0];
  if (!match) return;

  // Atualizar preço se a variante tem preço próprio
  if (match.price) {
    const priceEl = document.querySelector('.price_regular-price');
    if (priceEl) {
      priceEl.textContent = 'R$ ' + parseFloat(match.price).toFixed(2).replace('.', ',');
    }
    if (match.compare_at_price) {
      const compareEl = document.querySelector('.price_compare-at-price');
      if (compareEl) {
        compareEl.textContent = 'R$ ' + parseFloat(match.compare_at_price).toFixed(2).replace('.', ',');
      }
    }
  }

  // Atualizar galeria com imagens da variante (se tiver)
  const variantImages = Array.isArray(match.images) ? match.images : [];
  if (variantImages.length > 0) {
    const sorted = [...variantImages].sort((a, b) => a.position - b.position);
    const mainImg = document.getElementById('gallery-main');
    if (mainImg) {
      const principal = sorted.find(i => i.is_principal) || sorted[0];
      mainImg.src = principal.url;
    }

    const thumbs = document.getElementById('gallery-thumbs');
    if (thumbs) {
      thumbs.innerHTML = sorted.map((img, i) => {
        const isFirst = i === 0;
        return `<img src="${img.url}" alt="Foto ${i + 1}"
          onclick="document.getElementById('gallery-main').src='${img.url}';document.querySelectorAll('#gallery-thumbs img').forEach(t=>t.style.borderColor='#e5e7eb');this.style.borderColor='#2563eb';"
          style="width:64px;height:64px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid ${isFirst ? '#2563eb' : '#e5e7eb'};transition:border-color 0.15s;">`;
      }).join('');
    }
  }

  // Info da variante selecionada
  const infoEl = document.getElementById('variant-info');
  if (infoEl) {
    infoEl.innerHTML = `<div style="font-size:13px;color:#666;">${match.name}</div>`;
  }
}

async function fillRelatedProducts(currentProduct) {
  const grid = document.querySelector('.relacionados .w-dyn-items');
  if (!grid) return;

  try {
    const data = await fetchProducts({
      collection: currentProduct.collections,
      limit: 4
    });

    // Filtra o produto atual e pega até 4
    const related = data.products
      .filter(p => p.slug !== currentProduct.slug)
      .slice(0, 4);

    if (related.length === 0) {
      grid.closest('.section-14').style.display = 'none';
      return;
    }

    grid.innerHTML = related.map(p => `
      <div role="listitem" class="w-dyn-item w-col w-col-3">
        <div class="product-wrapper-2">
          <div class="product_card">
            <a href="/p/${p.slug}" class="product_images-wrapper relative w-inline-block">
              ${p.image ? `<img loading="lazy" alt="${p.name}" src="${p.image}" class="product_image-cover">` : ''}
            </a>
            <div class="product-card_info-container">
              <div class="product-card_info-wrapper">
                <div class="product-card_title-wrapper">
                  <a href="/p/${p.slug}" class="product-info_title-link w-inline-block">
                    <h5 class="heading-style-h5">${p.name}</h5>
                  </a>
                </div>
                <div class="product-card_price-wrapper">
                  ${p.compare_at_price ? `<span class="price_compare-at-price-3 is-small">${p.compare_at_price_formatted}</span>` : ''}
                  <span class="price_regular-price-3 is-small">${p.price_formatted}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Erro ao carregar produtos relacionados:', err);
  }
}

// =============================================
// INICIALIZAÇÃO
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  // Migração Shopify → Next.js: reescreve /account/* pra /conta/*
  rewireAccountLinks();

  // Newsletter: intercepta forms do Webflow e posta na API
  wireNewsletterForms();

  // Menu de categorias: normaliza hrefs + destaca link ativo + filtra loja
  rewireCategoryMenu();
  applyCurrentCategoryHighlight();
  filterLojaByCategory();

  // Grids da loja (por coleção)
  fillGrid('grid-smartwatch', 'smartwatch', renderSmartwatch);
  fillGrid('grid-audio', 'audio', renderSimpleCard);
  fillGrid('grid-acessorios', 'pulseiras', renderSimpleCard);

  // Grids da home (3 colunas para smartwatch/pulseiras, 2 para audio)
  fillGrid('home-grid-smartwatch', 'smartwatch', renderHomeCard('w-col-4'), 'w-col-4');
  fillGrid('home-grid-audio', 'audio', renderHomeCard('w-col-6'), 'w-col-6');
  fillGrid('home-grid-pulseiras', 'pulseiras', renderHomeCard('w-col-4'), 'w-col-4');

  // Página de produto individual — preenche o HTML existente
  populateProductPage();
});
