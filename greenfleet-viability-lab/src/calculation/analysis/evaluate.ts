import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { OperationalStatus } from "../operational/types";
import { calculateAssessment } from "../engine";
import type { AssessmentCalculationResult, CalculationError, GreenTechId, PaybackResult } from "../types";
import type { CommercialClassification, CommercialViabilityResult, EconomicCase, ReasonCode } from "../viability/types";

/** The numbers every Batch 6 table needs for one alternative, all copied from the authoritative result. */
export interface Snapshot {
  technology: GreenTechId;
  npv: number;
  presentCostDifference: number;
  presentCost: number;
  dieselPresentCost: number;
  tco: number;
  tcoPerKm: number;
  dieselTco: number;
  simplePayback: PaybackResult;
  discountedPayback: PaybackResult;
  economicCase: EconomicCase;
  operationalStatus: OperationalStatus;
  classification: CommercialClassification;
  reasonCodes: ReasonCode[];
  environmental: { state: "lower" | "higher" | "unchanged" | "unavailable"; percentChange: number | null };
  commercial: CommercialViabilityResult;
}

export type Evaluation = { ok: true; result: AssessmentCalculationResult; bev: Snapshot; biofuel: Snapshot } | { ok: false; errors: CalculationError[] };

export function snapshotOf(r: AssessmentCalculationResult, tech: GreenTechId): Snapshot {
  const inc = tech === "bev" ? r.bevVsDiesel : r.biofuelVsDiesel;
  const t = r[tech];
  const c = r.commercial[tech];
  return {
    technology: tech,
    npv: inc.npv,
    presentCostDifference: r.diesel.presentCost - t.presentCost,
    presentCost: t.presentCost,
    dieselPresentCost: r.diesel.presentCost,
    tco: t.undiscountedTco,
    tcoPerKm: t.tcoPerKm,
    dieselTco: r.diesel.undiscountedTco,
    simplePayback: inc.simplePayback,
    discountedPayback: inc.discountedPayback,
    economicCase: c.economicCase,
    operationalStatus: c.operationalStatus,
    classification: c.classification,
    reasonCodes: c.reasonCodes,
    environmental: { state: r.dimensions[tech].environmental.state, percentChange: r.dimensions[tech].environmental.percentChange },
    commercial: c,
  };
}

/** The single doorway to the authoritative pipeline. Every Batch 6 number comes through here. */
export function evaluateInput(input: NormalizedAssessmentInput): Evaluation {
  const out = calculateAssessment(input);
  if (!out.ok) return { ok: false, errors: out.errors };
  return { ok: true, result: out.result, bev: snapshotOf(out.result, "bev"), biofuel: snapshotOf(out.result, "biofuel") };
}

export const CLASSIFICATION_RANK: Record<CommercialClassification, number> = { INSUFFICIENT_EVIDENCE: 0, NOT_YET_VIABLE: 1, CONDITIONALLY_VIABLE: 2, VIABLE: 3 };
