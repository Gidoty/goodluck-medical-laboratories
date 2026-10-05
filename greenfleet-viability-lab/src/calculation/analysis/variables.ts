import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { GreenTechId } from "../types";

/**
 * The assumptions that Batch 6 may change in memory. Each one is represented correctly in the
 * normalized input and goes back through the authoritative engine, so no financial formula is
 * repeated here. A variable that cannot be changed safely (for example, a percentage subsidy or
 * tax credit, whose timing is undefined) reports why it is not applicable instead.
 */
export type VariableId =
  | "dieselPrice"
  | "electricityTariff"
  | "biofuelPrice"
  | "bevAcquisition"
  | "biofuelAcquisition"
  | "annualDistance"
  | "operatingDays"
  | "bevMaintenance"
  | "biofuelMaintenance"
  | "discountRate"
  | "bevInfraCapex"
  | "biofuelInfraCapex"
  | "bevSubsidy"
  | "biofuelSubsidy"
  | "bevRange"
  | "bevChargingDowntime"
  | "bevPayloadReduction"
  | "bevChargingOpportunity"
  | "biofuelAvailability";

export type ValueUnit = "money" | "money_per_litre" | "money_per_kwh" | "money_per_fuel_unit" | "money_per_year" | "km" | "km_per_year" | "days" | "percent" | "hours_per_day" | "kg";

export interface Applicability {
  ok: boolean;
  reason?: string;
}

export interface VariableDef {
  id: VariableId;
  label: string;
  kind: "numeric" | "categorical";
  group: "economic" | "operational";
  /** Which alternatives' results this variable can change (diesel-side variables affect both). */
  affects: readonly GreenTechId[];
  unit: ValueUnit;
  /** Short note on how the variable is applied, shown in documentation and the UI. */
  note?: string;
  options?: readonly { id: string; label: string }[];
  applicable(input: NormalizedAssessmentInput): Applicability;
  get(input: NormalizedAssessmentInput): number | string | null;
  /** Returns a new input. Never changes the one it is given. */
  set(input: NormalizedAssessmentInput, value: number | string): NormalizedAssessmentInput;
  /** Why a value is not valid for the model, or null. */
  invalid(input: NormalizedAssessmentInput, value: number | string): string | null;
  /** Solver bounds. They are computational limits, not market limits. */
  solverBounds(input: NormalizedAssessmentInput): { lo: number; hi: number };
  /** The direction that raises the incremental NPV (a hint for display only; the solver measures it). */
  higherIs?: "better" | "worse";
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const OK: Applicability = { ok: true };
const no = (reason: string): Applicability => ({ ok: false, reason });
const clone = (i: NormalizedAssessmentInput): NormalizedAssessmentInput => structuredClone(i);

const nonNegative = (label: string) => (_i: NormalizedAssessmentInput, v: number | string): string | null =>
  typeof v !== "number" || !Number.isFinite(v) ? `${label} must be a number.` : v < 0 ? `${label} cannot be negative.` : null;
const positive = (label: string) => (_i: NormalizedAssessmentInput, v: number | string): string | null =>
  typeof v !== "number" || !Number.isFinite(v) ? `${label} must be a number.` : v <= 0 ? `${label} must be greater than zero.` : null;

/** Upper solver bound: ten times the current value, or a fixed fallback when the current value is zero. */
const tenTimes = (zeroFallback: number) => (current: number | null) => ({ lo: 0, hi: isNum(current) && current > 0 ? current * 10 : zeroFallback });

function setScaledDistance(input: NormalizedAssessmentInput, annual: number): NormalizedAssessmentInput {
  const next = clone(input);
  const ops = next.operations;
  const factor = ops.annualDistanceKmPerVehicle > 0 ? annual / ops.annualDistanceKmPerVehicle : 1;
  ops.annualDistanceKmPerVehicle = annual;
  ops.fleetAnnualDistanceKm = annual * next.fleet.fleetSize;
  // The daily distance is linked to the annual distance (annual = daily x operating days), so with the days held fixed it scales too.
  // The operational checks therefore see the same duty the cost model sees. No contradictory distance inputs are created.
  ops.dailyDistanceKm = ops.dailyDistanceKm * factor;
  return next;
}

function incentiveApplicable(i: NormalizedAssessmentInput, tech: GreenTechId): Applicability {
  const t = i.finance.incentives[tech]?.type ?? null;
  return t === null || t === "none" || t === "upfront_grant" ? OK : no("A percentage subsidy, tax credit or other incentive is entered. Only an upfront grant per vehicle can be varied, because the timing of the others is not defined.");
}
function setGrant(input: NormalizedAssessmentInput, tech: GreenTechId, v: number): NormalizedAssessmentInput {
  const next = clone(input);
  next.finance.incentives[tech] = { type: "upfront_grant", amount: v, percentOfPurchasePrice: null };
  return next;
}
const grantCap = (tech: GreenTechId) => (i: NormalizedAssessmentInput) => i[tech].upfrontVehicleCost;

function bevCapex(i: NormalizedAssessmentInput): number {
  const c = i.infrastructure.bevCharging;
  return (c.equipmentCost ?? 0) + (c.installationCost ?? 0) + (c.electricalUpgradeCost ?? 0);
}
function bioCapex(i: NormalizedAssessmentInput): number {
  const c = i.infrastructure.biofuel;
  return (c.storageEquipmentCost ?? 0) + (c.refuellingInfrastructureCost ?? 0) + (c.installationCost ?? 0);
}

export const VARIABLES: Record<VariableId, VariableDef> = {
  dieselPrice: {
    id: "dieselPrice", label: "Diesel price", kind: "numeric", group: "economic", affects: ["bev", "biofuel"], unit: "money_per_litre", higherIs: "better",
    applicable: () => OK,
    get: (i) => i.diesel.fuelPricePerLitre,
    set: (i, v) => { const n = clone(i); n.diesel.fuelPricePerLitre = v as number; return n; },
    invalid: nonNegative("Diesel price"),
    solverBounds: (i) => tenTimes(10_000)(i.diesel.fuelPricePerLitre),
  },
  electricityTariff: {
    id: "electricityTariff", label: "Electricity tariff", kind: "numeric", group: "economic", affects: ["bev"], unit: "money_per_kwh", higherIs: "worse",
    applicable: () => OK,
    get: (i) => i.bev.electricityTariffPerKwh,
    set: (i, v) => { const n = clone(i); n.bev.electricityTariffPerKwh = v as number; return n; },
    invalid: nonNegative("Electricity tariff"),
    solverBounds: (i) => tenTimes(10_000)(i.bev.electricityTariffPerKwh),
  },
  biofuelPrice: {
    id: "biofuelPrice", label: "Biofuel price", kind: "numeric", group: "economic", affects: ["biofuel"], unit: "money_per_fuel_unit", higherIs: "worse",
    note: "Price of the fuel as bought, per fuel unit.",
    applicable: () => OK,
    get: (i) => i.biofuel.fuelPricePerFuelUnit,
    set: (i, v) => { const n = clone(i); n.biofuel.fuelPricePerFuelUnit = v as number; return n; },
    invalid: nonNegative("Biofuel price"),
    solverBounds: (i) => tenTimes(10_000)(i.biofuel.fuelPricePerFuelUnit),
  },
  bevAcquisition: {
    id: "bevAcquisition", label: "BEV acquisition price", kind: "numeric", group: "economic", affects: ["bev"], unit: "money", higherIs: "worse",
    note: "Per vehicle. Replacement purchases, a percentage residual value and a percentage subsidy follow it, as in the engine.",
    applicable: () => OK,
    get: (i) => i.bev.upfrontVehicleCost,
    set: (i, v) => { const n = clone(i); n.bev.upfrontVehicleCost = v as number; return n; },
    invalid: nonNegative("BEV acquisition price"),
    solverBounds: (i) => tenTimes(1e10)(i.bev.upfrontVehicleCost),
  },
  biofuelAcquisition: {
    id: "biofuelAcquisition", label: "Biofuel vehicle acquisition or conversion cost", kind: "numeric", group: "economic", affects: ["biofuel"], unit: "money", higherIs: "worse",
    note: "Per vehicle: the purchase price for a new vehicle, or the conversion cost.",
    applicable: () => OK,
    get: (i) => i.biofuel.upfrontVehicleCost,
    set: (i, v) => { const n = clone(i); n.biofuel.upfrontVehicleCost = v as number; return n; },
    invalid: nonNegative("Biofuel vehicle cost"),
    solverBounds: (i) => tenTimes(1e10)(i.biofuel.upfrontVehicleCost),
  },
  annualDistance: {
    id: "annualDistance", label: "Annual distance per vehicle", kind: "numeric", group: "economic", affects: ["bev", "biofuel"], unit: "km_per_year", higherIs: "better",
    note: "Changes annual distance with operating days held fixed, so the daily distance changes in proportion and the operational checks see the same duty.",
    applicable: () => OK,
    get: (i) => i.operations.annualDistanceKmPerVehicle,
    set: (i, v) => setScaledDistance(i, v as number),
    invalid: positive("Annual distance"),
    solverBounds: (i) => ({ lo: 1, hi: i.operations.annualDistanceKmPerVehicle * 10 }),
  },
  operatingDays: {
    id: "operatingDays", label: "Operating days per year", kind: "numeric", group: "economic", affects: ["bev", "biofuel"], unit: "days", higherIs: "better",
    note: "Changes annual distance with the daily distance held fixed, so route compatibility is unchanged.",
    applicable: () => OK,
    get: (i) => i.operations.operatingDaysPerYear,
    set: (i, v) => {
      const n = clone(i);
      n.operations.operatingDaysPerYear = v as number;
      n.operations.annualDistanceKmPerVehicle = n.operations.dailyDistanceKm * (v as number);
      n.operations.fleetAnnualDistanceKm = n.operations.annualDistanceKmPerVehicle * n.fleet.fleetSize;
      return n;
    },
    invalid: (_i, v) => (typeof v !== "number" || !Number.isFinite(v) ? "Operating days must be a number." : v <= 0 || v > 366 ? "Operating days must be above 0 and at most 366." : null),
    solverBounds: () => ({ lo: 1, hi: 366 }),
  },
  bevMaintenance: {
    id: "bevMaintenance", label: "BEV maintenance cost", kind: "numeric", group: "economic", affects: ["bev"], unit: "money_per_year", higherIs: "worse",
    note: "Per vehicle per year.",
    applicable: () => OK,
    get: (i) => i.bev.annualMaintenanceCost,
    set: (i, v) => { const n = clone(i); n.bev.annualMaintenanceCost = v as number; return n; },
    invalid: nonNegative("BEV maintenance cost"),
    solverBounds: (i) => tenTimes(1e9)(i.bev.annualMaintenanceCost),
  },
  biofuelMaintenance: {
    id: "biofuelMaintenance", label: "Biofuel vehicle maintenance cost", kind: "numeric", group: "economic", affects: ["biofuel"], unit: "money_per_year", higherIs: "worse",
    note: "Per vehicle per year.",
    applicable: () => OK,
    get: (i) => i.biofuel.annualMaintenanceCost,
    set: (i, v) => { const n = clone(i); n.biofuel.annualMaintenanceCost = v as number; return n; },
    invalid: nonNegative("Biofuel maintenance cost"),
    solverBounds: (i) => tenTimes(1e9)(i.biofuel.annualMaintenanceCost),
  },
  discountRate: {
    id: "discountRate", label: "Discount rate", kind: "numeric", group: "economic", affects: ["bev", "biofuel"], unit: "percent",
    note: "The effect on NPV need not be one-directional, so it is analysed by sensitivity and not solved as a threshold.",
    applicable: () => OK,
    get: (i) => i.finance.discountRatePct,
    set: (i, v) => { const n = clone(i); n.finance.discountRatePct = v as number; return n; },
    invalid: (_i, v) => (typeof v !== "number" || !Number.isFinite(v) ? "Discount rate must be a number." : v < 0 || v > 100 ? "Discount rate must be between 0% and 100%." : null),
    solverBounds: () => ({ lo: 0, hi: 100 }),
  },
  bevInfraCapex: {
    id: "bevInfraCapex", label: "Charging infrastructure capital cost (project total)", kind: "numeric", group: "economic", affects: ["bev"], unit: "money", higherIs: "worse",
    note: "Equipment, installation and electrical upgrade, as a project total. The fleet pays only its share, as in the engine. Changing the total scales the three items in proportion.",
    applicable: (i) => (i.infrastructure.bevCharging.investmentRequired ? OK : no("No charging infrastructure investment is entered.")),
    get: (i) => (i.infrastructure.bevCharging.investmentRequired ? bevCapex(i) : null),
    set: (i, v) => {
      const n = clone(i);
      const c = n.infrastructure.bevCharging;
      const sum = bevCapex(i);
      if (sum > 0) {
        const f = (v as number) / sum;
        c.equipmentCost = (c.equipmentCost ?? 0) * f;
        c.installationCost = (c.installationCost ?? 0) * f;
        if (c.electricalUpgradeCost !== null) c.electricalUpgradeCost = c.electricalUpgradeCost * f;
      } else {
        c.equipmentCost = v as number;
      }
      return n;
    },
    invalid: nonNegative("Charging infrastructure cost"),
    solverBounds: (i) => tenTimes(1e10)(bevCapex(i)),
  },
  biofuelInfraCapex: {
    id: "biofuelInfraCapex", label: "Biofuel infrastructure capital cost (project total)", kind: "numeric", group: "economic", affects: ["biofuel"], unit: "money", higherIs: "worse",
    note: "Storage, refuelling and installation, as a project total. Changing the total scales the three items in proportion.",
    applicable: (i) => (i.infrastructure.biofuel.investmentRequired === "yes" ? OK : no("No biofuel infrastructure investment is entered.")),
    get: (i) => (i.infrastructure.biofuel.investmentRequired === "yes" ? bioCapex(i) : null),
    set: (i, v) => {
      const n = clone(i);
      const c = n.infrastructure.biofuel;
      const sum = bioCapex(i);
      if (sum > 0) {
        const f = (v as number) / sum;
        c.storageEquipmentCost = (c.storageEquipmentCost ?? 0) * f;
        c.refuellingInfrastructureCost = (c.refuellingInfrastructureCost ?? 0) * f;
        c.installationCost = (c.installationCost ?? 0) * f;
      } else {
        c.storageEquipmentCost = v as number;
      }
      return n;
    },
    invalid: nonNegative("Biofuel infrastructure cost"),
    solverBounds: (i) => tenTimes(1e10)(bioCapex(i)),
  },
  bevSubsidy: {
    id: "bevSubsidy", label: "BEV purchase subsidy (upfront grant per vehicle)", kind: "numeric", group: "economic", affects: ["bev"], unit: "money", higherIs: "better",
    note: "A Year-0 grant per vehicle. It cannot exceed the vehicle's purchase cost.",
    applicable: (i) => incentiveApplicable(i, "bev"),
    get: (i) => (i.finance.incentives.bev.type === "upfront_grant" ? i.finance.incentives.bev.amount ?? 0 : 0),
    set: (i, v) => setGrant(i, "bev", v as number),
    invalid: (i, v) => (typeof v !== "number" || !Number.isFinite(v) ? "Subsidy must be a number." : v < 0 ? "Subsidy cannot be negative." : v > grantCap("bev")(i) ? "Subsidy cannot exceed the vehicle purchase cost." : null),
    solverBounds: (i) => ({ lo: 0, hi: grantCap("bev")(i) }),
  },
  biofuelSubsidy: {
    id: "biofuelSubsidy", label: "Biofuel purchase subsidy (upfront grant per vehicle)", kind: "numeric", group: "economic", affects: ["biofuel"], unit: "money", higherIs: "better",
    note: "A Year-0 grant per vehicle. It cannot exceed the vehicle's purchase or conversion cost.",
    applicable: (i) => incentiveApplicable(i, "biofuel"),
    get: (i) => (i.finance.incentives.biofuel.type === "upfront_grant" ? i.finance.incentives.biofuel.amount ?? 0 : 0),
    set: (i, v) => setGrant(i, "biofuel", v as number),
    invalid: (i, v) => (typeof v !== "number" || !Number.isFinite(v) ? "Subsidy must be a number." : v < 0 ? "Subsidy cannot be negative." : v > grantCap("biofuel")(i) ? "Subsidy cannot exceed the vehicle purchase cost." : null),
    solverBounds: (i) => ({ lo: 0, hi: grantCap("biofuel")(i) }),
  },
  bevRange: {
    id: "bevRange", label: "BEV usable range", kind: "numeric", group: "operational", affects: ["bev"], unit: "km", higherIs: "better",
    note: "Operational only. It does not enter the cost figures.",
    applicable: () => OK,
    get: (i) => i.bev.usableRangeKm,
    set: (i, v) => { const n = clone(i); n.bev.usableRangeKm = v as number; return n; },
    invalid: positive("Usable range"),
    solverBounds: (i) => ({ lo: 1, hi: Math.max(i.bev.usableRangeKm * 10, i.operations.dailyDistanceKm * 10, 1000) }),
  },
  bevChargingDowntime: {
    id: "bevChargingDowntime", label: "BEV charging downtime (hours per day)", kind: "numeric", group: "operational", affects: ["bev"], unit: "hours_per_day",
    note: "Operational indicator only. It is not priced and does not change the status.",
    applicable: () => OK,
    get: (i) => i.bev.operational.chargingDowntimeHoursPerDay,
    set: (i, v) => { const n = clone(i); n.bev.operational.chargingDowntimeHoursPerDay = v as number; return n; },
    invalid: (_i, v) => (typeof v !== "number" || !Number.isFinite(v) ? "Charging downtime must be a number." : v < 0 || v > 24 ? "Charging downtime must be between 0 and 24 hours." : null),
    solverBounds: () => ({ lo: 0, hi: 24 }),
  },
  bevPayloadReduction: {
    id: "bevPayloadReduction", label: "BEV payload reduction", kind: "numeric", group: "operational", affects: ["bev"], unit: "kg",
    note: "Used in kilograms when entered in kilograms, otherwise as a percentage.",
    applicable: (i) => {
      const o = i.bev.operational;
      return o.payloadImpact === "reduced" && (isNum(o.payloadReductionKg) || isNum(o.payloadReductionPct)) ? OK : no("No numeric payload reduction is entered.");
    },
    get: (i) => (isNum(i.bev.operational.payloadReductionKg) ? i.bev.operational.payloadReductionKg : i.bev.operational.payloadReductionPct),
    set: (i, v) => {
      const n = clone(i);
      if (isNum(n.bev.operational.payloadReductionKg)) n.bev.operational.payloadReductionKg = v as number;
      else n.bev.operational.payloadReductionPct = v as number;
      return n;
    },
    invalid: (i, v) => {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return "Payload reduction must be zero or more.";
      return !isNum(i.bev.operational.payloadReductionKg) && v > 100 ? "A percentage payload reduction cannot exceed 100%." : null;
    },
    solverBounds: (i) => (isNum(i.bev.operational.payloadReductionKg) ? { lo: 0, hi: Math.max(i.fleet.payloadCapacityKg ?? 0, 1) } : { lo: 0, hi: 100 }),
  },
  bevChargingOpportunity: {
    id: "bevChargingOpportunity", label: "BEV charging opportunity", kind: "categorical", group: "operational", affects: ["bev"], unit: "days",
    options: [{ id: "depot_only", label: "Depot only" }, { id: "public_available", label: "Public charging available" }, { id: "destination_available", label: "Destination charging available" }, { id: "mixed", label: "Mixed" }, { id: "unknown", label: "Unknown" }],
    note: "Categorical. Used in scenarios, not in sensitivity or threshold solving.",
    applicable: () => OK,
    get: (i) => i.bev.operational.chargingOpportunity,
    set: (i, v) => { const n = clone(i); n.bev.operational.chargingOpportunity = v as string; return n; },
    invalid: (_i, v) => (typeof v === "string" && ["depot_only", "public_available", "destination_available", "mixed", "unknown"].includes(v) ? null : "Choose a listed charging opportunity."),
    solverBounds: () => ({ lo: 0, hi: 0 }),
  },
  biofuelAvailability: {
    id: "biofuelAvailability", label: "Biofuel availability", kind: "categorical", group: "operational", affects: ["biofuel"], unit: "days",
    options: [{ id: "reliable", label: "Reliable" }, { id: "intermittent", label: "Intermittent" }, { id: "limited", label: "Limited" }, { id: "unknown", label: "Unknown" }],
    note: "Categorical. Used in scenarios only. It is never treated as a number.",
    applicable: () => OK,
    get: (i) => i.biofuel.supply.availability,
    set: (i, v) => { const n = clone(i); n.biofuel.supply.availability = v as string; return n; },
    invalid: (_i, v) => (typeof v === "string" && ["reliable", "intermittent", "limited", "unknown"].includes(v) ? null : "Choose a listed availability."),
    solverBounds: () => ({ lo: 0, hi: 0 }),
  },
};

export const VARIABLE_IDS = Object.keys(VARIABLES) as VariableId[];
export const NUMERIC_VARIABLE_IDS = VARIABLE_IDS.filter((id) => VARIABLES[id].kind === "numeric");

/** Numeric variables that can be varied for a technology and used for NPV (sensitivity and drivers). */
export function numericVariablesFor(input: NormalizedAssessmentInput, tech: GreenTechId): VariableDef[] {
  return NUMERIC_VARIABLE_IDS.map((id) => VARIABLES[id]).filter((v) => v.affects.includes(tech) && v.applicable(input).ok);
}

/** Variables the threshold solver may search (economic, one-directional in practice). Discount rate is deliberately excluded. */
export const THRESHOLD_VARIABLES: Record<GreenTechId, readonly VariableId[]> = {
  bev: ["bevAcquisition", "electricityTariff", "dieselPrice", "annualDistance", "bevSubsidy", "bevInfraCapex", "bevMaintenance"],
  biofuel: ["biofuelAcquisition", "biofuelPrice", "dieselPrice", "annualDistance", "biofuelSubsidy", "biofuelInfraCapex", "biofuelMaintenance"],
};

/** Applies named overrides to a copy of the input. Reports every problem instead of stopping at the first. */
export function applyOverrides(input: NormalizedAssessmentInput, overrides: Partial<Record<VariableId, number | string>>): { ok: true; input: NormalizedAssessmentInput } | { ok: false; errors: { variableId: string; message: string }[] } {
  const errors: { variableId: string; message: string }[] = [];
  let next = input;
  for (const [id, value] of Object.entries(overrides)) {
    const def = (VARIABLES as Record<string, VariableDef | undefined>)[id];
    if (!def) { errors.push({ variableId: id, message: `"${id}" is not an assumption that can be changed.` }); continue; }
    const app = def.applicable(next);
    if (!app.ok) { errors.push({ variableId: id, message: `${def.label}: ${app.reason}` }); continue; }
    if (value === undefined || value === null) { errors.push({ variableId: id, message: `${def.label}: a value is required.` }); continue; }
    const bad = def.invalid(next, value);
    if (bad) { errors.push({ variableId: id, message: bad }); continue; }
    next = def.set(next, value);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, input: next === input ? structuredClone(input) : next };
}
