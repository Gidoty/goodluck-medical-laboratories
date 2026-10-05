import type { IncrementalAnalysis, TechnologyEconomics } from "../types";
import type { CommercialViabilityPolicy } from "./policy";
import type { ConsistencyDiagnostic, EconomicAssessment, EconomicCase } from "./types";

const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/**
 * The tolerance denominator, chosen by one documented rule:
 *   the additional initial investment when it is positive and non-trivial (>= policy % of the diesel present cost),
 *   otherwise the diesel present cost.
 * Returns null when neither is a usable positive number, so nothing is ever divided by zero.
 */
export function toleranceDenominator(additionalInitialInvestment: number, dieselPresentCost: number, policy: CommercialViabilityPolicy): EconomicAssessment["denominator"] {
  const base = Math.abs(dieselPresentCost);
  // Only a POSITIVE additional investment is a meaningful base. When the alternative is cheaper at Year 0 there is no extra investment to measure against.
  if (finite(additionalInitialInvestment) && additionalInitialInvestment > 0 && finite(base) && additionalInitialInvestment >= (policy.minimumInvestmentBasePctOfDieselPresentCost / 100) * base) {
    return { kind: "incremental_investment", value: additionalInitialInvestment };
  }
  if (finite(base) && base > 0) return { kind: "diesel_present_cost", value: base };
  return null;
}

/** Cross-checks that must hold if the economics were calculated consistently. */
export function consistencyDiagnostics(diesel: TechnologyEconomics, green: TechnologyEconomics, inc: IncrementalAnalysis, policy: CommercialViabilityPolicy): ConsistencyDiagnostic[] {
  const out: ConsistencyDiagnostic[] = [];
  const scale = Math.max(1, Math.abs(diesel.presentCost));
  const zeroTol = policy.numericalToleranceFraction * scale;
  const tol = policy.consistencyToleranceFraction * scale;
  const last = inc.rows[inc.rows.length - 1];
  if (!finite(inc.npv) || !last || !finite(last.discountedCumulativeCashFlow)) {
    out.push({ code: "ECONOMICS_NOT_FINITE", severity: "error", message: "The incremental NPV or the cumulative cash flow is not a finite number." });
    return out;
  }
  if ((inc.npv > zeroTol && last.discountedCumulativeCashFlow < -tol) || (inc.npv < -zeroTol && last.discountedCumulativeCashFlow > tol)) {
    out.push({ code: "NPV_SIGN_CONTRADICTION", severity: "error", message: "The NPV and the discounted cumulative incremental cash flow at the end of the horizon have opposite signs. They should be the same number." });
  } else if (Math.abs(inc.npv - last.discountedCumulativeCashFlow) > tol) {
    out.push({ code: "NPV_CUMULATIVE_MISMATCH", severity: "error", message: "The NPV differs from the discounted cumulative incremental cash flow at the end of the horizon. They should be the same number." });
  }
  const pcDiff = diesel.presentCost - green.presentCost;
  if (Math.abs(pcDiff - inc.npv) > tol) {
    out.push({ code: "NPV_PRESENT_COST_MISMATCH", severity: "error", message: "The NPV differs from the difference in present cost between diesel and the alternative. Under a cost-only comparison they should be the same number." });
  }
  if (inc.npv > zeroTol && inc.discountedPayback.status === "not_achieved") {
    out.push({ code: "POSITIVE_NPV_WITHOUT_DISCOUNTED_PAYBACK", severity: "warning", message: "The NPV is positive but no discounted payback was found within the horizon. Inspect the year-by-year cash flows." });
  }
  return out;
}

/** Gate 3 input: classifies the economic case of one alternative against diesel. Pure. */
export function assessEconomics(diesel: TechnologyEconomics, green: TechnologyEconomics, inc: IncrementalAnalysis, horizonYears: number, policy: CommercialViabilityPolicy): EconomicAssessment {
  const diagnostics = consistencyDiagnostics(diesel, green, inc, policy);
  const base: Omit<EconomicAssessment, "case" | "explanation"> = {
    npv: finite(inc.npv) ? inc.npv : null,
    npvZeroWithinNumericalTolerance: false,
    nearBreakEvenTolerancePct: policy.nearBreakEvenTolerancePct,
    denominator: null,
    npvMaterialityRatio: null,
    presentCostDifference: finite(diesel.presentCost) && finite(green.presentCost) ? diesel.presentCost - green.presentCost : null,
    tcoDifference: finite(diesel.undiscountedTco) && finite(green.undiscountedTco) ? diesel.undiscountedTco - green.undiscountedTco : null,
    additionalInitialInvestment: finite(inc.additionalInitialInvestment) ? inc.additionalInitialInvestment : null,
    operatingSavingsYear1: finite(inc.operatingSavings?.year1) ? inc.operatingSavings.year1 : null,
    simplePaybackStatus: inc.simplePayback?.status ?? null,
    simplePaybackYears: inc.simplePayback?.years ?? null,
    discountedPaybackStatus: inc.discountedPayback?.status ?? null,
    discountedPaybackYears: inc.discountedPayback?.years ?? null,
    horizonYears,
    paybackWithinHorizon: inc.discountedPayback ? inc.discountedPayback.status !== "not_achieved" : null,
    immediateAdvantage: inc.discountedPayback?.status === "immediate" && inc.npv > 0,
    diagnostics,
  };
  if (diagnostics.some((d) => d.severity === "error")) {
    return { ...base, case: "INSUFFICIENT_DATA", explanation: "The economic results are internally inconsistent, so no economic case is drawn from them." };
  }
  const denominator = toleranceDenominator(inc.additionalInitialInvestment, diesel.presentCost, policy);
  if (!denominator) {
    return { ...base, case: "INSUFFICIENT_DATA", explanation: "There is no usable cost base to judge how large the NPV is." };
  }
  const zeroTol = policy.numericalToleranceFraction * Math.max(1, Math.abs(diesel.presentCost));
  const zero = Math.abs(inc.npv) <= zeroTol;
  const ratio = zero ? 0 : inc.npv / denominator.value;
  const tolerance = policy.nearBreakEvenTolerancePct / 100;
  let econ: EconomicCase;
  let explanation: string;
  if (Math.abs(ratio) <= tolerance) {
    econ = "NEAR_BREAK_EVEN";
    explanation = zero ? "The NPV is zero within numerical tolerance: economic indifference." : `The NPV is within the prototype tolerance of ${policy.nearBreakEvenTolerancePct}% of the ${denominator.kind === "incremental_investment" ? "additional initial investment" : "diesel present cost"}.`;
  } else if (ratio > 0) {
    econ = "FAVOURABLE";
    explanation = "The NPV is positive and larger than the near-break-even tolerance.";
  } else {
    econ = "UNFAVOURABLE";
    explanation = "The NPV is negative and larger in size than the near-break-even tolerance.";
  }
  return { ...base, case: econ, npvZeroWithinNumericalTolerance: zero, denominator, npvMaterialityRatio: ratio, explanation };
}
