import type { OnboardingStatus } from "./types";

export const ONBOARDING_KEY = "greenfleet-viability-lab:onboarding";
const VERSION = 1;

export interface OnboardingRecord {
  status: OnboardingStatus;
  at: string;
}

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Remembers only whether the welcome has been dealt with. It is stored apart from the assessment,
 * so guidance can never read, change or clear a user's inputs.
 */
export interface OnboardingStore {
  load(): OnboardingRecord | null;
  save(status: OnboardingStatus, now?: Date): OnboardingRecord;
  clear(): void;
}

export function createOnboardingStore(storage: Storage | null, key = ONBOARDING_KEY): OnboardingStore {
  return {
    load() {
      if (!storage) return null;
      try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        const v = JSON.parse(raw) as { version?: number; status?: string; at?: string } | null;
        if (!v || v.version !== VERSION || (v.status !== "completed" && v.status !== "skipped" && v.status !== "dismissed")) return null;
        return { status: v.status, at: typeof v.at === "string" ? v.at : "" };
      } catch {
        return null;
      }
    },
    save(status, now = new Date()) {
      const record: OnboardingRecord = { status, at: now.toISOString() };
      try {
        storage?.setItem(key, JSON.stringify({ version: VERSION, ...record }));
      } catch {
        /* blocked or full: the choice still holds for this visit */
      }
      return record;
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

export function browserOnboardingStore(): OnboardingStore {
  let storage: Storage | null = null;
  try {
    storage = typeof window === "undefined" ? null : window.localStorage;
  } catch {
    storage = null;
  }
  return createOnboardingStore(storage);
}
