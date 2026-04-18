"use client";

import { useState, type FormEvent } from "react";

type FieldErrors = Partial<
  Record<"currentPassword" | "newPassword" | "confirm", string>
>;

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!currentPassword) e.currentPassword = "Informe sua senha atual.";
    if (!newPassword) e.newPassword = "Informe a nova senha.";
    else if (!PASSWORD_RE.test(newPassword)) {
      e.newPassword =
        "Mínimo de 8 caracteres, com letras e números.";
    }
    if (newPassword && confirm !== newPassword) {
      e.confirm = "As senhas não conferem.";
    }
    return e;
  }

  async function onSubmit(evt: FormEvent<HTMLFormElement>) {
    evt.preventDefault();
    setBanner(null);
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/customer/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        if (data.error === "INVALID_CURRENT_PASSWORD") {
          setErrors({ currentPassword: "Senha atual incorreta." });
        } else {
          setBanner({
            type: "error",
            message:
              data.message || "Não foi possível alterar a senha.",
          });
        }
      } else {
        setBanner({ type: "success", message: "Senha alterada com sucesso." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirm("");
      }
    } catch {
      setBanner({ type: "error", message: "Erro de conexão. Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="conta-form" onSubmit={onSubmit} noValidate>
      {banner && (
        <p
          className={
            banner.type === "success"
              ? "conta-banner conta-banner-success"
              : "conta-banner conta-banner-error"
          }
          role={banner.type === "error" ? "alert" : "status"}
        >
          {banner.message}
        </p>
      )}

      <div className="conta-form-row">
        <div className="conta-field">
          <label htmlFor="pwd-current" className="conta-label">
            Senha atual
          </label>
          <input
            id="pwd-current"
            className="conta-input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
            aria-invalid={errors.currentPassword ? true : undefined}
            aria-describedby={
              errors.currentPassword ? "pwd-current-error" : undefined
            }
          />
          {errors.currentPassword && (
            <p id="pwd-current-error" className="conta-field-error">
              {errors.currentPassword}
            </p>
          )}
        </div>
      </div>

      <div className="conta-form-row">
        <div className="conta-field">
          <label htmlFor="pwd-new" className="conta-label">
            Nova senha
          </label>
          <input
            id="pwd-new"
            className="conta-input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
            aria-invalid={errors.newPassword ? true : undefined}
            aria-describedby={
              errors.newPassword ? "pwd-new-error" : "pwd-new-hint"
            }
          />
          {errors.newPassword ? (
            <p id="pwd-new-error" className="conta-field-error">
              {errors.newPassword}
            </p>
          ) : (
            <p id="pwd-new-hint" className="conta-hint">
              Mínimo de 8 caracteres, com letras e números.
            </p>
          )}
        </div>

        <div className="conta-field">
          <label htmlFor="pwd-confirm" className="conta-label">
            Confirmar nova senha
          </label>
          <input
            id="pwd-confirm"
            className="conta-input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            aria-invalid={errors.confirm ? true : undefined}
            aria-describedby={errors.confirm ? "pwd-confirm-error" : undefined}
          />
          {errors.confirm && (
            <p id="pwd-confirm-error" className="conta-field-error">
              {errors.confirm}
            </p>
          )}
        </div>
      </div>

      <div>
        <button
          type="submit"
          className="conta-button"
          disabled={submitting}
        >
          {submitting ? "Alterando..." : "Alterar senha"}
        </button>
      </div>
    </form>
  );
}
