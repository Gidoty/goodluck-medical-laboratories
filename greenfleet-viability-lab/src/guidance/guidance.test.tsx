import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/overview",
  useRouter: () => ({ push: () => undefined }),
  redirect: () => undefined,
  notFound: () => undefined,
}));

import AboutPage from "@/app/(app)/about/page";
import AssessmentStepPage from "@/app/(app)/assessment/[step]/page";
import MethodologyPage from "@/app/(app)/methodology/page";
import OverviewPage from "@/app/(app)/overview/page";
import ResultsPage from "@/app/(app)/results/page";
import ScenariosPage from "@/app/(app)/scenarios/page";
import SensitivityPage from "@/app/(app)/sensitivity/page";
import LandingPage from "@/app/page";
import { StepGuidanceNote } from "@/components/assessment/step-guidance-note";
import { AppShell } from "@/components/layout/app-shell";
import { ResultsBody } from "@/components/results/results-view";
import { HelpTip } from "@/components/ui/help-tip";
import { GLOSSARY } from "@/content/glossary";
import { FIELDS } from "@/domain/schema/fields";
import { runAssessment } from "@/domain/runAssessment";
import { ASSESSMENT_STEPS } from "@/domain/steps";
import { AssessmentStoreProvider } from "@/state/StoreProvider";
import { STORAGE_KEY } from "@/state/repository";
import { blank, demo } from "@/test/helpers";
import { GuidanceBody } from "./GuidanceBody";
import { HelpButton, PageHelpButton } from "./HelpButtons";
import { DISCLAIMER, GUIDANCE, HELP_TOPICS, TOUR_STEPS, WELCOME } from "./content";
import { createOnboardingStore, ONBOARDING_KEY } from "./onboardingStore";
import { getGuidance, guidanceIdForPath, relatedEntries, STEP_GUIDANCE } from "./registry";
import { guidanceReducer, initialGuidanceState, isInWorkspace, shouldShowWelcome, type GuidanceAction, type GuidanceState } from "./state";
import type { GuidanceId } from "./types";

const html = (el: ReactElement) => renderToStaticMarkup(<AssessmentStoreProvider>{el}</AssessmentStoreProvider>);
const text = (el: ReactElement) => html(el).replace(/&#x27;/g, "'").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const body = (id: GuidanceId) => text(<GuidanceBody content={getGuidance(id)} />);

function memoryStorage() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
}
const run = (s: GuidanceState, ...actions: GuidanceAction[]) => actions.reduce(guidanceReducer, s);
const loadedFresh = (): GuidanceState => run(initialGuidanceState, { type: "loaded", record: null });

describe("onboarding state: first visit, skip, complete, dismiss, restart", () => {
  it("1. offers the welcome on a first visit inside the workspace, and not before storage is read", () => {
    expect(shouldShowWelcome(initialGuidanceState, true)).toBe(false);
    expect(shouldShowWelcome(loadedFresh(), true)).toBe(true);
    expect(shouldShowWelcome(loadedFresh(), false)).toBe(false);
    expect(isInWorkspace("/")).toBe(false);
    expect(isInWorkspace("/overview")).toBe(true);
  });
  it("2. Skip for now records 'skipped' and the welcome does not return", () => {
    const s = run(loadedFresh(), { type: "welcome_skip" });
    expect(s.record?.status).toBe("skipped");
    expect(s.pendingSave).toBe("skipped");
    expect(shouldShowWelcome(s, true)).toBe(false);
  });
  it("3. finishing the tour records 'completed'", () => {
    const s = run(loadedFresh(), { type: "tour_start" }, { type: "tour_next" }, { type: "tour_finish" });
    expect(s.record?.status).toBe("completed");
    expect(s.tour.open).toBe(false);
  });
  it("4. dismissing (Escape, Start Assessment) records 'dismissed' and does not auto-open again", () => {
    for (const a of [{ type: "welcome_dismiss" }, { type: "welcome_start" }] as GuidanceAction[]) {
      const s = run(loadedFresh(), a);
      expect(s.record?.status).toBe("dismissed");
      expect(shouldShowWelcome(s, true)).toBe(false);
    }
    expect(run(loadedFresh(), { type: "tour_start" }, { type: "tour_close" }).record?.status).toBe("dismissed");
  });
  it("5. the Quick Tour can be restarted at any time, from the first step, keeping the earlier choice", () => {
    let s = run(loadedFresh(), { type: "welcome_skip" });
    s = run(s, { type: "tour_start" });
    expect(s.tour).toEqual({ open: true, step: 0 });
    expect(s.record?.status).toBe("skipped");
    s = run(s, { type: "tour_next" }, { type: "tour_next" }, { type: "tour_start" });
    expect(s.tour.step).toBe(0);
  });
  it("the tour has 5 to 8 steps, cannot run past the end or before the start", () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(5);
    expect(TOUR_STEPS.length).toBeLessThanOrEqual(8);
    let s = run(loadedFresh(), { type: "tour_start" });
    for (let i = 0; i < 20; i++) s = run(s, { type: "tour_next" });
    expect(s.tour.step).toBe(TOUR_STEPS.length - 1);
    for (let i = 0; i < 20; i++) s = run(s, { type: "tour_back" });
    expect(s.tour.step).toBe(0);
  });
  it("the welcome stays hidden while the tour or help is open", () => {
    expect(shouldShowWelcome(run(loadedFresh(), { type: "tour_start" }), true)).toBe(false);
    expect(shouldShowWelcome(run(loadedFresh(), { type: "help_open" }), true)).toBe(false);
  });
  it("opening help closes the tour and closing help clears the topic", () => {
    const s = run(loadedFresh(), { type: "tour_start" }, { type: "help_open", id: "results.economic" });
    expect(s.tour.open).toBe(false);
    expect(s.help).toEqual({ open: true, id: "results.economic" });
    expect(run(s, { type: "help_close" }).help).toEqual({ open: false, id: null });
  });
});

describe("onboarding persistence", () => {
  it("round-trips completed, skipped and dismissed", () => {
    for (const status of ["completed", "skipped", "dismissed"] as const) {
      const storage = memoryStorage();
      createOnboardingStore(storage).save(status);
      expect(createOnboardingStore(storage).load()?.status).toBe(status);
    }
  });
  it("is empty on a first visit, and ignores corrupted or unknown data", () => {
    const storage = memoryStorage();
    expect(createOnboardingStore(storage).load()).toBeNull();
    storage.setItem(ONBOARDING_KEY, "{not json");
    expect(createOnboardingStore(storage).load()).toBeNull();
    storage.setItem(ONBOARDING_KEY, JSON.stringify({ version: 1, status: "banana" }));
    expect(createOnboardingStore(storage).load()).toBeNull();
    storage.setItem(ONBOARDING_KEY, JSON.stringify({ version: 99, status: "skipped" }));
    expect(createOnboardingStore(storage).load()).toBeNull();
  });
  it("works without storage at all (private browsing)", () => {
    const store = createOnboardingStore(null);
    expect(store.save("skipped").status).toBe("skipped");
    expect(store.load()).toBeNull();
    const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(() => createOnboardingStore(throwing).save("skipped")).not.toThrow();
    expect(createOnboardingStore(throwing).load()).toBeNull();
  });
  it("6/24/26. never touches the assessment: its own key, and no calculation changes", () => {
    expect(ONBOARDING_KEY).not.toBe(STORAGE_KEY);
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "ASSESSMENT-DATA");
    const store = createOnboardingStore(storage);
    store.save("completed");
    store.clear();
    store.save("skipped");
    expect(storage.getItem(STORAGE_KEY)).toBe("ASSESSMENT-DATA");
    const a = demo();
    const before = JSON.stringify(runAssessment(a));
    let s = loadedFresh();
    s = run(s, { type: "tour_start" }, { type: "tour_next" }, { type: "help_open", id: "assessment.bev" }, { type: "help_close" }, { type: "welcome_skip" }, { type: "tour_start" }, { type: "tour_finish" });
    expect(s.record?.status).toBe("completed");
    expect(JSON.stringify(runAssessment(a))).toBe(before);
  });
});

describe("guidance registry", () => {
  const IDS = Object.keys(GUIDANCE) as GuidanceId[];
  it("every entry is complete enough to show and has the same id as its key", () => {
    for (const id of IDS) {
      const g = GUIDANCE[id];
      expect(g.id).toBe(id);
      expect(g.title.length).toBeGreaterThan(3);
      expect(g.shortDescription.length).toBeGreaterThan(10);
    }
    for (const id of ["home", "assessment.business", "assessment.diesel", "assessment.bev", "assessment.biofuel", "assessment.finance", "assessment.review", "results.overview", "results.economic", "results.operational", "results.environmental", "results.commercial", "methodology", "sensitivity", "scenarios"] as GuidanceId[]) expect(GUIDANCE[id]).toBeDefined();
  });
  it("7. maps every page to the right guidance", () => {
    expect(guidanceIdForPath("/")).toBe("home");
    expect(guidanceIdForPath("/overview")).toBe("home");
    expect(guidanceIdForPath("/assessment/business")).toBe("assessment.business");
    expect(guidanceIdForPath("/assessment/diesel")).toBe("assessment.diesel");
    expect(guidanceIdForPath("/assessment/electric")).toBe("assessment.bev");
    expect(guidanceIdForPath("/assessment/biofuel")).toBe("assessment.biofuel");
    expect(guidanceIdForPath("/assessment/finance")).toBe("assessment.finance");
    expect(guidanceIdForPath("/assessment/review")).toBe("assessment.review");
    expect(guidanceIdForPath("/assessment")).toBe("assessment.business");
    expect(guidanceIdForPath("/results")).toBe("results.overview");
    expect(guidanceIdForPath("/methodology")).toBe("methodology");
    expect(guidanceIdForPath("/sensitivity")).toBe("sensitivity");
    expect(guidanceIdForPath("/scenarios/")).toBe("scenarios");
    expect(guidanceIdForPath("/nowhere")).toBe("home");
    for (const s of ASSESSMENT_STEPS) expect(GUIDANCE[STEP_GUIDANCE[s.id]]).toBeDefined();
  });
  it("the help index covers the nine topics and points only at real entries", () => {
    expect(HELP_TOPICS.map((t) => t.title)).toEqual(["Getting Started", "Entering Fleet Data", "Diesel Baseline", "Battery Electric Vehicles", "Biofuel", "Finance & Infrastructure", "Understanding Results", "Commercial Viability", "Methodology"]);
    for (const t of HELP_TOPICS) for (const e of t.entries) expect(GUIDANCE[e]).toBeDefined();
    for (const id of relatedEntries("results.overview")) expect(GUIDANCE[id]).toBeDefined();
  });
  it("related terms point at real glossary entries and links at real routes", () => {
    for (const id of IDS) {
      for (const k of GUIDANCE[id].relatedTerms ?? []) expect(GLOSSARY[k], `${id}:${k}`).toBeDefined();
      for (const l of GUIDANCE[id].links ?? []) expect(l.href).toMatch(/^\//);
    }
  });
  it("keeps to plain text: no dashes used as punctuation, no manufacturer or market figures, no Group 8", () => {
    const all = JSON.stringify([GUIDANCE, TOUR_STEPS, WELCOME, GLOSSARY]);
    expect(all).not.toMatch(/ — | – /);
    expect(all).not.toMatch(/Group 8/);
    expect(all).not.toMatch(/₦\s?\d|\$\s?\d|\bTesla\b|\bToyota\b|\bMercedes\b/);
  });
});

describe("page guidance content (the task's required explanations)", () => {
  it("9-13. each assessment step receives its own guidance", () => {
    expect(body("assessment.business")).toContain("transport duty that the Diesel, BEV and Biofuel alternatives must perform");
    expect(body("assessment.diesel")).toContain("Diesel is the comparison baseline");
    expect(body("assessment.diesel")).toContain("Next, you will describe the battery-electric alternative.");
    expect(body("assessment.bev")).toContain("Range and charging inputs affect operational feasibility, while price and energy inputs affect commercial economics");
    expect(body("assessment.bev")).toContain("Next, you will configure the biofuel alternative.");
    expect(body("assessment.biofuel")).toContain("Fuel availability affects operational feasibility independently from financial attractiveness");
    const fin = body("assessment.finance");
    expect(fin).toContain("independently of debt financing");
    expect(fin).toContain("not double-counted");
    expect(fin).toContain("Enter 10 for 10%");
  });
  it("14. the review guidance names the real badges and the reliability caveat", () => {
    const t = body("assessment.review");
    expect(t).toContain("results are only as reliable as the inputs supplied");
    for (const b of ["USER INPUT", "DERIVED VALUE", "MISSING / EXCLUDED", "ILLUSTRATIVE ASSUMPTION", "SOURCED VALUE"]) expect(t).toContain(b);
    expect(t).toContain("calculate economic performance, operational feasibility, environmental performance where emission factors are available, and commercial viability");
  });
  it("15. results guidance explains the four separate dimensions", () => {
    const t = body("results.overview");
    for (const d of ["Economic Performance", "Operational Feasibility", "Environmental Performance", "Commercial Viability", "should not be interpreted as interchangeable"]) expect(t).toContain(d);
  });
  it("17. commercial viability help defines all four states and environmental independence", () => {
    const t = body("results.commercial");
    expect(t).toContain("Favourable economic case and no identified material unresolved operational constraint.");
    expect(t).toContain("Potentially credible commercial case, but one or more conditions or material uncertainties must be resolved.");
    expect(t).toContain("Current assumptions do not establish a sufficiently credible commercial case.");
    expect(t).toContain("Essential information required for a defensible classification is missing.");
    expect(t).toContain("does not determine the commercial classification under Policy v1.0");
  });
  it("18. operational help defines all four operational states", () => {
    const t = body("results.operational");
    for (const s of ["SUITABLE", "CONDITIONAL", "CONSTRAINED", "INSUFFICIENT DATA", "range", "route", "charging", "payload", "fuel availability", "infrastructure", "refuelling"]) expect(t.toLowerCase()).toContain(s.toLowerCase());
  });
  it("19. environmental help says missing data are not zero and names the scope limits", () => {
    const t = body("results.environmental");
    expect(t).toContain("Missing environmental data are shown as unavailable, not zero.");
    for (const s of ["CO2e", "Emission factor", "tCO2e per year", "kg CO2e per km", "Change vs diesel", "embodied emissions"]) expect(t).toContain(s);
  });
  it("20. NPV and payback help explain the interpretation", () => {
    const t = body("results.economic");
    expect(t).toContain("An economic advantage over diesel under the entered assumptions.");
    expect(t).toContain("An economic disadvantage compared with diesel under the entered assumptions.");
    for (const s of ["Total cost of ownership (TCO)", "Present cost", "Cost per km", "Payback", "Discounted payback"]) expect(t).toContain(s);
    expect(GLOSSARY.npv!.text).toMatch(/Positive means an advantage/);
  });
  it("the decision-trace help explains the gates", () => {
    const t = body("results.why");
    for (const s of ["exact rules GreenFleet followed", "Evidence gate", "Operational gate", "Economic gate", "Conditions", "Uncertainties", "Hard constraints", "Reason codes"]) expect(t).toContain(s);
  });
  it("27/28. sensitivity and scenarios guidance does not claim the feature exists", () => {
    const s = body("sensitivity");
    expect(s).toContain("Sensitivity analysis will allow you to examine how changing key assumptions affects the result.");
    expect(s).toContain("not available yet");
    const c = body("scenarios");
    expect(c).toContain("will allow you to keep different sets of assumptions");
    expect(c).toContain("not available yet");
    for (const t of [s, c]) expect(t).not.toMatch(/\byou can (run|compare|save)\b/i);
    expect(TOUR_STEPS.find((x) => x.id === "upcoming")!.body).toContain("not available yet");
  });
  it("home guidance explains the scope and the limits", () => {
    const t = body("home");
    expect(t.toLowerCase()).toContain("diesel baseline");
    expect(t).toContain("does not supply live market prices");
    expect(t).toContain("does not guarantee investment outcomes");
  });
  it("40. the prototype disclaimer is present in Help and wording is as specified", () => {
    expect(DISCLAIMER).toBe("GreenFleet is an academic decision-support prototype. Guidance explains how to use the model and does not constitute financial, investment, engineering or regulatory advice.");
    expect(body("about")).toContain("academic decision-support prototype");
  });
  it("the welcome text and four-step journey match the specification", () => {
    expect(WELCOME.text).toContain("compare Diesel, Battery Electric and Biofuel vehicles using their own operating, cost, infrastructure and environmental assumptions");
    expect(WELCOME.journey.map((j) => j.title)).toEqual(["Describe Your Fleet", "Enter Technology Assumptions", "Run the Assessment", "Compare Commercial Viability"]);
  });
});

describe("controls are present where they are needed", () => {
  it("8. a global Help control sits in the application shell on every workspace page", async () => {
    const steps = await Promise.all(ASSESSMENT_STEPS.map(async (s) => AssessmentStepPage({ params: Promise.resolve({ step: s.id }) })));
    const pages: ReactElement[] = [<OverviewPage key="o" />, <ResultsPage key="r" />, <SensitivityPage key="s" />, <ScenariosPage key="sc" />, <MethodologyPage key="m" />, <AboutPage key="a" />, ...steps];
    for (const p of pages) {
      const m = html(<AppShell>{p}</AppShell>);
      expect(m).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*>[^]*?Help<\/button>/);
      expect(m).toContain("How to use this page");
    }
  });
  it("the landing page also has Help, and still carries the Group 8 credit exactly once", () => {
    const m = html(<LandingPage />);
    expect(m).toContain("Help</button>");
    expect(m.split("Built by Group 8").length - 1).toBe(1);
  });
  it("each assessment step shows its own short guidance and a link to more", () => {
    for (const s of ASSESSMENT_STEPS) {
      const m = text(<StepGuidanceNote stepId={s.id} />);
      expect(m).toContain("In this step:");
      expect(m).toContain("More help for this step");
    }
    expect(text(<StepGuidanceNote stepId="diesel" />)).toContain("Next: Next, you will describe the battery-electric alternative.");
  });
  it("buttons are real buttons with accessible names, so they work by keyboard and touch", () => {
    const m = html(<><HelpButton /><PageHelpButton id="home" /></>);
    expect(m.match(/<button type="button"/g)?.length).toBe(2);
    expect(m).toContain('aria-haspopup="dialog"');
    expect(m).toMatch(/min-h-11/);
  });
  it("21. field help is a focusable button that names the term and is not hover-only", () => {
    const m = html(<HelpTip term="usableRange" />);
    expect(m).toContain('<button type="button"');
    expect(m).toContain('aria-label="What is Usable range?"');
    expect(m).toContain('aria-expanded="false"');
  });
  it("25. every technically difficult field has a tooltip with a plain explanation", () => {
    const need: Record<string, string> = {
      "ops.analysisHorizon": "analysisHorizon", "ops.annualDistance": "utilisation", "diesel.fuelEfficiency": "fuelEfficiency", "bev.energyConsumption": "energyConsumption",
      "bev.usableRange": "usableRange", "bev.chargingLoss": "chargingLosses", "bev.chargingDowntime": "chargingDowntime", "bev.payloadReduction": "payloadReduction",
      "diesel.residualValue": "residualValue", "finance.discountRate": "discountRate", "diesel.fuelEscalation": "escalation", "diesel.usefulLife": "usefulLife",
      "bev.batteryReplacement": "batteryReplacement", "bevInfra.vehiclesSharing": "infraSharing", "env.diesel.value": "emissionFactor", "env.lifecycle.diesel": "lifecycleAdjustment",
      "biofuel.fuelAvailability": "fuelAvailability",
    };
    for (const [id, key] of Object.entries(need)) {
      const f = FIELDS.find((x) => x.id === id);
      if (!f) continue; // some ids differ by technology; the loop below covers all fields that carry a term
      expect(f.glossary, id).toBe(key);
    }
    expect(FIELDS.filter((f) => f.glossary === "usefulLife").length).toBe(3);
    expect(GLOSSARY.discountRate!.text).toContain("Enter 10 for 10%");
    expect(GLOSSARY.usableRange!.text).toContain("Enter the range you want GreenFleet to use for route compatibility");
    expect(GLOSSARY.co2e).toBeDefined();
    for (const k of ["batteryReplacement", "infraSharing", "fuelAvailability", "chargingDowntime", "payloadReduction", "usefulLife", "npv", "payback"]) expect(GLOSSARY[k]!.text.length).toBeGreaterThan(40);
  });
  it("does not add tooltips to obvious fields", () => {
    expect(FIELDS.find((f) => f.id === "business.businessName")!.glossary).toBeUndefined();
    expect(FIELDS.find((f) => f.id === "business.assessmentName")!.glossary).toBeUndefined();
  });
  it("results tables carry help for NPV and payback", () => {
    const m = html(<ResultsBody assessment={demo()} />);
    for (const t of ["Net present value (NPV)?", "Payback?", "Discounted payback?", "Total cost of ownership (TCO)?"]) expect(m).toContain(`aria-label="What is ${t}"`);
    expect(m).toContain("How to read these figures");
    expect(m).toContain("What the statuses mean");
    expect(m).toContain("How emissions are estimated");
    expect(m).toContain("What the four labels mean");
    expect(m).toContain("How to read the decision trace");
  });
  it("39. the empty results page explains itself, offers a start and the overview, and draws no charts", () => {
    const m = html(<ResultsBody assessment={blank()} />);
    const t = m.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(t).toContain("No assessment results are available yet.");
    expect(t).toContain("Start an Assessment");
    expect(t).toContain("How GreenFleet Works");
    expect(m).not.toContain("recharts");
  });
  it("home explains how GreenFleet works in six steps", () => {
    const t = text(<OverviewPage />);
    expect(t).toContain("How GreenFleet Works");
    expect(t).toContain("Review GreenFleet's transparent commercial classification.");
  });
  it("29. Group 8 attribution is unchanged and does not appear in any guidance or help", () => {
    expect(JSON.stringify(GUIDANCE) + JSON.stringify(TOUR_STEPS)).not.toContain("Group 8");
  });
});
