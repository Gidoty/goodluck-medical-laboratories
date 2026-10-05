import type { CashFlowRow, NpvDirection, PaybackResult, SavingsDirection } from "./types";

/**
 * Pure financial arithmetic. No unit knowledge, no assessment knowledge, no side effects.
 * All rates are decimals (0.10 = 10%).
 */

/** 1 / (1 + r)^t. Year 0 is exactly 1. */
export const discountFactor = (rate: number, year: number): number => (year === 0 ? 1 : Math.pow(1 + rate, -year));

export const presentValue = (amount: number, rate: number, year: number): number => amount * discountFactor(rate, year);

/** price_t = price_1 x (1 + g)^(t - 1) for t >= 1. */
export const escalatedPrice = (priceYear1: number, rate: number, year: number): number => priceYear1 * Math.pow(1 + rate, year - 1);

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

export function cumulative(xs: readonly number[]): number[] {
  const out: number[] = [];
  let running = 0;
  for (const x of xs) {
    running += x;
    out.push(running);
  }
  return out;
}

const SNAP = 1e-9;

/** Removes binary noise from computed times such as 3 x 0.1 = 0.30000000000000004. */
export const snapToInteger = (x: number): number => (Math.abs(x - Math.round(x)) < SNAP ? Math.round(x) : x);

/**
 * Years at which a vehicle bought at Year 0 must be bought again within the horizon.
 * A replacement is due every `life` years and only if it still provides service before the
 * horizon ends, so none is bought at exactly Year T. Non-integer lives are placed at the end of
 * the year in which the life expires (the timeline is annual). Returns each year once per event.
 */
export function replacementYears(horizon: number, life: number): number[] {
  const out: number[] = [];
  for (let k = 1; ; k++) {
    const due = snapToInteger(k * life);
    if (due >= horizon - SNAP) break;
    out.push(Math.ceil(due - SNAP));
  }
  return out;
}

/** Start times (in years) of every vehicle cycle inside the horizon, including Year 0. */
export function cycleStarts(horizon: number, life: number): number[] {
  const starts = [0];
  for (let k = 1; ; k++) {
    const due = snapToInteger(k * life);
    if (due >= horizon - SNAP) break;
    starts.push(due);
  }
  return starts;
}

/**
 * Payback from a stream of cash flows indexed by year (index 0 = Year 0).
 *
 * - `immediate`: the running total is not negative at Year 0, so no extra investment has to be recovered.
 * - `achieved`: the first year in which the running total reaches zero or above, interpolated
 *   linearly inside that year: (t - 1) + shortfall at the start of the year / cash flow in the year.
 * - `not_achieved`: the running total is still negative at the end of the horizon.
 *
 * `sustained` reports whether the running total stays non-negative after the crossing, because
 * replacement or battery costs can push it below zero again.
 */
export function paybackOf(flows: readonly number[]): PaybackResult {
  const running = cumulative(flows);
  // No deficit at Year 0: nothing has to be recovered. `sustained` says whether it stays that way.
  if (running[0]! >= 0) return { status: "immediate", years: 0, sustained: running.every((c) => c >= 0) };

  for (let t = 1; t < running.length; t++) {
    if (running[t]! >= 0) {
      const before = running[t - 1]!; // negative
      const inYear = flows[t]!; // positive, because the running total crossed upwards
      const sustained = running.slice(t).every((c) => c >= 0);
      return { status: "achieved", years: t - 1 + -before / inYear, sustained };
    }
  }
  return { status: "not_achieved", years: null, sustained: null };
}

/** Cumulative fleet distance at a (possibly fractional) time, interpolating within the year. */
export function distanceAtTime(distanceByYear: readonly number[], time: number): number {
  // distanceByYear[t] is the distance driven during operating year t (index 0 = Year 0 = 0 km).
  const whole = Math.floor(time);
  let total = 0;
  for (let t = 1; t <= whole && t < distanceByYear.length; t++) total += distanceByYear[t]!;
  const frac = time - whole;
  if (frac > 0 && whole + 1 < distanceByYear.length) total += frac * distanceByYear[whole + 1]!;
  return total;
}

export function npvDirection(npv: number, scale: number): NpvDirection {
  const tolerance = Math.max(1e-9, 1e-9 * scale);
  if (Math.abs(npv) <= tolerance) return "indifferent";
  return npv > 0 ? "advantage" : "disadvantage";
}

export function savingsDirection(x: number): SavingsDirection {
  if (x === 0) return "none";
  return x > 0 ? "saving" : "additional_cost";
}

export function buildRows(diesel: readonly number[], green: readonly number[], rate: number): CashFlowRow[] {
  const rows: CashFlowRow[] = [];
  let cum = 0;
  let dcum = 0;
  for (let t = 0; t < diesel.length; t++) {
    const incremental = diesel[t]! - green[t]!;
    const discounted = presentValue(incremental, rate, t);
    cum += incremental;
    dcum += discounted;
    rows.push({ year: t, dieselCost: diesel[t]!, greenCost: green[t]!, incrementalCashFlow: incremental, discountedIncrementalCashFlow: discounted, cumulativeIncrementalCashFlow: cum, discountedCumulativeCashFlow: dcum });
  }
  return rows;
}
