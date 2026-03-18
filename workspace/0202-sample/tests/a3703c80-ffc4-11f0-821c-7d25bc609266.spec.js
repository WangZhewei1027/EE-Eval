import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3703c80-ffc4-11f0-821c-7d25bc609266.html';

// Page object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#run-demo-btn');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    // Navigate to the app and wait for load
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async isButtonVisible() {
    return await this.runButton.isVisible();
  }

  async getButtonText() {
    return await this.runButton.textContent();
  }

  async isButtonDisabled() {
    return await this.runButton.isDisabled();
  }

  async getOutputText() {
    return await this.output.textContent();
  }

  async runDemo() {
    await this.runButton.click();
  }

  async clickButtonWhenDisabled() {
    // Force a click attempt after disabled - using page.click to simulate user trying to click
    await this.page.click('#run-demo-btn').catch(() => {
      // ignore any exception thrown by Playwright if element is not interactable
    });
  }

  async outputHasAriaLivePolite() {
    const attr = await this.output.getAttribute('aria-live');
    return attr === 'polite';
  }
}

test.describe('Hash Table Demo FSM - a3703c80-ffc4-11f0-821c-7d25bc609266', () => {
  // Collect console messages and page errors for each test to assert runtime behavior
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors (runtime exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('State S0_Idle (Initial state)', () => {
    test('renders page with Run Demo button and empty output', async ({ page }) => {
      // Validate that initial UI (Idle state) is rendered as expected
      const demo = new DemoPage(page);
      await demo.goto();

      // The run-demo button should be visible and enabled initially
      expect(await demo.isButtonVisible()).toBe(true);
      expect(await demo.isButtonDisabled()).toBe(false);

      // Button text must be the initial label "Run Demo"
      expect(await demo.getButtonText()).toBe('Run Demo');

      // Demo output should be empty at initial state
      const outText = await demo.getOutputText();
      expect(outText).toBe('');

      // The demo output should have aria-live="polite" per component spec
      expect(await demo.outputHasAriaLivePolite()).toBe(true);

      // No uncaught runtime errors occurred while rendering the page
      expect(pageErrors, 'No page errors should occur on initial render').toHaveLength(0);

      // No console error messages on initial render
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors, 'No console.error messages should be emitted on initial render').toHaveLength(0);
    });
  });

  test.describe('Transition: RunDemo (S0_Idle -> S1_DemoRunning -> S2_DemoCompleted)', () => {
    test('clicking Run Demo executes demo, outputs expected insertion/search results, and disables button', async ({ page }) => {
      // This test validates the transition(s) and entry/exit actions by asserting DOM changes and output content.
      const demo = new DemoPage(page);
      await demo.goto();

      // Capture output before action
      const beforeOutput = await demo.getOutputText();
      expect(beforeOutput).toBe('');

      // Click the Run Demo button (triggers initializeHashTable, insertKeys, searchKeys)
      await demo.runDemo();

      // After clicking, the demo output should be populated with insertion logs
      const output = await demo.getOutputText();
      expect(output).toBeTruthy();

      // Validate that insertion logs for each key exist (evidence of insertKeys())
      // Keys: 10, 20, 15, 7, 32, and Value pairs created: Value10 etc.
      expect(output).toContain('Inserted (10, "Value10")');
      expect(output).toContain('Inserted (20, "Value20")');
      expect(output).toContain('Inserted (15, "Value15")');
      expect(output).toContain('Inserted (7, "Value7")');
      expect(output).toContain('Inserted (32, "Value32")');

      // Validate that the hash table buckets mapping appears as expected (evidence of printTable())
      // Bucket indices 0..6 must exist and show expected keys
      expect(output).toContain('Bucket 0 : [7]');
      expect(output).toContain('Bucket 1 : [15]');
      expect(output).toContain('Bucket 3 : [10]');
      expect(output).toContain('Bucket 4 : [32]');
      expect(output).toContain('Bucket 6 : [20]');

      // Validate search results for existing keys and non-existing key (99)
      expect(output).toContain('Key 10 found with value: Value10');
      expect(output).toContain('Key 20 found with value: Value20');
      expect(output).toContain('Key 15 found with value: Value15');
      expect(output).toContain('Key 7 found with value: Value7');
      expect(output).toContain('Key 32 found with value: Value32');
      // Non-existing key 99 should be reported as not found
      expect(output).toContain('Key 99 not found in the hash table.');

      // After demo completes, button should be disabled and text should be 'Demo Completed' (S2_DemoCompleted)
      expect(await demo.isButtonDisabled(), 'Button should be disabled after demo completion').toBe(true);
      expect(await demo.getButtonText(), 'Button text should indicate completion').toBe('Demo Completed');

      // No uncaught runtime errors should have occurred during the demo run
      expect(pageErrors, 'No page errors should occur during demo run').toHaveLength(0);

      // No console.error messages emitted during demo run
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors, 'No console.error messages during demo run').toHaveLength(0);
    });

    test('clicking Run Demo twice: second click should not re-run demo and output remains unchanged', async ({ page }) => {
      // Edge case: Attempt to run the demo again after completion (button disabled) - ensure idempotent behavior
      const demo = new DemoPage(page);
      await demo.goto();

      // First run
      await demo.runDemo();
      const firstOutput = await demo.getOutputText();

      // Attempt to click again (element is disabled) - simulate user's attempt
      // We attempt to click and ignore any Playwright thrown errors; the page code should not re-run logic.
      await demo.clickButtonWhenDisabled();

      // Output should remain identical (no duplicate insertion/search logs)
      const secondOutput = await demo.getOutputText();
      expect(secondOutput).toBe(firstOutput);

      // Button should remain disabled and text unchanged
      expect(await demo.isButtonDisabled()).toBe(true);
      expect(await demo.getButtonText()).toBe('Demo Completed');

      // Ensure no new runtime errors occurred due to the extra click attempt
      expect(pageErrors, 'No page errors should arise from clicking a disabled button').toHaveLength(0);
    });
  });

  test.describe('Behavioral and robustness checks', () => {
    test('demo output contains expected structure and whitespace preservation', async ({ page }) => {
      // Validate formatting and presence of section headings in the output text
      const demo = new DemoPage(page);
      await demo.goto();

      await demo.runDemo();
      const output = await demo.getOutputText();

      // The output should contain a header line and multiple newline-separated sections
      expect(output.startsWith('Inserting keys with values:'), 'Output should start with insertion header').toBe(true);
      expect(output).toContain('Hash table buckets after insertion:');
      expect(output).toContain('Searching for keys:');

      // Ensure that printTable produced one line per bucket (7 buckets)
      const bucketLines = output.split('\n').filter(line => line.startsWith('Bucket '));
      expect(bucketLines).toHaveLength(7);

      // Ensure no unexpected runtime errors or console errors
      expect(pageErrors).toHaveLength(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors).toHaveLength(0);
    });

    test('accessibility attributes and semantics: button and output exist and are accessible', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Basic accessibility checks: button has an id and output has aria-live attribute
      const runBtn = page.locator('#run-demo-btn');
      await expect(runBtn).toBeVisible();
      await expect(runBtn).toHaveAttribute('id', 'run-demo-btn');

      const demoOut = page.locator('#demo-output');
      await expect(demoOut).toHaveAttribute('aria-live', 'polite');

      // Run demo to ensure aria-live region receives text
      await demo.runDemo();
      const outText = await demo.getOutputText();
      expect(outText.length).toBeGreaterThan(0);

      // No runtime page errors
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Error observation and logging', () => {
    test('gathers console and page errors while loading and interacting with the page', async ({ page }) => {
      // This test focuses on observing console logs and page errors without modifying runtime.
      const demo = new DemoPage(page);
      await demo.goto();

      // There should be some console messages (info/debug) possibly, but we assert there are no critical runtime errors.
      // If any ReferenceError, TypeError, or SyntaxError had occurred, they would be in pageErrors or console.error messages.
      // We assert that no such errors exist (the application is expected to run correctly).
      await demo.runDemo();

      // Assert there are no uncaught exceptions recorded
      expect(pageErrors, 'No uncaught page errors (exceptions) should be present').toHaveLength(0);

      // Assert there are no console messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
      expect(consoleErrors, 'No console.error or error-like console messages should be present').toHaveLength(0);

      // Additionally assert that if any of the tracked error types had occurred, they would be captured here.
      // (This check is informational: we expect none.)
    });
  });
});