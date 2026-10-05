import type { ReasonCode } from "@/calculation/viability/types";

/** Short noun phrases for reason codes, used inside report sentences. Fixed wording, no generation. */
export const CODE_PHRASE: Partial<Record<ReasonCode, string>> = {
  DAYTIME_CHARGING_REQUIRED: "daytime charging",
  DEPOT_RECHARGE_BETWEEN_ROUTES: "recharging at the depot between routes",
  ROUTE_EXCEEDS_RANGE: "a required route longer than the stated usable range with no charging solution",
  RANGE_EXCEEDED_DEPOT_ONLY: "a daily distance beyond the stated usable range under depot-only charging",
  PAYLOAD_CONSTRAINT: "an average payload above the estimated BEV payload capacity",
  PAYLOAD_IMPACT_UNKNOWN: "an unconfirmed BEV payload impact",
  CHARGING_UNRESOLVED: "unsettled charging arrangements",
  BIOFUEL_SUPPLY_INTERMITTENT: "supply reliability (biofuel supply is intermittent)",
  BIOFUEL_SUPPLY_LIMITED: "supply availability (biofuel supply is limited)",
  BIOFUEL_SUPPLY_CONSTRAINED: "limited biofuel supply together with unspecified infrastructure",
  INFRASTRUCTURE_UNRESOLVED: "unspecified biofuel infrastructure",
  INFRASTRUCTURE_UNKNOWN: "an unknown biofuel infrastructure requirement",
  BATTERY_REPLACEMENT_UNKNOWN: "an unknown battery replacement requirement",
};

export const phraseOf = (code: ReasonCode, fallback: string): string => CODE_PHRASE[code] ?? fallback;

export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Assumptions a reason code points to, for the material-assumptions list. */
export const CODE_ASSUMPTION: Partial<Record<ReasonCode, string>> = {
  ROUTE_EXCEEDS_RANGE: "BEV usable range and route distance",
  RANGE_EXCEEDED_DEPOT_ONLY: "BEV usable range and charging opportunity",
  DAYTIME_CHARGING_REQUIRED: "BEV charging opportunity",
  DEPOT_RECHARGE_BETWEEN_ROUTES: "BEV charging opportunity",
  CHARGING_UNRESOLVED: "BEV charging arrangement",
  PAYLOAD_CONSTRAINT: "BEV payload impact",
  PAYLOAD_IMPACT_UNKNOWN: "BEV payload impact",
  BATTERY_REPLACEMENT_UNKNOWN: "Battery replacement assumption",
  BIOFUEL_SUPPLY_INTERMITTENT: "Biofuel availability",
  BIOFUEL_SUPPLY_LIMITED: "Biofuel availability",
  BIOFUEL_SUPPLY_CONSTRAINED: "Biofuel availability and infrastructure",
  INFRASTRUCTURE_UNRESOLVED: "Biofuel infrastructure",
  INFRASTRUCTURE_UNKNOWN: "Biofuel infrastructure",
};
