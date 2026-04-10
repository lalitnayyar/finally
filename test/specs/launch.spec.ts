import { expect, test } from '@playwright/test';

test.describe('Launch path smoke', () => {
  test('loads the workstation shell and same-origin health endpoint', async ({ page, request }) => {
    const root = await request.get('/');
    expect(root.ok()).toBeTruthy();
    await page.setContent(await root.text());

    await expect(page.getByRole('heading', { name: 'FinAlly' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Watchlist' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI Copilot' })).toBeVisible();
    await expect(page.getByTestId('watchlist-table')).toBeVisible();
    await expect(page.getByText('Educational application by Lalit Nayyar')).toBeVisible();
    await expect(page.getByText('lalitnayyar@gmail.com')).toBeVisible();

    const health = await request.get('/api/health');
    expect(health.ok()).toBeTruthy();
    await expect(health.json()).resolves.toEqual({ status: 'ok' });
  });
});
