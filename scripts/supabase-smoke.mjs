import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
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

// The smoke check uses a fetch stub: it can validate a read-only Supabase
// request without opening a network connection to the configured project.
const requests = [];
const client = createClient(url.href, keyValue, {
  global: {
    fetch: async (input, init = {}) => {
      const requestUrl = new URL(typeof input === 'string' ? input : input.url);
      const method = (init.method || input.method || 'GET').toUpperCase();
      requests.push({ url: requestUrl, method });
      return new Response(JSON.stringify([{ id: 'fixture-property' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
});
try {
  const { data, error } = await client
    .from('properties')
    .select('id')
    .eq('status', 'published')
    .limit(1);
  assert.equal(error, null, 'mocked published-listings query should succeed');
  assert.equal(requests.length, 1, 'the smoke check should issue exactly one request');
  assert.equal(requests[0].method, 'GET', 'the smoke check must remain read-only');
  assert.equal(requests[0].url.pathname, '/rest/v1/properties');
  assert.equal(requests[0].url.searchParams.get('status'), 'eq.published');
  assert.equal(requests[0].url.searchParams.get('limit'), '1');
  assert.equal(data?.[0]?.id, 'fixture-property');
  console.log('Supabase smoke check passed: valid public configuration and an intercepted, read-only fixture query. No network request was made.');
} catch {
  console.error('Supabase smoke check failed: the configuration or intercepted read-only fixture query was invalid. No credentials or response details were printed.');
  process.exit(1);
}
