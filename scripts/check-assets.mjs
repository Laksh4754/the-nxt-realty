import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };
const pass = (message) => console.log(`PASS: ${message}`);

const html = read("index.html");
const required = [
  ["stylesheet", /<link[^>]+href=["']styles\.css(?:\?[^"']*)?["']/i, "styles.css"],
  ["Supabase client", /<script[^>]+src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2["']/i, null],
  ["Supabase config", /<script[^>]+src=["']config\.js(?:\?[^"']*)?["']/i, "config.js"],
  ["homepage app", /<script[^>]+src=["']app\.js(?:\?[^"']*)?["']/i, "app.js"]
];
for (const [label, pattern, file] of required) {
  if (!pattern.test(html)) fail(`index.html is missing the ${label} reference`);
  else if (file && !fs.existsSync(path.join(root, file))) fail(`Referenced file ${file} does not exist`);
  else pass(`${label} reference and file`);
}

for (const file of ["property.html", "property.js", "admin.html", "admin.js", "admin.css"]) {
  if (!fs.existsSync(path.join(root, file))) fail(`Required site file missing: ${file}`);
  else pass(`file exists: ${file}`);
}

const config = read("config.js");
if (!/SUPABASE_URL:\s*["']https:\/\/[a-z0-9-]+\.supabase\.co["']/.test(config)) fail("config.js has no valid Supabase project URL");
else pass("Supabase project URL is configured");
if (!/SUPABASE_ANON_KEY:\s*["'][^"']{20,}["']/.test(config)) fail("config.js has no publishable/anon key");
else pass("Supabase publishable/anon key is configured");
if (/SUPABASE_SERVICE_ROLE\\s*:/i.test(config)) fail("service-role credential must never be in browser config");
else pass("no service-role credential label in browser config");

for (const file of fs.readdirSync(root).filter((name) => name.endsWith(".js"))) {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
  if (result.status !== 0) fail(`JavaScript syntax error in ${file}: ${result.stderr}`);
  else pass(`JavaScript syntax: ${file}`);
}
if (process.exitCode) process.exit(process.exitCode);
