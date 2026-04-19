import { SiteHeader } from '@/app/components/SiteHeader';
import { SiteFooter } from '@/app/components/SiteFooter';
import { CheckoutSummary } from '@/app/components/checkout/CheckoutSummary';
import { CheckoutHeader } from '@/app/components/checkout/CheckoutHeader';
import './checkout.css';

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="checkout-layout">
      <SiteHeader />
      <CheckoutHeader />
      <main className="checkout-grid">
        <div>{children}</div>
        <CheckoutSummary />
      </main>
      <SiteFooter />
    </div>
  );
}
