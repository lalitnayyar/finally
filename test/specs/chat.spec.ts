import { test, expect } from '@playwright/test';

test.describe('AI Chat (LLM_MOCK=true)', () => {
  test('chat panel is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Look for chat panel — input field or chat-related UI element
    const chatInput = page.getByPlaceholder(/message|chat|ask/i).or(
      page.locator('[data-testid="chat-input"]')
    ).first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
  });

  test('type a message and receive a response', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Find chat input
    const chatInput = page.getByPlaceholder(/message|chat|ask/i).or(
      page.locator('[data-testid="chat-input"]')
    ).first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Type a message
    await chatInput.fill('How is my portfolio doing?');

    // Submit — press Enter or click send button
    const sendButton = page.getByTestId('chat-send');

    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await chatInput.press('Enter');
    }

    // Wait for mock response — should contain "mock response" text
    await expect(
      page.getByText(/mock response|portfolio looks great/i).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(sendButton).toHaveText('Send');
    await expect(sendButton).toBeDisabled();
  });

  test('no JavaScript errors in console during chat', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const chatInput = page.getByPlaceholder(/message|chat|ask/i).or(
      page.locator('[data-testid="chat-input"]')
    ).first();

    if (await chatInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatInput.fill('Hello');
      await chatInput.press('Enter');
      await page.waitForTimeout(3000);
    }

    // Filter out non-critical errors (e.g., third-party script errors)
    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Script error')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
