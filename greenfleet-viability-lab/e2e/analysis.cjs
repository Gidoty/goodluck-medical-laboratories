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
const clean = (t) => !/NaN|Infinity|undefined|\[object Object\]|\{cur\}/.test(t);
(async () => {
  const b = await launch();
  for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: name === "mobile" });
    await ctx.addInitScript(DISMISS);
    const pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
    pg.on("pageerror", (e) => errs.push(name + " pageerror: " + e.message));
    pg.on("console", (m) => { if (["error","warning"].includes(m.type())) errs.push(name + " console." + m.type() + ": " + m.text()); });
    const no = () => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    const ls = (k) => pg.evaluate((k) => localStorage.getItem(k), k);
    await pg.goto(base + "/overview"); await pg.keyboard.press("Escape");
    // gate with no assessment
    await pg.goto(base + "/sensitivity"); await pg.getByText("Run an assessment first").waitFor();
    ok(name + " sensitivity gate", true); ok(name + " gate overflow", await no());
    await pg.goto(base + "/scenarios"); await pg.getByText("Run an assessment first").waitFor(); ok(name + " scenarios gate", true);
    // demo -> run
    await pg.goto(base + "/assessment/business"); await pg.getByRole("button", { name: /Load Demo Assessment/ }).click();
    await pg.goto(base + "/assessment/review"); await pg.getByRole("button", { name: /Run Commercial Viability Assessment/ }).click(); await pg.waitForURL("**/results");
    await pg.getByText("Commercial viability against diesel").first().waitFor();
    const results = await pg.locator("main").innerText();
    ok(name + " results CTAs", /Explore What Would Make It Viable|View Viability Margin|See What Would Make It Fully Viable/.test(results));
    const assessmentBefore = await ls("greenfleet-viability-lab:assessment");
    // CTA -> sensitivity
    await pg.getByRole("link", { name: /Explore What Would Make It Viable|View Viability Margin|See What Would Make It Fully Viable/ }).first().click();
    await pg.waitForURL("**/sensitivity**");
    const t0 = Date.now();
    await pg.getByText("Base Case: your current assessment").waitFor();
    await pg.locator("#viability").waitFor();
    ok(name + " viability panel time ms", true, Date.now() - t0);
    let body = await pg.locator("main").innerText();
    ok(name + " base case card", body.includes("Base Case: your current assessment"));
    ok(name + " viability heading", /WHAT WOULD MAKE IT VIABLE\?|WHAT WOULD MAKE IT FULLY VIABLE\?|VIABILITY MARGIN/.test(body));
    ok(name + " clean text", clean(body));
    ok(name + " disclaimer", body.includes("not forecasts, quotations or investment guarantees"));
    ok(name + " overflow sens", await no());
    await pg.screenshot({ path: `${S}/b6-${name}-sens-top.png` });
    // biofuel tab
    await pg.getByLabel("Biofuel vs diesel").check({ force: true }); await pg.waitForTimeout(1200);
    body = await pg.locator("main").innerText();
    ok(name + " biofuel panel", /WHAT WOULD MAKE IT/.test(body) || /VIABILITY MARGIN/.test(body)); ok(name + " biofuel clean", clean(body));
    // threshold card + create scenario
    await pg.getByLabel("Battery electric vs diesel").check({ force: true }); await pg.waitForTimeout(1200);
    const btn = pg.getByRole("button", { name: "Create Scenario at This Threshold" }).first();
    if (await btn.count()) { await btn.click(); ok(name + " scenario created from threshold", await pg.getByText("Scenario created").first().isVisible()); } else ok(name + " no scenario button (viable margin w/o value)", false);
    // one-way
    await pg.getByRole("button", { name: "Run sensitivity" }).click(); await pg.waitForTimeout(600);
    ok(name + " one-way chart", (await pg.locator("#one-way .recharts-surface").count()) >= 1);
    ok(name + " one-way table", (await pg.getByRole("table").first().count()) >= 1);
    ok(name + " overflow one-way", await no());
    // custom range invalid then valid
    await pg.locator("#one-way").getByLabel("Custom").check({ force: true });
    await pg.locator("#one-way").getByLabel(/Minimum/).fill("-150"); await pg.getByRole("button", { name: "Run sensitivity" }).click();
    ok(name + " invalid range rejected", /cannot use|negative/.test(await pg.locator("#one-way").innerText()));
    await pg.locator("#one-way").getByLabel(/Minimum/).fill("-30"); await pg.locator("#one-way").getByLabel(/Maximum/).fill("30"); await pg.locator("#one-way").getByLabel(/Steps/).fill("7");
    await pg.getByRole("button", { name: "Run sensitivity" }).click(); await pg.waitForTimeout(400);
    ok(name + " custom range ran", (await pg.locator("#one-way tbody tr").count()) === 7, await pg.locator("#one-way tbody tr").count());
    // drivers & two-way
    ok(name + " drivers chart", (await pg.locator("#drivers .recharts-surface").count()) >= 1);
    await pg.getByRole("button", { name: /Run grid/ }).click(); await pg.waitForTimeout(800);
    ok(name + " two-way grid", (await pg.locator("#two-way tbody tr").count()) >= 5);
    ok(name + " frontier label", (await pg.locator("#two-way").innerText()).includes("Economic break-even frontier"));
    ok(name + " overflow after all", await no());
    await pg.screenshot({ path: `${S}/b6-${name}-sens-full.png`, fullPage: true });
    ok(name + " assessment untouched", (await ls("greenfleet-viability-lab:assessment")) === assessmentBefore);
    // scenarios page
    await pg.goto(base + "/scenarios"); await pg.getByText("Comparison with the Base Case").waitFor();
    ok(name + " threshold scenario listed", (await pg.getByTestId("scenario-item").count()) >= 1);
    ok(name + " USER/threshold badge", /FROM A THRESHOLD/.test(await pg.locator("main").innerText()));
    // build a scenario
    await pg.getByLabel("Name", { exact: true }).fill("Higher diesel price");
    await pg.locator("#builder select").first().selectOption({ label: "Diesel price" });
    await pg.locator("#builder").getByLabel(/New value/).first().fill("2500");
    await pg.getByRole("button", { name: "Save and run scenario" }).click(); await pg.waitForTimeout(600);
    ok(name + " scenario saved", (await pg.getByTestId("scenario-item").count()) >= 2);
    body = await pg.locator("main").innerText();
    ok(name + " changed from base", body.toLowerCase().includes("changed from base case"));
    ok(name + " comparison rows", ["Incremental NPV vs diesel", "Total cost of ownership", "Commercial classification", "Operational status"].every((s) => body.includes(s)));
    ok(name + " scenarios clean", clean(body)); ok(name + " scenarios overflow", await no());
    // invalid override
    await pg.getByLabel("Name", { exact: true }).fill("Bad"); await pg.locator("#builder").getByLabel(/New value/).first().fill("-5");
    await pg.locator("#builder select").first().selectOption({ label: "Diesel price" }); await pg.locator("#builder").getByLabel(/New value/).first().fill("-5");
    await pg.getByRole("button", { name: "Save and run scenario" }).click();
    ok(name + " invalid override message", await pg.getByRole("alert").first().isVisible());
    // duplicate + persistence
    await pg.getByRole("button", { name: /Duplicate/ }).first().click();
    const countBefore = await pg.getByTestId("scenario-item").count();
    await pg.reload(); await pg.getByText("Comparison with the Base Case").waitFor();
    ok(name + " scenarios persist", (await pg.getByTestId("scenario-item").count()) === countBefore, countBefore);
    ok(name + " base unchanged after scenario work", (await ls("greenfleet-viability-lab:assessment")) === assessmentBefore);
    await pg.screenshot({ path: `${S}/b6-${name}-scen.png`, fullPage: true });
    // help
    await pg.getByRole("button", { name: "Help", exact: true }).click();
    const d = pg.getByRole("dialog", { name: /Scenarios/ }); await d.waitFor();
    ok(name + " scenarios help active", (await d.innerText()).includes("without changing your Base Case") && !/not available yet/.test(await d.innerText()));
    await pg.keyboard.press("Escape");
    await pg.goto(base + "/sensitivity"); await pg.getByText("Base Case: your current assessment").waitFor();
    await pg.getByRole("button", { name: "How thresholds work" }).click();
    const t = pg.getByRole("dialog", { name: /What would make it viable/ }); await t.waitFor();
    ok(name + " thresholds help", (await t.innerText()).includes("all else equal") || (await t.innerText()).toLowerCase().includes("all else equal"));
    await pg.keyboard.press("Escape");
    // methodology
    await pg.goto(base + "/methodology");
    for (const s of ["Sensitivity analysis methodology", "Scenario analysis methodology", "Threshold and inverse decision analysis"]) await pg.getByText(s).click();
    const m = await pg.locator("main").innerText();
    ok(name + " methodology sections", m.includes("bisect") && m.includes("Solver bounds") && m.includes("1e-10"));
    ok(name + " method overflow", await no());
    await ctx.close();
  }
  console.log(log.join("\n")); console.log("ERRORS:", errs.length ? errs.join("\n") : "none");
  await b.close();
})();
