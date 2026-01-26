import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83579b0-fa7b-11f0-b314-ad8654ee5de8.html';

/**
 * Page Object for the Exponential Search demo page.
 * Encapsulates common actions and DOM queries used by tests.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runDemo = page.locator('#runDemo');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.runDemo.click();
  }

  async focusRun() {
    await this.runDemo.focus();
  }

  async pressEnterOnRun() {
    await this.page.keyboard.press('Enter');
  }

  async getButtonText() {
    return this.runDemo.textContent();
  }

  async getOutputText() {
    return this.output.textContent();
  }

  async isOutputFocused() {
    return await this.page.evaluate(() => document.activeElement && document.activeElement.id === 'demoOutput');
  }

  async getButtonAttribute(name) {
    return this.runDemo.getAttribute(name);
  }

  async getOutputAttribute(name) {
    return this.output.getAttribute(name);
  }
}

test.describe('Exponential Search — FSM-driven end-to-end tests', () => {
  // Capture console events and page errors for each test so we can assert runtime health.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (type and text) so tests can make assertions about runtime diagnostics.
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If something goes wrong while reading a console message, still record a minimal entry.
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught page errors (ReferenceError, TypeError, SyntaxError etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test exactly as-is.
    await page.goto(APP_URL);
  });

  test('S0_Idle state: initial render shows Run demo button and placeholder output', async ({ page }) => {
    // Validate initial (Idle) state entry actions and DOM evidence per FSM.
    const demo = new DemoPage(page);

    // Button should be present and visible with expected text and attributes.
    await expect(demo.runDemo).toBeVisible();
    const btnText = await demo.getButtonText();
    expect(btnText && btnText.trim()).toBe('Run demo: find 15'); // evidence: button text

    // Check attributes on the button (class and aria-label) as described in FSM & HTML.
    const cls = await demo.getButtonAttribute('class');
    expect(cls).toBe('btn');

    const aria = await demo.getButtonAttribute('aria-label');
    expect(aria).toBe('Run demonstration');

    // Output area should contain the placeholder instruction before running the demo.
    const initialOutput = await demo.getOutputText();
    expect(initialOutput).toContain('(Press the button to view a trace of exponential search for a sample array.)');

    // Output should expose accessibility attributes referenced in the HTML.
    const ariaLive = await demo.getOutputAttribute('aria-live');
    expect(ariaLive).toBe('polite');

    const tabIndex = await demo.getOutputAttribute('tabindex');
    // tabindex is provided as "0" in the HTML; ensure it's present (could be string '0').
    expect(tabIndex === '0' || tabIndex === 0).toBeTruthy();

    // Assert there were no uncaught runtime errors on initial load.
    expect(pageErrors.length, `Expected no page errors on load, got: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    // Also assert there are no console errors recorded.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors were emitted: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Transition RunDemo: clicking the button renders step-by-step trace and focuses output (S0 -> S1)', async ({ page }) => {
    // This test validates the RunDemo event and transition to Demo Running state.
    const demo = new DemoPage(page);

    // Precondition sanity: initial output shows placeholder.
    const before = await demo.getOutputText();
    expect(before).toContain('(Press the button to view a trace');

    // Perform the event: user clicks the #runDemo button.
    await demo.clickRun();

    // After clicking, the output area should be replaced with a step-by-step trace.
    const outText = await demo.getOutputText();
    expect(outText).toContain('Array A: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]');
    expect(outText).toContain('Target T = 15');

    // Evidence lines from doubling and binary search phases should appear.
    expect(outText).toContain('Doubling step 1');
    expect(outText).toContain('Range for binary search: indices [4, 8]');
    expect(outText).toContain('Binary step 1');
    expect(outText).toContain('Found T at index 7.');

    // Check that out.focus() was invoked by verifying document.activeElement is the demo output.
    const focused = await demo.isOutputFocused();
    expect(focused).toBe(true);

    // The demo output should be styled with the "steps" class (visual feedback).
    const hasStepsClass = await page.locator('#demoOutput').evaluate((el) => el.classList.contains('steps'));
    expect(hasStepsClass).toBe(true);

    // Assert no uncaught runtime errors occurred during the click/transition.
    expect(pageErrors.length, `Expected no page errors after clicking runDemo, got: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    // Assert there were no console errors (but capture all console messages for debugging evidence).
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Event variant: keyboard activation (Enter) triggers the same transition and focuses output', async ({ page }) => {
    // Validate accessibility: activating the button via keyboard should produce the same results.
    const demo = new DemoPage(page);

    // Focus the button and simulate Enter key.
    await demo.focusRun();
    await demo.pressEnterOnRun();

    // Verify output updated as for click-based event.
    const outText = await demo.getOutputText();
    expect(outText).toContain('Array A: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]');
    expect(outText).toContain('Found T at index 7.');

    // Focus should move to demoOutput as a result of out.focus() in the script.
    const focused = await demo.isOutputFocused();
    expect(focused).toBe(true);

    // Ensure no runtime errors were thrown during keyboard activation.
    expect(pageErrors.length, `Page errors during keyboard activation: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Idempotence: repeated activations re-render the same trace (no duplication) and keep focus', async ({ page }) => {
    // Validate that repeated triggering of the demo produces consistent output (no accumulation across runs)
    // and that output remains focused after each run.
    const demo = new DemoPage(page);

    // First click
    await demo.clickRun();
    const firstText = await demo.getOutputText();
    expect(firstText).toContain('Found T at index 7.');

    // Click a second time
    await demo.clickRun();
    const secondText = await demo.getOutputText();
    expect(secondText).toContain('Found T at index 7.');

    // The texts should be identical (the implementation rebuilds lines and overwrites textContent).
    expect(secondText).toBe(firstText);

    // Output should remain focused after subsequent activation.
    const focused = await demo.isOutputFocused();
    expect(focused).toBe(true);

    // Confirm no new page errors or console errors appeared during repeated runs.
    expect(pageErrors.length, `Page errors after repeated runs: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors after repeated runs: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Edge-case checks: DOM evidence & FSM expectations are present (button exists, transition behavior deterministic)', async ({ page }) => {
    // This test cross-checks FSM evidence items and ensures UI elements match the FSM description.
    const demo = new DemoPage(page);

    // FSM evidence expects the #runDemo button exists with specific markup.
    await expect(page.locator('button#runDemo')).toHaveCount(1);

    // Validate that the demo output element exists and has the expected role in the DOM.
    await expect(page.locator('#demoOutput')).toBeVisible();

    // Trigger the transition to produce evidentiary text lines.
    await demo.clickRun();
    const outText = await demo.getOutputText();

    // Verify presence of some canonical lines matching the FSM's expected actions (textContent assignment).
    // The script sets out.textContent = lines.join('\n') and constructs specific lines — verify a few of them.
    expect(outText).toMatch(/Array A:\s*\[1,\s*3,\s*5/); // partial match for the array
    expect(outText).toMatch(/Range for binary search:\s*\[4,\s*8\]/); // confirms range reporting

    // Verify binary search trace contains step descriptions
    expect(outText).toMatch(/Binary step \d+:/);

    // No runtime errors should be present; if any exist they will be surfaced in pageErrors.
    expect(pageErrors.length, `Expected zero page errors; found ${pageErrors.length}: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Final assert for the test: log console messages if any non-zero severity seen (for debugging).
    // We still assert there were no console 'error' messages as part of verifying a healthy runtime.
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length, `Unexpected console.error messages: ${JSON.stringify(errors)}`).toBe(0);

    // And ensure there were no uncaught page errors.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    // Close page to ensure teardown (Playwright usually handles this automatically).
    await page.close();
  });
});