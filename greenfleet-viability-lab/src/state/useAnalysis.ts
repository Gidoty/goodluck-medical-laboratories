"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getBrowserAnalysisStore, type AnalysisStore, type AnalysisRecord } from "@/reporting/analysisRecord";

export function useAnalysisStore(): { record: AnalysisRecord | null; store: AnalysisStore } {
  const store = getBrowserAnalysisStore();
  const record = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => store.hydrate(), [store]);
  return { record, store };
}
