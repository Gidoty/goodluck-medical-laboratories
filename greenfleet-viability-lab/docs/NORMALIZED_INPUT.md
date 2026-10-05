# NormalizedAssessmentInput

The contract between the input system (Batch 2) and the calculation engine (Batch 3).
Type definition: `src/domain/normalized.ts`. Producer: `normalizeAssessment()` in `src/domain/normalize.ts`.

`normalizeAssessment(assessment)` returns `{ ok: true, input }` only when **every** validation error is resolved.
Otherwise it returns `{ ok: false, issues }`. It never produces partial or guessed output.

## Conventions

| Quantity | Internal convention |
| --- | --- |
| Money | Whole units of `meta.currency` (a plain number such as `1500000`, never `"₦1,500,000"`). No currency conversion exists. |
| Distance | km (`km/day`, `km/year`) |
| Liquid fuel | litres. Fuel use is stored per 100 km (`litres/100 km`). |
| Gaseous fuel | `biofuel.fuelUnit` is `litre`, `kg` or `m3`; price and consumption use that unit. |
| Electricity | kWh. Consumption is `kWh/100 km`. |
| Mass | kg (tonnes are converted on the way in) |
| Percentages | **0 to 100**, never 0 to 1. Field names end in `Pct` / `Percent`. |
| Time | years for lifetimes, horizon, tenor; hours where the name says so |
| Emissions | kg CO2e; factors are per litre, kg, m3 or kWh as stated in `unit` |

## Missing, zero, not applicable, unknown, hidden

- **`0` is a value.** It is preserved as `0` and never treated as missing.
- Optional numeric inputs are `null` when blank, marked not applicable, or hidden by another answer.
  `inputStatus[fieldId]` says which: `value`, `missing`, `not_applicable` or `hidden`.
- **`unknown` is an answer, not a gap.** Yes / No / Unknown questions keep `"unknown"` and are `null` only when unanswered.
- Nothing is defaulted. A blank escalation rate is `null`, not `0`. The calculation stage must decide, and document, how to treat each `null`.
- Inputs hidden by conditional logic (for example battery replacement cost when replacement is "No") are `null` even if a stale value exists in the form.

## Structure

| Path | Meaning | Unit | Required |
| --- | --- | --- | --- |
| `schemaVersion` | Contract version | | always `1` |
| `meta.assessmentId`, `assessmentName`, `scenarioName`, `currency`, `dataOrigin`, `updatedAt` | Identity and currency code | | required |
| `meta.illustrativeInputs` | Ids still holding an unedited demo value | field ids | always present |
| `business.*` | Name, type, country, location | text / ids | optional |
| `fleet.fleetSize` | Vehicles evaluated | count | required |
| `fleet.vehicleCategory` | Category id | | optional |
| `fleet.payloadCapacityKg`, `averagePayloadKg` | Payload | kg | optional |
| `operations.distanceInputMode` | `daily` or `annual` (which one the user typed) | | required |
| `operations.dailyDistanceKm` | Per vehicle. Derived (annual ÷ days) in annual mode | km/day | required |
| `operations.operatingDaysPerYear` | | days/year (1 to 366) | required |
| `operations.annualDistanceKmPerVehicle` | Derived (daily × days) in daily mode | km/year | required |
| `operations.fleetAnnualDistanceKm` | Annual × fleet size | km/year | required |
| `operations.operatingPattern`, `averageRouteDistanceKm`, `averageTripsPerDay` | Route detail | id, km, trips/day | optional |
| `operations.analysisHorizonYears` | Evaluation horizon | years (whole) | required |

### Vehicle cost block (`diesel`, `bev`, `biofuel` all contain this)

| Field | Meaning | Unit | Required |
| --- | --- | --- | --- |
| `upfrontVehicleCost` | Diesel/BEV: acquisition price. Biofuel: acquisition price (new) or conversion cost (conversion) | money / vehicle | required |
| `annualMaintenanceCost` | | money / vehicle / year | required |
| `usefulLifeYears` | | years | required |
| `residualValue` | `{kind: "amount", amount}` or `{kind: "percent_of_acquisition", percent}`; never both | money or % | optional (`null`) |
| `annualInsurance`, `annualRegistration`, `otherFixedAnnualCost` | | money / vehicle / year | optional |
| `otherVariableCostPerKm` | | money / km | optional |

### Diesel
`fuelPricePerLitre` (money/litre, required), `fuelConsumptionLitresPer100Km` (required), `fuelPriceEscalationPctPerYear` (% per year, optional).

### Battery electric
`electricityTariffPerKwh` (money/kWh), `energyConsumptionKwhPer100Km` (at the vehicle, before losses), `usableRangeKm` (all required).
Optional: `batteryCapacityKwh`, `chargingLossPct`, `electricityPriceEscalationPctPerYear`,
`batteryReplacement { expected: yes|no|unknown|null, year, cost }` (year and cost only when `yes`),
`operational { chargingOpportunity, chargingDowntimeHoursPerDay, payloadImpact, payloadReductionKg | payloadReductionPct }`.
No feasibility rule is applied in Batch 2; these are inputs for Batch 4.

### Biofuel / alternative fuel
`pathway` (required), `blendPct` (only for biodiesel blends), `fuelUnit`, `acquisition { mode, existingVehicleValue }`,
`fuelPricePerFuelUnit` (money per `fuelUnit`), `fuelConsumptionFuelUnitsPer100Km` (required),
`fuelPriceEscalationPctPerYear`, `incrementalMaintenance { kind, amount | percent }` (optional, may be negative),
`supply { availability, additionalRefuellingKmPerDay, downtimeHoursPerMonth, specialInfrastructure }` (optional).

### Finance
`structure`, `debtSharePct`, `equitySharePct` (always sum to 100; derived for 100% equity or debt), `discountRatePct` (required),
`interestRatePct`, `loanTenorYears` (required only when debt share > 0, else `null`), `loanFees` (optional),
`incentives.{diesel,bev,biofuel} { type, amount, percentOfPurchasePrice }` (all `null` unless the user states an incentive; `type: "none"` is an explicit "no incentive").

### Infrastructure
`bevCharging { arrangement, investmentRequired, equipmentCost, installationCost, electricalUpgradeCost, numberOfChargers, vehiclesSharing, usefulLifeYears, annualMaintenanceCost, otherAnnualCost, utilisationPct }`:
cost fields are `null` unless `investmentRequired` is true.
`biofuel { investmentRequired, storageEquipmentCost, refuellingInfrastructureCost, installationCost, annualMaintenanceCost, usefulLifeYears }`:
populated only when special infrastructure is `yes`.

### Environmental assumptions (optional)
`diesel` (kg CO2e/litre), `gridElectricity` (kg CO2e/kWh), `biofuel` (kg CO2e per `fuelUnit`), each
`{ value, unit, source, sourceYear, notes, lifecycleAdjustmentPct }`. **No factor is ever pre-filled**; `value` is `null` until the user supplies one.

### Provenance and audit
`provenance[fieldId] { source, reference, year }`: optional metadata the user attached to volatile inputs (prices, rates).
`inputStatus[fieldId]`: entry status of every field, for auditing gaps.
