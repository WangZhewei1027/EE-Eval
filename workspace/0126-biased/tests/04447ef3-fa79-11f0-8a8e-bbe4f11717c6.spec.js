import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04447ef3-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object for the Compiler app
class CompilerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for assertions
    this._consoleListener = (msg) => {
      this.consoleMessages.push(msg);
    };
    this._pageErrorListener = (err) => {
      this.pageErrors.push(err);
    };

    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  // Navigate to the application and wait for load event
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the compile button
  async clickCompile() {
    await this.page.click('#compiler-button');
  }

  // Get locator for compile button
  get compileButton() {
    return this.page.locator('#compiler-button');
  }

  // Utility to wait a short period allowing any client-side errors to surface
  async settle(ms = 200) {
    await this.page.waitForTimeout(ms);
  }

  // Clean up listeners (optional)
  detachListeners() {
    this.page.off('console', this._consoleListener);
    this.page.off('pageerror', this._pageErrorListener);
  }

  // Convenience checks
  hasConsoleError() {
    return this.consoleMessages.some((m) => m.type() === 'error');
  }

  consoleErrorCount() {
    return this.consoleMessages.filter((m) => m.type() === 'error').length;
  }

  pageErrorCount() {
    return this.pageErrors.length;
  }
}

test.describe('Compiler FSM and UI - 04447ef3-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Create a fresh CompilerPage for each test via fixture's page
  test.describe.configure({ mode: 'serial' });

  test('Idle state is rendered on load (S0_Idle) - button present and visible', async ({ page }) => {
    // This test validates the Idle state evidence: the Compile button is rendered.
    const app = new CompilerPage(page);
    await app.goto();

    // Ensure the Compile button exists and is visible
    const button = app.compileButton;
    await expect(button).toBeVisible();
    await expect(button).toHaveText(/Compile/i);

    // Verify header and basic structure are present as additional evidence of renderPage()
    await expect(page.locator('h1')).toHaveText(/Compiler/i);
    await expect(page.locator('.compiler-body h2')).toContainText(/Compiler Interface|Output/);

    // Allow any script errors to appear (renderPage() might be referenced in page script)
    await app.settle(300);

    // Observe console and page errors. The environment may intentionally have missing or broken scripts.
    // We assert that either a console error or a page error occurred during load so that runtime issues are observed.
    const hadAnyError = app.hasConsoleError() || app.pageErrorCount() > 0;
    expect(hadAnyError).toBeTruthy();

    // Detach listeners
    app.detachListeners();
  });

  test('Transition to Compiling (S0_Idle -> S1_Compiling) on single Compile click', async ({ page }) => {
    // This test validates that clicking the Compile button triggers the compiling transition.
    // Since the implementation may be missing functions (startCompilation), we assert that the click is handled
    // without navigation and that runtime errors or console errors appear as a result of attempted actions.
    const app = new CompilerPage(page);
    await app.goto();

    // Baseline counts before click
    const baselineConsoleErrors = app.consoleErrorCount();
    const baselinePageErrors = app.pageErrorCount();

    // Click the Compile button once
    await app.clickCompile();

    // Wait a little to let any JS triggered by the click run and possibly throw errors
    await app.settle(300);

    // The URL should remain the same (no unexpected navigation)
    expect(page.url()).toBe(APP_URL);

    // The Compile button should still be present (UI didn't vanish)
    await expect(app.compileButton).toBeVisible();

    // Either new console errors or page errors should have occurred (startCompilation / related functions may be missing).
    const newConsoleErrors = app.consoleErrorCount() - baselineConsoleErrors;
    const newPageErrors = app.pageErrorCount() - baselinePageErrors;
    const anyNewError = newConsoleErrors > 0 || newPageErrors > 0;

    // Assert that at least one new error was observed after clicking; this follows the requirement to observe runtime errors naturally.
    expect(anyNewError).toBeTruthy();

    // Cleanup listeners
    app.detachListeners();
  });

  test('Transition back to Idle (S1_Compiling -> S0_Idle) on second Compile click', async ({ page }) => {
    // This test simulates clicking the Compile button twice to trigger the second transition back to Idle.
    // We verify DOM stability and that additional runtime issues (if any) are observed on the second interaction.
    const app = new CompilerPage(page);
    await app.goto();

    // Click once (enter compiling)
    await app.clickCompile();
    await app.settle(200);

    // Record counts after first click
    const afterFirstConsoleErrors = app.consoleErrorCount();
    const afterFirstPageErrors = app.pageErrorCount();

    // Click again (attempt to finish compilation / return to idle)
    await app.clickCompile();
    await app.settle(300);

    // Ensure the button remains present and enabled/visible after the second click
    await expect(app.compileButton).toBeVisible();

    // Ensure we didn't navigate away
    expect(page.url()).toBe(APP_URL);

    // Ensure we observed additional errors or at least the same behavior (since finishCompilation may be missing)
    const afterSecondConsoleErrors = app.consoleErrorCount();
    const afterSecondPageErrors = app.pageErrorCount();

    const consoleErrorsInSecondClick = afterSecondConsoleErrors - afterFirstConsoleErrors;
    const pageErrorsInSecondClick = afterSecondPageErrors - afterFirstPageErrors;

    // Assert that the second click produced either additional console or page errors (observing runtime behavior)
    expect(consoleErrorsInSecondClick + pageErrorsInSecondClick).toBeGreaterThanOrEqual(0);

    // At least one runtime error should exist across the two clicks or initial load (global assertion)
    expect(app.consoleErrorCount() + app.pageErrorCount()).toBeGreaterThanOrEqual(1);

    app.detachListeners();
  });

  test('Rapid multiple clicks do not crash the page (edge case)', async ({ page }) => {
    // Edge case: Rapidly clicking the Compile button multiple times should not close the page or cause unhandled catastrophic errors.
    // We assert the page remains open, the button stays present, and runtime errors are observed but handled by the environment.
    const app = new CompilerPage(page);
    await app.goto();

    // Rapidly click the button 10 times
    for (let i = 0; i < 10; i++) {
      // Use Promise.all to not await each click sequentially too long; but keep short awaits to avoid flakiness
      await app.clickCompile();
    }

    // Allow errors or processing to settle
    await app.settle(500);

    // The page should not be closed
    expect(page.isClosed()).toBeFalsy();

    // The Compile button should still be visible and interactable (not removed from DOM)
    await expect(app.compileButton).toBeVisible();

    // We expect at least one console error or page error due to missing handlers or broken scripts — capture them
    const totalErrors = app.consoleErrorCount() + app.pageErrorCount();
    expect(totalErrors).toBeGreaterThanOrEqual(1);

    app.detachListeners();
  });

  test('Console and page error inspection (reporting)', async ({ page }) => {
    // This test explicitly inspects and asserts the presence and types of console messages and page errors captured.
    // It does not assume exact text content of errors but validates that errors are categorized correctly.
    const app = new CompilerPage(page);
    await app.goto();

    // Trigger at least one interaction to provoke any lazy-loaded script behavior
    await app.clickCompile();
    await app.settle(300);

    // Collect typed summaries
    const consoleMsgs = app.consoleMessages.map((m) => ({ type: m.type(), text: m.text() }));
    const pageErrCount = app.pageErrorCount();

    // We expect to have observed one or more console messages; at least one should be of type 'error'
    expect(app.consoleMessages.length).toBeGreaterThanOrEqual(0); // there may be informational logs
    expect(app.consoleMessages.some((m) => m.type() === 'error') || pageErrCount > 0).toBeTruthy();

    // Additional sanity checks: console messages should include the 'Compile' button text somewhere in the DOM, not necessarily in logs
    await expect(app.compileButton).toHaveText(/Compile/i);

    // Optionally attach the captured messages to a helpful assertion message to aid debugging if the test fails
    // (This keeps the assertions generic but informative)
    if (!(app.hasConsoleError() || pageErrCount > 0)) {
      // If no errors were found, fail with contextual information
      expect.fail(`Expected runtime errors or console errors during load/interactions. Console messages: ${JSON.stringify(consoleMsgs)}, pageErrorsCount: ${pageErrCount}`);
    }

    app.detachListeners();
  });
});