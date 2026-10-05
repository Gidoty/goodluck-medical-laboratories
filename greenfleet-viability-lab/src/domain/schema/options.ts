import { CURRENCY_LIST } from "@/lib/currency";
import { COUNTRIES } from "@/lib/countries";
import type { ChoiceOption } from "./types";

const opts = (pairs: ReadonlyArray<readonly [string, string]>): ChoiceOption[] => pairs.map(([id, label]) => ({ id, label }));

export const YES_NO_UNKNOWN = opts([["yes", "Yes"], ["no", "No"], ["unknown", "Unknown"]]);

export const OPTIONS = {
  currency: CURRENCY_LIST.map((c) => ({ id: c.code, label: `${c.code} (${c.symbol}) ${c.name}` })),
  country: COUNTRIES.map((c) => ({ id: c.id, label: c.label })),
  businessType: opts([
    ["logistics_startup", "Logistics start-up"],
    ["freight_operator", "Freight operator"],
    ["last_mile", "Last-mile delivery"],
    ["haulage", "Haulage company"],
    ["distribution", "Distribution business"],
    ["fleet_owner", "Fleet owner/operator"],
    ["other", "Other"],
  ]),
  vehicleCategory: opts([
    ["light_commercial", "Light commercial vehicle"],
    ["delivery_van", "Delivery van"],
    ["medium_duty_truck", "Medium-duty truck"],
    ["heavy_duty_truck", "Heavy-duty truck"],
    ["tractor_trailer", "Tractor-trailer"],
    ["other_commercial", "Other commercial vehicle"],
  ]),
  operatingPattern: opts([["urban", "Urban"], ["intercity", "Intercity"], ["regional", "Regional"], ["long_haul", "Long-haul"], ["mixed", "Mixed"]]),
  distanceMode: opts([["daily", "Daily distance"], ["annual", "Annual distance"]]),
  chargingOpportunity: opts([
    ["depot_only", "Depot charging only"],
    ["public_available", "Public charging available"],
    ["destination_available", "Destination charging available"],
    ["mixed", "Mixed charging"],
    ["unknown", "Unknown"],
  ]),
  payloadImpact: opts([["none", "No material payload impact expected"], ["reduced", "Reduced payload expected"], ["unknown", "Unknown"]]),
  biofuelPathway: opts([
    ["biodiesel_blend", "Biodiesel blend"],
    ["renewable_diesel", "Renewable diesel"],
    ["biomethane", "Biomethane / renewable gas"],
    ["other", "Other"],
    ["user_defined", "User-defined pathway"],
  ]),
  fuelUnit: opts([["litre", "Litre"], ["kg", "Kilogram"], ["m3", "Cubic metre"]]),
  acquisitionMode: opts([["new_vehicle", "New biofuel-compatible vehicle"], ["conversion", "Existing vehicle + conversion/modification"]]),
  fuelAvailability: opts([["reliable", "Reliable"], ["intermittent", "Intermittent"], ["limited", "Limited"], ["unknown", "Unknown"]]),
  financingStructure: opts([["equity_100", "100% equity"], ["debt_equity", "Debt + equity"], ["debt_100", "100% debt"], ["custom", "Custom"]]),
  incentiveType: opts([
    ["none", "No incentive"],
    ["upfront_grant", "Upfront grant / subsidy"],
    ["percent_subsidy", "Percentage purchase subsidy"],
    ["tax_credit", "Tax credit / rebate"],
    ["other", "Other"],
  ]),
  chargingArrangement: opts([
    ["existing_access", "Existing charging access"],
    ["dedicated_private", "Dedicated private charger"],
    ["shared_private", "Shared private charger"],
    ["public_only", "Public charging only"],
    ["mixed", "Mixed"],
    ["unknown", "Unknown"],
  ]),
  emissionScope: opts([
    ["direct", "Direct only (burning the fuel, or using the electricity)"],
    ["fuel_cycle", "Fuel or energy cycle (production and delivery included)"],
    ["lifecycle", "Full lifecycle (including vehicles and equipment)"],
  ]),
  yesNoUnknown: YES_NO_UNKNOWN,
} as const;

/** Biofuel pathways that are always liquid and measured in litres. */
export const LIQUID_PATHWAYS: readonly string[] = ["biodiesel_blend", "renewable_diesel"];
/** Charging arrangements that involve buying or building charging infrastructure. */
export const INFRASTRUCTURE_ARRANGEMENTS: readonly string[] = ["dedicated_private", "shared_private", "mixed"];
