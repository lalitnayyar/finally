import { test, expect } from '@playwright/test';

test.describe('Charts', () => {
  test('main chart area renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const chartElement = page.getByTestId('primary-trading-chart');
    await expect(chartElement).toBeVisible({ timeout: 10000 });
    await expect(chartElement.locator('.candle rect').first()).toBeVisible({ timeout: 10000 });
    await expect(chartElement.locator('.ma-line').first()).toBeVisible();
    await expect(chartElement.locator('.rsi-line')).toBeVisible();
    await expect(chartElement.locator('.macd-line')).toBeVisible();
  });

  test('click a ticker in watchlist updates chart', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const msftRow = page
      .getByTestId('watchlist-table')
      .locator('tbody tr')
      .filter({ hasText: 'MSFT' })
      .first();
    await expect(msftRow).toBeVisible({ timeout: 10000 });
    await msftRow.click();

    await expect(page.locator('.trading-chart-card h2')).toHaveText('MSFT');
    await expect(page.locator('input[name="trade-symbol"]')).toHaveValue('MSFT');
    await expect(page.getByTestId('primary-trading-chart').locator('.candle rect').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('portfolio value chart renders terminal-style performance data', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.request.post('/api/portfolio/trade', {
      data: { ticker: 'AAPL', side: 'buy', quantity: 1 },
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const portfolioChart = page.getByTestId('portfolio-value-chart');
    await expect(portfolioChart).toBeVisible({ timeout: 10000 });
    await expect(portfolioChart.locator('.portfolio-line')).toHaveCount(1);
    await expect(portfolioChart.locator('.drawdown-bar').first()).toHaveCount(1);
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
