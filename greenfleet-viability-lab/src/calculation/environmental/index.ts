import type { EmissionFactorInput, NormalizedAssessmentInput } from "@/domain/normalized";
import { fmtNum } from "../collector";
import type { AssumptionRecord, CalcWarning, TechId, WarningScope } from "../types";
import { parseFactorUnit } from "./units";
import {
  SCOPE_LABEL,
  type EmissionDirection,
  type EmissionScope,
  type EmissionsComparison,
  type EnvironmentalPerformanceResult,
  type FactorUsed,
  type PhysicalUnit,
  type PhysicalUse,
  type TechnologyEmissions,
} from "./types";

export * from "./types";
export { parseFactorUnit, FACTOR_UNIT_IDS } from "./units";

export const SCOPE_STATEMENT =
  "Estimated operational energy/fuel-related greenhouse-gas emissions, as CO2-equivalent where the factors are supplied on that basis. This is not a life-cycle assessment.";

const TECH_NAME: Record<TechId, string> = { diesel: "Diesel", bev: "Battery-electric", biofuel: "Biofuel" };
const FACTOR_NAME: Record<TechId, string> = { diesel: "Diesel", bev: "Grid electricity", biofuel: "Biofuel" };

const warning = (code: string, scope: WarningScope, message: string, severity: CalcWarning["severity"] = "warning"): CalcWarning => ({ code, scope, message, severity, domain: "environmental" });

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/* ---------------------------------- factors ---------------------------------- */

type Resolved = { ok: true; factor: FactorUsed; warnings: CalcWarning[] } | { ok: false; reason: string; warnings: CalcWarning[] };

/**
 * A factor is accepted only if it is a real non-negative number whose unit is "mass of gas per <the
 * exact physical unit the quantity is measured in>". Anything else makes that technology
 * unavailable. It never becomes a zero.
 */
function resolveFactor(tech: TechId, raw: EmissionFactorInput | undefined, expected: PhysicalUnit): Resolved {
  const name = FACTOR_NAME[tech];
  const fail = (code: string, reason: string): Resolved => ({ ok: false, reason, warnings: [warning(code, tech, reason)] });

  if (!raw || raw.value === null || raw.value === undefined) return fail("EMISSION_FACTOR_MISSING", `${name} emission factor was not supplied.`);
  if (!isNum(raw.value) || raw.value < 0) return fail("EMISSION_FACTOR_INVALID", `The ${name.toLowerCase()} emission factor is not a valid non-negative number.`);

  const unit = parseFactorUnit(raw.unitId, raw.unit);
  if (!unit) return fail("EMISSION_FACTOR_UNIT_UNKNOWN", `The ${name.toLowerCase()} emission-factor unit is not recognised.`);
  if (unit.perUnit !== expected) {
    const message =
      tech === "biofuel"
        ? "Biofuel emission-factor unit is incompatible with the configured fuel-consumption unit."
        : tech === "diesel"
          ? "Diesel emission-factor unit is incompatible with litres of diesel."
          : "Grid emission-factor unit is incompatible with kWh of electricity.";
    return fail("EMISSION_FACTOR_UNIT_INCOMPATIBLE", message);
  }

  const warnings: CalcWarning[] = [];
  const source = raw.source?.trim() ? raw.source.trim() : null;
  if (!source) warnings.push(warning("EMISSION_FACTOR_NO_PROVENANCE", tech, "Emission factor supplied without source provenance."));
  if (unit.gas === "CO2") warnings.push(warning("EMISSION_FACTOR_CO2_ONLY", tech, `The ${name.toLowerCase()} factor is expressed as CO2, not CO2e, so other greenhouse gases are not included.`));
  if (isNum(raw.lifecycleAdjustmentPct)) {
    warnings.push(warning("LIFECYCLE_ADJUSTMENT_NOT_APPLIED", tech, `A lifecycle adjustment was entered for ${name.toLowerCase()} but is not applied: how it should be used is not defined yet. The emissions shown use the factor exactly as entered.`));
  }
  const scope: EmissionScope = raw.scope ?? "not_stated";
  const factor: FactorUsed = {
    enteredValue: raw.value,
    enteredUnit: unit.label,
    kgPerUnit: raw.value * unit.kgPerEnteredMass,
    perUnit: unit.perUnit,
    gas: unit.gas,
    source,
    sourceYear: isNum(raw.sourceYear) ? raw.sourceYear : null,
    notes: raw.notes?.trim() ? raw.notes.trim() : null,
    origin: "user_supplied",
    hasProvenance: source !== null,
    scope,
    scopeLabel: SCOPE_LABEL[scope],
    lifecycleAdjustmentPct: isNum(raw.lifecycleAdjustmentPct) ? raw.lifecycleAdjustmentPct : null,
    lifecycleAdjustmentApplied: false,
  };
  return { ok: true, factor, warnings };
}

/* ------------------------------ physical quantities ------------------------------ */

/** Fleet distance in each year, index 0..T. Annual utilisation is constant for now; the array lets later versions vary it. */
function fleetDistanceByYear(input: NormalizedAssessmentInput): number[] | null {
  const T = input.operations?.analysisHorizonYears;
  const N = input.fleet?.fleetSize;
  const d = input.operations?.annualDistanceKmPerVehicle;
  if (!isNum(T) || !Number.isInteger(T) || T < 1 || !isNum(N) || N < 1 || !isNum(d) || d <= 0) return null;
  return Array.from({ length: T + 1 }, (_, t) => (t === 0 ? 0 : d * N));
}

function physicalUse(unit: PhysicalUnit, perKm: number, distance: number[]): PhysicalUse {
  const byYear = distance.map((km) => km * perKm);
  return { unit, byYear, annualQuantity: byYear[1] ?? 0 };
}

/* ------------------------------ one technology ------------------------------ */

function technologyEmissions(tech: TechId, use: PhysicalUse, raw: EmissionFactorInput | undefined, distance: number[]): TechnologyEmissions {
  const resolved = resolveFactor(tech, raw, use.unit);
  if (!resolved.ok) {
    return {
      technology: tech, status: "unavailable", unavailableReason: resolved.reason, physicalUse: use,
      annualEmissionsKg: null, annualEmissionsTonnes: null, horizonEmissionsKg: null, horizonEmissionsTonnes: null,
      emissionsPerKmKg: null, byYearKg: null, factor: null, scopeLabel: SCOPE_LABEL.not_stated, warnings: resolved.warnings,
    };
  }
  const { factor } = resolved;
  const byYearKg = use.byYear.map((q) => q * factor.kgPerUnit); // physical use x factor, never price
  const horizonKg = byYearKg.reduce((a, b) => a + b, 0);
  const annualKg = byYearKg[1] ?? 0;
  const annualKm = distance[1] ?? 0;
  return {
    technology: tech, status: "calculated", unavailableReason: null, physicalUse: use,
    annualEmissionsKg: annualKg, annualEmissionsTonnes: annualKg / 1000,
    horizonEmissionsKg: horizonKg, horizonEmissionsTonnes: horizonKg / 1000,
    emissionsPerKmKg: annualKm > 0 ? annualKg / annualKm : null,
    byYearKg, factor, scopeLabel: factor.scopeLabel, warnings: resolved.warnings,
  };
}

/* ------------------------------ comparison with diesel ------------------------------ */

function compare(alt: TechnologyEmissions, diesel: TechnologyEmissions): EmissionsComparison {
  const technology = alt.technology as "bev" | "biofuel";
  const unavailable = (reason: string): EmissionsComparison => ({
    technology, status: "unavailable", unavailableReason: reason, absoluteDifferenceAnnualKg: null, absoluteDifferenceAnnualTonnes: null,
    absoluteDifferenceHorizonTonnes: null, percentageChange: null, direction: "undefined", label: null, sameStatedScope: null,
  });
  if (diesel.status !== "calculated") return unavailable("Diesel emissions are the baseline and could not be calculated: " + (diesel.unavailableReason ?? "emission factor required."));
  if (alt.status !== "calculated") return unavailable(alt.unavailableReason ?? "Emission factor required.");

  const d = diesel.annualEmissionsKg as number;
  const a = alt.annualEmissionsKg as number;
  const diff = d - a;
  const tolerance = 1e-12 * Math.max(Math.abs(d), Math.abs(a), 1);
  const direction: EmissionDirection = Math.abs(diff) <= tolerance ? "unchanged" : diff > 0 ? "lower" : "higher";
  const stated = diesel.factor!.scope !== "not_stated" && alt.factor!.scope !== "not_stated";
  return {
    technology, status: "calculated", unavailableReason: null,
    absoluteDifferenceAnnualKg: diff,
    absoluteDifferenceAnnualTonnes: diff / 1000,
    absoluteDifferenceHorizonTonnes: ((diesel.horizonEmissionsKg as number) - (alt.horizonEmissionsKg as number)) / 1000,
    percentageChange: d === 0 ? null : (diff / d) * 100,
    direction,
    label: direction === "lower" ? "Emissions reduction" : direction === "higher" ? "Emissions increase" : "No change in estimated emissions",
    sameStatedScope: stated ? diesel.factor!.scope === alt.factor!.scope : null,
  };
}

/* ------------------------------ entry point ------------------------------ */

/**
 * Estimated operational GHG emissions for each technology and the difference from diesel.
 * Physical use x user-supplied factor. Independent of the financial engine: prices, discounting
 * and escalation play no part, so emissions cannot change because a price changed.
 */
export function calculateEnvironmentalPerformance(input: NormalizedAssessmentInput): EnvironmentalPerformanceResult {
  const distance = fleetDistanceByYear(input) ?? [0, 0];
  const valid = fleetDistanceByYear(input) !== null;
  const env = input.environmentalAssumptions;

  const lossPct = input.bev?.chargingLossPct;
  const lossRate = isNum(lossPct) ? lossPct / 100 : 0;
  const bevGridPerKm = lossRate >= 1 ? Number.NaN : (input.bev?.energyConsumptionKwhPer100Km ?? 0) / 100 / (1 - lossRate);
  const biofuelUnit: PhysicalUnit = input.biofuel?.fuelUnit ?? "litre";

  const dieselUse = physicalUse("litre", (input.diesel?.fuelConsumptionLitresPer100Km ?? 0) / 100, distance);
  const bevUse = physicalUse("kWh", bevGridPerKm, distance); // grid draw after charging losses, not vehicle-delivered energy
  const biofuelUse = physicalUse(biofuelUnit, (input.biofuel?.fuelConsumptionFuelUnitsPer100Km ?? 0) / 100, distance);

  const invalidInput = (tech: TechId, use: PhysicalUse): TechnologyEmissions => ({
    technology: tech, status: "unavailable", unavailableReason: "Distance, fleet size, analysis period or consumption is not valid.", physicalUse: use,
    annualEmissionsKg: null, annualEmissionsTonnes: null, horizonEmissionsKg: null, horizonEmissionsTonnes: null, emissionsPerKmKg: null, byYearKg: null,
    factor: null, scopeLabel: SCOPE_LABEL.not_stated, warnings: [warning("ENVIRONMENTAL_INPUT_INVALID", tech, "Distance, fleet size, analysis period or consumption is not valid, so emissions cannot be calculated.")],
  });
  const usable = (use: PhysicalUse) => valid && use.byYear.every(Number.isFinite) && use.annualQuantity > 0;

  const diesel = usable(dieselUse) ? technologyEmissions("diesel", dieselUse, env?.diesel, distance) : invalidInput("diesel", dieselUse);
  const bev = usable(bevUse) ? technologyEmissions("bev", bevUse, env?.gridElectricity, distance) : invalidInput("bev", bevUse);
  const biofuel = usable(biofuelUse) ? technologyEmissions("biofuel", biofuelUse, env?.biofuel, distance) : invalidInput("biofuel", biofuelUse);

  const bevVsDiesel = compare(bev, diesel);
  const biofuelVsDiesel = compare(biofuel, diesel);

  const all: TechnologyEmissions[] = [diesel, bev, biofuel];
  const warnings: CalcWarning[] = all.flatMap((t) => t.warnings);
  const extra = (w: CalcWarning) => warnings.push(w);

  // Scopes that differ between the two factors being compared make the comparison less like-for-like.
  for (const [alt, cmp, scope] of [[bev, bevVsDiesel, "bev_vs_diesel"], [biofuel, biofuelVsDiesel, "biofuel_vs_diesel"]] as const) {
    if (cmp.status !== "calculated") continue;
    const ds = diesel.factor!.scope;
    const as = alt.factor!.scope;
    if (ds !== "not_stated" && as !== "not_stated" && ds !== as) {
      extra(warning("EMISSION_SCOPE_MISMATCH", scope, `The diesel factor covers "${SCOPE_LABEL[ds]}" but the ${TECH_NAME[alt.technology].toLowerCase()} factor covers "${SCOPE_LABEL[as]}". The comparison may not be like-for-like.`));
    } else if (ds === "not_stated" || as === "not_stated") {
      extra(warning("EMISSION_SCOPE_NOT_STATED", scope, "What one or both emission factors cover is not stated, so it cannot be confirmed that the comparison is like-for-like.", "info"));
    }
  }
  if (bev.status === "calculated" && !isNum(lossPct)) {
    extra(warning("EMISSIONS_CHARGING_LOSS_NOT_MODELLED", "bev", "No charging loss was entered, so grid electricity is taken to equal the energy the vehicles use. Charging losses would raise electricity-related emissions.", "info"));
  }
  if (biofuel.status === "calculated" && isNum(input.biofuel.blendPct) && input.biofuel.blendPct < 100) {
    extra(warning("BIOFUEL_FACTOR_APPLIED_TO_BLEND", "biofuel", "The biofuel emission factor is applied to all the fuel bought. For a blend it should be the factor of the blend, not of the pure biofuel.", "info"));
  }

  const calculated = all.filter((t) => t.status === "calculated").map((t) => t.technology);
  const unavailable = all.filter((t) => t.status === "unavailable").map((t) => t.technology);
  const state = unavailable.length === 0 ? "complete" : calculated.length === 0 ? "unavailable" : "partial";
  if (state !== "complete") {
    extra(warning("ENVIRONMENTAL_COMPARISON_UNAVAILABLE", "general", state === "unavailable" ? "Environmental comparison is unavailable: emission factors are required." : "Environmental comparison is incomplete: at least one emission factor is missing or unusable."));
  }

  const assumptions: AssumptionRecord[] = [];
  for (const t of all) {
    const f = t.factor;
    assumptions.push({
      id: `env_factor_${t.technology}`, group: "environment", label: `${FACTOR_NAME[t.technology]} emission factor`,
      value: f ? `${fmtNum(f.enteredValue)} ${f.enteredUnit}` : "not usable", status: f ? "user_input" : "missing",
      note: f ? `${f.scopeLabel}. ${f.hasProvenance ? `Source: ${f.source}${f.sourceYear ? ` (${f.sourceYear})` : ""}.` : "No source given."}` : t.unavailableReason ?? undefined,
      fieldIds: [t.technology === "bev" ? "env.grid.value" : `env.${t.technology}.value`],
    });
  }
  assumptions.push(
    { id: "env_factor_constant", group: "environment", label: "Emission factors over time", value: "held constant", status: "convention", note: "The grid, diesel and biofuel are not assumed to change over the analysis period unless you supply different factors." },
    { id: "env_embodied", group: "environment", label: "Vehicle and infrastructure embodied emissions", value: "not included", status: "excluded", note: "Manufacturing, batteries, disposal and infrastructure are outside the operational-emissions scope." },
    { id: "env_price_independent", group: "environment", label: "Energy prices", value: "do not affect emissions", status: "convention", note: "Emissions follow physical fuel and electricity use, which does not change when prices change." },
  );
  if (all.some((t) => t.factor?.lifecycleAdjustmentPct != null)) {
    assumptions.push({ id: "env_lifecycle_adjustment", group: "environment", label: "Lifecycle adjustment", value: "recorded, not applied", status: "excluded", note: "The method for applying it is not defined, so the factors are used exactly as entered." });
  }

  const notes = [
    "Only operational energy and fuel-related emissions are estimated. Vehicle and infrastructure embodied emissions are outside the current operational-emissions scope.",
    "Emission factors are held constant over the analysis period. GreenFleet does not assume the grid, diesel or biofuel will change.",
    "Physical fuel and electricity use does not change when prices change, so price escalation has no effect on emissions.",
    "A battery-electric vehicle has no tailpipe emissions, but the electricity it uses can have emissions. They are counted here using the grid factor you supplied, applied to the electricity drawn from the grid after charging losses.",
    "Emissions are a physical measure. They are not converted into money, and no carbon price is applied.",
  ];

  const dedup = new Map<string, CalcWarning>();
  for (const w of warnings) dedup.set(`${w.code}|${w.scope}`, w);

  return {
    scopeStatement: SCOPE_STATEMENT,
    diesel, bev, biofuel, bevVsDiesel, biofuelVsDiesel,
    dataCompleteness: { state, calculated, unavailable },
    warnings: [...dedup.values()],
    assumptions,
    notes,
  };
}
