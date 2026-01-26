import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8379c92-fa7b-11f0-b314-ad8654ee5de8.html';

// Simple page object for the demo area to keep tests readable
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemoBtn');
    this.log = page.locator('#demoLog');
    this.logLines = page.locator('#demoLog > div');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getButtonText() {
    return this.runBtn.textContent();
  }

  async isButtonDisabled() {
    return this.runBtn.isDisabled();
  }

  async getLogText() {
    return this.log.textContent();
  }

  async countLogLines() {
    return this.logLines.count();
  }

  async clickRun() {
    await this.runBtn.click();
  }
}

test.describe('Context Switching — Demo (d8379c92-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Capture console messages and page errors for each test for assertions.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console and page errors but do not alter page behavior.
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // swallow any unexpected inspection error from Playwright message handling
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    const demo = new DemoPage(page);
    await demo.goto();
  });

  test('Initial Idle state (S0_Idle): button present, enabled, and initial log line', async ({ page }) => {
    // Set a slightly longer timeout for safety of element resolution
    test.setTimeout(10_000);

    const demo = new DemoPage(page);

    // Validate the primary button exists, has expected text, and is enabled.
    await expect(demo.runBtn).toBeVisible();
    await expect(demo.runBtn).toHaveText('Run simple context-switch demo');
    await expect(demo.runBtn).toBeEnabled();

    // The FSM's S0_Idle entry_action appends an initial line to the log.
    // Validate the log contains that initial line and at least one child div.
    const initialText = await demo.getLogText();
    expect(initialText).toContain('Demo ready. Click the button to see an annotated sequence of one context switch (A → B).');

    const initialCount = await demo.countLogLines();
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Assert that no runtime page errors were observed on initial load.
    // We expect the implementation to be stable and not throw ReferenceError/SyntaxError/TypeError.
    expect(pageErrors.length).toBe(0);

    // Also assert that no "error" console messages were emitted.
    const errorConsole = consoleMessages.find(m => m.type === 'error' || /error/i.test(m.text));
    expect(errorConsole).toBeFalsy();
  });

  test('Transition S0_Idle -> S1_RunningDemo: clicking runs demo, disables button, changes text, appends steps, and returns to Idle', async ({ page }) => {
    // The demo schedules 11 steps at 600ms intervals = ~6s total; give buffer
    test.setTimeout(20_000);
    const demo = new DemoPage(page);

    // Precondition: button is enabled
    await expect(demo.runBtn).toBeEnabled();

    // Click to start the demo. According to the implementation:
    // - It sets run = true
    // - Disables the button immediately and sets textContent to "Running demo..."
    // - Schedules appending of each step with setTimeout
    await demo.clickRun();

    // Immediately after clicking, the UI should reflect the "running" state.
    await expect(demo.runBtn).toBeDisabled();
    await expect(demo.runBtn).toHaveText('Running demo...');

    // The initial implementation does NOT clear the log when run === false (first run).
    // So the initial line is likely still present. Ensure that at least one new line appears
    // after the first scheduled step (600ms).
    await page.waitForTimeout(800); // wait for first scheduled step to be appended
    const countAfterOneStep = await demo.countLogLines();
    expect(countAfterOneStep).toBeGreaterThanOrEqual(2); // initial + at least 1 step

    // Wait for the demo to complete: wait until button is re-enabled which signals completion.
    await page.waitForSelector('#runDemoBtn:not([disabled])', { timeout: 12_000 });

    // After completion, the button should be enabled and the text should be restored.
    await expect(demo.runBtn).toBeEnabled();
    await expect(demo.runBtn).toHaveText('Run simple context-switch demo');

    // Verify that the full sequence of steps was appended.
    // The page's "steps" array has 11 entries. Because the initial log line remained, expect 12 entries.
    const finalCount = await demo.countLogLines();
    expect(finalCount).toBeGreaterThanOrEqual(11); // robust check
    // Prefer exact check if possible: at least 11 lines from steps; initial may or may not have been cleared.
    expect(finalCount).toBeGreaterThanOrEqual(11);

    // Verify that the final log contains the final completion message from steps.
    const fullLogText = await demo.getLogText();
    expect(fullLogText).toContain('[COMPLETE] Context switch complete — Process B now executing in user mode.');

    // Assert no unexpected page errors occurred during the run.
    expect(pageErrors.length).toBe(0);

    // No error-level console messages expected.
    const errorConsole = consoleMessages.find(m => m.type === 'error' || /error/i.test(m.text));
    expect(errorConsole).toBeFalsy();
  });

  test('Re-run demo: when run is already true, clicking clears log then replays steps (tests S1 -> S0 -> S1 behaviour and exit actions)', async ({ page }) => {
    // This test will:
    // 1) Run the demo once and wait for completion.
    // 2) Click again to trigger the "if (run) { clearLog(); }" branch and then run again.
    // 3) Verify the log was cleared on second run and steps appended afresh.
    // Long timeout to accommodate two demo runs.
    test.setTimeout(40_000);
    const demo = new DemoPage(page);

    // --- First run (same as previous test) ---
    await demo.clickRun();
    await page.waitForSelector('#runDemoBtn:not([disabled])', { timeout: 12_000 });
    const firstRunCount = await demo.countLogLines();
    expect(firstRunCount).toBeGreaterThanOrEqual(11);

    // --- Second run: since run variable is true now, runDemo will call clearLog() at start ---
    // Click to run again; immediately after click, the implementation should clear the log.
    await demo.clickRun();

    // Immediately after the second click, the log should be cleared (0 children) or briefly empty.
    // Use a short wait to let the clearLog() effect take place.
    await page.waitForTimeout(200);
    const afterClearCount = await demo.countLogLines();
    // The implementation does clear via log.innerHTML = ''; so count should be 0 before steps re-appear.
    // However timing may allow a step to appear quickly; assert it's at most 1 initially.
    expect(afterClearCount).toBeLessThanOrEqual(1);

    // As second run proceeds, wait for completion.
    await page.waitForSelector('#runDemoBtn:not([disabled])', { timeout: 12_000 });

    // After second completion, the log should contain the 11 steps (no initial "Demo ready..." line).
    const secondRunFinalCount = await demo.countLogLines();
    expect(secondRunFinalCount).toBeGreaterThanOrEqual(11);

    // The button should be back to idle state text and enabled.
    await expect(demo.runBtn).toBeEnabled();
    await expect(demo.runBtn).toHaveText('Run simple context-switch demo');

    // Confirm again that no page errors were emitted.
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.find(m => m.type === 'error' || /error/i.test(m.text));
    expect(errorConsole).toBeFalsy();
  });

  test('Edge case: cannot trigger click actions while button is disabled (attempting to click while running)', async ({ page }) => {
    // Validate that the page enforces the disabled state while demo is running.
    test.setTimeout(20_000);
    const demo = new DemoPage(page);

    // Start the demo
    await demo.clickRun();

    // Ensure button is disabled now
    await expect(demo.runBtn).toBeDisabled();

    // Attempting to click a disabled element via page.click normally throws an error in Playwright.
    // Assert that such an attempt is rejected (ensures UI prevents user interaction while running).
    // We intentionally call page.click on the selector directly which will check enablement.
    // Use expect(...).rejects to verify the runtime behavior from Playwright's perspective.
    await expect(page.click('#runDemoBtn')).rejects.toThrow();

    // Wait for demo to finish to avoid interfering with subsequent tests
    await page.waitForSelector('#runDemoBtn:not([disabled])', { timeout: 12_000 });

    // Final sanity checks
    expect(pageErrors.length).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Final guard assertions on page errors and console errors after each test.
    // These are defensive: the page should remain free of unhandled JS exceptions throughout interactions.
    expect(pageErrors.length).toBe(0);

    const errorConsole = consoleMessages.find(m => m.type === 'error' || /error/i.test(m.text));
    expect(errorConsole).toBeFalsy();

    // Optionally capture console messages for debugging if a test fails; they are available in test output
    // via the arrays we collected. No further action required here.
  });
});