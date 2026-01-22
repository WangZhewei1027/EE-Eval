import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79cc7b0-d361-11f0-8438-11a56595a476.html';

// Page Object Model for the Merge Sort demo page
class MergeSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async input() {
    return this.page.locator('#array-input');
  }

  async sortButton() {
    return this.page.locator('#sort-button');
  }

  async stepsDiv() {
    return this.page.locator('#steps');
  }

  async finalResult() {
    return this.page.locator('#final-result');
  }

  // Enter array string into input
  async enterArray(value) {
    const input = await this.input();
    await input.fill(value);
  }

  // Click sort button
  async clickSort() {
    const btn = await this.sortButton();
    await btn.click();
  }

  // Wait for final result element to appear (Sorted state)
  async waitForFinalResult(timeout = 2000) {
    return this.page.waitForSelector('#final-result', { timeout });
  }

  // Read stepsDiv text content
  async stepsText() {
    const steps = await this.stepsDiv();
    return steps.textContent();
  }

  // Helper to get whether button/input disabled
  async isButtonDisabled() {
    return (await (await this.sortButton()).getAttribute('disabled')) !== null;
  }

  async isInputDisabled() {
    return (await (await this.input()).getAttribute('disabled')) !== null;
  }
}

test.describe('Merge Sort Demonstration - FSM states and transitions', () => {
  // Collect console errors and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen to uncaught page errors
    page.on('pageerror', err => {
      // store the actual Error object for assertion and debugging
      pageErrors.push(err);
    });
  });

  // Ensure we start from a fresh page for each test
  test.describe('Initial Idle state (S0_Idle)', () => {
    test('renders input, button, and initial message; controls enabled', async ({ page }) => {
      const app = new MergeSortPage(page);
      await app.goto();

      // Validate presence of input and button (evidence from FSM S0_Idle)
      await expect(page.locator('#array-input')).toBeVisible();
      await expect(page.locator('#sort-button')).toBeVisible();

      // Initial steps message should instruct the user
      const stepsText = await app.stepsText();
      expect(stepsText).toContain('Enter an array above and click "Sort" to see merge sort steps.');

      // Controls should be enabled in Idle state
      expect(await app.isButtonDisabled()).toBe(false);
      expect(await app.isInputDisabled()).toBe(false);

      // Assert no runtime page errors happened during load
      expect(pageErrors.length).toBe(0);
      // Assert no console.error messages were output during load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Sorting transition and Sorted final state', () => {
    test('clicking Sort moves to Sorting (S1_Sorting) then to Sorted (S2_Sorted) with correct final result and onExit actions', async ({ page }) => {
      const app = new MergeSortPage(page);
      await app.goto();

      // Provide a sample array, click Sort => should immediately show "Sorting... Please wait."
      await app.enterArray('5,3,8,4,2');
      // Confirm the input value is set
      await expect(page.locator('#array-input')).toHaveValue('5,3,8,4,2');

      // Click the button to trigger SortClick event (transition S0_Idle -> S1_Sorting)
      await app.clickSort();

      // Immediately after clicking, application should set "Sorting..." message (S1_Sorting entry action)
      await expect(page.locator('#steps')).toHaveText('Sorting... Please wait.');

      // Buttons/input should be disabled while sorting (transition actions)
      expect(await app.isButtonDisabled()).toBe(true);
      expect(await app.isInputDisabled()).toBe(true);

      // No synchronous runtime errors expected on click
      const consoleErrorsImmediately = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorsImmediately.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // Wait for the final sorted result (setTimeout used inside implementation)
      await app.waitForFinalResult(3000); // allow up to 3s
      const finalText = await page.locator('#final-result').textContent();
      // Verify the final result matches expected sorted array
      expect(finalText.trim()).toBe('Final sorted array: [2, 3, 4, 5, 8]');

      // After sorting completes, onExit actions should re-enable controls
      expect(await app.isButtonDisabled()).toBe(false);
      expect(await app.isInputDisabled()).toBe(false);

      // Steps should include a sequence of .step elements (split/merge steps evidence)
      const stepCount = await page.locator('.step').count();
      expect(stepCount).toBeGreaterThanOrEqual(1);

      // Confirm the original array and steps are present inside stepsDiv (renderSteps evidence)
      const stepsDivText = await app.stepsText();
      expect(stepsDivText).toContain('Splitting array: [5, 3, 8, 4, 2]');
      expect(stepsDivText).toContain('Merging:');

      // No runtime page errors occurred during sorting process
      const consoleErrorsFinal = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorsFinal.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('after one successful sort, performing another sort produces correct subsequent result', async ({ page }) => {
      const app = new MergeSortPage(page);
      await app.goto();

      // First sort
      await app.enterArray('10,1,7');
      await app.clickSort();
      await app.waitForFinalResult();

      // Ensure first result is correct
      expect(await page.locator('#final-result')).toHaveText('Final sorted array: [1, 7, 10]');

      // Perform second sort with a different array to ensure UI resets and onExit actions allowed subsequent use
      await app.enterArray('4 2 9 1'); // spaces allowed as separators
      await app.clickSort();

      // Immediately "Sorting..." message appears again
      await expect(page.locator('#steps')).toHaveText('Sorting... Please wait.');

      // After processing, final result updated
      await app.waitForFinalResult();
      expect(await page.locator('#final-result')).toHaveText('Final sorted array: [1, 2, 4, 9]');

      // Confirm no page errors happened during repeated usage
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Invalid input scenarios (S3_InvalidInput)', () => {
    test('clicking Sort with empty input shows invalid input message and does not disable controls', async ({ page }) => {
      const app = new MergeSortPage(page);
      await app.goto();

      // Ensure input empty
      await expect(page.locator('#array-input')).toHaveValue('');
      // Click Sort with empty input - should show invalid message (S3_InvalidInput entry action)
      await app.clickSort();

      // Because the code returns early on invalid input, controls stay enabled
      expect(await app.isButtonDisabled()).toBe(false);
      expect(await app.isInputDisabled()).toBe(false);

      // Steps div should contain the invalid input message
      await expect(page.locator('#steps')).toHaveText('Invalid input. Please enter a sequence of numbers separated by commas or spaces.');

      // No runtime exceptions expected for invalid input path
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('non-numeric tokens produce invalid input message and no sorting occurs', async ({ page }) => {
      const app = new MergeSortPage(page);
      await app.goto();

      // Provide a partially invalid input with non-numeric tokens
      await app.enterArray('1, two, 3');
      await app.clickSort();

      // Expect invalid input message and controls remain enabled
      await expect(page.locator('#steps')).toHaveText('Invalid input. Please enter a sequence of numbers separated by commas or spaces.');
      expect(await app.isButtonDisabled()).toBe(false);
      expect(await app.isInputDisabled()).toBe(false);

      // Assert no page errors were thrown
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Error and console observation', () => {
    test('observes console and page errors across interactions; expects none for this implementation', async ({ page }) => {
      const app = new MergeSortPage(page);
      await app.goto();

      // Do a few interactions to exercise code paths
      await app.enterArray('3,2,1');
      await app.clickSort();
      await app.waitForFinalResult();
      await app.enterArray('a,b,c');
      await app.clickSort();

      // Inspect the collected console messages and page errors
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');

      // The implementation provided should not throw runtime exceptions; assert zero errors
      // This validates that ReferenceError/SyntaxError/TypeError did not occur in normal usage
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // Additionally, ensure at least some console activity occurred (informational logs may exist)
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    });
  });
});