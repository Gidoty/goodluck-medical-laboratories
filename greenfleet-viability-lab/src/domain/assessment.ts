import type { CurrencyCode } from "@/lib/currency";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import { missing, type NumericField } from "./fieldValue";
import type { Assessment } from "./types";

/** Every path (as a tuple of keys) that ends in a NumericField. Checked by the compiler. */
type PathsTo<T, Leaf> = [T] extends [Leaf]
  ? []
  : T extends string | number | boolean | null | undefined
    ? never
    : T extends object
      ? { [K in keyof T & string]: [K, ...PathsTo<T[K], Leaf>] }[keyof T & string]
      : never;

export type NumericPath = PathsTo<Assessment, NumericField>;
export type TextPath = ["name"] | ["scenarioName"] | ["business", "businessName"] | ["business", "operatingRegion"];

export const pathId = (path: readonly string[]): string => path.join(".");

export function createBlankAssessment(id: string, nowIso: string): Assessment {
  const m = (): NumericField => missing();
  const vehicle = {
    acquisitionCost: m(),
    lifetimeYears: m(),
    residualValuePct: m(),
    maintenanceCostPerKm: m(),
    annualFixedCosts: m(),
    ratedPayloadKg: m(),
  };
  return {
    id,
    name: "Untitled assessment",
    currency: DEFAULT_CURRENCY,
    scenarioName: "Base scenario",
    origin: "blank",
    createdAt: nowIso,
    updatedAt: nowIso,
    business: { businessName: "", operatingRegion: "", fleetSize: m() },
    operations: { dailyDistanceKm: m(), operatingDaysPerYear: m(), analysisHorizonYears: m(), loadFactorPct: m() },
    energy: {
      dieselPricePerLitre: m(),
      electricityPricePerKwh: m(),
      biofuelPricePerLitre: m(),
      dieselPriceEscalationPct: m(),
      electricityPriceEscalationPct: m(),
      biofuelPriceEscalationPct: m(),
    },
    technologies: {
      diesel: { technology: "diesel", ...vehicle, fuelConsumptionLPer100Km: m() },
      electric: {
        technology: "electric",
        ...vehicle,
        energyConsumptionKwhPer100Km: m(),
        batteryCapacityKwh: m(),
        usableBatteryPct: m(),
        chargingLossPct: m(),
        batteryReplacementCost: m(),
      },
      biofuel: {
        technology: "biofuel",
        ...vehicle,
        fuelConsumptionLPer100Km: m(),
        blendSharePct: m(),
        approvedMaxBlendPct: m(),
      },
    },
    infrastructure: {
      chargingInfrastructureCost: m(),
      vehiclesSharingChargers: m(),
      chargerPowerKw: m(),
      chargingHoursPerDay: m(),
      fuelStorageAndBlendingCost: m(),
    },
    financing: { financedSharePct: m(), interestRatePct: m(), loanTermYears: m(), discountRatePct: m() },
    environment: {
      dieselEmissionFactorKgCo2ePerLitre: m(),
      biofuelEmissionFactorKgCo2ePerLitre: m(),
      gridEmissionFactorKgCo2ePerKwh: m(),
    },
  };
}

function readPath(root: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], root);
}

function writePath<T>(node: T, path: readonly string[], leaf: unknown): T {
  const [head, ...rest] = path;
  if (head === undefined) return leaf as T;
  const record = node as Record<string, unknown>;
  return { ...record, [head]: writePath(record[head], rest, leaf) } as T;
}

export const getNumeric = (a: Assessment, path: NumericPath): NumericField => readPath(a, path) as NumericField;
export const getText = (a: Assessment, path: TextPath): string => readPath(a, path) as string;

export function setNumeric(a: Assessment, path: NumericPath, field: NumericField, nowIso: string): Assessment {
  return { ...writePath(a, path, field), origin: "user", updatedAt: nowIso };
}

export function setText(a: Assessment, path: TextPath, text: string, nowIso: string): Assessment {
  return { ...writePath(a, path, text), origin: a.origin === "blank" ? "blank" : "user", updatedAt: nowIso };
}

export function setCurrency(a: Assessment, currency: CurrencyCode, nowIso: string): Assessment {
  return { ...a, currency, updatedAt: nowIso };
}

/**
 * Overlays a persisted/untrusted object on a blank assessment so fields added in later versions
 * always exist. Leaves that are not valid FieldValues fall back to the blank value.
 */
export function mergeOntoBlank(blank: Assessment, saved: unknown): Assessment {
  const walk = (base: unknown, incoming: unknown): unknown => {
    if (isFieldValue(base)) return isFieldValue(incoming) ? incoming : base;
    if (base !== null && typeof base === "object") {
      const inc = incoming !== null && typeof incoming === "object" ? (incoming as Record<string, unknown>) : {};
      return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, walk(v, inc[k])]));
    }
    return typeof incoming === typeof base ? incoming : base;
  };
  return walk(blank, saved) as Assessment;
}

function isFieldValue(x: unknown): x is NumericField {
  if (x === null || typeof x !== "object") return false;
  const status = (x as { status?: unknown }).status;
  if (status === "missing" || status === "not_applicable") return true;
  return status === "value" && typeof (x as { value?: unknown }).value === "number" && Number.isFinite((x as { value: number }).value);
}
