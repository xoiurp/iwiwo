'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminFetch } from '../lib/auth';
import ImageUploader, { ImageItem } from './ImageUploader';

// ── Types ────────────────────────────────────────────────────────────────────

interface Variant {
  id?: number;
  product_id?: number;
  name: string;
  sku: string;
  price: string;
  compare_at_price: string;
  stock: string;
  color: string;
  size: string;
  images: ImageItem[];
  is_active: boolean;
  _isNew?: boolean;
  _expanded?: boolean;
}

interface VariantManagerProps {
  productId: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyVariant(): Variant {
  return {
    name: '',
    sku: '',
    price: '',
    compare_at_price: '',
    stock: '0',
    color: '',
    size: '',
    images: [],
    is_active: true,
    _isNew: true,
    _expanded: true,
  };
}

function parseVariant(v: Record<string, unknown>): Variant {
  return {
    id: v.id as number | undefined,
    product_id: v.product_id as number | undefined,
    name: (v.name as string) || '',
    sku: (v.sku as string) || '',
    price: v.price != null ? String(v.price) : '',
    compare_at_price: v.compare_at_price != null ? String(v.compare_at_price) : '',
    stock: v.stock != null ? String(v.stock) : '0',
    color: (v.color as string) || '',
    size: (v.size as string) || '',
    images: Array.isArray(v.images)
      ? (v.images as ImageItem[])
      : typeof v.images === 'string'
      ? JSON.parse((v.images as string) || '[]')
      : [],
    is_active: v.is_active === true || v.is_active === 'true',
    _isNew: false,
    _expanded: false,
  };
}

function isValidColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{3,6}$/.test(color);
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = {
  card: {
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '12px',
  } as React.CSSProperties,
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    userSelect: 'none' as const,
  } as React.CSSProperties,
  cardHeaderInfo: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  variantName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1a1a2e',
  } as React.CSSProperties,
  variantMeta: {
    fontSize: '13px',
    color: '#666',
  } as React.CSSProperties,
  badge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '20px',
  } as React.CSSProperties,
  activeBadge: {
    backgroundColor: '#dcfce7',
    color: '#16a34a',
  } as React.CSSProperties,
  inactiveBadge: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  } as React.CSSProperties,
  chevron: {
    fontSize: '12px',
    color: '#9ca3af',
    transition: 'transform 0.2s',
    flexShrink: 0,
  } as React.CSSProperties,
  formBody: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #f3f4f6',
  } as React.CSSProperties,
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  } as React.CSSProperties,
  grid3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '16px',
  } as React.CSSProperties,
  field: {
    marginBottom: '14px',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#555',
    marginBottom: '6px',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
    backgroundColor: '#fff',
  } as React.CSSProperties,
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#555',
    cursor: 'pointer',
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid #eee',
    backgroundColor: '#fafafa',
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '16px',
    paddingTop: '14px',
    borderTop: '1px solid #f3f4f6',
  } as React.CSSProperties,
  saveBtn: {
    padding: '9px 22px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
  deleteBtn: {
    padding: '9px 18px',
    backgroundColor: '#fff',
    color: '#dc2626',
    border: '1px solid #fca5a5',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,
  cancelBtn: {
    padding: '9px 18px',
    backgroundColor: '#fff',
    color: '#6b7280',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  } as React.CSSProperties,
  addBtn: {
    marginTop: '8px',
    padding: '10px 20px',
    backgroundColor: '#fff',
    color: '#2563eb',
    border: '1px dashed #93c5fd',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
    transition: 'background-color 0.15s',
  } as React.CSSProperties,
  errorMsg: {
    fontSize: '12px',
    color: '#dc2626',
    marginTop: '4px',
  } as React.CSSProperties,
  loadingMsg: {
    fontSize: '13px',
    color: '#9ca3af',
    padding: '12px 0',
  } as React.CSSProperties,
  colorSwatch: {
    display: 'inline-block',
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: '1px solid rgba(0,0,0,0.15)',
    flexShrink: 0,
    verticalAlign: 'middle',
  } as React.CSSProperties,
};

// ── VariantCard ──────────────────────────────────────────────────────────────

interface VariantCardProps {
  variant: Variant;
  productId: number;
  onChange: (v: Variant) => void;
  onSave: (v: Variant) => Promise<void>;
  onDelete: (v: Variant) => Promise<void>;
  onCancel: (v: Variant) => void;
}

function VariantCard({
  variant,
  productId,
  onChange,
  onSave,
  onDelete,
  onCancel,
}: VariantCardProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState('');

  function handleField(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    onChange({ ...variant, [name]: type === 'checkbox' ? checked : value });
  }

  async function handleSave() {
    if (!variant.name.trim()) {
      setSaveError('Nome e obrigatorio.');
      return;
    }
    setSaveError('');
    setSaving(true);
    try {
      await onSave(variant);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir variante "${variant.name}"?`)) return;
    setDeleting(true);
    try {
      await onDelete(variant);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao excluir.');
      setDeleting(false);
    }
  }

  const expanded = variant._expanded;
  const colorValid = isValidColor(variant.color);

  return (
    <div style={s.card}>
      {/* Header — click to expand/collapse */}
      <div
        style={s.cardHeader}
        onClick={() => onChange({ ...variant, _expanded: !expanded })}
      >
        <div style={s.cardHeaderInfo}>
          {/* Color swatch */}
          {variant.color && (
            <span
              style={{
                ...s.colorSwatch,
                backgroundColor: colorValid ? variant.color : 'transparent',
                border: colorValid
                  ? '1px solid rgba(0,0,0,0.15)'
                  : '1px solid #d1d5db',
              }}
              title={variant.color}
            />
          )}

          {/* Name */}
          <span style={s.variantName}>
            {variant.name || <span style={{ color: '#9ca3af' }}>Nova variante</span>}
          </span>

          {/* SKU */}
          {variant.sku && (
            <span style={s.variantMeta}>SKU: {variant.sku}</span>
          )}

          {/* Price */}
          {variant.price && (
            <span style={s.variantMeta}>
              R$ {parseFloat(variant.price).toFixed(2)}
            </span>
          )}

          {/* Stock */}
          {variant.stock !== '' && (
            <span style={s.variantMeta}>Estoque: {variant.stock}</span>
          )}

          {/* Active badge */}
          <span
            style={{
              ...s.badge,
              ...(variant.is_active ? s.activeBadge : s.inactiveBadge),
            }}
          >
            {variant.is_active ? 'Ativo' : 'Inativo'}
          </span>
        </div>

        {/* Chevron */}
        <span
          style={{
            ...s.chevron,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▼
        </span>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div style={s.formBody}>
          {/* Row 1: name + sku */}
          <div style={s.grid2}>
            <div style={s.field}>
              <label style={s.label}>Nome *</label>
              <input
                name="name"
                value={variant.name}
                onChange={handleField}
                style={s.input}
                placeholder="ex: Preto 42mm"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>SKU</label>
              <input
                name="sku"
                value={variant.sku}
                onChange={handleField}
                style={s.input}
                placeholder="ex: SKU-001"
              />
            </div>
          </div>

          {/* Row 2: price + compare_at_price + stock */}
          <div style={s.grid3}>
            <div style={s.field}>
              <label style={s.label}>Preco (R$)</label>
              <input
                name="price"
                value={variant.price}
                onChange={handleField}
                style={s.input}
                type="number"
                step="0.01"
                min="0"
                placeholder="299.90"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Preco comparativo (R$)</label>
              <input
                name="compare_at_price"
                value={variant.compare_at_price}
                onChange={handleField}
                style={s.input}
                type="number"
                step="0.01"
                min="0"
                placeholder="399.90"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Estoque</label>
              <input
                name="stock"
                value={variant.stock}
                onChange={handleField}
                style={s.input}
                type="number"
                min="0"
                step="1"
                placeholder="0"
              />
            </div>
          </div>

          {/* Row 3: color + size */}
          <div style={s.grid2}>
            <div style={s.field}>
              <label style={s.label}>Cor</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  name="color"
                  value={variant.color}
                  onChange={handleField}
                  style={{ ...s.input, flex: 1 }}
                  placeholder="ex: Preto ou #000000"
                />
                {colorValid && (
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '6px',
                      backgroundColor: variant.color,
                      border: '1px solid #ddd',
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                )}
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Tamanho</label>
              <input
                name="size"
                value={variant.size}
                onChange={handleField}
                style={s.input}
                placeholder="ex: 42mm, P, M, G"
              />
            </div>
          </div>

          {/* is_active */}
          <div style={{ ...s.field, marginBottom: '16px' }}>
            <label style={s.checkboxLabel}>
              <input
                type="checkbox"
                name="is_active"
                checked={variant.is_active}
                onChange={handleField}
              />
              Variante ativa
            </label>
          </div>

          {/* Images */}
          <div style={s.field}>
            <label style={s.label}>Imagens da Variante</label>
            <ImageUploader
              images={variant.images}
              onChange={(imgs) => onChange({ ...variant, images: imgs })}
              productId={productId}
              maxImages={5}
            />
          </div>

          {/* Error */}
          {saveError && <div style={s.errorMsg}>{saveError}</div>}

          {/* Action buttons */}
          <div style={s.actions}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || deleting}
              style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Salvando...' : variant._isNew ? 'Criar Variante' : 'Salvar'}
            </button>

            {!variant._isNew && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting}
                style={{ ...s.deleteBtn, opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            )}

            {variant._isNew && (
              <button
                type="button"
                onClick={() => onCancel(variant)}
                style={s.cancelBtn}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── VariantManager ───────────────────────────────────────────────────────────

export default function VariantManager({ productId }: VariantManagerProps) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const loadVariants = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await adminFetch(`/api/admin/products/${productId}/variants`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Erro ${res.status}`);
      }
      const data = await res.json();
      const list: Variant[] = Array.isArray(data)
        ? data.map(parseVariant)
        : Array.isArray(data.variants)
        ? data.variants.map(parseVariant)
        : [];
      setVariants(list);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Erro ao carregar variantes.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadVariants();
  }, [loadVariants]);

  function handleChange(index: number, updated: Variant) {
    setVariants((prev) => prev.map((v, i) => (i === index ? updated : v)));
  }

  async function handleSave(index: number, variant: Variant) {
    const payload = {
      name: variant.name.trim(),
      sku: variant.sku.trim() || null,
      price: variant.price !== '' ? parseFloat(variant.price) : null,
      compare_at_price:
        variant.compare_at_price !== '' ? parseFloat(variant.compare_at_price) : null,
      stock: parseInt(variant.stock, 10) || 0,
      color: variant.color.trim() || null,
      size: variant.size.trim() || null,
      images: variant.images,
      is_active: variant.is_active,
    };

    if (variant._isNew) {
      const res = await adminFetch(`/api/admin/products/${productId}/variants`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Erro ${res.status}`);
      }
      const created = await res.json();
      const savedVariant = parseVariant(
        (created.variant ?? created) as Record<string, unknown>
      );
      setVariants((prev) => prev.map((v, i) => (i === index ? savedVariant : v)));
    } else {
      const res = await adminFetch(
        `/api/admin/products/${productId}/variants/${variant.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Erro ${res.status}`);
      }
      const updated = await res.json();
      const savedVariant = parseVariant(
        (updated.variant ?? updated) as Record<string, unknown>
      );
      setVariants((prev) => prev.map((v, i) => (i === index ? savedVariant : v)));
    }
  }

  async function handleDelete(index: number, variant: Variant) {
    if (!variant.id) {
      setVariants((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    const res = await adminFetch(
      `/api/admin/products/${productId}/variants/${variant.id}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `Erro ${res.status}`);
    }
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCancel(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  function addVariant() {
    setVariants((prev) => [...prev, emptyVariant()]);
  }

  if (loading) {
    return <div style={s.loadingMsg}>Carregando variantes...</div>;
  }

  if (fetchError) {
    return (
      <div>
        <div style={{ ...s.errorMsg, marginBottom: '8px' }}>{fetchError}</div>
        <button type="button" onClick={loadVariants} style={s.cancelBtn}>
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div>
      {variants.length === 0 && (
        <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '12px' }}>
          Nenhuma variante cadastrada.
        </div>
      )}

      {variants.map((variant, index) => (
        <VariantCard
          key={variant.id ?? `new-${index}`}
          variant={variant}
          productId={productId}
          onChange={(updated) => handleChange(index, updated)}
          onSave={(v) => handleSave(index, v)}
          onDelete={(v) => handleDelete(index, v)}
          onCancel={() => handleCancel(index)}
        />
      ))}

      <button type="button" onClick={addVariant} style={s.addBtn}>
        + Adicionar Variante
      </button>
    </div>
  );
}
