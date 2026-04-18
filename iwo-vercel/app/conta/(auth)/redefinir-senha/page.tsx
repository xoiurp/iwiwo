"use client";

// app/conta/(auth)/redefinir-senha/page.tsx
// Consumes a single-use reset token from the email link and sets a new
// password. The token is required in the URL (`?token=...`); without it we
// bail out early and point users back to the request flow.

import { Suspense, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

type ResetError =
  | { kind: "invalid_token" }
  | { kind: "invalid_password"; message: string }
  | { kind: "generic"; message: string };

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={<p className="auth-subtitle">Carregando…</p>}>
      <RedefinirSenhaForm />
    </Suspense>
  );
}

function RedefinirSenhaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<ResetError | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!token) return;

    if (password !== passwordConfirm) {
      setError({ kind: "generic", message: "As senhas não coincidem." });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };

        if (res.ok) {
          setSuccess(true);
          return;
        }

        if (data.error === "INVALID_TOKEN") {
          setError({ kind: "invalid_token" });
          return;
        }
        if (data.error === "INVALID_PASSWORD") {
          setError({
            kind: "invalid_password",
            message:
              data.message ||
              "A senha precisa ter ao menos 8 caracteres, com letras e números.",
          });
          return;
        }

        setError({
          kind: "generic",
          message:
            data.message || "Não foi possível redefinir a senha. Tente novamente.",
        });
      } catch {
        setError({
          kind: "generic",
          message: "Não foi possível redefinir a senha. Verifique sua conexão.",
        });
      }
    });
  }

  if (!token) {
    return (
      <>
        <h1 className="auth-title">Link inválido</h1>
        <p className="auth-error">
          Link inválido.{" "}
          <Link href="/conta/esqueci-senha">Solicitar novo link</Link>
        </p>
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

  if (success) {
    return (
      <>
        <h1 className="auth-title">Senha alterada</h1>
        <div className="auth-success-screen">
          <div className="auth-success-icon" aria-hidden="true">
            ✓
          </div>
          <p className="auth-subtitle">
            Sua senha foi atualizada. Faça login com a nova senha.
          </p>
          <button
            type="button"
            className="auth-button-primary"
            onClick={() => router.push("/conta/login")}
          >
            Fazer login
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="auth-title">Nova senha</h1>

      {error?.kind === "invalid_token" ? (
        <p className="auth-error">
          Link expirado ou inválido.{" "}
          <Link href="/conta/esqueci-senha">Solicitar novo link</Link>
        </p>
      ) : null}
      {error?.kind === "invalid_password" ? (
        <p className="auth-error">{error.message}</p>
      ) : null}
      {error?.kind === "generic" ? (
        <p className="auth-error">{error.message}</p>
      ) : null}

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="auth-field">
          <label className="auth-label" htmlFor="reset-password">
            Nova senha
          </label>
          <input
            id="reset-password"
            className="auth-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
          <p className="auth-hint">Mínimo 8 caracteres com letras e números.</p>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="reset-password-confirm">
            Confirmar nova senha
          </label>
          <input
            id="reset-password-confirm"
            className="auth-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            disabled={pending}
          />
        </div>

        <button
          type="submit"
          className="auth-button-primary"
          disabled={pending}
        >
          {pending ? "Salvando…" : "Salvar nova senha"}
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
