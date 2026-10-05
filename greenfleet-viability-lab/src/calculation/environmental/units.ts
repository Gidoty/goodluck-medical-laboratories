import type { PhysicalUnit } from "./types";

/**
 * Emission-factor units the engine understands: mass of gas per physical quantity.
 * Built from three small tables so every combination is explicit and tested, and a factor can only
 * ever be applied to a quantity measured in the same physical unit.
 */
const MASS_KG: Record<string, number> = { kg: 1, g: 0.001 };
const GAS: Record<string, "CO2e" | "CO2"> = { co2e: "CO2e", co2: "CO2" };
const PER: Record<string, PhysicalUnit> = { litre: "litre", kg: "kg", m3: "m3", kwh: "kWh" };
const PER_LABEL: Record<PhysicalUnit, string> = { litre: "litre", kg: "kg", m3: "m³", kWh: "kWh" };

export interface ParsedFactorUnit {
  id: string;
  label: string;
  kgPerEnteredMass: number;
  gas: "CO2e" | "CO2";
  perUnit: PhysicalUnit;
}

const TABLE: ParsedFactorUnit[] = [];
for (const [m, kg] of Object.entries(MASS_KG)) {
  for (const [g, gas] of Object.entries(GAS)) {
    for (const [p, per] of Object.entries(PER)) {
      TABLE.push({ id: `${m}${g}_per_${p}`, label: `${m} ${gas}/${PER_LABEL[per]}`, kgPerEnteredMass: kg, gas, perUnit: per });
    }
  }
}

export function parseFactorUnit(unitId: string | undefined, label?: string): ParsedFactorUnit | null {
  const byId = TABLE.find((t) => t.id === unitId);
  if (byId) return byId;
  const norm = (x: string) => x.replace(/\s+/g, "").toLowerCase();
  return (label ? TABLE.find((t) => norm(t.label) === norm(label)) : undefined) ?? null;
}

export const FACTOR_UNIT_IDS: readonly string[] = TABLE.map((t) => t.id);
