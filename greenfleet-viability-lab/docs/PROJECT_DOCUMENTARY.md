# GreenFleet Viability Lab: the complete project documentary

**GreenFleet MSc Prototype v1.0** · MSc Prototype Feature Freeze · Commercial Viability Policy v1.0

This document tells the whole story of the project: what it is, why it exists, how it works, how it was built, how it was checked, what it cannot do, and how to run it. You do not need to have seen the software before. If you want the technical depth behind any part, the other files in `docs/` go further, and each section below says where.

---

## 1. The project at a glance

| | |
| --- | --- |
| **Name** | GreenFleet Viability Lab |
| **What it is** | A web application that helps a logistics start-up decide whether a green vehicle is commercially viable compared with a diesel vehicle |
| **Compares** | Diesel (the baseline), battery-electric vehicles (BEV), and biofuel or alternative-fuel vehicles |
| **Kind of software** | An academic decision-support prototype. It is not certified software and it gives no financial, investment, engineering, regulatory or procurement advice |
| **Built for** | University of Port Harcourt, Faculty of Social Sciences, Centre for Logistics and Transport Studies (CELTRAS). Course SGS 802, Entrepreneurship in Transport and Supply Chain Management |
| **Built by** | Group 8, MSc Class of 2025, CELTRAS |
| **Status** | Feature-frozen for the MSc seminar (Batch 8 complete) |
| **Technology** | Next.js 16, React 19, strict TypeScript, Tailwind CSS 4, Recharts 3, Vitest 5 |
| **Size** | About 1,300 automated tests, 91 traced requirements, 5 browser test suites |
| **Where it runs** | In the browser. No account, no server database, no outside service. It is hosted on Vercel from the `main` branch, root directory `greenfleet-viability-lab` |
| **Key rule** | It uses only the assumptions you enter. It ships no prices, no emission factors, no live data, no artificial intelligence |

---

## 2. The problem it addresses

A small logistics company that is thinking about buying electric or biofuel vehicles faces a hard decision. Many people assume a green vehicle is automatically the better business choice. It is not automatically so. The decision depends on questions that a single cost figure cannot answer:

1. **Does it cost less over its life?** A battery-electric van often costs more to buy and less to run. Whether the saving repays the extra price depends on distance driven, fuel and electricity prices, how long the vehicle lasts, and what it is worth at the end.
2. **Can it do the work?** An electric van with a 200 km range cannot cover a 240 km day if it can only charge at the depot. A biofuel vehicle is useless if the fuel is only sometimes available.
3. **What does it do to emissions?** Lower emissions matter, but they are a separate question from profit.
4. **Is there enough evidence to say?** If a critical fact is unknown, any confident answer would be invented.

Most simple calculators merge these into one number or a single "green score". That hides the trade-offs. GreenFleet keeps the questions apart, answers each one on its own terms, and then gives one clearly explained commercial verdict with the reasons shown.

The project also responds to a practical gap in emerging economies, where reliable local data is scarce and fuel and electricity prices move often. GreenFleet therefore does not guess. The user supplies every price, rate and emission factor, and anything that is missing is reported as missing.

---

## 3. Who it is for

- **Entrepreneurs and small fleet operators** deciding whether to buy, convert or stay with diesel.
- **Advisers and investors** who want to see the assumptions behind a recommendation.
- **Students and researchers** studying the commercial viability of green transport. The method is open and every figure can be traced.
- **Examiners** reviewing the MSc work. The documentation and the tests are written so each claim can be checked.

It is not meant to replace a financial adviser, a vehicle engineer or a regulator, and it says so on the screen and in every report.

---

## 4. What GreenFleet does: four questions, kept apart

GreenFleet reports four separate things for each green alternative. They are shown side by side and never merged into a score.

| Dimension | The question | How it is answered |
| --- | --- | --- |
| **Economic performance** | Does it cost less than diesel over the analysis period? | Total cost of ownership, present cost, cost per km, incremental net present value (NPV) against diesel, simple and discounted payback |
| **Operational feasibility** | Can it do the work I described? | Plain rules on range, routes, charging, payload, fuel supply and infrastructure. Result: Suitable, Conditional, Constrained or Insufficient data |
| **Environmental performance** | How do estimated emissions compare? | Physical use multiplied by an emission factor that you supply. Shown beside, never inside, the verdict |
| **Commercial viability** | Is the alternative commercially viable relative to diesel? | Ordered rules (Policy v1.0). Result: VIABLE, CONDITIONALLY VIABLE, NOT YET VIABLE or INSUFFICIENT EVIDENCE |

Diesel is the **baseline**. Every result is a difference from diesel. Diesel itself is never given a label, because it is the reference case and not a judged option.

On top of the verdict, GreenFleet can show **what would change it**: how sensitive the result is to each assumption, how named scenarios compare, and what value of an assumption would reach break-even or change the label.

---

## 5. A tour of the application

Pages in the left menu (or the menu button on a phone):

| Page | What you do there |
| --- | --- |
| **Home** (`/`) | The landing page. Explains the idea and links into the workspace |
| **Overview** | Start a blank assessment, continue one, or load a labelled synthetic demonstration case. Shows progress through the ten-stage journey |
| **New Assessment** | A six-step form: Business and Fleet, Diesel, Battery Electric, Biofuel, Finance and Infrastructure, then Review and Calculate |
| **Results** | The dashboard: the four dimensions, the verdict for each alternative, the reasons, tables, charts, warnings and assumptions |
| **Sensitivity Analysis** | One-way sensitivity, a ranking of the assumptions that move the result most, a limited two-way grid, and "What would make it viable?" |
| **Saved Scenarios** | Build named sets of changes and compare them with your Base Case |
| **Methodology** | Every formula and rule, written for a reader to inspect |
| **About** | Context, version, disclaimer |
| **Professional Report** | A printable document built from your results. Reached from Results |
| **Presentation Mode** | A full-screen, keyboard-driven slide-style view for a live seminar. Reached from Results |
| **Help** | A side panel on every page with explanations, a guided Quick Tour you can restart, and a glossary |

Everything you type is saved in your own browser and nowhere else.

---

## 6. How an assessment flows

```
what you type
   -> validation (is each value allowed, and is it consistent?)
   -> normalised input (one clean, unit-checked object)
   -> calculation engine (economics, operations, environment, completeness)
   -> Commercial Viability Policy v1.0 (the verdict and its reasons)
   -> Results page, report, presentation, CSV and JSON exports
   -> optional analysis on top: sensitivity, scenarios, thresholds
```

There is **one authoritative pipeline**. Reports, exports, sensitivity and thresholds read what the engine produced. They add no formula of their own, so a number can never differ between the Results page, the report, the presentation and the exports. A test checks exactly that.

### The four states of a number

A value is never allowed to be confused with its absence. GreenFleet keeps these distinct everywhere:

- **0**: a real value. "Zero maintenance cost" is an answer.
- **Missing**: not entered yet.
- **Not applicable**: the question does not apply to you.
- **Unknown**: you answered "I do not know" (for choices such as charging access).

The same care applies to results: *unavailable* (could not be calculated), *not run* (an analysis was not run), and *not achieved* (for example, no payback within the horizon) are each shown in their own words, never as zero.

---

## 7. The inputs

The six steps collect:

1. **Business and Fleet.** Name, type, fleet size, vehicle category, payload capacity and average payload, daily or annual distance, operating days per year, optional route distance and trips, and the analysis horizon in whole years (1 to 50).
2. **Diesel baseline.** Vehicle price, fuel economy, fuel price, maintenance, useful life, residual (resale) value, optional insurance, registration and other costs, and an optional fuel price escalation rate.
3. **Battery electric.** Vehicle price, energy use (kWh per 100 km), electricity tariff, usable range, battery capacity, charging loss, optional battery replacement (whether, when, and cost), charging opportunity (depot only, public, destination, mixed, unknown), payload impact, and electricity price escalation.
4. **Biofuel.** Pathway (for example a biodiesel blend or a gaseous fuel), fuel unit (litre, kg or m³), new vehicle or conversion, fuel price and consumption, maintenance effects, supply availability (reliable, intermittent, limited, unknown), whether special infrastructure is needed, and refuelling or downtime effects.
5. **Finance and infrastructure.** Discount rate, financing terms (stored but not used in the economics, see section 20), incentives, charging infrastructure cost and sharing, biofuel infrastructure cost, and optional emission factors with their unit, scope and source.
6. **Review and Calculate.** A summary of everything, what is missing, and the button to run the assessment.

Practical features: units can be entered in the form you prefer (km per litre or litres per 100 km; kg or tonnes) and are converted exactly; a value can carry a source and a year; values that come from a demonstration are labelled "Illustrative assumption, not current market data" until you edit them; and a "Why is this required?" note appears under missing required values.

The formal contract between the form and the engine is in `docs/NORMALIZED_INPUT.md`.

---

## 8. The economics

The economic engine is a pure calculation with no screen code. Its conventions, in plain terms:

- **Timeline.** Year 0 is the purchase date and is not discounted. Years 1 to T are operating years, with cash flows at year end. T is the analysis period.
- **Costs are positive.** Incentives and resale value are subtracted.
- **Fuel and energy.** Fleet distance multiplied by consumption multiplied by price. If you enter a price escalation rate g, the price in year t is the year-1 price times (1 + g) to the power (t − 1). A blank escalation means "held constant" and is recorded as a missing assumption, which is different from an entered 0%.
- **Charging loss.** The electricity bought equals the electricity delivered to the vehicle divided by (1 − loss). A loss of 100% or more is refused.
- **Running costs each year.** Energy, maintenance, insurance, licensing, other fixed and variable costs, and infrastructure running cost.
- **Vehicle replacement.** A new vehicle is bought each time the useful life ends, but only if the vehicle would still be used before the period ends. Nothing is bought at exactly the final year. A replacement costs what the first vehicle cost.
- **Battery replacement.** If you say a battery will be replaced, its cost is added in that year of each vehicle cycle. An unknown answer is excluded from the cost and disclosed.
- **Resale value.** Credited once at the end for the vehicle in service, using the amount or percentage you entered.
- **Infrastructure.** Entered as a project total. Your fleet pays min(1, vehicles you assess ÷ vehicles using the chargers). Paid once at Year 0.
- **Total cost of ownership (TCO)** is the sum of net cash costs. **Present cost** is the same sum with each year discounted at your rate. **Cost per km** divides by the fleet distance over the period.
- **Incremental cash flow** each year is the diesel net cost minus the alternative net cost. Positive means the alternative is cheaper that year.
- **Net present value (NPV)** is the sum of incremental cash flows, each discounted. **A positive NPV means an economic advantage over diesel. A negative NPV means an economic disadvantage.**
- **Payback** is the point where the running total of incremental cash flow reaches zero, interpolated within the year. It is *immediate* if the alternative is not dearer at Year 0, and *not achieved* (shown as such, never as zero) if it does not recover its extra cost within the horizon. A discounted version uses the discounted flows.

### A worked example you can check by hand

Two vehicles, 10,000 km a year each, a 3-year horizon, 0% discount rate, no replacement.

- Diesel: fuel 2,000 litres a year at ₦100 is ₦200,000; maintenance 2 × ₦50,000 is ₦100,000. Running cost ₦300,000 a year. Buy 2 × ₦1,000,000, resell 2 × ₦200,000. **TCO = 2,000,000 + 3 × 300,000 − 400,000 = ₦2,500,000.**
- Battery electric: 4,000 kWh a year at ₦25 is ₦100,000; maintenance ₦40,000. Running cost ₦140,000 a year. Buy 2 × ₦1,200,000, resell 2 × ₦300,000. **TCO = 2,400,000 + 3 × 140,000 − 600,000 = ₦2,220,000.**
- Incremental cash flows: Year 0 −₦400,000; Years 1 and 2 +₦160,000; Year 3 +₦360,000. Running total ends at +₦280,000, so **NPV = +₦280,000**, and payback is 2 + 80,000 ÷ 360,000 = **2.22 years**.

These are abstract numbers chosen for easy arithmetic. They are not Nigerian prices. The test suite checks the engine against this and three similar hand-worked cases.

Full detail: `docs/CALCULATION_ENGINE.md`.

---

## 9. Operational feasibility

This layer asks only whether the vehicle can do the described work. It uses no prices and no emissions. It applies rules to your own inputs.

**Battery electric**
- *Range:* a daily distance up to the usable range is satisfied. The margin is shown exactly. **There is no hidden safety buffer.** Equal to the range counts as within range. This is a model compatibility threshold, not an engineering safety recommendation.
- *If the day is longer than the range:* with depot-only charging it is **Constrained**, unless each route fits the range and vehicles can recharge at the depot between routes (**Conditional**). With daytime charging available it is **Conditional**. If charging access is unknown it is **Insufficient data**.
- *Single route:* a route longer than the range is judged separately and more strictly.
- *Payload:* the effective capacity is the capacity minus the reduction you enter. An average payload above it is **Constrained**.
- *Charging arrangement:* contradictory answers (for example "depot only" and "public only") are a condition to reconcile.

**Biofuel**
- *Supply:* reliable is satisfied; intermittent is **Conditional**; limited is **Conditional**, or **Constrained** when needed infrastructure is not specified; unknown is **Insufficient data**. Fuel availability is a category. It is never turned into a percentage or a price.
- *Infrastructure:* not needed is satisfied; needed and fully specified is satisfied; needed but incomplete is **Conditional**; unknown is **Insufficient data**.

Charging time, extra refuelling distance and downtime are shown as you entered them and are never converted into cost.

The overall status follows four rules in order: any Constrained check makes it Constrained; otherwise a missing core check makes it Insufficient data; otherwise any Conditional or uncertain check makes it Conditional; otherwise it is Suitable. The rule that applied is shown.

---

## 10. Environmental performance

GreenFleet estimates **operational energy and fuel-related greenhouse gas emissions**:

```
emissions (kg CO2e) = physical energy or fuel used x emission factor you supply
```

For battery electric the physical use is the grid electricity including charging loss. Results are given per year, per km and over the horizon, in kilograms internally and tonnes for display. The change against diesel is (diesel − alternative) ÷ diesel × 100.

What it deliberately does not do:
- It ships **no emission factors**. You supply each one with its unit, and ideally its source, year and scope.
- A **missing, incompatible or unusable factor makes that result "Unavailable". It is never shown as zero.** An entered zero is a real zero.
- Units are checked. A per-litre factor cannot be applied to kilowatt-hours. Grams convert to kilograms. A CO2-only factor is flagged because it is not CO2e.
- It is **not a life-cycle assessment.** Vehicle and battery manufacturing, disposal and infrastructure emissions are not included. A lifecycle adjustment percentage can be recorded but is not applied.
- Emissions are never converted to money. There is no carbon price.
- **Emissions never change the commercial verdict.** This is tested.

---

## 11. The commercial verdict: Policy v1.0

"GreenFleet Commercial Viability Policy v1.0" classifies each green alternative against diesel into one of four labels. It is a set of **ordered rules, with no score and no weighting.**

| Label | Meaning |
| --- | --- |
| **VIABLE** | A favourable economic case against diesel and no material unresolved operational constraint, condition or uncertainty |
| **CONDITIONALLY VIABLE** | A credible case, but a remediable condition or material uncertainty must be resolved, or the economics are close to break-even |
| **NOT YET VIABLE** | No sufficiently credible case under the current assumptions: unfavourable economics, an unresolved hard operational constraint, or both. "Yet" is deliberate, because changing assumptions can change the result |
| **INSUFFICIENT EVIDENCE** | A critical fact is missing or the results are inconsistent. The label is withheld rather than forced |

### The decision order

1. **Consistency.** The NPV must agree with the discounted cumulative cash flow and the present-cost difference. A contradiction is never classified.
2. **Evidence sufficiency.** Economic evidence must support the comparison, and critical operational items must be known. Environmental data is not required.
3. **Operational feasibility.** A hard constraint gives NOT YET VIABLE. A remediable condition allows CONDITIONALLY VIABLE.
4. **Economic case.** Unfavourable gives NOT YET VIABLE. Near break-even gives CONDITIONALLY VIABLE. Favourable continues.
5. **Conditions and uncertainties.** Any that remain give CONDITIONALLY VIABLE. Otherwise VIABLE.

### Important consequences

- **A positive NPV is not the same as VIABLE.** A positive NPV with a hard operational constraint is NOT YET VIABLE. With a condition such as daytime charging it is CONDITIONALLY VIABLE.
- **NPV exactly zero is never VIABLE.** It counts as near break-even.
- **Evidence is judged before economics.** A negative NPV with a critical operational fact missing gives INSUFFICIENT EVIDENCE. GreenFleet still states, in words, that the available economic evidence is unfavourable, for information only.
- **Near break-even** means the NPV is within plus or minus 5% of the additional initial investment (when that is positive and at least 1% of the diesel present cost), otherwise of the diesel present cost. The 5% and 1% are **prototype policy values**, not academic standards. They are held in one policy object. A separate, tiny numerical tolerance only absorbs computer rounding noise.
- Every result carries reason codes, supporting evidence, conditions, uncertainties, constraints, next steps and a step-by-step decision trace. The "Why this result?" panel shows all of it. The sentences come from fixed templates, not from AI.

Full text: `docs/COMMERCIAL_VIABILITY_POLICY.md`.

---

## 12. Sensitivity, scenarios and thresholds

All three call the same engine on a **copy** of your Base Case. The Base Case itself is never changed.

- **One-way sensitivity.** Change one assumption across a range (by default minus 20%, minus 10%, base, plus 10%, plus 20%, or a custom range). For each point you see the NPV, costs, paybacks, operational status and verdict. The NPV = 0 crossing is solved exactly and marked.
- **Driver ranking.** Each economic assumption is moved low and high. Its influence is the gap between the two resulting NPVs, with no weighting. It is labelled "Sensitivity influence under the tested ranges" and is never presented as proof of cause.
- **Two-way grid.** A limited set of useful pairs (for example BEV price and electricity tariff) in a grid of up to 11 by 11, with the economic break-even frontier.
- **Scenarios.** Name a set of changes, save it (up to 12, in your browser), duplicate, rename or delete it, and compare it with the Base Case. Environmental changes alone cannot change a verdict.
- **Thresholds: "What would make it viable?"** The solver finds the value of one assumption at which the NPV reaches zero (economic break-even), or at which the verdict changes. It brackets the answer, checks the relationship is one-directional, bisects to a tight tolerance and then re-runs the full engine at the result to verify it. A threshold that cannot be found says so and shows no number.
  - For NOT YET VIABLE: the economic thresholds, the operational remedies, and a note when more than one kind of barrier exists. **Reaching economic break-even does not by itself make an alternative viable**, and the answer says so whenever a hard constraint remains.
  - For CONDITIONALLY VIABLE: the conditions to resolve. No financial threshold is invented when the economics are already favourable.
  - For VIABLE: a **viability margin**, showing how far each assumption can move before the label changes. Margins are not additive and are not forecasts.
  - For INSUFFICIENT EVIDENCE: solving is blocked and the exact missing inputs are listed.
  - Where an operational rule gives a number (for example the minimum range equals the daily distance), it is shown without a safety buffer and checked by the engine. Fuel availability and charging access stay qualitative.

Every threshold holds all other assumptions equal. It is a mathematical boundary, not a forecast.

Full detail: `docs/SENSITIVITY_AND_THRESHOLD_ENGINE.md`.

---

## 13. Reporting, presentation and exports

All of these are built from **one report model**, so the numbers cannot drift apart.

- **Professional Report.** A numbered document: executive decision summary, profile, assumptions with provenance and sources, comparison, economics with charts, operational feasibility, environmental performance (scope stated), commercial viability, the decision trace, sensitivity, scenarios, thresholds or viability margin, evidence quality, methodology, limitations and disclaimer. **Print / Save as PDF** uses your browser. The print layout hides the menus and buttons.
- **Presentation Mode.** Up to ten screens: Assessment Snapshot, Technology Comparison, Economics, Operations, Environment, Commercial Classification, Why This Result, What Would Make It Viable or the Viability Margin, Sensitivity Drivers, and Key Decision Takeaways. Right and left arrow keys move, Escape exits, nothing advances by itself. Screens with nothing true to show are skipped.
- **Exports.** Seven CSV tables (comparison, cash flow, sensitivity, drivers, scenarios, scenario changes, thresholds) and one full JSON file. They hold raw, unrounded numbers, the currency, the policy and prototype versions and the disclaimer. Spreadsheet formula characters in names are neutralised and filenames are made safe. The JSON contains the normalised input, so the results can be reproduced from it. Files are created on your device and are not uploaded.
- **Evidence quality.** Described in words (complete, partial, insufficient, unavailable), with counts of user-entered, sourced, illustrative, derived and missing values, the critical missing inputs and the material uncertainties. **There is no confidence score and no confidence percentage.** Evidence completeness is not statistical confidence.
- The Group 8 credit appears in the generated report and on the landing page, not on ordinary internal pages.

Full detail: `docs/REPORTING_AND_PRESENTATION.md`.

---

## 14. Help and guidance

Built so a first-time entrepreneur can use the tool without training:

- A **Help panel** on every page explains what you are doing, what GreenFleet does, why it matters, tips, warnings and what happens next.
- A **welcome** on the first visit and a seven-step **Quick Tour** that can be skipped and restarted from Help.
- **Contextual help** beside difficult inputs and on each part of the results (for example NPV, payback, TCO, the four labels, the decision trace).
- Onboarding state is stored separately from your assessment, so it never touches your data.
- All Help text comes from one registry, and tests check that every page has an entry, every link works, and nothing promises an unbuilt feature.

Full detail: `docs/USER_GUIDANCE_SYSTEM.md`.

---

## 15. The five synthetic demonstration cases

Every case is labelled: *"Illustrative synthetic values for demonstration only. These are not current market prices or investment recommendations."* They share the same base (5 delivery vans, 100 km a day for 250 days, five-year horizon, 15% discount rate, amounts in NGN) and change only what each case needs. None includes an emission factor, so emissions show as Unavailable.

| Case | Idea | Battery electric | Biofuel |
| --- | --- | --- | --- |
| 1. Strong battery-electric | Favourable economics, suitable operation, adequate evidence | **VIABLE** (NPV +₦10.8 million) | NOT YET VIABLE |
| 2. Positive NPV, daytime charging needed | A positive NPV is not enough | **CONDITIONALLY VIABLE** (NPV +₦76.0 million) | NOT YET VIABLE |
| 3. Negative NPV and a range constraint | Two separate barriers | **NOT YET VIABLE** (NPV −₦15.8 million; 240 km day, 200 km range, depot-only) | NOT YET VIABLE |
| 4. Attractive biofuel, intermittent supply | A categorical condition | VIABLE | **CONDITIONALLY VIABLE** (NPV +₦6.4 million) |
| 5. Critical evidence missing | Refusing to manufacture certainty | **INSUFFICIENT EVIDENCE** | **INSUFFICIENT EVIDENCE** |

They load from a keyboard-accessible menu on the Overview and assessment pages. If you already have work in progress, GreenFleet asks before replacing it, and "Return to Blank Assessment" clears a demonstration after you confirm. The recommended 7-minute live demonstration, a fallback plan for presentation day, and fifteen likely examiner questions with answers are in `docs/DEMO_CASES.md`.

---

## 16. Design principles: what GreenFleet refuses to do

These are not accidents. They are decisions, and tests protect most of them.

| Principle | In practice |
| --- | --- |
| **Honesty about missing data** | Missing is missing. It is never silently zero or guessed |
| **Separate questions** | Economics, operations, environment and the verdict are never merged into one score |
| **No hidden factors** | No safety buffer, no weighting, no invented thresholds |
| **No invented data** | No prices or emission factors are shipped. Demonstration values are labelled synthetic |
| **Deterministic and auditable** | The same inputs always give the same output, with no randomness and no clock |
| **No generative AI** | Every figure comes from a stated formula and every sentence from a fixed template |
| **No Monte Carlo** | It would need probability distributions the user cannot justify. Deterministic analysis is used instead |
| **No confidence score** | A number would suggest statistical meaning that does not exist |
| **Conditional language** | "Under the entered assumptions", never "will", "guaranteed" or "optimal" |
| **Privacy by design** | Nothing leaves your device |

---

## 17. How it is built

### Technology
Next.js 16 (App Router), React 19, strict TypeScript, Tailwind CSS 4, Recharts 3 for charts, Vitest 5 for tests. Only seven runtime packages are used, all MIT or ISC licensed.

### Code layout (inside `greenfleet-viability-lab/`)

```
src/app/            routes (pages are thin)
src/components/     interface pieces: ui, layout, landing, assessment form, results, analysis, report, presentation
src/domain/         the input schema (one entry per input), validation, normalisation, demonstration cases
src/calculation/    the pure engine: economics, environmental/, operational/, viability/,
                    sensitivity/, scenario/, threshold/, analysis/   (no screen code at all)
src/reporting/      the single report model, evidence quality, exports, presentation screens
src/guidance/       Help content, welcome, Quick Tour, modal dialogs
src/state/          stores and browser persistence
src/validation/     validation, audit and traceability tests
e2e/                browser tests
docs/               the design, policy, validation and demonstration documents
```

### Rules the code follows
- The calculation engine has no React and no browser code, so it can be tested on its own.
- One schema describes every input. Forms, validation, the review screen and normalisation all read it.
- Hidden inputs read as missing, so a stale value can never leak into a result.
- Persistence sits behind an interface. Browser storage is one implementation, in four small modules.
- Percentages are entered as 0 to 100 and used as decimals internally. Money is whole units of the chosen currency, NGN by default.

---

## 18. How it was checked

Trust in a decision tool must be earned. The checks fall into five groups.

1. **Independent calculations.** Four hand-worked cases (simple, replacement and battery, infrastructure sharing, escalation) whose expected values are written as plain arithmetic in the tests, not produced by the software. Also a closed-form check of five economic thresholds (agreement to better than one part in a million), a closed-form check of the driver ranking, and a check of the solver on synthetic mathematical functions.
2. **Rule coverage.** A decision table of all 32 combinations of economic case, operational status and uncertainty for Policy v1.0. Boundary tests at exactly the range, the payload limit and the 5% tolerance. A stress test that changes only the emission factors and confirms the verdict never moves.
3. **Hostile input.** Every numeric field was tried with zero, tiny and enormous values, negatives, 100% and above, blank, NaN and Infinity, plus very long, Unicode and formula-like names. Also corrupt and unavailable browser storage, frozen data to catch accidental changes, and repeated runs to prove determinism.
4. **Outputs.** The same values across the Results page, report, presentation, CSV and JSON. Re-running an exported JSON reproduces the same results. CSV and filename safety.
5. **The real browser.** Five Playwright suites drive Chromium. They check all five demonstration cases through the interface, 15 pages at eight screen sizes from 360 px to 1920 px, keyboard and focus behaviour, projector sizes, print, timings, and every network request. An accessibility scanner (axe-core) found no violation of WCAG 2 A or AA, contrast included, in 33 audits.

A requirements traceability matrix links 91 requirements to code and tests, and a test fails if a file or test it names goes missing.

**Numbers:** 580 tests at the end of Batch 7, **1,323** at the end of Batch 8, across 30 files. The browser checks report 598 passes and no failures.

### What the checking found (and fixed)
Batch 8 found nine defects. None changed any financial formula or rule.

- The verdict INSUFFICIENT EVIDENCE did not say in words that the available economics were unfavourable. Now it does, as information only.
- Inputs so large they overflowed the number range showed Infinity or NaN. They are now refused with a message.
- A vehicle life of 0.000000001 years froze the page. It is now refused. This was the most serious one.
- An amount under ₦1 displayed as "₦0". It now shows "< ₦1".
- Heading levels were skipped, closing the tour dropped keyboard focus, the top bar overlapped at 360 px, and the logo had a mismatched accessible name.
- Outdated wording and dead code were removed.

Full record: `docs/VALIDATION_AND_VERIFICATION.md` and `docs/REQUIREMENTS_TRACEABILITY.md`.

### Observed speed
On the build machine the base assessment takes a few milliseconds. The slowest operation, a viability margin with threshold solving, takes about 0.65 seconds. In the browser the Results page appears in about half a second. These are observations, not promises.

---

## 19. Privacy and security

- **Nothing is sent anywhere.** The application makes no network request with your data. There is no account, analytics, remote database, market-data feed or AI service. A source audit and a live audit of about 6,000 browser requests found only requests to the application's own address and no uploads.
- Your assessment, scenarios and stored analysis live in your browser's local storage. Clearing site data removes them.
- Names you type are shown as plain text, never as markup. CSV cells that could run as spreadsheet formulas are neutralised. Filenames are sanitised.
- No secret or API key is needed to run it. `npm audit` for the runtime packages reported no known vulnerabilities.

---

## 20. Limitations, stated plainly

- **It is a cost comparison of the project or asset.** Loans, interest and the debt and equity split are stored but not used. GreenFleet does not say whether a start-up could obtain finance, repay it or stay solvent. This choice keeps the technology comparison independent of how the vehicles are paid for and avoids counting the purchase twice.
- **No tax, VAT, revenue, general inflation, risk or carbon price.** Maintenance is not escalated.
- **No live data.** Every price, rate and emission factor is yours. Results are only as good as your inputs.
- **Emissions are operational only,** not a full life-cycle estimate.
- **One vehicle profile at a time.** Infrastructure replacement and its end-of-period value are not modelled.
- **Prototype conventions.** The 5% tolerance, the 1% floor, the default sensitivity range and the 12-scenario limit are choices, not standards.
- **Thresholds are not forecasts.** They hold everything else equal.
- **No real-fleet validation.** The software was checked against independent calculations and boundary cases, not against a measured fleet.
- **Accessibility** was tested with automated tools and a keyboard, not with a screen reader.
- **Browsers.** The browser tests used Chromium. Print page breaks differ between browsers. At 1366 by 768, three of the ten presentation screens need a small scroll.
- No rule links route distance to daily distance, and none was invented.

---

## 21. Future work

Documented as deliberately not built: Monte Carlo analysis, optimisation, financing measures (levered cash flow and debt service), tax and revenue and internal rate of return, general inflation, lifecycle and embodied emissions, carbon pricing, infrastructure replacement and terminal value, and a user-facing import of exported files.

---

## 22. How the project was built: the eight batches

| Batch | What it delivered |
| --- | --- |
| **1. Foundation** | App shell, landing page, design system, units and currency, local persistence, first pages |
| **2. Input system** | The schema-driven six-step form, validation that keeps 0, missing and N/A apart, completeness, the normalised input contract |
| **3. Calculation engine** | TCO, present cost, cost per km, NPV, payback, break-even distance, results page and charts |
| **4. Environmental and operational layers** | Estimated emissions from user factors, and rule-based feasibility, kept independent of the economics |
| **5. Commercial viability** | Policy v1.0: four labels, ordered rules, reason codes, decision trace |
| **5.1. User guidance** | Contextual Help, welcome, Quick Tour, glossary |
| **6. Sensitivity, scenarios, thresholds** | One-way, driver and two-way sensitivity, named scenarios, threshold solving, "What would make it viable?" |
| **7. Reporting and presentation** | The professional report, Presentation Mode, CSV and JSON exports, evidence quality |
| **8. Validation and freeze** | Independent benchmarks, hostile-input testing, source audits, accessibility and browser QA, five demonstration cases, the traceability matrix, and the feature freeze |

Batch 8 was deliberately not a feature batch. It asked whether the prototype could be trusted within its stated scope. Its rules were that no methodology would change unless a genuine defect appeared, that nothing would be changed silently, and that every defect would be documented and covered by a regression test.

**MSc Prototype Feature Freeze:** no new major features before the seminar unless there is a critical defect, a methodological error, or a presentation-blocking usability problem.

---

## 23. Running, testing and deploying it

### Run it locally
```
cd greenfleet-viability-lab
npm install
npm run dev            # http://localhost:3000
```
For a stable demonstration, use the production build:
```
npm run build
npm start
```
No internet connection, account or key is needed once the packages are installed.

### Test it
```
npm run typecheck
npm run lint
npm test               # about 1,300 automated tests
npm run e2e            # browser checks against a running build
```
The browser checks use Playwright and Chromium, and an optional accessibility scan with axe-core. They are supplied with environment variables (`PLAYWRIGHT_MODULE`, `CHROMIUM`, `AXE_PATH`) and are not project dependencies.

### Deploy it
The project is a standard Next.js application inside a larger repository. On Vercel, import the GitHub repository, set **Root Directory** to `greenfleet-viability-lab`, keep the Next.js preset, add no environment variables, and deploy. Later pushes to the production branch redeploy automatically.

### Recommended seminar preparation
Use the production build, load each demonstration case once, open the report and the presentation, and keep `docs/DEMO_CASES.md` open on a second screen.

---

## 24. Glossary

| Term | Meaning |
| --- | --- |
| **Analysis horizon** | The number of whole years over which the investment is evaluated |
| **Base Case** | Your current assessment. Every analysis changes a copy of it and never the Base Case itself |
| **BEV** | Battery-electric vehicle |
| **CO2e** | Carbon dioxide equivalent, a common unit for greenhouse gases |
| **Commercial classification transition** | The nearest value of an assumption at which the verdict changes |
| **Discount rate** | The yearly rate used to convert future costs into present value |
| **Economic break-even** | The value at which the incremental NPV against diesel is approximately zero |
| **Emission factor** | Mass of gas emitted per unit of fuel or electricity, supplied by you |
| **Evidence completeness** | How fully the inputs behind a result are answered. It is not statistical confidence |
| **Incremental NPV** | The present-value advantage (positive) or disadvantage (negative) of an alternative compared with diesel |
| **Near break-even** | An NPV within the policy tolerance of zero, currently plus or minus 5% of a stated denominator |
| **Operational feasibility** | Whether a vehicle can do the described work |
| **Payback** | The time to recover the extra up-front cost from savings |
| **Present cost** | Total cost with each year discounted to today |
| **Provenance** | Where a number came from: you, a named source, a demonstration, a derivation, or missing |
| **Sensitivity** | How a result changes when one assumption changes |
| **TCO** | Total cost of ownership: all costs over the period, less resale value |
| **Threshold** | The value of one assumption that reaches a target, with all else equal |
| **Viability margin** | For a VIABLE result, how far an assumption can move before the label changes |

---

## 25. Where to read more

| Document | Contents |
| --- | --- |
| `README.md` | Short overview, how to run, limitations |
| `docs/PROGRESS_SUMMARY.md` | What each batch built and the rules to keep |
| `docs/NORMALIZED_INPUT.md` | Field-by-field input contract |
| `docs/CALCULATION_ENGINE.md` | Formulas, conventions and layers |
| `docs/COMMERCIAL_VIABILITY_POLICY.md` | The full Policy v1.0 text |
| `docs/SENSITIVITY_AND_THRESHOLD_ENGINE.md` | Sensitivity, scenarios, thresholds |
| `docs/REPORTING_AND_PRESENTATION.md` | Report, exports, presentation, evidence quality |
| `docs/USER_GUIDANCE_SYSTEM.md` | Help, welcome and tour |
| `docs/VALIDATION_AND_VERIFICATION.md` | Benchmark worksheets, QA results, defects |
| `docs/REQUIREMENTS_TRACEABILITY.md` | Requirement to code to test |
| `docs/DEMO_CASES.md` | Demonstration cases, live script, examiner questions |
| `CHANGELOG.md` | Batch-by-batch history |

---

## 26. Credits and disclaimer

Built by Group 8, MSc Class of 2025, Centre for Logistics and Transport Studies (CELTRAS), Faculty of Social Sciences, University of Port Harcourt, for SGS 802: Entrepreneurship in Transport and Supply Chain Management.

> GreenFleet is an academic decision-support prototype. Results are model-derived estimates based on the entered assumptions and should not be interpreted as financial, investment, engineering, regulatory or procurement advice.
