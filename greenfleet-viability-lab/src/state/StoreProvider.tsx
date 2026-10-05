"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createAssessmentStore, type AssessmentActions, type AssessmentStore, type StoreState } from "./assessmentStore";
import { createStorageRepository, getBrowserStorage } from "./repository";

const StoreContext = createContext<AssessmentStore | null>(null);

export function AssessmentStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createAssessmentStore({ repository: createStorageRepository(getBrowserStorage()) }));
  useEffect(() => store.hydrate(), [store]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

function useStore(): AssessmentStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useAssessment must be used inside <AssessmentStoreProvider>.");
  return store;
}

export function useAssessmentState(): StoreState {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/** Actions only (stable reference, never causes re-renders). */
export function useAssessmentActions(): AssessmentActions {
  return useStore();
}
