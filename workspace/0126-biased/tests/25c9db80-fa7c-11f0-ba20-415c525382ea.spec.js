import { test, expect } from '@playwright/test';

// Test file: 25c9db80-fa7c-11f0-ba20-415c525382ea.spec.js
// Target URL (served): http://127.0.0.1:5500/workspace/0126-biased/html/25c9db80-fa7c-11f0-ba20-415c525382ea.html

// Page object encapsulating interactions with the demo UI
class InsertionSortDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemoBtn');
    this.demoArea = page.locator('#demo');
  }

  // Navigate to the page under test
  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/25c9db80-fa7c-11f0-ba20-415c525382ea.html', { waitUntil: 'networkidle' });
  }

  // Click the "Run Insertion Sort Demo" button
  async clickRun() {
    await this.runBtn.click();
  }

  // Get the current text content of the demo region
  async getDemoText() {
    return (await this.demoArea.textContent()) || '';
  }

  // Wait until the demo enters the "Running demonstration..." state (S1)
  async waitForRunningState(timeout = 1000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('demo');
      return el && el.textContent && el.textContent.indexOf('Running demonstration...') === 0;
    }, {}, { timeout });
  }

  // Wait until the demo completes and the final sorted output is present (S2)
  async waitForCompletedState(timeout = 2000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('demo');
      return el && el.textContent && el.textContent.includes('Final sorted array:');
    }, {}, { timeout });
  }

  // Helper to check if button is disabled
  async isRunButtonDisabled() {
    return await this.runBtn.isDisabled();
  }

  // Focus state of demo area
  async demoAreaHasFocus() {
    return await this.page.evaluate(() => document.activeElement === document.getElementById('demo'));
  }
}

test.describe('Insertion Sort Demo - FSM states and transitions', () => {
  // Will collect console messages and page errors for each test.
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Observe console messages
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Observe page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, assert that there were no unexpected runtime errors reported to the page
    // The application is expected to run without throwing runtime exceptions.
    // If errors are present, fail the test pointing to the captured messages.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.join('\n')}`).toBe(0);
  });

  test('Idle state (S0_Idle) renders the button and an empty demo area', async ({ page }) => {
    // This test validates the initial/idle state of the app.
    // It checks that the Run Demo button exists and that the demo output region exists and is empty.
    const demo = new InsertionSortDemoPage(page);
    await demo.goto();

    // Button should be present and enabled in the Idle state
    await expect(page.locator('#runDemoBtn')).toBeVisible();
    await expect(page.locator('#runDemoBtn')).toBeEnabled();

    // The demo output region should be present and initially empty
    const demoText = await demo.getDemoText();
    expect(demoText.trim(), 'Demo area should be empty on initial render').toBe('');

    // Verify the demo region has the expected accessibility attributes per FSM/components
    const demoEl = page.locator('#demo');
    await expect(demoEl).toHaveAttribute('aria-live', 'polite');
    await expect(demoEl).toHaveAttribute('role', 'region');
    await expect(demoEl).toHaveAttribute('aria-label', 'Insertion Sort demonstration output');
  });

  test('Transition S0_Idle -> S1_DemoRunning when clicking Run Demo (immediate effects)', async ({ page }) => {
    // This test validates the transition from Idle to Demo Running:
    // - Clicking the button immediately sets demoArea text to 'Running demonstration...\n'
    // - The Run button becomes disabled while running
    const demo = new InsertionSortDemoPage(page);
    await demo.goto();

    // Click the run button to start the demo
    await demo.clickRun();

    // Immediately after clicking, the demo area should show the 'Running demonstration...' message
    await demo.waitForRunningState(500);
    const runningText = await demo.getDemoText();
    expect(runningText.startsWith('Running demonstration...'), 'Expected Running demonstration... as immediate feedback').toBe(true);

    // The run button should be disabled while the demo is in progress
    const disabled = await demo.isRunButtonDisabled();
    expect(disabled, 'Run button should be disabled while demo is running').toBe(true);
  });

  test('Transition S1_DemoRunning -> S2_DemoCompleted: final output and re-enabled button', async ({ page }) => {
    // This test validates that after the demo runs, the final sorted output is displayed,
    // the run button is re-enabled, and the demo area receives focus (onEnter actions from S2).
    const demo = new InsertionSortDemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickRun();

    // Wait for demo to complete and assert expected final message is present
    await demo.waitForCompletedState(2000);
    const finalText = await demo.getDemoText();

    // The final output should include the final sorted array as described in the FSM
    expect(finalText.includes('Final sorted array:'), 'Final sorted array message should be present').toBe(true);
    expect(finalText.includes('[ 1, 2, 4, 5, 7 ]'), 'Final sorted array should be [ 1, 2, 4, 5, 7 ]').toBe(true);

    // The run button should have been re-enabled by the demo completion logic
    const disabledAfter = await demo.isRunButtonDisabled();
    expect(disabledAfter, 'Run button should be re-enabled after demo completes').toBe(false);

    // The demo area should be focused as the script calls demoArea.focus()
    const hasFocus = await demo.demoAreaHasFocus();
    expect(hasFocus, 'Demo area should receive focus after demo completes').toBe(true);
  });

  test('Edge case: clicking multiple times quickly should not start overlapping demos', async ({ page }) => {
    // This test attempts to click the Run Demo button multiple times in quick succession.
    // Expected behavior:
    // - The first click starts the demo and disables the button immediately.
    // - Further clicks while the button is disabled should have no effect and should not cause errors.
    const demo = new InsertionSortDemoPage(page);
    await demo.goto();

    // Start the demo (first click)
    await demo.clickRun();

    // Immediately try to click again. Because the button should be disabled, Playwright's click
    // will still attempt to click; a disabled button will not trigger the event listener in the page.
    // We don't want to patch or change page behavior; we only observe the outcomes.
    // Attempt a second click with force to simulate a user's rapid double-click; this should not break the demo.
    await page.locator('#runDemoBtn').click({ force: true });

    // Ensure the visible state remains the "running" message and there are no JS errors
    await demo.waitForRunningState(500);
    const runningText = await demo.getDemoText();
    expect(runningText.startsWith('Running demonstration...'), 'After rapid clicks, should still show running message').toBe(true);

    // Wait for completion and verify final output once
    await demo.waitForCompletedState(2000);
    const finalText = await demo.getDemoText();
    expect(finalText.includes('Final sorted array:'), 'Final message should appear even after rapid clicks').toBe(true);
    expect(finalText.includes('[ 1, 2, 4, 5, 7 ]'), 'Final sorted array should be correct after rapid clicks').toBe(true);

    // Confirm no page errors were captured by the listeners in afterEach
  });

  test('Observability: capture console outputs and verify no runtime exceptions emitted', async ({ page }) => {
    // This test explicitly validates that the page does not throw runtime exceptions during a demo run.
    // It captures console events and page errors and ensures no error-level console messages are present.
    const demo = new InsertionSortDemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickRun();

    // Wait for completion
    await demo.waitForCompletedState(2000);

    // At this point, the afterEach hook will assert that there were no console.error or pageerrors.
    // Additionally assert that we captured some console messages or at least the page behaved as expected.
    const finalText = await demo.getDemoText();
    expect(finalText.length > 0, 'Demo should have produced textual output').toBe(true);
  });

  test('Content validation: textual steps contain expected sequence entries', async ({ page }) => {
    // Validate that the textual walkthrough produced by the demo includes several expected step markers.
    const demo = new InsertionSortDemoPage(page);
    await demo.goto();

    await demo.clickRun();
    await demo.waitForCompletedState(2000);
    const finalText = await demo.getDemoText();

    // Check for initial array and some step markers as part of the FSM evidence
    expect(finalText.includes('Initial array:'), 'Should include "Initial array:" label').toBe(true);
    expect(finalText.includes('Step 1:'), 'Should include Step 1 marker').toBe(true);
    expect(finalText.includes('Step 2:'), 'Should include Step 2 marker').toBe(true);
    expect(finalText.includes('Step 3:'), 'Should include Step 3 marker').toBe(true);
    expect(finalText.includes('Step 4:'), 'Should include Step 4 marker').toBe(true);
  });
});