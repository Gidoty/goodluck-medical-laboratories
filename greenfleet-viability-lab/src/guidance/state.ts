import type { OnboardingRecord } from "./onboardingStore";
import { TOUR_STEPS } from "./content";
import type { GuidanceId, OnboardingStatus } from "./types";

/**
 * Pure state for onboarding, the quick tour and the help panel. Nothing here touches an
 * assessment: the only thing remembered is the onboarding record, kept under its own key.
 */
export interface GuidanceState {
  /** undefined until storage has been read, null when the user has never dealt with the welcome. */
  record: OnboardingRecord | null | undefined;
  /** A record was just chosen and still has to be written to storage. */
  pendingSave: OnboardingStatus | null;
  tour: { open: boolean; step: number };
  help: { open: boolean; id: GuidanceId | null };
}

export const initialGuidanceState: GuidanceState = { record: undefined, pendingSave: null, tour: { open: false, step: 0 }, help: { open: false, id: null } };

export type GuidanceAction =
  | { type: "loaded"; record: OnboardingRecord | null }
  | { type: "saved" }
  | { type: "welcome_skip" }
  | { type: "welcome_dismiss" }
  | { type: "welcome_start" }
  | { type: "tour_start" }
  | { type: "tour_next" }
  | { type: "tour_back" }
  | { type: "tour_skip" }
  | { type: "tour_finish" }
  | { type: "tour_close" }
  | { type: "help_open"; id?: GuidanceId }
  | { type: "help_close" }
  | { type: "reset_welcome" };

const choose = (s: GuidanceState, status: OnboardingStatus): GuidanceState => ({
  ...s,
  record: { status, at: "" },
  pendingSave: status,
  tour: { open: false, step: 0 },
});

export function guidanceReducer(s: GuidanceState, a: GuidanceAction): GuidanceState {
  switch (a.type) {
    case "loaded":
      return { ...s, record: a.record };
    case "saved":
      return { ...s, pendingSave: null };
    case "welcome_skip":
      return choose(s, "skipped");
    case "welcome_dismiss":
    case "welcome_start":
      return choose(s, "dismissed");
    case "tour_start":
      // Restarting never deletes the record or any assessment data.
      return { ...s, tour: { open: true, step: 0 }, help: { open: false, id: null } };
    case "tour_next":
      return s.tour.step >= TOUR_STEPS.length - 1 ? s : { ...s, tour: { open: true, step: s.tour.step + 1 } };
    case "tour_back":
      return { ...s, tour: { open: true, step: Math.max(0, s.tour.step - 1) } };
    case "tour_skip":
      return choose(s, "skipped");
    case "tour_finish":
      return choose(s, "completed");
    case "tour_close":
      // Closing with Escape counts as dismissing, so the welcome does not return.
      return s.record === null ? choose(s, "dismissed") : { ...s, tour: { open: false, step: 0 } };
    case "help_open":
      return { ...s, help: { open: true, id: a.id ?? null }, tour: { open: false, step: 0 } };
    case "help_close":
      return { ...s, help: { open: false, id: null } };
    case "reset_welcome":
      return { ...s, record: null };
  }
}

/** The welcome is offered once, inside the workspace, and never while another guide is open. */
export function shouldShowWelcome(s: GuidanceState, inWorkspace: boolean): boolean {
  return s.record === null && inWorkspace && !s.tour.open && !s.help.open;
}

export const isInWorkspace = (pathname: string | null | undefined): boolean => !!pathname && pathname !== "/" && !pathname.startsWith("/present");
