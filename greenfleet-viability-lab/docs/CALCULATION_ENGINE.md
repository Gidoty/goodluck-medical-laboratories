# Calculation engine (Batch 3)

Location: `src/calculation/`. Pure TypeScript: no React, no browser APIs, no I/O, no randomness.
Entry point: `calculateAssessment(input: NormalizedAssessmentInput): CalculationOutcome`.
Glue from stored form data: `runAssessment(assessment)` in `src/domain/runAssessment.ts`.

## Perspective

The **asset / project** perspective. Loan principal, interest and the debt/equity split are stored but never enter the
primary result, so the comparison does not depend on how vehicles are financed and acquisition is never counted twice.

## Modules

| File | Role |
| --- | --- |
| `input-checks.ts` | Runtime validation of the normalized input. Returns plain-language errors instead of NaN or a crash. |
| `specs.ts` | Turns normalized inputs into a technology-neutral `TechSpec` (diesel, BEV, biofuel builders). Records assumptions and warnings. |
| `assemble.ts` | Technology-neutral cost model: builds the year-by-year cost series from a `TechSpec`. Knows nothing about diesel or BEV. |
| `compare.ts` | Incremental case (alternative vs diesel): cash flows, NPV, payback, break-even, operating savings. |
| `finance.ts` | Pure arithmetic: discount factors, escalation, replacement schedule, payback, interpolation. |
| `types.ts` | The result model. |
| `notes.ts` | Fixed methodology statements shown with the results. |

## Conventions

- Year 0 = purchase date (not discounted). Years 1..T = operating years, cash flows at year end.
- Costs are positive; incentives and residual value are negative entries in a cost series.
- Rates are decimals inside the engine (the input uses 0..100).
- Net cash cost in a year = vehicle + replacement + infrastructure + battery + operating - incentives - residual.
- `incremental cash flow_t = diesel net cash cost_t - alternative net cash cost_t` (positive = alternative cheaper).
- NPV = sum of incremental cash flow_t / (1 + r)^t.
- Utilisation is constant (the distance series is an array so later batches can vary it).

## Rules worth knowing

- **Charging loss L:** grid energy = vehicle energy / (1 - L).
- **Escalation:** applied only if entered. A blank is held constant and recorded as a *missing* assumption (distinct from an entered 0%).
- **Vehicle replacement:** a new vehicle at every `k x life` strictly before T (none at exactly T); non-integer lives are placed at the end of the year they expire; price unchanged.
- **Battery replacement:** only "Yes" adds cost, repeated in each vehicle cycle; "Unknown" and unanswered are excluded and warned about.
- **Residual value:** user-supplied, at the end of T, for the asset in service; no straight-line invention.
- **Infrastructure:** project totals, share = min(1, fleet / vehicles using it), paid once at Year 0; replacement and terminal value not modelled (warned).
- **Incentives:** only those entered. Grants and subsidies at Year 0 on the first purchase; tax credits and "other" are excluded (timing undefined).
- **Payback:** first year the running total of incremental cash flow reaches zero, interpolated; `immediate` if there is no deficit at Year 0; `not_achieved` (null years) otherwise. `sustained` reports whether it stays non-negative afterwards.
- **Not modelled:** financing, tax, revenue/IRR, general inflation, maintenance inflation, emissions, operational feasibility, classification.

## Verification

`src/calculation/fixtures.ts` documents **Verification Case 1** (0% discount; every figure hand-checkable) and
`engine.test.ts` contains **Verification Case 2** (10% discount, escalation, replacement, residual, incentives, shared
infrastructure) checked against an independent loop-based script. All values are abstract currency units, not market data.
