# GreenFleet Viability Lab

Techno-economic decision support for green logistics entrepreneurs. Compares diesel (baseline), battery-electric and biofuel
fleets under the user's own operating and financial assumptions. Academic proof of concept, University of Port Harcourt
(CELTRAS, SGS 802). Not financial or engineering advice.

This folder is a self-contained project inside a larger repository: own `package.json`, own dependencies, own build.
`next.config.ts` pins the project root so Next.js never reads the parent project's files.

## Run

```bash
cd greenfleet-viability-lab
npm install
npm run dev          # http://localhost:3000
npm run lint
npm run typecheck
npm test
npm run build
```

## Status: Batch 6 (sensitivity, scenarios and thresholds)

Implemented: Batch 2's complete input system, plus the techno-economic engine in `src/calculation/` and the results page that
displays it: total cost of ownership, present cost, cost per km, incremental NPV, simple and discounted payback, break-even
distance, operating savings, year-by-year cash flows, assumptions used, warnings, and three charts.

See `docs/CALCULATION_ENGINE.md` (design and conventions) and `docs/NORMALIZED_INPUT.md` (input contract). The formulas are
also on the in-app Methodology page.

Batch 4 adds two analytical layers, each independent of the cost engine and of each other: estimated operational
energy/fuel-related GHG emissions (from emission factors the user supplies; none are shipped) and rule-based operational
feasibility for battery-electric and biofuel (Suitable, Conditional, Constrained, Insufficient data). The results page shows
Economic, Operational and Environmental sections separately, with three separate data-completeness indicators.

Batch 6 adds one-way, driver and two-way sensitivity, saved scenarios with comparison, and the "What would make it viable?" threshold analysis (`docs/SENSITIVITY_AND_THRESHOLD_ENGINE.md`). Batch 5.1 adds contextual Help, a first-visit welcome and a restartable Quick Tour (`docs/USER_GUIDANCE_SYSTEM.md`). Batch 5 adds the rule-based commercial classification of battery electric and biofuel against diesel (VIABLE, CONDITIONALLY VIABLE, NOT YET VIABLE, INSUFFICIENT EVIDENCE) under GreenFleet Commercial Viability Policy v1.0 (`docs/COMMERCIAL_VIABILITY_POLICY.md`). There is no weighted score, and environmental performance does not change the label.

Deliberately not implemented: Monte Carlo, optimisation, AI,
report export, carbon pricing, lifecycle (embodied) emissions. The classification is decision support under your assumptions, not investment advice.

Developer view: open the review step with `?debug=1` (or run `npm run dev`) to inspect the exact normalized object.

## Architecture

```
src/app/                   routes (App Router). Pages are thin.
src/components/ui/         design-system primitives (button, card, badge, alert, help tip, assumption badge, confirm dialog, ...)
src/components/layout/     app shell, sidebar, top bar, mobile navigation
src/components/landing/    marketing page sections (the only place the product credit appears)
src/components/assessment/ wizard, schema-driven field controls, review screen, developer panel
src/components/results/    results page: tiles, tables, charts, warnings, assumptions
src/domain/schema/         THE input schema: fields.ts (one entry per input), sections.ts, options.ts, types.ts
src/domain/                stored types, reader, blank/restore, mutations, validation, checks, completion,
                           derive (previews and unit conversion), normalize + normalized (calculation contract), demo
src/calculation/           the pure calculation engine (no React, no browser APIs); tested without the UI
src/state/                 framework-free store, persistence repository, confirm gate, React binding
src/content/               glossary (help text)
src/lib/                   units, fuel units, currency, countries, formatting
docs/NORMALIZED_INPUT.md   field-by-field description of the calculation contract
```

Rules the code follows:

- No calculation logic in components. `src/calculation` has no React or browser imports. The results page only formats what the engine returns.
- Every numeric input is a `FieldValue`: `value` (including 0), `missing`, or `not_applicable`. Choices keep `unknown` as a real answer.
- Hidden (conditional) inputs read as missing to everything else, so stale values never leak into results.
- Canonical internal units are documented in `src/lib/units.ts` and `docs/NORMALIZED_INPUT.md`. Percentages are 0..100.
- The schema is the single source of truth: add or change an input in one place.
- Persistence is behind `AssessmentRepository`. `localStorage` is one implementation.
- Demo values are labelled "Illustrative assumption — not current market data." No emission factor or market price is shipped.
