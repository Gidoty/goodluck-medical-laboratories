import type { NormalizedAssessmentInput } from "@/domain/normalized";
import { OPTIONS } from "@/domain/schema/options";
import { COUNTRIES } from "@/lib/countries";
import { formatNumber } from "@/lib/format";
import { OPERATIONAL_STATUS_LABEL } from "@/calculation/operational/types";
import { compareScenarios, type Scenario } from "@/calculation/scenario";
import { COMMERCIAL_VIABILITY_POLICY_V1 } from "@/calculation/viability";
import { TECH_NAMES, type AssessmentCalculationResult, type GreenTechId, type TechId } from "@/calculation/types";
import { CLASSIFICATION_LABEL } from "@/calculation/viability/types";
import type { AnalysisRecord } from "./analysisRecord";
import { buildEvidenceQuality } from "./evidence";
import { buildExecutiveSummary, buildKeyTakeaways, optionLabel } from "./executive";
import { APP_NAME, APP_VERSION, REPORT_AUTHORSHIP, REPORT_DISCLAIMER, REPORT_TITLE, REPORT_VERSION, THRESHOLD_NOTE } from "./identity";
import { buildLimitations } from "./limitations";
import { classifyAssumption, contextOf, sourceOf } from "./provenance";
import {
  DEFAULT_REPORT_OPTIONS,
  type AssumptionRow,
  type Cell,
  type CommercialBlock,
  type EnvironmentalSection,
  type ExecutiveCard,
  type OperationalBlock,
  type ReportModel,
  type ReportOptions,
  type ScenarioSection,
  type SensitivitySection,
  type TableRow,
  type ThresholdSection,
} from "./types";

const TECHS: readonly TechId[] = ["diesel", "bev", "biofuel"];
const GREEN: readonly GreenTechId[] = ["bev", "biofuel"];

const CATEGORY: Record<string, string> = { scope: "Business and fleet", operations: "Business and fleet", diesel: "Diesel", bev: "Battery electric", biofuel: "Biofuel", finance: "Finance", infrastructure: "Infrastructure", environment: "Environmental", operational: "Operational", method: "Method" };

const baselineOr = (fn: (t: GreenTechId) => Cell): Cell[] => [{ kind: "baseline" }, fn("bev"), fn("biofuel")];
const perTech = (fn: (t: TechId) => Cell): Cell[] => TECHS.map(fn);

function emissionsCell(r: AssessmentCalculationResult, t: TechId, pick: (e: AssessmentCalculationResult["environmental"]["diesel"]) => number | null, kind: "tonnes" | "kgPerKm"): Cell {
  const e = r.environmental[t];
  const v = pick(e);
  return e.status === "calculated" && v !== null ? { kind, value: v } : { kind: "unavailable", reason: e.unavailableReason ?? "no compatible emission factor was supplied." };
}

function comparisonRows(r: AssessmentCalculationResult): TableRow[] {
  const inc = (t: GreenTechId) => (t === "bev" ? r.bevVsDiesel : r.biofuelVsDiesel);
  return [
    { label: "Initial investment (Year 0, net)", cells: perTech((t) => ({ kind: "money", value: r[t].initialCapitalRequirement })) },
    { label: "Total cost of ownership (undiscounted)", cells: perTech((t) => ({ kind: "money", value: r[t].undiscountedTco })) },
    { label: "Present cost", cells: perTech((t) => ({ kind: "money", value: r[t].presentCost })) },
    { label: "Cost per km", cells: perTech((t) => ({ kind: "perKm", value: r[t].tcoPerKm })) },
    { label: "Energy or fuel cost, Year 1", cells: perTech((t) => ({ kind: "money", value: r[t].year1EnergyCost })) },
    { label: "Maintenance over the horizon", cells: perTech((t) => ({ kind: "money", value: r[t].breakdown.undiscounted.maintenance })) },
    { label: "Incremental NPV vs diesel", cells: baselineOr((t) => ({ kind: "money", value: inc(t).npv })) },
    { label: "Simple payback", cells: baselineOr((t) => ({ kind: "payback", value: inc(t).simplePayback })) },
    { label: "Discounted payback", cells: baselineOr((t) => ({ kind: "payback", value: inc(t).discountedPayback })) },
    { label: "Operational status", cells: [{ kind: "text", value: "Baseline configuration" }, ...GREEN.map((t): Cell => ({ kind: "text", value: OPERATIONAL_STATUS_LABEL[r.operational[t].status] }))] },
    { label: "Annual operational emissions", cells: perTech((t) => emissionsCell(r, t, (e) => e.annualEmissionsTonnes, "tonnes")) },
    { label: "Emissions per km", cells: perTech((t) => emissionsCell(r, t, (e) => e.emissionsPerKmKg, "kgPerKm")) },
    { label: "Emissions over the horizon", cells: perTech((t) => emissionsCell(r, t, (e) => e.horizonEmissionsTonnes, "tonnes")) },
    { label: "Commercial classification", cells: baselineOr((t) => ({ kind: "class", value: r.commercial[t].classification })) },
  ];
}

function economicRows(r: AssessmentCalculationResult): TableRow[] {
  const inc = (t: GreenTechId) => (t === "bev" ? r.bevVsDiesel : r.biofuelVsDiesel);
  return [
    { label: "Present cost per km", cells: perTech((t) => ({ kind: "perKm", value: r[t].presentCostPerKm })) },
    { label: "Operating cost, Year 1", cells: perTech((t) => ({ kind: "money", value: r[t].year1OperatingCost })) },
    { label: "Additional initial investment vs diesel", cells: baselineOr((t) => ({ kind: "money", value: inc(t).additionalInitialInvestment })) },
    { label: "Operating savings, Year 1 (diesel minus alternative)", cells: baselineOr((t) => ({ kind: "money", value: inc(t).operatingSavings.year1 })) },
    { label: "Cumulative savings over the horizon", cells: baselineOr((t) => ({ kind: "money", value: inc(t).cumulativeSavings })) },
    { label: "Break-even distance (fleet)", cells: baselineOr((t) => (inc(t).breakEvenDistanceKm === null ? { kind: "text", value: "Not reached within the analysis horizon" } : { kind: "text", value: `${formatNumber(inc(t).breakEvenDistanceKm, 0)} km` })) },
  ];
}

function profileRows(i: NormalizedAssessmentInput): ReportModel["profile"] {
  const rows: ReportModel["profile"] = [];
  const add = (label: string, value: string | null) => { if (value) rows.push({ label, value }); };
  add("Fleet size", `${i.fleet.fleetSize} ${i.fleet.fleetSize === 1 ? "vehicle" : "vehicles"}`);
  add("Vehicle category", optionLabel(OPTIONS.vehicleCategory, i.fleet.vehicleCategory));
  if (i.fleet.payloadCapacityKg !== null) add("Payload capacity", `${formatNumber(i.fleet.payloadCapacityKg, 0)} kg`);
  if (i.fleet.averagePayloadKg !== null) add("Average payload", `${formatNumber(i.fleet.averagePayloadKg, 0)} kg`);
  add("Daily distance per vehicle", `${formatNumber(i.operations.dailyDistanceKm, 1)} km`);
  add("Annual distance per vehicle", `${formatNumber(i.operations.annualDistanceKmPerVehicle, 0)} km`);
  add("Operating days per year", formatNumber(i.operations.operatingDaysPerYear, 0));
  if (i.operations.averageRouteDistanceKm !== null) add("Average route distance", `${formatNumber(i.operations.averageRouteDistanceKm, 1)} km`);
  add("Analysis horizon", `${i.operations.analysisHorizonYears} years`);
  add("Discount rate", `${formatNumber(i.finance.discountRatePct, 2)}% a year`);
  add("Currency", i.meta.currency);
  add("Business type", optionLabel(OPTIONS.businessType, i.business.businessType));
  return rows;
}

function assumptionRows(r: AssessmentCalculationResult, i: NormalizedAssessmentInput): AssumptionRow[] {
  const ctx = contextOf(i);
  return r.assumptions.map((a) => {
    const s = sourceOf(a, i);
    return {
      category: CATEGORY[a.group] ?? a.group,
      label: a.label,
      value: a.value,
      unit: a.unit ?? null,
      provenance: classifyAssumption(a, ctx),
      source: s.source ?? s.reference,
      year: s.year,
      notes: a.note ?? null,
      status: a.status,
    };
  });
}

function operationalBlocks(r: AssessmentCalculationResult, i: NormalizedAssessmentInput): OperationalBlock[] {
  const out: OperationalBlock[] = [];
  const bev = r.operational.bev;
  const m = bev.rangeMetrics;
  const rows: OperationalBlock["rows"] = [];
  if (m) {
    rows.push({ label: "Usable range", value: `${formatNumber(m.usableRangeKm, 0)} km` }, { label: "Daily requirement", value: `${formatNumber(m.dailyDistanceKm, 0)} km` }, { label: "Range margin", value: `${formatNumber(m.rangeMarginKm, 0)} km (${formatNumber(m.rangeMarginPercent, 0)}%)` });
    if (m.routeDistanceKm !== null) rows.push({ label: "Route requirement", value: `${formatNumber(m.routeDistanceKm, 0)} km` });
  }
  const opp = optionLabel(OPTIONS.chargingOpportunity, i.bev.operational.chargingOpportunity);
  if (opp) rows.push({ label: "Charging opportunity", value: opp });
  const arr = i.infrastructure.bevCharging.arrangement;
  if (arr) rows.push({ label: "Charging arrangement", value: arr.replace(/_/g, " ") });
  if (bev.chargingTime.perVehiclePerDayHours !== null) rows.push({ label: "Charging time entered", value: `${formatNumber(bev.chargingTime.perVehiclePerDayHours, 1)} h per vehicle per day (not priced)` });
  rows.push({ label: "Payload compatibility", value: bev.checks.payload.status === "not_assessed" ? "Not assessed" : bev.checks.payload.status.replace(/_/g, " ") });
  out.push({ technology: "bev", status: bev.status, rows, conditions: r.commercial.bev.conditions.map((c) => c.text), constraints: r.commercial.bev.hardConstraints.map((c) => c.text), notAssessed: bev.notAssessed });
  const bio = r.operational.biofuel;
  const brows: OperationalBlock["rows"] = [];
  const av = optionLabel(OPTIONS.fuelAvailability, i.biofuel.supply.availability);
  if (av) brows.push({ label: "Fuel availability", value: av });
  brows.push({ label: "Infrastructure readiness", value: bio.checks.infrastructure.status.replace(/_/g, " ") });
  if (bio.refuelling.additionalDistanceKmPerVehiclePerDay !== null) brows.push({ label: "Additional refuelling distance", value: `${formatNumber(bio.refuelling.additionalDistanceKmPerVehiclePerDay, 1)} km per vehicle per day (not priced)` });
  if (bio.downtime.annualHours !== null) brows.push({ label: "Fuel-related downtime", value: `${formatNumber(bio.downtime.annualHours, 0)} h per vehicle per year (not priced)` });
  out.push({ technology: "biofuel", status: bio.status, rows: brows, conditions: r.commercial.biofuel.conditions.map((c) => c.text), constraints: r.commercial.biofuel.hardConstraints.map((c) => c.text), notAssessed: bio.notAssessed });
  return out;
}

function environmentalSection(r: AssessmentCalculationResult): EnvironmentalSection {
  const names: Record<TechId, string> = { diesel: "Diesel", bev: "Battery electric", biofuel: "Biofuel" };
  const factors = TECHS.map((t) => {
    const f = r.environmental[t].factor;
    return f
      ? { technology: names[t], value: formatNumber(f.enteredValue, 4), unit: f.enteredUnit, source: f.hasProvenance ? (f.source ?? "Not supplied") : "Not supplied", year: f.sourceYear ? String(f.sourceYear) : "Not supplied", scope: f.scopeLabel }
      : { technology: names[t], value: "Not supplied", unit: "", source: "Not supplied", year: "Not supplied", scope: "Not supplied" };
  });
  const rows: TableRow[] = [
    { label: "Annual operational emissions", cells: perTech((t) => emissionsCell(r, t, (e) => e.annualEmissionsTonnes, "tonnes")) },
    { label: "Emissions per km", cells: perTech((t) => emissionsCell(r, t, (e) => e.emissionsPerKmKg, "kgPerKm")) },
    { label: "Emissions over the horizon", cells: perTech((t) => emissionsCell(r, t, (e) => e.horizonEmissionsTonnes, "tonnes")) },
    { label: "Difference vs diesel, annual (diesel minus alternative)", cells: baselineOr((g) => { const c = g === "bev" ? r.environmental.bevVsDiesel : r.environmental.biofuelVsDiesel; return c.status === "calculated" && c.absoluteDifferenceAnnualTonnes !== null ? { kind: "tonnes", value: c.absoluteDifferenceAnnualTonnes } : { kind: "unavailable", reason: c.unavailableReason ?? "no compatible emission factor was supplied." }; }), note: "Positive means the alternative emits less than diesel." },
    { label: "Difference vs diesel, percent", cells: baselineOr((g) => { const c = g === "bev" ? r.environmental.bevVsDiesel : r.environmental.biofuelVsDiesel; return c.status === "calculated" && c.percentageChange !== null ? { kind: "percent", value: c.percentageChange } : { kind: "unavailable", reason: c.unavailableReason ?? "no compatible emission factor was supplied." }; }), note: "Positive means lower than diesel." },
  ];
  const comparisons = GREEN.map((t) => ({ technology: t, text: r.commercial[t].environmentalContext.text }));
  const available = GREEN.some((t) => r.environmental[t === "bev" ? "bevVsDiesel" : "biofuelVsDiesel"].status === "calculated");
  return { scope: "Operational energy/fuel-related GHG emissions", rows, factors, comparisons, available, unavailableNote: available ? null : "Environmental comparison is unavailable because no compatible emission factor was supplied. Unavailable is not zero." };
}

function commercialBlocks(r: AssessmentCalculationResult): CommercialBlock[] {
  return GREEN.map((t) => {
    const c = r.commercial[t];
    return {
      technology: t,
      classification: c.classification,
      economicCase: c.economicCase,
      operationalStatus: c.operationalStatus,
      environmentalContext: c.environmentalContext.text,
      primaryReason: c.primaryReason,
      supportingEvidence: c.supportingEvidence.map((e) => ({ label: e.label, value: e.value })),
      conditions: c.conditions.map((x) => x.text),
      uncertainties: c.uncertainties.map((x) => x.text),
      hardConstraints: c.hardConstraints.map((x) => x.text),
      criticalMissing: c.criticalMissing.map((x) => x.text),
      nextSteps: c.recommendedNextSteps.map((s) => s.text),
      trace: c.decisionTrace.map((s) => s.text),
      reasonCodes: c.reasonCodes,
      policyVersion: c.policyVersion,
    };
  });
}

function sensitivitySection(record: AnalysisRecord | null, options: ReportOptions): SensitivitySection {
  const phrase = "under the tested ranges";
  if (!options.sensitivity) return { state: "omitted", message: null, oneWay: [], drivers: [], phrase };
  const oneWay = GREEN.flatMap((t) => record?.oneWay[t] ?? []);
  const drivers = GREEN.flatMap((t) => {
    const d = record?.drivers[t];
    return d && d.status === "ok" && d.rows.length > 0 ? [{ technology: t, analysis: d, top: d.rows.slice(0, 3).map((row, k) => ({ rank: k + 1, label: row.label, spread: row.spread, unit: row.unit })) }] : [];
  });
  if (oneWay.length === 0 && drivers.length === 0) return { state: "not_run", message: "Sensitivity analysis has not been run for this assessment.", oneWay: [], drivers: [], phrase };
  return { state: "included", message: null, oneWay, drivers, phrase };
}

function scenarioSection(i: NormalizedAssessmentInput, scenarios: readonly Scenario[], options: ReportOptions): ScenarioSection {
  if (!options.scenarios) return { state: "omitted", message: null, comparison: null };
  if (scenarios.length === 0) return { state: "none", message: "No scenarios have been saved for this assessment.", comparison: null };
  const c = compareScenarios(i, scenarios);
  if ("status" in c) return { state: "none", message: c.message, comparison: null };
  return { state: "included", message: null, comparison: c };
}

function thresholdSection(record: AnalysisRecord | null, options: ReportOptions): ThresholdSection {
  if (!options.thresholds) return { state: "omitted", message: null, analyses: [], barrierStatements: [] };
  const analyses = GREEN.flatMap((t) => (record?.viability[t] ? [record.viability[t]!] : []));
  if (analyses.length === 0) return { state: "not_run", message: "Threshold analysis has not been run for this assessment.", analyses: [], barrierStatements: [] };
  const statements: ThresholdSection["barrierStatements"] = [];
  for (const a of analyses) {
    const economic = a.economicThresholds.find((x) => x.status === "FOUND" && x.thresholdValue !== null) ?? a.economicThresholds.find((x) => x.status === "ALREADY_SATISFIED" && x.thresholdValue !== null);
    if (economic) statements.push({ technology: a.technology, text: economic.statement });
    if (a.barriers.operational[0] && a.mode !== "viability_margin") statements.push({ technology: a.technology, text: `Operational: ${a.barriers.operational[0].text}` });
    if (a.multipleBarrierNote) statements.push({ technology: a.technology, text: a.multipleBarrierNote });
  }
  return { state: "included", message: null, analyses, barrierStatements: statements };
}

function executiveCards(r: AssessmentCalculationResult): ExecutiveCard[] {
  const rows = comparisonRows(r);
  const pick = (labels: string[]) => rows.filter((x) => labels.includes(x.label));
  return [
    { technology: "diesel", title: "Diesel", classification: "BASELINE", rows: pick(["Total cost of ownership (undiscounted)", "Cost per km"]).map((x) => ({ label: x.label, cells: [x.cells[0]!] })) },
    ...GREEN.map((t, k): ExecutiveCard => ({
      technology: t,
      title: TECH_NAMES[t],
      classification: r.commercial[t].classification,
      rows: pick(["Incremental NPV vs diesel", "Total cost of ownership (undiscounted)", "Cost per km", "Simple payback", "Discounted payback", "Operational status", "Annual operational emissions"]).map((x) => ({ label: x.label, cells: [x.cells[k + 1]!] })),
    })),
  ];
}

const METHOD: ReportModel["methodology"] = [
  { heading: "Economics", text: "Asset perspective, Year 0 to the horizon, costs positive and incentives and residual value negative. Incremental NPV against diesel = sum over years of (diesel net cash cost minus alternative net cash cost) divided by (1 + discount rate) to the power of the year. Financing, tax and revenue are excluded." },
  { heading: "Operational feasibility", text: "Transparent rule checks on the inputs entered: BEV range, route, charging and payload; biofuel supply and infrastructure. Statuses are Suitable, Conditional, Constrained and Insufficient data. No cost or emissions figure is used." },
  { heading: "Environmental scope", text: "Estimated operational energy and fuel-related emissions = physical use multiplied by the emission factor the user supplied. No factor ships with GreenFleet. It is not a lifecycle assessment." },
  { heading: "Commercial Viability Policy v1.0", text: "Ordered rules: consistency, evidence sufficiency, operational feasibility, economic case (favourable, near break-even within 5%, unfavourable), then conditions and uncertainties. There is no weighted score. Environmental performance does not change the label." },
  { heading: "Sensitivity, scenarios and thresholds", text: "One assumption is changed on a copy of the Base Case and the same engine recalculates. Thresholds are solved by bracketing and bisection and verified by re-running the engine. All results hold all else equal." },
  { heading: "Evidence quality", text: "Evidence states describe completeness and provenance. They are not statistical confidence, and no confidence score is calculated." },
];

export interface ReportInputs {
  input: NormalizedAssessmentInput;
  result: AssessmentCalculationResult;
  analysis: AnalysisRecord | null;
  scenarios: readonly Scenario[];
  options?: Partial<ReportOptions>;
  /** ISO timestamp supplied by the caller so the builder stays pure. */
  now: string;
}

/**
 * The single source for the report, the print view, the presentation and the exports.
 * It only reads results the engine already produced and arranges them. It calculates nothing new.
 */
export function buildReportModel(args: ReportInputs): ReportModel {
  const options: ReportOptions = { ...DEFAULT_REPORT_OPTIONS, ...args.options };
  const { input, result, analysis } = args;
  const evidence = buildEvidenceQuality(result, input, analysis);
  const sensitivity = sensitivitySection(analysis, options);
  const scenarios = scenarioSection(input, args.scenarios, options);
  const thresholds = thresholdSection(analysis, options);
  const executive = buildExecutiveSummary({ input, result, evidence, analysis, tables: executiveCards(result) });
  const country = COUNTRIES.find((c) => c.id === input.business.country)?.label ?? null;
  const location = [input.business.operatingLocation, country].filter(Boolean).join(", ") || null;
  return {
    identity: {
      product: APP_NAME,
      title: REPORT_TITLE,
      assessmentName: input.meta.assessmentName || "Untitled assessment",
      businessName: input.business.businessName,
      location,
      assessedAt: input.meta.updatedAt,
      generatedAt: args.now,
      currency: input.meta.currency,
      horizonYears: input.operations.analysisHorizonYears,
      authorship: REPORT_AUTHORSHIP,
      reportVersion: REPORT_VERSION,
      appVersion: APP_VERSION,
      engineVersion: result.metadata.engineVersion,
      policyId: COMMERCIAL_VIABILITY_POLICY_V1.id,
      policyVersion: COMMERCIAL_VIABILITY_POLICY_V1.version,
      dataOrigin: input.meta.dataOrigin,
    },
    options,
    executive,
    profile: profileRows(input),
    assumptions: options.detailedAssumptions ? assumptionRows(result, input) : [],
    comparison: { columns: ["Diesel", "Battery electric", "Biofuel"], rows: comparisonRows(result) },
    economic: {
      rows: economicRows(result),
      definitions: [
        { term: "Total cost of ownership (TCO)", text: "The estimated total cost of owning and operating the technology over the analysis horizon." },
        { term: "Present cost", text: "The value today of those costs after applying the discount rate." },
        { term: "Incremental NPV vs diesel", text: "The present-value economic advantage (positive) or disadvantage (negative) of choosing the alternative instead of diesel." },
        { term: "Near break-even", text: `A Policy v1.0 category: the NPV is within a prototype tolerance of ${COMMERCIAL_VIABILITY_POLICY_V1.nearBreakEvenTolerancePct}% of the additional initial investment (or of diesel present cost where that is not positive).` },
      ],
    },
    operational: operationalBlocks(result, input),
    environmental: environmentalSection(result),
    commercial: commercialBlocks(result),
    sensitivity,
    scenarios,
    thresholds,
    evidence,
    methodology: options.methodologyAppendix ? METHOD : [],
    limitations: buildLimitations({ result, evidence, options, sensitivity, scenarios, thresholds, dataOrigin: input.meta.dataOrigin }),
    disclaimer: REPORT_DISCLAIMER,
    footer: `Generated by ${APP_NAME}. Policy: ${COMMERCIAL_VIABILITY_POLICY_V1.id}. Academic decision-support prototype.`,
    takeaways: buildKeyTakeaways(result, evidence, analysis),
  };
}

export { THRESHOLD_NOTE, CLASSIFICATION_LABEL };
