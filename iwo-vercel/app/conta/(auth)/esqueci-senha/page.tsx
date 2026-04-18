"use client";

// app/conta/(auth)/esqueci-senha/page.tsx
// Request a password reset link. The backend intentionally returns the same
// generic 200 whether or not the email exists (anti-enumeration), so the UI
// mirrors that: any successful request shows the same confirmation copy.

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        if (res.ok) {
          setSubmitted(true);
          return;
        }

        // The endpoint always responds 200 with a generic body, so this path
        // is only hit on network/server errors.
        setError("Não foi possível enviar o email. Tente novamente.");
      } catch {
        setError("Não foi possível enviar o email. Verifique sua conexão.");
      }
    });
  }

  if (submitted) {
    return (
      <>
        <h1 className="auth-title">Verifique seu email</h1>
        <div className="auth-success-screen">
          <div className="auth-success-icon" aria-hidden="true">
            ✉
          </div>
          <p className="auth-subtitle">
            Se existe uma conta com esse email, enviamos instruções pra
            redefinir a senha.
          </p>
        </div>
        <div className="auth-footer">
          <span className="auth-footer-link">
            <Link href="/conta/login" className="is-link">
              Voltar ao login
            </Link>
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="auth-title">Recuperar senha</h1>
      <p className="auth-subtitle">
        Informe seu email e enviaremos um link pra criar uma nova senha.
      </p>

      {error ? <p className="auth-error">{error}</p> : null}

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="auth-field">
          <label className="auth-label" htmlFor="forgot-email">
            Email
          </label>
          <input
            id="forgot-email"
            className="auth-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </div>

        <button
          type="submit"
          className="auth-button-primary"
          disabled={pending}
        >
          {pending ? "Enviando…" : "Enviar link"}
        </button>
      </form>

      <div className="auth-footer">
        <span className="auth-footer-link">
          <Link href="/conta/login" className="is-link">
            Voltar ao login
          </Link>
        </span>
      </div>
    </>
  );
}
