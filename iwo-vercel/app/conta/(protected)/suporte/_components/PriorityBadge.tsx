"use client";

// app/conta/(protected)/suporte/_components/PriorityBadge.tsx
// Small pill for ticket priority. Kept visually lighter than StatusBadge so
// the two badges can sit side by side without competing for attention.

import type { TicketPriority } from "@prisma/client";

type Tone = { bg: string; fg: string; label: string };

const TONES: Record<TicketPriority, Tone> = {
  LOW: { bg: "#f3f4f6", fg: "#666666", label: "Baixa" },
  MEDIUM: { bg: "#fff7ed", fg: "#f59e0b", label: "Média" },
  HIGH: { bg: "#fee2e2", fg: "#dc2626", label: "Alta" },
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const tone = TONES[priority];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
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

export default PriorityBadge;
