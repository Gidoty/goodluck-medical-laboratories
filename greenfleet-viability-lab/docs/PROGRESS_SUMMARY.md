# GreenFleet Viability Lab: progress summary (Batches 1 to 3)

**Project:** web decision-support tool comparing diesel, battery-electric (BEV) and biofuel fleets for logistics start-ups. Academic prototype, University of Port Harcourt (CELTRAS).
**Where:** folder `greenfleet-viability-lab/` in repo `gidoty/goodluck-medical-laboratories`, branch `ccr-7360588a-pkyx8s`. Independent of the rest of the repo.
**Stack:** Next.js 16 (App Router), React 19, strict TypeScript, Tailwind 4, Recharts, Vitest. Run: `cd greenfleet-viability-lab && npm install && npm run dev`.

## Batch 1: foundation
App shell with sidebar and mobile menu, landing page, design system (forest green, navy, off-white), reusable UI components, domain types, unit and currency system (NGN default), validation helpers that keep 0, missing and not applicable apart, local persistence behind a repository interface. Pages for Overview, Assessment, Results, Sensitivity, Scenarios, Methodology, About.

## Batch 2: complete input system
- One declarative field schema (`src/domain/schema/fields.ts`) drives the forms, validation, conditional visibility, review screen and normalization.
- Six-step wizard (Business & Fleet, Diesel, Battery Electric, Biofuel, Finance & Infrastructure, Review) with essential inputs plus collapsed advanced assumptions.
- Conditional fields, unit choices with automatic conversion, optional source metadata, assumption badges, help tooltips, completeness indicator, confirmed reset, blank start (default) and a labelled illustrative demo.
- `NormalizedAssessmentInput` is the contract the engine reads (`docs/NORMALIZED_INPUT.md`). Developer view at review step with `?debug=1`.
- The Group 8 product credit appears only on the landing page footer.

## Batch 3: calculation engine and results
- Pure engine in `src/calculation/` (no React). Entry points: `calculateAssessment(normalizedInput)` and `runAssessment(assessment)`.
- Calculates per technology: total cost of ownership, present cost, cost per km, year-by-year costs in 13 categories. Per alternative versus diesel: incremental cash flow, NPV, simple and discounted payback, break-even distance, operating savings.
- Results page: headline tiles, cost cards, comparison tables, three charts (cumulative cash flow, TCO, cost components), warnings, "Assumptions used", year-by-year table. Formulas are on the Methodology page.
- Shows "Commercial classification pending multi-factor assessment". No viability label is assigned.

## Rules to keep
- Asset perspective only. Loans, interest and equity are stored but excluded from NPV and TCO.
- Escalation applies only if the user entered it. A blank is held constant and shown as a missing assumption.
- Inputs use percentages 0 to 100; the engine uses decimals. Charging loss: grid energy = vehicle energy / (1 - loss).
- Infrastructure costs are project totals; the fleet pays min(1, assessed vehicles / vehicles using the chargers). Utilisation is not used for cost sharing.
- A replacement vehicle is bought each time the useful life ends before the horizon (none at exactly the final year). Unknown battery replacement is excluded and warned about.
- Tax credits and "other" incentives are excluded (timing undefined). Tax, revenue, IRR and general inflation are not modelled.
- No market prices or emission factors are shipped. Demo values are labelled "Illustrative assumption, not current market data."

## Quality status
228 automated tests, lint, typecheck and production build all pass. Browser-checked at desktop, laptop, tablet and mobile with no console errors or horizontal overflow. Two hand-verifiable calculation cases are in the tests.

## Already in the code for later batches
Operational inputs are collected but not yet used: BEV usable range, charging opportunity, downtime, payload impact; biofuel availability, refuelling distance, downtime. Emission factor fields (value, unit, source, year, notes, lifecycle adjustment) are collected and carried in the normalized input but unused. Types exist for `SensitivityVariable`, `Scenario`, `ViabilityStatus`, and a `StatusBadge` component. Sensitivity and Scenarios pages are placeholders.

## Not built yet
Emissions calculation, operational feasibility, viability classification, sensitivity and scenario engines, threshold solving ("what would make it viable"), AI interpretation, report export, saved scenarios.

## Decisions to confirm
- A converted biofuel vehicle replaced within the horizon repeats the conversion cost (no replacement vehicle price is entered).
- Infrastructure replacement and end-of-period value are not modelled, only warned about.
- Battery replacement repeats in each later vehicle cycle.
