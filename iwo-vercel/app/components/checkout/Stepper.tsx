'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';

type Step = { id: 1 | 2 | 3; label: string; href: string };

const STEPS: Step[] = [
  { id: 1, label: 'Carrinho', href: '/checkout/carrinho' },
  { id: 2, label: 'Endereço', href: '/checkout/endereco' },
  { id: 3, label: 'Pagamento', href: '/checkout/pagamento' },
];

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    padding: '24px 20px',
    maxWidth: 640,
    margin: '0 auto',
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    flex: '0 0 auto',
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    border: '2px solid #d1d5db',
    background: '#fff',
    color: '#9ca3af',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  circleActive: {
    background: '#0a0a0f',
    color: '#fff',
    border: '2px solid #0a0a0f',
  },
  circleDone: {
    background: '#059669',
    color: '#fff',
    border: '2px solid #059669',
  },
  label: { fontSize: 13, fontWeight: 600, color: '#9ca3af' },
  labelActive: { color: '#0a0a0f' },
  labelDone: { color: '#059669' },
  line: {
    flex: 1,
    height: 2,
    background: '#e4e7ec',
    margin: '0 12px',
    marginBottom: 24,
  },
  lineDone: { background: '#059669' },
};

export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div style={styles.container} aria-label="Progresso do checkout">
      {STEPS.map((s, idx) => {
        const isDone = s.id < current;
        const isActive = s.id === current;
        const circleStyle: CSSProperties = {
          ...styles.circle,
          ...(isActive ? styles.circleActive : {}),
          ...(isDone ? styles.circleDone : {}),
        };
        const labelStyle: CSSProperties = {
          ...styles.label,
          ...(isActive ? styles.labelActive : {}),
          ...(isDone ? styles.labelDone : {}),
        };
        const circle = <div style={circleStyle}>{isDone ? '\u2713' : s.id}</div>;

        return (
          <div
            key={s.id}
            style={{ display: 'flex', alignItems: 'center', flex: idx === 0 ? '0 0 auto' : '1 1 auto' }}
          >
            {idx > 0 ? (
              <div style={{ ...styles.line, ...(isDone || isActive ? styles.lineDone : {}) }} />
            ) : null}
            <div style={styles.item}>
              {isDone ? (
                <Link href={s.href} style={{ textDecoration: 'none' }}>
                  {circle}
                </Link>
              ) : (
                circle
              )}
              <span style={labelStyle}>{s.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
