import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e7132-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object for the Time Complexity Demonstration app.
 * Encapsulates common interactions and queries to keep tests readable.
 */
class TimeComplexityPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.constantBtn = page.locator('#constant-time');
    this.linearBtn = page.locator('#linear-time');
    this.quadraticBtn = page.locator('#quadratic-time');
    this.result = page.locator('#result');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  async clickConstant() {
    await this.constantBtn.click();
  }

  async clickLinear() {
    await this.linearBtn.click();
  }

  async clickQuadratic() {
    await this.quadraticBtn.click();
  }

  async getResultText() {
    return await this.result.innerText();
  }

  async headerText() {
    return await this.header.innerText();
  }

  async isResultEmpty() {
    const text = await this.getResultText();
    return text.trim().length === 0;
  }

  // Wait for result to be non-empty (with timeout)
  async waitForNonEmptyResult(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('result');
      return el && el.innerText && el.innerText.trim().length > 0;
    }, null, { timeout });
  }
}

test.describe('Time Complexity Demonstration - FSM validation', () => {
  // Shared error collectors for console errors and page errors.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location ? msg.location() : null,
          });
        }
      } catch (e) {
        // If inspection fails, still push minimal info
        consoleErrors.push({ text: String(msg), location: null });
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
  });

  test.afterEach(async () => {
    // After each test ensure there's no unexpected console or page errors.
    // These expectations are repeated in tests as well, but kept here as a safety net.
    expect(consoleErrors, `Console errors were logged: ${JSON.stringify(consoleErrors, null, 2)}`).toEqual([]);
    expect(pageErrors, `Page errors were emitted: ${JSON.stringify(pageErrors, null, 2)}`).toEqual([]);
  });

  test('S0_Idle - initial render shows heading, buttons and empty result', async ({ page }) => {
    // Validate that initial state (Idle) rendered correctly.
    const app = new TimeComplexityPage(page);

    // Header presence and text
    await expect(app.header).toBeVisible();
    const headerText = await app.headerText();
    expect(headerText).toBe('Time Complexity Demonstration');

    // Buttons exist and are visible
    await expect(app.constantBtn).toBeVisible();
    await expect(app.linearBtn).toBeVisible();
    await expect(app.quadraticBtn).toBeVisible();

    // Result area should be present and initially empty
    await expect(app.result).toBeVisible();
    const resultEmpty = await app.isResultEmpty();
    expect(resultEmpty).toBe(true);

    // Assert no console or page errors occurred during load
    expect(consoleErrors.length, 'Expected no console.error messages on initial load').toBe(0);
    expect(pageErrors.length, 'Expected no page errors on initial load').toBe(0);

    // Specifically assert that no ReferenceError/TypeError/SyntaxError occurred
    const errorNames = pageErrors.map(e => e.name);
    expect(errorNames.includes('ReferenceError')).toBe(false);
    expect(errorNames.includes('TypeError')).toBe(false);
    expect(errorNames.includes('SyntaxError')).toBe(false);
  });

  test('S1_ConstantTime - clicking constant button sets exact constant-time message', async ({ page }) => {
    // This validates the transition from Idle -> ConstantTime (S0 -> S1)
    const app1 = new TimeComplexityPage(page);

    // Click the constant time button and wait for result update.
    await app.clickConstant();
    await app.waitForNonEmptyResult();

    const resultText = await app.getResultText();

    // Expected exact message as per FSM/implementation
    const expected = "O(1) - Constant Time: This operation takes the same amount of time regardless of input size.";
    expect(resultText).toBe(expected);

    // Validate that no console/page errors occurred during the action
    expect(consoleErrors.length, `Console errors during constantTime: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors during constantTime: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('S2_LinearTime - clicking linear button shows linear-time message starting with expected prefix', async ({ page }) => {
    // This validates the transition from Idle -> LinearTime (S0 -> S2)
    const app2 = new TimeComplexityPage(page);

    // Click the linear time button and wait for result update.
    // Note: Implementation runs linearTime(10000) which should complete quickly enough.
    await app.clickLinear();
    await app.waitForNonEmptyResult(10000); // allow more time just in case

    const resultText1 = await app.getResultText();

    // Validate prefix and structure rather than exact milliseconds value
    const expectedPrefix = 'O(n) - Linear Time: Time taken for n = 10000 is ';
    expect(resultText.startsWith(expectedPrefix)).toBe(true);

    // Ensure the message ends with 'milliseconds.' as constructed in implementation
    expect(resultText.endsWith(' milliseconds.')).toBe(true);

    // Assert that the numeric timeTaken is present and is parseable
    const millisPart = resultText.slice(expectedPrefix.length, -' milliseconds.'.length).trim();
    const millisNumber = Number(millisPart);
    expect(Number.isFinite(millisNumber)).toBe(true);

    // No console/page errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S3_QuadraticTime - clicking quadratic button shows quadratic-time message starting with expected prefix', async ({ page }) => {
    // This validates the transition from Idle -> QuadraticTime (S0 -> S3)
    const app3 = new TimeComplexityPage(page);

    // Click the quadratic time button and wait for result update.
    // Implementation runs quadraticTime(100) - should be quick but give some timeout headroom.
    await app.clickQuadratic();
    await app.waitForNonEmptyResult(10000);

    const resultText2 = await app.getResultText();

    // Validate prefix and structure
    const expectedPrefix1 = 'O(n^2) - Quadratic Time: Time taken for n = 100 is ';
    expect(resultText.startsWith(expectedPrefix)).toBe(true);
    expect(resultText.endsWith(' milliseconds.')).toBe(true);

    // Parse the milliseconds value
    const millisPart1 = resultText.slice(expectedPrefix.length, -' milliseconds.'.length).trim();
    const millisNumber1 = Number(millisPart);
    expect(Number.isFinite(millisNumber)).toBe(true);

    // No console/page errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases and robustness - rapid repeated clicks update result predictably and do not produce errors', async ({ page }) => {
    // Validate multiple quick interactions and ensure last-clicked result is displayed
    const app4 = new TimeComplexityPage(page);

    // Rapid sequence: constant -> linear -> quadratic
    await Promise.all([
      app.constantBtn.click(),
      app.linearBtn.click(),
      app.quadraticBtn.click()
    ]).catch(() => {
      // In case of racing clicks, continue to wait for a final result update.
    });

    // Wait for result to be non-empty; final expected is quadratic result
    await app.waitForNonEmptyResult(10000);

    const resultText3 = await app.getResultText();

    // Since last click is quadratic, expect quadratic prefix (robustness of event handling)
    expect(resultText.startsWith('O(n^2) - Quadratic Time: Time taken for n = 100 is ')).toBe(true);

    // Ensure no console or page errors were logged during rapid interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Error monitoring test - assert absence of ReferenceError, SyntaxError, TypeError in logs', async ({ page }) => {
    // This test explicitly inspects captured errors for the common JS error names.
    // It does not mutate the page - only reads the recorded logs from beforeEach navigation.
    const foundErrorNames = pageErrors.map(e => e.name);
    const foundConsoleTexts = consoleErrors.map(e => e.text);

    // Assert none of the pageErrors are ReferenceError/TypeError/SyntaxError
    expect(foundErrorNames.includes('ReferenceError')).toBe(false);
    expect(foundErrorNames.includes('TypeError')).toBe(false);
    expect(foundErrorNames.includes('SyntaxError')).toBe(false);

    // Also inspect console error strings for these substrings
    const consoleStr = foundConsoleTexts.join(' | ');
    expect(consoleStr.includes('ReferenceError')).toBe(false);
    expect(consoleStr.includes('TypeError')).toBe(false);
    expect(consoleStr.includes('SyntaxError')).toBe(false);
  });
});