import type { ReportModel } from "./types";

export type ScreenId = "snapshot" | "comparison" | "economic" | "operational" | "environmental" | "commercial" | "why" | "viability" | "drivers" | "takeaways";

export interface ScreenDef {
  id: ScreenId;
  title: string;
}

/**
 * The screens that have something true to show. A screen whose analysis was not run is left out
 * instead of being shown empty. The environmental screen stays, because "unavailable" is itself a finding.
 */
export function buildPresentationScreens(m: ReportModel): ScreenDef[] {
  const out: ScreenDef[] = [
    { id: "snapshot", title: "Assessment snapshot" },
    { id: "comparison", title: "Technology comparison" },
    { id: "economic", title: "Economic performance" },
    { id: "operational", title: "Operational feasibility" },
    { id: "environmental", title: "Environmental performance" },
    { id: "commercial", title: "Commercial classification" },
    { id: "why", title: "Why this result?" },
  ];
  if (m.thresholds.state === "included") out.push({ id: "viability", title: m.thresholds.analyses.every((a) => a.mode === "viability_margin") ? "Viability margin" : "What would make it viable?" });
  if (m.sensitivity.drivers.length > 0) out.push({ id: "drivers", title: "Sensitivity drivers" });
  out.push({ id: "takeaways", title: "Key decision takeaways" });
  return out;
}

export interface PresentationState {
  index: number;
  exited: boolean;
}

export type PresentationAction = { type: "next" } | { type: "previous" } | { type: "exit" } | { type: "go"; index: number };

/** Moves one screen at a time. It never goes past the ends and never advances by itself. */
export function presentationReducer(s: PresentationState, a: PresentationAction, count: number): PresentationState {
  switch (a.type) {
    case "next": return { ...s, index: Math.min(count - 1, s.index + 1) };
    case "previous": return { ...s, index: Math.max(0, s.index - 1) };
    case "go": return { ...s, index: Math.min(count - 1, Math.max(0, a.index)) };
    case "exit": return { ...s, exited: true };
  }
}

export function keyToAction(key: string): PresentationAction | null {
  if (key === "ArrowRight") return { type: "next" };
  if (key === "ArrowLeft") return { type: "previous" };
  if (key === "Escape") return { type: "exit" };
  return null;
}
