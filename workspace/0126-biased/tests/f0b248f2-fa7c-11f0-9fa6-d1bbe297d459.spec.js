import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b248f2-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the demo page to encapsulate interactions and queries
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('.button');
    this.outputLocator = page.locator('#demoOutput');
  }

  // Click the Run Demonstration button
  async clickRun() {
    await this.runButton.click();
  }

  // Return the raw innerText of the demo output container
  async getOutputText() {
    return await this.page.$eval('#demoOutput', (el) => el.innerText);
  }

  // Return the raw innerHTML of the demo output container
  async getOutputHTML() {
    return await this.page.$eval('#demoOutput', (el) => el.innerHTML);
  }

  // Wait until the demo output contains a specific substring
  async waitForOutputContains(substring, timeout = 2000) {
    await this.page.waitForFunction(
      (selector, part) => {
        const el = document.querySelector(selector);
        return el && el.innerText.includes(part);
      },
      '#demoOutput',
      substring,
      { timeout }
    );
  }
}

test.describe('Interpolation Search Interactive Demo - FSM validation', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, warning, error, etc.)
    page.on('console', (msg) => {
      // Save the type and text for assertions and diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is; do not modify environment or inject code
    await page.goto(APP_URL);
  });

  test.afterEach(async ({}, testInfo) => {
    // Basic teardown check: record if any console errors or page errors were captured
    if (consoleMessages.length > 0) {
      testInfo.attach('console-messages', {
        body: JSON.stringify(consoleMessages, null, 2),
        contentType: 'application/json',
      });
    }
    if (pageErrors.length > 0) {
      testInfo.attach('page-errors', {
        body: pageErrors.map(e => (e && e.stack) ? e.stack : String(e)).join('\n\n'),
        contentType: 'text/plain',
      });
    }
  });

  test.describe('Idle State (S0_Idle) validations', () => {
    test('Initial render shows Run Demonstration button and demo output is empty', async ({ page }) => {
      // Validate Idle state UI: the Run Demonstration button must be present with correct text
      const demoPage = new DemoPage(page);

      await expect(demoPage.runButton).toBeVisible();
      await expect(demoPage.runButton).toHaveText('Run Demonstration');

      // The demo output should exist but be empty at initial load
      const outputExists = await page.$('#demoOutput');
      expect(outputExists).not.toBeNull();
      const outputText = await demoPage.getOutputText();
      expect(outputText.trim()).toBe('');

      // FSM S0_Idle entry action references renderPage() in FSM metadata.
      // Confirm that clicking hasn't attempted to call a non-existent renderPage automatically.
      // We check that renderPage is not defined on the window (since the HTML does not implement it).
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      // The implementation didn't provide renderPage; assert that's the case.
      expect(hasRenderPage).toBe(false);

      // Assert no unexpected page runtime errors were emitted during initial load
      expect(pageErrors.length).toBe(0);

      // Also assert no console-level errors were recorded (we may have benign console messages, but ensure no 'error' typed messages)
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Demo Running (S1_DemoRunning) and Final States (S2_TargetFound / S3_TargetNotFound)', () => {
    test('Clicking Run Demonstration transitions to Demo Running and results in Target Found (S2_TargetFound)', async ({ page }) => {
      // This test validates the main happy path:
      // - Clicking the button executes runDemo()
      // - Output shows a starting message, the step(s), and a "Found target" final message
      const demoPage = new DemoPage(page);

      // Click "Run Demonstration" to trigger runDemo()
      await demoPage.clickRun();

      // Wait until the output contains the starting message and the found message
      await demoPage.waitForOutputContains('Starting interpolation search for value 60', 2000);
      await demoPage.waitForOutputContains('Found target at position', 2000);

      // Inspect output text and verify expected lines and ordering
      const outputText = await demoPage.getOutputText();

      // The starting line must be present and reference the array and target 60
      expect(outputText).toContain('Starting interpolation search for value 60 in array');
      expect(outputText).toContain('[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]');

      // There should be a step indicating the probe; in the provided implementation this is one step checking position 5
      expect(outputText).toContain('Step 1: Checking position 5 (value 60)');

      // The found message should indicate position 5 and 1 step
      expect(outputText).toContain('Found target at position 5 in 1 steps!');

      // Because the function returns immediately upon finding, ensure "Target not found" is NOT present
      expect(outputText).not.toContain('Target not found in array');

      // Confirm no runtime page errors were emitted during demo run
      expect(pageErrors.length).toBe(0);

      // Confirm console did not emit 'error' level messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking Run Demonstration multiple times appends output and remains consistent', async ({ page }) => {
      // This test validates idempotency / repeated runs:
      // Each click appends another run's messages; we verify that multiple "Found" messages appear
      const demoPage = new DemoPage(page);

      // Click twice sequentially
      await demoPage.clickRun();
      await demoPage.waitForOutputContains('Found target at position 5', 2000);

      // Capture output after first run
      const firstRunText = await demoPage.getOutputText();
      const foundCountAfterFirst = (firstRunText.match(/Found target at position 5/g) || []).length;
      expect(foundCountAfterFirst).toBe(1);

      // Click again to run a second demonstration
      await demoPage.clickRun();
      // Wait for second found message to appear (the content is appended; wait until count is 2)
      await page.waitForFunction(() => {
        const el = document.getElementById('demoOutput');
        return el && (el.innerText.match(/Found target at position 5/g) || []).length >= 2;
      }, { timeout: 2000 });

      const combinedText = await demoPage.getOutputText();
      const foundCountAfterSecond = (combinedText.match(/Found target at position 5/g) || []).length;
      expect(foundCountAfterSecond).toBeGreaterThanOrEqual(2);

      // Ensure both runs contain the starting message and step message for each run (at least twice)
      const startCount = (combinedText.match(/Starting interpolation search for value 60/g) || []).length;
      expect(startCount).toBeGreaterThanOrEqual(2);

      const stepCount = (combinedText.match(/Step 1: Checking position 5 \(value 60\)/g) || []).length;
      // Depending on timing, step message may be present for each run; expect at least 2 occurrences
      expect(stepCount).toBeGreaterThanOrEqual(2);

      // No errors emitted during repeated runs
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Target Not Found path (S3_TargetNotFound) is not reachable via provided UI - validate absence', async ({ page }) => {
      // The current implementation of runDemo() hardcodes target = 60 which exists in the array.
      // Therefore, the "Target not found" final state should not be reached through the exposed Run Demonstration button.
      // We assert that after triggering the demo, the "Target not found in array" message does not appear.

      const demoPage = new DemoPage(page);

      await demoPage.clickRun();
      await demoPage.waitForOutputContains('Found target at position 5', 2000);

      const outputText = await demoPage.getOutputText();
      // Confirm the "not found" message is absent
      expect(outputText).not.toContain('Target not found in array');

      // Because FSM lists a TargetNotFound transition, we document that it cannot be exercised with current UI.
      // Assert that no page errors were thrown when attempting to run the "not found" branch (since it wasn't reached)
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and edge-case behaviors', () => {
    test('No unexpected ReferenceError/SyntaxError/TypeError occurred during page lifecycle', async ({ page }) => {
      // This test collects page errors and asserts that none occurred.
      // If any errors did occur, we verify they are of expected JS Error types (ReferenceError, SyntaxError, TypeError)
      // The HTML/JS implementation appears correct for the provided demo, so we expect zero errors.
      expect(pageErrors.length).toBe(0);

      // If any errors were present, assert they are JS runtime errors of certain types (defensive)
      for (const err of pageErrors) {
        // The error object has a name property in typical Playwright pageerror Events
        const name = err && err.name ? err.name : undefined;
        const allowed = ['ReferenceError', 'SyntaxError', 'TypeError'];
        expect(allowed.includes(name)).toBe(true);
      }
    });

    test('Validate DOM stability and no exceptions thrown when querying demo output', async ({ page }) => {
      // Robustness test: repeatedly query the demo output DOM node to ensure no transient errors occur
      const demoPage = new DemoPage(page);

      // Poll and query output several times to ensure DOM access is stable
      for (let i = 0; i < 5; i++) {
        // No click; just ensure reading the output doesn't trigger errors
        const content = await demoPage.getOutputHTML();
        expect(typeof content).toBe('string');
      }

      // Confirm again no page errors were logged
      expect(pageErrors.length).toBe(0);
    });
  });
});