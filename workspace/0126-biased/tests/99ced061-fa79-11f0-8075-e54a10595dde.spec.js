import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ced061-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Counting Sort Demo
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.maxValueInput = page.locator('#maxValue');
    this.sortButton = page.locator('#sortButton');
    this.resetButton = page.locator('#resetButton');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure main elements are present
    await Promise.all([
      this.arrayInput.waitFor({ state: 'visible' }),
      this.maxValueInput.waitFor({ state: 'visible' }),
      this.sortButton.waitFor({ state: 'visible' }),
      this.resetButton.waitFor({ state: 'visible' }),
      this.output.waitFor({ state: 'attached' }),
    ]);
  }

  async fillArray(value) {
    await this.arrayInput.fill(value);
  }

  async fillMax(value) {
    await this.maxValueInput.fill(String(value));
  }

  async clickSort() {
    await this.sortButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async getOutputText() {
    return (await this.output.innerText()).trim();
  }

  async getArrayValue() {
    return await this.arrayInput.inputValue();
  }

  async getMaxValue() {
    return await this.maxValueInput.inputValue();
  }
}

test.describe('Counting Sort Interactive Demo - states and transitions', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console messages for each test run
    pageErrors = [];
    consoleMessages = [];
    page.on('pageerror', (err) => {
      // Capture unhandled exceptions from the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async () => {
    // Assert that no uncaught page errors occurred during the test.
    // If any errors exist, surface them to fail the test with details.
    if (pageErrors.length > 0) {
      // Build readable error summary
      const summary = pageErrors
        .map((e, i) => `Error ${i + 1}: ${e.message}\n${e.stack || ''}`)
        .join('\n\n');
      // Fail explicitly with the collected error information
      throw new Error(`Uncaught page errors were observed:\n\n${summary}`);
    }
  });

  test('S0_Idle: Page loads and initial UI elements rendered (entry state checks)', async ({ page }) => {
    // This test verifies the Idle state rendering (entry action renderPage() referenced in FSM).
    // It checks presence of inputs, placeholders, buttons, and that output is empty.
    const app = new CountingSortPage(page);
    await app.goto();

    // Verify placeholders and presence of elements
    await expect(app.arrayInput).toBeVisible();
    await expect(app.maxValueInput).toBeVisible();
    await expect(app.sortButton).toBeVisible();
    await expect(app.resetButton).toBeVisible();
    await expect(app.output).toBeVisible();

    // Check placeholder attributes match the FSM evidence
    await expect(app.arrayInput).toHaveAttribute('placeholder', 'e.g., 4, 2, 2, 8, 3, 3, 1');
    await expect(app.maxValueInput).toHaveAttribute('placeholder', 'Enter maximum value of numbers');

    // Output should initially be empty
    const outputText = await app.getOutputText();
    expect(outputText).toBe('', 'Expected initial #output to be empty on load (Idle state).');

    // FSM mentions renderPage() as an entry action. Verify whether a global renderPage function exists.
    // The implementation provided in the HTML does NOT define renderPage(), so we assert it is not defined.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage === 'function');
    expect(hasRenderPage).toBeFalsy();
  });

  test('Transition S0_Idle -> S1_Sorted: Sorting valid input updates the output (Sorted state)', async ({ page }) => {
    // This test validates the primary SortButtonClick transition: valid inputs lead to a sorted output.
    const app = new CountingSortPage(page);
    await app.goto();

    // Ensure helper functions exist on the page as used in handlers
    const countingSortExists = await page.evaluate(() => typeof countingSort === 'function');
    const validateInputExists = await page.evaluate(() => typeof validateInput === 'function');

    expect(countingSortExists).toBeTruthy();
    expect(validateInputExists).toBeTruthy();

    // Input array and max value (from FSM example)
    const input = '4, 2, 2, 8, 3, 3, 1';
    await app.fillArray(input);
    await app.fillMax('8');

    // Click Sort and wait a short time for DOM updates
    await app.clickSort();

    // Verify output text is the expected sorted string
    const output = await app.getOutputText();
    expect(output).toBe('Sorted Array: 1, 2, 2, 3, 3, 4, 8');

    // Also verify that console didn't log any uncaught errors during sorting
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test('Transition S0_Idle -> S0_Idle: Reset clears inputs and output (ResetButtonClick)', async ({ page }) => {
    // This test validates that clicking Reset returns the UI to the Idle state's expectations.
    const app = new CountingSortPage(page);
    await app.goto();

    // Fill inputs and produce output first
    await app.fillArray('2,1');
    await app.fillMax('2');
    await app.clickSort();

    // Ensure output shows sorted content before reset
    expect(await app.getOutputText()).toContain('Sorted Array:');

    // Now click reset and verify fields and output cleared
    await app.clickReset();

    expect(await app.getArrayValue()).toBe('');
    expect(await app.getMaxValue()).toBe('');
    expect(await app.getOutputText()).toBe('');
  });

  test('Edge cases: Invalid inputs trigger an alert with the expected message', async ({ page }) => {
    // This test covers multiple invalid scenarios that should cause validateInput to fail and show alert.
    const app = new CountingSortPage(page);
    await app.goto();

    // Helper to run a scenario and assert an alert with expected text appears
    async function expectAlertForScenario(arrayStr, maxStr) {
      const dialogs = [];
      page.on('dialog', (dialog) => {
        dialogs.push(dialog);
        // Dismiss to allow the page to continue
        dialog.dismiss();
      });

      // Fill values
      await app.fillArray(arrayStr);
      await app.fillMax(maxStr);

      // Click sort to trigger validation
      await app.clickSort();

      // Wait a short time for dialog to appear if it will
      await page.waitForTimeout(200);

      // We expect exactly one dialog with the message from the app
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const msg = dialogs[0].message();
      expect(msg).toBe('Please enter valid numbers.');
    }

    // Scenario 1: A number exceeds max
    await expectAlertForScenario('1, 5', '3');

    // Scenario 2: Non-numeric input
    await expectAlertForScenario('1, a, 3', '5');

    // Scenario 3: Empty input (splitting empty string yields NaN)
    await expectAlertForScenario('', '5');

    // Scenario 4: Missing max value (max becomes NaN and fails)
    await app.fillArray('1,2,3');
    await app.fillMax('');
    const dialogs = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog);
      dialog.dismiss();
    });
    await app.clickSort();
    await page.waitForTimeout(200);
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].message()).toBe('Please enter valid numbers.');
  });

  test('Implementation sanity checks: countingSort produces expected array for various inputs', async ({ page }) => {
    // Directly call countingSort via page.evaluate for several cases to validate algorithm behavior.
    await page.goto(APP_URL);

    // Simple increasing order check
    const result1 = await page.evaluate(() => countingSort([0, 1, 2], 2));
    expect(result1).toEqual([0, 1, 2]);

    // Duplicates and stability check
    const result2 = await page.evaluate(() => countingSort([2, 1, 2, 1, 0], 2));
    // Sorting result should be ascending: 0,1,1,2,2
    expect(result2).toEqual([0, 1, 1, 2, 2]);

    // Edge: all same elements
    const result3 = await page.evaluate(() => countingSort([3, 3, 3], 3));
    expect(result3).toEqual([3, 3, 3]);
  });

  test('No unexpected page runtime errors (ReferenceError/SyntaxError/TypeError) observed during typical interactions', async ({ page }) => {
    // This test explicitly performs several interactions and asserts that no uncaught page errors were emitted.
    // Note: test.afterEach will also check pageErrors, but we assert here proactively as well.
    const app = new CountingSortPage(page);
    await app.goto();

    // Perform a sequence of actions
    await app.fillArray('4,2,1');
    await app.fillMax('4');
    await app.clickSort();
    await page.waitForTimeout(100);
    await app.clickReset();
    await app.fillArray('a,b');
    await app.fillMax('2');
    // Interact to trigger validation alert, but do not expect page error
    page.on('dialog', (d) => d.dismiss());
    await app.clickSort();
    await page.waitForTimeout(100);

    // Assert captured pageErrors is empty
    expect(pageErrors.length).toBe(0);
  });
});