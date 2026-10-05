import { convertUnit, type UnitId } from "@/lib/units";
import { cleanFloat } from "@/lib/format";
import { biofuelFuelUnit } from "./schema/fields";
import { FUEL_UNITS } from "@/lib/fuel";
import { createReader } from "./reader";
import type { Reader } from "./schema/types";
import type { Assessment } from "./stored";

/**
 * Input-normalisation helpers: unit conversions and simple multiplications of the user's own
 * numbers. These are not commercial calculations (no cost, no NPV, no payback).
 */

const num = (r: Reader, id: string): number | null => {
  const f = r.number(id);
  return f.status === "value" ? f.value : null;
};

export interface DerivedOperations {
  mode: "daily" | "annual";
  dailyDistanceKm: number | null;
  annualDistanceKm: number | null;
  fleetAnnualDistanceKm: number | null;
  /** Human-readable working, shown next to the numbers so nothing is a black box. */
  formula: string | null;
}

export function deriveOperations(a: Assessment, reader: Reader = createReader(a)): DerivedOperations {
  const mode = reader.choice("ops.distanceMode") === "annual" ? "annual" : "daily";
  const days = num(reader, "ops.operatingDays");
  const fleet = num(reader, "fleet.size");
  let daily: number | null = null;
  let annual: number | null = null;
  let formula: string | null = null;

  if (mode === "daily") {
    daily = num(reader, "ops.dailyDistance");
    if (daily !== null && days !== null) {
      annual = cleanFloat(daily * days);
      formula = `${daily} km/day × ${days} days/year = ${annual} km/year`;
    }
  } else {
    annual = num(reader, "ops.annualDistance");
    if (annual !== null && days !== null && days > 0) {
      daily = cleanFloat(annual / days);
      formula = `${annual} km/year ÷ ${days} days/year = ${daily} km/day`;
    }
  }
  const fleetAnnual = annual !== null && fleet !== null ? cleanFloat(annual * fleet) : null;
  return { mode, dailyDistanceKm: daily, annualDistanceKm: annual, fleetAnnualDistanceKm: fleetAnnual, formula };
}

/** Internal unit for each input that offers a choice of units. */
const CANONICAL_UNIT: Record<string, UnitId | ((r: Reader) => UnitId)> = {
  "diesel.fuelEfficiency": "litres_per_100km",
  "bev.energyConsumption": "kwh_per_100km",
  "biofuel.fuelEfficiency": (r) => FUEL_UNITS[biofuelFuelUnit(r)].fuelPer100Km,
  "fleet.payloadCapacity": "kg",
  "fleet.averagePayload": "kg",
};

export interface CanonicalValue {
  value: number;
  unit: UnitId;
  /** True when the user entered a different unit, so a conversion took place. */
  converted: boolean;
}

/** The user's entry expressed in the internal unit, or null when it is not a convertible quantity or not entered. */
export function toCanonical(reader: Reader, id: string): CanonicalValue | null {
  const target = CANONICAL_UNIT[id];
  if (!target) return null;
  const { value } = reader.q(id);
  if (value.status !== "value") return null;
  const from = reader.unitOf(id);
  const to = typeof target === "function" ? target(reader) : target;
  try {
    return { value: cleanFloat(convertUnit(value.value, from, to)), unit: to, converted: from !== to };
  } catch {
    return null;
  }
}
