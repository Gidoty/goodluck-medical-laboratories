import { OPERATIONAL_STATUS_LABEL } from "./operational/types";
import type { EmissionsComparison } from "./environmental/types";
import type { AssessmentCalculationResult, DimensionSummary, GreenTechId, IncrementalAnalysis } from "./types";
import type { OperationalFeasibilityResult } from "./operational/types";

const ECONOMIC_LABEL = {
  advantage: "Positive incremental NPV",
  indifferent: "Incremental NPV about zero",
  disadvantage: "Negative incremental NPV",
} as const;

const ENV_LABEL = {
  lower: "Lower estimated operational GHG emissions than diesel",
  higher: "Higher estimated operational GHG emissions than diesel",
  unchanged: "No change in estimated operational GHG emissions",
  unavailable: "Environmental comparison unavailable: emission factor required",
} as const;

/**
 * Side-by-side summary of the three dimensions for one alternative. Each field is copied from its
 * own engine; none is derived from another. There is no combined verdict.
 */
export function summarizeDimension(tech: GreenTechId, economic: IncrementalAnalysis, operational: OperationalFeasibilityResult, environmental: EmissionsComparison): DimensionSummary {
  const op = operational[tech];
  const envState = environmental.status === "calculated" ? (environmental.direction as "lower" | "higher" | "unchanged") : "unavailable";
  return {
    technology: tech,
    economic: { direction: economic.npvDirection, npv: economic.npv, label: ECONOMIC_LABEL[economic.npvDirection] },
    operational: { status: op.status, label: OPERATIONAL_STATUS_LABEL[op.status] },
    environmental: { state: envState, percentChange: environmental.percentageChange, label: ENV_LABEL[envState], reason: environmental.unavailableReason },
  };
}

export const summarizeDimensions = (r: Pick<AssessmentCalculationResult, "bevVsDiesel" | "biofuelVsDiesel" | "operational" | "environmental">): Record<GreenTechId, DimensionSummary> => ({
  bev: summarizeDimension("bev", r.bevVsDiesel, r.operational, r.environmental.bevVsDiesel),
  biofuel: summarizeDimension("biofuel", r.biofuelVsDiesel, r.operational, r.environmental.biofuelVsDiesel),
});
