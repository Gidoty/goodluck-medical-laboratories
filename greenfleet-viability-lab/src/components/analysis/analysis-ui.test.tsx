import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/sensitivity",
  useRouter: () => ({ push: () => undefined }),
  redirect: () => undefined,
  notFound: () => undefined,
}));

import ScenariosPage from "@/app/(app)/scenarios/page";
import SensitivityPage from "@/app/(app)/sensitivity/page";
import { AppShell } from "@/components/layout/app-shell";
import { ResultsBody } from "@/components/results/results-view";
import { CommercialHeadline } from "@/components/results/commercial-sections";
import { resultFormatter } from "@/components/results/format-results";
import { calculateAssessment } from "@/calculation/engine";
import { makeInput } from "@/calculation/fixtures";
import { createScenarioRepository } from "@/calculation/scenario/storage";
import { MAX_SCENARIOS } from "@/calculation/scenario";
import { AssessmentStoreProvider } from "@/state/StoreProvider";
import { createScenarioStore } from "@/state/scenarioStore";
import { demo } from "@/test/helpers";
import { Disclaimer, MODEL_DISCLAIMER } from "./shared";
import { OneWaySection } from "./one-way";
import { DriversSection } from "./drivers";
import { TwoWaySection } from "./two-way";
import { ViabilityPanel } from "./viability-panel";

type Patch = Parameters<typeof makeInput>[0];
const html = (el: ReactElement) => renderToStaticMarkup(<AssessmentStoreProvider>{el}</AssessmentStoreProvider>);
const text = (el: ReactElement) => html(el).replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const f = resultFormatter("NGN");
const input = (p: Patch = {}) => makeInput(p);
const P = (p: unknown) => p as Patch;

function memory() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
}

describe("Sensitivity and Scenarios pages are active", () => {
  it("the Sensitivity page no longer says the feature is coming later, and shows a gate until an assessment exists", () => {
    const t = text(<AppShell><SensitivityPage /></AppShell>);
    expect(t).toContain("Sensitivity, thresholds and drivers");
    expect(t).not.toMatch(/added in a later development batch|Run an assessment first.*later/i);
    expect(t).toMatch(/Loading your saved work|Run an assessment first|Complete the assessment first/);
  });
  it("the Scenarios page describes the working tool", () => {
    const t = text(<AppShell><ScenariosPage /></AppShell>);
    expect(t).toContain("Base Case is never changed");
    expect(t).not.toMatch(/added in a later development batch/i);
  });
  it("shared disclaimer is the one specified", () => {
    expect(MODEL_DISCLAIMER).toBe("Sensitivity and threshold results are model-derived decision-support estimates based on the entered assumptions. They are not forecasts, quotations or investment guarantees.");
    expect(text(<Disclaimer />).trim()).toBe(MODEL_DISCLAIMER);
  });
});

describe("analysis panels render real numbers and the required wording", () => {
  const i = input(P({ bev: { upfrontVehicleCost: 20000 } }));
  it("what would make it viable (NOT YET VIABLE): barriers grouped, a threshold card, a scenario button, the disclaimer", () => {
    const t = text(<ViabilityPanel input={i} tech="bev" f={f} />);
    for (const s of ["WHAT WOULD MAKE IT VIABLE?", "Economic", "Operational", "Evidence and uncertainty", "BEV acquisition price", "Create Scenario at This Threshold", "Decision trace before and after", "all else equal", "not forecasts or guaranteed market outcomes", "solver bounds, not market limits"]) expect(t).toContain(s);
    expect(t).toMatch(/would need to fall to approximately ₦15,000/);
    expect(t).not.toMatch(/NaN|Infinity|undefined|\[object Object\]|\{cur\}/);
  });
  it("conditionally viable result changes the heading", () => {
    const t = text(<ViabilityPanel input={input(P({ operations: { dailyDistanceKm: 450 }, bev: { usableRangeKm: 300, operational: { chargingOpportunity: "public_available" } } }))} tech="bev" f={f} />);
    expect(t).toContain("WHAT WOULD MAKE IT FULLY VIABLE?");
    expect(t).toContain("Secure reliable daytime charging");
  });
  it("viable result shows the viability margin, not a search for viability", () => {
    const t = text(<ViabilityPanel input={input()} tech="bev" f={f} />);
    expect(t).toContain("VIABILITY MARGIN");
    expect(t).toMatch(/could increase to approximately ₦0\.09\/kWh/);
    expect(t).not.toContain("WHAT WOULD MAKE IT VIABLE?");
  });
  it("insufficient evidence blocks the panel and lists what is missing", () => {
    const t = text(<ViabilityPanel input={input(P({ operations: { dailyDistanceKm: 450 }, bev: { usableRangeKm: 300, operational: { chargingOpportunity: null } } }))} tech="bev" f={f} />);
    expect(t).toContain("Complete these inputs before threshold analysis can be performed.");
    expect(t).toContain("Complete Missing Inputs");
    expect(t).not.toContain("Create Scenario at This Threshold");
  });
  it("a route constraint with negative economics says economic break-even is not enough", () => {
    const t = text(<ViabilityPanel input={input(P({ bev: { upfrontVehicleCost: 20000, usableRangeKm: 300, operational: { chargingOpportunity: "depot_only" } }, operations: { dailyDistanceKm: 450, averageRouteDistanceKm: 350 } }))} tech="bev" f={f} />);
    expect(t).toContain("Economic break-even alone does not make this configuration commercially viable");
    expect(t).toContain("This would achieve economic break-even. The operational constraint would still need to be resolved before commercial viability can improve.");
    expect(t).toContain("minimum model threshold, not an engineering safety recommendation");
    expect(t).not.toMatch(/will make the technology viable/);
  });
  it("biofuel supply is a qualitative remedy with no number", () => {
    const t = text(<ViabilityPanel input={input(P({ biofuel: { fuelPricePerFuelUnit: 0.5, supply: { availability: "intermittent" } } }))} tech="biofuel" f={f} />);
    expect(t).toContain("Improve biofuel supply reliability");
    expect(t).not.toMatch(/supply threshold/i);
  });
  it("one-way section renders the prototype label, a table and sentences", () => {
    const t = text(<OneWaySection input={input()} tech="bev" f={f} />);
    for (const s of ["Prototype sensitivity range", "Run sensitivity", "Base Case", "Incremental NPV", "What this shows", "under the tested assumptions", "Discounted payback"]) expect(t).toContain(s);
    expect(t).not.toMatch(/NaN|Infinity|undefined|\[object Object\]|\{cur\}/);
  });
  it("driver section shows the tornado wording and the driver table columns", () => {
    const t = text(<DriversSection input={input()} tech="bev" f={f} />);
    for (const s of ["Sensitivity influence under the tested ranges", "NPV spread", "Classification (low / base / high)", "largest NPV influence among the variables tested", "base value is zero"]) expect(t).toContain(s);
    expect(t).not.toMatch(/NaN|Infinity|undefined|\{cur\}/);
  });
  it("two-way section offers the limited pairs and runs on demand", () => {
    const t = text(<TwoWaySection input={input()} tech="bev" f={f} />);
    expect(t).toContain("BEV acquisition price × Electricity tariff");
    expect(t).toContain("Run grid");
  });
});

describe("scenario store", () => {
  it("add, rename, duplicate, remove persist and survive a reload", () => {
    const storage = memory();
    let n = 0;
    const store = createScenarioStore(createScenarioRepository(storage), () => "2026-01-01T00:00:00.000Z", () => `id${++n}`);
    store.hydrate();
    expect(store.getSnapshot().hydrated).toBe(true);
    expect(store.add({ name: "Higher diesel price", overrides: { dieselPrice: 1.5 } }).ok).toBe(true);
    expect(store.rename("id1", "Diesel +50%").ok).toBe(true);
    expect(store.duplicate("id1").ok).toBe(true);
    expect(store.update("id1", { description: "note", overrides: { dieselPrice: 2 } }).ok).toBe(true);
    const again = createScenarioStore(createScenarioRepository(storage));
    again.hydrate();
    expect(again.getSnapshot().scenarios.map((s) => s.name)).toEqual(["Diesel +50%", "Diesel +50% (copy)"]);
    expect(again.getSnapshot().scenarios[0]!.overrides).toEqual({ dieselPrice: 2 });
    expect(store.remove("id2").ok).toBe(true);
    expect(store.getSnapshot().scenarios.length).toBe(1);
    expect(storage.getItem("greenfleet-viability-lab:assessment")).toBeNull();
  });
  it("notifies subscribers and stops at the limit without losing data", () => {
    const store = createScenarioStore(createScenarioRepository(memory()));
    store.hydrate();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    for (let k = 0; k < MAX_SCENARIOS; k++) expect(store.add({ name: `S${k}`, overrides: { dieselPrice: 1 + k } }).ok).toBe(true);
    const over = store.add({ name: "extra", overrides: { dieselPrice: 99 } });
    expect(over.ok).toBe(false);
    expect(store.getSnapshot().scenarios.length).toBe(MAX_SCENARIOS);
    expect(calls).toBe(MAX_SCENARIOS);
    off();
  });
  it("server snapshot is empty so nothing is invented before the browser loads", () => {
    const store = createScenarioStore(createScenarioRepository(null));
    expect(store.getServerSnapshot()).toEqual({ scenarios: [], hydrated: false });
  });
});

describe("Results: calls to action by classification", () => {
  const card = (p: Patch) => {
    const o = calculateAssessment(makeInput(p));
    if (!o.ok) throw new Error("x");
    return renderToStaticMarkup(<CommercialHeadline r={o.result} f={f} />);
  };
  it("each state routes to the right analysis", () => {
    expect(card(P({ bev: { upfrontVehicleCost: 20000 } }))).toContain("Explore What Would Make It Viable");
    expect(card(P({ operations: { dailyDistanceKm: 450 }, bev: { usableRangeKm: 300, operational: { chargingOpportunity: "public_available" } } }))).toContain("See What Would Make It Fully Viable");
    const viable = card({});
    expect(viable).toContain("View Viability Margin");
    expect(viable).toContain('href="/sensitivity#bev"');
    expect(card(P({ operations: { dailyDistanceKm: 450 }, bev: { usableRangeKm: 300, operational: { chargingOpportunity: null } } }))).toContain("Complete Missing Inputs");
  });
  it("the full Results page still renders for the demo", () => {
    expect(text(<ResultsBody assessment={demo()} />)).toMatch(/Explore What Would Make It Viable|View Viability Margin|See What Would Make It Fully Viable/);
  });
});
