'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getToken, setToken, removeToken } from './lib/auth';

const SIDEBAR_WIDTH = 240;

const styles = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties,
  sidebar: {
    width: SIDEBAR_WIDTH,
    minWidth: SIDEBAR_WIDTH,
    backgroundColor: '#1a1a2e',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '0',
    position: 'fixed' as const,
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 100,
  } as React.CSSProperties,
  logo: {
    padding: '24px 20px',
    fontSize: '20px',
    fontWeight: 700,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    letterSpacing: '-0.5px',
  } as React.CSSProperties,
  nav: {
    flex: 1,
    padding: '16px 0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  } as React.CSSProperties,
  navLink: {
    display: 'block',
    padding: '10px 20px',
    color: 'rgba(255,255,255,0.7)',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'all 0.15s',
    borderLeft: '3px solid transparent',
  } as React.CSSProperties,
  navLinkActive: {
    display: 'block',
    padding: '10px 20px',
    color: '#fff',
    textDecoration: 'none',
    fontSize: '14px',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderLeft: '3px solid #2563eb',
    fontWeight: 500,
  } as React.CSSProperties,
  logoutBtn: {
    margin: '16px 20px',
    padding: '10px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.15s',
  } as React.CSSProperties,
  main: {
    flex: 1,
    marginLeft: SIDEBAR_WIDTH,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  } as React.CSSProperties,
  content: {
    padding: '32px',
    maxWidth: 1200,
  } as React.CSSProperties,
  // Login styles
  loginWrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties,
  loginCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '40px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  } as React.CSSProperties,
  loginTitle: {
    fontSize: '24px',
    fontWeight: 700,
    marginBottom: '8px',
    color: '#1a1a2e',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  loginSubtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '24px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginBottom: '16px',
    transition: 'border-color 0.15s',
  } as React.CSSProperties,
  submitBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  } as React.CSSProperties,
  error: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    padding: '10px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '16px',
    border: '1px solid #fecaca',
  } as React.CSSProperties,
};

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/produtos', label: 'Produtos' },
  { href: '/admin/produtos/novo', label: 'Novo Produto' },
  { href: '/admin/pedidos', label: 'Pedidos' },
];

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao autenticar');
        return;
      }

      setToken(data.token);
      onLogin(data.token);
    } catch {
      setError('Erro de conexao. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.loginWrapper}>
      <div style={styles.loginCard}>
        <div style={styles.loginTitle}>IWO Admin</div>
        <div style={styles.loginSubtitle}>Digite a senha para acessar o painel</div>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>IWO Admin</div>
      <nav style={styles.nav}>
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              style={isActive ? styles.navLinkActive : styles.navLink}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={onLogout}
        style={styles.logoutBtn}
        onMouseOver={(e) => {
          (e.target as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.2)';
        }}
        onMouseOut={(e) => {
          (e.target as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.1)';
        }}
      >
        Sair
      </button>
    </aside>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getToken();
    if (token) {
      // Verify token is not expired
      try {
        const data = JSON.parse(atob(token));
        if (data.exp > Date.now()) {
          setIsAuthenticated(true);
        } else {
          removeToken();
          setIsAuthenticated(false);
        }
      } catch {
        removeToken();
        setIsAuthenticated(false);
      }
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  function handleLogin() {
    setIsAuthenticated(true);
  }

  function handleLogout() {
    removeToken();
    setIsAuthenticated(false);
  }

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div style={styles.loginWrapper}>
        <div style={{ color: '#666', fontSize: '14px' }}>Carregando...</div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  // Authenticated
  return (
    <div style={styles.wrapper}>
      <Sidebar onLogout={handleLogout} />
      <main style={styles.main}>
        <div style={styles.content}>{children}</div>
      </main>
    </div>
  );
}
