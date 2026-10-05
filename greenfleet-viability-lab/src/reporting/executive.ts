import type { NormalizedAssessmentInput } from "@/domain/normalized";
import { OPTIONS } from "@/domain/schema/options";
import { TECH_NAMES, type AssessmentCalculationResult, type GreenTechId } from "@/calculation/types";
import { CLASSIFICATION_LABEL, type CommercialViabilityResult } from "@/calculation/viability/types";
import { availableEconomicEvidenceNote } from "@/calculation/viability";
import { formatNumber } from "@/lib/format";
import type { AnalysisRecord } from "./analysisRecord";
import { joinList, phraseOf } from "./phrases";
import type { EvidenceQuality, ExecutiveSummary } from "./types";

const GREEN: readonly GreenTechId[] = ["bev", "biofuel"];
const LOWER: Record<GreenTechId, string> = { bev: "battery-electric", biofuel: "biofuel" };
const money = (x: number) => `${x < 0 ? "-" : ""}{cur}${Math.abs(x).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
/** Lower-cases the first letter of a sentence fragment but leaves acronyms such as BEV alone. */
const lc = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

export const optionLabel = (opts: readonly { id: string; label: string }[], id: string | null): string | null => (id ? opts.find((o) => o.id === id)?.label ?? id : null);

const ECON: Record<string, string> = { FAVOURABLE: "favourable", NEAR_BREAK_EVEN: "close to break-even", UNFAVOURABLE: "unfavourable" };

/** One technology, as sentences built only from the structured Policy v1.0 result. */
export function technologySentences(t: GreenTechId, c: CommercialViabilityResult): string[] {
  const name = LOWER[t];
  if (c.classification === "INSUFFICIENT_EVIDENCE") {
    const why = c.criticalMissing[0]?.text.replace(/\.$/, "") ?? "essential information is missing";
    const note = availableEconomicEvidenceNote(c.economicCase);
    return [`GreenFleet cannot classify the ${name} alternative because ${lc(why)}.`, ...(note ? [note] : []), c.environmentalContext.text];
  }
  const out = [`Under the entered assumptions, the ${name} alternative is ${CLASSIFICATION_LABEL[c.classification]} relative to diesel.`];
  out.push(`Its economic case is ${ECON[c.economicCase] ?? "not determined"}, with an incremental NPV of ${money(c.economic.npv ?? 0)}.`);
  const hard = c.hardConstraints.map((h) => phraseOf(h.code, h.text));
  const cond = c.conditions.map((h) => phraseOf(h.code, h.text));
  const unc = c.uncertainties.map((h) => phraseOf(h.code, h.text));
  if (hard.length > 0) out.push(`An operational constraint remains unresolved: ${joinList(hard)}.`);
  if (cond.length > 0) out.push(`Operationally, ${joinList(cond)} ${cond.length === 1 ? "is a condition" : "are conditions"} to resolve.`);
  if (hard.length === 0 && cond.length === 0) out.push("No material operational constraint is identified.");
  if (unc.length > 0) out.push(`Unresolved: ${joinList(unc)}.`);
  out.push(c.environmentalContext.text);
  return out;
}

export function buildExecutiveSummary(args: { input: NormalizedAssessmentInput; result: AssessmentCalculationResult; evidence: EvidenceQuality; analysis: AnalysisRecord | null; tables: ExecutiveSummary["cards"] }): ExecutiveSummary {
  const { input, result, analysis, evidence } = args;
  const cat = optionLabel(OPTIONS.vehicleCategory, input.fleet.vehicleCategory);
  const n = input.fleet.fleetSize;
  const profile = `This assessment compares battery-electric and biofuel vehicles with a diesel baseline for ${n} ${cat ? `${lc(cat)} ` : ""}${n === 1 ? "vehicle" : "vehicles"}, each covering about ${formatNumber(input.operations.annualDistanceKmPerVehicle, 0)} km a year over ${input.operations.analysisHorizonYears} ${input.operations.analysisHorizonYears === 1 ? "year" : "years"}, in ${input.meta.currency}.`;
  const perTechnology = {} as Record<GreenTechId, string>;
  for (const t of GREEN) perTechnology[t] = technologySentences(t, result.commercial[t]).join(" ");

  // What could change the decision: only what was actually run.
  let change: string;
  const drivers = GREEN.map((t) => ({ t, d: analysis?.drivers[t] })).filter((x) => x.d && x.d.status === "ok" && x.d.rows.length > 0 && x.d.rows[0]!.spread > 0);
  const thr = GREEN.flatMap((t) => (analysis?.viability[t]?.economicThresholds ?? []).filter((x) => x.status === "FOUND" && x.thresholdValue !== null).slice(0, 1).map((x) => ({ t, x })));
  if (!analysis || (drivers.length === 0 && thr.length === 0 && Object.keys(analysis.viability).length === 0)) {
    change = "Sensitivity and threshold analysis have not been run for this assessment, so what could change the decision is not reported here.";
  } else {
    const bits: string[] = [];
    for (const { t, d } of drivers) if (d && d.status === "ok") bits.push(`for the ${LOWER[t]} alternative, ${lc(d.rows[0]!.label)} has the largest tested NPV influence under the tested ranges`);
    if (bits.length > 0) change = `What could change the decision: ${joinList(bits)}.`;
    else change = "Threshold analysis has been run; see the thresholds section.";
    for (const { x } of thr.slice(0, 1)) change += ` ${x.statement}`;
  }

  const paragraphs = [profile, perTechnology.bev, perTechnology.biofuel, change];
  const wordCount = paragraphs.join(" ").replace(/\{cur\}/g, "").split(/\s+/).filter(Boolean).length;

  const kdp: string[] = [];
  for (const t of GREEN) {
    const c = result.commercial[t];
    kdp.push(`${TECH_NAMES[t]}: ${CLASSIFICATION_LABEL[c.classification]}. ${c.primaryReason}`);
  }
  for (const t of GREEN) kdp.push(`${TECH_NAMES[t]} environment: ${result.commercial[t].environmentalContext.text}`);
  kdp.push(change);
  kdp.push(evidence.overall);

  return { paragraphs, wordCount, keyDecisionPoints: kdp, perTechnology, cards: args.tables };
}

/** Evidence-based closing statements for the presentation. Every line comes from a structured result. */
export function buildKeyTakeaways(result: AssessmentCalculationResult, evidence: EvidenceQuality, analysis: AnalysisRecord | null): string[] {
  const out: string[] = [];
  for (const t of GREEN) {
    const c = result.commercial[t];
    const note = c.classification === "INSUFFICIENT_EVIDENCE" ? availableEconomicEvidenceNote(c.economicCase) : null;
    out.push(c.classification === "INSUFFICIENT_EVIDENCE" ? `${TECH_NAMES[t]} cannot be classified: essential information is missing.${note ? ` ${note}` : ""}` : `${TECH_NAMES[t]} is ${CLASSIFICATION_LABEL[c.classification]} relative to diesel under the entered assumptions.`);
  }
  for (const t of GREEN) {
    const d = analysis?.drivers[t];
    if (d && d.status === "ok" && d.rows[0] && d.rows[0].spread > 0) out.push(`${d.rows[0].label} is the strongest tested economic driver for ${LOWER[t]}, under the tested ranges.`);
  }
  for (const t of GREEN) {
    const c = result.commercial[t];
    const hard = c.hardConstraints[0];
    const cond = c.conditions[0];
    if (hard) out.push(`The principal ${LOWER[t]} operational constraint is ${phraseOf(hard.code, hard.text)}.`);
    else if (cond) out.push(`The principal ${LOWER[t]} operational condition is ${phraseOf(cond.code, cond.text)}.`);
    else if (c.classification !== "INSUFFICIENT_EVIDENCE") out.push(`No material ${LOWER[t]} operational constraint is identified.`);
    const u = c.uncertainties[0];
    if (u) out.push(`A material ${LOWER[t]} uncertainty remains: ${phraseOf(u.code, u.text)}.`);
  }
  const states = GREEN.map((t) => result.commercial[t].environmentalContext);
  if (states.every((s) => s.state === "unavailable")) out.push("Environmental comparison is unavailable because compatible emission factors were not supplied.");
  else for (const t of GREEN) out.push(result.commercial[t].environmentalContext.text);
  out.push(evidence.overall);
  return out;
}
