import { describe, expect, it } from "vitest";
import { GLOSSARY } from "@/content/glossary";
import { checkAssessment } from "./checks";
import { createReader, visibleFields } from "./reader";
import { FIELDS, FIELD_BY_ID } from "./schema/fields";
import { SECTIONS } from "./schema/sections";
import { ASSESSMENT_STEPS } from "./steps";
import { blank, demo } from "@/test/helpers";

describe("schema integrity", () => {
  it("has unique field ids", () => {
    expect(new Set(FIELDS.map((f) => f.id)).size).toBe(FIELDS.length);
  });
  it("places every field in a real section of its own step", () => {
    for (const f of FIELDS) {
      const s = SECTIONS.find((x) => x.id === f.section);
      expect(s, f.id).toBeDefined();
      expect(s?.step, f.id).toBe(f.step);
      expect(ASSESSMENT_STEPS.some((st) => st.id === f.step)).toBe(true);
    }
  });
  it("only references fields and glossary terms that exist", () => {
    for (const f of FIELDS) {
      if (f.glossary) expect(GLOSSARY[f.glossary], `${f.id} -> ${f.glossary}`).toBeDefined();
      if (f.kind === "choice") for (const id of f.resetsOnChange ?? []) expect(FIELD_BY_ID[id], `${f.id} resets ${id}`).toBeDefined();
    }
  });
  it("resolves every unit and every visibility rule without throwing, for blank and demo data", () => {
    for (const a of [blank(), demo()]) {
      const r = createReader(a);
      for (const f of FIELDS) {
        r.isVisible(f.id);
        if (f.kind === "number" || f.kind === "qnumber") expect(() => r.unitOf(f.id), f.id).not.toThrow();
      }
    }
  });
  it("never preselects a market value in a blank assessment", () => {
    const a = blank();
    const preset = FIELDS.filter((f) => {
      const v = a.inputs[f.id];
      return f.kind === "choice" ? (v as { status: string }).status === "value" : f.kind === "number" ? (v as { status: string }).status !== "missing" : false;
    }).map((f) => f.id);
    expect(preset.sort()).toEqual(["business.currency", "ops.distanceMode"]);
  });
  it("blank data has no validation warnings and only 'missing' errors", () => {
    const issues = checkAssessment(blank());
    expect(issues.filter((i) => i.severity === "error").every((i) => i.code === "missing")).toBe(true);
    expect(issues.some((i) => i.severity === "warning")).toBe(false);
  });
  it("the illustrative demo is complete and valid, with no emission factors", () => {
    const a = demo();
    expect(checkAssessment(a).filter((i) => i.severity === "error")).toEqual([]);
    expect(a.illustrative.some((id) => id.startsWith("env."))).toBe(false);
    expect(visibleFields(a).length).toBeGreaterThan(40);
  });
});
