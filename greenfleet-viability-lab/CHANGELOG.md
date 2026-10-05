# Changelog

GreenFleet MSc Prototype. Newest first. Details for each batch are in `docs/PROGRESS_SUMMARY.md`.

## Batch 8: scientific validation, hardening and freeze (GreenFleet MSc Prototype v1.0)

No methodology change. The Commercial Viability Policy stays at v1.0.

- Independent hand-calculated benchmarks (simple, replacement, infrastructure, escalation), the financing boundary, NPV sign, payback, cost per km and charging loss.
- Policy v1.0 decision table (32 combinations), gate order, near-break-even boundaries and an environmental-independence stress test.
- Environmental, operational (exact boundary equality), sensitivity, driver, scenario and threshold-solver validation, including a closed-form threshold benchmark.
- Adversarial and robustness suite; determinism, mutation, persistence and export round-trip checks; CSV and filename security.
- Source audits: network and security, unsupported claims, dependencies and licences, units, Help and Methodology.
- Five synthetic demonstration cases with a confirmation guard and a way back to a blank assessment.
- Defects fixed: an insufficient-evidence result now states the available economic evidence (D-1); overflowing inputs and a vanishing vehicle life are refused instead of producing Infinity/NaN or freezing the page (D-2, D-3); a real amount under ₦1 no longer displays as ₦0 (D-4); heading levels, tour focus return, top-bar overlap and a logo name corrected (D-5 to D-8); stale wording removed (D-9).
- One core disclaimer in Help, About, the report and the export metadata; prototype version `GreenFleet MSc Prototype v1.0` in About, the report and the exports.
- Browser QA (`e2e/qa.cjs`): demonstration cases, 15 routes at 8 viewport sizes, axe-core, keyboard and focus, projector sizes, print, timings and a network audit.
- Dead code removed. New documents: `VALIDATION_AND_VERIFICATION.md`, `DEMO_CASES.md`, `REQUIREMENTS_TRACEABILITY.md`; README finalised.
- Tests: 580 to 1,323.

## Batch 7: reporting, export and presentation

Professional report with print support, Presentation Mode, seven CSV tables and a JSON export, evidence quality and provenance (descriptive, no score), stored sensitivity and threshold results tied to the current inputs, and browser checks moved into `e2e/`.

## Batch 6: sensitivity, scenarios and thresholds

One-way, driver and two-way sensitivity; named scenarios with comparison; threshold solving by bracketing and bisection verified by the engine; "What would make it viable?" and the viability margin.

## Batch 5.1: user guidance

Contextual Help, first-visit welcome, restartable Quick Tour, step notes, glossary.

## Batch 5: commercial viability decision engine

GreenFleet Commercial Viability Policy v1.0: VIABLE, CONDITIONALLY VIABLE, NOT YET VIABLE, INSUFFICIENT EVIDENCE by ordered rules, with reason codes and a decision trace. Environmental performance never changes the label.

## Batch 4: environmental and operational layers

Estimated operational energy/fuel-related emissions from user-supplied factors; rule-based BEV and biofuel operational feasibility; three separate completeness indicators.

## Batch 3: calculation engine and results

TCO, present cost, cost per km, incremental NPV, simple and discounted payback, break-even distance, year-by-year cash flows, assumptions, warnings and charts. Asset / project perspective.

## Batch 2: complete input system

Schema-driven six-step wizard, conditional fields, unit conversion, validation, completeness, provenance metadata and the normalized input contract.

## Batch 1: foundation

App shell, landing page, design system, domain types, units and currency, local persistence and the first pages.
