# Reporting, export and presentation (Batch 7)

Reporting is downstream of calculation. Nothing here recalculates a financial, operational, environmental or
classification result. Policy v1.0, the financial formulas and the Batch 4 rules are unchanged.

## Architecture (`src/reporting/`)
| File | Role |
| --- | --- |
| `model.ts` | `buildReportModel({input, result, analysis, scenarios, options, now})`. Pure. The single model behind the screen report, the print view, the presentation and the exports. |
| `types.ts` | `ReportModel`, `Cell` (money, per-km, tonnes, payback, class, baseline, unavailable, not_run, na), `ReportOptions`. |
| `cells.ts` | `cellText` (display) and `cellRaw` (raw value plus status for exports). One formatter layer: it reuses `resultFormatter`. |
| `executive.ts` | `buildExecutiveSummary`, `buildKeyTakeaways`: fixed sentence templates filled from the structured results. |
| `evidence.ts` | `buildEvidenceQuality`: descriptive evidence states, provenance counts, critical missing, material uncertainties, material assumptions. |
| `limitations.ts` | `buildLimitations`: only limitations that apply to this assessment. |
| `provenance.ts` | `classifyAssumption`: one mapping to the existing badge classes (user, sourced, illustrative, derived, convention, missing/excluded). Used by Results, report and evidence view. |
| `exports.ts`, `download.ts` | CSV and JSON builders, safe filenames, local file save. |
| `analysisRecord.ts` | Keeps the sensitivity, driver and threshold analyses the user ran, tied to a fingerprint of the Base Case. |
| `presentation.ts` | Screen list and navigation reducer. |
| `identity.ts` | Product, version and authorship constants, and the disclaimer. |
| `phrases.ts` | Fixed noun phrases for reason codes. |

Routes: `/report` (inside the app shell, print-ready) and `/present` (full screen, no shell). Components:
`components/report/*`, `components/present/*`. The Results page links to both and has an "Evidence & Assumptions" panel.

## Where the numbers come from
The Base Case result is the same `runAssessment` output the Results page uses. Sensitivity, driver and threshold sections come from
what the user ran on the Sensitivity page for the current inputs (saved locally under `greenfleet-viability-lab:analysis`, with a
fingerprint of the normalized input). If the inputs have changed since, the saved analysis is ignored and the report says the analysis
has not been run. The report never reruns them. Scenarios are compared with the existing `compareScenarios` (one engine run each, at most 12).

Availability is explicit and never collapsed: *not run* (sensitivity, thresholds), *none saved* (scenarios), *unavailable* with a reason
(emissions), *not achieved within the horizon* (payback), *baseline* (diesel), *not applicable*.

## Executive summary
About 100 to 200 words when the data allow: the operation, then one paragraph per alternative (classification, economic case with the NPV,
operational constraints and conditions, uncertainties, environmental result), then what could change the decision (largest tested driver and
the first solved threshold, or a statement that the analysis was not run). The two alternatives are always described separately.
Insufficient evidence produces "GreenFleet cannot classify ... because ..." and no recommendation. Key decision points and the
presentation takeaways use the same structured results.

## Evidence quality
Descriptive only. Per alternative: economic (complete, partial, insufficient), operational (complete, partial, insufficient with items answered of total),
environmental (complete, partial, unavailable). Provenance counts (user, sourced, illustrative, derived, convention, missing or excluded),
the list and count of critical missing inputs and of material uncertainties, and a plain statement such as "Economic and operational evidence are
sufficient, but one material uncertainty remains." There is **no score and no confidence percentage**. GreenFleet calculates no statistical
confidence for the classification (`statisticalConfidence: "not calculated"`). Material assumptions are taken from the Policy v1.0 reason codes,
the tested drivers and solved thresholds, not from the form.

## Report structure
Cover (identity, dates, currency, horizon, versions, policy, authorship), executive decision summary, assessment profile, assumptions and data
sources (category, variable, value, unit, provenance, source, year, notes), technology comparison, economic performance (with the TCO and
cash-flow charts), operational feasibility, environmental performance (scope stated, factors and sources), commercial viability, decision trace,
sensitivity, scenarios, what would make it viable or the viability margin, evidence quality, methodology summary, limitations, disclaimer, footer.
Sections with nothing to show are left out or say why. The user can include or leave out sensitivity, scenarios, thresholds, detailed assumptions
and the methodology appendix. A source, year or note is shown only if the user supplied it; otherwise "Not supplied".
The authorship line ("Built by Group 8, MSc Class of 2025, CELTRAS") appears in the generated report only, not on ordinary application pages.

## Print and PDF
The strategy is the browser's print dialog. The button is labelled **Print / Save as PDF** because that is what it does. Print CSS
(`globals.css`, `@media print`) and `print:` utility classes hide the sidebar, top bar, Help button, skip link, toolbar and interactive chart controls;
set A4 margins; start the report body after the cover; avoid breaking cards, figures, table rows and list items; keep headings with their content. Wide
tables stop scrolling and fit the page in print.

## Exports
All exports are created in the browser and never uploaded. Filenames are `greenfleet-assessment-<slug>-<type>-<YYYY-MM-DD>.<csv|json>`; the slug is lower-case
ASCII with unsafe characters removed.
- CSV (UTF-8 with a byte-order mark): technology comparison (value and status columns), year-by-year cash flow, sensitivity results, sensitivity drivers,
  scenario comparison, scenario changed assumptions, threshold results. Raw unrounded numbers, no currency symbols, a metadata header (`# export`, `# generated`,
  `# currency`, `# analysis_horizon_years`, `# policy`, `# application_version`). Missing values are empty with an explicit status, never zero. Text that a spreadsheet
  could read as a formula is prefixed. Tables for analyses that were not run are disabled with the reason.
- JSON: `exportType`, schema version, timestamp, application, report and engine versions, policy id and version, currency, horizon, the normalized input, provenance
  (by source field, input status, illustrative inputs, assumption records, counts), results, commercial results, evidence quality, and the sensitivity, threshold and
  scenario sections if present. No interface state.

## Presentation Mode
A live view of the current assessment, not a slide file. Screens (those without data behind them are skipped): assessment snapshot, technology comparison,
economic performance, operational feasibility, environmental performance (kept even when unavailable), commercial classification, why this result,
what would make it viable or the viability margin (only if run), sensitivity drivers (only if run), key decision takeaways. Previous and Next buttons,
Left and Right arrow keys, Escape to exit, a screen counter and a progress bar. Nothing advances automatically. Larger type, fewer metrics per screen,
the same green, navy and off-white palette.

## Privacy
No upload, no analytics, no third-party service. Files are saved on the device. Analyses, scenarios and onboarding state are stored in the browser only.

## Limitations
A report shows only analyses already run for the current inputs. The Print / Save as PDF output depends on the browser. Charts in print are the on-screen charts.
The 5% near-break-even tolerance and the evidence wording are prototype choices. No AI is involved in any text.

## Browser checks
`npm run e2e` (against a running app) runs four suites in `e2e/`: classification, guidance, analysis and reporting. Set `PLAYWRIGHT_MODULE` and `CHROMIUM` if needed.
The reporting suite also emulates print media and generates a PDF.

## Batch 8 additions

- **Prototype identifier.** `GreenFleet MSc Prototype v1.0` (`PROTOTYPE_VERSION` in `src/reporting/identity.ts`) appears on the report cover, in the About page, in every CSV metadata block (`# prototype`) and in the JSON (`application.prototypeVersion`). It names the software and is separate from `GreenFleet Commercial Viability Policy v1.0`. `package.json` carries version 1.0.0.
- **One core disclaimer.** The same sentence is used in Help, About, the report, the presentation, the CSV metadata (`# disclaimer`) and the JSON (`disclaimer`).
- **Demonstration values.** When the assessment is a demonstration, the report cover, the presentation snapshot, the wizard and Results state: "Illustrative synthetic values for demonstration only. These are not current market prices or investment recommendations."
- **Insufficient evidence.** The report, the presentation and the takeaways state the available economic evidence for information (see `docs/COMMERCIAL_VIABILITY_POLICY.md`, defect D-1) without drawing a conclusion.
- **Report semantics.** The cover title is an `h2`; the page owns the single `h1`.
- **Validation.** Consistency of every value across the Results page, the report, the presentation, the CSV tables and the JSON; JSON round trip; CSV and filename security are tested in `src/validation/outputs.test.tsx`.
