import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ebf53-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object for the Monitor Example page.
 * Encapsulates common interactions and queries used across tests.
 */
class MonitorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#btnMonitor');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the button to be visible as an initial readiness check
    await this.button.waitFor({ state: 'visible' });
  }

  async clickMonitor(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.button.click();
    }
  }

  async getOutputParagraphs() {
    return await this.output.locator('p').allTextContents();
  }

  async getRawOutputHTML() {
    return await this.output.innerHTML();
  }
}

test.describe('Monitor Example (FSM: Idle -> Monitoring)', () => {
  // Collect console messages and page errors for assertions in tests
  /** @type {Array<{type:string, text:string}>} */
  let consoleMessages;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages with types (log, error, warning, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught errors happening in the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Clean up arrays (not strictly necessary, but keeps state clear between tests)
    consoleMessages = [];
    pageErrors = [];
  });

  test('Initial Idle state: button visible and output empty', async ({ page }) => {
    // This test validates the S0_Idle state.
    // It ensures the Start Monitoring button is present and the output area is empty.
    const monitor = new MonitorPage(page);
    await monitor.goto();

    // Button should have correct text and be visible
    await expect(monitor.button).toBeVisible();
    await expect(monitor.button).toHaveText('Start Monitoring');

    // Output should be empty initially (no <p> children)
    const paras = await monitor.output.locator('p').count();
    expect(paras).toBe(0);

    // No page errors or console errors should have occurred on initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking Start Monitoring transitions to Monitoring and appends call info and result', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Monitoring on ButtonClick.
    // It asserts both expected observables appear in the output in the correct order.
    const monitor1 = new MonitorPage(page);
    await monitor.goto();

    // Click the monitor button once
    await monitor.clickMonitor(1);

    // Wait for two paragraphs to appear (call info then result)
    await page.waitForSelector('#output p');

    const texts = await monitor.getOutputParagraphs();
    // Expect two paragraphs appended
    expect(texts.length).toBeGreaterThanOrEqual(2);

    // The first appended paragraph should indicate the function call and args
    // It should contain the substring "Function called 1 times with arguments: [2,3]"
    expect(texts[0]).toContain('Function called 1 times with arguments: [2,3]');

    // The second paragraph should contain the result value "5"
    expect(texts[1]).toContain('Result of function: 5');

    // Ensure no uncaught page errors nor console errors occurred as part of this normal flow
    const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Multiple clicks append outputs and increment call counts sequentially', async ({ page }) => {
    // This test exercises repeated transitions (re-entrancy of Monitoring state)
    // and ensures the monitor's count increments across clicks.
    const monitor2 = new MonitorPage(page);
    await monitor.goto();

    // Click three times
    await monitor.clickMonitor(3);

    // Wait until 6 paragraphs exist (2 per click)
    await page.waitForFunction(() => {
      const out = document.getElementById('output');
      if (!out) return false;
      return out.querySelectorAll('p').length >= 6;
    });

    const texts1 = await monitor.getOutputParagraphs();
    expect(texts.length).toBeGreaterThanOrEqual(6);

    // The call info paragraphs should be at indices 0,2,4 with counts 1,2,3 respectively
    const callInfoParas = [texts[0], texts[2], texts[4]];
    expect(callInfoParas[0]).toContain('Function called 1 times with arguments: [2,3]');
    expect(callInfoParas[1]).toContain('Function called 2 times with arguments: [2,3]');
    expect(callInfoParas[2]).toContain('Function called 3 times with arguments: [2,3]');

    // Each corresponding result paragraph should contain "Result of function: 5"
    const resultParas = [texts[1], texts[3], texts[5]];
    for (const r of resultParas) {
      expect(r).toContain('Result of function: 5');
    }

    // No uncaught page errors for normal repeated usage
    const consoleErrors2 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Directly invoking monitoredFunction from page context throws ReferenceError', async ({ page }) => {
    // This test intentionally tries to call monitoredFunction from the test's page context.
    // In the provided implementation monitoredFunction is declared with const at top-level,
    // which does not necessarily expose it as a global (window) property in the page context.
    // Therefore we expect a ReferenceError to be thrown when trying to access it directly.
    const monitor3 = new MonitorPage(page);
    await monitor.goto();

    // Attempt to call monitoredFunction via evaluate and expect an exception
    let thrownError = null;
    try {
      await page.evaluate(() => {
        // This will throw a ReferenceError if monitoredFunction is not defined as global
        // Let the error propagate to the evaluate call so we can assert it here
        return monitoredFunction(2, 3);
      });
    } catch (err) {
      thrownError = err;
    }

    // We expect a thrown error to have occurred
    expect(thrownError).not.toBeNull();
    // The thrown error message / name should indicate a reference issue
    // The exact message can vary by engine; check name or message for 'ReferenceError' or 'not defined'
    const errMsg = (thrownError && thrownError.message) || '';
    const isReference = errMsg.toLowerCase().includes('not defined') || errMsg.toLowerCase().includes('referenceerror');
    expect(isReference).toBeTruthy();
  });

  test('Calling monitor with a non-function then invoking triggers a TypeError (captured as pageerror)', async ({ page }) => {
    // This test intentionally causes a TypeError inside the page by creating a monitored wrapper
    // around a non-function and invoking it asynchronously, so the exception is an unhandled
    // runtime error and triggers the pageerror event.
    await page.goto(APP_URL);

    // Ensure our pageerror listener is ready and then schedule an unhandled invocation
    // We use setTimeout in page context so the error happens asynchronously and is reported as a page error.
    const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 2000 });

    await page.evaluate(() => {
      // monitor should be available as a function declared by the page script
      // Create a wrapper around a string (not a function)
      const f = monitor('not-a-function');

      // Invoke asynchronously to create an unhandled TypeError that the page will emit
      setTimeout(() => {
        // This call will attempt to execute 'not-a-function' as a function and throw
        // Do not catch here so the error surfaces as an unhandled exception in the page
        f();
      }, 0);
    });

    // Wait for the pageerror to be emitted and capture it
    const pageErr = await pageErrorPromise;
    expect(pageErr).toBeTruthy();

    // The error should be a TypeError for "not a function"
    const name = pageErr.name || '';
    const msg = pageErr.message || '';
    expect(name.toLowerCase()).toContain('typeerror');
    // message can vary, but check typical substring
    expect(msg.toLowerCase()).toContain('not');
    // ensure our captured pageErrors array has at least one entry
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Evaluating invalid code in page produces a SyntaxError pageerror', async ({ page }) => {
    // This test deliberately runs invalid JavaScript in the page asynchronously (via setTimeout+eval)
    // so that a SyntaxError occurs in the page runtime and emits a pageerror event.
    await page.goto(APP_URL);

    const pageErrorPromise1 = page.waitForEvent('pageerror', { timeout: 2000 });

    // Run invalid code asynchronously to trigger pageerror
    await page.evaluate(() => {
      setTimeout(() => {
        // This eval is syntactically invalid and should throw a SyntaxError
        // The exception is not caught so it will be reported to the page as an unhandled exception.
        eval('function(');
      }, 0);
    });

    const pageErr1 = await pageErrorPromise;
    expect(pageErr).toBeTruthy();

    const name1 = pageErr.name1 || '';
    const msg1 = pageErr.message || '';
    // Assert that this is a SyntaxError (engine-specific naming may vary but typically 'SyntaxError')
    expect(name.toLowerCase()).toContain('syntaxerror');
    // The message should indicate a parsing issue
    expect(msg.length).toBeGreaterThan(0);
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });
});