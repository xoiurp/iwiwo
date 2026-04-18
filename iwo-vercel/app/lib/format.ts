// app/lib/format.ts
// Shared pt-BR formatters for currency and dates. Handles Prisma Decimal
// instances via `.toString()` → Number conversion.

type DecimalLike = { toString(): string };

function toNumber(v: number | string | DecimalLike): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return Number(v.toString());
}

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(v: number | string | DecimalLike | null | undefined): string {
  if (v === null || v === undefined) return brlFormatter.format(0);
  const n = toNumber(v);
  return brlFormatter.format(Number.isFinite(n) ? n : 0);
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateBR(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return dateFormatter.format(date);
}
