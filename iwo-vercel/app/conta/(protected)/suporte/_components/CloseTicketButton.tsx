"use client";

// app/conta/(protected)/suporte/_components/CloseTicketButton.tsx
// Client-only button that confirms, PATCHes the ticket, and refreshes the
// server component shell so the closed state is reflected immediately.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function CloseTicketButton({ ticketId }: { ticketId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    const ok = window.confirm(
      "Tem certeza que deseja fechar este ticket? Você não poderá mais responder."
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        setError(data?.message ?? "Não foi possível fechar o ticket.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Erro de conexão ao fechar o ticket.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          color: "#1a1a1a",
          padding: "8px 14px",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? "Fechando..." : "Fechar ticket"}
      </button>
      {error ? (
        <div style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
