"use client";

// app/conta/(protected)/suporte/_components/StatusBadge.tsx
// Renders the support ticket status as a styled pill. Colors are sourced from
// the W2-3 design tokens so the list, detail, and admin views stay aligned.

import type { TicketStatus } from "@prisma/client";

type Tone = { bg: string; fg: string; label: string };

const TONES: Record<TicketStatus, Tone> = {
  OPEN: { bg: "#fff7ed", fg: "#f59e0b", label: "Aberto" },
  WAITING_CUSTOMER: {
    bg: "#eff6ff",
    fg: "#2563eb",
    label: "Aguardando resposta sua",
  },
  ANSWERED: { bg: "#ecfdf5", fg: "#16a34a", label: "Respondido" },
  CLOSED: { bg: "#f3f4f6", fg: "#666666", label: "Fechado" },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const tone = TONES[status];
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
