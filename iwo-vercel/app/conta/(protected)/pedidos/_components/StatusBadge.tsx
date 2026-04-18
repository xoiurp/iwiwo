"use client";

// app/conta/(protected)/pedidos/_components/StatusBadge.tsx
// Small client component that renders a pill badge for an order status.
// The underlying `orders.status` column is a free-text VARCHAR(50) in the DB,
// so we normalize unknown values to a muted gray.

type Tone = {
  bg: string;
  fg: string;
  label: string;
};

const TONES: Record<string, Tone> = {
  pending: { bg: "#fef3c7", fg: "#92400e", label: "Aguardando pagamento" },
  paid: { bg: "#dcfce7", fg: "#166534", label: "Pago" },
  shipped: { bg: "#dbeafe", fg: "#1d4ed8", label: "Enviado" },
  delivered: { bg: "#dcfce7", fg: "#166534", label: "Entregue" },
  cancelled: { bg: "#fee2e2", fg: "#991b1b", label: "Cancelado" },
  canceled: { bg: "#fee2e2", fg: "#991b1b", label: "Cancelado" },
  failed: { bg: "#fee2e2", fg: "#991b1b", label: "Rejeitado" },
  rejected: { bg: "#fee2e2", fg: "#991b1b", label: "Rejeitado" },
  refunded: { bg: "#f3f4f6", fg: "#4b5563", label: "Reembolsado" },
};

const UNKNOWN: Tone = { bg: "#f3f4f6", fg: "#4b5563", label: "Desconhecido" };

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status ?? "").toLowerCase().trim();
  const tone = TONES[key] ?? { ...UNKNOWN, label: status || UNKNOWN.label };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.2,
        letterSpacing: 0.2,
        backgroundColor: tone.bg,
        color: tone.fg,
        whiteSpace: "nowrap",
      }}
    >
      {tone.label}
    </span>
  );
}

export default StatusBadge;
