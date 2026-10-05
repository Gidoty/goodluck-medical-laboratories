import type { CurrencyCode } from "./currency";
import { CURRENCIES } from "./currency";

/**
 * Explicit unit system.
 *
 * Canonical internal units (what calculation code will receive):
 *   money            -> the assessment currency, whole units (no thousands/millions scaling)
 *   distance         -> km
 *   volume           -> litres
 *   energy           -> kWh
 *   mass             -> kg
 *   time             -> years (or days/year, km/year for rates)
 *   ratio            -> percent in the range 0..100 (never a 0..1 fraction)
 *   fuel economy     -> litres per 100 km
 *   electric economy -> kWh per 100 km
 *   emissions        -> kg CO2e
 *
 * Display units (km/litre, kWh/km, tonnes, tCO2e/year) are reached through `convertUnit`.
 */
export type UnitId =
  | "money"
  | "money_per_litre"
  | "money_per_kwh"
  | "money_per_km"
  | "money_per_year"
  | "km"
  | "km_per_day"
  | "km_per_year"
  | "days_per_year"
  | "hours_per_day"
  | "litres_per_100km"
  | "km_per_litre"
  | "kwh_per_100km"
  | "kwh_per_km"
  | "kwh"
  | "kw"
  | "kg"
  | "tonnes"
  | "years"
  | "percent"
  | "vehicles"
  | "kgco2e"
  | "kgco2e_per_km"
  | "kgco2e_per_litre"
  | "kgco2e_per_kwh"
  | "tco2e_per_year";

export type Dimension =
  | "money"
  | "money_per_volume"
  | "money_per_energy"
  | "money_per_distance"
  | "money_per_time"
  | "distance"
  | "distance_per_day"
  | "distance_per_year"
  | "days_per_year"
  | "hours_per_day"
  | "fuel_economy"
  | "electric_economy"
  | "energy"
  | "power"
  | "mass"
  | "time"
  | "ratio"
  | "count"
  | "emissions_mass"
  | "emissions_per_distance"
  | "emissions_per_volume"
  | "emissions_per_energy"
  | "emissions_per_year";

export interface UnitDefinition {
  /** "{cur}" is replaced with the currency symbol. */
  label: string;
  dimension: Dimension;
}

export const UNITS: Record<UnitId, UnitDefinition> = {
  money: { label: "{cur}", dimension: "money" },
  money_per_litre: { label: "{cur}/litre", dimension: "money_per_volume" },
  money_per_kwh: { label: "{cur}/kWh", dimension: "money_per_energy" },
  money_per_km: { label: "{cur}/km", dimension: "money_per_distance" },
  money_per_year: { label: "{cur}/year", dimension: "money_per_time" },
  km: { label: "km", dimension: "distance" },
  km_per_day: { label: "km/day", dimension: "distance_per_day" },
  km_per_year: { label: "km/year", dimension: "distance_per_year" },
  days_per_year: { label: "days/year", dimension: "days_per_year" },
  hours_per_day: { label: "hours/day", dimension: "hours_per_day" },
  litres_per_100km: { label: "litres/100 km", dimension: "fuel_economy" },
  km_per_litre: { label: "km/litre", dimension: "fuel_economy" },
  kwh_per_100km: { label: "kWh/100 km", dimension: "electric_economy" },
  kwh_per_km: { label: "kWh/km", dimension: "electric_economy" },
  kwh: { label: "kWh", dimension: "energy" },
  kw: { label: "kW", dimension: "power" },
  kg: { label: "kg", dimension: "mass" },
  tonnes: { label: "tonnes", dimension: "mass" },
  years: { label: "years", dimension: "time" },
  percent: { label: "%", dimension: "ratio" },
  vehicles: { label: "vehicles", dimension: "count" },
  kgco2e: { label: "kg CO2e", dimension: "emissions_mass" },
  kgco2e_per_km: { label: "kg CO2e/km", dimension: "emissions_per_distance" },
  kgco2e_per_litre: { label: "kg CO2e/litre", dimension: "emissions_per_volume" },
  kgco2e_per_kwh: { label: "kg CO2e/kWh", dimension: "emissions_per_energy" },
  tco2e_per_year: { label: "tCO2e/year", dimension: "emissions_per_year" },
};

export function unitLabel(unit: UnitId, currency: CurrencyCode): string {
  return UNITS[unit].label.replace("{cur}", CURRENCIES[currency].symbol);
}

export class UnitConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnitConversionError";
  }
}

/** Linear conversions: value_in_target = value * factor. */
const LINEAR: Partial<Record<UnitId, Partial<Record<UnitId, number>>>> = {
  kg: { tonnes: 1 / 1000 },
  tonnes: { kg: 1000 },
  kwh_per_km: { kwh_per_100km: 100 },
  kwh_per_100km: { kwh_per_km: 1 / 100 },
};

/** Reciprocal pair: x litres/100 km <-> 100/x km/litre. Zero has no reciprocal. */
const RECIPROCAL: ReadonlyArray<readonly [UnitId, UnitId]> = [["litres_per_100km", "km_per_litre"]];

export function convertUnit(value: number, from: UnitId, to: UnitId): number {
  if (!Number.isFinite(value)) throw new UnitConversionError("Cannot convert a non-finite value.");
  if (from === to) return value;
  const factor = LINEAR[from]?.[to];
  if (factor !== undefined) return value * factor;
  if (RECIPROCAL.some(([a, b]) => (a === from && b === to) || (a === to && b === from))) {
    if (value === 0) throw new UnitConversionError("Zero fuel economy has no reciprocal.");
    return 100 / value;
  }
  throw new UnitConversionError(`Cannot convert ${UNITS[from].label} to ${UNITS[to].label}: incompatible units.`);
}
