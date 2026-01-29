import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cb8932-fa7c-11f0-ba20-415c525382ea.html';

/**
 * Page Object for the P vs NP demo page.
 * Encapsulates selectors and common interactions to keep tests readable.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.solveButtonSelector = '#solve-button';
    this.outputSelector = '#demo-output';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async solveButton() {
    return this.page.locator(this.solveButtonSelector);
  }

  async output() {
    return this.page.locator(this.outputSelector);
  }

  async clickSolveButton() {
    await this.page.click(this.solveButtonSelector);
  }

  async getOutputText() {
    return this.page.locator(this.outputSelector).innerText();
  }

  async isButtonDisabled() {
    return this.page.locator(this.solveButtonSelector).isDisabled();
  }

  async getButtonText() {
    return this.page.locator(this.solveButtonSelector).innerText();
  }
}

test.describe('P vs NP - Subset Sum Verification Demo (FSM validation)', () => {
  // Will collect console messages and page errors for assertions.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages from the page
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      // err is Error object; preserve name and message
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });
  });

  test.afterEach(async () => {
    // nothing to teardown explicitly; listeners are tied to page fixture and cleaned up automatically
  });

  test.describe('State S0_Idle (Initial render)', () => {
    test('Idle state renders expected UI elements and attributes', async ({ page }) => {
      // Validate entry action renderPage() by checking UI is present and initial state is correct.
      const demo = new DemoPage(page);
      await demo.goto();

      // Button should exist, visible, enabled and have correct initial text
      const button = await demo.solveButton();
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
      await expect(button).toHaveText('Run Subset Sum Verification Demo');

      // Output pre element should exist, be empty initially, and have proper aria attributes
      const output = await demo.output();
      await expect(output).toBeVisible();
      const initialOutputText = await demo.getOutputText();
      expect(initialOutputText.trim()).toBe('', 'Expected demo output to be empty on initial render');

      // Verify aria attributes are set as defined in the implementation
      const ariaLive = await page.getAttribute('#demo-output', 'aria-live');
      const ariaAtomic = await page.getAttribute('#demo-output', 'aria-atomic');
      expect(ariaLive).toBe('polite');
      expect(ariaAtomic).toBe('true');

      // Assert there were no runtime page errors up to this point
      expect(pageErrors.length).toBe(0);
      // Also assert no console errors were emitted
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });

  test.describe('Transition RunDemo: S0_Idle -> S1_DemoCompleted', () => {
    test('Clicking the Run Subset Sum button runs demo(), outputs verification results, and updates button (Demo Completed)', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Sanity check initial state
      await expect(await demo.getButtonText()).toBe('Run Subset Sum Verification Demo');

      // Click the button to trigger the demo() and transition to Demo Completed state
      await demo.clickSolveButton();

      // After clicking, the output should be populated with the expected lines.
      // Wait for the output text to contain a distinctive expected substring.
      await page.waitForSelector('#demo-output:has-text("Subset Sum Problem Instance:")');

      const outputText = await demo.getOutputText();

      // Validate important expected observables produced by demo()
      expect(outputText).toContain('Subset Sum Problem Instance:');
      expect(outputText).toContain('Set: [3, 34, 4, 12, 5, 2]');
      expect(outputText).toContain('Target Sum: 9');
      expect(outputText).toContain('Candidate solution 1: [4, 5]');
      expect(outputText).toContain('Verification result: Valid subset (Sum matches target)');
      expect(outputText).toContain('Candidate solution 2: [3, 2]');
      expect(outputText).toContain('Verification result: Invalid subset');
      expect(outputText).toContain('Note: Verification is fast (just sum and check membership).');
      expect(outputText).toContain('This distinction illustrates the core of the P vs NP question.');

      // Validate button state changed to "Demo Completed" and is disabled, as per FSM evidence
      await expect(await demo.isButtonDisabled()).toBe(true);
      await expect(await demo.getButtonText()).toBe('Demo Completed');

      // Ensure no uncaught exceptions were thrown during the transition
      expect(pageErrors.length).toBe(0, `Expected no page errors during demo run, found: ${JSON.stringify(pageErrors)}`);

      // Also assert that the console did not emit error-level messages during the demo
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.text.includes('ReferenceError') || m.text.includes('TypeError') || m.text.includes('SyntaxError'));
      expect(errorConsoleMsgs.length).toBe(0, `Expected no console errors but found: ${JSON.stringify(errorConsoleMsgs)}`);
    });

    test('Edge case: attempting to click the disabled button does nothing and produces no errors', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Trigger the demo to disable the button
      await demo.clickSolveButton();
      await page.waitForSelector('#demo-output:has-text("Subset Sum Problem Instance:")');

      // Capture the output before attempting the second click
      const beforeText = await demo.getOutputText();

      // Attempt to click the now-disabled button. This should not change output or crash the page.
      // Playwright's click on a disabled button will still attempt to dispatch but the browser will ignore it.
      // Use a try/catch to ensure we assert the behavior (no exceptions should be thrown by the page).
      await demo.clickSolveButton();

      // Wait briefly to give any unexpected handlers a chance to run
      await page.waitForTimeout(100);

      const afterText = await demo.getOutputText();
      expect(afterText).toBe(beforeText, 'Output should remain unchanged after clicking disabled button');

      // Ensure the button remains disabled and labeled "Demo Completed"
      await expect(await demo.isButtonDisabled()).toBe(true);
      await expect(await demo.getButtonText()).toBe('Demo Completed');

      // No new page errors or console error messages should have been emitted
      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });

  test.describe('FSM coverage and robustness checks', () => {
    test('Re-render / navigation sanity: page reload retains initial Idle state before interaction', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Reload the page to ensure renderPage() semantics are consistent
      await page.reload({ waitUntil: 'domcontentloaded' });

      // After reload, UI should be back in Idle state
      const button = await demo.solveButton();
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
      await expect(button).toHaveText('Run Subset Sum Verification Demo');

      const outputText = await demo.getOutputText();
      expect(outputText.trim()).toBe('', 'Expected demo output to be empty after reload (back to Idle)');

      // No unexpected errors on reload
      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });

    test('Confirm that verification messages match the internal demo logic (presence of Valid/Invalid lines)', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Run demo
      await demo.clickSolveButton();
      await page.waitForSelector('#demo-output:has-text("Verification result:")');

      const outputText = await demo.getOutputText();

      // The demo verifies two candidate subsets: first valid, second invalid.
      // Check that exactly one "Valid subset" and one "Invalid subset" appear.
      const validMatches = (outputText.match(/Valid subset/g) || []).length;
      const invalidMatches = (outputText.match(/Invalid subset/g) || []).length;
      expect(validMatches).toBe(1, 'Expected exactly one valid subset verification result');
      expect(invalidMatches).toBe(1, 'Expected exactly one invalid subset verification result');

      // Ensure the "Set" and "Target Sum" lines are present (evidence of the demo details)
      expect(outputText).toMatch(/Set: \[3, 34, 4, 12, 5, 2\]/);
      expect(outputText).toMatch(/Target Sum: 9/);

      // No runtime errors during this verification
      expect(pageErrors.length).toBe(0);
    });

    test('Observe console and pageerror events: assert no ReferenceError, TypeError, or SyntaxError occurred', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Run demo to exercise page script
      await demo.clickSolveButton();
      await page.waitForSelector('#demo-output:has-text("This distinction illustrates the core of the P vs NP question.")');

      // Evaluate collected console messages and page errors
      // Assert that there are zero uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Assert console did not emit any critical error types
      const criticalErrors = consoleMessages.filter((m) => {
        return (
          m.type === 'error' ||
          /ReferenceError|TypeError|SyntaxError/.test(m.text)
        );
      });

      expect(criticalErrors.length).toBe(0, `Expected no critical console errors but found: ${JSON.stringify(criticalErrors)}`);
    });
  });
});