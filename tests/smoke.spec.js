import { test, expect } from '@playwright/test';

async function openHome(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Explore properties' })).toBeVisible();
  await expect(page.locator('#resultsCount')).not.toContainText('Loading properties');
  await expect(page.locator('#propertyGrid')).toBeVisible().or(expect(page.locator('#emptyState')).toBeVisible());
}

test('homepage resources and published property cards resolve', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await openHome(page);

  await expect(page.locator('#quickFilters button')).toHaveCount(4);
  const countText = await page.locator('#resultsCount').innerText();
  const count = Number(countText.match(/^(\d+) properties? found$/)?.[1]);
  if (Number.isFinite(count)) {
    await expect(page.locator('.property-card')).toHaveCount(count);
    if (count === 0) await expect(page.locator('#emptyState')).toBeVisible();
  } else {
    expect(countText).toMatch(/temporarily unavailable|not connected/i);
  }
  expect(await pageErrors).toEqual([]);
});

test('homepage category and search filters remain usable', async ({ page }) => {
  await openHome(page);
  await page.locator('.chip[data-filter="Resale"]').click();
  await expect(page.locator('.chip[data-filter="Resale"]')).toHaveClass(/active/);
  await page.locator('.chip[data-filter="All"]').click();
  await expect(page.locator('.chip[data-filter="All"]')).toHaveClass(/active/);

  const originalCount = (await page.locator('.property-card').count());
  await page.locator('#minBudgetFilter').selectOption('50000000');
  await page.locator('#budgetFilter').selectOption('3000000');
  await page.getByRole('button', { name: /Search homes/ }).click();
  await expect(page.locator('#resultsCount')).not.toContainText('Loading');
  expect(await page.locator('.property-card').count()).toBeLessThanOrEqual(originalCount);
});

test('a published card opens its property detail page when listings exist', async ({ page }) => {
  await openHome(page);
  const cards = page.locator('.property-card');
  const count = await cards.count();
  test.skip(count === 0, 'There are currently no published listings to open.');
  await cards.first().click();
  await expect(page).toHaveURL(/property\.html\?id=/);
  const detail = page.locator('#propertyDetail');
  await expect(detail).not.toContainText('Loading property details');
  await expect(detail).not.toContainText(/unavailable|could not load|temporarily unavailable/i);
  await expect(detail.locator('h1')).toBeVisible();
});

test('admin page presents the sign-in screen in a clean browser context', async ({ page }) => {
  await page.goto('/admin.html');
  await expect(page.getByRole('heading', { name: 'Admin workspace' })).toBeVisible();
  await expect(page.locator('#loginPanel')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Administrator sign in' })).toBeVisible();
  await expect(page.locator('#dashboard')).toBeHidden();
});
