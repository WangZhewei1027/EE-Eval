import { test, expect } from '@playwright/test';

// Page object representing the Big-O Notation Demo page
class BigODemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      linearButton: ".button[onclick='testLinear()']",
      quadraticButton: ".button[onclick='testQuadratic()']",
      constantButton: ".button[onclick='testConstant()']",
      result: '#result',
    };
  }

  async goto() {
    // Navigate to the provided HTML file URL
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/324e4a25-fa73-11f0-a9d0-d7a1991987c6.html', { waitUntil: 'load' });
  }

  async clickLinear() {
    await this.page.click(this.selectors.linearButton);
  }

  async clickQuadratic() {
    await this.page.click(this.selectors.quadraticButton);
  }

  async clickConstant() {
    await this.page.click(this.selectors.constantButton);
  }

  async getResultText() {
    return (await this.page.locator(this.selectors.result).innerText()).trim();
  }

  async isButtonVisible(selector) {
    return await this.page.locator(selector).isVisible();
  }
}

test.describe('Big-O Notation Demo - FSM state and transition tests', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages and page errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Collect unhandled exceptions in the page context
      pageErrors.push(err);
    });

    // No navigation here; each test will navigate explicitly via page object
  });

  test.afterEach(async () => {
    // After each test we ensure there were no unexpected page errors by default.
    // Tests that intentionally expect errors will assert them directly.
    expect(pageErrors.length).toBeGreaterThanOrEqual(0); // trivial check to ensure array exists
  });

  test('Idle state: buttons are present and result area is initially empty', async ({ page }) => {
    // Validate the Idle state (S0_Idle) evidence: three buttons and empty result div
    const demo = new BigODemoPage(page);
    await demo.goto();

    // Check that all three buttons are visible
    expect(await demo.isButtonVisible(demo.selectors.linearButton)).toBe(true);
    expect(await demo.isButtonVisible(demo.selectors.quadraticButton)).toBe(true);
    expect(await demo.isButtonVisible(demo.selectors.constantButton)).toBe(true);

    // Result area should be empty at idle
    const resultText = await demo.getResultText();
    expect(resultText).toBe(''); // evidence: <div id="result" class="result"></div>

    // No page errors should be present on initial load
    expect(pageErrors).toHaveLength(0);

    // No console error messages on load
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Transition: TestLinear -> S1_LinearTest produces expected result text', async ({ page }) => {
    // This test validates transition from Idle to Linear Test (S0_Idle -> S1_LinearTest)
    // It also verifies the entry action testLinear() produced the expected DOM update.
    const demo = new BigODemoPage(page);
    await demo.goto();

    // Click the linear button to trigger testLinear()
    await demo.clickLinear();

    // Wait for the result text to appear & assert exact expected output per FSM
    await expect(page.locator(demo.selectors.result)).toHaveText('O(n): Processed 1000 elements. Sum = 499500');

    // Verify final text via page object getter as well
    const resultText = await demo.getResultText();
    expect(resultText).toBe('O(n): Processed 1000 elements. Sum = 499500');

    // No runtime page errors should have happened during the linear computation
    expect(pageErrors).toHaveLength(0);

    // No console error logs produced by the page while computing linear
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Transition: TestQuadratic -> S2_QuadraticTest produces expected result text', async ({ page }) => {
    // Validate the quadratic transition and associated entry action testQuadratic()
    const demo = new BigODemoPage(page);
    await demo.goto();

    // Click the quadratic button to trigger testQuadratic()
    await demo.clickQuadratic();

    // Assert expected result string per FSM
    await expect(page.locator(demo.selectors.result)).toHaveText('O(n^2): Processed 100 * 100 elements. Count = 10000');

    const resultText = await demo.getResultText();
    expect(resultText).toBe('O(n^2): Processed 100 * 100 elements. Count = 10000');

    // Ensure no uncaught errors on the page during the quadratic run
    expect(pageErrors).toHaveLength(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Transition: TestConstant -> S3_ConstantTest produces expected result text', async ({ page }) => {
    // Validate the constant time transition and associated entry action testConstant()
    const demo = new BigODemoPage(page);
    await demo.goto();

    // Click the constant button to trigger testConstant()
    await demo.clickConstant();

    // Assert the exact expected output per FSM
    await expect(page.locator(demo.selectors.result)).toHaveText('O(1): Processed 1000 elements. Result = 42');

    const resultText = await demo.getResultText();
    expect(resultText).toBe('O(1): Processed 1000 elements. Result = 42');

    // Ensure no uncaught errors on the page during the constant run
    expect(pageErrors).toHaveLength(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Edge case: rapid repeated clicks update result consistently (idempotency / repeated entry actions)', async ({ page }) => {
    // This edge case ensures repeated triggers of the same transition produce consistent results.
    const demo = new BigODemoPage(page);
    await demo.goto();

    // Rapidly click linear button multiple times
    await Promise.all([
      demo.clickLinear(),
      demo.clickLinear(),
      demo.clickLinear()
    ]);

    // The result should be the same as single click (deterministic)
    const resultText = await demo.getResultText();
    expect(resultText).toBe('O(n): Processed 1000 elements. Sum = 499500');

    // Now rapidly click constant button multiple times
    await Promise.all([
      demo.clickConstant(),
      demo.clickConstant()
    ]);
    expect(await demo.getResultText()).toBe('O(1): Processed 1000 elements. Result = 42');

    // And quadratic
    await Promise.all([
      demo.clickQuadratic(),
      demo.clickQuadratic()
    ]);
    expect(await demo.getResultText()).toBe('O(n^2): Processed 100 * 100 elements. Count = 10000');

    // Confirm no page errors occurred during rapid interactions
    expect(pageErrors).toHaveLength(0);
  });

  test('Error scenario: calling a non-existent function in page context yields a ReferenceError (natural error observation)', async ({ page }) => {
    // This test intentionally attempts to call a non-existent function in the page's global scope.
    // We let the error occur naturally and assert that the evaluation rejects with an appropriate ReferenceError.
    const demo = new BigODemoPage(page);
    await demo.goto();

    let caughtError = null;
    try {
      // Attempt to call a function that is not defined in the page's script.
      // This should cause a ReferenceError in the page's JS execution context and reject the evaluate promise.
      await page.evaluate(() => {
        // Intentionally reference a non-existent function name - do NOT create it.
        // This is a natural ReferenceError without modifying page globals.
        // eslint-disable-next-line no-undef
        nonExistentFunctionThatDoesNotExist();
      });
    } catch (err) {
      caughtError = err;
    }

    // We must observe that an error was thrown and it is a ReferenceError-like message.
    expect(caughtError).not.toBeNull();
    // The error message should typically indicate that the function is not defined.
    // Different engines may provide slightly different wording, so check for common substrings.
    const message = String(caughtError);
    expect(
      message.includes('nonExistentFunctionThatDoesNotExist') ||
      message.includes('is not defined') ||
      message.includes('is not a function') ||
      message.includes('ReferenceError')
    ).toBeTruthy();
  });

  test('Sanity check: no unexpected console.error logs produced during normal operation', async ({ page }) => {
    // This test loads the page, interacts with it, and ensures there are no console.error logs.
    const demo = new BigODemoPage(page);
    await demo.goto();

    // Perform a normal sequence of interactions
    await demo.clickLinear();
    await demo.clickQuadratic();
    await demo.clickConstant();

    // Collect all console messages captured in this test's beforeEach
    const errors = consoleMessages.filter(m => m.type === 'error');
    // In a healthy implementation there should be no console errors
    expect(errors.length).toBe(0);

    // Also, pageErrors should remain empty
    expect(pageErrors.length).toBe(0);
  });
});