import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('Asset check failed: index.html is missing.');
  process.exit(1);
}

// Ignore markup inside HTML comments so it cannot satisfy required resources.
const html = fs.readFileSync(indexPath, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const references = [];
for (const match of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
  const tag = match[0];
  const isScript = /^<script\b/i.test(tag);
  const attr = isScript ? 'src' : 'href';
  const value = tag.match(new RegExp('\\b' + attr + '\\s*=\\s*["\\\']([^"\\\']+)["\\\']', 'i'))?.[1];
  if (value) references.push({ tag, value });
}

const required = [
  { name: 'styles.css', test: item => /^styles\.css(?:[?#]|$)/i.test(item.value) },
  { name: 'config.js', test: item => /^config\.js(?:[?#]|$)/i.test(item.value) },
  { name: 'Supabase JavaScript library', test: item => /<script\b/i.test(item.tag) && /(?:@supabase\/supabase-js|supabase-js)/i.test(item.value) },
  { name: 'app.js', test: item => /^app\.js(?:[?#]|$)/i.test(item.value) }
];

const missing = required.filter(item => !references.some(item.test)).map(item => item.name);
const missingFiles = [];
for (const item of references) {
  if (/^[a-z][a-z\d+.-]*:/i.test(item.value) || item.value.startsWith('//') || item.value.startsWith('#')) continue;
  let localPath;
  try { localPath = decodeURIComponent(new URL(item.value, 'http://localhost/').pathname); }
  catch { missingFiles.push(item.value); continue; }
  const absolutePath = path.resolve(root, `.${localPath.startsWith('/') ? localPath : `/${localPath}`}`);
  if (!absolutePath.startsWith(root + path.sep) || !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    missingFiles.push(localPath || item.value);
  }
}

if (missing.length || missingFiles.length) {
  if (missing.length) console.error('Asset check failed: index.html is missing required references: ' + missing.join(', '));
  if (missingFiles.length) console.error('Asset check failed: referenced local files are missing: ' + [...new Set(missingFiles)].join(', '));
  process.exit(1);
}
console.log('Asset check passed: required homepage resources are referenced and local files exist.');
