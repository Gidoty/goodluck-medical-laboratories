import { describe, expect, it } from "vitest";
import { missing, notApplicable, parseNumericInput, value } from "./fieldValue";
import { rules, validateCurrency, validateNumeric } from "./validation";

const check = (field: Parameters<typeof validateNumeric>[1], rule: Parameters<typeof validateNumeric>[2]) =>
  validateNumeric("f", field, rule, "NGN");

describe("zero, missing and not applicable are different", () => {
  it("accepts 0 for a cost", () => {
    expect(check(value(0), rules.money("Cost"))).toEqual([]);
  });
  it("rejects missing for a required cost, with a message that mentions 0", () => {
    const [issue] = check(missing(), rules.money("Cost"));
    expect(issue?.code).toBe("missing");
    expect(issue?.message).toMatch(/0/);
  });
  it("allows missing on an optional field", () => {
    expect(check(missing(), rules.money("Cost", "money", false))).toEqual([]);
  });
  it("only allows not-applicable where the rule says so", () => {
    expect(check(notApplicable(), rules.money("Cost"))[0]?.code).toBe("not_applicable_not_allowed");
    expect(check(notApplicable(), { ...rules.money("Cost"), allowNotApplicable: true })).toEqual([]);
  });
});

describe("impossible values", () => {
  it("rejects negative money", () => {
    const [issue] = check(value(-1), rules.money("Vehicle price"));
    expect(issue?.code).toBe("below_min");
    expect(issue?.message).toBe("Vehicle price cannot be negative.");
  });
  it("rejects zero and negative distance", () => {
    expect(check(value(0), rules.distance("Daily distance", "km_per_day"))[0]?.code).toBe("below_min");
    expect(check(value(-5), rules.distance("Daily distance", "km_per_day"))[0]?.code).toBe("below_min");
    expect(check(value(120), rules.distance("Daily distance", "km_per_day"))).toEqual([]);
  });
  it("rejects a zero-year lifetime and fractional years", () => {
    expect(check(value(0), rules.lifetimeYears("Lifetime"))[0]?.message).toContain("greater than 0");
    expect(check(value(7.5), rules.lifetimeYears("Lifetime"))[0]?.code).toBe("not_integer");
    expect(check(value(8), rules.lifetimeYears("Lifetime"))).toEqual([]);
  });
  it("keeps percentages in 0..100 and accepts both ends", () => {
    const rule = rules.percentage("Residual value");
    expect(check(value(0), rule)).toEqual([]);
    expect(check(value(100), rule)).toEqual([]);
    expect(check(value(-1), rule)[0]?.code).toBe("below_min");
    expect(check(value(101), rule)[0]?.code).toBe("above_max");
  });
  it("rejects zero efficiency but only warns about implausibly high values", () => {
    const rule = rules.efficiency("Fuel consumption", "litres_per_100km", 100);
    expect(check(value(0), rule)[0]?.severity).toBe("error");
    const [warning] = check(value(250), rule);
    expect(warning?.code).toBe("implausible");
    expect(warning?.severity).toBe("warning");
    expect(check(value(20), rule)).toEqual([]);
  });
  it("rejects non-finite numbers", () => {
    expect(check(value(Number.NaN), rules.money("Cost"))[0]?.code).toBe("not_a_number");
    expect(check(value(Number.POSITIVE_INFINITY), rules.money("Cost"))[0]?.code).toBe("not_a_number");
  });
});

describe("validateCurrency", () => {
  it("accepts supported codes and rejects the rest", () => {
    expect(validateCurrency("currency", "NGN")).toEqual([]);
    expect(validateCurrency("currency", "XXX")[0]?.code).toBe("invalid_currency");
    expect(validateCurrency("currency", undefined)[0]?.code).toBe("invalid_currency");
  });
});

describe("parseNumericInput", () => {
  it("treats empty text as missing and 0 as a value", () => {
    expect(parseNumericInput("")).toEqual(missing());
    expect(parseNumericInput("   ")).toEqual(missing());
    expect(parseNumericInput("0")).toEqual(value(0));
    expect(parseNumericInput("0.0")).toEqual(value(0));
  });
  it("parses numbers and flags junk", () => {
    expect(parseNumericInput("12.5")).toEqual(value(12.5));
    expect(parseNumericInput("-3")).toEqual(value(-3));
    expect(parseNumericInput("1e3")).toEqual(value(1000));
    expect(parseNumericInput("12,5").status).toBe("invalid");
    expect(parseNumericInput("abc").status).toBe("invalid");
    expect(parseNumericInput("₦100").status).toBe("invalid");
  });
});
