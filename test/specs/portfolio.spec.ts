import { test, expect, type Page } from '@playwright/test';

type Position = {
  ticker: string;
  quantity: number;
};

type PortfolioResponse = {
  cash_balance: number;
  positions: Position[];
};

async function getPortfolio(page: Page) {
  const response = await page.request.get('/api/portfolio');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as PortfolioResponse;
}

function formatCash(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

test.describe('Portfolio', () => {
  test('portfolio and cash balance are displayed', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // The header shows "Portfolio" and "Cash" labels with dollar amounts
    await expect(page.getByText('Portfolio').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Cash').first()).toBeVisible({ timeout: 10000 });

    // At least one dollar amount should be visible (formatted with $ and commas)
    await expect(page.locator('text=/\\$[\\d,]+\\.\\d{2}/').first()).toBeVisible({ timeout: 10000 });
  });

  test('buy 1 share of AAPL: cash decreases, position appears', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.waitForSelector('[data-testid="watchlist-table"] tbody tr', { timeout: 10000 });
    await page.waitForTimeout(3000);

    // Get portfolio state before the trade
    const beforePortfolio = await getPortfolio(page);
    const cashBefore = beforePortfolio.cash_balance;
    const row = page.getByTestId('watchlist-table').locator('tbody tr').nth(1);
    const selectedTicker = (await row.locator('.ticker-cell').innerText()).trim();
    const positionBefore = beforePortfolio.positions.find((p) => p.ticker === selectedTicker);
    const qtyBefore = positionBefore ? positionBefore.quantity : 0;

    // User flow: click a ticker in the watchlist, enter quantity, then buy.
    await row.click();

    const symbolInput = page.locator('input[name="trade-symbol"]');
    await expect(symbolInput).toBeVisible({ timeout: 5000 });
    await expect(symbolInput).toHaveValue(selectedTicker);

    const quantityInput = page.getByPlaceholder('Qty');
    await expect(quantityInput).toBeVisible({ timeout: 5000 });
    await quantityInput.fill('1');

    // Click buy button
    const buyButton = page.getByRole('button', { name: 'Buy' });
    const tradeResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/portfolio/trade') &&
        response.request().method() === 'POST',
    );
    await buyButton.click();
    const tradeResponse = await tradeResponsePromise;
    expect(tradeResponse.ok()).toBeTruthy();
    await expect(page.getByRole('button', { name: 'Buy' })).toBeVisible({ timeout: 5000 });

    // Verify via API that cash decreased and position quantity increased
    const afterPortfolio = await getPortfolio(page);

    expect(afterPortfolio.cash_balance).toBeLessThan(cashBefore);

    const positionAfter = afterPortfolio.positions.find((p) => p.ticker === selectedTicker);
    expect(positionAfter).toBeDefined();
    expect(positionAfter.quantity).toBe(qtyBefore + 1);

    const positionsPanel = page.locator('article', { hasText: 'Positions' });
    await expect(page.getByTestId('portfolio-cash')).not.toHaveText(formatCash(cashBefore));
    await expect(positionsPanel).toContainText(selectedTicker);
    await expect(positionsPanel).toContainText(String(qtyBefore + 1));
    await expect(page.locator('.inline-success')).toContainText(`BUY 1 ${selectedTicker}`);
    await expect(page.locator('.inline-error')).toHaveCount(0);
  });

  test('sell a share: cash increases, position reduces', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Check current portfolio to find a position we can sell
    const beforePortfolio = await getPortfolio(page);

    // Find any position with quantity >= 1 to sell
    const sellablePosition = beforePortfolio.positions.find(
      (p) => p.quantity >= 1
    );

    // If no position exists, buy one first (use a cheap ticker amount)
    let tickerToSell: string;
    if (sellablePosition) {
      tickerToSell = sellablePosition.ticker;
    } else {
      // Buy 1 share via API first
      const buyResponse = await page.request.post('/api/portfolio/trade', {
        data: { ticker: 'AAPL', side: 'buy', quantity: 1 },
      });
      expect(buyResponse.ok()).toBeTruthy();
      tickerToSell = 'AAPL';
    }

    const portfolioBeforeSell = await getPortfolio(page);
    const cashBeforeSell = portfolioBeforeSell.cash_balance;
    const positionBeforeSell = portfolioBeforeSell.positions.find((p) => p.ticker === tickerToSell);
    const quantityBeforeSell = positionBeforeSell ? positionBeforeSell.quantity : 1;

    await page.waitForSelector('[data-testid="watchlist-table"] tbody tr', { timeout: 10000 });
    const sellRow = page
      .getByTestId('watchlist-table')
      .locator('tbody tr')
      .filter({ hasText: tickerToSell })
      .first();
    await expect(sellRow).toBeVisible({ timeout: 10000 });
    await sellRow.click();

    const symbolInput = page.locator('input[name="trade-symbol"]');
    await expect(symbolInput).toBeVisible({ timeout: 5000 });
    await expect(symbolInput).toHaveValue(tickerToSell);

    const quantityInput = page.getByPlaceholder('Qty');
    await quantityInput.fill('1');

    const sellButton = page.getByRole('button', { name: 'Sell' });
    const tradeResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/portfolio/trade') &&
        response.request().method() === 'POST',
    );
    await sellButton.click();
    const tradeResponse = await tradeResponsePromise;
    expect(tradeResponse.ok()).toBeTruthy();
    await expect(page.getByRole('button', { name: 'Sell' })).toBeVisible({ timeout: 5000 });

    // Cash should increase after selling
    const afterPortfolio = await getPortfolio(page);

    expect(afterPortfolio.cash_balance).toBeGreaterThan(cashBeforeSell);

    const positionAfterSell = afterPortfolio.positions.find((p) => p.ticker === tickerToSell);
    expect(positionAfterSell?.quantity ?? 0).toBe(quantityBeforeSell - 1);
    await expect(page.locator('.inline-error')).toHaveCount(0);
  });

  test('selected ticker trade controls stay usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[data-testid="watchlist-table"] tbody tr', { timeout: 10000 });

    const row = page.getByTestId('watchlist-table').locator('tbody tr').nth(1);
    const selectedTicker = (await row.locator('.ticker-cell').innerText()).trim();
    await row.click();

    await expect(page.locator('.trading-chart-card h2')).toHaveText(selectedTicker);
    await expect(page.getByTestId('primary-trading-chart')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[name="trade-symbol"]')).toHaveValue(selectedTicker);
    await expect(page.getByPlaceholder('Qty')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buy' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sell' })).toBeVisible();
  });
});
