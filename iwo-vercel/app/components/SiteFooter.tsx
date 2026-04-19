/**
 * SiteFooter — portado de public/loja.html (Webflow export).
 *
 * Componente server-side puro: só markup estático com classes
 * Webflow preservadas. Links internos usam next/link, externos
 * continuam como <a target="_blank">.
 */

import Link from 'next/link';

export function SiteFooter() {
  return (
    <section className="section-15">
      <div className="div-block-46">
        <img
          src="/images/Logo-Icone-Cinza.svg"
          alt="IWO Watch"
          className="image-31"
        />
      </div>
      <div className="global-pad-footer">
        <div className="div-block-44">
          <h1 className="text-footer">Atendimento</h1>
          <div className="text-block-20">
            <strong className="bold-text-3">Horário de atendimento:</strong>
            <br />
          </div>
          <div className="text-block-20">
            <strong className="text-footer-regular">
              Segunda à Sexta-feira:
              <br />
              08:00 às 18:00
              <br />
              Sábados e Feriados:
              <br />
              09:00 às 13:00
            </strong>
            <br />
          </div>
          <div className="div-block-45">
            <img src="/images/mail.svg" alt="" className="image-30" />
            <div className="text-block-21">
              sac@iwowatch.com.br
              <br />
            </div>
          </div>
        </div>
        <div className="div-block-44">
          <h1 className="text-footer">
            Institucional
            <br />
          </h1>
          <div className="text-block-20">
            <strong className="text-footer-regularr-bold">
              A Iwo Watch é uma loja virtual
              <br />
              especializada em produtos de tecnologia.
            </strong>
            <br />
          </div>
          <div className="text-block-20">
            <strong className="text-footer-regular">
              R. Asteca, 29 – Saúde
              <br />
              sac@iwowatch.com.br
            </strong>
            <br />
          </div>
          <div className="text-block-20">
            <strong className="text-footer-regular">
              CNPJ: 54.772.229/0001-73
            </strong>
            <br />
          </div>
          <a
            href="https://instagram.com/iwodobrasil"
            target="_blank"
            rel="noreferrer"
            className="w-inline-block"
            aria-label="Instagram IWO"
          >
            <img src="/images/instagram.svg" alt="" className="image-32" />
          </a>
          <h1 className="text-footer">
            Conheça nosso Blog!
            <br />
          </h1>
          <Link href="/blog" className="linkblog">
            Blog Iwo Watch
          </Link>
        </div>
        <div className="div-block-44">
          <h1 className="text-footer">
            Central do Cliente
            <br />
          </h1>
          <Link href="/politica-de-privacidade" className="link-2">
            Política de Privacidade
          </Link>
          <Link href="/politica-de-devolucoes-e-reembolsos" className="link-2">
            Política de Devoluções
            <br />
          </Link>
          <Link href="/politica-de-envios" className="link-2">
            Política de Envios
          </Link>
          <Link href="/termos-de-servico" className="link-2">
            Termos de Serviços
          </Link>
          <Link href="/perguntas-frequentes" className="link-2">
            Perguntas Frequentes
          </Link>
          <Link href="/contato" className="link-2">
            Contato
          </Link>
        </div>
        <div className="div-block-44">
          <h1 className="text-footer">
            Meus Pedidos
            <br />
          </h1>
          <Link href="/conta" className="link-2">
            Minha Conta
            <br />
          </Link>
          <Link href="/conta/pedidos" className="link-2">
            Rastreio
          </Link>
          <h1 className="text-footer">
            Formas de Pagamento
            <br />
          </h1>
          <div className="div-block-47">
            <img src="/images/forma-de-pagamento-04-1.svg" alt="" />
            <img src="/images/forma-de-pagamento-05-1.svg" alt="" />
            <img src="/images/forma-de-pagamento-10-1.svg" alt="" />
            <img src="/images/forma-de-pagamento-03-1.svg" alt="" />
            <img src="/images/forma-de-pagamento-06-1.svg" alt="" />
            <img src="/images/forma-de-pagamento-07-1.svg" alt="" />
            <img src="/images/forma-de-pagamento-08-1.svg" alt="" />
            <img src="/images/forma-de-pagamento-09-1.svg" alt="" />
            <img src="/images/forma-de-pagamento-02-1.svg" alt="" />
            <img src="/images/forma-de-pagamento-01-1.svg" alt="" />
          </div>
        </div>
      </div>
      <div className="div-footer-cnpj">
        <h1 className="heading-13">
          GSB E-COMMERCE LTDA – CNPJ: 54.772.229/0001-73 – R. Asteca, 29 – SL 02
          - Saúde – SP – sac@iwowatch.com.br
        </h1>
      </div>
    </section>
  );
}

export default SiteFooter;
