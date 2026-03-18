import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3717501-ffc4-11f0-821c-7d25bc609266.html';

// Simple Page Object for the demo page
class RecursionDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runDemoBtn');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure initial load
    await expect(this.page).toHaveTitle(/Understanding Recursion/i);
    await expect(this.runButton).toBeVisible();
    await expect(this.output).toBeVisible();
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getOutputText() {
    return (await this.output.innerText()).trim();
  }

  async isButtonDisabled() {
    return await this.runButton.isDisabled();
  }

  async getButtonText() {
    return (await this.runButton.innerText()).trim();
  }

  async getButtonAriaLabel() {
    return await this.runButton.getAttribute('aria-label');
  }
}

test.describe('FSM: Understanding Recursion Demo (a3717501-ffc4-11f0-821c-7d25bc609266)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for each test to assert runtime health
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // store type, text and location if available
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location ? msg.location() : undefined,
      });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Basic assertion that no uncaught errors occurred during page interaction.
    // This validates that runtime did not throw unexpected exceptions (ReferenceError, TypeError, etc).
    // If the application has intentional runtime errors, adjust expectations accordingly.
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs, `Expected no console.error messages, found: ${JSON.stringify(errorConsoleMsgs, null, 2)}`)
      .toHaveLength(0);
    expect(pageErrors, `Expected no page errors, found: ${pageErrors.length} errors`).toHaveLength(0);
  });

  test.describe('Idle State (S0_Idle)', () => {
    test('renders the page and Idle state UI correctly', async ({ page }) => {
      // This test validates the S0_Idle evidence:
      // - Button with id runDemoBtn exists with correct text and aria-label
      // - demoOutput exists and is initially empty
      const demo = new RecursionDemoPage(page);
      await demo.goto();

      // Validate button exists, enabled, and has expected text & aria-label
      await expect(demo.runButton).toBeEnabled();
      await expect(demo.runButton).toHaveText('Show Recursive Calculation of factorial(5)');
      expect(await demo.getButtonAriaLabel()).toBe('Calculate factorial of 5');

      // Validate output area is empty on entry (entry action renderPage() is implied)
      const outputText = await demo.getOutputText();
      expect(outputText, 'demoOutput should be empty on initial render').toBe('');

      // Accessibility checks relevant to Idle state evidence
      await expect(demo.output).toHaveAttribute('aria-live', 'polite');
      await expect(demo.output).toHaveAttribute('aria-atomic', 'true');
    });

    test('edge case: ensure button is focusable and keyboard operable', async ({ page }) => {
      // Validate user can focus and activate the button with keyboard (Enter).
      const demo = new RecursionDemoPage(page);
      await demo.goto();

      // Focus the button and press Enter; since this will trigger the transition, we only test focusing and keydown firing capability.
      await demo.runButton.focus();
      expect(await demo.runButton.evaluate((el) => document.activeElement === el)).toBe(true);

      // Pressing Enter will trigger the demo; we won't assert post-click behavior here (that's covered in transition tests),
      // but ensure no immediate errors from focusing or keyboard interaction.
      await page.keyboard.press('Enter');

      // Wait briefly for potential console/page errors to surface (collected in afterEach)
      await page.waitForTimeout(200);
    });
  });

  test.describe('Transition: ShowFactorialCalculation (S0_Idle -> S1_Calculating)', () => {
    test('clicking the Run Demo button triggers calculation and transitions to Calculating state', async ({ page }) => {
      // This test validates the transition actions and S1_Calculating evidence:
      // - output.textContent is cleared and updated with "Calculating factorial(5):"
      // - the trace of recursive calls is printed
      // - final result displayed
      // - button disabled and text changed to "Demo Completed" (exit actions)
      const demo = new RecursionDemoPage(page);
      await demo.goto();

      // Click the button to trigger the transition
      await demo.clickRun();

      // Wait for the output to show at least the header and final result
      await expect(demo.output).toContainText('Calculating factorial(5):');
      await expect(demo.output).toContainText('Final Result: factorial(5) = 120');

      // Validate that recursive trace lines exist (calls, base case, returns)
      const out = await demo.getOutputText();

      // Basic structural expectations
      expect(out).toMatch(/Calculating factorial\(5\):/);
      expect(out).toMatch(/factorial\(5\) called/);
      expect(out).toMatch(/factorial\(4\) called/);
      expect(out).toMatch(/Base case reached: factorial\(0\) = 1/);
      expect(out).toMatch(/Returning factorial\(1\) = 1/);
      expect(out).toMatch(/Returning factorial\(2\) = 2/);
      expect(out).toMatch(/Returning factorial\(3\) = 6/);
      expect(out).toMatch(/Returning factorial\(4\) = 24/);
      expect(out).toMatch(/Returning factorial\(5\) = 120/);

      // Verify onExit actions on the button: disabled and text changed to 'Demo Completed'
      await expect(demo.runButton).toBeDisabled();
      expect(await demo.getButtonText()).toBe('Demo Completed');

      // Verify that the output begins with the transition's expected header and that the trace follows
      // The FSM expected the header to be added immediately after clearing output
      expect(out.startsWith('Calculating factorial(5):')).toBeTruthy();
    });

    test('edge case: clicking the button a second time does not re-run the demo (button is disabled)', async ({ page }) => {
      // Validate idempotence and that the button's disabled state prevents a second run
      const demo = new RecursionDemoPage(page);
      await demo.goto();

      await demo.clickRun();
      // Wait for completion of trace
      await expect(demo.output).toContainText('Final Result: factorial(5) = 120');

      // Capture the output snapshot after first run
      const snapshotAfterFirstRun = await demo.getOutputText();

      // Attempt to click again (should be disabled)
      // Use a direct click anyway to simulate user trying — Playwright will throw if element disabled,
      // so conditionally attempt to click only if enabled to avoid test framework exceptions.
      const isDisabled = await demo.isButtonDisabled();
      expect(isDisabled).toBe(true);

      if (!isDisabled) {
        // If unexpectedly not disabled, attempt second click and then ensure output changed appropriately.
        await demo.clickRun();
      }

      // Wait briefly and then verify output remains unchanged (no re-run)
      await page.waitForTimeout(200);
      const snapshotAfterSecondAttempt = await demo.getOutputText();
      expect(snapshotAfterSecondAttempt).toBe(snapshotAfterFirstRun);
    });

    test('error scenario: ensure no uncaught exceptions are thrown during the factorial trace', async ({ page }) => {
      // Even though we've already asserted no page errors in afterEach, this test explicitly
      // exercises the demo and then asserts there were no page errors collected during the run.
      const demo = new RecursionDemoPage(page);
      await demo.goto();

      await demo.clickRun();

      // Wait for expected final result
      await expect(demo.output).toContainText('Final Result: factorial(5) = 120');

      // Allow any asynchronous console errors to be emitted
      await page.waitForTimeout(200);

      // Check collected console messages: none should be of type 'error'
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs, `Expected no console.error messages during run, found: ${JSON.stringify(errorConsoleMsgs, null, 2)}`)
        .toHaveLength(0);

      // Check pageErrors captured
      expect(pageErrors, `Expected no page errors during run, found: ${pageErrors.length} errors`).toHaveLength(0);
    });
  });

  test.describe('Accessibility & Content Integrity', () => {
    test('output uses pre and preserves whitespace and is readable', async ({ page }) => {
      // Verify #demoOutput uses <pre> semantics: newlines preserved, min-height exists (visual), and content has indentation.
      const demo = new RecursionDemoPage(page);
      await demo.goto();

      await demo.clickRun();
      await expect(demo.output).toContainText('factorial(5) called');

      const out = await demo.getOutputText();

      // Check that indentation appears (two spaces repeated as in implementation)
      // Look for an indented "factorial(4) called" line (should include at least two leading spaces)
      expect(/\n\s{2}factorial\(4\) called/.test('\n' + out)).toBeTruthy();

      // Ensure final result present
      expect(out.includes('Final Result: factorial(5) = 120')).toBeTruthy();
    });
  });
});