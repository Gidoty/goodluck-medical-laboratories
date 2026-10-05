import type { Currency } from "../engine/fields";

export interface Fmt {
  currency: Currency;
  money: (v: number) => string;
  compact: (v: number) => string;
  perUnit: (v: number) => string;
  num: (v: number, digits?: number) => string;
  years: (v: number | null) => string;
  pct: (v: number, digits?: number) => string;
}

export function makeFmt(currency: Currency): Fmt {
  const full = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const small = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const comp = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const sign = (v: number) => (v < 0 ? "-" : "");
  return {
    currency,
    money: (v) => `${sign(v)}${currency.symbol}${full.format(Math.abs(v))}`,
    compact: (v) => `${sign(v)}${currency.symbol}${comp.format(Math.abs(v))}`,
    perUnit: (v) => `${sign(v)}${currency.symbol}${Math.abs(v) >= 100 ? full.format(Math.abs(v)) : small.format(Math.abs(v))}`,
    num: (v, d = 1) => new Intl.NumberFormat("en-US", { maximumFractionDigits: d }).format(v),
    years: (v) => (v === null ? "not within horizon" : v === 0 ? "immediate" : `${v.toFixed(1)} yr`),
    pct: (v, d = 1) => `${v.toFixed(d)}%`,
  };
}
