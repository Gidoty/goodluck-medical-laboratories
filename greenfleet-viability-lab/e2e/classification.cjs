// End-to-end browser check. Run against a running app:  npm run build && npx next start -p 3100
// Environment: BASE_URL (default http://localhost:3100), PLAYWRIGHT_MODULE (default "playwright"),
// CHROMIUM (path to a Chromium executable, optional), SHOT_DIR (screenshots, default ./e2e/out).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.BASE_URL || "http://localhost:3100";
const S = process.env.SHOT_DIR || "./e2e/out";
const fs = require("fs");
fs.mkdirSync(S, { recursive: true });
const launch = () => chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
// Deterministic start-up: mark the welcome dialog as already dismissed, except in the guidance test that exercises it.
const DISMISS = () => { try { if (!localStorage.getItem("greenfleet-viability-lab:onboarding")) localStorage.setItem("greenfleet-viability-lab:onboarding", JSON.stringify({ version: 1, status: "dismissed", at: "e2e" })); } catch {} };
const log = [], errs = [];
const ok = (n, c, x) => log.push((c ? "PASS " : "FAIL ") + n + (x !== undefined ? " :: " + x : ""));
const labels = (t) => (t.match(/NOT YET VIABLE|CONDITIONALLY VIABLE|INSUFFICIENT EVIDENCE|\bVIABLE\b/g) || []);
(async () => {
  const b = await launch();
  for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const ctx = await b.newContext({ viewport: vp });
    await ctx.addInitScript(DISMISS);
    const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
    pg.on("pageerror", (e) => errs.push(name + " pageerror: " + e.message));
    pg.on("console", (m) => { if (["error","warning"].includes(m.type())) errs.push(name + " console." + m.type() + ": " + m.text()); });
    await pg.goto(base + "/"); const home = await pg.locator("body").innerText();
    ok(name + " home credit", home.includes("GreenFleet — Built by Group 8, MSc Class of 2025, CELTRAS"));
    await pg.goto(base + "/assessment/business");
    await pg.getByRole("button", { name: /Load Demo Assessment/ }).click();
    await pg.goto(base + "/assessment/review");
    await pg.getByRole("button", { name: /Run Commercial Viability Assessment/ }).click();
    await pg.waitForURL("**/results");
    await pg.getByText("Commercial viability against diesel").first().waitFor();
    const body = await pg.locator("main").innerText();
    const l1 = labels(body);
    ok(name + " labels shown", l1.length >= 2, JSON.stringify(l1));
    ok(name + " pending text gone", !body.includes("pending multi-factor"));
    ok(name + " clean", !/NaN|Infinity|undefined|\[object Object\]|\{cur\}/.test(body));
    ok(name + " no group8 on results", !body.includes("Group 8"));
    ok(name + " baseline", body.includes("Baseline"));
    ok(name + " policy", body.includes("GreenFleet Commercial Viability Policy v1.0"));
    ok(name + " no overflow", await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    const hc = await pg.locator("[data-testid=commercial-bev]").innerText(); const hb = await pg.locator("[data-testid=commercial-biofuel]").innerText();
    console.log(name, "BEV:", hc.replace(/\n+/g, " | ").slice(0, 400)); console.log(name, "BIO:", hb.replace(/\n+/g, " | ").slice(0, 400));
    await pg.locator("summary", { hasText: "Why this result? Battery electric" }).click();
    ok(name + " why panel", (await pg.locator("main").innerText()).includes("Decision trace"));
    await pg.screenshot({ path: `${S}/b5-${name}-top.png` });
    await pg.screenshot({ path: `${S}/b5-${name}-full.png`, fullPage: true });
    // emission factors via CTA: label must not change
    const before = labels(await pg.locator("[data-testid=commercial-bev]").innerText()).join();
    const beforeB = labels(hb).join();
    await pg.getByRole("link", { name: "Add Emission Factors" }).click(); await pg.waitForURL("**/assessment/finance**"); await pg.waitForTimeout(800);
    for (const [l, v] of [["Diesel emission factor","2.7"],["Grid electricity emission factor","0.4"],["Biofuel emission factor","2.2"]]) { const el = pg.getByLabel(l).first(); await el.fill(v); await el.blur(); }
    await pg.goto(base + "/results"); await pg.getByText("Commercial viability against diesel").first().waitFor();
    const after = labels(await pg.locator("[data-testid=commercial-bev]").innerText()).join();
    const afterB = labels(await pg.locator("[data-testid=commercial-biofuel]").innerText()).join();
    ok(name + " emission factors do not change labels", before === after && beforeB === afterB, `${before} / ${after}; ${beforeB} / ${afterB}`);
    ok(name + " env text now numeric", /% (lower|higher) than diesel/.test(await pg.locator("main").innerText()));
    // change the range to force an operational change -> label may change
    await pg.goto(base + "/assessment/electric");
    const rng = pg.getByLabel("Usable driving range per full charge"); await rng.fill("20"); await rng.blur();
    await pg.goto(base + "/results"); await pg.getByText("Commercial viability against diesel").first().waitFor();
    const l3 = await pg.locator("[data-testid=commercial-bev]").innerText();
    console.log(name, "BEV range 20:", l3.replace(/\n+/g, " | ").slice(0, 300));
    ok(name + " operational change alters BEV card", labels(l3).join() !== before);
    ok(name + " overflow after", await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await pg.screenshot({ path: `${S}/b5-${name}-nyv.png`, fullPage: false });
    await pg.goto(base + "/methodology");
    const m = await pg.locator("main").innerText();
    ok(name + " methodology policy", m.includes("Commercial viability policy v1.0") && m.includes("Prototype near-break-even tolerance: ±5%"));
    ok(name + " method overflow", await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await pg.goto(base + "/assessment/business"); ok(name + " assessment overflow", await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await ctx.close();
  }
  console.log(log.join("\n")); console.log("ERRORS:", errs.length ? errs.join("\n") : "none");
  await b.close();
})();
