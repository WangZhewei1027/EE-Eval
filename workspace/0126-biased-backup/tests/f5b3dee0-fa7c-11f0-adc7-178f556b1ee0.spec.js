import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b3dee0-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page Object for the Linear Regression example page.
 * Encapsulates common interactions and queries.
 */
class LinearRegressionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demonstration-button');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickDemonstration() {
    await this.button.click();
  }

  async getButtonText() {
    return await this.button.textContent();
  }

  async hasExamplePreText(substring) {
    const pres = this.page.locator('pre');
    const count = await pres.count();
    for (let i = 0; i < count; i++) {
      const text = await pres.nth(i).textContent();
      if (text && text.includes(substring)) return true;
    }
    return false;
  }

  async isElementPresent(selector) {
    return await this.page.locator(selector).count() > 0;
  }
}

test.describe('Linear Regression FSM - Idle and Demonstration Tests', () => {
  // Arrays to capture runtime errors and console messages for each test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture unhandled exceptions thrown on the page
    page.on('pageerror', (err) => {
      // store the Error object for assertions
      pageErrors.push(err);
    });

    // Capture console messages (info, log, warn, error, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test('Idle state: page loads and Idle evidence is present (button and explanatory text)', async ({ page }) => {
    // Validate S0_Idle: the page renders and shows the demonstration button and textual description.
    const lr = new LinearRegressionPage(page);
    await lr.goto();

    // The "Démonstration" button should be present and visible.
    await expect(lr.button).toBeVisible();
    const buttonText = (await lr.getButtonText()).trim();
    expect(buttonText).toBe('Démonstration');

    // Check that the textual explanation and examples are present (FSM evidence for Idle).
    // There are several <pre> blocks; ensure the page contains the OLS formulas and example output.
    const hasFormula = await lr.hasExamplePreText('m = (Σ[(xi - x̄)(yi - ȳ)] / Σ(xi - x̄)^2)');
    expect(hasFormula).toBe(true);

    const hasExampleResult = await lr.hasExamplePreText('m = 2.0');
    expect(hasExampleResult).toBe(true);

    // On page load (Idle), there should be no unhandled runtime errors yet.
    expect(pageErrors.length).toBe(0);

    // Verify onEnter action functions mentioned in the FSM are not present on the page.
    // FSM mentioned renderPage() for S0; the implementation does not define it.
    const functionsExist = await page.evaluate(() => {
      return {
        renderPage: typeof window.renderPage,
        calculateRegression: typeof window.calculateRegression,
        generateRandomData: typeof window.generateRandomData,
        calculateSlopeAndIntercept: typeof window.calculateSlopeAndIntercept,
      };
    });
    // We expect these to be 'undefined' because the page implementation does not provide them.
    expect(functionsExist.renderPage).toBe('undefined');
    expect(functionsExist.calculateRegression).toBe('undefined');
    expect(functionsExist.generateRandomData).toBe('undefined');
    expect(functionsExist.calculateSlopeAndIntercept).toBe('undefined');
  });

  test('Transition: clicking the Demonstration button should attempt calculation and produce runtime errors (Demonstrating state)', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_Demonstrating by clicking the button.
    // It observes console output and page errors and asserts that the flawed implementation
    // produces unhandled exceptions (as expected given the inline JS bugs).
    const lr = new LinearRegressionPage(page);
    await lr.goto();

    // Ensure starting state has no errors
    expect(pageErrors.length).toBe(0);

    // Click the demonstration button and wait for a pageerror to be emitted.
    // We explicitly wait for the pageerror event because the page's click handler is known to throw.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      lr.clickDemonstration(),
    ]);

    // We expect an Error (ReferenceError or TypeError) was thrown during the click handler.
    expect(error).toBeTruthy();
    // The message should indicate something undefined or index not defined due to the buggy reduce usage.
    const msg = error.message || String(error);
    // Accept several possible error message patterns that indicate the calculation failed.
    expect(msg).toMatch(/index is not defined|ReferenceError|TypeError|is not defined/);

    // Also assert that console logs do not contain successful calculation outputs like "Slope (m):"
    // (In the correct implementation we'd expect such logs, but this buggy implementation throws before logging).
    const slopeLogs = consoleMessages.filter(m => m.text.includes('Slope (m):'));
    expect(slopeLogs.length).toBe(0);

    // The page should not have any DOM elements that display computed slope or intercept (since none are created).
    // We check for common ids/classes that might be used; none should exist.
    const hasSlopeElement = await lr.isElementPresent('#slope');
    const hasInterceptElement = await lr.isElementPresent('#intercept');
    expect(hasSlopeElement).toBe(false);
    expect(hasInterceptElement).toBe(false);
  });

  test('Edge case: repeated clicks emit multiple errors and do not produce valid outputs', async ({ page }) => {
    // Validate robustness: clicking the button repeatedly should continue to result in errors
    // and should not silently recover to produce valid regression outputs.
    const lr = new LinearRegressionPage(page);
    await lr.goto();

    // First click
    const err1Promise = page.waitForEvent('pageerror');
    await lr.clickDemonstration();
    const err1 = await err1Promise;
    expect(err1).toBeTruthy();
    expect(String(err1.message || err1)).toMatch(/index is not defined|ReferenceError|TypeError|is not defined/);

    // Capture console output snapshot after first click
    const logsAfterFirst = consoleMessages.map(m => `${m.type}:${m.text}`);

    // Second click - ensure another pageerror happens
    const err2Promise = page.waitForEvent('pageerror');
    await lr.clickDemonstration();
    const err2 = await err2Promise;
    expect(err2).toBeTruthy();
    expect(String(err2.message || err2)).toMatch(/index is not defined|ReferenceError|TypeError|is not defined/);

    // The errors should be independent and present for each click (counts >= 2)
    expect(pageErrors.length).toBeGreaterThanOrEqual(2);

    // Ensure still no successful calculation logs (defensive check)
    const successLogs = consoleMessages.filter(m => /Slope\s*\(m\)|Y-intercept|Linear Regression Line/.test(m.text));
    expect(successLogs.length).toBe(0);

    // Verify that repeated clicks did not unexpectedly modify the DOM to include results
    const resultElements = await page.$$('text=Slope (m):');
    expect(resultElements.length).toBe(0);
  });

  test('Error inspection: ensure the specific bug pattern exists in the page script (undefined index usage)', async ({ page }) => {
    // This test scans the inline script content to assert the presence of the buggy reduce usage
    // referenced by the FSM transition. We do not modify the page, only read the script text.
    await page.goto(APP_URL);

    // Gather all inline script tags and their text
    const scripts = await page.evaluate(() => {
      return Array.from(document.scripts).map(s => s.textContent || '');
    });

    // There should be at least one script containing a reduce call that references "index" without definition.
    const buggyPatternFound = scripts.some(text => /reduce\(\(acc,\s*curr,\s*index\)\s*=>/.test(text) && /x\[index - 1\]/.test(text));
    expect(buggyPatternFound).toBe(true);

    // The buggy script also attempts to use variables like b and index inside a reduce for b calculation.
    const buggyBPattern = scripts.some(text => /y\.reduce\(\(acc,\s*curr\)\s*=>/.test(text) && /\(m \* x\[index - 1\] \+ b\)/.test(text));
    expect(buggyBPattern).toBe(true);
  });
});