import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { CalculationError } from "./types";

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/**
 * Last line of defence before arithmetic. The input system already validates, but the engine does
 * not trust that: persisted or hand-built objects must never produce NaN, Infinity or a crash.
 */
export function checkNormalizedInput(input: NormalizedAssessmentInput): CalculationError[] {
  const errors: CalculationError[] = [];
  const bad = (field: string, message: string) => errors.push({ field, message });

  if (input === null || typeof input !== "object" || input.schemaVersion !== 1) {
    return [{ field: "schemaVersion", message: "The assessment data is not in a supported format." }];
  }
  const need = (field: string, v: unknown, label: string, test: (n: number) => boolean, rule: string) => {
    if (!isNum(v)) bad(field, `${label} is required.`);
    else if (!test(v)) bad(field, `${label} ${rule}.`);
  };
  const optional = (field: string, v: unknown, label: string, test: (n: number) => boolean, rule: string) => {
    if (v !== null && v !== undefined && (!isNum(v) || !test(v))) bad(field, `${label} ${rule}.`);
  };
  const positive = (n: number) => n > 0;
  const nonNeg = (n: number) => n >= 0;

  need("fleet.fleetSize", input.fleet?.fleetSize, "Fleet size", (n) => Number.isInteger(n) && n >= 1, "must be a whole number of at least 1");
  need("operations.analysisHorizonYears", input.operations?.analysisHorizonYears, "Analysis period", (n) => Number.isInteger(n) && n >= 1, "must be a whole number of years, at least 1");
  need("operations.annualDistanceKmPerVehicle", input.operations?.annualDistanceKmPerVehicle, "Annual distance", positive, "must be greater than zero");
  need("finance.discountRatePct", input.finance?.discountRatePct, "Discount rate", (n) => n >= 0 && n <= 100, "must be between 0% and 100%");

  const vehicle = (key: "diesel" | "bev" | "biofuel", name: string) => {
    const v = input[key];
    if (!v) return bad(key, `${name} inputs are missing.`);
    need(`${key}.upfrontVehicleCost`, v.upfrontVehicleCost, `${name} vehicle cost`, nonNeg, "cannot be negative");
    need(`${key}.annualMaintenanceCost`, v.annualMaintenanceCost, `${name} maintenance cost`, nonNeg, "cannot be negative");
    need(`${key}.usefulLifeYears`, v.usefulLifeYears, `${name} useful life`, positive, "must be greater than zero");
    optional(`${key}.annualInsurance`, v.annualInsurance, `${name} insurance`, nonNeg, "cannot be negative");
    optional(`${key}.annualRegistration`, v.annualRegistration, `${name} licensing cost`, nonNeg, "cannot be negative");
    optional(`${key}.otherFixedAnnualCost`, v.otherFixedAnnualCost, `${name} other fixed cost`, nonNeg, "cannot be negative");
    optional(`${key}.otherVariableCostPerKm`, v.otherVariableCostPerKm, `${name} other variable cost`, nonNeg, "cannot be negative");
    const r = v.residualValue;
    if (r) {
      if (r.kind === "amount") need(`${key}.residualValue`, r.amount, `${name} residual value`, nonNeg, "cannot be negative");
      else need(`${key}.residualValue`, r.percent, `${name} residual value percentage`, (n) => n >= 0 && n <= 100, "must be between 0% and 100%");
    }
  };
  vehicle("diesel", "Diesel");
  vehicle("bev", "Battery-electric");
  vehicle("biofuel", "Biofuel");

  need("diesel.fuelPricePerLitre", input.diesel?.fuelPricePerLitre, "Diesel price", nonNeg, "cannot be negative");
  need("diesel.fuelConsumptionLitresPer100Km", input.diesel?.fuelConsumptionLitresPer100Km, "Diesel fuel consumption", positive, "must be greater than zero");
  optional("diesel.fuelPriceEscalationPctPerYear", input.diesel?.fuelPriceEscalationPctPerYear, "Diesel price escalation", (n) => n > -100, "must be above -100%");

  need("bev.electricityTariffPerKwh", input.bev?.electricityTariffPerKwh, "Electricity tariff", nonNeg, "cannot be negative");
  need("bev.energyConsumptionKwhPer100Km", input.bev?.energyConsumptionKwhPer100Km, "Electric energy consumption", positive, "must be greater than zero");
  optional("bev.chargingLossPct", input.bev?.chargingLossPct, "Charging loss", (n) => n >= 0 && n < 100, "must be at least 0% and below 100%");
  optional("bev.electricityPriceEscalationPctPerYear", input.bev?.electricityPriceEscalationPctPerYear, "Electricity price escalation", (n) => n > -100, "must be above -100%");
  const br = input.bev?.batteryReplacement;
  if (br?.expected === "yes") {
    need("bev.batteryReplacement.year", br.year, "Battery replacement year", (n) => n > 0, "must be greater than zero");
    need("bev.batteryReplacement.cost", br.cost, "Battery replacement cost", nonNeg, "cannot be negative");
  }

  need("biofuel.fuelPricePerFuelUnit", input.biofuel?.fuelPricePerFuelUnit, "Biofuel price", nonNeg, "cannot be negative");
  need("biofuel.fuelConsumptionFuelUnitsPer100Km", input.biofuel?.fuelConsumptionFuelUnitsPer100Km, "Biofuel consumption", positive, "must be greater than zero");
  optional("biofuel.fuelPriceEscalationPctPerYear", input.biofuel?.fuelPriceEscalationPctPerYear, "Biofuel price escalation", (n) => n > -100, "must be above -100%");
  const inc = input.biofuel?.incrementalMaintenance;
  if (inc) {
    if (inc.kind === "percent_of_maintenance") need("biofuel.incrementalMaintenance", inc.percent, "Additional biofuel maintenance", (n) => n >= -100, "cannot reduce maintenance by more than 100%");
    else if (isNum(inc.amount) && isNum(input.biofuel.annualMaintenanceCost) && input.biofuel.annualMaintenanceCost + inc.amount < 0) bad("biofuel.incrementalMaintenance", "Additional biofuel maintenance would make total maintenance negative.");
    else if (!isNum(inc.amount)) bad("biofuel.incrementalMaintenance", "Additional biofuel maintenance is required.");
  }

  const infra = input.infrastructure?.bevCharging;
  if (infra?.investmentRequired) {
    for (const [k, label] of [["equipmentCost", "Charger equipment cost"], ["installationCost", "Charger installation cost"]] as const) need(`infrastructure.bevCharging.${k}`, infra[k], label, nonNeg, "cannot be negative");
    optional("infrastructure.bevCharging.electricalUpgradeCost", infra.electricalUpgradeCost, "Electrical upgrade cost", nonNeg, "cannot be negative");
    optional("infrastructure.bevCharging.annualMaintenanceCost", infra.annualMaintenanceCost, "Charger maintenance cost", nonNeg, "cannot be negative");
    optional("infrastructure.bevCharging.otherAnnualCost", infra.otherAnnualCost, "Other charging cost", nonNeg, "cannot be negative");
    optional("infrastructure.bevCharging.vehiclesSharing", infra.vehiclesSharing, "Vehicles using the chargers", (n) => n >= 1, "must be at least 1");
    optional("infrastructure.bevCharging.usefulLifeYears", infra.usefulLifeYears, "Charger useful life", positive, "must be greater than zero");
  }
  const bio = input.infrastructure?.biofuel;
  if (bio?.investmentRequired === "yes") {
    for (const [k, label] of [["storageEquipmentCost", "Storage equipment cost"], ["refuellingInfrastructureCost", "Refuelling infrastructure cost"], ["installationCost", "Biofuel infrastructure installation cost"]] as const) need(`infrastructure.biofuel.${k}`, bio[k], label, nonNeg, "cannot be negative");
    optional("infrastructure.biofuel.annualMaintenanceCost", bio.annualMaintenanceCost, "Biofuel infrastructure maintenance", nonNeg, "cannot be negative");
    optional("infrastructure.biofuel.usefulLifeYears", bio.usefulLifeYears, "Biofuel infrastructure useful life", positive, "must be greater than zero");
  }

  for (const key of ["diesel", "bev", "biofuel"] as const) {
    const i = input.finance?.incentives?.[key];
    if (i?.type === "upfront_grant" || i?.type === "tax_credit" || i?.type === "other") optional(`finance.incentives.${key}.amount`, i.amount, "Incentive amount", nonNeg, "cannot be negative");
    if (i?.type === "percent_subsidy") optional(`finance.incentives.${key}.percentOfPurchasePrice`, i.percentOfPurchasePrice, "Subsidy percentage", (n) => n >= 0 && n <= 100, "must be between 0% and 100%");
  }
  return errors;
}
