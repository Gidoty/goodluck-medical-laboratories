import type { Params, Tech } from "./fields";
import { computeTech, incremental, type Incremental, type TechResult } from "./model";

export type Alt = Exclude<Tech, "diesel">;
export const ALTS: readonly Alt[] = ["bev", "biofuel"];

export interface Evaluation {
  results: Record<Tech, TechResult>;
  incr: Record<Alt, Incremental>;
  /** Technology with the lowest nominal TCO, regardless of classification. */
  lowestTco: Tech;
  /** Technology with the lowest present-value cost. */
  lowestPvTco: Tech;
}

export function evaluate(p: Params): Evaluation {
  const results = {
    diesel: computeTech(p, "diesel"),
    bev: computeTech(p, "bev"),
    biofuel: computeTech(p, "biofuel"),
  };
  const incr = {
    bev: incremental(p, results.diesel, results.bev),
    biofuel: incremental(p, results.diesel, results.biofuel),
  };
  const techs: Tech[] = ["diesel", "bev", "biofuel"];
  const argmin = (f: (t: Tech) => number) => techs.reduce((a, b) => (f(b) < f(a) ? b : a));
  return {
    results,
    incr,
    lowestTco: argmin((t) => results[t].tco),
    lowestPvTco: argmin((t) => results[t].pvTco),
  };
}

export const npvVsDiesel = (p: Params, alt: Alt) => evaluate(p).incr[alt].npv;
