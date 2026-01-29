import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d59fb3a0-fa7b-11f0-8b-01-9f078a0ff214.html';

// Page Object Model for the Understanding Arrays page
class ArraysPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('button[onclick="demonstrateArray()"]');
    this.heading = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    return await this.button.textContent();
  }

  async getButtonOnclickAttribute() {
    return await this.button.getAttribute('onclick');
  }

  async clickDemonstrate() {
    // Use waitForEvent to capture the dialog that the click triggers
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.button.click()
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  async clickDemonstrateNoDialogCapture() {
    // Click without capturing dialog (used to ensure multiple clicks still produce dialogs which we handle separately)
    await this.button.click();
  }

  async headingText() {
    return await this.heading.textContent();
  }

  async isButtonVisible() {
    return await this.button.isVisible();
  }

  async demonstrateFunctionType() {
    return await this.page.evaluate(() => typeof window.demonstrateArray);
  }
}

test.describe('Understanding Arrays - FSM validation and UI tests', () => {
  // Arrays to collect page errors and console error messages during each test
  let pageErrors = [];
  let consoleErrors = [];

  // Register listeners before each test to capture any runtime errors emitted during page load/interaction
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture page-level unhandled exceptions (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (error) => {
      // store the actual Error object for later assertions
      pageErrors.push(error);
    });

    // Capture console error messages (console.error)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the page after listeners are installed so we capture load-time errors
    await page.goto(APP_URL);
  });

  // No special teardown required, Playwright fixture handles closing pages.

  test.describe('Idle State (S0_Idle) validations', () => {
    test('Idle state: page renders and demonstrates the expected static content and button', async ({ page }) => {
      // This test validates the S0_Idle state: initial rendering, presence of the demonstrate button and basic DOM content.
      const arraysPage = new ArraysPage(page);

      // Verify main heading is present and has expected text
      const heading = await arraysPage.headingText();
      expect(heading).toBeTruthy();
      expect(heading.trim()).toContain('Understanding Arrays');

      // Verify the demonstrate button exists, is visible, and has the expected text and onclick attribute
      expect(await arraysPage.isButtonVisible()).toBe(true);
      const btnText = await arraysPage.getButtonText();
      expect(btnText.trim()).toBe('Click to Demonstrate Array');

      const onclickAttr = await arraysPage.getButtonOnclickAttribute();
      // The implementation uses onclick="demonstrateArray()"
      expect(onclickAttr).toBe('demonstrateArray()');

      // Verify that the demonstrateArray function is defined on the window (S0 should lead to having this handler available)
      const funcType = await arraysPage.demonstrateFunctionType();
      expect(funcType).toBe('function');

      // Ensure there were no page runtime errors during initial render
      const errorNames = pageErrors.map(e => e.name);
      const hasCriticalErrors = errorNames.some(n => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(n));
      expect(hasCriticalErrors).toBe(false);

      // Ensure console did not emit error-level messages during load
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge: verify renderPage() presence/absence does not throw a ReferenceError on load', async ({ page }) => {
      // The FSM mentions an entry action renderPage(), but the implementation does not call it.
      // This test checks that no ReferenceError related to renderPage() occurred on page load.
      // We do NOT call renderPage() ourselves; we only inspect captured errors (we must not inject or fix the page).
      const renderPageErrors = pageErrors.filter(err => /renderPage/.test(err.message || ''));
      // Expect zero errors mentioning renderPage (meaning the page did not attempt to call a missing renderPage)
      expect(renderPageErrors.length).toBe(0);

      // Also verify there are no ReferenceError/SyntaxError/TypeError in general
      const names = pageErrors.map(e => e.name);
      expect(names).not.toContain('ReferenceError');
      expect(names).not.toContain('SyntaxError');
      expect(names).not.toContain('TypeError');
    });
  });

  test.describe('Transition: ClickToDemonstrateArray -> Array Demonstration (S1_ArrayDemonstration)', () => {
    test('Clicking the button triggers an alert dialog with the expected message (transition observable)', async ({ page }) => {
      // This test validates the transition from S0_Idle to S1_ArrayDemonstration via the ClickToDemonstrateArray event.
      const arraysPage = new ArraysPage(page);

      // Click the button and capture the dialog
      const dialogMessage = await arraysPage.clickDemonstrate();

      // Validate the alert message content matches FSM evidence
      expect(dialogMessage).toBe("Array demonstration: Arrays can hold multiple items of the same type. Try accessing elements using their indices!");

      // Ensure that no runtime page errors were emitted as a result of the click
      const errorNames = pageErrors.map(e => e.name);
      const hasCriticalErrors = errorNames.some(n => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(n));
      expect(hasCriticalErrors).toBe(false);

      // Ensure console did not emit error-level messages during the transition
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking the button multiple times still produces an alert each time and keeps DOM stable', async ({ page }) => {
      // Edge case: rapid or repeated clicks should consistently produce dialogs and should not break the page.
      const arraysPage = new ArraysPage(page);

      const messages = [];
      // Click 3 times and capture dialogs sequentially
      for (let i = 0; i < 3; i++) {
        const [dialog] = await Promise.all([
          page.waitForEvent('dialog'),
          arraysPage.button.click()
        ]);
        messages.push(dialog.message());
        await dialog.accept();
      }

      // All captured messages should match expected text
      for (const msg of messages) {
        expect(msg).toBe("Array demonstration: Arrays can hold multiple items of the same type. Try accessing elements using their indices!");
      }

      // After multiple dialogs, the DOM elements should remain present and unchanged
      expect(await arraysPage.isButtonVisible()).toBe(true);
      const headingText = await arraysPage.headingText();
      expect(headingText).toContain('Understanding Arrays');

      // Verify no critical runtime errors occurred during repeated interactions
      const names = pageErrors.map(e => e.name);
      expect(names).not.toContain('ReferenceError');
      expect(names).not.toContain('SyntaxError');
      expect(names).not.toContain('TypeError');

      // Also ensure no console.error messages were emitted
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and diagnostics', () => {
    test('Collect and assert on any unexpected page errors or console errors', async ({ page }) => {
      // This test intentionally inspects the recorded errors and fails if critical JS errors occurred.
      // It does not inject or call missing functions; it purely inspects what the page emitted naturally.
      // Useful to catch runtime regressions (ReferenceError, SyntaxError, TypeError).

      // Basic smoke check: page loaded content we expect
      const arraysPage = new ArraysPage(page);
      expect(await arraysPage.headingText()).toContain('Understanding Arrays');
      expect(await arraysPage.getButtonText()).toContain('Click to Demonstrate Array');

      // If any page errors occurred, surface them in test output and fail the test.
      if (pageErrors.length > 0) {
        // Build a concise debug string for assertions
        const debug = pageErrors.map(e => `${e.name}: ${e.message}`).join(' | ');
        // Fail the test with collected error details
        expect(pageErrors.length, `Unexpected page errors: ${debug}`).toBe(0);
      }

      // If any console error messages were emitted, fail and include them
      if (consoleErrors.length > 0) {
        const debugConsole = consoleErrors.join(' | ');
        expect(consoleErrors.length, `Unexpected console.error messages: ${debugConsole}`).toBe(0);
      }

      // Final explicit asserts that critical JS error types are not present
      const names = pageErrors.map(e => e.name);
      expect(names).not.toContain('ReferenceError');
      expect(names).not.toContain('SyntaxError');
      expect(names).not.toContain('TypeError');
    });

    test('Intentional negative check: ensure we do not inject or call missing functions (we do not call renderPage)', async ({ page }) => {
      // This test documents the intent: we must not call or patch missing functions.
      // We ensure no ReferenceError mentioning renderPage was emitted by the page itself.
      const renderPageErrors = pageErrors.filter(err => /renderPage/.test(err.message || ''));
      expect(renderPageErrors.length).toBe(0);
    });
  });
});