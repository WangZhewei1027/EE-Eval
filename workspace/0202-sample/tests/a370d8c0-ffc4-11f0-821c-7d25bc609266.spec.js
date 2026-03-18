import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a370d8c0-ffc4-11f0-821c-7d25bc609266.html';

// Simple Page Object for the demo page
class InsertionSortDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  demoButton() {
    return this.page.locator('#demo-button');
  }

  demoOutput() {
    return this.page.locator('#demo-output');
  }

  // Click the demo button and wait a short while for DOM updates
  async runDemo() {
    await this.demoButton().click();
    // Wait until text content becomes non-empty
    await expect(this.demoOutput()).not.toHaveText('', { timeout: 2000 });
  }

  // Helper to read output text content
  async outputText() {
    return this.demoOutput().innerText();
  }
}

test.describe('Insertion Sort Demo (a370d8c0-ffc4-11f0-821c-7d25bc609266)', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let page;

  // Attach listeners and navigate before each test
  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    consoleMessages = [];

    // Create a fresh context and page so tests are isolated
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect console messages for inspection
    page.on('console', (msg) => {
      // store type and text for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Close the page after each test (teardown)
  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
    // Reset arrays
    pageErrors = [];
    consoleMessages = [];
  });

  test.describe('State S0_Idle (Initial Render)', () => {
    test('should render the page with demo button and empty output (Idle state)', async () => {
      const demo = new InsertionSortDemoPage(page);

      // Validate presence and visibility of the demo button
      const button = demo.demoButton();
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled(); // Idle state: button should be enabled
      await expect(button).toHaveText('Run Insertion Sort Demonstration');

      // Validate demo output exists and is initially empty
      const output = demo.demoOutput();
      await expect(output).toBeVisible();
      // The initial text should be empty string
      await expect(output).toHaveText('', { timeout: 1000 });

      // Accessibility: #demo-output should have aria-live and aria-atomic attributes
      await expect(page.locator('#demo-output')).toHaveAttribute('aria-live', 'polite');
      await expect(page.locator('#demo-output')).toHaveAttribute('aria-atomic', 'true');

      // Ensure no uncaught page errors occurred during initial render
      expect(pageErrors.length, `Expected no page errors on initial load, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

      // Optionally log console messages for debugging if any exist
      // but assert there were no console.error messages
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(errorConsoleMsgs.length, `Expected no console errors/warnings on initial load, got: ${JSON.stringify(errorConsoleMsgs)}`).toBe(0);
    });
  });

  test.describe('Transition: S0_Idle -> S1_DemoRunning (RunDemoClick)', () => {
    test('clicking the button should run the demo, update output, and disable the button', async () => {
      const demo = new InsertionSortDemoPage(page);

      // Click the demo button to trigger runDemo()
      await demo.demoButton().click();

      // After clicking, the demo output should be updated with steps
      const output = demo.demoOutput();
      await expect(output).not.toHaveText('', { timeout: 2000 }); // wait for demo to populate text

      const text = await demo.outputText();

      // Check expected content fragments that indicate the demo ran
      expect(text.includes('Initial array: [8, 3, 5, 4, 6]')).toBeTruthy();
      expect(text.includes('i = 1')).toBeTruthy();
      expect(text.includes('Insert key at position')).toBeTruthy();

      // According to the implementation, the button is disabled at the end of runDemo()
      await expect(demo.demoButton()).toBeDisabled();

      // Verify that demoOutput.textContent was updated (non-empty) - already asserted,
      // but also verify that the output contains multiple lines/steps
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      expect(lines.length).toBeGreaterThan(3); // expect several step lines

      // No uncaught page errors should have occurred while running the demo
      expect(pageErrors.length, `Expected no page errors after running demo, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

      // Ensure no console errors were emitted
      const consoleErrs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(consoleErrs.length, `Expected no console errors/warnings after running demo, got: ${JSON.stringify(consoleErrs)}`).toBe(0);
    });
  });

  test.describe('Edge Cases and FSM exit behavior', () => {
    test('rapid repeated clicks should not duplicate demo output nor cause errors', async () => {
      // Reload to ensure fresh state
      await page.reload({ waitUntil: 'load' });
      const demo = new InsertionSortDemoPage(page);

      // Rapidly attempt to click the button multiple times
      // The implementation disables the button as part of runDemo(), so subsequent clicks should not produce additional runs.
      await Promise.all([
        demo.demoButton().click(),
        demo.demoButton().click().catch(() => {}), // guard: subsequent click might throw or be ignored, don't fail test immediately
        demo.demoButton().click().catch(() => {})
      ]);

      // Wait until output is populated
      await expect(demo.demoOutput()).not.toHaveText('', { timeout: 2000 });
      const text = await demo.outputText();

      // There should be exactly one "Initial array" header in the output.
      const initialArrayCount = (text.match(/Initial array:/g) || []).length;
      expect(initialArrayCount).toBe(1);

      // The button should be disabled after the first click (implementation behavior)
      await expect(demo.demoButton()).toBeDisabled();

      // Ensure no uncaught page errors occurred during the rapid clicks
      expect(pageErrors.length, `Expected no page errors during rapid clicks, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

      // Ensure no console errors were logged
      const consoleErrs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(consoleErrs.length, `Expected no console errors/warnings during rapid clicks, got: ${JSON.stringify(consoleErrs)}`).toBe(0);
    });

    test('FSM expectation: verify onExit action (demoButton.disabled = false) did or did not occur', async () => {
      // The FSM's S1 -> S0 transition has an expected observable that demoButton.disabled becomes false on exit.
      // The actual implementation sets demoButton.disabled = true in runDemo() and never re-enables it.
      // This test validates the real behavior versus the FSM expectation.

      // Reload to a fresh state
      await page.reload({ waitUntil: 'load' });
      const demo = new InsertionSortDemoPage(page);

      // Trigger the demo
      await demo.runDemo();

      // Check actual implementation: button remains disabled after demo completes
      const isDisabled = await demo.demoButton().isDisabled();

      // Assert the actual behavior (button is disabled)
      expect(isDisabled, 'Expected the demo button to be disabled after running demo (implementation behavior)').toBe(true);

      // Now assert that the FSM expectation (button becomes false on exit) did NOT occur.
      // We check that demoButton.disabled is not false (i.e., exit action did not re-enable button).
      expect(isDisabled === false, 'FSM expected demoButton.disabled === false on exit, but the implementation did not perform this action').toBe(false);

      // No page errors should have been thrown during this check
      expect(pageErrors.length, `Expected no page errors while verifying onExit behavior, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    });
  });

  test.describe('Accessibility and content checks', () => {
    test('demo output container should be properly styled for preformatted textual demo and accessible', async () => {
      const demo = new InsertionSortDemoPage(page);

      // Ensure output area exists and has relevant CSS properties (via computed style)
      const output = demo.demoOutput();
      await expect(output).toBeVisible();

      // Check that the CSS white-space is set to pre-wrap (as described in the HTML)
      const whiteSpace = await page.evaluate(() => {
        const el = document.getElementById('demo-output');
        return window.getComputedStyle(el).whiteSpace;
      });
      expect(whiteSpace).toBe('pre-wrap');

      // Run the demo and ensure the demo-output contains monospace font-family text (the content is plain text)
      await demo.runDemo();
      const text = await demo.outputText();
      expect(text.length).toBeGreaterThan(10);

      // No uncaught page errors
      expect(pageErrors.length, `Expected no page errors during accessibility/content checks, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    });
  });

  test.describe('Console and page error observation (observability tests)', () => {
    test('should not have any unexpected uncaught exceptions or console.error messages during normal usage', async () => {
      const demo = new InsertionSortDemoPage(page);

      // Run the demo once as a normal usage scenario
      await demo.runDemo();

      // After running the demo, assert there were no page errors (uncaught exceptions)
      expect(pageErrors.length, `Found unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

      // Assert that there are no console.error messages captured
      const errors = consoleMessages.filter(m => m.type === 'error');
      expect(errors.length, `Expected no console.error messages, but found: ${JSON.stringify(errors)}`).toBe(0);
    });
  });
});