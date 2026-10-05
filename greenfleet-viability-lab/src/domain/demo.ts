import { createBlankAssessment, setNumeric, setText, type NumericPath } from "./assessment";
import { value } from "./fieldValue";
import type { Assessment } from "./types";

export const DEMO_LABEL = "Illustrative demo assumption — not current market data.";

/**
 * Round numbers chosen only so the interface has something to show. They are not Nigerian
 * averages, prices, benchmarks or market rates, and must never be presented as such.
 */
const DEMO_NUMBERS: ReadonlyArray<readonly [NumericPath, number]> = [
  [["business", "fleetSize"], 5],
  [["operations", "dailyDistanceKm"], 100],
  [["operations", "operatingDaysPerYear"], 250],
  [["operations", "analysisHorizonYears"], 5],
  [["operations", "loadFactorPct"], 60],
  [["technologies", "diesel", "acquisitionCost"], 10_000_000],
  [["technologies", "diesel", "fuelConsumptionLPer100Km"], 20],
  [["technologies", "diesel", "lifetimeYears"], 8],
  [["technologies", "diesel", "residualValuePct"], 20],
  [["technologies", "diesel", "maintenanceCostPerKm"], 50],
  [["energy", "dieselPricePerLitre"], 1000],
  [["technologies", "electric", "acquisitionCost"], 15_000_000],
  [["technologies", "electric", "energyConsumptionKwhPer100Km"], 30],
  [["technologies", "electric", "batteryCapacityKwh"], 100],
  [["technologies", "electric", "usableBatteryPct"], 80],
  [["technologies", "electric", "lifetimeYears"], 8],
  [["energy", "electricityPricePerKwh"], 100],
  [["technologies", "electric", "batteryReplacementCost"], 0],
  [["technologies", "biofuel", "acquisitionCost"], 10_500_000],
  [["technologies", "biofuel", "fuelConsumptionLPer100Km"], 21],
  [["technologies", "biofuel", "blendSharePct"], 20],
  [["technologies", "biofuel", "approvedMaxBlendPct"], 20],
  [["technologies", "biofuel", "lifetimeYears"], 8],
  [["energy", "biofuelPricePerLitre"], 1100],
  [["financing", "financedSharePct"], 50],
  [["financing", "interestRatePct"], 20],
  [["financing", "loanTermYears"], 4],
  [["financing", "discountRatePct"], 15],
  [["infrastructure", "chargingInfrastructureCost"], 2_000_000],
  [["infrastructure", "vehiclesSharingChargers"], 5],
  [["infrastructure", "fuelStorageAndBlendingCost"], 0],
];

export function createDemoAssessment(id: string, nowIso: string): Assessment {
  let a = createBlankAssessment(id, nowIso);
  a = setText(a, ["name"], "Demo assessment", nowIso);
  a = setText(a, ["business", "businessName"], "Demo logistics company", nowIso);
  a = setText(a, ["business", "operatingRegion"], "Demo region", nowIso);
  for (const [path, n] of DEMO_NUMBERS) a = setNumeric(a, path, value(n), nowIso);
  return { ...a, origin: "demo" };
}

/** Values of the untouched demo, used to tag fields that still hold an unedited demo number. */
export function demoValueFor(path: NumericPath): number | undefined {
  return DEMO_NUMBERS.find(([p]) => p.join(".") === path.join("."))?.[1];
}
