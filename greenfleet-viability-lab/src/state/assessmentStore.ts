import { createBlankAssessment } from "@/domain/blank";
import { createDemoAssessment, type DemoCaseId } from "@/domain/demo";
import type { NumericField } from "@/domain/fieldValue";
import { setChoice, setCurrency, setInput, setProvenance, setQNumber } from "@/domain/mutations";
import type { Assessment, ProvenanceEntry } from "@/domain/stored";
import type { CurrencyCode } from "@/lib/currency";
import { newId as defaultNewId } from "@/lib/id";
import type { AssessmentRepository } from "./repository";

export interface StoreState {
  assessment: Assessment;
  /** False until saved data has been read on the client. Lets the UI avoid a flash of empty state. */
  hydrated: boolean;
}

export interface AssessmentActions {
  setNumber(id: string, field: NumericField): void;
  setText(id: string, text: string): void;
  /** `null` clears the choice back to "not selected". */
  setChoice(id: string, option: string | null): void;
  setQNumber(id: string, patch: { value?: NumericField; qualifier?: string }): void;
  setProvenance(id: string, patch: Partial<ProvenanceEntry>): void;
  setCurrency(currency: CurrencyCode): void;
  /** Loads the general walkthrough demo, or one of the five synthetic demonstration cases. UI must ask for confirmation first when work would be lost. */
  loadDemo(caseId?: DemoCaseId): void;
  /** Discards everything and starts a fresh blank assessment. UI must ask for confirmation first. */
  reset(): void;
}

export interface AssessmentStore extends AssessmentActions {
  subscribe(listener: () => void): () => void;
  getSnapshot(): StoreState;
  getServerSnapshot(): StoreState;
  hydrate(): void;
}

export interface StoreDeps {
  repository: AssessmentRepository;
  now?: () => Date;
  newId?: () => string;
}

/**
 * Framework-free store (compatible with React's useSyncExternalStore). Holds the single working
 * assessment, persists every change through the repository, and contains no UI or calculation code.
 */
export function createAssessmentStore({ repository, now = () => new Date(), newId = defaultNewId }: StoreDeps): AssessmentStore {
  const iso = () => now().toISOString();
  const initial: StoreState = { assessment: createBlankAssessment(newId(), iso()), hydrated: false };
  let state = initial;
  const listeners = new Set<() => void>();

  const commit = (assessment: Assessment, persist = true) => {
    state = { assessment, hydrated: true };
    if (persist) repository.save(assessment);
    listeners.forEach((l) => l());
  };
  const hydrate = () => {
    if (state.hydrated) return;
    commit(repository.load() ?? state.assessment, false);
  };
  // An edit that arrives before saved work has loaded must build on that work, never replace it.
  const update = (f: (a: Assessment, nowIso: string) => Assessment) => {
    hydrate();
    commit(f(state.assessment, iso()));
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    hydrate,
    setNumber: (id, field) => update((a, t) => setInput(a, id, field, t)),
    setText: (id, text) => update((a, t) => setInput(a, id, text, t)),
    setChoice: (id, option) => update((a, t) => setChoice(a, id, option, t)),
    setQNumber: (id, patch) => update((a, t) => setQNumber(a, id, patch, t)),
    setProvenance: (id, patch) => update((a, t) => setProvenance(a, id, patch, t)),
    setCurrency: (currency) => update((a, t) => setCurrency(a, currency, t)),
    loadDemo: (caseId) => {
      hydrate();
      commit(createDemoAssessment(newId(), iso(), caseId));
    },
    reset: () => {
      repository.clear();
      commit(createBlankAssessment(newId(), iso()), false);
    },
  };
}
