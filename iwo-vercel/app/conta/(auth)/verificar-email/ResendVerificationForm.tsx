"use client";

import { useState, useTransition, type FormEvent } from "react";

type Props = { initialEmail?: string };

export function ResendVerificationForm({ initialEmail = "" }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/resend-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        if (res.ok) {
          setSent(true);
          return;
        }
        setError(data.message ?? "Não foi possível reenviar agora.");
      } catch {
        setError("Erro de conexão. Tente novamente.");
      }
    });
  }

  if (sent) {
    return (
      <p className="auth-success" role="status">
        Se existe uma conta pendente com esse email, reenviamos o link. Pode
        levar alguns minutos pra chegar.
      </p>
    );
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <div className="auth-field">
        <label className="auth-label" htmlFor="resend-email">
          Reenviar email de confirmação
        </label>
        <input
          id="resend-email"
          className="auth-input"
          type="email"
          autoComplete="email"
          required
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
      </div>

      {error ? <p className="auth-error">{error}</p> : null}

      <button
        type="submit"
        className="auth-button-primary"
        disabled={pending || email.trim().length === 0}
      >
        {pending ? "Enviando…" : "Reenviar link"}
      </button>
    </form>
  );
}
