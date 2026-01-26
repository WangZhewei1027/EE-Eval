import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b405f2-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page object for the Random Forest demo page.
 * Captures console messages and page errors for assertions.
 */
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages (logs, errors, warnings, etc.)
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught exceptions and other page errors
    this.page.on('pageerror', (err) => {
      // err is an Error object
      this.pageErrors.push({
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
    });
  }

  // Load the application URL and wait for basic load state
  async load() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Small wait to allow any synchronous script parsing errors to surface
    await this.page.waitForTimeout(100);
  }

  // Click the demonstration button if present
  async clickDemonstrationButton() {
    await this.page.click('#demonstration-button');
    // Allow any async handlers to run or errors to be emitted
    await this.page.waitForTimeout(100);
  }

  // Helpers to inspect captured logs/errors
  getConsoleTexts() {
    return this.consoleMessages.map((m) => `[${m.type}] ${m.text}`);
  }

  getPageErrorMessages() {
    return this.pageErrors.map((e) => `${e.name}: ${e.message}`);
  }

  // Returns true if any captured console or page errors match common JS error patterns
  hasExpectedScriptingError() {
    const combined = [
      ...this.getConsoleTexts(),
      ...this.getPageErrorMessages(),
    ].join('\n').toLowerCase();

    // Look for typical JavaScript error names/messages that we expect to happen naturally
    return /syntaxerror|referenceerror|typeerror|uncaught|unexpected token|unexpected string|randomforestclassifier|x_train|accuracy:/.test(
      combined
    );
  }
}

/**
 * Tests for the Random Forest interactive application.
 *
 * The FSM indicates two states:
 * - S0_Idle (initial) where the page is rendered and a "Démonstrateur Random Forest" button exists.
 * - S1_DemonstrationStarted when the demonstration button is clicked and model creation/training/prediction/evaluation happen.
 *
 * The implementation contains scripting issues (undefined RandomForestClassifier, undefined X_train/X_test/y_train,
 * and an invalid Python-style f-string used inside console.log). Per instructions we do NOT patch the page;
 * instead we observe the page behavior and assert that expected errors occur naturally.
 */
test.describe('Random Forest Demo (FSM validation)', () => {
  // Basic smoke test: page loads and Idle state is rendered
  test('S0_Idle: Page loads and demonstration button is present; capture load-time scripting errors', async ({ page }) => {
    const app = new AppPage(page);

    // Load the page (renderPage() should be invoked implicitly by the HTML)
    await app.load();

    // Validate UI evidence for S0_Idle: the demonstration button is present and visible
    const demoButton = page.locator('#demonstration-button');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Démonstrateur Random Forest');

    // The HTML/JS includes broken script constructs; ensure that errors are observed on load.
    // We assert that at least one of the expected JS error types occurred (SyntaxError, ReferenceError, TypeError, etc).
    // This validates that we did not patch or hide runtime errors and that the environment exposes them.
    const pageErrors = app.getPageErrorMessages();
    const consoleTexts = app.getConsoleTexts();

    // At least one error/console message should indicate a scripting problem.
    const hasScriptingError = app.hasExpectedScriptingError();

    // Provide helpful diagnostics in assertion messages if the expected errors are not found.
    expect(hasScriptingError, `Expected scripting error (SyntaxError/ReferenceError/TypeError) on load.
Console messages: ${JSON.stringify(consoleTexts, null, 2)}
Page errors: ${JSON.stringify(pageErrors, null, 2)}
`).toBeTruthy();
  });

  // Test the declared transition: clicking the button should start demonstration (S1) — we assert outcome and errors.
  test('Transition DemonstrationStart: clicking the demonstration button triggers handlers and leads to scripting errors (observed naturally)', async ({ page }) => {
    const app = new AppPage(page);

    // Load the page
    await app.load();

    // Record existing errors before click
    const initialConsole = app.getConsoleTexts();
    const initialPageErrors = app.getPageErrorMessages();

    // Attempt the event defined in the FSM: click #demonstration-button
    // If the script failed to parse, the click handler may not be attached; the click should still be allowed and we observe no patched behavior.
    await app.clickDemonstrationButton();

    // Capture new messages after click
    const afterConsole = app.getConsoleTexts();
    const afterPageErrors = app.getPageErrorMessages();

    // If click caused additional errors, they would be reflected in afterPageErrors/console.
    // We assert that across load+click we observe at least one of the expected error types (SyntaxError/ReferenceError/TypeError).
    const hasScriptingError = app.hasExpectedScriptingError();
    expect(hasScriptingError, `Expected scripting error during/after click.
Before click console: ${JSON.stringify(initialConsole, null, 2)}
After click console: ${JSON.stringify(afterConsole, null, 2)}
Before click page errors: ${JSON.stringify(initialPageErrors, null, 2)}
After click page errors: ${JSON.stringify(afterPageErrors, null, 2)}
`).toBeTruthy();

    // Verify that the demo button still exists in the DOM after the attempted transition.
    await expect(page.locator('#demonstration-button')).toBeVisible();

    // The FSM expected observables include "Random Forest model trained", "Predictions made", "Model evaluated".
    // Because the implementation contains undefined variables and invalid syntax, we should NOT see a console line
    // indicating a successful "Accuracy: ..." message. Assert that no such success message was printed.
    const combinedConsole = afterConsole.join('\n').toLowerCase();
    expect(combinedConsole).not.toContain('accuracy:');

    // Edge-case: clicking multiple times should not produce a successful evaluation output either.
    await app.clickDemonstrationButton();
    const afterSecondClickConsole = app.getConsoleTexts().join('\n').toLowerCase();
    expect(afterSecondClickConsole).not.toContain('accuracy:');
  });

  // Edge case tests focusing on error types and stability
  test('Edge cases: multiple rapid clicks and verifying stable DOM and error types', async ({ page }) => {
    const app = new AppPage(page);
    await app.load();

    // Rapidly click the button multiple times to exercise potential event handlers (if attached)
    const demoLocator = page.locator('#demonstration-button');
    await expect(demoLocator).toBeVisible();

    // Perform several clicks in rapid succession
    for (let i = 0; i < 5; i++) {
      // Use try/catch to ensure clicks don't cause the test process to throw; we still rely on captured page errors.
      try {
        await demoLocator.click({ timeout: 500 });
      } catch (e) {
        // If click throws because the element becomes detached, that's a DOM stability issue — capture it as part of test diagnostics.
      }
    }

    // Allow time for any asynchronous errors to appear
    await page.waitForTimeout(200);

    // Assert DOM stability: button still present
    await expect(demoLocator).toBeVisible();

    // Confirm that the observed errors include at least one of the expected scripting error classes.
    expect(app.hasExpectedScriptingError(), 'Expected at least one scripting error to be present after rapid clicks').toBeTruthy();

    // Also assert that no successful "model trained" or "predictions made" textual indicators are present in the DOM,
    // since the script is broken and cannot produce such outputs.
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.toLowerCase()).not.toContain('random forest model trained');
    expect(bodyText.toLowerCase()).not.toContain('predictions made');
    expect(bodyText.toLowerCase()).not.toContain('model evaluated');
  });

  // Verify that script errors are visible to console/pageerror events (observability test)
  test('Observability: console and pageerror events report the scripting issues (no silent failures)', async ({ page }) => {
    const app = new AppPage(page);
    await app.load();

    // Both console and pageerror should have captured diagnostics or at least one of them should.
    const consoleCaptured = app.getConsoleTexts().length > 0;
    const pageErrorsCaptured = app.getPageErrorMessages().length > 0;

    // We expect at least one mechanism to report the problem.
    expect(consoleCaptured || pageErrorsCaptured, `Expected console or pageerror events to capture scripting problems.
Console: ${JSON.stringify(app.getConsoleTexts(), null, 2)}
PageErrors: ${JSON.stringify(app.getPageErrorMessages(), null, 2)}
`).toBeTruthy();

    // And assert that the captured messages contain error semantics (SyntaxError/ReferenceError/TypeError)
    expect(app.hasExpectedScriptingError(), 'Captured diagnostics should reference SyntaxError/ReferenceError/TypeError or similar').toBeTruthy();
  });
});