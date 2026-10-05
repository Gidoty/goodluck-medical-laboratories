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

## Status: Batch 1 (foundation and interface shell)

Implemented: navigation, landing page, six-step assessment wizard with local persistence, domain model, unit and currency
system, validation architecture, results/sensitivity/scenarios placeholders, methodology and about pages.

Deliberately not implemented: the calculation engine, viability classification rules, charts, scenario saving, AI features.
No result is ever shown without a calculation behind it.

## Architecture

```
src/app/                 routes (App Router). Pages are thin; they compose components.
src/components/ui/       design-system primitives (button, card, badge, alert, KPI card, status badge, ...)
src/components/layout/   app shell, sidebar, top bar, mobile navigation
src/components/landing/  marketing page sections
src/components/assessment/ wizard, form fields, step progress, review panel
src/components/results/  overview and results views
src/domain/              types, field registry, validation, assessment helpers, demo data
src/calculation/         reserved for the pure calculation engine (contract only)
src/state/               framework-free store, persistence repository, React binding
src/lib/                 units, currency, formatting, small utilities
```

Rules the code follows:

- No calculation logic in components. `src/calculation` has no React or browser imports.
- Every numeric input is a `FieldValue`: `value` (including 0), `missing`, or `not_applicable`. Never test inputs with truthiness.
- Canonical internal units are documented in `src/lib/units.ts`. Percentages are 0..100.
- One registry (`src/domain/fields.ts`) defines each form input's label, unit and validation rule.
- Persistence is behind `AssessmentRepository`. `localStorage` is one implementation and can be replaced.
- Demo values are labelled "Illustrative demo assumption — not current market data." and are never presented as market data.
