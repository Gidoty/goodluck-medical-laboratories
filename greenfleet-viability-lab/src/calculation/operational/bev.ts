import type { NormalizedAssessmentInput } from "@/domain/normalized";
import { fmtNum } from "../collector";
import type { CalcWarning } from "../types";
import { check, opWarning, overallStatus, STATUS_EXPLANATION } from "./status";
import type { BevOperational, BevRangeMetrics, ChargingTimeIndicator, OperationalCheck, PayloadAssessment } from "./types";

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

const OPPORTUNITY: Record<string, string> = {
  depot_only: "depot charging only",
  public_available: "public charging available",
  destination_available: "destination charging available",
  mixed: "mixed charging",
  unknown: "unknown",
};
const ARRANGEMENT: Record<string, string> = {
  existing_access: "existing charging access",
  dedicated_private: "a dedicated private charger",
  shared_private: "a shared private charger",
  public_only: "public charging only",
  mixed: "mixed arrangements",
  unknown: "unknown",
};

/** Charging that can happen away from the depot during the working day. */
const chargesDuringDay = (opportunity: string | null) => opportunity === "public_available" || opportunity === "destination_available" || opportunity === "mixed";

/**
 * Battery-electric operational feasibility, from the user's own inputs only.
 *
 * Range is judged against the stated daily distance first; whether charging during the day can
 * close a shortfall depends on the charging opportunity the user selected. No safety buffer is
 * invented: the margin is reported exactly. Individual routes are kept distinct from the whole day.
 */
export function evaluateBev(input: NormalizedAssessmentInput): BevOperational {
  const warnings: CalcWarning[] = [];
  const warn = (code: string, message: string, severity: CalcWarning["severity"] = "warning") => warnings.push(opWarning(code, "bev", message, severity));
  const ruleTrace: string[] = [];

  const daily = input.operations?.dailyDistanceKm;
  const range = input.bev?.usableRangeKm;
  const route = isNum(input.operations?.averageRouteDistanceKm) ? (input.operations.averageRouteDistanceKm as number) : null;
  const opportunity = input.bev?.operational?.chargingOpportunity ?? null;
  const arrangement = input.infrastructure?.bevCharging?.arrangement ?? null;
  const operatingDays = input.operations?.operatingDaysPerYear;
  const fleetSize = input.fleet?.fleetSize;

  /* ---------------- range ---------------- */
  let rangeMetrics: BevRangeMetrics | null = null;
  let rangeCheck: OperationalCheck;
  if (!isNum(daily) || daily <= 0 || !isNum(range) || range <= 0) {
    rangeCheck = check("range", "Daily range", "insufficient", "The daily distance or the usable range is missing or not valid, so range compatibility cannot be judged.");
  } else {
    const margin = range - daily;
    rangeMetrics = {
      dailyDistanceKm: daily,
      usableRangeKm: range,
      dailyRangeRatio: daily / range,
      rangeMarginKm: margin,
      rangeMarginPercent: (margin / range) * 100,
      routeDistanceKm: route,
      routeMarginKm: route === null ? null : range - route,
      routeMarginPercent: route === null ? null : ((range - route) / range) * 100,
      dailyExceedsRange: daily > range,
      routeExceedsRange: route === null ? null : route > range,
    };
    const observed = { value: daily, unit: "km/day" };
    const reference = { value: range, unit: "km usable range" };
    if (daily <= range) {
      ruleTrace.push("Range: daily distance is within the usable range, so no en-route charging is needed for the day.");
      rangeCheck = check("range", "Daily range", "satisfied", `Range requirement is satisfied for the stated daily distance without relying on en-route charging. Margin: ${fmtNum(margin)} km (${fmtNum(rangeMetrics.rangeMarginPercent)}% of the range).`, { observed, reference });
    } else {
      const shortfall = daily - range;
      warn("OP_BEV_DAILY_EXCEEDS_RANGE", "Daily distance exceeds stated BEV usable range.");
      if (opportunity === "depot_only") {
        warn("OP_BEV_DEPOT_ONLY_SHORTFALL", "Daily operating distance exceeds stated usable range under depot-only charging.");
        if (route !== null && route <= range) {
          ruleTrace.push("Range: the day is longer than the range and charging is depot-only, but each route fits the range, so recharging at the depot between routes could close the gap. Conditional.");
          rangeCheck = check("range", "Daily range", "conditional", `Daily distance is ${fmtNum(shortfall)} km more than the usable range and charging is depot-only. Each average route (${fmtNum(route)} km) fits within the range, so the day is possible only if vehicles return to the depot and recharge between routes.`, { observed, reference, conditions: ["Vehicles must return to the depot and recharge between routes."] });
        } else {
          ruleTrace.push("Range: the day is longer than the range, charging is depot-only, and nothing entered shows the vehicles can recharge at the depot mid-day. Constrained.");
          rangeCheck = check("range", "Daily range", "constrained", `Daily distance is ${fmtNum(shortfall)} km more than the usable range, and charging is depot-only. ${route === null ? "No route distance was entered to show that recharging between routes is possible." : "The average route is itself longer than the range."}`, { observed, reference });
        }
      } else if (chargesDuringDay(opportunity)) {
        warn("OP_BEV_ADDITIONAL_CHARGING", "Additional daytime charging is required.");
        ruleTrace.push("Range: the day is longer than the range, and charging is available during the day. Conditional on that charging being used.");
        rangeCheck = check("range", "Daily range", "conditional", `Daily distance is ${fmtNum(shortfall)} km more than the usable range. Additional charging is required during the operating day (${OPPORTUNITY[opportunity as string]}). Nothing entered shows that this charging can cover the shortfall.`, { observed, reference, conditions: ["Additional charging is required during the operating day."] });
      } else {
        warn("OP_BEV_CHARGING_UNKNOWN_SHORTFALL", "Daily distance exceeds usable range and charging availability is unknown.");
        ruleTrace.push("Range: the day is longer than the range and it is not known whether the vehicles can charge during the day. Insufficient data.");
        rangeCheck = check("range", "Daily range", "insufficient", `Daily distance is ${fmtNum(shortfall)} km more than the usable range, and charging availability is ${opportunity === "unknown" ? "unknown" : "not stated"}.`, { observed, reference });
      }
    }
  }

  /* ---------------- route ---------------- */
  let routeCheck: OperationalCheck;
  if (route === null || !isNum(range) || range <= 0) {
    routeCheck = check("route", "Single-route range", "not_assessed", "No average route distance was entered, so individual routes were not compared with the range.");
  } else if (route <= range) {
    routeCheck = check("route", "Single-route range", "satisfied", `The average route (${fmtNum(route)} km) fits within the usable range.${rangeMetrics?.dailyExceedsRange ? " The whole day does not, so recharging between routes matters." : ""}`, { observed: { value: route, unit: "km/route" }, reference: { value: range, unit: "km usable range" } });
  } else {
    warn("OP_BEV_ROUTE_EXCEEDS_RANGE", "Average route distance exceeds stated BEV usable range.");
    const observed = { value: route, unit: "km/route" };
    const reference = { value: range, unit: "km usable range" };
    if (opportunity === "depot_only") {
      ruleTrace.push("Route: a single average route is longer than the range and charging is depot-only. Constrained.");
      routeCheck = check("route", "Single-route range", "constrained", `A single average route (${fmtNum(route)} km) is longer than the usable range (${fmtNum(range)} km), and charging is depot-only, so the route cannot be completed without charging on the way.`, { observed, reference });
    } else if (chargesDuringDay(opportunity)) {
      ruleTrace.push("Route: a single average route is longer than the range, and charging is available during the day. Conditional.");
      routeCheck = check("route", "Single-route range", "conditional", `A single average route (${fmtNum(route)} km) is longer than the usable range (${fmtNum(range)} km), so a charge is needed on the way.`, { observed, reference, conditions: ["A charge is needed during a single route."] });
    } else {
      ruleTrace.push("Route: a single average route is longer than the range and charging availability is unknown. Insufficient data.");
      routeCheck = check("route", "Single-route range", "insufficient", `A single average route (${fmtNum(route)} km) is longer than the usable range (${fmtNum(range)} km), and charging availability is ${opportunity === "unknown" ? "unknown" : "not stated"}.`, { observed, reference });
    }
  }

  /* ---------------- charging ---------------- */
  let chargingCheck: OperationalCheck;
  if (opportunity === null && arrangement === null) {
    chargingCheck = check("charging", "Charging arrangements", "not_assessed", "Neither the charging opportunity nor the charging arrangement was entered.");
  } else if (opportunity === "depot_only" && arrangement === "public_only") {
    warn("OP_BEV_CHARGING_INCONSISTENT", "The charging opportunity is depot-only, but the charging arrangement is public charging only. Please reconcile them.");
    ruleTrace.push("Charging: the opportunity (depot only) and the arrangement (public only) contradict each other. Conditional.");
    chargingCheck = check("charging", "Charging arrangements", "conditional", "Charging opportunity says depot charging only, but the charging arrangement says public charging only. These contradict each other.", { conditions: ["The charging opportunity and the charging arrangement must be reconciled."] });
  } else if (opportunity === "unknown" || arrangement === "unknown") {
    warn("OP_BEV_CHARGING_UNKNOWN", "Charging availability is unknown.");
    chargingCheck = check("charging", "Charging arrangements", "insufficient", `Charging ${opportunity === "unknown" ? "opportunity" : "arrangement"} is unknown.`, { conditions: ["Charging arrangements must be confirmed."] });
  } else {
    const parts = [opportunity ? `opportunity: ${OPPORTUNITY[opportunity]}` : null, arrangement ? `arrangement: ${ARRANGEMENT[arrangement]}` : null].filter(Boolean);
    chargingCheck = check("charging", "Charging arrangements", "satisfied", `Charging ${parts.join("; ")}.${arrangement === "shared_private" ? " Access to the shared charger must be reliable." : ""}`);
  }

  /* ---------------- charging time (indicator only) ---------------- */
  const perDay = input.bev?.operational?.chargingDowntimeHoursPerDay;
  const entered = isNum(perDay);
  const chargingTime: ChargingTimeIndicator = {
    perVehiclePerDayHours: entered ? perDay : null,
    perVehicleAnnualHours: entered && isNum(operatingDays) ? perDay * operatingDays : null,
    fleetAnnualHours: entered && isNum(operatingDays) && isNum(fleetSize) ? perDay * operatingDays * fleetSize : null,
    label: "Charging-related time entered by user. This is not the same as lost productive time, because vehicles may charge outside working periods.",
  };

  /* ---------------- payload ---------------- */
  const baseline = isNum(input.fleet?.payloadCapacityKg) ? (input.fleet.payloadCapacityKg as number) : null;
  const average = isNum(input.fleet?.averagePayloadKg) ? (input.fleet.averagePayloadKg as number) : null;
  const impact = input.bev?.operational?.payloadImpact ?? null;
  const redKg = isNum(input.bev?.operational?.payloadReductionKg) ? (input.bev.operational.payloadReductionKg as number) : null;
  const redPct = isNum(input.bev?.operational?.payloadReductionPct) ? (input.bev.operational.payloadReductionPct as number) : null;
  const payload: PayloadAssessment = { baselineCapacityKg: baseline, averagePayloadKg: average, reductionKg: redKg, reductionPercent: redPct, effectiveCapacityKg: null, impact };

  let payloadCheck: OperationalCheck;
  if (impact === null) {
    payloadCheck = check("payload", "Payload", "not_assessed", "The payload impact was not stated, so payload compatibility was not assessed.");
  } else if (impact === "unknown") {
    warn("OP_BEV_PAYLOAD_UNKNOWN", "BEV payload impact is unknown.");
    payloadCheck = check("payload", "Payload", "insufficient", "The payload impact of the battery-electric vehicle is unknown.", { conditions: ["The payload impact must be confirmed."] });
  } else if (impact === "none") {
    payload.effectiveCapacityKg = baseline;
    payloadCheck = check("payload", "Payload", "satisfied", "No material payload impact is expected, so the stated payload is unchanged.", baseline !== null ? { reference: { value: baseline, unit: "kg capacity" }, observed: average !== null ? { value: average, unit: "kg average payload" } : null } : {});
  } else {
    // reduced
    const hasReduction = redKg !== null || redPct !== null;
    if (baseline === null || !hasReduction) {
      payloadCheck = check("payload", "Payload", "insufficient", baseline === null ? "A payload reduction is expected, but the payload capacity was not entered, so the effective capacity cannot be worked out." : "A payload reduction is expected, but its size was not entered.", { conditions: ["The payload capacity and the reduction must be entered."] });
    } else {
      const effective = redKg !== null ? baseline - redKg : baseline * (1 - (redPct as number) / 100);
      payload.effectiveCapacityKg = effective;
      if (average === null) {
        payloadCheck = check("payload", "Payload", "insufficient", `Effective battery-electric payload capacity is ${fmtNum(effective)} kg after the entered reduction, but no average payload was entered to compare with it.`, { reference: { value: effective, unit: "kg effective capacity" }, conditions: ["The average payload carried must be entered."] });
      } else if (average <= effective) {
        payloadCheck = check("payload", "Payload", "satisfied", `The average payload (${fmtNum(average)} kg) fits within the estimated effective capacity (${fmtNum(effective)} kg) after the entered reduction.`, { observed: { value: average, unit: "kg average payload" }, reference: { value: effective, unit: "kg effective capacity" } });
      } else {
        warn("OP_BEV_PAYLOAD_EXCEEDS_CAPACITY", "Average stated payload exceeds estimated BEV payload capacity after the entered payload reduction.");
        ruleTrace.push("Payload: the average payload is above the effective battery-electric capacity. Constrained.");
        payloadCheck = check("payload", "Payload", "constrained", `The average payload (${fmtNum(average)} kg) is ${fmtNum(average - effective)} kg above the estimated effective capacity (${fmtNum(effective)} kg).`, { observed: { value: average, unit: "kg average payload" }, reference: { value: effective, unit: "kg effective capacity" } });
      }
    }
  }

  const checks = { range: rangeCheck, route: routeCheck, charging: chargingCheck, payload: payloadCheck };
  const list = [rangeCheck, routeCheck, chargingCheck, payloadCheck];
  const { status, rule } = overallStatus(list, ["range", "route"]);
  ruleTrace.push(rule);
  return {
    technology: "bev",
    status,
    statusExplanation: STATUS_EXPLANATION[status],
    checks,
    rangeMetrics,
    chargingTime,
    payload,
    conditions: [...new Set(list.flatMap((c) => c.conditions))],
    notAssessed: list.filter((c) => c.status === "not_assessed").map((c) => c.label),
    ruleTrace,
    warnings,
  };
}
