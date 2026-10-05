import { describe, expect, it } from "vitest";
import { deepFreeze, makeInput } from "../fixtures";
import { evaluateBev, evaluateOperationalFeasibility } from "./index";

/** Base fixture: 100 km/day, usable range 500 km, 100 operating days, 1 vehicle. All BEV operational extras are blank. */
type Patch = Parameters<typeof makeInput>[0];
const bev = (patch: Patch = {}) => evaluateBev(makeInput(patch));
const ops = (daily: number, range: number, extra: Patch = {}): Patch => ({ ...extra, operations: { dailyDistanceKm: daily, ...(extra?.operations ?? {}) }, bev: { usableRangeKm: range, ...(extra?.bev ?? {}) } } as Patch);
const charging = (opportunity: string | null, rest: Patch = {}): Patch => ({ ...rest, bev: { ...(rest.bev ?? {}), operational: { chargingOpportunity: opportunity } } });
const codes = (r: ReturnType<typeof bev>) => r.warnings.map((w) => w.code);
const text = (r: ReturnType<typeof bev>) => r.warnings.map((w) => w.message);

describe("BEV range", () => {
  it("daily distance below the range is satisfied, with the margin reported exactly", () => {
    const r = bev(ops(100, 400));
    expect(r.checks.range.status).toBe("satisfied");
    expect(r.rangeMetrics).toMatchObject({ dailyDistanceKm: 100, usableRangeKm: 400, dailyRangeRatio: 0.25, rangeMarginKm: 300, rangeMarginPercent: 75, dailyExceedsRange: false });
    expect(r.checks.range.explanation).toMatch(/without relying on en-route charging/);
    expect(r.status).toBe("suitable");
    expect(r.warnings).toEqual([]);
  });
  it("daily distance equal to the range is still satisfied, with zero margin", () => {
    const r = bev(ops(300, 300));
    expect(r.checks.range.status).toBe("satisfied");
    expect(r.rangeMetrics).toMatchObject({ rangeMarginKm: 0, rangeMarginPercent: 0, dailyRangeRatio: 1 });
  });
  it("a negative margin is reported as a shortfall, and no safety buffer is invented", () => {
    const r = bev(ops(450, 300, charging("depot_only")));
    expect(r.rangeMetrics).toMatchObject({ rangeMarginKm: -150, rangeMarginPercent: -50, dailyRangeRatio: 1.5, dailyExceedsRange: true });
    // 290 km against a 300 km range passes: nothing like a 10% or 20% buffer is demanded
    expect(bev(ops(290, 300)).checks.range.status).toBe("satisfied");
  });
  it("above the range with depot-only charging and no route detail is constrained", () => {
    const r = bev(ops(450, 300, charging("depot_only")));
    expect(r.checks.range.status).toBe("constrained");
    expect(r.status).toBe("constrained");
    expect(text(r)).toEqual(expect.arrayContaining(["Daily distance exceeds stated BEV usable range.", "Daily operating distance exceeds stated usable range under depot-only charging."]));
  });
  it("depot-only with routes that each fit the range is conditional on recharging between routes", () => {
    const r = bev(ops(450, 300, charging("depot_only", { operations: { averageRouteDistanceKm: 150 } })));
    expect(r.checks.range.status).toBe("conditional");
    expect(r.checks.route.status).toBe("satisfied");
    expect(r.conditions).toContain("Vehicles must return to the depot and recharge between routes.");
    expect(r.status).toBe("conditional");
  });
  it("above the range with charging during the day is conditional, never immediately infeasible", () => {
    for (const o of ["public_available", "destination_available", "mixed"]) {
      const r = bev(ops(450, 300, charging(o)));
      expect(r.checks.range.status, o).toBe("conditional");
      expect(r.status, o).toBe("conditional");
      expect(text(r), o).toContain("Additional daytime charging is required.");
      expect(r.conditions, o).toContain("Additional charging is required during the operating day.");
    }
  });
  it("above the range with unknown or unstated charging is insufficient data", () => {
    for (const o of ["unknown", null]) {
      const r = bev(ops(450, 300, charging(o)));
      expect(r.checks.range.status, String(o)).toBe("insufficient");
      expect(r.status, String(o)).toBe("insufficient_data");
      expect(text(r)).toContain("Daily distance exceeds usable range and charging availability is unknown.");
    }
  });
});

describe("BEV single routes versus the whole day", () => {
  it("a route longer than the range is a stronger problem than a long day", () => {
    const depot = bev(ops(450, 300, charging("depot_only", { operations: { averageRouteDistanceKm: 350 } })));
    expect(depot.checks.route.status).toBe("constrained");
    expect(depot.status).toBe("constrained");
    expect(text(depot)).toContain("Average route distance exceeds stated BEV usable range.");
    const pub = bev(ops(450, 300, charging("public_available", { operations: { averageRouteDistanceKm: 350 } })));
    expect(pub.checks.route.status).toBe("conditional");
    expect(pub.conditions).toContain("A charge is needed during a single route.");
    const unknown = bev(ops(450, 300, charging("unknown", { operations: { averageRouteDistanceKm: 350 } })));
    expect(unknown.checks.route.status).toBe("insufficient");
  });
  it("a day longer than the range with routes that fit is distinguished from a route that does not fit", () => {
    const r = bev(ops(450, 300, charging("public_available", { operations: { averageRouteDistanceKm: 120 } })));
    expect(r.checks.route.status).toBe("satisfied");
    expect(r.rangeMetrics).toMatchObject({ routeDistanceKm: 120, routeMarginKm: 180, routeMarginPercent: 60, routeExceedsRange: false, dailyExceedsRange: true });
    expect(codes(r)).not.toContain("OP_BEV_ROUTE_EXCEEDS_RANGE");
    expect(r.checks.route.explanation).toMatch(/recharging between routes matters/);
  });
  it("does not assess routes when no route distance is entered", () => {
    const r = bev(ops(100, 400));
    expect(r.checks.route.status).toBe("not_assessed");
    expect(r.rangeMetrics?.routeDistanceKm).toBeNull();
    expect(r.notAssessed).toContain("Single-route range");
  });
});

describe("BEV payload", () => {
  const payload = (extra: NonNullable<Patch>["fleet"], bevOp: object) => bev({ fleet: { payloadCapacityKg: 1000, averagePayloadKg: 700, ...extra }, bev: { operational: bevOp } } as Patch);
  it("within the effective capacity after an absolute reduction", () => {
    const r = payload({}, { payloadImpact: "reduced", payloadReductionKg: 200 });
    expect(r.payload).toMatchObject({ baselineCapacityKg: 1000, reductionKg: 200, effectiveCapacityKg: 800, averagePayloadKg: 700 });
    expect(r.checks.payload.status).toBe("satisfied");
  });
  it("applies a percentage reduction as capacity x (1 - rate)", () => {
    const r = payload({}, { payloadImpact: "reduced", payloadReductionPct: 15 });
    expect(r.payload.effectiveCapacityKg).toBeCloseTo(850, 9);
    expect(r.checks.payload.status).toBe("satisfied");
  });
  it("is constrained when the average payload exceeds the effective capacity", () => {
    const r = payload({ averagePayloadKg: 900 }, { payloadImpact: "reduced", payloadReductionKg: 200 });
    expect(r.checks.payload.status).toBe("constrained");
    expect(r.status).toBe("constrained");
    expect(text(r)).toContain("Average stated payload exceeds estimated BEV payload capacity after the entered payload reduction.");
    expect(r.checks.payload.observed).toEqual({ value: 900, unit: "kg average payload" });
    expect(r.checks.payload.reference).toEqual({ value: 800, unit: "kg effective capacity" });
  });
  it("accepts a payload exactly at the effective capacity", () => {
    expect(payload({ averagePayloadKg: 800 }, { payloadImpact: "reduced", payloadReductionKg: 200 }).checks.payload.status).toBe("satisfied");
  });
  it("no expected impact leaves the stated payload unchanged", () => {
    const r = payload({}, { payloadImpact: "none" });
    expect(r.checks.payload.status).toBe("satisfied");
    expect(r.payload.effectiveCapacityKg).toBe(1000);
  });
  it("reports uncertainty when the impact is unknown, without guessing a reduction", () => {
    const r = payload({}, { payloadImpact: "unknown" });
    expect(r.checks.payload.status).toBe("insufficient");
    expect(r.payload.effectiveCapacityKg).toBeNull();
    expect(text(r)).toContain("BEV payload impact is unknown.");
    expect(r.status).toBe("conditional"); // payload is not a core check, so this is a condition rather than missing core evidence
  });
  it("cannot judge a reduction without a capacity or a size", () => {
    expect(bev({ fleet: { payloadCapacityKg: null, averagePayloadKg: 700 }, bev: { operational: { payloadImpact: "reduced", payloadReductionKg: 100 } } }).checks.payload.status).toBe("insufficient");
    expect(bev({ fleet: { payloadCapacityKg: 1000 }, bev: { operational: { payloadImpact: "reduced" } } }).checks.payload.status).toBe("insufficient");
    expect(bev({ fleet: { payloadCapacityKg: 1000, averagePayloadKg: null }, bev: { operational: { payloadImpact: "reduced", payloadReductionKg: 100 } } }).checks.payload.explanation).toMatch(/no average payload/);
  });
  it("does not assess payload when no impact is stated", () => {
    expect(bev().checks.payload.status).toBe("not_assessed");
  });
});

describe("BEV charging", () => {
  it("annualises the charging time entered by the user per vehicle and for the fleet, labelled carefully", () => {
    const r = bev({ fleet: { fleetSize: 5 }, operations: { operatingDaysPerYear: 250 }, bev: { operational: { chargingDowntimeHoursPerDay: 2 } } });
    expect(r.chargingTime).toMatchObject({ perVehiclePerDayHours: 2, perVehicleAnnualHours: 500, fleetAnnualHours: 2500 });
    expect(r.chargingTime.label).toMatch(/entered by user/);
    expect(r.chargingTime.label).toMatch(/not the same as lost productive time/);
    expect(JSON.stringify(r.chargingTime)).not.toMatch(/lost productivity\b(?! )/);
  });
  it("leaves the indicator empty when nothing was entered, and 0 is a real value", () => {
    expect(bev().chargingTime).toMatchObject({ perVehiclePerDayHours: null, perVehicleAnnualHours: null, fleetAnnualHours: null });
    expect(bev({ bev: { operational: { chargingDowntimeHoursPerDay: 0 } } }).chargingTime).toMatchObject({ perVehiclePerDayHours: 0, perVehicleAnnualHours: 0 });
  });
  it("flags a contradiction between the opportunity and the arrangement", () => {
    const r = bev({ infrastructure: { bevCharging: { arrangement: "public_only" } }, bev: { operational: { chargingOpportunity: "depot_only" } } });
    expect(r.checks.charging.status).toBe("conditional");
    expect(codes(r)).toContain("OP_BEV_CHARGING_INCONSISTENT");
  });
  it("treats an unknown charging arrangement as uncertainty, not a failure", () => {
    const r = bev({ infrastructure: { bevCharging: { arrangement: "unknown" } } });
    expect(r.checks.charging.status).toBe("insufficient");
    expect(r.status).toBe("conditional");
    expect(text(r)).toContain("Charging availability is unknown.");
  });
  it("accepts a stated opportunity and arrangement", () => {
    const r = bev({ infrastructure: { bevCharging: { arrangement: "dedicated_private" } }, bev: { operational: { chargingOpportunity: "depot_only" } } });
    expect(r.checks.charging.status).toBe("satisfied");
  });
  it("notes that shared chargers need reliable access", () => {
    expect(bev({ infrastructure: { bevCharging: { arrangement: "shared_private" } } }).checks.charging.explanation).toMatch(/shared charger/);
  });
});

describe("BEV overall status and robustness", () => {
  it("is SUITABLE with only the required inputs, and lists what was not assessed", () => {
    const r = bev({ infrastructure: { bevCharging: { arrangement: null } } });
    expect(r.status).toBe("suitable");
    expect(r.notAssessed).toEqual(["Single-route range", "Charging arrangements", "Payload"]);
  });
  it("a constraint outranks a condition", () => {
    const r = bev({ ...ops(450, 300, charging("public_available")), fleet: { payloadCapacityKg: 1000, averagePayloadKg: 900 }, ...{ bev: { usableRangeKm: 300, operational: { chargingOpportunity: "public_available", payloadImpact: "reduced", payloadReductionKg: 200 } } } } as Patch);
    expect(r.checks.range.status).toBe("conditional");
    expect(r.checks.payload.status).toBe("constrained");
    expect(r.status).toBe("constrained");
  });
  it("records which rule produced the status", () => {
    const r = bev(ops(450, 300, charging("depot_only")));
    expect(r.ruleTrace.join(" ")).toMatch(/Rule 1/);
    expect(r.statusExplanation).toMatch(/conflicts with the duty cycle/);
  });
  it("copes with an invalid or zero range without NaN or Infinity", () => {
    for (const range of [0, -5, Number.NaN]) {
      const r = bev(ops(100, range));
      expect(r.rangeMetrics).toBeNull();
      expect(r.checks.range.status).toBe("insufficient");
      expect(r.status).toBe("insufficient_data");
      expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity/);
    }
  });
  it("does not mutate its input and does not depend on any price", () => {
    const input = deepFreeze(makeInput(ops(450, 300, charging("public_available"))));
    const before = JSON.stringify(input);
    const a = evaluateBev(input);
    expect(JSON.stringify(input)).toBe(before);
    const priced = evaluateBev(makeInput({ ...ops(450, 300, charging("public_available")), bev: { usableRangeKm: 300, upfrontVehicleCost: 1, electricityTariffPerKwh: 999, operational: { chargingOpportunity: "public_available" } }, finance: { discountRatePct: 30 } }));
    expect(priced).toEqual(a);
  });
});

describe("operational data completeness (BEV)", () => {
  it("counts the stated evidence items and names what is missing", () => {
    const none = evaluateOperationalFeasibility(makeInput({ infrastructure: { bevCharging: { arrangement: null } } })).dataCompleteness.bev;
    expect(none).toMatchObject({ state: "insufficient", provided: 0, total: 5 });
    expect(none.missing).toContain("Charging opportunity during the day");
    const some = evaluateOperationalFeasibility(makeInput({ infrastructure: { bevCharging: { arrangement: null } }, bev: { operational: { chargingOpportunity: "depot_only" } } })).dataCompleteness.bev;
    expect(some).toMatchObject({ state: "partial", provided: 1, total: 5 });
  });
  it("is complete only when every item is answered, and 'unknown' does not count as answered", () => {
    const all = evaluateOperationalFeasibility(makeInput({ operations: { averageRouteDistanceKm: 100 }, infrastructure: { bevCharging: { arrangement: "dedicated_private" } }, bev: { operational: { chargingOpportunity: "depot_only", chargingDowntimeHoursPerDay: 1, payloadImpact: "none" } } })).dataCompleteness.bev;
    expect(all).toMatchObject({ state: "complete", provided: 5, total: 5, missing: [] });
    const unknown = evaluateOperationalFeasibility(makeInput({ infrastructure: { bevCharging: { arrangement: null } }, bev: { operational: { chargingOpportunity: "unknown" } } })).dataCompleteness.bev;
    expect(unknown.provided).toBe(0);
  });
  it("asks for payload capacity and average payload only when a reduction is expected", () => {
    const reduced = evaluateOperationalFeasibility(makeInput({ bev: { operational: { payloadImpact: "reduced", payloadReductionKg: 50 } } })).dataCompleteness.bev;
    expect(reduced.total).toBe(7);
    expect(reduced.missing).toEqual(expect.arrayContaining(["Payload capacity", "Average payload"]));
  });
});
