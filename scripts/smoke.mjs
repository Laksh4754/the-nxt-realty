import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mime = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".xml":"application/xml; charset=utf-8", ".txt":"text/plain; charset=utf-8", ".svg":"image/svg+xml" };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
  const file = path.resolve(root, "." + pathname);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  const target = pathname === "/" ? path.join(root, "index.html") : file;
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(200, { "content-type": mime[path.extname(target)] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
let failures = 0;
const check = (ok, message) => { console.log(`${ok ? "PASS" : "FAIL"}: ${message}`); if (!ok) failures++; };

try {
  for (const viewport of [{width:390,height:844,label:"mobile"},{width:1365,height:900,label:"desktop"}]) {
    const page = await browser.newPage({ viewport });
    const pageErrors = [];
    page.on("pageerror", e => pageErrors.push(e.message));
    await page.goto(base, { waitUntil:"domcontentloaded" });
    await page.waitForFunction(() => document.querySelectorAll(".property-card").length > 0, null, { timeout:30000 });
    const css = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    check(css.includes("DM Sans") || css.includes("Arial"), `${viewport.label}: stylesheet applied (${css})`);
    const cardCount = await page.locator(".property-card").count();
    check(cardCount > 0, `${viewport.label}: published property cards loaded from Supabase (${cardCount})`);
    await page.locator("#quickFilters [data-filter=\"New Project\"]").click();
    const filteredCards = await page.locator(".property-card").count();
    const filterLabels = await page.locator(".property-card .tag").allTextContents();
    check(filteredCards > 0 && filterLabels.every(label => label.toLowerCase().includes("new project")), `${viewport.label}: listing category filter works`);
    await page.locator("#quickFilters [data-filter=\"All\"]").click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    check(!overflow, `${viewport.label}: no horizontal page overflow`);
    await page.locator(".property-card").first().click();
    await page.waitForURL(/property\.html\?id=/, { timeout:15000 });
    await page.waitForFunction(() => {
      const root = document.querySelector("#propertyDetail");
      return root && !root.textContent.includes("Loading property details") && root.textContent.trim().length > 50;
    }, null, { timeout:30000 });
    check(true, `${viewport.label}: property detail page loads`);
    check(pageErrors.length === 0, `${viewport.label}: no uncaught browser errors${pageErrors.length ? " ("+pageErrors.join("; ")+")" : ""}`);
    await page.close();
  }

  const admin = await browser.newPage({ viewport:{width:390,height:844} });
  await admin.goto(base + "/admin.html", { waitUntil:"domcontentloaded" });
  check(await admin.locator("#loginForm").isVisible(), "admin: login form is visible without signing in");
  const adminCss = await admin.evaluate(() => getComputedStyle(document.body).fontFamily);
  check(adminCss !== "Times New Roman", `admin: stylesheet applied (${adminCss})`);
  await admin.close();
} catch (error) {
  failures++;
  console.error("FAIL: browser smoke test aborted:", error);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
if (failures) process.exit(1);
