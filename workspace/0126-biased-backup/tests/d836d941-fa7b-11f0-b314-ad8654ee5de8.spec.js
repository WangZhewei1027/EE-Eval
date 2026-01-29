import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d836d941-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object Model for the demo page
class TwoPointersDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemo');
    this.output = page.locator('#demo');
    // collectors for console and page errors
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  // Attach listeners to capture console messages and page errors
  async attachListeners() {
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
    this.page.on('pageerror', (err) => {
      // pageerror typically is an Error object
      this.pageErrors.push(String(err && err.message ? err.message : err));
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure listeners attached (call after navigation if needed)
    await this.attachListeners();
  }

  // Returns boolean whether run button is enabled
  async isRunButtonEnabled() {
    return await this.runBtn.isEnabled();
  }

  // Click the Run small demonstration button
  async clickRunButton() {
    await this.runBtn.click();
  }

  // Get text content of demo output
  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  // Wait until output contains a substring or timeout
  async waitForOutputContains(substr, options = { timeout: 2000 }) {
    await this.page.waitForFunction(
      (selector, s) => {
        const el = document.querySelector(selector);
        return !!el && el.textContent && el.textContent.indexOf(s) !== -1;
      },
      this.output.selector,
      substr,
      options
    );
  }
}

test.describe('Two Pointers — Demo FSM (d836d941-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Basic smoke test: page loads and initial Idle state (S0_Idle) is rendered
  test('S0_Idle: initial render shows Run button and empty demo output', async ({ page }) => {
    const demo = new TwoPointersDemoPage(page);
    // Navigate to the page (load exactly as-is)
    await demo.goto();

    // Validate the run button exists and is enabled initially (Idle state)
    await expect(demo.runBtn).toBeVisible();
    await expect(demo.runBtn).toHaveText('Run small demonstration');
    expect(await demo.isRunButtonEnabled()).toBe(true);

    // Validate demo output is empty at Idle state
    const initialText = await demo.getOutputText();
    expect(initialText.trim()).toBe('', 'Demo output should be empty on initial render (Idle).');

    // Assert no runtime page errors or console Error entries occurred during load
    // (The test observes console and page errors and asserts they did not occur)
    expect(demo.pageErrors).toEqual([]);
    expect(demo.consoleErrors).toEqual([]);
  });

  test.describe('Transitions: RunDemoClick -> DemoRunning -> DemoCompleted', () => {
    // Validate S0 -> S1 transition on click and S1 -> S2 after timeout
    test('S0_Idle -> S1_DemoRunning: clicking Run disables button and shows "Running demonstration..."', async ({ page }) => {
      const demo = new TwoPointersDemoPage(page);
      await demo.goto();

      // Click the Run button to trigger the demonstration (this is the RunDemoClick event)
      await demo.clickRunButton();

      // Immediately after clicking, button should be disabled (onEnter action of S1_DemoRunning)
      expect(await demo.isRunButtonEnabled()).toBe(false);

      // Output should show the running state text as per onEnter actions for S1
      // We check the exact expected interim message
      const interim = await demo.getOutputText();
      expect(interim).toBe('Running demonstration...');

      // Ensure no page errors were produced immediately
      expect(demo.pageErrors).toEqual([]);
      expect(demo.consoleErrors).toEqual([]);
    });

    test('S1_DemoRunning -> S2_DemoCompleted: after timeout output contains full steps and button is re-enabled', async ({ page }) => {
      const demo = new TwoPointersDemoPage(page);
      await demo.goto();

      // Click to start demo
      await demo.clickRunButton();

      // Confirm we are in running state
      expect(await demo.isRunButtonEnabled()).toBe(false);
      expect(await demo.getOutputText()).toBe('Running demonstration...');

      // Wait for the demo to complete and produce the step-by-step output.
      // The implementation uses setTimeout with 250ms, so allow a bit more.
      await demo.waitForOutputContains('Found: indices', { timeout: 2000 });

      // Now the output should contain the sequence of steps including array and target lines
      const finalText = await demo.getOutputText();
      expect(finalText).toContain('Array: [1, 2, 3, 4, 6, 8]');
      expect(finalText).toContain('Target: 10');
      expect(finalText).toContain('Start: left = 0 (value = 1), right = 5 (value = 8)');
      // Confirm it reports the found result (expected by demoTwoSum with provided nums and target)
      expect(finalText).toContain('Found: indices (1, 5) — values (2, 8)');

      // After completion, button should be re-enabled (S2_DemoCompleted exit action)
      expect(await demo.isRunButtonEnabled()).toBe(true);

      // There should be no page errors captured throughout the run
      expect(demo.pageErrors).toEqual([]);
      expect(demo.consoleErrors).toEqual([]);
    });

    test('Click while running: verify button is disabled and does not re-trigger mid-run', async ({ page }) => {
      const demo = new TwoPointersDemoPage(page);
      await demo.goto();

      // Start the demo
      await demo.clickRunButton();

      // Immediately confirm disabled
      expect(await demo.isRunButtonEnabled()).toBe(false);

      // Attempting to click while disabled should not throw internal JS errors.
      // Playwright's page.click will attempt to click; we assert no page errors occurred
      // and that the demo output still transitions normally to completion.
      // We do NOT force-click to avoid bypassing the disabled state.
      let clickAttemptError = null;
      try {
        // Try a second click; if Playwright blocks clicking a disabled element it will throw.
        // We catch any error and record it, but we will assert that it does not cause runtime page errors.
        await demo.runBtn.click({ timeout: 200 }).catch(e => { throw e; });
      } catch (e) {
        clickAttemptError = e;
      }

      // Either clicking a disabled button resulted in a Playwright action error (acceptable),
      // or it succeeded but had no effect. In either case, the page should not have JS runtime errors.
      expect(demo.pageErrors).toEqual([]);
      expect(demo.consoleErrors).toEqual([]);

      // Wait for completion and verify expected final state
      await demo.waitForOutputContains('Found: indices', { timeout: 2000 });
      expect(await demo.isRunButtonEnabled()).toBe(true);

      // If Playwright threw an action error trying to click a disabled element,
      // it should be a Playwright-level error, not a page runtime error.
      // We assert that such an action-level error is either null (no error) or an Error object.
      if (clickAttemptError) {
        expect(clickAttemptError).toBeInstanceOf(Error);
      }
    });
  });

  test.describe('Edge cases & robustness', () => {
    test('Multiple sequential runs: clicking again after completion produces same result and no errors', async ({ page }) => {
      const demo = new TwoPointersDemoPage(page);
      await demo.goto();

      // Run once
      await demo.clickRunButton();
      await demo.waitForOutputContains('Found: indices', { timeout: 2000 });
      expect(await demo.isRunButtonEnabled()).toBe(true);

      // Capture first output
      const first = await demo.getOutputText();

      // Run a second time
      await demo.clickRunButton();
      await demo.waitForOutputContains('Found: indices', { timeout: 2000 });
      expect(await demo.isRunButtonEnabled()).toBe(true);

      const second = await demo.getOutputText();

      // Both outputs should be strings and contain the expected result; they should be similar
      expect(first).toContain('Found: indices (1, 5)');
      expect(second).toContain('Found: indices (1, 5)');
      // It's acceptable if they are identical; ensure no runtime page errors across repeated runs
      expect(demo.pageErrors).toEqual([]);
      expect(demo.consoleErrors).toEqual([]);
    });

    test('Page-level Error observation: ensure no ReferenceError/SyntaxError/TypeError occurred', async ({ page }) => {
      // This test explicitly observes console and page errors while loading the page,
      // as required: we load the page exactly as-is and assert that no runtime
      // ReferenceError/SyntaxError/TypeError occurred during load or demo runs.
      const demo = new TwoPointersDemoPage(page);
      await demo.goto();

      // Run the demo once to surface possible runtime errors
      await demo.clickRunButton();
      await demo.waitForOutputContains('Found: indices', { timeout: 2000 });

      // Collate page errors and console.error messages
      // Expect none of the common runtime error types to have been recorded
      expect(demo.pageErrors.length).toBe(0);
      expect(demo.consoleErrors.length).toBe(0);

      // For clarity in test output, assert that the page content includes the critical elements
      expect(await demo.runBtn.innerText()).toBe('Run small demonstration');
      expect(await demo.output.getAttribute('class')).toContain('demo-output');
    });
  });
});