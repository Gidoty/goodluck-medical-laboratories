"use client";

import { createContext, useContext } from "react";
import { initialGuidanceState, type GuidanceAction, type GuidanceState } from "./state";
import type { GuidanceId } from "./types";

export interface GuidanceApi {
  state: GuidanceState;
  pageId: GuidanceId;
  openHelp: (id?: GuidanceId) => void;
  closeHelp: () => void;
  startTour: () => void;
  dispatch: (a: GuidanceAction) => void;
}

const noop = () => undefined;
export const DEFAULT_GUIDANCE: GuidanceApi = { state: initialGuidanceState, pageId: "home", openHelp: noop, closeHelp: noop, startTour: noop, dispatch: noop };
export const GuidanceContext = createContext<GuidanceApi>(DEFAULT_GUIDANCE);

/** Safe outside a provider (static rendering, tests): the controls simply do nothing. */
export const useGuidance = () => useContext(GuidanceContext);
