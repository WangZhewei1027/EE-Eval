import { test, expect } from '@playwright/test';

test.setTimeout(120000); // Increase timeout globally to allow the demo animation to complete (~60-80s)

/**
 * Tests for: Understanding Merge Sort - Interactive Demo
 * Application ID: a370d8c1-ffc4-11f0-821c-7d25bc609266
 * Served at: http://127.0.0.1:5500/workspace/0202-sample/html/a370d8c1-ffc4-11f0-821c-7d25bc609266.html
 *
 * These tests validate the FSM states:
 *  - S0_Idle (initial render)
 *  - S1_DemoRunning (after clicking Run Demo)
 *  - S2_DemoCompleted (after demo finishes)
 *
 * They also observe console messages and page errors without modifying the page environment.
 */

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a370d8c1-ffc4-11f0-821c-7d25bc609266.html';

test.describe('Merge Sort Demo FSM and UI', () => {
  // Utility page object for the demo page
  class DemoPage {
    constructor(page) {
      this.page = page;
      this.runButton = page.locator('#runDemoBtn');
      this.demoArea = page.locator('#demo-area');
    }

    async goto() {
      await this.page.goto(APP_URL);
    }

    async clickRun() {
      await this.runButton.click();
    }

    async getDemoText() {
      return (await this.demoArea.textContent()) || '';
    }

    async isRunButtonDisabled() {
      return await this.runButton.getAttribute('disabled') !== null;
    }

    async isRunButtonEnabled() {
      // Playwright's disabled property reflect: use isEnabled
      return await this.runButton.isEnabled();
    }
  }

  // Setup console and page error capture for each test
  test.beforeEach(async ({ page }) => {
    // Nothing to set globally before each; individual tests will attach listeners as needed.
  });

  test('S0_Idle: initial render shows Run Demo button and empty demo area', async ({ page }) => {
    // Capture console and page errors for assertions
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const demo = new DemoPage(page);
    await demo.goto();

    // Validate the Run Demo button exists, is visible, and enabled (Idle state)
    await expect(demo.runButton).toBeVisible();
    await expect(demo.runButton).toHaveText('Run Merge Sort Demo');
    expect(await demo.isRunButtonEnabled()).toBe(true);

    // The demo area should exist, be empty initially, and have the correct ARIA attributes
    await expect(demo.demoArea).toBeVisible();
    const initialText = await demo.getDemoText();
    expect(initialText.trim()).toBe(''); // empty at idle
    await expect(demo.demoArea).toHaveAttribute('aria-live', 'polite');
    await expect(demo.demoArea).toHaveAttribute('aria-atomic', 'true');

    // Ensure no runtime errors occurred during initial render
    expect(pageErrors.length).toBe(0);

    // There may be no console messages in a clean render, but capture what exists for debugging
    // At minimum, assert that console did not emit 'error' severity messages
    const hasConsoleError = consoleMessages.some(m => m.type === 'error');
    expect(hasConsoleError).toBe(false);
  });

  test('Transition S0 -> S1: clicking Run Demo disables button and shows running text and first step', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure preconditions (idle)
    expect(await demo.isRunButtonEnabled()).toBe(true);
    expect((await demo.getDemoText()).trim()).toBe('');

    // Click the Run Demo button and validate onEnter actions for DemoRunning
    await demo.clickRun();

    // Immediately after clicking, the button should be disabled (exit action for S0 -> S1)
    expect(await demo.isRunButtonDisabled()).toBe(true);

    // demoArea should start with the Running message synchronously
    const areaText = await demo.getDemoText();
    expect(areaText).toContain('Running Merge Sort Demo...');
    // The first info step is appended synchronously by showStep() before any setTimeout,
    // so we should see at least one "Dividing array" or "Base case" line right away.
    const hasFirstStep = /Dividing array|Base case reached/.test(areaText);
    expect(hasFirstStep).toBe(true);

    // Ensure no page errors occurred immediately after starting demo
    expect(pageErrors.length).toBe(0);

    // Ensure there are no severe console error messages at this moment
    const hasConsoleErrorNow = consoleMessages.some(m => m.type === 'error');
    expect(hasConsoleErrorNow).toBe(false);
  });

  test('During S1_DemoRunning: button remains disabled and repeated clicks do nothing', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const demo = new DemoPage(page);
    await demo.goto();

    await demo.clickRun();

    // Immediately, button should be disabled
    expect(await demo.isRunButtonDisabled()).toBe(true);

    // Try clicking the button multiple times while disabled — this should not throw and should have no effect.
    // Using try/catch to capture any unexpected errors triggered by clicks
    let clickThrew = false;
    try {
      // Attempt to click multiple times; Playwright will throw if element is disabled, so use evaluate to attempt a DOM click.
      // We are not allowed to modify page functions; but calling DOM click on a disabled button does nothing.
      await page.evaluate(() => {
        const btn = document.getElementById('runDemoBtn');
        if (btn) {
          try { btn.click(); } catch (e) { /* ignore DOM click errors */ }
        }
      });
    } catch (e) {
      clickThrew = true;
    }

    // Ensure the attempted extra clicks did not cause exceptions in our test harness
    expect(clickThrew).toBe(false);

    // Ensure demo area still begins with single Running header (not duplicated)
    const textNow = await demo.getDemoText();
    const runningOccurrences = (textNow.match(/Running Merge Sort Demo\.\.\./g) || []).length;
    expect(runningOccurrences).toBeLessThanOrEqual(1);

    // No page errors produced by extra clicks
    expect(pageErrors.length).toBe(0);

    // No console error severity messages
    const hasConsoleError = consoleMessages.some(m => m.type === 'error');
    expect(hasConsoleError).toBe(false);
  });

  test('S1 -> S2: demo completes, shows final sorted array and re-enables button', async ({ page }) => {
    // This test waits for the full demo to complete. The demo emits many timed steps (~1.2s per step),
    // so we've increased the test timeout globally at the top of this file.

    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const demo = new DemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickRun();

    // Assert we've entered the running state
    expect(await demo.isRunButtonDisabled()).toBe(true);
    const startText = await demo.getDemoText();
    expect(startText).toContain('Running Merge Sort Demo...');

    // Wait until the final sorted array text appears in demoArea
    // Use a generous timeout (covered by test.setTimeout above)
    await page.waitForFunction(() => {
      const area = document.getElementById('demo-area');
      return area && area.textContent && area.textContent.includes('Final sorted array:');
    }, { timeout: 110000 });

    // After completion, demo button should be re-enabled (exit_action: demoBtn.disabled = false)
    expect(await demo.isRunButtonEnabled()).toBe(true);

    // Final sorted array string should match expected result from FSM
    const finalText = await demo.getDemoText();
    expect(finalText).toContain('Final sorted array:');
    // The expected sorted array from the demoArray [38,27,43,3,9,82,10] is:
    expect(finalText).toContain('[3, 9, 10, 27, 38, 43, 82]');

    // Ensure the demo produced many steps (sanity check) - at least 10 lines of info beyond the header.
    const infoLines = finalText.split('\n').map(s => s.trim()).filter(Boolean);
    // There will be "Running Merge Sort Demo..." plus many lines. Expect more than 15 non-empty lines.
    expect(infoLines.length).toBeGreaterThan(15);

    // Ensure no uncaught page errors occurred during the entire run
    expect(pageErrors.length).toBe(0);

    // Ensure no console error severity messages were emitted
    const hasConsoleError = consoleMessages.some(m => m.type === 'error');
    expect(hasConsoleError).toBe(false);
  });

  test('Edge case: After completion clicking Run Demo restarts the demo (resets demoArea)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const demo = new DemoPage(page);
    await demo.goto();

    // Run the demo and wait for completion
    await demo.clickRun();
    await page.waitForFunction(() => {
      const area = document.getElementById('demo-area');
      return area && area.textContent && area.textContent.includes('Final sorted array:');
    }, { timeout: 110000 });

    // Click again to restart - this should immediately reset demoArea to the "Running" header
    await demo.clickRun();

    // After restart, button should be disabled again
    expect(await demo.isRunButtonDisabled()).toBe(true);

    // demoArea should have been reset to the initial running message
    const restartedText = await demo.getDemoText();
    expect(restartedText).toContain('Running Merge Sort Demo...');
    // It should not contain the "Final sorted array:" text immediately after restart (it will be appended later)
    expect(restartedText).not.toContain('Final sorted array:');

    // No page errors or console errors were thrown by restarting
    expect(pageErrors.length).toBe(0);
    const hasConsoleError = consoleMessages.some(m => m.type === 'error');
    expect(hasConsoleError).toBe(false);
  });
});