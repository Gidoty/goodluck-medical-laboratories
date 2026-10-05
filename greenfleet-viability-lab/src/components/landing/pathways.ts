import { BatteryCharging, Fuel, Sprout, type LucideIcon } from "lucide-react";

export interface Pathway {
  id: "diesel" | "electric" | "biofuel";
  name: string;
  role: string;
  summary: string;
  icon: LucideIcon;
}

export const PATHWAYS: readonly Pathway[] = [
  { id: "diesel", name: "Diesel", role: "Baseline", summary: "The conventional vehicle every alternative is measured against. It is a fair benchmark, not a straw man.", icon: Fuel },
  { id: "electric", name: "Battery Electric", role: "Green Alternative", summary: "Higher purchase cost, different energy and maintenance economics, and a charging infrastructure to plan for.", icon: BatteryCharging },
  { id: "biofuel", name: "Biofuel", role: "Alternative Fuel Pathway", summary: "Biofuel or biofuel blends in an adapted or approved engine, with its own supply price and blending limits.", icon: Sprout },
];

export const HOW_IT_WORKS = [
  { title: "Enter operating conditions", text: "Describe your routes, utilisation, vehicles, energy prices and financing." },
  { title: "Compare technologies", text: "Diesel, electric and biofuel are assessed on the same assumptions side by side." },
  { title: "Analyse commercial performance", text: "Total cost of ownership, cost per kilometre, NPV and payback, all traceable to your inputs." },
  { title: "Stress-test assumptions", text: "See how fuel prices, tariffs, interest rates and mileage change the answer." },
  { title: "Identify viability thresholds", text: "Find what would need to change for an unattractive option to become viable." },
] as const;
