import { CURRENCIES, type CurrencyCode } from "./currency";
import { unitLabel, type UnitId } from "./units";

/** Shown wherever a value is missing or not applicable. */
export const EMPTY_VALUE = "—";

const nf = (maxFractionDigits: number, minFractionDigits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: maxFractionDigits, minimumFractionDigits: minFractionDigits });

const FULL = nf(0);
const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

const isUsable = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Removes binary floating-point noise for display only (0.1 + 0.2 shows as 0.3, not 0.30000000000000004).
 * Stored values are never rounded.
 */
export const cleanFloat = (v: number): number => Number(v.toPrecision(12));

/** Minus sign is only shown for values that round to a non-zero amount, so -0 never appears. */
function signOf(v: number, rounded: string): string {
  return v < 0 && /[1-9]/.test(rounded) ? "-" : "";
}

export function formatNumber(value: number | null | undefined, maxFractionDigits = 2): string {
  if (!isUsable(value)) return EMPTY_VALUE;
  const body = nf(maxFractionDigits).format(Math.abs(cleanFloat(value)));
  return `${signOf(value, body)}${body}`;
}

export function formatMoney(
  value: number | null | undefined,
  currency: CurrencyCode,
  options: { compact?: boolean; fractionDigits?: number } = {},
): string {
  if (!isUsable(value)) return EMPTY_VALUE;
  const symbol = CURRENCIES[currency].symbol;
  const abs = Math.abs(cleanFloat(value));
  const body = options.compact
    ? COMPACT.format(abs)
    : options.fractionDigits !== undefined
      ? nf(options.fractionDigits, options.fractionDigits).format(abs)
      : FULL.format(abs);
  return `${signOf(value, body)}${symbol}${body}`;
}

export function formatPercent(value: number | null | undefined, maxFractionDigits = 1): string {
  if (!isUsable(value)) return EMPTY_VALUE;
  return `${formatNumber(value, maxFractionDigits)}%`;
}

/** Value plus its unit, e.g. "120 km/day" or "₦1,200/litre". Money-based units put the symbol first. */
export function formatQuantity(
  value: number | null | undefined,
  unit: UnitId,
  currency: CurrencyCode,
  maxFractionDigits = 2,
): string {
  if (!isUsable(value)) return EMPTY_VALUE;
  if (unit === "percent") return formatPercent(value, maxFractionDigits);
  if (unit.startsWith("money")) {
    const suffix = unitLabel(unit, currency).replace(CURRENCIES[currency].symbol, "");
    return `${formatMoney(value, currency, { fractionDigits: Math.abs(value) < 1000 && !Number.isInteger(value) ? 2 : undefined })}${suffix}`;
  }
  return `${formatNumber(value, maxFractionDigits)} ${unitLabel(unit, currency)}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return EMPTY_VALUE;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return EMPTY_VALUE;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
