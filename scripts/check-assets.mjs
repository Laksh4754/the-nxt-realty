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

const previewPath = path.join(root, 'listing-preview.html');
if (fs.existsSync(previewPath)) {
  const previewHtml = fs.readFileSync(previewPath, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  for (const match of previewHtml.matchAll(/<(?:img|script|link)\b[^>]*>/gi)) {
    const tag = match[0];
    const value = tag.match(/\b(?:src|href)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!value || /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//') || value.startsWith('#')) continue;
    let localPath;
    try { localPath = decodeURIComponent(new URL(value, 'http://localhost/').pathname).replace(/^\//, ''); }
    catch { missingFiles.push(value); continue; }
    const absolutePath = path.resolve(root, localPath);
    if (!absolutePath.startsWith(root + path.sep) || !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      missingFiles.push(localPath || value);
    }
  }
  const appMarkup = [previewHtml, fs.readFileSync(path.join(root, 'property.js'), 'utf8')].join('\n');
  if (/assets\/floor-plans\//i.test(appMarkup)) missingFiles.push('Floor-plan originals must not be referenced by public page markup.');
  if (/assets\/floor-plan-previews\//i.test(appMarkup)) missingFiles.push('Floor-plan preview files must be generated from blurred uploads or abstract CSS art.');
  const vercelIgnore = fs.existsSync(path.join(root, '.vercelignore')) ? fs.readFileSync(path.join(root, '.vercelignore'), 'utf8') : '';
  if (!/^assets\/floor-plans\/\*\*\s*$/m.test(vercelIgnore)) missingFiles.push('.vercelignore must exclude the retained floor-plan source folder from public preview uploads.');
  if (!/^assets\/floor-plan-previews\/\*\*\s*$/m.test(vercelIgnore)) missingFiles.push('.vercelignore must exclude retained floor-plan preview images from public deployments.');
  const gitignore = fs.existsSync(path.join(root, '.gitignore')) ? fs.readFileSync(path.join(root, '.gitignore'), 'utf8') : '';
  if (!/^assets\/floor-plans\/\s*$/m.test(gitignore)) missingFiles.push('.gitignore must exclude retained full-resolution floor-plan sources from the public repository.');
  if (!/^assets\/floor-plan-previews\/\s*$/m.test(gitignore)) missingFiles.push('.gitignore must exclude retained floor-plan preview bitmaps from the public repository.');
}

if (missing.length || missingFiles.length) {
  if (missing.length) console.error('Asset check failed: index.html is missing required references: ' + missing.join(', '));
  if (missingFiles.length) console.error('Asset check failed: referenced local files are missing: ' + [...new Set(missingFiles)].join(', '));
  process.exit(1);
}
console.log('Asset check passed: required homepage resources are referenced and local files exist.');
