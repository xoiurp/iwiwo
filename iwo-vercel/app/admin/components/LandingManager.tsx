'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '../lib/auth';
import { formatRelativeTimeBR } from '@/app/lib/format';

// ── Types ───────────────────────────────────────────────────────────────────

interface LandingManagerProps {
  productId: number;
  productSlug: string;
}

interface VariantStatus {
  figmaUrl: string | null;
  importedAt: string | null;
  hasHtml: boolean;
  hasCss: boolean;
  assetCount: number;
}

interface LandingStatus {
  desktop: VariantStatus;
  mobile: VariantStatus;
}

type UiState = 'loading' | 'ready' | 'error';
type Variant = 'desktop' | 'mobile';

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

function buildPrompt(
  productId: number,
  productSlug: string,
  figmaUrl: string,
  variant: Variant,
): string {
  const variantFlag = variant === 'mobile' ? ' --variant=mobile' : '';
  return `Importe o Figma ${figmaUrl} para a landing ${variant} do produto ${productSlug} (id: ${productId}).
Use o MCP plugin:figma:figma.
Rode: node scripts/figma-import-${productId}/import.mjs${variantFlag}`;
}

function emptyVariant(): VariantStatus {
  return { figmaUrl: null, importedAt: null, hasHtml: false, hasCss: false, assetCount: 0 };
}

function readVariant(raw: unknown): VariantStatus {
  if (!raw || typeof raw !== 'object') return emptyVariant();
  const v = raw as Record<string, unknown>;
  const manifest = v.assetManifest;
  const assetCount = Array.isArray(manifest)
    ? manifest.length
    : manifest && typeof manifest === 'object'
      ? Object.keys(manifest).length
      : 0;
  return {
    figmaUrl: (v.figmaUrl as string | null) ?? null,
    importedAt: (v.importedAt as string | null) ?? null,
    hasHtml: Boolean(typeof v.html === 'string' && v.html.length > 0),
    hasCss: Boolean(typeof v.css === 'string' && v.css.length > 0),
    assetCount,
  };
}

// ── Component ───────────────────────────────────────────────────────────────

export default function LandingManager({ productId, productSlug }: LandingManagerProps) {
  const [uiState, setUiState] = useState<UiState>('loading');
  const [status, setStatus] = useState<LandingStatus | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deletingVariant, setDeletingVariant] = useState<Variant | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setUiState('loading');
    try {
      const res = await adminFetch(`/api/admin/products/${productId}/landing`);
      if (!res.ok) {
        setUiState('error');
        return;
      }
      const body = await res.json();
      setStatus({
        desktop: readVariant(body?.desktop),
        mobile: readVariant(body?.mobile),
      });
      setUiState('ready');
    } catch {
      setUiState('error');
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  async function copyPrompt(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Clipboard API can fail in insecure contexts — no-op.
    }
  }

  async function handleDeleteVariant(variant: Variant) {
    const confirmed = window.confirm(
      `Remover a landing ${variant}? Os assets no R2 permanecem (limpeza manual).`,
    );
    if (!confirmed) return;

    setDeletingVariant(variant);
    setDeleteError('');
    try {
      const res = await adminFetch(
        `/api/admin/products/${productId}/landing?variant=${variant}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body?.error || `Erro ao remover landing ${variant}.`);
        return;
      }
      await load();
    } catch {
      setDeleteError('Erro de conexão ao remover.');
    } finally {
      setDeletingVariant(null);
    }
  }

  if (uiState === 'loading') {
    return (
      <div style={s.wrap}>
        <h3 style={s.heading}>Landing personalizada</h3>
        <div style={s.loadingText}>Carregando status da landing...</div>
      </div>
    );
  }

  if (uiState === 'error' || !status) {
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

  function renderCard(variant: Variant, v: VariantStatus) {
    const label = variant === 'desktop' ? '💻 Desktop' : '📱 Mobile';
    const hasContent = v.hasHtml || v.figmaUrl;
    const importedAtRel = v.importedAt ? formatRelativeTimeBR(v.importedAt) : '';
    const prompt = buildPrompt(
      productId,
      productSlug,
      v.figmaUrl || '<URL_AQUI>',
      variant,
    );
    const copyKey = `prompt:${variant}`;

    return (
      <div style={s.card} key={variant}>
        <div style={s.cardLabel}>{label}</div>
        {hasContent ? (
          <>
            <div style={s.cardValue}>
              {v.figmaUrl ? (
                <a
                  href={v.figmaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.link}
                >
                  Abrir no Figma
                </a>
              ) : (
                <span style={{ color: '#666' }}>—</span>
              )}
              <div style={{ color: '#666', marginTop: 6, fontSize: 12 }}>
                Última importação: {importedAtRel || '—'}
              </div>
              <div style={{ color: '#666', marginTop: 2, fontSize: 12 }}>
                {v.assetCount} asset(s) no R2 · HTML {v.hasHtml ? '✓' : '✗'} · CSS{' '}
                {v.hasCss ? '✓' : '✗'}
              </div>
            </div>
            <div style={s.actions}>
              <button
                type="button"
                style={s.btn}
                onClick={() => copyPrompt(copyKey, prompt)}
              >
                Reimportar (copiar prompt)
              </button>
              {copiedKey === copyKey && <span style={s.copyOk}>Copiado!</span>}
              <button
                type="button"
                style={{ ...s.btnDanger, opacity: deletingVariant === variant ? 0.7 : 1 }}
                onClick={() => handleDeleteVariant(variant)}
                disabled={deletingVariant !== null}
              >
                {deletingVariant === variant ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ ...s.cardValue, color: '#666', marginBottom: 8 }}>
              Ainda não importada.
            </div>
            <div style={s.promptBox}>{prompt}</div>
            <div style={s.actions}>
              <button
                type="button"
                style={s.copyBtn}
                onClick={() => copyPrompt(copyKey, prompt)}
              >
                Copiar prompt
              </button>
              {copiedKey === copyKey && <span style={s.copyOk}>Copiado!</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <h3 style={s.heading}>Landing personalizada</h3>
      <p style={s.sub}>
        Duas variantes independentes: desktop (≥ 769px) e mobile (≤ 768px). Cada uma é
        importada via Claude Code com o MCP do Figma autenticado.
      </p>
      <div style={s.grid2}>
        {renderCard('desktop', status.desktop)}
        {renderCard('mobile', status.mobile)}
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
      </div>
      {deleteError && (
        <div style={{ ...s.err, marginTop: 12 }}>
          <span>{deleteError}</span>
        </div>
      )}
    </div>
  );
}
