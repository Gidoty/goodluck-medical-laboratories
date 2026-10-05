import type { NormalizedAssessmentInput } from "@/domain/normalized";
import { evaluateInput, type Snapshot } from "../analysis/evaluate";
import { formatValue } from "../analysis/format";
import { VARIABLES, applyOverrides, type VariableId } from "../analysis/variables";
import type { ThresholdResult } from "../threshold/types";
import type { GreenTechId } from "../types";
import { COMMERCIAL_VIABILITY_POLICY_V1 } from "../viability";

/** A UI and performance limit so a comparison stays readable. It is not a scientific rule. */
export const MAX_SCENARIOS = 12;

export type ScenarioOrigin = "user" | "illustrative" | "threshold";
export type Overrides = Partial<Record<VariableId, number | string>>;

/** A named set of changes to the Base Case. The Base Case itself is never stored or copied here. */
export interface Scenario {
  id: string;
  name: string;
  description: string;
  origin: ScenarioOrigin;
  overrides: Overrides;
  createdAt: string;
  updatedAt: string;
}

export interface ChangedAssumption {
  variableId: VariableId;
  label: string;
  from: number | string | null;
  to: number | string;
  /** Display text with the {cur} token. */
  fromText: string;
  toText: string;
}

export interface ScenarioTechResult {
  snapshot: Snapshot;
  /** Differences from the Base Case, scenario minus base. */
  deltaNpv: number;
  deltaTco: number;
  deltaPresentCost: number;
  deltaTcoPerKm: number;
  classificationChanged: boolean;
  operationalChanged: boolean;
}

export interface ScenarioResult {
  /** null for the Base Case. */
  scenario: Scenario | null;
  name: string;
  status: "ok" | "invalid" | "calculation_failed";
  errors: string[];
  changes: ChangedAssumption[];
  bev: ScenarioTechResult | null;
  biofuel: ScenarioTechResult | null;
}

export interface ScenarioComparison {
  base: ScenarioResult;
  scenarios: ScenarioResult[];
  /** How many scenarios were left out because of MAX_SCENARIOS. */
  truncated: number;
  maxScenarios: number;
  policyVersion: string;
  note: string;
}

function valueText(id: VariableId, v: number | string | null): string {
  if (v === null || v === undefined) return "Not entered";
  const def = VARIABLES[id];
  if (typeof v === "string") return def.options?.find((o) => o.id === v)?.label ?? v;
  return formatValue(def.unit, v);
}

export function describeChanges(input: NormalizedAssessmentInput, overrides: Overrides): ChangedAssumption[] {
  const out: ChangedAssumption[] = [];
  for (const [id, to] of Object.entries(overrides) as [VariableId, number | string][]) {
    const def = VARIABLES[id];
    if (!def) continue;
    const from = def.get(input);
    out.push({ variableId: id, label: def.label, from, to, fromText: valueText(id, from), toText: valueText(id, to) });
  }
  return out;
}

const techResult = (s: Snapshot, b: Snapshot): ScenarioTechResult => ({
  snapshot: s, deltaNpv: s.npv - b.npv, deltaTco: s.tco - b.tco, deltaPresentCost: s.presentCost - b.presentCost, deltaTcoPerKm: s.tcoPerKm - b.tcoPerKm,
  classificationChanged: s.classification !== b.classification, operationalChanged: s.operationalStatus !== b.operationalStatus,
});

/** Runs the Base Case and each scenario through the authoritative engine. The Base Case is never changed. */
export function compareScenarios(input: NormalizedAssessmentInput, scenarios: readonly Scenario[]): ScenarioComparison | { status: "error"; message: string } {
  const baseEval = evaluateInput(input);
  if (!baseEval.ok) return { status: "error", message: `The Base Case cannot be calculated: ${baseEval.errors.map((e) => e.message).join(" ")}` };
  const base: ScenarioResult = { scenario: null, name: "Base Case", status: "ok", errors: [], changes: [], bev: techResult(baseEval.bev, baseEval.bev), biofuel: techResult(baseEval.biofuel, baseEval.biofuel) };
  const used = scenarios.slice(0, MAX_SCENARIOS);
  const results = used.map((sc): ScenarioResult => {
    const applied = applyOverrides(input, sc.overrides);
    if (!applied.ok) return { scenario: sc, name: sc.name, status: "invalid", errors: applied.errors.map((e) => e.message), changes: describeChanges(input, sc.overrides), bev: null, biofuel: null };
    const e = evaluateInput(applied.input);
    if (!e.ok) return { scenario: sc, name: sc.name, status: "calculation_failed", errors: e.errors.map((x) => x.message), changes: describeChanges(input, sc.overrides), bev: null, biofuel: null };
    return { scenario: sc, name: sc.name, status: "ok", errors: [], changes: describeChanges(input, sc.overrides), bev: techResult(e.bev, baseEval.bev), biofuel: techResult(e.biofuel, baseEval.biofuel) };
  });
  return {
    base, scenarios: results, truncated: Math.max(0, scenarios.length - MAX_SCENARIOS), maxScenarios: MAX_SCENARIOS, policyVersion: COMMERCIAL_VIABILITY_POLICY_V1.version,
    note: "The scenario with the lowest cost is not automatically the best: check the operational status and the commercial classification before comparing cost.",
  };
}

/* ------------------------------ pure scenario list operations ------------------------------ */

export type ScenarioCheck = { ok: true } | { ok: false; message: string };

export function validateScenario(input: NormalizedAssessmentInput, sc: Pick<Scenario, "name" | "overrides">): ScenarioCheck {
  if (sc.name.trim().length === 0) return { ok: false, message: "Give the scenario a name." };
  if (Object.keys(sc.overrides).length === 0) return { ok: false, message: "Change at least one assumption." };
  const a = applyOverrides(input, sc.overrides);
  return a.ok ? { ok: true } : { ok: false, message: a.errors.map((e) => e.message).join(" ") };
}

export type ListResult = { ok: true; scenarios: Scenario[]; scenario?: Scenario } | { ok: false; message: string };

export function addScenario(list: readonly Scenario[], draft: { name: string; description?: string; origin?: ScenarioOrigin; overrides: Overrides }, id: string, now: string): ListResult {
  if (list.length >= MAX_SCENARIOS) return { ok: false, message: `You can keep up to ${MAX_SCENARIOS} scenarios. Delete one to add another. This limit keeps the comparison readable.` };
  const name = draft.name.trim();
  if (!name) return { ok: false, message: "Give the scenario a name." };
  const scenario: Scenario = { id, name, description: draft.description?.trim() ?? "", origin: draft.origin ?? "user", overrides: { ...draft.overrides }, createdAt: now, updatedAt: now };
  return { ok: true, scenarios: [...list, scenario], scenario };
}
export function renameScenario(list: readonly Scenario[], id: string, name: string, now: string): ListResult {
  if (!name.trim()) return { ok: false, message: "Give the scenario a name." };
  if (!list.some((s) => s.id === id)) return { ok: false, message: "That scenario no longer exists." };
  return { ok: true, scenarios: list.map((s) => (s.id === id ? { ...s, name: name.trim(), updatedAt: now } : s)) };
}
export function updateScenario(list: readonly Scenario[], id: string, patch: { description?: string; overrides?: Overrides }, now: string): ListResult {
  if (!list.some((s) => s.id === id)) return { ok: false, message: "That scenario no longer exists." };
  return { ok: true, scenarios: list.map((s) => (s.id === id ? { ...s, ...(patch.description !== undefined ? { description: patch.description } : {}), ...(patch.overrides ? { overrides: { ...patch.overrides } } : {}), updatedAt: now } : s)) };
}
export function duplicateScenario(list: readonly Scenario[], id: string, newId: string, now: string): ListResult {
  const src = list.find((s) => s.id === id);
  if (!src) return { ok: false, message: "That scenario no longer exists." };
  return addScenario(list, { name: `${src.name} (copy)`, description: src.description, origin: src.origin, overrides: src.overrides }, newId, now);
}
export function deleteScenario(list: readonly Scenario[], id: string): ListResult {
  if (!list.some((s) => s.id === id)) return { ok: false, message: "That scenario no longer exists." };
  return { ok: true, scenarios: list.filter((s) => s.id !== id) };
}

/** A scenario that holds only the solved value. The Base Case is not touched. */
export function scenarioDraftFromThreshold(t: ThresholdResult, techName: string): { name: string; description: string; origin: "threshold"; overrides: Overrides } | null {
  if (t.thresholdValue === null) return null;
  const kind = t.target === "economic_break_even" ? "Economic Break-Even" : "Classification Change";
  return {
    name: `${techName} ${kind}: ${t.variableLabel}`,
    description: `Created from a solved threshold: ${t.statement.replace(/\{cur\}/g, "")}`,
    origin: "threshold",
    overrides: { [t.variableId]: t.thresholdValue },
  };
}

export { applyOverrides } from "../analysis/variables";
export type { GreenTechId };
