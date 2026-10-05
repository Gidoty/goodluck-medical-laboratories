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
| `environmental/` | Batch 4. Operational energy/fuel-related emissions (`index.ts`, `units.ts`, `types.ts`). Reads only the normalized input. |
| `operational/` | Batch 4. Rule-based BEV and biofuel feasibility (`bev.ts`, `biofuel.ts`, `status.ts`, `index.ts`). Reads only the normalized input. |
| `completeness.ts` | Three separate data-completeness states (economic, operational, environmental). |
| `viability/` | Batch 5. Commercial Viability Policy v1.0: economic case, gates, classification, reason codes, trace. See `docs/COMMERCIAL_VIABILITY_POLICY.md`. |
| `dimensions.ts` | Side-by-side summary per alternative. Copies each layer's own answer; no combined verdict. |

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
- **Not modelled:** financing, tax, revenue/IRR, general inflation, maintenance inflation, classification, sensitivity, carbon pricing.

## Verification

`src/calculation/fixtures.ts` documents **Verification Case 1** (0% discount; every figure hand-checkable) and
`engine.test.ts` contains **Verification Case 2** (10% discount, escalation, replacement, residual, incentives, shared
infrastructure) checked against an independent loop-based script. All values are abstract currency units, not market data.

## Batch 4: two further layers (independent of the economic engine)

Three questions are answered separately and never merged: **economic attractiveness** (NPV, TCO), **operational feasibility**
(can it do the work) and **environmental performance** (estimated operational emissions). No layer reads another layer's output.
The environmental and operational engines take the normalized input only. There is no score, no weighting and no classification.

### Environmental (`src/calculation/environmental/`)
- `emissions (kg CO2e) = physical quantity x user-supplied factor`. The physical quantity is the same litres or kWh the cost model uses (a test checks this).
- BEV grid kWh = delivered kWh / (1 - charging loss). Without a loss rate, none is applied and a note says so.
- `change % = (diesel - alternative) / diesel x 100`; positive is labelled "Emissions reduction", negative "Emissions increase".
- Canonical unit kg CO2e. Factor units are read from the unit id (`kgco2e_per_litre`, `gco2e_per_kwh`, `kgco2_per_litre`, ...): g converts to kg, a CO2-only factor is flagged, and a unit that does not match the physical quantity (litre, kg, m3, kWh) makes that technology **unavailable** rather than guessed.
- No factor ships with the software. A missing factor means "unavailable", never zero.
- Scope labels (direct, fuel cycle, lifecycle, not stated) are recorded; a mismatch between compared factors is warned about. Provenance counts only when source text is present.
- Lifecycle adjustment is recorded and warned about but **not applied** (how to apply it is undefined). No embodied emissions, no carbon price, no monetisation.

### Operational (`src/calculation/operational/`)
- Check statuses: satisfied, conditional, constrained, insufficient, not_assessed. Overall: Suitable, Conditional, Constrained, Insufficient data (`status.ts`, `overallStatus`).
- Rule 1: any constrained check gives Constrained. Rule 2: a core check with insufficient data (or a must-be-assessed check not assessed) gives Insufficient data. Rule 3: any conditional or unknown check gives Conditional. Rule 4: Suitable. The rule used is returned in `ruleTrace`.
- BEV: range (daily distance vs usable range, no safety buffer), single route, charging, payload (core checks: range and route). Biofuel: supply (core, must be assessed) and infrastructure. Diesel is reported as "baseline".
- Charging time, refuelling distance and downtime are shown as entered (downtime per month x 12). None is priced.
- Completeness counts answered evidence items against an explicit total; "unknown" does not count.

## Batch 5: commercial classification

After the three layers are computed, `classifyCommercialViability` is called once per green alternative and returns `result.commercial`. It reads the Batch 3 incremental results, the Batch 4 operational result and the completeness summary. It reads the environmental comparison only to describe it. The Batch 3 formulas are untouched. Details: `docs/COMMERCIAL_VIABILITY_POLICY.md`.

## Batch 6: analysis on top of the engine

`sensitivity/`, `scenario/` and `threshold/` (with shared `analysis/`) change a clone of the normalized input and call `calculateAssessment` again. They add no formula. See `docs/SENSITIVITY_AND_THRESHOLD_ENGINE.md`.
