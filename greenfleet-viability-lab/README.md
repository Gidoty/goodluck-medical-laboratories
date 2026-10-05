# GreenFleet Viability Lab

A techno-economic decision-support prototype that compares diesel (baseline), battery-electric (BEV) and biofuel-blend
vehicles for logistics start-ups. It is an academic proof of concept for the MSc seminar in Entrepreneurship in Transport and
Supply Chain Management, CELTRAS, University of Port Harcourt. It is not a certified financial, engineering or
investment-advisory system.

This folder is a self-contained project with its own `package.json`, dependencies and build. It shares no code with the rest of
the repository. The only root files touched are `tsconfig.json` and `eslint.config.mjs`, which now ignore this folder so the
existing Next.js build does not try to compile it.

## Run

```bash
cd greenfleet-viability-lab
npm install
npm run dev        # http://localhost:5173
npm test           # engine tests (vitest)
npm run build      # typecheck + production build into dist/
```

## Design rules

1. Diesel is the baseline, not an inferior option. The numbers decide the outcome.
2. BEV and biofuel get no automatic favour. If diesel is cheaper, the app says so.
3. Commercial viability and emissions are separate. Lower emissions never raise a classification.
4. All figures come from deterministic code in `src/engine`. No AI touches any calculation.
5. Every input has a unit; money fields show the selected currency (default Naira). Changing currency relabels, it does not convert.
6. Every default is an editable, illustrative placeholder. No market price or statistic is presented as fact.
7. Sensitivity analysis, stress tests, break-evens and a two-way table are core features.
8. `0`, blank (missing) and `N/A` are different. Blank on a required field is an error; `0` is a real value; `N/A` is explicit.
9. Validation rejects impossible inputs: negative distance or price, zero lifetime, percentages out of range, a horizon longer than vehicle life, fractional years.
10. The Methodology tab lists every formula, unit, default and rule, including the live thresholds.

## Layout

```
src/engine/fields.ts       input registry: units, ranges, defaults, provenance
src/engine/validate.ts     validation; separates 0 / missing / N/A
src/engine/model.ts        cash flows, loan, TCO, NPV, payback, emissions
src/engine/evaluate.ts     runs all three technologies and the comparison with diesel
src/engine/sensitivity.ts  one-way, stress tests, break-even, two-way grid
src/engine/decision.ts     VIABLE / CONDITIONALLY VIABLE / NOT YET VIABLE rules
src/engine/engine.test.ts  tests
src/ui/                    React dashboard, inputs, sensitivity, scenarios, methodology
```

## Classification rules

- Hard rule: operational feasibility (BEV range with safety margin and charging time; biofuel blend within the approved maximum). Failing gives NOT YET VIABLE.
- VIABLE: NPV versus diesel is positive, payback is within the limit, and enough adverse stress tests keep NPV positive.
- CONDITIONALLY VIABLE: NPV is positive but payback or robustness fails, or NPV is negative by no more than the near-miss tolerance.
- NOT YET VIABLE: anything else.

All thresholds are editable inputs.

## Not yet included

AI advisory text (it would only restate the computed results), tax and subsidies, carbon pricing, multi-vehicle fleets, and
sourced default data. Add a cited default only with its reference stored next to the value.
