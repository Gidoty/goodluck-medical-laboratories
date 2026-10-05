import { createBlankAssessment } from "./blank";
import { notApplicable, value } from "./fieldValue";
import { FIELD_BY_ID } from "./schema/fields";
import type { Assessment, StoredValue } from "./stored";

export const DEMO_NAME = "SYNTHETIC DEMONSTRATION: General walkthrough";
export const DEMO_LABEL = "Illustrative assumption — not current market data.";
/** Shown wherever demonstration values are loaded: wizard, results, report and presentation. */
export const DEMO_NOTICE = "Illustrative synthetic values for demonstration only. These are not current market prices or investment recommendations.";

type DemoEntry = number | string | "NA" | { q: number; unit: string };

/**
 * Round numbers chosen only to exercise the interface (every branch of the conditional logic is
 * touched). They are NOT Nigerian averages, prices, benchmarks or market rates. No emission
 * factor is included, because none is supported by a source.
 */
const DEMO: Readonly<Record<string, DemoEntry>> = {
  "business.assessmentName": DEMO_NAME,
  "business.businessName": "Demo Logistics Ltd",
  "business.businessType": "last_mile",
  "business.country": "NG",
  "business.location": "Demo city",
  "fleet.size": 5,
  "fleet.vehicleCategory": "delivery_van",
  "fleet.payloadCapacity": { q: 1000, unit: "kg" },
  "fleet.averagePayload": { q: 600, unit: "kg" },
  "ops.dailyDistance": 100,
  "ops.operatingDays": 250,
  "ops.operatingPattern": "urban",
  "ops.analysisHorizon": 5,

  "diesel.acquisitionPrice": 10_000_000,
  "diesel.fuelEfficiency": { q: 8, unit: "km_per_litre" },
  "diesel.fuelPrice": 1000,
  "diesel.annualMaintenance": 400_000,
  "diesel.usefulLife": 8,
  "diesel.residual": { q: 20, unit: "percent" },
  "diesel.insurance": 0,

  "bev.acquisitionPrice": 15_000_000,
  "bev.energyConsumption": { q: 25, unit: "kwh_per_100km" },
  "bev.electricityTariff": 100,
  "bev.annualMaintenance": 250_000,
  "bev.usefulLife": 8,
  "bev.usableRange": 200,
  "bev.batteryCapacity": 60,
  "bev.chargingOpportunity": "depot_only",
  "bev.payloadImpact": "none",
  "bev.batteryReplacement": "yes",
  "bev.batteryReplacementYear": 6,
  "bev.batteryReplacementCost": 3_000_000,
  "bev.chargingLoss": 10,

  "biofuel.pathway": "biodiesel_blend",
  "biofuel.blendPercent": 20,
  "biofuel.acquisitionMode": "new_vehicle",
  "biofuel.acquisitionPrice": 10_500_000,
  "biofuel.fuelPrice": 1100,
  "biofuel.fuelEfficiency": { q: 13, unit: "fuel_per_100km" },
  "biofuel.annualMaintenance": 420_000,
  "biofuel.usefulLife": 8,
  "biofuel.fuelAvailability": "reliable",
  "biofuel.specialInfrastructure": "no",

  "finance.structure": "debt_equity",
  "finance.debtPercent": 50,
  "finance.equityPercent": 50,
  "finance.interestRate": 20,
  "finance.loanTenor": 4,
  "finance.discountRate": 15,

  "bevInfra.arrangement": "dedicated_private",
  "bevInfra.equipmentCost": 2_000_000,
  "bevInfra.installationCost": 500_000,
  "bevInfra.chargerCount": 1,
  "bevInfra.vehiclesSharing": 5,
  "bevInfra.lifeYears": 10,
};

export type DemoCaseId = "strong_bev" | "conditional_bev" | "not_yet_viable_bev" | "intermittent_biofuel" | "insufficient_evidence";

export interface DemoCase {
  id: DemoCaseId;
  number: number;
  title: string;
  /** What the case is for, in one sentence. */
  purpose: string;
  /** What the engine returns for this case, verified by tests. Used in the documentation and the presenter notes only. */
  expected: { bev: string; biofuel: string };
  /** Changes to the shared base values. `null` removes a base value. */
  changes: Readonly<Record<string, DemoEntry | null>>;
}

/**
 * Five SYNTHETIC DEMONSTRATION CASES. They start from the same illustrative base values above and change only what the
 * case needs. No emission factor is included, so emissions show as "Unavailable" in every case (deliberately).
 * Each expected result is asserted in src/validation/demo-cases.test.ts. They are teaching fixtures, not market data.
 */
export const DEMO_CASES: readonly DemoCase[] = [
  {
    id: "strong_bev",
    number: 1,
    title: "Strong battery-electric case",
    purpose: "A favourable economic case, a suitable operation and adequate evidence give VIABLE for the battery-electric vehicle. Biofuel is shown alongside for contrast.",
    expected: { bev: "VIABLE", biofuel: "NOT YET VIABLE" },
    changes: { "bev.batteryReplacement": "no", "bev.batteryReplacementYear": null, "bev.batteryReplacementCost": null },
  },
  {
    id: "conditional_bev",
    number: 2,
    title: "Positive NPV, daytime charging needed",
    purpose: "Shows that a positive NPV does not make a result VIABLE: the day is longer than the range, so daytime charging is a condition to resolve.",
    expected: { bev: "CONDITIONALLY VIABLE", biofuel: "NOT YET VIABLE" },
    changes: { "ops.dailyDistance": 260, "bev.chargingOpportunity": "public_available", "bev.batteryReplacement": "no", "bev.batteryReplacementYear": null, "bev.batteryReplacementCost": null },
  },
  {
    id: "not_yet_viable_bev",
    number: 3,
    title: "Negative NPV and a range constraint",
    purpose: "Two separate barriers: unfavourable economics and a day longer than the range with depot-only charging. Gives a worked 'What would make it viable?' with an economic threshold and a range remedy.",
    expected: { bev: "NOT YET VIABLE", biofuel: "NOT YET VIABLE" },
    changes: { "ops.dailyDistance": 240, "ops.operatingDays": 100, "bev.acquisitionPrice": 20_000_000, "bev.batteryReplacement": "no", "bev.batteryReplacementYear": null, "bev.batteryReplacementCost": null },
  },
  {
    id: "intermittent_biofuel",
    number: 4,
    title: "Attractive biofuel, intermittent supply",
    purpose: "Biofuel is economically attractive, but supply is intermittent. This is a categorical condition: GreenFleet names it and never turns it into a number.",
    expected: { bev: "VIABLE", biofuel: "CONDITIONALLY VIABLE" },
    changes: { "biofuel.fuelPrice": 700, "biofuel.fuelAvailability": "intermittent" },
  },
  {
    id: "insufficient_evidence",
    number: 5,
    title: "Critical evidence missing",
    purpose: "Charging access and fuel availability are unknown. GreenFleet withholds the label rather than manufacture certainty, and still discloses that the available economic evidence is unfavourable.",
    expected: { bev: "INSUFFICIENT EVIDENCE", biofuel: "INSUFFICIENT EVIDENCE" },
    changes: { "ops.dailyDistance": 240, "ops.operatingDays": 100, "bev.acquisitionPrice": 20_000_000, "bev.chargingOpportunity": "unknown", "bev.batteryReplacement": "no", "bev.batteryReplacementYear": null, "bev.batteryReplacementCost": null, "biofuel.fuelAvailability": "unknown" },
  },
];

export const demoCaseById = (id: DemoCaseId): DemoCase => DEMO_CASES.find((c) => c.id === id)!;

function demoStored(id: string, entry: DemoEntry): StoredValue {
  const def = FIELD_BY_ID[id];
  if (!def) throw new Error(`Demo references unknown field "${id}"`);
  switch (def.kind) {
    case "number":
      return entry === "NA" ? notApplicable<number>() : value<number>(entry as number);
    case "text":
      return entry as string;
    case "choice":
      return value<string>(entry as string);
    case "qnumber": {
      const e = entry as { q: number; unit: string };
      return { value: value<number>(e.q), qualifier: e.unit };
    }
  }
}

/** The general walkthrough demo (no case), or one of the five synthetic demonstration cases. */
export function createDemoAssessment(id: string, nowIso: string, caseId?: DemoCaseId): Assessment {
  const blank = createBlankAssessment(id, nowIso);
  const entries: Record<string, DemoEntry> = { ...DEMO };
  if (caseId) {
    const c = demoCaseById(caseId);
    for (const [k, v] of Object.entries(c.changes)) {
      if (v === null) delete entries[k];
      else entries[k] = v;
    }
    entries["business.assessmentName"] = `SYNTHETIC DEMONSTRATION CASE ${c.number}: ${c.title}`;
  }
  const inputs = { ...blank.inputs };
  for (const [fieldId, entry] of Object.entries(entries)) inputs[fieldId] = demoStored(fieldId, entry);
  return { ...blank, inputs, origin: "demo", illustrative: Object.keys(entries) };
}
