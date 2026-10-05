// End-to-end browser check. Run against a running app:  npm run build && npx next start -p 3100
// Environment: BASE_URL (default http://localhost:3100), PLAYWRIGHT_MODULE (default "playwright"),
// CHROMIUM (path to a Chromium executable, optional), SHOT_DIR (screenshots, default ./e2e/out).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.BASE_URL || "http://localhost:3100";
const S = process.env.SHOT_DIR || "./e2e/out";
const fs = require("fs");
fs.mkdirSync(S, { recursive: true });
const launch = () => chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const log = [], errs = [];
const ok = (n, c, x) => log.push((c ? "PASS " : "FAIL ") + n + (x !== undefined ? " :: " + x : ""));
const noOverflow = (pg) => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
(async () => {
  const b = await launch();
  for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: name === "mobile" });
    const pg = await ctx.newPage(); pg.setDefaultTimeout(8000);
    pg.on("pageerror", (e) => errs.push(name + " pageerror: " + e.message));
    pg.on("console", (m) => { if (["error","warning"].includes(m.type())) errs.push(name + " console." + m.type() + ": " + m.text()); });
    const ls = (k) => pg.evaluate((k) => localStorage.getItem(k), k);
    // landing: no auto welcome, Help works, credit stays
    await pg.goto(base + "/");
    ok(name + " landing no auto-welcome", (await pg.getByRole("dialog").count()) === 0);
    ok(name + " landing credit", (await pg.locator("body").innerText()).includes("Built by Group 8, MSc Class of 2025, CELTRAS"));
    await pg.getByRole("button", { name: "Help", exact: true }).first().click();
    ok(name + " landing help opens", await pg.getByRole("dialog", { name: /Welcome to GreenFleet/ }).isVisible());
    await pg.keyboard.press("Escape");
    // first visit in workspace
    await pg.goto(base + "/overview");
    const welcome = pg.getByRole("dialog", { name: "Welcome to GreenFleet" });
    await welcome.waitFor();
    ok(name + " welcome shown on first visit", await welcome.isVisible());
    const wtxt = await welcome.innerText();
    ok(name + " welcome content", ["Describe Your Fleet","Enter Technology Assumptions","Run the Assessment","Compare Commercial Viability","Start Assessment","Take a Quick Tour","Skip for now"].every((t) => wtxt.includes(t)));
    ok(name + " welcome fits", await welcome.evaluate((d) => d.getBoundingClientRect().right <= window.innerWidth + 1));
    await pg.screenshot({ path: `${S}/b51-${name}-welcome.png` });
    await pg.keyboard.press("Escape");
    await pg.waitForTimeout(300);
    ok(name + " Escape closes welcome", !(await welcome.isVisible()));
    await pg.waitForTimeout(300);
    ok(name + " dismissed saved", /dismissed/.test((await ls("greenfleet-viability-lab:onboarding")) || ""));
    await pg.reload(); await pg.waitForTimeout(600);
    ok(name + " does not reopen", !(await welcome.isVisible()));
    // demo data then tour must not alter it
    await pg.goto(base + "/assessment/business"); await pg.getByRole("button", { name: /Load Demo Assessment/ }).click(); await pg.waitForTimeout(400);
    const before = await ls("greenfleet-viability-lab:assessment");
    ok(name + " demo saved", !!before);
    // help -> restart tour
    await pg.getByRole("button", { name: "Help", exact: true }).click();
    const help = pg.getByRole("dialog", { name: /Step 1: Business & Fleet/ }); await help.waitFor();
    ok(name + " help contextual (business)", await help.isVisible());
    ok(name + " help no overflow", await noOverflow(pg));
    ok(name + " help fits", await help.evaluate((d) => { const r = d.getBoundingClientRect(); return r.left >= -1 && r.right <= window.innerWidth + 1; }));
    ok(name + " disclaimer", (await help.innerText()).includes("academic decision-support prototype"));
    await pg.screenshot({ path: `${S}/b51-${name}-help.png` });
    await pg.getByRole("button", { name: "Restart Quick Tour" }).click();
    const tour = pg.getByRole("dialog", { name: "Overview" }); await tour.waitFor();
    ok(name + " tour step 1/7", (await tour.innerText()).toLowerCase().includes("step 1 of 7"));
    for (let i = 0; i < 6; i++) await pg.getByRole("button", { name: "Next" }).click();
    ok(name + " tour last step upcoming", (await pg.getByRole("dialog").innerText()).includes("changes one assumption at a time"));
    await pg.screenshot({ path: `${S}/b51-${name}-tour.png` });
    await pg.getByRole("button", { name: "Finish" }).click();
    ok(name + " completed saved", /completed/.test((await ls("greenfleet-viability-lab:onboarding")) || ""));
    ok(name + " assessment untouched by tour", (await ls("greenfleet-viability-lab:assessment")) === before);
    // skip tour path
    await pg.getByRole("button", { name: "Help", exact: true }).click(); await pg.getByRole("button", { name: "Restart Quick Tour" }).click();
    await pg.getByRole("button", { name: "Skip tour" }).click();
    ok(name + " skipped saved", /skipped/.test((await ls("greenfleet-viability-lab:onboarding")) || ""));
    // every page: Help opens page guidance, Escape closes, focus returns
    const pages = [["/overview", /Welcome to GreenFleet/], ["/assessment/business", /Step 1/], ["/assessment/diesel", /Step 2: Diesel/], ["/assessment/electric", /Step 3: Battery/], ["/assessment/biofuel", /Step 4: Biofuel/], ["/assessment/finance", /Step 5/], ["/assessment/review", /Step 6/], ["/results", /How to interpret your results/], ["/methodology", /Methodology/], ["/sensitivity", /Sensitivity analysis/], ["/scenarios", /Scenarios/]];
    for (const [url, re] of pages) {
      await pg.goto(base + url); await pg.waitForTimeout(300);
      const btn = pg.getByRole("button", { name: "Help", exact: true });
      await btn.focus(); await pg.keyboard.press("Enter");
      const d = pg.getByRole("dialog", { name: re }); await d.waitFor();
      ok(name + " help " + url, await d.isVisible());
      ok(name + " " + url + " overflow while open", await noOverflow(pg));
      await pg.keyboard.press("Escape");
      ok(name + " " + url + " Escape closes", !(await d.isVisible()));
      ok(name + " " + url + " focus returns", await pg.evaluate(() => document.activeElement && /Help/.test(document.activeElement.textContent || "")));
      ok(name + " " + url + " page overflow", await noOverflow(pg));
    }
    // sensitivity page text
    await pg.goto(base + "/sensitivity"); await pg.getByRole("button", { name: "Help", exact: true }).click();
    ok(name + " sensitivity help describes the working tool", (await pg.getByRole("dialog").innerText()).includes("changes one assumption at a time"));
    await pg.keyboard.press("Escape");
    // field help: keyboard + tap
    await pg.goto(base + "/assessment/electric"); await pg.waitForTimeout(400);
    const tip = pg.getByRole("button", { name: "What is Usable range?" });
    await tip.focus(); await pg.keyboard.press("Enter");
    ok(name + " field tip opens by keyboard", await pg.getByRole("tooltip").isVisible());
    ok(name + " tip fits viewport", await pg.getByRole("tooltip").evaluate((t) => { const r = t.getBoundingClientRect(); return r.left >= -1 && r.right <= window.innerWidth + 1; }));
    await pg.screenshot({ path: `${S}/b51-${name}-tip.png` });
    await pg.keyboard.press("Escape");
    ok(name + " tip closes with Escape", (await pg.getByRole("tooltip").count()) === 0);
    const box = await tip.boundingBox(); ok(name + " tip target >= 28px", box.width >= 28 && box.height >= 28, JSON.stringify(box));
    // step guidance note
    ok(name + " step note", (await pg.getByTestId("step-guidance").innerText()).includes("Next: Next, you will configure the biofuel alternative."));
    // results (demo) section helps + empty state
    await pg.goto(base + "/assessment/review"); await pg.getByRole("button", { name: /Run Commercial Viability Assessment/ }).click(); await pg.waitForURL("**/results");
    await pg.getByText("Commercial viability against diesel").first().waitFor();
    for (const [lab, re] of [["What the four labels mean", /Commercial viability/], ["How to read the decision trace", /Why this result/], ["What the statuses mean", /Operational feasibility/], ["How emissions are estimated", /Environmental performance/], ["How to read these figures", /Economic results/]]) {
      await pg.getByRole("button", { name: lab }).click();
      const d = pg.getByRole("dialog", { name: re }); await d.waitFor(); ok(name + " results help: " + lab, await d.isVisible());
      await pg.keyboard.press("Escape");
    }
    await pg.getByRole("button", { name: "What is Net present value (NPV)?" }).first().click();
    ok(name + " NPV tip on results", (await pg.getByRole("tooltip").innerText()).includes("Positive means an advantage"));
    ok(name + " results overflow", await noOverflow(pg));
    await pg.screenshot({ path: `${S}/b51-${name}-results.png` });
    // empty results
    await pg.evaluate(() => localStorage.removeItem("greenfleet-viability-lab:assessment")); await pg.goto(base + "/results");
    await pg.getByText("No assessment results are available yet.").waitFor();
    ok(name + " empty results", (await pg.locator("main").innerText()).includes("How GreenFleet Works") && (await pg.locator(".recharts-surface").count()) === 0);
    // index
    await pg.getByRole("button", { name: "Help", exact: true }).click(); await pg.getByRole("button", { name: "All help topics" }).click();
    ok(name + " help index", (await pg.getByRole("dialog").innerText()).includes("Commercial Viability"));
    await pg.getByRole("button", { name: "Commercial Viability" }).click();
    ok(name + " index navigates", (await pg.getByRole("dialog").innerText()).includes("INSUFFICIENT EVIDENCE"));
    await pg.screenshot({ path: `${S}/b51-${name}-index.png` });
    await ctx.close();
  }
  console.log(log.join("\n")); console.log("ERRORS:", errs.length ? errs.join("\n") : "none");
  await b.close();
})();
