import type { NormalizedAssessmentInput } from "@/domain/normalized";
import { evaluateInput, type Snapshot } from "../analysis/evaluate";
import { formatValue } from "../analysis/format";
import { VARIABLES } from "../analysis/variables";
import type { ReasonCode } from "../viability/types";

/**
 * What would have to be true operationally. Where the operational rule itself gives a number
 * (a minimum range, a maximum payload reduction) the number is the rule's boundary, with no
 * safety buffer, and it is checked by re-running the engine. Categorical conditions such as
 * fuel availability are never turned into numbers: they stay qualitative remedies.
 */
export interface OperationalRemedy {
  code: ReasonCode;
  kind: "numeric_threshold" | "qualitative";
  text: string;
  /** For numeric remedies. */
  value?: number;
  display?: string;
  /** True when the engine, re-run at the value, no longer shows the problem. */
  verified?: boolean;
  /** What the remedy removes: a hard constraint or a condition. */
  resolves: "hard_constraint" | "condition";
}

const MODEL_NOTE = "This is the minimum model threshold, not an engineering safety recommendation.";

const QUALITATIVE: Partial<Record<ReasonCode, string>> = {
  DAYTIME_CHARGING_REQUIRED: "Secure reliable daytime charging so the day's distance can be covered.",
  DEPOT_RECHARGE_BETWEEN_ROUTES: "Confirm that vehicles can return to the depot and recharge between routes.",
  CHARGING_UNRESOLVED: "Confirm and reconcile the charging arrangements.",
  BIOFUEL_SUPPLY_INTERMITTENT: "Improve biofuel supply reliability, or arrange a fallback for the times it is not available.",
  BIOFUEL_SUPPLY_LIMITED: "Improve fuel availability to a reliably supportable operating condition.",
  BIOFUEL_SUPPLY_CONSTRAINED: "Improve fuel availability to a reliably supportable operating condition, and specify the required storage and refuelling infrastructure.",
  INFRASTRUCTURE_UNRESOLVED: "Specify and provide the required storage and refuelling infrastructure.",
};

export function deriveOperationalRemedies(input: NormalizedAssessmentInput, snap: Snapshot): OperationalRemedy[] {
  const c = snap.commercial;
  const out: OperationalRemedy[] = [];
  const op = (c.technology === "bev" ? "bev" : "biofuel") as "bev" | "biofuel";
  const range = VARIABLES.bevRange;
  const verifyRange = (v: number, hard: ReasonCode[]) => {
    const e = evaluateInput(range.set(input, v));
    return e.ok && !e.bev.commercial.hardConstraints.some((h) => hard.includes(h.code));
  };

  const hard = c.hardConstraints.map((h) => h.code);
  if (op === "bev") {
    const daily = input.operations.dailyDistanceKm;
    const route = input.operations.averageRouteDistanceKm;
    if (hard.includes("RANGE_EXCEEDED_DEPOT_ONLY") || hard.includes("ROUTE_EXCEEDS_RANGE")) {
      const needed = route !== null && route !== undefined ? route : daily;
      const basis = route !== null && route !== undefined ? "the required route distance" : "the required daily distance";
      out.push({
        code: hard.includes("ROUTE_EXCEEDS_RANGE") ? "ROUTE_EXCEEDS_RANGE" : "RANGE_EXCEEDED_DEPOT_ONLY", kind: "numeric_threshold", resolves: "hard_constraint", value: needed,
        display: formatValue("km", needed, true), verified: verifyRange(needed, ["RANGE_EXCEEDED_DEPOT_ONLY", "ROUTE_EXCEEDS_RANGE"]),
        text: `A usable range of at least ${formatValue("km", needed, true)} (${basis}), or compatible en-route charging, is required. ${MODEL_NOTE}`,
      });
    }
    if (hard.includes("PAYLOAD_CONSTRAINT")) {
      const o = input.bev.operational;
      const cap = input.fleet.payloadCapacityKg;
      const avg = input.fleet.averagePayloadKg;
      if (cap !== null && avg !== null) {
        out.push({ code: "PAYLOAD_CONSTRAINT", kind: "qualitative", resolves: "hard_constraint", text: `The effective payload capacity must be at least the average payload of ${formatValue("kg", avg, true)}. This does not claim that any particular vehicle can achieve it.` });
        const kg = typeof o.payloadReductionKg === "number";
        const max = kg ? cap - avg : (1 - avg / cap) * 100;
        if (max >= 0) {
          const v = VARIABLES.bevPayloadReduction;
          const e = evaluateInput(v.set(input, max));
          out.push({
            code: "PAYLOAD_CONSTRAINT", kind: "numeric_threshold", resolves: "hard_constraint", value: max, display: formatValue(kg ? "kg" : "percent", max, true),
            verified: e.ok && !e.bev.commercial.hardConstraints.some((h) => h.code === "PAYLOAD_CONSTRAINT"),
            text: `The payload reduction would need to be no more than about ${formatValue(kg ? "kg" : "percent", max, true)}, all else equal. ${MODEL_NOTE}`,
          });
        }
      }
    }
    for (const cond of c.conditions) {
      if ((cond.code === "DAYTIME_CHARGING_REQUIRED" || cond.code === "DEPOT_RECHARGE_BETWEEN_ROUTES") && !out.some((r) => r.code === cond.code)) {
        out.push({ code: cond.code, kind: "qualitative", resolves: "condition", text: QUALITATIVE[cond.code]! });
        const rm = input.bev.usableRangeKm;
        if (daily > rm) out.push({ code: cond.code, kind: "numeric_threshold", resolves: "condition", value: daily, display: formatValue("km", daily, true), verified: evaluateInput(range.set(input, daily)).ok, text: `Alternatively, a usable range of at least ${formatValue("km", daily, true)} would cover the whole day without daytime charging. ${MODEL_NOTE}` });
      } else if (cond.code === "CHARGING_UNRESOLVED") {
        out.push({ code: cond.code, kind: "qualitative", resolves: "condition", text: QUALITATIVE.CHARGING_UNRESOLVED! });
      }
    }
  } else {
    for (const h of c.hardConstraints) {
      const t = QUALITATIVE[h.code];
      if (t) out.push({ code: h.code, kind: "qualitative", resolves: "hard_constraint", text: t });
    }
    for (const cond of c.conditions) {
      const t = QUALITATIVE[cond.code];
      if (t) out.push({ code: cond.code, kind: "qualitative", resolves: "condition", text: t });
    }
  }
  return out;
}
