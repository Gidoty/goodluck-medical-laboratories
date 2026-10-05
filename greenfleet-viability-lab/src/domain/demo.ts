import { createBlankAssessment } from "./blank";
import { notApplicable, value } from "./fieldValue";
import { FIELD_BY_ID } from "./schema/fields";
import type { Assessment, StoredValue } from "./stored";

export const DEMO_NAME = "Illustrative Demo Assessment";
export const DEMO_LABEL = "Illustrative assumption — not current market data.";

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

export function createDemoAssessment(id: string, nowIso: string): Assessment {
  const blank = createBlankAssessment(id, nowIso);
  const inputs = { ...blank.inputs };
  for (const [fieldId, entry] of Object.entries(DEMO)) inputs[fieldId] = demoStored(fieldId, entry);
  return { ...blank, inputs, origin: "demo", illustrative: Object.keys(DEMO) };
}
