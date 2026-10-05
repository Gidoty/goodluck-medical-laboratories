import { SOLVER_SETTINGS, type SolverReport, type SolverSettings } from "./types";

export type Fn = (x: number) => number | null;

export type RootOutcome =
  | { status: "found"; root: number; fRoot: number; report: SolverReport }
  | { status: "not_bracketed" | "non_monotonic" | "max_iterations" | "evaluation_failed"; report: SolverReport };

const sign = (x: number, tol: number) => (Math.abs(x) <= tol ? 0 : x > 0 ? 1 : -1);

/**
 * Finds x where f(x) = 0, starting from x0 and moving in direction `dir` (+1 or -1) within [lo, hi].
 *
 *  1. Step away from x0, doubling the step each time, until f changes sign (the root is bracketed)
 *     or a solver bound is reached (not bracketed).
 *  2. Sample the bracket and check that f is monotonic across it. If it is not, there is no reliable single root.
 *  3. Bisect until the bracket is narrower than the root tolerance, |f| is within the value tolerance,
 *     or the iteration limit is reached.
 *
 * Every evaluation calls the authoritative engine through `f`. Nothing is extrapolated.
 */
export function findRoot(f: Fn, x0: number, f0: number, dir: 1 | -1, lo: number, hi: number, valueTol: number, settings: SolverSettings = SOLVER_SETTINGS): RootOutcome {
  const cache = new Map<number, number | null>();
  let evaluations = 0;
  const ev: Fn = (x) => {
    if (cache.has(x)) return cache.get(x)!;
    evaluations++;
    const v = f(x);
    cache.set(x, v);
    return v;
  };
  const report = (over: Partial<SolverReport> = {}): SolverReport => ({ method: "bisection", iterations: 0, evaluations, expansions: 0, bounds: { lo, hi }, bracket: null, monotonic: null, settings, ...over });

  const s0 = sign(f0, valueTol);
  if (s0 === 0) return { status: "found", root: x0, fRoot: f0, report: report() };

  // 1. Expand until bracketed.
  const step0 = Math.max(Math.abs(x0) * 0.05, (hi - lo) * 1e-6, 1e-9);
  let a = x0;
  let fa = f0;
  let b = x0;
  let fb = f0;
  let expansions = 0;
  let bracketed = false;
  for (let k = 0; k <= settings.maxExpansions; k++) {
    const raw = x0 + dir * step0 * Math.pow(settings.expansionFactor, k);
    const next = Math.min(hi, Math.max(lo, raw));
    if (next === b) break; // stuck on a bound
    const fn = ev(next);
    expansions = k + 1;
    if (fn === null) return { status: "evaluation_failed", report: report({ expansions }) };
    a = b;
    fa = fb;
    b = next;
    fb = fn;
    if (sign(fn, valueTol) !== s0) {
      bracketed = true;
      break;
    }
    if (next === lo || next === hi) break;
  }
  if (!bracketed) return { status: "not_bracketed", report: report({ expansions }) };
  const [left, right] = a < b ? [a, b] : [b, a];
  const fLeft = a < b ? fa : fb;

  // 2. Monotonic check across the bracket.
  const n = settings.monotonicSamples;
  const samples: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = left + ((right - left) * i) / n;
    const v = i === 0 ? (a < b ? fa : fb) : i === n ? (a < b ? fb : fa) : ev(x);
    if (v === null) return { status: "evaluation_failed", report: report({ expansions, bracket: [left, right] }) };
    samples.push(v);
  }
  let up = false;
  let down = false;
  for (let i = 1; i < samples.length; i++) {
    const d = samples[i]! - samples[i - 1]!;
    if (d > valueTol) up = true;
    if (d < -valueTol) down = true;
  }
  const monotonic = !(up && down);
  if (!monotonic) return { status: "non_monotonic", report: report({ expansions, bracket: [left, right], monotonic: false }) };

  // 3. Bisection.
  let l = left;
  let r = right;
  let fl = fLeft;
  const sl = sign(fl, valueTol);
  let iterations = 0;
  let mid = (l + r) / 2;
  let fm = 0;
  while (iterations < settings.maxIterations) {
    mid = (l + r) / 2;
    const v = ev(mid);
    if (v === null) return { status: "evaluation_failed", report: report({ expansions, iterations, bracket: [left, right], monotonic: true }) };
    fm = v;
    iterations++;
    if (Math.abs(fm) <= valueTol || r - l <= settings.rootToleranceRelative * Math.max(1, Math.abs(mid))) {
      return { status: "found", root: mid, fRoot: fm, report: report({ expansions, iterations, bracket: [left, right], monotonic: true }) };
    }
    if (sign(fm, valueTol) === sl) { l = mid; fl = fm; } else { r = mid; }
  }
  return { status: "max_iterations", report: report({ expansions, iterations, bracket: [left, right], monotonic: true }) };
}
