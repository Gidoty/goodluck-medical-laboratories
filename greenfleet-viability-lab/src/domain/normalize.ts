import { FUEL_UNITS } from "@/lib/fuel";
import { UNITS } from "@/lib/units";
import { checkAssessment, type FieldIssue } from "./checks";
import { deriveOperations, toCanonical } from "./derive";
import type {
  BevInput,
  BiofuelInput,
  DieselInput,
  EmissionFactorInput,
  IncentiveInput,
  InputStatus,
  NormalizedAssessmentInput,
  ResidualValueInput,
  VehicleCostInput,
  YesNoUnknown,
} from "./normalized";
import { createReader, getCurrency } from "./reader";
import { biofuelFuelUnit, FIELDS } from "./schema/fields";
import { INFRASTRUCTURE_ARRANGEMENTS } from "./schema/options";
import type { Reader } from "./schema/types";
import type { Assessment } from "./stored";

export type NormalizeResult = { ok: true; input: NormalizedAssessmentInput } | { ok: false; issues: FieldIssue[] };

/**
 * Turns a validated assessment into the contract the calculation engine consumes.
 * Fails (with the blocking issues) rather than producing partial or guessed output.
 */
export function normalizeAssessment(a: Assessment): NormalizeResult {
  const blocking = checkAssessment(a).filter((i) => i.severity === "error");
  if (blocking.length > 0) return { ok: false, issues: blocking };

  const r = createReader(a);
  const opt = (id: string): number | null => {
    const f = r.number(id);
    return f.status === "value" ? f.value : null;
  };
  const req = (id: string): number => {
    const v = opt(id);
    if (v === null) throw new Error(`Validated assessment is missing required input "${id}"`);
    return v;
  };
  const text = (id: string): string | null => {
    const t = r.text(id).trim();
    return t === "" ? null : t;
  };
  const choice = (id: string): string | null => r.choice(id) ?? null;
  const yesNo = (id: string): YesNoUnknown | null => (choice(id) as YesNoUnknown | null);
  const canonical = (id: string): number => {
    const c = toCanonical(r, id);
    if (!c) throw new Error(`Validated assessment is missing required input "${id}"`);
    return c.value;
  };
  const optCanonical = (id: string): number | null => toCanonical(r, id)?.value ?? null;

  const residual = (id: string): ResidualValueInput | null => {
    const { value, qualifier } = r.q(id);
    if (value.status !== "value") return null;
    return qualifier === "amount"
      ? { kind: "amount", amount: value.value, percent: null }
      : { kind: "percent_of_acquisition", amount: null, percent: value.value };
  };

  const vehicleCosts = (prefix: string, upfront: number): VehicleCostInput => ({
    upfrontVehicleCost: upfront,
    annualMaintenanceCost: req(`${prefix}.annualMaintenance`),
    usefulLifeYears: req(`${prefix}.usefulLife`),
    residualValue: residual(`${prefix}.residual`),
    annualInsurance: opt(`${prefix}.insurance`),
    annualRegistration: opt(`${prefix}.registration`),
    otherFixedAnnualCost: opt(`${prefix}.otherFixed`),
    otherVariableCostPerKm: opt(`${prefix}.otherVariable`),
  });

  const diesel: DieselInput = {
    ...vehicleCosts("diesel", req("diesel.acquisitionPrice")),
    fuelPricePerLitre: req("diesel.fuelPrice"),
    fuelConsumptionLitresPer100Km: canonical("diesel.fuelEfficiency"),
    fuelPriceEscalationPctPerYear: opt("diesel.fuelEscalation"),
  };

  const payloadReduction = r.q("bev.payloadReduction");
  const bev: BevInput = {
    ...vehicleCosts("bev", req("bev.acquisitionPrice")),
    electricityTariffPerKwh: req("bev.electricityTariff"),
    energyConsumptionKwhPer100Km: canonical("bev.energyConsumption"),
    usableRangeKm: req("bev.usableRange"),
    batteryCapacityKwh: opt("bev.batteryCapacity"),
    chargingLossPct: opt("bev.chargingLoss"),
    electricityPriceEscalationPctPerYear: opt("bev.electricityEscalation"),
    batteryReplacement: { expected: yesNo("bev.batteryReplacement"), year: opt("bev.batteryReplacementYear"), cost: opt("bev.batteryReplacementCost") },
    operational: {
      chargingOpportunity: choice("bev.chargingOpportunity"),
      chargingDowntimeHoursPerDay: opt("bev.chargingDowntime"),
      payloadImpact: choice("bev.payloadImpact") as BevInput["operational"]["payloadImpact"],
      payloadReductionKg: payloadReduction.value.status === "value" && payloadReduction.qualifier === "kg" ? payloadReduction.value.value : null,
      payloadReductionPct: payloadReduction.value.status === "value" && payloadReduction.qualifier === "percent" ? payloadReduction.value.value : null,
    },
  };

  const mode = choice("biofuel.acquisitionMode") as "new_vehicle" | "conversion";
  const inc = r.q("biofuel.incrementalMaintenance");
  const fuelUnit = biofuelFuelUnit(r);
  const biofuel: BiofuelInput = {
    ...vehicleCosts("biofuel", mode === "new_vehicle" ? req("biofuel.acquisitionPrice") : req("biofuel.conversionCost")),
    pathway: choice("biofuel.pathway") as string,
    blendPct: opt("biofuel.blendPercent"),
    fuelUnit,
    acquisition: { mode, existingVehicleValue: opt("biofuel.existingVehicleValue") },
    fuelPricePerFuelUnit: req("biofuel.fuelPrice"),
    fuelConsumptionFuelUnitsPer100Km: canonical("biofuel.fuelEfficiency"),
    fuelPriceEscalationPctPerYear: opt("biofuel.fuelEscalation"),
    incrementalMaintenance:
      inc.value.status === "value"
        ? inc.qualifier === "percent"
          ? { kind: "percent_of_maintenance", amount: null, percent: inc.value.value }
          : { kind: "amount_per_year", amount: inc.value.value, percent: null }
        : null,
    supply: {
      availability: choice("biofuel.fuelAvailability"),
      additionalRefuellingKmPerDay: opt("biofuel.additionalRefuellingKm"),
      downtimeHoursPerMonth: opt("biofuel.downtime"),
      specialInfrastructure: yesNo("biofuel.specialInfrastructure"),
    },
  };

  const incentive = (tech: string): IncentiveInput => ({
    type: choice(`incentive.${tech}.type`) as IncentiveInput["type"],
    amount: opt(`incentive.${tech}.amount`),
    percentOfPurchasePrice: opt(`incentive.${tech}.percent`),
  });

  const structure = choice("finance.structure") as NormalizedAssessmentInput["finance"]["structure"];
  const debt = structure === "equity_100" ? 0 : structure === "debt_100" ? 100 : req("finance.debtPercent");
  const equity = structure === "equity_100" ? 100 : structure === "debt_100" ? 0 : req("finance.equityPercent");

  const factor = (key: string, lifecycleKey: string): EmissionFactorInput => ({
    value: opt(`env.${key}.value`),
    unit: UNITS[r.unitOf(`env.${key}.value`)].label,
    source: text(`env.${key}.source`),
    sourceYear: opt(`env.${key}.year`),
    notes: text(`env.${key}.notes`),
    lifecycleAdjustmentPct: opt(`env.lifecycle.${lifecycleKey}`),
  });

  const ops = deriveOperations(a, r);
  const arrangement = choice("bevInfra.arrangement");

  const input: NormalizedAssessmentInput = {
    schemaVersion: 1,
    meta: {
      assessmentId: a.id,
      assessmentName: text("business.assessmentName") ?? "",
      scenarioName: a.scenarioName,
      currency: getCurrency(a),
      dataOrigin: a.origin,
      illustrativeInputs: [...a.illustrative],
      updatedAt: a.updatedAt,
    },
    business: { businessName: text("business.businessName"), businessType: choice("business.businessType"), country: choice("business.country"), operatingLocation: text("business.location") },
    fleet: { fleetSize: req("fleet.size"), vehicleCategory: choice("fleet.vehicleCategory"), payloadCapacityKg: optCanonical("fleet.payloadCapacity"), averagePayloadKg: optCanonical("fleet.averagePayload") },
    operations: {
      distanceInputMode: ops.mode,
      dailyDistanceKm: ops.dailyDistanceKm as number,
      operatingDaysPerYear: req("ops.operatingDays"),
      annualDistanceKmPerVehicle: ops.annualDistanceKm as number,
      fleetAnnualDistanceKm: ops.fleetAnnualDistanceKm as number,
      operatingPattern: choice("ops.operatingPattern"),
      averageRouteDistanceKm: opt("ops.routeDistance"),
      averageTripsPerDay: opt("ops.tripsPerDay"),
      analysisHorizonYears: req("ops.analysisHorizon"),
    },
    diesel,
    bev,
    biofuel,
    finance: {
      structure,
      debtSharePct: debt,
      equitySharePct: equity,
      interestRatePct: opt("finance.interestRate"),
      loanTenorYears: opt("finance.loanTenor"),
      loanFees: opt("finance.loanFees"),
      discountRatePct: req("finance.discountRate"),
      incentives: { diesel: incentive("diesel"), bev: incentive("bev"), biofuel: incentive("biofuel") },
    },
    infrastructure: {
      bevCharging: {
        arrangement,
        investmentRequired: INFRASTRUCTURE_ARRANGEMENTS.includes(arrangement ?? ""),
        equipmentCost: opt("bevInfra.equipmentCost"),
        installationCost: opt("bevInfra.installationCost"),
        electricalUpgradeCost: opt("bevInfra.electricalUpgradeCost"),
        numberOfChargers: opt("bevInfra.chargerCount"),
        vehiclesSharing: opt("bevInfra.vehiclesSharing"),
        usefulLifeYears: opt("bevInfra.lifeYears"),
        annualMaintenanceCost: opt("bevInfra.annualMaintenance"),
        otherAnnualCost: opt("bevInfra.otherAnnualCost"),
        utilisationPct: opt("bevInfra.utilisation"),
      },
      biofuel: {
        investmentRequired: yesNo("biofuel.specialInfrastructure"),
        storageEquipmentCost: opt("bioInfra.storageCost"),
        refuellingInfrastructureCost: opt("bioInfra.refuellingCost"),
        installationCost: opt("bioInfra.installationCost"),
        annualMaintenanceCost: opt("bioInfra.annualMaintenance"),
        usefulLifeYears: opt("bioInfra.lifeYears"),
      },
    },
    environmentalAssumptions: { diesel: factor("diesel", "diesel"), gridElectricity: factor("grid", "grid"), biofuel: { ...factor("biofuel", "biofuel"), unit: UNITS[FUEL_UNITS[fuelUnit].emissionFactor].label } },
    provenance: Object.fromEntries(
      Object.entries(a.provenance)
        .filter(([id, p]) => r.isVisible(id) && (p.source !== null || p.reference.trim() !== "" || p.year.status === "value"))
        .map(([id, p]) => [id, { source: p.source, reference: p.reference.trim() || null, year: p.year.status === "value" ? p.year.value : null }]),
    ),
    inputStatus: inputStatuses(r),
  };
  return { ok: true, input };
}

function inputStatuses(r: Reader): Record<string, InputStatus> {
  const out: Record<string, InputStatus> = {};
  for (const f of FIELDS) {
    if (!r.isVisible(f.id)) {
      out[f.id] = "hidden";
      continue;
    }
    switch (f.kind) {
      case "number":
        out[f.id] = r.number(f.id).status;
        break;
      case "text":
        out[f.id] = r.text(f.id).trim() === "" ? "missing" : "value";
        break;
      case "choice":
        out[f.id] = r.choice(f.id) === undefined ? "missing" : "value";
        break;
      case "qnumber":
        out[f.id] = r.q(f.id).value.status;
        break;
    }
  }
  return out;
}
