// cart.js — Sistema de carrinho com localStorage e drawer lateral
// Incluir em todas as páginas ANTES de products.js

// =============================================
// CART STATE (localStorage)
// =============================================

const CART_KEY = 'iwo_cart';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  } catch { return []; }
}

function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  updateCartBadge();
}

function addToCart(item) {
  const cart = getCart();
  // Checar se já existe (mesmo product + variant)
  const idx = cart.findIndex(c =>
    c.productId === item.productId && c.variantId === item.variantId
  );
  if (idx >= 0) {
    cart[idx].quantity += item.quantity;
  } else {
    cart.push(item);
  }
  saveCart(cart);
  openCartDrawer();
}

function updateCartItemQty(index, qty) {
  const cart = getCart();
  if (qty <= 0) {
    cart.splice(index, 1);
  } else {
    cart[index].quantity = qty;
  }
  saveCart(cart);
  renderCartDrawer();
}

function removeCartItem(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  renderCartDrawer();
}

function clearCart() {
  saveCart([]);
  renderCartDrawer();
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}

// =============================================
// CART BADGE (header)
// =============================================

function updateCartBadge() {
  const count = getCartCount();
  let badge = document.getElementById('cart-badge');
  if (!badge) return;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function injectCartIcon() {
  // Procura o container de ícones no header (display-inlineflex)
  const iconContainer = document.querySelector('.display-inlineflex');
  if (!iconContainer) return;
  // Verifica se já foi injetado
  if (document.getElementById('cart-icon-link')) return;

  const cartLink = document.createElement('a');
  cartLink.id = 'cart-icon-link';
  cartLink.href = '#';
  cartLink.onclick = function(e) { e.preventDefault(); toggleCartDrawer(); };
  cartLink.style.cssText = 'position:relative;display:flex;align-items:center;cursor:pointer;margin-right:8px;';
  cartLink.innerHTML = `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"></path>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <path d="M16 10a4 4 0 01-8 0"></path>
    </svg>
    <span id="cart-badge" style="position:absolute;top:-6px;right:-8px;background:#2563eb;color:#fff;font-size:10px;font-weight:700;width:18px;height:18px;border-radius:50%;display:none;align-items:center;justify-content:center;">0</span>
  `;
  iconContainer.insertBefore(cartLink, iconContainer.firstChild);
  updateCartBadge();
}

// =============================================
// CART DRAWER
// =============================================

function createCartDrawer() {
  if (document.getElementById('cart-drawer-overlay')) return;

  // Overlay
  const overlay = document.createElement('div');
  overlay.id = 'cart-drawer-overlay';
  overlay.onclick = closeCartDrawer;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9998;display:none;opacity:0;transition:opacity 0.25s;';

  // Drawer
  const drawer = document.createElement('div');
  drawer.id = 'cart-drawer';
  drawer.style.cssText = 'position:fixed;top:0;right:0;width:400px;max-width:90vw;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column;transform:translateX(100%);transition:transform 0.3s ease;box-shadow:-4px 0 20px rgba(0,0,0,0.1);';

  // Header
  drawer.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #eee;">
      <h3 style="margin:0;font-size:18px;font-weight:700;color:#1a1a2e;">Carrinho</h3>
      <button onclick="closeCartDrawer()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;padding:0;line-height:1;">&times;</button>
    </div>
    <div id="cart-drawer-items" style="flex:1;overflow-y:auto;padding:16px 24px;"></div>
    <div id="cart-drawer-footer" style="border-top:1px solid #eee;padding:20px 24px;"></div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
}

function renderCartDrawer() {
  const itemsEl = document.getElementById('cart-drawer-items');
  const footerEl = document.getElementById('cart-drawer-footer');
  if (!itemsEl || !footerEl) return;

  const cart = getCart();

  if (cart.length === 0) {
    itemsEl.innerHTML = '<div style="text-align:center;padding:40px 0;color:#999;font-size:14px;">Seu carrinho está vazio</div>';
    footerEl.innerHTML = '';
    return;
  }

  itemsEl.innerHTML = cart.map((item, i) => `
    <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f3f4f6;${i === 0 ? 'padding-top:0;' : ''}">
      <div style="width:64px;height:64px;border-radius:8px;overflow:hidden;background:#f5f5f5;flex-shrink:0;">
        ${item.image ? `<img src="${item.image}" style="width:100%;height:100%;object-fit:cover;">` : ''}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:#1a1a2e;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</div>
        ${item.variantName ? `<div style="font-size:11px;color:#888;margin-bottom:4px;">${item.variantName}</div>` : ''}
        <div style="font-size:14px;font-weight:700;color:#1a1a2e;">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
          <button onclick="updateCartItemQty(${i}, ${item.quantity - 1})" style="width:26px;height:26px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">−</button>
          <span style="font-size:13px;font-weight:600;min-width:20px;text-align:center;">${item.quantity}</span>
          <button onclick="updateCartItemQty(${i}, ${item.quantity + 1})" style="width:26px;height:26px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">+</button>
          <button onclick="removeCartItem(${i})" style="margin-left:auto;background:none;border:none;color:#dc2626;cursor:pointer;font-size:12px;">Remover</button>
        </div>
      </div>
    </div>
  `).join('');

  const total = getCartTotal();
  footerEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <span style="font-size:14px;color:#666;">Subtotal</span>
      <span style="font-size:18px;font-weight:700;color:#1a1a2e;">R$ ${total.toFixed(2).replace('.', ',')}</span>
    </div>
    <a href="/checkout.html" style="display:block;width:100%;padding:14px;background:#000;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;box-sizing:border-box;">
      Finalizar Compra
    </a>
    <button onclick="clearCart()" style="display:block;width:100%;padding:10px;background:none;border:none;color:#999;cursor:pointer;font-size:12px;margin-top:8px;">
      Limpar carrinho
    </button>
  `;
}

function openCartDrawer() {
  const overlay = document.getElementById('cart-drawer-overlay');
  const drawer = document.getElementById('cart-drawer');
  if (!overlay || !drawer) return;
  renderCartDrawer();
  overlay.style.display = 'block';
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    drawer.style.transform = 'translateX(0)';
  });
  document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
  const overlay = document.getElementById('cart-drawer-overlay');
  const drawer = document.getElementById('cart-drawer');
  if (!overlay || !drawer) return;
  overlay.style.opacity = '0';
  drawer.style.transform = 'translateX(100%)';
  setTimeout(() => {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
}

function toggleCartDrawer() {
  const overlay = document.getElementById('cart-drawer-overlay');
  if (overlay && overlay.style.display === 'block') {
    closeCartDrawer();
  } else {
    openCartDrawer();
  }
}

// =============================================
// BUY BUTTONS (rendered by products.js)
// =============================================

function renderBuyButtons(product, variants) {
  const container = document.getElementById('buy-buttons');
  if (!container) return;

  container.innerHTML = `
    <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;">
      <button id="btn-add-cart" onclick="handleAddToCart()" style="flex:1;min-width:160px;padding:14px 24px;background:#fff;color:#000;border:2px solid #000;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.15s;">
        Adicionar ao Carrinho
      </button>
      <button id="btn-buy-now" onclick="handleBuyNow()" style="flex:1;min-width:160px;padding:14px 24px;background:#000;color:#fff;border:2px solid #000;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.15s;">
        Comprar Agora
      </button>
    </div>
  `;

  // Guardar produto para os handlers
  window.__CURRENT_PRODUCT__ = product;
  window.__CURRENT_VARIANTS__ = variants;
}

function buildCartItem() {
  const p = window.__CURRENT_PRODUCT__;
  if (!p) return null;

  const variants = window.__CURRENT_VARIANTS__ || [];
  const selectedIndex = window.__SELECTED_INDEX__ || 0;
  const variant = variants.length > 0 ? variants[selectedIndex] : null;

  const price = variant && variant.price
    ? parseFloat(variant.price)
    : parseFloat(p.price);

  // Imagem: preferir a da variante, senão a principal do produto
  let image = p.image;
  if (variant && variant.images && variant.images.length > 0) {
    const principal = variant.images.find(i => i.is_principal) || variant.images[0];
    image = principal.url;
  } else if (p.images && p.images.length > 0) {
    const principal = p.images.find(i => i.is_principal) || p.images[0];
    image = principal.url;
  }

  return {
    productId: p.id,
    variantId: variant ? variant.id : null,
    name: p.name,
    variantName: variant ? variant.name : null,
    price: price,
    quantity: 1,
    image: image,
    slug: p.slug,
  };
}

function handleAddToCart() {
  const item = buildCartItem();
  if (!item) return;
  addToCart(item);

  // Feedback visual
  const btn = document.getElementById('btn-add-cart');
  if (btn) {
    const original = btn.textContent;
    btn.textContent = 'Adicionado!';
    btn.style.background = '#16a34a';
    btn.style.color = '#fff';
    btn.style.borderColor = '#16a34a';
    setTimeout(() => {
      btn.textContent = original;
      btn.style.background = '#fff';
      btn.style.color = '#000';
      btn.style.borderColor = '#000';
    }, 1500);
  }
}

function handleBuyNow() {
  const item = buildCartItem();
  if (!item) return;
  // Limpar carrinho e adicionar só este item
  saveCart([item]);
  // Redirecionar para checkout
  window.location.href = '/checkout.html';
}

// =============================================
// INIT
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  createCartDrawer();
  injectCartIcon();
});
