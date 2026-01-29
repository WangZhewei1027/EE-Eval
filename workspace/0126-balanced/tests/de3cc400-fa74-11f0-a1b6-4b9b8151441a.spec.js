import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3cc400-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object model for the demo page
class ThreadDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Use Playwright's has-text selectors for robust matching
    this.startButton = page.locator('button:has-text("Start Worker")');
    this.stopButton = page.locator('button:has-text("Stop Worker")');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStart() {
    await this.startButton.click();
  }

  async clickStop() {
    await this.stopButton.click();
  }

  async isStartVisible() {
    return await this.startButton.isVisible();
  }

  async isStopVisible() {
    return await this.stopButton.isVisible();
  }

  async startText() {
    return await this.startButton.innerText();
  }

  async stopText() {
    return await this.stopButton.innerText();
  }
}

test.describe('JavaScript Thread Demonstration - FSM (de3cc400-fa74-11f0-a1b6-4b9b8151441a)', () => {
  let consoleMessages;
  let pageErrors;
  let consoleHandler;
  let pageErrorHandler;

  // Setup listeners before each test to observe console and runtime errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    consoleHandler = (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // ignore any issues while reading console message
      }
    };

    pageErrorHandler = (err) => {
      // err is an Error with message/stack
      pageErrors.push(err);
    };

    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);

    // Navigate to the application page exactly as-is.
    await page.goto(APP_URL);
  });

  // Cleanup listeners after each test
  test.afterEach(async ({ page }) => {
    page.removeListener('console', consoleHandler);
    page.removeListener('pageerror', pageErrorHandler);
  });

  test('Initial Idle state - Start and Stop buttons are present and labeled correctly', async ({ page }) => {
    // This test validates the Idle state's evidence:
    // Both "Start Worker" and "Stop Worker" buttons should be present in the DOM.
    const demo = new ThreadDemoPage(page);

    // Verify both buttons are visible
    await expect(demo.startButton).toBeVisible({ timeout: 2000 });
    await expect(demo.stopButton).toBeVisible({ timeout: 2000 });

    // Verify the button text matches the FSM evidence
    await expect(demo.startButton).toHaveText('Start Worker');
    await expect(demo.stopButton).toHaveText('Stop Worker');

    // There may be no runtime page errors on initial load (depends on the truncated HTML),
    // but we still capture any that occurred.
    // Assert that console messages array exists (could be empty) and pageErrors is an array.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();
  });

  test('StartWorker event: clicking "Start Worker" should trigger page error (if startWorker not defined) and not crash the page', async ({ page }) => {
    // This test performs the StartWorker event and asserts runtime behavior.
    // Per instructions we must not modify the page; we let any ReferenceError / TypeError occur naturally and assert it.
    const demo1 = new ThreadDemoPage(page);

    // Ensure button present before clicking
    await expect(demo.startButton).toBeVisible();

    // Click and wait for a pageerror. If no pageerror is thrown within timeout, the test will fail.
    const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 }).catch(e => e);

    await demo.clickStart();

    const pageError = await pageErrorPromise;

    // Validate that a page error occurred and its message references the expected missing function or is a ReferenceError.
    // Many browsers report "startWorker is not defined" or similar. Accept a variety of error messages.
    expect(pageError).toBeTruthy();
    // pageError may be an Error object or Playwright's Timeout error (if none). Ensure it's an Error with message.
    if (pageError instanceof Error && typeof pageError.message === 'string') {
      // Accept common patterns: function name, "is not defined", or ReferenceError / TypeError / SyntaxError
      const msg = pageError.message;
      const matches = /startWorker|ReferenceError|TypeError|is not defined|not defined/i.test(msg);
      expect(matches).toBeTruthy();
    } else {
      // If it's the Playwright timeout object or something unexpected, fail explicitly.
      throw new Error(`Expected a runtime page error after clicking Start Worker, got: ${String(pageError)}`);
    }

    // Verify the page remains interactive: both buttons should still be present (no state update happened)
    await expect(demo.startButton).toBeVisible();
    await expect(demo.stopButton).toBeVisible();
  });

  test('StopWorker event: clicking "Stop Worker" should trigger page error (if stopWorker not defined) and not crash the page', async ({ page }) => {
    // This test performs the StopWorker event and asserts runtime behavior.
    const demo2 = new ThreadDemoPage(page);

    await expect(demo.stopButton).toBeVisible();

    const pageErrorPromise1 = page.waitForEvent('pageerror', { timeout: 3000 }).catch(e => e);

    await demo.clickStop();

    const pageError1 = await pageErrorPromise;

    expect(pageError).toBeTruthy();
    if (pageError instanceof Error && typeof pageError.message === 'string') {
      const msg1 = pageError.message;
      const matches1 = /stopWorker|ReferenceError|TypeError|is not defined|not defined/i.test(msg);
      expect(matches).toBeTruthy();
    } else {
      throw new Error(`Expected a runtime page error after clicking Stop Worker, got: ${String(pageError)}`);
    }

    // Ensure UI still present after the failed handler
    await expect(demo.startButton).toBeVisible();
    await expect(demo.stopButton).toBeVisible();
  });

  test('Edge case: double-clicking "Start Worker" produces multiple page errors (if handler missing)', async ({ page }) => {
    // Validate behavior when the user triggers StartWorker twice quickly.
    // We expect multiple runtime errors if the onclick handler is undefined and the event fires each time.
    const demo3 = new ThreadDemoPage(page);

    await expect(demo.startButton).toBeVisible();

    // Wait for two pageerror events sequentially.
    const firstErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 }).catch(e => e);
    await demo.clickStart();
    const firstError = await firstErrorPromise;
    expect(firstError).toBeTruthy();

    const secondErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 }).catch(e => e);
    await demo.clickStart();
    const secondError = await secondErrorPromise;
    expect(secondError).toBeTruthy();

    // Both errors should mention the missing function or a ReferenceError
    if (firstError instanceof Error && secondError instanceof Error) {
      const ok1 = /startWorker|ReferenceError|TypeError|is not defined/i.test(firstError.message);
      const ok2 = /startWorker|ReferenceError|TypeError|is not defined/i.test(secondError.message);
      expect(ok1).toBeTruthy();
      expect(ok2).toBeTruthy();
    }
  });

  test('Edge case: clicking "Stop Worker" before "Start Worker" should not crash the browser and should surface errors if handlers missing', async ({ page }) => {
    // Some apps expect a worker to be running before stopping; clicking Stop early may still call a missing function.
    const demo4 = new ThreadDemoPage(page);

    await expect(demo.stopButton).toBeVisible();

    const pageErrorPromise2 = page.waitForEvent('pageerror', { timeout: 3000 }).catch(e => e);
    await demo.clickStop();
    const pageError2 = await pageErrorPromise;

    expect(pageError).toBeTruthy();
    if (pageError instanceof Error && typeof pageError.message === 'string') {
      const msg2 = pageError.message;
      const matches2 = /stopWorker|ReferenceError|TypeError|is not defined/i.test(msg);
      expect(matches).toBeTruthy();
    }
  });

  test('Observability: captured console messages and page errors are available for debugging', async ({ page }) => {
    // This test demonstrates that we are capturing console messages and runtime errors across page interactions.
    const demo5 = new ThreadDemoPage(page);
    // Trigger both actions to populate the listeners (if handlers are missing errors will be recorded).
    const p1 = page.waitForEvent('pageerror', { timeout: 3000 }).catch(e => e);
    await demo.clickStart();
    await p1;

    const p2 = page.waitForEvent('pageerror', { timeout: 3000 }).catch(e => e);
    await demo.clickStop();
    await p2;

    // At this point our earlier handlers will have pushed entries into consoleMessages and pageErrors arrays.
    // Assert that the arrays are arrays and that pageErrors contains at least one Error object.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Ensure at least one page error message contains a likely indicator of a missing handler or runtime error.
    const anyRelevant = pageErrors.some(err => {
      try {
        return /startWorker|stopWorker|ReferenceError|TypeError|is not defined/i.test(err.message);
      } catch {
        return false;
      }
    });
    expect(anyRelevant).toBeTruthy();
  });

});