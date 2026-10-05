/**
 * Single registry of every user-editable input.
 *
 * Each field carries a unit (money fields carry the selected currency), valid range,
 * default, and the provenance of that default. Every default shipped here is an
 * ILLUSTRATIVE PLACEHOLDER, not market data. Nothing in this file is a statement of
 * current Nigerian (or any other) prices, tariffs, interest rates or statistics.
 */

export const NA = "NA" as const;
/** number = entered value (0 is a real value), null = missing, "NA" = not applicable. */
export type Raw = number | null | typeof NA;

export type Tech = "diesel" | "bev" | "biofuel";
export const TECHS: readonly Tech[] = ["diesel", "bev", "biofuel"];
export const TECH_LABEL: Record<Tech, string> = {
  diesel: "Diesel (baseline)",
  bev: "Battery-electric (BEV)",
  biofuel: "Biofuel blend",
};

export type Group =
  | "operations"
  | "prices"
  | "financing"
  | "diesel"
  | "bev"
  | "biofuel"
  | "emissions"
  | "rules";

export const GROUP_LABEL: Record<Group, string> = {
  operations: "Operations and valuation",
  prices: "Energy prices and escalation",
  financing: "Financing",
  diesel: "Diesel vehicle (baseline)",
  bev: "Battery-electric vehicle",
  biofuel: "Biofuel-blend vehicle",
  emissions: "Emission factors",
  rules: "Decision rules (thresholds)",
};

export type Kind = "money" | "number" | "percent" | "int";

export interface FieldDef {
  id: string;
  group: Group;
  label: string;
  /** "{cur}" is replaced by the selected currency code. */
  unit: string;
  kind: Kind;
  min: number;
  max: number;
  /** If true the value must be strictly greater than `min`. */
  minExclusive?: boolean;
  default: Raw;
  allowNA?: boolean;
  provenance: "illustrative";
  help?: string;
}

const p = "illustrative" as const;

const defs = [
  // ---------- operations ----------
  { id: "horizonYears", group: "operations", label: "Analysis horizon", unit: "years", kind: "int", min: 1, max: 30, default: 7, provenance: p, help: "Must not exceed any vehicle's lifetime." },
  { id: "discountRatePct", group: "operations", label: "Discount rate (nominal)", unit: "% per year", kind: "percent", min: 0, max: 100, default: 15, provenance: p, help: "Your required return. Keep nominal/real consistent with the escalation rates below." },
  { id: "dailyDistanceKm", group: "operations", label: "Daily distance", unit: "km/day", kind: "number", min: 0, max: 1500, minExclusive: true, default: 120, provenance: p },
  { id: "operatingDays", group: "operations", label: "Operating days", unit: "days/year", kind: "int", min: 1, max: 366, default: 300, provenance: p },
  { id: "loadFactorPct", group: "operations", label: "Average load factor", unit: "% of payload", kind: "percent", min: 0, max: 100, minExclusive: true, default: 70, provenance: p, help: "Used only for cost per tonne-km." },

  // ---------- prices ----------
  { id: "dieselPrice", group: "prices", label: "Diesel price (year 1)", unit: "{cur}/L", kind: "money", min: 0, max: 1e6, minExclusive: true, default: 1200, provenance: p },
  { id: "electricityPrice", group: "prices", label: "Electricity price (year 1)", unit: "{cur}/kWh", kind: "money", min: 0, max: 1e6, minExclusive: true, default: 150, provenance: p, help: "Price you actually pay at the charger, including any generator or tariff premium." },
  { id: "biofuelPrice", group: "prices", label: "Pure biofuel component price (year 1)", unit: "{cur}/L", kind: "money", min: 0, max: 1e6, minExclusive: true, default: 1400, provenance: p },
  { id: "dieselEscPct", group: "prices", label: "Diesel price escalation", unit: "% per year", kind: "percent", min: -50, max: 100, default: 8, provenance: p },
  { id: "electricityEscPct", group: "prices", label: "Electricity price escalation", unit: "% per year", kind: "percent", min: -50, max: 100, default: 8, provenance: p },
  { id: "biofuelEscPct", group: "prices", label: "Biofuel price escalation", unit: "% per year", kind: "percent", min: -50, max: 100, default: 8, provenance: p },
  { id: "opexEscPct", group: "prices", label: "Maintenance and fixed-cost escalation", unit: "% per year", kind: "percent", min: -50, max: 100, default: 8, provenance: p },

  // ---------- financing ----------
  { id: "financedSharePct", group: "financing", label: "Share of vehicle price financed", unit: "% of vehicle price", kind: "percent", min: 0, max: 100, default: 50, provenance: p, help: "Infrastructure is assumed paid from equity." },
  { id: "interestRatePct", group: "financing", label: "Loan interest rate", unit: "% per year", kind: "percent", min: 0, max: 100, default: 25, provenance: p },
  { id: "loanTermYears", group: "financing", label: "Loan term", unit: "years", kind: "int", min: 1, max: 15, default: 4, allowNA: true, provenance: p, help: "Set N/A if nothing is financed. Equal annual payments." },

  // ---------- diesel ----------
  { id: "dPrice", group: "diesel", label: "Vehicle acquisition cost", unit: "{cur}", kind: "money", min: 0, max: 1e12, minExclusive: true, default: 45_000_000, provenance: p },
  { id: "dConsumption", group: "diesel", label: "Fuel consumption", unit: "L/100 km", kind: "number", min: 0, max: 200, minExclusive: true, default: 22, provenance: p },
  { id: "dMaintPerKm", group: "diesel", label: "Maintenance cost", unit: "{cur}/km", kind: "money", min: 0, max: 1e6, default: 45, provenance: p },
  { id: "dFixedAnnual", group: "diesel", label: "Insurance, licences and other fixed costs", unit: "{cur}/year", kind: "money", min: 0, max: 1e12, default: 900_000, provenance: p },
  { id: "dLifetime", group: "diesel", label: "Vehicle lifetime", unit: "years", kind: "int", min: 1, max: 40, default: 10, provenance: p },
  { id: "dResidualPct", group: "diesel", label: "Residual value at end of lifetime", unit: "% of price", kind: "percent", min: 0, max: 100, default: 20, provenance: p, help: "Value declines straight-line to this level over the lifetime." },
  { id: "dPayloadKg", group: "diesel", label: "Payload", unit: "kg", kind: "number", min: 0, max: 100000, minExclusive: true, default: 3000, provenance: p },

  // ---------- BEV ----------
  { id: "bPrice", group: "bev", label: "Vehicle acquisition cost", unit: "{cur}", kind: "money", min: 0, max: 1e12, minExclusive: true, default: 80_000_000, provenance: p },
  { id: "bConsumption", group: "bev", label: "Electricity consumption (at the vehicle)", unit: "kWh/100 km", kind: "number", min: 0, max: 500, minExclusive: true, default: 38, provenance: p },
  { id: "bChargingLossPct", group: "bev", label: "Charging losses", unit: "% of energy drawn", kind: "percent", min: 0, max: 60, default: 10, provenance: p, help: "Extra grid energy needed because of charger and battery losses." },
  { id: "bMaintPerKm", group: "bev", label: "Maintenance cost", unit: "{cur}/km", kind: "money", min: 0, max: 1e6, default: 25, provenance: p },
  { id: "bFixedAnnual", group: "bev", label: "Insurance, licences and other fixed costs", unit: "{cur}/year", kind: "money", min: 0, max: 1e12, default: 1_000_000, provenance: p },
  { id: "bLifetime", group: "bev", label: "Vehicle lifetime", unit: "years", kind: "int", min: 1, max: 40, default: 10, provenance: p },
  { id: "bResidualPct", group: "bev", label: "Residual value at end of lifetime", unit: "% of price", kind: "percent", min: 0, max: 100, default: 15, provenance: p },
  { id: "bPayloadKg", group: "bev", label: "Payload", unit: "kg", kind: "number", min: 0, max: 100000, minExclusive: true, default: 2700, provenance: p },
  { id: "bBatteryKwh", group: "bev", label: "Battery capacity", unit: "kWh", kind: "number", min: 0, max: 2000, minExclusive: true, default: 90, provenance: p },
  { id: "bUsableSocPct", group: "bev", label: "Usable share of battery", unit: "% of capacity", kind: "percent", min: 0, max: 100, minExclusive: true, default: 80, provenance: p },
  { id: "bChargerKw", group: "bev", label: "Charger power", unit: "kW", kind: "number", min: 0, max: 1000, minExclusive: true, default: 22, provenance: p },
  { id: "bChargeWindowHrs", group: "bev", label: "Hours available for charging per day", unit: "hours/day", kind: "number", min: 0, max: 24, minExclusive: true, default: 8, provenance: p },
  { id: "bInfraCost", group: "bev", label: "Charging infrastructure cost (total)", unit: "{cur}", kind: "money", min: 0, max: 1e12, default: 6_000_000, allowNA: true, provenance: p, help: "Enter 0 if it genuinely costs nothing. Choose N/A if no dedicated infrastructure applies. Leaving it blank is an error." },
  { id: "bInfraVehicles", group: "bev", label: "Vehicles sharing the infrastructure", unit: "vehicles", kind: "int", min: 1, max: 10000, default: 2, allowNA: true, provenance: p, help: "Infrastructure cost is divided by this number (utilisation)." },
  { id: "bBatteryReplCost", group: "bev", label: "Battery replacement cost", unit: "{cur}", kind: "money", min: 0, max: 1e12, default: NA, allowNA: true, provenance: p, help: "Stated in money of the replacement year; no further escalation is applied." },
  { id: "bBatteryReplYear", group: "bev", label: "Battery replacement year", unit: "year of operation", kind: "int", min: 1, max: 30, default: NA, allowNA: true, provenance: p },

  // ---------- biofuel ----------
  { id: "fPrice", group: "biofuel", label: "Vehicle acquisition cost (incl. any conversion)", unit: "{cur}", kind: "money", min: 0, max: 1e12, minExclusive: true, default: 46_000_000, provenance: p },
  { id: "fBlendPct", group: "biofuel", label: "Biofuel share of blend (by volume)", unit: "% of litres", kind: "percent", min: 0, max: 100, default: 20, provenance: p },
  { id: "fApprovedBlendPct", group: "biofuel", label: "Maximum blend approved for the engine", unit: "% of litres", kind: "percent", min: 0, max: 100, default: 20, provenance: p, help: "Take this from the manufacturer or warranty terms." },
  { id: "fConsumptionPenaltyPct", group: "biofuel", label: "Extra fuel use versus diesel", unit: "% of diesel litres", kind: "percent", min: -20, max: 50, default: 3, provenance: p, help: "Consumption is taken from the diesel vehicle, scaled by this penalty." },
  { id: "fMaintPerKm", group: "biofuel", label: "Maintenance cost", unit: "{cur}/km", kind: "money", min: 0, max: 1e6, default: 48, provenance: p },
  { id: "fFixedAnnual", group: "biofuel", label: "Insurance, licences and other fixed costs", unit: "{cur}/year", kind: "money", min: 0, max: 1e12, default: 900_000, provenance: p },
  { id: "fLifetime", group: "biofuel", label: "Vehicle lifetime", unit: "years", kind: "int", min: 1, max: 40, default: 10, provenance: p },
  { id: "fResidualPct", group: "biofuel", label: "Residual value at end of lifetime", unit: "% of price", kind: "percent", min: 0, max: 100, default: 20, provenance: p },
  { id: "fPayloadKg", group: "biofuel", label: "Payload", unit: "kg", kind: "number", min: 0, max: 100000, minExclusive: true, default: 3000, provenance: p },
  { id: "fInfraCost", group: "biofuel", label: "Storage and blending infrastructure cost (total)", unit: "{cur}", kind: "money", min: 0, max: 1e12, default: 0, allowNA: true, provenance: p, help: "0 is a real value (no extra infrastructure). N/A means not applicable. Blank is an error." },
  { id: "fInfraVehicles", group: "biofuel", label: "Vehicles sharing the infrastructure", unit: "vehicles", kind: "int", min: 1, max: 10000, default: 1, allowNA: true, provenance: p },

  // ---------- emissions ----------
  { id: "efDiesel", group: "emissions", label: "Diesel combustion emission factor", unit: "kg CO2e/L", kind: "number", min: 0, max: 20, default: 2.68, provenance: p, help: "Order of magnitude of commonly published combustion factors. Not verified against a specific edition; replace with a cited value." },
  { id: "efBiofuel", group: "emissions", label: "Pure biofuel net life-cycle factor", unit: "kg CO2e/L", kind: "number", min: 0, max: 20, default: 1.0, provenance: p, help: "Depends heavily on feedstock and land use. Replace with a cited value for your supply chain." },
  { id: "efGrid", group: "emissions", label: "Electricity emission factor", unit: "kg CO2e/kWh", kind: "number", min: 0, max: 5, default: 0.43, provenance: p, help: "Depends on the grid or generator you charge from. Replace with a cited value." },

  // ---------- rules ----------
  { id: "ruleMaxPaybackYears", group: "rules", label: "Maximum acceptable payback", unit: "years", kind: "number", min: 0, max: 30, minExclusive: true, default: 5, provenance: p },
  { id: "ruleNearMissPct", group: "rules", label: "Near-miss tolerance for negative NPV", unit: "% of diesel PV cost", kind: "percent", min: 0, max: 100, default: 5, provenance: p },
  { id: "ruleMinRobustPct", group: "rules", label: "Minimum share of stress tests with positive NPV", unit: "%", kind: "percent", min: 0, max: 100, default: 75, provenance: p },
  { id: "ruleRangeMarginPct", group: "rules", label: "Range safety margin (BEV)", unit: "% above daily distance", kind: "percent", min: 0, max: 100, default: 20, provenance: p },
  { id: "stressPct", group: "rules", label: "Stress / sensitivity step (relative)", unit: "%", kind: "percent", min: 1, max: 90, default: 20, provenance: p },
  { id: "stressRatePp", group: "rules", label: "Stress step for interest and discount rates", unit: "percentage points", kind: "number", min: 0, max: 50, default: 5, provenance: p },
] as const satisfies readonly FieldDef[];

export type FieldId = (typeof defs)[number]["id"];
export const FIELDS: readonly (FieldDef & { id: FieldId })[] = defs;
export const FIELD_BY_ID = Object.fromEntries(FIELDS.map((f) => [f.id, f])) as Record<FieldId, FieldDef & { id: FieldId }>;

export type RawInputs = Record<FieldId, Raw>;
/** Fully validated numeric parameters. N/A has been resolved to 0 for cost-like fields. */
export type Params = Record<FieldId, number>;

export interface Currency { code: string; symbol: string; name: string }
export const CURRENCIES: readonly Currency[] = [
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "Pound Sterling" },
];

export function unitLabel(f: FieldDef, currency: Currency): string {
  return f.unit.replace("{cur}", currency.symbol);
}

export function defaultInputs(): RawInputs {
  return Object.fromEntries(FIELDS.map((f) => [f.id, f.default])) as RawInputs;
}
