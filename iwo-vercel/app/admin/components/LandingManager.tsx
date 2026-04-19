'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetch } from '../lib/auth';
import { formatRelativeTimeBR } from '@/app/lib/format';

// ── Types ───────────────────────────────────────────────────────────────────

interface LandingManagerProps {
  productId: number;
  productSlug: string;
}

interface LandingStatus {
  figmaUrl: string | null;
  importedAt: string | null;
  hasHtml: boolean;
  hasCss: boolean;
  assetCount: number;
}

type UiState = 'loading' | 'empty' | 'imported' | 'error';

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  wrap: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '24px',
    backgroundColor: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  } as React.CSSProperties,
  heading: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#000',
    margin: '0 0 8px 0',
  } as React.CSSProperties,
  sub: {
    fontSize: '13px',
    color: '#666',
    lineHeight: 1.5,
    margin: '0 0 16px 0',
  } as React.CSSProperties,
  promptBox: {
    position: 'relative' as const,
    backgroundColor: '#f7f7f8',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '16px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '12px',
    color: '#1a1a1a',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    lineHeight: 1.5,
  } as React.CSSProperties,
  copyBtn: {
    padding: '8px 14px',
    backgroundColor: '#000',
    color: '#fff',
    border: '1px solid #000',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: '12px',
  } as React.CSSProperties,
  copyOk: {
    marginLeft: '8px',
    fontSize: '12px',
    color: '#16a34a',
  } as React.CSSProperties,
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
    marginBottom: '16px',
  } as React.CSSProperties,
  card: {
    backgroundColor: '#f7f7f8',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '16px',
  } as React.CSSProperties,
  cardLabel: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: '#666',
    marginBottom: '8px',
  } as React.CSSProperties,
  cardValue: {
    fontSize: '13px',
    color: '#1a1a1a',
    lineHeight: 1.5,
    wordBreak: 'break-all' as const,
  } as React.CSSProperties,
  link: {
    color: '#000',
    textDecoration: 'underline',
  } as React.CSSProperties,
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 500,
    backgroundColor: '#000',
    color: '#fff',
    marginLeft: '8px',
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    marginTop: '8px',
  } as React.CSSProperties,
  btn: {
    padding: '8px 14px',
    backgroundColor: '#fff',
    color: '#000',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
  } as React.CSSProperties,
  btnPrimary: {
    padding: '8px 14px',
    backgroundColor: '#000',
    color: '#fff',
    border: '1px solid #000',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
  } as React.CSSProperties,
  btnDanger: {
    padding: '8px 14px',
    backgroundColor: '#fff',
    color: '#dc2626',
    border: '1px solid #dc2626',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,
  err: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    border: '1px solid #fecaca',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,
  errBtn: {
    padding: '6px 12px',
    backgroundColor: '#fff',
    color: '#dc2626',
    border: '1px solid #dc2626',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,
  loadingText: {
    fontSize: '13px',
    color: '#666',
  } as React.CSSProperties,
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    margin: '16px 0',
    border: 'none',
  } as React.CSSProperties,
  expandDetails: {
    marginTop: '8px',
  } as React.CSSProperties,
  expandSummary: {
    fontSize: '13px',
    color: '#666',
    cursor: 'pointer',
    padding: '4px 0',
    userSelect: 'none' as const,
  } as React.CSSProperties,
};

// ── Prompt template ─────────────────────────────────────────────────────────

function buildPrompt(productId: number, productSlug: string, figmaUrl: string): string {
  return `Importe o Figma ${figmaUrl} para a landing do produto ${productSlug} (id: ${productId}).
Use o MCP plugin:figma:figma.
Faça mirror dos assets pro R2 (prefix landing/${productId}/), converta JSX→HTML com AST walker,
compile Tailwind JIT, escope CSS com .iwo-landing-${productId}, sanitize com DOMPurify,
substitua placeholders {Nome do Produto}→{{name}}, {Subtítulo do produto}→{{subtitle}},
{Descrição curta do produto}→{{description}}, e faça PATCH /api/admin/products/${productId}/landing
com { figmaUrl, html, css, assetManifest }.`;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function LandingManager({ productId, productSlug }: LandingManagerProps) {
  const [uiState, setUiState] = useState<UiState>('loading');
  const [status, setStatus] = useState<LandingStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setUiState('loading');
    try {
      const res = await adminFetch(`/api/admin/products/${productId}/landing`);
      if (res.status === 404) {
        setStatus(null);
        setUiState('empty');
        return;
      }
      if (!res.ok) {
        setUiState('error');
        return;
      }
      const body = await res.json();
      const html: string | null = body?.html ?? null;
      const css: string | null = body?.css ?? null;
      const manifest = body?.assetManifest;
      const assetCount =
        Array.isArray(manifest)
          ? manifest.length
          : manifest && typeof manifest === 'object'
            ? Object.keys(manifest).length
            : 0;
      const next: LandingStatus = {
        figmaUrl: body?.figmaUrl ?? null,
        importedAt: body?.importedAt ?? null,
        hasHtml: Boolean(html && html.length > 0),
        hasCss: Boolean(css && css.length > 0),
        assetCount,
      };
      setStatus(next);
      // Treat as "imported" only when we actually have HTML payload.
      setUiState(next.hasHtml || next.figmaUrl ? 'imported' : 'empty');
    } catch {
      setUiState('error');
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const emptyPrompt = useMemo(
    () => buildPrompt(productId, productSlug, '<URL_AQUI>'),
    [productId, productSlug]
  );

  const reimportPrompt = useMemo(
    () => buildPrompt(productId, productSlug, status?.figmaUrl || '<URL_AQUI>'),
    [productId, productSlug, status?.figmaUrl]
  );

  async function copyPrompt(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail in insecure contexts — no-op.
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      'Remover a landing do produto? A página voltará a exibir apenas o template padrão. Os assets no R2 permanecem (limpeza manual).'
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError('');
    try {
      const res = await adminFetch(`/api/admin/products/${productId}/landing`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body?.error || 'Erro ao remover a landing.');
        return;
      }
      setStatus(null);
      setUiState('empty');
    } catch {
      setDeleteError('Erro de conexão ao remover a landing.');
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (uiState === 'loading') {
    return (
      <div style={s.wrap}>
        <h3 style={s.heading}>Landing personalizada</h3>
        <div style={s.loadingText}>Carregando status da landing...</div>
      </div>
    );
  }

  if (uiState === 'error') {
    return (
      <div style={s.wrap}>
        <h3 style={s.heading}>Landing personalizada</h3>
        <div style={s.err}>
          <span>Não foi possível carregar o status da landing.</span>
          <button type="button" onClick={load} style={s.errBtn}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (uiState === 'empty') {
    return (
      <div style={s.wrap}>
        <h3 style={s.heading}>Landing personalizada</h3>
        <p style={s.sub}>
          Esta área mostra uma página desenhada no Figma abaixo da página do produto.
          Para importar, rode Claude Code com MCP do Figma autenticado e diga:
        </p>
        <div style={s.promptBox}>{emptyPrompt}</div>
        <div style={s.actions}>
          <button
            type="button"
            style={s.copyBtn}
            onClick={() => copyPrompt(emptyPrompt)}
          >
            Copiar prompt
          </button>
          {copied && <span style={s.copyOk}>Copiado!</span>}
        </div>
      </div>
    );
  }

  // imported
  const importedAtRel = status?.importedAt ? formatRelativeTimeBR(status.importedAt) : '';

  return (
    <div style={s.wrap}>
      <h3 style={s.heading}>
        Landing personalizada
        <span style={s.badge}>ativa</span>
      </h3>

      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.cardLabel}>Figma source</div>
          <div style={s.cardValue}>
            {status?.figmaUrl ? (
              <>
                <a
                  href={status.figmaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.link}
                >
                  Abrir no Figma
                </a>
                <div style={{ color: '#666', marginTop: 6, fontSize: 12 }}>
                  Última importação: {importedAtRel || '—'}
                </div>
              </>
            ) : (
              <span style={{ color: '#666' }}>—</span>
            )}
          </div>
        </div>

        <div style={s.card}>
          <div style={s.cardLabel}>Conteúdo</div>
          <div style={s.cardValue}>
            <div>{status?.hasHtml ? 'HTML presente' : '—'}</div>
            <div>{status?.hasCss ? 'CSS presente' : '—'}</div>
            <div>{status?.assetCount ?? 0} asset(s) no R2</div>
          </div>
        </div>
      </div>

      <div style={s.actions}>
        <a
          href={`/p/${productSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={s.btnPrimary}
        >
          Ver preview
        </a>
        <button
          type="button"
          style={s.btn}
          title="Reimporte via Claude Code copiando o prompt abaixo"
          onClick={() => copyPrompt(reimportPrompt)}
        >
          Reimportar
        </button>
        {copied && <span style={s.copyOk}>Copiado!</span>}
        <button
          type="button"
          style={{ ...s.btnDanger, opacity: deleting ? 0.7 : 1 }}
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Removendo...' : 'Remover landing'}
        </button>
      </div>

      {deleteError && (
        <div style={{ ...s.err, marginTop: 12 }}>
          <span>{deleteError}</span>
        </div>
      )}

      <details style={s.expandDetails}>
        <summary style={s.expandSummary}>Ver prompt de reimportação</summary>
        <hr style={s.divider} />
        <div style={s.promptBox}>{reimportPrompt}</div>
        <div style={s.actions}>
          <button
            type="button"
            style={s.copyBtn}
            onClick={() => copyPrompt(reimportPrompt)}
          >
            Copiar prompt
          </button>
          {copied && <span style={s.copyOk}>Copiado!</span>}
        </div>
      </details>
    </div>
  );
}
