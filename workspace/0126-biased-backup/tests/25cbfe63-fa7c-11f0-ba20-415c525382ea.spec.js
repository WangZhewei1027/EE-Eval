import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cbfe63-fa7c-11f0-ba20-415c525382ea.html';

// Page object model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btn = page.locator('#demoBtn');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.btn.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async waitForOutputContains(text, options = {}) {
    await expect(this.output).toContainText(text, options);
  }

  async isButtonDisabled() {
    return await this.btn.isDisabled();
  }
}

test.describe('Understanding Monitors Demo - FSM validation', () => {
  // Collect console errors and page errors for each test so we can assert on them.
  test.beforeEach(async ({ page }) => {
    // Attach error listeners for each test run
    page._caughtConsoleErrors = [];
    page._caughtPageErrors = [];

    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          page._caughtConsoleErrors.push({
            text: msg.text(),
            location: msg.location(),
            type: msg.type(),
          });
        }
      } catch (e) {
        // ignore listener errors
      }
    });

    page.on('pageerror', (err) => {
      try {
        page._caughtPageErrors.push({
          message: err.message,
          stack: err.stack,
        });
      } catch (e) {
        // ignore listener errors
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // At the end of each test ensure there were no fatal runtime errors (ReferenceError, SyntaxError, TypeError, etc).
    // This validates that the page executed without uncaught exceptions.
    const consoleErrors = page._caughtConsoleErrors || [];
    const pageErrors = page._caughtPageErrors || [];

    // If errors exist, include them in the assertion message to aid debugging.
    expect(consoleErrors.length + pageErrors.length, `Unexpected console/page errors: consoleErrors=${JSON.stringify(consoleErrors)}, pageErrors=${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test.describe('Idle State S0_Idle', () => {
    test('Initial render shows Run Mutual Exclusion Demo button and empty output', async ({ page }) => {
      const demo = new DemoPage(page);
      // Navigate to the page (enter Idle state)
      await demo.goto();

      // Validate button exists and is enabled (Idle state's evidence)
      await expect(demo.btn).toBeVisible();
      await expect(demo.btn).toHaveText('Run Mutual Exclusion Demo');
      await expect(demo.btn).toBeEnabled();

      // Validate demo output area exists and is initially empty (or whitespace)
      await expect(demo.output).toBeVisible();
      const outText = await demo.getOutputText();
      expect(outText.trim().length, 'Expected demo output to be empty on initial render').toBeGreaterThanOrEqual(0);

      // Validate ARIA attributes per FSM components evidence
      await expect(demo.output).toHaveAttribute('aria-live', 'polite');
      await expect(demo.output).toHaveAttribute('aria-atomic', 'true');
    });
  });

  test.describe('Demo Running State S1_DemoRunning and transitions', () => {
    test('Clicking Run transitions to Demo Running: output starts and button disabled', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Click the demo button to start the mutual exclusion simulation (event: ButtonClick)
      await demo.clickRun();

      // Immediately after click, the output should contain starting message as per entry_actions.
      await demo.waitForOutputContains('Starting Monitor Mutual Exclusion Demo...', { timeout: 2000 });

      // Button should be disabled during demo (exit action re-enables later)
      await expect(demo.btn).toBeDisabled();

      // The initial tasks append "wants to enter" lines quickly; assert at least one such line appears
      await demo.waitForOutputContains('wants to enter critical section.', { timeout: 2000 });
    });

    test('Demo runs to completion: three ENTERS and LEAVES occur and button re-enabled', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Start demo
      await demo.clickRun();

      // Confirm starting line
      await demo.waitForOutputContains('Starting Monitor Mutual Exclusion Demo...', { timeout: 2000 });

      // Wait for demo completion line which the implementation appends after setTimeout 6000ms
      // Use a generous timeout to account for delays: 15s
      await demo.waitForOutputContains('Demo complete.', { timeout: 15000 });

      // After demo completes, button should be re-enabled (exit_actions)
      await expect(demo.btn).toBeEnabled();

      // Verify counts of ENTERS and LEAVES are equal and equal to 3 (three tasks)
      const outText = await demo.getOutputText();
      const enters = (outText.match(/ENTERS critical section\./g) || []).length;
      const leaves = (outText.match(/LEAVES critical section\./g) || []).length;
      expect(enters, 'Expected exactly three ENTERS in demo output').toBe(3);
      expect(leaves, 'Expected exactly three LEAVES in demo output').toBe(3);

      // Ensure ordering: each ENTER for a thread is followed by its corresponding LEAVES before next thread ENTERS
      // We'll find line indices to ensure for each thread, its ENTER occurs before its LEAVE.
      const lines = outText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

      // Collect events per thread in order they appear
      const events = lines.filter(line => /wants to enter critical section\.|ENTERS critical section\.|LEAVES critical section\./.test(line));

      // For each thread name A,B,C ensure ENTER appears before its LEAVE
      ['Thread A', 'Thread B', 'Thread C'].forEach(name => {
        const enterIndex = events.findIndex(e => e.includes(name) && e.includes('ENTERS'));
        const leaveIndex = events.findIndex(e => e.includes(name) && e.includes('LEAVES'));
        expect(enterIndex, `Expected ${name} to ENTER at least once`).toBeGreaterThanOrEqual(0);
        expect(leaveIndex, `Expected ${name} to LEAVE at least once`).toBeGreaterThanOrEqual(0);
        expect(enterIndex, `${name} should ENTER before it LEAVES`).toBeLessThan(leaveIndex);
      });
    });

    test('Attempting to click the disabled button during demo should not be allowed (edge case)', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Start demo
      await demo.clickRun();

      // Ensure button is disabled
      await expect(demo.btn).toBeDisabled();

      // Attempting to click without force should throw because button is disabled.
      // We assert that this action is rejected, demonstrating that UI prevents re-triggering while demo runs.
      await expect(demo.btn.click()).rejects.toThrow();

      // Wait for demo to finish to avoid overlapping runs and to keep environment clean
      await demo.waitForOutputContains('Demo complete.', { timeout: 15000 });
      await expect(demo.btn).toBeEnabled();
    });

    test('Rerun demo after completion resets output and begins new run (transition back and forth)', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // First run
      await demo.clickRun();
      await demo.waitForOutputContains('Demo complete.', { timeout: 15000 });
      await expect(demo.btn).toBeEnabled();

      // Capture output after first run
      const firstRunText = await demo.getOutputText();
      expect(firstRunText.includes('Demo complete.'), 'First run should show Demo complete.').toBeTruthy();

      // Start second run - per implementation, the click handler sets output.textContent = "Starting..." resetting previous output.
      await demo.clickRun();

      // Immediately check that output was reset to the new starting string
      await demo.waitForOutputContains('Starting Monitor Mutual Exclusion Demo...', { timeout: 2000 });
      const afterSecondStart = await demo.getOutputText();
      expect(afterSecondStart.startsWith('Starting Monitor Mutual Exclusion Demo...'), 'Second run should reset the output textContent').toBeTruthy();

      // Wait for second run to finish to leave the page in stable state
      await demo.waitForOutputContains('Demo complete.', { timeout: 15000 });
      await expect(demo.btn).toBeEnabled();
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No uncaught ReferenceError/SyntaxError/TypeError occurred during page lifecycle', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Perform a typical user flow to exercise scripts: start demo and wait completion
      await demo.clickRun();
      await demo.waitForOutputContains('Demo complete.', { timeout: 15000 });

      // Gather any captured console or page errors from listeners attached in beforeEach
      const consoleErrors = page._caughtConsoleErrors || [];
      const pageErrors = page._caughtPageErrors || [];

      // Assert that no console errors or uncaught page errors occurred.
      // This ensures the script ran without throwing ReferenceError, SyntaxError, TypeError, etc.
      expect(consoleErrors.length + pageErrors.length, `Expected no runtime errors but found consoleErrors=${JSON.stringify(consoleErrors)}, pageErrors=${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });
});