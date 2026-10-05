# Requirements traceability matrix

GreenFleet MSc Prototype v1.0. Requirement, implementation and verification in one place, for academic and software traceability.

**How to read it.** Each row names one requirement, where it is implemented (`src/...`), and the tests that verify it. In the Tests column a path is a test or QA file and each quoted phrase is the title of a `describe` or `it` block (or a check name in `e2e/qa.cjs`) inside one of the listed files. `src/validation/traceability.test.ts` parses this file and fails if a listed path does not exist, a quoted title cannot be found in a listed file, or a status is not one of the allowed values. The matrix therefore cannot silently go stale.

**Status values.** `PASS` means the requirement is implemented and every listed check passes. `PASS (limitation)` means it passes within a stated, documented limit. `PASS (defect fixed)` means a Batch 8 test found a defect, the fix is in the code, and the regression test is listed.

**What this matrix is not.** It is not a claim about real-world accuracy. It shows that the prototype does what its documentation says, and that the checks exist.

Requirement documents: `docs/NORMALIZED_INPUT.md`, `docs/CALCULATION_ENGINE.md`, `docs/COMMERCIAL_VIABILITY_POLICY.md`, `docs/USER_GUIDANCE_SYSTEM.md`, `docs/SENSITIVITY_AND_THRESHOLD_ENGINE.md`, `docs/REPORTING_AND_PRESENTATION.md`, `docs/VALIDATION_AND_VERIFICATION.md`.

## Inputs

| ID | Requirement | Implementation | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GF-INP-001 | Zero, missing, not applicable and unknown are four different states and are never merged. | `src/domain/fieldValue.ts`, `src/domain/validation.ts` | `src/domain/inputs.test.ts` "zero, missing, not applicable and unknown"; `src/domain/validation.test.ts` "zero, missing and not applicable are different" | PASS | |
| GF-INP-002 | Free-text numbers that are not finite numbers (NaN, Infinity, 1e400, thousands separators) are refused; 0 is a value. | `src/domain/fieldValue.ts` | `src/validation/adversarial.test.ts` "Free-text numeric input parsing" | PASS | |
| GF-INP-003 | Every numeric field survives hostile values (0, tiny, huge, negative, 100%, over 100%, NaN, Infinity) without a crash or a non-finite result. | `src/domain/checks.ts`, `src/domain/schema/fields.ts`, `src/domain/normalize.ts` | `src/validation/adversarial.test.ts` "Every numeric field survives hostile values" | PASS | A non-finite value read from storage is treated as not entered. |
| GF-INP-004 | Logically impossible relationships are blocked by the current validation rules (horizon, life, fleet size, operating days, charging loss, battery year, payload, debt plus equity). | `src/domain/checks.ts`, `src/domain/validation.ts` | `src/validation/adversarial.test.ts` "Invalid relationships (current validation rules)" | PASS (limitation) | No rule links route distance to daily distance. None was invented. Residual above price is a warning, not an error. |
| GF-INP-005 | The engine reads one normalized input, produced only when every blocking issue is resolved. | `src/domain/normalize.ts`, `src/domain/runAssessment.ts` | `src/domain/inputs.test.ts` "normalized output"; `src/domain/run.test.ts` "from form inputs to the engine" | PASS | |
| GF-INP-006 | Names with long text, Unicode, markup and formula characters do not break validation, the engine or the exports. | `src/domain/normalize.ts`, `src/reporting/exports.ts` | `src/validation/adversarial.test.ts` "Free-text names: long, Unicode and special characters" | PASS | |
| GF-INP-007 | Five labelled synthetic demonstration cases load through the real form path and are visibly marked as synthetic. | `src/domain/demo.ts`, `src/components/assessment/start-actions.tsx` | `src/validation/demo-cases.test.tsx` "The five synthetic demonstration cases"; `e2e/qa.cjs` "wizard shows the required notice" | PASS | |

## Economics

| ID | Requirement | Implementation | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GF-ECO-001 | Diesel is the baseline. Incremental cash flow is diesel minus alternative. | `src/calculation/compare.ts` | `src/validation/benchmarks.test.ts` "the incremental cash flow is always diesel minus green"; `src/calculation/engine.test.ts` "incremental analysis" | PASS | |
| GF-ECO-002 | Annual fuel and energy quantity and cost, per technology. | `src/calculation/specs.ts` | `src/validation/benchmarks.test.ts` "Benchmark 1: simple hand-calculable case" | PASS | Expected values are written as plain arithmetic in the test. |
| GF-ECO-003 | Year 0 is not discounted; years 1 to T are discounted at (1+r)^t. | `src/calculation/finance.ts` | `src/validation/benchmarks.test.ts` "Benchmark 1b: the same case at a 10% discount rate" | PASS | |
| GF-ECO-004 | Undiscounted TCO, present cost and cost per km (fleet horizon distance denominator). | `src/calculation/assemble.ts` | `src/validation/benchmarks.test.ts` "Cost-per-km validation" | PASS | |
| GF-ECO-005 | A replacement vehicle is bought at each k times life strictly before T, and never at exactly T. | `src/calculation/finance.ts`, `src/calculation/assemble.ts` | `src/validation/benchmarks.test.ts` "no vehicle replacement exactly at the final horizon year" | PASS | |
| GF-ECO-006 | Battery replacement follows the vehicle-cycle convention and is paid at exactly the horizon but not beyond it. | `src/calculation/assemble.ts` | `src/validation/benchmarks.test.ts` "battery replacement follows the cycle convention" | PASS | |
| GF-ECO-007 | Residual value is credited once, at year T, for the vehicle in service. | `src/calculation/specs.ts` | `src/validation/benchmarks.test.ts` "residual value is credited once" | PASS | |
| GF-ECO-008 | Infrastructure cost share is min(1, fleet / vehicles using the chargers), paid at year 0; utilisation and charger count are not multipliers. | `src/calculation/specs.ts` | `src/validation/benchmarks.test.ts` "Benchmark 3: infrastructure allocation" | PASS | |
| GF-ECO-009 | Price in year t is the year-1 price times (1+g)^(t-1); maintenance is not escalated; a blank escalation is disclosed as missing. | `src/calculation/specs.ts`, `src/calculation/finance.ts` | `src/validation/benchmarks.test.ts` "Benchmark 4: price escalation, year indexing and compounding" | PASS | |
| GF-ECO-010 | Loan principal, interest and the debt/equity split never enter project TCO or NPV. | `src/calculation/engine.ts` | `src/validation/benchmarks.test.ts` "Financing boundary" | PASS | The UI and Methodology state the boundary as project and asset economics. |
| GF-ECO-011 | Positive incremental NPV means an advantage of the green alternative; negative means a disadvantage. | `src/calculation/compare.ts`, `src/calculation/finance.ts` | `src/validation/benchmarks.test.ts` "NPV sign convention" | PASS | |
| GF-ECO-012 | Payback is immediate, achieved (interpolated) or not achieved (null, never zero). | `src/calculation/finance.ts` | `src/validation/benchmarks.test.ts` "Payback validation"; `src/calculation/finance.test.ts` "payback" | PASS | |
| GF-ECO-013 | Grid energy is delivered energy divided by (1 - loss); a loss of 100% or more, or below 0, is refused. | `src/calculation/specs.ts`, `src/calculation/input-checks.ts` | `src/validation/benchmarks.test.ts` "Charging-loss validation" | PASS | |
| GF-ECO-014 | Zero or missing distance is refused; no division by zero. | `src/calculation/input-checks.ts` | `src/validation/benchmarks.test.ts` "zero or missing distance is rejected by the engine" | PASS | |
| GF-ECO-015 | Arithmetic that overflows is refused with a message, never shown as Infinity or NaN (defect D-2). | `src/calculation/engine.ts`, `src/calculation/finite.ts` | `src/validation/adversarial.test.ts` "Defect D-2 / D-3 regressions" | PASS (defect fixed) | |
| GF-ECO-016 | A vanishing vehicle life cannot make the schedule loops run for billions of iterations (defect D-3). | `src/calculation/input-checks.ts`, `src/calculation/finite.ts` | `src/validation/adversarial.test.ts` "a vanishingly short useful life is refused" | PASS (defect fixed) | Limit: 1,000 replacement events. |
| GF-ECO-017 | Rounding is for display only; a non-zero amount below one unit is never displayed as zero. | `src/lib/format.ts` | `src/lib/format.test.ts` "Batch 8 rounding audit" | PASS | |
| GF-ECO-018 | Identical inputs give identical outputs; the calculation uses no randomness or clock. | `src/calculation/` | `src/validation/adversarial.test.ts` "Determinism" | PASS | |
| GF-ECO-019 | The calculation never writes to its input, and a result is independent of later edits to the input. | `src/calculation/engine.ts` | `src/validation/adversarial.test.ts` "Mutation safety: frozen inputs and results" | PASS | |

## Operations

| ID | Requirement | Implementation | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GF-OPS-001 | A daily distance equal to the usable range is satisfied with a margin of exactly 0; no safety buffer exists. | `src/calculation/operational/bev.ts` | `src/validation/env-ops.test.ts` "BEV operational boundaries: exact equality semantics" | PASS | The boundary is a model compatibility threshold, not an engineering safety recommendation. |
| GF-OPS-002 | A route equal to the range is satisfied; longer is constrained, conditional or insufficient by charging access. | `src/calculation/operational/bev.ts` | `src/validation/env-ops.test.ts` "route distance below / equal to / above the range"; `src/calculation/operational/bev.test.ts` "BEV single routes versus the whole day" | PASS | |
| GF-OPS-003 | An average payload equal to the effective capacity is satisfied; above is constrained. | `src/calculation/operational/bev.ts` | `src/validation/env-ops.test.ts` "payload below / equal to / above the effective capacity" | PASS | |
| GF-OPS-004 | Charging arrangement contradictions are conditions; unknown is insufficient. | `src/calculation/operational/bev.ts` | `src/validation/env-ops.test.ts` "charging arrangements: contradiction is a condition" | PASS | |
| GF-OPS-005 | Biofuel availability and infrastructure are categorical and never become numeric thresholds. | `src/calculation/operational/biofuel.ts` | `src/validation/env-ops.test.ts` "Biofuel operational benchmarks (categorical, never numeric thresholds)" | PASS | |
| GF-OPS-006 | Overall operational status follows the four rules in order. | `src/calculation/operational/status.ts` | `src/calculation/operational/bev.test.ts` "BEV overall status and robustness" | PASS | |
| GF-OPS-007 | Charging time, extra refuelling distance and downtime are shown as entered and never priced. | `src/calculation/operational/` | `src/validation/env-ops.test.ts` "refuelling burden and downtime are shown as entered" | PASS | |

## Environment

| ID | Requirement | Implementation | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GF-ENV-001 | Emissions equal physical quantity times a compatible factor, in kg CO2e, with tonnes for display. | `src/calculation/environmental/index.ts` | `src/validation/env-ops.test.ts` "Environmental benchmark: physical quantity x compatible factor" | PASS | |
| GF-ENV-002 | Grams convert to kilograms; litre, kg, m3 and kWh factors apply only to their own quantity. | `src/calculation/environmental/units.ts` | `src/validation/env-ops.test.ts` "Environmental unit handling" | PASS | |
| GF-ENV-003 | A missing, incompatible, invalid or overflowing factor makes the result unavailable, never zero. | `src/calculation/environmental/index.ts` | `src/validation/env-ops.test.ts` "Environmental missingness"; `src/validation/adversarial.test.ts` "an emission factor that overflows makes the emissions unavailable" | PASS | |
| GF-ENV-004 | An unstated scope is "not stated", never lifecycle; a lifecycle adjustment is recorded but not applied. | `src/calculation/environmental/index.ts` | `src/validation/env-ops.test.ts` "an unstated scope is 'not stated', never lifecycle" | PASS | |
| GF-ENV-005 | Emissions are described as estimated operational energy/fuel-related emissions, never lifecycle, zero-emission or carbon-neutral. | `src/calculation/environmental/index.ts`, `src/reporting/limitations.ts` | `src/validation/audit.test.ts` "Unsupported-claim audit of user-facing text" | PASS | |

## Commercial classification

| ID | Requirement | Implementation | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GF-VIA-001 | An environmental result cannot alter the Policy v1.0 classification. | `src/calculation/viability/classify.ts`, `src/calculation/viability/policy.ts` | `src/validation/policy.test.ts` "Environmental independence stress test"; `src/validation/demo-cases.test.tsx` "Final end-to-end case F" | PASS | Ten factor sets, four categories, every operational state. |
| GF-VIA-002 | The four labels follow a hierarchy of ordered rules, with no score, for every combination of economics, operation and uncertainty. | `src/calculation/viability/classify.ts` | `src/validation/policy.test.ts` "Policy v1.0: exhaustive decision table" | PASS | 32 combinations plus a no-score check. |
| GF-VIA-003 | Evidence sufficiency is judged before the economic case: negative NPV with critical operational evidence missing gives INSUFFICIENT EVIDENCE. | `src/calculation/viability/classify.ts` | `src/validation/policy.test.ts` "Policy v1.0: gate order" | PASS | |
| GF-VIA-004 | An insufficient-evidence result still discloses that the available economic evidence is unfavourable, as information only (defect D-1). | `src/calculation/viability/classify.ts`, `src/reporting/executive.ts`, `src/components/results/commercial-sections.tsx` | `src/validation/policy.test.ts` "the output still discloses that the available economic evidence is unfavourable"; `src/validation/demo-cases.test.tsx` "the gate-order disclosure" | PASS (defect fixed) | Disclosure only. No classification rule changed. |
| GF-VIA-005 | Near break-even is within plus or minus 5% of the denominator; the denominator rule, the 1% floor and the exact boundaries behave as documented. | `src/calculation/viability/economic.ts` | `src/validation/policy.test.ts` "Near-break-even tolerance (prototype value 5%) and denominator selection" | PASS | Floating-point tolerance is a separate constant. |
| GF-VIA-006 | Economic break-even (NPV = 0) does not imply VIABLE. | `src/calculation/viability/classify.ts` | `src/validation/policy.test.ts` "NPV break-even does not imply VIABLE (Policy v1.0 governs)" | PASS | |
| GF-VIA-007 | Economic, operational and evidence barriers are grouped separately, and a combination says money alone is not enough. | `src/calculation/threshold/analyze.ts` | `src/validation/analysis.test.ts` "Multiple-barrier validation (economic, operational, evidence)" | PASS | All seven combinations. |
| GF-VIA-008 | The prototype version is separate from the policy version. | `src/reporting/identity.ts`, `src/calculation/viability/policy.ts` | `src/validation/audit.test.ts` "Version identifiers are separate and consistent" | PASS | |

## Guidance

| ID | Requirement | Implementation | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GF-GUI-001 | Help content comes from one registry, covers every page and feature, and has no obsolete wording. | `src/guidance/content.ts`, `src/guidance/registry.ts` | `src/guidance/guidance.test.tsx` "guidance registry"; `src/validation/audit.test.ts` "there are no debug logs or leftover TODO / FIXME markers" | PASS | |
| GF-GUI-002 | Welcome, Quick Tour and Restart Tour behave as documented. | `src/guidance/` | `src/guidance/guidance.test.tsx` "onboarding state: first visit, skip, complete, dismiss, restart"; `e2e/qa.cjs` "tour: opens as a dialog with focus inside" | PASS | |
| GF-GUI-003 | One core disclaimer is shared by Help, About, the report and the export metadata. | `src/reporting/identity.ts`, `src/guidance/content.ts` | `src/validation/audit.test.ts` "Help and the report share the single core disclaimer" | PASS | |
| GF-GUI-004 | Demonstration values always carry the required synthetic-values notice. | `src/domain/demo.ts` | `src/validation/demo-cases.test.tsx` "the required disclosure sentence is exact" | PASS | |

## Sensitivity

| ID | Requirement | Implementation | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GF-SEN-001 | Only the selected variable changes in a one-way sensitivity. | `src/calculation/analysis/variables.ts`, `src/calculation/sensitivity/index.ts` | `src/validation/analysis.test.ts` "only the selected variable changes" | PASS | |
| GF-SEN-002 | The default range is -20%, -10%, base, +10%, +20%; the base value is always included; a custom range works; a zero base refuses a percentage range. | `src/calculation/sensitivity/index.ts` | `src/validation/analysis.test.ts` "One-way sensitivity validation" | PASS | |
| GF-SEN-003 | Driver impact is max(NPV high, NPV low) minus min, with no weighting, sorted largest first. | `src/calculation/sensitivity/index.ts` | `src/validation/analysis.test.ts` "Driver ranking: a synthetic case with an obvious order" | PASS | Closed-form spreads 5,200 / 2,000 / 1,000 / 1,000 / 400. |
| GF-SEN-004 | Sensitivity influence is never presented as causal importance. | `src/calculation/sensitivity/index.ts` | `src/validation/analysis.test.ts` "is labelled as influence under the tested ranges and never as causal importance" | PASS | |
| GF-SEN-005 | Two-way grid cells equal the engine's NPV. | `src/calculation/sensitivity/index.ts` | `src/validation/analysis.test.ts` "two-way grid cells equal the closed form" | PASS | |
| GF-SEN-006 | The Base Case is never mutated by any analysis. | `src/calculation/analysis/evaluate.ts` | `src/calculation/analysis/batch6.test.ts` "immutability: the Base Case is never changed"; `src/validation/adversarial.test.ts` "Mutation safety: frozen inputs and results" | PASS | |

## Scenarios

| ID | Requirement | Implementation | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GF-SCN-001 | A scenario is the Base Case plus overrides, applied to a clone; scenario values never leak into the Base Case or another scenario. | `src/calculation/scenario/index.ts` | `src/validation/analysis.test.ts` "scenario values never leak into the base assessment or into other scenarios" | PASS | |
| GF-SCN-002 | Duplicate, rename, delete and the 12-scenario limit behave as documented. | `src/calculation/scenario/index.ts` | `src/validation/analysis.test.ts` "duplicate, rename and delete are pure list operations" | PASS | |
| GF-SCN-003 | Corrupt, hostile or unwritable scenario storage is tolerated. | `src/calculation/scenario/storage.ts` | `src/validation/analysis.test.ts` "corrupt persistence is ignored" | PASS | |
| GF-SCN-004 | A scenario created from a solved threshold holds exactly one override and reproduces the threshold. | `src/calculation/scenario/index.ts` | `src/validation/demo-cases.test.tsx` "Final end-to-end case G: a scenario derived from a solved threshold" | PASS | |

## Thresholds

| ID | Requirement | Implementation | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GF-THR-001 | The numerical economic break-even agrees with the analytical solution to a relative error below 1e-6. | `src/calculation/threshold/solve.ts` | `src/validation/analysis.test.ts` "Economic threshold: analytical solution vs GreenFleet's numerical solution" | PASS | Five variables. |
| GF-THR-002 | Economic break-even does not automatically imply commercial viability. | `src/calculation/threshold/analyze.ts` | `src/validation/analysis.test.ts` "economic break-even is not commercial viability"; `src/validation/demo-cases.test.tsx` "economic break-even is solved but is explicitly not enough" | PASS | |
| GF-THR-003 | The root solver brackets, checks monotonicity, bisects, honours its tolerance and iteration cap, and caches evaluations. | `src/calculation/threshold/solver.ts` | `src/validation/analysis.test.ts` "Root solver mechanics on synthetic monotonic functions" | PASS | |
| GF-THR-004 | A failure state never carries a number. | `src/calculation/threshold/solve.ts` | `src/validation/analysis.test.ts` "failure states in the full solver never carry a number" | PASS | |
| GF-THR-005 | A viability margin has the right direction, percentage and unit, and is not a forecast. | `src/calculation/threshold/analyze.ts` | `src/validation/analysis.test.ts` "Viability margin: directional correctness (not a forecast)" | PASS | |
| GF-THR-006 | Operational remedies give the rule's own boundary, with no safety buffer, and are verified by the engine. | `src/calculation/threshold/remedies.ts` | `src/validation/demo-cases.test.tsx` "an economic break-even threshold is found, and a range remedy is shown" | PASS | |
| GF-THR-007 | Insufficient evidence blocks threshold solving and lists the missing inputs. | `src/calculation/threshold/analyze.ts` | `src/validation/demo-cases.test.tsx` "threshold solving is blocked for both technologies" | PASS | |

## Reporting

| ID | Requirement | Implementation | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GF-REP-001 | The report, presentation and exports show the same underlying values as the Results page. | `src/reporting/model.ts`, `src/reporting/cells.ts` | `src/validation/outputs.test.tsx` "Results / report / presentation / CSV / JSON show the same underlying values" | PASS | NPV, TCO, present cost, cost per km, payback, operational status, emissions, classification, policy version. |
| GF-REP-002 | Evidence quality is descriptive; no score and no confidence percentage. | `src/reporting/evidence.ts` | `src/reporting/reporting.test.tsx` "evidence quality: descriptive states, no score" | PASS | |
| GF-REP-003 | The report carries the exact disclaimer, the prototype version and the policy version. | `src/reporting/identity.ts`, `src/components/report/report-document.tsx` | `src/validation/outputs.test.tsx` "carries the exact core disclaimer, the prototype version and the policy version" | PASS | |
| GF-REP-004 | The Group 8 attribution appears in the generated report only. | `src/reporting/identity.ts` | `src/reporting/reporting.test.tsx` "report page and attribution" | PASS | |
| GF-REP-005 | Print output hides navigation, toolbar and Help, keeps headings and tables readable, and shows the disclaimer and attribution. | `src/app/globals.css`, `src/components/report/report-document.tsx` | `e2e/qa.cjs` "print: navigation absent" | PASS | |
| GF-REP-006 | Building a report never changes the result, the input or the stored analysis. | `src/reporting/model.ts` | `src/validation/outputs.test.tsx` "building the model, the exports and every presentation screen from frozen data changes nothing" | PASS | |

## Exports

| ID | Requirement | Implementation | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GF-EXP-001 | CSV has a BOM, CRLF rows, a metadata block, one header and equal column counts; values are raw numbers with a status column. | `src/reporting/exports.ts` | `src/validation/outputs.test.tsx` "CSV validation" | PASS | |
| GF-EXP-002 | Text starting with = + - @ is defused; legitimate negative numbers are untouched. | `src/reporting/exports.ts` | `src/validation/outputs.test.tsx` "hostile assessment and scenario names are quoted, escaped and defused" | PASS | |
| GF-EXP-003 | Filenames are safe for every hostile name and are deterministic. | `src/reporting/exports.ts` | `src/validation/outputs.test.tsx` "Filename security" | PASS | |
| GF-EXP-004 | The exported normalized input re-evaluates to the exported results. | `src/reporting/exports.ts` | `src/validation/outputs.test.tsx` "JSON export reproducibility (no import feature required)" | PASS | |
| GF-EXP-005 | Downloads are built in the browser and sent nowhere. | `src/reporting/download.ts` | `src/validation/audit.test.ts` "downloads are built in the browser from a Blob" | PASS | |

## Presentation

| ID | Requirement | Implementation | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GF-PRE-001 | Ten screens in the documented order; screens with nothing true to show are skipped. | `src/reporting/presentation.ts` | `src/validation/outputs.test.tsx` "Presentation Mode: full sequence and skipped screens" | PASS | |
| GF-PRE-002 | Arrow keys move one screen, Escape exits, the ends hold, and nothing auto-advances. | `src/reporting/presentation.ts`, `src/components/present/presentation-view.tsx` | `src/reporting/reporting.test.tsx` "presentation mode"; `e2e/qa.cjs` "presentation does not run past the last screen" | PASS | |
| GF-PRE-003 | Body text is at least 14 px and nothing overflows horizontally at 1366x768, 1440x900, 1920x1080 and 390 px. | `src/components/present/presentation-view.tsx` | `e2e/qa.cjs` "presentation: no body text under 14px" | PASS (limitation) | At 1366x768 three of ten screens need vertical scrolling. |
| GF-PRE-004 | An insufficient-evidence result is not turned into a conclusion in the presentation. | `src/components/present/presentation-view.tsx` | `src/validation/outputs.test.tsx` "insufficient evidence: the presentation does not fabricate a conclusion" | PASS | |

## Accessibility and responsiveness

| ID | Requirement | Implementation | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GF-ACC-001 | No WCAG 2 A/AA violation (including colour contrast) on any route, at desktop and phone width, or in the Welcome dialog, Help drawer and scenario builder. | `src/app/globals.css`, `src/components/ui/` | `e2e/qa.cjs` "axe (wcag2a/aa)" | PASS | axe-core 33 audits, zero violations. axe-core is not a project dependency. |
| GF-ACC-002 | Keyboard: skip link first, visible focus, no trap outside modals, Escape closes dialogs, focus returns to a control. | `src/guidance/useModalDialog.ts` | `e2e/qa.cjs` "help: Escape closes it and focus returns to the Help button" | PASS (defect fixed) | The tour used to drop focus to the page body. |
| GF-ACC-003 | One h1 per page and no skipped heading levels. | `src/components/assessment/step-form.tsx`, `src/app/(app)/methodology/page.tsx` | `e2e/qa.cjs` "one h1, no skipped heading levels" | PASS (defect fixed) | |
| GF-ACC-004 | Status is never shown by colour alone: every classification has text and an icon. | `src/components/ui/status-badge.tsx` | `src/components/results/commercial-sections.test.tsx` "commercial classification UI: all four states" | PASS | |
| GF-ACC-005 | No horizontal page overflow at 360, 390, 430, 768, 1024, 1366, 1440 and 1920 px; the top bar does not overlap. | `src/components/layout/top-bar.tsx` | `e2e/qa.cjs` "no horizontal page overflow" | PASS (defect fixed) | |

## Persistence and privacy

| ID | Requirement | Implementation | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| GF-PER-001 | Missing, blocked, corrupt, old-schema and full storage never break the app. | `src/state/repository.ts` | `src/validation/outputs.test.tsx` "Persistence hardening"; `src/state/state.test.ts` "repository resilience" | PASS | |
| GF-PER-002 | Assessment, scenarios and stored analysis use separate keys; stored analysis is ignored when the inputs change. | `src/reporting/analysisRecord.ts` | `src/validation/outputs.test.tsx` "the analysis store: corrupt data, a stale fingerprint and write failure are all tolerated" | PASS | |
| GF-PER-003 | Discarding work always asks first. | `src/state/confirmGate.ts` | `src/state/state.test.ts` "reset requires confirmation"; `e2e/qa.cjs` "replacing a loaded case asks for confirmation" | PASS | |
| GF-SEC-001 | No assessment data leaves the browser: no network call with data, no analytics, no AI service, no remote database. | `src/` | `src/validation/audit.test.ts` "Security and network audit (the prototype sends nothing anywhere)"; `e2e/qa.cjs` "network: every request goes to the app's own origin" | PASS | |
| GF-SEC-002 | Runtime dependencies are minimal, used, permissively licensed and free of known vulnerabilities. | `package.json` | `src/validation/audit.test.ts` "Dependency review" | PASS | `npm audit --omit=dev` reported 0 vulnerabilities. |

## Known gaps

None of the rows above is an open failure. The limits that remain are documented in `docs/VALIDATION_AND_VERIFICATION.md` (Limitations) and in the Methodology page.
