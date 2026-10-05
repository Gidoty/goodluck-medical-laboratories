import type { AssessmentCalculationResult, GreenTechId } from "@/calculation/types";
import { COMMERCIAL_VIABILITY_POLICY_V1 } from "@/calculation/viability";
import type { EvidenceQuality, ReportOptions, ScenarioSection, SensitivitySection, ThresholdSection } from "./types";

const GREEN: readonly GreenTechId[] = ["bev", "biofuel"];

/** Applicable limitations, assembled from the state of this assessment. Nothing unrelated is added. */
export function buildLimitations(args: {
  result: AssessmentCalculationResult;
  evidence: EvidenceQuality;
  options: ReportOptions;
  sensitivity: SensitivitySection;
  scenarios: ScenarioSection;
  thresholds: ThresholdSection;
  dataOrigin: "blank" | "demo" | "user";
}): string[] {
  const { result, evidence, sensitivity, scenarios, thresholds } = args;
  const out: string[] = [];
  out.push("Results depend on the assumptions entered. They are only as reliable as those inputs.");
  if (args.dataOrigin === "demo" || evidence.provenance.illustrative > 0) out.push("Some inputs are illustrative placeholders. They show how the tool works and are not market data.");
  out.push("GreenFleet does not check prices or rates against live market data.");
  out.push("The economics are a cost comparison of the asset, independent of financing. Tax, revenue and general inflation are not modelled.");
  out.push("Emissions are estimated operational energy and fuel-related emissions from the factors supplied. They are not a full lifecycle assessment, and vehicle, battery and infrastructure manufacturing are not included.");
  if (GREEN.some((t) => result.commercial[t].environmentalContext.state === "unavailable")) out.push("Environmental comparison is unavailable for at least one alternative because no compatible emission factor was supplied. Unavailable is not zero.");
  out.push(`Commercial classification follows ${COMMERCIAL_VIABILITY_POLICY_V1.id}, a set of prototype decision rules and not a universal investment rule. The near-break-even tolerance (${COMMERCIAL_VIABILITY_POLICY_V1.nearBreakEvenTolerancePct}%) is a model-policy assumption.`);
  if (GREEN.some((t) => result.commercial[t].uncertainties.some((u) => u.code === "BATTERY_REPLACEMENT_UNKNOWN"))) out.push("An unknown battery replacement requirement is not included in the cost estimate and is carried as an uncertainty.");
  out.push("Evidence states describe how complete the inputs are. GreenFleet calculates no statistical confidence interval for the classification.");
  if (thresholds.state === "included" || sensitivity.state === "included") out.push("Threshold and sensitivity results change one assumption at a time and hold all others equal. They are model estimates, not forecasts, and are valid only for the ranges tested.");
  if (scenarios.state === "included") out.push("Scenarios are sets of assumptions created by the user. None is a market forecast.");
  out.push("Nothing here is a guarantee of financial return.");
  return out;
}
