import { test, expect } from '@playwright/test';

test.describe('Connection Status', () => {
  test('connection status indicator is visible in header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // The header has a colored dot (div with rounded-full) next to status text
    const statusDot = page.locator('header .rounded-full').first();
    await expect(statusDot).toBeVisible({ timeout: 10000 });

    // Status text "disconnected" or "connected" is inside a span in the header
    const statusText = page.locator('header span', { hasText: /^(connected|reconnecting|disconnected)$/ });
    await expect(statusText).toBeVisible({ timeout: 10000 });
  });

  test('after page load, indicator shows connected state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for SSE connection to establish and status to update
    const connectedSpan = page.locator('header span', { hasText: 'connected' });
    await expect(connectedSpan).toBeVisible({ timeout: 15000 });
  });

  test('SSE stream delivers price updates', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for prices to appear in the watchlist via SSE
    // Prices show as numbers with decimal points (e.g., 190.32)
    await page.waitForTimeout(3000);

    // Verify that at least one price value appears in the watchlist table
    const priceCell = page.locator('table td').filter({ hasText: /^\d+\.\d{2}$/ }).first();
    await expect(priceCell).toBeVisible({ timeout: 10000 });
  });
});
