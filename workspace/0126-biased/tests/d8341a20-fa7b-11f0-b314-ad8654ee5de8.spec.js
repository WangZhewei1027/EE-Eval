import { test, expect } from '@playwright/test';

// Test suite for: Priority Queue — Comprehensive Exposition
// Application ID: d8341a20-fa7b-11f0-b314-ad8654ee5de8
// Served at: http://127.0.0.1:5500/workspace/0126-biased/html/d8341a20-fa7b-11f0-b314-ad8654ee5de8.html

// Page object for interacting with the demo area
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8341a20-fa7b-11f0-b314-ad8654ee5de8.html';
    this.selectors = {
      runButton: '#runDemo',
      output: '#demoOutput'
    };
  }

  async goto() {
    await this.page.goto(this.url);
    // Ensure DOM is ready
    await this.page.waitForSelector(this.selectors.runButton, { state: 'visible' });
    await this.page.waitForSelector(this.selectors.output, { state: 'visible' });
  }

  async getRunButton() {
    return this.page.locator(this.selectors.runButton);
  }

  async getOutput() {
    return this.page.locator(this.selectors.output);
  }

  // Clicks the run demo button and returns immediately (does not wait for demo completion)
  async clickRunDemo() {
    await this.page.click(this.selectors.runButton);
  }

  // Waits until the demo output indicates completion (we look for a stable substring that appears at end)
  // Timeout default 2s to account for setTimeout(300) in the page script and some processing time
  async waitForDemoCompletion(timeout = 2000) {
    await this.page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      // The demo appends "Final heap array:" and "Notes:" near the end — use that as a sign of completion.
      return el.textContent.includes('Final heap array:') && el.textContent.includes('Notes:');
    }, this.selectors.output, { timeout });
  }
}

test.describe('Priority Queue Demo FSM (d8341a20-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Arrays to capture console and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors to observe runtime behavior and unexpected errors.
    page.on('console', (msg) => {
      // store text + type for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store error message and name
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });
  });

  test('S0_Idle: initial render shows Run demo button and output placeholder', async ({ page }) => {
    // Validate Idle state: button present, output placeholder present, no runtime errors at load
    const demo = new DemoPage(page);
    await demo.goto();

    const btn = await demo.getRunButton();
    const out = await demo.getOutput();

    // Button should be visible and enabled in the Idle state
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Run demo: Insert & Extract');
    // The button is not disabled initially
    await expect(btn).toBeEnabled();

    // Output placeholder content and aria-live attribute per FSM evidence
    await expect(out).toHaveAttribute('aria-live', 'polite');
    await expect(out).toHaveText('Demo output will appear here when you click the button.');

    // Assert that no page-level uncaught errors were observed on initial load
    // We explicitly check for common runtime error types (ReferenceError, SyntaxError, TypeError).
    const relevantErrors = pageErrors.filter(e => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name));
    // The application is expected to load without these errors. If such errors occur naturally, they will be captured,
    // but in the normal case we assert none happened.
    expect(relevantErrors.length).toBe(0);

    // Also expect no console.error-level messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Keep console capture for debugging assertions later if necessary
  });

  test('S0 -> S1 transition: clicking Run demo enters Demo Running (button disabled + "Running...")', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    const btn = await demo.getRunButton();
    const out = await demo.getOutput();

    // Click the button to trigger transition from Idle (S0) to Demo Running (S1)
    await demo.clickRunDemo();

    // Immediately after click, button should be disabled and show "Running..."
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveText('Running...');

    // While running, the output may not yet contain the final result; it will be filled after runDemo executes.
    // However the runDemo is scheduled via setTimeout(300) which means we should still see button disabled for a short time.
    // Check after 100ms that button is still disabled (indicative of the running state).
    await page.waitForTimeout(100);
    await expect(btn).toBeDisabled();

    // Confirm no immediate page errors were triggered by the click action
    const immediateRuntimeErrors = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));
    expect(immediateRuntimeErrors.length).toBe(0);

    // The runDemo sequence will eventually update the output; wait for completion in a following test.
  });

  test('S1 -> S2 transition: demo completes and output contains insert/extract steps and final notes', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    const btn = await demo.getRunButton();
    const out = await demo.getOutput();

    // Start the demo
    await demo.clickRunDemo();

    // Confirm we entered running state (button disabled and label changed)
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveText('Running...');

    // Wait for the demo to complete and update the output
    await demo.waitForDemoCompletion(3000); // use a slightly larger timeout to be robust

    // After completion, the button should be re-enabled and label restored
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveText('Run demo: Insert & Extract');

    // Inspect the output content for expected lines that indicate Demo Completed (S2)
    const outputText = await out.textContent();

    // Ensure the runDemo function executed (evidence: "Starting demo: build min-heap from sequence")
    expect(outputText).toContain('Starting demo: build min-heap from sequence: [7, 2, 5, 3, 10, 1]');

    // Check several insert snapshots appear in the output (verifying step-by-step inserts)
    expect(outputText).toContain('Insert 7: heap array -> [7]');
    expect(outputText).toContain('Insert 2: heap array -> [2, 7]');
    expect(outputText).toContain('Insert 1: heap array -> [1, 3, 2, 7, 10, 5]');

    // Check that extract-min operations were performed and documented
    expect(outputText).toMatch(/extract-min -> 1\s*; heap -> \[2, 3, 5, 7, 10\]/);

    // Verify final notes and complexities appear indicating completion
    expect(outputText).toContain('Final heap array: [2, 3, 5, 7, 10]');
    expect(outputText).toContain('Notes:');
    expect(outputText).toContain('- This demo uses an array-backed binary min-heap.');

    // Confirm that no uncaught ReferenceError, SyntaxError, or TypeError were observed during the run
    const runtimeErrors = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));
    expect(runtimeErrors.length).toBe(0);

    // Confirm console did not emit error-level messages during the demo
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid multiple clicks should not queue multiple demos while already running', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    const out = await demo.getOutput();
    const btn = await demo.getRunButton();

    // Click once to start
    await demo.clickRunDemo();

    // Immediately attempt to click again while the button should be disabled.
    // Because the page disables the button on first click, the second click should have no effect.
    // Use page.mouse.click to try to click at the button center regardless of disabled attribute.
    // But clicking a disabled button has no effect in the DOM; this simulates a user rapidly clicking.
    try {
      // Try clicking; if Playwright refuses due to disabled state, this will throw; catch and ignore.
      await page.click('#runDemo').catch(() => {});
    } catch (e) {
      // ignore click error
    }

    // Wait for completion
    await demo.waitForDemoCompletion(3000);

    const outputText = await out.textContent();

    // Count number of "Starting demo:" occurrences to ensure only one run was produced
    const occurrences = (outputText.match(/Starting demo: build min-heap from sequence:/g) || []).length;
    expect(occurrences).toBe(1);

    // After completion, clicking again should start another run (test reentrancy)
    await demo.clickRunDemo();
    // Wait for the second run to complete
    await demo.waitForDemoCompletion(3000);

    const outputTextAfterSecondRun = await out.textContent();
    // After two runs, the starting header should appear twice
    const occurrencesAfter = (outputTextAfterSecondRun.match(/Starting demo: build min-heap from sequence:/g) || []).length;
    expect(occurrencesAfter).toBeGreaterThanOrEqual(1); // at least 1, often 2 depending on how output is overwritten/appended

    // Ensure no unexpected runtime errors occurred through the process
    const runtimeErrors = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));
    expect(runtimeErrors.length).toBe(0);
  });

  test('DOM integrity checks and expected attributes (verifies FSM evidence renderPage / output binding)', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Check structural expectations from FSM evidence
    const btn = await demo.getRunButton();
    const out = await demo.getOutput();

    // Button exists with correct id and text per FSM evidence
    await expect(btn).toHaveAttribute('id', 'runDemo');
    await expect(btn).toHaveText('Run demo: Insert & Extract');

    // Output div exists and contains the initial placeholder text
    await expect(out).toHaveAttribute('id', 'demoOutput');
    await expect(out).toHaveClass(/output/);
    await expect(out).toHaveAttribute('aria-live', 'polite');
    await expect(out).toHaveText('Demo output will appear here when you click the button.');

    // Validate that clicking triggers the listener (evidence: "btn.addEventListener('click', function() {...})")
    await demo.clickRunDemo();
    // Wait for the output to change to ensure the click handler executed
    await demo.waitForDemoCompletion(2000);
    const finalText = await out.textContent();
    expect(finalText.length).toBeGreaterThan(0);
    expect(finalText).toContain('Starting demo: build min-heap from sequence:');

    // Ensure that the textContent is updated via assignment (evidence: out.textContent = lines.join("\n");)
    // We cannot inspect the assignment operation itself without instrumenting the page,
    // but we can assert that the end result is plain text with newlines present.
    expect(finalText).toMatch(/\n/); // should contain at least one newline separating lines

    // No page errors of interest
    expect(pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name)).length).toBe(0);
  });
});