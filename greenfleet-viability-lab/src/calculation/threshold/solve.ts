import type { NormalizedAssessmentInput } from "@/domain/normalized";
import { evaluateInput, CLASSIFICATION_RANK, type Snapshot } from "../analysis/evaluate";
import { CLASS_WORDS, formatValue } from "../analysis/format";
import { THRESHOLD_VARIABLES, VARIABLES, type VariableDef, type VariableId } from "../analysis/variables";
import { COMMERCIAL_VIABILITY_POLICY_V1 } from "../viability";
import type { GreenTechId } from "../types";
import type { CommercialViabilityResult, ReasonCode } from "../viability/types";
import { findRoot } from "./solver";
import {
  SOLVER_SETTINGS,
  type Blockers,
  type Outcome,
  type RequiredChange,
  type SolverReport,
  type SolverSettings,
  type ThresholdKind,
  type ThresholdResult,
  type ThresholdStatus,
  type ThresholdTarget,
  type TransitionInfo,
} from "./types";


export interface ThresholdRequest {
  input: NormalizedAssessmentInput;
  technology: GreenTechId;
  variableId: VariableId;
  target: ThresholdTarget;
  settings?: SolverSettings;
}

const OPERATIONAL_SOLVABLE: readonly VariableId[] = ["bevRange", "bevPayloadReduction"];

export function blockersOf(c: CommercialViabilityResult): Blockers {
  return {
    hardConstraints: c.hardConstraints.map((h) => ({ code: h.code, text: h.text })),
    conditions: c.conditions.map((h) => ({ code: h.code, text: h.text })),
    uncertainties: c.uncertainties.map((h) => ({ code: h.code, text: h.text })),
  };
}
const noBlockers: Blockers = { hardConstraints: [], conditions: [], uncertainties: [] };

export function outcomeOf(s: Snapshot): Outcome {
  return { npv: s.npv, classification: s.classification, economicCase: s.economicCase, operationalStatus: s.operationalStatus, reasonCodes: s.reasonCodes, decisionTrace: s.commercial.decisionTrace.map((t) => `[${t.gate}] ${t.text}`) };
}

const change = (from: number, to: number): RequiredChange => ({ absolute: to - from, percent: from === 0 ? null : ((to - from) / Math.abs(from)) * 100, direction: to > from ? "increase" : to < from ? "decrease" : "none" });
const pctText = (p: number | null) => (p === null ? "" : ` (${p > 0 ? "+" : ""}${p.toFixed(1)}%)`);
const disp = (def: VariableDef, v: number) => formatValue(def.unit, v, true);
const lowerName = (def: VariableDef) => (/^[A-Z]{2}/.test(def.label) ? def.label : def.label.charAt(0).toLowerCase() + def.label.slice(1));

function base(req: ThresholdRequest, def: VariableDef): ThresholdResult {
  return {
    status: "NOT_APPLICABLE", target: req.target, thresholdKind: null, technology: req.technology, variableId: def.id, variableLabel: def.label, unit: def.unit,
    currentValue: null, thresholdValue: null, thresholdDisplay: null, currentDisplay: null, requiredChange: null, before: null, after: null, transition: null,
    blockers: noBlockers, statement: "", caveats: [], solver: null, allElseEqual: true, policyVersion: COMMERCIAL_VIABILITY_POLICY_V1.version,
  };
}
const fail = (r: ThresholdResult, status: ThresholdStatus, statement: string, solver: SolverReport | null = null, extra: Partial<ThresholdResult> = {}): ThresholdResult => ({ ...r, status, statement, solver, thresholdValue: null, thresholdDisplay: null, requiredChange: null, thresholdKind: null, ...extra });

const OPERATIONAL_SENTENCE = "This would achieve economic break-even. The operational constraint would still need to be resolved before commercial viability can improve.";
function constraintList(b: Blockers): string {
  const t = b.hardConstraints.map((h) => h.text.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase()));
  return t.length === 1 ? `the operational constraint (${t[0]}) remains` : `${t.length} operational constraints remain`;
}

/** Why a classification changed between two evaluations. Read from the Policy v1.0 results; nothing is inferred. */
export function describeTransition(before: Snapshot, after: Snapshot): TransitionInfo {
  const ec = before.economicCase !== after.economicCase;
  const op = before.operationalStatus !== after.operationalStatus;
  const added = after.reasonCodes.filter((c) => !before.reasonCodes.includes(c));
  const removed = before.reasonCodes.filter((c) => !after.reasonCodes.includes(c));
  const gate: TransitionInfo["changedGate"] = ec && op ? "both" : ec ? "economic" : op ? "operational" : "conditions";
  const why = gate === "economic" ? `the economic case moved from ${before.economicCase.replace(/_/g, " ").toLowerCase()} to ${after.economicCase.replace(/_/g, " ").toLowerCase()}` : gate === "operational" ? `the operational status moved from ${before.operationalStatus.replace(/_/g, " ")} to ${after.operationalStatus.replace(/_/g, " ")}` : gate === "both" ? "both the economic case and the operational status moved" : "the conditions or uncertainties carried by the result changed";
  return {
    from: before.classification, to: after.classification, changedGate: gate,
    economicCase: { from: before.economicCase, to: after.economicCase },
    operationalStatus: { from: before.operationalStatus, to: after.operationalStatus },
    reasonCodesAdded: added as ReasonCode[], reasonCodesRemoved: removed as ReasonCode[],
    explanation: `The classification changes from ${CLASS_WORDS[before.classification]} to ${CLASS_WORDS[after.classification]} because ${why}.`,
  };
}

/**
 * Inverse analysis for one variable of one alternative, with everything else held equal.
 *
 *  economic_break_even: the value at which the incremental NPV against diesel is approximately zero,
 *    found by calling the authoritative engine repeatedly (bracket, monotonic check, bisection).
 *  classification_transition: the nearest value at which Policy v1.0 changes the commercial label,
 *    found by scanning and then bisecting on the label.
 *
 * A failure state never carries a number. The input is never changed.
 */
export function solveViabilityThreshold(req: ThresholdRequest): ThresholdResult {
  const settings = req.settings ?? SOLVER_SETTINGS;
  const def = VARIABLES[req.variableId];
  const r0 = base(req, def);
  const tech = req.technology;

  // applicability
  const solvable = (THRESHOLD_VARIABLES[tech] as readonly VariableId[]).includes(def.id) || (req.target === "classification_transition" && OPERATIONAL_SOLVABLE.includes(def.id));
  if (def.kind !== "numeric" || !def.affects.includes(tech) || !solvable) {
    const why = def.kind !== "numeric" ? `${def.label} is a category, not a number, so there is no numerical threshold. It is treated as an operational remedy.` : !def.affects.includes(tech) ? `${def.label} does not apply to this alternative.` : `${def.label} is not solved as a threshold. ${def.note ?? ""}`.trim();
    return fail(r0, "NOT_APPLICABLE", why);
  }
  const app = def.applicable(req.input);
  if (!app.ok) return fail(r0, "NOT_APPLICABLE", `${def.label} cannot be solved: ${app.reason}`);
  const x0 = def.get(req.input);
  if (typeof x0 !== "number") return fail(r0, "NOT_APPLICABLE", `${def.label} has no numeric value in this assessment.`);

  // evidence gate: nothing speculative is solved
  const baseEval = evaluateInput(req.input);
  if (!baseEval.ok) return fail({ ...r0, currentValue: x0 }, "INSUFFICIENT_DATA", `Complete these inputs before threshold analysis can be performed: ${baseEval.errors.map((e) => e.message).join(" ")}`);
  const bs = baseEval[tech];
  if (bs.classification === "INSUFFICIENT_EVIDENCE") {
    const missing = bs.commercial.criticalMissing.map((m) => m.text).join(" ");
    return fail({ ...r0, currentValue: x0, before: outcomeOf(bs) }, "INSUFFICIENT_DATA", `Complete these inputs before threshold analysis can be performed. ${missing || bs.commercial.primaryReason}`);
  }
  const blockers = blockersOf(bs.commercial);
  const head: ThresholdResult = { ...r0, currentValue: x0, currentDisplay: formatValue(def.unit, x0), before: outcomeOf(bs), blockers };

  return req.target === "economic_break_even" ? solveEconomic(req, def, head, bs, x0, settings) : solveTransition(req, def, head, bs, x0, settings);
}

const npvAt = (req: ThresholdRequest, def: VariableDef) => (x: number): number | null => {
  if (def.invalid(req.input, x)) return null;
  const e = evaluateInput(def.set(req.input, x));
  return e.ok ? e[req.technology].npv : null;
};
const snapAt = (req: ThresholdRequest, def: VariableDef, x: number): Snapshot | null => {
  if (def.invalid(req.input, x)) return null;
  const e = evaluateInput(def.set(req.input, x));
  return e.ok ? e[req.technology] : null;
};

function solveEconomic(req: ThresholdRequest, def: VariableDef, head: ThresholdResult, bs: Snapshot, x0: number, settings: SolverSettings): ThresholdResult {
  const scale = Math.max(1, Math.abs(bs.dieselPresentCost));
  const valueTol = settings.valueToleranceFraction * scale;
  const verifyTol = settings.verifyToleranceFraction * scale;
  const { lo, hi } = def.solverBounds(req.input);
  const f = npvAt(req, def);
  const f0 = bs.npv;

  if (Math.abs(f0) <= valueTol) {
    return { ...head, status: "ALREADY_SATISFIED", thresholdKind: "at_threshold", thresholdValue: x0, thresholdDisplay: disp(def, x0), requiredChange: change(x0, x0), after: head.before, statement: `Incremental NPV is already approximately zero at the current ${lowerName(def)}, all else equal.`, caveats: [] };
  }

  // direction in which NPV rises with x, measured by the engine
  const probe = x0 + Math.max(Math.abs(x0) * 0.01, (hi - lo) * 1e-6, 1e-6) * (x0 + 1e-9 >= hi ? -1 : 1);
  const fp = f(Math.min(hi, Math.max(lo, probe)));
  if (fp === null) return fail(head, "NON_MONOTONIC", "No reliable single threshold was found within the tested range.");
  const slope = (fp - f0) / (probe - x0);
  if (Math.abs(fp - f0) <= valueTol) return fail(head, "NOT_APPLICABLE", `Changing ${lowerName(def)} does not change the incremental NPV, so there is no economic threshold for it.`);
  const s: 1 | -1 = slope > 0 ? 1 : -1;
  const needsImprovement = f0 < 0;
  const dir: 1 | -1 = needsImprovement ? s : ((-s) as 1 | -1);

  const out = findRoot(f, x0, f0, dir, lo, hi, valueTol, settings);
  const solver = out.report;
  if (out.status === "non_monotonic") return fail(head, "NON_MONOTONIC", "No reliable single threshold was found within the tested range.", solver);
  if (out.status === "max_iterations") return fail(head, "MAX_ITERATIONS", "The solver reached its iteration limit before settling on a threshold, so none is reported.", solver);
  if (out.status === "evaluation_failed") return fail(head, "NOT_BRACKETED", "The engine could not evaluate part of the search range, so no threshold is reported.", solver);
  if (out.status === "not_bracketed") {
    const range = `${disp(def, lo)} to ${disp(def, hi)}`;
    return needsImprovement
      ? fail(head, "NOT_BRACKETED", `No economic threshold was found within the solver bounds (${range}) for ${lowerName(def)}, all else equal.`, solver)
      : { ...head, status: "ALREADY_SATISFIED", thresholdKind: "headroom", statement: `Incremental NPV stays positive across the whole solver range (${range}) for ${lowerName(def)}, all else equal, so no deterioration point was found.`, solver };
  }

  if (out.status !== "found") return fail(head, "NOT_BRACKETED", "No threshold was found.", solver);
  const root = out.root;
  const after = snapAt(req, def, root);
  if (!after || Math.abs(after.npv) > verifyTol) return fail(head, "VERIFICATION_FAILED", "The solved value did not reproduce a zero NPV when the engine was re-run, so it is not reported.", solver);
  const rc = change(x0, root);
  const word = rc.direction === "increase" ? "rise" : "fall";
  const kind: ThresholdKind = needsImprovement ? "required" : "headroom";
  let statement: string;
  if (needsImprovement) {
    statement = `${def.label} would need to ${word} to approximately ${disp(def, root)}${pctText(rc.percent)} for incremental NPV to reach zero, all else equal.`;
  } else {
    statement = `${def.label} could ${rc.direction === "increase" ? "increase" : "decrease"} to approximately ${disp(def, root)}${pctText(rc.percent)} before incremental NPV reaches zero, all else equal. This is a margin, not a forecast.`;
  }
  const caveats: string[] = [];
  if (needsImprovement && head.blockers.hardConstraints.length > 0) {
    statement += ` Economic break-even alone does not make this configuration commercially viable because ${constraintList(head.blockers)}. ${OPERATIONAL_SENTENCE}`;
    caveats.push(OPERATIONAL_SENTENCE);
  } else if (needsImprovement && (head.blockers.conditions.length > 0 || head.blockers.uncertainties.length > 0)) {
    caveats.push("Open conditions or uncertainties would still need to be resolved before the result could become fully viable.");
  }
  return {
    ...head, status: needsImprovement ? "FOUND" : "ALREADY_SATISFIED", thresholdKind: kind, thresholdValue: root, thresholdDisplay: disp(def, root), requiredChange: rc,
    after: outcomeOf(after), transition: after.classification !== bs.classification ? describeTransition(bs, after) : null, statement, caveats, solver,
  };
}

function solveTransition(req: ThresholdRequest, def: VariableDef, head: ThresholdResult, bs: Snapshot, x0: number, settings: SolverSettings): ThresholdResult {
  const { lo, hi } = def.solverBounds(req.input);
  const baseRank = CLASSIFICATION_RANK[bs.classification];
  const viable = bs.classification === "VIABLE";
  let improving: 1 | -1;
  if (def.group === "operational") improving = def.higherIs === "worse" ? -1 : 1;
  else {
    const f = npvAt(req, def);
    const probe = x0 + Math.max(Math.abs(x0) * 0.01, (hi - lo) * 1e-6, 1e-6) * (x0 + 1e-9 >= hi ? -1 : 1);
    const fp = f(Math.min(hi, Math.max(lo, probe)));
    if (fp === null || Math.abs(fp - bs.npv) <= 0) return fail(head, "NOT_APPLICABLE", `Changing ${lowerName(def)} does not change the economics, so it cannot move the classification.`);
    improving = (fp - bs.npv) / (probe - x0) > 0 ? 1 : -1;
  }
  const dir: 1 | -1 = viable ? ((-improving) as 1 | -1) : improving;
  const extent = dir > 0 ? hi - x0 : x0 - lo;
  const solver = (over: Partial<SolverReport> = {}): SolverReport => ({ method: "scan_and_bisection", iterations: 0, evaluations: 0, expansions: 0, bounds: { lo, hi }, bracket: null, monotonic: null, settings, ...over });
  if (extent <= 0) return fail(head, "NOT_BRACKETED", `${def.label} is already at the edge of the solver bounds in the direction that could change the classification.`, solver());

  const changed = (s: Snapshot) => (viable ? CLASSIFICATION_RANK[s.classification] < baseRank : CLASSIFICATION_RANK[s.classification] > baseRank);
  const N = settings.scanPoints;
  let evaluations = 0;
  let prevX = x0;
  let hitX: number | null = null;
  let revert = false;
  for (let k = 1; k <= N; k++) {
    const x = x0 + (dir * extent * k) / N;
    evaluations++;
    const s = snapAt(req, def, x);
    if (!s) continue;
    if (hitX === null) {
      if (changed(s)) hitX = x;
      else prevX = x;
    } else if (!changed(s)) revert = true;
  }
  if (hitX === null) {
    let status: ThresholdStatus = "NOT_BRACKETED";
    let statement = `No change of classification was found within the solver bounds for ${lowerName(def)}, all else equal.`;
    if (viable) {
      status = "ALREADY_SATISFIED";
      statement = `The classification stays Viable across the whole solver range for ${lowerName(def)}, all else equal, so no deterioration point was found.`;
    } else if (def.group === "economic" && head.blockers.hardConstraints.length > 0) {
      status = "BLOCKED_BY_OPERATIONAL_CONSTRAINT";
      statement = `Changing ${lowerName(def)} alone cannot improve the classification because ${constraintList(head.blockers)}, all else equal. ${OPERATIONAL_SENTENCE}`;
    } else if (def.group === "economic" && bs.classification === "CONDITIONALLY_VIABLE" && (head.blockers.conditions.length > 0 || head.blockers.uncertainties.length > 0)) {
      status = "BLOCKED_BY_OPEN_CONDITIONS";
      statement = `Changing ${lowerName(def)} alone cannot make the result fully viable because conditions or uncertainties remain open, all else equal.`;
    }
    return fail(head, status, statement, solver({ evaluations }));
  }
  // bisect between prevX (not changed) and hitX (changed)
  let a = prevX;
  let b = hitX;
  let iterations = 0;
  while (iterations < settings.maxIterations && Math.abs(b - a) > settings.rootToleranceRelative * Math.max(1, Math.abs(b))) {
    const m = (a + b) / 2;
    evaluations++;
    iterations++;
    const s = snapAt(req, def, m);
    if (s && changed(s)) b = m; else a = m;
  }
  const afterSnap = snapAt(req, def, b);
  if (!afterSnap || !changed(afterSnap)) return fail(head, "VERIFICATION_FAILED", "The classification change could not be reproduced when the engine was re-run, so no threshold is reported.", solver({ evaluations, iterations }));
  const tr = describeTransition(bs, afterSnap);
  const rc = change(x0, b);
  const verb = viable ? (rc.direction === "increase" ? "rises" : "falls") : rc.direction === "increase" ? "rises" : "falls";
  const statement = `${viable ? "The classification changes" : "The nearest classification change is reached"} when ${lowerName(def)} ${verb} to approximately ${disp(def, b)}${pctText(rc.percent)}, all else equal: ${tr.explanation}`;
  const caveats: string[] = [];
  if (afterSnap.classification !== "VIABLE" && !viable) caveats.push(`The result becomes ${CLASS_WORDS[afterSnap.classification]}, not Viable. ${afterSnap.commercial.conditions.length + afterSnap.commercial.uncertainties.length > 0 ? "Conditions or uncertainties remain." : ""}`.trim());
  if (revert) caveats.push("The classification is not monotonic across the scanned range: it returns to the starting label further along. This is the nearest change only.");
  return {
    ...head, status: "FOUND", thresholdKind: viable ? "headroom" : "required", thresholdValue: b, thresholdDisplay: disp(def, b), requiredChange: rc,
    after: outcomeOf(afterSnap), transition: tr, statement, caveats, solver: solver({ evaluations, iterations, bracket: [Math.min(a, b), Math.max(a, b)], monotonic: !revert }),
    blockers: { ...head.blockers },
  };
}
