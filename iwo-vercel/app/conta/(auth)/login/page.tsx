"use client";

// app/conta/(auth)/login/page.tsx
// Credentials sign-in form. Delegates to NextAuth client helper with
// redirect:false so we can surface specific error codes thrown by the
// Credentials provider (EMAIL_NOT_VERIFIED, INVALID_CREDENTIALS) instead of
// the default /conta/login?error=... loop.

import { Suspense, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export const dynamic = "force-dynamic";

function mapError(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === "EMAIL_NOT_VERIFIED") return "Confirme seu email antes de entrar.";
  if (code === "INVALID_CREDENTIALS") return "Email ou senha incorretos.";
  if (code === "CredentialsSignin") return "Email ou senha incorretos.";
  return "Não foi possível entrar. Tente novamente.";
}

function isNotVerifiedError(code: string | null | undefined): boolean {
  return code === "EMAIL_NOT_VERIFIED";
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="auth-subtitle">Carregando…</p>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "1";
  const from = searchParams.get("from") || "/conta";
  const initialError = mapError(searchParams.get("error"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [errorCode, setErrorCode] = useState<string | null>(
    searchParams.get("error"),
  );
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setErrorCode(null);

    startTransition(async () => {
      try {
        const res = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (!res) {
          setError("Não foi possível entrar. Tente novamente.");
          return;
        }

        if (res.error) {
          setError(mapError(res.error));
          setErrorCode(res.error);
          return;
        }

        // Success: let the server render the protected view.
        router.push(from);
        router.refresh();
      } catch {
        setError("Não foi possível entrar. Tente novamente.");
      }
    });
  }

  const resendHref = `/conta/verificar-email?email=${encodeURIComponent(email || "")}`;

  return (
    <>
      <h1 className="auth-title">Entrar</h1>

      {verified && !error ? (
        <p className="auth-success">Email confirmado! Faça login.</p>
      ) : null}

      {error ? (
        <p className="auth-error">
          {error}
          {isNotVerifiedError(errorCode) ? (
            <>
              {" "}
              <Link href={resendHref} className="is-link">
                Reenviar email de confirmação
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="auth-field">
          <label className="auth-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="auth-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="login-password">
            Senha
          </label>
          <input
            id="login-password"
            className="auth-input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
        </div>

        <button
          type="submit"
          className="auth-button-primary"
          disabled={pending}
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <div className="auth-footer">
        <span className="auth-footer-link">
          <Link href="/conta/esqueci-senha" className="is-link">
            Esqueci minha senha
          </Link>
        </span>
        <span className="auth-footer-link">
          Ainda não tem conta?{" "}
          <Link href="/conta/registro" className="is-link">
            Criar conta
          </Link>
        </span>
      </div>
    </>
  );
}
