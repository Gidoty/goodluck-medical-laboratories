import { describe, expect, it } from "vitest";
import { value } from "./fieldValue";
import { runAssessment } from "./runAssessment";
import { blank, demo, setChoiceOf, setNum, setQ, withNums } from "@/test/helpers";
import type { Assessment } from "./stored";

function ok(a: Assessment) {
  const r = runAssessment(a);
  if (r.status !== "ok") throw new Error(JSON.stringify(r));
  return r.result;
}

describe("from form inputs to the engine", () => {
  it("runs the illustrative demo and flags the result as demo data", () => {
    const r = ok(demo());
    expect(r.metadata.dataOrigin).toBe("demo");
    expect(r.metadata.illustrativeInputs.length).toBeGreaterThan(10);
    expect(r.metadata.fleetHorizonDistanceKm).toBe(5 * 25000 * 5);
  });
  it("converts km/litre to litres/100 km before costing (8 km/litre = 12.5 litres/100 km)", () => {
    const r = ok(demo());
    expect(r.diesel.energy.fleetQuantityYear1).toBeCloseTo(125000 / 8, 9); // 15,625 litres
    expect(r.diesel.year1EnergyCost).toBeCloseTo((125000 / 8) * 1000, 6);
  });
  it("gives the same answer whichever unit the user chose", () => {
    const kmPerLitre = ok(demo());
    const per100 = ok(setQ(demo(), "diesel.fuelEfficiency", { value: value(12.5), qualifier: "litres_per_100km" }));
    expect(per100.diesel.undiscountedTco).toBeCloseTo(kmPerLitre.diesel.undiscountedTco, 6);
  });
  it("converts kWh/100 km and kWh/km to the same energy use", () => {
    const per100 = ok(demo()); // 25 kWh/100 km
    const perKm = ok(setQ(demo(), "bev.energyConsumption", { value: value(0.25), qualifier: "kwh_per_km" }));
    expect(perKm.bev.energy.vehicleDeliveredKwhFleetYear1).toBeCloseTo(per100.bev.energy.vehicleDeliveredKwhFleetYear1!, 6);
    expect(per100.bev.energy.vehicleDeliveredKwhFleetYear1).toBeCloseTo(125000 * 0.25, 6);
  });
  it("applies the charging loss entered in the form as grid = delivered / (1 - loss)", () => {
    const r = ok(demo()); // demo enters 10%
    expect(r.bev.energy.fleetQuantityYear1).toBeCloseTo((125000 * 0.25) / 0.9, 6);
    const noLoss = ok(setNum(demo(), "bev.chargingLoss", null));
    expect(noLoss.bev.energy.fleetQuantityYear1).toBeCloseTo(125000 * 0.25, 6);
    expect(noLoss.warnings.some((w) => w.code === "CHARGING_LOSS_NOT_MODELLED")).toBe(true);
  });
  it("uses a directly entered annual distance, and the same distance for every technology", () => {
    let a = setChoiceOf(demo(), "ops.distanceMode", "annual");
    a = setNum(a, "ops.annualDistance", 30000);
    const r = ok(a);
    expect(r.metadata.annualDistancePerVehicleKm).toBe(30000);
    expect(r.metadata.fleetAnnualDistanceKm).toBe(150000);
    expect(r.diesel.fleetHorizonDistanceKm).toBe(r.bev.fleetHorizonDistanceKm);
    expect(r.assumptions.find((x) => x.id === "annual_distance")?.status).toBe("user_input");
    expect(ok(demo()).assumptions.find((x) => x.id === "annual_distance")?.status).toBe("derived");
  });
  it("keeps an unknown battery replacement out of the cost and discloses it", () => {
    const r = ok(setChoiceOf(demo(), "bev.batteryReplacement", "unknown"));
    expect(r.bev.breakdown.undiscounted.batteryReplacement).toBe(0);
    expect(r.warnings.map((w) => w.code)).toContain("BATTERY_REPLACEMENT_UNKNOWN");
    expect(ok(demo()).bev.breakdown.undiscounted.batteryReplacement).toBe(0); // the demo replaces in year 6, after the 5-year period
    expect(ok(setNum(demo(), "bev.batteryReplacementYear", 4)).bev.breakdown.undiscounted.batteryReplacement).toBe(5 * 3_000_000);
  });
  it("allocates shared charging infrastructure from the form inputs", () => {
    const r = ok(withNums(demo(), { "bevInfra.vehiclesSharing": 10 })); // 5 assessed vehicles of 10 sharing
    expect(r.bev.series[0]!.components.infrastructureCapex).toBeCloseTo((2_000_000 + 500_000) * 0.5, 6);
  });
  it("supports a gaseous biofuel pathway in kg", () => {
    let a = setChoiceOf(demo(), "biofuel.pathway", "biomethane");
    a = setChoiceOf(a, "biofuel.fuelUnit", "kg");
    a = setNum(a, "biofuel.fuelPrice", 600);
    a = setQ(a, "biofuel.fuelEfficiency", { value: value(5), qualifier: "distance_per_fuel" });
    const r = ok(a);
    expect(r.biofuel.energy).toMatchObject({ unit: "kg", unitPriceYear1: 600 });
    expect(r.biofuel.energy.fleetQuantityYear1).toBeCloseTo(125000 / 5, 6);
  });
  it("reports blocking input problems instead of calculating", () => {
    const r = runAssessment(blank());
    expect(r.status).toBe("invalid_inputs");
    expect(runAssessment(setNum(demo(), "ops.dailyDistance", -5)).status).toBe("invalid_inputs");
  });
  it("does not change the stored assessment", () => {
    const a = demo();
    const before = JSON.stringify(a);
    ok(a);
    expect(JSON.stringify(a)).toBe(before);
  });
  it("is unaffected by the financing structure", () => {
    const equity = ok(setChoiceOf(demo(), "finance.structure", "equity_100"));
    const debt = ok(demo()); // debt + equity with a 20% interest rate
    expect(JSON.stringify(debt.bevVsDiesel)).toBe(JSON.stringify(equity.bevVsDiesel));
  });
});
