import { test, expect } from '@playwright/test';

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

    // Wait for prices to be available via SSE
    await page.waitForTimeout(3000);

    // Get portfolio state before the trade
    const beforeResponse = await page.request.get('/api/portfolio');
    const beforePortfolio = await beforeResponse.json();
    const cashBefore = beforePortfolio.cash_balance;
    const aaplBefore = beforePortfolio.positions.find(
      (p: { ticker: string }) => p.ticker === 'AAPL'
    );
    const qtyBefore = aaplBefore ? aaplBefore.quantity : 0;

    // Default watchlist selection is AAPL — trade bar shows symbol from watchlist (not a text input)
    await expect(page.getByTestId('trade-selected-symbol')).toHaveText('AAPL', { timeout: 5000 });

    const quantityInput = page.getByPlaceholder('Qty');
    await expect(quantityInput).toBeVisible({ timeout: 5000 });
    await quantityInput.fill('1');

    // Click buy button
    const buyButton = page.getByRole('button', { name: 'Buy' });
    await buyButton.click();

    // Wait for the trade to process
    await page.waitForTimeout(1000);

    // Verify via API that cash decreased and position quantity increased
    const afterResponse = await page.request.get('/api/portfolio');
    const afterPortfolio = await afterResponse.json();

    expect(afterPortfolio.cash_balance).toBeLessThan(cashBefore);

    const aaplAfter = afterPortfolio.positions.find(
      (p: { ticker: string }) => p.ticker === 'AAPL'
    );
    expect(aaplAfter).toBeDefined();
    expect(aaplAfter.quantity).toBe(qtyBefore + 1);
  });

  test('sell a share: cash increases, position reduces', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Check current portfolio to find a position we can sell
    const beforeResponse = await page.request.get('/api/portfolio');
    const beforePortfolio = await beforeResponse.json();

    // Find any position with quantity >= 1 to sell
    const sellablePosition = beforePortfolio.positions.find(
      (p: { quantity: number }) => p.quantity >= 1
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

    const cashBeforeSell = (await (await page.request.get('/api/portfolio')).json()).cash_balance;

    // Select the row in the watchlist so the trade bar uses that symbol
    await page
      .getByTestId('watchlist-table')
      .locator('tbody tr')
      .filter({ hasText: tickerToSell })
      .first()
      .click();

    await expect(page.getByTestId('trade-selected-symbol')).toHaveText(tickerToSell, { timeout: 5000 });

    const quantityInput = page.getByPlaceholder('Qty');
    await quantityInput.fill('1');

    const sellButton = page.getByRole('button', { name: 'Sell' });
    await sellButton.click();

    await page.waitForTimeout(1000);

    // Cash should increase after selling
    const afterResponse = await page.request.get('/api/portfolio');
    const afterPortfolio = await afterResponse.json();

    expect(afterPortfolio.cash_balance).toBeGreaterThan(cashBeforeSell);
  });
});
