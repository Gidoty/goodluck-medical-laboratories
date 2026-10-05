import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
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
import { StepForm } from "@/components/assessment/step-form";
import { ResultsBody } from "@/components/results/results-view";
import { AppShell } from "@/components/layout/app-shell";
import { PRODUCT_CREDIT } from "@/components/landing/product-credit";
import { checkAssessment } from "@/domain/checks";
import { ASSESSMENT_STEPS } from "@/domain/steps";
import { AssessmentStoreProvider } from "@/state/StoreProvider";
import { demo, blank, setChoiceOf, setNum, setText } from "@/test/helpers";

const html = (el: ReactElement) => renderToStaticMarkup(<AssessmentStoreProvider>{el}</AssessmentStoreProvider>);
const CREDIT_HTML = "GreenFleet — Built by Group 8, MSc Class of 2025, CELTRAS";

describe("homepage attribution", () => {
  it("uses the exact required wording", () => {
    expect(PRODUCT_CREDIT).toBe(CREDIT_HTML);
  });
  it("appears once on the Home/Landing page", () => {
    const markup = html(<LandingPage />);
    expect(markup).toContain(CREDIT_HTML);
    expect(markup.split(CREDIT_HTML).length - 1).toBe(1);
  });
  it("does not appear on any internal application page", async () => {
    const steps = await Promise.all(ASSESSMENT_STEPS.map(async (s) => AssessmentStepPage({ params: Promise.resolve({ step: s.id }) })));
    const pages: ReactElement[] = [<OverviewPage key="o" />, <ResultsPage key="r" />, <SensitivityPage key="s" />, <ScenariosPage key="sc" />, <MethodologyPage key="m" />, <AboutPage key="a" />, ...steps];
    for (const page of pages) {
      const markup = html(<AppShell>{page}</AppShell>);
      expect(markup).not.toContain("Group 8");
      expect(markup).not.toContain("Class of 2025");
    }
  });
  it("is referenced only by the landing page code", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|css)$/.test(name) && !name.endsWith(".test.tsx") && !name.endsWith(".test.ts")) {
          const src = readFileSync(path, "utf8");
          if (src.includes("Group 8") || src.includes("product-credit")) hits.push(path.replace(/.*\/src\//, ""));
        }
      }
    };
    walk(join(process.cwd(), "src"));
    expect(hits.sort()).toEqual(["components/landing/product-credit.tsx", "components/landing/sections.tsx"]);
  });
});

describe("results page", () => {
  const text = (el: ReactElement) => html(el).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  it("shows the empty state and no figures until an assessment is complete", () => {
    const markup = html(<ResultsBody assessment={blank()} />);
    expect(markup).toContain("No assessment results are available yet.");
    expect(text(<ResultsBody assessment={blank()} />)).not.toMatch(/[₦$]\s?\d/);
  });
  it("shows calculated figures, warnings, charts and assumptions for a complete assessment", () => {
    const t = text(<ResultsBody assessment={demo()} />);
    for (const s of ["Cost of each option on its own", "Each alternative against diesel", "Net present value (NPV)", "Simple payback", "Discounted payback", "Present cost of ownership", "Assumptions used", "Year-by-year cash flows", "Cumulative cash flow versus diesel", "Total cost of ownership", "What the cost is made of"]) expect(t).toContain(s);
    expect(t).toMatch(/₦[\d,]{4,}/);
  });
  it("labels demo results as illustrative", () => {
    expect(text(<ResultsBody assessment={demo()} />)).toContain("These results use illustrative demo values");
  });
  it("shows a real commercial classification for the two alternatives, and none for diesel (Batch 5)", () => {
    const t = text(<ResultsBody assessment={demo()} />);
    expect(t).not.toContain("Commercial classification pending multi-factor assessment");
    expect(t).toContain("Commercial viability against diesel");
    expect(t).toMatch(/VIABLE|NOT YET VIABLE|INSUFFICIENT EVIDENCE/);
    expect(t).toContain("GreenFleet Commercial Viability Policy v1.0");
    expect(t).toContain("Why this result?");
    expect(t).toContain("Baseline");
  });
  it("never shows a score or a weighting", () => {
    expect(text(<ResultsBody assessment={demo()} />)).not.toMatch(/viability score|green score|sustainability score|\d+\s*\/\s*100/i);
  });
  it("never prints NaN, Infinity, undefined or [object Object]", () => {
    for (const a of [demo(), setNum(demo(), "bev.chargingLoss", null), setChoiceOf(demo(), "bev.batteryReplacement", "unknown"), blank()]) {
      expect(text(<ResultsBody assessment={a} />)).not.toMatch(/NaN|Infinity|undefined|\[object Object\]/);
    }
  });
  it("explains a missing payback in words", () => {
    const t = text(<ResultsBody assessment={setNum(demo(), "bev.acquisitionPrice", 90_000_000)} />);
    expect(t).toContain("Not achieved within analysis horizon");
  });

  it("keeps economic, operational and environmental sections separate", () => {
    const t = text(<ResultsBody assessment={demo()} />);
    for (const s of ["Economic attractiveness", "Operational feasibility", "Environmental performance", "Decision dimensions side by side", "Economic data", "Operational data", "Environmental data", "Baseline configuration", "Review Operational Inputs"]) expect(t).toContain(s);
    expect(t).toContain("Estimated operational energy/fuel-related GHG emissions");
  });
  it("shows emissions as unavailable, never zero, when no factor was entered", () => {
    const t = text(<ResultsBody assessment={demo()} />);
    expect(t).toContain("Not available");
    expect(t).toContain("Add Emission Factors");
    expect(t).not.toMatch(/\b0(\.0+)? ?tCO2e/);
  });
  it("calculates emissions from the factors entered on the form", () => {
    let a = demo();
    a = setNum(a, "env.diesel.value", 2.7);
    a = setNum(a, "env.grid.value", 0.4);
    a = setText(a, "env.diesel.source", "Test source");
    const t = text(<ResultsBody assessment={a} />);
    expect(t).toMatch(/\d[\d,.]* tCO2e/);
    expect(t).toContain("Test source");
    expect(t).not.toMatch(/NaN|Infinity|undefined|\[object Object\]/);
  });
  it("discloses the exclusions", () => {
    const t = text(<ResultsBody assessment={demo()} />);
    expect(t).toContain("independently of financing structure");
    expect(t).toContain("Tax effects are excluded");
  });
});

describe("step form", () => {
  const render = (a: Parameters<typeof checkAssessment>[0], step: (typeof ASSESSMENT_STEPS)[number]["id"], showIssues = false) =>
    html(<StepForm stepId={step} assessment={a} issues={checkAssessment(a)} showIssues={showIssues} />);

  it("shows battery replacement details only when replacement is expected", () => {
    expect(render(demo(), "electric")).toContain("Battery replacement year");
    expect(render(setChoiceOf(demo(), "bev.batteryReplacement", "no"), "electric")).not.toContain("Battery replacement year");
    expect(render(setChoiceOf(demo(), "bev.batteryReplacement", "unknown"), "electric")).not.toContain("Estimated battery replacement cost");
  });
  it("shows debt fields only when debt is involved", () => {
    expect(render(demo(), "finance")).toContain("Annual interest rate");
    expect(render(setChoiceOf(demo(), "finance.structure", "equity_100"), "finance")).not.toContain("Annual interest rate");
  });
  it("shows charger purchase fields only for a charger arrangement", () => {
    expect(render(demo(), "finance")).toContain("Charger equipment cost");
    expect(render(setChoiceOf(demo(), "bevInfra.arrangement", "public_only"), "finance")).not.toContain("Charger equipment cost");
  });
  it("shows blend only for biodiesel and conversion cost only for conversions", () => {
    const biofuel = render(demo(), "biofuel");
    expect(biofuel).toContain("Biofuel blend percentage");
    expect(biofuel).not.toContain("Conversion / modification cost");
    const conversion = render(setChoiceOf(setChoiceOf(demo(), "biofuel.pathway", "renewable_diesel"), "biofuel.acquisitionMode", "conversion"), "biofuel");
    expect(conversion).not.toContain("Biofuel blend percentage");
    expect(conversion).toContain("Conversion / modification cost");
  });
  it("puts optional inputs in an Advanced assumptions disclosure", () => {
    expect(render(blank(), "diesel")).toContain("Advanced assumptions");
  });
  it("labels demo values and gives every input a programmatic label", () => {
    const markup = render(demo(), "diesel");
    expect(markup).toContain("Illustrative assumption — not current market data.");
    const inputs = markup.match(/<input[^>]*id="([^"]+)"/g) ?? [];
    for (const m of inputs) {
      const id = /id="([^"]+)"/.exec(m)![1];
      expect(markup, id).toContain(`for="${id}"`);
    }
  });
  it("shows blocking errors only after they are revealed, but always shows warnings", () => {
    const a = demo();
    const bad = { ...a, inputs: { ...a.inputs, "fleet.size": { status: "value" as const, value: 0 } } };
    expect(render(bad, "business")).not.toContain("Fleet size cannot");
    expect(render(bad, "business", true)).toMatch(/Number of vehicles being evaluated must be at least 1/);
  });
});
