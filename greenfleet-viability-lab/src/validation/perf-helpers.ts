import { calculateAssessment } from "@/calculation/engine";
import { runDriverAnalysis, runSensitivityAnalysis } from "@/calculation/sensitivity";
import { analyzeViability } from "@/calculation/threshold";
import type { NormalizedAssessmentInput } from "@/domain/normalized";
import { emptyRecord, fingerprintInput, type AnalysisRecord } from "@/reporting/analysisRecord";
import { buildExportFile } from "@/reporting/exports";
import { buildReportModel } from "@/reporting/model";

const NOW = "2026-10-05T10:00:00.000Z";

/** The analyses a person would have run on the Sensitivity page, stored against the current inputs. */
export function analysisRecordFor(input: NormalizedAssessmentInput): AnalysisRecord {
  const rec = emptyRecord(fingerprintInput(input), NOW);
  for (const t of ["bev", "biofuel"] as const) {
    rec.viability[t] = analyzeViability(input, t);
    const d = runDriverAnalysis({ input, technology: t });
    if (d.status === "ok") rec.drivers[t] = d;
    const s = runSensitivityAnalysis({ input, technology: t, variableId: t === "bev" ? "electricityTariff" : "biofuelPrice" });
    if (s.status === "ok") rec.oneWay[t] = [s];
  }
  return rec;
}

/** Builds the report model and every export from stored analyses. */
export function buildFor(input: NormalizedAssessmentInput, analysis: AnalysisRecord): number {
  const o = calculateAssessment(input);
  if (!o.ok) throw new Error("calc");
  const model = buildReportModel({ input, result: o.result, analysis, scenarios: [], now: NOW });
  let bytes = 0;
  for (const k of ["comparison", "cashflow", "sensitivity", "drivers", "scenarios", "scenario_changes", "thresholds", "json"] as const) bytes += buildExportFile(k, { model, input, result: o.result, analysis, scenarios: [] }).content.length;
  return bytes;
}
