'use client';

/*
 * CheckoutHeader — envoltório do Stepper que infere qual step mostrar
 * a partir do pathname. Renderizado no layout (full-width, acima do
 * grid 2-col) para que os dois cards do grid fiquem alinhados no topo.
 */

import { usePathname } from 'next/navigation';
import { Stepper } from './Stepper';

function stepForPath(pathname: string | null): 1 | 2 | 3 {
  if (!pathname) return 1;
  if (pathname.startsWith('/checkout/pagamento')) return 3;
  if (pathname.startsWith('/checkout/endereco')) return 2;
  return 1;
}

export function CheckoutHeader() {
  const pathname = usePathname();
  // Tela de confirmação não mostra stepper — fluxo terminal.
  if (pathname && pathname.startsWith('/checkout/confirmacao')) {
    return null;
  }
  return <Stepper current={stepForPath(pathname)} />;
}
