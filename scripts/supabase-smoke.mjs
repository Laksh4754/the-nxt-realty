import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'config.js');
if (!fs.existsSync(configPath)) {
  console.error('Supabase smoke check failed: config.js is missing.');
  process.exit(1);
}

const sandbox = { window: { NXT_CONFIG: {} } };
try {
  vm.runInNewContext(fs.readFileSync(configPath, 'utf8'), sandbox, { timeout: 1000 });
} catch {
  console.error('Supabase smoke check failed: config.js could not be read safely.');
  process.exit(1);
}

const config = sandbox.window.NXT_CONFIG || {};
const envUrl = process.env.SUPABASE_URL;
const envKey = process.env.SUPABASE_ANON_KEY;
if ((envUrl && !envKey) || (!envUrl && envKey)) {
  console.error('Supabase smoke check failed: provide both SUPABASE_URL and SUPABASE_ANON_KEY, or neither.');
  process.exit(1);
}
const urlValue = envUrl || config.SUPABASE_URL;
const keyValue = envKey || config.SUPABASE_ANON_KEY;
let url;
try { url = new URL(urlValue); } catch {}
if (!url || url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') ||
    typeof keyValue !== 'string' || keyValue.length < 12 ||
    /PASTE_|service_role|sb_secret/i.test(keyValue)) {
  console.error('Supabase smoke check failed: required public project URL or publishable/anon key is missing or invalid.');
  process.exit(1);
}

const client = createClient(url.href, keyValue);
try {
  const { data, error } = await client
    .from('properties')
    .select('id')
    .eq('status', 'published')
    .limit(1);
  if (error || !Array.isArray(data)) throw new Error();
  console.log('Supabase smoke check passed: configuration is valid and the published listings query succeeded.');
} catch {
  console.error('Supabase smoke check failed: the published listings query did not succeed. No credentials or response details were printed.');
  process.exit(1);
}
