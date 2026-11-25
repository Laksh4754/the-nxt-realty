import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const properties = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/properties.json'), 'utf8'));
const supabaseBrowserMock = fs.readFileSync(path.join(root, 'tests/fixtures/supabase-browser-mock.js'), 'utf8');
const supabaseUrl = 'https://fixture-project.supabase.co';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer'
};

async function isolateNetwork(page) {
  const leadRequests = [];
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/@supabase/supabase-js@')) {
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: supabaseBrowserMock });
      return;
    }

    if (url.hostname.endsWith('.supabase.co')) {
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      if (url.pathname === '/rest/v1/properties' && request.method() === 'GET') {
        const filtered = properties.filter(property => {
          const status = url.searchParams.get('status');
          const id = url.searchParams.get('id');
          return (!status || property.status === status.slice(3)) && (!id || property.id === id.slice(3));
        });
        await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify(filtered) });
        return;
      }

      if (url.pathname === '/rest/v1/leads' && request.method() === 'POST') {
        leadRequests.push({ url: request.url(), method: request.method(), body: request.postDataJSON() });
      }
      // Every other Supabase request is blocked too; no browser test can reach a project.
      await route.abort('blockedbyclient');
      return;
    }

    if (url.origin === 'http://127.0.0.1:4173') {
      await route.continue();
      return;
    }

    // Fonts, analytics, images, and any unexpected third-party request are offline in CI.
    await route.abort('blockedbyclient');
  });

  await page.addInitScript(() => {
    window.open = () => ({
      location: { set href(value) { window.__openedWhatsApp = value; } },
      close() {}
    });
  });
  return leadRequests;
}

async function openHome(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Explore properties' })).toBeVisible();
  await expect(page.locator('#resultsCount')).toHaveText('3 properties found');
  await expect(page.locator('.property-card')).toHaveCount(3);
}

test('homepage resources and fixture property cards resolve', async ({ page }) => {
  const leadRequests = await isolateNetwork(page);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await openHome(page);

  await expect(page.locator('#quickFilters button')).toHaveCount(4);
  await expect(page.locator('#propertyGrid')).toBeVisible();
  expect(leadRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('homepage category and budget filters behave consistently with fixtures', async ({ page }) => {
  await isolateNetwork(page);
  await openHome(page);
  await page.locator('.chip[data-filter="Resale"]').click();
  await expect(page.locator('.chip[data-filter="Resale"]')).toHaveClass(/active/);
  await expect(page.locator('.property-card')).toHaveCount(2);
  for (const card of await page.locator('.property-card').all()) {
    await expect(card.locator('.tag')).toContainText(/resale/i);
  }

  await page.locator('.chip[data-filter="All"]').click();
  const before = await page.locator('.property-card').evaluateAll(cards =>
    cards.map(card => ({ id: card.dataset.id, price: card.querySelector('.price')?.textContent.trim() }))
  );
  await page.locator('#minBudgetFilter').selectOption('10000000');
  await page.locator('#budgetFilter').selectOption('3000000');
  await page.getByRole('button', { name: /Search homes/ }).click();
  await expect(page.locator('#resultsCount')).toHaveText('1 property found');
  const remainingIds = await page.locator('.property-card').evaluateAll(cards => cards.map(card => card.dataset.id));
  const onlyUnpricedListings = before.filter(item => item.price === 'Price on request').map(item => item.id);
  expect(remainingIds.sort()).toEqual(onlyUnpricedListings.sort());
});

test('a fixture property card opens its detail page', async ({ page }) => {
  await isolateNetwork(page);
  await openHome(page);
  await page.locator('.property-card').first().click();
  await expect(page).toHaveURL(/property\.html\?id=11111111-1111-4111-8111-111111111111/);
  const detail = page.locator('#propertyDetail');
  await expect(detail).toContainText('Harbour View Homes');
  await expect(detail.locator('h1')).toBeVisible();
});

test('valid enquiry records and aborts the lead request before it can reach Supabase', async ({ page }) => {
  const leadRequests = await isolateNetwork(page);
  await page.goto('/');
  const form = page.locator('#enquiryForm');
  const name = form.locator('[name="name"]');
  const phone = form.locator('[name="phone"]');
  const consent = form.locator('[name="consent"]');
  const submit = form.getByRole('button', { name: /Continue on WhatsApp/ });

  await expect(form).toBeVisible();
  await name.fill('Smoke Test Lead');
  await phone.fill('+91 98765 43210');
  await form.locator('[name="requirement"]').selectOption({ label: 'Arranging a site visit' });
  await form.locator('[name="location"]').selectOption({ label: 'Navi Mumbai' });
  await form.locator('[name="message"]').fill('Looking for a two bedroom home.');
  await consent.check();
  expect(await form.evaluate(element => element.checkValidity())).toBe(true);

  await submit.click();
  await expect(page.locator('#formNote')).toContainText("couldn't save your enquiry");
  expect(leadRequests).toHaveLength(1);
  expect(leadRequests[0].method).toBe('POST');
  expect(new URL(leadRequests[0].url).pathname).toBe('/rest/v1/leads');
  expect(leadRequests[0].body).toMatchObject({
    name: 'Smoke Test Lead',
    phone: '+91 98765 43210',
    requirement: 'Arranging a site visit',
    preferred_location: 'Navi Mumbai',
    message: 'Looking for a two bedroom home.',
    consent: true,
    status: 'new'
  });
});

test('admin page presents the sign-in screen in a clean browser context', async ({ page }) => {
  await isolateNetwork(page);
  await page.goto('/admin.html');
  await expect(page.getByRole('heading', { name: 'Admin workspace' })).toBeVisible();
  await expect(page.locator('#loginPanel')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Administrator sign in' })).toBeVisible();
  await expect(page.locator('#dashboard')).toBeHidden();
});
