import type { BevInput, BiofuelInput, DieselInput, IncentiveInput, NormalizedAssessmentInput, VehicleCostInput } from "@/domain/normalized";
import type { Context, TechSpec } from "./assemble";
import { fmtNum, type Collector } from "./collector";
import { escalatedPrice, replacementYears } from "./finance";
import type { TechId } from "./types";

const decimal = (pct: number) => pct / 100;

/** Energy cost for each year: quantity_t x price_t, with price_t = price_1 x (1 + g)^(t-1). Index 0 is 0. */
function energyCosts(ctx: Context, quantityPerKm: number, price1: number, escalation: number): number[] {
  return ctx.years.map((t) => (t === 0 ? 0 : ctx.fleetDistanceKm[t]! * quantityPerKm * escalatedPrice(price1, escalation, t)));
}

/**
 * Escalation is applied only if the user entered it. A blank is NOT the same as an entered 0%:
 * the price is held constant for arithmetic, and the assumption is recorded as missing so the
 * results page can say so.
 */
function escalationRate(col: Collector, id: string, group: "diesel" | "bev" | "biofuel", label: string, entered: number | null, fieldId: string): number {
  if (entered === null) {
    col.assume({ id, group, label, value: "not entered", status: "missing", note: "No escalation was entered, so the price is held constant. This is not the same as expecting 0% change.", fieldIds: [fieldId] });
    return 0;
  }
  col.assume({ id, group, label, value: fmtNum(entered), unit: "% per year", status: "user_input", fieldIds: [fieldId] });
  return decimal(entered);
}

function residualTotal(col: Collector, tech: TechId, v: VehicleCostInput, basePricePerVehicle: number | null, fleetSize: number, replaced: boolean, baseNote: string): number {
  const r = v.residualValue;
  if (r === null) {
    col.warn("RESIDUAL_NOT_PROVIDED", tech, "No residual value was entered, so no resale value is credited at the end of the analysis period.");
    col.assume({ id: `${tech}_residual`, group: tech, label: "Residual value", value: "not entered", status: "missing", note: "No resale value credited.", fieldIds: [`${tech}.residual`] });
    return 0;
  }
  let total: number;
  if (r.kind === "amount") {
    total = (r.amount ?? 0) * fleetSize;
    col.assume({ id: `${tech}_residual`, group: tech, label: "Residual value", value: `{cur}${fmtNum(r.amount ?? 0)}`, unit: "per vehicle", status: "user_input", fieldIds: [`${tech}.residual`] });
  } else if (basePricePerVehicle === null) {
    col.warn("RESIDUAL_BASE_UNDEFINED", tech, `A residual percentage was entered, but ${baseNote} It was left out. Enter a residual amount instead.`);
    col.assume({ id: `${tech}_residual`, group: tech, label: "Residual value", value: `${fmtNum(r.percent ?? 0)}%`, status: "excluded", note: baseNote, fieldIds: [`${tech}.residual`] });
    return 0;
  } else {
    total = (decimal(r.percent ?? 0) * basePricePerVehicle) * fleetSize;
    col.assume({ id: `${tech}_residual`, group: tech, label: "Residual value", value: `${fmtNum(r.percent ?? 0)}% of {cur}${fmtNum(basePricePerVehicle)}`, unit: "of acquisition price, per vehicle", status: "user_input", fieldIds: [`${tech}.residual`] });
  }
  if (replaced) {
    col.warn("RESIDUAL_WITH_REPLACEMENT", tech, "The analysis period is longer than the vehicle life, so a replacement vehicle is in service at the end. Your residual assumption is applied to that vehicle as entered, with no adjustment for its age.");
  }
  return total;
}

/**
 * Upfront incentives. Only incentives the user entered are applied. A grant or subsidy is cash at
 * Year 0 against the vehicle purchase; tax credits and "other" incentives have no defined timing,
 * so they are excluded and reported instead of being guessed into Year 0.
 */
function upfrontIncentive(col: Collector, tech: TechId, inc: IncentiveInput, eligibleVehicleCapex: number, fleetSize: number): number {
  const group = tech;
  switch (inc.type) {
    case null:
    case "none":
      return 0;
    case "upfront_grant": {
      const requested = (inc.amount ?? 0) * fleetSize;
      const applied = Math.min(requested, eligibleVehicleCapex);
      if (applied < requested) col.warn("INCENTIVE_CAPPED", tech, "The upfront grant is larger than the vehicle purchase cost, so it was capped at the purchase cost.");
      col.assume({ id: `${tech}_incentive`, group, label: "Upfront grant", value: `{cur}${fmtNum(inc.amount ?? 0)}`, unit: "per vehicle", status: "user_input", fieldIds: [`incentive.${tech}.amount`] });
      return applied;
    }
    case "percent_subsidy": {
      const rate = decimal(inc.percentOfPurchasePrice ?? 0);
      col.assume({ id: `${tech}_incentive`, group, label: "Purchase subsidy", value: fmtNum(inc.percentOfPurchasePrice ?? 0), unit: "% of vehicle purchase cost", status: "user_input", fieldIds: [`incentive.${tech}.percent`] });
      return rate * eligibleVehicleCapex;
    }
    case "tax_credit":
    case "other":
      col.warn("INCENTIVE_TIMING_UNDEFINED", tech, `A ${inc.type === "tax_credit" ? "tax credit or rebate" : "other incentive"} was entered, but when the money is received is not defined. It is excluded from the primary calculation rather than assumed to arrive in Year 0.`);
      col.assume({ id: `${tech}_incentive`, group, label: inc.type === "tax_credit" ? "Tax credit / rebate" : "Other incentive", value: `{cur}${fmtNum(inc.amount ?? 0)}`, unit: "per vehicle", status: "excluded", note: "Timing not defined, so not included.", fieldIds: [`incentive.${tech}.amount`] });
      return 0;
  }
}

const other = (x: number | null) => x ?? 0;

/** Costs shared by every vehicle type. */
function commonCosts(v: VehicleCostInput) {
  return {
    insurancePerVehicleYear: other(v.annualInsurance),
    licensingPerVehicleYear: other(v.annualRegistration),
    otherFixedPerVehicleYear: other(v.otherFixedAnnualCost),
    otherVariablePerKm: other(v.otherVariableCostPerKm),
  };
}

export function buildDieselSpec(input: NormalizedAssessmentInput, ctx: Context, col: Collector): TechSpec {
  const d: DieselInput = input.diesel;
  const N = ctx.fleetSize;
  const g = escalationRate(col, "diesel_escalation", "diesel", "Diesel price escalation", d.fuelPriceEscalationPctPerYear, "diesel.fuelEscalation");
  const initialVehicleCapex = d.upfrontVehicleCost * N;
  const replaced = replacementYears(ctx.horizon, d.usefulLifeYears).length > 0;
  col.assume({ id: "diesel_price", group: "diesel", label: "Diesel price (Year 1)", value: `{cur}${fmtNum(d.fuelPricePerLitre)}`, unit: "per litre", status: "user_input", fieldIds: ["diesel.fuelPrice"] });
  col.assume({ id: "diesel_consumption", group: "diesel", label: "Diesel consumption", value: fmtNum(d.fuelConsumptionLitresPer100Km), unit: "litres/100 km", status: "user_input", fieldIds: ["diesel.fuelEfficiency"] });
  col.assume({ id: "diesel_life", group: "diesel", label: "Vehicle useful life", value: fmtNum(d.usefulLifeYears), unit: "years", status: "user_input", fieldIds: ["diesel.usefulLife"] });
  return {
    id: "diesel",
    label: "Diesel (baseline)",
    acquisitionLabel: "Vehicle acquisition",
    energy: { unit: "litre", fleetQuantityYear1: ctx.fleetDistanceKm[1]! * (d.fuelConsumptionLitresPer100Km / 100), unitPriceYear1: d.fuelPricePerLitre },
    energyCostByYear: energyCosts(ctx, d.fuelConsumptionLitresPer100Km / 100, d.fuelPricePerLitre, g),
    usefulLifeYears: d.usefulLifeYears,
    initialVehicleCapex,
    replacementCapexPerEvent: initialVehicleCapex,
    upfrontIncentives: upfrontIncentive(col, "diesel", input.finance.incentives.diesel, initialVehicleCapex, N),
    initialInfrastructureCapex: 0,
    infrastructureOpexPerYear: 0,
    maintenancePerVehicleYear: d.annualMaintenanceCost,
    ...commonCosts(d),
    batteryReplacement: null,
    residualTotal: residualTotal(col, "diesel", d, d.upfrontVehicleCost, N, replaced, "no acquisition price is available to apply it to."),
  };
}

export function buildBevSpec(input: NormalizedAssessmentInput, ctx: Context, col: Collector): TechSpec {
  const b: BevInput = input.bev;
  const N = ctx.fleetSize;
  const g = escalationRate(col, "bev_escalation", "bev", "Electricity price escalation", b.electricityPriceEscalationPctPerYear, "bev.electricityEscalation");

  // Charging loss L is the share of GRID energy lost: grid = delivered / (1 - L). Not delivered x (1 + L).
  const perKmDelivered = b.energyConsumptionKwhPer100Km / 100;
  const lossRate = b.chargingLossPct === null ? null : decimal(b.chargingLossPct);
  const perKmGrid = lossRate === null ? perKmDelivered : perKmDelivered / (1 - lossRate);
  if (lossRate === null) {
    col.warn("CHARGING_LOSS_NOT_MODELLED", "bev", "No charging loss was entered, so the electricity bought equals the energy the vehicles use. Real charging always loses some energy, which would raise the electricity cost.");
    col.assume({ id: "bev_charging_loss", group: "bev", label: "Charging losses", value: "not entered", status: "missing", note: "Not modelled: grid energy is taken to equal vehicle energy.", fieldIds: ["bev.chargingLoss"] });
  } else {
    col.assume({ id: "bev_charging_loss", group: "bev", label: "Charging losses", value: fmtNum(b.chargingLossPct ?? 0), unit: "% of grid energy", status: "user_input", note: "Grid energy = vehicle energy / (1 - loss).", fieldIds: ["bev.chargingLoss"] });
  }
  col.assume({ id: "bev_tariff", group: "bev", label: "Electricity tariff (Year 1)", value: `{cur}${fmtNum(b.electricityTariffPerKwh)}`, unit: "per kWh", status: "user_input", fieldIds: ["bev.electricityTariff"] });
  col.assume({ id: "bev_consumption", group: "bev", label: "Energy consumption at the vehicle", value: fmtNum(b.energyConsumptionKwhPer100Km), unit: "kWh/100 km", status: "user_input", fieldIds: ["bev.energyConsumption"] });
  col.assume({ id: "bev_life", group: "bev", label: "Vehicle useful life", value: fmtNum(b.usefulLifeYears), unit: "years", status: "user_input", fieldIds: ["bev.usefulLife"] });

  // Battery replacement: only an explicit "yes" adds a cost. Unknown and unanswered are disclosed, never turned into zero silently.
  let battery: TechSpec["batteryReplacement"] = null;
  const br = b.batteryReplacement;
  if (br.expected === "yes" && br.year !== null && br.cost !== null) {
    battery = { yearsFromCycleStart: br.year, costFleet: br.cost * N };
    col.assume({ id: "bev_battery", group: "bev", label: "Battery replacement", value: `year ${fmtNum(br.year)}, {cur}${fmtNum(br.cost)} per vehicle`, status: "user_input", fieldIds: ["bev.batteryReplacement", "bev.batteryReplacementYear", "bev.batteryReplacementCost"] });
  } else if (br.expected === "no") {
    col.assume({ id: "bev_battery", group: "bev", label: "Battery replacement", value: "none expected", status: "user_input", fieldIds: ["bev.batteryReplacement"] });
  } else {
    col.warn("BATTERY_REPLACEMENT_UNKNOWN", "bev", "Battery replacement requirement is unknown and is not included in the primary cost estimate.");
    col.assume({ id: "bev_battery", group: "bev", label: "Battery replacement", value: br.expected === "unknown" ? "unknown" : "not answered", status: "excluded", note: "Not included in the primary cost estimate.", fieldIds: ["bev.batteryReplacement"] });
  }

  const infra = input.infrastructure.bevCharging;
  let initialInfra = 0;
  let opexInfra = 0;
  if (infra.investmentRequired) {
    // All infrastructure costs are PROJECT TOTALS (not per charger), so the charger count is not a multiplier.
    const total = other(infra.equipmentCost) + other(infra.installationCost) + other(infra.electricalUpgradeCost);
    const sharing = infra.vehiclesSharing ?? N;
    const share = Math.min(1, N / sharing);
    if (sharing < N) col.warn("INFRA_SHARING_BELOW_FLEET", "bev", "Fewer vehicles are using the chargers than the number you are assessing, so your fleet is charged the whole infrastructure cost.");
    initialInfra = total * share;
    opexInfra = (other(infra.annualMaintenanceCost) + other(infra.otherAnnualCost)) * share;
    col.assume({ id: "bev_infra_total", group: "infrastructure", label: "Charging infrastructure cost (project total)", value: `{cur}${fmtNum(total)}`, status: "user_input", note: "Equipment, installation and electrical upgrade, entered as totals (not per charger).", fieldIds: ["bevInfra.equipmentCost", "bevInfra.installationCost", "bevInfra.electricalUpgradeCost"] });
    col.assume({ id: "bev_infra_share", group: "infrastructure", label: "Share of infrastructure charged to your fleet", value: fmtNum(share * 100), unit: "%", status: "derived", note: `min(1, ${fmtNum(N)} assessed vehicles / ${fmtNum(sharing)} vehicles using the chargers). Charger utilisation is not used for cost sharing.`, fieldIds: ["bevInfra.vehiclesSharing"] });
    if (infra.usefulLifeYears !== null && infra.usefulLifeYears < ctx.horizon) {
      col.warn("INFRA_REPLACEMENT_NOT_MODELLED", "bev", "The charging infrastructure's useful life is shorter than the analysis period. Replacing it is not modelled, so its cost is understated.");
    }
    col.assume({ id: "bev_infra_terminal", group: "infrastructure", label: "Infrastructure replacement and terminal value", value: "not modelled", status: "convention", note: "Infrastructure is paid for once at Year 0. No replacement cost and no remaining value at the end of the period are included." });
  } else {
    const arrangement = infra.arrangement;
    if (arrangement === null || arrangement === "unknown") {
      col.warn("CHARGING_ARRANGEMENT_UNKNOWN", "bev", "The charging arrangement is not known, so no charging infrastructure cost is included.");
    }
    col.assume({ id: "bev_infra_total", group: "infrastructure", label: "Charging infrastructure cost", value: "none", status: arrangement === null || arrangement === "unknown" ? "missing" : "user_input", note: arrangement === "public_only" || arrangement === "existing_access" ? "Existing or public charging: any charging cost is assumed to be inside the electricity tariff." : "No infrastructure investment indicated.", fieldIds: ["bevInfra.arrangement"] });
  }

  const initialVehicleCapex = b.upfrontVehicleCost * N;
  const replaced = replacementYears(ctx.horizon, b.usefulLifeYears).length > 0;
  return {
    id: "bev",
    label: "Battery electric",
    acquisitionLabel: "Vehicle acquisition",
    energy: {
      unit: "kWh",
      fleetQuantityYear1: ctx.fleetDistanceKm[1]! * perKmGrid,
      unitPriceYear1: b.electricityTariffPerKwh,
      vehicleDeliveredKwhFleetYear1: ctx.fleetDistanceKm[1]! * perKmDelivered,
      chargingLossRate: lossRate,
    },
    energyCostByYear: energyCosts(ctx, perKmGrid, b.electricityTariffPerKwh, g),
    usefulLifeYears: b.usefulLifeYears,
    initialVehicleCapex,
    replacementCapexPerEvent: initialVehicleCapex,
    upfrontIncentives: upfrontIncentive(col, "bev", input.finance.incentives.bev, initialVehicleCapex, N),
    initialInfrastructureCapex: initialInfra,
    infrastructureOpexPerYear: opexInfra,
    maintenancePerVehicleYear: b.annualMaintenanceCost,
    ...commonCosts(b),
    batteryReplacement: battery,
    residualTotal: residualTotal(col, "bev", b, b.upfrontVehicleCost, N, replaced, "no acquisition price is available to apply it to."),
  };
}

export function buildBiofuelSpec(input: NormalizedAssessmentInput, ctx: Context, col: Collector): TechSpec {
  const f: BiofuelInput = input.biofuel;
  const N = ctx.fleetSize;
  const g = escalationRate(col, "biofuel_escalation", "biofuel", "Biofuel price escalation", f.fuelPriceEscalationPctPerYear, "biofuel.fuelEscalation");
  const unit = f.fuelUnit;
  const conversion = f.acquisition.mode === "conversion";

  // Maintenance: the entered annual maintenance, plus any additional effect of this fuel.
  let maintenance = f.annualMaintenanceCost;
  if (f.incrementalMaintenance) {
    const inc = f.incrementalMaintenance;
    maintenance = inc.kind === "percent_of_maintenance" ? maintenance * (1 + decimal(inc.percent ?? 0)) : maintenance + (inc.amount ?? 0);
    col.assume({ id: "biofuel_incremental_maintenance", group: "biofuel", label: "Additional maintenance caused by this fuel", value: inc.kind === "percent_of_maintenance" ? `${fmtNum(inc.percent ?? 0)}% of annual maintenance` : `{cur}${fmtNum(inc.amount ?? 0)} per vehicle per year`, status: "user_input", fieldIds: ["biofuel.incrementalMaintenance"] });
  }

  const initialVehicleCapex = f.upfrontVehicleCost * N;
  col.assume({ id: "biofuel_pathway", group: "biofuel", label: "Biofuel pathway", value: f.pathway.replace(/_/g, " "), status: "user_input", fieldIds: ["biofuel.pathway"] });
  col.assume({ id: "biofuel_price", group: "biofuel", label: "Fuel price (Year 1)", value: `{cur}${fmtNum(f.fuelPricePerFuelUnit)}`, unit: `per ${unit === "m3" ? "m³" : unit}`, status: "user_input", note: "Price of the fuel as bought (for a blend, the blend).", fieldIds: ["biofuel.fuelPrice"] });
  col.assume({ id: "biofuel_consumption", group: "biofuel", label: "Fuel consumption", value: fmtNum(f.fuelConsumptionFuelUnitsPer100Km), unit: `${unit === "m3" ? "m³" : unit}/100 km`, status: "user_input", fieldIds: ["biofuel.fuelEfficiency"] });
  col.assume({ id: "biofuel_life", group: "biofuel", label: "Vehicle useful life", value: fmtNum(f.usefulLifeYears), unit: "years", status: "user_input", fieldIds: ["biofuel.usefulLife"] });
  col.assume({ id: "biofuel_mode", group: "biofuel", label: "Vehicle option", value: conversion ? "convert an existing vehicle" : "buy a new vehicle", status: "user_input", fieldIds: ["biofuel.acquisitionMode"] });

  if (conversion) {
    col.warn("CONVERSION_REPLACEMENT_ASSUMPTION", "biofuel", "A converted vehicle that reaches the end of its life within the analysis period is replaced by repeating the conversion cost, because no replacement vehicle price is entered. Treat this as a rough assumption.", "info");
    if (f.acquisition.existingVehicleValue !== null) {
      col.warn("EXISTING_VEHICLE_VALUE_NOT_USED", "biofuel", "The existing vehicle's value is recorded but not treated as a cash cost or an opportunity cost in the primary calculation.", "info");
      col.assume({ id: "biofuel_existing_value", group: "biofuel", label: "Existing vehicle value", value: `{cur}${fmtNum(f.acquisition.existingVehicleValue)}`, unit: "per vehicle", status: "excluded", note: "Stored for later methodology decisions. Used only as the base for a residual percentage.", fieldIds: ["biofuel.existingVehicleValue"] });
    }
  }

  // Biofuel infrastructure: only when the user said it is required.
  const inf = input.infrastructure.biofuel;
  let initialInfra = 0;
  let opexInfra = 0;
  if (inf.investmentRequired === "yes") {
    initialInfra = other(inf.storageEquipmentCost) + other(inf.refuellingInfrastructureCost) + other(inf.installationCost);
    opexInfra = other(inf.annualMaintenanceCost);
    col.assume({ id: "biofuel_infra", group: "infrastructure", label: "Biofuel infrastructure cost (project total)", value: `{cur}${fmtNum(initialInfra)}`, status: "user_input", note: "Storage, refuelling or conversion equipment and installation, charged in full to the assessed fleet.", fieldIds: ["bioInfra.storageCost", "bioInfra.refuellingCost", "bioInfra.installationCost"] });
    if (inf.usefulLifeYears !== null && inf.usefulLifeYears < ctx.horizon) {
      col.warn("INFRA_REPLACEMENT_NOT_MODELLED", "biofuel", "The biofuel infrastructure's useful life is shorter than the analysis period. Replacing it is not modelled, so its cost is understated.");
    }
  } else if (inf.investmentRequired === "unknown" || inf.investmentRequired === null) {
    if (inf.investmentRequired === "unknown") col.warn("BIOFUEL_INFRA_UNKNOWN", "biofuel", "Whether special storage or infrastructure is needed is unknown, so no biofuel infrastructure cost is included.");
    col.assume({ id: "biofuel_infra", group: "infrastructure", label: "Biofuel infrastructure cost", value: inf.investmentRequired === "unknown" ? "unknown" : "not answered", status: inf.investmentRequired === "unknown" ? "excluded" : "missing", note: "Not included.", fieldIds: ["biofuel.specialInfrastructure"] });
  }

  // Residual percentage needs a base: the purchase price for a new vehicle, the existing vehicle's value for a conversion.
  const base = conversion ? f.acquisition.existingVehicleValue : f.upfrontVehicleCost;
  const replaced = replacementYears(ctx.horizon, f.usefulLifeYears).length > 0;

  return {
    id: "biofuel",
    label: "Biofuel",
    acquisitionLabel: conversion ? "Vehicle conversion" : "Vehicle acquisition",
    energy: { unit, fleetQuantityYear1: ctx.fleetDistanceKm[1]! * (f.fuelConsumptionFuelUnitsPer100Km / 100), unitPriceYear1: f.fuelPricePerFuelUnit },
    energyCostByYear: energyCosts(ctx, f.fuelConsumptionFuelUnitsPer100Km / 100, f.fuelPricePerFuelUnit, g),
    usefulLifeYears: f.usefulLifeYears,
    initialVehicleCapex,
    replacementCapexPerEvent: initialVehicleCapex,
    upfrontIncentives: upfrontIncentive(col, "biofuel", input.finance.incentives.biofuel, initialVehicleCapex, N),
    initialInfrastructureCapex: initialInfra,
    infrastructureOpexPerYear: opexInfra,
    maintenancePerVehicleYear: maintenance,
    ...commonCosts(f),
    batteryReplacement: null,
    residualTotal: residualTotal(col, "biofuel", f, base, N, replaced, conversion ? "a conversion has no acquisition price, and no existing vehicle value was entered to use as the base." : "no acquisition price is available to apply it to."),
  };
}
