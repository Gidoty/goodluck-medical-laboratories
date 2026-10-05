import type { NormalizedAssessmentInput } from "@/domain/normalized";
import type { DriverAnalysis, SensitivityResult } from "@/calculation/sensitivity";
import type { ViabilityAnalysis } from "@/calculation/threshold";
import type { GreenTechId } from "@/calculation/types";

/**
 * The sensitivity, driver and threshold analyses the user has actually run on the Sensitivity page,
 * kept so the report and the presentation can show them without running them again. Each record is
 * tied to a fingerprint of the Base Case, so a result for different inputs is never shown.
 */
export interface AnalysisRecord {
  version: 1;
  fingerprint: string;
  savedAt: string;
  viability: Partial<Record<GreenTechId, ViabilityAnalysis>>;
  drivers: Partial<Record<GreenTechId, DriverAnalysis>>;
  oneWay: Partial<Record<GreenTechId, SensitivityResult[]>>;
}

export const ANALYSIS_KEY = "greenfleet-viability-lab:analysis";
export const MAX_ONE_WAY_PER_TECH = 4;

/** FNV-1a over the normalized input without the fields that change on every edit but not the numbers. */
export function fingerprintInput(input: NormalizedAssessmentInput): string {
  const copy = { ...input, meta: { ...input.meta, updatedAt: "", scenarioName: "" } };
  const s = JSON.stringify(copy);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export const emptyRecord = (fingerprint: string, now: string): AnalysisRecord => ({ version: 1, fingerprint, savedAt: now, viability: {}, drivers: {}, oneWay: {} });

/** Returns the record only when it belongs to these inputs. */
export const recordFor = (record: AnalysisRecord | null, input: NormalizedAssessmentInput): AnalysisRecord | null => (record && record.fingerprint === fingerprintInput(input) ? record : null);

export const hasAnyAnalysis = (r: AnalysisRecord | null): boolean => !!r && (Object.keys(r.viability).length > 0 || Object.keys(r.drivers).length > 0 || Object.keys(r.oneWay).length > 0);

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AnalysisStore {
  subscribe(l: () => void): () => void;
  getSnapshot(): AnalysisRecord | null;
  getServerSnapshot(): AnalysisRecord | null;
  hydrate(): void;
  recordViability(input: NormalizedAssessmentInput, tech: GreenTechId, a: ViabilityAnalysis): void;
  recordDrivers(input: NormalizedAssessmentInput, tech: GreenTechId, d: DriverAnalysis): void;
  recordOneWay(input: NormalizedAssessmentInput, tech: GreenTechId, r: SensitivityResult): void;
  clear(): void;
}

export function createAnalysisStore(storage: Storage | null, now: () => string = () => new Date().toISOString()): AnalysisStore {
  let state: AnalysisRecord | null = null;
  let loaded = false;
  const listeners = new Set<() => void>();
  const persist = () => {
    try {
      if (state) storage?.setItem(ANALYSIS_KEY, JSON.stringify(state));
      else storage?.removeItem(ANALYSIS_KEY);
    } catch {
      /* storage blocked or full: the analysis still shows for this visit */
    }
  };
  const emit = () => listeners.forEach((l) => l());
  const base = (input: NormalizedAssessmentInput): AnalysisRecord => {
    const fp = fingerprintInput(input);
    return state && state.fingerprint === fp ? state : emptyRecord(fp, now());
  };
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  return {
    subscribe(l) { listeners.add(l); return () => void listeners.delete(l); },
    getSnapshot: () => state,
    getServerSnapshot: () => null,
    hydrate() {
      if (loaded) return;
      loaded = true;
      try {
        const raw = storage?.getItem(ANALYSIS_KEY);
        const parsed = raw ? (JSON.parse(raw) as Partial<AnalysisRecord>) : null;
        state = parsed && parsed.version === 1 && typeof parsed.fingerprint === "string" ? { ...emptyRecord(parsed.fingerprint, parsed.savedAt ?? ""), ...parsed } as AnalysisRecord : null;
      } catch {
        state = null;
      }
      emit();
    },
    recordViability(input, tech, a) {
      const b = base(input);
      if (same(b.viability[tech], a) && b === state) return;
      state = { ...b, savedAt: now(), viability: { ...b.viability, [tech]: a } };
      persist(); emit();
    },
    recordDrivers(input, tech, d) {
      const b = base(input);
      if (same(b.drivers[tech], d) && b === state) return;
      state = { ...b, savedAt: now(), drivers: { ...b.drivers, [tech]: d } };
      persist(); emit();
    },
    recordOneWay(input, tech, r) {
      const b = base(input);
      const prior = (b.oneWay[tech] ?? []).filter((x) => x.variableId !== r.variableId);
      const list = [...prior, r].slice(-MAX_ONE_WAY_PER_TECH);
      if (same(b.oneWay[tech], list) && b === state) return;
      state = { ...b, savedAt: now(), oneWay: { ...b.oneWay, [tech]: list } };
      persist(); emit();
    },
    clear() { state = null; persist(); emit(); },
  };
}

let browser: AnalysisStore | null = null;
export function getBrowserAnalysisStore(): AnalysisStore {
  if (!browser) {
    let s: Storage | null = null;
    try { s = typeof window === "undefined" ? null : window.localStorage; } catch { s = null; }
    browser = createAnalysisStore(s);
  }
  return browser;
}
