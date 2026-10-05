# Sensitivity, scenario and threshold engine (Batch 6)

Three separate questions, three separate modules. All of them call the one authoritative pipeline
(`calculateAssessment`, through `evaluateInput`), so no TCO, NPV, operational or viability formula is repeated.
Policy v1.0, the financial formulas and the Batch 4 methodology are unchanged.

| Mode | Question | Module |
| --- | --- | --- |
| Sensitivity | What happens to the result if X changes? | `src/calculation/sensitivity/` |
| Scenario | How do coherent sets of assumptions compare? | `src/calculation/scenario/` |
| Threshold | What value of X reaches a target? | `src/calculation/threshold/` |

Shared: `src/calculation/analysis/` (`variables.ts` the variable registry, `evaluate.ts` the doorway to the engine and the `Snapshot`
type, `format.ts` display rounding).

## Immutability
Every analysis starts from the **Base Case**, the current normalized assessment. A variable's `set` clones the input
(`structuredClone`), changes the clone, and the clone goes back through the engine. The Base Case is never changed.
Tests freeze the input and compare its JSON before and after every operation.

## Variables (`variables.ts`)
Each has `applicable`, `get`, `set`, `invalid` (model validity) and `solverBounds`. A variable is exposed only if it can be changed correctly in the normalized input.

| Variable | How it is applied |
| --- | --- |
| Diesel price, electricity tariff, biofuel price | The price field. |
| BEV acquisition, biofuel acquisition or conversion cost | `upfrontVehicleCost` per vehicle. Replacement purchases and a percentage residual value follow it, as in the engine. |
| Annual distance | Sets annual distance and scales the daily distance in proportion (operating days fixed). The cost model and the operational checks see one duty and there are no contradictory distance inputs. |
| Operating days | Sets days and annual distance with the daily distance fixed, so route compatibility is unchanged. |
| BEV and biofuel maintenance | Per vehicle per year. |
| Discount rate | 0% to 100%. |
| Charging and biofuel infrastructure capital cost | The project total (equipment, installation, electrical upgrade or storage, refuelling, installation); changing it scales the items in proportion. The fleet pays only its share, as in the engine. |
| Purchase subsidy | An upfront grant per vehicle. Not applicable when the incentive is a percentage subsidy, a tax credit or "other" (their timing is undefined). Cannot exceed the vehicle purchase cost. |
| BEV range, charging downtime, payload reduction | Operational. They do not enter the cost figures. |
| Charging opportunity, biofuel availability | Categorical. Scenarios only. Never a number. |

Threshold variables (`THRESHOLD_VARIABLES`): BEV acquisition, electricity tariff, diesel price, annual distance, subsidy, charging infrastructure capital cost, BEV maintenance; biofuel acquisition, biofuel price, diesel price, annual distance, subsidy, biofuel infrastructure capital cost, biofuel maintenance. Range and payload reduction are searched for classification transitions and are given as operational remedies. Discount rate and operating days are sensitivity-only.

## Sensitivity
- `runSensitivityAnalysis({input, technology, variableId, range?})`. Only the chosen variable changes.
- **Prototype sensitivity range:** `-20%, -10%, base, +10%, +20%` (`DEFAULT_SENSITIVITY_RANGE`). A convention for exploring, labelled as such. Custom: percentage or absolute, min, max, 3 to 41 steps (`SENSITIVITY_LIMITS`). The base value is always included and marked.
- A zero base value gives `unavailable` for a percentage range ("Percentage sensitivity is unavailable because the base value is zero"). A value the model cannot use is rejected with the reason (`range_invalid`), never clamped.
- Each point returns the value, NPV, present-cost difference, TCO, TCO per km, both paybacks, economic case, operational status, classification and the emissions result as secondary information.
- Classification transitions between tested points are reported with the reason-code differences and described as rule boundaries.
- If the NPV crosses zero inside the tested values, the threshold solver is called and the solved NPV = 0 point is returned (`breakEven`).
- Interpretation sentences are fixed templates in conditional language ("under the tested assumptions").
- **Drivers (`runDriverAnalysis`)**: each economic variable at the low and high end of the same percentage range; `spread = max(NPV_high, NPV_low) - min(NPV_high, NPV_low)`; sorted descending. Labelled "Sensitivity influence under the tested ranges." Zero-base variables are listed as skipped with a reason; model limits are applied by pulling a value back and marking it `clamped`.
- **Two-way (`runTwoWaySensitivity`)**: only the pairs in `TWO_WAY_PAIRS`; at most 11 × 11 cells (default 5 × 5); returns an "Economic break-even frontier" (one solver run per x value). Combinations are not called commercially viable unless the classification column says so.

## Scenarios
`Scenario {id, name, description, origin: user | illustrative | threshold, overrides, createdAt, updatedAt}`. Only the overrides are stored. `compareScenarios(input, scenarios)` returns the Base Case and each scenario as `ScenarioResult` (changes from the Base Case, snapshot per technology, and deltas). Invalid overrides are reported and not calculated. Environmental changes alone cannot change a classification.
- Persistence: `src/calculation/scenario/storage.ts` (`createScenarioRepository`, key `greenfleet-viability-lab:scenarios`, versioned, corrupt data ignored), `src/state/scenarioStore.ts` (create, rename, update, duplicate, delete). Local only, no account. Apart from the assessment key.
- Limit: `MAX_SCENARIOS = 12`, a UI and performance limit that keeps the comparison readable. It has no scientific meaning. Over the limit, adding is refused with a message, and a comparison shows the first 12 and says how many were left out.
- Saved scenarios store absolute values and are applied to the current Base Case.
- `scenarioDraftFromThreshold` builds a scenario holding only the solved override ("Create Scenario at This Threshold").

## Threshold solver (`threshold/`)
`solveViabilityThreshold({input, technology, variableId, target})`, targets `economic_break_even` and `classification_transition`.

**Economic break-even** (`solve.ts`, `solver.ts`):
1. Read the current value and NPV. If |NPV| is within the value tolerance the current value is the threshold (`ALREADY_SATISFIED`, kind `at_threshold`).
2. Measure the slope with a small engine probe. A flat slope is `NOT_APPLICABLE`.
3. Move in the direction that drives the NPV toward zero (the improving direction when the NPV is negative, the deteriorating direction when it is positive, which gives a margin). Initial step: the larger of 5% of the current value and one millionth of the bound range. The step doubles up to 60 times, never beyond the solver bound. A sign change brackets the root. No sign change by the bound is `NOT_BRACKETED`.
4. Sample the bracket at 12 intervals; an NPV that rises and falls is `NON_MONOTONIC`.
5. Bisect until the bracket is below `1e-10` of max(1, |x|), or |NPV| is within `1e-9` of the diesel present cost, or 100 iterations (`MAX_ITERATIONS`).
6. Re-run the engine at the root. |NPV| must be within `1e-6` of the diesel present cost or the result is `VERIFICATION_FAILED`.
7. Report the full-precision value plus a display value rounded to about three significant figures.
Settings are `SOLVER_SETTINGS` in `threshold/types.ts` and are returned in each result.

**Solver bounds** (`variable.solverBounds`) are computational limits, not market limits: 0 to ten times the current value (a fixed ceiling when the current value is zero); subsidy 0 to the vehicle purchase cost; discount rate 0 to 100; operating days 1 to 366; annual distance 1 km up to ten times.

**Classification transition**: scan 48 points from the current value toward the bound in the direction that improves the label (or worsens it, for a VIABLE result), then bisect between the last unchanged and first changed point. Returns the nearest change, the gate that moved (economic, operational, both, conditions), reason codes added and removed, and the Policy v1.0 decision trace before and after. Numeric variables do not always reach VIABLE; the result can be CONDITIONALLY VIABLE with conditions listed. A scan that finds no change gives `BLOCKED_BY_OPERATIONAL_CONSTRAINT` (hard constraints), `BLOCKED_BY_OPEN_CONDITIONS` (conditions or uncertainties), `NOT_BRACKETED`, or `ALREADY_SATISFIED` for VIABLE (no deterioration found).

**Statuses**: `FOUND`, `ALREADY_SATISFIED`, `NOT_BRACKETED`, `NON_MONOTONIC`, `MAX_ITERATIONS`, `VERIFICATION_FAILED`, `INSUFFICIENT_DATA`, `NOT_APPLICABLE`, `BLOCKED_BY_OPERATIONAL_CONSTRAINT`, `BLOCKED_BY_OPEN_CONDITIONS`. A failure state has `thresholdValue: null` and never carries a number.

**Insufficient evidence**: nothing is solved. The result lists what is missing ("Complete these inputs before threshold analysis can be performed.").

## What would make it viable? (`analyze.ts`, `remedies.ts`)
`analyzeViability(input, technology)` reads the Policy v1.0 result for barriers (reason codes, not the label) and groups them as economic, operational and evidence. It then calls the solver.
- **NOT YET VIABLE**: economic break-even thresholds when the economics are unfavourable; operational remedies; evidence list; a note when more than one kind of barrier exists. If only an economic threshold is solved while a hard constraint remains, the text says: "Economic break-even alone does not make this configuration commercially viable because ... This would achieve economic break-even. The operational constraint would still need to be resolved before commercial viability can improve."
- **CONDITIONALLY VIABLE** ("What would make it fully viable?"): the conditions and uncertainties; classification thresholds toward VIABLE only when the economics are near break-even; no financial threshold is invented when the economics are already favourable.
- **VIABLE** ("Viability margin"): economic headroom and the nearest classification change per variable. Margins are not additive.
- **INSUFFICIENT EVIDENCE**: blocked.

**Operational remedies** are derived from the rules themselves and checked by re-running the engine: minimum range = the required route distance (or the daily distance when no route is entered), with no safety buffer; maximum payload reduction keeps the effective capacity at the average payload; for a day longer than the range, a range equal to the daily distance removes the need for daytime charging. Each carries "This is the minimum model threshold, not an engineering safety recommendation." Fuel availability, charging access and infrastructure are qualitative remedies only.

## Limitations
One variable at a time (plus the limited two-way grid); thresholds depend on the entered assumptions and are not forecasts; the classification scan reports the nearest change only and can miss a double crossing between two scan points (a non-monotonic scan is flagged); no Monte Carlo, optimisation, report export or AI. Typical cost: a full viability analysis is about 40 to 500 engine runs per technology, run on the page in well under a second.
