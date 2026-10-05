import type { NormalizedAssessmentInput } from "@/domain/normalized";
import { evaluateBev } from "./bev";
import { evaluateBiofuel } from "./biofuel";
import { check } from "./status";
import type { BevOperational, DataState, DieselOperational, EvidenceSummary, OperationalFeasibilityResult } from "./types";

export * from "./types";
export { evaluateBev } from "./bev";
export { evaluateBiofuel } from "./biofuel";

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const answered = (x: string | null | undefined) => x !== null && x !== undefined && x !== "unknown";

function summarize(items: Array<[string, boolean]>): EvidenceSummary {
  const provided = items.filter(([, ok]) => ok).length;
  const state: DataState = provided === items.length ? "complete" : provided === 0 ? "insufficient" : "partial";
  return { state, provided, total: items.length, missing: items.filter(([, ok]) => !ok).map(([label]) => label) };
}

/**
 * Operational evidence per technology. The denominator is the explicit list below, so the state is
 * never an arbitrary percentage. An item counts as provided when it was answered and not "unknown".
 */
function bevEvidence(input: NormalizedAssessmentInput, bev: BevOperational): EvidenceSummary {
  const op = input.bev?.operational;
  const items: Array<[string, boolean]> = [
    ["Charging opportunity during the day", answered(op?.chargingOpportunity)],
    ["Charging arrangement", answered(input.infrastructure?.bevCharging?.arrangement)],
    ["Average route distance", isNum(input.operations?.averageRouteDistanceKm)],
    ["Charging time per day", isNum(op?.chargingDowntimeHoursPerDay)],
    ["Payload impact", answered(op?.payloadImpact)],
  ];
  if (op?.payloadImpact === "reduced") {
    items.push(["Payload capacity", bev.payload.baselineCapacityKg !== null], ["Average payload", bev.payload.averagePayloadKg !== null]);
  }
  return summarize(items);
}

function biofuelEvidence(input: NormalizedAssessmentInput): EvidenceSummary {
  const s = input.biofuel?.supply;
  return summarize([
    ["Fuel availability", answered(s?.availability)],
    ["Special storage or infrastructure requirement", answered(s?.specialInfrastructure)],
    ["Additional refuelling distance", isNum(s?.additionalRefuellingKmPerDay)],
    ["Fuel-related downtime", isNum(s?.downtimeHoursPerMonth)],
  ]);
}

/**
 * Operational feasibility of each technology for the duty cycle the user described.
 * Rule-based and transparent: every status carries the check results and the rule that produced it.
 * Independent of cost and emissions, and it never changes a financial figure.
 */
export function evaluateOperationalFeasibility(input: NormalizedAssessmentInput): OperationalFeasibilityResult {
  const bev = evaluateBev(input);
  const biofuel = evaluateBiofuel(input);
  const diesel: DieselOperational = {
    technology: "diesel",
    status: "baseline",
    checks: [check("baseline", "Baseline configuration", "satisfied", "Diesel is the baseline: it is taken as the existing way of doing the work described. No diesel range or supply limit was collected, so none is assumed.")],
    warnings: [],
  };

  const b = bevEvidence(input, bev);
  const f = biofuelEvidence(input);
  const state: DataState = b.state === "complete" && f.state === "complete" ? "complete" : b.state === "insufficient" && f.state === "insufficient" ? "insufficient" : "partial";

  return {
    diesel,
    bev,
    biofuel,
    dataCompleteness: { state, bev: b, biofuel: f },
    warnings: [...bev.warnings, ...biofuel.warnings],
    notes: [
      "Operational feasibility asks whether a technology can plausibly do the transport work you described. It does not describe cost or emissions, and it does not change either.",
      "Each status comes from explicit rules applied to your inputs, shown with the check results. No score or weighting is used.",
      "No safety margin on range is assumed. The range margin is reported exactly as the difference between your usable range and your distance.",
      "Charging time and fuel-related downtime are shown as you entered them. They are not converted into lost revenue.",
    ],
  };
}
