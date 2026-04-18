'use client';

import { useState, useEffect } from 'react';
import ImageUploader, { ImageItem } from './ImageUploader';
import VariantManager from './VariantManager';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ProductData {
  name: string;
  slug: string;
  description: string;
  descricao_longa: string;
  image: string;
  images: ImageItem[];
  product_type: string;
  collections: string;
  vendor: string;
  price: string;
  compare_at_price: string;
  seo_title: string;
  seo_description: string;
  // Specs
  tamanho_da_caixa: string;
  tipo_de_tela: string;
  tamanho_display: string;
  capacidade_da_bateria: string;
  duracao_da_bateria: string;
  bluetooth: string;
  com_gps: boolean;
  com_nfc: boolean;
  memoria_interna: string;
  aplicativo: string;
  // Resources (booleans)
  pedometro: boolean;
  monitoramento_de_sono: boolean;
  saude_feminina: boolean;
  ecg: boolean;
  pressao_arterial: boolean;
  frequencia_cardiaca: boolean;
  oxigenio_no_sangue: boolean;
  acompanha_carregador: boolean;
  com_wi_fi: boolean;
  rede_movel: boolean;
  musica_local: boolean;
  leitor_de_ebooks: boolean;
  gravador_de_voz: boolean;
  com_chat_gpt: boolean;
  assistente_de_voz: boolean;
  controle_de_musica: boolean;
  // Colors
  cor_1: string;
  cor_2: string;
  cor_3: string;
  // Status
  draft: boolean;
  archived: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Product = Record<string, any>;

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: ProductData) => Promise<void>;
  isEdit?: boolean;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  form: {
    maxWidth: 800,
  } as React.CSSProperties,
  fieldset: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '24px',
    marginBottom: '24px',
    backgroundColor: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  } as React.CSSProperties,
  legend: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1a1a2e',
    padding: '0 8px',
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
    marginBottom: '16px',
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
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    minHeight: 100,
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    backgroundColor: '#fff',
  } as React.CSSProperties,
  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '10px',
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
    transition: 'all 0.15s',
  } as React.CSSProperties,
  colorInput: {
    width: 48,
    height: 36,
    padding: 2,
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
    backgroundColor: '#fff',
  } as React.CSSProperties,
  submitBtn: {
    padding: '12px 32px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    marginRight: '12px',
  } as React.CSSProperties,
  cancelBtn: {
    padding: '12px 32px',
    backgroundColor: '#fff',
    color: '#555',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
  } as React.CSSProperties,
  error: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '20px',
    border: '1px solid #fecaca',
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '8px',
  } as React.CSSProperties,
};

// ── Slug generation ─────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// ── Checkbox fields ─────────────────────────────────────────────────────────

const RECURSOS_FIELDS: { key: keyof ProductData; label: string }[] = [
  { key: 'pedometro', label: 'Pedometro' },
  { key: 'monitoramento_de_sono', label: 'Monitoramento de Sono' },
  { key: 'saude_feminina', label: 'Saude Feminina' },
  { key: 'ecg', label: 'ECG' },
  { key: 'pressao_arterial', label: 'Pressao Arterial' },
  { key: 'frequencia_cardiaca', label: 'Frequencia Cardiaca' },
  { key: 'oxigenio_no_sangue', label: 'Oxigenio no Sangue' },
  { key: 'acompanha_carregador', label: 'Acompanha Carregador' },
  { key: 'com_wi_fi', label: 'Wi-Fi' },
  { key: 'rede_movel', label: 'Rede Movel' },
  { key: 'musica_local', label: 'Musica Local' },
  { key: 'leitor_de_ebooks', label: 'Leitor de E-books' },
  { key: 'gravador_de_voz', label: 'Gravador de Voz' },
  { key: 'com_chat_gpt', label: 'ChatGPT' },
  { key: 'assistente_de_voz', label: 'Assistente de Voz' },
  { key: 'controle_de_musica', label: 'Controle de Musica' },
];

// ── Default form data ───────────────────────────────────────────────────────

function getDefaultData(): ProductData {
  return {
    name: '',
    slug: '',
    description: '',
    descricao_longa: '',
    image: '',
    images: [],
    product_type: 'Smartwatch',
    collections: 'smartwatch',
    vendor: '',
    price: '',
    compare_at_price: '',
    seo_title: '',
    seo_description: '',
    tamanho_da_caixa: '',
    tipo_de_tela: '',
    tamanho_display: '',
    capacidade_da_bateria: '',
    duracao_da_bateria: '',
    bluetooth: '',
    com_gps: false,
    com_nfc: false,
    memoria_interna: '',
    aplicativo: '',
    pedometro: false,
    monitoramento_de_sono: false,
    saude_feminina: false,
    ecg: false,
    pressao_arterial: false,
    frequencia_cardiaca: false,
    oxigenio_no_sangue: false,
    acompanha_carregador: false,
    com_wi_fi: false,
    rede_movel: false,
    musica_local: false,
    leitor_de_ebooks: false,
    gravador_de_voz: false,
    com_chat_gpt: false,
    assistente_de_voz: false,
    controle_de_musica: false,
    cor_1: '#000000',
    cor_2: '#000000',
    cor_3: '#000000',
    draft: false,
    archived: false,
  };
}

function productToFormData(product: Product): ProductData {
  const defaults = getDefaultData();
  const data = { ...defaults } as Record<string, unknown>;

  // Parse images from JSON if needed
  if (product.images) {
    if (typeof product.images === 'string') {
      try { data.images = JSON.parse(product.images); } catch { data.images = []; }
    } else if (Array.isArray(product.images)) {
      data.images = product.images;
    }
  }

  for (const key of Object.keys(defaults) as (keyof ProductData)[]) {
    if (key === 'images') continue; // handled above
    const val = product[key];
    if (val === null || val === undefined) continue;

    if (typeof defaults[key] === 'boolean') {
      data[key] = Boolean(val);
    } else if (key === 'price' || key === 'compare_at_price') {
      data[key] = String(val);
    } else {
      data[key] = String(val);
    }
  }

  return data as unknown as ProductData;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ProductForm({ product, onSubmit, isEdit }: ProductFormProps) {
  const [form, setForm] = useState<ProductData>(getDefaultData);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm(productToFormData(product));
    }
  }, [product]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setForm((prev) => {
      const next = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      };

      // Auto-generate slug from name (only if not editing or slug is auto-generated)
      if (name === 'name' && !isEdit) {
        next.slug = slugify(value);
      }

      // Auto-match collections to product_type
      if (name === 'product_type') {
        if (value === 'Smartwatch') next.collections = 'smartwatch';
        else if (value === 'Audio' || value === 'Áudio') next.collections = 'audio';
        else if (value === 'Pulseira') next.collections = 'pulseiras';
      }

      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('O nome do produto e obrigatorio.');
      return;
    }
    if (!form.price || isNaN(Number(form.price))) {
      setError('O preco e obrigatorio e deve ser numerico.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  }

  const isSmartwatch =
    form.product_type === 'Smartwatch' || form.product_type === 'smartwatch';

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      {error && <div style={s.error}>{error}</div>}

      {/* Informacoes Basicas */}
      <fieldset style={s.fieldset}>
        <legend style={s.legend}>Informacoes Basicas</legend>

        <div style={s.grid2}>
          <div style={s.field}>
            <label style={s.label}>Nome *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              style={s.input}
              placeholder="Nome do produto"
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Slug</label>
            <input
              name="slug"
              value={form.slug}
              onChange={handleChange}
              style={{ ...s.input, backgroundColor: '#f9fafb' }}
              placeholder="auto-gerado"
            />
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Descricao curta</label>
          <input
            name="description"
            value={form.description}
            onChange={handleChange}
            style={s.input}
            placeholder="Breve descricao"
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>Descricao longa</label>
          <textarea
            name="descricao_longa"
            value={form.descricao_longa}
            onChange={handleChange}
            style={s.textarea}
            placeholder="Descricao detalhada do produto"
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>Imagens do Produto</label>
          <ImageUploader
            images={form.images}
            onChange={(imgs) => setForm(prev => ({ ...prev, images: imgs }))}
            productId={product?.id}
            maxImages={5}
          />
          {!product?.id && (
            <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
              Salve o produto primeiro para habilitar o upload de imagens.
            </div>
          )}
        </div>

        <div style={s.grid3}>
          <div style={s.field}>
            <label style={s.label}>Tipo de Produto</label>
            <select
              name="product_type"
              value={form.product_type}
              onChange={handleChange}
              style={s.select}
            >
              <option value="Smartwatch">Smartwatch</option>
              <option value="Áudio">Audio</option>
              <option value="Pulseira">Pulseira</option>
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Colecao</label>
            <select
              name="collections"
              value={form.collections}
              onChange={handleChange}
              style={s.select}
            >
              <option value="smartwatch">Smartwatch</option>
              <option value="audio">Audio</option>
              <option value="pulseiras">Pulseiras</option>
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Vendor</label>
            <input
              name="vendor"
              value={form.vendor}
              onChange={handleChange}
              style={s.input}
              placeholder="Fabricante"
            />
          </div>
        </div>
      </fieldset>

      {/* Precos */}
      <fieldset style={s.fieldset}>
        <legend style={s.legend}>Precos</legend>
        <div style={s.grid2}>
          <div style={s.field}>
            <label style={s.label}>Preco (R$) *</label>
            <input
              name="price"
              value={form.price}
              onChange={handleChange}
              style={s.input}
              placeholder="299.90"
              type="number"
              step="0.01"
              min="0"
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Preco comparativo (R$)</label>
            <input
              name="compare_at_price"
              value={form.compare_at_price}
              onChange={handleChange}
              style={s.input}
              placeholder="399.90"
              type="number"
              step="0.01"
              min="0"
            />
          </div>
        </div>
      </fieldset>

      {/* SEO */}
      <fieldset style={s.fieldset}>
        <legend style={s.legend}>SEO</legend>
        <div style={s.field}>
          <label style={s.label}>Titulo SEO</label>
          <input
            name="seo_title"
            value={form.seo_title}
            onChange={handleChange}
            style={s.input}
            placeholder="Titulo para busca"
          />
        </div>
        <div style={s.field}>
          <label style={s.label}>Descricao SEO</label>
          <textarea
            name="seo_description"
            value={form.seo_description}
            onChange={handleChange}
            style={{ ...s.textarea, minHeight: 60 }}
            placeholder="Descricao para resultados de busca"
          />
        </div>
      </fieldset>

      {/* Especificacoes (Smartwatch only) */}
      {isSmartwatch && (
        <fieldset style={s.fieldset}>
          <legend style={s.legend}>Especificacoes</legend>
          <div style={s.grid2}>
            <div style={s.field}>
              <label style={s.label}>Tamanho da Caixa</label>
              <input
                name="tamanho_da_caixa"
                value={form.tamanho_da_caixa}
                onChange={handleChange}
                style={s.input}
                placeholder="ex: 45mm"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Tipo de Tela</label>
              <input
                name="tipo_de_tela"
                value={form.tipo_de_tela}
                onChange={handleChange}
                style={s.input}
                placeholder="ex: AMOLED"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Tamanho do Display</label>
              <input
                name="tamanho_display"
                value={form.tamanho_display}
                onChange={handleChange}
                style={s.input}
                placeholder="ex: 1.85 polegadas"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Capacidade da Bateria</label>
              <input
                name="capacidade_da_bateria"
                value={form.capacidade_da_bateria}
                onChange={handleChange}
                style={s.input}
                placeholder="ex: 380mAh"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Duracao da Bateria</label>
              <input
                name="duracao_da_bateria"
                value={form.duracao_da_bateria}
                onChange={handleChange}
                style={s.input}
                placeholder="ex: 5-7 dias"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Bluetooth</label>
              <input
                name="bluetooth"
                value={form.bluetooth}
                onChange={handleChange}
                style={s.input}
                placeholder="ex: 5.2"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Memoria Interna</label>
              <input
                name="memoria_interna"
                value={form.memoria_interna}
                onChange={handleChange}
                style={s.input}
                placeholder="ex: 4GB"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Aplicativo</label>
              <input
                name="aplicativo"
                value={form.aplicativo}
                onChange={handleChange}
                style={s.input}
                placeholder="ex: HryFit"
              />
            </div>
          </div>

          <div style={{ ...s.grid2, marginTop: 8 }}>
            <label style={s.checkboxLabel}>
              <input
                type="checkbox"
                name="com_gps"
                checked={form.com_gps}
                onChange={handleChange}
              />
              GPS
            </label>
            <label style={s.checkboxLabel}>
              <input
                type="checkbox"
                name="com_nfc"
                checked={form.com_nfc}
                onChange={handleChange}
              />
              NFC
            </label>
          </div>
        </fieldset>
      )}

      {/* Recursos (Smartwatch only) */}
      {isSmartwatch && (
        <fieldset style={s.fieldset}>
          <legend style={s.legend}>Recursos</legend>
          <div style={s.checkboxGrid}>
            {RECURSOS_FIELDS.map(({ key, label }) => (
              <label key={key} style={s.checkboxLabel}>
                <input
                  type="checkbox"
                  name={key}
                  checked={form[key] as boolean}
                  onChange={handleChange}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Cores */}
      <fieldset style={s.fieldset}>
        <legend style={s.legend}>Cores</legend>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <label style={s.label}>Cor 1</label>
            <input
              type="color"
              name="cor_1"
              value={form.cor_1}
              onChange={handleChange}
              style={s.colorInput}
            />
          </div>
          <div>
            <label style={s.label}>Cor 2</label>
            <input
              type="color"
              name="cor_2"
              value={form.cor_2}
              onChange={handleChange}
              style={s.colorInput}
            />
          </div>
          <div>
            <label style={s.label}>Cor 3</label>
            <input
              type="color"
              name="cor_3"
              value={form.cor_3}
              onChange={handleChange}
              style={s.colorInput}
            />
          </div>
        </div>
      </fieldset>

      {/* Variantes */}
      {product?.id && (
        <fieldset style={s.fieldset}>
          <legend style={s.legend}>Variantes</legend>
          <VariantManager productId={product.id} />
        </fieldset>
      )}

      {/* Status */}
      <fieldset style={s.fieldset}>
        <legend style={s.legend}>Status</legend>
        <div style={{ display: 'flex', gap: '24px' }}>
          <label style={s.checkboxLabel}>
            <input
              type="checkbox"
              name="draft"
              checked={form.draft}
              onChange={handleChange}
            />
            Rascunho (Draft)
          </label>
          <label style={s.checkboxLabel}>
            <input
              type="checkbox"
              name="archived"
              checked={form.archived}
              onChange={handleChange}
            />
            Arquivado
          </label>
        </div>
      </fieldset>

      {/* Actions */}
      <div style={s.actions}>
        <button
          type="submit"
          disabled={saving}
          style={{
            ...s.submitBtn,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Salvando...' : isEdit ? 'Atualizar Produto' : 'Criar Produto'}
        </button>
        <a href="/admin/produtos" style={s.cancelBtn}>
          Cancelar
        </a>
      </div>
    </form>
  );
}
