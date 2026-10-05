import type { NormalizedAssessmentInput } from "@/domain/normalized";
import { evaluateInput } from "../analysis/evaluate";
import { formatValue } from "../analysis/format";
import { THRESHOLD_VARIABLES, VARIABLES } from "../analysis/variables";
import { COMMERCIAL_VIABILITY_POLICY_V1 } from "../viability";
import type { GreenTechId } from "../types";
import type { CommercialClassification, ReasonCode } from "../viability/types";
import { solveViabilityThreshold } from "./solve";
import type { ThresholdResult } from "./types";
import { deriveOperationalRemedies, type OperationalRemedy } from "./remedies";

export interface Barrier {
  code: ReasonCode;
  text: string;
}

export type AnalysisMode = "make_viable" | "make_fully_viable" | "viability_margin" | "blocked" | "unavailable";

export interface ViabilityAnalysis {
  technology: GreenTechId;
  classification: CommercialClassification | null;
  mode: AnalysisMode;
  /** The panel heading, which depends on the current classification. */
  heading: string;
  /** The label of the call to action on the Results page. */
  ctaLabel: string;
  barriers: { economic: Barrier[]; operational: Barrier[]; evidence: Barrier[] };
  /** Economic break-even (NOT YET VIABLE) or deterioration headroom (VIABLE), one per variable. */
  economicThresholds: ThresholdResult[];
  /** Nearest change of classification (VIABLE headroom, or CONDITIONALLY VIABLE to VIABLE). */
  classificationThresholds: ThresholdResult[];
  remedies: OperationalRemedy[];
  /** Exact inputs to complete, when the analysis is blocked. */
  missingInputs: string[];
  /** Set when more than one kind of barrier exists, so money alone cannot be said to solve it. */
  multipleBarrierNote: string | null;
  notes: string[];
  disclaimer: string;
  policyVersion: string;
}

export const THRESHOLD_DISCLAIMER = "Thresholds are model-derived values based on the entered assumptions. They are not forecasts or guaranteed market outcomes. Every threshold holds all else equal.";

const CTA: Record<CommercialClassification, string> = {
  NOT_YET_VIABLE: "Explore What Would Make It Viable",
  CONDITIONALLY_VIABLE: "See What Would Make It Fully Viable",
  VIABLE: "View Viability Margin",
  INSUFFICIENT_EVIDENCE: "Complete Missing Inputs",
};

export const ctaLabelFor = (c: CommercialClassification) => CTA[c];

/**
 * "What would make it viable?" for one alternative. It reads the Policy v1.0 result for the barriers
 * (never the label alone) and calls the threshold solver for the numbers. It changes nothing.
 */
export function analyzeViability(input: NormalizedAssessmentInput, technology: GreenTechId): ViabilityAnalysis {
  const empty = (): ViabilityAnalysis["barriers"] => ({ economic: [], operational: [], evidence: [] });
  const common = { technology, economicThresholds: [] as ThresholdResult[], classificationThresholds: [] as ThresholdResult[], remedies: [] as OperationalRemedy[], missingInputs: [] as string[], multipleBarrierNote: null as string | null, notes: [] as string[], disclaimer: THRESHOLD_DISCLAIMER, policyVersion: COMMERCIAL_VIABILITY_POLICY_V1.version };

  const e = evaluateInput(input);
  if (!e.ok) {
    return { ...common, classification: null, mode: "unavailable", heading: "WHAT WOULD MAKE IT VIABLE?", ctaLabel: "Complete Missing Inputs", barriers: empty(), missingInputs: e.errors.map((x) => x.message), notes: ["Complete these inputs before threshold analysis can be performed."] };
  }
  const snap = e[technology];
  const c = snap.commercial;
  const barriers = empty();

  // barriers come from the actual reason codes, not from the label
  if (c.economicCase === "UNFAVOURABLE") barriers.economic.push({ code: "NEGATIVE_NPV", text: "Incremental NPV against diesel is materially negative." });
  if (c.economicCase === "NEAR_BREAK_EVEN") barriers.economic.push({ code: "NEAR_BREAK_EVEN", text: "The economic case is close to break-even, so the result is sensitive to the assumptions entered." });
  if (c.economicCase !== "INSUFFICIENT_DATA" && c.economicCase !== "FAVOURABLE" && c.reasonCodes.includes("NO_PAYBACK_WITHIN_HORIZON")) barriers.economic.push({ code: "NO_PAYBACK_WITHIN_HORIZON", text: "The additional investment is not recovered within the analysis horizon." });
  for (const h of c.hardConstraints) barriers.operational.push({ code: h.code, text: h.text });
  for (const k of c.conditions) barriers.operational.push({ code: k.code, text: k.text });
  for (const u of c.uncertainties) barriers.evidence.push({ code: u.code, text: u.text });
  for (const m of c.criticalMissing) barriers.evidence.push({ code: "CRITICAL_DATA_MISSING", text: m.text });

  const kinds = [barriers.economic.length > 0, barriers.operational.length > 0, barriers.evidence.length > 0].filter(Boolean).length;
  const multipleBarrierNote = kinds > 1 ? "More than one kind of barrier is present, so a change in money alone would not be enough. Each kind is shown separately below." : null;

  if (c.classification === "INSUFFICIENT_EVIDENCE") {
    return {
      ...common, classification: c.classification, mode: "blocked", heading: "WHAT WOULD MAKE IT VIABLE?", ctaLabel: CTA.INSUFFICIENT_EVIDENCE, barriers,
      missingInputs: c.criticalMissing.length > 0 ? c.criticalMissing.map((m) => m.text) : [c.primaryReason],
      notes: ["Complete these inputs before threshold analysis can be performed."],
    };
  }

  const remedies = deriveOperationalRemedies(input, snap);
  const vars = THRESHOLD_VARIABLES[technology].filter((id) => VARIABLES[id].applicable(input).ok);
  const solve = (variableId: (typeof vars)[number], target: "economic_break_even" | "classification_transition") => solveViabilityThreshold({ input, technology, variableId, target });

  if (c.classification === "NOT_YET_VIABLE") {
    const economicThresholds = c.economicCase === "UNFAVOURABLE" || c.economicCase === "NEAR_BREAK_EVEN" ? vars.map((v) => solve(v, "economic_break_even")) : [];
    const notes: string[] = [];
    if (economicThresholds.length === 0) notes.push("The economic case is already favourable, so no financial threshold is needed. The barrier is operational.");
    if (c.hardConstraints.length > 0) notes.push("Reaching economic break-even does not resolve the operational constraint. Both have to be addressed.");
    return { ...common, classification: c.classification, mode: "make_viable", heading: "WHAT WOULD MAKE IT VIABLE?", ctaLabel: CTA.NOT_YET_VIABLE, barriers, economicThresholds, remedies, multipleBarrierNote, notes };
  }

  if (c.classification === "CONDITIONALLY_VIABLE") {
    const classificationThresholds = c.economicCase === "NEAR_BREAK_EVEN" ? vars.map((v) => solve(v, "classification_transition")) : [];
    const notes: string[] = [];
    if (c.economicCase === "FAVOURABLE") notes.push("The economics are already favourable, so no financial threshold is invented. What stands between this result and Viable is the conditions and uncertainties listed.");
    return { ...common, classification: c.classification, mode: "make_fully_viable", heading: "WHAT WOULD MAKE IT FULLY VIABLE?", ctaLabel: CTA.CONDITIONALLY_VIABLE, barriers, classificationThresholds, remedies, multipleBarrierNote, notes };
  }

  // VIABLE: a margin, not a search for viability
  const economicThresholds = vars.map((v) => solve(v, "economic_break_even"));
  const classificationThresholds = vars.map((v) => solve(v, "classification_transition"));
  return {
    ...common, classification: c.classification, mode: "viability_margin", heading: "VIABILITY MARGIN", ctaLabel: CTA.VIABLE, barriers, economicThresholds, classificationThresholds, remedies,
    notes: ["Each margin moves one assumption and holds all others equal. Margins for different assumptions are not additive."],
  };
}

export const money = (unit: Parameters<typeof formatValue>[0], v: number) => formatValue(unit, v, true);
