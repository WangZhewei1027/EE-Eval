import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b33353-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page object representing the interactive NP-Completeness demo page.
 * Encapsulates common selectors and actions used across tests.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Array<string>} pageErrors array to collect pageerror messages
   * @param {Array<string>} consoleErrors array to collect console error texts
   */
  constructor(page, pageErrors, consoleErrors) {
    this.page = page;
    this.pageErrors = pageErrors;
    this.consoleErrors = consoleErrors;
    this.buttonSelector = "button[onclick='runDemo()']";
    this.outputSelector = '#demo-output';
  }

  // Navigate to the page and wait for load. Handlers should already be attached by the caller.
  async load() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Returns a Playwright Locator for the Run Demo button
  button() {
    return this.page.locator(this.buttonSelector);
  }

  // Returns a Playwright Locator for the demo output container
  output() {
    return this.page.locator(this.outputSelector);
  }

  // Click the Run Demo button (triggers onclick="runDemo()")
  async clickRunDemo() {
    await this.page.click(this.buttonSelector);
  }

  // Get computed display style of demo output
  async getOutputDisplay() {
    return await this.output().evaluate((el) => getComputedStyle(el).display);
  }

  // Get innerHTML of demo output
  async getOutputHTML() {
    return await this.output().evaluate((el) => el.innerHTML);
  }

  // Helper to assert whether any captured page error message matches a regex
  hasPageErrorMatching(regex) {
    return this.pageErrors.some((m) => regex.test(m));
  }

  // Helper to assert whether any captured console error matches a regex
  hasConsoleErrorMatching(regex) {
    return this.consoleErrors.some((m) => regex.test(m));
  }
}

test.describe('FSM: Understanding NP-Completeness - interactive demo (f0b33353...)', () => {
  // Arrays to collect errors for each test
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors for each test to avoid cross-test leakage
    pageErrors = [];
    consoleErrors = [];

    // Attach listeners BEFORE navigation so we capture load-time script errors (SyntaxError etc.)
    page.on('pageerror', (err) => {
      // pageerror gives an Error object; capture its message for assertions
      try {
        pageErrors.push(err && err.message ? String(err.message) : String(err));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });

    page.on('console', (msg) => {
      // Capture console errors (console.error, uncaught exceptions surfaced to console, etc.)
      if (msg.type() === 'error') {
        try {
          consoleErrors.push(msg.text());
        } catch (e) {
          consoleErrors.push(String(msg));
        }
      }
    });

    // Navigate to the app and wait for the page to load (this may trigger SyntaxError on load)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('Initial state (S0_Idle): page renders with Run Verification Demo button and hidden output', async ({ page }) => {
    // Purpose:
    // - Validate the Idle state evidence: the Run Verification Demo button exists
    // - Validate demo-output exists and is initially hidden (display: none)
    // - Capture and assert any early script parsing errors are reported (we expect issues in the page's JS)

    const demo = new DemoPage(page, pageErrors, consoleErrors);

    // Assert the button exists and has the expected visible text
    const button = demo.button();
    await expect(button).toHaveCount(1);
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Run Verification Demo');

    // Assert the demo output container exists and is hidden by default
    const output = demo.output();
    await expect(output).toHaveCount(1);
    const display = await demo.getOutputDisplay();
    expect(display).toBe('none');

    // Check that the output is empty initially (no pre-rendered content)
    const html = await demo.getOutputHTML();
    expect(html.trim()).toBe('');

    // The implementation contains malformed JS in the script block.
    // We assert that a SyntaxError (or similar parse error) occurred during page load.
    // This validates that errors are surfaced and captured by the test harness (requirement: observe console logs/page errors).
    const sawSyntaxError = pageErrors.some((m) => /SyntaxError|Unexpected token|Unexpected identifier|Unexpected end of input/i.test(m));
    expect(sawSyntaxError).toBeTruthy();
  });

  test('Transition: clicking Run Demo attempts to run runDemo() and raises errors or reveals output (S0 -> S1)', async ({ page }) => {
    // Purpose:
    // - Attempt the FSM transition: click the Run Verification Demo button.
    // - Observe the resulting behavior: either the demo-output becomes visible (successful transition)
    //   OR JS errors occur (SyntaxError / ReferenceError) which we must assert as observed per instructions.
    // - Verify onEnter runDemo() effects if they execute: output.style.display = 'block' and expected verification text appears.

    const demo = new DemoPage(page, pageErrors, consoleErrors);

    // Clear previous collectors for clarity before user interaction
    pageErrors.length = 0;
    consoleErrors.length = 0;

    // Try clicking the button. If runDemo is undefined or script is malformed, this click will likely cause a ReferenceError.
    await demo.clickRunDemo();

    // Give the page a short moment to process any asynchronous console/page errors triggered by the click.
    // We do not patch or alter the environment; we only observe errors that naturally occur.
    await page.waitForTimeout(200);

    // Check if demo-output was made visible (the expected observable in the FSM transition).
    const displayAfterClick = await demo.getOutputDisplay();

    if (displayAfterClick === 'block') {
      // If the output is visible, validate that it contains expected verification content from the demo.
      const outputHTML = await demo.getOutputHTML();

      // The correct demo, if executed, should include heading "Verifying 3-SAT Solution" and a final result paragraph.
      expect(outputHTML).toContain('Verifying 3-SAT Solution');
      expect(outputHTML.toLowerCase()).toContain('final result');

      // Also assert no fatal page errors were captured (best-case scenario)
      const fatalError = pageErrors.some((m) => /SyntaxError|ReferenceError|TypeError|is not defined/i.test(m));
      expect(fatalError).toBeFalsy();
    } else {
      // Likely path due to malformed JS: the demo did not execute and we should see one or more errors.
      // Assert that we observed a SyntaxError at load OR a ReferenceError when the onclick handler executed.
      const sawSyntaxError = pageErrors.some((m) => /SyntaxError|Unexpected token|Unexpected identifier|Unexpected end of input/i.test(m));
      const sawReferenceError = pageErrors.some((m) => /ReferenceError|is not defined|runDemo/i.test(m));
      const sawConsoleError = consoleErrors.some((m) => /ReferenceError|SyntaxError|TypeError|is not defined/i.test(m));

      // At least one of these error types should be present (we expect errors per instructions).
      expect(sawSyntaxError || sawReferenceError || sawConsoleError).toBeTruthy();

      // Verify that the demo-output remains hidden (transition to S1 did not occur)
      expect(displayAfterClick).toBe('none');

      // Also ensure that output remains empty or unchanged (no partial HTML inserted)
      const outputHTML = await demo.getOutputHTML();
      expect(outputHTML.trim()).toBe('');
    }
  });

  test('Edge case & error observation: document-level errors are reported via console and pageerror', async ({ page }) => {
    // Purpose:
    // - Explicitly validate that both pageerror and console.error reporting channels capture problems.
    // - This test ensures the test harness correctly observes runtime and load-time errors.
    const demo = new DemoPage(page, pageErrors, consoleErrors);

    // We expect at least one pageerror due to the malformed JS in the page.
    expect(pageErrors.length).toBeGreaterThan(0);

    // Also check consoleErrors array; some environments surface parsing/runtime issues via console as well.
    // It's acceptable if consoleErrors is empty in some browsers/environments; we assert that either pageErrors or consoleErrors contains relevant error text.
    const combinedHasRelevantError = pageErrors.concat(consoleErrors).some((m) =>
      /SyntaxError|Unexpected token|Unexpected identifier|ReferenceError|is not defined|TypeError/i.test(m)
    );
    expect(combinedHasRelevantError).toBeTruthy();

    // Ensure that core UI elements are still present despite script errors (graceful degradation)
    await expect(demo.button()).toBeVisible();
    const display = await demo.getOutputDisplay();
    expect(display).toBe('none');
  });
});