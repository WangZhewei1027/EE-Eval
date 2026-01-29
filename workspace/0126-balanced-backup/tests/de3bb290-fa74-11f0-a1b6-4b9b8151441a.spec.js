import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3bb290-fa74-11f0-a1b6-4b9b8151441a.html';

/**
 * Page Object for the Counting Sort demo page.
 * Encapsulates common interactions and queries to keep tests readable.
 */
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputArray');
    this.sortButton = page.locator('button[onclick="sortArray()"]');
    this.error = page.locator('#error');
    this.stepsContainer = page.locator('#stepsContainer');
    this.sortedResult = page.locator('#sortedResult');
    this.sortedArray = page.locator('#sortedArray');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getInputValue() {
    return this.input.inputValue();
  }

  async setInputValue(val) {
    await this.input.fill(val);
  }

  async clickSort() {
    await this.sortButton.click();
  }

  async getErrorText() {
    return this.error.textContent();
  }

  async isSortedResultVisible() {
    // Use toBeVisible in tests, but provide programmatic check as well.
    return this.sortedResult.isVisible();
  }

  async getSortedArrayText() {
    return (await this.sortedArray.textContent()) || '';
  }

  async getStepCount() {
    return this.stepsContainer.locator('.step').count();
  }

  async getStepsText() {
    const count = await this.getStepCount();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.stepsContainer.locator('.step').nth(i).innerText());
    }
    return texts;
  }
}

test.describe('Counting Sort Demonstration - FSM states and transitions', () => {
  // For each test we collect console errors and page errors to observe runtime issues.
  test.beforeEach(async ({ page }) => {
    // Ensure any existing listeners are cleared by creating new arrays per test.
    page.context()._collectedConsole = [];
    page.context()._collectedPageErrors = [];

    page.on('console', msg => {
      // record console messages; this includes console.error, console.warn, etc.
      page.context()._collectedConsole.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', err => {
      // record uncaught exceptions (ReferenceError, TypeError, etc.)
      page.context()._collectedPageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity assertions about console and page errors.
    // We expect the demo to run without uncaught page errors.
    const pageErrors = page.context()._collectedPageErrors || [];
    const consoleMessages = page.context()._collectedConsole || [];

    // Fail the test if there were uncaught page errors (runtime exceptions).
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Fail the test if any console messages are of type 'error'.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test('Idle state: page initially renders correctly (S0_Idle)', async ({ page }) => {
    // Validate initial/Idle state - elements are present and default values are set.
    const app = new CountingSortPage(page);
    await app.goto();

    // Input should exist and have the default example value.
    const inputVal = await app.getInputValue();
    expect(inputVal, 'Default input value should match the FSM example').toContain('4');
    expect(await app.sortButton.isVisible(), 'Sort button should be visible in Idle state').toBeTruthy();

    // Steps container should be empty initially.
    const steps = await app.getStepCount();
    expect(steps, 'No steps should be displayed initially').toBe(0);

    // Sorted results hidden initially.
    expect(await app.sortedResult.isVisible(), 'Sorted result container should be hidden initially').toBeFalsy();

    // No error text initially.
    const errorText = await app.getErrorText();
    expect(errorText?.trim() || '', 'Error container should be empty on initial render').toBe('');
  });

  test('Sorting -> Sorted transition with valid input produces steps and final sorted output (S1_Sorting -> S3_Sorted)', async ({ page }) => {
    // This test validates the normal successful sorting path.
    const app = new CountingSortPage(page);
    await app.goto();

    // Use a known unsorted array (default or custom) and click sort.
    await app.setInputValue('4, 2, 2, 8, 3, 3, 1');
    await app.clickSort();

    // Wait for the final sorted result container to become visible.
    await expect(app.sortedResult).toBeVisible({ timeout: 2000 });

    // The steps container should contain multiple steps (original array + algorithm steps).
    const stepCount = await app.getStepCount();
    expect(stepCount, 'Sorting should produce multiple step entries').toBeGreaterThanOrEqual(3);

    // Validate sorted array text is correct.
    const sortedText = (await app.getSortedArrayText()).trim();
    // counting sort of [4,2,2,8,3,3,1] -> [1,2,2,3,3,4,8]
    expect(sortedText, 'Sorted array text should show numbers in non-decreasing order').toBe('1, 2, 2, 3, 3, 4, 8');

    // Ensure error container remains empty.
    const errorText = await app.getErrorText();
    expect(errorText?.trim() || '', 'No error should be shown for valid input').toBe('');
  });

  test('Sorting -> Error transition when input is empty (S1_Sorting -> S2_Error)', async ({ page }) => {
    // Validate error path when the user provides no valid numbers.
    const app = new CountingSortPage(page);
    await app.goto();

    // Clear input to trigger the empty-input guard.
    await app.setInputValue('   ');
    await app.clickSort();

    // Error text should show appropriate message for empty input.
    await expect(app.error).toHaveText('Please enter valid numbers');

    // Sorted results should remain hidden.
    expect(await app.isSortedResultVisible(), 'Sorted result should remain hidden on error').toBeFalsy();

    // Steps should remain empty because sorting did not proceed.
    const stepCount = await app.getStepCount();
    expect(stepCount, 'No steps should be displayed when input is invalid/empty').toBe(0);
  });

  test('Sorting -> Error transition when input contains negative numbers (S1_Sorting -> S2_Error)', async ({ page }) => {
    // Validate guard for negative numbers - counting sort only supports non-negative integers.
    const app = new CountingSortPage(page);
    await app.goto();

    // Input with a negative number to provoke the error.
    await app.setInputValue('1, -2, 3');
    await app.clickSort();

    // Expect the specific error message about non-negative integers.
    await expect(app.error).toHaveText('Counting sort only works with non-negative integers');

    // Ensure sorted result remains hidden.
    expect(await app.isSortedResultVisible(), 'Sorted result should remain hidden when negative numbers present').toBeFalsy();

    // No algorithmic steps should be shown.
    const stepCount = await app.getStepCount();
    expect(stepCount, 'No steps should be displayed when negative input exists').toBe(0);
  });

  test('Edge case: non-numeric tokens are filtered and remaining numbers are sorted', async ({ page }) => {
    // The implementation filters out non-numeric tokens. Ensure this behavior works.
    const app = new CountingSortPage(page);
    await app.goto();

    // Provide input with alphabets and extra commas - non-numeric items should be ignored.
    await app.setInputValue('a, 5, , 2, ,b, 5');
    await app.clickSort();

    // Wait for sorted result to appear (since valid numbers exist).
    await expect(app.sortedResult).toBeVisible();

    // The numbers that remain are [5,2,5] -> sorted [2,5,5]
    const sortedText = (await app.getSortedArrayText()).trim();
    expect(sortedText, 'Non-numeric tokens should be ignored; remaining numbers should be sorted').toBe('2, 5, 5');

    // Steps should show the process at least once.
    const stepCount = await app.getStepCount();
    expect(stepCount).toBeGreaterThanOrEqual(3);

    // Error should be empty.
    const errorText = await app.getErrorText();
    expect(errorText?.trim() || '', 'No error should be displayed when valid numeric tokens remain').toBe('');
  });

  test('Verify DOM modifications expected by FSM entry/exit actions and evidence strings (S1_Sorting evidence checks)', async ({ page }) => {
    // This test observes specific DOM mutations referenced in the FSM evidence:
    // - sortArray() clears #stepsContainer.innerHTML
    // - countingSort steps append children to #stepsContainer
    // - final display toggles #sortedResult.style.display = "block"
    const app = new CountingSortPage(page);
    await app.goto();

    // Pre-populate steps container with a dummy node to ensure it gets cleared.
    await page.evaluate(() => {
      const steps = document.getElementById('stepsContainer');
      steps.innerHTML = '<div class="step">DUMMY</div>';
      const sorted = document.getElementById('sortedResult');
      sorted.style.display = 'none';
    });

    // Confirm dummy exists
    expect(await app.getStepCount()).toBe(1);

    // Perform sorting with a valid input
    await app.setInputValue('3,1,2');
    await app.clickSort();

    // After clicking, steps container should have been cleared and then populated by the algorithm.
    const stepCount = await app.getStepCount();
    expect(stepCount, 'Steps container should be replaced with algorithm steps (not the dummy) after sort').toBeGreaterThanOrEqual(3);

    // Final sortedResult should be visible (style.display = 'block' evidence).
    await expect(app.sortedResult).toBeVisible();
    const displayStyle = await page.$eval('#sortedResult', el => getComputedStyle(el).display);
    expect(displayStyle, "sortedResult should be displayed with 'block' or visible style").toBe('block');

    // The sorted array content should match the expected sorted order.
    const sortedText = (await app.getSortedArrayText()).trim();
    expect(sortedText).toBe('1, 2, 3');
  });
});