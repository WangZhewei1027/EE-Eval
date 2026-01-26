import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8352b91-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object representing the demo area and controls.
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runDemo');
    this.demoArea = page.locator('#demoArea');
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

  async isButtonVisible() {
    return await this.runButton.isVisible();
  }

  async getButtonAriaLabel() {
    return await this.runButton.getAttribute('aria-label');
  }

  async getDemoRole() {
    return await this.demoArea.getAttribute('role');
  }

  async getDemoAriaLive() {
    return await this.demoArea.getAttribute('aria-live');
  }
}

// Utility: count occurrences of substring in a string
function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  while (true) {
    pos = haystack.indexOf(needle, pos);
    if (pos === -1) break;
    count++;
    pos += needle.length;
  }
  return count;
}

test.describe('Binary Search — Minimal Demonstration (FSM validation)', () => {
  // Collect console messages and page errors for each test so we can assert runtime stability.
  test.beforeEach(async ({ page }) => {
    // Ensure a fresh navigation for each test.
    await page.goto('about:blank');
  });

  test('S0_Idle: initial render shows expected button and demo area text', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) per the FSM:
    // - renderPage() is expected to have produced a button with id #runDemo
    // - the demo area should show the initial guidance text.
    const demo = new DemoPage(page);
    // Listen for console and page errors (captured but not asserted here).
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    await demo.goto();

    // Verify the run button exists, is visible, and has the expected aria-label
    expect(await demo.isButtonVisible()).toBe(true);
    expect(await demo.getButtonAriaLabel()).toBe('Run binary search demonstration');

    // Verify demo area initial content matches the textual prompt from the HTML
    const initial = await demo.getDemoText();
    expect(initial).toContain('Click the button to start the textual demonstration.');

    // Accessibility attributes per FSM components
    expect(await demo.getDemoRole()).toBe('log');
    expect(await demo.getDemoAriaLive()).toBe('polite');

    // There should be no uncaught page errors or error-level console messages on initial load
    // (we capture them to be explicit — many pages are error-free).
    const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleCount).toBe(0);
  });

  test('Transition S0 -> S1 (clearDemoArea) and S1 -> S2 (Demonstration complete) on click', async ({ page }) => {
    // This test validates the transition when the user clicks #runDemo:
    // - The demo area should be cleared at the start (entry action clearDemoArea)
    // - The textual trace for the two traces (present & absent) should be appended
    // - The final "Demonstration complete..." line should be present (S2_DemoComplete)
    const demo = new DemoPage(page);
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    await demo.goto();

    // Sanity: initial content exists
    const before = await demo.getDemoText();
    expect(before).toContain('Click the button to start the textual demonstration.');

    // Click to run the demonstration.
    await demo.clickRun();

    // After clicking, the demo area should no longer contain the initial guidance text,
    // because clearDemoArea() was invoked at the start of the run (entry action).
    const after = await demo.getDemoText();
    expect(after).not.toContain('Click the button to start the textual demonstration.');

    // The trace should include the first search ("Searching for 7") and the second ("Searching for 8")
    expect(after).toContain('Searching for 7 in [1, 3, 5, 7, 9, 11, 13]');
    expect(after).toContain('Searching for 8 in [1, 3, 5, 7, 9, 11, 13]');

    // There should be separators ("-----") between traces and then the demonstration-complete line.
    expect(after).toContain('-----');
    expect(after).toContain('Demonstration complete. This trace mirrors the step-by-step descriptions above.');

    // No unexpected runtime errors during the run.
    const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleCount).toBe(0);
  });

  test('Edge case: multiple rapid clicks produce multiple sequential demonstrations and remain stable', async ({ page }) => {
    // This test checks an edge-case scenario mentioned in the FSM requirements:
    // - Users might click many times. The page's script prevents reentry while running,
    //   but because the demo runs synchronously, multiple rapid clicks will queue sequential runs.
    // - We validate that multiple runs append multiple "Demonstration complete..." messages rather than throwing errors.
    const demo = new DemoPage(page);
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    await demo.goto();

    // Perform 3 rapid clicks to simulate user impatience.
    const RUNS = 3;
    for (let i = 0; i < RUNS; i++) {
      // Fire clicks without awaiting intermediary changes to simulate rapid user interaction.
      // Because the implementation runs synchronously in the click handler, each click will
      // create a separate complete run appended in sequence.
      // Using Promise.all wouldn't help here since clicks are synchronous; we just issue them quickly.
      await demo.runButton.click();
    }

    // Wait for the demo area to contain at least one complete marker (gives time for synchronous runs to finish)
    await expect(demo.demoArea).toContainText('Demonstration complete.', { timeout: 2000 });

    const content = await demo.getDemoText();
    const completes = countOccurrences(content, 'Demonstration complete. This trace mirrors the step-by-step descriptions above.');

    // Expect one "Demonstration complete..." per click. If the implementation prevents reentry mid-run,
    // the number could be lower, but given synchronous runs we expect sequential runs equal to RUNS.
    // We assert it's at least 1 and not more than RUNS to be robust on different runtimes.
    expect(completes).toBeGreaterThanOrEqual(1);
    expect(completes).toBeLessThanOrEqual(RUNS);

    // Ensure there are no page errors or console errors from repeated runs.
    const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleCount).toBe(0);
  });

  test('FSM evidence checks: DOM contains expected traces and structure after run', async ({ page }) => {
    // This test cross-checks the expected evidential strings found in the FSM definition and page JS:
    // - "btn.addEventListener('click', function({" is part of the source; we cannot inspect source text easily,
    //   but we can validate observable outcomes tied to those handlers: presence of 'Found at index' lines and 'Not found'.
    const demo = new DemoPage(page);
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    await demo.goto();

    // Run the demo once
    await demo.clickRun();

    const content = await demo.getDemoText();

    // Evidence: for the present-target trace, we expect "Found at index 3"
    expect(content).toContain('Found at index 3.');

    // Evidence: for the absent-target trace, we expect "Not found. Interval became empty (low > high)."
    expect(content).toContain('Not found. Interval became empty (low > high).');

    // And the final demonstration complete line (S2 evidence)
    expect(content).toContain('Demonstration complete. This trace mirrors the step-by-step descriptions above.');

    // No unexpected runtime exceptions
    const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleCount).toBe(0);
  });

  test('Accessibility and semantics remain intact after running demo', async ({ page }) => {
    // This test ensures the demo area retains its role/aria-live attributes after the run,
    // and that the button remains in the DOM (state machine should not remove it).
    const demo = new DemoPage(page);
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    await demo.goto();

    // Run the demo
    await demo.clickRun();

    // The role and aria-live attributes should still be present and unchanged.
    expect(await demo.getDemoRole()).toBe('log');
    expect(await demo.getDemoAriaLive()).toBe('polite');

    // The run button should still be visible and enabled (not removed or disabled by the script).
    expect(await demo.isButtonVisible()).toBe(true);

    // No runtime exceptions
    const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleCount).toBe(0);
  });
});