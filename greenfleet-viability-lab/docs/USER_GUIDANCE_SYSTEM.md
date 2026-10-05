# User guidance system (Batch 5.1)

Guidance only. It never reads or writes an assessment, never changes a calculation and never changes the Commercial Viability
Policy. All text is reviewed static content. No AI, no analytics, no third-party scripts, and it works offline.

## Four levels
1. **First-time onboarding**: a welcome dialog and an optional Quick Tour.
2. **Page-level help**: a "How to use this page" button in each page header and a short note at the top of each assessment step.
3. **Action-level guidance**: the sentence beside Run Commercial Viability Assessment, "What happens next" lines, and the empty Results state.
4. **Field-level help**: the info button beside technical fields, and "Why is this required?" under a missing required value.

## Architecture (`src/guidance/`)
| File | Role |
| --- | --- |
| `types.ts` | `GuidanceId`, `GuidanceContent`, `HelpTopic`, `TourStep`, `OnboardingStatus`. |
| `content.ts` | All guidance prose: the registry `GUIDANCE`, `HELP_TOPICS` (the index), `TOUR_STEPS`, `WELCOME`, the disclaimer. |
| `registry.ts` | `guidanceIdForPath(pathname)`, `getGuidance`, `STEP_GUIDANCE`, `relatedEntries`. |
| `state.ts` | Pure reducer for onboarding, tour and help state, and `shouldShowWelcome`. Unit-tested. |
| `onboardingStore.ts` | `createOnboardingStore(storage)`: the one thing remembered. |
| `context.ts`, `GuidanceProvider.tsx` | React context (safe with no provider) and the provider mounted in the root layout. |
| `HelpDrawer.tsx`, `WelcomeDialog.tsx`, `QuickTour.tsx` | Native `<dialog>` components. |
| `HelpButtons.tsx` | `HelpButton` (global) and `PageHelpButton` (page or section). |
| `GuidanceBody.tsx` | Renders one guidance entry. Pure presentation. |
| `useModalDialog.ts` | Opens and closes a native dialog from state. |

Field tooltips stay in `src/content/glossary.ts` and are attached to fields through `glossary` in the field schema.
`HelpTip` (`src/components/ui/help-tip.tsx`) renders them.

## Registry
Ids: `home`, `assessment.business`, `assessment.diesel`, `assessment.bev`, `assessment.biofuel`, `assessment.finance`,
`assessment.review`, `results.overview`, `results.economic`, `results.operational`, `results.environmental`,
`results.commercial`, `results.why`, `methodology`, `sensitivity`, `scenarios`, `about`.
`/` and `/overview` both use `home`. The Help button opens the entry for the current route. Section buttons on the Results page
open `results.economic`, `.operational`, `.environmental`, `.commercial` and `.why` directly. Each entry uses only the sections
it needs: what you are doing, what you need, why it matters, what GreenFleet does, definitions, tips, warnings, what happens next,
related glossary terms and links. Help explains how to use the tool. Formulas and rules stay on the Methodology page, which Help links to.

## Onboarding
- The welcome dialog appears once, on the first visit to a **workspace page** (not on the landing page, which already introduces the product).
  It offers Start Assessment, Take a Quick Tour and Skip for now. Nothing forces the tour.
- Quick Tour: 7 steps (Overview, New Assessment, the six steps, Review & Calculate, Results, Methodology, Sensitivity and Scenarios; these are working tools since Batch 6).
  Back, Next, Skip tour, Finish. It explains areas. It does not highlight, click or edit anything.
- Persistence: `localStorage` key `greenfleet-viability-lab:onboarding` holds `{version, status, at}`, with status `completed` (tour finished),
  `skipped` (Skip for now or Skip tour) or `dismissed` (Escape, Start Assessment). Any recorded status stops the welcome from opening again.
  It is separate from the assessment key. Without storage (private browsing) the choice lasts for the visit.
- Help > Restart Quick Tour starts the tour from step 1 at any time. It keeps the earlier record and all assessment data.

## Help panel
Native `<dialog>` opened with `showModal()`. Wide screens: a right-hand panel. Phones: a bottom sheet (up to 88% of the height) that scrolls.
Contents: the current page's guidance, "All help topics" (Getting Started, Entering Fleet Data, Diesel Baseline, Battery Electric Vehicles,
Biofuel, Finance & Infrastructure, Understanding Results, Commercial Viability, Methodology), Restart Quick Tour, and the prototype disclaimer.
There is no full-text search.

## Field help
Added or rewritten where a user needs it: analysis period, distance, fuel efficiency, kWh per km and per 100 km, usable range, charging losses,
charging opportunity and downtime, payload reduction, residual value, discount rate, escalation, useful life, battery replacement, infrastructure
allocation, emission factor and CO2e, lifecycle adjustment, fuel availability, refuelling distance, fuel-related downtime, route distance. On
Results: TCO, present cost, NPV, payback, discounted payback. Examples show format only ("Enter 10 for 10%"). No market values or manufacturer figures.

## Accessibility
- Dialogs use `<dialog>`: focus is trapped, Escape closes, and focus returns to the control that opened them.
- Every control is a real `<button>` or link with an accessible name, at least 44px high (field info buttons have a 32px target).
- Field tips open on click, tap, keyboard activation and hover, close on Escape or when focus leaves, and are linked with `aria-describedby`.
- Status is never colour only. The tour step is announced with `aria-live`.

## Tests
`src/guidance/guidance.test.tsx` covers the reducer, persistence, registry, required wording, and the presence of controls. Browser checks
covered keyboard open and Escape, focus return, tap targets, and overflow on desktop and mobile (see PROGRESS_SUMMARY).

## Limitations
No spotlight tour. No search. Welcome is not shown on the landing page. Help text is English only. The Help panel does not know which
Results section is on screen, so section buttons open those entries directly.

## Batch 6 update
The Sensitivity, Scenarios and new "thresholds" entries now describe working tools (one assumption at a time, Base Case never changed, all else equal, economic break-even versus commercial transition, viability margin). The tour step and the Help index (ten topics) were updated, and the Batch 5.1 tests that expected "not available yet" were changed to match.

## Batch 8 additions

- **Demonstration cases.** Five labelled synthetic cases are loaded from a keyboard-accessible list on Overview and the assessment steps. Loading one asks first if work would be replaced; "Return to Blank Assessment" clears it after confirmation. Help and the Overview entry describe this.
- **Single disclaimer.** Help uses the same core disclaimer as About, the report and the exports.
- **Focus.** `useModalDialog` returns focus to the control that opened a dialog. If that control is gone (the tour is restarted from Help, which closes), focus returns to the Help button (`data-help-trigger`), and only after a real close, never on first render.
- **Help audit.** Tested: every page has an entry, every Help and tour link goes to an existing page, no text promises an unbuilt feature, every current feature is covered, and the tour can be restarted from Help (`src/validation/audit.test.ts`).
