"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { GuidanceContext, type GuidanceApi } from "./context";
import { HelpDrawer } from "./HelpDrawer";
import { QuickTour } from "./QuickTour";
import { WelcomeDialog } from "./WelcomeDialog";
import { browserOnboardingStore, type OnboardingStore } from "./onboardingStore";
import { guidanceIdForPath } from "./registry";
import { guidanceReducer, initialGuidanceState, isInWorkspace, shouldShowWelcome } from "./state";
import type { GuidanceId } from "./types";

export function GuidanceProvider({ children, store }: { children: ReactNode; store?: OnboardingStore }) {
  const pathname = usePathname();
  const [state, dispatch] = useReducer(guidanceReducer, initialGuidanceState);
  const storeRef = useRef<OnboardingStore | null>(store ?? null);

  useEffect(() => {
    storeRef.current ??= browserOnboardingStore();
    dispatch({ type: "loaded", record: storeRef.current.load() });
  }, []);

  useEffect(() => {
    if (state.pendingSave) {
      storeRef.current?.save(state.pendingSave);
      dispatch({ type: "saved" });
    }
  }, [state.pendingSave]);

  const openHelp = useCallback((id?: GuidanceId) => dispatch({ type: "help_open", id }), []);
  const closeHelp = useCallback(() => dispatch({ type: "help_close" }), []);
  const startTour = useCallback(() => dispatch({ type: "tour_start" }), []);
  const pageId = guidanceIdForPath(pathname);
  const api = useMemo<GuidanceApi>(() => ({ state, pageId, openHelp, closeHelp, startTour, dispatch }), [state, pageId, openHelp, closeHelp, startTour]);

  return (
    <GuidanceContext.Provider value={api}>
      {children}
      <WelcomeDialog open={shouldShowWelcome(state, isInWorkspace(pathname))} />
      <QuickTour />
      <HelpDrawer />
    </GuidanceContext.Provider>
  );
}
