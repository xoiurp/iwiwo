const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { toString(): string }).toString === "function"
  ) {
    const n = Number((v as { toString(): string }).toString());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const MONEY_KEYS = new Set([
  "price",
  "compare_at_price",
  "unit_price",
  "total_price",
  "total",
]);

export function toPublicShape<T extends Record<string, unknown>>(
  input: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, rawVal] of Object.entries(input)) {
    const snakeKey = camelToSnake(key);
    let val: unknown = rawVal;

    if (MONEY_KEYS.has(snakeKey)) {
      val = toNumber(rawVal);
    } else if (val instanceof Date) {
      val = val.toISOString();
    }

    out[snakeKey] = val;
  }

  const price = toNumber(out["price"]);
  if (price != null && !out["price_formatted"]) {
    out["price_formatted"] = BRL_FORMATTER.format(price);
  }
  const cap = toNumber(out["compare_at_price"]);
  if (cap != null && cap > 0 && !out["compare_at_price_formatted"]) {
    out["compare_at_price_formatted"] = BRL_FORMATTER.format(cap);
  }

  return out;
}
