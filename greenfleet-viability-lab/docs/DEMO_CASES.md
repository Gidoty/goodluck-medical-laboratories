# Demonstration cases and presentation-day guide

GreenFleet MSc Prototype v1.0.

> **SYNTHETIC DEMONSTRATION CASES. Illustrative synthetic values for demonstration only. These are not current market prices or investment recommendations.**

Every case below is a teaching fixture. The numbers were chosen so that each case shows one idea clearly. None is a Nigerian average, a price, a benchmark or a forecast, and none carries a source. Each case starts from the same base values (5 delivery vans, 100 km a day for 250 days, a five-year horizon, a 15% discount rate, amounts in NGN) and changes only what the case needs. **No emission factor is included in any case**, so emissions show as "Unavailable" in all of them. That is deliberate: GreenFleet does not invent emissions.

The expected results are asserted by `src/validation/demo-cases.test.tsx` and checked through the real interface by `e2e/qa.cjs`, so this page cannot drift from the software.

## How to load a case

1. Open **Overview** or any **New Assessment** step.
2. Open **Synthetic demonstration cases** (a keyboard-accessible list).
3. Choose a case. If an assessment is already in progress, GreenFleet asks before replacing it.
4. Go to **Step 6: Review & Calculate**, choose **Run Commercial Viability Assessment**, and read **Results**.
5. For sensitivity, thresholds, the report and the presentation, open **Sensitivity Analysis** once so the analysis is run for these inputs, then use **View Professional Report** or **Presentation Mode** on Results.
6. To leave a case, choose **Return to Blank Assessment** in the same list (it asks first), or use **Reset Assessment**.

A value stops being labelled "Illustrative assumption" as soon as you edit it, and the demonstration notice stays until every illustrative value has been replaced.

## The cases

Figures are rounded for reading. Exact values are in the application.

### Case 1: Strong battery-electric case

| | Battery electric | Biofuel |
| --- | --- | --- |
| Commercial classification | **VIABLE** | NOT YET VIABLE |
| Incremental NPV against diesel | +₦10,780,345 | -₦15,349,332 |
| Extra money at Year 0 | ₦27,500,000 | ₦2,500,000 |
| Simple / discounted payback | 2.13 / 2.77 years | not achieved |
| Operational status | Suitable (100 km a day, 200 km range, depot charging) | Suitable |

**Purpose.** A favourable economic case, a suitable operation and adequate evidence give VIABLE. Biofuel is on the same screen for contrast.

**Talking points.** Diesel is the baseline, so the NPV is the saving against it. VIABLE is conditional on the entered assumptions and is not a promise. The viability margin shows how far each assumption can move before the label changes: the BEV price could rise from ₦15.0 million to about ₦17.2 million, the electricity tariff from ₦100 to about ₦193 a kWh, or the diesel price fall from ₦1,000 to about ₦794 a litre, one at a time and all else equal. These margins are not additive and are not forecasts. Biofuel is NOT YET VIABLE because its fuel costs more per kilometre than diesel in these numbers; the threshold shows it would need, for example, a price of about ₦818 a litre.

### Case 2: Positive NPV, daytime charging needed

| | Battery electric | Biofuel |
| --- | --- | --- |
| Commercial classification | **CONDITIONALLY VIABLE** | NOT YET VIABLE |
| Incremental NPV against diesel | +₦75,961,139 | -₦27,417,090 |
| Operational status | Conditional (260 km a day, 200 km range, public charging available) | Suitable |

**Purpose.** A positive NPV does not make a result VIABLE. The day is longer than the range, so daytime charging is a condition that must be resolved.

**Talking points.** The economics are strongly favourable, so GreenFleet invents no financial remedy. "What would make it fully viable?" names the condition (secure reliable daytime charging) and gives one numeric alternative: a usable range of at least 260 km would cover the whole day without daytime charging. That figure is the model's own boundary with no safety buffer, "not an engineering safety recommendation".

### Case 3: Negative NPV and a range constraint

| | Battery electric | Biofuel |
| --- | --- | --- |
| Commercial classification | **NOT YET VIABLE** | NOT YET VIABLE |
| Incremental NPV against diesel | -₦15,849,175 | -₦15,047,638 |
| Operational status | Constrained (240 km a day, 200 km range, depot-only charging, no route detail) | Suitable |
| Payback | not achieved | not achieved |

**Purpose.** Two separate barriers: unfavourable economics and a hard operational constraint. This is the case for "What would make it viable?".

**Talking points.** The economic threshold is found: the BEV price would need to fall from ₦20.0 million to about ₦16.8 million for the NPV to reach zero (or a purchase subsidy of about ₦3.2 million a vehicle, or diesel at about ₦1,315 a litre). **Reaching break-even does not resolve the range constraint**, and the answer says so: the label at break-even is still NOT YET VIABLE and the operational status is still Constrained. The range remedy is a usable range of at least 240 km (the daily distance) or compatible en-route charging. Even a free electricity tariff cannot reach break-even, which the solver reports as "Not bracketed" with no number.

### Case 4: Attractive biofuel, intermittent supply

| | Battery electric | Biofuel |
| --- | --- | --- |
| Commercial classification | VIABLE | **CONDITIONALLY VIABLE** |
| Incremental NPV against diesel | +₦10,780,345 | +₦6,439,676 |
| Operational status | Suitable | Conditional (supply intermittent) |
| Payback | 2.13 years | 0.60 years |

**Purpose.** Categorical operational conditions. Supply is intermittent, so the economics are attractive but the label is CONDITIONALLY VIABLE.

**Talking points.** Fuel availability is a category (reliable, intermittent, limited, unknown), never a number. GreenFleet does not convert it into an availability percentage or price it. The remedy is qualitative: improve supply reliability or arrange a fallback.

### Case 5: Critical evidence missing

| | Battery electric | Biofuel |
| --- | --- | --- |
| Commercial classification | **INSUFFICIENT EVIDENCE** | **INSUFFICIENT EVIDENCE** |
| Available economic evidence | NPV -₦15,849,175 (unfavourable) | NPV -₦15,047,638 (unfavourable) |
| What is missing | Charging access is unknown while the day (240 km) is longer than the range (200 km) | Fuel availability is unknown |

**Purpose.** GreenFleet refuses to manufacture certainty.

**Talking points.** The economics are unfavourable, but because the evidence check comes before the economic case, the label is INSUFFICIENT EVIDENCE, not NOT YET VIABLE. The result says plainly that "available economic evidence is unfavourable", as information only, and lists the exact items to complete. Threshold solving is blocked until they are. Nothing is guessed.

## Recommended live demonstration (5 to 8 minutes)

| Minute | Step | What to say |
| --- | --- | --- |
| 0:00 | Open GreenFleet (Overview). | "A logistics start-up has to choose between diesel, battery-electric and biofuel vehicles. GreenFleet answers four separate questions: economics, operation, environment and commercial viability." |
| 0:45 | Explain the decision problem. | "Diesel is the baseline. Everything is a difference from it. The tool uses only the assumptions you enter and ships no prices." |
| 1:15 | Open **Synthetic demonstration cases** and load **Case 3**. | "These values are synthetic. The notice is on every screen. Loading would ask first if I had work in progress." |
| 2:00 | Show key inputs (Step 3 Battery Electric: range 200 km, charging at the depot only; Step 1: 240 km a day). | "The day is longer than the range and the vehicle only charges at the depot." |
| 2:45 | Step 6, run the assessment. Show **Commercial viability against diesel**. | "BEV is NOT YET VIABLE. Environmental performance is Unavailable because no factor was entered. GreenFleet says so and does not guess." |
| 3:30 | Open **Why this result?** | "Ordered rules, no score. Evidence, then operations, then economics. The hard constraint and the negative NPV are both listed." |
| 4:15 | Open **Sensitivity Analysis**, then **What would make it viable?** | "Two barriers. An economic threshold: the price would need to fall to about ₦16.8 million. But economic break-even alone does not make it viable, because the range constraint remains. The range remedy is 240 km." |
| 5:15 | Show **Which assumptions move the result most?** | "Influence under the tested ranges, not causal importance." |
| 6:00 | Return to Results; open **Presentation Mode** (arrow keys), or **View Professional Report**. | "The report and the presentation are built from the same results. Nothing is recalculated, and the CSV and JSON exports carry the same numbers." |
| 7:00 | Optional contrast: load **Case 2**, then **Case 5**. | "Positive NPV, still conditional. And when evidence is missing, GreenFleet withholds the label." |

Keep **Case 4** in reserve for a question about biofuel.

## If something goes wrong

| Problem | What to do |
| --- | --- |
| Live data entry is too slow. | Load a demonstration case. They are complete and need no typing. |
| The browser blocks printing or "Save as PDF" is unavailable. | Show the **Professional Report** on screen. It is the same document. |
| The screen is small or the projector is low resolution. | Use **Presentation Mode**. Its text was checked at 1366 by 768, 1440 by 900 and 1920 by 1080 (no body text under 14 px). At 1366 by 768 three of the ten screens need a small vertical scroll. |
| An environmental figure shows "Unavailable". | This is correct. Explain that GreenFleet reports "Unavailable" rather than inventing emissions, and that no emission factor ships with the software. |
| The tool seems to have lost the assessment. | Everything is saved in this browser only. Load the case again. |
| Sensitivity or the report shows "not run". | Open **Sensitivity Analysis** once for the current inputs, then return. The report shows analyses only for the inputs they were run on. |
| The page does not load. | Start it again with `cd greenfleet-viability-lab && npm install && npm run dev`. No internet connection is needed once installed. |
| A figure looks surprising. | Open **Why this result?** and **Methodology**; every figure traces to a formula. |

Before the seminar: run `npm run build && npm start`, load each case once, open the report and the presentation, and keep this page open on a second screen.

## Questions an examiner may ask

**Why is diesel the baseline?** The investment decision is whether to replace or avoid a conventional vehicle. Every cost is therefore compared with it: incremental cash flow is diesel minus the alternative, so a positive NPV is an economic advantage over diesel. Diesel is the reference case, not a judged technology, so it receives no label.

**Why is NPV the primary economic indicator?** It is the only one of the indicators that uses all cash flows and their timing: the extra purchase price, running-cost savings, replacements, battery replacement and resale value, discounted at the chosen rate. TCO ignores timing, and payback ignores everything after the crossing. The NPV is also cross-checked against the present-cost difference as a consistency test before any classification.

**Why is environmental performance separate?** It is a different question with no accepted conversion to money. Mixing it into a score would need weights or a carbon price that GreenFleet cannot justify. It is reported beside the label, and a test varies only the emission factors and confirms the classification never moves.

**Why does a positive NPV not guarantee viability?** Viability also needs the vehicle to do the work and the evidence to be adequate. A positive NPV with a hard operational constraint is NOT YET VIABLE (Case 3 with better economics), with a condition such as daytime charging is CONDITIONALLY VIABLE (Case 2), and with a material uncertainty such as an unknown battery replacement is CONDITIONALLY VIABLE. NPV break-even (zero) is not viability either.

**Why no Monte Carlo simulation?** It needs probability distributions for every input, and a student or start-up cannot justify them. That would make a reassuring number look more rigorous than the evidence allows. Deterministic sensitivity, scenarios and thresholds show the same dependence transparently. Monte Carlo is listed as future work.

**Why no live market prices?** Prices are volatile, sources have licences, and a result must be reproducible. Every price is entered by the user, can carry a source and year, and is labelled where it is illustrative.

**Why is there no confidence score?** A number would suggest a statistical meaning that does not exist. Evidence quality is described in words (complete, partial, insufficient, unavailable) with counts of user-entered, sourced, illustrative, derived and missing values and the exact list of missing items.

**Why are thresholds "all else equal"?** Each threshold moves one assumption and holds every other at the Base Case, so the answer is a mathematical boundary, not a forecast. Real assumptions move together, so margins for different assumptions are not additive. A limited set of two-way grids shows pairs together.

**Why does financing not enter the project NPV?** GreenFleet evaluates project and asset economic viability. Leaving loan principal, interest and the debt/equity split out keeps the technology comparison independent of how the vehicles are paid for and ensures the purchase is never counted twice (the principal repays the same acquisition cost). It also means GreenFleet does not say whether a start-up could obtain finance or service debt, and it does not claim to. Levered cash flow and debt-service measures are future work.

**Why can a result be Insufficient Evidence?** Because a defensible label needs the critical facts. If the day is longer than the range and the charging access is unknown, the vehicle may or may not be able to work, and no NPV can settle that. GreenFleet lists what is missing and withholds the label. It still shows the available economic evidence, because hiding a negative NPV would also be misleading.

**How do you know the calculations are right?** Small cases whose expected values are written out as plain arithmetic, not produced by the software, are compared with the engine: a simple case, a replacement case, an infrastructure case and an escalation case, with hand-derived sums. A numerical threshold is compared with its analytical solution to better than one part in a million. Policy v1.0 is checked against a decision table of 32 combinations. See `docs/VALIDATION_AND_VERIFICATION.md`.

**Where does the 5% near-break-even tolerance come from?** It is a prototype policy value, not a universal law and not an academic consensus. It sits in one policy object, is stated everywhere it is used, and is separate from the floating-point tolerance. The sensitivity of a result to it can be explored by moving an assumption across the boundary.

**Is any of this artificial intelligence?** No. Every figure comes from the deterministic formulas on the Methodology page, and every sentence is a fixed template filled with values from the structured results. The same inputs always give the same words.

**What leaves the browser?** Nothing. There is no account, analytics, remote database, market-data feed or AI service. Files are generated on the device. This is checked by a source audit and by a runtime audit of every network request.

**What are the main limitations?** One vehicle profile at a time; no tax, revenue, financing or general inflation; no live data; emission factors are user-supplied; the 5% and 1% policy values and the sensitivity range are conventions; categorical operational conditions are not priced. They are listed on the Methodology page and in the report.
