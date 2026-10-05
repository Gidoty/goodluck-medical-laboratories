import { describe, expect, it } from "vitest";
import { createBlankAssessment, getNumeric, mergeOntoBlank, setNumeric } from "./assessment";
import { assessmentCompletion, isAssessmentReady, stepCompletion, validateStep } from "./assessmentValidation";
import { createDemoAssessment } from "./demo";
import { missing, notApplicable, value } from "./fieldValue";

const NOW = "2026-01-01T00:00:00.000Z";
const blank = () => createBlankAssessment("a1", NOW);

describe("assessment state helpers", () => {
  it("starts with every numeric input missing, never 0", () => {
    const a = blank();
    expect(getNumeric(a, ["technologies", "diesel", "acquisitionCost"])).toEqual(missing());
    expect(getNumeric(a, ["infrastructure", "chargingInfrastructureCost"])).toEqual(missing());
  });
  it("stores 0 as a value and does not mutate the original", () => {
    const a = blank();
    const b = setNumeric(a, ["infrastructure", "chargingInfrastructureCost"], value(0), NOW);
    expect(getNumeric(b, ["infrastructure", "chargingInfrastructureCost"])).toEqual(value(0));
    expect(getNumeric(a, ["infrastructure", "chargingInfrastructureCost"])).toEqual(missing());
    expect(b.origin).toBe("user");
  });
  it("round-trips not-applicable", () => {
    const b = setNumeric(blank(), ["financing", "loanTermYears"], notApplicable(), NOW);
    expect(getNumeric(b, ["financing", "loanTermYears"])).toEqual(notApplicable());
  });
});

describe("mergeOntoBlank", () => {
  it("keeps valid saved fields, restores new fields, and drops malformed ones", () => {
    const saved = {
      name: "Saved",
      operations: { dailyDistanceKm: { status: "value", value: 0 }, operatingDaysPerYear: { status: "value", value: "oops" } },
    };
    const merged = mergeOntoBlank(blank(), saved);
    expect(merged.name).toBe("Saved");
    expect(merged.operations.dailyDistanceKm).toEqual(value(0));
    expect(merged.operations.operatingDaysPerYear).toEqual(missing());
    expect(merged.technologies.electric.batteryCapacityKwh).toEqual(missing());
  });
});

describe("step validation", () => {
  it("marks an untouched step as not started and an edited one as in progress", () => {
    expect(stepCompletion(blank(), "diesel").state).toBe("not_started");
    const edited = setNumeric(blank(), ["technologies", "diesel", "acquisitionCost"], value(0), NOW);
    expect(stepCompletion(edited, "diesel").state).toBe("in_progress");
  });
  it("requires a loan term only when something is financed", () => {
    let a = setNumeric(blank(), ["financing", "financedSharePct"], value(0), NOW);
    expect(validateStep(a, "finance").some((i) => i.fieldId === "financing.loanTermYears")).toBe(false);
    a = setNumeric(a, ["financing", "financedSharePct"], value(40), NOW);
    expect(validateStep(a, "finance").some((i) => i.fieldId === "financing.loanTermYears")).toBe(true);
    a = setNumeric(a, ["financing", "loanTermYears"], value(3), NOW);
    expect(validateStep(a, "finance").some((i) => i.fieldId === "financing.loanTermYears")).toBe(false);
  });
  it("rejects a blend above the engine-approved maximum", () => {
    let a = setNumeric(blank(), ["technologies", "biofuel", "blendSharePct"], value(30), NOW);
    a = setNumeric(a, ["technologies", "biofuel", "approvedMaxBlendPct"], value(20), NOW);
    expect(validateStep(a, "biofuel").some((i) => i.fieldId === "technologies.biofuel.blendSharePct")).toBe(true);
  });
});

describe("demo assessment", () => {
  it("passes every validation rule and is flagged as demo data", () => {
    const demo = createDemoAssessment("d1", NOW);
    expect(demo.origin).toBe("demo");
    expect(assessmentCompletion(demo).map((c) => [c.stepId, c.errors.length])).toEqual([
      ["business", 0],
      ["diesel", 0],
      ["electric", 0],
      ["biofuel", 0],
      ["finance", 0],
    ]);
    expect(isAssessmentReady(demo)).toBe(true);
  });
  it("preserves a deliberate zero in the demo (battery replacement)", () => {
    expect(getNumeric(createDemoAssessment("d1", NOW), ["technologies", "electric", "batteryReplacementCost"])).toEqual(value(0));
  });
  it("becomes user data after any edit", () => {
    const edited = setNumeric(createDemoAssessment("d1", NOW), ["business", "fleetSize"], value(7), NOW);
    expect(edited.origin).toBe("user");
  });
});
