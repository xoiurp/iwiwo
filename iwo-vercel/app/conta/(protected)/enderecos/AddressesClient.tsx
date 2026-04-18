"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type AddressRow = {
  id: number;
  label: string | null;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  isDefault: boolean;
};

type AddressFormState = {
  label: string;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
};

type FieldErrors = Partial<Record<keyof AddressFormState, string>>;

const BR_UF = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

function maskCep(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function emptyForm(): AddressFormState {
  return {
    label: "",
    recipient: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    isDefault: false,
  };
}

function fromRow(a: AddressRow): AddressFormState {
  return {
    label: a.label ?? "",
    recipient: a.recipient,
    cep: a.cep,
    street: a.street,
    number: a.number,
    complement: a.complement ?? "",
    neighborhood: a.neighborhood,
    city: a.city,
    state: a.state,
    isDefault: a.isDefault,
  };
}

export default function AddressesClient({
  initial,
}: {
  initial: AddressRow[];
}) {
  const router = useRouter();
  const [addresses, setAddresses] = useState<AddressRow[]>(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AddressFormState>(emptyForm());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [banner, setBanner] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  useEffect(() => {
    setAddresses(initial);
  }, [initial]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm());
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(a: AddressRow) {
    setEditingId(a.id);
    setForm(fromRow(a));
    setErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
  }

  async function onCepBlur() {
    const digits = form.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) return;
      setForm((f) => ({
        ...f,
        street: f.street || data.logradouro || "",
        neighborhood: f.neighborhood || data.bairro || "",
        city: f.city || data.localidade || "",
        state: f.state || (data.uf ?? "").toUpperCase(),
      }));
    } catch {
      // Silently ignore; user can fill in manually
    } finally {
      setCepLoading(false);
    }
  }

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!form.recipient.trim()) e.recipient = "Informe o destinatário.";
    if (!/^\d{5}-\d{3}$/.test(form.cep)) e.cep = "CEP deve ter 8 dígitos.";
    if (!form.street.trim()) e.street = "Informe a rua.";
    if (!form.number.trim()) e.number = "Informe o número.";
    if (!form.neighborhood.trim()) e.neighborhood = "Informe o bairro.";
    if (!form.city.trim()) e.city = "Informe a cidade.";
    if (!/^[A-Z]{2}$/.test(form.state) || !BR_UF.includes(form.state)) {
      e.state = "UF inválida.";
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
      const payload = {
        label: form.label.trim() || null,
        recipient: form.recipient.trim(),
        cep: form.cep,
        street: form.street.trim(),
        number: form.number.trim(),
        complement: form.complement.trim() || null,
        neighborhood: form.neighborhood.trim(),
        city: form.city.trim(),
        state: form.state.toUpperCase(),
        country: "BR",
        isDefault: form.isDefault,
      };

      const url = editingId
        ? `/api/customer/addresses/${editingId}`
        : "/api/customer/addresses";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setBanner({
          type: "error",
          message: data.message || "Não foi possível salvar o endereço.",
        });
        return;
      }
      setBanner({
        type: "success",
        message: editingId ? "Endereço atualizado." : "Endereço adicionado.",
      });
      setModalOpen(false);
      router.refresh();
    } catch {
      setBanner({ type: "error", message: "Erro de conexão. Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Remover este endereço?")) return;
    setBanner(null);
    try {
      const res = await fetch(`/api/customer/addresses/${id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!res.ok) {
        setBanner({
          type: "error",
          message: data.message || "Não foi possível remover.",
        });
        return;
      }
      setBanner({ type: "success", message: "Endereço removido." });
      router.refresh();
    } catch {
      setBanner({ type: "error", message: "Erro de conexão." });
    }
  }

  async function onSetDefault(a: AddressRow) {
    if (a.isDefault) return;
    setBanner(null);
    try {
      const res = await fetch(`/api/customer/addresses/${a.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: a.label,
          recipient: a.recipient,
          cep: a.cep,
          street: a.street,
          number: a.number,
          complement: a.complement,
          neighborhood: a.neighborhood,
          city: a.city,
          state: a.state,
          country: a.country,
          isDefault: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!res.ok) {
        setBanner({
          type: "error",
          message: data.message || "Não foi possível atualizar.",
        });
        return;
      }
      setBanner({ type: "success", message: "Endereço definido como padrão." });
      router.refresh();
    } catch {
      setBanner({ type: "error", message: "Erro de conexão." });
    }
  }

  return (
    <div>
      {banner && (
        <p
          className={
            banner.type === "success"
              ? "conta-banner conta-banner-success"
              : "conta-banner conta-banner-error"
          }
          role={banner.type === "error" ? "alert" : "status"}
          style={{ marginBottom: 16 }}
        >
          {banner.message}
        </p>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 16,
        }}
      >
        <button type="button" className="conta-button" onClick={openNew}>
          Novo endereço
        </button>
      </div>

      {addresses.length === 0 ? (
        <p className="conta-empty">
          Você ainda não cadastrou nenhum endereço.
        </p>
      ) : (
        <div className="conta-address-list">
          {addresses.map((a) => (
            <div
              key={a.id}
              className={
                "conta-address-card" + (a.isDefault ? " is-default" : "")
              }
            >
              <div className="conta-address-label">
                <span>{a.label || "Endereço"}</span>
                {a.isDefault && (
                  <span className="conta-badge conta-badge-success">Padrão</span>
                )}
              </div>
              <div className="conta-address-body">
                <div>
                  <strong>{a.recipient}</strong>
                </div>
                <div>
                  {a.street}, {a.number}
                  {a.complement ? ` · ${a.complement}` : ""}
                </div>
                <div>
                  {a.neighborhood} · {a.city}/{a.state}
                </div>
                <div>CEP {a.cep}</div>
              </div>
              <div className="conta-actions-row">
                <button
                  type="button"
                  className="conta-button conta-button-secondary"
                  onClick={() => openEdit(a)}
                >
                  Editar
                </button>
                {!a.isDefault && (
                  <button
                    type="button"
                    className="conta-button conta-button-secondary"
                    onClick={() => onSetDefault(a)}
                  >
                    Definir como padrão
                  </button>
                )}
                <button
                  type="button"
                  className="conta-button conta-button-danger"
                  onClick={() => onDelete(a.id)}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div
          className="conta-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="addr-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="conta-modal">
            <div className="conta-modal-header">
              <h2 id="addr-modal-title" className="conta-modal-title">
                {editingId ? "Editar endereço" : "Novo endereço"}
              </h2>
              <button
                type="button"
                className="conta-modal-close"
                onClick={closeModal}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form className="conta-form" onSubmit={onSubmit} noValidate>
              <div className="conta-form-row">
                <div className="conta-field">
                  <label htmlFor="addr-label" className="conta-label">
                    Rótulo
                    <span className="conta-label-optional">(opcional)</span>
                  </label>
                  <input
                    id="addr-label"
                    className="conta-input"
                    type="text"
                    placeholder="Casa, Trabalho..."
                    value={form.label}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, label: e.target.value }))
                    }
                  />
                </div>
                <div className="conta-field">
                  <label htmlFor="addr-recipient" className="conta-label">
                    Destinatário
                  </label>
                  <input
                    id="addr-recipient"
                    className="conta-input"
                    type="text"
                    value={form.recipient}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, recipient: e.target.value }))
                    }
                    required
                    aria-invalid={errors.recipient ? true : undefined}
                    aria-describedby={
                      errors.recipient ? "addr-recipient-error" : undefined
                    }
                  />
                  {errors.recipient && (
                    <p id="addr-recipient-error" className="conta-field-error">
                      {errors.recipient}
                    </p>
                  )}
                </div>
              </div>

              <div className="conta-form-row">
                <div className="conta-field">
                  <label htmlFor="addr-cep" className="conta-label">
                    CEP
                  </label>
                  <input
                    id="addr-cep"
                    className="conta-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={form.cep}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cep: maskCep(e.target.value) }))
                    }
                    onBlur={onCepBlur}
                    required
                    aria-invalid={errors.cep ? true : undefined}
                    aria-describedby={
                      errors.cep ? "addr-cep-error" : "addr-cep-hint"
                    }
                  />
                  {errors.cep ? (
                    <p id="addr-cep-error" className="conta-field-error">
                      {errors.cep}
                    </p>
                  ) : (
                    <p id="addr-cep-hint" className="conta-hint">
                      {cepLoading
                        ? "Buscando endereço..."
                        : "Preenchemos o restante automaticamente."}
                    </p>
                  )}
                </div>
                <div className="conta-field">
                  <label htmlFor="addr-state" className="conta-label">
                    UF
                  </label>
                  <select
                    id="addr-state"
                    className="conta-input"
                    value={form.state}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        state: e.target.value.toUpperCase(),
                      }))
                    }
                    required
                    aria-invalid={errors.state ? true : undefined}
                    aria-describedby={
                      errors.state ? "addr-state-error" : undefined
                    }
                  >
                    <option value="">—</option>
                    {BR_UF.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                  {errors.state && (
                    <p id="addr-state-error" className="conta-field-error">
                      {errors.state}
                    </p>
                  )}
                </div>
              </div>

              <div className="conta-form-row">
                <div className="conta-field" style={{ gridColumn: "span 2" }}>
                  <label htmlFor="addr-street" className="conta-label">
                    Rua
                  </label>
                  <input
                    id="addr-street"
                    className="conta-input"
                    type="text"
                    value={form.street}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, street: e.target.value }))
                    }
                    required
                    aria-invalid={errors.street ? true : undefined}
                    aria-describedby={
                      errors.street ? "addr-street-error" : undefined
                    }
                  />
                  {errors.street && (
                    <p id="addr-street-error" className="conta-field-error">
                      {errors.street}
                    </p>
                  )}
                </div>
                <div className="conta-field">
                  <label htmlFor="addr-number" className="conta-label">
                    Número
                  </label>
                  <input
                    id="addr-number"
                    className="conta-input"
                    type="text"
                    value={form.number}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, number: e.target.value }))
                    }
                    required
                    aria-invalid={errors.number ? true : undefined}
                    aria-describedby={
                      errors.number ? "addr-number-error" : undefined
                    }
                  />
                  {errors.number && (
                    <p id="addr-number-error" className="conta-field-error">
                      {errors.number}
                    </p>
                  )}
                </div>
              </div>

              <div className="conta-form-row">
                <div className="conta-field">
                  <label htmlFor="addr-complement" className="conta-label">
                    Complemento
                    <span className="conta-label-optional">(opcional)</span>
                  </label>
                  <input
                    id="addr-complement"
                    className="conta-input"
                    type="text"
                    value={form.complement}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, complement: e.target.value }))
                    }
                  />
                </div>
                <div className="conta-field">
                  <label htmlFor="addr-neighborhood" className="conta-label">
                    Bairro
                  </label>
                  <input
                    id="addr-neighborhood"
                    className="conta-input"
                    type="text"
                    value={form.neighborhood}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        neighborhood: e.target.value,
                      }))
                    }
                    required
                    aria-invalid={errors.neighborhood ? true : undefined}
                    aria-describedby={
                      errors.neighborhood
                        ? "addr-neighborhood-error"
                        : undefined
                    }
                  />
                  {errors.neighborhood && (
                    <p
                      id="addr-neighborhood-error"
                      className="conta-field-error"
                    >
                      {errors.neighborhood}
                    </p>
                  )}
                </div>
              </div>

              <div className="conta-form-row">
                <div className="conta-field">
                  <label htmlFor="addr-city" className="conta-label">
                    Cidade
                  </label>
                  <input
                    id="addr-city"
                    className="conta-input"
                    type="text"
                    value={form.city}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, city: e.target.value }))
                    }
                    required
                    aria-invalid={errors.city ? true : undefined}
                    aria-describedby={
                      errors.city ? "addr-city-error" : undefined
                    }
                  />
                  {errors.city && (
                    <p id="addr-city-error" className="conta-field-error">
                      {errors.city}
                    </p>
                  )}
                </div>
              </div>

              <label className="conta-checkbox">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isDefault: e.target.checked }))
                  }
                />
                Definir como endereço padrão
              </label>

              <div className="conta-actions-row">
                <button
                  type="submit"
                  className="conta-button"
                  disabled={submitting}
                >
                  {submitting
                    ? "Salvando..."
                    : editingId
                    ? "Salvar alterações"
                    : "Adicionar endereço"}
                </button>
                <button
                  type="button"
                  className="conta-button conta-button-secondary"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
