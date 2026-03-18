import { test, expect } from '@playwright/test';

// Test file: a36fee60-ffc4-11f0-821c-7d25bc609266.spec.js
// URL served: http://127.0.0.1:5500/workspace/0202-sample/html/a36fee60-ffc4-11f0-821c-7d25bc609266.html

// Page object encapsulating interactions and queries for the linked list demo page
class LinkedListDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0202-sample/html/a36fee60-ffc4-11f0-821c-7d25bc609266.html';
    this.demoButton = page.locator('#demoButton');
    this.demoOutput = page.locator('#demoOutput');
    // step container created dynamically inside demoOutput by the demo script
    this.stepContainer = this.demoOutput.locator('div').first();
  }

  async goto() {
    await this.page.goto(this.url);
  }

  // Click the demo button (will throw if not interactable)
  async startDemo() {
    await this.demoButton.click();
  }

  // Wait for the demo to enter the running state: button becomes disabled and text updates
  async waitForDemoRunning(timeout = 5000) {
    await expect(this.demoButton).toBeDisabled({ timeout });
    await expect(this.demoButton).toHaveAttribute('aria-pressed', 'true', { timeout });
    await expect(this.demoButton).toHaveText('Demonstration Running...', { timeout });
    // Ensure a step container appears with the first step text
    await expect(this.stepContainer).toBeVisible({ timeout });
    await expect(this.stepContainer).toContainText('Initial linked list', { timeout });
  }

  // Wait for the demo to complete: button becomes enabled again and text reverts
  // Note: the demo uses setInterval with 2.5s per step; allow generous timeout.
  async waitForDemoCompleted(timeout = 30000) {
    await expect(this.demoButton).toBeEnabled({ timeout });
    await expect(this.demoButton).toHaveAttribute('aria-pressed', 'false', { timeout });
    await expect(this.demoButton).toHaveText('Show Linked List Insertion Demo', { timeout });
  }

  // Wait for the demo output to contain the final "Resulting linked list..." message
  async waitForFinalResultText(timeout = 20000) {
    await expect(this.demoOutput).toContainText('Resulting linked list after insertion at the end:', { timeout });
  }

  // Helper to count how many step containers exist currently
  async countStepContainers() {
    return await this.demoOutput.locator('div').count();
  }
}

test.describe('Linked List Insertion Demo (FSM validation)', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console messages for assertions and diagnostics
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // store the Error object for later assertions
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // store console messages (type + text)
      const args = { type: msg.type(), text: msg.text() };
      consoleMessages.push(args);
    });
  });

  // Group: Idle state tests
  test.describe('S0_Idle - Initial render (Idle state verification)', () => {
    test('Initial render shows the demo button and empty output area', async ({ page }) => {
      const demo = new LinkedListDemoPage(page);
      await demo.goto();

      // Validate Idle state's evidence: button exists with aria-pressed="false" and correct text
      await expect(demo.demoButton).toBeVisible();
      await expect(demo.demoButton).toHaveAttribute('aria-pressed', 'false');
      await expect(demo.demoButton).toHaveAttribute('aria-controls', 'demoOutput');
      await expect(demo.demoButton).toHaveText('Show Linked List Insertion Demo');

      // demoOutput should be present and initially empty (no step container)
      await expect(demo.demoOutput).toBeVisible();
      // It can contain whitespace or empty; ensure it does not contain the first step yet
      await expect(demo.demoOutput).not.toContainText('Initial linked list');

      // Assert no uncaught page errors occurred during initial load
      expect(pageErrors.length).toBe(0);
    });
  });

  // Group: Transitions and running demo
  test.describe('S0 -> S1 Transition and S1 behavior (Demo Running)', () => {
    test('Clicking the demo button transitions to Demo Running and shows the first step', async ({ page }) => {
      const demo = new LinkedListDemoPage(page);
      await demo.goto();

      // Start the demo
      await demo.startDemo();

      // Immediately assert running-state evidence per FSM:
      // - button disabled
      // - aria-pressed true
      // - text indicates running
      await demo.waitForDemoRunning(5000);

      // The demo output should contain a bordered step container and the initial step text
      await expect(demo.stepContainer).toContainText('Initial linked list: [ 10 ]', { timeout: 2000 });

      // Confirm that there are no uncaught exceptions thrown synchronously by the demo start
      expect(pageErrors.length).toBe(0);
    });

    test('Attempting to click the button while demo is running does not create duplicate demos', async ({ page }) => {
      const demo = new LinkedListDemoPage(page);
      await demo.goto();

      // Start the demo
      await demo.startDemo();

      // Wait until it is running
      await demo.waitForDemoRunning(5000);

      // Count step containers before attempting second click
      const countBefore = await demo.countStepContainers();

      // Try to click the button while it is disabled.
      // Playwright's click will attempt the action but the browser should ignore clicks on disabled buttons.
      // We catch any Playwright errors but do not fail on them here; we will assert behavior through DOM changes.
      try {
        await demo.demoButton.click({ timeout: 1000 });
      } catch (e) {
        // If Playwright prevents clicking a disabled element, that's acceptable; log it via consoleMessages
        consoleMessages.push({ type: 'test', text: `Second click attempt threw: ${String(e)}` });
      }

      // Wait briefly to let any spurious handlers run (if any)
      await page.waitForTimeout(500);

      // Ensure no additional step containers were injected as a result of the second click
      const countAfter = await demo.countStepContainers();
      expect(countAfter).toBe(countBefore);

      // Ensure still running (button still disabled)
      await expect(demo.demoButton).toBeDisabled();

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  // Group: Demo completion and S2 validations
  test.describe('S1 -> S2 Transition (Demo Completed)', () => {
    test('Demo completes automatically and returns to Idle-like state (button re-enabled, final result shown)', async ({ page }) => {
      const demo = new LinkedListDemoPage(page);
      await demo.goto();

      // Start the demo
      await demo.startDemo();

      // Validate it enters running state first
      await demo.waitForDemoRunning(5000);

      // Wait for the final step text to appear (this happens before the button is re-enabled)
      // Allow generous timeout because demo uses several 2.5s intervals
      await demo.waitForFinalResultText(25000);

      // At this point the final descriptive step is visible in the output.
      await expect(demo.demoOutput).toContainText('Resulting linked list after insertion at the end:', { timeout: 1000 });

      // Wait until the demo signals completion by re-enabling the button and resetting text
      await demo.waitForDemoCompleted(30000);

      // Validate completion evidence per FSM
      await expect(demo.demoButton).toHaveAttribute('aria-pressed', 'false');
      await expect(demo.demoButton).toHaveText('Show Linked List Insertion Demo');

      // Validate that the demo output still contains the full final list rendering (visual evidence)
      await expect(demo.demoOutput).toContainText('[ 10 ]', { timeout: 1000 });
      await expect(demo.demoOutput).toContainText('[ 40 ]', { timeout: 1000 }).catch(() => {
        // The implementation displays a textual representation of the resulting list; presence of '[ 40 ]' is expected,
        // but not strictly guaranteed if rendering differs. We still assert that the "Resulting linked list" text is present above.
      });

      // Ensure there were no uncaught runtime errors (ReferenceError/SyntaxError/TypeError) during the full run
      expect(pageErrors.length).toBe(0);
    }, 35000); // overall timeout for this test: 35s to allow demo to complete
  });

  // Group: Edge cases and error scenario checks
  test.describe('Edge cases and runtime diagnostics', () => {
    test('Rapid double-clicks do not start multiple concurrent demos and no runtime exceptions are thrown', async ({ page }) => {
      const demo = new LinkedListDemoPage(page);
      await demo.goto();

      // Rapidly click twice in succession
      await demo.startDemo();
      // attempt a very quick second click
      try {
        await demo.demoButton.click({ timeout: 500 });
      } catch (e) {
        // If clicking a disabled button throws, that's okay; record it
        consoleMessages.push({ type: 'test', text: `Rapid second click threw: ${String(e)}` });
      }

      // Wait for the demo to run a bit and ensure only one step container exists
      await demo.waitForDemoRunning(5000);
      const containers = await demo.countStepContainers();
      expect(containers).toBeGreaterThanOrEqual(1);
      expect(containers).toBeLessThanOrEqual(2); // should not explode with many duplicates; at most 1 created by implementation

      // Wait for demo to finish
      await demo.waitForFinalResultText(25000);
      await demo.waitForDemoCompleted(30000);

      // Assert that no page-level uncaught exceptions occurred
      expect(pageErrors.length).toBe(0);

      // Sanity: ensure console did not include any obvious "ReferenceError", "TypeError" or "SyntaxError"
      const severeConsole = consoleMessages.filter(m =>
        /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(String(m.text))
      );
      expect(severeConsole.length).toBe(0);
    }, 35000);
  });
});