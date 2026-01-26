import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b342a3-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Unit Testing app
class UnitTestingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '.button-container';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getRunExampleButton() {
    return this.page.locator(this.buttonSelector);
  }

  async clickRunExample() {
    await this.page.click(this.buttonSelector);
  }

  async getButtonOnclickAttribute() {
    return this.page.getAttribute(this.buttonSelector, 'onclick');
  }

  // Helper: wait until the page has printed the expected console messages
  // Uses a polling strategy against the collected console messages array.
  static async waitForConsoleMessages(consoleMessages, expectedTexts, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const textsSeen = consoleMessages.map(m => m.text());
      let allPresent = true;
      for (const t of expectedTexts) {
        if (!textsSeen.some(s => s.includes(t))) {
          allPresent = false;
          break;
        }
      }
      if (allPresent) return;
      // small delay
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Timed out waiting for console messages: ${expectedTexts.join(', ')}`);
  }
}

test.describe('FSM: Unit Testing Interactive App (f5b342a3-...-1ee0)', () => {
  // Shared variables for each test
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {Array<import('@playwright/test').ConsoleMessage>} */
  let consoleMessages;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // New context and page for isolation
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push(msg);
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Close page to ensure clean teardown
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('Initial state (S0_Idle) - Run Example button is present and not executed on render', async () => {
    // This test validates the Idle state (S0_Idle)
    // - The Run Example button is present
    // - The onclick attribute references runExample()
    // - The runExample function should NOT have executed on initial render (no test logs)
    const ui = new UnitTestingPage(page);

    const btn = await ui.getRunExampleButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText(/Run Example/);

    // Verify the onclick attribute exists and references the expected function call
    const onclickAttr = await ui.getButtonOnclickAttribute();
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain('runExample');

    // Ensure no "Test X passed" logs are present before clicking (ensures entry action hasn't run)
    const texts = consoleMessages.map(m => m.text());
    expect(texts.some(t => t.includes('Test 1 passed'))).toBe(false);
    expect(texts.some(t => t.includes('Test 2 passed'))).toBe(false);
    expect(texts.some(t => t.includes('Test 3 passed'))).toBe(false);

    // Also ensure there are no runtime page errors at initial render
    expect(pageErrors.length).toBe(0);
  });

  test('Transition RunExample (S0_Idle -> S1_ExampleRunning) - clicking triggers console logs', async () => {
    // This test validates the transition from Idle to Example Running
    // - Clicking the Run Example button should invoke runExample()
    // - The expected console logs should be produced
    // - No page errors should occur as a result
    const ui = new UnitTestingPage(page);

    // Click the Run Example button
    await ui.clickRunExample();

    // Wait for the three expected console messages emitted by runExample()
    await UnitTestingPage.waitForConsoleMessages(consoleMessages, [
      'Test 1 passed',
      'Test 2 passed',
      'Test 3 passed'
    ], 2000);

    // Assert that console contains each expected message at least once
    const texts = consoleMessages.map(m => m.text());
    expect(texts.filter(t => t.includes('Test 1 passed')).length).toBeGreaterThanOrEqual(1);
    expect(texts.filter(t => t.includes('Test 2 passed')).length).toBeGreaterThanOrEqual(1);
    expect(texts.filter(t => t.includes('Test 3 passed')).length).toBeGreaterThanOrEqual(1);

    // Confirm that there were no page errors (ReferenceError/SyntaxError/TypeError) triggered by clicking
    // This follows the instruction to observe page errors and assert their presence/absence.
    expect(pageErrors.length).toBe(0);
  });

  test('Repeated clicks produce repeated logs and maintain stability (edge case)', async () => {
    // Edge case: clicking the Run Example button multiple times rapidly
    // - Verify the app logs are produced for each click
    // - Ensure no unexpected errors occur even after multiple invocations
    const ui = new UnitTestingPage(page);

    // Click three times with small pauses to simulate user interaction
    await ui.clickRunExample();
    await new Promise(r => setTimeout(r, 100));
    await ui.clickRunExample();
    await new Promise(r => setTimeout(r, 100));
    await ui.clickRunExample();

    // Expect at least three occurrences of each "Test X passed" message
    // Use polling to wait until we have enough logs or timeout
    const expectedEachCount = 3;
    const start = Date.now();
    const timeout = 3000;
    while (Date.now() - start < timeout) {
      const texts = consoleMessages.map(m => m.text());
      const counts = {
        t1: texts.filter(t => t.includes('Test 1 passed')).length,
        t2: texts.filter(t => t.includes('Test 2 passed')).length,
        t3: texts.filter(t => t.includes('Test 3 passed')).length
      };
      if (counts.t1 >= expectedEachCount && counts.t2 >= expectedEachCount && counts.t3 >= expectedEachCount) {
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 50));
    }

    const texts = consoleMessages.map(m => m.text());
    expect(texts.filter(t => t.includes('Test 1 passed')).length).toBeGreaterThanOrEqual(expectedEachCount);
    expect(texts.filter(t => t.includes('Test 2 passed')).length).toBeGreaterThanOrEqual(expectedEachCount);
    expect(texts.filter(t => t.includes('Test 3 passed')).length).toBeGreaterThanOrEqual(expectedEachCount);

    // Verify no runtime page errors occurred during repeated invocations
    expect(pageErrors.length).toBe(0);
  });

  test('Visual and DOM checks after running example - button remains and content intact', async () => {
    // This test validates that running the example does not remove UI elements unexpectedly.
    // It checks that the Run Example button is still present and that the main informational content is unchanged.
    const ui = new UnitTestingPage(page);

    // Capture some content that should remain stable
    const initialHeading = page.locator('.text-container h2').first();
    const initialHeadingText = await initialHeading.textContent();

    // Run the example once
    await ui.clickRunExample();
    await UnitTestingPage.waitForConsoleMessages(consoleMessages, ['Test 1 passed', 'Test 2 passed', 'Test 3 passed'], 2000);

    // The button should still be visible and clickable
    const btn = await ui.getRunExampleButton();
    await expect(btn).toBeVisible();

    // The heading text should remain unchanged (sanity check for DOM stability)
    const headingTextAfter = await page.locator('.text-container h2').first().textContent();
    expect(headingTextAfter).toBe(initialHeadingText);

    // Ensure again no page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console and page errors behavior - explicitly report collected errors if any', async () => {
    // This test's purpose is to surface any console error messages or page errors that might exist.
    // It intentionally does not force errors; it records and asserts their absence for a healthy app.
    // If any console messages of severity 'error' exist, we will fail and include details to aid debugging.

    // Give the page a short moment to produce any late console errors (if any)
    await new Promise(r => setTimeout(r, 200));

    // Extract console errors (severity 'error') from consoleMessages
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error').map(m => m.text());

    // If any page errors exist, include them in assertion message
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Fail the test and provide details
      const pageErrorDetails = pageErrors.map(e => e.stack || e.message).join('\n---\n');
      const consoleErrorDetails = consoleErrors.join('\n---\n');
      throw new Error(
        `Detected runtime issues:\nPage errors:\n${pageErrorDetails || '(none)'}\nConsole errors:\n${consoleErrorDetails || '(none)'}`
      );
    }

    // Otherwise, assert that the app produced no runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});