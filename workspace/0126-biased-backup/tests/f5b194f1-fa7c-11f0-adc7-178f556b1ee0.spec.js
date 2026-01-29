import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b194f1-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Recursion application
class RecursionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selector = '#recursion-button';
  }

  // Navigate to the app URL
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns the button handle (or throws if missing)
  async getButton() {
    return this.page.$(this.selector);
  }

  // Returns text content of the button
  async getButtonText() {
    return this.page.textContent(this.selector);
  }

  // Click the recursion button
  async clickButton(options = {}) {
    await this.page.click(this.selector, options);
  }

  // Remove the button from the DOM (used for edge-case tests)
  async removeButtonFromDOM() {
    await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.remove();
    }, this.selector);
  }

  // Check whether the button is visible
  async isButtonVisible() {
    const handle = await this.getButton();
    if (!handle) return false;
    return handle.isVisible ? await handle.isVisible() : true;
  }
}

test.describe('Recursion Interactive App - FSM tests', () => {
  // Containers for captured console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  // Setup per test: create arrays to collect console logs and page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages emitted by the page
    page.on('console', (msg) => {
      try {
        // Normalize to string for easier assertions
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // If capturing fails for some reason, still record a fallback
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });
  });

  // Teardown: not strictly necessary here since Playwright handles context cleanup,
  // but we declare it to keep the structure clear.
  test.afterEach(async () => {
    // Assert there are no unexpected unhandled errors left in the array in tests that expect none.
    // Individual tests will assert specifics as needed.
  });

  test('S0_Idle: Initial render shows the recursion button (Idle state)', async ({ page }) => {
    // This test validates the Idle state: presence of the button and no S1 console log yet.
    const app = new RecursionPage(page);

    // Navigate to the app and capture any console/page errors emitted during load
    await app.goto();

    // Verify button exists in DOM and has correct text
    const button = await app.getButton();
    expect(button).not.toBeNull();
    const text = await app.getButtonText();
    expect(text).toBe('Recursion in Action');

    // Verify no "Recursion in action!" log has been emitted before user interaction
    const foundRecursionLog = consoleMessages.some(m => m.text === 'Recursion in action!');
    expect(foundRecursionLog).toBeFalsy();

    // Verify there are no unhandled page errors on initial load (renderPage() from FSM is not present in HTML,
    // so we expect no ReferenceError about renderPage)
    expect(pageErrors.length).toBe(0);
  });

  test('Transition ButtonClick -> S1_RecursionInAction: clicking the button logs the expected message', async ({ page }) => {
    // This test validates the transition and S1 entry action: console.log('Recursion in action!')
    const app = new RecursionPage(page);

    await app.goto();

    // Click the button and wait a short time for console events to be emitted
    await app.clickButton();

    // Give the page a small moment to process and emit console logs
    await page.waitForTimeout(50);

    // Verify that a console.log with the expected text was emitted
    const recursionLogs = consoleMessages.filter(m => m.text === 'Recursion in action!');
    expect(recursionLogs.length).toBeGreaterThanOrEqual(1);
    // Ensure the console message type is 'log' for the emitted message
    expect(recursionLogs.every(m => m.type === 'log')).toBeTruthy();

    // Verify the DOM hasn't unexpectedly changed after the click: button still present and clickable
    const button = await app.getButton();
    expect(button).not.toBeNull();
    const visible = await app.isButtonVisible();
    expect(visible).toBeTruthy();

    // Ensure no unexpected page errors were thrown during click/transition
    expect(pageErrors.length).toBe(0);
  });

  test('Multiple clicks: multiple transitions produce multiple console logs', async ({ page }) => {
    // This test validates repeated event firing and confirms each click produces a log
    const app = new RecursionPage(page);

    await app.goto();

    // Clear any logs that might have appeared during load
    consoleMessages = [];

    // Click the button three times
    await app.clickButton();
    await app.clickButton();
    await app.clickButton();

    // Allow some time for console messages to arrive
    await page.waitForTimeout(100);

    // Filter console messages to only our expected log lines
    const recursionLogs = consoleMessages.filter(m => m.text === 'Recursion in action!');
    // We expect exactly 3 logs, one per click
    expect(recursionLogs.length).toBe(3);

    // Verify no unhandled page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking when the button is removed should result in a click error', async ({ page }) => {
    // This test validates an error scenario: attempting to click a non-existent selector should reject.
    const app = new RecursionPage(page);

    await app.goto();

    // Remove the button from the DOM to simulate the edge case
    await app.removeButtonFromDOM();

    // Ensure the button is indeed removed
    const btnAfterRemove = await app.getButton();
    expect(btnAfterRemove).toBeNull();

    // Attempting to click the missing selector should throw; assert that Playwright reports a timeout/no node error.
    // We use a short timeout to make the test run fast.
    const clickPromise = app.clickButton({ timeout: 1000 });
    await expect(clickPromise).rejects.toThrow();

    // Removing the button shouldn't produce any unexpected page errors (pageerror). It should simply make the click fail.
    // Depending on runtime, pageErrors might be empty; assert that there are no unhandled exceptions in page context
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry/exit actions verification: S0 has no runtime renderPage call; S1 emits console on enter', async ({ page }) => {
    // This test ensures that S0's declared entry action (renderPage()) does not cause a ReferenceError,
    // and that S1's entry action (console.log) happens on transition (click).
    const app = new RecursionPage(page);

    await app.goto();

    // If the FSM's "renderPage()" were invoked and missing, we'd expect a ReferenceError in pageErrors.
    // Assert there were no such errors on load.
    const refErrors = pageErrors.filter(err => /ReferenceError/i.test(err.message));
    expect(refErrors.length).toBe(0);

    // Now transition to S1 by clicking the button and assert the S1 entry console log occurs
    await app.clickButton();
    await page.waitForTimeout(50);
    const s1Logs = consoleMessages.filter(m => m.text === 'Recursion in action!');
    expect(s1Logs.length).toBeGreaterThanOrEqual(1);
  });

  test('Robustness: the button text and structure remain stable after repeated interactions', async ({ page }) => {
    // This test checks visual/textual stability after interactions (DOM integrity)
    const app = new RecursionPage(page);

    await app.goto();

    // Capture initial button text
    const initialText = await app.getButtonText();
    expect(initialText).toBe('Recursion in Action');

    // Perform several interactions
    for (let i = 0; i < 5; i++) {
      await app.clickButton();
    }

    // Allow console logs to accumulate
    await page.waitForTimeout(100);

    // Button text should remain unchanged
    const postText = await app.getButtonText();
    expect(postText).toBe(initialText);

    // The number of recursion logs should be at least 5 (one per click in this loop) plus any earlier ones
    const recursionLogs = consoleMessages.filter(m => m.text === 'Recursion in action!');
    expect(recursionLogs.length).toBeGreaterThanOrEqual(5);

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });
});