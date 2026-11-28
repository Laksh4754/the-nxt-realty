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
    floor_plans: [
      { path: 'floor-plans/fixture-1bhk.jpg', name: '1 BHK floor plan', type: 'image/jpeg', thumbnail_url:null, visible: true, featured:true, sort_order: 0 },
      { path: 'floor-plans/fixture-1bhk-alt.jpg', name: 'Alternate plan', type: 'image/jpeg', thumbnail_url:null, visible: true, featured:false, sort_order: 1 }
    ] }],
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
  await expect(detail.locator('.floor-plan-item .view-floor-plan')).toHaveText(/view floor plan/i);

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
  const planAction = plan.locator('.view-floor-plan');
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

test('private floor plan appears only after the saved enquiry receives a signed URL', async ({ page }) => {
  await openDetailFixture(page);
  await expect(page.locator('.floor-plan-item')).toHaveCount(1);
  await expect(page.locator('.floor-plan-item')).not.toContainText('Alternate plan');
  await expect(page.locator('.floor-plan-preview-thumb')).toHaveCount(0);
  await expect(page.locator('.floor-plan-item .plan-blur-art')).toBeVisible();
  await expect(page.locator('.floor-plan-item .plan-preview-overlay')).toHaveText('PRIVATE FLOOR PLAN');
  let submitted;
  await page.route('**/functions/v1/floor-plan-access', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({status:200,headers:corsHeaders,contentType:'application/json',body:JSON.stringify({signed_url:'https://fixture-project.supabase.co/storage/v1/object/sign/floor-plan-private/fixture-1bhk.jpg?token=fixture',expires_in:300})});
  });
  await page.getByRole('button',{name:/view floor plan/i}).click();
  const form=page.locator('#resourceGateForm');
  await form.locator('[name="name"]').fill('Fixture Visitor');
  await form.locator('[name="phone"]').fill('+91 98765 43210');
  await form.locator('[name="consent"]').check();
  await form.getByRole('button',{name:'Send enquiry'}).click();
  await expect(page.locator('#resourceGateNote a')).toHaveAttribute('href',/object\/sign\/floor-plan-private/);
  expect(submitted).toMatchObject({property_id:detailFixture.id,plan_path:'floor-plans/fixture-1bhk.jpg',configuration:'1 BHK',consent:true});
});

test('legacy public floor-plan URLs are not rendered by the public listing', async ({ page }) => {
  await isolateNetwork(page);
  const listing = {
    ...detailFixture,
    floor_plans: [{ url: 'https://public.example.test/legacy-project-plan.jpg', featured: true }],
    configurations: [{ ...detailFixture.configurations[0], floor_plans: [
      { url: 'https://public.example.test/legacy-configuration-plan.jpg', name: 'Legacy plan', featured: true, visible: true }
    ] }]
  };
  await page.route('**/rest/v1/properties*', async route => {
    await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify([listing]) });
  });
  await page.goto('/property.html?id=' + detailFixture.id);
  await expect(page.locator('.project-hero h1')).toHaveText('Sai World Dreams');
  await expect(page.locator('.floor-plan-item')).toHaveCount(0);
  await expect(page.locator('#propertyDetail')).not.toContainText('legacy-project-plan.jpg');
  await expect(page.locator('#propertyDetail')).not.toContainText('legacy-configuration-plan.jpg');
});

test('floor-plan thumbnails are blurred in the image bytes before public upload', async ({ page }) => {
  await isolateNetwork(page);
  await page.goto('/admin.html');
  const pixels = await page.evaluate(async () => {
    const source = document.createElement('canvas'); source.width = 900; source.height = 600;
    const sourceContext = source.getContext('2d'); sourceContext.fillStyle = '#fff'; sourceContext.fillRect(0, 0, 900, 600);
    sourceContext.fillStyle = '#000'; sourceContext.fillRect(435, 250, 30, 100);
    const blob = await new Promise(resolve => source.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'fixture-plan.png', {type:'image/png'});
    const staged = await window.NXTImagePipeline.stage(file, 'floor-plan');
    const bitmap = await createImageBitmap(staged.thumbnail);
    const preview = document.createElement('canvas'); preview.width = bitmap.width; preview.height = bitmap.height;
    const previewContext = preview.getContext('2d', {willReadFrequently:true}); previewContext.drawImage(bitmap, 0, 0);
    const data = previewContext.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const gray = x => { const i = (100 * bitmap.width + x) * 4; return (data[i] + data[i + 1] + data[i + 2]) / 3; };
    const values = {center:gray(Math.floor(bitmap.width/2)), near:gray(Math.floor(bitmap.width/2)+12), far:gray(Math.floor(bitmap.width/2)+40), width:bitmap.width, height:bitmap.height};
    bitmap.close();
    return values;
  });
  expect(pixels.width).toBeLessThanOrEqual(320);
  expect(pixels.height).toBeLessThanOrEqual(200);
  expect(pixels.center).toBeGreaterThan(40);
  expect(pixels.center).toBeLessThan(240);
  expect(Math.abs(pixels.center-pixels.near)).toBeLessThan(100);
  expect(pixels.far).toBeGreaterThan(180);
});

test('invalid, cancelled, and failed floor-plan enquiries never reveal an image', async ({ page }) => {
  await openDetailFixture(page);
  let calls=0;
  await page.route('**/functions/v1/floor-plan-access', async route => {calls++;await route.fulfill({status:500,headers:corsHeaders,contentType:'application/json',body:'{"error":"fixture failure"}'});});
  const open=async()=>page.getByRole('button',{name:/view floor plan/i}).click();
  const form=page.locator('#resourceGateForm');
  await open();
  await form.getByRole('button',{name:'Send enquiry'}).click();
  expect(await form.evaluate(el=>el.checkValidity())).toBe(false);
  expect(calls).toBe(0);
  await page.locator('.resource-gate-close').click();
  await expect(page.locator('#resourceGateNote')).toHaveText('');
  await open();
  await form.locator('[name="name"]').fill('Fixture Visitor');
  await form.locator('[name="phone"]').fill('+91 98765 43210');
  await form.locator('[name="consent"]').check();
  await form.getByRole('button',{name:'Send enquiry'}).click();
  await expect(page.locator('#resourceGateNote')).toContainText(/could not save/i);
  expect(calls).toBe(1);
  await expect(page.locator('.floor-plan-preview-thumb')).toHaveCount(0);
  await expect(page.locator('.floor-plan-item .plan-blur-art')).toBeVisible();
  await expect(page.locator('.resource-gate-note a')).toHaveCount(0);
});

test('closing a floor-plan enquiry while authorization is pending does not reveal the returned URL', async ({ page }) => {
  await openDetailFixture(page);
  let markStarted;
  let releaseRequest;
  const started=new Promise(resolve=>{markStarted=resolve;});
  const released=new Promise(resolve=>{releaseRequest=resolve;});
  await page.route('**/functions/v1/floor-plan-access',async route=>{
    markStarted();
    await released;
    await route.fulfill({status:200,headers:corsHeaders,contentType:'application/json',body:JSON.stringify({signed_url:'https://fixture-project.supabase.co/storage/v1/object/sign/floor-plan-private/fixture-1bhk.jpg?token=fixture',expires_in:300})});
  });
  await page.getByRole('button',{name:/view floor plan/i}).click();
  const form=page.locator('#resourceGateForm');
  await form.locator('[name="name"]').fill('Fixture Visitor');
  await form.locator('[name="phone"]').fill('+91 98765 43210');
  await form.locator('[name="consent"]').check();
  await form.getByRole('button',{name:'Send enquiry'}).click();
  await started;
  await page.locator('.resource-gate-close').click();
  releaseRequest();
  await expect(page.locator('#resourceGateDialog')).toBeHidden();
  await expect(page.locator('.resource-gate-note a')).toHaveCount(0);
  await expect(page.locator('.floor-plan-preview-thumb')).toHaveCount(0);
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

test('admin can manage each saved floor plan without deleting its source', async ({page}) => {
  await isolateNetwork(page);
  await page.addInitScript(()=>{window.__NXT_TEST_ADMIN__=true;});
  const listing={...detailFixture,id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',configurations:[
    {label:'1 BHK',floor_plans:[
      {path:'floor-plans/plan-a.jpg',name:'Plan A',type:'image/jpeg',visible:true,featured:true,sort_order:0},
      {path:'floor-plans/plan-b.jpg',name:'Plan B',type:'image/jpeg',visible:true,sort_order:1}
    ]},
    {label:'2 BHK',floor_plans:[{path:'floor-plans/plan-c.jpg',name:'Plan C',type:'image/jpeg',visible:true,featured:true,sort_order:0}]}
  ]};
  await page.route('**/rest/v1/properties*',route=>route.fulfill({status:200,headers:corsHeaders,contentType:'application/json',body:JSON.stringify([listing])}));
  await page.route('**/rest/v1/leads*',route=>route.fulfill({status:200,headers:corsHeaders,contentType:'application/json',body:'[]'}));
  await page.route('**/rest/v1/site_events*',route=>route.fulfill({status:200,headers:corsHeaders,contentType:'application/json',body:'[]'}));
  await page.goto('/admin.html');
  await expect(page.locator('#dashboard')).toBeVisible();
  await page.locator(`[data-edit="${listing.id}"]`).click();
  const plans=page.locator('.saved-media-row');
  await expect(plans).toHaveCount(3);
  const planB=plans.nth(1);
  await planB.locator('.plan-name').fill('Renamed plan B');
  await planB.locator('.plan-visibility input').uncheck();
  await planB.locator('.plan-featured input').check();
  await expect(planB.locator('.plan-visibility input')).toBeChecked();
  await expect(plans.first().locator('.plan-featured input')).not.toBeChecked();
  await planB.getByRole('button',{name:'Move floor plan up'}).click();
  await expect(plans.first().locator('.plan-name')).toHaveValue('Renamed plan B');
  await plans.first().locator('.plan-move').selectOption({label:'2 BHK'});
  const destinationPlans=page.locator('.configuration-row').nth(1).locator('.saved-media-row');
  await expect(destinationPlans).toHaveCount(2);
  await expect(destinationPlans.nth(0).locator('.plan-featured input')).not.toBeChecked();
  await expect(destinationPlans.nth(1).locator('.plan-featured input')).toBeChecked();
  await destinationPlans.nth(1).locator('.plan-replacement').setInputFiles(path.join(root,'assets/sai-world-dreams-logo.jpg'));
  await expect(page.locator('.configuration-row').nth(0).locator('.saved-media-row')).toHaveCount(1);
  await expect(destinationPlans).toHaveCount(2);
  await expect(destinationPlans.nth(1).locator('.plan-name')).toHaveValue('Renamed plan B');
  await expect(destinationPlans.nth(1).locator('.plan-visibility input')).toBeChecked();
  await expect(destinationPlans.nth(1).locator('.plan-replacement')).toHaveJSProperty('files.length',1);
  await expect(page.getByRole('button',{name:/keep uploaded file/i})).toHaveCount(3);
});

test('Sai World Dreams preview carousel, supplied photography, and responsive layout work', async ({ page, isMobile }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/listing-preview.html');

  const carousel = page.locator('.hero-carousel');
  await expect(carousel.locator('.hero-slide')).toHaveCount(4);
  await expect(carousel.locator('.hero-slide.is-active img')).toHaveAttribute('alt', /swimming pool/i);
  await expect(carousel.locator('.carousel-count')).toHaveText('01 / 04');
  await expect(carousel.getByRole('link', { name: /2 more photos/i })).toHaveAttribute('href', '#gallery');
  await expect(page.locator('#gallery .project-gallery img')).toHaveCount(6);
  await expect(page.locator('.listing-project-logo')).toBeVisible();
  await expect(page.locator('.listing-developer-logo')).toBeVisible();
  await expect(page.locator('.listing-developer-logo')).toHaveCSS('object-fit', 'contain');
  await expect(page.locator('.trustbar')).not.toContainText(/possession|rera/i);
  await expect(page.locator('.hero-tags')).not.toContainText(/dombivli/i);
  await expect(page.locator('.unit-plan-card')).toHaveCount(4);
  await expect(page.locator('.unit-plan-card img')).toHaveCount(0);
  await expect(page.locator('.unit-plan-card .plan-blur-art')).toHaveCount(4);
  expect(await page.locator('.unit-plan-card figcaption b').allTextContents()).toEqual(['1 BHK · Apartment layout','2 BHK · Apartment layout','2.5 BHK · Apartment layout','3 BHK · Apartment layout']);
  await expect(page.locator('.unit-plan-card .view-floor-plan').first()).toBeVisible();
  await page.locator('.view-floor-plan').first().click();
  await expect(page.locator('#enquiry-modal')).toBeVisible();
  await expect(page.locator('#modal-title')).toContainText('floor plan');
  await page.locator('.modal-close').click();

  await carousel.getByRole('button', { name: 'Next project photo' }).click();
  await expect(carousel.locator('.hero-slide.is-active img')).toHaveAttribute('alt', /aerial view/i);
  await expect(carousel.locator('.carousel-count')).toHaveText('02 / 04');
  if (isMobile) {
    await carousel.evaluate(element => {
      const start = new Event('touchstart');
      Object.defineProperty(start, 'changedTouches', { value: [{ clientX: 300 }] });
      element.dispatchEvent(start);
      const end = new Event('touchend');
      Object.defineProperty(end, 'changedTouches', { value: [{ clientX: 220 }] });
      element.dispatchEvent(end);
    });
    await expect(carousel.locator('.carousel-count')).toHaveText('03 / 04');
    await expect(carousel.locator('.hero-slide.is-active img')).toHaveAttribute('alt', /project entrance/i);
  }
  await carousel.getByRole('button', { name: 'Show photo 4' }).click();
  await expect(carousel.locator('.hero-slide.is-active img')).toHaveAttribute('alt', /roadside view/i);
  await carousel.getByRole('button', { name: 'Next project photo' }).click();
  await expect(carousel.locator('.carousel-count')).toHaveText('01 / 04');

  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    projectLogoWidth: document.querySelector('.listing-project-logo').getBoundingClientRect().width,
    developerLogoWidth: document.querySelector('.listing-developer-logo').getBoundingClientRect().width
  }));
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  expect(layout.projectLogoWidth).toBeGreaterThan(isMobile ? 55 : 90);
  expect(layout.developerLogoWidth).toBeGreaterThan(isMobile ? 120 : 175);
  expect(pageErrors).toEqual([]);
});

test('four preview plans stay gated after preview error, close, and mock completion', async ({page}) => {
  await page.goto('/listing-preview.html?demoError=1');
  const cards=page.locator('.unit-plan-card');
  await expect(cards).toHaveCount(4);
  await page.locator('.view-floor-plan').first().click();
  await page.locator('.modal-close').click();
  await expect(page.locator('#enquiry-modal')).toBeHidden();
  await expect(cards).toHaveCount(4);
  await page.locator('.view-floor-plan').first().click();
  const form=page.locator('#preview-enquiry-form');
  await form.locator('[name="name"]').fill('Preview Visitor');
  await form.locator('[name="mobile"]').fill('+91 98765 43210');
  await form.locator('[name="consent"]').check();
  await form.getByRole('button',{name:/request a callback/i}).click();
  await expect(page.locator('#preview-toast')).toContainText('no enquiry was sent');
  await expect(cards).toHaveCount(4);
  await expect(page.locator('.unit-plan-card img')).toHaveCount(0);
  await expect(page.locator('.unit-plan-card .plan-blur-art')).toHaveCount(4);
});

test('pricing cards reveal every owner-supplied size independently and preserve enquiry selection', async ({page}) => {
  await page.goto('/listing-preview.html');
  const expected = [
    ['1 BHK', ['450 sqft — ₹57.52 lakh', '473 sqft — ₹60.60 lakh', '477 sqft — ₹61.16 lakh']],
    ['2 BHK', ['609 sqft — ₹77.68 lakh', '711 sqft — ₹90.84 lakh', '720 sqft — ₹91.96 lakh', '730 sqft — ₹93.36 lakh', '733 sqft — ₹93.64 lakh']],
    ['2.5 BHK', ['825 sqft — ₹1.05 crore']],
    ['3 BHK', ['1,194 sqft — ₹1.51 crore', '1,322 sqft — ₹1.73 crore']]
  ];
  const cards = page.locator('.config-card');
  await expect(cards).toHaveCount(expected.length);
  for (let index = 0; index < expected.length; index++) {
    const [label, rows] = expected[index];
    const card = cards.nth(index);
    await expect(card.locator('.config-title')).toHaveText(label);
    const priceRows = card.locator('.price-options > a[data-config]');
    await expect(priceRows).toHaveCount(rows.length);
    const actualRows = await priceRows.evaluateAll(nodes => nodes.map(node =>
      `${node.querySelector('b').textContent.trim()} — ${node.querySelector('strong').textContent.trim()}`));
    expect(actualRows).toEqual(rows);
    await expect(priceRows.first()).toBeVisible();
    for (let row = 1; row < rows.length; row++) await expect(priceRows.nth(row)).toBeHidden();
    if (rows.length > 1) await expect(card.getByRole('button', {name: 'More sizes'})).toHaveAttribute('aria-expanded', 'false');
  }

  const oneBhk = cards.nth(0);
  const twoBhk = cards.nth(1);
  await oneBhk.getByRole('button', {name: 'More sizes'}).click();
  await expect(oneBhk.locator('.price-more-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(oneBhk.locator('.price-options > a[data-config]')).toHaveCount(3);
  await expect(twoBhk.locator('.price-options > a[data-config]').nth(1)).toBeHidden();
  await twoBhk.getByRole('button', {name: 'More sizes'}).click();
  await expect(twoBhk.locator('.price-options > a[data-config]').nth(4)).toBeVisible();

  await oneBhk.locator('a[data-config="1 BHK · 477 sqft"]').click();
  await expect(page.locator('#enquiry-modal')).toBeVisible();
  await expect(page.locator('#preview-enquiry-form [name="configuration"]')).toHaveValue('1 BHK · 477 sqft');
  const allOptions = await page.locator('#preview-enquiry-form [name="configuration"] option').allTextContents();
  const normalizedOptions = allOptions.join(' ').replace(/,/g, '');
  for (const [, rows] of expected) for (const row of rows) expect(normalizedOptions).toContain(row.split(' — ')[0].replace(/,/g, ''));
});
