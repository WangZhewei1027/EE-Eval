import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cb3b10-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo page
class SlidingWindowDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemoBtn');
    this.demoOutput = page.locator('#demoOutput');
    this.container = page.locator('.demo-container');
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Click the run demo button
  async clickRun() {
    await this.runBtn.click();
  }

  // Return text content of demo output
  async getOutputText() {
    return (await this.demoOutput.textContent()) ?? '';
  }

  // Check whether run button is disabled
  async isRunDisabled() {
    return await this.runBtn.getAttribute('disabled') !== null || (await this.runBtn.evaluate((b) => b.disabled));
  }

  // Return aria-label of the run button
  async getRunAriaLabel() {
    return await this.runBtn.getAttribute('aria-label');
  }

  // Return role and aria-label of demo output div
  async getDemoOutputAttributes() {
    const role = await this.demoOutput.getAttribute('role');
    const ariaLabel = await this.demoOutput.getAttribute('aria-label');
    return { role, ariaLabel };
  }
}

// Helper to compute expected outputs using same algorithm as page's JS
function computeExpectedOutputs() {
  const arr = [5, 2, 1, 3, 4, 6, 1, 0, 8, 9];
  const k = 3;
  if (k > arr.length) {
    return ['Window size is larger than array length.'];
  }
  const result = [];
  let windowSum = 0;
  for (let i = 0; i < k; i++) {
    windowSum += arr[i];
  }
  result.push(`Window [0:${k - 1}] => sum = ${windowSum}`);
  for (let i = k; i < arr.length; i++) {
    windowSum += arr[i] - arr[i - k];
    result.push(`Window [${i - k + 1}:${i}] => sum = ${windowSum}`);
  }
  return result;
}

test.describe('Sliding Window Demo - FSM validation and behaviour', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages and page errors
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          // capture error messages logged to console
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // If anything odd happens while reading console, capture it
        consoleErrors.push(`Console read error: ${String(e)}`);
      }
    });

    page.on('pageerror', (err) => {
      // capture uncaught exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the application page
    const demo = new SlidingWindowDemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // Assert that no console.error messages occurred
    expect(consoleErrors, `Expected no console.error messages, but got: ${JSON.stringify(consoleErrors, null, 2)}`).toEqual([]);
    // Assert that no uncaught page errors occurred
    expect(pageErrors, `Expected no uncaught page errors, but got: ${JSON.stringify(pageErrors, null, 2)}`).toEqual([]);
  });

  test('S0_Idle: Page renders initial Idle state with Run Demo button and empty output', async ({ page }) => {
    // Validate initial Idle state S0_Idle
    const demo = new SlidingWindowDemoPage(page);

    // Run button should be visible and enabled
    await expect(demo.runBtn).toBeVisible();
    await expect(demo.runBtn).toBeEnabled();

    // Verify aria-label on button
    const aria = await demo.getRunAriaLabel();
    expect(aria).toBe('Run sliding window demo');

    // demoOutput should exist and be empty initially
    await expect(demo.demoOutput).toBeVisible();
    const initialText = await demo.getOutputText();
    // The FSM entry action renderPage() should have produced the button and output empty
    expect(initialText.trim()).toBe(''); // empty content expected at Idle

    // Validate demo output attributes (evidence from FSM/components)
    const attrs = await demo.getDemoOutputAttributes();
    expect(attrs.role).toBe('region');
    expect(attrs.ariaLabel).toBe('Sliding window sums output');
  });

  test('S1_RunningDemo: Clicking Run Demo transitions to RunningDemo - button disabled and calculating message shown', async ({ page }) => {
    // This test validates the transition S0 -> S1 when clicking the run button
    const demo = new SlidingWindowDemoPage(page);

    // Click the button to trigger the demo
    await demo.clickRun();

    // Immediately after click, the button should be disabled (entry action effect)
    const disabled = await demo.isRunDisabled();
    expect(disabled).toBeTruthy();

    // The demoOutput should display the "Calculating sliding window sums..." message exactly as in entry_actions
    const text = await demo.getOutputText();
    // The script sets: "Calculating sliding window sums...\n\n"
    // Normalize line endings for robust matching
    const normalized = text.replace(/\r\n/g, '\n');
    expect(normalized).toBe('Calculating sliding window sums...\n\n');

    // Attempting to click while disabled should have no visible effect and should not throw errors
    // Use try/catch to ensure no test-level exceptions; but the application's disabled attribute should prevent action
    try {
      await demo.runBtn.click({ timeout: 200 }).catch(() => {}); // ignore click rejection
    } catch (e) {
      // We don't expect the test harness to throw here; just ignore
    }

    // Ensure still disabled right after attempted second click
    const stillDisabled = await demo.isRunDisabled();
    expect(stillDisabled).toBeTruthy();
  });

  test('Transition S1_RunningDemo -> S2_DemoCompleted: After timeout demo completes and outputs expected window sums, button re-enabled', async ({ page }) => {
    // Validate the demo completes and reaches final state S2_DemoCompleted
    const demo = new SlidingWindowDemoPage(page);

    // Click to start demo
    await demo.clickRun();

    // Wait longer than the setTimeout delay (400ms in the page). Use 750ms to be safe.
    await page.waitForTimeout(750);

    // After completion, the button should be re-enabled
    await expect(demo.runBtn).toBeEnabled();

    // Compute expected outputs here using the same logic (without touching page internals)
    const expectedArray = computeExpectedOutputs();
    const expectedText = expectedArray.join('\n');

    const actualText = await demo.getOutputText();
    // Trim both ends to avoid platform newline quirks
    expect(actualText.trim()).toBe(expectedText.trim());
  });

  test('Edge case: Rapid double-click should not produce duplicate runs or uncaught errors (button disabled protects against re-run)', async ({ page }) => {
    // This test intentionally tries to trigger multiple clicks quickly to exercise error scenarios or race conditions
    const demo = new SlidingWindowDemoPage(page);

    // Perform a rapid double-click action on the Run Demo button
    // Even if dblclick sends two click events, the handler disables button synchronously, protecting from re-run
    await demo.runBtn.dblclick();

    // Immediately check that the state indicates RunningDemo
    const immediateText = await demo.getOutputText();
    expect(immediateText.replace(/\r\n/g, '\n')).toBe('Calculating sliding window sums...\n\n');

    // Wait for completion
    await page.waitForTimeout(750);

    // After completion, make sure output shows expected number of windows (arr.length - k + 1)
    const expectedArray = computeExpectedOutputs();
    const actualText = await demo.getOutputText();
    // Compare trimmed content
    expect(actualText.trim()).toBe(expectedArray.join('\n').trim());

    // Confirm no console or page errors were recorded (this is also asserted in afterEach, but we assert again for clarity)
    // (The afterEach will fail the test if any errors exist)
  });

  test('Accessibility & content checks: demo output container has aria-live on parent and content is readable', async ({ page }) => {
    const demo = new SlidingWindowDemoPage(page);

    // Check that the demo container has aria-live and related attributes set for polite updates
    const containerHasAriaLive = await demo.container.getAttribute('aria-live');
    const containerAriaAtomic = await demo.container.getAttribute('aria-atomic');
    const containerAriaRelevant = await demo.container.getAttribute('aria-relevant');

    expect(containerHasAriaLive).toBe('polite');
    expect(containerAriaAtomic).toBe('true');
    expect(containerAriaRelevant).toBe('additions');

    // Start the demo to ensure content updates happen in the aria-live region
    await demo.clickRun();
    await page.waitForTimeout(750);

    // Ensure demoOutput contains text and is not empty after run
    const afterText = await demo.getOutputText();
    expect(afterText.trim().length).toBeGreaterThan(0);
  });
});