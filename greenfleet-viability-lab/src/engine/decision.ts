import { evaluate, type Alt, type Evaluation } from "./evaluate";
import type { Params } from "./fields";
import { breakEven, stressTests, tornado, type BreakEven, type StressRow, type TornadoRow } from "./sensitivity";

export type Classification = "VIABLE" | "CONDITIONALLY VIABLE" | "NOT YET VIABLE";

export interface RuleResult {
  id: "economic" | "payback" | "operational" | "robustness";
  title: string;
  passed: boolean;
  /** A failed hard rule always yields NOT YET VIABLE. */
  hard: boolean;
  actual: number | null;
  threshold: number | null;
  unit: "money" | "years" | "percent" | "none";
  note: string;
}

export interface OperationalCheck { label: string; passed: boolean; actual: number; required: number; unit: string }

export interface Decision {
  alt: Alt;
  classification: Classification;
  rules: RuleResult[];
  operational: OperationalCheck[];
  stress: StressRow[];
  drivers: TornadoRow[];
  breakEvens: BreakEven[];
  /** Codes the UI turns into plain-language sentences. */
  reasonCodes: string[];
}

export function operationalChecks(p: Params, alt: Alt): OperationalCheck[] {
  if (alt === "bev") {
    const usableKwh = p.bBatteryKwh * (p.bUsableSocPct / 100);
    const rangeKm = usableKwh / (p.bConsumption / 100);
    const requiredKm = p.dailyDistanceKm * (1 + p.ruleRangeMarginPct / 100);
    const gridKwhPerDay = (p.dailyDistanceKm * p.bConsumption * (1 + p.bChargingLossPct / 100)) / 100;
    const hours = gridKwhPerDay / p.bChargerKw;
    return [
      { label: "Usable range covers daily distance plus safety margin", passed: rangeKm >= requiredKm, actual: rangeKm, required: requiredKm, unit: "km" },
      { label: "Daily charging fits the available window", passed: hours <= p.bChargeWindowHrs, actual: hours, required: p.bChargeWindowHrs, unit: "hours" },
    ];
  }
  return [{ label: "Blend is within the engine-approved maximum", passed: p.fBlendPct <= p.fApprovedBlendPct, actual: p.fBlendPct, required: p.fApprovedBlendPct, unit: "%" }];
}

export function breakEvenIds(alt: Alt): string[] {
  return alt === "bev"
    ? ["dieselPrice", "electricityPrice", "vehiclePrice", "annualDistance", "infraUtilisation"]
    : ["dieselPrice", "biofuelPrice", "vehiclePrice", "annualDistance"];
}

export function decide(p: Params, alt: Alt, ev: Evaluation = evaluate(p)): Decision {
  const inc = ev.incr[alt];
  const dieselPv = ev.results.diesel.pvTco;
  const operational = operationalChecks(p, alt);
  const stress = stressTests(p, alt);
  const positiveShare = stress.length === 0 ? 100 : (stress.filter((s) => s.positive).length / stress.length) * 100;

  const econ = inc.npv > 0;
  const paybackOk = inc.paybackYears !== null && inc.paybackYears <= p.ruleMaxPaybackYears;
  const opsOk = operational.every((o) => o.passed);
  const robust = positiveShare >= p.ruleMinRobustPct;
  const shortfallPct = inc.npv <= 0 ? (-inc.npv / dieselPv) * 100 : 0;
  const nearMiss = !econ && shortfallPct <= p.ruleNearMissPct;

  const rules: RuleResult[] = [
    { id: "economic", title: "NPV versus diesel is positive", passed: econ, hard: false, actual: inc.npv, threshold: 0, unit: "money", note: "Discounted savings minus extra upfront cost, relative to the diesel baseline." },
    { id: "payback", title: "Payback within the acceptable limit", passed: paybackOk, hard: false, actual: inc.paybackYears, threshold: p.ruleMaxPaybackYears, unit: "years", note: inc.paybackYears === null ? "Cumulative savings do not turn positive within the analysis horizon." : "Undiscounted, interpolated within the year." },
    { id: "operational", title: "Operational feasibility", passed: opsOk, hard: true, actual: null, threshold: null, unit: "none", note: "Range, charging time or approved blend, depending on the technology." },
    { id: "robustness", title: "NPV stays positive under adverse stress tests", passed: robust, hard: false, actual: positiveShare, threshold: p.ruleMinRobustPct, unit: "percent", note: `${stress.filter((s) => s.positive).length} of ${stress.length} stress tests keep NPV above zero.` },
  ];

  let classification: Classification;
  const codes: string[] = [];
  if (!opsOk) { classification = "NOT YET VIABLE"; codes.push("ops-fail"); }
  else if (econ) {
    if (paybackOk && robust) { classification = "VIABLE"; codes.push("all-pass"); }
    else { classification = "CONDITIONALLY VIABLE"; if (!paybackOk) codes.push("payback-fail"); if (!robust) codes.push("robust-fail"); }
  } else if (nearMiss) { classification = "CONDITIONALLY VIABLE"; codes.push("near-miss"); }
  else { classification = "NOT YET VIABLE"; codes.push("npv-negative"); }

  return {
    alt, classification, rules, operational, stress,
    drivers: tornado(p, alt),
    breakEvens: breakEvenIds(alt).map((id) => breakEven(p, alt, id)),
    reasonCodes: codes,
  };
}
