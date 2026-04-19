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

const relativeFormatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

// Returns a localized relative-time string in pt-BR (e.g. "há 3 horas", "em 1 minuto").
// Chooses the largest unit whose absolute magnitude is >= 1.
export function formatRelativeTimeBR(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);

  const units: { limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { limit: 60, divisor: 1, unit: "second" },
    { limit: 3600, divisor: 60, unit: "minute" },
    { limit: 86400, divisor: 3600, unit: "hour" },
    { limit: 604800, divisor: 86400, unit: "day" },
    { limit: 2629800, divisor: 604800, unit: "week" },
    { limit: 31557600, divisor: 2629800, unit: "month" },
    { limit: Number.POSITIVE_INFINITY, divisor: 31557600, unit: "year" },
  ];

  for (const { limit, divisor, unit } of units) {
    if (abs < limit) {
      return relativeFormatter.format(Math.round(diffSec / divisor), unit);
    }
  }
  return relativeFormatter.format(Math.round(diffSec / 31557600), "year");
}
