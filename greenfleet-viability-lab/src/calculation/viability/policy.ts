import type { OperationalStatus } from "../operational/types";

/**
 * GreenFleet Commercial Viability Policy v1.0.
 *
 * Every modelling choice that shapes a commercial classification lives in this one object, so it
 * can be read, tested and versioned in one place. These are PROTOTYPE MODELLING POLICIES for
 * transparent comparative analysis. They are not universal investment laws and have no academic
 * consensus behind them. There is no weighted score anywhere in the policy.
 */
export interface CommercialViabilityPolicy {
  id: string;
  version: string;
  /**
   * Economic near-break-even tolerance, in percent. "Prototype decision tolerance: 5%".
   * An alternative is NEAR_BREAK_EVEN when |incremental NPV| <= tolerance% of the denominator below.
   */
  nearBreakEvenTolerancePct: number;
  /**
   * Denominator for the tolerance. The additional initial investment is used when it is positive and
   * "non-trivial", meaning at least this percentage of the diesel present cost. Otherwise (zero,
   * negative or tiny) the diesel present cost is used. This prevents division by zero or by a
   * near-zero figure, and gives one rule for the case where green is cheaper at Year 0.
   */
  minimumInvestmentBasePctOfDieselPresentCost: number;
  /**
   * Floating-point tolerance. An NPV is "exactly zero" when |NPV| <= this fraction of the diesel
   * present cost. This is about machine arithmetic only and is separate from the economic tolerance.
   */
  numericalToleranceFraction: number;
  /** Looser tolerance for the cross-checks between the NPV, the present-cost difference and the cumulative cash flow. */
  consistencyToleranceFraction: number;
  /** Economic warning codes that are material uncertainties for a green alternative (not critical unknowns). */
  materialEconomicWarnings: { bev: readonly string[]; biofuel: readonly string[] };
  /**
   * How a Batch 4 operational status enters the decision.
   *  pass: no operational barrier.  condition: a remediable condition to resolve.
   *  hard_constraint: an unresolved material problem.  critical_unknown: the evidence to judge is missing.
   */
  operationalMapping: Record<OperationalStatus, "pass" | "condition" | "hard_constraint" | "critical_unknown">;
  /**
   * Operational checks whose absence stops a defensible classification (critical unknowns). This
   * mirrors rule 2 of the Batch 4 operational status, and a test keeps the two in step.
   * Everything else that is unknown is a non-critical unknown: it is carried as a material uncertainty.
   */
  criticalChecks: { bev: readonly string[]; biofuel: readonly string[] };
  /** Environmental performance never changes the label in this policy version. */
  environmentalAffectsClassification: false;
}

export const COMMERCIAL_VIABILITY_POLICY_V1: CommercialViabilityPolicy = {
  id: "GreenFleet Commercial Viability Policy v1.0",
  version: "1.0",
  nearBreakEvenTolerancePct: 5,
  minimumInvestmentBasePctOfDieselPresentCost: 1,
  numericalToleranceFraction: 1e-9,
  consistencyToleranceFraction: 1e-6,
  materialEconomicWarnings: { bev: ["BATTERY_REPLACEMENT_UNKNOWN"], biofuel: [] },
  criticalChecks: { bev: ["range", "route"], biofuel: ["supply"] },
  operationalMapping: {
    suitable: "pass",
    conditional: "condition",
    constrained: "hard_constraint",
    insufficient_data: "critical_unknown",
  },
  environmentalAffectsClassification: false,
};
