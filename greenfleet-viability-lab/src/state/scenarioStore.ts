import { addScenario, deleteScenario, duplicateScenario, renameScenario, updateScenario, type ListResult, type Overrides, type Scenario, type ScenarioOrigin } from "@/calculation/scenario";
import { browserScenarioRepository, type ScenarioRepository } from "@/calculation/scenario/storage";

export interface ScenarioState {
  scenarios: readonly Scenario[];
  hydrated: boolean;
}

export interface ScenarioStore {
  subscribe(l: () => void): () => void;
  getSnapshot(): ScenarioState;
  getServerSnapshot(): ScenarioState;
  hydrate(): void;
  add(draft: { name: string; description?: string; origin?: ScenarioOrigin; overrides: Overrides }): ListResult;
  rename(id: string, name: string): ListResult;
  update(id: string, patch: { description?: string; overrides?: Overrides }): ListResult;
  duplicate(id: string): ListResult;
  remove(id: string): ListResult;
}

const SERVER: ScenarioState = { scenarios: [], hydrated: false };

/** Framework-free store for saved scenarios, over a repository, so it can be tested without a browser. */
export function createScenarioStore(repo: ScenarioRepository, now: () => string = () => new Date().toISOString(), newId: () => string = () => `sc-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`): ScenarioStore {
  let state: ScenarioState = { scenarios: [], hydrated: false };
  const listeners = new Set<() => void>();
  const commit = (r: ListResult): ListResult => {
    if (r.ok) {
      state = { scenarios: r.scenarios, hydrated: true };
      repo.save(r.scenarios);
      listeners.forEach((l) => l());
    }
    return r;
  };
  return {
    subscribe(l) { listeners.add(l); return () => void listeners.delete(l); },
    getSnapshot: () => state,
    getServerSnapshot: () => SERVER,
    hydrate() {
      if (state.hydrated) return;
      state = { scenarios: repo.load(), hydrated: true };
      listeners.forEach((l) => l());
    },
    add: (d) => commit(addScenario(state.scenarios, d, newId(), now())),
    rename: (id, name) => commit(renameScenario(state.scenarios, id, name, now())),
    update: (id, p) => commit(updateScenario(state.scenarios, id, p, now())),
    duplicate: (id) => commit(duplicateScenario(state.scenarios, id, newId(), now())),
    remove: (id) => commit(deleteScenario(state.scenarios, id)),
  };
}

let browserStore: ScenarioStore | null = null;
export function getBrowserScenarioStore(): ScenarioStore {
  browserStore ??= createScenarioStore(browserScenarioRepository());
  return browserStore;
}
