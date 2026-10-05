import type { ValueUnit } from "./variables";

/** Rounds a solved value for display only: about three significant figures for large numbers. The solver keeps full precision. */
export function roundForDisplay(v: number): number {
  if (!Number.isFinite(v)) return v;
  const a = Math.abs(v);
  if (a === 0) return 0;
  if (a >= 1000) {
    const digits = Math.floor(Math.log10(a)) + 1;
    const keep = Math.max(3, 0);
    const p = Math.pow(10, digits - keep);
    return Math.round(v / p) * p;
  }
  if (a >= 100) return Math.round(v);
  if (a >= 1) return Math.round(v * 100) / 100;
  return Number(v.toPrecision(3));
}

const num = (x: number, d = 2, min = 0) => x.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: min });

const UNIT_SUFFIX: Record<ValueUnit, string> = {
  money: "", money_per_litre: "/litre", money_per_kwh: "/kWh", money_per_fuel_unit: "/fuel unit", money_per_year: "/year",
  km: " km", km_per_year: " km/year", days: " days", percent: "%", hours_per_day: " hours/day", kg: " kg",
};

/** Text with the {cur} token for the currency symbol, which the UI fills in. */
export function formatValue(unit: ValueUnit, v: number, rounded = false): string {
  const x = rounded ? roundForDisplay(v) : v;
  const perUnit = unit === "money_per_litre" || unit === "money_per_kwh" || unit === "money_per_fuel_unit";
  const body = Math.abs(x) >= 1000 ? num(x, perUnit ? 2 : 0) : num(x, Math.abs(x) >= 1 ? 2 : 4, perUnit ? 2 : 0);
  if (unit.startsWith("money")) return `${x < 0 ? "-" : ""}{cur}${body.replace("-", "")}${UNIT_SUFFIX[unit]}`;
  return `${body}${UNIT_SUFFIX[unit]}`;
}

export const CLASS_WORDS: Record<string, string> = { VIABLE: "Viable", CONDITIONALLY_VIABLE: "Conditionally Viable", NOT_YET_VIABLE: "Not Yet Viable", INSUFFICIENT_EVIDENCE: "Insufficient Evidence" };
