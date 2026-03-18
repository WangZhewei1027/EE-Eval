import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3706391-ffc4-11f0-821c-7d25bc609266.html';

/**
 * Page object for the BST demo page.
 * Encapsulates common interactions and assertions for clarity and reuse.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.button.click();
  }

  async getOutputText() {
    return await this.page.$eval('#demoOutput', el => el.textContent || '');
  }

  /**
   * Waits until the output contains the provided substring.
   * @param {string} substring
   * @param {number} timeout
   */
  async waitForOutputContains(substring, timeout = 5000) {
    await expect(this.output).toContainText(substring, { timeout });
  }

  /**
   * Waits for the full completion message at the end of demo run.
   */
  async waitForCompletion(timeout = 15000) {
    await this.waitForOutputContains('Insertion demo completed.\nThe tree now contains keys in sorted order.', timeout);
  }
}

test.describe('BST Demo FSM - a3706391-ffc4-11f0-821c-7d25bc609266', () => {
  // Collect console messages and page errors for each test to assert runtime health
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages with type and text for later assertions / diagnostics
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Basic check to ensure no unexpected runtime errors occurred during page interactions.
    // We assert this in each test explicitly as well, but keep this here to help debugging when tests fail.
  });

  test.describe('State S0_Idle (Initial rendering)', () => {
    test('renders Run BST Insertion Demo button and empty output region', async ({ page }) => {
      // Arrange
      const demo = new DemoPage(page);
      await demo.goto();

      // Assert - the primary button exists and has expected text
      await expect(demo.button).toBeVisible();
      await expect(demo.button).toHaveText('Run BST Insertion Demo');

      // Assert - the output region exists and is initially empty (Idle state)
      await expect(demo.output).toBeVisible();
      const initialText = await demo.getOutputText();
      expect(initialText.trim()).toBe('', 'Expected demo output to be empty in Idle state (S0_Idle)');

      // Assert - accessibility attributes present as described in FSM/components
      await expect(page.locator('#demoOutput')).toHaveAttribute('aria-live', 'polite');
      await expect(page.locator('#demoOutput')).toHaveAttribute('role', 'region');
      await expect(page.locator('#demoOutput')).toHaveAttribute('aria-label', 'Binary Search Tree textual demonstration output');

      // No unexpected page errors (SyntaxError/ReferenceError/TypeError) should have occurred on load
      expect(pageErrors.length, `pageErrors on load: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);
      // No console errors captured
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `console errors on load: ${consoleErrors.map(e => e.text).join(', ')}`).toBe(0);
    });
  });

  test.describe('Transitions: S0 -> S1 -> S2 -> S3 (Full demo run)', () => {
    test('clicking the button starts demo (S0 -> S1) and sequentially inserts keys showing in-order traversals (S2) then completes (S3)', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Start the demo by clicking the button (ButtonClick event -> S1_Inserting)
      await demo.clickRun();

      // S1 Entry action expected: output.textContent = "Starting BST insertion demonstration...\n";
      await demo.waitForOutputContains('Starting BST insertion demonstration...\n', 2000);

      // Verify first insertion message appears (S1 Inserting evidence)
      await demo.waitForOutputContains('Inserting key: 50', 3000);

      // Now validate intermediate S2_DisplayInOrder outputs after each insertion.
      // The demo inserts keys in this order and we expect these in-order results after each insertion:
      const expectedInOrders = [
        '50',
        '30 50',
        '30 50 70',
        '20 30 50 70',
        '20 30 40 50 70',
        '20 30 40 50 60 70',
        '20 30 40 50 60 70 80'
      ];

      // For each expected in-order state, wait for the corresponding "Current in-order traversal:" line.
      // Each insertion has two pauses of 700ms each in the implementation; allow generous timeout per step.
      for (const seq of expectedInOrders) {
        await demo.waitForOutputContains(`Current in-order traversal: ${seq}`, 4000);
      }

      // After all insertions, the final completion message should be appended (S3_Completed)
      await demo.waitForCompletion(5000);

      // Final assert: the output contains the final sorted keys string as described in FSM evidence
      const finalText = await demo.getOutputText();
      expect(finalText).toContain('Insertion demo completed.\nThe tree now contains keys in sorted order.');

      // Ensure there were no runtime errors during the demo run
      expect(pageErrors.length, `pageErrors during demo: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `console errors during demo: ${consoleErrors.map(e => e.text).join(', ')}`).toBe(0);
    }).timeout(30000); // extend timeout because demo has deliberate pauses
  });

  test.describe('Edge cases and interactions', () => {
    test('clicking the Run button again while demo is running resets and restarts demonstration', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Start the demo
      await demo.clickRun();

      // Wait for the first "Inserting key: 50" to confirm demo started
      await demo.waitForOutputContains('Inserting key: 50', 3000);

      // Click the button again while demo is in progress.
      // The implementation sets output.textContent = "Starting BST insertion demonstration...\n" on each click.
      await demo.clickRun();

      // After the second click, output should be reset to the starting message again.
      await demo.waitForOutputContains('Starting BST insertion demonstration...\n', 2000);

      // Verify it proceeds with insertion after restart: expect Inserting key: 50 again
      await demo.waitForOutputContains('Inserting key: 50', 3000);

      // Wait for final completion to avoid leaving background activity
      await demo.waitForCompletion(15000);

      // No page errors or console errors happened as a result of double-clicking
      expect(pageErrors.length, `pageErrors after double-click: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `console errors after double-click: ${consoleErrors.map(e => e.text).join(', ')}`).toBe(0);
    }).timeout(30000);

    test('the demo ignores duplicates (implementation detail) - sanity check via repeated runs', async ({ page }) => {
      // NOTE: We do not inject or modify page functions. We simply run the provided demo twice
      // and observe that the produced in-order at completion is the expected sorted unique sequence.
      const demo = new DemoPage(page);
      await demo.goto();

      // Run the demo once
      await demo.clickRun();
      await demo.waitForCompletion(15000);

      const finalText1 = await demo.getOutputText();
      expect(finalText1).toContain('20 30 40 50 60 70 80');

      // Run it again to ensure the demo behaves deterministically on subsequent runs (no duplication across runs)
      await demo.clickRun();
      await demo.waitForCompletion(15000);

      const finalText2 = await demo.getOutputText();
      expect(finalText2).toContain('20 30 40 50 60 70 80');

      // No runtime errors observed
      expect(pageErrors.length, `pageErrors on repeated runs: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `console errors on repeated runs: ${consoleErrors.map(e => e.text).join(', ')}`).toBe(0);
    }).timeout(35000);
  });

  test.describe('Observability: Console and runtime error monitoring', () => {
    test('collects console messages and ensures there are no uncaught exceptions (ReferenceError/SyntaxError/TypeError)', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // No page errors should exist at this point
      expect(pageErrors.length, `unexpected page errors on load: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

      // Start the demo so any latent runtime issues manifest
      await demo.clickRun();

      // Wait for completion so any async errors occur during run
      await demo.waitForCompletion(20000);

      // Assert there were no page errors captured
      if (pageErrors.length > 0) {
        // For clarity, fail with the messages collected
        const messages = pageErrors.map(e => String(e)).join('\n');
        throw new Error(`Detected page errors: ${messages}`);
      }
      expect(pageErrors.length).toBe(0);

      // Assert there were no console.error messages captured
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      if (errorConsoleMessages.length > 0) {
        const messages = errorConsoleMessages.map(m => m.text).join('\n');
        throw new Error(`Detected console errors: ${messages}`);
      }
      expect(errorConsoleMessages.length).toBe(0);
    }).timeout(30000);
  });
});