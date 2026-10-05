import { describe, expect, it, vi } from "vitest";
import { getNumeric } from "@/domain/assessment";
import { notApplicable, value } from "@/domain/fieldValue";
import { createAssessmentStore } from "./assessmentStore";
import { createStorageRepository, SCHEMA_VERSION, STORAGE_KEY, type KeyValueStorage } from "./repository";

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const clock = () => new Date("2026-03-01T10:00:00.000Z");
let n = 0;
const deps = (storage: KeyValueStorage | null) => ({ repository: createStorageRepository(storage), now: clock, newId: () => `id-${++n}` });

describe("assessment store persistence", () => {
  it("persists edits and restores them in a new store, including 0 and not-applicable", () => {
    const storage = memoryStorage();
    const first = createAssessmentStore(deps(storage));
    first.hydrate();
    first.setNumeric(["infrastructure", "chargingInfrastructureCost"], value(0));
    first.setNumeric(["financing", "loanTermYears"], notApplicable());
    first.setText(["name"], "My fleet");

    const second = createAssessmentStore(deps(storage));
    expect(second.getSnapshot().hydrated).toBe(false);
    second.hydrate();
    const a = second.getSnapshot().assessment;
    expect(a.name).toBe("My fleet");
    expect(getNumeric(a, ["infrastructure", "chargingInfrastructureCost"])).toEqual(value(0));
    expect(getNumeric(a, ["financing", "loanTermYears"])).toEqual(notApplicable());
  });

  it("notifies subscribers and exposes a new snapshot on change", () => {
    const store = createAssessmentStore(deps(memoryStorage()));
    store.hydrate();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    const before = store.getSnapshot();
    store.setNumeric(["business", "fleetSize"], value(3));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(before);
    off();
    store.setNumeric(["business", "fleetSize"], value(4));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite saved work when hydrate runs, and hydrate is idempotent", () => {
    const storage = memoryStorage();
    const a = createAssessmentStore(deps(storage));
    a.hydrate();
    a.setText(["name"], "Keep me");
    const b = createAssessmentStore(deps(storage));
    b.hydrate();
    b.hydrate();
    expect(b.getSnapshot().assessment.name).toBe("Keep me");
  });

  it("reset clears storage", () => {
    const storage = memoryStorage();
    const s = createAssessmentStore(deps(storage));
    s.hydrate();
    s.setText(["name"], "Temp");
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
    s.reset();
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
    expect(s.getSnapshot().assessment.name).toBe("Untitled assessment");
  });

  it("loadDemo marks the data as demo", () => {
    const s = createAssessmentStore(deps(memoryStorage()));
    s.hydrate();
    s.loadDemo();
    expect(s.getSnapshot().assessment.origin).toBe("demo");
  });
});

describe("repository resilience", () => {
  it("ignores corrupted JSON, wrong versions and wrong shapes", () => {
    expect(createStorageRepository(memoryStorage({ [STORAGE_KEY]: "{not json" })).load()).toBeNull();
    expect(createStorageRepository(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 999, assessment: {} }) })).load()).toBeNull();
    expect(createStorageRepository(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: SCHEMA_VERSION, assessment: 5 }) })).load()).toBeNull();
  });
  it("falls back to the default currency when a saved one is unsupported", () => {
    const stored = JSON.stringify({ version: SCHEMA_VERSION, assessment: { id: "x", currency: "XXX" } });
    expect(createStorageRepository(memoryStorage({ [STORAGE_KEY]: stored })).load()?.currency).toBe("NGN");
  });
  it("works with no storage at all", () => {
    const repo = createStorageRepository(null);
    repo.save(createAssessmentStore(deps(null)).getSnapshot().assessment);
    expect(repo.load()).toBeNull();
  });
  it("survives a storage that throws", () => {
    const broken: KeyValueStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("full"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    const store = createAssessmentStore(deps(broken));
    expect(() => { store.hydrate(); store.setText(["name"], "x"); store.reset(); }).not.toThrow();
  });
});
