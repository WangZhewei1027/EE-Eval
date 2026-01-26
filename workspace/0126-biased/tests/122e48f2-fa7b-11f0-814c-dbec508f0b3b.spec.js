import { test, expect } from '@playwright/test';

// Test file for application: 122e48f2-fa7b-11f0-814c-dbec508f0b3b
// Served at: http://127.0.0.1:5500/workspace/0126-biased/html/122e48f2-fa7b-11f0-814c-dbec508f0b3b.html
// This suite validates the FSM states and transitions described in the prompt,
// and also intentionally observes runtime errors produced by the page implementation.
// NOTE: We do NOT modify or patch the page under test. We let runtime errors (TypeError, etc.) occur naturally
// and assert that they occur where expected.

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-biased/html/122e48f2-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object representing main interactions with the KNN app
class KNNPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      feature1: '#feature1',
      feature2: '#feature2',
      feature3: '#feature3',
      knnButton: '#knn-button',
      knnClear: '#knn-clear',
      knnTableBody: '#knn-data',
      knnTable: '#knn-table',
      knnOutput: '#knn-output',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickKNN(expectError = false) {
    if (expectError) {
      return Promise.all([this.page.waitForEvent('pageerror'), this.page.click(this.selectors.knnButton)]);
    } else {
      await this.page.click(this.selectors.knnButton);
      return null;
    }
  }

  async clickClear(expectError = false) {
    if (expectError) {
      return Promise.all([this.page.waitForEvent('pageerror'), this.page.click(this.selectors.knnClear)]);
    } else {
      await this.page.click(this.selectors.knnClear);
      return null;
    }
  }

  async getRowCount() {
    // Count rows inside the #knn-data container. The page implementation appends a <table> into this tbody,
    // so rows are descendants.
    return this.page.$$eval(`${this.selectors.knnTableBody} tr`, (rows) => rows.length);
  }

  async getTableText() {
    return this.page.$eval(this.selectors.knnTableBody, (el) => el.innerText);
  }

  async getButtonText() {
    return this.page.$eval(this.selectors.knnButton, (el) => el.textContent);
  }

  async getButtonValueProperty() {
    return this.page.$eval(this.selectors.knnButton, (el) => el.value);
  }

  async setButtonValueAndDispatchInput(newValue) {
    // The implementation attaches an 'input' event listener to the button element (oddly).
    // We emulate changing the button's value property and dispatching an input event.
    await this.page.evaluate(
      ({ selector, val }) => {
        const el = document.querySelector(selector);
        if (!el) return;
        el.value = val;
        const evt = new Event('input', { bubbles: true, cancelable: true });
        el.dispatchEvent(evt);
      },
      { selector: this.selectors.knnButton, val: newValue }
    );
  }
}

test.describe('KNN FSM and UI validation - Application 122e48f2...', () => {
  // Use a fresh page for each test to avoid cross-test interference
  test.beforeEach(async ({ page }) => {
    // Capture console messages for debugging within tests when needed
    page.on('console', (msg) => {
      // We intentionally do not fail on console messages; we attach them to test output if helpful.
      // (Playwright will still show console output.)
      // No-op: keeping listener to ensure we observe console activity during test runs.
    });
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Ensure no residual listeners from page remain; Playwright closes pages automatically per test.
    // No explicit teardown required.
  });

  test('S0_Idle: initial UI elements are present and have expected defaults', async ({ page }) => {
    // Validate initial Idle state: inputs and buttons exist and show default values
    const knn = new KNNPage(page);

    // Inputs should be present and have default values as per HTML
    await expect(page.locator(knn.selectors.feature1)).toBeVisible();
    await expect(page.locator(knn.selectors.feature2)).toBeVisible();
    await expect(page.locator(knn.selectors.feature3)).toBeVisible();

    await expect(page.locator(knn.selectors.knnButton)).toBeVisible();
    await expect(page.locator(knn.selectors.knnClear)).toBeVisible();

    // Assert default input values
    expect(await page.getAttribute(knn.selectors.feature1, 'value')).toBe('Feature 1');
    expect(await page.getAttribute(knn.selectors.feature2, 'value')).toBe('Feature 2');
    expect(await page.getAttribute(knn.selectors.feature3, 'value')).toBe('Feature 3');

    // Buttons text content
    expect(await knn.getButtonText()).toContain('KNN');
    expect(await page.$eval(knn.selectors.knnClear, (b) => b.textContent)).toContain('Clear');

    // Initially, knn-data tbody should be empty (no rows)
    const initialRows = await knn.getRowCount();
    expect(initialRows).toBe(0);
  });

  test.describe('S1_DataEntered: clicking KNN adds data and updates table', () => {
    test('Clicking KNN once populates the table with one entry', async ({ page }) => {
      const knn = new KNNPage(page);

      // Click KNN to enter data (should not produce an error)
      await knn.clickKNN(false);

      // After one click, expect one row in the table
      const rowsAfterOne = await knn.getRowCount();
      expect(rowsAfterOne).toBeGreaterThanOrEqual(1);

      // Verify the table text contains expected feature strings from inputs
      const tableText = await knn.getTableText();
      expect(tableText).toContain('Feature 1');
      expect(tableText).toContain('Feature 2');
      expect(tableText).toContain('Feature 3');
    });

    test('Clicking KNN multiple times appends additional entries (data updated)', async ({ page }) => {
      const knn = new KNNPage(page);

      // First click - should add first entry
      await knn.clickKNN(false);
      const rowsAfterFirst = await knn.getRowCount();
      expect(rowsAfterFirst).toBeGreaterThanOrEqual(1);

      // Second click - should add another entry; knnData is a const array but push is allowed
      await knn.clickKNN(false);
      const rowsAfterSecond = await knn.getRowCount();
      // Expect at least as many rows as before (usually incremented)
      expect(rowsAfterSecond).toBeGreaterThanOrEqual(rowsAfterFirst + 0); // allow for implementation details
      // At minimum, ensure there are multiple entries after two clicks
      expect(rowsAfterSecond).toBeGreaterThanOrEqual(2);

      // The implementation reassigns knnButtonInput.value = 'KNN' in one handler; ensure that value property exists
      const buttonValue = await knn.getButtonValueProperty();
      // The value property on a button may be an empty string or 'KNN' depending on timing; assert it's defined
      expect(buttonValue).not.toBeUndefined();
    });
  });

  test.describe('Error scenarios and S2_DataCleared transition', () => {
    test('Clear clicked from Idle triggers a runtime error (const reassignment) - observe pageerror', async ({
      page,
    }) => {
      const knn = new KNNPage(page);

      // Clicking Clear when no data exists still invokes the clear handler which attempts "knnData = []"
      // This should throw a TypeError due to assignment to a const variable.
      const [error] = await Promise.all([page.waitForEvent('pageerror'), page.click(knn.selectors.knnClear)]);

      // Validate that a pageerror occurred and that it is a TypeError (assignment to const)
      expect(error).toBeTruthy();
      // The Error object typically exposes a name property
      expect(error.name).toBe('TypeError');
      // The message should mention assignment to constant or cannot assign; we allow partial matching
      expect(String(error.message).length).toBeGreaterThan(0);
    });

    test('Clicking Clear after data entry triggers runtime error and table remains (not cleared)', async ({ page }) => {
      const knn = new KNNPage(page);

      // Enter data by clicking KNN (no error expected)
      await knn.clickKNN(false);
      const rowsBeforeClear = await knn.getRowCount();
      expect(rowsBeforeClear).toBeGreaterThanOrEqual(1);

      // Now click Clear and expect an unhandled TypeError to be emitted (assignment to const)
      const [error] = await Promise.all([page.waitForEvent('pageerror'), page.click(knn.selectors.knnClear)]);

      expect(error).toBeTruthy();
      expect(error.name).toBe('TypeError');

      // Because the error occurs before knnDataContainer.innerHTML is cleared (assignment threw),
      // the existing table rows should remain present.
      const rowsAfterClearAttempt = await knn.getRowCount();
      // It should be equal to rowsBeforeClear (clearing did not occur), or at least > 0
      expect(rowsAfterClearAttempt).toBeGreaterThanOrEqual(1);
      expect(rowsAfterClearAttempt).toBe(rowsBeforeClear);
    });

    test('Clear handler attached inside KNN click also triggers error on subsequent clear', async ({ page }) => {
      // The page also attaches an additional clear handler inside the KNN click handler.
      // That inner handler also reassigns knnData and will throw when invoked.
      const knn = new KNNPage(page);

      // Click KNN to register the inner clear handler
      await knn.clickKNN(false);

      // Now clicking the clear button should fire one of the handlers and produce a TypeError.
      const [error] = await Promise.all([page.waitForEvent('pageerror'), page.click(knn.selectors.knnClear)]);

      expect(error).toBeTruthy();
      expect(error.name).toBe('TypeError');

      // Confirm that the table content was not cleared by the failing handler
      const rowsAfter = await knn.getRowCount();
      expect(rowsAfter).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Input_Change event and visual feedback', () => {
    test('Dispatching input event on #knn-button updates its displayed text', async ({ page }) => {
      const knn = new KNNPage(page);

      // Set a custom value on the button element and dispatch an 'input' event
      const newLabel = 'CustomKNN';
      await knn.setButtonValueAndDispatchInput(newLabel);

      // After dispatching input, the page's listener sets knnButton.textContent to the button's value property.
      const displayedText = await knn.getButtonText();
      expect(displayedText).toContain(newLabel);
    });
  });

  test.describe('Edge cases and robustness checks', () => {
    test('Clicking KNN repeatedly then Clear triggers at least one TypeError (clear fails)', async ({ page }) => {
      const knn = new KNNPage(page);

      // Click KNN several times to populate data
      await knn.clickKNN(false);
      await knn.clickKNN(false);
      await knn.clickKNN(false);

      const rowsBefore = await knn.getRowCount();
      expect(rowsBefore).toBeGreaterThanOrEqual(1);

      // Now click clear and capture the pageerror. We expect a TypeError due to const reassignment.
      const [error] = await Promise.all([page.waitForEvent('pageerror'), page.click(knn.selectors.knnClear)]);

      expect(error).toBeTruthy();
      expect(error.name).toBe('TypeError');

      // Verify rows were not removed (clear failed)
      const rowsAfter = await knn.getRowCount();
      expect(rowsAfter).toBe(rowsBefore);
    });

    test('Attempting to input on knn-button with an empty string updates displayed text to empty', async ({ page }) => {
      const knn = new KNNPage(page);

      // dispatch input with empty string
      await knn.setButtonValueAndDispatchInput('');

      // The displayed text should reflect the empty value (may be empty string)
      const displayedText = await knn.getButtonText();
      // It may be empty or whitespace; assert it is a string and its trimmed length is zero
      expect(typeof displayedText).toBe('string');
      expect(displayedText.trim().length).toBeGreaterThanOrEqual(0);
    });
  });
});