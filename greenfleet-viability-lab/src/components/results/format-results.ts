import type { CurrencyCode } from "@/lib/currency";
import { CURRENCIES } from "@/lib/currency";
import { EMPTY_VALUE, formatMoney, formatNumber } from "@/lib/format";
import type { PaybackResult, SavingsDirection } from "@/calculation/types";

/** Display formatting for results. Rounds only here, never in the engine. */
export function resultFormatter(currency: CurrencyCode) {
  const symbol = CURRENCIES[currency].symbol;
  return {
    currency,
    symbol,
    money: (x: number | null) => formatMoney(x, currency),
    compact: (x: number) => formatMoney(x, currency, { compact: true }),
    perKm: (x: number | null) => (x === null ? EMPTY_VALUE : `${formatMoney(x, currency, { fractionDigits: 2 })}/km`),
    km: (x: number | null) => (x === null ? EMPTY_VALUE : `${formatNumber(x, 0)} km`),
    years: (p: PaybackResult) =>
      p.status === "not_achieved" || p.years === null
        ? "Not achieved within analysis horizon"
        : p.status === "immediate"
          ? "Immediate (no extra upfront cost)"
          : `${formatNumber(p.years, 2)} years`,
    savings: (x: number, direction: SavingsDirection) =>
      direction === "additional_cost" ? `Additional operating cost of ${formatMoney(-x, currency)}` : direction === "none" ? `${formatMoney(0, currency)}` : `${formatMoney(x, currency)} saved`,
    /** Replaces the engine's {cur} token with the real symbol. */
    text: (s: string) => s.split("{cur}").join(symbol),
  };
}

export type ResultFormatter = ReturnType<typeof resultFormatter>;

export const NPV_LABEL = {
  advantage: "Economic advantage over diesel",
  indifferent: "Economically indifferent to diesel",
  disadvantage: "Economic disadvantage versus diesel",
} as const;
