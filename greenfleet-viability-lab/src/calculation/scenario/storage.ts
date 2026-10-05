import { MAX_SCENARIOS, type Scenario } from "./index";

export const SCENARIO_KEY = "greenfleet-viability-lab:scenarios";
const VERSION = 1;

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Persistence boundary for saved scenarios. Local only, no account, and apart from the assessment key. */
export interface ScenarioRepository {
  load(): Scenario[];
  save(list: readonly Scenario[]): void;
  clear(): void;
}

const isScenario = (x: unknown): x is Scenario => {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return typeof s.id === "string" && typeof s.name === "string" && typeof s.description === "string" && (s.origin === "user" || s.origin === "illustrative" || s.origin === "threshold") && !!s.overrides && typeof s.overrides === "object" && typeof s.createdAt === "string" && typeof s.updatedAt === "string";
};

export function createScenarioRepository(storage: Storage | null, key = SCENARIO_KEY): ScenarioRepository {
  return {
    load() {
      if (!storage) return [];
      try {
        const raw = storage.getItem(key);
        if (!raw) return [];
        const env = JSON.parse(raw) as { version?: number; scenarios?: unknown } | null;
        if (!env || env.version !== VERSION || !Array.isArray(env.scenarios)) return [];
        return env.scenarios.filter(isScenario).slice(0, MAX_SCENARIOS);
      } catch {
        return [];
      }
    },
    save(list) {
      try {
        storage?.setItem(key, JSON.stringify({ version: VERSION, scenarios: list }));
      } catch {
        /* blocked or full: the list still works for this visit */
      }
    },
    clear() {
      try {
        storage?.removeItem(key);
      } catch {
        /* nothing to do */
      }
    },
  };
}

export function browserScenarioRepository(): ScenarioRepository {
  let s: Storage | null = null;
  try {
    s = typeof window === "undefined" ? null : window.localStorage;
  } catch {
    s = null;
  }
  return createScenarioRepository(s);
}
