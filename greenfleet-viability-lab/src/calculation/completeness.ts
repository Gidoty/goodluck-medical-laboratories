import type { EnvironmentalPerformanceResult } from "./environmental/types";
import type { OperationalFeasibilityResult } from "./operational/types";
import type { AssumptionRecord, DataCompletenessSummary } from "./types";

/** Groups that feed the cost figures. Environmental and operational records are judged separately. */
const ECONOMIC_GROUPS: ReadonlyArray<AssumptionRecord["group"]> = ["scope", "operations", "diesel", "bev", "biofuel", "finance", "infrastructure"];
/** Fixed exclusions or informational records that are not gaps in the user's data. */
const NOT_A_GAP = new Set(["financing", "tax", "biofuel_existing_value"]);

/**
 * Economic completeness: "complete" when none of the optional assumptions behind the cost figures
 * (escalation, residual value, charging loss, battery replacement, infrastructure answers, ...) is
 * missing or left out. The numbers exist either way; this says how much of the picture was entered.
 */
export function buildCompleteness(
  economicAssumptions: readonly AssumptionRecord[],
  operational: OperationalFeasibilityResult,
  environmental: EnvironmentalPerformanceResult,
): DataCompletenessSummary {
  const gaps = economicAssumptions.filter((a) => ECONOMIC_GROUPS.includes(a.group) && (a.status === "missing" || a.status === "excluded") && !NOT_A_GAP.has(a.id));
  return {
    economic: { state: gaps.length === 0 ? "complete" : "partial", missing: gaps.map((g) => g.label) },
    operational: operational.dataCompleteness,
    environmental: { state: environmental.dataCompleteness.state, unavailable: environmental.dataCompleteness.unavailable },
  };
}
