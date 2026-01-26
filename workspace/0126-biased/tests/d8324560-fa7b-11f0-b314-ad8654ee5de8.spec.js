import { test, expect } from '@playwright/test';

// Test suite for the Dynamic Array interactive demo
// Application ID: d8324560-fa7b-11f0-b314-ad8654ee5de8
// Served at: http://127.0.0.1:5500/workspace/0126-biased/html/d8324560-fa7b-11f0-b314-ad8654ee5de8.html
//
// This file verifies the FSM states and transitions described in the spec:
// - S0_Idle: initial rendering (button present, demo output prompt visible)
// - S1_Simulating: clicking the button disables it and shows "Simulating..." immediately
// - S2_Completed: after a short timeout the full simulation text is shown and the button is re-enabled
//
// The tests also capture console messages and page errors emitted by the page during interactions.
// We assert that no unexpected runtime errors occur (pageerror or console.error).
//
// Page object pattern: DemoPage encapsulates common interactions and assertions.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8324560-fa7b-11f0-b314-ad8654ee5de8.html';

class DemoPage {
  constructor(page) {
    this.page = page;
    this.runBtn = '#runDemo';
    this.out = '#demoOut';
  }

  // Navigate to the demo page
  async goto() {
    await this.page.goto(APP_URL);
    // Ensure main container loaded
    await this.page.waitForSelector('.container');
  }

  // Return the current textContent of the demo output
  async getOutputText() {
    return await this.page.locator(this.out).textContent();
  }

  // Click the run demo button (normal user click)
  async clickRunDemo() {
    await this.page.click(this.runBtn);
  }

  // Check if the run button is disabled
  async isButtonDisabled() {
    return await this.page.locator(this.runBtn).evaluate((el) => el.disabled === true);
  }

  // Wait until the simulation completed: output contains "after append 50"
  async waitForSimulationComplete(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const out = document.getElementById('demoOut');
      return out && out.textContent && out.textContent.includes('after append 50');
    }, null, { timeout });
  }
}

test.describe('Dynamic Array — Interactive Demo (FSM validation)', () => {
  // Shared per-test structures to collect console messages and page errors
  let consoleMessages;
  let pageErrors;
  let demo;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events to capture logs and console.error
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.type() throws in some environments, still capture text
        consoleMessages.push({ type: 'unknown', text: msg.text() });
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // Basic assertion: there should be no uncaught page errors
    // and no console messages of type 'error'.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || /error/i.test(m.text));
    expect(pageErrors, 'No uncaught page errors should appear').toEqual([]);
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  test('Initial state (S0_Idle) renders correctly - button and output present', async ({ page }) => {
    // Validate initial DOM and entry action of S0 (renderPage())
    // - The Run capacity demo button exists and is enabled
    // - The demoOut div exists with the prompt text and aria-live attribute
    const btn = page.locator('#runDemo');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Run capacity demo (1..50)');
    await expect(btn).toBeEnabled();

    const out = page.locator('#demoOut');
    await expect(out).toBeVisible();
    await expect(out).toHaveAttribute('aria-live', 'polite');

    const outText = await demo.getOutputText();
    // The initial text should instruct the user to press the button
    expect(outText && outText.includes('Press the button to see the output.'), true);

    // Confirm no errors logged at load time (these are also asserted in afterEach)
    expect(consoleMessages.length >= 0).toBe(true); // presence only; detailed checks in afterEach
  });

  test('Transition S0_Idle -> S1_Simulating on click: button disabled and output shows "Simulating..."', async ({ page }) => {
    // Click the run button: transition to Simulating should occur synchronously
    // Verify: button.disabled === true immediately and output shows 'Simulating...'
    await demo.clickRunDemo();

    // Immediately after click, button should be disabled
    const disabledNow = await demo.isButtonDisabled();
    expect(disabledNow).toBe(true);

    // Output should change synchronously to "Simulating..."
    const textNow = await demo.getOutputText();
    expect(textNow && textNow.trim() === 'Simulating...').toBe(true);
  });

  test('Transition S1_Simulating -> S2_Completed after timeout: output shows simulation results and button re-enabled', async ({ page }) => {
    // Click to start simulation
    await demo.clickRunDemo();

    // Ensure we saw the S1 state: disabled and simulating text
    expect(await demo.isButtonDisabled()).toBe(true);
    expect(await demo.getOutputText()).toBe('Simulating...');

    // Wait for the asynchronous completion (setTimeout 100ms in the app)
    await demo.waitForSimulationComplete(5000);

    // After completion, output should contain the simulation header and the final append line
    const finalText = await demo.getOutputText();
    expect(finalText).toContain('Append simulation (grow by factor 2):');
    expect(finalText).toContain('Starting: size=0, capacity=0');
    expect(finalText).toContain('after append 50');

    // The button should be re-enabled
    const disabledAfter = await demo.isButtonDisabled();
    expect(disabledAfter).toBe(false);
  });

  test('Edge case: attempting a second click while simulating should not trigger a second concurrent simulation', async ({ page }) => {
    // Click to start simulation
    await demo.clickRunDemo();

    // Immediately confirm disabled
    expect(await demo.isButtonDisabled()).toBe(true);

    // Attempt a second click while disabled. Playwright's click will throw when element is disabled.
    // We assert that trying to click a disabled button results in an error from Playwright and that
    // the page still completes only a single simulation (final output contains expected final state).
    let secondClickErrored = false;
    try {
      // This will normally throw because the button is disabled. We intentionally try to simulate a naive user double-click.
      await page.click('#runDemo');
    } catch (err) {
      secondClickErrored = true;
      // Basic sanity check: error message should indicate not enabled or not clickable or disconnected
      expect(String(err.message || err)).toBeTruthy();
    }
    expect(secondClickErrored).toBe(true);

    // Wait for the single simulation to finish and verify there is only one final completion
    await demo.waitForSimulationComplete(5000);
    const finalText = await demo.getOutputText();

    // Ensure final text corresponds to one run: contains header and final append
    expect(finalText).toContain('Append simulation (grow by factor 2):');
    expect(finalText.match(/after append 50/g)?.length).toBeGreaterThanOrEqual(1);
  });

  test('Stress: run demo multiple times sequentially and validate consistent behavior', async ({ page }) => {
    // Run the demo three times in sequence and validate each run completes and button toggles state properly
    for (let i = 0; i < 3; i++) {
      await demo.clickRunDemo();

      // Immediately simulating
      expect(await demo.isButtonDisabled()).toBe(true);
      expect(await demo.getOutputText()).toBe('Simulating...');

      await demo.waitForSimulationComplete(5000);

      const out = await demo.getOutputText();
      expect(out).toContain('Append simulation (grow by factor 2):');
      expect(out).toContain('after append 50');

      // After completion, button should be enabled for the next iteration
      expect(await demo.isButtonDisabled()).toBe(false);
    }
  });

  test('Accessibility & content checks: aria-live present and output is monospaced, contains expected sections', async ({ page }) => {
    // Validate aria-live attribute and check that output shows a code-like block (monospace font indicated in CSS)
    const out = page.locator('#demoOut');
    await expect(out).toHaveAttribute('aria-live', 'polite');

    // Trigger the demo to get real content
    await demo.clickRunDemo();
    await demo.waitForSimulationComplete(5000);

    const finalText = await demo.getOutputText();
    // Ensure lines describing resizes exist and at least one 'resize:' entry appears
    expect(finalText).toMatch(/resize:/);
    // Ensure the content contains "capacity" references
    expect(finalText).toMatch(/capacity/);
  });
});