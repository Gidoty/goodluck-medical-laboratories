import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { CURRENCIES } from "@/lib/currency";
import { UNITS, unitLabel } from "@/lib/units";
import { DISCLAIMER } from "@/guidance/content";
import { PROTOTYPE_VERSION, REPORT_DISCLAIMER } from "@/reporting/identity";
import { COMMERCIAL_VIABILITY_POLICY_V1 } from "@/calculation/viability";

/**
 * Source-level audits: network and security, unsupported claims, dependencies, units and version identifiers.
 * They read the shipped source (tests and validation fixtures excluded), so they catch regressions in wording.
 */

const SRC = join(process.cwd(), "src");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const isShipped = (f: string) => /\.(ts|tsx|css|svg)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f) && !f.includes("/validation/") && !f.endsWith("/test/helpers.ts") && !f.endsWith("/calculation/fixtures.ts");
const FILES = walk(SRC).filter(isShipped);
const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => relative(process.cwd(), f);
const lines = FILES.flatMap((f) => read(f).split("\n").map((text, i) => ({ file: rel(f), n: i + 1, text })));

describe("Security and network audit (the prototype sends nothing anywhere)", () => {
  const FORBIDDEN: [string, RegExp][] = [
    ["fetch()", /\bfetch\s*\(/],
    ["XMLHttpRequest", /XMLHttpRequest/],
    ["sendBeacon", /sendBeacon/],
    ["WebSocket", /\bWebSocket\b/],
    ["EventSource", /\bEventSource\b/],
    ["dangerouslySetInnerHTML", /dangerouslySetInnerHTML/],
    ["innerHTML", /\.innerHTML\b/],
    ["eval()", /\beval\s*\(/],
    ["new Function", /new Function\s*\(/],
    ["document.write", /document\.write/],
    ["cookies", /document\.cookie/],
    ["window.open", /window\.open/],
    ["postMessage", /postMessage/],
    ["indexedDB", /indexedDB/],
    ["importScripts / workers", /new (Shared)?Worker\s*\(|importScripts/],
    ["analytics SDKs", /\bgtag\s*\(|google-analytics|googletagmanager|@segment|analytics-node|mixpanel-browser|plausible-tracker|posthog-js|@sentry|hotjar|@vercel\/analytics|@vercel\/speed-insights/i],
    ["AI SDKs", /@anthropic-ai|openai|\bgenerateText\b|\bchat\.completions\b/i],
    ["secrets", /api[_-]?key|secret|password|bearer\s|authorization:/i],
  ];
  it.each(FORBIDDEN)("no %s anywhere in shipped source", (_name, re) => {
    const hits = lines.filter((l) => re.test(l.text)).map((l) => `${l.file}:${l.n}`);
    expect(hits).toEqual([]);
  });
  it("the only absolute URLs are the SVG namespace", () => {
    const hits = lines.filter((l) => /https?:\/\//.test(l.text) && !/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(l.text)).map((l) => `${l.file}:${l.n}: ${l.text.trim().slice(0, 100)}`);
    expect(hits).toEqual([]);
  });
  it("no remote fonts, scripts, images or stylesheets are referenced", () => {
    const hits = lines.filter((l) => /next\/font\/google|fonts\.googleapis|<script|<link\b|<img\b|@import\s+url|src=\{?["']https?:/.test(l.text)).map((l) => `${l.file}:${l.n}`);
    expect(hits).toEqual([]);
  });
  it("environment variables are not read, apart from the development-mode check", () => {
    const hits = lines.filter((l) => /process\.env\.(?!NODE_ENV)/.test(l.text) || /import\.meta\.env/.test(l.text)).map((l) => `${l.file}:${l.n}`);
    expect(hits).toEqual([]);
  });
  it("browser storage is touched only by the four persistence modules", () => {
    const users = [...new Set(lines.filter((l) => /localStorage|sessionStorage/.test(l.text) && !/^\s*(\/\/|\*|\/\*)/.test(l.text)).map((l) => l.file))].sort();
    expect(users).toEqual(["src/calculation/scenario/storage.ts", "src/guidance/onboardingStore.ts", "src/reporting/analysisRecord.ts", "src/state/repository.ts"]);
  });
  it("all user-controlled text is rendered through React (escaped), never as markup", () => {
    expect(lines.filter((l) => /dangerouslySetInnerHTML|\.outerHTML|insertAdjacentHTML/.test(l.text))).toEqual([]);
  });
  it("there are no debug logs or leftover TODO / FIXME markers", () => {
    expect(lines.filter((l) => /console\.(log|debug|info|trace)\b/.test(l.text)).map((l) => `${l.file}:${l.n}`)).toEqual([]);
    expect(lines.filter((l) => /\b(TODO|FIXME|XXX|HACK)\b/.test(l.text)).map((l) => `${l.file}:${l.n}`)).toEqual([]);
  });
  it("downloads are built in the browser from a Blob, with no server round trip", () => {
    const d = read(join(SRC, "reporting/download.ts"));
    expect(d).toMatch(/new Blob/);
    expect(d).toMatch(/URL\.createObjectURL/);
    expect(d).not.toMatch(/fetch|XMLHttpRequest/);
  });
});

describe("Dependency review", () => {
  const runtime = Object.keys(pkg.dependencies).sort();
  it("runtime dependencies are exactly the seven the prototype needs", () => {
    expect(runtime).toEqual(["clsx", "lucide-react", "next", "react", "react-dom", "recharts", "tailwind-merge"]);
  });
  it("every runtime dependency is imported by the source (nothing unnecessary remains)", () => {
    const imports = FILES.map(read).join("\n");
    for (const d of runtime) {
      if (d === "react-dom" || d === "react") continue; // used implicitly by Next's JSX runtime
      if (d === "next") expect(imports).toMatch(/from "next\//);
      else expect(imports, d).toContain(`from "${d}"`);
    }
  });
  it("every direct dependency has a permissive licence", () => {
    const allowed = new Set(["MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause"]);
    for (const name of [...runtime, ...Object.keys(pkg.devDependencies)]) {
      const meta = JSON.parse(readFileSync(join(process.cwd(), "node_modules", name, "package.json"), "utf8")) as { license?: string };
      expect(allowed.has(meta.license ?? ""), `${name}: ${meta.license}`).toBe(true);
    }
  });
  it("the package is private and carries the frozen version", () => {
    expect((pkg as { private?: boolean }).private).toBe(true);
    expect(pkg.version).toBe("1.0.0");
  });
});

describe("Unsupported-claim audit of user-facing text", () => {
  /** A line that mentions one of these is acceptable only if the same line also negates it ("not a forecast", "does not guarantee"). */
  const CLAIMS = /\b(optimal|optimum|optimi[sz]\w*|guarantee[sd]?|profitable|profitability|zero[- ]emissions?|carbon[- ]neutral\w*|net[- ]zero|high confidence|medium confidence|low confidence|accurate(ly)? predict\w*|prediction|predicts?|forecasts?|recommend(ed|ation|ations)?|investment advice|proven|definitely|will (save|pay|be viable|break even)|full life.?cycle|life.?cycle emissions?)\b/i;
  const NEGATION = /\b(not|no|none|nothing|never|nor|neither|without|cannot|can't|doesn't|does not|do not|isn't|aren't|rather than|instead of)\b/i;
  // Words that are legitimate label text for an input (a user declares what an emission factor covers), not a claim by GreenFleet.
  const OK_LABEL = /Full lifecycle \(including vehicles and equipment\)|Lifecycle emissions \(as declared for the factor\)/;
  const comment = (t: string) => /^\s*(\/\/|\*|\/\*)/.test(t);

  it("no line makes a claim without negating it", () => {
    const offenders = lines.filter((l) => !comment(l.text) && CLAIMS.test(l.text) && !NEGATION.test(l.text) && !OK_LABEL.test(l.text)).map((l) => `${l.file}:${l.n}: ${l.text.trim().slice(0, 120)}`);
    expect(offenders).toEqual([]);
  });
  it("report, presentation and result strings never call results profitable, zero-emission, carbon-neutral or a purchase recommendation (a negated disclosure such as 'does not mean zero emissions' is allowed)", () => {
    const surfaces = FILES.filter((f) => /reporting\/|components\/(report|present|results)\//.test(f));
    const strict = /\b(profitable|zero[- ]emissions?|carbon[- ]neutral\w*|purchase recommendation|buy (this|the)|you should (buy|purchase|invest))\b/i;
    const hits = surfaces.flatMap((f) => read(f).split("\n").map((t, i) => ({ f, t, i })).filter(({ t }) => strict.test(t) && !comment(t) && !NEGATION.test(t))).map(({ f, i }) => `${rel(f)}:${i + 1}`);
    expect(hits).toEqual([]);
  });
  it("emissions are always described as estimated operational energy/fuel-related emissions", () => {
    const all = FILES.map(read).join("\n");
    expect(all).toMatch(/Estimated operational energy\/fuel-related greenhouse-gas emissions/);
    expect(all).toMatch(/not a life-cycle assessment/i);
    expect(read(join(SRC, "calculation/environmental/index.ts"))).toMatch(/SCOPE_STATEMENT/);
  });
  it("the Methodology page states the financing boundary and the project/asset perspective", () => {
    const m = read(join(SRC, "app/(app)/methodology/page.tsx"));
    expect(m).toMatch(/asset|project/i);
    expect(m).toMatch(/financ/i);
    expect(m).toMatch(/not (used|part)|excluded|independent/i);
  });
  it("viability language is conditional ('under the entered assumptions'), not absolute", () => {
    const text = read(join(SRC, "calculation/viability/classify.ts")) + read(join(SRC, "reporting/executive.ts"));
    expect(text).toMatch(/Under the entered assumptions|under the entered assumptions/);
  });
});

describe("Version identifiers are separate and consistent", () => {
  it("the prototype version is not the policy version", () => {
    expect(PROTOTYPE_VERSION).toBe("GreenFleet MSc Prototype v1.0");
    expect(COMMERCIAL_VIABILITY_POLICY_V1.id).toBe("GreenFleet Commercial Viability Policy v1.0");
    expect(PROTOTYPE_VERSION).not.toBe(COMMERCIAL_VIABILITY_POLICY_V1.id);
  });
  it("Help and the report share the single core disclaimer, word for word", () => {
    expect(DISCLAIMER).toBe(REPORT_DISCLAIMER);
    expect(REPORT_DISCLAIMER).toBe("GreenFleet is an academic decision-support prototype. Results are model-derived estimates based on the entered assumptions and should not be interpreted as financial, investment, engineering, regulatory or procurement advice.");
  });
});

describe("Currency and unit audit", () => {
  it("NGN is the default currency and the list is extensible (a table, not a hard-coded symbol)", () => {
    expect(Object.keys(CURRENCIES)).toContain("NGN");
    expect(CURRENCIES.NGN.symbol).toBe("₦");
    expect(Object.keys(CURRENCIES).length).toBeGreaterThanOrEqual(2);
  });
  it("no engine or reporting source hard-codes the naira symbol (it comes from the currency table)", () => {
    const hits = lines.filter((l) => l.text.includes("₦") && /calculation\/|reporting\//.test(l.file) && !/^\s*(\/\/|\*|\/\*)/.test(l.text)).map((l) => `${l.file}:${l.n}`);
    expect(hits).toEqual([]);
  });
  it("every unit that people see has a label with the unit written out", () => {
    const required = ["km", "km_per_day", "days_per_year", "years", "percent", "kg", "kwh", "kwh_per_100km", "litres_per_100km", "money_per_litre", "money_per_kwh"];
    for (const id of required) {
      expect(Object.keys(UNITS), id).toContain(id);
      const label = unitLabel(id as keyof typeof UNITS, "NGN");
      expect(label.length, id).toBeGreaterThan(0);
    }
    expect(unitLabel("km_per_day", "NGN")).toMatch(/km\/day/);
    expect(unitLabel("kwh_per_100km", "NGN")).toMatch(/kWh\/100 km/);
    expect(unitLabel("money_per_litre", "NGN")).toMatch(/₦.*litre/);
    expect(unitLabel("percent", "NGN")).toBe("%");
  });
  it("emissions are stated in kg CO2e and t CO2e, per km as kg CO2e/km", () => {
    const all = FILES.map(read).join("\n");
    expect(all).toMatch(/kg CO2e\/km/);
    expect(all).toMatch(/tCO2e/);
  });
});
