"use client";

// app/conta/(protected)/suporte/novo/page.tsx
// Client form to open a new ticket. If the user arrived from an order detail
// page (?pedido=123) we pre-fill the description with a reference line so the
// admin has immediate context without the customer having to retype it.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "../suporte.module.css";

type Priority = "LOW" | "MEDIUM" | "HIGH";

export default function NovoTicketPage() {
  return (
    <Suspense fallback={<div className={styles.wrap}>Carregando…</div>}>
      <NovoTicketForm />
    </Suspense>
  );
}

function NovoTicketForm() {
  const router = useRouter();
  const params = useSearchParams();
  const pedido = params.get("pedido");

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (pedido && /^\d+$/.test(pedido)) {
      setDescription((current) =>
        current.length === 0
          ? `Relacionado ao Pedido #${pedido}\n\n`
          : current
      );
    }
  }, [pedido]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedSubject = subject.trim();
    const trimmedDescription = description.trim();

    if (trimmedSubject.length < 3 || trimmedSubject.length > 255) {
      setError("O assunto deve ter entre 3 e 255 caracteres.");
      return;
    }
    if (trimmedDescription.length < 10) {
      setError("A descrição deve ter ao menos 10 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: trimmedSubject,
          description: trimmedDescription,
          priority,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        setError(data?.message ?? "Não foi possível abrir o ticket.");
        return;
      }

      const data = (await res.json()) as { id: number };
      router.push(`/conta/suporte/${data.id}`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <Link href="/conta/suporte" className={styles.backLink}>
        ← Voltar para suporte
      </Link>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Novo ticket</h1>
          <p className={styles.subtitle}>
            Descreva seu problema com o máximo de detalhes possível.
          </p>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="subject">
            Assunto
          </label>
          <input
            id="subject"
            type="text"
            className={styles.input}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={255}
            placeholder="Ex.: Dúvida sobre entrega do pedido"
            disabled={submitting}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="description">
            Descrição
          </label>
          <textarea
            id="description"
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            placeholder="Conte o que aconteceu..."
            disabled={submitting}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="priority">
            Prioridade
          </label>
          <select
            id="priority"
            className={styles.select}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            disabled={submitting}
          >
            <option value="LOW">Baixa</option>
            <option value="MEDIUM">Média</option>
            <option value="HIGH">Alta</option>
          </select>
        </div>

        {error ? <div className={styles.errorBox}>{error}</div> : null}

        <div className={styles.formActions}>
          <Link href="/conta/suporte" className={styles.cancelBtn}>
            Cancelar
          </Link>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting}
          >
            {submitting ? "Enviando..." : "Abrir ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}
