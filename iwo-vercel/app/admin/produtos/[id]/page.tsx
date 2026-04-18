'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '../../lib/auth';
import ProductForm, { type Product, type ProductData } from '../../components/ProductForm';

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap' as const,
    gap: '12px',
  } as React.CSSProperties,
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
  } as React.CSSProperties,
  deleteBtn: {
    padding: '10px 20px',
    backgroundColor: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  } as React.CSSProperties,
  loading: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#888',
    fontSize: '14px',
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
};

export default function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await adminFetch(`/api/admin/products/${id}`);
        if (!res.ok) {
          const body = await res.json();
          setError(body.error || 'Erro ao carregar produto');
          return;
        }
        const data = await res.json();
        setProduct(data.product);
      } catch {
        setError('Erro de conexao');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSubmit(data: ProductData) {
    const res = await adminFetch(`/api/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || 'Erro ao atualizar produto');
    }

    router.push('/admin/produtos');
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      'Tem certeza que deseja excluir este produto? Esta acao nao pode ser desfeita.'
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await adminFetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || 'Erro ao excluir produto');
        return;
      }

      router.push('/admin/produtos');
    } catch {
      setError('Erro de conexao');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div style={styles.loading}>Carregando produto...</div>;
  }

  if (error && !product) {
    return <div style={styles.error}>{error}</div>;
  }

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>
          Editar: {product?.name || 'Produto'}
        </h1>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            ...styles.deleteBtn,
            opacity: deleting ? 0.7 : 1,
          }}
        >
          {deleting ? 'Excluindo...' : 'Excluir Produto'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <ProductForm
        product={product || undefined}
        onSubmit={handleSubmit}
        isEdit
      />
    </div>
  );
}
