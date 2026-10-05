import { createBlankAssessment, restoreAssessment } from "@/domain/blank";
import type { Assessment } from "@/domain/stored";

/**
 * Persistence boundary. The store only knows this interface, so localStorage can later be swapped
 * for an API or database without touching state or UI code.
 */
export interface AssessmentRepository {
  load(): Assessment | null;
  save(assessment: Assessment): void;
  clear(): void;
}

/** The subset of the Web Storage API that the repository needs. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_KEY = "greenfleet-viability-lab:assessment";
/** Bump when the stored shape changes incompatibly. Older saves are ignored rather than misread. */
export const SCHEMA_VERSION = 2;

interface Envelope {
  version: number;
  assessment: unknown;
}

export function createStorageRepository(storage: KeyValueStorage | null, key = STORAGE_KEY): AssessmentRepository {
  return {
    load() {
      if (!storage) return null;
      try {
        const raw = storage.getItem(key);
        if (raw === null) return null;
        const env = JSON.parse(raw) as Partial<Envelope> | null;
        if (!env || env.version !== SCHEMA_VERSION || typeof env.assessment !== "object" || env.assessment === null) return null;
        const saved = env.assessment as { id?: unknown; updatedAt?: unknown };
        const id = typeof saved.id === "string" ? saved.id : "recovered";
        const now = typeof saved.updatedAt === "string" ? saved.updatedAt : new Date(0).toISOString();
        return restoreAssessment(createBlankAssessment(id, now), env.assessment);
      } catch {
        return null; // corrupted data must never break the app; start clean instead
      }
    },
    save(assessment) {
      if (!storage) return;
      try {
        storage.setItem(key, JSON.stringify({ version: SCHEMA_VERSION, assessment } satisfies Envelope));
      } catch {
        // storage full or blocked: the in-memory state still works for this session
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

/** Browser storage if available, otherwise null (server render, privacy modes that throw). */
export function getBrowserStorage(): KeyValueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
