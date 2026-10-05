# GreenFleet Viability Lab: progress summary (Batches 1 to 8)

**Status:** MSc Prototype Feature Freeze. Prototype identifier: `GreenFleet MSc Prototype v1.0` (separate from `GreenFleet Commercial Viability Policy v1.0`).
**How to read this file:** each batch section describes that batch when it was built; the current state is in Batch 8, 'Quality status' and 'Not built'.
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
- Showed "Commercial classification pending multi-factor assessment" (replaced in Batch 5).

## Batch 4: environmental and operational layers
- Principle: economic attractiveness, operational feasibility and environmental performance are three separate answers. They are shown side by side and never combined. No score, no classification.
- **Environmental** (`src/calculation/environmental/`): estimated operational energy/fuel-related emissions = physical use x emission factor the user supplies. kg CO2e inside; tonnes for display. Units checked (litre, kg, m3, kWh; g to kg; CO2-only flagged); a mismatch or missing factor gives "unavailable", never zero. BEV uses grid kWh = delivered / (1 - charging loss). Change vs diesel = (diesel - alt) / diesel x 100. Scope labels and source provenance recorded. Lifecycle adjustment is recorded, not applied. No embodied emissions, no carbon price.
- **Operational** (`src/calculation/operational/`): transparent rules over the user's inputs. Statuses: Suitable, Conditional, Constrained, Insufficient data. BEV: range margin (no safety buffer), single-route range, charging, payload. Biofuel: supply and infrastructure. Diesel shown as "Baseline configuration". Charging time, refuelling distance and downtime are shown, never priced. Each result carries a rule trace.
- Three separate completeness states (economic, operational, environmental). Evidence-count denominators are explicit; "unknown" does not count as answered.
- Results page now has an Economic section (unchanged figures), an Operational section (status cards, BEV range bars), an Environmental section (table, chart with table view), a three-part summary per alternative, completeness indicators, and warnings grouped by layer. Calls to action: "Add Emission Factors" and "Review Operational Inputs" (jump to the right form section).
- Input changes: each emission factor now has an optional "what the factor covers" choice; the unit id and scope reach the normalized input. Fixed: links with a section anchor now open a collapsed form section.
- Methodology page gained "Environmental methodology" and "Operational feasibility methodology".
- Demo data still contains no emission factors, so demo emissions show as unavailable until you enter your own.

## Batch 5: commercial viability decision engine
- `src/calculation/viability/` implements **GreenFleet Commercial Viability Policy v1.0** (full text in `docs/COMMERCIAL_VIABILITY_POLICY.md`). BEV and biofuel are each classified against diesel as VIABLE, CONDITIONALLY VIABLE, NOT YET VIABLE or INSUFFICIENT EVIDENCE. Diesel stays the unlabelled baseline.
- Hierarchical rules, no weighted score: consistency check, evidence sufficiency, operational feasibility (hard constraint vs remediable condition), economic case (favourable / near break-even / unfavourable), then conditions and material uncertainties.
- Economic case uses the Batch 3 NPV (unchanged). Near break-even = |NPV| within ±5% of the additional initial investment (positive and at least 1% of diesel present cost), else of the diesel present cost. Prototype policy values, held in one policy object. Floating-point tolerance is separate.
- Environmental performance is shown beside the label and never changes it. Missing emission factors do not block classification. Unknown battery replacement gives CONDITIONALLY VIABLE.
- Each result carries reason codes, supporting evidence, conditions, uncertainties, hard constraints, next steps, evidence completeness, a decision trace and the policy version.
- Results page: headline classification cards (with Conditions to Resolve / Primary barriers / What is missing / viable wording), a dimensions matrix, "Why this result?" panels with the trace, and a policy note. The "pending" message is gone. Methodology page has the policy section.
- Not built: sensitivity, scenarios, threshold solving, AI, export, saved-scenario storage.

## Batch 5.1: user guidance system
- New `src/guidance/` module (details in `docs/USER_GUIDANCE_SYSTEM.md`): a central static content registry, a context-aware Help panel (side drawer on desktop, bottom sheet on mobile), a first-visit welcome, a 7-step skippable Quick Tour that can be restarted from Help, and page and section help buttons.
- Onboarding state (completed, skipped or dismissed) is kept under its own storage key and never touches assessment data.
- Every assessment step has a short "In this step / Next" note. Results have help for the economic, operational, environmental and commercial parts, the decision trace, and an honest empty state.
- Field help rewritten or added for the technically difficult inputs; NPV, payback and TCO help on Results. "Why is this required?" appears under missing required values.
- Home has a "How GreenFleet Works" panel. Sensitivity and Scenarios help says plainly that those tools are not available yet.
- No calculation, operational rule, environmental rule or Policy v1.0 change.

## Batch 6: sensitivity, scenarios and thresholds
- Three isolated engines (`src/calculation/sensitivity|scenario|threshold`, shared `analysis/`) that call the existing engine. Nothing in the financial, environmental, operational or Policy v1.0 code changed. The Base Case is cloned, never mutated. Details: `docs/SENSITIVITY_AND_THRESHOLD_ENGINE.md`.
- **Sensitivity page**: Base Case card, "What would make it viable?" (heading becomes "...fully viable?" or "Viability margin"), one-way sensitivity with a chart (NPV = 0 line, Base Case marker, solved crossing), a driver (tornado) chart and table, and a limited two-way grid with an economic break-even frontier.
- **Thresholds**: economic break-even and Policy v1.0 classification transitions, solved by bracketing, a monotonic check, bisection and engine verification. Ten explicit statuses; failure states carry no number. Economic break-even is kept separate from commercial viability, and barriers are grouped as economic, operational and evidence. Categories such as fuel availability are qualitative remedies only.
- **Scenarios page**: build, edit, duplicate, rename and delete named sets of overrides (up to 12, saved in this browser), compare with the Base Case, and create a scenario from a solved threshold.
- Results page buttons route to the analysis. Help, tour text and Methodology now describe the working tools.
- Tests changed on purpose: the Batch 5.1 "coming later" guidance tests and the Batch 5 "Explore What Could Change This Result" CTA test, because Batch 6 activates those features; the cross-domain help-topic count (nine to ten).
- Not built: Monte Carlo, optimisation, report export, AI interpretation.

## Batch 7: reporting, export, presentation and evidence quality
- `src/reporting/` builds one report model from results the engine already produced (`docs/REPORTING_AND_PRESENTATION.md`). Nothing is recalculated.
- **Professional report** at `/report`: executive summary, profile, assumptions with provenance and sources, comparison, economics with charts, operational, environmental (scope stated), commercial viability, decision trace, sensitivity, scenarios, thresholds or viability margin, evidence quality, methodology, limitations, disclaimer. Print / Save as PDF through the browser; print CSS hides the app chrome. Optional sections can be switched off.
- **Evidence quality** is descriptive (complete, partial, insufficient, unavailable), with provenance counts, critical missing inputs and material uncertainties. No score and no confidence percentage. Shown in the report and in a new "Evidence & Assumptions" panel on Results.
- **Exports**: seven CSV tables and a full JSON, created locally with raw numbers, metadata and safe filenames.
- **Presentation Mode** at `/present`: up to ten decision-focused screens, keyboard and button navigation, no auto-advance.
- Sensitivity, driver and threshold results from the Sensitivity page are now remembered locally (tied to the current inputs) so the report and presentation can show them without rerunning.
- Help, tour and Methodology updated. The authorship line is allowed in the generated report only.
- QA debt cleared: the browser checks now live in `e2e/` (`npm run e2e`), start deterministically and match the product.
- Tests changed on purpose: the attribution-file test now allows `reporting/identity.ts`, and the Help index count (eleven topics).

## Batch 8: scientific validation, hardening, demonstration readiness and freeze
Not a feature batch. It asks whether GreenFleet can be trusted as a coherent, reproducible, academically defensible prototype within its scope. Full results: `docs/VALIDATION_AND_VERIFICATION.md`; requirement to code to test: `docs/REQUIREMENTS_TRACEABILITY.md`; demonstration and examiner guide: `docs/DEMO_CASES.md`.
- **Independent benchmarks.** Four hand-calculated fixtures (simple, replacement and battery cycle, infrastructure allocation, escalation) with expected values written as plain arithmetic; the financing boundary; NPV sign; payback states; cost per km; charging loss; a closed-form threshold benchmark (relative error below 1e-6); a closed-form driver-ranking benchmark.
- **Policy v1.0.** A 32-row decision table, gate order, exact near-break-even boundaries and denominators, NPV = 0 is not VIABLE, and an environmental-independence stress test. No rule changed.
- **Hardening.** Adversarial inputs on every numeric field, hostile names, engine-level hostile objects, numerical robustness, determinism, mutation safety, persistence failure, JSON round trip, CSV and filename security.
- **Defects found and fixed (none changed methodology).** D-1 an insufficient-evidence result now states the available economic evidence (disclosure only). D-2 inputs that overflow are refused, never shown as Infinity or NaN. D-3 a vanishing vehicle life no longer freezes the page. D-4 a real amount under one currency unit no longer displays as zero. D-5 to D-8 heading levels, focus return after the tour, a top-bar overlap at 360 px, a logo name. D-9 stale wording. Table in the validation document.
- **Demonstration cases.** Five labelled synthetic cases (strong BEV, positive NPV with daytime charging, negative NPV with a range constraint, attractive biofuel with intermittent supply, critical evidence missing), loaded from a keyboard-accessible menu, asking before replacing work, with a way back to a blank assessment.
- **Identity and wording.** `GreenFleet MSc Prototype v1.0` in About, the report and the exports. One core disclaimer in Help, About, the report and the export metadata. Terminology, claim, currency and unit audits; Methodology and Help re-read and corrected; dead code removed.
- **QA.** `e2e/qa.cjs`: demonstration cases through the real interface; 15 routes at 360, 390, 430, 768, 1024, 1366, 1440 and 1920 px; axe-core (33 audits, 0 violations); keyboard and focus; presentation at projector sizes; print and PDF; timings; a network audit (no external request, no POST).
- **Docs.** New `VALIDATION_AND_VERIFICATION.md`, `DEMO_CASES.md`, `REQUIREMENTS_TRACEABILITY.md`; new `CHANGELOG.md`; README finalised.
- **Freeze.** No new major feature before the seminar unless there is a critical defect, a methodological error or a presentation-blocking usability problem.
- Tests changed on purpose: the `formatMoney(-0.2)` expectation (D-4), the Help disclaimer wording, the "Commercial classification transition" term, and the numbered-section selector in the report test (D-5).

## Rules to keep
- Asset perspective only. Loans, interest and equity are stored but excluded from NPV and TCO.
- Escalation applies only if the user entered it. A blank is held constant and shown as a missing assumption.
- Inputs use percentages 0 to 100; the engine uses decimals. Charging loss: grid energy = vehicle energy / (1 - loss).
- Infrastructure costs are project totals; the fleet pays min(1, assessed vehicles / vehicles using the chargers). Utilisation is not used for cost sharing.
- A replacement vehicle is bought each time the useful life ends before the horizon (none at exactly the final year). Unknown battery replacement is excluded and warned about.
- Tax credits and "other" incentives are excluded (timing undefined). Tax, revenue, IRR and general inflation are not modelled.
- No market prices or emission factors are shipped. Demo values are labelled "Illustrative assumption, not current market data."

## Quality status
1,323 automated tests (580 at the end of Batch 7, 743 added in Batch 8), lint, typecheck and production build pass. Browser checks (`npm run e2e`): five suites, no console error or warning, no failed resource, no external request, axe-core clean (WCAG 2 A/AA). Independent hand-calculated benchmarks, a 32-row policy decision table and a self-checking traceability matrix are in the tests.

## Not built (deliberately, and documented as future work)
Monte Carlo analysis, optimisation, generative AI, live market data, financing metrics (levered cash flow, debt service), tax, revenue and IRR, general inflation, lifecycle (embodied) emissions, carbon pricing, infrastructure replacement and terminal value, a user-facing import of exported files.

## Decisions to confirm
- A converted biofuel vehicle replaced within the horizon repeats the conversion cost (no replacement vehicle price is entered).
- Infrastructure replacement and end-of-period value are not modelled, only warned about.
- Battery replacement repeats in each later vehicle cycle.
- Decided in Batch 8: the demonstration cases ship no emission factors, on purpose, so emissions show as Unavailable and the 'refuse to invent' behaviour can be demonstrated.
- Biofuel downtime is read as hours per month per vehicle. Refuelling distance is not annualised, because no refuelling frequency is collected.
- Gate 1 runs before the economic case: a missing critical operational item gives INSUFFICIENT EVIDENCE even with a negative NPV. Confirmed in Batch 8 and kept. The output now also states that the available economic evidence is unfavourable, as information only.
- Limited biofuel supply alone is a condition (no required fuel volume is collected). Limited supply plus unspecified needed infrastructure is a hard constraint.
- The 5% tolerance and 1% denominator floor are prototype policy values.
