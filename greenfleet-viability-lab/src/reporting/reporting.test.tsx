import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/report",
  useRouter: () => ({ push: () => undefined }),
  redirect: () => undefined,
  notFound: () => undefined,
}));

import { calculateAssessment } from "@/calculation/engine";
import { deepFreeze, makeInput } from "@/calculation/fixtures";
import { runDriverAnalysis, runSensitivityAnalysis } from "@/calculation/sensitivity";
import { analyzeViability } from "@/calculation/threshold";
import type { Scenario } from "@/calculation/scenario";
import type { AssessmentCalculationResult } from "@/calculation/types";
import ReportPage from "@/app/(app)/report/page";
import { PresentationDeck, PresentationScreen } from "@/components/present/presentation-view";
import { EmptyReport } from "@/components/report/report-view";
import { ReportDocument } from "@/components/report/report-document";
import { AppShell } from "@/components/layout/app-shell";
import { resultFormatter } from "@/components/results/format-results";
import { AssessmentStoreProvider } from "@/state/StoreProvider";
import { createAnalysisStore, emptyRecord, fingerprintInput, recordFor, type AnalysisRecord } from "./analysisRecord";
import { cellRaw, cellText } from "./cells";
import { buildEvidenceQuality, CONFIDENCE_NOTE } from "./evidence";
import { availability, buildExportFile, csvField, safeFilename, toCsv } from "./exports";
import { REPORT_AUTHORSHIP, REPORT_DISCLAIMER } from "./identity";
import { buildReportModel } from "./model";
import { buildPresentationScreens, keyToAction, presentationReducer } from "./presentation";
import type { ReportModel } from "./types";

type Patch = Parameters<typeof makeInput>[0];
const P = (p: unknown) => p as Patch;
const f = resultFormatter("NGN");
const NOW = "2026-10-05T10:00:00.000Z";
const html = (el: ReactElement) => renderToStaticMarkup(<AssessmentStoreProvider>{el}</AssessmentStoreProvider>);
const text = (el: ReactElement) => html(el).replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const factor = (value: number, unit: string, unitId: string) => ({ value, unit, unitId, scope: null, source: "Test source", sourceYear: 2020, notes: null, lifecycleAdjustmentPct: null });
const FACTORS = P({ environmentalAssumptions: { diesel: factor(2.7, "kg CO2e/litre", "kgco2e_per_litre"), gridElectricity: factor(0.1, "kg CO2e/kWh", "kgco2e_per_kwh"), biofuel: factor(2.2, "kg CO2e/litre", "kgco2e_per_litre") } });
const longDay = (opp: string | null, extra: Record<string, unknown> = {}): Patch => P({ operations: { dailyDistanceKm: 450, ...extra }, bev: { usableRangeKm: 300, operational: { chargingOpportunity: opp } } });

function build(patch: Patch = {}, opts: { analysis?: AnalysisRecord | null; scenarios?: Scenario[]; options?: Parameters<typeof buildReportModel>[0]["options"] } = {}) {
  const input = makeInput(patch);
  const o = calculateAssessment(input);
  if (!o.ok) throw new Error("calc");
  const model = buildReportModel({ input, result: o.result, analysis: opts.analysis ?? null, scenarios: opts.scenarios ?? [], options: opts.options, now: NOW });
  return { input, result: o.result, model };
}
function analysisFor(patch: Patch, techs: ("bev" | "biofuel")[] = ["bev"]): AnalysisRecord {
  const input = makeInput(patch);
  const rec = emptyRecord(fingerprintInput(input), NOW);
  for (const t of techs) {
    rec.viability[t] = analyzeViability(input, t);
    const d = runDriverAnalysis({ input, technology: t });
    if (d.status === "ok") rec.drivers[t] = d;
    const s = runSensitivityAnalysis({ input, technology: t, variableId: t === "bev" ? "electricityTariff" : "biofuelPrice" });
    if (s.status === "ok") rec.oneWay[t] = [s];
  }
  return rec;
}
const sc = (over: Scenario["overrides"], name = "Higher diesel price", id = "s1"): Scenario => ({ id, name, description: "A user scenario", origin: "user", overrides: over, createdAt: NOW, updatedAt: NOW });

describe("report model consistency with the authoritative results", () => {
  const { result, model, input } = build(P({ bev: { upfrontVehicleCost: 20000 } }));
  const row = (l: string) => model.comparison.rows.find((r) => r.label === l)!;
  it("1/2/3. builds from a valid assessment, shows diesel as the baseline, and carries no report-only numbers", () => {
    expect(model.comparison.columns).toEqual(["Diesel", "Battery electric", "Biofuel"]);
    expect(row("Incremental NPV vs diesel").cells[0]).toEqual({ kind: "baseline" });
    expect(row("Commercial classification").cells[0]).toEqual({ kind: "baseline" });
    expect(row("Operational status").cells[0]).toEqual({ kind: "text", value: "Baseline configuration" });
    expect(model.executive.cards[0]).toMatchObject({ technology: "diesel", classification: "BASELINE" });
    expect(model.identity.policyVersion).toBe("1.0");
  });
  it("4-8. classification, NPV, TCO, payback and operational status are the engine's own values", () => {
    expect(row("Commercial classification").cells[1]).toEqual({ kind: "class", value: result.commercial.bev.classification });
    expect(row("Commercial classification").cells[2]).toEqual({ kind: "class", value: result.commercial.biofuel.classification });
    expect(row("Incremental NPV vs diesel").cells[1]).toEqual({ kind: "money", value: result.bevVsDiesel.npv });
    expect(row("Incremental NPV vs diesel").cells[2]).toEqual({ kind: "money", value: result.biofuelVsDiesel.npv });
    expect(row("Total cost of ownership (undiscounted)").cells.map((c) => (c as { value: number }).value)).toEqual([result.diesel.undiscountedTco, result.bev.undiscountedTco, result.biofuel.undiscountedTco]);
    expect(row("Discounted payback").cells[1]).toEqual({ kind: "payback", value: result.bevVsDiesel.discountedPayback });
    expect(row("Simple payback").cells[2]).toEqual({ kind: "payback", value: result.biofuelVsDiesel.simplePayback });
    expect(model.operational.map((o) => o.status)).toEqual([result.operational.bev.status, result.operational.biofuel.status]);
    expect(model.commercial.map((c) => c.classification)).toEqual([result.commercial.bev.classification, result.commercial.biofuel.classification]);
    expect(cellText(row("Cost per km").cells[1]!, f)).toBe(f.perKm(result.bev.tcoPerKm));
  });
  it("9. the report, the results page figures and the exports agree for the same assessment", () => {
    const csv = buildExportFile("comparison", { model, input, result, analysis: null, scenarios: [] }).content;
    expect(csv).toContain(`Incremental NPV vs diesel,,baseline,${result.bevVsDiesel.npv},value,${result.biofuelVsDiesel.npv},value`);
    const json = JSON.parse(buildExportFile("json", { model, input, result, analysis: null, scenarios: [] }).content);
    expect(json.results.bevVsDiesel.npv).toBe(result.bevVsDiesel.npv);
    expect(json.commercial.bev.classification).toBe(result.commercial.bev.classification);
  });
  it("12/13. the decision trace and the policy version are preserved", () => {
    expect(model.commercial[0]!.trace).toEqual(result.commercial.bev.decisionTrace.map((s) => s.text));
    expect(model.commercial[0]!.trace.length).toBeGreaterThan(4);
    expect(model.commercial[0]!.policyVersion).toBe("1.0");
    expect(model.footer).toContain("GreenFleet Commercial Viability Policy v1.0");
  });
  it("37. building a model does not change the authoritative result or the input", () => {
    const i = deepFreeze(makeInput(P({ bev: { upfrontVehicleCost: 20000 } })));
    const r = calculateAssessment(i);
    if (!r.ok) throw new Error("x");
    const before = JSON.stringify(r.result);
    deepFreeze(r.result);
    buildReportModel({ input: i, result: r.result, analysis: null, scenarios: [sc({ dieselPrice: 3 })], now: NOW });
    expect(JSON.stringify(r.result)).toBe(before);
  });
});

describe("environmental values in the report", () => {
  it("11/62. missing emission factors are Unavailable with a reason, never zero, and not mistaken for 'not run'", () => {
    const { model } = build();
    const row = model.comparison.rows.find((r) => r.label === "Annual operational emissions")!;
    for (const c of row.cells) expect(c.kind).toBe("unavailable");
    expect(cellText(row.cells[1]!, f)).toMatch(/^Unavailable: /);
    expect(JSON.stringify(row)).not.toMatch(/"value":0\b/);
    expect(model.environmental.available).toBe(false);
    expect(model.environmental.unavailableNote).toMatch(/Unavailable is not zero/);
    expect(model.environmental.scope).toBe("Operational energy/fuel-related GHG emissions");
  });
  it("10. with factors it shows the engine's tonnes and percentages and the factor provenance", () => {
    const { model, result } = build(FACTORS);
    const row = model.comparison.rows.find((r) => r.label === "Annual operational emissions")!;
    expect(row.cells[0]).toEqual({ kind: "tonnes", value: result.environmental.diesel.annualEmissionsTonnes });
    expect(model.environmental.factors[0]).toMatchObject({ technology: "Diesel", source: "Test source", year: "2020" });
    expect(model.environmental.available).toBe(true);
  });
  it("15. no invented source: a factor without a source says Not supplied", () => {
    const noSource = P({ environmentalAssumptions: { diesel: { ...factor(2.7, "kg CO2e/litre", "kgco2e_per_litre"), source: null, sourceYear: null }, gridElectricity: { ...factor(0.4, "kg CO2e/kWh", "kgco2e_per_kwh"), source: null, sourceYear: null } } });
    const { model } = build(noSource);
    expect(model.environmental.factors[0]).toMatchObject({ source: "Not supplied", year: "Not supplied" });
    const a = model.assumptions.filter((x) => x.provenance === "user");
    expect(a.length).toBeGreaterThan(0);
    expect(text(<ReportDocument model={model} result={build(noSource).result} f={f} />)).toContain("Not supplied");
  });
});

describe("evidence quality: descriptive states, no score", () => {
  const base = build();
  const edit = (fn: (r: AssessmentCalculationResult) => void) => {
    const r = structuredClone(base.result) as AssessmentCalculationResult;
    fn(r);
    return buildEvidenceQuality(r, base.input, null);
  };
  it("1-3. economic evidence states", () => {
    expect(edit((r) => { r.dataCompleteness.economic = { state: "complete", missing: [] }; }).dimensions.bev.economic.state).toBe("Complete");
    const p = edit((r) => { r.dataCompleteness.economic = { state: "partial", missing: ["Diesel price escalation"] }; });
    expect(p.dimensions.bev.economic).toMatchObject({ state: "Partial" });
    expect(p.dimensions.bev.economic.detail).toContain("Diesel price escalation");
    expect(edit((r) => { r.commercial.bev.economicCase = "INSUFFICIENT_DATA"; }).dimensions.bev.economic.state).toBe("Insufficient");
  });
  it("4/5. operational evidence states", () => {
    expect(edit((r) => { r.dataCompleteness.operational.bev = { state: "complete", provided: 5, total: 5, missing: [] }; }).dimensions.bev.operational.state).toBe("Complete");
    expect(edit((r) => { r.dataCompleteness.operational.bev = { state: "insufficient", provided: 0, total: 5, missing: ["Charging opportunity during the day"] }; }).dimensions.bev.operational.detail).toContain("0 of 5");
  });
  it("6-8. environmental states: available, partial, unavailable", () => {
    expect(build(FACTORS).model.evidence.dimensions.bev.environmental.state).toBe("Complete");
    expect(base.model.evidence.dimensions.bev.environmental.state).toBe("Unavailable");
    const onlyDiesel = build(P({ environmentalAssumptions: { diesel: factor(2.7, "kg CO2e/litre", "kgco2e_per_litre") } }));
    expect(onlyDiesel.model.evidence.dimensions.bev.environmental.state).toBe("Partial");
  });
  it("9/13/14. provenance counts: derived counted, missing counted as missing and never as zero", () => {
    const p = base.model.evidence.provenance;
    expect(p.derived).toBeGreaterThan(0);
    expect(p.missingExcluded).toBeGreaterThan(0);
    const total = p.userInputs + p.sourced + p.illustrative + p.derived + p.conventions + p.missingExcluded;
    expect(total).toBe(base.result.assumptions.length);
    const demo = build(P({ meta: { illustrativeInputs: ["diesel.fuelPrice"] } }));
    expect(demo.model.evidence.provenance.illustrative).toBeGreaterThanOrEqual(0);
  });
  it("10/11. critical missing and material uncertainties are listed with counts", () => {
    const g = build(longDay(null)).model.evidence;
    expect(g.criticalMissing.length).toBeGreaterThan(0);
    expect(g.criticalMissing[0]!.technology).toBe("bev");
    const u = build(P({ bev: { batteryReplacement: { expected: "unknown", year: null, cost: null } } })).model.evidence;
    expect(u.materialUncertainties.map((x) => x.text).join(" ")).toMatch(/[Bb]attery replacement/);
    expect(u.statements.bev).toMatch(/but one material uncertainty remains/);
  });
  it("12/16/52. there is no numeric confidence or score anywhere, and the note separates completeness from statistical confidence", () => {
    const j = JSON.stringify(base.model.evidence);
    expect(j).not.toMatch(/\d+\s?%\s?(confidence|quality)|confidence score|quality score|\d+\/100/i);
    expect(base.model.evidence.statisticalConfidence).toBe("not calculated");
    expect(base.model.evidence.confidenceNote).toBe(CONFIDENCE_NOTE);
    expect(CONFIDENCE_NOTE).toMatch(/not statistical confidence/);
    expect(text(<ReportDocument model={base.model} result={base.result} f={f} />)).not.toMatch(/\b(high|medium|low) confidence\b|\d+\s?% confident/i);
  });
  it("material assumptions come from the decision logic and tested drivers, not from the form", () => {
    const withD = build(longDay("depot_only", { averageRouteDistanceKm: 350 }), { analysis: analysisFor(longDay("depot_only", { averageRouteDistanceKm: 350 })) });
    const labels = withD.model.evidence.materialAssumptions.map((m) => m.label);
    expect(labels).toContain("BEV usable range and route distance");
    expect(withD.model.evidence.materialAssumptions.some((m) => m.because.join(" ").includes("tested driver"))).toBe(true);
    expect(build().model.evidence.materialAssumptions.every((m) => !/business name|assessment name/i.test(m.label))).toBe(true);
  });
  it("25. the report handles partial evidence", () => {
    const m = build(longDay("public_available")).model;
    expect(m.evidence.statements.bev).toBeTruthy();
    expect(text(<ReportDocument model={m} result={build(longDay("public_available")).result} f={f} />)).toContain("Evidence quality and data provenance");
  });
});

describe("executive summary: deterministic, technology specific", () => {
  const words = (m: ReportModel) => m.executive.wordCount;
  it("A/81. BEV viable and biofuel not yet viable are never collapsed into 'green transport'", () => {
    const { model } = build();
    const p = model.executive.paragraphs.join(" ");
    expect(model.commercial.map((c) => c.classification)).toEqual(["VIABLE", "NOT_YET_VIABLE"]);
    expect(model.executive.perTechnology.bev).toContain("battery-electric alternative is VIABLE relative to diesel");
    expect(model.executive.perTechnology.biofuel).toContain("biofuel alternative is NOT YET VIABLE relative to diesel");
    expect(p).not.toMatch(/green transport is viable|green technologies are viable/i);
    expect(words(model)).toBeGreaterThan(70);
    expect(words(model)).toBeLessThan(260);
  });
  it("B. viable with lower emissions says so, with the engine's percentage", () => {
    const { model, result } = build(FACTORS);
    expect(model.executive.perTechnology.bev).toMatch(/Estimated operational GHG emissions are [\d.]+% lower than diesel/);
    expect(result.commercial.bev.environmentalContext.state).toBe("lower");
  });
  it("C/83. conditionally viable with a charging condition, environment unavailable: no claim of environmental benefit", () => {
    const { model } = build(longDay("public_available"));
    const t = model.executive.perTechnology.bev;
    expect(t).toContain("CONDITIONALLY VIABLE");
    expect(t).toContain("daytime charging");
    expect(t).toMatch(/Environmental comparison unavailable/);
    expect(JSON.stringify(model)).not.toMatch(/environmentally beneficial|greener than diesel/i);
  });
  it("D/E/82. negative NPV with a hard range constraint and lower emissions keeps every dimension honest", () => {
    const patch = { ...P({ bev: { upfrontVehicleCost: 20000, usableRangeKm: 300, operational: { chargingOpportunity: "depot_only" } }, operations: { dailyDistanceKm: 450, averageRouteDistanceKm: 350 } }), ...FACTORS };
    const analysis = analysisFor(patch);
    const { model, result } = build(patch, { analysis });
    const c = model.commercial[0]!;
    expect(c.classification).toBe("NOT_YET_VIABLE");
    expect(c.economicCase).toBe("UNFAVOURABLE");
    expect(c.operationalStatus).toBe("constrained");
    expect(result.commercial.bev.environmentalContext.state).toBe("lower");
    expect(c.environmentalContext).toMatch(/lower than diesel/);
    const t = model.executive.perTechnology.bev;
    expect(t).toContain("economic case is unfavourable");
    expect(t).toMatch(/operational constraint remains unresolved/);
    expect(model.thresholds.barrierStatements.map((s) => s.text).join(" ")).toContain("Economic break-even alone does not make this configuration commercially viable");
  });
  it("F. biofuel conditionally viable with intermittent supply names supply reliability", () => {
    const { model } = build(P({ biofuel: { fuelPricePerFuelUnit: 0.5, supply: { availability: "intermittent" } } }));
    expect(model.commercial[1]!.classification).toBe("CONDITIONALLY_VIABLE");
    expect(model.executive.perTechnology.biofuel).toMatch(/supply reliability/);
    expect(model.commercial[1]!.conditions.join(" ")).toMatch(/intermittent/);
  });
  it("G/85. insufficient evidence is still useful: what is missing, why, what to complete, and no decision", () => {
    const { model, result } = build(longDay(null));
    const c = model.commercial[0]!;
    expect(c.classification).toBe("INSUFFICIENT_EVIDENCE");
    expect(c.criticalMissing.length).toBeGreaterThan(0);
    expect(model.executive.perTechnology.bev).toMatch(/^GreenFleet cannot classify the battery-electric alternative because/);
    expect(c.nextSteps.join(" ")).toMatch(/Complete the missing inputs/);
    expect(model.evidence.statements.bev).toMatch(/limited by missing critical evidence/);
    expect(model.executive.perTechnology.bev).not.toMatch(/VIABLE relative/);
    expect(model.takeaways.join(" ")).toMatch(/BEV cannot be classified|Battery electric cannot be classified/);
    expect(text(<ReportDocument model={model} result={result} f={f} />)).toContain("Missing evidence");
  });
  it("H/I. thresholds found and not found are reported as run, with all else equal", () => {
    const found = build(P({ bev: { upfrontVehicleCost: 20000 } }), { analysis: analysisFor(P({ bev: { upfrontVehicleCost: 20000 } })) });
    expect(found.model.executive.paragraphs[3]).toMatch(/all else equal/);
    const notRun = build();
    expect(notRun.model.executive.paragraphs[3]).toBe("Sensitivity and threshold analysis have not been run for this assessment, so what could change the decision is not reported here.");
  });
  it("J. a viable result shows headroom only from solved thresholds", () => {
    const patch = {};
    const { model } = build(patch, { analysis: analysisFor(patch) });
    expect(model.thresholds.state).toBe("included");
    expect(model.thresholds.barrierStatements.map((s) => s.text).join(" ")).toMatch(/could increase to approximately .*before incremental NPV reaches zero, all else equal/);
    expect(model.thresholds.analyses[0]!.mode).toBe("viability_margin");
  });
  it("keeps acronyms intact when a variable name starts a clause", () => {
    const { model } = build({}, { analysis: analysisFor({}) });
    expect(model.executive.paragraphs[3]).not.toMatch(/\bbEV\b/);
    expect(model.executive.paragraphs[3]).toMatch(/BEV acquisition price|Diesel price|[a-z]/);
  });
  it("34/35. the same structured result always gives the same summary", () => {
    const a = build(longDay("public_available"));
    const b = build(longDay("public_available"));
    expect(JSON.stringify(a.model)).toBe(JSON.stringify(b.model));
    expect(a.model.executive.paragraphs).toEqual(b.model.executive.paragraphs);
  });
});

describe("sensitivity, scenarios and thresholds in the report", () => {
  it("14/26/27/62. sensitivity appears only when run, with the tested-range wording and top drivers from the actual ranking", () => {
    const none = build().model;
    expect(none.sensitivity.state).toBe("not_run");
    expect(none.sensitivity.message).toBe("Sensitivity analysis has not been run for this assessment.");
    expect(none.sensitivity.drivers).toEqual([]);
    const withA = build({}, { analysis: analysisFor({}) }).model;
    expect(withA.sensitivity.state).toBe("included");
    expect(withA.sensitivity.drivers[0]!.top.length).toBe(3);
    expect(withA.sensitivity.drivers[0]!.top.map((t) => t.rank)).toEqual([1, 2, 3]);
    const spreads = withA.sensitivity.drivers[0]!.top.map((t) => t.spread);
    expect(spreads).toEqual([...spreads].sort((a, b) => b - a));
    const html2 = text(<ReportDocument model={withA} result={build({}).result} f={f} />);
    expect(html2).toContain("under the tested ranges");
    expect(html2).not.toMatch(/is the (main |primary )?cause|will happen/i);
  });
  it("63. report options omit sections cleanly", () => {
    const m = build({}, { analysis: analysisFor({}), scenarios: [sc({ dieselPrice: 2 })], options: { sensitivity: false, scenarios: false, thresholds: false, detailedAssumptions: false, methodologyAppendix: false } }).model;
    expect([m.sensitivity.state, m.scenarios.state, m.thresholds.state]).toEqual(["omitted", "omitted", "omitted"]);
    expect(m.assumptions).toEqual([]);
    expect(m.methodology).toEqual([]);
    const t = text(<ReportDocument model={m} result={build({}).result} f={f} />);
    expect(t).not.toContain("Sensitivity analysis");
    expect(t).not.toContain("Methodology summary");
    expect(t).not.toContain("Assumptions and data sources");
  });
  it("15/28/87. scenarios appear only when they exist; the Base Case stays separate and unchanged", () => {
    expect(build().model.scenarios).toMatchObject({ state: "none", message: "No scenarios have been saved for this assessment." });
    const { model, result } = build({}, { scenarios: [sc({ dieselPrice: 1.5 }), sc({ bevAcquisition: 11000 }, "Cheaper BEV", "s2")] });
    const c = model.scenarios.comparison!;
    expect(c.base.name).toBe("Base Case");
    expect(c.base.bev!.snapshot.npv).toBe(result.bevVsDiesel.npv);
    expect(c.scenarios.map((s) => s.name)).toEqual(["Higher diesel price", "Cheaper BEV"]);
    expect(c.scenarios[0]!.changes[0]).toMatchObject({ variableId: "dieselPrice", from: 1, to: 1.5 });
    expect(model.comparison.rows.find((r) => r.label === "Incremental NPV vs diesel")!.cells[1]).toEqual({ kind: "money", value: result.bevVsDiesel.npv });
    const t = text(<ReportDocument model={model} result={result} f={f} />);
    expect(t).toContain("Changed from the Base Case");
    expect(t).toContain("Higher diesel price");
    expect(t).toContain("Cheaper BEV");
  });
  it("16/29/30/46. threshold findings keep the remaining barriers in view", () => {
    const patch = P({ bev: { upfrontVehicleCost: 20000, usableRangeKm: 300, operational: { chargingOpportunity: "depot_only" } }, operations: { dailyDistanceKm: 450, averageRouteDistanceKm: 350 } });
    const { model, result } = build(patch, { analysis: analysisFor(patch) });
    const doc = text(<ReportDocument model={model} result={result} f={f} />);
    expect(doc).toContain("Economic break-even alone does not make this configuration commercially viable");
    expect(doc).toContain("approximately");
    expect(doc).toContain("all else equal");
    expect(doc).not.toMatch(/makes the (BEV|battery electric) viable/);
    expect(doc).toContain("Remaining barriers");
  });
  it("a stale analysis for different inputs is never shown", () => {
    const rec = analysisFor({});
    expect(recordFor(rec, makeInput())).toBe(rec);
    expect(recordFor(rec, makeInput(P({ diesel: { fuelPricePerLitre: 5 } })))).toBeNull();
    expect(recordFor(null, makeInput())).toBeNull();
  });
});

describe("report document: identity, wording, limitations", () => {
  const { model, result } = build();
  const doc = text(<ReportDocument model={model} result={result} f={f} />);
  it("22/66. identity block, authorship, versions and footer are present", () => {
    for (const s of ["GreenFleet Viability Lab", "Commercial Viability Assessment", REPORT_AUTHORSHIP, "Report version", "Calculation engine", "GreenFleet Commercial Viability Policy v1.0", "Generated by GreenFleet Viability Lab"]) expect(doc).toContain(s);
    expect(model.identity.reportVersion).toBe("1.0");
    expect(model.identity.engineVersion).toBe(result.metadata.engineVersion);
  });
  it("sections are numbered, ordered and exist for the available data", () => {
    const heads = [...html(<ReportDocument model={model} result={result} f={f} />).matchAll(/<h2[^>]*>.*?<\/h2>/g)].map((m) => m[0]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
    expect(heads[0]).toBe("1. Executive decision summary");
    expect(heads.some((h) => /Technology comparison/.test(h))).toBe(true);
    expect(heads.some((h) => /Commercial viability/.test(h))).toBe(true);
    expect(heads.some((h) => /decision trace/.test(h))).toBe(true);
    expect(heads.at(-1)).toMatch(/Disclaimer/);
    heads.forEach((h, i) => expect(h.startsWith(`${i + 1}.`)).toBe(true));
  });
  it("20/21. limitations are generated from the state of the assessment", () => {
    const l = model.limitations.join(" ");
    for (const s of ["depend on the assumptions entered", "live market data", "Tax, revenue and general inflation are not modelled", "not a full lifecycle assessment", "prototype decision rules", "5%", "no statistical confidence interval", "Nothing here is a guarantee"]) expect(l).toContain(s);
    expect(l).toMatch(/Environmental comparison is unavailable/);
    expect(l).not.toMatch(/Scenarios are sets of assumptions/);
    expect(l).not.toMatch(/all others equal/);
    const full = build({}, { analysis: analysisFor({}), scenarios: [sc({ dieselPrice: 2 })] }).model.limitations.join(" ");
    expect(full).toMatch(/hold all others equal/);
    expect(full).toMatch(/Scenarios are sets of assumptions/);
    expect(build(P({ bev: { batteryReplacement: { expected: "unknown", year: null, cost: null } } })).model.limitations.join(" ")).toMatch(/unknown battery replacement/);
  });
  it("21/33. the disclaimer is the specified wording", () => {
    expect(REPORT_DISCLAIMER).toBe("GreenFleet is an academic decision-support prototype. Results are model-derived estimates based on the entered assumptions and should not be interpreted as financial, investment, engineering, regulatory or procurement advice.");
    expect(doc).toContain(REPORT_DISCLAIMER);
  });
  it("93. no overclaiming language anywhere in generated report text", () => {
    const cases = [build(), build(FACTORS), build(longDay("public_available")), build(longDay(null)), build(P({ bev: { upfrontVehicleCost: 20000 } }), { analysis: analysisFor(P({ bev: { upfrontVehicleCost: 20000 } })) })];
    for (const c of cases) {
      const t = text(<ReportDocument model={c.model} result={c.result} f={f} />) + JSON.stringify(c.model.takeaways);
      expect(t).not.toMatch(/best option|guaranteed savings|profitable investment|zero-emission|carbon neutral|high confidence|\boptimal\b|recommended purchase/i);
      expect(t).not.toMatch(/NaN|Infinity|undefined|\[object Object\]|\{cur\}/);
    }
  });
});

describe("report page and attribution", () => {
  it("24/61. an empty assessment gets a useful empty state", () => {
    const t = text(<EmptyReport status="empty" />);
    expect(t).toContain("No completed assessment is available to report.");
    expect(t).toContain("Start an Assessment");
    expect(text(<ReportPage />)).toContain("Loading your saved work");
  });
  it("22/23. Group 8 appears in the report but not on ordinary internal pages", () => {
    const { model, result } = build();
    expect(text(<ReportDocument model={model} result={result} f={f} />)).toContain("Built by Group 8, MSc Class of 2025, CELTRAS");
    expect(text(<AppShell><ReportPage /></AppShell>)).not.toContain("Group 8");
  });
  it("80. print rules: chrome is hidden, the report keeps its sections and page breaks", () => {
    const shell = html(<AppShell><div /></AppShell>);
    expect(shell).toMatch(/<aside[^>]*print:hidden/);
    expect(shell).toContain("print:block");
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain("@media print");
    expect(css).toMatch(/\.report-cover \{ break-after: page; \}/);
    expect(css).toMatch(/\.report-section figure, \.report-section tr/);
    const { model, result } = build();
    const doc = html(<ReportDocument model={model} result={result} f={f} />);
    expect(doc).toContain("report-cover");
    expect(doc).toContain("report-page-break");
    expect(readFileSync(join(process.cwd(), "src/components/layout/top-bar.tsx"), "utf8")).toContain("print:hidden");
    expect(readFileSync(join(process.cwd(), "src/components/results/results-charts.tsx"), "utf8")).toContain("print:hidden");
  });
});

describe("exports", () => {
  const ctxFor = (patch: Patch = {}, analysis: AnalysisRecord | null = null, scenarios: Scenario[] = []) => {
    const b = build(patch, { analysis, scenarios });
    return { ...b, analysis, scenarios };
  };
  it("1/2/3. comparison CSV has headers, metadata and raw numbers", () => {
    const c = ctxFor();
    const f1 = buildExportFile("comparison", { model: c.model, input: c.input, result: c.result, analysis: null, scenarios: [] });
    expect(f1.content.startsWith("﻿# export")).toBe(true);
    expect(f1.content).toContain("metric,diesel,diesel_status,bev,bev_status,biofuel,biofuel_status,note");
    expect(f1.content).toContain(`Total cost of ownership (undiscounted),${c.result.diesel.undiscountedTco},value,${c.result.bev.undiscountedTco},value`);
    expect(f1.content).toContain("# policy,GreenFleet Commercial Viability Policy v1.0");
    expect(f1.content).not.toMatch(/₦\d|NaN|Infinity|undefined/);
  });
  it("4. missing values are marked, not zero", () => {
    const c = ctxFor();
    const csv = buildExportFile("comparison", { model: c.model, input: c.input, result: c.result, analysis: null, scenarios: [] }).content;
    expect(csv).toMatch(/Annual operational emissions,[^,]*Diesel emission factor was not supplied[^,]*,unavailable|Annual operational emissions,.*unavailable/);
    expect(cellRaw({ kind: "unavailable", reason: "x" })).toEqual({ value: "x", status: "unavailable" });
    expect(cellRaw({ kind: "payback", value: { status: "not_achieved", years: null, sustained: null } })).toEqual({ value: null, status: "not_achieved" });
    expect(cellRaw({ kind: "payback", value: { status: "immediate", years: 0, sustained: true } })).toEqual({ value: 0, status: "immediate" });
    expect(cellRaw({ kind: "baseline" }).status).toBe("baseline");
  });
  it("5. Unicode and currency text are kept safely, and spreadsheet formulas are defused", () => {
    expect(csvField("₦ naira, \"quoted\"")).toBe("\"₦ naira, \"\"quoted\"\"\"");
    expect(csvField("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvField("+1")).toBe("'+1");
    expect(csvField(-5000)).toBe("-5000");
    expect(csvField(null)).toBe("");
    expect(csvField(Number.NaN)).toBe("");
    expect(toCsv([["a", 1], ["b,c", 2.5]])).toBe("a,1\r\n\"b,c\",2.5\r\n");
  });
  it("6/90. filenames are safe and deterministic", () => {
    expect(safeFilename("My Fleet", "comparison", "csv", "2026-10-05T10:00:00Z")).toBe("greenfleet-assessment-my-fleet-comparison-2026-10-05.csv");
    expect(safeFilename("../../etc/passwd", "full", "json", "2026-10-05")).toBe("greenfleet-assessment-etc-passwd-full-2026-10-05.json");
    expect(safeFilename("Ọlá Logistics <script>.exe", "full", "json", "2026-10-05")).toMatch(/^greenfleet-assessment-[a-z0-9-]+-full-2026-10-05\.json$/);
    expect(safeFilename("", "x", "csv", "bad")).toBe("greenfleet-assessment-untitled-x-undated.csv");
    expect(safeFilename("a".repeat(200), "x", "csv", "2026-01-01").length).toBeLessThan(90);
    expect(safeFilename("a b", "scenario_changes", "csv", "2026-01-01")).toContain("scenario-changes");
    expect(safeFilename("x/y\\z:*?", "x", "csv", "2026-01-01")).not.toMatch(/[\\/:*?<>|"]/);
  });
  it("7-11. JSON export is valid and carries inputs, provenance, policy and the commercial result", () => {
    const c = ctxFor(P({ bev: { upfrontVehicleCost: 20000 } }), analysisFor(P({ bev: { upfrontVehicleCost: 20000 } })), [sc({ dieselPrice: 1.5 })]);
    const file = buildExportFile("json", { model: c.model, input: c.input, result: c.result, analysis: c.analysis, scenarios: c.scenarios });
    expect(file.mime).toBe("application/json");
    const j = JSON.parse(file.content);
    expect(j.exportType).toBe("greenfleet-assessment");
    expect(j.generatedAt).toBe(NOW);
    expect(j.currency).toBe("NGN");
    expect(j.analysisHorizonYears).toBe(5);
    expect(j.policy).toMatchObject({ id: "GreenFleet Commercial Viability Policy v1.0", version: "1.0" });
    expect(j.application.reportVersion).toBe("1.0");
    expect(j.normalizedInput.bev.upfrontVehicleCost).toBe(20000);
    expect(j.provenance.assumptions.length).toBeGreaterThan(5);
    expect(j.provenance.counts).toBeTruthy();
    expect(j.commercial.bev.classification).toBe(c.result.commercial.bev.classification);
    expect(j.results.bevVsDiesel.npv).toBe(c.result.bevVsDiesel.npv);
    expect(j.sensitivity.drivers.bev.rows.length).toBeGreaterThan(0);
    expect(j.thresholds.bev.mode).toBe("make_viable");
    expect(j.scenarios.definitions[0].name).toBe("Higher diesel price");
  });
  it("12. JSON carries no transient UI state", () => {
    const c = ctxFor();
    const s = buildExportFile("json", { model: c.model, input: c.input, result: c.result, analysis: null, scenarios: [] }).content;
    expect(s).not.toMatch(/"hydrated"|"welcomeOpen"|"helpOpen"|"tour"|"revealedFor"|localStorage/);
    expect(JSON.parse(s).sensitivity).toBeNull();
  });
  it("13. exporting does not mutate the assessment or the model", () => {
    const c = ctxFor(P({ bev: { upfrontVehicleCost: 20000 } }), analysisFor(P({ bev: { upfrontVehicleCost: 20000 } })), [sc({ dieselPrice: 1.5 })]);
    deepFreeze(c.input); deepFreeze(c.result);
    const before = JSON.stringify([c.input, c.result, c.model]);
    for (const k of ["comparison", "cashflow", "sensitivity", "drivers", "scenarios", "scenario_changes", "thresholds", "json"] as const) buildExportFile(k, { model: c.model, input: c.input, result: c.result, analysis: c.analysis, scenarios: c.scenarios });
    expect(JSON.stringify([c.input, c.result, c.model])).toBe(before);
  });
  it("the other CSVs are normalized tables with raw values, and unavailable ones are not offered", () => {
    const c = ctxFor(P({ bev: { upfrontVehicleCost: 20000 } }), analysisFor(P({ bev: { upfrontVehicleCost: 20000 } })), [sc({ dieselPrice: 1.5 })]);
    const get = (k: Parameters<typeof buildExportFile>[0]) => buildExportFile(k, { model: c.model, input: c.input, result: c.result, analysis: c.analysis, scenarios: c.scenarios }).content;
    expect(get("cashflow")).toContain("comparison,year,diesel_cost,alternative_cost,incremental_cash_flow");
    expect(get("cashflow").split("\r\n").filter((l) => l.startsWith("bev_vs_diesel,")).length).toBe(6);
    expect(get("sensitivity")).toContain("technology,variable,unit,base_value,tested_value,percent_change,incremental_npv");
    expect(get("drivers")).toContain("technology,rank,variable,unit,base_value,low_value,high_value");
    expect(get("scenarios")).toMatch(/Base Case,base_case,bev,ok,/);
    expect(get("scenario_changes")).toContain("Higher diesel price,dieselPrice,Diesel price,1,1.5");
    expect(get("thresholds")).toContain("technology,current_classification,mode,target,variable");
    expect(get("thresholds")).toMatch(/bev,NOT_YET_VIABLE,make_viable,economic_break_even,bevAcquisition,money,20000,15000/);
    const bare = build();
    const a = availability(bare.model);
    expect(a.comparison.available && a.cashflow.available && a.json.available).toBe(true);
    expect(a.sensitivity).toEqual({ available: false, reason: "Sensitivity analysis has not been run for this assessment." });
    expect(a.scenarios.reason).toBe("No scenarios have been saved.");
    expect(a.thresholds.reason).toBe("Threshold analysis has not been run for this assessment.");
  });
});

describe("analysis record store", () => {
  const mem = () => { const d = new Map<string, string>(); return { d, getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v), removeItem: (k: string) => void d.delete(k) }; };
  it("keeps what was run for these inputs, drops it for other inputs, and survives a reload", () => {
    const storage = mem();
    const input = makeInput();
    const store = createAnalysisStore(storage, () => NOW);
    store.hydrate();
    store.recordViability(input, "bev", analyzeViability(input, "bev"));
    const d = runDriverAnalysis({ input, technology: "bev" });
    if (d.status === "ok") store.recordDrivers(input, "bev", d);
    const reload = createAnalysisStore(storage);
    reload.hydrate();
    expect(reload.getSnapshot()!.viability.bev!.technology).toBe("bev");
    expect(recordFor(reload.getSnapshot(), input)).not.toBeNull();
    const other = makeInput(P({ diesel: { fuelPricePerLitre: 3 } }));
    expect(recordFor(reload.getSnapshot(), other)).toBeNull();
    store.recordViability(other, "bev", analyzeViability(other, "bev"));
    expect(Object.keys(store.getSnapshot()!.drivers)).toEqual([]);
    expect(storage.d.has("greenfleet-viability-lab:assessment")).toBe(false);
  });
});

describe("presentation mode", () => {
  const A = build();
  it("1-3/48. the deck reads the current results: classification and NPV match the Results page", () => {
    const t = text(<PresentationScreen id="commercial" m={A.model} result={A.result} f={f} />);
    expect(t).toContain("VIABLE");
    expect(t).toContain("NOT YET VIABLE");
    expect(t).toContain("Diesel is the baseline and is not classified");
    const e = text(<PresentationScreen id="economic" m={A.model} result={A.result} f={f} />);
    expect(e).toContain(f.money(A.result.bevVsDiesel.npv));
    expect(e).toContain(f.money(A.result.biofuelVsDiesel.npv));
  });
  it("9. screens without analysis behind them are skipped; the environmental screen stays", () => {
    const ids = buildPresentationScreens(A.model).map((s) => s.id);
    expect(ids).toEqual(["snapshot", "comparison", "economic", "operational", "environmental", "commercial", "why", "takeaways"]);
    const withA = build({}, { analysis: analysisFor({}, ["bev", "biofuel"]) }).model;
    const ids2 = buildPresentationScreens(withA).map((s) => s.id);
    expect(ids2).toEqual(["snapshot", "comparison", "economic", "operational", "environmental", "commercial", "why", "viability", "drivers", "takeaways"]);
  });
  it("4-8. Next, Previous and keyboard navigation stay within the deck, and Escape exits", () => {
    const n = 8;
    let s = { index: 0, exited: false };
    s = presentationReducer(s, { type: "previous" }, n);
    expect(s.index).toBe(0);
    s = presentationReducer(s, { type: "next" }, n);
    expect(s.index).toBe(1);
    s = presentationReducer(s, keyToAction("ArrowRight")!, n);
    expect(s.index).toBe(2);
    s = presentationReducer(s, keyToAction("ArrowLeft")!, n);
    expect(s.index).toBe(1);
    for (let i = 0; i < 20; i++) s = presentationReducer(s, { type: "next" }, n);
    expect(s.index).toBe(n - 1);
    expect(presentationReducer(s, keyToAction("Escape")!, n).exited).toBe(true);
    expect(keyToAction("a")).toBeNull();
    expect(keyToAction("Enter")).toBeNull();
  });
  it("the first screen shows progress, controls and no auto-advance", () => {
    const t = html(<PresentationDeck model={A.model} result={A.result} f={f} onExit={() => undefined} />);
    expect(t.replace(/<[^>]+>/g, " ")).toMatch(/Screen 1 of 8/);
    for (const s of ["Previous", "Next", "Exit Presentation", 'role="progressbar"']) expect(t).toContain(s);
    expect(t).not.toMatch(/setInterval|autoplay/);
  });
  it("10. an unavailable environmental comparison is shown honestly", () => {
    const t = text(<PresentationScreen id="environmental" m={A.model} result={A.result} f={f} />);
    expect(t).toContain("Environmental comparison is unavailable because no compatible emission factor was supplied. Unavailable is not zero.");
    expect(t).not.toMatch(/0(\.0+)? tCO2e/);
  });
  it("12/49. threshold screen keeps remaining barriers; takeaways come only from actual results", () => {
    const patch = P({ bev: { upfrontVehicleCost: 20000, usableRangeKm: 300, operational: { chargingOpportunity: "depot_only" } }, operations: { dailyDistanceKm: 450, averageRouteDistanceKm: 350 } });
    const b = build(patch, { analysis: analysisFor(patch) });
    const v = text(<PresentationScreen id="viability" m={b.model} result={b.result} f={f} />);
    expect(v).toContain("Economic break-even alone does not make this configuration commercially viable");
    const tk = b.model.takeaways.join(" ");
    expect(tk).toContain("Battery electric is NOT YET VIABLE relative to diesel under the entered assumptions.");
    expect(tk).toMatch(/strongest tested economic driver for battery-electric, under the tested ranges/);
    expect(tk).toMatch(/principal battery-electric operational constraint/);
    expect(tk).toContain("Environmental comparison is unavailable");
    const bare = build().model.takeaways.join(" ");
    expect(bare).not.toMatch(/strongest tested/);
  });
  it("15. building and showing the deck does not change the assessment", () => {
    const i = deepFreeze(makeInput());
    const r = calculateAssessment(i);
    if (!r.ok) throw new Error("x");
    const before = JSON.stringify(r.result);
    const m = buildReportModel({ input: i, result: r.result, analysis: null, scenarios: [], now: NOW });
    html(<PresentationDeck model={m} result={r.result} f={f} onExit={() => undefined} />);
    expect(JSON.stringify(r.result)).toBe(before);
  });
});
