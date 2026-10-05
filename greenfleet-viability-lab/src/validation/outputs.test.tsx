import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/report",
  useRouter: () => ({ push: () => undefined }),
  redirect: () => undefined,
  notFound: () => undefined,
}));

import { calculateAssessment } from "@/calculation/engine";
import { deepFreeze, makeInput } from "@/calculation/fixtures";
import type { Scenario } from "@/calculation/scenario";
import { compareScenarios } from "@/calculation/scenario";
import { runDriverAnalysis, runSensitivityAnalysis } from "@/calculation/sensitivity";
import { analyzeViability } from "@/calculation/threshold";
import { PresentationScreen } from "@/components/present/presentation-view";
import { ReportDocument } from "@/components/report/report-document";
import { resultFormatter } from "@/components/results/format-results";
import { AssessmentStoreProvider } from "@/state/StoreProvider";
import { createAnalysisStore, emptyRecord, fingerprintInput, recordFor, ANALYSIS_KEY, type AnalysisRecord } from "@/reporting/analysisRecord";
import { cellText } from "@/reporting/cells";
import { buildExportFile, csvField, safeFilename, type CsvKind } from "@/reporting/exports";
import { REPORT_DISCLAIMER } from "@/reporting/identity";
import { buildReportModel } from "@/reporting/model";
import { buildPresentationScreens } from "@/reporting/presentation";
import { createStorageRepository, SCHEMA_VERSION, STORAGE_KEY } from "@/state/repository";
import { createAssessmentStore } from "@/state/assessmentStore";
import { createBlankAssessment } from "@/domain/blank";
import { createDemoAssessment } from "@/domain/demo";

/** Cross-surface consistency, export and persistence validation. VALIDATION FIXTURES: SYNTHETIC VALUES. */

type Patch = Parameters<typeof makeInput>[0];
const P = (p: unknown) => p as Patch;
const f = resultFormatter("NGN");
const NOW = "2026-10-05T10:00:00.000Z";
const html = (el: ReactElement) => renderToStaticMarkup(<AssessmentStoreProvider>{el}</AssessmentStoreProvider>);
const text = (el: ReactElement) => html(el).replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const factor = (value: number, unit: string, unitId: string) => ({ value, unit, unitId, scope: "direct" as const, source: "Synthetic test factor", sourceYear: 2020, notes: null, lifecycleAdjustmentPct: null });
const FACTORS = P({ environmentalAssumptions: { diesel: factor(2.7, "kg CO2e/litre", "kgco2e_per_litre"), gridElectricity: factor(0.1, "kg CO2e/kWh", "kgco2e_per_kwh"), biofuel: factor(2.2, "kg CO2e/litre", "kgco2e_per_litre") } });
const sc = (overrides: Scenario["overrides"], name = "Higher diesel price", id = "s1"): Scenario => ({ id, name, description: "", origin: "user", overrides, createdAt: NOW, updatedAt: NOW });

function analysisFor(patch: Patch, techs: ("bev" | "biofuel")[] = ["bev", "biofuel"]): AnalysisRecord {
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

function chain(patch: Patch = {}, opts: { withAnalysis?: boolean; scenarios?: Scenario[] } = {}) {
  const input = makeInput(patch);
  const o = calculateAssessment(input);
  if (!o.ok) throw new Error(o.errors.map((e) => e.message).join("; "));
  const analysis = opts.withAnalysis ? analysisFor(patch) : null;
  const scenarios = opts.scenarios ?? [];
  const model = buildReportModel({ input, result: o.result, analysis, scenarios, now: NOW });
  const ctx = { model, input, result: o.result, analysis, scenarios };
  return { ...ctx, ctx };
}

/** Small RFC 4180 reader, written independently of the exporter. */
function parseCsv(csv: string): string[][] {
  const body = csv.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\r" && body[i + 1] === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; }
    else cell += c;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

describe("Results / report / presentation / CSV / JSON show the same underlying values", () => {
  const c = chain(P({ bev: { upfrontVehicleCost: 14_900, batteryReplacement: { expected: "yes", year: 3, cost: 800 } }, ...FACTORS }), { withAnalysis: true, scenarios: [sc({ dieselPrice: 1.4 })] });
  const r = c.result;
  const doc = text(<ReportDocument model={c.model} result={r} f={f} />);
  const comparison = parseCsv(buildExportFile("comparison", c.ctx).content);
  const json = JSON.parse(buildExportFile("json", c.ctx).content);
  const csvRow = (label: string) => comparison.find((row) => row[0] === label)!;

  it("incremental NPV (BEV and biofuel): engine = report model = CSV raw = JSON raw", () => {
    const row = c.model.comparison.rows.find((x) => x.label === "Incremental NPV vs diesel")!;
    expect(row.cells[1]).toEqual({ kind: "money", value: r.bevVsDiesel.npv });
    expect(Number(csvRow("Incremental NPV vs diesel")[3])).toBe(r.bevVsDiesel.npv);
    expect(Number(csvRow("Incremental NPV vs diesel")[5])).toBe(r.biofuelVsDiesel.npv);
    expect(json.results.bevVsDiesel.npv).toBe(r.bevVsDiesel.npv);
    expect(doc).toContain(f.money(r.bevVsDiesel.npv));
  });
  it("TCO and present cost, per technology", () => {
    const tco = csvRow("Total cost of ownership (undiscounted)");
    expect([Number(tco[1]), Number(tco[3]), Number(tco[5])]).toEqual([r.diesel.undiscountedTco, r.bev.undiscountedTco, r.biofuel.undiscountedTco]);
    const pc = csvRow("Present cost");
    expect([Number(pc[1]), Number(pc[3]), Number(pc[5])]).toEqual([r.diesel.presentCost, r.bev.presentCost, r.biofuel.presentCost]);
    expect(json.results.bev.undiscountedTco).toBe(r.bev.undiscountedTco);
    expect(json.results.bev.presentCost).toBe(r.bev.presentCost);
    expect(doc).toContain(f.money(r.bev.undiscountedTco));
    expect(doc).toContain(f.money(r.bev.presentCost));
  });
  it("cost per km", () => {
    const cpk = csvRow("Cost per km");
    expect(Number(cpk[3])).toBe(r.bev.tcoPerKm);
    expect(json.results.bev.tcoPerKm).toBe(r.bev.tcoPerKm);
    expect(doc).toContain(f.perKm(r.bev.tcoPerKm));
  });
  it("payback keeps its three states in the CSV (value / immediate / not_achieved)", () => {
    const sp = csvRow("Simple payback");
    expect(["value", "immediate", "not_achieved"]).toContain(sp[4]);
    expect(sp[4] === "value" ? Number(sp[3]) : sp[3]).toBe(r.bevVsDiesel.simplePayback.status === "achieved" ? r.bevVsDiesel.simplePayback.years : r.bevVsDiesel.simplePayback.status === "immediate" ? 0 : "");
    expect(json.results.bevVsDiesel.simplePayback.status).toBe(r.bevVsDiesel.simplePayback.status);
  });
  it("operational status and environmental result", () => {
    expect(json.results.operational.bev.status).toBe(r.operational.bev.status);
    expect(json.results.environmental.bevVsDiesel.percentageChange).toBe(r.environmental.bevVsDiesel.percentageChange);
    expect(json.results.environmental.bev.annualEmissionsKg).toBe(r.environmental.bev.annualEmissionsKg);
    expect(c.model.operational[0]!.status).toBe(r.operational.bev.status);
  });
  it("commercial classification and policy version appear identically everywhere", () => {
    const cls = csvRow("Commercial classification");
    expect(cls[3]).toBe(r.commercial.bev.classification);
    expect(cls[5]).toBe(r.commercial.biofuel.classification);
    expect(json.commercial.bev.classification).toBe(r.commercial.bev.classification);
    expect(json.policy.version).toBe("1.0");
    expect(json.commercial.bev.policyVersion).toBe("1.0");
    expect(comparison.some((row) => row[0] === "# policy" && /Policy v1\.0/.test(row[1]!))).toBe(true);
    expect(doc).toContain("Policy v1.0");
    const pres = text(<PresentationScreen id="commercial" m={c.model} result={r} f={f} />);
    expect(pres).toContain("Policy v1.0");
    expect(pres.toLowerCase()).toContain(r.commercial.bev.classification.replace(/_/g, " ").toLowerCase());
  });
  it("the presentation economic screen uses the same formatted NPV, TCO and payback as the report", () => {
    const pres = text(<PresentationScreen id="economic" m={c.model} result={r} f={f} />);
    expect(pres).toContain(f.money(r.bevVsDiesel.npv));
    expect(pres).toContain(f.money(r.bev.undiscountedTco));
  });
  it("cash-flow CSV equals the engine's year-by-year rows", () => {
    const rows = parseCsv(buildExportFile("cashflow", c.ctx).content);
    const header = rows.findIndex((row) => row[0] === "comparison" && row[1] === "year");
    expect(header).toBeGreaterThanOrEqual(0);
    const bev = rows.slice(header + 1).filter((row) => row[0] === "bev_vs_diesel");
    expect(bev).toHaveLength(r.metadata.horizonYears + 1);
    expect(bev.map((row) => Number(row[1]))).toEqual(r.bevVsDiesel.rows.map((x) => x.year));
    expect(bev.map((row) => Number(row[4]))).toEqual(r.bevVsDiesel.rows.map((x) => x.incrementalCashFlow));
    expect(bev.map((row) => Number(row[3]))).toEqual(r.bevVsDiesel.rows.map((x) => x.greenCost));
  });
  it("sensitivity, drivers, thresholds and scenario CSVs carry the stored analysis values", () => {
    const drivers = parseCsv(buildExportFile("drivers", c.ctx).content);
    expect(drivers.length).toBeGreaterThan(8);
    const top = c.analysis!.drivers.bev!.rows[0]!;
    expect(drivers.some((row) => row.some((cell) => Number(cell) === top.spread))).toBe(true);
    const sc1 = parseCsv(buildExportFile("scenarios", c.ctx).content);
    expect(sc1.flat().some((cell) => cell === "Higher diesel price")).toBe(true);
  });
});

describe("JSON export reproducibility (no import feature required)", () => {
  it("re-evaluating the exported normalized input reproduces the exported results exactly", () => {
    const c = chain(P({ bev: { upfrontVehicleCost: 16_000, batteryReplacement: { expected: "yes", year: 2, cost: 700 } }, finance: { discountRatePct: 12 }, diesel: { fuelPriceEscalationPctPerYear: 8 }, ...FACTORS }), { withAnalysis: true });
    const json = JSON.parse(buildExportFile("json", c.ctx).content);
    const again = calculateAssessment(json.normalizedInput);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const rerun = JSON.parse(JSON.stringify(again.result));
    for (const key of ["diesel", "bev", "biofuel", "bevVsDiesel", "biofuelVsDiesel", "environmental", "operational", "dataCompleteness"] as const) {
      expect(rerun[key], key).toEqual(json.results[key]);
    }
    expect(rerun.commercial).toEqual(json.commercial);
    expect(rerun.metadata).toEqual(json.metadata);
  });
  it("the exported input is plain JSON that survives a round trip unchanged", () => {
    const c = chain(P({}));
    const json = JSON.parse(buildExportFile("json", c.ctx).content);
    expect(json.normalizedInput).toEqual(JSON.parse(JSON.stringify(c.input)));
    expect(fingerprintInput(json.normalizedInput)).toBe(fingerprintInput(c.input));
  });
  it("records the policy, versions and scope so a reader can tell what produced it", () => {
    const json = JSON.parse(buildExportFile("json", chain(P({})).ctx).content);
    expect(json.policy.id).toBe("GreenFleet Commercial Viability Policy v1.0");
    expect(json.application.name).toBe("GreenFleet Viability Lab");
    expect(json.application.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(json.exportSchemaVersion).toBe(1);
    expect(JSON.stringify(json)).not.toMatch(/NaN|Infinity/);
  });
});

describe("CSV validation", () => {
  const KINDS: CsvKind[] = ["comparison", "cashflow", "sensitivity", "drivers", "scenarios", "scenario_changes", "thresholds"];
  const full = chain(P({ bev: { upfrontVehicleCost: 14_900 }, ...FACTORS }), { withAnalysis: true, scenarios: [sc({ dieselPrice: 1.4, bevAcquisition: 14_000 })] });

  it.each(KINDS)("%s: UTF-8 BOM, CRLF rows, a metadata block, one header, and equal column counts in the data rows", (kind) => {
    const csv = buildExportFile(kind, full.ctx).content;
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv).not.toMatch(/[^\r]\n/); // every line break inside the file is CRLF (embedded newlines are inside quotes)
    const rows = parseCsv(csv);
    const metaRows = rows.filter((row) => row[0]!.startsWith("#"));
    expect(metaRows.length).toBeGreaterThanOrEqual(5);
    const data = rows.filter((row) => !row[0]!.startsWith("#") && row.some((cell) => cell !== ""));
    expect(data.length).toBeGreaterThan(1);
    const width = data[0]!.length;
    expect(width).toBeGreaterThan(2);
    for (const row of data) expect(row.length, `${kind}: ${row.join("|")}`).toBe(width);
    expect(csv).not.toMatch(/NaN|Infinity|undefined|\[object/);
  });
  it("values are raw numbers, not currency text, and the currency is stated in the metadata", () => {
    const rows = parseCsv(buildExportFile("comparison", full.ctx).content);
    expect(rows.some((row) => row[0] === "# currency" && row[1] === "NGN")).toBe(true);
    const npv = rows.find((row) => row[0] === "Incremental NPV vs diesel")!;
    expect(npv[3]).toMatch(/^-?\d+(\.\d+)?(e[-+]?\d+)?$/i);
    expect(npv[3]).not.toMatch(/₦|,/);
  });
  it("missing, unavailable, not-run and not-applicable values are marked in a status column, never zero", () => {
    const noEnv = chain(P({}));
    const rows = parseCsv(buildExportFile("comparison", noEnv.ctx).content);
    const emissions = rows.find((row) => row[0] === "Annual operational emissions")!;
    expect(emissions[2]).toBe("unavailable");
    expect(emissions[1]).not.toBe("0");
    expect(rows.find((row) => row[0] === "Incremental NPV vs diesel")![2]).toBe("baseline");
  });
  it("hostile assessment and scenario names are quoted, escaped and defused", () => {
    const names = ['=1+1', '+SUM(A1)', '-2+3', '@cmd', 'a,b', 'say "hi"', "line1\nline2", "tab\there", "Ünï 車 ₦ 🚚", "\r=evil"];
    for (const name of names) {
      const scen = sc({ dieselPrice: 1.2 }, name);
      const c = chain(P({}), { scenarios: [scen] });
      const csv = buildExportFile("scenarios", c.ctx).content;
      const rows = parseCsv(csv);
      const cell = rows.flat().find((x) => x.replace(/^'/, "") === name || x === `'${name}`);
      expect(cell, `name ${JSON.stringify(name)} survives`).toBeDefined();
      for (const row of rows) for (const x of row) {
        // no cell may start with a formula trigger unless it is the defused form
        if (/^[=+\-@\t\r]/.test(x)) expect(x, `unsafe cell ${JSON.stringify(x)}`).toMatch(/^[-+]?\d/);
      }
    }
  });
  it("legitimate negative numbers are never altered (they are numbers, not text)", () => {
    expect(csvField(-5000)).toBe("-5000");
    expect(csvField(-0.000001)).toBe("-0.000001");
    expect(csvField(-1e-7)).toBe("-1e-7");
    expect(csvField(0)).toBe("0");
    expect(csvField("-5000")).toBe("'-5000"); // text that merely looks numeric is text, and is defused
  });
  it("round trip: parsing the quoted CSV returns the original hostile text", () => {
    for (const s of ['a,b', 'say "hi"', "line1\r\nline2", "Ünï 車 ₦", "plain"]) {
      expect(parseCsv(`${csvField(s)}\r\n`)[0]![0]).toBe(s);
    }
  });
});

describe("Filename security", () => {
  const DATE = "2026-10-05T10:00:00Z";
  const bad = ["a/b", "a\\b", "a:b", "a*b", "a?b", 'a"b', "a<b>", "a|b", "../../x", "..\\..\\x", "CON", "nul.txt", "emoji 🚚⚡🌍", "a".repeat(5_000), "   ", "\u0000‮.exe", "名前", " leading and trailing ", "a b  c", ".hidden", "x".repeat(300) + "/y"];
  it.each(bad.map((n) => [JSON.stringify(n).slice(0, 40), n] as const))("%s", (_label, name) => {
    const file = safeFilename(name, "comparison", "csv", DATE);
    expect(file).toMatch(/^greenfleet-assessment-[a-z0-9-]+-comparison-2026-10-05\.csv$/);
    expect(file.length).toBeLessThanOrEqual(100);
    expect(file).not.toMatch(/\.\./);
    expect(file.startsWith(".")).toBe(false);
  });
  it("an empty or unusable name becomes 'untitled'", () => {
    expect(safeFilename("   ", "x", "csv", DATE)).toContain("-untitled-");
    expect(safeFilename("車両", "x", "csv", DATE)).toContain("-untitled-");
  });
  it("the same inputs always give the same filename", () => {
    expect(safeFilename("My Fleet", "full", "json", DATE)).toBe(safeFilename("My Fleet", "full", "json", DATE));
  });
});

describe("Presentation Mode: full sequence and skipped screens", () => {
  it("with everything run: ten screens in the documented order", () => {
    const m = chain(P({ bev: { upfrontVehicleCost: 14_900 } }), { withAnalysis: true }).model;
    expect(buildPresentationScreens(m).map((s) => s.id)).toEqual(["snapshot", "comparison", "economic", "operational", "environmental", "commercial", "why", "viability", "drivers", "takeaways"]);
  });
  it("with no analysis run: viability and driver screens are skipped, not shown empty", () => {
    const m = chain(P({})).model;
    expect(buildPresentationScreens(m).map((s) => s.id)).toEqual(["snapshot", "comparison", "economic", "operational", "environmental", "commercial", "why", "takeaways"]);
  });
  it("the viability screen title follows the result (margin when everything is viable)", () => {
    const m = chain(P({}), { withAnalysis: true }).model;
    const t = buildPresentationScreens(m).find((s) => s.id === "viability")!.title;
    expect(["Viability margin", "What would make it viable?"]).toContain(t);
  });
  it("every screen renders text from the model with no NaN, undefined or placeholder", () => {
    const c = chain(P({ bev: { upfrontVehicleCost: 17_000 }, ...FACTORS }), { withAnalysis: true });
    for (const s of buildPresentationScreens(c.model)) {
      const t = text(<PresentationScreen id={s.id} m={c.model} result={c.result} f={f} />);
      expect(t.length, s.id).toBeGreaterThan(40);
      expect(t, s.id).not.toMatch(/\bNaN\b|\bundefined\b|\[object|Infinity|\bTODO\b|lorem ipsum/);
    }
  });
  it("insufficient evidence: the presentation does not fabricate a conclusion", () => {
    const c = chain(P({ operations: { dailyDistanceKm: 600 }, bev: { usableRangeKm: 500, operational: { chargingOpportunity: null } } }), { withAnalysis: false });
    expect(c.result.commercial.bev.classification).toBe("INSUFFICIENT_EVIDENCE");
    const bevOnly = (s: string) => s.split(/Biofuel against diesel/)[0]!;
    const commercial = bevOnly(text(<PresentationScreen id="commercial" m={c.model} result={c.result} f={f} />));
    const takeaway = text(<PresentationScreen id="takeaways" m={c.model} result={c.result} f={f} />).split(/Biofuel is/)[0]!;
    for (const t of [commercial, takeaway]) {
      expect(t).toMatch(/cannot (be )?classif/i);
      expect(t).not.toMatch(/\bis (conditionally )?viable\b|not yet viable/i);
      expect(t).toMatch(/available economic evidence is favourable/i); // disclosed, not hidden, not used
    }
  });
});

describe("Report: disclaimer, version, and mutation safety", () => {
  const c = chain(P({}));
  it("carries the exact core disclaimer, the prototype version and the policy version", () => {
    const doc = text(<ReportDocument model={c.model} result={c.result} f={f} />);
    expect(doc).toContain(REPORT_DISCLAIMER);
    expect(doc).toContain("Policy v1.0");
  });
  it("building the model, the exports and every presentation screen from frozen data changes nothing", () => {
    const frozen = chain(P({ bev: { upfrontVehicleCost: 14_900 }, ...FACTORS }), { withAnalysis: true, scenarios: [sc({ dieselPrice: 1.4 })] });
    deepFreeze(frozen.result);
    deepFreeze(frozen.input);
    if (frozen.analysis) deepFreeze(frozen.analysis);
    const before = JSON.stringify([frozen.result, frozen.input, frozen.analysis]);
    for (const k of ["comparison", "cashflow", "sensitivity", "drivers", "scenarios", "scenario_changes", "thresholds", "json"] as const) buildExportFile(k, frozen.ctx);
    for (const s of buildPresentationScreens(frozen.model)) text(<PresentationScreen id={s.id} m={frozen.model} result={frozen.result} f={f} />);
    text(<ReportDocument model={frozen.model} result={frozen.result} f={f} />);
    expect(JSON.stringify([frozen.result, frozen.input, frozen.analysis])).toBe(before);
  });
  it("two builds of the same report model are identical (timestamps are passed in, not read)", () => {
    const a = chain(P({ bev: { upfrontVehicleCost: 14_900 } }), { withAnalysis: true });
    const b = chain(P({ bev: { upfrontVehicleCost: 14_900 } }), { withAnalysis: true });
    expect(JSON.stringify(a.model)).toBe(JSON.stringify(b.model));
    expect(buildExportFile("json", a.ctx).content).toBe(buildExportFile("json", b.ctx).content);
  });
  it("a scenario comparison in the report equals the scenario engine's own comparison", () => {
    const s = sc({ dieselPrice: 1.4 });
    const cc = chain(P({}), { scenarios: [s] });
    const direct = compareScenarios(cc.input, [s]);
    if ("status" in direct) throw new Error(direct.message);
    expect(cc.model.scenarios.comparison?.scenarios[0]!.bev?.snapshot.npv).toBe(direct.scenarios[0]!.bev?.snapshot.npv);
  });
  it("cell text never turns a missing value into zero", () => {
    const row = c.model.comparison.rows.find((x) => x.label === "Annual operational emissions")!;
    for (const cell of row.cells) expect(cellText(cell, f)).not.toMatch(/^0|₦0|tCO2e$/);
  });
});

describe("Persistence hardening", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { data, storage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) } };
  };
  const blank = () => createBlankAssessment("a", NOW);

  it("missing storage (null): load gives nothing, save and clear do nothing, no error", () => {
    const repo = createStorageRepository(null);
    expect(repo.load()).toBeNull();
    expect(() => repo.save(blank())).not.toThrow();
    expect(() => repo.clear()).not.toThrow();
  });
  it("storage that throws on every call (privacy mode) never breaks the app", () => {
    const hostile = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("denied"); } };
    const repo = createStorageRepository(hostile);
    expect(repo.load()).toBeNull();
    expect(() => repo.save(blank())).not.toThrow();
    expect(() => repo.clear()).not.toThrow();
    const store = createAssessmentStore({ repository: repo });
    expect(() => { store.hydrate(); store.loadDemo(); store.reset(); }).not.toThrow();
    expect(store.getSnapshot().assessment).toBeTruthy();
  });
  it("corrupt stored data: invalid JSON, wrong shapes and wrong types all fall back to a clean assessment", () => {
    const { data, storage } = memory();
    const repo = createStorageRepository(storage);
    for (const raw of ["{broken", "null", "42", '"text"', "[]", "{}", '{"version":2}', '{"version":2,"assessment":null}', '{"version":2,"assessment":"x"}', `{"version":${SCHEMA_VERSION},"assessment":{"inputs":"nope"}}`]) {
      data.set(STORAGE_KEY, raw);
      let loaded: ReturnType<typeof repo.load>;
      expect(() => { loaded = repo.load(); }).not.toThrow();
      // either nothing (clean start) or a sanitised assessment that is safe to use
      if (loaded!) expect(Object.keys(loaded.inputs).length).toBeGreaterThan(0);
    }
  });
  it("an older schema version is ignored, not misread", () => {
    const { data, storage } = memory();
    data.set(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION - 1, assessment: createDemoAssessment("old", NOW) }));
    expect(createStorageRepository(storage).load()).toBeNull();
    data.set(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION + 1, assessment: createDemoAssessment("new", NOW) }));
    expect(createStorageRepository(storage).load()).toBeNull();
  });
  it("hostile values inside a valid envelope are sanitised (NaN-like, strings in number fields, unknown ids)", () => {
    const { data, storage } = memory();
    const demo = createDemoAssessment("d", NOW);
    const tampered = JSON.parse(JSON.stringify(demo));
    tampered.inputs["fleet.size"] = { status: "value", value: "five" };
    tampered.inputs["diesel.fuelPrice"] = { status: "value", value: null };
    tampered.inputs["not.a.field"] = { status: "value", value: 1 };
    tampered.inputs["bev.chargingLoss"] = { status: "bogus" };
    data.set(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, assessment: tampered }));
    const loaded = createStorageRepository(storage).load()!;
    expect(loaded.inputs["not.a.field"]).toBeUndefined();
    expect(loaded.inputs["fleet.size"]).toEqual({ status: "missing" });
    expect(loaded.inputs["diesel.fuelPrice"]).toEqual({ status: "missing" });
  });
  it("a save and load round trip keeps 0, missing and N/A as three different states", () => {
    const { storage } = memory();
    const repo = createStorageRepository(storage);
    const a = createDemoAssessment("rt", NOW);
    repo.save(a);
    const back = repo.load()!;
    expect(back.inputs).toEqual(a.inputs);
    expect(back.origin).toBe("demo");
  });
  it("the analysis store: corrupt data, a stale fingerprint and write failure are all tolerated", () => {
    const { data, storage } = memory();
    const input = makeInput({});
    data.set(ANALYSIS_KEY, "{broken");
    const s = createAnalysisStore(storage as Storage, () => NOW);
    expect(() => s.hydrate()).not.toThrow();
    expect(s.getSnapshot()).toBeNull();
    const rec = emptyRecord(fingerprintInput(input), NOW);
    expect(recordFor(rec, input)).toBe(rec);
    expect(recordFor(rec, makeInput({ bev: { upfrontVehicleCost: 99 } }))).toBeNull(); // inputs changed: stale results are ignored
    const failing = { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("x"); } } as unknown as Storage;
    const s2 = createAnalysisStore(failing, () => NOW);
    expect(() => s2.recordViability(input, "bev", analyzeViability(input, "bev"))).not.toThrow();
    expect(s2.getSnapshot()?.viability.bev).toBeDefined(); // still works for this visit
    expect(() => s2.clear()).not.toThrow();
    data.set(ANALYSIS_KEY, JSON.stringify({ version: 99, fingerprint: "x" }));
    const s3 = createAnalysisStore(storage as Storage, () => NOW);
    s3.hydrate();
    expect(s3.getSnapshot()).toBeNull();
  });
  it("assessment, scenarios, analysis and onboarding use four separate keys", async () => {
    const { SCENARIO_KEY } = await import("@/calculation/scenario/storage");
    const keys = [STORAGE_KEY, SCENARIO_KEY, ANALYSIS_KEY];
    expect(new Set(keys).size).toBe(3);
    const { readFileSync } = await import("node:fs");
    const onboarding = readFileSync(new URL("../guidance/onboardingStore.ts", import.meta.url), "utf8");
    const key = /["'`](greenfleet-viability-lab:[a-z-]+)["'`]/.exec(onboarding)?.[1];
    expect(key).toBeTruthy();
    expect(keys).not.toContain(key);
  });
});
