import { describe, expect, it, vi } from "vitest";
import { createReader } from "@/domain/reader";
import { isUntouched } from "@/domain/mutations";
import { missing, notApplicable, value } from "@/domain/fieldValue";
import { createAssessmentStore } from "./assessmentStore";
import { createConfirmGate } from "./confirmGate";
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
const read = (s: ReturnType<typeof createAssessmentStore>) => createReader(s.getSnapshot().assessment);

describe("assessment store persistence", () => {
  it("persists edits and restores them in a new store, including 0, not-applicable and unknown", () => {
    const storage = memoryStorage();
    const first = createAssessmentStore(deps(storage));
    first.hydrate();
    first.setText("business.assessmentName", "My fleet");
    first.setNumber("diesel.insurance", value(0));
    first.setNumber("diesel.registration", notApplicable());
    first.setChoice("bev.batteryReplacement", "unknown");
    first.setQNumber("diesel.fuelEfficiency", { value: value(8), qualifier: "km_per_litre" });
    first.setProvenance("diesel.fuelPrice", { source: "supplier_quotation", reference: "Depot quote", year: value(2026) });

    const second = createAssessmentStore(deps(storage));
    expect(second.getSnapshot().hydrated).toBe(false);
    second.hydrate();
    const r = read(second);
    expect(r.text("business.assessmentName")).toBe("My fleet");
    expect(r.number("diesel.insurance")).toEqual(value(0));
    expect(r.number("diesel.registration")).toEqual(notApplicable());
    expect(r.number("diesel.annualMaintenance")).toEqual(missing());
    expect(r.choice("bev.batteryReplacement")).toBe("unknown");
    expect(r.q("diesel.fuelEfficiency")).toEqual({ value: value(8), qualifier: "km_per_litre" });
    expect(second.getSnapshot().assessment.provenance["diesel.fuelPrice"]).toEqual({ source: "supplier_quotation", reference: "Depot quote", year: value(2026) });
  });

  it("keeps every entry while the user moves between wizard steps (state is independent of the route)", () => {
    const store = createAssessmentStore(deps(memoryStorage()));
    store.hydrate();
    store.setNumber("fleet.size", value(5)); // step 1
    store.setNumber("diesel.acquisitionPrice", value(0)); // step 2
    const before = store.getSnapshot().assessment.inputs;
    // "navigating" does not touch the store; reading from different steps sees the same data
    expect(read(store).number("fleet.size")).toEqual(value(5));
    store.setNumber("bev.usableRange", value(200)); // step 3
    expect(read(store).number("fleet.size")).toEqual(value(5));
    expect(read(store).number("diesel.acquisitionPrice")).toEqual(value(0));
    expect(store.getSnapshot().assessment.inputs["fleet.size"]).toBe(before["fleet.size"]);
  });

  it("notifies subscribers and exposes a new snapshot on change", () => {
    const store = createAssessmentStore(deps(memoryStorage()));
    store.hydrate();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    const before = store.getSnapshot();
    store.setNumber("fleet.size", value(3));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(before);
    off();
    store.setNumber("fleet.size", value(4));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite saved work when hydrate runs, and hydrate is idempotent", () => {
    const storage = memoryStorage();
    const a = createAssessmentStore(deps(storage));
    a.hydrate();
    a.setText("business.assessmentName", "Keep me");
    const b = createAssessmentStore(deps(storage));
    b.hydrate();
    b.hydrate();
    expect(read(b).text("business.assessmentName")).toBe("Keep me");
  });

  it("an edit made before saved work has loaded builds on that work instead of replacing it", () => {
    const storage = memoryStorage();
    const first = createAssessmentStore(deps(storage));
    first.hydrate();
    first.setText("business.assessmentName", "Saved earlier");
    first.setNumber("fleet.size", value(9));

    const second = createAssessmentStore(deps(storage)); // never hydrated explicitly
    second.setNumber("ops.operatingDays", value(250));
    expect(read(second).text("business.assessmentName")).toBe("Saved earlier");
    expect(read(second).number("fleet.size")).toEqual(value(9));
    expect(read(second).number("ops.operatingDays")).toEqual(value(250));
    const third = createAssessmentStore(deps(storage));
    third.hydrate();
    expect(read(third).number("fleet.size")).toEqual(value(9));
  });

  it("loadDemo marks values illustrative and editing a value removes its label", () => {
    const s = createAssessmentStore(deps(memoryStorage()));
    s.hydrate();
    s.loadDemo();
    expect(s.getSnapshot().assessment.origin).toBe("demo");
    expect(s.getSnapshot().assessment.illustrative).toContain("fleet.size");
    s.setNumber("fleet.size", value(7));
    expect(s.getSnapshot().assessment.illustrative).not.toContain("fleet.size");
    expect(s.getSnapshot().assessment.illustrative).toContain("ops.dailyDistance");
    expect(s.getSnapshot().assessment.origin).toBe("demo");
  });

  it("a blank assessment is untouched until the first edit", () => {
    const s = createAssessmentStore(deps(memoryStorage()));
    s.hydrate();
    expect(isUntouched(s.getSnapshot().assessment)).toBe(true);
    s.setNumber("fleet.size", value(1));
    expect(isUntouched(s.getSnapshot().assessment)).toBe(false);
  });
});

describe("reset requires confirmation", () => {
  it("does nothing until confirmed, and cancel leaves the work intact", () => {
    const storage = memoryStorage();
    const s = createAssessmentStore(deps(storage));
    s.hydrate();
    s.setText("business.assessmentName", "Precious work");
    const gate = createConfirmGate(s.reset);

    gate.request();
    expect(gate.pending).toBe(true);
    expect(read(s).text("business.assessmentName")).toBe("Precious work");

    gate.cancel();
    expect(gate.confirm()).toBe(false); // cancelled: confirming now must do nothing
    expect(read(s).text("business.assessmentName")).toBe("Precious work");
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
  });
  it("a confirm without a prior request is ignored", () => {
    const action = vi.fn();
    expect(createConfirmGate(action).confirm()).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });
  it("clears the saved assessment and starts blank after confirm", () => {
    const storage = memoryStorage();
    const s = createAssessmentStore(deps(storage));
    s.hydrate();
    s.loadDemo();
    const gate = createConfirmGate(s.reset);
    gate.request();
    expect(gate.confirm()).toBe(true);
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
    expect(read(s).text("business.assessmentName")).toBe("");
    expect(read(s).number("fleet.size")).toEqual(missing());
    expect(s.getSnapshot().assessment.illustrative).toEqual([]);
    expect(gate.pending).toBe(false);
  });
});

describe("repository resilience", () => {
  it("ignores corrupted JSON, older versions and wrong shapes", () => {
    expect(createStorageRepository(memoryStorage({ [STORAGE_KEY]: "{not json" })).load()).toBeNull();
    expect(createStorageRepository(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, assessment: {} }) })).load()).toBeNull();
    expect(createStorageRepository(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: SCHEMA_VERSION, assessment: 5 }) })).load()).toBeNull();
  });
  it("repairs malformed fields instead of trusting them", () => {
    const stored = JSON.stringify({
      version: SCHEMA_VERSION,
      assessment: {
        id: "x",
        inputs: {
          "fleet.size": { status: "value", value: "five" },
          "ops.operatingDays": { status: "value", value: 250 },
          "business.country": { status: "value", value: "not-a-country" },
          "business.currency": { status: "value", value: "XXX" },
          "no.such.field": 1,
        },
        illustrative: ["fleet.size", "no.such.field"],
      },
    });
    const loaded = createStorageRepository(memoryStorage({ [STORAGE_KEY]: stored })).load()!;
    const r = createReader(loaded);
    expect(r.number("fleet.size")).toEqual(missing());
    expect(r.number("ops.operatingDays")).toEqual(value(250));
    expect(r.choice("business.country")).toBeUndefined();
    expect(r.currency).toBe("NGN");
    expect(loaded.illustrative).toEqual(["fleet.size"]);
    expect("no.such.field" in loaded.inputs).toBe(false);
  });
  it("works with no storage, and survives a storage that throws", () => {
    const repo = createStorageRepository(null);
    repo.save(createAssessmentStore(deps(null)).getSnapshot().assessment);
    expect(repo.load()).toBeNull();
    const broken: KeyValueStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("full"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    const store = createAssessmentStore(deps(broken));
    expect(() => { store.hydrate(); store.setText("business.assessmentName", "x"); store.reset(); }).not.toThrow();
  });
});
