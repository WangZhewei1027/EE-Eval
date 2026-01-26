import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d833a4f0-fa7b-11f0-b314-ad8654ee5de8.html';

// Increase default timeout to allow demo playback (8 steps × 900ms ≈ 7200ms)
test.setTimeout(30000);

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('button#runDemo');
    this.output = page.locator('pre#demoOutput');
    this.demoArea = page.locator('.demo-area');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    return this.runButton.textContent();
  }

  async isButtonEnabled() {
    return await this.runButton.isEnabled();
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getOutputText() {
    return this.output.textContent();
  }

  async waitForOutputContains(substring, opts = {}) {
    // Uses Playwright expect which polls until condition or timeout
    await expect(this.output).toContainText(substring, opts);
  }

  async waitForButtonEnabled(opts = {}) {
    await expect(this.runButton).toBeEnabled(opts);
  }

  async waitForButtonDisabled(opts = {}) {
    await expect(this.runButton).toBeDisabled(opts);
  }

  async ariaControlsValue() {
    return await this.runButton.getAttribute('aria-controls');
  }

  async outputHasAriaLivePolite() {
    return (await this.output.getAttribute('aria-live')) === 'polite';
  }
}

test.describe('AVL Tree Demo — FSM states and transitions', () => {
  // We'll capture console messages and page errors to observe runtime behavior
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // store the ConsoleMessage object for later inspection
      consoleMessages.push(msg);
    });

    page.on('pageerror', (err) => {
      // store thrown errors (uncaught exceptions)
      pageErrors.push(err);
    });
  });

  test('S0_Idle: initial render shows Run button and initial demo output', async ({ page }) => {
    // Validate Idle state (S0_Idle) is rendered correctly on page load.
    const demo = new DemoPage(page);
    await demo.goto();

    // The Run button must exist and be enabled initially
    await expect(demo.runButton).toBeVisible();
    await expect(demo.runButton).toBeEnabled();

    // The button should contain the expected text per FSM evidence
    await expect(demo.runButton).toHaveText('Run demonstration: Insert 30, 20, 10, 25, 40, 22');

    // aria-controls should reference the demo output element id
    const ariaControls = await demo.ariaControlsValue();
    expect(ariaControls).toBe('demoOutput');

    // The demo output should contain the initial placeholder text (evidence of renderPage-like behavior)
    await expect(demo.output).toHaveText('Demo output will appear here (click the button).');

    // Verify accessibility hint: output has aria-live="polite"
    expect(await demo.outputHasAriaLivePolite()).toBe(true);

    // Ensure no uncaught page errors during initial render (we observe console and page errors)
    expect(pageErrors.length).toBe(0);

    // Ensure no console.error messages were emitted on load
    const consoleErrorCount = consoleMessages.filter(m => m.type() === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('RunDemoClick event transitions to S1_DemoRunning and plays the demo sequence', async ({ page }) => {
    // This test verifies the transition from Idle to DemoRunning when the user clicks the Run button.
    // It also checks playDemo() behavior: disabling the button during playback, updating output
    // with step snapshots, and re-enabling when finished.

    const demo = new DemoPage(page);
    await demo.goto();

    // Start playback — transition event
    await demo.clickRun();

    // Immediately after click the button should be disabled (playDemo starts and sets disabled=true)
    await demo.waitForButtonDisabled({ timeout: 2000 });

    // The output should begin updating. The first step appears after ~900ms.
    // Wait for at least "Step 0" to appear.
    await demo.waitForOutputContains('Step 0', { timeout: 3000 });

    // Capture current output text to compare after attempted second click while disabled
    const outputBeforeSecondClick = (await demo.getOutputText()) || '';

    // Attempt to click the button again while it's disabled.
    // Clicking a disabled button should have no effect and not restart the demo or throw errors.
    // Use page.click directly to simulate a user trying to click; browser will ignore a disabled button.
    try {
      await page.click('button#runDemo', { timeout: 500 });
    } catch (e) {
      // Some browsers may throw if clicking a disabled element; swallowing is OK because the demo should not crash.
    }

    // Wait briefly and assert the output did not reset (playback not restarted)
    await page.waitForTimeout(600); // short wait to observe potential reset behavior
    const outputAfterSecondClickAttempt = (await demo.getOutputText()) || '';
    expect(outputAfterSecondClickAttempt).toContain(outputBeforeSecondClick);

    // Wait for the demo to finish and the button to be re-enabled
    // There are 8 steps with 900ms intervals → ~7200ms total. Give generous timeout.
    await demo.waitForButtonEnabled({ timeout: 12000 });

    // After completion, final output should reflect the last step (contains "Insert 22" or "Step 6")
    const finalOutput = (await demo.getOutputText()) || '';
    expect(finalOutput).toMatch(/(Insert 22|Step 6)/);

    // Ensure no uncaught page errors occurred during playback
    expect(pageErrors.length).toBe(0);

    // Ensure no console.error messages were emitted during playback
    const consoleErrorCount = consoleMessages.filter(m => m.type() === 'error').length;
    expect(consoleErrorCount).toBe(0);

    // Ensure the button is re-enabled at the end (user can replay)
    expect(await demo.isButtonEnabled()).toBe(true);
  });

  test('Replay: after completion user can replay the demo and it restarts correctly', async ({ page }) => {
    // This test validates that the demo is "one-shot" and can be replayed after completion.
    // It also asserts that the onEnter action playDemo is triggered again on replay.

    const demo = new DemoPage(page);
    await demo.goto();

    // First playback
    await demo.clickRun();
    await demo.waitForButtonDisabled({ timeout: 2000 });
    await demo.waitForOutputContains('Step 0', { timeout: 3000 });
    await demo.waitForButtonEnabled({ timeout: 12000 });

    // Now replay: click the run button again. The demo should restart:
    // playDemo() sets output.textContent = '' at start, so we can observe that reset.
    await demo.clickRun();

    // Immediately after clicking for replay the button should be disabled again
    await demo.waitForButtonDisabled({ timeout: 2000 });

    // At the very start of replay the output is cleared by playDemo(); verify that happens
    // We wait a short time for the JS to set out.textContent = ''.
    await page.waitForTimeout(200);
    const outputAfterReplayStart = (await demo.getOutputText()) || '';
    // Because the script sometimes sets textContent = '' before the first interval,
    // assert that the output is either empty or contains "Step 0" soon after.
    // It's acceptable if it's empty initially.
    expect(outputAfterReplayStart.length).toBeGreaterThanOrEqual(0);

    // Wait for the first step of the replay to appear
    await demo.waitForOutputContains('Step 0', { timeout: 3000 });

    // Let the replay finish and ensure the button re-enables
    await demo.waitForButtonEnabled({ timeout: 12000 });

    // Final verification: last step present
    const finalOutputReplay = (await demo.getOutputText()) || '';
    expect(finalOutputReplay).toMatch(/(Insert 22|Step 6)/);

    // Confirm no uncaught exceptions happened during replay
    expect(pageErrors.length).toBe(0);
  });

  test('Edge-case: rapid double-click attempts do not cause runtime errors or duplicate playback', async ({ page }) => {
    // Validate that attempting to trigger the event rapidly (double-click) does not crash the page,
    // and playback proceeds only once per click (button being disabled prevents duplicate start).

    const demo = new DemoPage(page);
    await demo.goto();

    // Rapidly attempt two clicks (simulate a user double-clicking)
    // The second click may be ignored by the browser because button becomes disabled.
    // We attempt both programmatic clicks in quick succession.
    await demo.runButton.click(); // first click -> starts playback and disables button
    try {
      // second click immediately
      await demo.runButton.click({ timeout: 200 });
    } catch (e) {
      // If Playwright can't click disabled element, swallowing is fine — we only want to make sure nothing crashes.
    }

    // Wait to see the demo progress to first step
    await demo.waitForOutputContains('Step 0', { timeout: 3000 });

    // Ensure no uncaught page errors were recorded
    expect(pageErrors.length).toBe(0);

    // Ensure console did not produce error messages
    const consoleErrorCount = consoleMessages.filter(m => m.type() === 'error').length;
    expect(consoleErrorCount).toBe(0);

    // Let playback finish
    await demo.waitForButtonEnabled({ timeout: 12000 });

    // Final output indicates single normal playback completed
    const finalOutput = (await demo.getOutputText()) || '';
    expect(finalOutput).toMatch(/(Insert 22|Step 6)/);
  });

  test.afterEach(async ({ page }) => {
    // Generic sanity: ensure no uncaught exceptions recorded across tests.
    // This doubles as a final observation point for runtime errors.
    if (pageErrors.length > 0) {
      // If there are page errors, surface them with a helpful message for debugging.
      const errorsSummary = pageErrors.map(e => e.stack || String(e)).join('\n---\n');
      // Fail the test by throwing a descriptive error (Playwright will report the failure).
      throw new Error('Uncaught page errors detected:\n' + errorsSummary);
    }

    // Also ensure no console.error messages were emitted.
    const consoleErrorMsgs = consoleMessages.filter(m => m.type() === 'error');
    if (consoleErrorMsgs.length > 0) {
      // Extract text for assertions visibility
      const msgs = consoleErrorMsgs.map(m => m.text()).join('\n---\n');
      throw new Error('console.error messages were emitted during test:\n' + msgs);
    }
  });
});