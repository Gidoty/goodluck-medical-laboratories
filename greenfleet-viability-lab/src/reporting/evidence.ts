import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { AssessmentCalculationResult, GreenTechId } from "@/calculation/types";
import { TECH_NAMES } from "@/calculation/types";
import type { AnalysisRecord } from "./analysisRecord";
import { CODE_ASSUMPTION, joinList } from "./phrases";
import { classifyAssumption, contextOf } from "./provenance";
import type { EvidenceDimension, EvidenceQuality, MaterialAssumption } from "./types";

const GREEN: readonly GreenTechId[] = ["bev", "biofuel"];

export const CONFIDENCE_NOTE =
  "These are descriptions of how complete the evidence is. They are not statistical confidence. GreenFleet calculates no confidence interval or probability for the commercial classification.";

const word = (s: string): EvidenceDimension["state"] => (s === "complete" ? "Complete" : s === "partial" ? "Partial" : s === "unavailable" ? "Unavailable" : "Insufficient");

export function provenanceCounts(result: AssessmentCalculationResult, input: NormalizedAssessmentInput): EvidenceQuality["provenance"] {
  const ctx = contextOf(input);
  const c = { userInputs: 0, sourced: 0, illustrative: 0, derived: 0, conventions: 0, missingExcluded: 0 };
  for (const a of result.assumptions) {
    switch (classifyAssumption(a, ctx)) {
      case "user": c.userInputs++; break;
      case "sourced": c.sourced++; break;
      case "illustrative": c.illustrative++; break;
      case "derived": c.derived++; break;
      case "convention": c.conventions++; break;
      case "excluded": c.missingExcluded++; break;
    }
  }
  return c;
}

/** Material assumptions come from the decision itself: reason codes, tested drivers and solved thresholds. Not from the form. */
export function materialAssumptions(result: AssessmentCalculationResult, analysis: AnalysisRecord | null): MaterialAssumption[] {
  const map = new Map<string, string[]>();
  const add = (label: string, why: string) => map.set(label, [...(map.get(label) ?? []), why]);
  for (const t of GREEN) {
    const c = result.commercial[t];
    for (const x of [...c.hardConstraints, ...c.conditions, ...c.uncertainties]) {
      const label = CODE_ASSUMPTION[x.code];
      if (label) add(label, `${TECH_NAMES[t]}: it shapes the commercial result (${x.code}).`);
    }
    const d = analysis?.drivers[t];
    if (d && d.status === "ok") {
      d.rows.slice(0, 3).filter((r) => r.spread > 0).forEach((r, i) => add(r.label, `${TECH_NAMES[t]}: tested driver number ${i + 1} of NPV, under the tested ranges.`));
    }
    const v = analysis?.viability[t];
    if (v) for (const th of [...v.economicThresholds, ...v.classificationThresholds]) if (th.status === "FOUND" || (th.status === "ALREADY_SATISFIED" && th.thresholdValue !== null)) add(th.variableLabel, `${TECH_NAMES[t]}: a model threshold was solved for it.`);
  }
  return [...map].map(([label, because]) => ({ label, because: [...new Set(because)] }));
}

function envDimension(r: AssessmentCalculationResult, t: GreenTechId): EvidenceDimension {
  const cmp = t === "bev" ? r.environmental.bevVsDiesel : r.environmental.biofuelVsDiesel;
  if (cmp.status === "calculated") return { label: "Environmental", state: "Complete", detail: "Compatible emission factors were supplied for diesel and this alternative." };
  const some = r.environmental.diesel.status === "calculated" || r.environmental[t].status === "calculated";
  return { label: "Environmental", state: some ? "Partial" : "Unavailable", detail: cmp.unavailableReason ?? "No compatible emission factor was supplied." };
}

export function buildEvidenceQuality(result: AssessmentCalculationResult, input: NormalizedAssessmentInput, analysis: AnalysisRecord | null): EvidenceQuality {
  const dc = result.dataCompleteness;
  const dimensions = {} as EvidenceQuality["dimensions"];
  const statements = {} as EvidenceQuality["statements"];
  const criticalMissing: EvidenceQuality["criticalMissing"] = [];
  const materialUncertainties: EvidenceQuality["materialUncertainties"] = [];
  for (const t of GREEN) {
    const c = result.commercial[t];
    const op = t === "bev" ? dc.operational.bev : dc.operational.biofuel;
    const econ: EvidenceDimension = { label: "Economic", state: c.economicCase === "INSUFFICIENT_DATA" ? "Insufficient" : word(dc.economic.state), detail: dc.economic.missing.length > 0 ? `${dc.economic.missing.length} optional cost ${dc.economic.missing.length === 1 ? "assumption was" : "assumptions were"} not entered or left out: ${dc.economic.missing.join(", ")}.` : "No cost assumption that shapes the figures is missing." };
    const oper: EvidenceDimension = { label: "Operational", state: word(op.state), detail: `${op.provided} of ${op.total} evidence items answered${op.missing.length ? `. Not answered: ${op.missing.join(", ")}` : ""}.` };
    dimensions[t] = { economic: econ, operational: oper, environmental: envDimension(result, t) };
    for (const m of c.criticalMissing) criticalMissing.push({ technology: t, text: m.text });
    for (const u of c.uncertainties) materialUncertainties.push({ technology: t, text: u.text });

    const env = dimensions[t].environmental.state;
    const parts: string[] = [];
    if (c.classification === "INSUFFICIENT_EVIDENCE") {
      parts.push(`Commercial classification is limited by missing critical evidence${c.criticalMissing[0] ? `: ${c.criticalMissing[0].text.replace(/\.$/, "")}` : ""}.`);
    } else {
      const unc = c.uncertainties.length;
      parts.push(unc > 0 ? `Economic and operational evidence are sufficient, but ${unc === 1 ? "one material uncertainty remains" : `${unc} material uncertainties remain`}.` : "Commercial classification is supported by sufficient economic and operational evidence.");
    }
    parts.push(env === "Complete" ? "Environmental comparison is available." : env === "Partial" ? "Environmental comparison is incomplete." : "Environmental comparison is unavailable.");
    statements[t] = parts.join(" ");
  }
  const names = GREEN.filter((t) => result.commercial[t].classification === "INSUFFICIENT_EVIDENCE").map((t) => TECH_NAMES[t]);
  const overall = names.length > 0 ? `Commercial classification cannot be completed for ${joinList(names)} because critical evidence is missing. ` + "The other alternative is assessed on its own evidence." : "Commercial classification is supported by sufficient economic and operational evidence for both alternatives" + (materialUncertainties.length > 0 ? `, with ${materialUncertainties.length} material ${materialUncertainties.length === 1 ? "uncertainty" : "uncertainties"} noted.` : ".");
  return {
    dimensions,
    provenance: provenanceCounts(result, input),
    criticalMissing,
    materialUncertainties,
    statements,
    overall: names.length === 2 ? "Commercial classification cannot be completed for either alternative because critical evidence is missing." : overall,
    materialAssumptions: materialAssumptions(result, analysis),
    confidenceNote: CONFIDENCE_NOTE,
    statisticalConfidence: "not calculated",
  };
}
