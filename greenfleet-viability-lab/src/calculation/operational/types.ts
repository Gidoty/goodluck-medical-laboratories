import type { CalcWarning } from "../types";

/**
 * Operational feasibility: "can this technology plausibly do the transport task the user described,
 * under the operating assumptions they entered?" It says nothing about cost or emissions.
 *
 * Every status comes from explicit rules over the user's own inputs (see bev.ts and biofuel.ts).
 * There is no score and no weighting. Where evidence is missing the result says so.
 */

export type OperationalStatus = "suitable" | "conditional" | "constrained" | "insufficient_data";

export const OPERATIONAL_STATUS_LABEL: Record<OperationalStatus, string> = {
  suitable: "Suitable",
  conditional: "Conditional",
  constrained: "Constrained",
  insufficient_data: "Insufficient data",
};

export const OPERATIONAL_STATUS_MEANING: Record<OperationalStatus, string> = {
  suitable: "No operational constraint is identified from the data entered.",
  conditional: "Operation appears possible but depends on a stated condition.",
  constrained: "At least one entered fact conflicts with the duty cycle.",
  insufficient_data: "The evidence needed to judge this is not available.",
};

/** Result of a single check. "not_assessed" means the optional inputs for it were left blank. */
export type CheckStatus = "satisfied" | "conditional" | "constrained" | "insufficient" | "not_assessed";

export interface CheckValue {
  value: number | string;
  unit: string | null;
}

export interface OperationalCheck {
  id: string;
  label: string;
  status: CheckStatus;
  observed: CheckValue | null;
  reference: CheckValue | null;
  explanation: string;
  conditions: string[];
}

export interface BevRangeMetrics {
  dailyDistanceKm: number;
  usableRangeKm: number;
  /** daily distance / usable range. Informative only: charging during the day can change the answer. */
  dailyRangeRatio: number;
  /** usable range - daily distance. Negative = shortfall. No safety buffer is assumed. */
  rangeMarginKm: number;
  rangeMarginPercent: number;
  routeDistanceKm: number | null;
  routeMarginKm: number | null;
  routeMarginPercent: number | null;
  dailyExceedsRange: boolean;
  routeExceedsRange: boolean | null;
}

export interface ChargingTimeIndicator {
  /** Hours per operating day, exactly as the user entered them. */
  perVehiclePerDayHours: number | null;
  perVehicleAnnualHours: number | null;
  /** Sum over all vehicles. Not lost business hours: vehicles may charge outside productive periods. */
  fleetAnnualHours: number | null;
  label: string;
}

export interface PayloadAssessment {
  baselineCapacityKg: number | null;
  averagePayloadKg: number | null;
  reductionKg: number | null;
  reductionPercent: number | null;
  effectiveCapacityKg: number | null;
  impact: "none" | "reduced" | "unknown" | null;
}

export interface BevOperational {
  technology: "bev";
  status: OperationalStatus;
  statusExplanation: string;
  checks: { range: OperationalCheck; route: OperationalCheck; charging: OperationalCheck; payload: OperationalCheck };
  rangeMetrics: BevRangeMetrics | null;
  chargingTime: ChargingTimeIndicator;
  payload: PayloadAssessment;
  conditions: string[];
  notAssessed: string[];
  /** Plain-language trace of which rule produced the status. */
  ruleTrace: string[];
  warnings: CalcWarning[];
}

export interface BiofuelOperational {
  technology: "biofuel";
  status: OperationalStatus;
  statusExplanation: string;
  checks: { supply: OperationalCheck; infrastructure: OperationalCheck };
  refuelling: {
    /** As entered, per vehicle per operating day. Not annualised: no refuelling frequency is known. */
    additionalDistanceKmPerVehiclePerDay: number | null;
    annualAdditionalDistanceKm: null;
    note: string;
  };
  downtime: {
    hoursPerMonthAsEntered: number | null;
    annualHours: number | null;
    label: string;
  };
  conditions: string[];
  notAssessed: string[];
  ruleTrace: string[];
  warnings: CalcWarning[];
}

export interface DieselOperational {
  technology: "diesel";
  /** The baseline configuration is taken as the existing way of doing the work; no constraint was collected for it. */
  status: "baseline";
  checks: OperationalCheck[];
  warnings: CalcWarning[];
}

export type DataState = "complete" | "partial" | "insufficient";

export interface EvidenceSummary {
  state: DataState;
  provided: number;
  total: number;
  /** Evidence items that were left blank or answered "unknown". */
  missing: string[];
}

export interface OperationalFeasibilityResult {
  diesel: DieselOperational;
  bev: BevOperational;
  biofuel: BiofuelOperational;
  dataCompleteness: { state: DataState; bev: EvidenceSummary; biofuel: EvidenceSummary };
  warnings: CalcWarning[];
  notes: string[];
}
