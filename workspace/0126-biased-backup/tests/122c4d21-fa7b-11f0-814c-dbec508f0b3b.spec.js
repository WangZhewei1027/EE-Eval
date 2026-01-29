import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122c4d21-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the simple app
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.kInput = '#k';
    this.solveButton = '#solve';
    this.result = '#result';
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async getKValue() {
    const el = await this.page.$(this.kInput);
    return el ? (await el.inputValue()) : null;
  }

  async setKValue(value) {
    await this.page.fill(this.kInput, String(value));
    // Blur so potential input handlers run (if any)
    await this.page.locator('body').click();
  }

  async clickSolve() {
    await this.page.click(this.solveButton);
  }

  async getResultText() {
    return this.page.locator(this.result).innerText().catch(() => '');
  }
}

test.describe('Dynamic Programming App - FSM tests (Application ID 122c4d21-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Arrays to capture console and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize capture arrays
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (including errors)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught exceptions from the page (pageerror)
    page.on('pageerror', (err) => {
      // err may be an Error object; capture its message and stack
      pageErrors.push({
        message: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : undefined,
      });
    });

    // Navigate to the page (solve() is invoked on load in the page script)
    await page.goto(BASE_URL);
  });

  test.afterEach(async () => {
    // Nothing to tear down besides clearing captures (done implicitly)
  });

  test('S0_Idle: Initial render - input, button, and onLoad solve() invocation observed', async ({ page }) => {
    // This test validates the initial (Idle) state: presence of input, default value, button,
    // and that the page invoked solve() during load (we check for page errors as evidence of that run).
    const app = new AppPage(page);

    // Verify input exists and has the default value from the HTML (value="3")
    const kValue = await app.getKValue();
    expect(kValue).toBe('3');

    // Verify Solve button exists
    const solveVisible = await page.isVisible('#solve');
    expect(solveVisible).toBe(true);

    // Verify result paragraph exists in the DOM
    const resultExists = await page.$('#result');
    expect(resultExists).not.toBeNull();

    // Because the implementation calls solve() on load and contains logic errors,
    // we expect at least one uncaught page error to have been emitted during the initial run.
    // Assert that we observed at least one pageerror and that it looks like a TypeError (common symptom).
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one captured page error message should mention "TypeError" or "Cannot read"
    const combinedMessages = pageErrors.map(e => e.message).join(' | ');
    expect(
      /TypeError|Cannot read properties|Cannot read property/i.test(combinedMessages)
    ).toBeTruthy();

    // Also assert that the console captured error-level messages (if any)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBeGreaterThanOrEqual(0);

    // The result paragraph may not have been updated successfully due to the runtime error.
    // Ensure we can still read it and it's a string (empty or containing partial output).
    const resultText = await app.getResultText();
    expect(typeof resultText).toBe('string');
  });

  test('Transition SolveClick -> S1_Solved: clicking Solve triggers solve() and emits a page error', async ({ page }) => {
    // This test validates the transition from Idle to Solved caused by clicking the Solve button.
    // The page's solve() has known runtime issues; we assert that clicking triggers at least one pageerror.
    const app = new AppPage(page);

    // Record current number of page errors so we can assert a new one appears after the click
    const beforeErrors = pageErrors.length;

    // Wait for the next pageerror that should be caused by the click; if it doesn't happen within timeout the test will fail.
    const [err] = await Promise.all([
      page.waitForEvent('pageerror', { timeout: 2000 }),
      app.clickSolve(),
    ]).catch(async (e) => {
      // If waitForEvent times out, rethrow a more descriptive error including previous error count and console logs
      const consoleSummary = consoleMessages.slice(-10).map(m => `${m.type}:${m.text}`).join('\n');
      throw new Error(`Expected a pageerror after clicking Solve but none occurred within timeout. Previous pageErrors: ${beforeErrors}. Recent console:\n${consoleSummary}`);
    });

    // We should have received a new error object
    expect(err).toBeTruthy();
    const msg = err && err.message ? err.message : String(err);
    // Validate that it's the kind of runtime error expected from the broken algorithm
    expect(/TypeError|Cannot read properties|Cannot read property/i.test(msg)).toBeTruthy();

    // Confirm that a new entry was appended to our captured pageErrors array
    expect(pageErrors.length).toBeGreaterThan(beforeErrors);

    // Verify that the result element still exists and is a string (the script may not have completed)
    const resultText = await app.getResultText();
    expect(typeof resultText).toBe('string');
  });

  test('Edge case: set k to 1 (lower valid bound) and click Solve - runtime error should still occur', async ({ page }) => {
    // This test changes the input to a boundary-valid value and asserts that solve() still fails
    const app = new AppPage(page);

    // Set k to 1
    await app.setKValue(1);
    const kNow = await app.getKValue();
    expect(kNow).toBe('1');

    // Click solve and wait for a pageerror triggered by the function
    const [err] = await Promise.all([
      page.waitForEvent('pageerror', { timeout: 2000 }),
      app.clickSolve(),
    ]).catch(() => {
      throw new Error('Expected a pageerror after clicking Solve with k=1 but none occurred.');
    });

    expect(err).toBeTruthy();
    expect(/TypeError|Cannot read properties|Cannot read property/i.test(err.message)).toBeTruthy();

    // Check that console captured messages (optional): at least zero items exists; if errors present ensure they are of type error
    const errors = consoleMessages.filter(m => m.type === 'error');
    // It is acceptable if there are no console.error messages (pageerror is the primary signal), but if present they should indicate an error
    if (errors.length > 0) {
      expect(errors.some(e => /TypeError|error/i.test(e.text))).toBe(true);
    }
  });

  test('Edge case: set k to 0 (out-of-bounds) and click Solve - algorithm should still attempt and likely emit a runtime error', async ({ page }) => {
    // This test intentionally uses an out-of-range value for k to exercise error handling / algorithm behavior.
    // The page input allows filling arbitrary values; we assert that calling solve() causes a runtime error we can observe.
    const app = new AppPage(page);

    // Set k to 0 (below min=1 in HTML, but JS will parse whatever we put)
    await app.setKValue(0);
    const kNow = await app.getKValue();
    expect(kNow).toBe('0');

    // Click solve and wait for pageerror (we assert such an error happens)
    const [err] = await Promise.all([
      page.waitForEvent('pageerror', { timeout: 2000 }),
      app.clickSolve(),
    ]).catch(() => {
      throw new Error('Expected a pageerror after clicking Solve with k=0 but none occurred.');
    });

    expect(err).toBeTruthy();
    // Again we expect TypeError or a similar runtime complaint
    expect(/TypeError|Cannot read properties|Cannot read property/i.test(err.message)).toBeTruthy();

    // Ensure the result element can still be accessed
    const resultText = await app.getResultText();
    expect(typeof resultText).toBe('string');
  });
});