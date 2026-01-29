import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e7131-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Big-Omega demo page
class BigOmegaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runCode');
    this.result = page.locator('#result');
    this.codeSnippet = page.locator('#codeSnippet');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getResultText() {
    return (await this.result.textContent()) || '';
  }

  async evaluateFindMin(arg) {
    // Calls the existing findMin function in the page context.
    // We do not redefine or patch any functions.
    return this.page.evaluate((input) => {
      // We intentionally call the page's findMin function (as-is).
      return findMin(input);
    }, arg);
  }
}

test.describe('Big-Omega Notation Demonstration - End-to-End', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners to capture console logs and page errors for each test.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // record all console messages for inspection
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', (err) => {
      // record unhandled exceptions from the page
      pageErrors.push(err);
    });

    // Do not navigate here; tests will navigate as needed to maintain clarity.
  });

  test.afterEach(async ({ page }) => {
    // To be tidy, remove listeners by reloading to a blank page.
    try {
      await page.goto('about:blank');
    } catch (e) {
      // ignore navigation errors during teardown
    }
  });

  test('S0_Idle state: Page loads and shows the Run Code button and empty result', async ({ page }) => {
    // Validate the Idle state (S0_Idle) entry: run page rendering and check initial DOM.
    const po = new BigOmegaPage(page);
    await po.goto();

    // The Run Code button should be visible and have correct text
    await expect(po.runButton).toBeVisible();
    await expect(po.runButton).toHaveText('Run Code');

    // The result div should exist and be empty initially
    const initialResult = await po.getResultText();
    expect(initialResult.trim()).toBe(''); // empty string expected on initial render

    // The code snippet should be present and include the function name
    await expect(po.codeSnippet).toContainText('function findMin');

    // Assert that there were no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were emitted (console messages may include informational logs)
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition RunCodeClick: Clicking Run Code enters CodeRunning state and displays the minimum value', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_CodeRunning triggered by clicking #runCode
    const po = new BigOmegaPage(page);
    await po.goto();

    // Click the Run Code button to trigger the code path described by the FSM.
    await po.clickRun();

    // The result should reflect the expected observable from the FSM transition.
    const expectedText = 'The minimum value in the array [5, 3, 8, 1, 2, 7] is: 1';
    await expect(po.result).toHaveText(expectedText);

    // Clicking again should produce the same result (idempotent behavior)
    await po.clickRun();
    await expect(po.result).toHaveText(expectedText);

    // Confirm that no unhandled page errors were emitted during the run
    expect(pageErrors.length).toBe(0);

    // Confirm that console did not emit errors during the run
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_CodeRunning - Direct function invocation: findMin returns correct values for various inputs', async ({ page }) => {
    // This test exercises the implementation of findMin directly, without modifying page code.
    const po = new BigOmegaPage(page);
    await po.goto();

    // Normal array: expect minimum 1
    const min = await po.evaluateFindMin([5, 3, 8, 1, 2, 7]);
    expect(min).toBe(1);

    // Empty array: per implementation, expect null
    const emptyMin = await po.evaluateFindMin([]);
    expect(emptyMin).toBeNull();

    // Multiple calls should be consistent
    const repeated = await po.evaluateFindMin([2, 2, 2]);
    expect(repeated).toBe(2);

    // Ensure no uncaught page errors produced by these direct calls
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: calling findMin with undefined should throw a TypeError (natural error propagation)', async ({ page }) => {
    // This test intentionally calls findMin with an invalid argument to allow a runtime error to surface.
    const po = new BigOmegaPage(page);
    await po.goto();

    // We expect the page's implementation to throw when called with undefined, because it uses array.length
    let thrown = null;
    try {
      // This evaluate call should reject because the function will throw in the page context.
      await po.evaluateFindMin(undefined);
    } catch (e) {
      thrown = e;
    }

    // We assert that an error was thrown and its message indicates an issue reading `length`
    expect(thrown).not.toBeNull();
    const message = String(thrown && thrown.message ? thrown.message : thrown);
    // Modern browsers report messages like "Cannot read properties of undefined (reading 'length')" or similar.
    expect(message.toLowerCase()).toMatch(/length|cannot read|reading 'length'/);

    // There may or may not be an uncaught pageerror depending on how the browser surfaces the exception.
    // We at least ensure that the evaluate invocation rejected as expected.
  });

  test('Robustness: repeated UI interactions do not produce additional unexpected console errors', async ({ page }) => {
    // This test performs a sequence of UI interactions to ensure stability.
    const po = new BigOmegaPage(page);
    await po.goto();

    // Perform multiple clicks, interleaved with checks.
    for (let i = 0; i < 5; i++) {
      await po.clickRun();
      await expect(po.result).toContainText('The minimum value in the array [5, 3, 8, 1, 2, 7] is: 1');
    }

    // Ensure console did not accumulate error-level messages during repeated interactions
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);

    // No unhandled page errors should have occurred
    expect(pageErrors.length).toBe(0);
  });

  test('DOM Integrity: Ensure critical components exist and have expected attributes', async ({ page }) => {
    // Validate the components detected in the FSM mapping are present in the DOM.
    const po = new BigOmegaPage(page);
    await po.goto();

    const buttonExists = await page.$('#runCode');
    const resultExists = await page.$('#result');

    expect(buttonExists).not.toBeNull();
    expect(resultExists).not.toBeNull();

    // Validate that the button is a <button> element and the result is a <div>
    const buttonTag = await page.evaluate(() => document.querySelector('#runCode')?.tagName);
    const resultTag = await page.evaluate(() => document.querySelector('#result')?.tagName);

    expect(buttonTag).toBe('BUTTON');
    expect(resultTag).toBe('DIV');
  });
});