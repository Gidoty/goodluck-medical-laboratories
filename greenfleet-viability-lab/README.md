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

## Status: Batch 2 (complete input system)

Implemented: the full six-step assessment wizard, a declarative field schema that drives forms, validation, conditional
visibility, review and normalization, unit conversion, derived previews, optional source (provenance) metadata,
assumption badges, help tooltips, persistence, demo and blank starts, confirmed reset, and the
`NormalizedAssessmentInput` contract (see `docs/NORMALIZED_INPUT.md`).

Deliberately not implemented: TCO, NPV, payback, break-even, emissions calculation, viability classification, scenario and
sensitivity engines, AI, reports. No result is ever shown without a calculation behind it.

Developer view: open the review step with `?debug=1` (or run `npm run dev`) to inspect the exact normalized object.

## Architecture

```
src/app/                   routes (App Router). Pages are thin.
src/components/ui/         design-system primitives (button, card, badge, alert, help tip, assumption badge, confirm dialog, ...)
src/components/layout/     app shell, sidebar, top bar, mobile navigation
src/components/landing/    marketing page sections (the only place the product credit appears)
src/components/assessment/ wizard, schema-driven field controls, review screen, developer panel
src/domain/schema/         THE input schema: fields.ts (one entry per input), sections.ts, options.ts, types.ts
src/domain/                stored types, reader, blank/restore, mutations, validation, checks, completion,
                           derive (previews and unit conversion), normalize + normalized (calculation contract), demo
src/calculation/           reserved for the pure calculation engine (contract only)
src/state/                 framework-free store, persistence repository, confirm gate, React binding
src/content/               glossary (help text)
src/lib/                   units, fuel units, currency, countries, formatting
docs/NORMALIZED_INPUT.md   field-by-field description of the calculation contract
```

Rules the code follows:

- No calculation logic in components. `src/calculation` has no React or browser imports.
- Every numeric input is a `FieldValue`: `value` (including 0), `missing`, or `not_applicable`. Choices keep `unknown` as a real answer.
- Hidden (conditional) inputs read as missing to everything else, so stale values never leak into results.
- Canonical internal units are documented in `src/lib/units.ts` and `docs/NORMALIZED_INPUT.md`. Percentages are 0..100.
- The schema is the single source of truth: add or change an input in one place.
- Persistence is behind `AssessmentRepository`. `localStorage` is one implementation.
- Demo values are labelled "Illustrative assumption — not current market data." No emission factor or market price is shipped.
