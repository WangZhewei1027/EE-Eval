import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b38170-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page object for the deadlock demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runDemo');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async getOutputInnerHTML() {
    return await this.page.$eval('#demoOutput', (el) => el.innerHTML);
  }

  async waitForText(text, options = {}) {
    // waits until the output contains the specified text
    await expect(this.output).toContainText(text, options);
  }
}

test.describe('Deadlock Demo - FSM validation and UI tests', () => {
  // Collect console errors and page errors to assert no unexpected runtime errors occur
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console "error" messages
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore any listener errors
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('Initial UI renders correctly and idle state shows Run button and empty output', async ({ page }) => {
      // Setup page object and navigate
      const demo = new DemoPage(page);
      await demo.goto();

      // Validate initial evidence of S0_Idle: button present
      await expect(demo.runButton).toBeVisible();
      await expect(demo.runButton).toHaveText('Run Deadlock Example');

      // Validate demo output is initially empty
      const initialOutput = await demo.getOutputText();
      expect(initialOutput.trim()).toBe('', 'Expected demo output to be empty in Idle state');

      // Assert there are no console errors or uncaught page errors on initial load
      expect(consoleErrors.length, 'No console.error messages expected on initial load').toBe(0);
      expect(pageErrors.length, 'No page errors expected on initial load').toBe(0);
    });
  });

  test.describe('Simulation sequence and FSM transitions (S1 -> S6)', () => {
    test('Single click runs full simulation and transitions through all states', async ({ page }) => {
      test.setTimeout(10000); // increase timeout for the timed simulation steps

      const demo = new DemoPage(page);
      await demo.goto();

      // Click to start the simulation (RunDemoClick -> triggers S1)
      await demo.clickRun();

      // Immediately expect the "Starting deadlock simulation..." message (S1 entry evidence)
      await demo.waitForText('Starting deadlock simulation...', { timeout: 1000 });

      // After ~500ms the two locked resource messages should be appended (S2 and S3)
      // give some buffer and wait for the first set of thread locked messages
      await demo.waitForText('Thread 1: Locked Resource A', { timeout: 2000 });
      await demo.waitForText('Thread 2: Locked Resource B', { timeout: 2000 });

      // After additional ~1000ms (total ~1500ms) the waiting messages should be appended (S4 and S5)
      await demo.waitForText('Thread 1: Waiting for Resource B (held by Thread 2)', { timeout: 3000 });
      await demo.waitForText('Thread 2: Waiting for Resource A (held by Thread 1)', { timeout: 3000 });

      // After additional ~1000ms (total ~2500ms) the deadlock detected final message should be appended (S6)
      // Also verify the specific style attribute is present in the innerHTML (evidence expects styled <p>)
      await demo.waitForText('DEADLOCK DETECTED: Both threads are blocked indefinitely', { timeout: 5000 });
      const innerHTML = await demo.getOutputInnerHTML();

      // Validate the styled DEADLOCK DETECTED paragraph exists exactly as in the implementation evidence
      expect(
        innerHTML.includes('<p style="color:red;font-weight:bold;">DEADLOCK DETECTED: Both threads are blocked indefinitely</p>'),
        'Expected the DEADLOCK DETECTED paragraph with inline style to be present in the output'
      ).toBe(true);

      // Validate that a descriptive paragraph explaining the four conditions was appended after the detection
      expect(innerHTML.includes('This demonstrates all four conditions:'), 'Expected explanation of four conditions to appear after detection').toBe(true);

      // Ensure no unexpected console or page errors happened during the simulation run
      expect(consoleErrors.length, `console.error calls during simulation: ${consoleErrors.join(' | ')}`).toBe(0);
      expect(pageErrors.length, `page errors during simulation: ${pageErrors.join(' | ')}`).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking Run multiple times restarts the simulation (output reset)', async ({ page }) => {
      test.setTimeout(10000);
      const demo = new DemoPage(page);
      await demo.goto();

      // Start simulation once
      await demo.clickRun();

      // Wait a small amount of time to allow the first click to schedule timers but before the 500ms locked messages
      // Using 100ms to be before the first 500ms setTimeout task
      await page.waitForTimeout(100);

      // Click again quickly to trigger a restart - handler sets output.innerHTML = 'Starting ...'
      await demo.clickRun();

      // Immediately after the second click the output should contain the 'Starting deadlock simulation...' message
      // and should not yet contain the 'Thread 1: Locked Resource A' message (since 500ms hasn't elapsed for the new run)
      await demo.waitForText('Starting deadlock simulation...', { timeout: 1000 });

      // Immediately check absence of locked message (should not be present instantly)
      const currentText = await demo.getOutputText();
      expect(currentText.includes('Thread 1: Locked Resource A')).toBe(false);

      // Now wait for the new run to proceed and ensure it completes through to deadlock detection
      await demo.waitForText('Thread 1: Locked Resource A', { timeout: 2000 });
      await demo.waitForText('DEADLOCK DETECTED: Both threads are blocked indefinitely', { timeout: 5000 });

      // Verify there are no uncaught page errors or console errors caused by rapid clicking
      expect(consoleErrors.length, 'No console.error expected after rapid clicks').toBe(0);
      expect(pageErrors.length, 'No page errors expected after rapid clicks').toBe(0);
    });

    test('Multiple overlapping clicks produce multiple appended runs (interleaving behaviour)', async ({ page }) => {
      test.setTimeout(15000);
      const demo = new DemoPage(page);
      await demo.goto();

      // Click once to start first run
      await demo.clickRun();

      // After 600ms, the locked messages from first run will have been appended; click again to start a second run
      // The second click will reset output and schedule a second set of timers.
      await page.waitForTimeout(600);
      await demo.clickRun();

      // After clicking at ~600ms, within the timeline of the second run:
      // Wait for the second run's locked messages to appear (500ms after the second click => ~1100ms from original start)
      await demo.waitForTimeout(700); // ensure enough time passes for second run to append locked messages
      await demo.waitForText('Thread 1: Locked Resource A', { timeout: 2000 });
      await demo.waitForText('Thread 2: Locked Resource B', { timeout: 2000 });

      // Wait until final deadlock message appears at the end of the second run
      await demo.waitForText('DEADLOCK DETECTED: Both threads are blocked indefinitely', { timeout: 5000 });

      // Assess the innerHTML to ensure multiple runs did not create malformed HTML (we expect multiple paragraphs possibly)
      const innerHTML = await demo.getOutputInnerHTML();
      // There should be at least one occurrence of the DEADLOCK DETECTED styled paragraph
      expect(
        innerHTML.match(/DEADLOCK DETECTED: Both threads are blocked indefinitely/g)?.length ?? 0
      ).toBeGreaterThanOrEqual(1);

      // No runtime errors expected due to overlapping runs
      expect(consoleErrors.length, 'No console.error expected during overlapping runs').toBe(0);
      expect(pageErrors.length, 'No page errors expected during overlapping runs').toBe(0);
    });

    test('No unexpected ReferenceError / SyntaxError / TypeError thrown by the page', async ({ page }) => {
      // This test intentionally observes runtime errors and fails if any are reported.
      const demo = new DemoPage(page);
      await demo.goto();

      // Interact with the page to ensure scripts execute
      await demo.clickRun();
      await demo.waitForText('Starting deadlock simulation...', { timeout: 1000 });

      // Final assertions: there should be zero captured console errors or page errors.
      // If any ReferenceError/SyntaxError/TypeError occurred they would have been collected above.
      expect(consoleErrors.length, `console errors were observed: ${consoleErrors.join(' | ')}`).toBe(0);
      expect(pageErrors.length, `page errors were observed: ${pageErrors.join(' | ')}`).toBe(0);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If there were any errors captured, attach them to the test output for easier debugging
    if (consoleErrors && consoleErrors.length > 0) {
      for (const msg of consoleErrors) {
        testInfo.attach('console-error', { body: msg, contentType: 'text/plain' });
      }
    }
    if (pageErrors && pageErrors.length > 0) {
      for (const err of pageErrors) {
        testInfo.attach('page-error', { body: err, contentType: 'text/plain' });
      }
    }
  });
});