import { describe, expect, it } from "vitest";
import { calculateAssessment } from "../engine";
import { makeInput } from "../fixtures";
import { evaluateBiofuel, evaluateOperationalFeasibility } from "./index";

type Supply = { availability?: string | null; additionalRefuellingKmPerDay?: number | null; downtimeHoursPerMonth?: number | null; specialInfrastructure?: "yes" | "no" | "unknown" | null };
type Infra = { investmentRequired?: "yes" | "no" | "unknown" | null; storageEquipmentCost?: number | null; refuellingInfrastructureCost?: number | null; installationCost?: number | null; annualMaintenanceCost?: number | null; usefulLifeYears?: number | null };
const SPECIFIED: Infra = { investmentRequired: "yes", storageEquipmentCost: 5000, refuellingInfrastructureCost: 0, installationCost: 800, annualMaintenanceCost: 100, usefulLifeYears: 10 };
const fuel = (supply: Supply = {}, infra: Infra = {}) =>
  evaluateBiofuel(makeInput({ biofuel: { supply: { availability: "reliable", specialInfrastructure: "no", ...supply } }, infrastructure: { biofuel: { investmentRequired: supply.specialInfrastructure ?? "no", ...infra } } } as never));
const messages = (r: ReturnType<typeof fuel>) => r.warnings.map((w) => w.message);

describe("biofuel supply", () => {
  it("reliable supply raises no supply warning and is suitable", () => {
    const r = fuel({ availability: "reliable" });
    expect(r.checks.supply.status).toBe("satisfied");
    expect(r.status).toBe("suitable");
    expect(r.warnings).toEqual([]);
  });
  it("intermittent supply is a stated condition", () => {
    const r = fuel({ availability: "intermittent" });
    expect(r.checks.supply.status).toBe("conditional");
    expect(r.status).toBe("conditional");
    expect(messages(r)).toContain("Biofuel availability is intermittent.");
    expect(r.conditions[0]).toMatch(/fallback/);
  });
  it("limited supply on its own is conditional and is flagged as a material access constraint", () => {
    const r = fuel({ availability: "limited" });
    expect(r.checks.supply.status).toBe("conditional");
    expect(r.checks.supply.explanation).toMatch(/material fuel-access constraint/);
    expect(r.status).toBe("conditional");
    expect(messages(r)).toContain("Biofuel availability is limited.");
  });
  it("limited supply combined with required but unspecified infrastructure is constrained", () => {
    const r = fuel({ availability: "limited", specialInfrastructure: "yes" }, { investmentRequired: "yes", storageEquipmentCost: null });
    expect(r.checks.infrastructure.status).toBe("conditional");
    expect(r.checks.supply.status).toBe("constrained");
    expect(r.status).toBe("constrained");
    expect(r.ruleTrace.join(" ")).toMatch(/limited AND the infrastructure/);
  });
  it("limited supply with specified infrastructure stays conditional", () => {
    expect(fuel({ availability: "limited", specialInfrastructure: "yes" }, SPECIFIED).status).toBe("conditional");
  });
  it("unknown or unstated supply is insufficient data", () => {
    const unknown = fuel({ availability: "unknown" });
    expect(unknown.checks.supply.status).toBe("insufficient");
    expect(unknown.status).toBe("insufficient_data");
    expect(messages(unknown)).toContain("Biofuel availability is unknown.");
    const unstated = fuel({ availability: null });
    expect(unstated.checks.supply.status).toBe("not_assessed");
    expect(unstated.status).toBe("insufficient_data");
    expect(unstated.notAssessed).toContain("Fuel supply");
  });
});

describe("biofuel infrastructure", () => {
  it("not required is satisfied", () => {
    expect(fuel({ specialInfrastructure: "no" }).checks.infrastructure.status).toBe("satisfied");
  });
  it("required and specified is satisfied, because investment alone is not a problem", () => {
    const r = fuel({ specialInfrastructure: "yes" }, SPECIFIED);
    expect(r.checks.infrastructure.status).toBe("satisfied");
    expect(r.checks.infrastructure.explanation).toMatch(/included in the economic analysis/);
    expect(r.warnings).toEqual([]);
    expect(r.status).toBe("suitable");
  });
  it("a zero cost is a real value and counts as specified", () => {
    const r = fuel({ specialInfrastructure: "yes" }, { ...SPECIFIED, storageEquipmentCost: 0, refuellingInfrastructureCost: 0, installationCost: 0 });
    expect(r.checks.infrastructure.status).toBe("satisfied");
  });
  it("required but not fully specified is flagged with the exact message", () => {
    for (const missing of ["storageEquipmentCost", "refuellingInfrastructureCost", "installationCost", "usefulLifeYears"] as const) {
      const r = fuel({ specialInfrastructure: "yes" }, { ...SPECIFIED, [missing]: null });
      expect(r.checks.infrastructure.status, missing).toBe("conditional");
      expect(messages(r)).toContain("Required biofuel infrastructure is not fully specified.");
      expect(r.conditions).toContain("The required biofuel infrastructure must be fully specified.");
    }
  });
  it("unknown is uncertainty, and unstated is not assessed", () => {
    const unknown = fuel({ specialInfrastructure: "unknown" });
    expect(unknown.checks.infrastructure.status).toBe("insufficient");
    expect(unknown.status).toBe("conditional");
    expect(fuel({ specialInfrastructure: null }, { investmentRequired: null }).checks.infrastructure.status).toBe("not_assessed");
  });
});

describe("biofuel indicators", () => {
  it("annualises fuel-related downtime (hours per month x 12) and labels it as an assumption", () => {
    const r = fuel({ downtimeHoursPerMonth: 6 });
    expect(r.downtime).toMatchObject({ hoursPerMonthAsEntered: 6, annualHours: 72 });
    expect(r.downtime.label).toMatch(/Fuel-availability-related downtime assumption/);
    expect(r.downtime.label).toMatch(/not converted into cost/);
    expect(fuel({ downtimeHoursPerMonth: 0 }).downtime).toMatchObject({ hoursPerMonthAsEntered: 0, annualHours: 0 });
    expect(fuel({ downtimeHoursPerMonth: null }).downtime).toMatchObject({ hoursPerMonthAsEntered: null, annualHours: null });
  });
  it("keeps the additional refuelling distance as entered and never invents an annual total", () => {
    const r = fuel({ additionalRefuellingKmPerDay: 12 });
    expect(r.refuelling.additionalDistanceKmPerVehiclePerDay).toBe(12);
    expect(r.refuelling.annualAdditionalDistanceKm).toBeNull();
    expect(r.refuelling.note).toMatch(/how often refuelling trips happen is not known/);
    expect(fuel().refuelling).toMatchObject({ additionalDistanceKmPerVehiclePerDay: null, annualAdditionalDistanceKm: null });
  });
  it("does not turn downtime or refuelling distance into any financial figure", () => {
    const quiet = calculateAssessment(makeInput());
    const burdened = calculateAssessment(makeInput({ biofuel: { supply: { availability: "limited", additionalRefuellingKmPerDay: 80, downtimeHoursPerMonth: 100 } } }));
    if (!quiet.ok || !burdened.ok) throw new Error("engine failed");
    expect(burdened.result.biofuel.undiscountedTco).toBe(quiet.result.biofuel.undiscountedTco);
    expect(JSON.stringify(burdened.result.biofuelVsDiesel)).toBe(JSON.stringify(quiet.result.biofuelVsDiesel));
  });
});

describe("biofuel operational data completeness", () => {
  it("counts the four evidence items", () => {
    const base = evaluateOperationalFeasibility(makeInput({ biofuel: { supply: { availability: null, specialInfrastructure: null } } })).dataCompleteness.biofuel;
    expect(base).toMatchObject({ state: "insufficient", provided: 0, total: 4 });
    const full = evaluateOperationalFeasibility(makeInput({ biofuel: { supply: { availability: "reliable", specialInfrastructure: "no", additionalRefuellingKmPerDay: 3, downtimeHoursPerMonth: 1 } } })).dataCompleteness.biofuel;
    expect(full).toMatchObject({ state: "complete", provided: 4, total: 4 });
    const partial = evaluateOperationalFeasibility(makeInput({ biofuel: { supply: { availability: "reliable", specialInfrastructure: "unknown" } } })).dataCompleteness.biofuel;
    expect(partial).toMatchObject({ state: "partial", provided: 1 });
  });
  it("combines the two technologies with explicit rules", () => {
    const empty = evaluateOperationalFeasibility(makeInput({ infrastructure: { bevCharging: { arrangement: null } }, biofuel: { supply: { availability: null, specialInfrastructure: null } } }));
    expect(empty.dataCompleteness.state).toBe("insufficient");
    const mixed = evaluateOperationalFeasibility(makeInput({ biofuel: { supply: { availability: "reliable", specialInfrastructure: "no", additionalRefuellingKmPerDay: 3, downtimeHoursPerMonth: 1 } } }));
    expect(mixed.dataCompleteness.state).toBe("partial");
  });
});

describe("diesel baseline", () => {
  it("is reported as the baseline configuration with no invented constraint", () => {
    const d = evaluateOperationalFeasibility(makeInput()).diesel;
    expect(d.status).toBe("baseline");
    expect(d.checks).toHaveLength(1);
    expect(d.checks[0]!.explanation).toMatch(/No diesel range or supply limit was collected/);
    expect(d.warnings).toEqual([]);
  });
  it("states that operational feasibility is separate from cost and emissions", () => {
    expect(evaluateOperationalFeasibility(makeInput()).notes.join(" ")).toMatch(/does not describe cost or emissions/);
  });
});
