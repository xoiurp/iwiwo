// app/conta/(auth)/verificar-email/page.tsx
// Landing pós-registro + destino de fallback pra /api/auth/verify-email falho.
// Três estados via `error` query param:
//   (nenhum)   → mensagem neutra "confira sua caixa de entrada"
//   "missing"  → link de verificação sem token
//   "invalid"  → token expirado ou já usado
//
// Em qualquer estado, exibe um formulário de REENVIO que POSTa em
// /api/auth/resend-verification. Sempre responde de forma genérica
// (sem enumeração de emails).

import Link from "next/link";
import { ResendVerificationForm } from "./ResendVerificationForm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string | string[]; email?: string | string[] }>;

function pickValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function VerificarEmailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const error = pickValue(params.error);
  const initialEmail = pickValue(params.email) ?? "";

  let heading = "Confira seu email";
  let message =
    "Verifique sua caixa de entrada. Clique no link que enviamos pra confirmar seu email.";
  let isError = false;

  if (error === "missing") {
    heading = "Link incompleto";
    message = "Link de verificação incompleto. Reenvie pra continuar.";
    isError = true;
  } else if (error === "invalid") {
    heading = "Link inválido";
    message = "Link expirado ou já usado. Reenvie pra continuar.";
    isError = true;
  }

  return (
    <>
      <h1 className="auth-title">{heading}</h1>

      {isError ? (
        <p className="auth-error">{message}</p>
      ) : (
        <div className="auth-success-screen">
          <div className="auth-success-icon" aria-hidden="true">
            ✉
          </div>
          <p className="auth-subtitle">{message}</p>
        </div>
      )}

      <ResendVerificationForm initialEmail={initialEmail} />

      <div className="auth-footer">
        <span className="auth-footer-link">
          <Link href="/conta/login" className="is-link">
            Voltar ao login
          </Link>
        </span>
        {isError ? (
          <span className="auth-footer-link">
            <Link href="/conta/registro" className="is-link">
              Criar nova conta
            </Link>
          </span>
        ) : null}
      </div>
    </>
  );
}
