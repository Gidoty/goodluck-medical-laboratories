import type { NormalizedAssessmentInput } from "@/domain/normalized";
import { assembleEconomics, buildContext } from "./assemble";
import { createCollector, fmtNum, type Collector } from "./collector";
import { buildCompleteness } from "./completeness";
import { compareWithDiesel } from "./compare";
import { summarizeDimensions } from "./dimensions";
import { calculateEnvironmentalPerformance } from "./environmental";
import { evaluateOperationalFeasibility } from "./operational";
import { checkNormalizedInput } from "./input-checks";
import { ENGINE_VERSION, METHODOLOGY_NOTES } from "./notes";
import { buildBevSpec, buildBiofuelSpec, buildDieselSpec } from "./specs";
import type { AssessmentCalculationResult, CalculationOutcome, IncrementalAnalysis } from "./types";

/**
 * Deterministic techno-economic engine. Same input, same output, no side effects.
 *
 * Perspective: the ASSET / PROJECT. Financing (loans, interest, equity) is deliberately not part
 * of the primary result, so the choice between technologies never depends on how they are paid for.
 */
export function calculateAssessment(input: NormalizedAssessmentInput): CalculationOutcome {
  const errors = checkNormalizedInput(input);
  if (errors.length > 0) return { ok: false, errors };

  const T = input.operations.analysisHorizonYears;
  const N = input.fleet.fleetSize;
  const rate = input.finance.discountRatePct / 100;
  const annualDistance = input.operations.annualDistanceKmPerVehicle;
  const ctx = buildContext(T, rate, N, annualDistance);
  const col = createCollector();

  const diesel = assembleEconomics(ctx, buildDieselSpec(input, ctx, col));
  const bev = assembleEconomics(ctx, buildBevSpec(input, ctx, col));
  const biofuel = assembleEconomics(ctx, buildBiofuelSpec(input, ctx, col));
  const bevVsDiesel = compareWithDiesel(ctx, diesel, bev, "bev");
  const biofuelVsDiesel = compareWithDiesel(ctx, diesel, biofuel, "biofuel");

  generalAssumptions(input, ctx.fleetHorizonDistanceKm, col);
  operationalWarnings(input, col);
  paybackWarnings(bevVsDiesel, "bev_vs_diesel", "battery-electric", col);
  paybackWarnings(biofuelVsDiesel, "biofuel_vs_diesel", "biofuel", col);

  // Environmental and operational layers read the same normalized input but not the financial results,
  // so neither can change a cost figure and neither is changed by one.
  const environmental = calculateEnvironmentalPerformance(input);
  const operational = evaluateOperationalFeasibility(input);
  const economicAssumptions = [...col.assumptions];
  const assumptions = [...economicAssumptions, ...environmental.assumptions];
  const partial = { bevVsDiesel, biofuelVsDiesel, environmental, operational };

  const result: AssessmentCalculationResult = {
    metadata: {
      engineVersion: ENGINE_VERSION,
      assessmentId: input.meta.assessmentId,
      assessmentName: input.meta.assessmentName,
      currency: input.meta.currency,
      dataOrigin: input.meta.dataOrigin,
      illustrativeInputs: [...input.meta.illustrativeInputs],
      horizonYears: T,
      discountRate: rate,
      fleetSize: N,
      annualDistancePerVehicleKm: annualDistance,
      fleetAnnualDistanceKm: annualDistance * N,
      fleetHorizonDistanceKm: ctx.fleetHorizonDistanceKm,
    },
    diesel,
    bev,
    biofuel,
    bevVsDiesel,
    biofuelVsDiesel,
    warnings: col.warnings,
    assumptions,
    assumptionsUsed: assumptions.filter((a) => a.status === "user_input" || a.status === "derived" || a.status === "convention"),
    assumptionsMissing: assumptions.filter((a) => a.status === "missing" || a.status === "excluded"),
    methodologyNotes: [...METHODOLOGY_NOTES],
    environmental,
    operational,
    dataCompleteness: buildCompleteness(economicAssumptions, operational, environmental),
    dimensions: summarizeDimensions(partial),
  };
  return { ok: true, result };
}

function generalAssumptions(input: NormalizedAssessmentInput, fleetHorizonDistance: number, col: Collector): void {
  const ops = input.operations;
  const dailyMode = ops.distanceInputMode === "daily";
  col.assume({ id: "horizon", group: "scope", label: "Analysis period", value: fmtNum(ops.analysisHorizonYears), unit: "years", status: "user_input", fieldIds: ["ops.analysisHorizon"] });
  col.assume({ id: "discount_rate", group: "scope", label: "Discount rate", value: fmtNum(input.finance.discountRatePct), unit: "% per year", status: "user_input", fieldIds: ["finance.discountRate"] });
  col.assume({ id: "fleet_size", group: "scope", label: "Vehicles evaluated", value: fmtNum(input.fleet.fleetSize), unit: "vehicles", status: "user_input", fieldIds: ["fleet.size"] });
  col.assume({ id: "annual_distance", group: "operations", label: "Annual distance per vehicle", value: fmtNum(ops.annualDistanceKmPerVehicle), unit: "km/year", status: dailyMode ? "derived" : "user_input", note: dailyMode ? `${fmtNum(ops.dailyDistanceKm)} km/day × ${fmtNum(ops.operatingDaysPerYear)} days/year` : "Entered directly.", fieldIds: dailyMode ? ["ops.dailyDistance", "ops.operatingDays"] : ["ops.annualDistance"] });
  col.assume({ id: "fleet_distance", group: "operations", label: "Fleet annual distance", value: fmtNum(ops.annualDistanceKmPerVehicle * input.fleet.fleetSize), unit: "km/year", status: "derived", note: "Annual distance per vehicle × vehicles evaluated." });
  col.assume({ id: "horizon_distance", group: "operations", label: "Fleet distance over the analysis period", value: fmtNum(fleetHorizonDistance), unit: "km", status: "derived", note: "Utilisation is held constant in every year." });
  col.assume({ id: "financing", group: "finance", label: "Loan, interest and equity", value: "not used", status: "excluded", note: "The primary result evaluates the asset independently of how it is financed." });
  col.assume({ id: "tax", group: "method", label: "Taxes, depreciation allowances, VAT", value: "not modelled", status: "excluded", note: "Tax effects are excluded from the current prototype." });
  col.assume({ id: "maintenance_escalation", group: "method", label: "Maintenance and other operating cost inflation", value: "none", status: "convention", note: "Held at the entered nominal values." });
  col.assume({ id: "acquisition_price_escalation", group: "method", label: "Vehicle replacement price", value: "same as the entered purchase price", status: "convention", note: "Replacement vehicles cost what the first one did. No price change is assumed." });
  col.assume({ id: "replacement_rule", group: "method", label: "Vehicle replacement rule", value: "a new vehicle is bought each time the useful life ends, if it would still be used before the period ends", status: "convention", note: "No replacement is bought at the end of the final year. The old vehicle's resale value is not credited when it is replaced." });
  col.assume({ id: "incentive_scope", group: "method", label: "Incentives", value: "only those you entered, at Year 0, on the first purchase", status: "convention" });
}

function operationalWarnings(input: NormalizedAssessmentInput, col: Collector): void {
  const { bev, biofuel, operations } = input;
  if (operations.dailyDistanceKm > bev.usableRangeKm) {
    col.warn("BEV_RANGE_BELOW_DAILY_DISTANCE", "bev", "Entered daily operating distance exceeds the stated BEV usable range. Financial results should not be interpreted as operational feasibility without a charging strategy.");
  }
  if (bev.operational.payloadImpact === "reduced") {
    col.warn("BEV_PAYLOAD_REDUCTION_NOT_MODELLED", "bev", "A payload reduction is expected for the battery-electric vehicle. Any extra trips or lost revenue it causes are not included in the cost comparison.", "info");
  }
  const avail = biofuel.supply.availability;
  if (avail === "limited" || avail === "intermittent") {
    col.warn("BIOFUEL_AVAILABILITY", "biofuel", `Biofuel availability is ${avail}. Financial results assume the fuel can be bought as entered and do not include delays, shortages or extra cost.`);
  } else if (avail === "unknown") {
    col.warn("BIOFUEL_AVAILABILITY_UNKNOWN", "biofuel", "Biofuel availability is unknown. Financial results assume the fuel can be bought at the entered price.", "info");
  }
  if (biofuel.supply.additionalRefuellingKmPerDay !== null || biofuel.supply.downtimeHoursPerMonth !== null) {
    col.warn("BIOFUEL_SUPPLY_COSTS_NOT_MODELLED", "biofuel", "Extra refuelling distance or downtime caused by fuel supply was entered, but it is not converted into cost in this calculation.", "info");
  }
}

function paybackWarnings(a: IncrementalAnalysis, scope: "bev_vs_diesel" | "biofuel_vs_diesel", name: string, col: Collector): void {
  if (a.simplePayback.status === "not_achieved") {
    col.warn("PAYBACK_NOT_ACHIEVED", scope, `The ${name} option does not pay back its extra cost within the analysis period.`, "info");
  }
  if (a.simplePayback.sustained === false) {
    col.warn("PAYBACK_NOT_SUSTAINED", scope, `Cumulative savings of the ${name} option fall below zero again after the first payback, because of later replacement or battery costs.`);
  }
}
