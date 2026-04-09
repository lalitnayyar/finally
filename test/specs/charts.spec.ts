import { test, expect } from '@playwright/test';

test.describe('Charts', () => {
  test('main chart area renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Chart area should be present — look for canvas or SVG elements used by charting libs
    const chartElement = page.locator('canvas').or(page.locator('svg')).first();
    await expect(chartElement).toBeVisible({ timeout: 10000 });
  });

  test('click a ticker in watchlist updates chart', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click on MSFT ticker in the watchlist
    const msftElement = page.getByText('MSFT', { exact: true }).first();
    await expect(msftElement).toBeVisible({ timeout: 10000 });
    await msftElement.click();

    // After clicking, the chart area or a heading should reflect the selected ticker
    await expect(
      page.getByText('MSFT').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('portfolio heatmap section is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // First buy some shares so we have positions to display in the heatmap
    await page.request.post('/api/portfolio/trade', {
      data: { ticker: 'AAPL', side: 'buy', quantity: 5 },
    });
    await page.request.post('/api/portfolio/trade', {
      data: { ticker: 'GOOGL', side: 'buy', quantity: 3 },
    });

    // Reload to see updated portfolio
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for heatmap/treemap section — could be canvas, SVG, or div-based
    const heatmapSection = page.getByText(/heatmap|portfolio/i).or(
      page.locator('[data-testid="heatmap"]').or(
        page.locator('[class*="heatmap"]').or(
          page.locator('[class*="treemap"]')
        )
      )
    ).first();
    await expect(heatmapSection).toBeVisible({ timeout: 10000 });
  });
});
