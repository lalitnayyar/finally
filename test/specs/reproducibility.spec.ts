import { expect, test } from '@playwright/test';

test.describe('Reproducibility', () => {
  test('serves current generated Next assets from the root document', async ({ page, request }) => {
    const response = await request.get('/');
    expect(response.ok()).toBeTruthy();

    const html = await response.text();
    await page.setContent(html);
    expect(html).toContain('/_next/static/');

    const assetPaths = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)]
      .map((match) => match[1])
      .filter((value, index, all) => all.indexOf(value) === index);

    expect(assetPaths.length).toBeGreaterThan(0);

    for (const assetPath of assetPaths.slice(0, 4)) {
      const assetResponse = await request.get(assetPath);
      expect(assetResponse.ok(), `${assetPath} should be reachable`).toBeTruthy();
    }
  });
});
