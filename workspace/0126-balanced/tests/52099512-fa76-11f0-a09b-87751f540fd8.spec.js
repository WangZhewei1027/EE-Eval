import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52099512-fa76-11f0-a09b-87751f540fd8.html';

// Page object encapsulating interactions with the Divide and Conquer page
class DivideConquerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.divideButton = page.locator('button:has-text("Divide")');
    this.conquerButton = page.locator('button:has-text("Conquer")');
    this.result = page.locator('#result');
    this.header = page.locator('h1');
    this.allButtons = page.locator('button');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickDivide() {
    await this.divideButton.click();
  }

  async clickConquer() {
    await this.conquerButton.click();
  }

  async getResultText() {
    return (await this.result.textContent()) ?? '';
  }
}

test.describe('Divide and Conquer App - FSM and DOM validation', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let pageObject;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleErrors = [];

    // Capture runtime page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      // store the Error object for later assertions
      pageErrors.push(err);
    });

    // Capture console messages, especially errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    pageObject = new DivideConquerPage(page);
    await pageObject.goto();
  });

  test.afterEach(async ({ page }) => {
    // remove listeners to avoid cross-test leakage (best-effort)
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test('Initial Idle state: UI renders with two buttons and empty result', async ({ page }) => {
    // Validate initial UI elements are present as evidence of Idle state (S0_Idle)
    await expect(pageObject.header).toHaveText('Divide and Conquer');
    await expect(pageObject.divideButton).toBeVisible();
    await expect(pageObject.conquerButton).toBeVisible();
    await expect(pageObject.allButtons).toHaveCount(2);
    const resultText = await pageObject.getResultText();
    // Initially, the result div should be empty (S0 evidence)
    expect(resultText.trim()).toBe('');

    // Assert that loading the page did not produce ReferenceError / SyntaxError / TypeError
    const combinedConsole = consoleErrors.join('\n');
    const pageErrorMessages = pageErrors.map(e => String(e));
    expect(combinedConsole).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    for (const err of pageErrorMessages) {
      expect(err).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }
  });

  test('DivideAction (click Divide) transitions to Divided state and updates result', async ({ page }) => {
    // Click the Divide button (event) and assert that result updates (S1_Divided)
    await pageObject.clickDivide();

    // Wait for some non-empty text in result; give a reasonable timeout for computation
    await expect(pageObject.result).not.toHaveText('', { timeout: 2000 });

    const resultText1 = (await pageObject.getResultText()).trim();
    // The implementation attempts to compute a numeric result; assert we got something that looks numeric
    expect(resultText.length).toBeGreaterThan(0);
    expect(resultText).toMatch(/[0-9]/);

    // Also ensure no ReferenceError/SyntaxError/TypeError occurred during this interaction
    const combinedConsole1 = consoleErrors.join('\n');
    const pageErrorMessages1 = pageErrors.map(e => String(e));
    expect(combinedConsole).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    for (const err of pageErrorMessages) {
      expect(err).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }
  });

  test('ConquerAction (click Conquer) triggers same divideAndConquer and updates result', async ({ page }) => {
    // Click the Conquer button (it uses same onclick handler) and assert result updates
    await pageObject.clickConquer();

    // Wait for some non-empty text in result
    await expect(pageObject.result).not.toHaveText('', { timeout: 2000 });

    const resultText2 = (await pageObject.getResultText()).trim();
    expect(resultText.length).toBeGreaterThan(0);
    expect(resultText).toMatch(/[0-9]/);

    // No ReferenceError/SyntaxError/TypeError expected
    const combinedConsole2 = consoleErrors.join('\n');
    const pageErrorMessages2 = pageErrors.map(e => String(e));
    expect(combinedConsole).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    for (const err of pageErrorMessages) {
      expect(err).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }
  });

  test('Repeated DivideAction: clicking Divide from Divided state updates result again (attempt transition to Conquered)', async ({ page }) => {
    // First click to reach S1_Divided
    await pageObject.clickDivide();
    await expect(pageObject.result).not.toHaveText('', { timeout: 2000 });
    const first = (await pageObject.getResultText()).trim();

    // Click Divide again (FSM indicates S1 -> S2 on DivideAction in transitions)
    await pageObject.clickDivide();
    await expect(pageObject.result).not.toHaveText('', { timeout: 2000 });
    const second = (await pageObject.getResultText()).trim();

    // The result should be updated (could be same or different numerically), but should remain non-empty
    expect(second.length).toBeGreaterThan(0);
    expect(second).toMatch(/[0-9]/);

    // Validate that the DOM element result was updated (string equality check may allow same value, but ensure at least update occurred in DOM)
    expect(await pageObject.result.isVisible()).toBe(true);

    // No critical JS errors expected during normal repeated interactions
    const combinedConsole3 = consoleErrors.join('\n');
    const pageErrorMessages3 = pageErrors.map(e => String(e));
    expect(combinedConsole).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    for (const err of pageErrorMessages) {
      expect(err).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }
  });

  test('Edge case: calling recursive helper with empty arrays should produce a stack overflow (error scenario)', async ({ page }) => {
    // This test intentionally calls divideAndConquerDivide with empty arrays to exercise error conditions
    // We expect a RangeError or a "Maximum call stack size exceeded" to be thrown due to infinite recursion.
    // Use page.evaluate and assert that the call rejects with an error.
    const evalCall = page.evaluate(() => {
      // Intentionally call the internal recursive function with inputs that cause infinite recursion
      // This will let the runtime naturally throw (do not patch or modify functions)
      return divideAndConquerDivide([], []);
    });

    // The evaluate should reject due to a maximum call stack error (RangeError)
    await expect(evalCall).rejects.toThrow(/Maximum call stack|RangeError/);

    // Also verify that the page emitted an unhandled pageerror (the runtime error)
    // There may be a delay before the pageerror listener captures the error; give a small wait
    await page.waitForTimeout(100); // allow event propagation
    const foundStackError = pageErrors.some(err => String(err).match(/Maximum call stack|RangeError/));
    expect(foundStackError).toBe(true);
  });

  test('Sanity: no unexpected console errors on normal load and interactions', async ({ page }) => {
    // Perform a typical user flow: click Divide, then Conquer, and ensure no console 'error' messages were emitted
    await pageObject.clickDivide();
    await expect(pageObject.result).not.toHaveText('', { timeout: 2000 });

    await pageObject.clickConquer();
    await expect(pageObject.result).not.toHaveText('', { timeout: 2000 });

    // Assert console error messages collected do not include ReferenceError/SyntaxError/TypeError
    const combinedConsole4 = consoleErrors.join('\n');
    expect(combinedConsole).not.toMatch(/ReferenceError|SyntaxError|TypeError/);

    // Also ensure pageErrors do not include those error types (they may include RangeError from explicit test above only)
    for (const err of pageErrors) {
      expect(String(err)).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }
  });

  // Additional meta test: ensure expected DOM evidence elements exist as described in the FSM components
  test('FSM evidence elements present in DOM: two buttons with onclick and result div', async ({ page }) => {
    // Ensure both buttons have onclick attribute that references divideAndConquer()
    const buttons = await page.$$eval('button', (els) => els.map(b => ({ text: b.textContent?.trim(), onclick: b.getAttribute('onclick') })));
    // There should be two buttons and both should have the onclick attribute set to call divideAndConquer()
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const btn of buttons) {
      // The FSM evidence expects onclick="divideAndConquer()"
      expect(btn.onclick).toBe('divideAndConquer()');
      expect(['Divide', 'Conquer']).toContain(btn.text);
    }

    // Ensure result div exists
    const resultExists = await page.$('#result');
    expect(resultExists).not.toBeNull();
  });
});