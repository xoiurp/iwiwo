'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from './lib/auth';

const styles = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: '24px',
  } as React.CSSProperties,
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
  } as React.CSSProperties,
  card: {
    backgroundColor: '#fff',
    borderRadius: '10px',
    padding: '24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    border: '1px solid #eee',
  } as React.CSSProperties,
  cardLabel: {
    fontSize: '13px',
    color: '#888',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontWeight: 500,
  } as React.CSSProperties,
  cardValue: {
    fontSize: '36px',
    fontWeight: 700,
    color: '#1a1a2e',
  } as React.CSSProperties,
  links: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  link: {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: '#2563eb',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'background-color 0.15s',
  } as React.CSSProperties,
  linkOutline: {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: '#fff',
    color: '#2563eb',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    border: '1px solid #2563eb',
    transition: 'all 0.15s',
  } as React.CSSProperties,
  loading: {
    color: '#888',
    fontSize: '14px',
  } as React.CSSProperties,
};

export default function AdminDashboard() {
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const res = await adminFetch('/api/admin/products');
        if (!res.ok) {
          setError('Erro ao carregar dados');
          return;
        }
        const data = await res.json();
        setTotal(data.products?.length ?? 0);
      } catch {
        setError('Erro de conexao');
      }
    }
    loadData();
  }, []);

  return (
    <div>
      <h1 style={styles.title}>Dashboard</h1>

      <div style={styles.cards}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Total de Produtos</div>
          <div style={styles.cardValue}>
            {error ? (
              <span style={{ fontSize: '14px', color: '#dc2626' }}>{error}</span>
            ) : total === null ? (
              <span style={styles.loading}>...</span>
            ) : (
              total
            )}
          </div>
        </div>
      </div>

      <div style={styles.links}>
        <Link href="/admin/produtos" style={styles.link}>
          Ver Produtos
        </Link>
        <Link href="/admin/produtos/novo" style={styles.linkOutline}>
          Novo Produto
        </Link>
      </div>
    </div>
  );
}
