import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b25fb1-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Time Complexity Demo page
class TimeComplexityPage {
  constructor(page) {
    this.page = page;
    this.btnLinear = page.locator('#btn-linear');
    this.btnQuadratic = page.locator('#btn-quadratic');
    this.btnLogarithmic = page.locator('#btn-logarithmic');
    this.resultLinear = page.locator('#result-linear');
    this.resultQuadratic = page.locator('#result-quadratic');
    this.resultLogarithmic = page.locator('#result-logarithmic');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the page is loaded and buttons are visible
    await expect(this.btnLinear).toBeVisible();
    await expect(this.btnQuadratic).toBeVisible();
    await expect(this.btnLogarithmic).toBeVisible();
  }

  async clickLinear() {
    await this.btnLinear.click();
  }

  async clickQuadratic() {
    await this.btnQuadratic.click();
  }

  async clickLogarithmic() {
    await this.btnLogarithmic.click();
  }

  async isLinearDisabled() {
    return await this.btnLinear.isDisabled();
  }

  async isQuadraticDisabled() {
    return await this.btnQuadratic.isDisabled();
  }

  async isLogarithmicDisabled() {
    return await this.btnLogarithmic.isDisabled();
  }

  async getLinearResultText() {
    return (await this.resultLinear.textContent()) ?? '';
  }

  async getQuadraticResultText() {
    return (await this.resultQuadratic.textContent()) ?? '';
  }

  async getLogarithmicResultText() {
    return (await this.resultLogarithmic.textContent()) ?? '';
  }

  // Wait until the given result element's text starts with prefix
  async waitForResultPrefix(resultLocator, prefix, timeout = 60000) {
    await this.page.waitForFunction(
      (selector, prefix) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const text = el.textContent || '';
        return text.trim().startsWith(prefix);
      },
      [await resultLocator.evaluate((el) => el.id), prefix],
      { timeout }
    );
  }
}

test.describe('Time Complexity Demonstration - FSM validation', () => {
  // Increase default timeout because some tests run heavy computations
  test.setTimeout(120000);

  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for assertions later
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // pageerror is typically an unhandled exception thrown in the page
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Remove all listeners to avoid memory leaks between tests
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial Idle state: S0_Idle - page renders with buttons and empty results', async ({ page }) => {
    const app = new TimeComplexityPage(page);
    // Navigate to the page and validate initial UI
    await app.goto();

    // Validate the evidence from FSM: buttons exist with expected labels
    await expect(app.btnLinear).toHaveText('Run Test with 1,000,000 entries');
    await expect(app.btnQuadratic).toHaveText('Run Test with 2,000 entries');
    await expect(app.btnLogarithmic).toHaveText('Run Test with 1,000,000 entries');

    // Result divs should be empty at idle
    await expect(app.resultLinear).toHaveText('', { timeout: 2000 });
    await expect(app.resultQuadratic).toHaveText('', { timeout: 2000 });
    await expect(app.resultLogarithmic).toHaveText('', { timeout: 2000 });

    // No page errors or console errors should have occurred during initial render
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition S0 -> S1 (LinearTestStart) and back to S0 (LinearTestComplete)', async ({ page }) => {
    const app1 = new TimeComplexityPage(page);
    await app.goto();

    // Verify onEnter actions after clicking linear: button disabled and 'Generating array...' shown
    await app.clickLinear();

    // Immediately after clicking: button should be disabled and result shows 'Generating array...'
    await expect(app.btnLinear).toBeDisabled();
    // Wait for the 'Generating array...' intermediate state (set synchronously before timeout)
    await page.waitForFunction(
      () => document.getElementById('result-linear')?.textContent?.includes('Generating array...'),
      null,
      { timeout: 2000 }
    );

    // Wait until final result starts with 'Sum:' (on exit action)
    // This may take some time due to creating 1,000,000 entries and summing them.
    await app.waitForResultPrefix(app.resultLinear, 'Sum:', 90000);

    // Ensure the final result indeed starts with 'Sum:' and contains "Time taken"
    const finalLinear = await app.getLinearResultText();
    expect(finalLinear.trim().startsWith('Sum:')).toBeTruthy();
    expect(finalLinear).toMatch(/Time taken: .* ms/);

    // After completion, button should be re-enabled (onExit action)
    await expect(app.btnLinear).toBeEnabled();

    // Ensure no unhandled page errors occurred during the test run
    expect(pageErrors.length).toBe(0);

    // Also ensure there are no console errors
    const errorConsoleMessages1 = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition S0 -> S2 (QuadraticTestStart) and back to S0 (QuadraticTestComplete)', async ({ page }) => {
    const app2 = new TimeComplexityPage(page);
    await app.goto();

    // Click quadratic button and validate onEnter actions
    await app.clickQuadratic();
    await expect(app.btnQuadratic).toBeDisabled();

    // Confirm 'Generating array...' appears
    await page.waitForFunction(
      () => document.getElementById('result-quadratic')?.textContent?.includes('Generating array...'),
      null,
      { timeout: 2000 }
    );

    // Wait for final text to start with 'Pairs with sum zero:'
    await app.waitForResultPrefix(app.resultQuadratic, 'Pairs with sum zero:', 60000);

    const finalQuadratic = await app.getQuadraticResultText();
    expect(finalQuadratic.trim().startsWith('Pairs with sum zero:')).toBeTruthy();
    expect(finalQuadratic).toMatch(/Time taken: .* ms/);

    // Button should be re-enabled
    await expect(app.btnQuadratic).toBeEnabled();

    // Ensure no page errors or console errors occurred
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages2 = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition S0 -> S3 (LogarithmicTestStart) and back to S0 (LogarithmicTestComplete)', async ({ page }) => {
    const app3 = new TimeComplexityPage(page);
    await app.goto();

    // Click logarithmic button and validate onEnter actions
    await app.clickLogarithmic();
    await expect(app.btnLogarithmic).toBeDisabled();

    // Confirm 'Generating sorted array...' appears as per FSM evidence
    await page.waitForFunction(
      () => document.getElementById('result-logarithmic')?.textContent?.includes('Generating sorted array...'),
      null,
      { timeout: 2000 }
    );

    // Wait for final text to start with 'Index found:'
    await app.waitForResultPrefix(app.resultLogarithmic, 'Index found:', 60000);

    const finalLog = await app.getLogarithmicResultText();
    expect(finalLog.trim().startsWith('Index found:')).toBeTruthy();
    expect(finalLog).toMatch(/Time taken: .* ms/);

    // Button should be re-enabled after completion
    await expect(app.btnLogarithmic).toBeEnabled();

    // Ensure no page errors or console errors occurred
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages3 = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Edge case: clicking a button while test is running should not start duplicate run', async ({ page }) => {
    const app4 = new TimeComplexityPage(page);
    await app.goto();

    // Start linear test
    await app.clickLinear();

    // Ensure button is disabled
    await expect(app.btnLinear).toBeDisabled();

    // Try to click the disabled button again - this should have no effect; Playwright click will try to click,
    // but browser ignores clicks on disabled buttons. We assert the result text does not change to contain extra runs.
    // Capture the result after a short delay to ensure intermediate 'Generating array...' is present
    await page.waitForFunction(
      () => document.getElementById('result-linear')?.textContent?.includes('Generating array...'),
      null,
      { timeout: 2000 }
    );

    // Attempt to click while disabled (Playwright will throw if button is not enabled by default - so use evaluate to simulate a user click
    // only if the element is not disabled. We must NOT modify or patch the page; instead we attempt to call click and catch errors.
    let clickWhileDisabledError = null;
    try {
      await app.btnLinear.click({ timeout: 1000 });
    } catch (err) {
      // Playwright may throw because element is not interactable; record the error
      clickWhileDisabledError = err;
    }

    // There should be either an error when attempting to click disabled element OR the click is ignored.
    // We accept either outcome; the important part is that no duplicate run completes producing multiple "Sum:" results,
    // so final text should still start with a single 'Sum:' once complete.
    await app.waitForResultPrefix(app.resultLinear, 'Sum:', 90000);
    const finalLinear1 = await app.getLinearResultText();
    expect(finalLinear.trim().startsWith('Sum:')).toBeTruthy();

    // Assert button is enabled again
    await expect(app.btnLinear).toBeEnabled();

    // Ensure no unhandled page errors
    expect(pageErrors.length).toBe(0);

    // If Playwright threw an error attempting to click the disabled button, ensure it was due to interactability (expected)
    if (clickWhileDisabledError) {
      expect(clickWhileDisabledError.message.toLowerCase()).toContain('element is not attached') ||
        expect(clickWhileDisabledError.message.toLowerCase()).toContain('element is not visible') ||
        expect(clickWhileDisabledError.message.toLowerCase()).toContain('not enabled');
    }
  });

  test('Sequential runs: run all three tests one after another and ensure system returns to Idle each time', async ({ page }) => {
    const app5 = new TimeComplexityPage(page);
    await app.goto();

    // Run linear
    await app.clickLinear();
    await app.waitForResultPrefix(app.resultLinear, 'Sum:', 90000);
    await expect(app.btnLinear).toBeEnabled();

    // Run quadratic
    await app.clickQuadratic();
    await app.waitForResultPrefix(app.resultQuadratic, 'Pairs with sum zero:', 60000);
    await expect(app.btnQuadratic).toBeEnabled();

    // Run logarithmic
    await app.clickLogarithmic();
    await app.waitForResultPrefix(app.resultLogarithmic, 'Index found:', 60000);
    await expect(app.btnLogarithmic).toBeEnabled();

    // After each run the UI should be back to Idle: all buttons enabled
    expect(await app.isLinearDisabled()).toBeFalsy();
    expect(await app.isQuadraticDisabled()).toBeFalsy();
    expect(await app.isLogarithmicDisabled()).toBeFalsy();

    // Validate that all results have expected prefixes
    expect((await app.getLinearResultText()).trim().startsWith('Sum:')).toBeTruthy();
    expect((await app.getQuadraticResultText()).trim().startsWith('Pairs with sum zero:')).toBeTruthy();
    expect((await app.getLogarithmicResultText()).trim().startsWith('Index found:')).toBeTruthy();

    // No page errors or console errors observed
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages4 = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Observability: capture console messages and page errors during page lifecycle', async ({ page }) => {
    const app6 = new TimeComplexityPage(page);
    await app.goto();

    // At this point we have been collecting console messages and page errors in beforeEach.
    // Assert that no severe console errors or page errors exist during idle render.
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Also assert there are informational or log messages (not required but we assert the capture mechanism works).
    // The page doesn't explicitly log messages, so we allow zero or more non-error console entries.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});