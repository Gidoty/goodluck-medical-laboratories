import type { Decision } from "../engine/decision";
import type { Alt, Evaluation } from "../engine/evaluate";
import type { Params } from "../engine/fields";
import type { Fmt } from "./format";

export const ALT_NAME: Record<Alt, string> = { bev: "Battery-electric (BEV)", biofuel: "Biofuel blend" };

/** Template-based plain-language reading of the deterministic results. No AI is involved. */
export function narrate(d: Decision, ev: Evaluation, p: Params, f: Fmt): { commercial: string[]; environmental: string; whatMustChange: string[] } {
  const inc = ev.incr[d.alt];
  const name = ALT_NAME[d.alt];
  const H = p.horizonYears;
  const commercial: string[] = [];

  commercial.push(
    inc.npv > 0
      ? `Over ${H} years, ${name} has an NPV ${f.money(inc.npv)} better than diesel.`
      : `Over ${H} years, diesel has an NPV ${f.money(-inc.npv)} better than ${name}.`,
  );
  commercial.push(
    inc.paybackYears === null
      ? "Cumulative savings do not turn positive within the analysis horizon, so there is no payback."
      : `Payback is ${f.years(inc.paybackYears)} against a limit of ${f.num(p.ruleMaxPaybackYears)} yr.`,
  );
  for (const o of d.operational.filter((o) => !o.passed)) {
    commercial.push(`Operational check failed: ${o.label.toLowerCase()} (${f.num(o.actual)} ${o.unit} against ${f.num(o.required)} ${o.unit}).`);
  }
  const failed = d.stress.filter((s) => !s.positive);
  if (d.stress.length && inc.npv > 0 && failed.length) {
    commercial.push(`NPV turns negative if: ${failed.map((s) => `${s.label.toLowerCase()} ${s.changeText}`).join("; ")}.`);
  }
  if (d.drivers[0]) {
    const top = d.drivers.slice(0, 3).map((r) => r.label.toLowerCase());
    commercial.push(`The result is most sensitive to: ${top.join(", ")}.`);
  }

  const red = inc.emissionsReductionPct;
  const environmental =
    `Estimated emissions are ${f.pct(Math.abs(red))} ${red >= 0 ? "lower" : "higher"} than diesel ` +
    `(${f.num(Math.abs(inc.emissionsReductionKg) / 1000)} t CO2e over ${H} years), using your emission factors. ` +
    (inc.abatementCostPerTonne !== null
      ? `Present-value cost per tonne avoided: ${f.money(inc.abatementCostPerTonne)}${inc.abatementCostPerTonne < 0 ? " (a net saving)" : ""}. `
      : "") +
    "This is reported separately and does not change the commercial classification.";

  const whatMustChange: string[] = [];
  for (const b of d.breakEvens) {
    if (b.breakEven === null) { whatMustChange.push(`${b.label}: ${b.reason}`); continue; }
    const dir = b.changePct! >= 0 ? "rise" : "fall";
    if (Math.abs(b.changePct!) < 0.05) { whatMustChange.push(`${b.label} is already at break-even.`); continue; }
    const show = (v: number) =>
      b.unit.startsWith("{cur}") ? `${v < 100 ? f.perUnit(v) : f.money(v)}${b.unit.slice(5)}` : `${f.num(v, 2)} ${b.unit}`;
    whatMustChange.push(
      `${b.label} would need to ${dir} from ${show(b.current)} to about ${show(b.breakEven)} (${b.changePct! >= 0 ? "+" : ""}${f.num(b.changePct!, 0)}%) for NPV to reach zero, with everything else unchanged.`,
    );
  }
  return { commercial, environmental, whatMustChange };
}
