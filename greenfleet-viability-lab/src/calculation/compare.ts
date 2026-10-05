import type { Context } from "./assemble";
import { buildRows, distanceAtTime, npvDirection, paybackOf, savingsDirection, sum } from "./finance";
import type { GreenTechId, IncrementalAnalysis, TechnologyEconomics } from "./types";

/**
 * Incremental case: "what extra do I invest to choose this alternative instead of diesel, and do
 * the resulting savings justify it?" Every figure is a difference of two full cost series, so
 * nothing can be counted twice:
 *
 *   incremental cash flow_t = diesel net cash cost_t - alternative net cash cost_t
 *
 * Year 0 therefore equals -(extra upfront investment); the final year includes the difference in
 * residual values. Positive = the alternative is cheaper in that year.
 */
export function compareWithDiesel(ctx: Context, diesel: TechnologyEconomics, green: TechnologyEconomics, id: GreenTechId): IncrementalAnalysis {
  const rows = buildRows(
    diesel.series.map((r) => r.netCashCost),
    green.series.map((r) => r.netCashCost),
    ctx.rate,
  );
  const npv = sum(rows.map((r) => r.discountedIncrementalCashFlow));
  const flows = rows.map((r) => r.incrementalCashFlow);
  const discounted = rows.map((r) => r.discountedIncrementalCashFlow);
  const simplePayback = paybackOf(flows);
  const discountedPayback = paybackOf(discounted);

  const scale = sum(flows.map(Math.abs));
  const opByYear = ctx.years.slice(1).map((t) => diesel.series[t]!.operatingCost - green.series[t]!.operatingCost);
  const year1 = opByYear[0] ?? 0;

  // Break-even distance: how far the whole fleet has driven when cumulative savings reach zero.
  // Read off the year-by-year path (not an algebraic formula) because replacements and escalation make it non-linear.
  const breakEvenDistanceKm = simplePayback.years === null ? null : distanceAtTime(ctx.fleetDistanceKm, simplePayback.years);

  return {
    technology: id,
    additionalInitialInvestment: green.initialCapitalRequirement - diesel.initialCapitalRequirement,
    rows,
    npv,
    npvDirection: npvDirection(npv, scale),
    cumulativeSavings: sum(flows),
    simplePayback,
    discountedPayback,
    breakEvenYear: simplePayback.years,
    breakEvenDistanceKm,
    operatingSavings: {
      byYear: opByYear,
      year1,
      averageAnnual: sum(opByYear) / ctx.horizon,
      cumulative: sum(opByYear),
      year1Direction: savingsDirection(year1),
    },
  };
}
