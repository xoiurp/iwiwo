// app/lib/email-templates.ts
// Minimal, responsive, single-column HTML templates for transactional email.
// Style is intentionally inline (email-client safe) and uses neutral brand
// palette — #000 primary, #111 copy, #888 muted. Keep these in sync with
// the visual language used on iwowatch.com.br.

type TemplatePayload = {
  subject: string;
  html: string;
  text: string;
};

const BRAND = '#000000';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(opts: {
  preheader: string;
  title: string;
  bodyHtml: string;
}): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(opts.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(opts.preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid ${BORDER};">
                <div style="font-size:18px;font-weight:700;letter-spacing:0.04em;color:${BRAND};">IWO WATCH</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;font-size:15px;line-height:1.55;color:#111;">
                ${opts.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;border-top:1px solid ${BORDER};font-size:12px;color:${MUTED};">
                Você recebeu este email porque uma ação foi solicitada na sua conta IWO Watch.
                Se não foi você, pode ignorar esta mensagem com segurança.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
    <tr>
      <td align="center" bgcolor="${BRAND}" style="border-radius:6px;">
        <a href="${href}" target="_blank" rel="noopener"
           style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

export function welcomeVerifyEmail(opts: {
  name?: string | null;
  verifyUrl: string;
}): TemplatePayload {
  const greet = opts.name ? `Olá, ${opts.name}` : 'Olá';
  const subject = 'Bem-vindo ao IWO Watch — confirme seu email';
  const html = layout({
    preheader: 'Confirme seu email para ativar sua conta IWO Watch.',
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px;"><strong>${escapeHtml(greet)}!</strong></p>
      <p style="margin:0 0 12px;">Bem-vindo ao <strong>IWO Watch</strong>. Para ativar sua conta, confirme seu email clicando no botão abaixo:</p>
      ${button(opts.verifyUrl, 'Confirmar meu email')}
      <p style="margin:0 0 8px;font-size:13px;color:${MUTED};">Ou copie e cole este link no navegador:</p>
      <p style="margin:0 0 16px;word-break:break-all;font-size:13px;"><a href="${opts.verifyUrl}" style="color:${BRAND};">${escapeHtml(opts.verifyUrl)}</a></p>
      <p style="margin:0;font-size:13px;color:${MUTED};">Este link é válido por <strong>24 horas</strong>. Se você não criou uma conta no IWO Watch, pode ignorar este email.</p>
    `,
  });
  const text = [
    `${greet}!`,
    '',
    'Bem-vindo ao IWO Watch. Para ativar sua conta, confirme seu email:',
    opts.verifyUrl,
    '',
    'Este link é válido por 24 horas. Se você não criou uma conta, ignore este email.',
  ].join('\n');
  return { subject, html, text };
}

export function ticketCreatedEmail(opts: {
  ticketId: number;
  subject: string;
  customerName?: string | null;
}): TemplatePayload {
  const greet = opts.customerName ? `Olá, ${opts.customerName}` : 'Olá';
  const subject = `Seu ticket #${opts.ticketId} foi aberto — IWO Watch`;
  const html = layout({
    preheader: `Recebemos seu ticket #${opts.ticketId}. Responderemos em breve.`,
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px;"><strong>${escapeHtml(greet)}.</strong></p>
      <p style="margin:0 0 12px;">Recebemos seu ticket de suporte <strong>#${opts.ticketId}</strong> com o assunto:</p>
      <p style="margin:0 0 16px;padding:12px 14px;background:#f7f7f8;border-left:3px solid ${BRAND};font-size:14px;color:#1a1a1a;">${escapeHtml(opts.subject)}</p>
      <p style="margin:0 0 12px;">Nossa equipe analisará sua solicitação e responderá em breve. Você pode acompanhar o andamento diretamente na sua conta.</p>
      <p style="margin:0;font-size:13px;color:${MUTED};">Caso precise adicionar informações, basta responder pela página do ticket.</p>
    `,
  });
  const text = [
    `${greet}.`,
    '',
    `Recebemos seu ticket de suporte #${opts.ticketId} — "${opts.subject}".`,
    'Nossa equipe analisará sua solicitação e responderá em breve.',
    '',
    'Você pode acompanhar o andamento na sua conta IWO Watch.',
  ].join('\n');
  return { subject, html, text };
}

export function ticketReplyAdminNotify(opts: {
  ticketId: number;
  subject: string;
  customerName?: string | null;
  preview: string;
  adminUrl?: string;
}): TemplatePayload {
  const name = opts.customerName ?? 'Cliente';
  const subject = `Nova mensagem no ticket #${opts.ticketId}`;
  const previewClipped =
    opts.preview.length > 240 ? `${opts.preview.slice(0, 240)}…` : opts.preview;
  const html = layout({
    preheader: `${name} respondeu ao ticket #${opts.ticketId}.`,
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px;"><strong>Nova atividade no suporte.</strong></p>
      <p style="margin:0 0 8px;font-size:14px;"><strong>Ticket:</strong> #${opts.ticketId} — ${escapeHtml(opts.subject)}</p>
      <p style="margin:0 0 12px;font-size:14px;"><strong>Cliente:</strong> ${escapeHtml(name)}</p>
      <p style="margin:0 0 8px;font-size:13px;color:${MUTED};">Prévia da mensagem:</p>
      <p style="margin:0 0 16px;padding:12px 14px;background:#f7f7f8;border-left:3px solid ${BRAND};font-size:14px;color:#1a1a1a;white-space:pre-wrap;">${escapeHtml(previewClipped)}</p>
      ${opts.adminUrl ? button(opts.adminUrl, 'Abrir ticket no painel') : ''}
    `,
  });
  const text = [
    `Nova mensagem no ticket #${opts.ticketId}.`,
    `Assunto: ${opts.subject}`,
    `Cliente: ${name}`,
    '',
    'Prévia:',
    previewClipped,
    ...(opts.adminUrl ? ['', opts.adminUrl] : []),
  ].join('\n');
  return { subject, html, text };
}

export function ticketAdminCreatedNotify(opts: {
  ticketId: number;
  subject: string;
  customerName?: string | null;
  customerEmail: string;
  priority: string;
  description: string;
  adminUrl?: string;
}): TemplatePayload {
  const name = opts.customerName ?? 'Cliente';
  const subject = `Novo ticket #${opts.ticketId} (${opts.priority})`;
  const descClipped =
    opts.description.length > 400
      ? `${opts.description.slice(0, 400)}…`
      : opts.description;
  const html = layout({
    preheader: `Novo ticket de suporte de ${name}.`,
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px;"><strong>Novo ticket no suporte.</strong></p>
      <p style="margin:0 0 6px;font-size:14px;"><strong>#${opts.ticketId}:</strong> ${escapeHtml(opts.subject)}</p>
      <p style="margin:0 0 6px;font-size:13px;color:${MUTED};">Prioridade: ${escapeHtml(opts.priority)}</p>
      <p style="margin:0 0 6px;font-size:13px;color:${MUTED};">Cliente: ${escapeHtml(name)} &lt;${escapeHtml(opts.customerEmail)}&gt;</p>
      <p style="margin:12px 0 8px;font-size:13px;color:${MUTED};">Descrição:</p>
      <p style="margin:0 0 16px;padding:12px 14px;background:#f7f7f8;border-left:3px solid ${BRAND};font-size:14px;color:#1a1a1a;white-space:pre-wrap;">${escapeHtml(descClipped)}</p>
      ${opts.adminUrl ? button(opts.adminUrl, 'Abrir no painel') : ''}
    `,
  });
  const text = [
    `Novo ticket #${opts.ticketId} — ${opts.subject}`,
    `Prioridade: ${opts.priority}`,
    `Cliente: ${name} <${opts.customerEmail}>`,
    '',
    'Descrição:',
    descClipped,
    ...(opts.adminUrl ? ['', opts.adminUrl] : []),
  ].join('\n');
  return { subject, html, text };
}

export function passwordResetEmail(opts: {
  name?: string | null;
  resetUrl: string;
}): TemplatePayload {
  const greet = opts.name ? `Olá, ${opts.name}` : 'Olá';
  const subject = 'IWO Watch — redefinição de senha';
  const html = layout({
    preheader: 'Link para redefinir a senha da sua conta IWO Watch.',
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px;"><strong>${escapeHtml(greet)}.</strong></p>
      <p style="margin:0 0 12px;">Você solicitou redefinir sua senha. Clique abaixo para escolher uma nova:</p>
      ${button(opts.resetUrl, 'Redefinir minha senha')}
      <p style="margin:0 0 8px;font-size:13px;color:${MUTED};">Ou copie e cole este link no navegador:</p>
      <p style="margin:0 0 16px;word-break:break-all;font-size:13px;"><a href="${opts.resetUrl}" style="color:${BRAND};">${escapeHtml(opts.resetUrl)}</a></p>
      <p style="margin:0;font-size:13px;color:${MUTED};">Este link é válido por <strong>1 hora</strong>. Se não foi você quem solicitou, ignore este email — sua senha atual continua válida.</p>
    `,
  });
  const text = [
    `${greet}.`,
    '',
    'Você solicitou redefinir sua senha. Acesse o link abaixo para escolher uma nova:',
    opts.resetUrl,
    '',
    'Este link é válido por 1 hora. Se não foi você, ignore este email.',
  ].join('\n');
  return { subject, html, text };
}

export function newsletterWelcomeEmail(opts: {
  name?: string | null;
}): TemplatePayload {
  const greet = opts.name ? `Olá, ${opts.name}` : 'Olá';
  const subject = 'IWO Watch — inscrição confirmada';
  const html = layout({
    preheader: 'Você agora recebe novidades, lançamentos e ofertas do IWO Watch.',
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 12px;"><strong>${escapeHtml(greet)}!</strong></p>
      <p style="margin:0 0 12px;">Sua inscrição foi confirmada. Você vai receber por aqui:</p>
      <ul style="margin:0 0 16px;padding-left:18px;color:#111;">
        <li style="margin:0 0 6px;">Lançamentos de novos modelos</li>
        <li style="margin:0 0 6px;">Ofertas e cupons exclusivos</li>
        <li style="margin:0 0 6px;">Dicas de uso e tutoriais</li>
      </ul>
      <p style="margin:0;font-size:13px;color:${MUTED};">Você pode se descadastrar a qualquer momento pelo link no rodapé dos emails.</p>
    `,
  });
  const text = [
    `${greet}!`,
    '',
    'Sua inscrição no IWO Watch foi confirmada. Obrigado!',
    'Você vai receber lançamentos, ofertas e dicas por aqui.',
    '',
    'Descadastre-se a qualquer momento pelo link no rodapé dos emails.',
  ].join('\n');
  return { subject, html, text };
}
