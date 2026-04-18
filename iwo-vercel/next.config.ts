import type { NextConfig } from "next";
import path from "node:path";

// Clean URL ↔ Webflow HTML mapping.
// Entries here expose the exported static pages from `public/` at ergonomic
// paths (no `.html`). Dynamic routes like `/p/[slug]` still win over these.
// When a page is migrated to a real Next.js `app/*` route, remove its entry.
const STATIC_PAGE_MAP: Array<[string, string]> = [
  // Home
  ["/", "/index.html"],

  // Principais
  ["/loja", "/loja.html"],
  ["/carrinho", "/cart.html"],
  ["/checkout", "/checkout.html"],
  ["/contato", "/contato.html"],
  ["/biografia-instagram", "/biografia-instagram.html"],

  // Institucional
  ["/sobre-nos", "/sobre-nos.html"],
  ["/perguntas-frequentes", "/perguntas-frequentes.html"],
  ["/politica-de-privacidade", "/politica-de-privacidade.html"],
  ["/politica-de-envios", "/politica-de-envios.html"],
  ["/politica-de-devolucoes-e-reembolsos", "/politica-de-devolucoes-e-reembolsos.html"],
  ["/termos-de-servico", "/termos-de-servico.html"],

  // NOTA: /conta/* eram rewrites pros HTMLs Shopify/Smootify legados.
  // Agora existem como rotas Next.js reais em app/conta/(auth)/* e
  // app/conta/(protected)/*. App router vence sobre rewrites, então
  // remover estes aliases evita confusão.

  // Blog
  ["/blog", "/blog/principal.html"],

  // Produtos hardcoded (stopgap — substituir por /p/[slug] dinâmico)
  ["/iwo-14-mini", "/iwo-14-mini.html"],
  ["/iwo-14-pro-max", "/iwo-14-pro-max.html"],
  ["/iwo-15-x-mini", "/iwo-15-x-mini.html"],
  ["/iwo-15x-pro", "/iwo-15x-pro.html"],
  ["/iwo-15x", "/iwo-15x.html"],
  ["/iwo-s10", "/iwo-s10.html"],
  ["/iwo-ultra-3-amoled", "/iwo-ultra-3-amoled.html"],
  ["/iwo-ultra-3-pro", "/iwo-ultra-3-pro.html"],
];

// Redirects 301 pra URLs antigas do Shopify/Smootify.
// Bookmarks, links externos e HTMLs Webflow ainda não-editados continuam
// chegando nas páginas certas. Cada par cobre `/account/X` e `/account/X.html`.
const LEGACY_ACCOUNT_REDIRECTS: Array<[string, string]> = [
  ["/account/login", "/conta/login"],
  ["/account/login.html", "/conta/login"],
  ["/account/register", "/conta/registro"],
  ["/account/register.html", "/conta/registro"],
  ["/account/my-account", "/conta"],
  ["/account/my-account.html", "/conta"],
  ["/account/orders", "/conta/pedidos"],
  ["/account/orders.html", "/conta/pedidos"],
  ["/account/order", "/conta/pedidos"],
  ["/account/order.html", "/conta/pedidos"],
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    return STATIC_PAGE_MAP.map(([source, destination]) => ({ source, destination }));
  },
  async redirects() {
    return LEGACY_ACCOUNT_REDIRECTS.map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }));
  },
};

export default nextConfig;
