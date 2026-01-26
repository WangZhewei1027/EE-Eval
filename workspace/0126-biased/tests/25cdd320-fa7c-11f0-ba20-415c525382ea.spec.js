import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cdd320-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.demo = page.locator('#demo');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickDemo() {
    await this.button.click();
  }

  async getDemoText() {
    // returns the .textContent of the demo div
    return (await this.demo.textContent()) || '';
  }

  async waitForDemoContains(substring, timeout = 2000) {
    await expect(this.demo).toContainText(substring, { timeout });
  }
}

test.describe('Linear Regression Interactive Demo (FSM: Idle -> DemoDisplayed)', () => {
  // arrays to collect console messages & page errors
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // capture console events
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Defensive: if msg.type() throws, still push minimal record
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // capture uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // navigate to the page under test
    const demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test.afterEach(async () => {
    // Nothing to teardown besides letting Playwright close the page
    // Tests themselves will assert on consoleMessages and pageErrors as needed
  });

  test('S0 Idle: initial render shows button and empty demo region (entry: renderPage())', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Validate the demo button exists and has the expected text
    await expect(demoPage.button).toBeVisible();
    await expect(demoPage.button).toHaveText('Show Simple Linear Regression Prediction Demo');

    // Validate the demo region exists and is initially empty (Idle state)
    const initialText = await demoPage.getDemoText();
    // Trim to be robust to whitespace; expected evidence shows demo is empty initially
    expect(initialText.trim()).toBe('', 'Expected demo region to be empty in the Idle state (S0_Idle)');

    // Validate ARIA attribute (component evidence)
    await expect(demoPage.demo).toHaveAttribute('aria-live', 'polite');

    // Assert no uncaught page errors or console.error messages occurred during initial render
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length, `Expected no console.error messages on initial render, got ${JSON.stringify(errorConsoleMessages)}`).toBe(0);
    expect(pageErrors.length, `Expected no page errors on initial render, got ${pageErrors.map(e => String(e))}`).toBe(0);
  });

  test('Transition ShowDemo: clicking demoButton triggers displayPredictions() and populates demo (S1 DemoDisplayed)', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Click the demo button to trigger the transition S0 -> S1
    await demoPage.clickDemo();

    // Wait/assert that the demo region contains expected header text that displayPredictions() sets
    await demoPage.waitForDemoContains('Given a simple linear model');

    const text = await demoPage.getDemoText();

    // Assert that the displayed output references the intercept and slope used in the implementation
    expect(text).toContain('β₀ = 1', 'Expected demo output to include the intercept β₀ = 1');
    expect(text).toContain('β₁ = 0.8', 'Expected demo output to include the slope β₁ = 0.8');

    // Verify that predictions for each data point are present and correctly formatted
    // Based on the page's script: predicted = beta0 + beta1 * x; beta0=1, beta1=0.8
    const expectedPredictions = [
      { x: 1, actual: 2, predicted: '1.80' },
      { x: 2, actual: 3, predicted: '2.60' },
      { x: 3, actual: 5, predicted: '3.40' },
      { x: 4, actual: 4, predicted: '4.20' },
      { x: 5, actual: 6, predicted: '5.00' }
    ];

    for (const p of expectedPredictions) {
      const expectedLine = `x = ${p.x}, actual y = ${p.actual}, predicted ŷ = ${p.predicted}`;
      expect(text).toContain(expectedLine, `Expected demo output to include prediction line: "${expectedLine}"`);
    }

    // Ensure the demo content is presented as textContent (not innerHTML with markup), i.e., plain textual content
    const demoInnerHTML = await page.locator('#demo').evaluate(node => node.innerHTML);
    // innerHTML should not contain <script> tags or unexpected markup; we just assert it contains the raw text substring
    expect(demoInnerHTML).toContain('Given a simple linear model');

    // Assert no unexpected errors occurred during the click and rendering
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length, `Expected no console.error messages after clicking demo, got ${JSON.stringify(errorConsoleMessages)}`).toBe(0);
    expect(pageErrors.length, `Expected no page errors after clicking demo, got ${pageErrors.map(e => String(e))}`).toBe(0);
  });

  test('Idempotence & edge case: multiple clicks should replace content and not append duplicate sections', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Click the button twice in quick succession
    await demoPage.clickDemo();
    await demoPage.clickDemo();

    // Wait for the demo to contain the expected header text
    await demoPage.waitForDemoContains('Given a simple linear model');

    const text = await demoPage.getDemoText();

    // The header "Given a simple linear model" should only appear once (i.e., content replaced, not appended)
    const headerOccurrences = text.split('Given a simple linear model').length - 1;
    expect(headerOccurrences, 'Expected the header to appear only once after repeated clicks').toBe(1);

    // There should be exactly 5 prediction lines (one per data point), not duplicated
    const matches = text.match(/x = \d+, actual y = \d+, predicted ŷ = [0-9]+\.[0-9]{2}/g) || [];
    expect(matches.length, `Expected exactly 5 prediction lines in the demo (found ${matches.length})`).toBe(5);

    // Assert no console errors or page errors were introduced by multiple clicks
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length, 'No console.error expected after multiple clicks').toBe(0);
    expect(pageErrors.length, 'No page errors expected after multiple clicks').toBe(0);
  });

  test('Stress/edge case: rapid repeated clicking does not crash the page or produce JS errors', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Rapidly click the demo button 10 times
    for (let i = 0; i < 10; i++) {
      // Use Promise.all to avoid waiting for network etc; the click handler is synchronous DOM updates
      await demoPage.button.click();
    }

    // After rapid clicks, ensure the demo contains correct content and is consistent
    await demoPage.waitForDemoContains('Given a simple linear model', 3000);
    const text = await demoPage.getDemoText();

    // Validate a couple of predictions to ensure content is consistent
    expect(text).toContain('x = 1, actual y = 2, predicted ŷ = 1.80');
    expect(text).toContain('x = 5, actual y = 6, predicted ŷ = 5.00');

    // Check no page errors or console.error messages were emitted during the rapid sequence
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length, `Expected no console.error messages after rapid clicking, got ${JSON.stringify(errorConsoleMessages)}`).toBe(0);
    expect(pageErrors.length, `Expected no page errors after rapid clicking, got ${pageErrors.map(e => String(e))}`).toBe(0);
  });

  test('Assertions about runtime errors (verify no ReferenceError / SyntaxError / TypeError occurred)', async ({ page }) => {
    // This test inspects captured page errors and console messages for common JS error types.
    // It does NOT modify the page or patch anything — only observes and asserts.

    // If there were any page errors, they are in pageErrors array. Ensure none match the common error names.
    const jsErrorNamesFound = pageErrors.map(e => e && e.name).filter(Boolean);
    expect(jsErrorNamesFound.length, `Expected no uncaught JS errors, found: ${jsErrorNamesFound.join(', ')}`).toBe(0);

    // Inspect console.error messages for mentions of common error types or stack traces
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    // Ensure none of the console.error texts include "ReferenceError", "SyntaxError", or "TypeError"
    for (const text of errorConsoleMessages) {
      expect(text).not.toContain('ReferenceError');
      expect(text).not.toContain('SyntaxError');
      expect(text).not.toContain('TypeError');
    }

    // Also assert that the console did not produce error-level outputs (general check)
    expect(errorConsoleMessages.length, `Expected no console.error messages, got: ${errorConsoleMessages.join(' | ')}`).toBe(0);
  });
});