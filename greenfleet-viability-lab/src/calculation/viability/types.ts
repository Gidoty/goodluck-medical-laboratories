import type { EmissionDirection } from "../environmental/types";
import type { OperationalStatus } from "../operational/types";
import type { EconomicDataState, GreenTechId, PaybackStatus } from "../types";

export type CommercialClassification = "VIABLE" | "CONDITIONALLY_VIABLE" | "NOT_YET_VIABLE" | "INSUFFICIENT_EVIDENCE";

export const CLASSIFICATION_LABEL: Record<CommercialClassification, string> = {
  VIABLE: "VIABLE",
  CONDITIONALLY_VIABLE: "CONDITIONALLY VIABLE",
  NOT_YET_VIABLE: "NOT YET VIABLE",
  INSUFFICIENT_EVIDENCE: "INSUFFICIENT EVIDENCE",
};

/** Internal analytical state. Not itself a user-facing verdict. */
export type EconomicCase = "FAVOURABLE" | "NEAR_BREAK_EVEN" | "UNFAVOURABLE" | "INSUFFICIENT_DATA";

export type ReasonCode =
  | "POSITIVE_NPV"
  | "NEGATIVE_NPV"
  | "NEAR_BREAK_EVEN"
  | "PAYBACK_WITHIN_HORIZON"
  | "NO_PAYBACK_WITHIN_HORIZON"
  | "IMMEDIATE_ECONOMIC_ADVANTAGE"
  | "OPERATIONALLY_SUITABLE"
  | "DAYTIME_CHARGING_REQUIRED"
  | "DEPOT_RECHARGE_BETWEEN_ROUTES"
  | "ROUTE_EXCEEDS_RANGE"
  | "RANGE_EXCEEDED_DEPOT_ONLY"
  | "PAYLOAD_CONSTRAINT"
  | "PAYLOAD_IMPACT_UNKNOWN"
  | "CHARGING_UNRESOLVED"
  | "BIOFUEL_SUPPLY_INTERMITTENT"
  | "BIOFUEL_SUPPLY_LIMITED"
  | "BIOFUEL_SUPPLY_CONSTRAINED"
  | "INFRASTRUCTURE_UNRESOLVED"
  | "INFRASTRUCTURE_UNKNOWN"
  | "BATTERY_REPLACEMENT_UNKNOWN"
  | "CRITICAL_DATA_MISSING"
  | "RESULT_INCONSISTENT"
  | "LOWER_EMISSIONS"
  | "HIGHER_EMISSIONS"
  | "NO_MATERIAL_EMISSIONS_DIFFERENCE"
  | "EMISSIONS_UNAVAILABLE";

export interface EconomicAssessment {
  case: EconomicCase;
  /** Incremental NPV versus diesel (diesel present cost minus alternative present cost). */
  npv: number | null;
  /** True when |NPV| is zero within floating-point tolerance. Separate from the economic tolerance. */
  npvZeroWithinNumericalTolerance: boolean;
  nearBreakEvenTolerancePct: number;
  /** What the tolerance is a percentage of. */
  denominator: { kind: "incremental_investment" | "diesel_present_cost"; value: number } | null;
  /** NPV / denominator. A materiality indicator only; it is not a return on investment. */
  npvMaterialityRatio: number | null;
  presentCostDifference: number | null;
  tcoDifference: number | null;
  additionalInitialInvestment: number | null;
  operatingSavingsYear1: number | null;
  simplePaybackStatus: PaybackStatus | null;
  simplePaybackYears: number | null;
  discountedPaybackStatus: PaybackStatus | null;
  discountedPaybackYears: number | null;
  horizonYears: number;
  paybackWithinHorizon: boolean | null;
  immediateAdvantage: boolean;
  diagnostics: ConsistencyDiagnostic[];
  explanation: string;
}

export interface ConsistencyDiagnostic {
  code: string;
  /** "error" blocks classification; "warning" is reported but does not. */
  severity: "error" | "warning";
  message: string;
}

export interface HardOperationalConstraint {
  code: ReasonCode;
  checkId: string;
  text: string;
  /** Always null here: a constrained check means no remedy is identified in the entered configuration. */
  identifiedRemedy: null;
}

export interface RemediableCondition {
  code: ReasonCode;
  checkId: string;
  /** What must be resolved. */
  text: string;
}

export interface MaterialUncertainty {
  code: ReasonCode;
  text: string;
}

export interface SupportingEvidence {
  label: string;
  /** Text with the {cur} token for the currency symbol, filled in by the UI. */
  value: string;
}

export interface EnvironmentalContext {
  state: "lower" | "higher" | "unchanged" | "unavailable";
  direction: EmissionDirection | null;
  percentChange: number | null;
  /** Human-readable, always shown beside the classification. */
  text: string;
  /** Available but never required for the classification. */
  usedInClassification: false;
}

export interface TraceStep {
  step: number;
  gate: "diagnostics" | "evidence" | "operational" | "economic" | "conditions" | "classification" | "environment";
  text: string;
}

export interface CriticalMissing {
  checkId: string;
  text: string;
}

export interface NextStep {
  code: ReasonCode | "GENERAL";
  text: string;
  /** Wizard section to open, when the step is about entering data. */
  target: string | null;
}

export interface CommercialViabilityResult {
  technology: GreenTechId;
  baselineTechnology: "diesel";
  policyVersion: string;
  policyId: string;
  classification: CommercialClassification;
  economicCase: EconomicCase;
  operationalStatus: OperationalStatus;
  economic: EconomicAssessment;
  environmentalContext: EnvironmentalContext;
  primaryReason: string;
  reasonCodes: ReasonCode[];
  supportingEvidence: SupportingEvidence[];
  conditions: RemediableCondition[];
  uncertainties: MaterialUncertainty[];
  hardConstraints: HardOperationalConstraint[];
  criticalMissing: CriticalMissing[];
  recommendedNextSteps: NextStep[];
  evidenceCompleteness: {
    economic: EconomicDataState;
    operational: "complete" | "partial" | "insufficient";
    environmental: "available" | "unavailable";
    environmentalRequiredForClassification: false;
    sufficientForClassification: boolean;
  };
  decisionTrace: TraceStep[];
}
