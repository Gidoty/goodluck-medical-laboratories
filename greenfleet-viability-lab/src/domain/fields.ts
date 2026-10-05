import { pathId, type NumericPath, type TextPath } from "./assessment";
import type { StepId } from "./steps";
import { rules, type NumericRule } from "./validation";

/**
 * Registry of inputs that have a form control. One entry per input: label, unit and validation
 * rule live together, so the form, the validator and the review page can never disagree.
 *
 * Batch 1 registers a representative subset. The domain model already holds the remaining inputs.
 */
export interface NumericFieldDefinition {
  id: string;
  path: NumericPath;
  stepId: StepId;
  rule: NumericRule;
  help?: string;
}

export interface TextFieldDefinition {
  id: string;
  path: TextPath;
  stepId: StepId;
  label: string;
  required: boolean;
  placeholder?: string;
}

const num = (path: NumericPath, stepId: StepId, rule: NumericRule, help?: string): NumericFieldDefinition => ({
  id: pathId(path),
  path,
  stepId,
  rule,
  help,
});

const text = (path: TextPath, stepId: StepId, label: string, required: boolean, placeholder?: string): TextFieldDefinition => ({
  id: pathId(path),
  path,
  stepId,
  label,
  required,
  placeholder,
});

export const TEXT_FIELDS: readonly TextFieldDefinition[] = [
  text(["name"], "business", "Assessment name", true, "e.g. Lagos last-mile fleet, 2026"),
  text(["business", "businessName"], "business", "Business name", false, "e.g. your company or project name"),
  text(["business", "operatingRegion"], "business", "Operating region", false, "e.g. city or corridor"),
];

export const NUMERIC_FIELDS: readonly NumericFieldDefinition[] = [
  // Step 1: business and fleet
  num(["business", "fleetSize"], "business", rules.count("Fleet size")),
  num(["operations", "dailyDistanceKm"], "business", rules.distance("Daily distance per vehicle", "km_per_day")),
  num(["operations", "operatingDaysPerYear"], "business", { label: "Operating days per year", unit: "days_per_year", required: true, min: 0, minExclusive: true, max: 366, integer: true }),
  num(["operations", "analysisHorizonYears"], "business", rules.lifetimeYears("Analysis horizon"), "How many years the comparison covers."),
  num(["operations", "loadFactorPct"], "business", rules.positivePercentage("Average load factor"), "Average payload carried as a share of rated payload."),

  // Step 2: diesel baseline
  num(["technologies", "diesel", "acquisitionCost"], "diesel", rules.money("Vehicle acquisition cost")),
  num(["technologies", "diesel", "fuelConsumptionLPer100Km"], "diesel", rules.efficiency("Fuel consumption", "litres_per_100km", 100)),
  num(["technologies", "diesel", "lifetimeYears"], "diesel", rules.lifetimeYears("Vehicle lifetime")),
  num(["technologies", "diesel", "residualValuePct"], "diesel", rules.percentage("Residual value"), "Resale value at end of lifetime as a share of the acquisition cost."),
  num(["technologies", "diesel", "maintenanceCostPerKm"], "diesel", rules.money("Maintenance cost", "money_per_km")),
  num(["energy", "dieselPricePerLitre"], "diesel", rules.money("Diesel price", "money_per_litre"), "The price you pay, not a national average."),

  // Step 3: battery electric
  num(["technologies", "electric", "acquisitionCost"], "electric", rules.money("Vehicle acquisition cost")),
  num(["technologies", "electric", "energyConsumptionKwhPer100Km"], "electric", rules.efficiency("Energy consumption", "kwh_per_100km", 300)),
  num(["technologies", "electric", "batteryCapacityKwh"], "electric", { label: "Battery capacity", unit: "kwh", required: true, min: 0, minExclusive: true }),
  num(["technologies", "electric", "usableBatteryPct"], "electric", rules.positivePercentage("Usable share of battery")),
  num(["technologies", "electric", "lifetimeYears"], "electric", rules.lifetimeYears("Vehicle lifetime")),
  num(["energy", "electricityPricePerKwh"], "electric", rules.money("Electricity price", "money_per_kwh"), "The price you actually pay at the charger, including any generator or tariff premium."),
  num(["technologies", "electric", "batteryReplacementCost"], "electric", { ...rules.money("Battery replacement cost"), allowNotApplicable: true }, "Choose “not applicable” if no replacement is planned within the horizon."),

  // Step 4: biofuel
  num(["technologies", "biofuel", "acquisitionCost"], "biofuel", rules.money("Vehicle acquisition cost (including any conversion)")),
  num(["technologies", "biofuel", "fuelConsumptionLPer100Km"], "biofuel", rules.efficiency("Fuel consumption", "litres_per_100km", 100)),
  num(["technologies", "biofuel", "blendSharePct"], "biofuel", rules.percentage("Biofuel share of blend")),
  num(["technologies", "biofuel", "approvedMaxBlendPct"], "biofuel", rules.percentage("Maximum blend approved for the engine"), "Take this from the manufacturer or warranty terms."),
  num(["technologies", "biofuel", "lifetimeYears"], "biofuel", rules.lifetimeYears("Vehicle lifetime")),
  num(["energy", "biofuelPricePerLitre"], "biofuel", rules.money("Biofuel price", "money_per_litre")),

  // Step 5: finance and infrastructure
  num(["financing", "financedSharePct"], "finance", rules.percentage("Share of vehicle price financed")),
  num(["financing", "interestRatePct"], "finance", rules.percentage("Loan interest rate")),
  num(["financing", "loanTermYears"], "finance", { ...rules.lifetimeYears("Loan term"), required: false, allowNotApplicable: true, max: 30 }, "Required only if part of the purchase is financed."),
  num(["financing", "discountRatePct"], "finance", rules.percentage("Discount rate"), "Your required annual return, used to value future cash flows."),
  num(["infrastructure", "chargingInfrastructureCost"], "finance", { ...rules.money("Charging infrastructure cost"), allowNotApplicable: true }, "Enter 0 if it genuinely costs nothing. Choose “not applicable” if no dedicated charging applies."),
  num(["infrastructure", "vehiclesSharingChargers"], "finance", rules.count("Vehicles sharing the chargers", false), "Infrastructure cost is spread over this many vehicles."),
  num(["infrastructure", "fuelStorageAndBlendingCost"], "finance", { ...rules.money("Fuel storage and blending cost"), allowNotApplicable: true }),
];

export const fieldsForStep = (stepId: StepId) => ({
  numeric: NUMERIC_FIELDS.filter((f) => f.stepId === stepId),
  text: TEXT_FIELDS.filter((f) => f.stepId === stepId),
});
