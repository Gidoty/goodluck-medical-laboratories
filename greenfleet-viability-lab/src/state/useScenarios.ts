"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getBrowserScenarioStore, type ScenarioState, type ScenarioStore } from "./scenarioStore";

export function useScenarios(): { state: ScenarioState; store: ScenarioStore } {
  const store = getBrowserScenarioStore();
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => store.hydrate(), [store]);
  return { state, store };
}
