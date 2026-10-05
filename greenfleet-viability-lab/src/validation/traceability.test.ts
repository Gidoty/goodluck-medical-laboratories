import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Keeps docs/REQUIREMENTS_TRACEABILITY.md honest. Every implementation path and test path must exist, every quoted test title
 * must appear in one of the files listed in the same row, and every status must be one of the allowed values.
 */
const ROOT = process.cwd();
const doc = readFileSync(join(ROOT, "docs/REQUIREMENTS_TRACEABILITY.md"), "utf8");
const ALLOWED = new Set(["PASS", "PASS (limitation)", "PASS (defect fixed)"]);

interface Row { id: string; requirement: string; impl: string; tests: string; status: string }
const rows: Row[] = doc
  .split("\n")
  .filter((l) => /^\| GF-[A-Z]+-\d{3} \|/.test(l))
  .map((l) => {
    const c = l.split("|").map((x) => x.trim());
    return { id: c[1]!, requirement: c[2]!, impl: c[3]!, tests: c[4]!, status: c[5]! };
  });

const paths = (cell: string) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
const titles = (cell: string) => [...cell.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);

describe("requirements traceability matrix", () => {
  it("lists a substantial set of requirements across every required area", () => {
    expect(rows.length).toBeGreaterThanOrEqual(75);
    const areas = new Set(rows.map((r) => r.id.split("-")[1]));
    for (const a of ["INP", "ECO", "OPS", "ENV", "VIA", "GUI", "SEN", "SCN", "THR", "REP", "EXP", "PRE", "ACC", "PER", "SEC"]) expect(areas.has(a), a).toBe(true);
  });
  it("has unique, ordered ids", () => {
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const area of new Set(rows.map((r) => r.id.split("-")[1]))) {
      const nums = rows.filter((r) => r.id.split("-")[1] === area).map((r) => Number(r.id.split("-")[2]));
      expect(nums, area).toEqual([...nums].sort((a, b) => a - b));
    }
  });
  it.each(rows.map((r) => [r.id, r] as const))("%s: every referenced file exists, every quoted title is found, status is allowed", (_id, r) => {
    expect(r.requirement.length, "requirement text").toBeGreaterThan(20);
    expect(ALLOWED.has(r.status), `status "${r.status}"`).toBe(true);
    const impl = paths(r.impl);
    const tests = paths(r.tests);
    expect(impl.length, "implementation").toBeGreaterThan(0);
    expect(tests.length, "tests").toBeGreaterThan(0);
    for (const p of [...impl, ...tests]) expect(existsSync(join(ROOT, p)), `missing: ${p}`).toBe(true);
    const text = tests.filter((p) => /\.(ts|tsx|cjs)$/.test(p)).map((p) => readFileSync(join(ROOT, p), "utf8")).join("\n");
    for (const t of titles(r.tests)) expect(text.includes(t), `title not found in the listed test files: "${t}"`).toBe(true);
  });
  it("every test file in the validation folder is referenced by at least one requirement", () => {
    const used = new Set(rows.flatMap((r) => paths(r.tests)));
    for (const f of ["benchmarks.test.ts", "policy.test.ts", "env-ops.test.ts", "analysis.test.ts", "adversarial.test.ts", "outputs.test.tsx", "demo-cases.test.tsx", "audit.test.ts"]) expect(used.has(`src/validation/${f}`), f).toBe(true);
  });
});
