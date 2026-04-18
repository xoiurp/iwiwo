'use client';

import { useRouter } from 'next/navigation';
import { adminFetch } from '../../lib/auth';
import ProductForm, { type ProductData } from '../../components/ProductForm';

const styles = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: '24px',
  } as React.CSSProperties,
};

export default function NovoProdutoPage() {
  const router = useRouter();

  async function handleSubmit(data: ProductData) {
    const res = await adminFetch('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || 'Erro ao criar produto');
    }

    router.push('/admin/produtos');
  }

  return (
    <div>
      <h1 style={styles.title}>Novo Produto</h1>
      <ProductForm onSubmit={handleSubmit} />
    </div>
  );
}
