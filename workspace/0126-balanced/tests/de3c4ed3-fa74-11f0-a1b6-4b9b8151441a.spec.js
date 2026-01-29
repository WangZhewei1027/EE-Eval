import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c4ed3-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the Greedy Algorithms Demonstration page
class GreedyAppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.amountInput = page.locator('#amount');
    this.calculateButton = page.locator("button[onclick='calculateCoins()']");
    this.activityButton = page.locator("button[onclick='solveActivitySelection()']");
    this.coinResult = page.locator('#coinResult');
    this.result = page.locator('#result');
    this.activityResult = page.locator('#activityResult');
    this.coinElements = page.locator('#coinResult .coin');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickCalculate() {
    await this.calculateButton.click();
  }

  async clickSolveActivity() {
    await this.activityButton.click();
  }

  async setAmount(value) {
    await this.amountInput.fill(String(value));
  }
}

test.describe('Greedy Algorithms Demonstration - FSM tests', () => {
  // Collect page errors and console messages for assertions
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture runtime errors (pageerror) which include SyntaxError, ReferenceError, etc.
    page.on('pageerror', (err) => {
      // push the Error object for later inspection
      pageErrors.push(err);
    });

    // Capture console messages for additional context
    page.on('console', (msg) => {
      // convert console message to string with location info
      const text = `${msg.type()}: ${msg.text()}`;
      consoleMessages.push(text);
    });
  });

  test.afterEach(async ({ page }) => {
    // Helpful debugging output if a test fails locally; not required by assertions
    // but kept as non-intrusive logs in case tests are reviewed.
    // Do not throw here. Tests will assert specific expectations below.
  });

  test('S0_Idle state: initial render shows inputs and buttons, and script parsing error is reported', async ({ page }) => {
    // Validate initial UI and capture parse-time script errors (e.g., SyntaxError)
    const app = new GreedyAppPage(page);

    // Navigate to the page; any SyntaxError in the inline script should be emitted as a pageerror
    await app.goto();

    // UI elements expected in Idle state
    await expect(app.amountInput).toBeVisible({ timeout: 2000 });
    await expect(app.calculateButton).toBeVisible();
    await expect(app.activityButton).toBeVisible();
    await expect(app.coinResult).toBeVisible();
    await expect(app.result).toBeVisible();
    await expect(app.activityResult).toBeVisible();

    // The input should have the default value from the HTML (67)
    await expect(app.amountInput).toHaveValue('67');

    // Because the provided HTML contains an incomplete JS function (unterminated template literal),
    // we expect a SyntaxError (or similar parsing error) to have occurred during page load.
    // Assert that at least one page error was captured and that it looks like a syntax-related error.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    const hasSyntaxLikeError = pageErrors.some(err => {
      if (!err) return false;
      // err.name is often 'SyntaxError' for parsing problems, check message for common phrases too.
      const nameMatch = err.name && /SyntaxError/i.test(err.name);
      const msg = String(err.message || '');
      const msgMatch = /Unterminated|Unexpected|Unexpected end|EOF|unterminated template/i.test(msg);
      return nameMatch || msgMatch;
    });

    expect(hasSyntaxLikeError).toBeTruthy();

    // Also assert that before any interaction, there are no coin elements or result text present
    await expect(app.coinElements).toHaveCount(0);
    await expect(app.result).toHaveText(''); // result div should be empty since script didn't run
    await expect(app.activityResult).toHaveText('');
  });

  test('Transition: CalculateCoins (S0 -> S1) should attempt to run calculateCoins and produce an error; no state entry effects occur', async ({ page }) => {
    const app1 = new GreedyAppPage(page);

    // Start listening early and navigate
    await app.goto();

    // Record current number of page errors (includes parse-time errors)
    const initialErrorCount = pageErrors.length;

    // Try clicking the Calculate Coins button.
    // Because the page script failed to parse, calculateCoins is expected to be undefined,
    // and clicking the button should raise a ReferenceError caught as a pageerror event.
    await app.clickCalculate();

    // Allow a short time for the error to be emitted and captured
    await page.waitForTimeout(200);

    // Check that a new page error was recorded as a result of the click
    expect(pageErrors.length).toBeGreaterThan(initialErrorCount);

    // The newly added errors should include a ReferenceError naming the missing function
    const newErrors = pageErrors.slice(initialErrorCount);
    const hasReferenceToCalculate = newErrors.some(err => {
      if (!err) return false;
      const msg1 = String(err.message || '');
      return /calculateCoins|is not defined|not defined|ReferenceError/i.test(msg);
    });

    expect(hasReferenceToCalculate).toBeTruthy();

    // Since the function didn't run, the coin result DOM should remain unchanged (no .coin elements)
    await expect(app.coinElements).toHaveCount(0);

    // And the textual result area should not contain the expected "Total coins needed" string
    await expect(app.result).not.toContainText('Total coins needed');
    await expect(app.result).toHaveText('');
  });

  test('Transition: SolveActivitySelection (S0 -> S2) should attempt to run solveActivitySelection and produce an error; no activity results displayed', async ({ page }) => {
    const app2 = new GreedyAppPage(page);

    await app.goto();

    const initialErrorCount1 = pageErrors.length;

    // Click the Solve Activity Selection button; expected to trigger ReferenceError because function is not defined
    await app.clickSolveActivity();

    // Wait a moment for the error to be captured
    await page.waitForTimeout(200);

    expect(pageErrors.length).toBeGreaterThan(initialErrorCount);

    const newErrors1 = pageErrors.slice(initialErrorCount);
    const hasReferenceToSolve = newErrors.some(err => {
      if (!err) return false;
      const msg2 = String(err.message || '');
      return /solveActivitySelection|is not defined|ReferenceError|not defined/i.test(msg);
    });

    expect(hasReferenceToSolve).toBeTruthy();

    // Because the function did not execute, the activityResult div should remain empty
    await expect(app.activityResult).toHaveText('');
  });

  test('Edge cases: Changing the amount and attempting calculation still results in error when script failed to parse', async ({ page }) => {
    const app3 = new GreedyAppPage(page);

    await app.goto();

    const initialErrorCount2 = pageErrors.length;

    // Change amount to an edge value (0) that would be invalid per min=1 in HTML, but script would normally handle
    // Since script isn't available, clicking should still yield a ReferenceError.
    await app.setAmount(0);
    await app.clickCalculate();

    await page.waitForTimeout(200);

    expect(pageErrors.length).toBeGreaterThan(initialErrorCount);

    // Validate that no coins were generated in the DOM
    await expect(app.coinElements).toHaveCount(0);
    await expect(app.result).toHaveText('');
  });

  test('Diagnostics: collected console messages include clues about failures', async ({ page }) => {
    // This test simply ensures that console messages were captured and can be inspected.
    const app4 = new GreedyAppPage(page);
    await app.goto();

    // Wait a short time for console messages to appear
    await page.waitForTimeout(100);

    // There should be at least some console messages (depending on the browser, may be none)
    // The primary assertion is that our capture mechanism works and returns an array.
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // If there are console messages, ensure they are strings and contain a type prefix
    if (consoleMessages.length > 0) {
      for (const msg of consoleMessages) {
        expect(typeof msg).toBe('string');
        expect(msg.length).toBeGreaterThan(0);
      }
    }
  });
});