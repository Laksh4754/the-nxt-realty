import { test, expect } from '@playwright/test';

async function openHome(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Explore properties' })).toBeVisible();
  const countText = page.locator('#resultsCount');
  await expect(countText).toContainText(/^\d+ properties? found$/);
  const count = Number((await countText.innerText()).match(/^(\d+) properties? found$/)?.[1]);
  expect(count, 'published listings must load and provide detail coverage').toBeGreaterThan(0);
}

test('homepage resources and published property cards resolve', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await openHome(page);

  await expect(page.locator('#quickFilters button')).toHaveCount(4);
  const countText = await page.locator('#resultsCount').innerText();
  const count = Number(countText.match(/^(\d+) properties? found$/)?.[1]);
  expect(countText, 'published listings must load successfully').toMatch(/^\d+ properties? found$/);
  expect(count, 'at least one published listing is required for detail coverage').toBeGreaterThan(0);
  await expect(page.locator('.property-card')).toHaveCount(count);
  await expect(page.locator('#propertyGrid')).toBeVisible();
  expect(await pageErrors).toEqual([]);
});

test('homepage category and budget filters behave consistently', async ({ page }) => {
  await openHome(page);
  await page.locator('.chip[data-filter="Resale"]').click();
  await expect(page.locator('.chip[data-filter="Resale"]')).toHaveClass(/active/);
  const resaleCards = page.locator('.property-card');
  const resaleCount = await resaleCards.count();
  if (resaleCount > 0) {
    for (const card of await resaleCards.all()) {
      await expect(card.locator('.tag')).toContainText(/resale/i);
    }
  } else {
    await expect(page.locator('#emptyState')).toBeVisible();
  }

  await page.locator('.chip[data-filter="All"]').click();
  await expect(page.locator('.chip[data-filter="All"]')).toHaveClass(/active/);
  const before = await page.locator('.property-card').evaluateAll(cards =>
    cards.map(card => ({
      id: card.dataset.id,
      price: card.querySelector('.price')?.textContent.trim()
    }))
  );
  await page.locator('#minBudgetFilter').selectOption('10000000');
  await page.locator('#budgetFilter').selectOption('3000000');
  await page.getByRole('button', { name: /Search homes/ }).click();
  await expect(page.locator('#resultsCount')).not.toContainText('Loading');
  const remainingIds = await page.locator('.property-card').evaluateAll(cards => cards.map(card => card.dataset.id));
  const onlyUnpricedListings = before.filter(item => item.price === 'Price on request').map(item => item.id);
  expect(remainingIds.sort()).toEqual(onlyUnpricedListings.sort());
});

test('a published card opens its property detail page', async ({ page }) => {
  await openHome(page);
  const cards = page.locator('.property-card');
  await expect(cards).not.toHaveCount(0);
  await cards.first().click();
  await expect(page).toHaveURL(/property\.html\?id=/);
  const detail = page.locator('#propertyDetail');
  await expect(detail).not.toContainText('Loading property details');
  await expect(detail).not.toContainText(/unavailable|could not load|temporarily unavailable/i);
  await expect(detail.locator('h1')).toBeVisible();
});

test('enquiry form validates required fields and consent without submitting a lead', async ({ page }) => {
  const leadRequests = [];
  await page.route(/\/rest\/v1\/leads(?:\?|$)/i, async route => {
    leadRequests.push(route.request().url());
    await route.abort();
  });

  await page.goto('/');
  const form = page.locator('#enquiryForm');
  const name = form.locator('[name="name"]');
  const phone = form.locator('[name="phone"]');
  const consent = form.locator('[name="consent"]');
  const submit = form.getByRole('button', { name: /Continue on WhatsApp/ });

  await expect(form).toBeVisible();
  await expect(name).toHaveAttribute('required', '');
  await expect(phone).toHaveAttribute('required', '');
  await expect(phone).toHaveAttribute('pattern', '\\+?[0-9][0-9 ]{6,16}[0-9]');
  await expect(consent).toHaveAttribute('required', '');
  await expect(form.locator('#formNote')).toContainText(/respond to this enquiry/i);

  await submit.click();
  await expect(name).toBeFocused();
  expect(await form.evaluate(element => element.checkValidity())).toBe(false);

  await name.fill('Smoke Test');
  await phone.fill('abcdefgh');
  expect(await phone.evaluate(input => input.validity.valid)).toBe(false);
  await phone.fill('+91 98765 43210');
  await submit.click();
  await expect(consent).toBeFocused();
  expect(await form.evaluate(element => element.checkValidity())).toBe(false);
  expect(leadRequests).toEqual([]);
});

test('admin page presents the sign-in screen in a clean browser context', async ({ page }) => {
  await page.goto('/admin.html');
  await expect(page.getByRole('heading', { name: 'Admin workspace' })).toBeVisible();
  await expect(page.locator('#loginPanel')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Administrator sign in' })).toBeVisible();
  await expect(page.locator('#dashboard')).toBeHidden();
});
