# GreenFleet Viability Lab

**GreenFleet MSc Prototype v1.0** (MSc Prototype Feature Freeze)

An academic decision-support prototype that compares a diesel baseline, battery-electric vehicles and biofuel (alternative-fuel) vehicles for a logistics start-up, under the user's own operating and financial assumptions. It was built for the University of Port Harcourt, Centre for Logistics and Transport Studies (CELTRAS), SGS 802.

GreenFleet is **not** certified software and gives **no** financial, investment, engineering, regulatory or procurement advice. Results are model-derived estimates based on the entered assumptions.

## The problem it addresses

A start-up that is choosing between conventional and green vehicles faces four different questions, and a single cost figure answers only one of them. A green vehicle is not automatically the better business choice, and the cheapest vehicle may not suit the routes. GreenFleet keeps the questions apart and then states, by explicit rules, whether each green alternative is commercially viable **relative to diesel**, under the assumptions entered.

## What it supports

**Technologies.** Diesel (the baseline, never labelled), battery electric (BEV), and biofuel / alternative fuel (biodiesel blends, gaseous fuels in litres, kg or m³, new vehicles or conversions).

**Four analytical dimensions, reported side by side and never merged into a score:**

- **Economic performance.** Total cost of ownership, present cost, cost per km, incremental NPV against diesel, simple and discounted payback, break-even distance, year-by-year cash flows. Asset / project perspective: financing is not modelled.
- **Operational feasibility.** Transparent rules for BEV range, routes, charging and payload, and for biofuel supply and infrastructure (Suitable, Conditional, Constrained, Insufficient data).
- **Environmental performance.** Estimated operational energy/fuel-related greenhouse-gas emissions from emission factors the user supplies. Not a life-cycle assessment. No factor is shipped; a missing factor is "Unavailable", never zero.
- **Commercial viability.** GreenFleet Commercial Viability Policy v1.0: **VIABLE**, **CONDITIONALLY VIABLE**, **NOT YET VIABLE** or **INSUFFICIENT EVIDENCE**, decided by ordered rules with no weighted score. Environmental performance never changes the label.

**Analysis on top of the result.** One-way, driver (tornado) and limited two-way sensitivity; named scenarios (up to 12) compared with the Base Case; "What would make it viable?" threshold solving (economic break-even and classification transitions, with a viability margin for results that are already viable). All of it is deterministic, calls the same engine, and never changes the Base Case.

**Reporting and presentation.** A printable professional report (Print / Save as PDF), Presentation Mode for a live seminar, seven CSV tables and a full JSON export, all built from one report model. Evidence quality is described in words, with no score or confidence percentage.

**Guidance.** Contextual Help on every page, a first-visit welcome, a restartable Quick Tour, and five labelled **synthetic demonstration cases** (`docs/DEMO_CASES.md`).

## Run it

```bash
cd greenfleet-viability-lab
npm install
npm run dev          # http://localhost:3000
```

No account, API key or internet connection is needed once the packages are installed. Assessments, scenarios and analyses are stored in the browser only.

For a stable demonstration use the production build:

```bash
npm run build
npm start            # http://localhost:3000
```

## Test it

```bash
npm run typecheck
npm run lint
npm test             # 1,323 automated tests
npm run e2e          # browser checks against a running build (see below)
```

`npm run e2e` drives Chromium with Playwright against a running app. Install Playwright and Chromium wherever you like and point to them:

```bash
npm run build && npx next start -p 3100 &
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM=/path/to/chromium \
AXE_PATH=/path/to/axe-core/axe.min.js npm run e2e      # AXE_PATH is optional
```

How the software was checked, with worked benchmark cases and the defects found, is in `docs/VALIDATION_AND_VERIFICATION.md`. Requirements are traced to code and tests in `docs/REQUIREMENTS_TRACEABILITY.md`, and a test keeps that file honest.

## Architecture

```
src/app/                   routes (App Router). Pages are thin.
src/components/            ui primitives, layout, landing, assessment wizard, results, analysis, report, presentation
src/domain/schema/         THE input schema: one entry per input; forms, validation and review all read it
src/domain/                stored types, reader, mutations, validation, normalize (the calculation contract), demonstration cases
src/calculation/           the pure engine (no React, no browser APIs): economics, environmental/, operational/,
                           viability/ (Policy v1.0), sensitivity/, scenario/, threshold/, analysis/
src/reporting/             the single report model, evidence quality, CSV/JSON exports, presentation screens, identity
src/guidance/              Help content registry, welcome, Quick Tour, modal dialogs
src/state/                 framework-free stores and the persistence repository
src/validation/            Batch 8 validation, audit and traceability tests
e2e/                       browser checks
docs/                      design, policy, validation, demonstration and traceability documents
```

Rules the code follows:

- One authoritative pipeline: normalized input, then `calculateAssessment`. Reports, exports, sensitivity and thresholds read its results and add no formula.
- `0`, missing, unknown, not applicable, not run, not achieved and unavailable are different states everywhere.
- Percentages are entered as 0 to 100; the engine uses decimals. Money is whole units of the chosen currency (NGN by default).
- No market price or emission factor is shipped. Demonstration values are labelled "Illustrative synthetic values for demonstration only. These are not current market prices or investment recommendations."
- No generative AI, no Monte Carlo, no live data, no network call with assessment data.

## Documentation

| Document | Contents |
| --- | --- |
| `docs/PROJECT_DOCUMENTARY.md` | The whole project in one readable document: purpose, method, design, checking, limits |
| `docs/PROGRESS_SUMMARY.md` | What each batch built, and the rules to keep |
| `docs/NORMALIZED_INPUT.md` | The input contract |
| `docs/CALCULATION_ENGINE.md` | Formulas, conventions and layers |
| `docs/COMMERCIAL_VIABILITY_POLICY.md` | Policy v1.0 |
| `docs/SENSITIVITY_AND_THRESHOLD_ENGINE.md` | Sensitivity, scenarios, thresholds |
| `docs/REPORTING_AND_PRESENTATION.md` | Report, exports, presentation, evidence quality |
| `docs/USER_GUIDANCE_SYSTEM.md` | Help, welcome and tour |
| `docs/VALIDATION_AND_VERIFICATION.md` | Benchmarks, QA results, defects, limitations |
| `docs/REQUIREMENTS_TRACEABILITY.md` | Requirement to code to test |
| `docs/DEMO_CASES.md` | Demonstration cases, the live-demo script, the failure plan, examiner questions |
| `CHANGELOG.md` | Batch-by-batch history |

## Prototype limitations

- It evaluates **project and asset economics**. Loans, interest and the debt/equity split are stored but not used; GreenFleet does not say whether a start-up could finance, repay or survive an investment.
- It is a cost comparison. Revenue, tax, VAT, general inflation, risk and carbon pricing are not modelled; maintenance is not escalated.
- Results are only as good as the inputs. The user supplies every price, rate and emission factor. There is no live market data.
- Emissions are estimated operational energy/fuel-related emissions only, not a life-cycle assessment. Lifecycle adjustments are recorded but not applied.
- One vehicle profile at a time. Infrastructure replacement and terminal value are not modelled.
- The 5% near-break-even tolerance, the 1% denominator floor, the default sensitivity range and the 12-scenario limit are prototype conventions, not academic consensus.
- Thresholds hold all else equal and are not forecasts.
- Categorical conditions (charging access, fuel availability) are never priced or turned into numbers.
- Validated against independent hand calculations and boundary cases, not against a real fleet.

## MSc Prototype Feature Freeze

No new major features before the seminar unless there is a critical defect, a methodological error or a presentation-blocking usability problem.

## Academic attribution

Built by Group 8, MSc Class of 2025, CELTRAS, University of Port Harcourt (Faculty of Social Sciences). Course: SGS 802, Entrepreneurship in Transport and Supply Chain Management.
