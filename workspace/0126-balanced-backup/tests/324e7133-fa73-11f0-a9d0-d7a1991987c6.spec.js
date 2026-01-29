import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e7133-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Space Complexity Demonstration (FSM: Idle -> Calculated)', () => {
  // Shared holders for console and page errors per test to assert and inspect
  test.beforeEach(async ({ page }) => {
    // Attach listeners early to capture any errors that occur during load
    page.__consoleMessages = [];
    page.__pageErrors = [];

    page.on('console', msg => {
      page.__consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', err => {
      // pageerror receives an Error object
      page.__pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Basic cleanup: remove listeners to not leak memory if Playwright keeps the page instance
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Idle state: page loads and renders three calculation buttons and an output container', async ({ page }) => {
    // This test validates the initial "Idle" state as defined by the FSM:
    // - renderPage() was expected as an entry action in the FSM, but the HTML does not define it.
    // - There should be three buttons with the expected labels and an #output div.
    const buttons = page.locator('button.btn');
    await expect(buttons).toHaveCount(3);

    // Validate the text of each button matches the FSM evidence
    await expect(buttons.nth(0)).toHaveText('Calculate Space for Array of Size 5');
    await expect(buttons.nth(1)).toHaveText('Calculate Space for Array of Size 10');
    await expect(buttons.nth(2)).toHaveText('Calculate Space for Array of Size 16');

    // Validate #output exists and is initially empty (no .complexity child)
    const output = page.locator('#output');
    await expect(output).toBeVisible();
    await expect(output).toBeEmpty();

    // Assert that no page runtime errors occurred during initial load
    expect(page.__pageErrors.length).toBe(0);

    // Collect any console messages - there should not be console.error items on a healthy load
    const consoleErrors = page.__consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Transitions: clicking each Calculate button moves to Calculated state and displays correct output', () => {
    // Test the three FSM events/transitions: CalculateSpace5, CalculateSpace10, CalculateSpace16
    test('CalculateSpace5: click the Size 5 button shows Input Size 5 and Total Space Used 8', async ({ page }) => {
      // Click the first button that uses onclick calculateSpace(['a','b','c','d','e'])
      const btn5 = page.locator('.btn[onclick="calculateSpace([\'a\', \'b\', \'c\', \'d\', \'e\'])"]');
      await expect(btn5).toBeVisible();
      await btn5.click();

      // Wait for the computed output to appear and validate content
      const complexityBox = page.locator('#output .complexity');
      await expect(complexityBox).toBeVisible();
      const text = await complexityBox.textContent();

      expect(text).toContain('Input Size: 5');
      // constantSpace = 3, so total = 5 + 3 = 8
      expect(text).toContain('Total Space Used: 8');
      expect(text).toContain('Space Complexity: O(n) where n is the size of the array (5).');

      // No page errors should have been thrown as a result of clicking
      expect(page.__pageErrors.length).toBe(0);

      // No console.error messages should have been emitted
      const consoleErrors = page.__consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('CalculateSpace10: click the Size 10 button shows Input Size 10 and Total Space Used 13', async ({ page }) => {
      const btn10 = page.locator('.btn[onclick="calculateSpace([\'a\', \'b\', \'c\', \'d\', \'e\', \'f\', \'g\', \'h\', \'i\', \'j\'])"]');
      await expect(btn10).toBeVisible();
      await btn10.click();

      const complexityBox = page.locator('#output .complexity');
      await expect(complexityBox).toBeVisible();
      const text = await complexityBox.textContent();

      expect(text).toContain('Input Size: 10');
      // 10 + 3 = 13
      expect(text).toContain('Total Space Used: 13');
      expect(text).toContain('Space Complexity: O(n) where n is the size of the array (10).');

      expect(page.__pageErrors.length).toBe(0);
      const consoleErrors = page.__consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('CalculateSpace16: click the Size 16 button shows Input Size 16 and Total Space Used 19', async ({ page }) => {
      const btn16 = page.locator('.btn[onclick="calculateSpace([\'a\', \'b\', \'c\', \'d\', \'e\', \'f\', \'g\', \'h\', \'i\', \'j\', \'k\', \'l\', \'m\', \'n\', \'o\', \'p\'])"]');
      await expect(btn16).toBeVisible();
      await btn16.click();

      const complexityBox = page.locator('#output .complexity');
      await expect(complexityBox).toBeVisible();
      const text = await complexityBox.textContent();

      expect(text).toContain('Input Size: 16');
      // 16 + 3 = 19
      expect(text).toContain('Total Space Used: 19');
      expect(text).toContain('Space Complexity: O(n) where n is the size of the array (16).');

      expect(page.__pageErrors.length).toBe(0);
      const consoleErrors = page.__consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases, onEnter/onExit expectations, and console/page error observations', () => {
    test('Edge case: calling calculateSpace with an empty array (0 elements) displays Input Size 0 and Total Space Used 3)', async ({ page }) => {
      // Use page.evaluate to call the page-defined function directly with an empty array.
      // This does not inject globals; it uses the functions already defined by the page.
      await page.evaluate(() => {
        // Intentionally call the existing function defined on the page
        // If calculateSpace is not defined this will throw a ReferenceError in the page context and be captured by pageerror.
        // We allow that natural error to occur (per the test instructions) and then assert expected behavior.
        if (typeof calculateSpace === 'function') {
          calculateSpace([]);
        }
      });

      const complexityBox = page.locator('#output .complexity');
      await expect(complexityBox).toBeVisible();
      const text = await complexityBox.textContent();

      expect(text).toContain('Input Size: 0');
      // 0 + 3 = 3
      expect(text).toContain('Total Space Used: 3');
      expect(text).toContain('Space Complexity: O(n) where n is the size of the array (0).');

      // Ensure no page errors were raised by this operation
      expect(page.__pageErrors.length).toBe(0);
    });

    test('FSM onEnter action renderPage() is not defined on the page (validate discrepancy)', async ({ page }) => {
      // The FSM listed renderPage() as an entry action. The implementation does not provide renderPage.
      // We assert that renderPage is undefined to show this mismatch (without attempting to invoke it).
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');
    });

    test('Observe console and pageerror events: capture and report any runtime exceptions (there should be none)', async ({ page }) => {
      // After normal interactions above, there should be no console.error or pageerror entries.
      // This test explicitly inspects the captured messages and errors arrays and asserts they are empty.
      const consoleErrors = page.__consoleMessages.filter(m => m.type === 'error');
      // If any console error messages exist, fail with details to aid debugging.
      expect(consoleErrors.length, `Console errors were logged: ${JSON.stringify(consoleErrors)}`).toBe(0);

      // Assert no page errors (uncaught exceptions) occurred
      expect(page.__pageErrors.length, `Page errors were thrown: ${JSON.stringify(page.__pageErrors)}`).toBe(0);
    });
  });
});