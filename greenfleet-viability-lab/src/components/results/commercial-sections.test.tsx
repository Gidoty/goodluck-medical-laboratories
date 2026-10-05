import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { calculateAssessment } from "@/calculation/engine";
import { makeInput } from "@/calculation/fixtures";
import type { AssessmentCalculationResult } from "@/calculation/types";
import { resultFormatter } from "./format-results";
import { CommercialHeadline, CommercialMatrix, CommercialPolicyNote, WhyPanels } from "./commercial-sections";

type Patch = Parameters<typeof makeInput>[0];
function run(patch: Patch = {}): AssessmentCalculationResult {
  const o = calculateAssessment(makeInput(patch));
  if (!o.ok) throw new Error("calc failed");
  return o.result;
}
const f = resultFormatter("NGN");
const text = (el: ReactElement) => renderToStaticMarkup(el).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const everything = (r: AssessmentCalculationResult) => text(<><CommercialHeadline r={r} f={f} /><CommercialMatrix r={r} /><WhyPanels r={r} f={f} /><CommercialPolicyNote r={r} /></>);
const longDay = (opportunity: string | null, extra: Record<string, unknown> = {}): Patch => ({ operations: { dailyDistanceKm: 450, ...extra }, bev: { usableRangeKm: 300, operational: { chargingOpportunity: opportunity } } }) as Patch;

describe("commercial classification UI: all four states", () => {
  it("VIABLE: the careful wording and the not-investment-advice line", () => {
    const t = text(<CommercialHeadline r={run()} f={f} />);
    expect(t).toContain("VIABLE");
    expect(t).toContain("establishes a favourable commercial case relative to diesel with no identified material operational constraint");
    expect(t).toContain("Decision-support result, not investment advice.");
    expect(t).not.toMatch(/\bbuy\b/i);
  });
  it("CONDITIONALLY VIABLE: Conditions to Resolve, derived from the reason codes", () => {
    const t = text(<CommercialHeadline r={run(longDay("public_available"))} f={f} />);
    expect(t).toContain("CONDITIONALLY VIABLE");
    expect(t).toContain("Conditions to Resolve");
    expect(t).toContain("Secure reliable daytime charging.");
  });
  it("NOT YET VIABLE: barriers, the change warning and the sensitivity CTA", () => {
    const html = renderToStaticMarkup(<CommercialHeadline r={run(longDay("depot_only", { averageRouteDistanceKm: 350 }))} f={f} />);
    const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(t).toContain("NOT YET VIABLE");
    expect(t).toContain("Primary barriers under current assumptions");
    expect(t).toContain("These results may change if key assumptions change.");
    expect(t).toContain("Explore What Could Change This Result");
    expect(html).toContain('href="/sensitivity"');
  });
  it("INSUFFICIENT EVIDENCE: says what is missing and links to the inputs, with no forced label", () => {
    const html = renderToStaticMarkup(<CommercialHeadline r={run(longDay(null))} f={f} />);
    const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(t).toContain("INSUFFICIENT EVIDENCE");
    expect(t).toContain("What is missing");
    expect(t).toContain("Complete Missing Inputs");
    expect(html).toContain('href="/assessment/electric"');
  });
});

describe("commercial classification UI: structure", () => {
  const r = run();
  it("shows diesel as the baseline and never gives it a label", () => {
    const t = text(<CommercialHeadline r={r} f={f} />);
    expect(t).toContain("Baseline");
    expect(t.match(/Diesel/g)?.length).toBeGreaterThan(0);
    expect(renderToStaticMarkup(<CommercialHeadline r={r} f={f} />).match(/data-testid="commercial-diesel"/)).toBeNull();
  });
  it("each headline card shows the classification, reason, NPV, discounted payback, operational and environmental lines", () => {
    const t = text(<CommercialHeadline r={r} f={f} />);
    for (const s of ["NPV vs diesel", "Discounted payback", "Operational", "Environmental", "Environmental comparison unavailable"]) expect(t).toContain(s);
  });
  it("the matrix lists every dimension and the three completeness states, with no numbers as scores", () => {
    const t = text(<CommercialMatrix r={r} />);
    for (const s of ["Economic", "Operational", "Environmental", "Evidence completeness", "Commercial classification", "not required for the classification"]) expect(t).toContain(s);
    expect(t).not.toMatch(/\b\d+\s*\/\s*100\b/);
  });
  it("Why this result? exposes the trace, reason codes, conditions and the policy version", () => {
    const t = text(<WhyPanels r={run(longDay("public_available"))} f={f} />);
    for (const s of ["Why this result?", "Economic evidence", "Operational evidence", "Material conditions", "Uncertainties", "Hard constraints", "Environmental context", "Decision trace", "Reason codes", "GreenFleet Commercial Viability Policy v1.0", "DAYTIME_CHARGING_REQUIRED"]) expect(t).toContain(s);
  });
  it("discloses the prototype tolerance and that these are not investment laws", () => {
    const t = text(<CommercialPolicyNote r={r} />);
    expect(t).toContain("prototype decision tolerance of ±5%");
    expect(t).toContain("not universal investment laws");
  });
  it("never prints NaN, Infinity, undefined or [object Object], in any state", () => {
    for (const p of [{}, longDay("public_available"), longDay("depot_only"), longDay(null), { bev: { upfrontVehicleCost: 20000 } }, { bev: { upfrontVehicleCost: 9000 } }] as Patch[]) {
      expect(everything(run(p))).not.toMatch(/NaN|Infinity|undefined|\[object Object\]|\{cur\}/);
    }
  });
  it("environmental context sits beside the classification, including when emissions are higher", () => {
    const r2 = run({ environmentalAssumptions: { diesel: { value: 1, unit: "kg CO2e/litre", unitId: "kgco2e_per_litre", scope: null, source: "s", sourceYear: 2020, notes: null, lifecycleAdjustmentPct: null }, gridElectricity: { value: 5, unit: "kg CO2e/kWh", unitId: "kgco2e_per_kwh", scope: null, source: "s", sourceYear: 2020, notes: null, lifecycleAdjustmentPct: null } } } as unknown as Patch);
    const t = text(<CommercialHeadline r={r2} f={f} />);
    expect(t).toContain("VIABLE");
    expect(t).toMatch(/% higher than diesel under the supplied emission factors/);
  });
});
