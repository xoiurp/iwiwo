"use client";

// app/conta/(protected)/suporte/_components/ReplyForm.tsx
// Textarea + submit for customer replies. Disables itself while the request
// is in-flight and calls router.refresh() on success so the new bubble shows
// without a full page reload.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function ReplyForm({ ticketId }: { ticketId: number }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      setError("Escreva sua resposta antes de enviar.");
      return;
    }
    if (trimmed.length > 5000) {
      setError("A resposta é muito longa (máx. 5000 caracteres).");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/support/tickets/${ticketId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: trimmed }),
        }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        setError(data?.message ?? "Não foi possível enviar sua resposta.");
        return;
      }
      setValue("");
      startTransition(() => router.refresh());
    } catch {
      setError("Erro de conexão ao enviar a resposta.");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || pending;

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
      <label
        htmlFor="reply-body"
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          color: "#1a1a1a",
          marginBottom: 8,
        }}
      >
        Sua resposta
      </label>
      <textarea
        id="reply-body"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        disabled={busy}
        placeholder="Escreva sua mensagem..."
        style={{
          width: "100%",
          resize: "vertical",
          padding: "12px 14px",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          fontSize: 14,
          lineHeight: 1.5,
          color: "#1a1a1a",
          fontFamily: "inherit",
          background: busy ? "#f7f7f8" : "#fff",
        }}
      />
      {error ? (
        <div style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>
          {error}
        </div>
      ) : null}
      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={busy}
          style={{
            background: "#000",
            color: "#fff",
            border: "none",
            padding: "10px 18px",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Enviando..." : "Enviar resposta"}
        </button>
      </div>
    </form>
  );
}
