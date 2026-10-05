import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { AssessmentCalculationResult, GreenTechId } from "@/calculation/types";
import { COMMERCIAL_VIABILITY_POLICY_V1 } from "@/calculation/viability";
import type { Scenario } from "@/calculation/scenario";
import type { AnalysisRecord } from "./analysisRecord";
import { cellRaw } from "./cells";
import { APP_NAME, APP_VERSION, PROTOTYPE_VERSION, REPORT_DISCLAIMER, REPORT_VERSION } from "./identity";
import type { ReportModel } from "./types";

export type CsvKind = "comparison" | "cashflow" | "sensitivity" | "drivers" | "scenarios" | "scenario_changes" | "thresholds";
export type ExportKind = CsvKind | "json";

export const CSV_LABEL: Record<CsvKind, string> = {
  comparison: "Technology comparison",
  cashflow: "Year-by-year cash flow",
  sensitivity: "Sensitivity results",
  drivers: "Sensitivity drivers",
  scenarios: "Scenario comparison",
  scenario_changes: "Scenario changed assumptions",
  thresholds: "Threshold results",
};

type Field = string | number | boolean | null | undefined;

/** RFC 4180 quoting. Text that a spreadsheet could read as a formula is prefixed, numbers are left alone. */
export function csvField(v: Field): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows: Field[][]): string => rows.map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";

/** Safe, deterministic filename. The date is passed in so the name is reproducible. */
export function safeFilename(assessmentName: string, kind: string, ext: "csv" | "json", date: string): string {
  const slug = assessmentName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  const day = /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : "undated";
  return `greenfleet-assessment-${slug || "untitled"}-${kind.replace(/_/g, "-")}-${day}.${ext}`;
}

const meta = (m: ReportModel): Field[][] => [
  ["# export", "GreenFleet assessment export"],
  ["# generated", m.identity.generatedAt],
  ["# currency", m.identity.currency],
  ["# analysis_horizon_years", m.identity.horizonYears],
  ["# policy", `${m.identity.policyId}`],
  ["# prototype", m.identity.prototypeVersion],
  ["# disclaimer", REPORT_DISCLAIMER],
  ["# application_version", `${m.identity.appVersion} (report ${m.identity.reportVersion}, engine ${m.identity.engineVersion})`],
];

export function comparisonRows(m: ReportModel): Field[][] {
  const out: Field[][] = [...meta(m), ["metric", "diesel", "diesel_status", "bev", "bev_status", "biofuel", "biofuel_status", "note"]];
  for (const r of m.comparison.rows) {
    const raw = r.cells.map(cellRaw);
    out.push([r.label, ...raw.flatMap((c) => [c.value, c.status]), r.note ?? ""]);
  }
  return out;
}

export function cashflowRows(m: ReportModel, result: AssessmentCalculationResult): Field[][] {
  const out: Field[][] = [...meta(m), ["comparison", "year", "diesel_cost", "alternative_cost", "incremental_cash_flow", "discounted_incremental_cash_flow", "cumulative_incremental", "cumulative_discounted_incremental"]];
  for (const [name, inc] of [["bev_vs_diesel", result.bevVsDiesel], ["biofuel_vs_diesel", result.biofuelVsDiesel]] as const) {
    for (const r of inc.rows) out.push([name, r.year, r.dieselCost, r.greenCost, r.incrementalCashFlow, r.discountedIncrementalCashFlow, r.cumulativeIncrementalCashFlow, r.discountedCumulativeCashFlow]);
  }
  return out;
}

const pb = (p: { status: string; years: number | null }) => [p.years, p.status];

export function sensitivityRows(m: ReportModel): Field[][] {
  const out: Field[][] = [...meta(m), ["technology", "variable", "unit", "base_value", "tested_value", "percent_change", "incremental_npv", "present_cost_difference", "tco", "tco_per_km", "simple_payback_years", "simple_payback_status", "discounted_payback_years", "discounted_payback_status", "economic_case", "operational_status", "classification", "is_base_case"]];
  for (const r of m.sensitivity.oneWay) {
    for (const p of r.points) out.push([r.technology, r.variableId, r.unit, r.baseValue, p.value, p.percentChange, p.npv, p.presentCostDifference, p.tco, p.tcoPerKm, ...pb(p.simplePayback), ...pb(p.discountedPayback), p.economicCase, p.operationalStatus, p.classification, p.isBase]);
  }
  return out;
}

export function driverRows(m: ReportModel): Field[][] {
  const out: Field[][] = [...meta(m), ["technology", "rank", "variable", "unit", "base_value", "low_value", "high_value", "npv_at_base", "npv_at_low", "npv_at_high", "npv_spread", "classification_low", "classification_base", "classification_high", "values_pulled_back_to_model_limit"]];
  for (const d of m.sensitivity.drivers) d.analysis.rows.forEach((r, k) => out.push([d.technology, k + 1, r.variableId, r.unit, r.baseValue, r.lowValue, r.highValue, r.npvBase, r.npvLow, r.npvHigh, r.spread, r.classificationLow, r.classificationBase, r.classificationHigh, r.clamped]));
  return out;
}

export function scenarioRows(m: ReportModel): Field[][] {
  const c = m.scenarios.comparison;
  const out: Field[][] = [...meta(m), ["scenario", "origin", "technology", "status", "incremental_npv", "delta_npv_vs_base", "tco", "delta_tco_vs_base", "present_cost", "tco_per_km", "simple_payback_years", "simple_payback_status", "discounted_payback_years", "discounted_payback_status", "operational_status", "environmental_state", "environmental_percent_change", "classification", "classification_changed_vs_base"]];
  if (!c) return out;
  for (const s of [c.base, ...c.scenarios]) {
    for (const [tech, r] of [["bev", s.bev], ["biofuel", s.biofuel]] as const) {
      if (!r) { out.push([s.name, s.scenario?.origin ?? "base_case", tech, s.status]); continue; }
      const x = r.snapshot;
      out.push([s.name, s.scenario?.origin ?? "base_case", tech, "ok", x.npv, r.deltaNpv, x.tco, r.deltaTco, x.presentCost, x.tcoPerKm, ...pb(x.simplePayback), ...pb(x.discountedPayback), x.operationalStatus, x.environmental.state, x.environmental.percentChange, x.classification, r.classificationChanged]);
    }
  }
  return out;
}

export function scenarioChangeRows(m: ReportModel): Field[][] {
  const out: Field[][] = [...meta(m), ["scenario", "variable_id", "variable", "base_case_value", "scenario_value"]];
  for (const s of m.scenarios.comparison?.scenarios ?? []) for (const ch of s.changes) out.push([s.name, ch.variableId, ch.label, ch.from, ch.to]);
  return out;
}

export function thresholdRows(m: ReportModel): Field[][] {
  const out: Field[][] = [...meta(m), ["technology", "current_classification", "mode", "target", "variable", "unit", "current_value", "threshold_value", "threshold_kind", "required_change_absolute", "required_change_percent", "direction", "solver_status", "remaining_hard_constraints", "all_else_equal", "statement"]];
  for (const a of m.thresholds.analyses) {
    for (const t of [...a.economicThresholds, ...a.classificationThresholds]) out.push([a.technology, a.classification, a.mode, t.target, t.variableId, t.unit, t.currentValue, t.thresholdValue, t.thresholdKind, t.requiredChange?.absolute, t.requiredChange?.percent, t.requiredChange?.direction, t.status, t.blockers.hardConstraints.length, true, t.statement.replace(/\{cur\}/g, "")]);
  }
  return out;
}

export function availability(m: ReportModel): Record<ExportKind, { available: boolean; reason: string | null }> {
  const yes = { available: true, reason: null };
  const no = (reason: string) => ({ available: false, reason });
  const sens = m.sensitivity.oneWay.length > 0;
  return {
    comparison: yes,
    cashflow: yes,
    json: yes,
    sensitivity: sens ? yes : no("Sensitivity analysis has not been run for this assessment."),
    drivers: m.sensitivity.drivers.length > 0 ? yes : no("Sensitivity analysis has not been run for this assessment."),
    scenarios: m.scenarios.comparison && m.scenarios.comparison.scenarios.length > 0 ? yes : no("No scenarios have been saved."),
    scenario_changes: m.scenarios.comparison && m.scenarios.comparison.scenarios.length > 0 ? yes : no("No scenarios have been saved."),
    thresholds: m.thresholds.analyses.length > 0 ? yes : no("Threshold analysis has not been run for this assessment."),
  };
}

export interface ExportFile {
  filename: string;
  mime: string;
  content: string;
}

/** JSON that lets someone inspect or reproduce the assessment. No UI state. Raw, unrounded numbers. */
export function buildJsonExport(args: { model: ReportModel; input: NormalizedAssessmentInput; result: AssessmentCalculationResult; analysis: AnalysisRecord | null; scenarios: readonly Scenario[] }): Record<string, unknown> {
  const { model: m, input, result, analysis, scenarios } = args;
  return {
    exportType: "greenfleet-assessment",
    disclaimer: REPORT_DISCLAIMER,
    exportSchemaVersion: 1,
    generatedAt: m.identity.generatedAt,
    application: { name: APP_NAME, prototypeVersion: PROTOTYPE_VERSION, version: APP_VERSION, reportVersion: REPORT_VERSION, engineVersion: result.metadata.engineVersion },
    policy: { id: COMMERCIAL_VIABILITY_POLICY_V1.id, version: COMMERCIAL_VIABILITY_POLICY_V1.version, nearBreakEvenTolerancePct: COMMERCIAL_VIABILITY_POLICY_V1.nearBreakEvenTolerancePct },
    currency: input.meta.currency,
    analysisHorizonYears: input.operations.analysisHorizonYears,
    metadata: result.metadata,
    normalizedInput: input,
    provenance: { bySourceField: input.provenance, inputStatus: input.inputStatus, illustrativeInputs: input.meta.illustrativeInputs, assumptions: m.assumptions, counts: m.evidence.provenance },
    results: {
      diesel: result.diesel,
      bev: result.bev,
      biofuel: result.biofuel,
      bevVsDiesel: result.bevVsDiesel,
      biofuelVsDiesel: result.biofuelVsDiesel,
      environmental: result.environmental,
      operational: result.operational,
      dataCompleteness: result.dataCompleteness,
      warnings: result.warnings,
    },
    commercial: result.commercial,
    evidenceQuality: m.evidence,
    sensitivity: analysis ? { oneWay: analysis.oneWay, drivers: analysis.drivers } : null,
    thresholds: analysis ? analysis.viability : null,
    scenarios: { definitions: scenarios, comparison: m.scenarios.comparison },
    notes: ["Numbers are raw and unrounded. Currency is stated above.", "Sensitivity and threshold sections are present only if they were run for these inputs."],
  };
}

export function buildExportFile(kind: ExportKind, ctx: { model: ReportModel; input: NormalizedAssessmentInput; result: AssessmentCalculationResult; analysis: AnalysisRecord | null; scenarios: readonly Scenario[] }): ExportFile {
  const m = ctx.model;
  const date = m.identity.generatedAt;
  const name = m.identity.assessmentName;
  if (kind === "json") return { filename: safeFilename(name, "full", "json", date), mime: "application/json", content: JSON.stringify(buildJsonExport(ctx), null, 2) };
  const table: Record<CsvKind, () => Field[][]> = {
    comparison: () => comparisonRows(m),
    cashflow: () => cashflowRows(m, ctx.result),
    sensitivity: () => sensitivityRows(m),
    drivers: () => driverRows(m),
    scenarios: () => scenarioRows(m),
    scenario_changes: () => scenarioChangeRows(m),
    thresholds: () => thresholdRows(m),
  };
  // The BOM lets spreadsheet programs read the currency symbols and any non-ASCII text as UTF-8.
  return { filename: safeFilename(name, kind, "csv", date), mime: "text/csv;charset=utf-8", content: "﻿" + toCsv(table[kind]()) };
}

export type { GreenTechId };
