import { FUEL_UNITS, type FuelUnit } from "@/lib/fuel";
import type { UnitId } from "@/lib/units";
import { OPTIONS, INFRASTRUCTURE_ARRANGEMENTS, LIQUID_PATHWAYS } from "./options";
import { SECTION_BY_ID } from "./sections";
import type { ChoiceDef, FieldDef, NumberDef, QNumberDef, QOption, Reader, RuleSpec, TextDef } from "./types";

/**
 * THE input schema. One entry per input: label, unit, validation, visibility and help live
 * together, so forms, validation, the review page and normalization can never disagree.
 *
 * No default here is a market value. Blank means blank.
 */

// ----- rule shorthands -------------------------------------------------------------------
const MONEY: RuleSpec = { min: 0 }; // zero is valid (free, existing, or none); negative is not
const POSITIVE: RuleSpec = { min: 0, minExclusive: true };
const POSITIVE_INT: RuleSpec = { min: 0, minExclusive: true, integer: true };
const PCT: RuleSpec = { min: 0, max: 100 };
const POSITIVE_PCT: RuleSpec = { min: 0, minExclusive: true, max: 100 };
const ESCALATION: RuleSpec = { min: -50, max: 100 };

// ----- builders --------------------------------------------------------------------------
type Common = "id" | "section" | "label" | "required";
type Opt<T> = Omit<T, "kind" | "step" | Common> & Pick<T, Extract<keyof T, Common>>;

const stepOf = (section: string) => {
  const s = SECTION_BY_ID[section];
  if (!s) throw new Error(`Unknown section "${section}"`);
  return s.step;
};

const num = (d: Opt<NumberDef>): NumberDef => ({ kind: "number", step: stepOf(d.section), ...d });
const text = (d: Opt<TextDef>): TextDef => ({ kind: "text", step: stepOf(d.section), ...d });
const choice = (d: Opt<ChoiceDef>): ChoiceDef => ({ kind: "choice", step: stepOf(d.section), ...d });
const qnum = (d: Opt<QNumberDef>): QNumberDef => ({ kind: "qnumber", step: stepOf(d.section), ...d });

// ----- shared helpers --------------------------------------------------------------------
/** Unit the biofuel is bought and burned in. Liquid pathways are always litres. */
export function biofuelFuelUnit(r: Reader): FuelUnit {
  const pathway = r.choice("biofuel.pathway");
  if (!pathway || LIQUID_PATHWAYS.includes(pathway)) return "litre";
  return (r.choice("biofuel.fuelUnit") as FuelUnit | undefined) ?? "litre";
}

const residualQualifiers: readonly QOption[] = [
  { id: "percent", unit: "percent", rule: PCT },
  { id: "amount", unit: "money", rule: MONEY },
];

const payloadQualifiers = (rule: RuleSpec): readonly QOption[] => [
  { id: "kg", unit: "kg", rule },
  { id: "tonnes", unit: "tonnes", rule },
];

/** Fields every vehicle pathway shares in its advanced section. */
function advancedCosts(prefix: string, section: string) {
  const optionalCost = (name: string, label: string, unit: UnitId, glossary?: string) =>
    num({ id: `${prefix}.${name}`, section, label, unit, rule: MONEY, required: false, allowNotApplicable: true, glossary });
  return [
    qnum({
      id: `${prefix}.residual`,
      section,
      label: "Residual value at the end of the analysis period",
      qualifiers: residualQualifiers,
      defaultQualifier: "percent",
      required: false,
      glossary: "residualValue",
      hint: "Enter either an amount (per vehicle) or a percentage of the acquisition price, not both.",
    }),
    optionalCost("insurance", "Annual insurance cost (per vehicle)", "money_per_year"),
    optionalCost("registration", "Annual registration and licensing cost (per vehicle)", "money_per_year"),
    optionalCost("otherFixed", "Other fixed annual operating cost (per vehicle)", "money_per_year"),
    optionalCost("otherVariable", "Other variable operating cost", "money_per_km"),
  ];
}

const SPLIT_STRUCTURES = ["debt_equity", "custom"];
const debtInvolved = (r: Reader) => {
  const structure = r.choice("finance.structure");
  if (structure === "debt_100") return true;
  if (!SPLIT_STRUCTURES.includes(structure ?? "")) return false;
  const debt = r.number("finance.debtPercent");
  return debt.status === "value" && debt.value > 0;
};
const hasChargingInfra = (r: Reader) => INFRASTRUCTURE_ARRANGEMENTS.includes(r.choice("bevInfra.arrangement") ?? "");

function incentiveFields(tech: "diesel" | "bev" | "biofuel", label: string): FieldDef[] {
  const type = `incentive.${tech}.type`;
  const is = (r: Reader, ...types: string[]) => types.includes(r.choice(type) ?? "");
  return [
    choice({ id: type, section: "fin-incentives", label: `${label}: incentive`, options: OPTIONS.incentiveType, presentation: "select", required: false, glossary: "incentive" }),
    num({ id: `incentive.${tech}.amount`, section: "fin-incentives", label: `${label}: incentive amount (per vehicle)`, unit: "money", rule: MONEY, required: true, visibleWhen: (r) => is(r, "upfront_grant", "tax_credit", "other"), hint: "0 is valid." }),
    num({ id: `incentive.${tech}.percent`, section: "fin-incentives", label: `${label}: share of purchase price covered`, unit: "percent", rule: PCT, required: true, visibleWhen: (r) => is(r, "percent_subsidy"), hint: "0 is valid." }),
  ];
}

function emissionFactor(key: string, label: string, unit: UnitId | ((r: Reader) => UnitId)): FieldDef[] {
  const base = { section: "fin-env" } as const;
  return [
    num({ id: `env.${key}.value`, ...base, label: `${label} emission factor`, unit, rule: { min: 0, max: 1000 }, required: false, glossary: "emissionFactor" }),
    text({ id: `env.${key}.source`, ...base, label: `${label}: source or reference`, required: false, placeholder: "e.g. report, dataset or supplier document" }),
    num({ id: `env.${key}.year`, ...base, label: `${label}: source year`, unit: "calendar_year", rule: { min: 1900, max: 2100, integer: true }, required: false, hint: "Calendar year of the source, e.g. 2023." }),
    text({ id: `env.${key}.notes`, ...base, label: `${label}: notes`, required: false, multiline: true }),
  ];
}

// ----- the schema ------------------------------------------------------------------------
export const FIELDS: readonly FieldDef[] = [
  // ===== Step 1: Business & Fleet =====================================================
  text({ id: "business.assessmentName", section: "assessment", label: "Assessment name", required: true, placeholder: "Port Harcourt Urban Delivery Fleet" }),
  text({ id: "business.businessName", section: "assessment", label: "Business name", required: false }),
  choice({ id: "business.businessType", section: "assessment", label: "Business type", options: OPTIONS.businessType, presentation: "select", required: false }),
  choice({ id: "business.country", section: "assessment", label: "Country", options: OPTIONS.country, presentation: "select", required: false }),
  text({ id: "business.location", section: "assessment", label: "Operating location", required: false, placeholder: "City, corridor or region" }),
  choice({ id: "business.currency", section: "assessment", label: "Currency", options: OPTIONS.currency, presentation: "select", required: true, defaultValue: "NGN", hint: "Changing currency relabels units. It does not convert amounts you have entered." }),

  num({ id: "fleet.size", section: "fleet", label: "Number of vehicles being evaluated", unit: "vehicles", rule: { min: 1, integer: true }, required: true }),
  choice({ id: "fleet.vehicleCategory", section: "fleet", label: "Vehicle category", options: OPTIONS.vehicleCategory, presentation: "select", required: false }),
  qnum({ id: "fleet.payloadCapacity", section: "fleet", label: "Payload capacity", qualifiers: payloadQualifiers(POSITIVE), defaultQualifier: "kg", required: false, glossary: "payload", hint: "Recommended. Used for cost per tonne-km later." }),
  qnum({ id: "fleet.averagePayload", section: "fleet", label: "Average payload carried", qualifiers: payloadQualifiers(POSITIVE), defaultQualifier: "kg", required: false, glossary: "payload" }),

  num({ id: "ops.dailyDistance", section: "operating", label: "Average distance per vehicle per day", unit: "km_per_day", rule: { ...POSITIVE, plausibleMax: 1500 }, required: true, glossary: "utilisation", visibleWhen: (r) => r.choice("ops.distanceMode") !== "annual" }),
  num({ id: "ops.annualDistance", section: "operating", label: "Average distance per vehicle per year", unit: "km_per_year", rule: { ...POSITIVE, plausibleMax: 500000 }, required: true, glossary: "utilisation", visibleWhen: (r) => r.choice("ops.distanceMode") === "annual" }),
  num({ id: "ops.operatingDays", section: "operating", label: "Operating days per year", unit: "days_per_year", rule: { min: 1, max: 366, integer: true }, required: true }),
  choice({ id: "ops.operatingPattern", section: "operating", label: "Operating pattern", options: OPTIONS.operatingPattern, presentation: "select", required: false }),
  num({ id: "ops.analysisHorizon", section: "operating", label: "Expected project / analysis period", unit: "years", rule: { ...POSITIVE_INT, max: 50 }, required: true, glossary: "analysisHorizon", hint: "Whole years over which the investment is evaluated." }),

  choice({ id: "ops.distanceMode", section: "operating-advanced", label: "Enter annual distance directly", options: OPTIONS.distanceMode, presentation: "switch", switchOn: "annual", defaultValue: "daily", required: false, hint: "Switch on to enter kilometres per year instead of kilometres per day." }),
  num({ id: "ops.routeDistance", section: "operating-advanced", label: "Average route distance", unit: "km", rule: POSITIVE, required: false }),
  num({ id: "ops.tripsPerDay", section: "operating-advanced", label: "Average trips per day", unit: "trips_per_day", rule: { ...POSITIVE, plausibleMax: 100 }, required: false }),

  // ===== Step 2: Diesel baseline ======================================================
  num({ id: "diesel.acquisitionPrice", section: "diesel-core", label: "Vehicle acquisition price", unit: "money", rule: MONEY, required: true, provenance: true, hint: "Per vehicle." }),
  qnum({
    id: "diesel.fuelEfficiency", section: "diesel-core", label: "Fuel efficiency", glossary: "fuelEfficiency", required: true, defaultQualifier: "litres_per_100km",
    qualifiers: [
      { id: "litres_per_100km", unit: "litres_per_100km", rule: { ...POSITIVE, plausibleMax: 100 } },
      { id: "km_per_litre", unit: "km_per_litre", rule: { ...POSITIVE, plausibleMax: 60 } },
    ],
    hint: "Choose the unit you know. Enter one, not both.",
  }),
  num({ id: "diesel.fuelPrice", section: "diesel-core", label: "Diesel price", unit: "money_per_litre", rule: MONEY, required: true, provenance: true, hint: "The price you pay, not a national average." }),
  num({ id: "diesel.annualMaintenance", section: "diesel-core", label: "Annual maintenance cost (per vehicle)", unit: "money_per_year", rule: MONEY, required: true }),
  num({ id: "diesel.usefulLife", section: "diesel-core", label: "Vehicle useful life", unit: "years", rule: { ...POSITIVE, max: 50 }, required: true }),
  ...advancedCosts("diesel", "diesel-advanced"),
  num({ id: "diesel.fuelEscalation", section: "diesel-advanced", label: "Expected annual fuel-price escalation", unit: "percent", rule: ESCALATION, required: false, glossary: "escalation", hint: "Leave blank if you have no view. No escalation is assumed." }),

  // ===== Step 3: Battery electric =====================================================
  num({ id: "bev.acquisitionPrice", section: "bev-core", label: "Vehicle acquisition price", unit: "money", rule: MONEY, required: true, provenance: true, hint: "Per vehicle." }),
  qnum({
    id: "bev.energyConsumption", section: "bev-core", label: "Energy consumption", glossary: "energyConsumption", required: true, defaultQualifier: "kwh_per_100km",
    qualifiers: [
      { id: "kwh_per_100km", unit: "kwh_per_100km", rule: { ...POSITIVE, plausibleMax: 300 } },
      { id: "kwh_per_km", unit: "kwh_per_km", rule: { ...POSITIVE, plausibleMax: 3 } },
    ],
    hint: "Energy used at the vehicle, before charging losses.",
  }),
  num({ id: "bev.electricityTariff", section: "bev-core", label: "Electricity tariff", unit: "money_per_kwh", rule: MONEY, required: true, provenance: true, hint: "What you actually pay at the charger, including any generator or tariff premium." }),
  num({ id: "bev.annualMaintenance", section: "bev-core", label: "Annual maintenance cost (per vehicle)", unit: "money_per_year", rule: MONEY, required: true }),
  num({ id: "bev.usefulLife", section: "bev-core", label: "Vehicle useful life", unit: "years", rule: { ...POSITIVE, max: 50 }, required: true }),
  num({ id: "bev.usableRange", section: "bev-core", label: "Usable driving range per full charge", unit: "km", rule: { ...POSITIVE, plausibleMax: 1500 }, required: true, glossary: "usableRange", hint: "Real-world range with your load and conditions, not the brochure figure." }),
  num({ id: "bev.batteryCapacity", section: "bev-core", label: "Battery capacity", unit: "kwh", rule: { ...POSITIVE, plausibleMax: 1500 }, required: false, hint: "Recommended." }),

  choice({ id: "bev.chargingOpportunity", section: "bev-ops", label: "Charging opportunity during the operating day", options: OPTIONS.chargingOpportunity, presentation: "select", required: false }),
  num({ id: "bev.chargingDowntime", section: "bev-ops", label: "Average charging downtime per operating day", unit: "hours_per_day", rule: { min: 0, max: 24 }, required: false }),
  choice({ id: "bev.payloadImpact", section: "bev-ops", label: "Payload impact", options: OPTIONS.payloadImpact, presentation: "radio", required: false }),
  qnum({ id: "bev.payloadReduction", section: "bev-ops", label: "Estimated payload reduction", qualifiers: [{ id: "kg", unit: "kg", rule: POSITIVE }, { id: "percent", unit: "percent", rule: POSITIVE_PCT }], defaultQualifier: "kg", required: true, visibleWhen: (r) => r.choice("bev.payloadImpact") === "reduced" }),

  ...advancedCosts("bev", "bev-advanced"),
  choice({ id: "bev.batteryReplacement", section: "bev-advanced", label: "Battery replacement expected?", options: OPTIONS.yesNoUnknown, presentation: "radio", required: false, hint: "“Unknown” is kept as unknown. It is not treated as zero." }),
  num({ id: "bev.batteryReplacementYear", section: "bev-advanced", label: "Battery replacement year", unit: "years", rule: { ...POSITIVE_INT, max: 50 }, required: true, visibleWhen: (r) => r.choice("bev.batteryReplacement") === "yes", hint: "Year of operation in which the battery is replaced." }),
  num({ id: "bev.batteryReplacementCost", section: "bev-advanced", label: "Estimated battery replacement cost", unit: "money", rule: MONEY, required: true, visibleWhen: (r) => r.choice("bev.batteryReplacement") === "yes" }),
  num({ id: "bev.electricityEscalation", section: "bev-advanced", label: "Expected annual electricity-price escalation", unit: "percent", rule: ESCALATION, required: false, glossary: "escalation", hint: "Leave blank if you have no view. No escalation is assumed." }),
  num({ id: "bev.chargingLoss", section: "bev-advanced", label: "Charging losses", unit: "percent", rule: { ...PCT, maxExclusive: true, plausibleMax: 40 }, required: false, glossary: "chargingLosses", hint: "Share of grid energy lost before it reaches the vehicle. 10% means 10 of every 100 kWh drawn from the grid is lost." }),

  // ===== Step 4: Biofuel / alternative fuel ===========================================
  choice({ id: "biofuel.pathway", section: "bio-core", label: "Biofuel pathway", options: OPTIONS.biofuelPathway, presentation: "select", required: true, resetsOnChange: ["biofuel.blendPercent", "biofuel.fuelUnit", "biofuel.fuelPrice", "biofuel.fuelEfficiency", "env.biofuel.value"], hint: "Compatibility with your engine must come from the manufacturer or your own records." }),
  num({ id: "biofuel.blendPercent", section: "bio-core", label: "Biofuel blend percentage", unit: "percent", rule: PCT, required: true, glossary: "biofuelBlend", visibleWhen: (r) => r.choice("biofuel.pathway") === "biodiesel_blend", hint: "Notation only: B5 = 5%, B20 = 20%." }),
  choice({ id: "biofuel.fuelUnit", section: "bio-core", label: "Fuel unit", options: OPTIONS.fuelUnit, presentation: "select", required: true, visibleWhen: (r) => { const p = r.choice("biofuel.pathway"); return !!p && !LIQUID_PATHWAYS.includes(p); }, resetsOnChange: ["biofuel.fuelPrice", "biofuel.fuelEfficiency", "env.biofuel.value"], hint: "The unit this fuel is bought and burned in." }),
  choice({ id: "biofuel.acquisitionMode", section: "bio-core", label: "Vehicle option", options: OPTIONS.acquisitionMode, presentation: "radio", required: true }),
  num({ id: "biofuel.acquisitionPrice", section: "bio-core", label: "Vehicle acquisition price", unit: "money", rule: MONEY, required: true, provenance: true, visibleWhen: (r) => r.choice("biofuel.acquisitionMode") === "new_vehicle", hint: "Per vehicle." }),
  num({ id: "biofuel.existingVehicleValue", section: "bio-core", label: "Existing vehicle value", unit: "money", rule: MONEY, required: false, visibleWhen: (r) => r.choice("biofuel.acquisitionMode") === "conversion", hint: "Optional. Current value of the vehicle you would convert." }),
  num({ id: "biofuel.conversionCost", section: "bio-core", label: "Conversion / modification cost", unit: "money", rule: MONEY, required: true, visibleWhen: (r) => r.choice("biofuel.acquisitionMode") === "conversion", hint: "Per vehicle." }),
  num({ id: "biofuel.fuelPrice", section: "bio-core", label: "Fuel price", unit: (r) => FUEL_UNITS[biofuelFuelUnit(r)].price, rule: MONEY, required: true, provenance: true, hint: "Price of the fuel as you buy it. For a blend, enter the price of the blend, not of the pure biofuel." }),
  qnum({
    id: "biofuel.fuelEfficiency", section: "bio-core", label: "Fuel efficiency", glossary: "fuelEfficiency", required: true, defaultQualifier: "fuel_per_100km",
    qualifiers: (r) => {
      const u = FUEL_UNITS[biofuelFuelUnit(r)];
      return [
        { id: "fuel_per_100km", unit: u.fuelPer100Km, rule: { ...POSITIVE, plausibleMax: 150 } },
        { id: "distance_per_fuel", unit: u.distancePerFuel, rule: { ...POSITIVE, plausibleMax: 60 } },
      ];
    },
    hint: "Choose the unit you know. Enter one, not both.",
  }),
  num({ id: "biofuel.annualMaintenance", section: "bio-core", label: "Annual maintenance cost (per vehicle)", unit: "money_per_year", rule: MONEY, required: true }),
  num({ id: "biofuel.usefulLife", section: "bio-core", label: "Vehicle useful life", unit: "years", rule: { ...POSITIVE, max: 50 }, required: true }),

  choice({ id: "biofuel.fuelAvailability", section: "bio-supply", label: "Fuel availability", options: OPTIONS.fuelAvailability, presentation: "select", required: false }),
  num({ id: "biofuel.additionalRefuellingKm", section: "bio-supply", label: "Additional refuelling distance (per vehicle per day)", unit: "km_per_day", rule: MONEY, required: false, hint: "Extra distance driven to reach this fuel." }),
  num({ id: "biofuel.downtime", section: "bio-supply", label: "Operational downtime from fuel availability", unit: "hours_per_month", rule: { min: 0, max: 744 }, required: false }),
  choice({ id: "biofuel.specialInfrastructure", section: "bio-supply", label: "Special storage or infrastructure required?", options: OPTIONS.yesNoUnknown, presentation: "radio", required: false, hint: "If yes, enter the costs in Step 5." }),

  ...advancedCosts("biofuel", "bio-advanced"),
  num({ id: "biofuel.fuelEscalation", section: "bio-advanced", label: "Expected annual fuel-price escalation", unit: "percent", rule: ESCALATION, required: false, glossary: "escalation", hint: "Leave blank if you have no view. No escalation is assumed." }),
  qnum({ id: "biofuel.incrementalMaintenance", section: "bio-advanced", label: "Additional maintenance caused by this fuel (per vehicle)", qualifiers: [{ id: "amount", unit: "money_per_year", rule: {} }, { id: "percent", unit: "percent", rule: { min: -100, max: 500 } }], defaultQualifier: "amount", required: false, hint: "Added on top of the annual maintenance above (an amount per vehicle per year, or a percentage of that maintenance). Use a negative number if you expect it to be lower." }),

  // ===== Step 5A: Financing ===========================================================
  choice({ id: "finance.structure", section: "fin-financing", label: "Financing structure", options: OPTIONS.financingStructure, presentation: "select", required: true }),
  num({ id: "finance.debtPercent", section: "fin-financing", label: "Debt share", unit: "percent", rule: PCT, required: true, visibleWhen: (r) => SPLIT_STRUCTURES.includes(r.choice("finance.structure") ?? ""), hint: "Debt and equity must add up to 100%." }),
  num({ id: "finance.equityPercent", section: "fin-financing", label: "Equity share", unit: "percent", rule: PCT, required: true, visibleWhen: (r) => SPLIT_STRUCTURES.includes(r.choice("finance.structure") ?? "") }),
  num({ id: "finance.interestRate", section: "fin-financing", label: "Annual interest rate", unit: "percent", rule: { min: 0, max: 100 }, required: true, provenance: true, visibleWhen: debtInvolved }),
  num({ id: "finance.loanTenor", section: "fin-financing", label: "Loan tenor", unit: "years", rule: { ...POSITIVE_INT, max: 40 }, required: true, visibleWhen: debtInvolved }),
  num({ id: "finance.loanFees", section: "fin-financing", label: "Loan fees / arrangement cost", unit: "money", rule: MONEY, required: false, visibleWhen: debtInvolved, hint: "Optional. Total, one-off." }),
  num({ id: "finance.discountRate", section: "fin-financing", label: "Discount rate", unit: "percent", rule: { min: 0, max: 100 }, required: true, glossary: "discountRate", provenance: true }),

  ...incentiveFields("diesel", "Diesel"),
  ...incentiveFields("bev", "Battery electric"),
  ...incentiveFields("biofuel", "Biofuel"),

  // ===== Step 5B: Infrastructure ======================================================
  choice({ id: "bevInfra.arrangement", section: "fin-bev-infra", label: "Charging arrangement", options: OPTIONS.chargingArrangement, presentation: "select", required: false, hint: "Infrastructure costs are asked for only if you will buy or build chargers." }),
  num({ id: "bevInfra.equipmentCost", section: "fin-bev-infra", label: "Charger equipment cost", unit: "money", rule: MONEY, required: true, visibleWhen: hasChargingInfra, hint: "Total for all chargers together, not per charger. 0 is valid if the equipment is already owned." }),
  num({ id: "bevInfra.installationCost", section: "fin-bev-infra", label: "Installation cost", unit: "money", rule: MONEY, required: true, visibleWhen: hasChargingInfra, hint: "Total for the whole installation." }),
  num({ id: "bevInfra.electricalUpgradeCost", section: "fin-bev-infra", label: "Electrical upgrade cost", unit: "money", rule: MONEY, required: false, allowNotApplicable: true, visibleWhen: hasChargingInfra, hint: "Total, for example grid connection or wiring upgrades." }),
  num({ id: "bevInfra.chargerCount", section: "fin-bev-infra", label: "Number of chargers", unit: "vehicles", rule: { min: 1, integer: true }, required: true, visibleWhen: hasChargingInfra }),
  num({ id: "bevInfra.vehiclesSharing", section: "fin-bev-infra", label: "Total vehicles using these chargers", unit: "vehicles", rule: { min: 1, integer: true }, required: true, visibleWhen: hasChargingInfra, hint: "Count every vehicle that uses them, including the vehicles you are assessing. Your fleet is charged its share of the cost." }),
  num({ id: "bevInfra.lifeYears", section: "fin-bev-infra", label: "Infrastructure useful life", unit: "years", rule: { ...POSITIVE, max: 50 }, required: true, visibleWhen: hasChargingInfra }),
  num({ id: "bevInfra.annualMaintenance", section: "fin-bev-infra", label: "Annual charger maintenance cost", unit: "money_per_year", rule: MONEY, required: false, allowNotApplicable: true, visibleWhen: hasChargingInfra }),
  num({ id: "bevInfra.otherAnnualCost", section: "fin-bev-infra", label: "Other annual charging infrastructure cost", unit: "money_per_year", rule: MONEY, required: false, allowNotApplicable: true, visibleWhen: hasChargingInfra }),
  num({ id: "bevInfra.utilisation", section: "fin-bev-infra", label: "Expected charger utilisation", unit: "percent", rule: PCT, required: false, glossary: "infraUtilisation", visibleWhen: hasChargingInfra }),

  num({ id: "bioInfra.storageCost", section: "fin-bio-infra", label: "Storage equipment cost", unit: "money", rule: MONEY, required: true, visibleWhen: (r) => r.choice("biofuel.specialInfrastructure") === "yes", hint: "Total. 0 is valid." }),
  num({ id: "bioInfra.refuellingCost", section: "fin-bio-infra", label: "Conversion / refuelling infrastructure cost", unit: "money", rule: MONEY, required: true, visibleWhen: (r) => r.choice("biofuel.specialInfrastructure") === "yes" }),
  num({ id: "bioInfra.installationCost", section: "fin-bio-infra", label: "Installation cost", unit: "money", rule: MONEY, required: true, visibleWhen: (r) => r.choice("biofuel.specialInfrastructure") === "yes" }),
  num({ id: "bioInfra.annualMaintenance", section: "fin-bio-infra", label: "Annual maintenance cost", unit: "money_per_year", rule: MONEY, required: false, allowNotApplicable: true, visibleWhen: (r) => r.choice("biofuel.specialInfrastructure") === "yes" }),
  num({ id: "bioInfra.lifeYears", section: "fin-bio-infra", label: "Infrastructure useful life", unit: "years", rule: { ...POSITIVE, max: 50 }, required: true, visibleWhen: (r) => r.choice("biofuel.specialInfrastructure") === "yes" }),

  // ===== Step 5C: Environmental assumptions ===========================================
  ...emissionFactor("diesel", "Diesel", "kgco2e_per_litre"),
  ...emissionFactor("grid", "Grid electricity", "kgco2e_per_kwh"),
  ...emissionFactor("biofuel", "Biofuel", (r) => FUEL_UNITS[biofuelFuelUnit(r)].emissionFactor),
  num({ id: "env.lifecycle.diesel", section: "fin-env", label: "Diesel lifecycle adjustment", unit: "percent", rule: { min: -100, max: 1000 }, required: false, glossary: "lifecycleAdjustment" }),
  num({ id: "env.lifecycle.grid", section: "fin-env", label: "Electricity lifecycle adjustment", unit: "percent", rule: { min: -100, max: 1000 }, required: false, glossary: "lifecycleAdjustment" }),
  num({ id: "env.lifecycle.biofuel", section: "fin-env", label: "Biofuel lifecycle adjustment", unit: "percent", rule: { min: -100, max: 1000 }, required: false, glossary: "lifecycleAdjustment" }),
];

export const FIELD_BY_ID: Readonly<Record<string, FieldDef>> = Object.fromEntries(FIELDS.map((f) => [f.id, f]));
