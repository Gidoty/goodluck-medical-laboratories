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
    const ctx = await b.newContext({ viewport: vp, hasTouch: name === "mobile", acceptDownloads: true });
    await ctx.addInitScript(DISMISS);
    const pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
    pg.on("pageerror", (e) => errs.push(name + " pageerror: " + e.message));
    pg.on("console", (m) => { if (["error", "warning"].includes(m.type())) errs.push(name + " console." + m.type() + ": " + m.text()); });
    const no = () => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    const ls = (k) => pg.evaluate((k) => localStorage.getItem(k), k);
    // empty states
    await pg.goto(base + "/report"); await pg.getByText("No completed assessment is available to report.").waitFor(); ok(name + " empty report", true);
    await pg.goto(base + "/present"); await pg.getByText("No completed assessment is available to report.").waitFor(); ok(name + " empty presentation", true);
    // demo
    await pg.goto(base + "/assessment/business"); await pg.getByRole("button", { name: /Load Demo Assessment/ }).click();
    await pg.goto(base + "/assessment/review"); await pg.getByRole("button", { name: /Run Commercial Viability Assessment/ }).click(); await pg.waitForURL("**/results");
    await pg.getByText("Commercial viability against diesel").first().waitFor();
    const res = await pg.locator("main").innerText();
    ok(name + " results entry points", res.includes("View Professional Report") && res.includes("Presentation Mode"));
    ok(name + " evidence panel", res.includes("Evidence & Assumptions"));
    await pg.getByText("Evidence & Assumptions").first().click();
    const ev = await pg.locator("main").innerText();
    ok(name + " evidence content", /Provenance composition/.test(ev) && /not statistical confidence/.test(ev) && !/\d+\s?%\s?confiden/i.test(ev));
    const npvResults = (await pg.getByTestId("commercial-bev").innerText()).match(/NPV vs diesel\s*\n?\s*([^\n]+)/)?.[1]?.trim();
    const assessBefore = await ls("greenfleet-viability-lab:assessment");
    // report without analysis
    await pg.getByRole("link", { name: "View Professional Report" }).click(); await pg.waitForURL("**/report");
    await pg.getByRole("heading", { name: /Executive decision summary/ }).waitFor();
    let rep = await pg.locator("main").innerText();
    ok(name + " report no sensitivity yet", rep.includes("Sensitivity analysis has not been run for this assessment."));
    ok(name + " report thresholds not run", rep.includes("Threshold analysis has not been run for this assessment."));
    // run analysis on the sensitivity page then report
    await pg.goto(base + "/sensitivity"); await pg.getByText("Base Case: your current assessment").waitFor(); await pg.waitForTimeout(1500);
    await pg.goto(base + "/report"); await pg.getByRole("heading", { name: /Executive decision summary/ }).waitFor();
    rep = await pg.locator("main").innerText();
    ok(name + " report has sensitivity after run", rep.includes("under the tested ranges") && !rep.includes("Sensitivity analysis has not been run"));
    ok(name + " report identity", ["GreenFleet Viability Lab", "Commercial Viability Assessment", "Built by Group 8, MSc Class of 2025, CELTRAS", "GreenFleet Commercial Viability Policy v1.0", "Report version"].every((s) => rep.includes(s)));
    ok(name + " report disclaimer", rep.includes("should not be interpreted as financial, investment, engineering, regulatory or procurement advice"));
    ok(name + " report clean", clean(rep));
    ok(name + " report NPV matches results", !npvResults || rep.includes(npvResults), npvResults);
    ok(name + " report overflow", await no());
    ok(name + " Print / Save as PDF button", (await pg.getByRole("button", { name: "Print / Save as PDF" }).count()) === 1);
    ok(name + " no Download PDF label", !/Download PDF/.test(rep));
    await pg.screenshot({ path: `${S}/b7-${name}-report-top.png` });
    await pg.screenshot({ path: `${S}/b7-${name}-report-full.png`, fullPage: true });
    // options
    await pg.getByLabel("Methodology appendix").uncheck(); ok(name + " option hides methodology", !(await pg.locator("main").innerText()).includes("Methodology summary")); await pg.getByLabel("Methodology appendix").check();
    // exports
    await pg.locator("summary", { hasText: "Export" }).click();
    const [dl] = await Promise.all([pg.waitForEvent("download"), pg.getByRole("button", { name: /CSV: Technology comparison/ }).click()]);
    const fn = dl.suggestedFilename(); const csv = fs.readFileSync(await dl.path(), "utf8");
    ok(name + " csv filename", /^greenfleet-assessment-[a-z0-9-]+-comparison-\d{4}-\d{2}-\d{2}\.csv$/.test(fn), fn);
    ok(name + " csv content", csv.includes("metric,diesel,diesel_status") && !/NaN|Infinity/.test(csv));
    if (!(await pg.locator("details[open]").count())) await pg.locator("summary", { hasText: "Export" }).click();
    const [dj] = await Promise.all([pg.waitForEvent("download"), pg.getByRole("button", { name: /JSON: full assessment/ }).click()]);
    const js = JSON.parse(fs.readFileSync(await dj.path(), "utf8"));
    ok(name + " json export", js.exportType === "greenfleet-assessment" && js.policy.version === "1.0" && !!js.normalizedInput && !!js.commercial.bev && !!js.sensitivity);
    ok(name + " assessment untouched by report/exports", (await ls("greenfleet-viability-lab:assessment")) === assessBefore);
    if (name === "desktop") {
      // print preview
      await pg.emulateMedia({ media: "print" });
      const hidden = await pg.evaluate(() => { const vis = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).display !== "none" : false; }; return { aside: vis("aside"), toolbar: [...document.querySelectorAll("button")].some((x) => x.textContent.includes("Print / Save as PDF") && getComputedStyle(x).display !== "none" && x.offsetParent !== null), help: [...document.querySelectorAll("button")].some((x) => x.textContent.trim() === "Help" && x.offsetParent !== null) }; });
      ok("print hides sidebar, toolbar and Help", !hidden.aside && !hidden.toolbar && !hidden.help, JSON.stringify(hidden));
      ok("print keeps report", (await pg.getByRole("heading", { name: /Executive decision summary/ }).isVisible()) && (await pg.getByText("Built by Group 8").first().isVisible()));
      await pg.screenshot({ path: `${S}/b7-print-top.png` });
      await pg.pdf({ path: `${S}/b7-report.pdf`, format: "A4", printBackground: true });
      const size = fs.statSync(`${S}/b7-report.pdf`).size; const pages = (fs.readFileSync(`${S}/b7-report.pdf`, "latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
      ok("pdf generated", size > 20000, `${size} bytes, ${pages} pages`);
      await pg.emulateMedia({ media: "screen" });
    }
    // presentation
    await pg.goto(base + "/results"); await pg.getByText("Commercial viability against diesel").first().waitFor();
    await pg.getByRole("link", { name: "Presentation Mode" }).click(); await pg.waitForURL("**/present");
    await pg.getByText(/Screen 1 of/i).waitFor();
    const total = Number((await pg.getByText(/Screen 1 of/i).innerText()).match(/of (\d+)/i)[1]);
    ok(name + " presentation screens", total >= 8, total);
    ok(name + " presentation hides app chrome", (await pg.locator("aside").count()) === 0);
    await pg.keyboard.press("ArrowRight"); ok(name + " ArrowRight", /Screen 2 of/i.test(await pg.locator("main").innerText()));
    await pg.keyboard.press("ArrowLeft"); ok(name + " ArrowLeft", /Screen 1 of/i.test(await pg.locator("main").innerText()));
    await pg.getByRole("button", { name: /Next/ }).click(); ok(name + " Next button", /Screen 2 of/i.test(await pg.locator("main").innerText()));
    await pg.getByRole("button", { name: /Previous/ }).click(); ok(name + " Previous button", /Screen 1 of/i.test(await pg.locator("main").innerText()));
    let seen = "";
    for (let i = 1; i < total; i++) { await pg.keyboard.press("ArrowRight"); seen += "\n" + (await pg.locator("main").innerText()); if (i === 5) { ok(name + " commercial screen", /Commercial classification/.test(await pg.locator("main").innerText())); await pg.screenshot({ path: `${S}/b7-${name}-present-commercial.png` }); } ok(name + ` present screen ${i + 1} overflow`, await no()); }
    ok(name + " takeaways last", /Key decision takeaways/.test(await pg.locator("main").innerText()));
    ok(name + " presentation clean", clean(seen));
    ok(name + " presentation honest env", /Environmental comparison is unavailable|lower than diesel|higher than diesel/.test(seen));
    await pg.screenshot({ path: `${S}/b7-${name}-present-last.png` });
    await pg.keyboard.press("Escape"); await pg.waitForURL("**/results"); ok(name + " Escape exits", true);
    ok(name + " assessment untouched by presentation", (await ls("greenfleet-viability-lab:assessment")) === assessBefore);
    // help + methodology
    await pg.goto(base + "/report"); await pg.getByRole("heading", { name: /Executive decision summary/ }).waitFor();
    await pg.getByRole("button", { name: "Help", exact: true }).click();
    const d = pg.getByRole("dialog", { name: /Professional report/ }); await d.waitFor();
    ok(name + " report help", (await d.innerText()).includes("do not create new calculations")); await pg.keyboard.press("Escape");
    await pg.goto(base + "/methodology"); await pg.getByText("Reporting and evidence interpretation").click();
    const mt = await pg.locator("main").innerText();
    ok(name + " methodology reporting section", mt.includes("not statistical confidence") || mt.includes("must not be read as statistical confidence"));
    ok(name + " no stale coming-later text", !/added in a later development batch|coming later|not available yet/i.test(mt));
    ok(name + " methodology overflow", await no());
    // internal pages carry no Group 8
    for (const u of ["/overview", "/results", "/sensitivity", "/scenarios", "/methodology", "/assessment/business"]) { await pg.goto(base + u); await pg.waitForTimeout(300); ok(name + " no Group 8 on " + u, !(await pg.locator("body").innerText()).includes("Group 8")); }
    await pg.goto(base + "/"); ok(name + " Group 8 on home", (await pg.locator("body").innerText()).includes("Built by Group 8, MSc Class of 2025, CELTRAS"));
    await ctx.close();
  }
  console.log(log.join("\n")); console.log("ERRORS:", errs.length ? errs.join("\n") : "none");
  await b.close();
})();
