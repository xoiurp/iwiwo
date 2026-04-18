"use client";

import { useState, type FormEvent } from "react";

export type PerfilInitial = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string; // YYYY-MM-DD or empty
};

type FieldErrors = Partial<Record<"name" | "phone" | "cpf" | "birthDate", string>>;

function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function maskCpf(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 9);
  const p4 = digits.slice(9, 11);
  let out = p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `-${p4}`;
  return out;
}

function isCpfFormat(value: string): boolean {
  return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value);
}

export default function PerfilForm({ initial }: { initial: PerfilInitial }) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(maskPhone(initial.phone));
  const [cpf, setCpf] = useState(maskCpf(initial.cpf));
  const [birthDate, setBirthDate] = useState(initial.birthDate);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!name.trim() || name.trim().length < 2) {
      e.name = "Informe seu nome completo.";
    }
    if (cpf.trim() && !isCpfFormat(cpf.trim())) {
      e.cpf = "CPF deve estar no formato 000.000.000-00.";
    }
    if (phone.trim()) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length !== 10 && digits.length !== 11) {
        e.phone = "Telefone deve ter 10 ou 11 dígitos.";
      }
    }
    if (birthDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      e.birthDate = "Data inválida.";
    }
    return e;
  };

  async function onSubmit(evt: FormEvent<HTMLFormElement>) {
    evt.preventDefault();
    setBanner(null);
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          cpf: cpf.trim() || null,
          birthDate: birthDate.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setBanner({
          type: "error",
          message: data.message || "Não foi possível salvar o perfil.",
        });
      } else {
        setBanner({ type: "success", message: "Perfil atualizado." });
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
          <label htmlFor="perfil-name" className="conta-label">
            Nome completo
          </label>
          <input
            id="perfil-name"
            className="conta-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "perfil-name-error" : undefined}
          />
          {errors.name && (
            <p id="perfil-name-error" className="conta-field-error">
              {errors.name}
            </p>
          )}
        </div>

        <div className="conta-field">
          <label htmlFor="perfil-email" className="conta-label">
            Email
          </label>
          <input
            id="perfil-email"
            className="conta-input"
            type="email"
            value={initial.email}
            readOnly
            aria-describedby="perfil-email-hint"
          />
          <p id="perfil-email-hint" className="conta-hint">
            Para alterar seu email, entre em contato com o suporte.
          </p>
        </div>
      </div>

      <div className="conta-form-row">
        <div className="conta-field">
          <label htmlFor="perfil-phone" className="conta-label">
            Telefone
            <span className="conta-label-optional">(opcional)</span>
          </label>
          <input
            id="perfil-phone"
            className="conta-input"
            type="tel"
            inputMode="numeric"
            placeholder="00 00000-0000"
            value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            autoComplete="tel"
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? "perfil-phone-error" : undefined}
          />
          {errors.phone && (
            <p id="perfil-phone-error" className="conta-field-error">
              {errors.phone}
            </p>
          )}
        </div>

        <div className="conta-field">
          <label htmlFor="perfil-cpf" className="conta-label">
            CPF
            <span className="conta-label-optional">(opcional)</span>
          </label>
          <input
            id="perfil-cpf"
            className="conta-input"
            type="text"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(maskCpf(e.target.value))}
            autoComplete="off"
            aria-invalid={errors.cpf ? true : undefined}
            aria-describedby={errors.cpf ? "perfil-cpf-error" : undefined}
          />
          {errors.cpf && (
            <p id="perfil-cpf-error" className="conta-field-error">
              {errors.cpf}
            </p>
          )}
        </div>

        <div className="conta-field">
          <label htmlFor="perfil-birth" className="conta-label">
            Data de nascimento
            <span className="conta-label-optional">(opcional)</span>
          </label>
          <input
            id="perfil-birth"
            className="conta-input"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            aria-invalid={errors.birthDate ? true : undefined}
            aria-describedby={
              errors.birthDate ? "perfil-birth-error" : undefined
            }
          />
          {errors.birthDate && (
            <p id="perfil-birth-error" className="conta-field-error">
              {errors.birthDate}
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
          {submitting ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
