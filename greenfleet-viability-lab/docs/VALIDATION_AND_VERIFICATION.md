# Validation and verification

GreenFleet MSc Prototype v1.0 (MSc Prototype Feature Freeze). Commercial Viability Policy v1.0 is a separate version and is unchanged.

## 1. Purpose and scope

This document answers one question: can GreenFleet be trusted as a coherent, reproducible, academically defensible decision-support prototype **within its stated scope**?

It reports what was checked, how, and what was found. It does not claim that the prototype predicts real costs, that its inputs are correct for any fleet, or that it is certified software. Every number used in a check is a synthetic value in abstract currency units. None is Nigerian market data.

*Verification* here means: the software does what its documentation says. *Validation* means: the results behave correctly against independent calculations, boundary cases and hostile input. There is no empirical validation against a real fleet, which is outside this prototype.

## 2. How the checks are organised

The suite was not reorganised. New checks sit in `src/validation/` and are grouped by purpose.

| Kind | Where |
| --- | --- |
| Unit and integration (Batches 1 to 7) | `src/calculation/**`, `src/domain/**`, `src/state/**`, `src/guidance/**`, `src/reporting/**`, `src/components/**`, `src/app/**`, `src/lib/**` |
| Benchmark (independent arithmetic) | `src/validation/benchmarks.test.ts`, `src/validation/env-ops.test.ts`, `src/validation/analysis.test.ts` |
| Decision table and regression | `src/validation/policy.test.ts`, `src/validation/adversarial.test.ts` ("Defect D-2 / D-3 regressions") |
| Edge case and adversarial | `src/validation/adversarial.test.ts` |
| UI, export and consistency | `src/validation/outputs.test.tsx`, `src/validation/demo-cases.test.tsx` |
| Source audits (security, claims, dependencies, units, Help, Methodology) | `src/validation/audit.test.ts` |
| Traceability | `src/validation/traceability.test.ts` checks `docs/REQUIREMENTS_TRACEABILITY.md` |
| Performance observations | `src/validation/performance.test.ts` |
| End-to-end browser | `e2e/*.cjs` (`npm run e2e`) |

Test count: 580 at the end of Batch 7, **1,323** at the end of Batch 8 (743 added, 10 new files, 30 files in all). Many of the new tests are parameterised: one block runs once per numeric field, per decision-table row or per traceability row.

| File | Tests |
| --- | --- |
| `src/validation/adversarial.test.ts` | 239 |
| `src/validation/traceability.test.ts` | 95 |
| `src/validation/policy.test.ts` | 68 |
| `src/validation/outputs.test.tsx` | 65 |
| `src/validation/analysis.test.ts` | 63 |
| `src/validation/benchmarks.test.ts` | 61 |
| `src/validation/audit.test.ts` | 53 |
| `src/validation/demo-cases.test.tsx` | 47 |
| `src/validation/env-ops.test.ts` | 41 |
| `src/validation/performance.test.ts` | 10 |
| Batches 1 to 7 (20 files) | 580 (a few edited on purpose, see section 12) |

## 3. Independent financial benchmarks

**Method.** In each benchmark the expected values are written as plain arithmetic in the test file. No production helper (`discountFactor`, `replacementYears`, `paybackOf`, and so on) is used to compute an expectation, so a test cannot pass merely because a helper agrees with itself. All values are labelled VALIDATION FIXTURE, SYNTHETIC VALUES.

### Benchmark 1: a simple hand-calculable case

2 vehicles, 10,000 km a year each (50 km a day, 200 days), 3-year horizon, discount rate 0%, no escalation, no replacement, no infrastructure.

| Quantity | Working | Result |
| --- | --- | --- |
| Diesel fuel | 2 × 10,000 km × 0.10 L/km = 2,000 L; × ₦100 | 200,000 a year |
| Diesel operating cost | 200,000 fuel + 2 × 50,000 maintenance | 300,000 a year |
| Diesel TCO | 2,000,000 + 3 × 300,000 − 400,000 residual | **2,500,000** |
| BEV energy (0% loss) | 2 × 10,000 × 0.20 kWh/km = 4,000 kWh; × 25 | 100,000 a year |
| BEV operating cost | 100,000 + 2 × 20,000 | 140,000 a year |
| BEV TCO | 2,400,000 + 3 × 140,000 − 600,000 | **2,220,000** |
| Biofuel TCO | 2,000,000 + 3 × (192,000 + 100,000) − 400,000 | **2,476,000** |
| Horizon distance | 20,000 km × 3 | 60,000 km |
| Cost per km | 2,500,000 / 60,000; 2,220,000 / 60,000 | 41.667; **37.000** |
| BEV incremental cash flow | Year 0: 2,000,000 − 2,400,000; Years 1, 2: 300,000 − 140,000; Year 3: (300,000 − 400,000) − (140,000 − 600,000) | −400,000; +160,000; +160,000; +360,000 |
| Running total | | −400,000; −240,000; −80,000; +280,000 |
| NPV (0%) | equals 2,500,000 − 2,220,000 | **+280,000** |
| Simple payback | (3 − 1) + 80,000 / 360,000 | **2.2222 years** |
| Biofuel payback | Year 0 difference is 0, so nothing to recover | immediate |

At a 10% discount rate the same flows give NPV = −400,000 + 160,000/1.1 + 160,000/1.21 + 360,000/1.331 = **+148,159.28**, and a discounted payback of 2 + 122,314.05 / (360,000/1.331) = **2.4522 years**, later than the simple payback. Year 0 is not discounted.

### Benchmark 2: replacement cycles, residual value and battery replacement

1 vehicle, 7-year horizon, 10%. Diesel life 3 years, BEV life 4 years, battery replacement 2 years into each BEV cycle.

| Year | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Diesel net cash cost | 1,000,000 | 150,000 | 150,000 | 1,150,000 | 150,000 | 150,000 | 1,150,000 | 50,000 |
| BEV net cash cost | 1,500,000 | 70,000 | 370,000 | 70,000 | 1,570,000 | 70,000 | 370,000 | −130,000 |

Replacement years: diesel 3 and 6 (the next, 9, is beyond the horizon), BEV 4. Battery years: 2 and 6 (cycles start at 0 and 4). The residual value is credited once, at Year 7, for the vehicle in service. Totals: diesel 3,950,000, BEV 3,890,000. Present costs at 10%: diesel **2,994,735.74**, BEV **3,179,953.94**, so the incremental NPV is **−185,218.20**.

Boundary checks: with life 3, a horizon of 6 gives one replacement (Year 3, none at Year 6); a horizon of 9 gives Years 3 and 6; a life equal to the horizon gives none; a life of 2.5 years over 6 years gives Years 3 and 5. A battery due exactly at the horizon is paid; one due after it is not; one due when the vehicle is replaced is not paid separately.

### Benchmark 3: infrastructure

Fleet 4. Project total CAPEX 600,000 + 300,000 + 100,000 = 1,000,000; running cost 50,000 + 10,000 = 60,000 a year. With 10 vehicles using the chargers the fleet pays min(1, 4/10) = 0.4: **400,000 at Year 0 and 24,000 a year**. With 4 or fewer vehicles sharing, or sharing not stated, the fleet pays 100% (and a warning is raised when sharing is below the fleet). Changing the charger count or the utilisation changes nothing. Discounted at 10%, a 1,000,000 outlay plus 60,000 a year adds 1,000,000 + 60,000 × 3.7908 to the present cost. Biofuel infrastructure is a project total charged in full.

### Benchmark 4: escalation

1 vehicle, 3 years, 10%. Price in year t = year-1 price × (1 + g)^(t−1), so year 1 is not escalated.

| Technology | g | Year 1 | Year 2 | Year 3 |
| --- | --- | --- | --- | --- |
| Diesel (100/L, 1,000 L) | 10% | 100,000 | 110,000 | 121,000 |
| BEV (25/kWh, 2,000 kWh) | 5% | 50,000 | 52,500 | 55,125 |
| Biofuel (80/L, 1,200 L) | 20% | 96,000 | 115,200 | 138,240 |

Maintenance is not escalated (a documented convention). A blank escalation gives the same numbers as an entered 0% but is recorded as a *missing* assumption instead of a user input. A negative rate above −100% lowers the price.

### Financing boundary

An assessment with 100% equity and the same assessment with 80% debt at 25% interest, a 4-year tenor and ₦500,000 of fees give **identical** diesel, BEV and biofuel economics, identical incremental results and identical classifications. No cost category carries principal, interest or fees, and the assumption "Loan, interest and equity: not used" is recorded as excluded. The Methodology page describes the scope as *project and asset economic viability* and states that GreenFleet does not model financeability.

### Other financial checks

| Check | Result |
| --- | --- |
| NPV sign | Green cheaper over the horizon: positive, direction "advantage". Dearer: negative, "disadvantage". Equal: zero, "indifferent". Incremental cash flow is always diesel minus alternative. |
| Payback | Immediate (also with a negative additional investment); inside Year 1 = 1,000/1,500 = 0.6667; mid-horizon 4.5; exactly at the horizon = 5; not achieved = null (never 0); discounted later than simple or not achieved; a payback that is not sustained after a later battery cost is flagged. |
| Cost per km | Scales with distance not fleet size; zero, negative, NaN or missing distance is refused; no Infinity or NaN. |
| Charging loss | Grid energy = delivered / (1 − L): 0% gives 2,000 kWh; 10% gives 2,222.22 (not 2,200); 50% gives 4,000; 99.9% gives a large finite value; 100%, above 100% and negative are refused. A blank loss is "not modelled" and disclosed, which is not the same as an entered 0%. |

## 4. Commercial Viability Policy v1.0

**Decision table.** All 4 × 4 × 2 = 32 combinations of economic case (favourable, near break-even, unfavourable, insufficient), operational status (suitable, conditional, constrained, insufficient data) and material uncertainty (none, material) were built from real inputs and compared with a hand-written expectation. The fixture is asserted to have produced the intended categories, otherwise the table would prove nothing. Result: all 32 rows pass, only four labels occur, and no score exists in the result.

**Gate order.** Evidence is judged before the economic case. A negative NPV with critical operational evidence missing gives INSUFFICIENT EVIDENCE, as documented in the Policy. See defect D-1 for the disclosure fix. A hard constraint outranks a missing item in another check.

**Near break-even (prototype ±5%).** With additional investment 4,000 (5% = 200): an NPV of exactly +200 and exactly −200 are inside the tolerance (near break-even); 199.5 is inside and 200.5 is outside (favourable); −200.5 is unfavourable. No floating-point noise moved a boundary.

| Denominator rule | Result |
| --- | --- |
| Additional investment positive and at least 1% of diesel present cost (155 of 15,500) | additional investment is the denominator |
| Investment of 154 (below the floor) | diesel present cost |
| Investment zero or negative (green cheaper at Year 0) | diesel present cost; reason code `IMMEDIATE_ECONOMIC_ADVANTAGE` |
| No cost base at all (everything costs zero) | no denominator, case "insufficient data", no division |

The 1e-9 floating-point tolerance is a separate constant from the 5% economic tolerance.

**NPV = 0 is not VIABLE.** With NPV zero: suitable operation gives CONDITIONALLY VIABLE (near break-even); conditional gives CONDITIONALLY VIABLE; a hard constraint gives NOT YET VIABLE; a material uncertainty gives CONDITIONALLY VIABLE; missing critical evidence gives INSUFFICIENT EVIDENCE.

**Environmental independence.** Ten sets of emission factors (far lower, lower, higher, equal, zero, extreme but valid 1e6, missing alternatives, missing baseline, none) across both technologies leave the classification, economic case, operational status, conditions, uncertainties, constraints, reason codes (apart from the four emissions codes) and the whole decision trace (apart from the environment lines) unchanged. The same holds through the real form path in end-to-end case F. The emissions result itself does change.

## 5. Environmental validation

1 vehicle, 10,000 km a year, 5 years: diesel 1,000 L × 2.5 = **2,500 kg a year**; BEV 10,000 kWh delivered ÷ 0.8 (20% loss) = 12,500 kWh × 0.4 = **5,000 kg**; biofuel 1,250 L × 1.2 = **1,500 kg**. Per km: 0.25, 0.50, 0.15. Over 5 years: 12,500, 25,000, 7,500 kg. Difference and change against diesel: BEV −2,500 kg (−100%, "Emissions increase"); biofuel +1,000 kg (+40%, "Emissions reduction"). Grams convert to kilograms (2,500 g/L = 2.5 kg/L); kg and m³ fuels use their own factors; a CO2-only factor is flagged; changing every price leaves emissions untouched; the charging loss raises BEV emissions as it raises cost.

**Missingness.** A missing factor, an incompatible unit (an electricity factor for diesel), an unrecognised unit, a negative or non-finite factor, and a factor so large that the result overflows all give **unavailable** with every number null. An entered zero is a real zero and is kept distinct (the percentage change is then undefined, never Infinity). An unstated scope is "not stated", never lifecycle. A lifecycle adjustment is recorded but not applied. Missing environmental data does not change the commercial classification.

## 6. Operational validation

| Case | Result |
| --- | --- |
| Daily distance 499 / **500** / 501 km against a 500 km range | satisfied (margin 1) / **satisfied (margin exactly 0)** / constrained under depot-only charging |
| 500.0001 km | constrained (no hidden buffer; verified by a source scan as well) |
| 501 km, daytime or mixed charging | conditional; unknown or unstated charging: insufficient data |
| 501 km, depot-only, each route fits | conditional (recharge between routes) |
| Route 499 / **500** / 500.5 km | satisfied / **satisfied** / constrained (depot-only), conditional (daytime), insufficient (unknown) |
| Payload 599 / **600** / 600.5 kg against an effective capacity of 600 (capacity 1,000 less 400 kg, or less 40%) | satisfied / **satisfied** / constrained |
| Biofuel reliable / intermittent / limited / unknown / unstated | suitable / conditional / conditional / insufficient data / insufficient data |
| Limited supply with infrastructure needed but unspecified | constrained |
| Infrastructure not needed / unknown / needed and specified / needed and unspecified | satisfied / insufficient / satisfied / conditional |

Equality is "within range". The boundary is a model compatibility threshold, not an engineering safety recommendation. Categorical values never produce a number, and the extra refuelling distance, downtime and charging time are shown as entered and never priced (changing them leaves the economics byte-identical).

## 7. Sensitivity, drivers, scenarios and thresholds

**Closed-form threshold benchmark.** For the base fixture (1 vehicle, 10,000 km a year, 5 years, 0%), with P the BEV price, t the tariff, p the diesel price, m the BEV maintenance and d the annual distance:

| Variable | Closed form of NPV | Analytical break-even | GreenFleet |
| --- | --- | --- | --- |
| BEV price | 15,000 − P | 15,000 | 14,999.999997 |
| Tariff | 4,500 − 50,000 t | 0.09 | agrees |
| Diesel price | 5,000 p − 3,000 | 0.60 | agrees |
| BEV maintenance | 3,000 − 5 m | 600 | agrees |
| Annual distance | 0.25 d − 500 | 2,000 km | agrees |

Acceptance tolerance: relative error below 1e-6. The engine, re-run independently at each solved value, returns an NPV within 1e-3 of zero. A positive-NPV base reports *headroom* (status `ALREADY_SATISFIED`, kind `headroom`) in the right direction; a negative base reports `FOUND`, kind `required`. The classification transition for the BEV price is found between 14,761.9 and 14,763, matching (15,000 − P)/(P − 10,000) = 5% at P = 14,761.905.

**Driver ranking.** Closed-form spreads at ±20%: BEV price 5,200, diesel price 2,000, tariff 1,000, annual distance 1,000, BEV maintenance 400. GreenFleet returns exactly these, sorted largest first, with spread = max(NPV high, NPV low) − min. Zero-base variables are skipped with a reason. The label is "Sensitivity influence under the tested ranges."

**Two-way grid.** Every cell equals NPV(P, t) = 17,500 − P − 50,000 t.

**Root solver, on synthetic functions independent of GreenFleet.** Linear, cubic and decreasing functions solved to tolerance; geometric expansion needs more steps for a distant root; steps never leave the bounds; a start already within tolerance returns immediately; a bracket that straddles a turning point is refused as non-monotonic; the iteration cap is a hard stop; evaluations are cached; a function that fails stops the search; every failure state carries no number.

**Multiple barriers.** All seven combinations of economic, operational and evidence barriers are grouped separately; a combination carries the note that money alone would not be enough; an economic threshold with a remaining constraint says it does not resolve the operational constraint.

**Scenarios.** Single and multiple overrides, duplicate (independent copy), rename, delete, the 12-scenario limit, corrupt and hostile persistence, storage that throws, a scenario built from a solved threshold (one override, reproduces NPV = 0), and a frozen Base Case. Scenario values never leak into the Base Case or into other scenarios.

## 8. Reports, presentation and exports

For one assessment, NPV (both technologies), TCO, present cost, cost per km, payback state, operational status, the environmental result, the classification and the policy version were compared across the engine, the report model, the rendered report, the rendered presentation, the CSV exports and the JSON export. They agree exactly.

**JSON reproducibility.** Re-evaluating the exported `normalizedInput` in a test harness reproduces the exported economics, environmental and operational results, completeness, classification and metadata exactly. No import feature exists or is needed.

**CSV.** Seven tables: UTF-8 byte-order mark, CRLF rows, a metadata block (generated time, currency, horizon, prototype, policy, disclaimer, versions), one header row, equal column counts in every data row, raw numbers with a status column, and no `NaN`, `Infinity` or `undefined`. Hostile names (`=1+1`, `+SUM(A1)`, `-2+3`, `@cmd`, commas, quotes, embedded newlines, tabs, a carriage return, Unicode and emoji) survive a parse round trip and are defused when they could be read as a formula. Legitimate negative numbers are untouched.

**Filenames.** Slashes, backslashes, colon, asterisk, question mark, quotes, angle brackets, pipe, emoji, a 5,000-character name, control and bidirectional characters, a leading dot, reserved device names and non-Latin names all give `greenfleet-assessment-<slug>-<type>-<date>.<ext>` with only `a-z`, `0-9`, `-` and `.`, under 100 characters.

**Presentation.** Ten screens in order with everything run; viability and driver screens are skipped when not run; every screen renders without placeholders; an insufficient-evidence result is not turned into a conclusion.

## 9. Robustness

| Area | Result |
| --- | --- |
| Hostile values on every numeric field (0, 1e-9, 1e-300, 1e15, 1e300, the largest double, −1, NaN, ±Infinity, 100, 100.0001, 101) | no crash; no NaN or Infinity in any result; non-finite values read as "not entered" |
| Free-text parsing | `1,000`, `NaN`, `Infinity`, `1e400`, `₦100`, Arabic-Indic digits refused; `1e3`, `.5`, `5.` accepted; 0 is a value |
| Names | 5,000 characters, Unicode, markup, formula characters, control characters |
| Engine given raw hostile objects | `null`, `{}`, arrays, wrong schema: an error, not a crash |
| Long horizon, high escalation, 100% discount, 10⁶ vehicles, tiny distances | finite results |
| Near-zero NPV | stable sign; classified near break-even in both directions |
| Scale | all costs × 10⁶: identical classification and NPV/10⁶ |
| Determinism | repeated runs of the engine, sensitivity, drivers and threshold analysis are byte-identical; the calculation source contains no `Math.random` and no clock |
| Mutation | deep-frozen inputs, results and analyses are read without error and without change |

## 10. Browser and accessibility QA

Run with `npm run build && npx next start -p 3100`, then `npm run e2e`. The Batch 8 script is `e2e/qa.cjs`; it also runs an axe-core audit when `AXE_PATH` points to `axe.min.js` (axe-core is not a project dependency).

| Check | Result |
| --- | --- |
| Existing suites (classification, guidance, analysis, reporting) | all pass, no console errors |
| `qa.cjs` | 598 checks pass, 0 fail; no console error or warning, no page error, no failed resource, no hydration warning |
| Demonstration cases through the real interface | all five load, run, show the expected labels and the synthetic-values notice; replacing asks first; cancelling keeps the work; Return to Blank Assessment resets after confirmation |
| Routes × viewports | 15 routes at 360, 390, 430, 768, 1024, 1366, 1440 and 1920 px wide: no horizontal page overflow, no `NaN` / `undefined` / `{cur}` leak |
| Accessibility (axe-core, WCAG 2 A/AA and 2.1 A/AA, including colour contrast) | 33 audits (every route at 1440×900 and 390 px, the Welcome dialog, Help drawer and scenario builder): **0 violations of any severity** |
| Headings and names | one `h1` per page, no skipped levels; every button, link, input, image and table has an accessible name or header |
| Status not by colour alone | every classification badge has text and an icon |
| Keyboard | first Tab stop is the skip link; 10+ distinct stops; visible focus on every focused element; Shift+Tab reverses; Enter/Space operate controls and radios; Help opens with focus inside, cannot reach controls behind it, and Escape returns focus to the Help button; the tour and confirm dialogs close without losing focus to the page body |
| Presentation | all ten screens, ArrowRight / ArrowLeft / Escape work, ends hold; no body text under 14 px at 1366×768, 1440×900, 1920×1080 and 390 px; no horizontal overflow; vertical scrolling needed on 3 of 10 screens at 1366×768, 1 of 10 at 1440×900, 0 at 1920×1080 |
| Print (emulated print media and a generated PDF) | navigation, toolbar buttons and Help absent; 12+ section headings visible; no table clipped; disclaimer, attribution and prototype version visible; PDF produced (about 280 KB) |
| Network | every request goes to the app's own origin; no POST, PUT or DELETE; no analytics, AI, market-data or database call |

Observed browser timings (headless Chromium on the build machine; not a promise): Results visible about 0.5 s after running; Sensitivity (drivers and two-way visible) about 0.8 s; Report about 0.3 s; no long main-thread task was recorded in the short observation window. Observed Node timings (one core): base assessment 2.5 ms; one-way sensitivity 42 ms; driver ranking 15 ms; two-way grid with frontier 130 ms; "What would make it viable?" 170 ms; a viability margin (the most solver work) 650 ms; report model and all eight exports from stored analyses 3 ms. The report reuses stored analyses and runs nothing again. No optimisation was needed.

## 11. Defects found

| ID | Finding | Classification | Fix | Earlier outputs affected? |
| --- | --- | --- | --- | --- |
| D-1 | An INSUFFICIENT EVIDENCE result did not say, in the decision trace, the executive summary, the headline card or the presentation, that the available economic evidence was (for example) unfavourable. The data was present (the economic case and the NPV) but not stated. | Disclosure gap. **Not methodology.** The label was always correct. | Added a decision-trace line and a plain sentence in the card, summary, takeaways, report and presentation. No rule changed. | No. Only added text. |
| D-2 | Inputs that pass form validation but overflow double precision (for example a fleet size of 1e308) produced `Infinity` and `NaN` in results. | Robustness defect. Not methodology. | The engine refuses with a message; an overflowing emission factor makes emissions unavailable and leaves the economics untouched. | No valid result changed. Only inputs that previously produced non-finite output are refused. |
| D-3 | A vehicle life such as 0.000000001 years was accepted by the form and sent the replacement-schedule loops into billions of iterations (about 13 s measured; in practice a frozen tab). | Robustness defect. Not methodology. | The engine refuses a life that would need more than 1,000 replacements in the horizon. A realistic life (1 year over 50 years needs 49) is unaffected. | No valid result changed. |
| D-4 | A real amount below ₦0.50 (for example an NPV of +0.3) was displayed as "₦0", which can sit beside "Economic advantage over diesel". | Display defect. | `formatMoney` shows "< ₦1" or "> -₦1". Floating-point noise below one millionth is still zero. Raw values and classifications never depend on display rounding. | Display only. |
| D-5 | Heading levels skipped (h2 to h4 on assessment steps and in "Why this result?", h1 to h3 on Methodology) and the report page had two `h1` elements. | Accessibility. | Heading levels corrected. | No. |
| D-6 | Closing the Quick Tour, restarted from Help, left keyboard focus on the page body. | Accessibility. | The modal hook remembers the opener and otherwise returns focus to the Help button, only after a real close. | No. |
| D-7 | At 360 px the top bar's assessment name was squeezed under the Help button. | Layout. | The name takes its own row on phones. | No. |
| D-8 | The logo's accessible name did not contain its visible text (axe `label-content-name-mismatch`). | Accessibility. | Visible text now carries the name. | No. |
| D-9 | Stale or unsupported wording: the Methodology subtitle in the future tense; "cost per km: lifecycle cost"; "a cleaner option"; a field hint promising "cost per tonne-km later"; "not applied to the results yet"; "A later stage will show which ones"; "Generative AI, if added later"; a "Coming later" journey badge that could never appear; a Help text with no mention that the tour can be restarted. | Wording. | Reworded or removed. | No numbers. |

**No defect changed methodology.** No financial formula, the Commercial Viability Policy v1.0, the near-break-even policy, the threshold methodology, the environmental methodology, the operational rules, scenario semantics or provenance semantics was changed. Outputs from earlier batches for any input that was valid and finite are unchanged; this is also shown by the Batch 3 to 7 suites passing unmodified (apart from the deliberate edits in section 12).

## 12. Tests and tooling changed on purpose

| Test | Why |
| --- | --- |
| `src/lib/format.test.ts` | `formatMoney(-0.2)` was expected to print "₦0". It now prints "> -₦1" (defect D-4). |
| `src/guidance/guidance.test.tsx` "the prototype disclaimer is present in Help" | Help now uses the single core disclaimer (spec item 75). |
| `src/guidance/guidance.test.tsx` "(updated in Batch 6)..." | The glossary term is "Commercial classification transition" (terminology audit). |
| `src/reporting/reporting.test.tsx` "sections are numbered, ordered..." | The report cover title is an `h2`, so the test selects the numbered section headings (defect D-5). |
| `eslint.config.mjs` | `npm run lint` lints the whole project, and the Batch 7 browser scripts (`e2e/*.cjs`) failed it on `require()` imports; I had only run `eslint src`. The scripts are now declared Node scripts in the config. This was a Batch 7 tooling defect, not a product defect. |

## 13. Audits

- **Terminology.** Preferred terms are used (Diesel Baseline, Battery Electric Vehicle / BEV, Biofuel, Economic Performance, Operational Feasibility, Environmental Performance, Commercial Viability, Incremental NPV vs Diesel, Present Cost, TCO, Sensitivity Analysis, Scenario Analysis, Economic Break-Even, Commercial Classification Transition, Viability Margin, Evidence Completeness, Data Provenance). Two accidental synonyms were aligned ("Commercial transition", "Data completeness").
- **Unsupported claims.** A scan of all shipped source for `optimal`, `best`, `guaranteed`, `profitable`, `zero-emission`, `carbon-neutral`, `high confidence`, `accurate prediction`, `recommended purchase`, `investment recommendation` and related terms finds only negated uses ("does not guarantee", "not a forecast", "the lowest-cost scenario is not the best"). A test fails if a new claim appears without a negation. No report, presentation or result string uses `profitable`, `zero-emission` or `carbon-neutral` except in the negated disclosure "It does not mean zero emissions."
- **Currency and units.** NGN is the default and the currency list is a table; no engine or report source hard-codes the naira symbol. Units are written out (km, km/day, km/year, days/year, litres/100 km, kWh/100 km, kg, kg CO2e, kg CO2e/km, tCO2e, years, %).
- **Dead code.** Removed: the unused Batch 1 scaffolding types (`Scenario`, `SensitivityVariable`, `ViabilityResult` in `domain/types.ts`), `domain/labels.ts`, six unreferenced helpers (`hasAnyAnalysis`, `hasValue`, `valueOrUndefined`, `fieldsEqual`, `issuesForStep`, `topicOf`), `FINANCE_NOTE_TEXT`, `VIABILITY_LABEL`, `CountryId`, the journey "state" flag and its "Coming later" branch. The developer view at `?debug=1` on the review step is intentionally kept; it is shown only in development or with that query.
- **Dependencies.** Seven runtime packages (`clsx`, `lucide-react`, `next`, `react`, `react-dom`, `recharts`, `tailwind-merge`), each imported, all MIT or ISC; direct development dependencies are MIT or Apache-2.0. `npm audit --omit=dev` found 0 vulnerabilities. No secret or API key is read.
- **Security.** No `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `dangerouslySetInnerHTML`, `eval`, cookie, remote font or script. Browser storage is used by exactly four modules. Names are rendered by React (escaped), filenames are sanitised and CSV text is defused.
- **Methodology page.** Read as an examiner would. Corrected: a future-tense subtitle, the NPV sign statement (both directions), the financing boundary wording, the gate-order consequence. Added: a "Prototype validation and computational safeguards" section. Statements are asserted against the code by `audit.test.ts`.
- **Help.** Every page has its own entry; every Help and tour link goes to a real page; no text promises something unbuilt; every current feature is covered; the tour can be restarted from Help.

## 14. Limitations

- There is no empirical validation against a real fleet. The checks show that the software is internally correct and consistent, not that any assumption is true.
- The benchmarks cover the documented conventions (replacement at each full life before the horizon, battery repeated per cycle, maintenance not escalated, infrastructure paid once). If those conventions are disputed, the software is consistent with them, not with the dispute.
- The 5% tolerance, the 1% floor, the sensitivity range and the 12-scenario limit are prototype conventions.
- The classification-transition scan reports the nearest change only and can miss a double crossing between scan points (a non-monotonic scan is flagged).
- Analyses appear in a report only if they were run for the current inputs.
- No rule links route distance to daily distance; none was invented.
- The Presentation needs a small vertical scroll on three of ten screens at 1366×768.
- Print pagination differs between browsers.
- axe-core cannot assess everything (for example reading order for a screen-reader user). Automated results are not a substitute for testing with assistive technology.
- Browser timings are from one headless run and are observations, not guarantees.
- Monte Carlo analysis, financing metrics, taxes, revenue and lifecycle emissions are future work, not defects.

## 15. How to reproduce

```
cd greenfleet-viability-lab
npm install
npm run typecheck && npm run lint && npm test       # lint covers the whole project; 1,323 tests
npm run build && npx next start -p 3100 &
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM=/path/to/chromium AXE_PATH=/path/to/axe.min.js npm run e2e
```
