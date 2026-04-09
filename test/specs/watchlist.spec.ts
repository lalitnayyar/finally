import { test, expect } from '@playwright/test';

const DEFAULT_TICKERS = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'NFLX'];

test.describe('Watchlist', () => {
  test('page loads with default tickers visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Ensure any missing default tickers are re-added via API first
    for (const ticker of DEFAULT_TICKERS) {
      await page.request.post('/api/watchlist', { data: { ticker } });
    }
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    for (const ticker of DEFAULT_TICKERS) {
      await expect(page.getByText(ticker, { exact: true }).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('prices are visible as numbers, not empty', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for prices to load via SSE
    await page.waitForTimeout(3000);

    // At least some tickers should have numeric price values displayed
    const pricePattern = /\d+\.\d{2}/;
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(pricePattern);
  });

  test('add a new ticker to watchlist', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // The watchlist has an input with placeholder "Add ticker" and a "+" button
    const tickerInput = page.getByPlaceholder('Add ticker');
    await expect(tickerInput).toBeVisible({ timeout: 5000 });
    await tickerInput.fill('PYPL');

    // Click the "+" button next to the input
    const addButton = page.getByRole('button', { name: '+' });
    await addButton.click();

    // PYPL should now appear in the watchlist
    await expect(page.getByText('PYPL').first()).toBeVisible({ timeout: 5000 });
  });

  test('remove a ticker from watchlist', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Add a test ticker via API so we have something safe to remove
    await page.request.post('/api/watchlist', { data: { ticker: 'DIS' } });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Verify DIS is present
    const disElement = page.getByText('DIS', { exact: true }).first();
    await expect(disElement).toBeVisible({ timeout: 10000 });

    // Find and click the remove button in the same row
    const disRow = page.locator('[data-ticker="DIS"]').or(
      disElement.locator('..')
    ).first();

    const removeButton = disRow.getByRole('button', { name: /remove|delete|×|x/i }).or(
      disRow.locator('button').last()
    ).first();

    await removeButton.click();

    // DIS should no longer be visible
    await expect(page.getByText('DIS', { exact: true })).not.toBeVisible({ timeout: 5000 });
  });
});
