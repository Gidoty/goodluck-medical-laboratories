// Batch 8 QA: the five demonstration cases through the real UI, route sweeps (console, network, overflow, headings, accessibility),
// presentation at projector sizes, mobile and tablet widths, keyboard and focus behaviour, print, and timings.
//
// Run against a running app:  npm run build && npx next start -p 3100
// Environment: BASE_URL, PLAYWRIGHT_MODULE, CHROMIUM, SHOT_DIR (as the other suites), and optionally
//   AXE_PATH = path to axe.min.js (axe-core is NOT a dependency of this project; install it anywhere and point to it)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.BASE_URL || "http://localhost:3100";
const S = process.env.SHOT_DIR || "./e2e/out";
const AXE = process.env.AXE_PATH || "";
const fs = require("fs");
fs.mkdirSync(S, { recursive: true });
const launch = () => chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const DISMISS = () => { try { if (!localStorage.getItem("greenfleet-viability-lab:onboarding")) localStorage.setItem("greenfleet-viability-lab:onboarding", JSON.stringify({ version: 1, status: "dismissed", at: "e2e" })); } catch {} };
const log = [], errs = [], info = [];
const ok = (n, c, x) => log.push((c ? "PASS " : "FAIL ") + n + (x !== undefined ? " :: " + x : ""));
const note = (n, x) => info.push("INFO " + n + " :: " + x);
const clean = (t) => !/NaN|Infinity|undefined|\[object Object\]|\{cur\}/.test(t);
const LABELS = ["INSUFFICIENT EVIDENCE", "NOT YET VIABLE", "CONDITIONALLY VIABLE", "VIABLE"];
const labelOf = (t) => LABELS.find((l) => t.includes(l)) || "(none)";

const CASES = [
  { n: 1, bev: "VIABLE", biofuel: "NOT YET VIABLE" },
  { n: 2, bev: "CONDITIONALLY VIABLE", biofuel: "NOT YET VIABLE" },
  { n: 3, bev: "NOT YET VIABLE", biofuel: "NOT YET VIABLE" },
  { n: 4, bev: "VIABLE", biofuel: "CONDITIONALLY VIABLE" },
  { n: 5, bev: "INSUFFICIENT EVIDENCE", biofuel: "INSUFFICIENT EVIDENCE" },
];

async function newPage(b, vp, name, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: !!opts.touch, acceptDownloads: true });
  if (!opts.welcome) await ctx.addInitScript(DISMISS);
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(12000);
  const requests = [];
  pg.on("request", (r) => requests.push({ url: r.url(), method: r.method() }));
  pg.on("pageerror", (e) => errs.push(`${name} pageerror: ${e.message}`));
  pg.on("console", (m) => { if (["error", "warning"].includes(m.type())) errs.push(`${name} console.${m.type()}: ${m.text().slice(0, 200)}`); });
  // Next aborts in-flight route prefetches (?_rsc=) when a page navigates away. That is normal, not a failed resource.
  pg.on("requestfailed", (r) => { if (r.failure()?.errorText === "net::ERR_ABORTED" && /[?&]_rsc=/.test(r.url())) return; errs.push(`${name} requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
  pg.on("response", (r) => { if (r.status() >= 400 && !/\/_next\/static\/.*\.map$/.test(r.url())) errs.push(`${name} http ${r.status()}: ${r.url()}`); });
  return { ctx, pg, requests };
}

async function loadCase(pg, n) {
  await pg.goto(base + "/assessment/business");
  const summary = pg.locator("summary", { hasText: "Synthetic demonstration cases" });
  if (!(await pg.locator("details[open] summary", { hasText: "Synthetic demonstration cases" }).count())) await summary.click();
  await pg.getByRole("button", { name: new RegExp(`Case ${n}:`) }).click();
  const confirm = pg.getByRole("button", { name: "Discard and load case" });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await pg.waitForTimeout(300);
}
async function runAssessment(pg) {
  await pg.goto(base + "/assessment/review");
  await pg.getByRole("button", { name: /Run Commercial Viability Assessment/ }).click();
  await pg.waitForURL("**/results");
  await pg.getByText("Commercial viability against diesel").first().waitFor();
}
const overflowOk = (pg) => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function axeRun(pg, label, failImpacts = ["critical", "serious"]) {
  if (!AXE) return;
  await pg.addScriptTag({ path: AXE });
  const res = await pg.evaluate(async () => {
    const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, first: v.nodes[0]?.target?.join(" ").slice(0, 90), help: v.help }));
  });
  const bad = res.filter((v) => failImpacts.includes(v.impact));
  ok(`${label} axe (wcag2a/aa)`, bad.length === 0, bad.length ? JSON.stringify(bad) : `${res.length} minor`);
  if (res.length && !bad.length) note(`${label} axe minor`, JSON.stringify(res.map((v) => `${v.id}(${v.impact},${v.n})`)));
}

async function headingCheck(pg, label) {
  const hs = await pg.evaluate(() => [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter((e) => e.offsetParent !== null && !e.closest("dialog:not([open])")).map((e) => Number(e.tagName[1])));
  const h1 = hs.filter((x) => x === 1).length;
  let skips = 0;
  for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) skips++;
  ok(`${label} one h1, no skipped heading levels`, h1 === 1 && skips === 0, `h1=${h1} skips=${skips}`);
}

async function namesCheck(pg, label) {
  const bad = await pg.evaluate(() => {
    const name = (e) => (e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") && document.getElementById(e.getAttribute("aria-labelledby"))?.textContent || e.textContent || e.getAttribute("title") || "").trim();
    const out = [];
    for (const e of document.querySelectorAll("button, a[href], [role=button]")) if (e.offsetParent !== null && !name(e)) out.push(e.tagName + "." + (e.className || "").toString().slice(0, 30));
    for (const e of document.querySelectorAll("input:not([type=hidden]), select, textarea")) {
      if (e.offsetParent === null) continue;
      const id = e.id;
      const labelled = e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || (id && document.querySelector(`label[for="${id}"]`)) || e.closest("label");
      if (!labelled) out.push("input#" + id);
    }
    for (const e of document.querySelectorAll("img")) if (!e.hasAttribute("alt")) out.push("img");
    for (const t of document.querySelectorAll("table")) if (t.offsetParent !== null && !t.querySelector("th")) out.push("table-without-th");
    return out;
  });
  ok(`${label} accessible names: buttons, links, inputs, images, tables`, bad.length === 0, bad.slice(0, 5).join(","));
}

(async () => {
  const b = await launch();
  const allRequests = [];

  /* ============================== 1. demonstration cases through the real UI ============================== */
  {
    const { ctx, pg, requests } = await newPage(b, { width: 1440, height: 900 }, "cases");
    await pg.goto(base + "/overview");
    await pg.locator("summary", { hasText: "Synthetic demonstration cases" }).waitFor();
    ok("overview offers the demonstration cases", (await pg.locator("summary", { hasText: "Synthetic demonstration cases" }).count()) === 1);
    for (const c of CASES) {
      await loadCase(pg, c.n);
      const name = await pg.evaluate(() => JSON.parse(localStorage.getItem("greenfleet-viability-lab:assessment")).assessment.inputs["business.assessmentName"]);
      ok(`case ${c.n} loaded and named`, new RegExp(`^SYNTHETIC DEMONSTRATION CASE ${c.n}:`).test(name), name);
      const alert = await pg.locator("main").innerText();
      ok(`case ${c.n} wizard shows the required notice`, alert.includes("Illustrative synthetic values for demonstration only. These are not current market prices or investment recommendations."));
      await runAssessment(pg);
      const bev = labelOf(await pg.getByTestId("commercial-bev").innerText());
      const bio = labelOf(await pg.getByTestId("commercial-biofuel").innerText());
      ok(`case ${c.n} BEV = ${c.bev}`, bev === c.bev, bev);
      ok(`case ${c.n} biofuel = ${c.biofuel}`, bio === c.biofuel, bio);
      const main = await pg.locator("main").innerText();
      ok(`case ${c.n} results carry the demonstration notice`, main.includes("Illustrative synthetic values for demonstration only"));
      ok(`case ${c.n} results clean and no horizontal overflow`, clean(main) && (await overflowOk(pg)));
      ok(`case ${c.n} emissions shown as unavailable, never zero`, /Unavailable|not supplied|No usable emission factor/i.test(main) || /does not mean zero emissions/.test(main));
      if (c.n === 5) ok("case 5 discloses the available economic evidence while withholding the label", /Available economic evidence is unfavourable/.test(await pg.getByTestId("commercial-bev").innerText()));
      await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(300);
      await pg.screenshot({ path: `${S}/b8-case${c.n}-results.png` });
    }
    // replacement asks first; cancel keeps; return to blank asks first
    await loadCase(pg, 1);
    await pg.goto(base + "/assessment/business");
    await pg.locator("summary", { hasText: "Synthetic demonstration cases" }).click();
    await pg.getByRole("button", { name: /Case 2:/ }).click();
    const dlg = pg.getByRole("button", { name: "Discard and load case" });
    ok("replacing a loaded case asks for confirmation", await dlg.isVisible());
    await pg.keyboard.press("Escape");
    const keptName = await pg.evaluate(() => JSON.parse(localStorage.getItem("greenfleet-viability-lab:assessment")).assessment.inputs["business.assessmentName"]);
    ok("cancelling keeps the current case", /CASE 1/.test(keptName), keptName);
    await pg.locator("summary", { hasText: "Synthetic demonstration cases" }).click().catch(() => {});
    if (!(await pg.getByRole("button", { name: "Return to Blank Assessment" }).isVisible().catch(() => false))) await pg.locator("summary", { hasText: "Synthetic demonstration cases" }).click();
    await pg.getByRole("button", { name: "Return to Blank Assessment" }).click();
    await pg.getByRole("button", { name: "Discard and start blank" }).click();
    await pg.waitForTimeout(400);
    const blank = await pg.evaluate(() => JSON.parse(localStorage.getItem("greenfleet-viability-lab:assessment") || "null"));
    ok("Return to Blank Assessment resets after confirmation", !blank || blank.assessment.origin === "blank", blank && blank.assessment.origin);
    allRequests.push(...requests);
    await ctx.close();
  }

  /* ============================== 2. route sweep: console, network, overflow, headings, names, axe ============================== */
  const ROUTES = ["/", "/overview", "/assessment/business", "/assessment/diesel", "/assessment/electric", "/assessment/biofuel", "/assessment/finance", "/assessment/review", "/results", "/sensitivity", "/scenarios", "/report", "/present", "/methodology", "/about"];
  for (const [vpName, vp, touch] of [["360", { width: 360, height: 740 }, true], ["390", { width: 390, height: 844 }, true], ["430", { width: 430, height: 932 }, true], ["tablet768", { width: 768, height: 1024 }, true], ["tablet1024", { width: 1024, height: 768 }, true], ["1366x768", { width: 1366, height: 768 }, false], ["1440x900", { width: 1440, height: 900 }, false], ["1920x1080", { width: 1920, height: 1080 }, false]]) {
    const { ctx, pg, requests } = await newPage(b, vp, `sweep-${vpName}`, { touch });
    await loadCase(pg, 3);
    await runAssessment(pg);
    await pg.goto(base + "/sensitivity"); await pg.getByText("Base Case: your current assessment").waitFor(); await pg.waitForTimeout(1500);
    for (const r of ROUTES) {
      await pg.goto(base + r);
      await pg.waitForLoadState("networkidle");
      await pg.waitForTimeout(r === "/report" || r === "/present" || r === "/sensitivity" ? 900 : 250);
      const txt = await pg.locator("body").innerText();
      const tag = `${vpName} ${r}`;
      ok(`${tag} no horizontal page overflow`, await overflowOk(pg));
      ok(`${tag} no NaN/undefined/token leaks`, clean(txt));
      if (r !== "/" && r !== "/present") { await headingCheck(pg, tag); await namesCheck(pg, tag); }
      if (r === "/present") await namesCheck(pg, tag);
      if (["desktop", "1440x900", "390"].includes(vpName) || ["1440x900", "390"].includes(vpName)) await axeRun(pg, tag);
    }
    // the top bar controls must not overlap each other (a defect found at 360px in Batch 8)
    ok(`${vpName} top bar: no control overlaps another`, await pg.evaluate(() => { const bar = document.querySelector("div.sticky"); if (!bar) return true; const items = [...bar.querySelectorAll("button, select, dt, dd, a")].filter((e) => e.offsetParent !== null).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0); for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i], b = items[j]; const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ox > 2 && oy > 2) return false; } return true; }));
    // wide tables are inside deliberate scroll containers, not the page
    await pg.goto(base + "/results"); await pg.waitForTimeout(400);
    ok(`${vpName} results: no element pushes the page wider than the viewport`, await pg.evaluate(() => { const w = window.innerWidth; return ![...document.querySelectorAll("main *")].some((e) => { if (e.closest("[data-scroll], .overflow-x-auto, .overflow-auto, .overflow-x-scroll")) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.right > w + 2 && getComputedStyle(e).position !== "fixed"; }); }));
    if (["360", "430", "tablet768", "1366x768"].includes(vpName)) { await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(300); await pg.screenshot({ path: `${S}/b8-${vpName}-results.png` }); }
    allRequests.push(...requests);
    await ctx.close();
  }

  /* ============================== 3. presentation at projector sizes ============================== */
  for (const [vpName, vp] of [["1366x768", { width: 1366, height: 768 }], ["1440x900", { width: 1440, height: 900 }], ["1920x1080", { width: 1920, height: 1080 }], ["390", { width: 390, height: 844 }]]) {
    const { ctx, pg, requests } = await newPage(b, vp, `present-${vpName}`);
    await loadCase(pg, 1);
    await runAssessment(pg);
    await pg.goto(base + "/sensitivity"); await pg.getByText("Base Case: your current assessment").waitFor(); await pg.waitForTimeout(2500);
    await pg.goto(base + "/present");
    await pg.getByText(/screen 1 of/i).first().waitFor();
    const total = Number((await pg.locator("body").innerText()).match(/SCREEN 1 OF (\d+)/i)?.[1]);
    ok(`${vpName} presentation has all ten screens when the analysis was run`, total === 10, String(total));
    const titles = [];
    let tiny = [], horizontal = 0, doesNotFit = 0;
    for (let i = 1; i <= total; i++) {
      const t = await pg.locator("body").innerText();
      titles.push((t.split("\n").map((x) => x.trim()).filter(Boolean).find((x, k, arr) => /^SCREEN \d+ OF/i.test(arr[k - 1] || "")) || ""));
      const fonts = await pg.evaluate(() => {
        const bad = [];
        for (const e of document.querySelectorAll("body *")) {
          if (e.offsetParent === null && getComputedStyle(e).position !== "fixed") continue;
          const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ");
          if (own.length < 25) continue;
          const px = parseFloat(getComputedStyle(e).fontSize);
          if (px < 14) bad.push(`${px}px "${own.slice(0, 40)}"`);
        }
        return bad;
      });
      tiny.push(...fonts.map((f) => `s${i}: ${f}`));
      if (!(await overflowOk(pg))) horizontal++;
      if (!(await pg.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 2))) doesNotFit++;
      if (i === 1 || i === 6 || i === 8) await pg.screenshot({ path: `${S}/b8-present-${vpName}-s${i}.png` });
      if (i < total) await pg.keyboard.press("ArrowRight");
    }
    ok(`${vpName} presentation: no horizontal overflow on any screen`, horizontal === 0);
    ok(`${vpName} presentation: no body text under 14px`, tiny.length === 0, tiny.slice(0, 4).join(" | "));
    note(`${vpName} presentation screens that need vertical scrolling`, `${doesNotFit} of ${total}`);
    ok(`${vpName} presentation order`, titles.join(" > ").length > 0, titles.join(" > "));
    await pg.keyboard.press("ArrowRight");
    ok(`${vpName} presentation does not run past the last screen`, /SCREEN 10 OF 10/i.test(await pg.locator("body").innerText()));
    for (let i = 0; i < 12; i++) await pg.keyboard.press("ArrowLeft");
    ok(`${vpName} presentation does not go before the first screen`, /SCREEN 1 OF 10/i.test(await pg.locator("body").innerText()));
    await pg.keyboard.press("Escape"); await pg.waitForURL("**/results");
    ok(`${vpName} Escape leaves the presentation for Results`, true);
    allRequests.push(...requests);
    await ctx.close();
  }

  /* ============================== 4. keyboard, focus and dialogs ============================== */
  {
    const { ctx, pg, requests } = await newPage(b, { width: 1440, height: 900 }, "keyboard");
    await pg.goto(base + "/overview");
    const seen = [];
    let noRing = [];
    for (let i = 0; i < 24; i++) {
      await pg.keyboard.press("Tab");
      const d = await pg.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); return { id: (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().slice(0, 40), ring: e.matches(":focus-visible") && (parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== "none" || cs.boxShadow !== "none") }; });
      if (d) { seen.push(d.id); if (!d.ring) noRing.push(d.id); }
    }
    ok("keyboard: the first Tab stop is the skip link", seen[0] === "Skip to main content", seen[0]);
    ok("keyboard: Tab reaches navigation, Help, the case menu and actions (no trap, 10+ distinct stops)", new Set(seen).size >= 10, String(new Set(seen).size));
    ok("keyboard: every focused element shows a visible focus indicator", noRing.length === 0, noRing.slice(0, 4).join(","));
    // Shift+Tab goes back
    const before = await pg.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 30));
    await pg.keyboard.press("Shift+Tab");
    const after = await pg.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 30));
    ok("keyboard: Shift+Tab moves backwards", before !== after, `${before} -> ${after}`);
    // Help: Enter opens, focus inside, Tab trapped inside the modal, Escape returns focus to Help
    const helpBtn = pg.getByRole("button", { name: "Help" }).first();
    await helpBtn.focus(); await pg.keyboard.press("Enter");
    await pg.waitForTimeout(300);
    ok("help: opens with Enter and focus moves into the dialog", await pg.evaluate(() => !!document.activeElement?.closest("dialog[open]")));
    // A native modal dialog makes the rest of the page inert. After its last control, Tab may hand focus to the browser's own UI
    // (document.body here), but never to a control behind the dialog.
    let behind = 0, insideStops = new Set();
    for (let i = 0; i < 14; i++) {
      await pg.keyboard.press("Tab");
      const where = await pg.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? "chrome" : a.closest("dialog[open]") ? "dialog:" + (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 20) : "behind"; });
      if (where === "behind") behind++; else if (where !== "chrome") insideStops.add(where);
    }
    ok("help: Tab never reaches a control behind the modal dialog (intentional trap), and cycles through its own controls", behind === 0 && insideStops.size >= 3, `behind=${behind} inside=${insideStops.size}`);
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(250);
    ok("help: Escape closes it and focus returns to the Help button", await pg.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Help" || /^Help$/.test(document.activeElement?.textContent?.trim() || "")));
    // tour from help
    await helpBtn.click(); await pg.waitForTimeout(250);
    await pg.getByRole("button", { name: /Restart Quick Tour/ }).click(); await pg.waitForTimeout(350);
    ok("tour: opens as a dialog with focus inside", await pg.evaluate(() => !!document.activeElement?.closest("dialog[open], [role=dialog]")));
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);
    ok("tour: Escape closes it and focus is not lost to the page body", await pg.evaluate(() => document.activeElement && document.activeElement !== document.body));
    // confirm dialog from the wizard
    await loadCase(pg, 1);
    await pg.goto(base + "/assessment/diesel");
    const reset = pg.getByRole("button", { name: /Reset Assessment/ });
    await reset.focus(); await pg.keyboard.press("Enter"); await pg.waitForTimeout(250);
    ok("confirm dialog: opens by keyboard with focus inside", await pg.evaluate(() => !!document.activeElement?.closest("dialog[open]")));
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(250);
    ok("confirm dialog: Escape cancels and keeps the data", !!(await pg.evaluate(() => localStorage.getItem("greenfleet-viability-lab:assessment"))));
    ok("confirm dialog: focus returns to a control, not the page body", await pg.evaluate(() => document.activeElement && document.activeElement !== document.body));
    // wizard: Enter/Space on controls
    await pg.goto(base + "/assessment/electric");
    const radios = pg.getByRole("radio");
    if (await radios.count()) { await radios.first().focus(); await pg.keyboard.press("Space"); ok("wizard: Space selects a radio choice", await radios.first().isChecked()); }
    const next = pg.getByRole("link", { name: /Next|Continue/ }).first();
    if (await next.count()) { await next.focus(); await pg.keyboard.press("Enter"); await pg.waitForTimeout(500); ok("wizard: Enter on Next moves to the next step", !/\/electric$/.test(pg.url()), pg.url()); }
    // scenario builder
    await pg.goto(base + "/scenarios");
    await pg.getByRole("button", { name: "Add another change" }).focus(); await pg.keyboard.press("Enter"); await pg.waitForTimeout(250);
    ok("scenario builder: 'Add another change' works from the keyboard", (await pg.getByRole("button", { name: /Remove change/ }).count()) >= 2);
    await pg.keyboard.press("Tab");
    await axeRun(pg, "scenarios builder");
    // open help drawer for axe
    await helpBtn.click(); await pg.waitForTimeout(250);
    await axeRun(pg, "help drawer open");
    await pg.keyboard.press("Escape");
    allRequests.push(...requests);
    await ctx.close();
  }

  /* ============================== 5. welcome dialog, tour and Restart Tour on a fresh visit ============================== */
  {
    const { ctx, pg, requests } = await newPage(b, { width: 1440, height: 900 }, "welcome", { welcome: true });
    await pg.goto(base + "/overview");
    await pg.getByRole("dialog").first().waitFor();
    ok("first visit: the welcome dialog opens with focus inside", await pg.evaluate(() => !!document.activeElement?.closest("dialog[open], [role=dialog]")));
    await axeRun(pg, "welcome dialog");
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);
    ok("first visit: Escape dismisses it and the app is usable", (await pg.getByRole("link", { name: "Overview" }).count()) > 0);
    allRequests.push(...requests);
    await ctx.close();
  }

  /* ============================== 6. print preview ============================== */
  {
    const { ctx, pg, requests } = await newPage(b, { width: 1280, height: 900 }, "print");
    await loadCase(pg, 3); await runAssessment(pg);
    await pg.goto(base + "/sensitivity"); await pg.getByText("Base Case: your current assessment").waitFor(); await pg.waitForTimeout(2500);
    await pg.goto(base + "/report"); await pg.getByRole("heading", { name: /Executive decision summary/ }).waitFor();
    await pg.emulateMedia({ media: "print" }); await pg.waitForTimeout(300);
    const vis = await pg.evaluate(() => {
      const shown = (sel) => [...document.querySelectorAll(sel)].some((e) => { const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== "none" && r.width > 0 && r.height > 0; });
      const txt = document.body.innerText;
      return {
        nav: shown("aside"), topbar: shown("header[class*=sticky], header[role=banner]"), buttons: shown("main button"), help: [...document.querySelectorAll("button")].some((e) => /Help/.test(e.getAttribute("aria-label") || e.textContent) && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0),
        disclaimer: txt.includes("should not be interpreted as financial, investment, engineering, regulatory or procurement advice"), attribution: txt.includes("Built by Group 8, MSc Class of 2025, CELTRAS"), prototype: txt.includes("GreenFleet MSc Prototype v1.0"),
        headings: [...document.querySelectorAll("h2")].filter((e) => e.getBoundingClientRect().height > 0).length,
        wideTables: [...document.querySelectorAll("table")].filter((t) => t.scrollWidth > t.parentElement.clientWidth + 2 && getComputedStyle(t.parentElement).overflowX !== "visible").length,
      };
    });
    ok("print: navigation absent", !vis.nav);
    ok("print: toolbar buttons absent", !vis.buttons);
    ok("print: help control absent", !vis.help);
    ok("print: major headings visible", vis.headings >= 12, String(vis.headings));
    ok("print: tables readable (none clipped by a scroll container)", vis.wideTables === 0, String(vis.wideTables));
    ok("print: disclaimer, attribution and prototype version visible", vis.disclaimer && vis.attribution && vis.prototype);
    const pdf = await pg.pdf({ format: "A4", printBackground: true });
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok("print: a PDF is produced with a sensible page count", pages >= 4 && pages <= 40, `${pages} pages, ${(pdf.length / 1024).toFixed(0)} KB`);
    fs.writeFileSync(`${S}/b8-report-case3.pdf`, pdf);
    await pg.emulateMedia({ media: "screen" });
    allRequests.push(...requests);
    await ctx.close();
  }

  /* ============================== 7. timings (observed, not promised) ============================== */
  {
    const { ctx, pg, requests } = await newPage(b, { width: 1440, height: 900 }, "timing");
    await loadCase(pg, 3);
    await pg.goto(base + "/assessment/review");
    let t0 = Date.now();
    await pg.getByRole("button", { name: /Run Commercial Viability Assessment/ }).click(); await pg.waitForURL("**/results"); await pg.getByText("Commercial viability against diesel").first().waitFor();
    note("timing results page (run to visible)", `${Date.now() - t0} ms`);
    t0 = Date.now();
    await pg.goto(base + "/sensitivity"); await pg.getByRole("heading", { name: /Driver ranking/ }).waitFor(); await pg.getByText("Two-way sensitivity").first().waitFor();
    note("timing sensitivity page (navigate to drivers and two-way visible)", `${Date.now() - t0} ms`);
    t0 = Date.now();
    await pg.goto(base + "/report"); await pg.getByRole("heading", { name: /Executive decision summary/ }).waitFor();
    note("timing report page (navigate to visible)", `${Date.now() - t0} ms`);
    const longTasks = await pg.evaluate(() => new Promise((res) => { let max = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) max = Math.max(max, e.duration); }).observe({ entryTypes: ["longtask"] }); } catch {} setTimeout(() => res(max), 50); }));
    note("timing longest main-thread task seen after report load", `${Math.round(longTasks)} ms`);
    allRequests.push(...requests);
    await ctx.close();
  }

  /* ============================== 8. runtime network audit ============================== */
  const external = allRequests.filter((r) => !r.url.startsWith(base) && !r.url.startsWith("data:") && !r.url.startsWith("blob:"));
  const posts = allRequests.filter((r) => r.method !== "GET");
  ok("network: every request goes to the app's own origin (no analytics, AI, market-data or database calls)", external.length === 0, external.slice(0, 3).map((r) => r.url).join(","));
  ok("network: no POST/PUT/DELETE request was made by any page", posts.length === 0, posts.slice(0, 3).map((r) => r.method + " " + r.url).join(","));
  note("network: total requests observed", String(allRequests.length));

  console.log(log.join("\n"));
  console.log(info.join("\n"));
  console.log(errs.length ? "ERRORS:\n" + [...new Set(errs)].join("\n") : "ERRORS: none");
  await b.close();
})().catch((e) => { console.log(log.join("\n")); console.log("FATAL " + e.stack); process.exit(1); });
