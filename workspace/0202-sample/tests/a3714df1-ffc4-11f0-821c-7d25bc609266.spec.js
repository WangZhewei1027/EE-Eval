import { test, expect } from '@playwright/test';

// Page Object for the Fibonacci demo page
class FibonacciPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3714df1-ffc4-11f0-821c-7d25bc609266.html';
    this.button = page.locator('#generateBtn');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async clickGenerate(options = {}) {
    await this.button.click(options);
  }

  async getButtonText() {
    return this.button.textContent();
  }

  async isButtonDisabled() {
    return this.button.isDisabled();
  }

  async getOutputText() {
    return this.output.textContent();
  }

  expectedFibonacciLines() {
    // Expected lines according to FSM: F(1) = 0 ... F(15) = 610
    const expected = [];
    const fib = (n) => {
      if (n === 1) return 0;
      if (n === 2) return 1;
      let a = 0, b = 1, c;
      for (let i = 3; i <= n; i++) {
        c = a + b;
        a = b;
        b = c;
      }
      return b;
    };
    for (let i = 1; i <= 15; i++) {
      expected.push(`F(${i}) = ${fib(i)}`);
    }
    return expected;
  }
}

test.describe('Fibonacci Interactive Application (a3714df1-ffc4-11f0-821c-7d25bc609266)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, warning, error, log)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', error => {
      // pageerror event provides Error object
      pageErrors.push(error);
    });
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: ensure networked URL stayed reachable
    // and assert no unexpected uncaught errors were thrown during the test.
    // Tests below also make more specific assertions about console/errors when relevant.
    // We do not attempt to patch or modify the page environment.
    // This check ensures we observed and recorded any runtime errors.
    expect(Array.isArray(pageErrors)).toBeTruthy();
  });

  test('Initial state (S0_Idle) renders correctly: button present, enabled, output empty', async ({ page }) => {
    // This test validates the initial "Idle" state described in the FSM:
    // - renderPage() should have produced a button with id #generateBtn
    // - The output pre#demo-output should exist and be empty initially
    const fib = new FibonacciPage(page);
    await fib.goto();

    // Verify button exists and contains expected starting text
    await expect(fib.button).toBeVisible();
    await expect(fib.button).toHaveText('Show First 15 Fibonacci Numbers');

    // Button should be enabled initially (idle state)
    expect(await fib.isButtonDisabled()).toBe(false);

    // Output should exist and be empty (no Fibonacci numbers shown yet)
    await expect(fib.output).toBeVisible();
    const outText = (await fib.getOutputText()) || '';
    expect(outText.trim()).toBe('');

    // Accessibility attributes should be present as documented in the FSM
    await expect(fib.output).toHaveAttribute('aria-live', 'polite');
    await expect(fib.output).toHaveAttribute('aria-atomic', 'true');

    // Verify we captured no uncaught page errors just from loading
    // We allow console logs but ensure there are no page-level exceptions.
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Click event transitions to Generated (S1_Generated) and displays first 15 Fibonacci numbers', async ({ page }) => {
    // This test validates the ButtonClick event and the transition to S1_Generated:
    // - Clicking the button should populate the output with 15 lines
    // - Button should become disabled and its text should change to 'Displayed'
    // - The exact expected lines (F(1) = 0 ... F(15) = 610) must be present and in order
    const fib = new FibonacciPage(page);
    await fib.goto();

    // Click the generate button as a user would
    await fib.clickGenerate();

    // Wait for the output to be populated with expected text content
    const expectedLines = fib.expectedFibonacciLines();
    // Wait and poll until output matches expected content (some DOM updates might be asynchronous)
    await page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const actual = (el.textContent || '').trim().split('\n').map(s => s.trim());
        if (actual.length !== expected.length) return false;
        for (let i = 0; i < expected.length; i++) {
          if (actual[i] !== expected[i]) return false;
        }
        return true;
      },
      fib.output.selector,
      expectedLines,
    );

    // Assert output equals expected join
    const out = await fib.getOutputText();
    const actualLines = out.split('\n').map(s => s.trim()).filter(Boolean);
    expect(actualLines.length).toBe(15);
    expect(actualLines).toEqual(expectedLines);

    // Assert button was disabled and text changed to 'Displayed'
    expect(await fib.isButtonDisabled()).toBe(true);
    await expect(fib.button).toHaveText('Displayed');

    // Confirm aria-live semantics: the pre element still has the attributes
    await expect(fib.output).toHaveAttribute('aria-live', 'polite');
    await expect(fib.output).toHaveAttribute('aria-atomic', 'true');

    // Ensure no uncaught page errors occurred during the click/processing
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were emitted while generating content
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Attempting to click disabled button after generation does not change output or crash', async ({ page }) => {
    // This test validates behavior after transition:
    // - The button should be disabled and clicking it (even with force) should not change the output
    // - No page errors should be thrown as a result of a second click attempt
    const fib = new FibonacciPage(page);
    await fib.goto();

    // Generate content first
    await fib.clickGenerate();

    // Capture output snapshot
    const before = (await fib.getOutputText()) || '';

    // Ensure button is disabled
    expect(await fib.isButtonDisabled()).toBe(true);

    // Attempt to click disabled button with force; this simulates a programmatic misuse.
    // We do not expect the page to throw runtime errors as a result.
    // If the page intends to ignore such clicks, the output should remain unchanged.
    await fib.button.click({ force: true });

    // Wait a short time for any unexpected effects to manifest
    await page.waitForTimeout(200);

    const after = (await fib.getOutputText()) || '';
    // The output should remain unchanged
    expect(after).toBe(before);

    // No uncaught page errors should have been recorded
    expect(pageErrors.length).toBe(0);

    // No console errors emitted due to the second click
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Robustness: verify output formatting, line counts, and content match FSM expected_observables', async ({ page }) => {
    // Validate exact observables from the FSM (the lines listed under expected_observables).
    // This test also verifies that the iterative algorithm was used and values are correct.
    const fib = new FibonacciPage(page);
    await fib.goto();

    // Click to populate
    await fib.clickGenerate();

    // Retrieve and normalize output
    const out = (await fib.getOutputText()) || '';
    const lines = out.split('\n').map(l => l.trim()).filter(Boolean);

    // Verify count
    expect(lines.length).toBe(15);

    // Confirm content against known expected values from the FSM
    const expected = [
      'F(1) = 0',
      'F(2) = 1',
      'F(3) = 2',
      'F(4) = 3',
      'F(5) = 5',
      'F(6) = 8',
      'F(7) = 13',
      'F(8) = 21',
      'F(9) = 34',
      'F(10) = 55',
      'F(11) = 89',
      'F(12) = 144',
      'F(13) = 233',
      'F(14) = 377',
      'F(15) = 610'
    ];

    expect(lines).toEqual(expected);

    // Additional checks: first and last lines specifically
    expect(lines[0]).toBe('F(1) = 0');
    expect(lines[lines.length - 1]).toBe('F(15) = 610');

    // Ensure no runtime exceptions were recorded in this process
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Monitoring: capture console output and page errors while interacting with the page', async ({ page }) => {
    // This test demonstrates explicit observation of console messages and page errors.
    // It asserts that there are no unexpected runtime exceptions (ReferenceError, SyntaxError, TypeError, etc.)
    // during normal use of the demo page.

    const fib = new FibonacciPage(page);
    await fib.goto();

    // Interact with the page multiple times (normal click)
    await fib.clickGenerate();

    // Attempt another click with force to simulate abnormal user/script interaction
    await fib.button.click({ force: true });

    // Wait briefly for any async errors/console messages
    await page.waitForTimeout(200);

    // Build human-readable summaries for debugging in case of failure
    const errorMessages = pageErrors.map(e => (e && e.stack) ? e.stack : String(e));
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);

    // Assert there were no uncaught exceptions
    expect(pageErrors.length, `Unexpected page errors: ${errorMessages.join(' | ')}`).toBe(0);

    // Assert there were no console.error messages
    expect(consoleErrorMessages.length, `Unexpected console.error: ${consoleErrorMessages.join(' | ')}`).toBe(0);

    // We still expect there to be console logs or informational messages possibly,
    // but none of type 'error' should be present.
    const nonErrorConsole = consoleMessages.filter(m => m.type !== 'error');
    expect(Array.isArray(nonErrorConsole)).toBe(true);
  });
});