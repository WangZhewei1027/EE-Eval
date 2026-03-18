import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a36fa040-ffc4-11f0-821c-7d25bc609266.html';

// Page Object for the demo page to encapsulate interactions and queries
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = '#demo-button';
    this.output = '#demo-output';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async isButtonVisible() {
    return await this.page.isVisible(this.button);
  }

  async isButtonEnabled() {
    // Playwright's isEnabled checks "disabled" attribute properly
    return await this.page.isEnabled(this.button);
  }

  async clickDemo(options = {}) {
    // Attempts to click the demo button. Caller may set { force: true } if desired.
    return await this.page.click(this.button, options);
  }

  async getOutputText() {
    return await this.page.$eval(this.output, el => el.textContent || '');
  }

  async getOutputLines() {
    const text = await this.getOutputText();
    // Filter out empty trailing lines
    return text.split('\n').filter(line => line.length > 0);
  }

  async waitForOutputLinesCount(count, timeout = 10000) {
    await this.page.waitForFunction(
      (sel, expected) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const lines = (el.textContent || '').split('\n').filter(l => l.length > 0);
        return lines.length >= expected;
      },
      this.output,
      count,
      { timeout }
    );
  }

  async waitForButtonEnabled(timeout = 10000) {
    await this.page.waitForFunction(
      selector => {
        const btn = document.querySelector(selector);
        return btn && !btn.disabled;
      },
      this.button,
      { timeout }
    );
  }
}

test.describe('Understanding Arrays Demo - FSM and UI acceptance tests', () => {
  let consoleErrors;
  let pageErrors;

  // Global setup for each test: create arrays that collect console/page errors and navigate to page.
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages for inspection
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // No mocking, no injection, load the page exactly as-is.
    const demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // Nothing to teardown other than letting Playwright close page context automatically.
  });

  test('Idle state (S0_Idle): page loads with demo button and empty demo output', async ({ page }) => {
    const demo = new DemoPage(page);

    // Validate button present and enabled (idle state)
    await expect(page.locator(demo.button)).toBeVisible();
    await expect(page.locator(demo.button)).toHaveText('Run Array Access Demo');
    expect(await demo.isButtonEnabled()).toBe(true);

    // Validate demo output area exists and is empty on load
    await expect(page.locator(demo.output)).toBeVisible();
    const outputText = await demo.getOutputText();
    expect(outputText).toBe('', 'Expected demo output to be empty in Idle state');

    // Validate ARIA attributes as part of component checks (from FSM components)
    const ariaLive = await page.getAttribute(demo.output, 'aria-live');
    const ariaAtomic = await page.getAttribute(demo.output, 'aria-atomic');
    expect(ariaLive).toBe('polite');
    expect(ariaAtomic).toBe('true');

    // Ensure no console.error or page errors occurred during initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoRunning: clicking the demo button starts the demo and updates output', async ({ page }) => {
    const demo = new DemoPage(page);

    // Click the demo button to start the demonstration
    await demo.clickDemo();

    // Immediately after click, entry actions in implementation set demoOutput.textContent = '' and demoButton.disabled = true
    // Expect button to be disabled in Demo Running state (S1_DemoRunning entry action)
    await expect(page.locator(demo.button)).toBeDisabled();

    // Because the implementation calls nextStep() immediately, the first step should already be present
    // Wait for at least 1 output line (first step). Use a modest timeout for the immediate append.
    await demo.waitForOutputLinesCount(1, 2000);

    const linesAfterStart = await demo.getOutputLines();
    expect(linesAfterStart.length).toBeGreaterThanOrEqual(1);
    // Basic check that the first expected textual fragment is present
    expect(linesAfterStart[0]).toContain('Step 1: Initialize array');

    // Wait for all 5 steps to appear (the demo code emits 5 steps at 0, 1.3s, 2.6s, 3.9s, 5.2s roughly)
    // Provide generous timeout to accommodate timing differences
    await demo.waitForOutputLinesCount(5, 10000);

    const finalLines = await demo.getOutputLines();
    expect(finalLines.length).toBe(5, 'Expected 5 demo steps to be displayed in output');

    // Verify sequences of step text to ensure demo properly displayed each step in order
    expect(finalLines[0]).toContain('Step 1: Initialize array: fruits');
    expect(finalLines[1]).toContain('Step 2: Access element at index 2');
    expect(finalLines[2]).toContain('Step 3: Modify element at index 1');
    expect(finalLines[3]).toContain('Step 4: Now, fruits array is');
    expect(finalLines[4]).toContain('Step 5: Access element at index 1 again');

    // After the demo finishes, exit action in implementation sets demoButton.disabled = false
    await demo.waitForButtonEnabled(5000); // waiting up to 5s for re-enable
    await expect(page.locator(demo.button)).toBeEnabled();

    // No console errors or unhandled page errors should have occurred during the demo run
    // Capture them now and assert none present
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Attempt to click the demo button while demo is running (disabled) should not be allowed', async ({ page }) => {
    const demo = new DemoPage(page);

    // Start the demo
    await demo.clickDemo();

    // Confirm it is disabled
    await expect(page.locator(demo.button)).toBeDisabled();

    // Attempt to click the disabled button normally -> Playwright should throw because element is disabled
    // We assert that the normal click rejects with an informative error rather than causing unexpected behavior.
    // Use a try/catch to capture the thrown error and assert on it.
    let clickError = null;
    try {
      // This click should fail due to the disabled state
      await demo.clickDemo();
    } catch (err) {
      clickError = err;
    }

    expect(clickError).not.toBeNull();
    // The exact message can differ across Playwright versions, but it should indicate the element is disabled or not enabled
    const errMsg = String(clickError);
    expect(errMsg.toLowerCase()).toContain('disabled');

    // Ensure that no duplicate/extra lines were produced as a result of the attempted click.
    // Wait a short time and confirm line count does not suddenly exceed expected progression.
    await page.waitForTimeout(1600); // allow one timer tick to progress the demo
    const lines = await demo.getOutputLines();
    // Should be between 1 and 2 lines at this point (first immediate, maybe second after timeout)
    expect(lines.length).toBeLessThanOrEqual(2);

    // Let the demo finish to restore state for cleanup; wait for final 5 lines and final enable
    await demo.waitForOutputLinesCount(5, 10000);
    await demo.waitForButtonEnabled(5000);

    // Confirm still no console error / page error
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('FSM-related check: renderPage function is not present on window (implementation difference)', async ({ page }) => {
    // The FSM declares an entry action renderPage(), but the provided implementation does not define it.
    // We must NOT invoke or patch anything. Instead, assert the function is indeed missing so we know
    // the FSM entry action is not implemented in the current page (observational test).
    const hasRenderPage = await page.evaluate(() => {
      // Safely check existence without invoking
      return typeof window.renderPage !== 'function';
    });

    expect(hasRenderPage).toBe(true);

    // Because we didn't call renderPage, there should be no ReferenceError thrown by our test run.
    // Verify no uncaught page errors were recorded
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid interactions and robustness: ensure multiple full demo runs behave correctly (start -> finish -> start again)', async ({ page }) => {
    const demo = new DemoPage(page);

    // Run the demo once
    await demo.clickDemo();
    await demo.waitForOutputLinesCount(5, 10000);
    await demo.waitForButtonEnabled(5000);
    await expect(page.locator(demo.button)).toBeEnabled();

    const firstRunLines = await demo.getOutputLines();
    expect(firstRunLines.length).toBe(5);

    // Clear output by starting the demo again (click) and ensure output resets at entry action
    // The implementation sets demoOutput.textContent = '' at demo start; verify this behavior.
    await demo.clickDemo();
    // Immediately after clicking, the output should be reset to empty string and button disabled
    // Because of immediate nextStep() call, first line will be appended almost immediately; check that output does not contain stale content from prior run beyond the fresh step(s).
    await expect(page.locator(demo.button)).toBeDisabled();

    // The first line of the second run should be present shortly
    await demo.waitForOutputLinesCount(1, 2000);
    const secondRunFirstLines = await demo.getOutputLines();
    expect(secondRunFirstLines[0]).toContain('Step 1: Initialize array');

    // Finish the second run
    await demo.waitForOutputLinesCount(5, 10000);
    await demo.waitForButtonEnabled(5000);
    await expect(page.locator(demo.button)).toBeEnabled();

    // Final assertions: no page errors occurred during repeated runs
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});