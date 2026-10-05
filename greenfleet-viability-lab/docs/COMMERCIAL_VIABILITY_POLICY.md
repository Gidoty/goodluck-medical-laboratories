# GreenFleet Commercial Viability Policy v1.0

Code: `src/calculation/viability/` (`policy.ts`, `economic.ts`, `classify.ts`, `types.ts`). Entry point:
`classifyCommercialViability(input, policy)`. It is pure and deterministic: same normalized input and same policy give the same
label, reason codes and trace. The engine calls it once per green alternative and returns `result.commercial.bev` and
`result.commercial.biofuel`. Diesel is the baseline and has no entry.

**These rules are prototype modelling policies for transparent comparative analysis. They are not universal investment laws and
no academic consensus is claimed for any threshold. A label is a model-based conclusion under user-supplied assumptions, not
investment advice and not a guarantee of profit.**

## Question answered
Under the user's stated operating, financial and infrastructure assumptions, is this green alternative commercially viable
relative to diesel? BEV and biofuel are each classified against diesel.

## No score
There is no weighted score, no points and no composite number. A label comes from ordered rules. Environmental performance is a
fourth dimension that is reported and never decides the label.

## The four labels (not the same as the Batch 4 operational statuses)
| Label | Meaning |
| --- | --- |
| VIABLE | Favourable economic case against diesel and no material unresolved operational constraint, condition or uncertainty. |
| CONDITIONALLY VIABLE | Potentially credible case, but a remediable condition, material uncertainty or dependency must be resolved, or the economics are near break-even. |
| NOT YET VIABLE | No sufficiently credible case under current assumptions: materially unfavourable economics, an unresolved hard operational constraint, or both. "Yet" because changing inputs may change the result. |
| INSUFFICIENT EVIDENCE | A critical item is missing or the economic results are inconsistent. Never forced into another label. |

## Decision order
1. **Gate 0, consistency.** NPV must agree in sign and size with the discounted cumulative incremental cash flow at the horizon
   and with the present-cost difference (tolerance 1e-6 of diesel present cost). An error gives INSUFFICIENT EVIDENCE with
   `RESULT_INCONSISTENT`. A positive NPV with no discounted payback is a warning only.
2. **Gate 1, evidence sufficiency.** Economic evidence must support the comparison. The operational status must not be
   "Insufficient data" (a critical unknown). Environmental evidence is not required.
3. **Gate 2, operational feasibility.** Mapping in `policy.operationalMapping`: Suitable = pass, Conditional = remediable
   condition, Constrained = hard constraint, Insufficient data = critical unknown. Any hard constraint gives NOT YET VIABLE.
4. **Gate 3, economic case.** Unfavourable gives NOT YET VIABLE. Near break-even gives CONDITIONALLY VIABLE. Favourable continues.
5. **Gate 4, conditions and uncertainties.** If any remain, CONDITIONALLY VIABLE. Otherwise VIABLE.

Ambiguity resolved: Gate 1 runs before the economic case, so a missing critical operational item gives INSUFFICIENT EVIDENCE even
when the NPV is negative. A hard constraint (Batch 4 rule 1) still outranks a missing item, because a conflict with the duty cycle
is already a conclusion.

## Economic case (internal categories)
`FAVOURABLE`, `NEAR_BREAK_EVEN`, `UNFAVOURABLE`, `INSUFFICIENT_DATA`.

- Primary indicator: incremental NPV versus diesel (Batch 3, unchanged). Supporting: present-cost difference, TCO difference,
  simple and discounted payback against the horizon, year-one operating saving. Payback never decides on its own.
- `NPV materiality ratio = NPV / denominator`. It only says how close the NPV is to zero. It is not a return on investment.
- **Denominator:** the additional initial investment (alternative Year-0 net cost minus diesel Year-0 net cost) when it is
  **positive** and at least **1%** of the diesel present cost. Otherwise the **diesel present cost**. If neither is usable
  (diesel present cost is zero), the case is INSUFFICIENT_DATA. Nothing is divided by zero.
- **Prototype near-break-even tolerance: ±5%** of that denominator. `|ratio| <= 5%` is `NEAR_BREAK_EVEN` (both sides, including
  an NPV of exactly zero). Above +5% is `FAVOURABLE`, below -5% is `UNFAVOURABLE`.
- **Numerical tolerance** is separate: `|NPV| <= 1e-9 x diesel present cost` is "zero within numerical tolerance". It only absorbs
  floating-point noise. The 5% is an economic policy choice.
- Green cheaper at Year 0 (additional investment zero or negative): payback is immediate, the denominator is the diesel present
  cost, and the reason code is `IMMEDIATE_ECONOMIC_ADVANTAGE`. No formula that needs a positive extra investment is used.
- Undiscounted advantage with a discounted NPV that is not positive is not rescued: it is near break-even only if the NPV is
  within the tolerance, otherwise unfavourable.

## Operational concepts
- **HardOperationalConstraint:** a Batch 4 check that is "constrained", meaning the entered requirement cannot be met by the
  configuration entered, and no remedy appears in the inputs (`identifiedRemedy: null`). Examples: a day longer than the BEV
  range with depot-only charging and no route detail showing recharging; a route longer than the range with depot-only charging;
  average payload above the effective BEV capacity; limited biofuel supply with required infrastructure not specified.
- **RemediableCondition:** a "conditional" check. Examples: daytime charging required (`DAYTIME_CHARGING_REQUIRED`), recharge at
  the depot between routes (`DEPOT_RECHARGE_BETWEEN_ROUTES`), charging arrangements inconsistent, intermittent or limited biofuel
  supply, required biofuel infrastructure not fully specified (`INFRASTRUCTURE_UNRESOLVED`).
- Infrastructure that is required, specified and costed is satisfied (its cost is already in the economics) and is not a condition.

## Critical and non-critical unknowns
| Critical (INSUFFICIENT EVIDENCE) | Non-critical (material uncertainty, CONDITIONALLY VIABLE) |
| --- | --- |
| BEV usable range or daily distance missing or invalid | Battery replacement requirement unknown (`BATTERY_REPLACEMENT_UNKNOWN`) |
| Day or a route longer than the range and charging availability unknown | BEV payload impact unknown |
| Biofuel availability unknown or not entered | Charging arrangement unknown |
| Economic results inconsistent or no cost base | Need for biofuel infrastructure unknown |

`policy.criticalChecks` mirrors Batch 4 rule 2 and a test keeps them aligned. Optional inputs that were left blank (route
distance, payload impact not stated) are not uncertainties. Their absence is listed as "not assessed" in the operational result.

Unknown battery replacement with a favourable economic case and a suitable operation gives CONDITIONALLY VIABLE: a lifecycle cost
that is not in the cost figures is unresolved. It is not treated as immaterial.

## Environmental independence
`environmentalAffectsClassification: false`. The environmental comparison is passed in and described (`LOWER_EMISSIONS`,
`HIGHER_EMISSIONS`, `NO_MATERIAL_EMISSIONS_DIFFERENCE`, `EMISSIONS_UNAVAILABLE`) but never read by any rule. "Equal" means equal
within numerical precision; there is no percentage threshold for a "material" difference. Tests change only the emission factors
across many scenarios and assert that the label, reasons, conditions, constraints and trace (apart from the environment lines)
are identical.

## Reason codes
`POSITIVE_NPV`, `NEGATIVE_NPV`, `NEAR_BREAK_EVEN`, `PAYBACK_WITHIN_HORIZON`, `NO_PAYBACK_WITHIN_HORIZON`,
`IMMEDIATE_ECONOMIC_ADVANTAGE`, `OPERATIONALLY_SUITABLE`, `DAYTIME_CHARGING_REQUIRED`, `DEPOT_RECHARGE_BETWEEN_ROUTES`,
`ROUTE_EXCEEDS_RANGE`, `RANGE_EXCEEDED_DEPOT_ONLY`, `PAYLOAD_CONSTRAINT`, `PAYLOAD_IMPACT_UNKNOWN`, `CHARGING_UNRESOLVED`,
`BIOFUEL_SUPPLY_INTERMITTENT`, `BIOFUEL_SUPPLY_LIMITED`, `BIOFUEL_SUPPLY_CONSTRAINED`, `INFRASTRUCTURE_UNRESOLVED`,
`INFRASTRUCTURE_UNKNOWN`, `BATTERY_REPLACEMENT_UNKNOWN`, `CRITICAL_DATA_MISSING`, `RESULT_INCONSISTENT`, `LOWER_EMISSIONS`,
`HIGHER_EMISSIONS`, `NO_MATERIAL_EMISSIONS_DIFFERENCE`, `EMISSIONS_UNAVAILABLE`.
The sentences shown to users are generated from these codes by fixed templates in `classify.ts`. No AI is involved.

## Result model (`CommercialViabilityResult`)
`technology`, `baselineTechnology`, `policyVersion`, `policyId`, `classification`, `economicCase`, `operationalStatus`,
`economic` (NPV, ratio, denominator, tolerance, payback, diagnostics), `environmentalContext`, `primaryReason`, `reasonCodes`,
`supportingEvidence`, `conditions`, `uncertainties`, `hardConstraints`, `criticalMissing`, `recommendedNextSteps`,
`evidenceCompleteness`, `decisionTrace`. It is plain JSON, ready to be saved with a scenario later.

## Limitations
Depends entirely on the user's inputs. No market data, tax, revenue, financing or risk. The 5% and 1% parameters are prototype
choices. The label does not say how far an input must move to change it (a later stage). Limited biofuel supply on its own is
treated as a condition because no required fuel volume is collected. Interpretation by an AI, sensitivity analysis, thresholds,
scenarios and export are not part of this batch.
