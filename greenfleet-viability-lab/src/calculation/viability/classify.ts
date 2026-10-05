import type { EmissionsComparison } from "../environmental/types";
import type { BevOperational, BiofuelOperational, OperationalCheck } from "../operational/types";
import { TECH_NAMES, type CalcWarning, type DataCompletenessSummary, type GreenTechId, type IncrementalAnalysis, type TechnologyEconomics } from "../types";
import { assessEconomics } from "./economic";
import { COMMERCIAL_VIABILITY_POLICY_V1, type CommercialViabilityPolicy } from "./policy";
import type {
  CommercialClassification,
  CommercialViabilityResult,
  CriticalMissing,
  EconomicAssessment,
  EconomicCase,
  EnvironmentalContext,
  HardOperationalConstraint,
  MaterialUncertainty,
  NextStep,
  ReasonCode,
  RemediableCondition,
  SupportingEvidence,
  TraceStep,
} from "./types";

export interface ClassifyInput {
  technology: GreenTechId;
  economic: { diesel: TechnologyEconomics; green: TechnologyEconomics; incremental: IncrementalAnalysis; warnings: readonly CalcWarning[]; horizonYears: number };
  operational: BevOperational | BiofuelOperational;
  /** Passed for context only. Policy v1.0 never lets it influence the classification. */
  environmental: EmissionsComparison;
  completeness: DataCompletenessSummary;
}

const money = (x: number | null) => (x === null || !Number.isFinite(x) ? "not available" : `${x < 0 ? "-" : ""}{cur}${Math.abs(x).toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
const num = (x: number, d = 1) => x.toLocaleString("en-US", { maximumFractionDigits: d });

const SECTION: Record<GreenTechId, { ops: string; advanced: string; infra: string }> = {
  bev: { ops: "/assessment/electric#section-bev-ops", advanced: "/assessment/electric#section-bev-advanced", infra: "/assessment/finance#section-fin-bev-infra" },
  biofuel: { ops: "/assessment/biofuel#section-bio-supply", advanced: "/assessment/biofuel#section-bio-advanced", infra: "/assessment/finance#section-fin-bio-infra" },
};
const CORE_INPUT: Record<GreenTechId, string> = { bev: "/assessment/electric", biofuel: "/assessment/biofuel#section-bio-supply" };

/** Short phrases used inside sentences. One place, so wording is consistent and testable. */
const SHORT: Partial<Record<ReasonCode, string>> = {
  DAYTIME_CHARGING_REQUIRED: "daytime charging is required",
  DEPOT_RECHARGE_BETWEEN_ROUTES: "vehicles must recharge at the depot between routes",
  ROUTE_EXCEEDS_RANGE: "a single required route exceeds the stated usable range and no charging solution is identified",
  RANGE_EXCEEDED_DEPOT_ONLY: "the daily distance exceeds the stated usable range under depot-only charging and no remedy is identified",
  PAYLOAD_CONSTRAINT: "the average payload exceeds the estimated BEV payload capacity",
  PAYLOAD_IMPACT_UNKNOWN: "the BEV payload impact is not confirmed",
  CHARGING_UNRESOLVED: "the charging arrangements are not settled",
  BIOFUEL_SUPPLY_INTERMITTENT: "biofuel supply is intermittent",
  BIOFUEL_SUPPLY_LIMITED: "biofuel supply is limited",
  BIOFUEL_SUPPLY_CONSTRAINED: "biofuel supply is limited and the infrastructure it needs is not specified",
  INFRASTRUCTURE_UNRESOLVED: "required biofuel infrastructure is not fully specified",
  INFRASTRUCTURE_UNKNOWN: "it is not known whether special biofuel infrastructure is needed",
  BATTERY_REPLACEMENT_UNKNOWN: "the battery replacement requirement is unknown",
};

const STEP_TEXT: Partial<Record<ReasonCode, string>> = {
  DAYTIME_CHARGING_REQUIRED: "Secure reliable daytime charging.",
  DEPOT_RECHARGE_BETWEEN_ROUTES: "Confirm that vehicles can return to the depot and recharge between routes.",
  CHARGING_UNRESOLVED: "Confirm and reconcile the charging arrangements.",
  PAYLOAD_IMPACT_UNKNOWN: "Confirm the payload impact of the battery-electric vehicle.",
  BIOFUEL_SUPPLY_INTERMITTENT: "Improve biofuel supply reliability or arrange a fallback.",
  BIOFUEL_SUPPLY_LIMITED: "Secure enough biofuel to cover the duty cycle.",
  INFRASTRUCTURE_UNRESOLVED: "Complete the required biofuel infrastructure details.",
  INFRASTRUCTURE_UNKNOWN: "Confirm whether special biofuel infrastructure is needed.",
  BATTERY_REPLACEMENT_UNKNOWN: "Confirm the battery replacement requirement and its cost.",
};

const hasWarning = (op: BevOperational | BiofuelOperational, code: string) => op.warnings.some((w) => w.code === code);

function describeEnvironment(tech: GreenTechId, c: EmissionsComparison): EnvironmentalContext {
  const base = { direction: c.direction ?? null, percentChange: c.percentageChange, usedInClassification: false } as const;
  if (c.status !== "calculated") {
    return { ...base, state: "unavailable", text: `Environmental comparison unavailable.${c.unavailableReason ? ` ${c.unavailableReason}` : ""}`.trim() };
  }
  const name = TECH_NAMES[tech];
  if (c.direction === "unchanged") return { ...base, state: "unchanged", text: `Estimated operational GHG emissions for ${name} are equal to diesel within numerical precision, under the supplied factors.` };
  const lower = c.direction === "lower";
  const pct = c.percentageChange === null ? "" : ` ${num(Math.abs(c.percentageChange), 1)}%`;
  const text = c.percentageChange === null
    ? `Estimated operational GHG emissions are ${lower ? "lower" : "higher"} than diesel under the supplied emission factors (percentage not defined).`
    : `Estimated operational GHG emissions are${pct} ${lower ? "lower" : "higher"} than diesel under the supplied emission factors.`;
  return { ...base, state: lower ? "lower" : "higher", text };
}

/**
 * When the evidence gate is not passed, the label is withheld. Whatever economic evidence IS available
 * is still disclosed, in words, so that a negative NPV is not hidden behind "insufficient evidence".
 * It is information only: it is never used to choose the label.
 */
export function availableEconomicEvidenceNote(econCase: EconomicCase): string | null {
  switch (econCase) {
    case "FAVOURABLE": return "Available economic evidence is favourable (incremental NPV versus diesel is positive and above the near-break-even tolerance).";
    case "NEAR_BREAK_EVEN": return "Available economic evidence is close to break-even.";
    case "UNFAVOURABLE": return "Available economic evidence is unfavourable (incremental NPV versus diesel is negative and beyond the near-break-even tolerance).";
    default: return null;
  }
}

function paybackText(status: string | null, years: number | null, horizon: number): string {
  if (status === "immediate") return "Immediate (no extra upfront cost)";
  if (status === "achieved" && years !== null) return `${num(years, 2)} years`;
  return `Not achieved within the ${horizon}-year horizon`;
}

/**
 * Commercial viability classification: a pure, deterministic, hierarchical rule set.
 *
 *   Gate 0  consistency of the economic results (a contradiction is never classified)
 *   Gate 1  evidence sufficiency (economic and operational; environmental is NOT required)
 *   Gate 2  operational feasibility (hard constraints versus remediable conditions)
 *   Gate 3  economic attractiveness (favourable, near break-even, unfavourable)
 *   Gate 4  material conditions and uncertainties
 *
 * Environmental performance is attached afterwards as context. It cannot change the label.
 */
export function classifyCommercialViability(input: ClassifyInput, policy: CommercialViabilityPolicy = COMMERCIAL_VIABILITY_POLICY_V1): CommercialViabilityResult {
  const { technology, economic, operational, environmental, completeness } = input;
  const name = TECH_NAMES[technology];
  const trace: TraceStep[] = [];
  const t = (gate: TraceStep["gate"], text: string) => trace.push({ step: trace.length + 1, gate, text });
  const codes: ReasonCode[] = [];
  const addCode = (c: ReasonCode) => { if (!codes.includes(c)) codes.push(c); };

  /* ---- economics ---- */
  const econ: EconomicAssessment = assessEconomics(economic.diesel, economic.green, economic.incremental, economic.horizonYears, policy);
  const errors = econ.diagnostics.filter((d) => d.severity === "error");
  if (errors.length > 0) t("diagnostics", `Consistency check failed: ${errors.map((e) => e.message).join(" ")}`);
  else t("diagnostics", "The economic results are internally consistent.");
  for (const d of econ.diagnostics.filter((x) => x.severity === "warning")) t("diagnostics", `Diagnostic warning: ${d.message}`);

  /* ---- operational reading ---- */
  const checks: OperationalCheck[] = Object.values(operational.checks);
  const mapping = policy.operationalMapping[operational.status];
  const critical = policy.criticalChecks[technology];
  const criticalMissing: CriticalMissing[] = checks
    .filter((c) => (critical.includes(c.id) && c.status === "insufficient") || (technology === "biofuel" && c.id === "supply" && c.status === "not_assessed"))
    .map((c) => ({ checkId: c.id, text: c.explanation }));

  const hardConstraints: HardOperationalConstraint[] = [];
  const conditions: RemediableCondition[] = [];
  const uncertainties: MaterialUncertainty[] = [];
  const addUncertainty = (code: ReasonCode, text: string) => { if (!uncertainties.some((u) => u.code === code)) uncertainties.push({ code, text }); };

  for (const c of checks) {
    if (c.status === "constrained") {
      const code: ReasonCode = c.id === "range" ? "RANGE_EXCEEDED_DEPOT_ONLY" : c.id === "route" ? "ROUTE_EXCEEDS_RANGE" : c.id === "payload" ? "PAYLOAD_CONSTRAINT" : c.id === "supply" ? "BIOFUEL_SUPPLY_CONSTRAINED" : c.id === "infrastructure" ? "INFRASTRUCTURE_UNRESOLVED" : "CHARGING_UNRESOLVED";
      hardConstraints.push({ code, checkId: c.id, text: c.explanation, identifiedRemedy: null });
    } else if (c.status === "conditional") {
      let code: ReasonCode;
      if (c.id === "range") code = hasWarning(operational, "OP_BEV_ADDITIONAL_CHARGING") ? "DAYTIME_CHARGING_REQUIRED" : "DEPOT_RECHARGE_BETWEEN_ROUTES";
      else if (c.id === "route") code = "DAYTIME_CHARGING_REQUIRED";
      else if (c.id === "supply") code = hasWarning(operational, "OP_BIOFUEL_LIMITED") ? "BIOFUEL_SUPPLY_LIMITED" : "BIOFUEL_SUPPLY_INTERMITTENT";
      else if (c.id === "infrastructure") code = "INFRASTRUCTURE_UNRESOLVED";
      else code = "CHARGING_UNRESOLVED";
      conditions.push({ code, checkId: c.id, text: c.explanation });
    } else if (c.status === "insufficient" && !criticalMissing.some((m) => m.checkId === c.id)) {
      const code: ReasonCode = c.id === "payload" ? "PAYLOAD_IMPACT_UNKNOWN" : c.id === "infrastructure" ? "INFRASTRUCTURE_UNKNOWN" : "CHARGING_UNRESOLVED";
      addUncertainty(code, c.explanation);
    }
  }
  for (const w of economic.warnings) {
    if ((policy.materialEconomicWarnings[technology] as readonly string[]).includes(w.code)) addUncertainty(w.code as ReasonCode, w.message);
  }

  /* ---- Gate 1: evidence ---- */
  const econInsufficient = econ.case === "INSUFFICIENT_DATA";
  const opInsufficient = mapping === "critical_unknown";
  const sufficient = !econInsufficient && !opInsufficient;
  t("evidence", econInsufficient ? "Economic evidence is not sufficient for a defensible comparison." : "Economic evidence is sufficient to compare the alternative with diesel.");
  t("evidence", opInsufficient ? "Operational evidence is not sufficient: a critical item is missing." : "Operational evidence is sufficient to evaluate the duty cycle.");
  t("environment", environmental.status === "calculated" ? "Environmental comparison is available. It is not required for the commercial classification." : "Environmental comparison is unavailable. It is not required for the commercial classification.");

  /* ---- Gate 2/3/4 and the decision ---- */
  let classification: CommercialClassification;
  if (!sufficient) {
    classification = "INSUFFICIENT_EVIDENCE";
    t("operational", `Operational status = ${operational.status === "insufficient_data" ? "Insufficient data" : operational.status}.`);
    const note = availableEconomicEvidenceNote(econ.case);
    if (note) t("economic", `${note} It is shown for information and was not used to classify, because the evidence gate was not passed.`);
  } else {
    t("operational", `Operational status = ${operational.status}.`);
    for (const c of hardConstraints) t("operational", `Hard operational constraint: ${c.text}`);
    for (const c of conditions) t("operational", `Remediable condition: ${c.text}`);
    if (hardConstraints.length === 0) t("operational", "No hard operational constraint identified.");
    t("economic", `Incremental NPV ${econ.npv === null ? "not available" : econ.npv > 0 ? "> 0" : econ.npv < 0 ? "< 0" : "= 0"}. Economic case = ${econ.case}. ${econ.explanation}`);
    if (hardConstraints.length > 0) classification = "NOT_YET_VIABLE";
    else if (econ.case === "UNFAVOURABLE") classification = "NOT_YET_VIABLE";
    else if (econ.case === "NEAR_BREAK_EVEN") classification = "CONDITIONALLY_VIABLE";
    else if (conditions.length > 0 || uncertainties.length > 0) classification = "CONDITIONALLY_VIABLE";
    else classification = "VIABLE";
    if (uncertainties.length > 0) t("conditions", `Material uncertainties: ${uncertainties.map((u) => SHORT[u.code] ?? u.text).join("; ")}.`);
    else t("conditions", "No material uncertainty identified.");
  }

  /* ---- reason codes ---- */
  if (errors.length > 0) addCode("RESULT_INCONSISTENT");
  if (!econInsufficient) {
    addCode(econ.case === "FAVOURABLE" ? "POSITIVE_NPV" : econ.case === "UNFAVOURABLE" ? "NEGATIVE_NPV" : "NEAR_BREAK_EVEN");
    if (econ.immediateAdvantage) addCode("IMMEDIATE_ECONOMIC_ADVANTAGE");
    else addCode(econ.paybackWithinHorizon ? "PAYBACK_WITHIN_HORIZON" : "NO_PAYBACK_WITHIN_HORIZON");
  }
  if (opInsufficient || criticalMissing.length > 0 || (econInsufficient && errors.length === 0)) addCode("CRITICAL_DATA_MISSING");
  if (operational.status === "suitable") addCode("OPERATIONALLY_SUITABLE");
  hardConstraints.forEach((c) => addCode(c.code));
  conditions.forEach((c) => addCode(c.code));
  uncertainties.forEach((u) => addCode(u.code));

  /* ---- environment (context only) ---- */
  const env = describeEnvironment(technology, environmental);
  addCode(env.state === "lower" ? "LOWER_EMISSIONS" : env.state === "higher" ? "HIGHER_EMISSIONS" : env.state === "unchanged" ? "NO_MATERIAL_EMISSIONS_DIFFERENCE" : "EMISSIONS_UNAVAILABLE");
  t("environment", `${env.text} (Context only: it does not change the commercial classification under ${policy.id}.)`);

  /* ---- explanation ---- */
  const npvText = money(econ.npv);
  const shorts = (items: { code: ReasonCode }[]) => items.map((i) => SHORT[i.code]).filter((s): s is string => !!s);
  const join = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  let primaryReason: string;
  switch (classification) {
    case "INSUFFICIENT_EVIDENCE":
      primaryReason = errors.length > 0
        ? `GreenFleet cannot classify ${name}: the economic results are internally inconsistent.`
        : criticalMissing.length > 0
          ? `GreenFleet cannot classify ${name} because ${criticalMissing.map((m) => m.text.charAt(0).toLowerCase() + m.text.slice(1).replace(/\.$/, "")).join("; and ")}.`
          : `GreenFleet cannot classify ${name} because essential information is missing.`;
      break;
    case "NOT_YET_VIABLE": {
      const parts: string[] = [];
      if (hardConstraints.length > 0) parts.push(cap(join(shorts(hardConstraints))));
      if (econ.case === "UNFAVOURABLE") parts.push(`Incremental NPV against diesel is materially negative (${npvText})`);
      primaryReason = `${parts.join(". ")}.`;
      break;
    }
    case "CONDITIONALLY_VIABLE": {
      const dep = [...shorts(conditions), ...shorts(uncertainties)];
      const lead = econ.case === "NEAR_BREAK_EVEN" ? `The economic case is close to break-even (NPV ${npvText}), so the result is sensitive to the assumptions entered` : `Positive economic case (NPV ${npvText})`;
      primaryReason = dep.length > 0 ? `${lead}, and ${join(dep)}.` : `${lead}.`;
      break;
    }
    default:
      primaryReason = `Under the entered assumptions, ${name} establishes a favourable commercial case relative to diesel (NPV ${npvText}) with no identified material operational constraint.`;
  }

  const evidence: SupportingEvidence[] = [];
  if (!econInsufficient) {
    evidence.push({ label: "Incremental NPV versus diesel", value: money(econ.npv) });
    evidence.push({ label: "Present cost difference (diesel minus alternative)", value: money(econ.presentCostDifference) });
    evidence.push({ label: "Total cost of ownership difference (diesel minus alternative)", value: money(econ.tcoDifference) });
    evidence.push({ label: "Additional initial investment", value: money(econ.additionalInitialInvestment) });
    evidence.push({ label: "Simple payback", value: paybackText(econ.simplePaybackStatus, econ.simplePaybackYears, econ.horizonYears) });
    evidence.push({ label: "Discounted payback", value: paybackText(econ.discountedPaybackStatus, econ.discountedPaybackYears, econ.horizonYears) });
    if (econ.denominator && econ.npvMaterialityRatio !== null) evidence.push({ label: `NPV as a share of ${econ.denominator.kind === "incremental_investment" ? "the additional initial investment" : "diesel present cost"} (policy tolerance ±${policy.nearBreakEvenTolerancePct}%)`, value: `${num(econ.npvMaterialityRatio * 100, 1)}%` });
  }
  if (technology === "bev" && "rangeMetrics" in operational && operational.rangeMetrics) {
    evidence.push({ label: "Daily distance", value: `${num(operational.rangeMetrics.dailyDistanceKm, 0)} km` });
    evidence.push({ label: "Usable range", value: `${num(operational.rangeMetrics.usableRangeKm, 0)} km` });
  }
  evidence.push({ label: "Operational status", value: operational.statusExplanation });

  /* ---- next steps ---- */
  const steps: NextStep[] = [];
  if (classification === "INSUFFICIENT_EVIDENCE") {
    steps.push({ code: "CRITICAL_DATA_MISSING", text: "Complete the missing inputs listed above.", target: errors.length > 0 ? null : CORE_INPUT[technology] });
  } else if (classification === "NOT_YET_VIABLE") {
    steps.push({ code: "GENERAL", text: "Explore what could change this result.", target: "/sensitivity" });
  }
  for (const c of [...conditions, ...uncertainties]) {
    const text = STEP_TEXT[c.code];
    if (text && !steps.some((s) => s.code === c.code)) steps.push({ code: c.code, text, target: c.code === "BATTERY_REPLACEMENT_UNKNOWN" ? SECTION[technology].advanced : c.code.startsWith("INFRASTRUCTURE") ? SECTION[technology].infra : SECTION[technology].ops });
  }
  if (env.state === "unavailable") steps.push({ code: "EMISSIONS_UNAVAILABLE", text: "Add emission factors to compare environmental performance. This is optional for the commercial classification.", target: "/assessment/finance#section-fin-env" });

  return {
    technology,
    baselineTechnology: "diesel",
    policyVersion: policy.version,
    policyId: policy.id,
    classification,
    economicCase: econ.case,
    operationalStatus: operational.status,
    economic: econ,
    environmentalContext: env,
    primaryReason,
    reasonCodes: codes,
    supportingEvidence: evidence,
    conditions,
    uncertainties,
    hardConstraints,
    criticalMissing: errors.length > 0 ? [] : criticalMissing,
    recommendedNextSteps: steps,
    evidenceCompleteness: {
      economic: econInsufficient ? "insufficient" : completeness.economic.state,
      operational: technology === "bev" ? completeness.operational.bev.state : completeness.operational.biofuel.state,
      environmental: environmental.status === "calculated" ? "available" : "unavailable",
      environmentalRequiredForClassification: false,
      sufficientForClassification: sufficient,
    },
    decisionTrace: (() => {
      t("classification", `Classification = ${classification.replace(/_/g, " ")}.`);
      return trace;
    })(),
  };
}
