"use client";

// app/conta/(auth)/registro/page.tsx
// Customer self-registration. POSTs to /api/auth/register which creates the
// user + customer in a transaction and sends a verification email. On 200 we
// swap to a "check your inbox" success screen rather than redirect, since the
// user can't log in until they click the email link anyway.

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type RegisterError =
  | { kind: "generic"; message: string }
  | { kind: "email_exists" };

function formatCpf(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 3));
  if (digits.length > 3) parts[parts.length - 1] += "." + digits.slice(3, 6);
  if (digits.length > 6) {
    const tail = digits.slice(6, 9);
    parts[parts.length - 1] += "." + tail;
  }
  if (digits.length > 9) {
    const tail = digits.slice(9, 11);
    parts[parts.length - 1] += "-" + tail;
  }
  return parts.join("");
}

export default function RegistroPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<RegisterError | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onCpfChange(e: ChangeEvent<HTMLInputElement>) {
    setCpf(formatCpf(e.target.value));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError({ kind: "generic", message: "As senhas não coincidem." });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            name,
            cpf: cpf.trim() ? cpf.trim() : undefined,
            phone: phone.trim() ? phone.trim() : undefined,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };

        if (res.ok) {
          setSubmittedEmail(email);
          return;
        }

        if (res.status === 409 || data.error === "EMAIL_EXISTS") {
          setError({ kind: "email_exists" });
          return;
        }

        setError({
          kind: "generic",
          message:
            data.message || "Não foi possível concluir o cadastro. Tente novamente.",
        });
      } catch {
        setError({
          kind: "generic",
          message: "Não foi possível concluir o cadastro. Verifique sua conexão.",
        });
      }
    });
  }

  if (submittedEmail) {
    return (
      <>
        <h1 className="auth-title">Confira seu email</h1>
        <div className="auth-success-screen">
          <div className="auth-success-icon" aria-hidden="true">
            ✓
          </div>
          <p className="auth-subtitle">
            Enviamos um email de confirmação pra <strong>{submittedEmail}</strong>.
            Clique no link pra ativar sua conta.
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
      <h1 className="auth-title">Criar conta</h1>

      {error?.kind === "email_exists" ? (
        <p className="auth-error">
          Este email já está cadastrado.{" "}
          <Link href="/conta/login">Entrar</Link>
        </p>
      ) : null}
      {error?.kind === "generic" ? (
        <p className="auth-error">{error.message}</p>
      ) : null}

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-name">
            Nome
          </label>
          <input
            id="reg-name"
            className="auth-input"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-email">
            Email
          </label>
          <input
            id="reg-email"
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
          <label className="auth-label" htmlFor="reg-password">
            Senha
          </label>
          <input
            id="reg-password"
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
          <label className="auth-label" htmlFor="reg-password-confirm">
            Confirmar senha
          </label>
          <input
            id="reg-password-confirm"
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

        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-cpf">
            CPF <span className="auth-label-optional">(opcional)</span>
          </label>
          <input
            id="reg-cpf"
            className="auth-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={onCpfChange}
            disabled={pending}
            maxLength={14}
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-phone">
            Telefone <span className="auth-label-optional">(opcional)</span>
          </label>
          <input
            id="reg-phone"
            className="auth-input"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={pending}
          />
        </div>

        <button
          type="submit"
          className="auth-button-primary"
          disabled={pending}
        >
          {pending ? "Criando conta…" : "Criar conta"}
        </button>
      </form>

      <div className="auth-footer">
        <span className="auth-footer-link">
          Já tenho conta?{" "}
          <Link href="/conta/login" className="is-link">
            Entrar
          </Link>
        </span>
      </div>
    </>
  );
}
