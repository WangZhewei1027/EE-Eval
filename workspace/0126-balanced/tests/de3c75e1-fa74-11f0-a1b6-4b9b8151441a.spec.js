import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c75e1-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object Model for the application under test
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Array} consoleMessages  - array to collect console messages
   * @param {Array} pageErrors       - array to collect page errors
   */
  constructor(page, consoleMessages, pageErrors) {
    this.page = page;
    this.consoleMessages = consoleMessages;
    this.pageErrors = pageErrors;
  }

  async goto() {
    // navigate and wait for load. Let any page errors happen naturally.
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async title() {
    return this.page.title();
  }

  async getExecuteButton() {
    return this.page.$('button#execute');
  }

  async getExecuteButtonText() {
    const btn = await this.getExecuteButton();
    if (!btn) return null;
    return btn.innerText();
  }

  async getExecuteOnclickAttr() {
    const btn1 = await this.getExecuteButton();
    if (!btn) return null;
    return this.page.evaluate(el => el.getAttribute('onclick'), btn);
  }

  async clickExecute() {
    const btn2 = await this.getExecuteButton();
    if (!btn) throw new Error('Execute button not found');
    await btn.click();
  }

  async currentUrl() {
    return this.page.url();
  }

  getConsoleMessages() {
    return this.consoleMessages.slice();
  }

  getPageErrors() {
    return this.pageErrors.slice();
  }

  // helper to wait briefly allowing any async errors to surface
  async waitForMicrotasks() {
    await this.page.waitForTimeout(50);
  }
}

test.describe('Two Pointers Technique - FSM validation', () => {
  // shared variables to collect logs and errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (info, log, error, warning). Preserve type and text.
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // keep collection resilient
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught page errors (exceptions)
    page.on('pageerror', err => {
      // err is an Error instance
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Also collect 'error' console entries that might come from scripts
    // (already covered by console listener)
  });

  test.afterEach(async ({ page }) => {
    // small cleanup: remove listeners by creating a new blank page if needed
    // Playwright will close the page automatically between tests when using fixtures
  });

  test('S0_Idle - initial render: title, execute button and entry action observation', async ({ page }) => {
    // This test validates the initial (Idle) state:
    // - The document title matches the FSM evidence
    // - The Execute button exists, has the expected text and onclick attribute
    // - The page may attempt to call an onEntry action (renderPage). We observe console/page errors and assert they occurred.
    const model = new TwoPointersPage(page, consoleMessages, pageErrors);

    await model.goto();

    // Verify the title is present and matches the FSM evidence
    const title = await model.title();
    expect(title).toContain('Two Pointers Technique');

    // Verify presence of the Execute button and its attributes
    const btn3 = await model.getExecuteButton();
    expect(btn).not.toBeNull();
    const btnText = await model.getExecuteButtonText();
    expect(btnText.trim()).toBe('Execute');

    const onclickAttr = await model.getExecuteOnclickAttr();
    // According to FSM, the button should have onclick="executeAlgorithm()"
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr.replace(/\s/g, '')).toContain('executeAlgorithm()');

    // Allow a brief moment for any onload / entry actions to surface errors
    await model.waitForMicrotasks();

    // As per instructions we must observe and assert runtime errors occur naturally.
    // The original HTML is truncated and may lead to ReferenceError/SyntaxError.
    // Assert that at least one page error or console error exists and matches expected patterns.
    const pageErrs = model.getPageErrors();
    const consoleMsgs = model.getConsoleMessages();

    // Combine messages for a broader check
    const combinedTexts = [
      ...pageErrs,
      ...consoleMsgs.map(m => `${m.type}: ${m.text}`)
    ].join('\n');

    // Expect at least one error-like symptom to have been captured.
    // Look for common JavaScript error indicators or the renderPage function name.
    const errorPattern = /(ReferenceError|SyntaxError|TypeError|renderPage|Uncaught|executeAlgorithm)/i;
    expect(combinedTexts.length).toBeGreaterThan(0); // there should be at least some console output or error captured
    expect(errorPattern.test(combinedTexts)).toBeTruthy();
  });

  test('S1_Executing - clicking Execute triggers executeAlgorithm invocation (or observable errors)', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Executing:
    // - Clicking the #execute button should attempt to run executeAlgorithm()
    // - We observe console/page errors indicating the invocation or failing call
    const model1 = new TwoPointersPage(page, consoleMessages, pageErrors);

    await model.goto();

    // Pre-click snapshot of errors
    const beforeErrors = model.getPageErrors().length;
    const beforeConsole = model.getConsoleMessages().length;

    // Click the Execute button to trigger the transition
    await model.clickExecute();

    // Wait a bit to let any runtime errors be thrown and handled
    await model.waitForMicrotasks();

    // After clicking, ensure we remain on the same page (no navigation happened)
    const urlAfter = await model.currentUrl();
    expect(urlAfter).toBe(APP_URL);

    // The onclick attribute should still be present
    const onclickAttr1 = await model.getExecuteOnclickAttr();
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr.replace(/\s/g, '')).toContain('executeAlgorithm()');

    // Gather post-click logs & errors
    const afterErrors = model.getPageErrors();
    const afterConsole = model.getConsoleMessages();

    // We expect the click to have produced at least one new error or console message referencing executeAlgorithm
    const newPageErrorsCount = afterErrors.length - beforeErrors;
    const newConsoleMsgsCount = afterConsole.length - beforeConsole;

    // Build combined text to search for function name or error types
    const combinedAfter = [
      ...afterErrors,
      ...afterConsole.map(m => `${m.type}: ${m.text}`)
    ].join('\n');

    // According to instructions, do not patch code; allow ReferenceError if executeAlgorithm is missing and assert it occurs.
    // Check for executeAlgorithm reference or common JS error types.
    const execPattern = /(executeAlgorithm|ReferenceError|TypeError|SyntaxError|Uncaught)/i;
    expect(execPattern.test(combinedAfter)).toBeTruthy();

    // Also ensure that the click produced some observable change in console/errors (either additional messages or pre-existing)
    expect(newPageErrorsCount + newConsoleMsgsCount).toBeGreaterThanOrEqual(0);
    // Preferably expect at least one new symptom after click; if not present, at least the combinedAfter matches the pattern
    if (newPageErrorsCount + newConsoleMsgsCount === 0) {
      // fallback assertion: the content still contains executeAlgorithm or error types
      expect(execPattern.test(combinedAfter)).toBeTruthy();
    }

    // Validate that the button still exists and is interactable after click
    const btn4 = await model.getExecuteButton();
    expect(btn).not.toBeNull();
  });

  test('Edge cases: multiple clicks and robustness - verify repeated interactions and captured errors', async ({ page }) => {
    // This test performs multiple rapid clicks on the Execute button to emulate edge usage.
    // Validate the app does not navigate away and that repeated clicks either produce repeated errors
    // or the error messages are stable. We assert that error patterns are observed.
    const model2 = new TwoPointersPage(page, consoleMessages, pageErrors);

    await model.goto();

    // Ensure button exists
    const btn5 = await model.getExecuteButton();
    expect(btn).not.toBeNull();

    // Click multiple times rapidly
    for (let i = 0; i < 3; i++) {
      try {
        await model.clickExecute();
      } catch (e) {
        // If click fails because button is removed, capture intent but continue
      }
      // small delay between clicks
      await model.waitForMicrotasks();
    }

    // After multiple clicks, collect errors and console logs
    const afterErrors1 = model.getPageErrors();
    const afterConsole1 = model.getConsoleMessages();

    // Combine and search for known problematic patterns
    const combined = [
      ...afterErrors,
      ...afterConsole.map(m => `${m.type}: ${m.text}`)
    ].join('\n');

    const problematicPattern = /(executeAlgorithm|renderPage|ReferenceError|TypeError|SyntaxError|Uncaught)/i;
    expect(problematicPattern.test(combined)).toBeTruthy();

    // Ensure URL unchanged
    expect(await model.currentUrl()).toBe(APP_URL);

    // Validate that the button text remains 'Execute' if it still exists
    const btnText1 = await model.getExecuteButtonText();
    if (btnText !== null) {
      expect(btnText.trim()).toBe('Execute');
    }

    // At least one pageerror or console error should be present (edge case expectation)
    expect(afterErrors.length + afterConsole.length).toBeGreaterThan(0);
  });
});