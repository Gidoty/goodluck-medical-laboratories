import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateAssessment } from "@/calculation/engine";
import { evaluateInput } from "@/calculation/analysis/evaluate";
import { runDriverAnalysis, runSensitivityAnalysis, runTwoWaySensitivity } from "@/calculation/sensitivity";
import { analyzeViability } from "@/calculation/threshold";
import { createDemoAssessment, DEMO_CASES } from "@/domain/demo";
import { runAssessment } from "@/domain/runAssessment";
import { analysisRecordFor, buildFor } from "./perf-helpers";

/**
 * Performance observations. The limits are deliberately generous (an order of magnitude above what a laptop needs) so the suite is
 * not flaky; they exist to catch an accidental slowdown such as a loop that scales badly. The measured times are written to
 * e2e/out/perf-node.json and quoted in docs/VALIDATION_AND_VERIFICATION.md as observations, not as performance promises.
 */
const time = (fn: () => unknown, runs = 5): { medianMs: number; maxMs: number; runs: number } => {
  const xs: number[] = [];
  for (let i = 0; i < runs; i++) { const t = performance.now(); fn(); xs.push(performance.now() - t); }
  xs.sort((a, b) => a - b);
  return { medianMs: Number(xs[Math.floor(xs.length / 2)]!.toFixed(2)), maxMs: Number(xs[xs.length - 1]!.toFixed(2)), runs };
};

describe("performance observations (Node, one core)", () => {
  const a = runAssessment(createDemoAssessment("p", "2026-01-01T00:00:00.000Z", "not_yet_viable_bev"));
  if (a.status !== "ok") throw new Error("demo case must run");
  const input = a.input;
  const out: Record<string, unknown> = {};

  it("base assessment (normalise + calculate + classify)", () => {
    const t = time(() => runAssessment(createDemoAssessment("p", "2026-01-01T00:00:00.000Z", "not_yet_viable_bev")), 15);
    out.baseAssessment = t;
    expect(t.medianMs).toBeLessThan(100);
  });
  it("engine alone, at the longest horizon (50 years) with replacements", () => {
    const long = JSON.parse(JSON.stringify(input));
    long.operations.analysisHorizonYears = 50;
    const t = time(() => calculateAssessment(long), 15);
    out.engine50Years = t;
    expect(t.medianMs).toBeLessThan(200);
  });
  it("one-way sensitivity (5 points)", () => {
    const t = time(() => runSensitivityAnalysis({ input, technology: "bev", variableId: "bevAcquisition" }));
    out.oneWay = t;
    expect(t.medianMs).toBeLessThan(500);
  });
  it("driver ranking (all economic variables, low and high)", () => {
    const t = time(() => runDriverAnalysis({ input, technology: "bev" }));
    out.drivers = t;
    expect(t.medianMs).toBeLessThan(1_000);
  });
  it("two-way sensitivity (default grid plus the break-even frontier)", () => {
    const t = time(() => runTwoWaySensitivity({ input, technology: "bev", xId: "bevAcquisition", yId: "electricityTariff" }), 3);
    out.twoWay = t;
    expect(t.medianMs).toBeLessThan(5_000);
  });
  it("threshold analysis: 'What would make it viable?' for one technology", () => {
    const t = time(() => analyzeViability(input, "bev"), 3);
    out.thresholdAnalysisBev = t;
    expect(t.medianMs).toBeLessThan(5_000);
  });
  it("viability margin for a VIABLE case (the most solver work)", () => {
    const v = runAssessment(createDemoAssessment("p", "2026-01-01T00:00:00.000Z", "strong_bev"));
    if (v.status !== "ok") throw new Error("x");
    const t = time(() => analyzeViability(v.input, "bev"), 3);
    out.viabilityMarginBev = t;
    expect(t.medianMs).toBeLessThan(5_000);
  });
  it("report model construction and every export, from stored analyses (no analysis is re-run)", () => {
    const rec = analysisRecordFor(input);
    const t = time(() => buildFor(input, rec), 15);
    out.reportAndExports = t;
    expect(t.medianMs).toBeLessThan(500);
  });
  it("all five demonstration cases calculate", () => {
    const t = time(() => { for (const c of DEMO_CASES) runAssessment(createDemoAssessment("p", "2026-01-01T00:00:00.000Z", c.id)); }, 5);
    out.fiveDemoCases = t;
    expect(t.medianMs).toBeLessThan(500);
  });
  it("records the observations", () => {
    out.note = "Node on one core; not a promise. Browser timings are in e2e/qa.cjs output.";
    out.evaluateInputOnce = time(() => evaluateInput(input), 25);
    writeFileSync(new URL("../../e2e/out/perf-node.json", import.meta.url), JSON.stringify(out, null, 2));
    expect(Object.keys(out).length).toBeGreaterThan(8);
  });
});
