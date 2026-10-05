import type { AssumptionKind } from "@/components/ui/assumption-badge";
import type { OperationalStatus } from "@/calculation/operational/types";
import type { PaybackResult, GreenTechId } from "@/calculation/types";
import type { CommercialClassification, CommercialViabilityResult, EconomicCase } from "@/calculation/viability/types";
import type { DriverAnalysis, SensitivityResult } from "@/calculation/sensitivity";
import type { ScenarioComparison } from "@/calculation/scenario";
import type { ThresholdResult, ViabilityAnalysis } from "@/calculation/threshold";

/** How the app says a value is absent. These states are not the same and are never all shown as N/A. */
export type Cell =
  | { kind: "money"; value: number }
  | { kind: "perKm"; value: number }
  | { kind: "tonnes"; value: number }
  | { kind: "kgPerKm"; value: number }
  | { kind: "percent"; value: number }
  | { kind: "payback"; value: PaybackResult }
  | { kind: "text"; value: string }
  | { kind: "class"; value: CommercialClassification }
  | { kind: "baseline" }
  | { kind: "unavailable"; reason: string }
  | { kind: "not_run" }
  | { kind: "na" };

export interface TableRow {
  label: string;
  cells: Cell[];
  note?: string;
}

export interface ReportOptions {
  sensitivity: boolean;
  scenarios: boolean;
  thresholds: boolean;
  detailedAssumptions: boolean;
  methodologyAppendix: boolean;
}

export const DEFAULT_REPORT_OPTIONS: ReportOptions = { sensitivity: true, scenarios: true, thresholds: true, detailedAssumptions: true, methodologyAppendix: true };

export interface ReportIdentity {
  product: string;
  title: string;
  assessmentName: string;
  businessName: string | null;
  location: string | null;
  assessedAt: string;
  generatedAt: string;
  currency: string;
  horizonYears: number;
  authorship: string;
  reportVersion: string;
  appVersion: string;
  prototypeVersion: string;
  engineVersion: string;
  policyId: string;
  policyVersion: string;
  dataOrigin: "blank" | "demo" | "user";
}

export interface ExecutiveSummary {
  /** The short summary, about 100 to 200 words when the data allow. Text carries the {cur} token. */
  paragraphs: string[];
  wordCount: number;
  keyDecisionPoints: string[];
  perTechnology: Record<GreenTechId, string>;
  cards: ExecutiveCard[];
}

export interface ExecutiveCard {
  technology: "diesel" | GreenTechId;
  title: string;
  classification: CommercialClassification | "BASELINE";
  rows: TableRow[];
}

export interface AssumptionRow {
  category: string;
  label: string;
  value: string;
  unit: string | null;
  provenance: AssumptionKind;
  source: string | null;
  year: number | null;
  notes: string | null;
  status: string;
}

export interface EvidenceDimension {
  label: string;
  state: "Complete" | "Partial" | "Insufficient" | "Unavailable";
  detail: string;
}

export interface MaterialAssumption {
  label: string;
  because: string[];
}

export interface EvidenceQuality {
  dimensions: Record<GreenTechId, { economic: EvidenceDimension; operational: EvidenceDimension; environmental: EvidenceDimension }>;
  provenance: { userInputs: number; sourced: number; illustrative: number; derived: number; conventions: number; missingExcluded: number };
  criticalMissing: { technology: GreenTechId; text: string }[];
  materialUncertainties: { technology: GreenTechId; text: string }[];
  statements: Record<GreenTechId, string>;
  overall: string;
  materialAssumptions: MaterialAssumption[];
  /** Always the same words: evidence completeness is not statistical confidence. */
  confidenceNote: string;
  /** GreenFleet calculates no statistical confidence for the classification. */
  statisticalConfidence: "not calculated";
}

export interface OperationalBlock {
  technology: GreenTechId;
  status: OperationalStatus;
  rows: { label: string; value: string }[];
  conditions: string[];
  constraints: string[];
  notAssessed: string[];
}

export interface CommercialBlock {
  technology: GreenTechId;
  classification: CommercialClassification;
  economicCase: EconomicCase;
  operationalStatus: OperationalStatus;
  environmentalContext: string;
  primaryReason: string;
  supportingEvidence: { label: string; value: string }[];
  conditions: string[];
  uncertainties: string[];
  hardConstraints: string[];
  criticalMissing: string[];
  nextSteps: string[];
  trace: string[];
  reasonCodes: string[];
  policyVersion: string;
}

export type SectionState = "included" | "not_run" | "omitted" | "none";

export interface SensitivitySection {
  state: SectionState;
  message: string | null;
  oneWay: SensitivityResult[];
  drivers: { technology: GreenTechId; top: { rank: number; label: string; spread: number; unit: string }[]; analysis: DriverAnalysis }[];
  phrase: string;
}

export interface ScenarioSection {
  state: SectionState;
  message: string | null;
  comparison: ScenarioComparison | null;
}

export interface ThresholdSection {
  state: SectionState;
  message: string | null;
  analyses: ViabilityAnalysis[];
  /** One sentence per technology that keeps every remaining barrier in view. */
  barrierStatements: { technology: GreenTechId; text: string }[];
}

export interface EnvironmentalSection {
  scope: string;
  rows: TableRow[];
  factors: { technology: string; value: string; unit: string; source: string; year: string; scope: string }[];
  comparisons: { technology: GreenTechId; text: string }[];
  available: boolean;
  unavailableNote: string | null;
}

export interface ReportModel {
  identity: ReportIdentity;
  options: ReportOptions;
  executive: ExecutiveSummary;
  profile: { label: string; value: string }[];
  assumptions: AssumptionRow[];
  comparison: { columns: string[]; rows: TableRow[] };
  economic: { rows: TableRow[]; definitions: { term: string; text: string }[] };
  operational: OperationalBlock[];
  environmental: EnvironmentalSection;
  commercial: CommercialBlock[];
  sensitivity: SensitivitySection;
  scenarios: ScenarioSection;
  thresholds: ThresholdSection;
  evidence: EvidenceQuality;
  methodology: { heading: string; text: string }[];
  limitations: string[];
  disclaimer: string;
  footer: string;
  takeaways: string[];
}

export type { CommercialViabilityResult, ThresholdResult };
