import { discountFactor, cycleStarts, replacementYears, snapToInteger, sum } from "./finance";
import { COST_CATEGORIES, type CostVector, type EnergyUse, type TechId, type TechnologyEconomics, type YearlyCosts } from "./types";

/** Time structure shared by every technology in one calculation. */
export interface Context {
  horizon: number; // T
  rate: number; // discount rate as a decimal
  fleetSize: number;
  /** 0..T */
  years: number[];
  /** Distance each vehicle drives in operating year t (index 0 = Year 0 = 0). Constant utilisation for now. */
  perVehicleDistanceKm: number[];
  fleetDistanceKm: number[];
  fleetHorizonDistanceKm: number;
}

export function buildContext(horizon: number, rate: number, fleetSize: number, annualDistancePerVehicle: number): Context {
  const years = Array.from({ length: horizon + 1 }, (_, t) => t);
  const perVehicle = years.map((t) => (t === 0 ? 0 : annualDistancePerVehicle));
  const fleet = perVehicle.map((d) => d * fleetSize);
  return { horizon, rate, fleetSize, years, perVehicleDistanceKm: perVehicle, fleetDistanceKm: fleet, fleetHorizonDistanceKm: sum(fleet) };
}

/**
 * Everything the generic cost model needs to know about one technology. The builders in specs.ts
 * turn the normalized input into this; assembleEconomics() knows nothing about diesel, BEV or biofuel.
 * All amounts are fleet totals unless the name says per vehicle / per km.
 */
export interface TechSpec {
  id: TechId;
  label: string;
  acquisitionLabel: string;
  energy: EnergyUse;
  /** Energy cost in each year, index 0..T (0 at Year 0). Prices and escalation are already applied. */
  energyCostByYear: number[];
  usefulLifeYears: number;
  initialVehicleCapex: number;
  /** Cost of one replacement event for the whole fleet. */
  replacementCapexPerEvent: number;
  upfrontIncentives: number;
  initialInfrastructureCapex: number;
  infrastructureOpexPerYear: number;
  maintenancePerVehicleYear: number;
  insurancePerVehicleYear: number;
  licensingPerVehicleYear: number;
  otherFixedPerVehicleYear: number;
  otherVariablePerKm: number;
  /** Battery replacement, measured from the start of each vehicle cycle. Null when none is modelled. */
  batteryReplacement: { yearsFromCycleStart: number; costFleet: number } | null;
  residualTotal: number;
}

export const zeroVector = (): CostVector => Object.fromEntries(COST_CATEGORIES.map((c) => [c.id, 0])) as CostVector;

const OPERATING = COST_CATEGORIES.filter((c) => c.kind === "operating").map((c) => c.id);

function countByYear(years: number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const y of years) m.set(y, (m.get(y) ?? 0) + 1);
  return m;
}

/** Years (with repeats) in which the battery is replaced, across every vehicle cycle inside the horizon. */
export function batteryReplacementYears(horizon: number, life: number, yearsFromCycleStart: number): number[] {
  const starts = cycleStarts(horizon, life);
  const out: number[] = [];
  starts.forEach((start, i) => {
    const time = snapToInteger(start + yearsFromCycleStart);
    const nextStart = starts[i + 1];
    if (time > horizon + 1e-9) return;
    if (nextStart !== undefined && time >= nextStart - 1e-9) return; // the vehicle is replaced first
    out.push(Math.ceil(time - 1e-9));
  });
  return out;
}

export function assembleEconomics(ctx: Context, spec: TechSpec): TechnologyEconomics {
  const T = ctx.horizon;
  const N = ctx.fleetSize;
  const vehicleReplacementYears = replacementYears(T, spec.usefulLifeYears);
  const replacements = countByYear(vehicleReplacementYears);
  const batteryYears = spec.batteryReplacement ? batteryReplacementYears(T, spec.usefulLifeYears, spec.batteryReplacement.yearsFromCycleStart) : [];
  const batteries = countByYear(batteryYears);

  const series: YearlyCosts[] = ctx.years.map((t) => {
    const c = zeroVector();
    if (t === 0) {
      c.vehicleAcquisition = spec.initialVehicleCapex;
      c.infrastructureCapex = spec.initialInfrastructureCapex;
      c.incentiveOffsets = -spec.upfrontIncentives;
    } else {
      c.energy = spec.energyCostByYear[t]!;
      c.maintenance = spec.maintenancePerVehicleYear * N;
      c.insurance = spec.insurancePerVehicleYear * N;
      c.licensing = spec.licensingPerVehicleYear * N;
      c.otherFixed = spec.otherFixedPerVehicleYear * N;
      c.otherVariable = spec.otherVariablePerKm * ctx.fleetDistanceKm[t]!;
      c.infrastructureOpex = spec.infrastructureOpexPerYear;
      c.vehicleReplacement = (replacements.get(t) ?? 0) * spec.replacementCapexPerEvent;
      c.batteryReplacement = spec.batteryReplacement ? (batteries.get(t) ?? 0) * spec.batteryReplacement.costFleet : 0;
      if (t === T) c.residualOffset = -spec.residualTotal;
    }
    const operatingCost = sum(OPERATING.map((id) => c[id]));
    const netCashCost = sum(COST_CATEGORIES.map((cat) => c[cat.id]));
    return { year: t, components: c, operatingCost, netCashCost, fleetDistanceKm: ctx.fleetDistanceKm[t]! };
  });

  const undiscounted = zeroVector();
  const present = zeroVector();
  for (const row of series) {
    const df = discountFactor(ctx.rate, row.year);
    for (const cat of COST_CATEGORIES) {
      undiscounted[cat.id] += row.components[cat.id];
      present[cat.id] += row.components[cat.id] * df;
    }
  }
  const undiscountedTco = sum(series.map((r) => r.netCashCost));
  const presentCost = sum(series.map((r) => r.netCashCost * discountFactor(ctx.rate, r.year)));

  return {
    technology: spec.id,
    label: spec.label,
    vehicleAcquisitionLabel: spec.acquisitionLabel,
    energy: spec.energy,
    series,
    grossInitialCapex: spec.initialVehicleCapex + spec.initialInfrastructureCapex,
    upfrontIncentives: spec.upfrontIncentives,
    initialCapitalRequirement: series[0]!.netCashCost,
    residualValue: spec.residualTotal,
    replacementYears: vehicleReplacementYears,
    batteryReplacementYears: batteryYears,
    year1OperatingCost: series[1]!.operatingCost,
    year1EnergyCost: series[1]!.components.energy,
    undiscountedTco,
    presentCost,
    fleetHorizonDistanceKm: ctx.fleetHorizonDistanceKm,
    tcoPerKm: undiscountedTco / ctx.fleetHorizonDistanceKm,
    presentCostPerKm: presentCost / ctx.fleetHorizonDistanceKm,
    breakdown: { undiscounted, present },
  };
}

