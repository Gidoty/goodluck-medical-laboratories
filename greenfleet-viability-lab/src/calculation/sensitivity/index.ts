import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { OperationalStatus } from "../operational/types";
import { evaluateInput, type Snapshot } from "../analysis/evaluate";
import { CLASS_WORDS, formatValue } from "../analysis/format";
import { VARIABLES, numericVariablesFor, type ValueUnit, type VariableId } from "../analysis/variables";
import { solveViabilityThreshold } from "../threshold/solve";
import type { PaybackResult, GreenTechId } from "../types";
import { COMMERCIAL_VIABILITY_POLICY_V1 } from "../viability";
import type { CommercialClassification, EconomicCase, ReasonCode } from "../viability/types";

/** A range of values for one assumption. */
export interface SensitivityRange {
  /** percent: min and max are percentage changes from the base value. absolute: they are values in the variable's own unit. */
  mode: "percent" | "absolute";
  min: number;
  max: number;
  steps: number;
}

/** Prototype default. A convention for exploring, not an academically justified universal range. */
export const DEFAULT_SENSITIVITY_RANGE: SensitivityRange = { mode: "percent", min: -20, max: 20, steps: 5 };
export const PROTOTYPE_RANGE_LABEL = "Prototype sensitivity range: -20%, -10%, base, +10%, +20%. Not an academically justified universal range.";
/** Practical limits so a browser never runs thousands of full calculations. */
export const SENSITIVITY_LIMITS = { minSteps: 3, maxSteps: 41, maxGridSide: 11, defaultGridSide: 5 } as const;

export type SensitivityError =
  | { status: "error"; code: "not_applicable" | "not_numeric" | "bad_range" | "range_invalid" | "calculation_failed" | "unknown_pair"; message: string }
  | { status: "unavailable"; code: "zero_base_percent"; message: string };

export interface SensitivityPoint {
  value: number;
  /** The percentage change from the base, when the base is not zero. */
  percentChange: number | null;
  isBase: boolean;
  npv: number;
  presentCostDifference: number;
  tco: number;
  tcoPerKm: number;
  simplePayback: PaybackResult;
  discountedPayback: PaybackResult;
  economicCase: EconomicCase;
  operationalStatus: OperationalStatus;
  classification: CommercialClassification;
  environmental: { state: "lower" | "higher" | "unchanged" | "unavailable"; percentChange: number | null };
}

export interface ClassificationTransitionMarker {
  fromIndex: number;
  toIndex: number;
  fromValue: number;
  toValue: number;
  from: CommercialClassification;
  to: CommercialClassification;
  reasonCodesAdded: ReasonCode[];
  reasonCodesRemoved: ReasonCode[];
  explanation: string;
}

export interface SensitivityResult {
  status: "ok";
  technology: GreenTechId;
  variableId: VariableId;
  variableLabel: string;
  unit: ValueUnit;
  baseValue: number;
  base: Snapshot;
  range: SensitivityRange;
  points: SensitivityPoint[];
  npvMin: number;
  npvMax: number;
  /** Where the incremental NPV crosses zero inside the tested values, solved by the threshold solver. Null if it does not. */
  breakEven: { value: number; statement: string } | null;
  transitions: ClassificationTransitionMarker[];
  interpretation: string[];
  transparency: { policyVersion: string; heldEqual: string; rangeLabel: string; baseValue: number; testedMin: number; testedMax: number };
}

function toPoint(s: Snapshot, value: number, base: number, isBase: boolean): SensitivityPoint {
  return {
    value, percentChange: base === 0 ? null : ((value - base) / Math.abs(base)) * 100, isBase, npv: s.npv, presentCostDifference: s.presentCostDifference, tco: s.tco, tcoPerKm: s.tcoPerKm,
    simplePayback: s.simplePayback, discountedPayback: s.discountedPayback, economicCase: s.economicCase, operationalStatus: s.operationalStatus, classification: s.classification, environmental: s.environmental,
  };
}

/** The values to test. The base value is always included and marked. */
export function sensitivityValues(base: number, range: SensitivityRange): number[] {
  const n = range.steps;
  const raw = Array.from({ length: n }, (_, i) => {
    const t = range.min + ((range.max - range.min) * i) / (n - 1);
    return range.mode === "percent" ? base * (1 + t / 100) : t;
  });
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  const vals = raw.map((v) => (near(v, base) ? base : v));
  if (!vals.includes(base) && base >= Math.min(...vals) && base <= Math.max(...vals)) vals.push(base);
  return vals.sort((a, b) => a - b);
}

function checkRange(range: SensitivityRange): SensitivityError | null {
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || !Number.isInteger(range.steps)) return { status: "error", code: "bad_range", message: "The range needs a minimum, a maximum and a whole number of steps." };
  if (range.steps < SENSITIVITY_LIMITS.minSteps || range.steps > SENSITIVITY_LIMITS.maxSteps) return { status: "error", code: "bad_range", message: `Use between ${SENSITIVITY_LIMITS.minSteps} and ${SENSITIVITY_LIMITS.maxSteps} steps.` };
  if (range.min >= range.max) return { status: "error", code: "bad_range", message: "The minimum must be below the maximum." };
  return null;
}

export interface SensitivityRequest {
  input: NormalizedAssessmentInput;
  technology: GreenTechId;
  variableId: VariableId;
  range?: SensitivityRange;
}

/**
 * One-way sensitivity: only the chosen assumption changes, everything else stays at the Base Case,
 * and every point is the full authoritative calculation. The input is never changed.
 */
export function runSensitivityAnalysis(req: SensitivityRequest): SensitivityResult | SensitivityError {
  const range = req.range ?? DEFAULT_SENSITIVITY_RANGE;
  const def = VARIABLES[req.variableId];
  if (def.kind !== "numeric") return { status: "error", code: "not_numeric", message: `${def.label} is a category, not a number, so it is compared in scenarios and not varied continuously.` };
  if (!def.affects.includes(req.technology)) return { status: "error", code: "not_applicable", message: `${def.label} does not apply to this alternative.` };
  const app = def.applicable(req.input);
  if (!app.ok) return { status: "error", code: "not_applicable", message: `${def.label}: ${app.reason}` };
  const bad = checkRange(range);
  if (bad) return bad;
  const baseValue = def.get(req.input);
  if (typeof baseValue !== "number") return { status: "error", code: "not_applicable", message: `${def.label} has no numeric value in this assessment.` };
  if (range.mode === "percent" && baseValue === 0) return { status: "unavailable", code: "zero_base_percent", message: "Percentage sensitivity is unavailable because the base value is zero. Use an absolute range instead." };

  const baseEval = evaluateInput(req.input);
  if (!baseEval.ok) return { status: "error", code: "calculation_failed", message: `The Base Case cannot be calculated: ${baseEval.errors.map((e) => e.message).join(" ")}` };
  const base = baseEval[req.technology];

  const values = sensitivityValues(baseValue, range);
  const invalid = values.map((v) => def.invalid(req.input, v)).filter((m): m is string => m !== null);
  if (invalid.length > 0) return { status: "error", code: "range_invalid", message: `The range includes values the model cannot use. ${[...new Set(invalid)].join(" ")}` };

  const points: SensitivityPoint[] = [];
  const snaps: Snapshot[] = [];
  for (const v of values) {
    const isBase = v === baseValue;
    const e = isBase ? baseEval : evaluateInput(def.set(req.input, v));
    if (!e.ok) return { status: "error", code: "calculation_failed", message: `The calculation failed at ${formatValue(def.unit, v)}: ${e.errors.map((x) => x.message).join(" ")}` };
    snaps.push(e[req.technology]);
    points.push(toPoint(e[req.technology], v, baseValue, isBase));
  }

  const npvs = points.map((p) => p.npv);
  const npvMin = Math.min(...npvs);
  const npvMax = Math.max(...npvs);
  const transitions: ClassificationTransitionMarker[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = snaps[i - 1]!;
    const b = snaps[i]!;
    if (a.classification !== b.classification) {
      const added = b.reasonCodes.filter((c) => !a.reasonCodes.includes(c));
      const removed = a.reasonCodes.filter((c) => !b.reasonCodes.includes(c));
      transitions.push({
        fromIndex: i - 1, toIndex: i, fromValue: points[i - 1]!.value, toValue: points[i]!.value, from: a.classification, to: b.classification, reasonCodesAdded: added, reasonCodesRemoved: removed,
        explanation: `Between the tested values, the classification changes from ${CLASS_WORDS[a.classification]} to ${CLASS_WORDS[b.classification]}. The classification is rule-based, so the exact change point is a boundary of the rules, not a continuous curve.`,
      });
    }
  }

  // connect forward sensitivity with the inverse solver
  let breakEven: SensitivityResult["breakEven"] = null;
  const crosses = npvs.some((x, i) => i > 0 && Math.sign(x) !== Math.sign(npvs[i - 1]!) && Math.sign(x) !== 0 && Math.sign(npvs[i - 1]!) !== 0) || npvs.some((x) => x === 0);
  const lo = values[0]!;
  const hi = values[values.length - 1]!;
  if (crosses && (["bevAcquisition", "electricityTariff", "dieselPrice", "annualDistance", "bevSubsidy", "bevInfraCapex", "bevMaintenance", "biofuelAcquisition", "biofuelPrice", "biofuelSubsidy", "biofuelInfraCapex", "biofuelMaintenance"] as VariableId[]).includes(req.variableId)) {
    const t = solveViabilityThreshold({ input: req.input, technology: req.technology, variableId: req.variableId, target: "economic_break_even" });
    if (t.thresholdValue !== null && t.thresholdValue >= lo && t.thresholdValue <= hi) breakEven = { value: t.thresholdValue, statement: t.statement };
  }

  // deterministic sentences, in conditional language
  const name = def.label;
  const interp: string[] = [];
  interp.push(`Across the tested ${name.toLowerCase().startsWith("bev") || name.toLowerCase().startsWith("co") ? name : name.charAt(0).toLowerCase() + name.slice(1)} range (${formatValue(def.unit, lo)} to ${formatValue(def.unit, hi)}), ${req.technology === "bev" ? "BEV" : "biofuel"} incremental NPV varies from ${formatValue("money", npvMin)} to ${formatValue("money", npvMax)}, under the tested assumptions.`);
  const spreadFlat = npvMax - npvMin <= 1e-9 * Math.max(1, Math.abs(base.dieselPresentCost));
  if (spreadFlat) interp.push(`${name} does not change the incremental NPV. It can still change operational status, which is shown in the table.`);
  if (transitions.length > 0) {
    for (const t of transitions) interp.push(`Commercial classification changes from ${CLASS_WORDS[t.from]} to ${CLASS_WORDS[t.to]} between ${formatValue(def.unit, t.fromValue)} and ${formatValue(def.unit, t.toValue)}, under the tested assumptions.`);
  } else {
    interp.push(`Commercial classification stays ${CLASS_WORDS[base.classification]} across the tested range, under the tested assumptions.`);
  }
  if (breakEven) interp.push(`Incremental NPV reaches approximately zero at ${formatValue(def.unit, breakEven.value, true)}, all else equal.`);
  else if (Math.min(...npvs) > 0) interp.push("Incremental NPV stays positive across the tested range.");
  else if (Math.max(...npvs) < 0) interp.push("Incremental NPV stays negative across the tested range.");

  return {
    status: "ok", technology: req.technology, variableId: req.variableId, variableLabel: def.label, unit: def.unit, baseValue, base, range, points, npvMin, npvMax, breakEven, transitions, interpretation: interp,
    transparency: { policyVersion: COMMERCIAL_VIABILITY_POLICY_V1.version, heldEqual: "Every other assumption equals the Base Case.", rangeLabel: range.mode === "percent" && range.min === DEFAULT_SENSITIVITY_RANGE.min && range.max === DEFAULT_SENSITIVITY_RANGE.max && range.steps === DEFAULT_SENSITIVITY_RANGE.steps ? PROTOTYPE_RANGE_LABEL : "Custom range set by the user.", baseValue, testedMin: lo, testedMax: hi },
  };
}

/* -------------------------------- drivers (tornado) -------------------------------- */

export interface DriverRow {
  variableId: VariableId;
  label: string;
  unit: ValueUnit;
  baseValue: number;
  lowValue: number;
  highValue: number;
  /** The tested values were pulled back to a model limit (for example 100% for a rate). */
  clamped: boolean;
  npvBase: number;
  npvLow: number;
  npvHigh: number;
  /** max(NPV_high, NPV_low) - min(NPV_high, NPV_low) */
  spread: number;
  classificationLow: CommercialClassification;
  classificationBase: CommercialClassification;
  classificationHigh: CommercialClassification;
}

export interface DriverAnalysis {
  status: "ok";
  technology: GreenTechId;
  range: SensitivityRange;
  rows: DriverRow[];
  skipped: { variableId: VariableId; label: string; reason: string }[];
  statement: string;
  label: "Sensitivity influence under the tested ranges.";
  note: string;
}

export function runDriverAnalysis(req: { input: NormalizedAssessmentInput; technology: GreenTechId; range?: SensitivityRange; variableIds?: VariableId[] }): DriverAnalysis | SensitivityError {
  const range = req.range ?? DEFAULT_SENSITIVITY_RANGE;
  if (range.mode !== "percent") return { status: "error", code: "bad_range", message: "Driver ranking uses a percentage range so that variables are comparable." };
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min >= range.max) return { status: "error", code: "bad_range", message: "The minimum must be below the maximum." };
  const baseEval = evaluateInput(req.input);
  if (!baseEval.ok) return { status: "error", code: "calculation_failed", message: `The Base Case cannot be calculated: ${baseEval.errors.map((e) => e.message).join(" ")}` };
  const base = baseEval[req.technology];
  const eligible = numericVariablesFor(req.input, req.technology).filter((v) => v.group === "economic" && (!req.variableIds || req.variableIds.includes(v.id)));
  const rows: DriverRow[] = [];
  const skipped: DriverAnalysis["skipped"] = [];
  for (const v of eligible) {
    const b = v.get(req.input);
    if (typeof b !== "number") continue;
    if (b === 0) { skipped.push({ variableId: v.id, label: v.label, reason: "Percentage sensitivity is unavailable because the base value is zero." }); continue; }
    const bounds = v.solverBounds(req.input);
    const clampTo = (x: number) => Math.min(bounds.hi, Math.max(v.id === "annualDistance" ? 1e-9 : bounds.lo, x));
    let low = b * (1 + range.min / 100);
    let high = b * (1 + range.max / 100);
    const lowC = clampTo(low);
    const highC = clampTo(high);
    const clamped = lowC !== low || highC !== high;
    low = lowC; high = highC;
    if (v.invalid(req.input, low) || v.invalid(req.input, high)) { skipped.push({ variableId: v.id, label: v.label, reason: "The tested values are outside what the model accepts." }); continue; }
    const el = evaluateInput(v.set(req.input, low));
    const eh = evaluateInput(v.set(req.input, high));
    if (!el.ok || !eh.ok) { skipped.push({ variableId: v.id, label: v.label, reason: "The calculation could not be completed at a tested value." }); continue; }
    const sl = el[req.technology];
    const sh = eh[req.technology];
    rows.push({
      variableId: v.id, label: v.label, unit: v.unit, baseValue: b, lowValue: low, highValue: high, clamped, npvBase: base.npv, npvLow: sl.npv, npvHigh: sh.npv,
      spread: Math.max(sl.npv, sh.npv) - Math.min(sl.npv, sh.npv), classificationLow: sl.classification, classificationBase: base.classification, classificationHigh: sh.classification,
    });
  }
  rows.sort((a, b) => b.spread - a.spread || a.label.localeCompare(b.label));
  const top = rows[0];
  return {
    status: "ok", technology: req.technology, range, rows, skipped, label: "Sensitivity influence under the tested ranges.",
    statement: top && top.spread > 0 ? `${top.label} has the largest NPV influence among the variables tested, under the tested ranges (a spread of ${formatValue("money", top.spread, true)}).` : "No tested variable changes the incremental NPV under the tested ranges.",
    note: "The ranking depends on the ranges tested. It shows how strongly the result responds to each assumption, not which assumption causes the result.",
  };
}

/* -------------------------------- two-way -------------------------------- */

/** Limited, high-value pairs only. There is no free-form combinatorial search. */
export const TWO_WAY_PAIRS: Record<GreenTechId, readonly (readonly [VariableId, VariableId])[]> = {
  bev: [["bevAcquisition", "electricityTariff"], ["bevAcquisition", "annualDistance"], ["dieselPrice", "electricityTariff"]],
  biofuel: [["biofuelPrice", "annualDistance"], ["dieselPrice", "biofuelPrice"]],
};

export interface TwoWayCell {
  xIndex: number;
  yIndex: number;
  npv: number;
  economicCase: EconomicCase;
  operationalStatus: OperationalStatus;
  classification: CommercialClassification;
}

export interface TwoWayResult {
  status: "ok";
  technology: GreenTechId;
  x: { variableId: VariableId; label: string; unit: ValueUnit; values: number[]; baseValue: number };
  y: { variableId: VariableId; label: string; unit: ValueUnit; values: number[]; baseValue: number };
  cells: TwoWayCell[];
  /** For each x value, the y value at which the incremental NPV is approximately zero. */
  frontier: { xValue: number; yValue: number | null }[];
  frontierLabel: "Economic break-even frontier";
  frontierNote: string;
}

export function runTwoWaySensitivity(req: { input: NormalizedAssessmentInput; technology: GreenTechId; xId: VariableId; yId: VariableId; xRange?: SensitivityRange; yRange?: SensitivityRange; withFrontier?: boolean }): TwoWayResult | SensitivityError {
  const ok = TWO_WAY_PAIRS[req.technology].some(([a, b]) => a === req.xId && b === req.yId);
  if (!ok) return { status: "error", code: "unknown_pair", message: "This pair of assumptions is not offered for two-way sensitivity." };
  const xr = req.xRange ?? { ...DEFAULT_SENSITIVITY_RANGE, steps: SENSITIVITY_LIMITS.defaultGridSide };
  const yr = req.yRange ?? { ...DEFAULT_SENSITIVITY_RANGE, steps: SENSITIVITY_LIMITS.defaultGridSide };
  for (const r of [xr, yr]) {
    const bad = checkRange(r);
    if (bad) return bad;
    if (r.steps > SENSITIVITY_LIMITS.maxGridSide) return { status: "error", code: "bad_range", message: `A two-way grid is limited to ${SENSITIVITY_LIMITS.maxGridSide} values on each side.` };
  }
  const xd = VARIABLES[req.xId];
  const yd = VARIABLES[req.yId];
  for (const d of [xd, yd]) {
    const app = d.applicable(req.input);
    if (!app.ok) return { status: "error", code: "not_applicable", message: `${d.label}: ${app.reason}` };
  }
  const xb = xd.get(req.input);
  const yb = yd.get(req.input);
  if (typeof xb !== "number" || typeof yb !== "number") return { status: "error", code: "not_applicable", message: "Both assumptions need numeric values." };
  if ((xr.mode === "percent" && xb === 0) || (yr.mode === "percent" && yb === 0)) return { status: "unavailable", code: "zero_base_percent", message: "Percentage sensitivity is unavailable because a base value is zero. Use an absolute range instead." };
  const xs = sensitivityValues(xb, xr);
  const ys = sensitivityValues(yb, yr);
  const bad = [...xs.map((v) => xd.invalid(req.input, v)), ...ys.map((v) => yd.invalid(req.input, v))].filter((m): m is string => m !== null);
  if (bad.length > 0) return { status: "error", code: "range_invalid", message: `The range includes values the model cannot use. ${[...new Set(bad)].join(" ")}` };
  const cells: TwoWayCell[] = [];
  for (let yi = 0; yi < ys.length; yi++) {
    for (let xi = 0; xi < xs.length; xi++) {
      const e = evaluateInput(yd.set(xd.set(req.input, xs[xi]!), ys[yi]!));
      if (!e.ok) return { status: "error", code: "calculation_failed", message: "The calculation failed at one grid point." };
      const s = e[req.technology];
      cells.push({ xIndex: xi, yIndex: yi, npv: s.npv, economicCase: s.economicCase, operationalStatus: s.operationalStatus, classification: s.classification });
    }
  }
  const frontier: TwoWayResult["frontier"] = [];
  if (req.withFrontier !== false) {
    for (const xv of xs) {
      const shifted = xd.set(req.input, xv);
      const t = solveViabilityThreshold({ input: shifted, technology: req.technology, variableId: req.yId, target: "economic_break_even" });
      frontier.push({ xValue: xv, yValue: t.thresholdValue });
    }
  }
  return {
    status: "ok", technology: req.technology,
    x: { variableId: req.xId, label: xd.label, unit: xd.unit, values: xs, baseValue: xb }, y: { variableId: req.yId, label: yd.label, unit: yd.unit, values: ys, baseValue: yb },
    cells, frontier, frontierLabel: "Economic break-even frontier",
    frontierNote: "Combinations on one side of the frontier have a positive incremental NPV. That is an economic result only. A combination is not commercially viable unless the operational gates are also satisfied, which the classification column shows.",
  };
}
