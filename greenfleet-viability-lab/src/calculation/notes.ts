/** Statements the results page must be able to show next to any number. Kept in one place. */
export const METHODOLOGY_NOTES: readonly string[] = [
  "Primary GreenFleet project economics evaluate the underlying asset independently of financing structure to avoid double-counting acquisition and financing costs. Loan repayments, interest and the debt/equity split are stored but not used here.",
  "Where escalation is supplied for selected costs only, results represent a scenario based on those specific escalation assumptions rather than a complete economy-wide inflation model. Prices and rates are used exactly as entered; nothing is inflated without your input.",
  "Tax effects are excluded from the current prototype (no corporate tax, depreciation tax shields, VAT recovery or capital allowances).",
  "This is a cost comparison. Diesel and the alternatives are assumed to do the same transport work, so no revenue is modelled and no internal rate of return is calculated.",
  "Maintenance and other operating costs are held at their entered nominal values. No maintenance inflation is assumed.",
  "Financial results do not establish operational feasibility, and they do not say anything about environmental performance.",
];

export const ENGINE_VERSION = "1.0.0";
