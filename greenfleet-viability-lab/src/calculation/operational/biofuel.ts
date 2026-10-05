import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { CalcWarning } from "../types";
import { check, opWarning, overallStatus, STATUS_EXPLANATION } from "./status";
import type { BiofuelOperational, OperationalCheck } from "./types";

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/**
 * Biofuel / alternative-fuel operational feasibility, from the user's own inputs only.
 *
 * Supply is the core question. Intermittent supply is a stated condition; limited supply becomes a
 * constraint only when it is combined with infrastructure the user said is needed but did not
 * specify. No maximum refuelling distance or downtime is invented, and neither is converted into
 * money, because no refuelling frequency or productivity data exist.
 */
export function evaluateBiofuel(input: NormalizedAssessmentInput): BiofuelOperational {
  const warnings: CalcWarning[] = [];
  const warn = (code: string, message: string, severity: CalcWarning["severity"] = "warning") => warnings.push(opWarning(code, "biofuel", message, severity));
  const ruleTrace: string[] = [];

  const supply = input.biofuel?.supply;
  const availability = supply?.availability ?? null;
  const needed = input.infrastructure?.biofuel?.investmentRequired ?? supply?.specialInfrastructure ?? null;
  const inf = input.infrastructure?.biofuel;

  /* ---------------- infrastructure ---------------- */
  let infrastructureUnspecified = false;
  let infrastructureCheck: OperationalCheck;
  if (needed === null) {
    infrastructureCheck = check("infrastructure", "Infrastructure readiness", "not_assessed", "Whether special storage or infrastructure is needed was not stated.");
  } else if (needed === "no") {
    infrastructureCheck = check("infrastructure", "Infrastructure readiness", "satisfied", "No special storage or infrastructure is required.");
  } else if (needed === "unknown") {
    warn("OP_BIOFUEL_INFRA_UNKNOWN", "Whether special biofuel infrastructure is needed is unknown.");
    infrastructureCheck = check("infrastructure", "Infrastructure readiness", "insufficient", "Whether special storage or infrastructure is needed is unknown.", { conditions: ["The infrastructure requirement must be confirmed."] });
  } else {
    // needed === "yes"
    const specified = isNum(inf?.storageEquipmentCost) && isNum(inf?.refuellingInfrastructureCost) && isNum(inf?.installationCost) && isNum(inf?.usefulLifeYears);
    if (specified) {
      infrastructureCheck = check("infrastructure", "Infrastructure readiness", "satisfied", "Special infrastructure is required and has been specified (equipment, installation and useful life). Its cost is included in the economic analysis.");
    } else {
      infrastructureUnspecified = true;
      warn("OP_BIOFUEL_INFRA_UNSPECIFIED", "Required biofuel infrastructure is not fully specified.");
      infrastructureCheck = check("infrastructure", "Infrastructure readiness", "conditional", "Special infrastructure is required, but its equipment, installation or useful life has not been fully specified.", { conditions: ["The required biofuel infrastructure must be fully specified."] });
    }
  }

  /* ---------------- supply ---------------- */
  let supplyCheck: OperationalCheck;
  switch (availability) {
    case "reliable":
      supplyCheck = check("supply", "Fuel supply", "satisfied", "Fuel availability is stated as reliable.");
      break;
    case "intermittent":
      warn("OP_BIOFUEL_INTERMITTENT", "Biofuel availability is intermittent.");
      supplyCheck = check("supply", "Fuel supply", "conditional", "Fuel availability is intermittent, which is a supply-continuity risk.", { conditions: ["Fuel supply must be secured, or a fallback arranged, for the times it is not available."] });
      break;
    case "limited":
      warn("OP_BIOFUEL_LIMITED", "Biofuel availability is limited.");
      if (infrastructureUnspecified) {
        ruleTrace.push("Supply: availability is limited AND the infrastructure that is needed has not been specified. Constrained.");
        supplyCheck = check("supply", "Fuel supply", "constrained", "Fuel availability is limited, and the special infrastructure that is required has not been specified. Together these are a material access problem that is unresolved.");
      } else {
        supplyCheck = check("supply", "Fuel supply", "conditional", "Fuel availability is limited, which is a material fuel-access constraint.", { conditions: ["Enough fuel must be secured to cover the duty cycle."] });
      }
      break;
    case "unknown":
      warn("OP_BIOFUEL_AVAILABILITY_UNKNOWN", "Biofuel availability is unknown.");
      supplyCheck = check("supply", "Fuel supply", "insufficient", "Fuel availability is unknown.", { conditions: ["Fuel availability must be confirmed."] });
      break;
    default:
      supplyCheck = check("supply", "Fuel supply", "not_assessed", "Fuel availability was not entered.");
  }

  /* ---------------- indicators (never converted into cost) ---------------- */
  const extra = supply?.additionalRefuellingKmPerDay;
  const monthly = supply?.downtimeHoursPerMonth;

  const list = [supplyCheck, infrastructureCheck];
  const { status, rule } = overallStatus(list, ["supply"], ["supply"]);
  ruleTrace.push(rule);
  return {
    technology: "biofuel",
    status,
    statusExplanation: STATUS_EXPLANATION[status],
    checks: { supply: supplyCheck, infrastructure: infrastructureCheck },
    refuelling: {
      additionalDistanceKmPerVehiclePerDay: isNum(extra) ? extra : null,
      annualAdditionalDistanceKm: null,
      note: isNum(extra)
        ? "Shown as entered. An annual total is not calculated because how often refuelling trips happen is not known."
        : "No additional refuelling distance was entered.",
    },
    downtime: {
      hoursPerMonthAsEntered: isNum(monthly) ? monthly : null,
      annualHours: isNum(monthly) ? monthly * 12 : null,
      label: "Fuel-availability-related downtime assumption (per vehicle). It is an operational indicator and is not converted into cost.",
    },
    conditions: [...new Set(list.flatMap((c) => c.conditions))],
    notAssessed: list.filter((c) => c.status === "not_assessed").map((c) => c.label),
    ruleTrace,
    warnings,
  };
}
