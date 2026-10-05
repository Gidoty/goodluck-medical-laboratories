import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/report",
  useRouter: () => ({ push: () => undefined }),
  redirect: () => undefined,
  notFound: () => undefined,
}));

import { MAX_SCENARIOS, compareScenarios, scenarioDraftFromThreshold, type Scenario } from "@/calculation/scenario";
import { runDriverAnalysis, runSensitivityAnalysis } from "@/calculation/sensitivity";
import { analyzeViability, solveViabilityThreshold } from "@/calculation/threshold";
import type { AssessmentCalculationResult } from "@/calculation/types";
import { PresentationScreen } from "@/components/present/presentation-view";
import { ReportDocument } from "@/components/report/report-document";
import { StartActions } from "@/components/assessment/start-actions";
import { resultFormatter } from "@/components/results/format-results";
import { DEMO_CASES, DEMO_NOTICE, createDemoAssessment, type DemoCaseId } from "@/domain/demo";
import { isUntouched } from "@/domain/mutations";
import type { NormalizedAssessmentInput } from "@/domain/normalized";
import { runAssessment } from "@/domain/runAssessment";
import { createAnalysisStore, emptyRecord, fingerprintInput, type AnalysisRecord } from "@/reporting/analysisRecord";
import { buildExportFile } from "@/reporting/exports";
import { buildReportModel } from "@/reporting/model";
import { buildPresentationScreens } from "@/reporting/presentation";
import { createAssessmentStore } from "@/state/assessmentStore";
import { AssessmentStoreProvider } from "@/state/StoreProvider";
import { setNum } from "@/test/helpers";

/**
 * The five SYNTHETIC DEMONSTRATION CASES, and the seven final end-to-end chains (A to G):
 *   stored input -> normalisation -> economics -> operations -> environment -> classification -> sensitivity ->
 *   threshold / margin -> report -> presentation -> export.
 */

const NOW = "2026-10-05T10:00:00.000Z";
const f = resultFormatter("NGN");
const html = (el: ReactElement) => renderToStaticMarkup(<AssessmentStoreProvider>{el}</AssessmentStoreProvider>);
const text = (el: ReactElement) => html(el).replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const LABEL = (c: string) => c.replace(/_/g, " ");

function chain(caseId: DemoCaseId | undefined, tweak: (a: ReturnType<typeof createDemoAssessment>) => ReturnType<typeof createDemoAssessment> = (a) => a, withAnalysis = true) {
  const assessment = tweak(createDemoAssessment("demo", NOW, caseId));
  const run = runAssessment(assessment);
  if (run.status !== "ok") throw new Error(`case ${caseId} did not calculate: ${JSON.stringify(run)}`);
  const { input, result } = run;
  let analysis: AnalysisRecord | null = null;
  if (withAnalysis) {
    analysis = emptyRecord(fingerprintInput(input), NOW);
    for (const t of ["bev", "biofuel"] as const) {
      analysis.viability[t] = analyzeViability(input, t);
      const d = runDriverAnalysis({ input, technology: t });
      if (d.status === "ok") analysis.drivers[t] = d;
      const s = runSensitivityAnalysis({ input, technology: t, variableId: t === "bev" ? "electricityTariff" : "biofuelPrice" });
      if (s.status === "ok") analysis.oneWay[t] = [s];
    }
  }
  return { assessment, input, result, analysis, scenarios: [] as Scenario[] };
}
function reportOf(c: ReturnType<typeof chain>) {
  const model = buildReportModel({ input: c.input, result: c.result, analysis: c.analysis, scenarios: c.scenarios, now: NOW });
  return { model, ctx: { model, input: c.input, result: c.result, analysis: c.analysis, scenarios: c.scenarios } };
}
const finite = (v: unknown, path = "$"): string[] => (typeof v === "number" ? (Number.isFinite(v) ? [] : [path]) : Array.isArray(v) ? v.flatMap((x, i) => finite(x, `${path}[${i}]`)) : v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => finite(x, `${path}.${k}`)) : []);

describe("The five synthetic demonstration cases", () => {
  it("there are exactly five, numbered 1 to 5, with distinct ids", () => {
    expect(DEMO_CASES.map((c) => c.number)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(DEMO_CASES.map((c) => c.id)).size).toBe(5);
  });
  it.each(DEMO_CASES.map((c) => [c.number, c.title, c] as const))("case %i (%s): expected classifications", (_n, _t, c) => {
    const r = chain(c.id, (a) => a, false).result;
    expect(LABEL(r.commercial.bev.classification)).toBe(c.expected.bev);
    expect(LABEL(r.commercial.biofuel.classification)).toBe(c.expected.biofuel);
  });
  it.each(DEMO_CASES.map((c) => [c.number, c] as const))("case %i is visibly labelled synthetic, never as market data", (_n, c) => {
    const a = createDemoAssessment("d", NOW, c.id);
    expect(a.origin).toBe("demo");
    expect(a.illustrative.length).toBeGreaterThan(30);
    const name = (a.inputs["business.assessmentName"] as string);
    expect(name).toMatch(new RegExp(`^SYNTHETIC DEMONSTRATION CASE ${c.number}: `));
    const g = chain(c.id, (x) => x, false);
    const model = reportOf(g).model;
    expect(model.identity.dataOrigin).toBe("demo");
    expect(text(<ReportDocument model={model} result={g.result} f={f} />)).toContain(DEMO_NOTICE);
    expect(text(<PresentationScreen id="snapshot" m={model} result={g.result} f={f} />)).toContain(DEMO_NOTICE);
  });
  it("the required disclosure sentence is exact", () => {
    expect(DEMO_NOTICE).toBe("Illustrative synthetic values for demonstration only. These are not current market prices or investment recommendations.");
  });
  it("every demonstration value is marked illustrative until the user edits it", () => {
    const a = createDemoAssessment("d", NOW, "strong_bev");
    const edited = setNum(a, "diesel.fuelPrice", 1234);
    expect(edited.illustrative).not.toContain("diesel.fuelPrice");
    expect(edited.illustrative.length).toBe(a.illustrative.length - 1);
  });
  it("no emission factor is shipped in any case, so emissions are Unavailable (deliberately), never zero", () => {
    for (const c of DEMO_CASES) {
      const { result } = chain(c.id, (a) => a, false);
      expect(result.environmental.bevVsDiesel.status).toBe("unavailable");
      expect(result.environmental.diesel.annualEmissionsKg).toBeNull();
    }
  });
  it("no case contains a source citation that could pass as market data", () => {
    for (const c of DEMO_CASES) {
      const a = createDemoAssessment("d", NOW, c.id);
      expect(Object.keys(a.provenance)).toEqual([]);
    }
  });
  it("every case runs through normalisation with no blocking issue and no non-finite number anywhere", () => {
    for (const c of DEMO_CASES) {
      const r = chain(c.id, (a) => a, false).result;
      expect(finite(r), c.id).toEqual([]);
    }
  });
});

describe("Demo loading, replacement and reset (no silent data loss)", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  };
  it("loading a case through the store replaces the assessment with that case, and reset returns a blank one", async () => {
    const { createStorageRepository } = await import("@/state/repository");
    const store = createAssessmentStore({ repository: createStorageRepository(memory()) });
    store.hydrate();
    expect(isUntouched(store.getSnapshot().assessment)).toBe(true);
    store.loadDemo("conditional_bev");
    expect(store.getSnapshot().assessment.origin).toBe("demo");
    expect(store.getSnapshot().assessment.inputs["business.assessmentName"]).toMatch(/CASE 2/);
    store.reset();
    expect(isUntouched(store.getSnapshot().assessment)).toBe(true);
    expect(store.getSnapshot().assessment.origin).toBe("blank");
  });
  it("a loaded demonstration case survives a reload (it is persisted like any assessment)", async () => {
    const { createStorageRepository } = await import("@/state/repository");
    const storage = memory();
    const a = createAssessmentStore({ repository: createStorageRepository(storage) });
    a.hydrate();
    a.loadDemo("insufficient_evidence");
    const b = createAssessmentStore({ repository: createStorageRepository(storage) });
    b.hydrate();
    expect(b.getSnapshot().assessment.inputs["business.assessmentName"]).toMatch(/CASE 5/);
  });
  it("the UI asks before discarding work: the start actions render the case menu, the blank option only while a demo is loaded, and confirmation dialogs", () => {
    const out = html(<StartActions variant="overview" />);
    expect(out).toContain("Synthetic demonstration cases");
    for (const c of DEMO_CASES) expect(out).toContain(`Case ${c.number}: ${c.title}`);
    expect(out).toContain(DEMO_NOTICE);
    expect(out).toContain("Replace your work with this demonstration case?");
    expect(out).toContain("Start a blank assessment?");
    expect(out).not.toContain("Return to Blank Assessment"); // nothing to return from: the assessment is untouched
  });
  it("the case menu is a native <details> list of real buttons (keyboard and screen-reader accessible)", () => {
    const out = html(<StartActions variant="compact" />);
    expect(out).toMatch(/<details[^>]*>\s*<summary/);
    expect((out.match(/<button[^>]*type="button"[^>]*>\s*<span class="block text-sm font-semibold/g) ?? []).length).toBe(5);
  });
});

describe("Final end-to-end case A: strong BEV (case 1)", () => {
  const c = chain("strong_bev");
  const { model, ctx } = reportOf(c);
  it("input to classification", () => {
    expect(c.result.commercial.bev.classification).toBe("VIABLE");
    expect(c.result.operational.bev.status).toBe("suitable");
    expect(c.result.commercial.bev.economicCase).toBe("FAVOURABLE");
    expect(c.result.environmental.bevVsDiesel.status).toBe("unavailable");
    expect(c.result.commercial.bev.policyVersion).toBe("1.0");
  });
  it("sensitivity and viability margin", () => {
    const a = c.analysis!.viability.bev!;
    expect(a.mode).toBe("viability_margin");
    expect(a.economicThresholds.some((t) => t.status === "ALREADY_SATISFIED" && t.thresholdKind === "headroom")).toBe(true);
    expect(c.analysis!.drivers.bev!.rows.length).toBeGreaterThan(3);
  });
  it("report, presentation and export agree", () => {
    const doc = text(<ReportDocument model={model} result={c.result} f={f} />);
    expect(doc).toContain(f.money(c.result.bevVsDiesel.npv));
    expect(doc).toMatch(/viability margin/i);
    expect(buildPresentationScreens(model).map((s) => s.id)).toContain("viability");
    const json = JSON.parse(buildExportFile("json", ctx).content);
    expect(json.commercial.bev.classification).toBe("VIABLE");
    expect(json.thresholds.bev.mode).toBe("viability_margin");
    expect(finite(json)).toEqual([]);
  });
});

describe("Final end-to-end case B: negative NPV and a range constraint (case 3)", () => {
  const c = chain("not_yet_viable_bev");
  const { model, ctx } = reportOf(c);
  const a = c.analysis!.viability.bev!;
  it("is NOT YET VIABLE with two separate barriers", () => {
    expect(c.result.commercial.bev.classification).toBe("NOT_YET_VIABLE");
    expect(c.result.commercial.bev.economicCase).toBe("UNFAVOURABLE");
    expect(c.result.commercial.bev.hardConstraints.map((h) => h.code)).toContain("RANGE_EXCEEDED_DEPOT_ONLY");
    expect(a.barriers.economic.length).toBeGreaterThan(0);
    expect(a.barriers.operational.length).toBeGreaterThan(0);
    expect(a.multipleBarrierNote).toMatch(/money alone/i);
  });
  it("an economic break-even threshold is found, and a range remedy is shown", () => {
    const price = a.economicThresholds.find((t) => t.variableId === "bevAcquisition")!;
    expect(price.status).toBe("FOUND");
    expect(price.thresholdValue!).toBeLessThan(price.currentValue!);
    const range = a.remedies.find((r) => r.kind === "numeric_threshold")!;
    expect(range.value).toBe(240); // the daily distance, with no safety buffer
    expect(range.verified).toBe(true);
    expect(range.text).toMatch(/not an engineering safety recommendation/i);
  });
  it("economic break-even is solved but is explicitly not enough", () => {
    expect(a.notes.join(" ")).toMatch(/does not resolve the operational constraint/i);
    const at = a.economicThresholds.find((t) => t.variableId === "bevAcquisition")!;
    expect(at.after?.classification).not.toBe("VIABLE");
    expect(at.after?.operationalStatus).toBe("constrained");
  });
  it("the report and the presentation say the same", () => {
    const doc = text(<ReportDocument model={model} result={c.result} f={f} />);
    expect(doc).toMatch(/does not resolve the operational constraint|money alone/i);
    const pres = text(<PresentationScreen id="viability" m={model} result={c.result} f={f} />);
    expect(pres).toMatch(/does not resolve the operational constraint|money alone|operational/i);
  });
  it("the export preserves both barriers", () => {
    const json = JSON.parse(buildExportFile("json", ctx).content);
    expect(json.thresholds.bev.barriers.economic.length).toBeGreaterThan(0);
    expect(json.thresholds.bev.barriers.operational.length).toBeGreaterThan(0);
    const csv = buildExportFile("thresholds", ctx).content;
    expect(csv).toMatch(/economic/i);
    expect(finite(json)).toEqual([]);
  });
});

describe("Final end-to-end case C: positive NPV with daytime charging (case 2)", () => {
  const c = chain("conditional_bev");
  const a = c.analysis!.viability.bev!;
  it("is CONDITIONALLY VIABLE because of the charging condition, not the economics", () => {
    expect(c.result.commercial.bev.classification).toBe("CONDITIONALLY_VIABLE");
    expect(c.result.commercial.bev.economicCase).toBe("FAVOURABLE");
    expect(c.result.commercial.bev.conditions.map((x) => x.code)).toEqual(["DAYTIME_CHARGING_REQUIRED"]);
  });
  it("no unnecessary financial remedy is invented", () => {
    expect(a.mode).toBe("make_fully_viable");
    expect(a.economicThresholds).toEqual([]);
    expect(a.classificationThresholds).toEqual([]);
    expect(a.notes.join(" ")).toMatch(/no financial threshold is invented/i);
  });
  it("the charging condition is clearly shown in the report and the presentation", () => {
    const { model } = reportOf(c);
    expect(text(<ReportDocument model={model} result={c.result} f={f} />)).toMatch(/daytime charging/i);
    expect(text(<PresentationScreen id="commercial" m={model} result={c.result} f={f} />)).toMatch(/daytime charging/i);
  });
});

describe("Final end-to-end case D: biofuel, positive economics, intermittent supply (case 4)", () => {
  const c = chain("intermittent_biofuel");
  const a = c.analysis!.viability.biofuel!;
  it("is CONDITIONALLY VIABLE", () => {
    expect(c.result.commercial.biofuel.classification).toBe("CONDITIONALLY_VIABLE");
    expect(c.result.commercial.biofuel.economicCase).toBe("FAVOURABLE");
    expect(c.result.commercial.biofuel.conditions.map((x) => x.code)).toEqual(["BIOFUEL_SUPPLY_INTERMITTENT"]);
  });
  it("the remedy is qualitative and no numerical availability threshold exists anywhere", () => {
    expect(a.remedies.every((r) => r.kind === "qualitative")).toBe(true);
    expect(a.remedies.map((r) => r.text).join(" ")).toMatch(/supply|fallback/i);
    const every = [...a.economicThresholds, ...a.classificationThresholds];
    expect(every.some((t) => t.variableId === "biofuelAvailability")).toBe(false);
    expect(JSON.stringify(a.remedies)).not.toMatch(/\d+\s?%\s?(availab|uptime)/i);
  });
});

describe("Final end-to-end case E: insufficient evidence (case 5)", () => {
  const c = chain("insufficient_evidence");
  const { model } = reportOf(c);
  const a = c.analysis!.viability.bev!;
  it("withholds the classification and lists exactly what is missing", () => {
    expect(c.result.commercial.bev.classification).toBe("INSUFFICIENT_EVIDENCE");
    expect(c.result.commercial.biofuel.classification).toBe("INSUFFICIENT_EVIDENCE");
    expect(c.result.commercial.bev.criticalMissing.map((m) => m.checkId)).toEqual(["range"]);
    expect(c.result.commercial.biofuel.criticalMissing.map((m) => m.checkId)).toEqual(["supply"]);
    expect(a.missingInputs.join(" ")).toMatch(/charging availability/i);
  });
  it("threshold solving is blocked for both technologies", () => {
    expect(a.mode).toBe("blocked");
    expect(a.economicThresholds).toEqual([]);
    expect(a.classificationThresholds).toEqual([]);
    expect(c.analysis!.viability.biofuel!.mode).toBe("blocked");
  });
  it("the gate-order disclosure: the available economic evidence is unfavourable, but it is not used", () => {
    expect(c.result.commercial.bev.economicCase).toBe("UNFAVOURABLE");
    const doc = text(<ReportDocument model={model} result={c.result} f={f} />);
    expect(doc).toMatch(/available economic evidence is unfavourable/i);
    expect(c.result.commercial.bev.decisionTrace.map((s) => s.text).join(" ")).toMatch(/not used to classify/i);
  });
  it("the report stays useful and the presentation does not fabricate a conclusion", () => {
    const doc = text(<ReportDocument model={model} result={c.result} f={f} />);
    expect(doc).toContain("Evidence quality and data provenance");
    expect(doc).toMatch(/Missing evidence/);
    const pres = ["commercial", "why", "takeaways"].map((id) => text(<PresentationScreen id={id as "commercial"} m={model} result={c.result} f={f} />)).join(" ");
    expect(pres).toMatch(/cannot (be )?classif/i);
    expect(pres).not.toMatch(/\bis (conditionally )?viable\b/i);
    expect(pres).not.toMatch(/(Battery electric|Biofuel) (is|against diesel) NOT YET VIABLE/i);
  });
});

describe("Final end-to-end case F: environmental factors varied only", () => {
  /** Emission factors are entered through the form fields, so this runs the whole path: form -> normalisation -> engine. */
  const factors = (d: number | null, g: number | null, b: number | null) => (a: ReturnType<typeof createDemoAssessment>) => {
    let n = a;
    if (d !== null) n = setNum(n, "env.diesel.value", d);
    if (g !== null) n = setNum(n, "env.grid.value", g);
    if (b !== null) n = setNum(n, "env.biofuel.value", b);
    return n;
  };
  const base = chain("strong_bev", (a) => a, false);
  const SETS: [string, number | null, number | null, number | null][] = [
    ["BEV lower", 2.7, 0.0, 2.2],
    ["BEV higher", 2.7, 9.0, 2.2],
    ["equal per litre", 2.7, 0.27, 2.7],
    ["extreme but valid", 1000, 1000, 1000],
    ["missing alternative factors", 2.7, null, null],
  ];
  it.each(SETS)("%s: the emissions result changes, the classification does not", (_n, d, g, b) => {
    const r = chain("strong_bev", factors(d, g, b), false).result;
    expect(r.commercial.bev.classification).toBe(base.result.commercial.bev.classification);
    expect(r.commercial.biofuel.classification).toBe(base.result.commercial.biofuel.classification);
    expect(r.commercial.bev.reasonCodes.filter((c) => !/EMISSIONS|NO_MATERIAL_EMISSIONS/.test(c))).toEqual(base.result.commercial.bev.reasonCodes.filter((c) => !/EMISSIONS|NO_MATERIAL_EMISSIONS/.test(c)));
    expect(r.bevVsDiesel.npv).toBe(base.result.bevVsDiesel.npv);
    expect(r.biofuelVsDiesel.npv).toBe(base.result.biofuelVsDiesel.npv);
  });
  it("the emissions figures themselves respond to the factors", () => {
    const lower = chain("strong_bev", factors(2.7, 0.0, 2.2), false).result.environmental;
    const higher = chain("strong_bev", factors(2.7, 9.0, 2.2), false).result.environmental;
    expect(lower.bevVsDiesel.status).toBe("calculated");
    expect(lower.bevVsDiesel.direction).toBe("lower");
    expect(higher.bevVsDiesel.direction).toBe("higher");
    expect(lower.bev.annualEmissionsKg).toBe(0);
    expect(higher.bev.annualEmissionsKg!).toBeGreaterThan(lower.bev.annualEmissionsKg!);
    expect(chain("strong_bev", factors(2.7, null, null), false).result.environmental.bevVsDiesel.status).toBe("unavailable");
  });
});

describe("Final end-to-end case G: a scenario derived from a solved threshold (case 3)", () => {
  const c = chain("not_yet_viable_bev", (a) => a, false);
  const solved = solveViabilityThreshold({ input: c.input, technology: "bev", variableId: "bevAcquisition", target: "economic_break_even" });
  const draft = scenarioDraftFromThreshold(solved, "Battery electric")!;
  const scenario: Scenario = { id: "t1", name: draft.name, description: draft.description, origin: "threshold", overrides: draft.overrides, createdAt: NOW, updatedAt: NOW };
  it("the Base Case is unchanged and the scenario holds exactly one override", () => {
    const before = JSON.stringify(c.input);
    const cmp = compareScenarios(c.input, [scenario]);
    if ("status" in cmp) throw new Error(cmp.message);
    expect(JSON.stringify(c.input)).toBe(before);
    expect(Object.keys(scenario.overrides)).toEqual(["bevAcquisition"]);
    expect(cmp.base.bev!.snapshot.npv).toBeCloseTo(c.result.bevVsDiesel.npv, 6);
    expect(Math.abs(cmp.scenarios[0]!.bev!.snapshot.npv)).toBeLessThan(1e-6 * c.result.diesel.presentCost); // solver tolerance
    expect(cmp.scenarios[0]!.changes[0]).toMatchObject({ variableId: "bevAcquisition", from: 20_000_000 });
  });
  it("the comparison and the report keep the scenario distinct from the Base Case", () => {
    const model = buildReportModel({ input: c.input, result: c.result, analysis: null, scenarios: [scenario], now: NOW });
    const doc = text(<ReportDocument model={model} result={c.result} f={f} />);
    expect(doc).toContain("Base Case");
    expect(doc).toContain(scenario.name);
    expect(model.scenarios.comparison!.base.name).toBe("Base Case");
    expect(model.scenarios.comparison!.scenarios[0]!.scenario?.origin).toBe("threshold");
    // reaching NPV = 0 still does not make the result VIABLE
    expect(model.scenarios.comparison!.scenarios[0]!.bev!.snapshot.classification).not.toBe("VIABLE");
  });
  it("scenario count stays inside the documented limit", () => {
    expect(MAX_SCENARIOS).toBe(12);
  });
});

describe("Persistence of analysis for the demonstration flow", () => {
  it("a stored analysis is used only while the inputs are unchanged", () => {
    const store = createAnalysisStore(null, () => NOW);
    const c = chain("strong_bev", (a) => a, false);
    store.recordViability(c.input as NormalizedAssessmentInput, "bev", analyzeViability(c.input, "bev"));
    expect(store.getSnapshot()?.fingerprint).toBe(fingerprintInput(c.input));
    const changed = chain("strong_bev", (a) => setNum(a, "diesel.fuelPrice", 1500), false);
    expect(fingerprintInput(changed.input)).not.toBe(fingerprintInput(c.input));
  });
});

export type { AssessmentCalculationResult };
