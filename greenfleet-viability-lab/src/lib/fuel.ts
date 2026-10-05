import type { UnitId } from "./units";

/**
 * A fuel is bought and burned in one of three physical units. Liquid pathways use litres;
 * gaseous pathways (for example biomethane) can use kilograms or cubic metres.
 * Everything that depends on the fuel unit is looked up here, never hard-coded to litres.
 */
export type FuelUnit = "litre" | "kg" | "m3";

export interface FuelUnitInfo {
  id: FuelUnit;
  label: string;
  /** Distance per fuel unit, e.g. km/litre. */
  distancePerFuel: UnitId;
  /** Fuel per 100 km, e.g. litres/100 km. This is the canonical internal form. */
  fuelPer100Km: UnitId;
  price: UnitId;
  emissionFactor: UnitId;
}

export const FUEL_UNITS: Record<FuelUnit, FuelUnitInfo> = {
  litre: { id: "litre", label: "litre", distancePerFuel: "km_per_litre", fuelPer100Km: "litres_per_100km", price: "money_per_litre", emissionFactor: "kgco2e_per_litre" },
  kg: { id: "kg", label: "kilogram", distancePerFuel: "km_per_kg", fuelPer100Km: "kg_per_100km", price: "money_per_kg", emissionFactor: "kgco2e_per_kg" },
  m3: { id: "m3", label: "cubic metre", distancePerFuel: "km_per_m3", fuelPer100Km: "m3_per_100km", price: "money_per_m3", emissionFactor: "kgco2e_per_m3" },
};
