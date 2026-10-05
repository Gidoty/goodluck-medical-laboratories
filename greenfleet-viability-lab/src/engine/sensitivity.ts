import { evaluate, npvVsDiesel, type Alt } from "./evaluate";
import type { Params } from "./fields";
import { annualKm } from "./model";

/**
 * A driver that can be flexed. "relative" variables are scaled by (1 + x);
 * "pp" variables are shifted by x percentage points.
 * `adverse` is the direction that hurts the alternative (-1 = a fall hurts, +1 = a rise hurts).
 */
export interface SensVar {
  id: string;
  label: string;
  mode: "relative" | "pp";
  appliesTo: readonly Alt[];
  adverse: -1 | 1;
  apply: (p: Params, x: number, alt: Alt) => Params;
  /** Current value of the underlying quantity and its unit label ("{cur}" = currency). */
  read: (p: Params, alt: Alt) => number;
  unit: string;
}

const altPriceKey = { bev: "bPrice", biofuel: "fPrice" } as const;
const altMaintKey = { bev: "bMaintPerKm", biofuel: "fMaintPerKm" } as const;
const altInfraKey = { bev: "bInfraCost", biofuel: "fInfraCost" } as const;
const altInfraVehKey = { bev: "bInfraVehicles", biofuel: "fInfraVehicles" } as const;

const rel = (p: Params, key: keyof Params, x: number): Params => ({ ...p, [key]: p[key] * (1 + x) });

export const SENS_VARS: readonly SensVar[] = [
  { id: "dieselPrice", label: "Diesel price", mode: "relative", appliesTo: ["bev", "biofuel"], adverse: -1, apply: (p, x) => rel(p, "dieselPrice", x), read: (p) => p.dieselPrice, unit: "{cur}/L" },
  { id: "electricityPrice", label: "Electricity tariff", mode: "relative", appliesTo: ["bev"], adverse: 1, apply: (p, x) => rel(p, "electricityPrice", x), read: (p) => p.electricityPrice, unit: "{cur}/kWh" },
  { id: "biofuelPrice", label: "Biofuel price", mode: "relative", appliesTo: ["biofuel"], adverse: 1, apply: (p, x) => rel(p, "biofuelPrice", x), read: (p) => p.biofuelPrice, unit: "{cur}/L" },
  { id: "vehiclePrice", label: "Vehicle acquisition cost (alternative)", mode: "relative", appliesTo: ["bev", "biofuel"], adverse: 1, apply: (p, x, a) => rel(p, altPriceKey[a], x), read: (p, a) => p[altPriceKey[a]], unit: "{cur}" },
  { id: "annualDistance", label: "Annual mileage", mode: "relative", appliesTo: ["bev", "biofuel"], adverse: -1, apply: (p, x) => rel(p, "dailyDistanceKm", x), read: (p) => annualKm(p), unit: "km/year" },
  { id: "maintenance", label: "Maintenance cost (alternative)", mode: "relative", appliesTo: ["bev", "biofuel"], adverse: 1, apply: (p, x, a) => rel(p, altMaintKey[a], x), read: (p, a) => p[altMaintKey[a]], unit: "{cur}/km" },
  { id: "infraCost", label: "Infrastructure cost", mode: "relative", appliesTo: ["bev", "biofuel"], adverse: 1, apply: (p, x, a) => rel(p, altInfraKey[a], x), read: (p, a) => p[altInfraKey[a]], unit: "{cur}" },
  { id: "infraUtilisation", label: "Infrastructure utilisation (vehicles sharing)", mode: "relative", appliesTo: ["bev", "biofuel"], adverse: -1, apply: (p, x, a) => rel(p, altInfraVehKey[a], x), read: (p, a) => p[altInfraVehKey[a]], unit: "vehicles" },
  { id: "interestRate", label: "Loan interest rate", mode: "pp", appliesTo: ["bev", "biofuel"], adverse: 1, apply: (p, x) => ({ ...p, interestRatePct: Math.max(0, p.interestRatePct + x) }), read: (p) => p.interestRatePct, unit: "%" },
  { id: "discountRate", label: "Discount rate", mode: "pp", appliesTo: ["bev", "biofuel"], adverse: 1, apply: (p, x) => ({ ...p, discountRatePct: Math.max(0, p.discountRatePct + x) }), read: (p) => p.discountRatePct, unit: "%" },
];

export const SENS_BY_ID = Object.fromEntries(SENS_VARS.map((v) => [v.id, v])) as Record<string, SensVar>;

/** Variables included in the pass/fail stress test behind the robustness rule. */
export const STRESS_IDS = ["dieselPrice", "electricityPrice", "biofuelPrice", "vehiclePrice", "annualDistance", "maintenance", "infraCost", "infraUtilisation", "interestRate"] as const;

export const stepSize = (p: Params, v: SensVar) => (v.mode === "pp" ? p.stressRatePp : p.stressPct / 100);

export interface TornadoRow {
  id: string;
  label: string;
  mode: SensVar["mode"];
  step: number;
  lowValue: number;
  highValue: number;
  npvLow: number;
  npvHigh: number;
  swing: number;
}

export function tornado(p: Params, alt: Alt): TornadoRow[] {
  const rows: TornadoRow[] = [];
  for (const v of SENS_VARS) {
    if (!v.appliesTo.includes(alt)) continue;
    const s = stepSize(p, v);
    const lo = v.apply(p, -s, alt);
    const hi = v.apply(p, s, alt);
    const npvLow = npvVsDiesel(lo, alt);
    const npvHigh = npvVsDiesel(hi, alt);
    const swing = Math.abs(npvHigh - npvLow);
    if (swing < 1e-6) continue; // variable has no effect under current inputs
    rows.push({ id: v.id, label: v.label, mode: v.mode, step: s, lowValue: v.read(lo, alt), highValue: v.read(hi, alt), npvLow, npvHigh, swing });
  }
  return rows.sort((a, b) => b.swing - a.swing);
}

export interface StressRow { id: string; label: string; npv: number; positive: boolean; changeText: string }

/** One adverse move per relevant driver. Drivers with no effect on this alternative are skipped. */
export function stressTests(p: Params, alt: Alt): StressRow[] {
  const out: StressRow[] = [];
  const baseNpv = npvVsDiesel(p, alt);
  for (const id of STRESS_IDS) {
    const v = SENS_BY_ID[id];
    if (!v.appliesTo.includes(alt)) continue;
    const s = stepSize(p, v) * v.adverse;
    const npv = npvVsDiesel(v.apply(p, s, alt), alt);
    if (Math.abs(npv - baseNpv) < 1e-6) continue;
    const changeText = v.mode === "pp" ? `${s > 0 ? "+" : "-"}${Math.abs(s)} pp` : `${s > 0 ? "+" : "-"}${Math.abs(s * 100).toFixed(0)}%`;
    out.push({ id, label: v.label, npv, positive: npv > 0, changeText });
  }
  return out;
}

export interface BreakEven {
  id: string;
  label: string;
  unit: string;
  current: number;
  breakEven: number | null;
  /** Relative change from the current value needed to reach NPV = 0. */
  changePct: number | null;
  /** Why there is no break-even, if there is none within the search range. */
  reason?: string;
}

/** Value of one relative driver at which NPV versus diesel equals zero (all else unchanged). */
export function breakEven(p: Params, alt: Alt, id: string): BreakEven {
  const v = SENS_BY_ID[id];
  const current = v.read(p, alt);
  const f = (x: number) => npvVsDiesel(v.apply(p, x, alt), alt);
  let lo = -0.99, hi = 20;
  const flo = f(lo), fhi = f(hi);
  const base = { id, label: v.label, unit: v.unit, current };
  if (current === 0) return { ...base, breakEven: null, changePct: null, reason: "Current value is 0, so a relative change is undefined." };
  if (Math.abs(f(0)) < 1e-9) return { ...base, breakEven: current, changePct: 0 };
  if (flo * fhi > 0) return { ...base, breakEven: null, changePct: null, reason: "NPV does not cross zero within -99% to +2000% of the current value." };
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (flo * fm <= 0) hi = mid; else lo = mid;
  }
  const x = (lo + hi) / 2;
  return { ...base, breakEven: v.read(v.apply(p, x, alt), alt), changePct: x * 100 };
}

export interface Grid { xId: string; yId: string; xSteps: number[]; ySteps: number[]; xValues: number[]; yValues: number[]; npv: number[][] }

/** Two-way table of NPV versus diesel. Rows = y, columns = x. Both drivers must be relative. */
export function twoWay(p: Params, alt: Alt, xId: string, yId: string, steps: number[]): Grid {
  const xv = SENS_BY_ID[xId], yv = SENS_BY_ID[yId];
  const npv = steps.map((ys) => steps.map((xs) => npvVsDiesel(yv.apply(xv.apply(p, xs, alt), ys, alt), alt)));
  return {
    xId, yId, xSteps: steps, ySteps: steps,
    xValues: steps.map((s) => xv.read(xv.apply(p, s, alt), alt)),
    yValues: steps.map((s) => yv.read(yv.apply(p, s, alt), alt)),
    npv,
  };
}

export { evaluate };
