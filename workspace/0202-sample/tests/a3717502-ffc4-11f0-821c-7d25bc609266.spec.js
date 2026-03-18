import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0202-sample/html/a3717502-ffc4-11f0-821c-7d25bc609266.html';

// Page Object for the Merge Sort Demo page
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
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getButtonText() {
    return this.button.textContent();
  }

  async isButtonEnabled() {
    return this.button.isEnabled();
  }

  async clickDemo(options = {}) {
    await this.button.click(options);
  }

  async getOutputText() {
    return this.output.textContent();
  }

  async waitForOutputContains(text, timeout = 2000) {
    await expect(this.output).toContainText(text, { timeout });
  }
}

test.describe('Divide and Conquer: Merge Sort Demo (FSM validation)', () => {
  let consoleMessages = [];
  let pageErrors = [];
  let page;

  test.beforeEach(async ({ browser }) => {
    // Create a new context/page for isolation
    const context = await browser.newContext();
    page = await context.newPage();

    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (all types) for inspection
    page.on('console', (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });
  });

  test.afterEach(async () => {
    // Close the page to release resources
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('renders expected static content and exposes initial components', async () => {
      // This test validates the Idle state evidence:
      // - #demoButton exists with text "Show Merge Sort Demo"
      // - #demoOutput exists and is initially empty
      // - No runtime page errors occurred during initial render
      const demo = new DemoPage(page);
      await demo.goto();

      // Verify button presence and text content
      await expect(page.locator('#demoButton')).toBeVisible();
      await expect(page.locator('#demoButton')).toHaveText('Show Merge Sort Demo');
      await expect(page.locator('#demoButton')).toBeEnabled();

      // Verify output container exists and initially empty
      await expect(page.locator('#demoOutput')).toBeVisible();
      const initialOutput = await demo.getOutputText();
      expect(initialOutput.trim()).toBe('', 'Expected demo output to be empty on initial load');

      // Verify accessibility attributes for the output container (evidence from FSM components)
      await expect(page.locator('#demoOutput')).toHaveAttribute('aria-live', 'polite');
      await expect(page.locator('#demoOutput')).toHaveAttribute('aria-atomic', 'true');

      // Check that no page errors (ReferenceError/SyntaxError/TypeError) occurred during load
      expect(pageErrors.length).toBe(
        0,
        `Expected no page errors on initial load, but found: ${JSON.stringify(pageErrors)}`
      );

      // Check console did not emit error-level messages during initial render
      const errorConsoleMessages = consoleMessages.filter((m) => m.startsWith('[error]'));
      expect(errorConsoleMessages.length).toBe(
        0,
        `Expected no console errors on initial load, but found: ${JSON.stringify(errorConsoleMessages)}`
      );

      // Verify FSM S0 entry action "renderPage()" is not defined globally (the page still renders correctly)
      // We check that window.renderPage is undefined to show that the entry action is not a global function.
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe(
        'undefined',
        'Expected no global function named renderPage (S0 entry action is not present as a global).'
      );
    });
  });

  test.describe('Demo lifecycle and transitions (S0 -> S1 -> S2)', () => {
    test('clicking the demo button starts the demo and produces expected textual output (S1_DemoStarted evidence)', async () => {
      // This test validates that clicking the button triggers mergeSortDemo and outputs logs:
      // - Output includes "Starting merge sort demonstration..."
      // - Output includes "Dividing" and "Merging" traces
      // - mergeSortDemo is invoked as evidenced by textual logs (even though function is not global)
      const demo = new DemoPage(page);
      await demo.goto();

      // Ensure no page errors prior to interaction
      expect(pageErrors.length).toBe(0);

      // Click the demo button to trigger the demo (S0 -> S1 transition)
      await demo.clickDemo();

      // Wait for primary evidence line to appear in output
      await demo.waitForOutputContains('Starting merge sort demonstration...');

      // Verify output contains expected demonstration traces
      const outputText = await demo.getOutputText();
      expect(outputText).toContain('Starting merge sort demonstration...');
      expect(outputText).toContain('Dividing');
      expect(outputText).toContain('Merging:');
      expect(outputText).toContain('Merged result');

      // Final merged result for the provided array [38, 27, 43, 3] should be visible
      // Expected final merged line: "Merged result: [3, 27, 38, 43]"
      expect(outputText).toContain('Merged result: [3, 27, 38, 43]');

      // Confirm that window.mergeSortDemo is not exposed as a global function (it is internal to the IIFE)
      const mergeSortDemoType = await page.evaluate(() => typeof window.mergeSortDemo);
      expect(mergeSortDemoType).toBe(
        'undefined',
        'Expected mergeSortDemo not to be a global function (it is defined inside an IIFE).'
      );

      // No page errors should have been thrown during the demo run
      expect(pageErrors.length).toBe(0);

      // No error-level console messages should have been emitted during the demo run
      const errorConsoleMessages = consoleMessages.filter((m) => m.startsWith('[error]'));
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('after demo completes the UI transitions to Demo Completed state (S2_DemoCompleted evidence)', async () => {
      // This test validates the S1 -> S2 transition:
      // - demoButton becomes disabled
      // - demoButton.textContent becomes "Demo Completed"
      // - output contains the merged logs
      const demo = new DemoPage(page);
      await demo.goto();

      // Click to start the demo
      await demo.clickDemo();

      // Wait for output evidence
      await demo.waitForOutputContains('Starting merge sort demonstration...');

      // After the demo logic completes synchronously in this implementation,
      // the button should be disabled and its text updated to "Demo Completed"
      await expect(page.locator('#demoButton')).toBeDisabled();
      await expect(page.locator('#demoButton')).toHaveText('Demo Completed');

      // Confirm output still contains expected final merged result
      const outputText = await demo.getOutputText();
      expect(outputText).toContain('Merged result: [3, 27, 38, 43]');

      // Validate that FSM final-state evidence (button disabled + text change) holds true
      expect(await demo.isButtonEnabled()).toBe(false);

      // Ensure no uncaught exceptions occurred
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('subsequent click attempts are prevented after completion (button disabled)', async () => {
      // This test validates that once the demo completes, the button is disabled
      // and further user clicks cannot trigger the demo again.
      const demo = new DemoPage(page);
      await demo.goto();

      // Start the demo
      await demo.clickDemo();

      // Wait for completion evidence
      await demo.waitForOutputContains('Starting merge sort demonstration...');

      // Ensure button is now disabled
      await expect(page.locator('#demoButton')).toBeDisabled();

      // Attempt to click the disabled button and assert that Playwright reports it as not enabled.
      // Playwright's click will throw for disabled elements; we capture that behavior.
      let clickThrew = false;
      try {
        // Attempt a regular click (should fail because the element is disabled)
        await page.click('#demoButton', { timeout: 1000 });
      } catch (err) {
        clickThrew = true;
        // We expect some sort of element not enabled / not clickable error
        expect(String(err.message || err)).toContain('Element is not enabled', {
          timeout: 0,
        });
      }
      expect(clickThrew).toBe(
        true,
        'Expected clicking the disabled demo button to throw an error (element not enabled).'
      );

      // Double-check that output did not change after the failed click attempt:
      const outputTextAfter = await demo.getOutputText();
      expect(outputTextAfter).toContain('Starting merge sort demonstration...');
      expect(outputTextAfter).toContain('Merged result: [3, 27, 38, 43]');
    });

    test('no unexpected runtime errors (ReferenceError/SyntaxError/TypeError) occur during interactions', async () => {
      // This test explicitly inspects captured page errors and console error messages.
      // It asserts that the runtime did not emit uncaught exceptions of the kinds specified.
      const demo = new DemoPage(page);
      await demo.goto();

      // Interact with the page to execute the demo code path
      await demo.clickDemo();
      await demo.waitForOutputContains('Starting merge sort demonstration...');

      // Assert we captured zero page errors
      expect(pageErrors.length).toBe(
        0,
        `Expected no page errors (ReferenceError/SyntaxError/TypeError), but found: ${JSON.stringify(
          pageErrors
        )}`
      );

      // Assert console did not emit error messages
      const consoleErrorMessages = consoleMessages.filter((m) => m.startsWith('[error]'));
      expect(consoleErrorMessages.length).toBe(
        0,
        `Expected no console '[error]' messages, but found: ${JSON.stringify(consoleErrorMessages)}`
      );
    });
  });
});