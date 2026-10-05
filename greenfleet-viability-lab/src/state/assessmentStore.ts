import {
  createBlankAssessment,
  setCurrency as withCurrency,
  setNumeric,
  setText,
  type NumericPath,
  type TextPath,
} from "@/domain/assessment";
import { createDemoAssessment } from "@/domain/demo";
import type { NumericField } from "@/domain/fieldValue";
import type { Assessment } from "@/domain/types";
import type { CurrencyCode } from "@/lib/currency";
import { newId as defaultNewId } from "@/lib/id";
import type { AssessmentRepository } from "./repository";

export interface StoreState {
  assessment: Assessment;
  /** False until saved data has been read on the client. Lets the UI avoid a flash of empty state. */
  hydrated: boolean;
}

export interface AssessmentStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): StoreState;
  getServerSnapshot(): StoreState;
  hydrate(): void;
  setNumeric(path: NumericPath, field: NumericField): void;
  setText(path: TextPath, text: string): void;
  setCurrency(currency: CurrencyCode): void;
  loadDemo(): void;
  reset(): void;
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

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    hydrate() {
      if (state.hydrated) return;
      commit(repository.load() ?? state.assessment, false);
    },
    setNumeric: (path, field) => commit(setNumeric(state.assessment, path, field, iso())),
    setText: (path, text) => commit(setText(state.assessment, path, text, iso())),
    setCurrency: (currency) => commit(withCurrency(state.assessment, currency, iso())),
    loadDemo: () => commit(createDemoAssessment(newId(), iso())),
    reset: () => {
      repository.clear();
      commit(createBlankAssessment(newId(), iso()), false);
    },
  };
}
