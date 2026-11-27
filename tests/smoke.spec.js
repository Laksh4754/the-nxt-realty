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


const detailFixture = {
  id: '44444444-4444-4444-8444-444444444444', status: 'published',
  project_name: 'Sai World Dreams', title: 'Sai World Dreams', developer_name: 'Paradise Group',
  location: 'Dombivli', locality: 'Dombivli', listing_type: 'New Project', possession_status: 'Under construction',
  description: 'A premium residential development in Dombivli.',
  image_url: 'https://images.example.test/hero.jpg',
  gallery_urls: ['https://images.example.test/gallery-1.jpg', 'https://images.example.test/gallery-2.jpg'],
  configurations: [{ label: '1 BHK', price: 6500000, area: '450 sq.ft.', bedrooms: 1,
    floor_plans: [{ url: 'https://images.example.test/1bhk-plan.jpg', name: '1 BHK floor plan', type: 'image/jpeg' }] }],
  amenities: ['Swimming pool', 'Gym'], map_url: 'https://maps.google.com/?q=Sai+World+Dreams+Dombivli',
  project_logo_url: '', developer_logo_url: '', lifestyle_highlights: [], media_assets: []
};

async function openDetailFixture(page) {
  await isolateNetwork(page);
  await page.route('**/rest/v1/properties*', async route => {
    if (route.request().method() !== 'GET') { await route.abort('blockedbyclient'); return; }
    await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify([detailFixture]) });
  });
  await page.goto('/property.html?id=' + detailFixture.id);
  await expect(page.locator('.project-hero h1')).toHaveText('Sai World Dreams');
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


test('property detail keeps one hero CTA and contextual section and card actions', async ({ page, isMobile }) => {
  await openDetailFixture(page);
  const detail = page.locator('#propertyDetail');
  await expect(detail.locator('.project-hero-copy button')).toHaveText('Enquire Now');
  await expect(detail.locator('.project-hero-meta .listing-card-enquire')).toHaveCount(0);
  await expect(detail.locator('.project-gallery-heading .section-enquire')).toHaveText('See All Pictures');
  await expect(detail.locator('.amenity-list .listing-card-enquire')).toHaveCount(0);
  await expect(detail.locator('.amenity-list + .section-enquire')).toHaveText('Enquire about amenities');
  await expect(detail.locator('.configuration-cards + .section-enquire')).toHaveText('Enquire about pricing');
  await expect(detail.locator('.property-map-card > .listing-card-enquire')).toHaveCount(1);
  await expect(detail.locator('.floor-plan-item > .listing-card-enquire')).toHaveCount(1);

  const summary = detail.locator('.configuration-summary').first();
  const configAction = summary.locator('.listing-card-enquire');
  if (isMobile) {
    await summary.click();
    await expect(summary).toHaveClass(/is-revealed/);
  } else {
    await summary.hover();
    await expect(configAction).toHaveCSS('opacity', '1');
  }
  await configAction.click();
  await expect(page.locator('#resourceGateDialog')).toBeVisible();
  await expect(page.locator('#resourceGateTitle')).toContainText('1 BHK configuration');
  await expect(page.locator('#resourceGateForm [name="configuration"]')).toHaveValue('1 BHK');
  await page.locator('.resource-gate-close').click();

  const plan = detail.locator('.floor-plan-item').first();
  const planAction = plan.locator('.listing-card-enquire');
  if (isMobile) await plan.click(); else await plan.hover();
  await planAction.click();
  await expect(page.locator('#resourceGateTitle')).toContainText('1 BHK · 1 BHK floor plan');
  await expect(page.locator('#resourceGateForm [name="configuration"]')).toHaveValue('1 BHK');
  await page.locator('.resource-gate-close').click();

  const mapCard = detail.locator('.property-map-card');
  if (isMobile) await mapCard.click(); else await mapCard.hover();
  await mapCard.locator('.listing-card-enquire').click();
  await expect(page.locator('#resourceGateTitle')).toContainText('the project location');
  await page.locator('.resource-gate-close').click();
});

test('map enquiry opens Maps only after a successful mocked save', async ({ page }) => {
  const leads = [];
  await openDetailFixture(page);
  await page.route('**/rest/v1/leads*', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: corsHeaders }); return; }
    leads.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, headers: corsHeaders, body: '' });
  });
  await page.getByRole('button', { name: /Open in Google Maps/ }).click();
  await expect(page.locator('#resourceGateTitle')).toContainText('the project location');
  const form = page.locator('#resourceGateForm');
  await form.locator('[name="name"]').fill('Fixture Visitor');
  await form.locator('[name="phone"]').fill('+91 98765 43210');
  await form.locator('[name="consent"]').check();
  await form.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.locator('#resourceGateDialog')).toBeHidden();
  expect(leads).toHaveLength(1);
  expect(leads[0]).toMatchObject({ requirement: 'Google Maps directions', source: 'property_maps', consent: true });
  expect(await page.evaluate(() => window.__openedWhatsApp)).toBe(detailFixture.map_url);
});

test('map save failure does not redirect and cancellation creates no lead request', async ({ page }) => {
  const leads = [];
  await openDetailFixture(page);
  await page.route('**/rest/v1/leads*', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: corsHeaders }); return; }
    leads.push(route.request().postDataJSON());
    await route.fulfill({ status: 500, headers: corsHeaders, body: '{"message":"fixture failure"}' });
  });
  await page.getByRole('button', { name: /Open in Google Maps/ }).click();
  await page.locator('.resource-gate-close').click();
  expect(leads).toHaveLength(0);
  expect(await page.evaluate(() => window.__openedWhatsApp)).toBeUndefined();

  await page.getByRole('button', { name: /Open in Google Maps/ }).click();
  const form = page.locator('#resourceGateForm');
  await form.locator('[name="name"]').fill('Fixture Visitor');
  await form.locator('[name="phone"]').fill('+91 98765 43210');
  await form.locator('[name="consent"]').check();
  await form.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.locator('#resourceGateNote')).toContainText(/we could not save your request/i);
  expect(leads).toHaveLength(1);
  expect(await page.evaluate(() => window.__openedWhatsApp)).toBeUndefined();
});

test('admin image uploads show before and after review and require approval', async ({ page }) => {
  await isolateNetwork(page);
  await page.goto('/admin.html');
  await page.evaluate(() => { document.querySelector('#dashboard').classList.remove('hidden'); document.querySelector('#propertyForm').classList.remove('hidden'); });
  const projectLogo = page.locator('input[name="project_logo_file"]');
  const developerLogo = page.locator('input[name="developer_logo_file"]');
  await expect(projectLogo).toHaveCount(1);
  await expect(developerLogo).toHaveCount(1);
  await projectLogo.setInputFiles(path.join(root, 'assets/sai-world-dreams-logo.jpg'));
  const review = page.locator('.media-review-card');
  await expect(review).toContainText('sai-world-dreams-logo.jpg');
  await expect(review).toContainText('Before');
  await expect(review).toContainText('After');
  await page.evaluate(() => document.querySelector('#propertyForm').classList.remove('hidden'));
  const save = page.locator('#savePropertyBtn');
  await expect(save).toHaveAttribute('data-media-ready', 'false');
  await review.getByRole('button', { name: 'Approve this image' }).click();
  await expect(save).toHaveAttribute('data-media-ready', 'true');
});

test('admin page presents the sign-in screen in a clean browser context', async ({ page }) => {
  await isolateNetwork(page);
  await page.goto('/admin.html');
  await expect(page.getByRole('heading', { name: 'Admin workspace' })).toBeVisible();
  await expect(page.locator('#loginPanel')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Administrator sign in' })).toBeVisible();
  await expect(page.locator('#dashboard')).toBeHidden();
});
