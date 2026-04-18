'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminFetch } from '../lib/auth';
import type { Product } from '../components/ProductForm';

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
  newBtn: {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: '#2563eb',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
  } as React.CSSProperties,
  searchWrapper: {
    marginBottom: '20px',
  } as React.CSSProperties,
  searchInput: {
    width: '100%',
    maxWidth: 400,
    padding: '10px 14px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  tableWrapper: {
    backgroundColor: '#fff',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    border: '1px solid #eee',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '14px',
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '12px 16px',
    backgroundColor: '#fafafa',
    fontWeight: 600,
    color: '#555',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    borderBottom: '1px solid #eee',
  } as React.CSSProperties,
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid #f3f4f6',
    color: '#333',
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,
  row: {
    cursor: 'pointer',
    transition: 'background-color 0.1s',
  } as React.CSSProperties,
  thumb: {
    width: 40,
    height: 40,
    objectFit: 'cover' as const,
    borderRadius: '6px',
    backgroundColor: '#f3f4f6',
  } as React.CSSProperties,
  badge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
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
  empty: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#888',
  } as React.CSSProperties,
};

function getStatusBadge(product: Product) {
  if (product.archived) {
    return { ...styles.badge, backgroundColor: '#fee2e2', color: '#991b1b' };
  }
  if (product.draft) {
    return { ...styles.badge, backgroundColor: '#fef3c7', color: '#92400e' };
  }
  return { ...styles.badge, backgroundColor: '#dcfce7', color: '#166534' };
}

function getStatusLabel(product: Product) {
  if (product.archived) return 'Arquivado';
  if (product.draft) return 'Rascunho';
  return 'Ativo';
}

export default function ProdutosPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await adminFetch('/api/admin/products');
        if (!res.ok) {
          setError('Erro ao carregar produtos');
          return;
        }
        const data = await res.json();
        setProducts(data.products || []);
      } catch {
        setError('Erro de conexao');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = search
    ? products.filter((p) =>
        p.name?.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Produtos</h1>
        <Link href="/admin/produtos/novo" style={styles.newBtn}>
          + Novo Produto
        </Link>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.searchWrapper}>
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {loading ? (
        <div style={styles.loading}>Carregando produtos...</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          {search ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado.'}
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Imagem</th>
                <th style={styles.th}>Nome</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Colecao</th>
                <th style={styles.th}>Preco</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr
                  key={product.id}
                  style={styles.row}
                  onClick={() => router.push(`/admin/produtos/${product.id}`)}
                  onMouseOver={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#f9fafb';
                  }}
                  onMouseOut={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '';
                  }}
                >
                  <td style={styles.td}>
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        style={styles.thumb}
                      />
                    ) : (
                      <div
                        style={{
                          ...styles.thumb,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ccc',
                          fontSize: '11px',
                        }}
                      >
                        N/A
                      </div>
                    )}
                  </td>
                  <td style={{ ...styles.td, fontWeight: 500 }}>
                    {product.name}
                  </td>
                  <td style={styles.td}>{product.product_type || '-'}</td>
                  <td style={styles.td}>{product.collections || '-'}</td>
                  <td style={styles.td}>
                    {product.price_formatted || (product.price ? `R$ ${Number(product.price).toFixed(2)}` : '-')}
                  </td>
                  <td style={styles.td}>
                    <span style={getStatusBadge(product)}>
                      {getStatusLabel(product)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
