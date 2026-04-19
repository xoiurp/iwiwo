'use client';

/**
 * SiteHeader — portado de public/loja.html (Webflow export).
 *
 * Mantém as classes Webflow intactas para que os estilos de
 * public/css/iwo-watch.webflow.css + webflow.css apliquem sem retrabalho.
 * Links internos usam next/link para navegação SPA. Substituímos a logo
 * pelo arquivo oficial /images/iwo_cinza_extended-1-p-500.webp.
 *
 * Interatividade mínima: o hamburger (w-nav-button) abre/fecha o menu
 * sem depender de webflow.js/jQuery — um `useState` alterna a classe
 * `w--open` no menu, que é reconhecida pelo CSS Webflow.
 */

import Link from 'next/link';
import { useState } from 'react';

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      data-animation="default"
      className="navbar21_component w-nav"
      data-easing2="ease"
      data-easing="ease"
      data-collapse="all"
      role="banner"
      data-duration="0"
    >
      <div className="navbar21_container">
        <Link href="/" className="navbar21_logo-link w-nav-brand">
          <img
            src="/images/iwo_cinza_extended-1-p-500.webp"
            alt="IWO Watch"
            style={{ height: 28, width: 'auto', display: 'block', maxWidth: 'none' }}
          />
        </Link>
        <div className="menu-wrapper-copy">
          <Link href="/" className="navlink-notselected w-nav-link">
            Home
          </Link>
          <Link
            href="/loja"
            aria-current="page"
            className="navlink-notselected w-nav-link w--current"
          >
            Loja
          </Link>
          <Link href="/loja" className="navlink-notselected w-nav-link">
            Smartwatch
          </Link>
          <Link href="/loja" className="navlink-notselected w-nav-link">
            Áudio
          </Link>
          <Link href="/loja" className="navlink-notselected w-nav-link">
            Pulseiras
          </Link>
        </div>
        <div className="navbar21_wrapper">
          <nav
            role="navigation"
            className={`navbar21_menu w-nav-menu${menuOpen ? ' w--open' : ''}`}
            style={menuOpen ? { display: 'block' } : undefined}
          >
            <div className="navbar21_menu-wrapper">
              <div className="navbar21_menu-left">
                <div className="navbar21_menu-links-wrapper">
                  <Link href="/p/iwo-ultra-3-amoled" className="link-block-9 w-inline-block">
                    <div className="div-block-60">
                      <img src="/images/svgexport-19.svg" alt="" className="icone-prod" />
                      <h1 className="heading-22-copy">Iwo Ultra 3 AMOLED</h1>
                    </div>
                  </Link>
                  <Link href="/p/iwo-15x" className="link-block-9 w-inline-block">
                    <div className="div-block-60">
                      <img src="/images/svgexport-20.svg" alt="" className="icone-prod" />
                      <h1 className="heading-22">Iwo 15X Pro</h1>
                    </div>
                  </Link>
                  <Link href="/p/iwo-14-mini" className="link-block-9 w-inline-block">
                    <div className="div-block-60">
                      <img src="/images/svgexport-22.svg" alt="" className="icone-prod" />
                      <h1 className="heading-22">Iwo 14 Mini</h1>
                    </div>
                  </Link>
                  <Link href="/p/iwo-14-pro-max" className="link-block-9 w-inline-block">
                    <div className="div-block-60">
                      <img src="/images/svgexport-20.svg" alt="" className="icone-prod" />
                      <h1 className="heading-22">Iwo 14 Pro Max</h1>
                    </div>
                  </Link>
                  <Link href="/p/iwo-15-x-mini" className="link-block-9 w-inline-block">
                    <div className="div-block-60">
                      <img src="/images/svgexport-21.svg" alt="" className="icone-prod" />
                      <h1 className="heading-22">Iwo 15X Mini</h1>
                    </div>
                  </Link>
                  <Link href="/loja" className="link-block-9 w-inline-block">
                    <div className="div-block-60">
                      <img src="/images/svgexport-23.svg" alt="" className="image-40" />
                      <h1 className="heading-22">Air Pods Pro</h1>
                    </div>
                  </Link>
                  <Link href="/loja" className="link-block-9 w-inline-block">
                    <div className="div-block-60">
                      <img src="/images/svgexport-24.svg" alt="" className="icone-prod" />
                      <h1 className="heading-22">Air Pods Max</h1>
                    </div>
                  </Link>
                  <Link href="/loja" className="link-block-9 w-inline-block">
                    <div className="div-block-60">
                      <img src="/images/watch_nav_bands_large_.svg" alt="" />
                      <h1 className="heading-22">Pulseiras</h1>
                    </div>
                  </Link>
                  <Link
                    href="/loja"
                    aria-current="page"
                    className="link-block-9 w-inline-block w--current"
                  >
                    <div className="div-block-60">
                      <img src="/images/shopping-bag.svg" alt="" className="icone-prod" />
                      <h1 className="heading-22">Todos os Produtos</h1>
                    </div>
                  </Link>
                </div>
                <div className="navbar21_menu-links-wrapper-copy">
                  <Link href="/conta" className="link-block-9 w-inline-block">
                    <div className="div-supop">
                      <img src="/images/account.svg" alt="" className="image-38" />
                      <h1 className="heading-22">Minha Conta</h1>
                    </div>
                  </Link>
                  <Link href="/conta" className="link-block-9 w-inline-block">
                    <div className="div-supop">
                      <img src="/images/Air-Pods-Max.svg" alt="" className="image-39" />
                      <h1 className="heading-22">Suporte ao Cliente</h1>
                    </div>
                  </Link>
                </div>
              </div>
              <div className="navbar21_menu-right">
                <div className="div-block-63">
                  <h1 className="heading-24">Artigos do Blog em Destaque</h1>
                </div>
                {/* TODO: Webflow CMS dynamic list — substituir por CMS real quando existir */}
                <div className="div-block-63">
                  <Link href="/blog" className="button-20 w-button">
                    Ver Blog
                  </Link>
                </div>
              </div>
              <div className="navbar21_bottom">
                <Link href="/contato" className="text-size-large">
                  Contato
                </Link>
                <div className="w-layout-grid navbar21_social-list">
                  <a
                    href="https://www.instagram.com/iwodobrasil/"
                    target="_blank"
                    rel="noreferrer"
                    className="navbar21_social-link w-inline-block"
                    aria-label="Instagram"
                  >
                    <div className="social-icon w-embed">
                      {/* TODO: Webflow SVG — porting verbatim */}
                      <svg
                        width="100%"
                        height="100%"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M16 3H8C5.23858 3 3 5.23858 3 8V16C3 18.7614 5.23858 21 8 21H16C18.7614 21 21 18.7614 21 16V8C21 5.23858 18.7614 3 16 3ZM19.25 16C19.2445 17.7926 17.7926 19.2445 16 19.25H8C6.20735 19.2445 4.75549 17.7926 4.75 16V8C4.75549 6.20735 6.20735 4.75549 8 4.75H16C17.7926 4.75549 19.2445 6.20735 19.25 8V16ZM16.75 8.25C17.3023 8.25 17.75 7.80228 17.75 7.25C17.75 6.69772 17.3023 6.25 16.75 6.25C16.1977 6.25 15.75 6.69772 15.75 7.25C15.75 7.80228 16.1977 8.25 16.75 8.25ZM12 7.5C9.51472 7.5 7.5 9.51472 7.5 12C7.5 14.4853 9.51472 16.5 12 16.5C14.4853 16.5 16.5 14.4853 16.5 12C16.5027 10.8057 16.0294 9.65957 15.1849 8.81508C14.3404 7.97059 13.1943 7.49734 12 7.5ZM9.25 12C9.25 13.5188 10.4812 14.75 12 14.75C13.5188 14.75 14.75 13.5188 14.75 12C14.75 10.4812 13.5188 9.25 12 9.25C10.4812 9.25 9.25 10.4812 9.25 12Z"
                          fill="CurrentColor"
                        />
                      </svg>
                    </div>
                  </a>
                  <a
                    href="#"
                    className="navbar21_social-link w-inline-block"
                    aria-label="YouTube"
                  >
                    <div className="icon-embed-xsmall w-embed">
                      {/* TODO: Webflow SVG — porting verbatim */}
                      <svg
                        width="100%"
                        height="100%"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M20.5686 4.77345C21.5163 5.02692 22.2555 5.76903 22.5118 6.71673C23.1821 9.42042 23.1385 14.5321 22.5259 17.278C22.2724 18.2257 21.5303 18.965 20.5826 19.2213C17.9071 19.8831 5.92356 19.8015 3.40294 19.2213C2.45524 18.9678 1.71595 18.2257 1.45966 17.278C0.827391 14.7011 0.871044 9.25144 1.44558 6.73081C1.69905 5.78311 2.44116 5.04382 3.38886 4.78753C6.96561 4.0412 19.2956 4.282 20.5686 4.77345ZM9.86682 8.70227L15.6122 11.9974L9.86682 15.2925V8.70227Z"
                          fill="CurrentColor"
                        />
                      </svg>
                    </div>
                  </a>
                </div>
                <div className="navbar21_bottom-background-overlay-tablet" />
              </div>
            </div>
          </nav>
          <div className="display-inlineflex">
            <Link href="/conta" className="link-block-8 w-inline-block" aria-label="Minha conta">
              <div className="icon-header-copy w-embed">
                {/* TODO: Webflow SVG — porting verbatim */}
                <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                  <path d="m437.019531 74.980469c-48.351562-48.351563-112.640625-74.980469-181.019531-74.980469s-132.667969 26.628906-181.019531 74.980469c-48.351563 48.351562-74.980469 112.640625-74.980469 181.019531s26.628906 132.667969 74.980469 181.019531c48.351562 48.351563 112.640625 74.980469 181.019531 74.980469s132.667969-26.628906 181.019531-74.980469c48.351563-48.351562 74.980469-112.640625 74.980469-181.019531s-26.628906-132.667969-74.980469-181.019531zm-325.914062 354.316406c8.453125-72.734375 70.988281-128.890625 144.894531-128.890625 38.960938 0 75.597656 15.179688 103.15625 42.734375 23.28125 23.285156 37.964844 53.6875 41.742188 86.152344-39.257813 32.878906-89.804688 52.707031-144.898438 52.707031s-105.636719-19.824219-144.894531-52.703125zm144.894531-159.789063c-42.871094 0-77.753906-34.882812-77.753906-77.753906 0-42.875 34.882812-77.753906 77.753906-77.753906s77.753906 34.878906 77.753906 77.753906c0 42.871094-34.882812 77.753906-77.753906 77.753906zm170.71875 134.425782c-7.644531-30.820313-23.585938-59.238282-46.351562-82.003906-18.4375-18.4375-40.25-32.269532-64.039063-40.9375 28.597656-19.394532 47.425781-52.160157 47.425781-89.238282 0-59.414062-48.339844-107.753906-107.753906-107.753906s-107.753906 48.339844-107.753906 107.753906c0 37.097656 18.84375 69.875 47.464844 89.265625-21.886719 7.976563-42.140626 20.308594-59.566407 36.542969-25.234375 23.5-42.757812 53.464844-50.882812 86.347656-34.410157-39.667968-55.261719-91.398437-55.261719-147.910156 0-124.617188 101.382812-226 226-226s226 101.382812 226 226c0 56.523438-20.859375 108.265625-55.28125 147.933594zm0 0" />
                </svg>
              </div>
            </Link>
            <button
              type="button"
              className="navbar21_menu-button w-nav-button"
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <div className="menu-icon4">
                <div className="menu-icon4_wrapper">
                  <div className="menu-icon4_line-top" />
                  <div className="menu-icon4_line-middle">
                    <div className="menu-icon_line-middle-top" />
                    <div className="menu-icon_line-middle-base" />
                  </div>
                  <div className="menu-icon4_line-bottom" />
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SiteHeader;
