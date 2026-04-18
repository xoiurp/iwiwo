import type { ReactNode } from "react";
import Link from "next/link";
import "./auth.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Link href="/" className="auth-logo-link">
          <img
            src="/images/iwo_cinza_extended-1.webp"
            alt="IWO Watch"
            className="auth-logo"
          />
        </Link>
        <div className="auth-content">{children}</div>
      </div>
    </div>
  );
}
