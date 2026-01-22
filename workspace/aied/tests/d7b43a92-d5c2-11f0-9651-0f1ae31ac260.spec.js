import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b43a92-d5c2-11f0-9651-0f1ae31ac260.html';

/**
 * Page Object Model for the Knapsack Demo application.
 * Encapsulates common interactions and queries used across tests.
 */
class KnapsackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async getTitleText() {
    return this.page.locator('h1').innerText();
  }

  async getCapacityValue() {
    return (await this.page.locator('#capacity').inputValue()).toString();
  }

  async setCapacity(value) {
    await this.page.fill('#capacity', String(value));
  }

  async getItemRows() {
    return this.page.locator('#items-table tbody tr');
  }

  async getItemCount() {
    return await this.getItemRows().count();
  }

  // Add item via the UI button (click)
  async clickAddItem() {
    await this.page.click('#add-item-btn');
  }

  // Programmatically add an item by calling the add button multiple times is still clicking
  async addItemMany(n) {
    for (let i = 0; i < n; i++) {
      await this.clickAddItem();
    }
  }

  // Delete an item by clicking the delete button at 1-based index position
  async clickDeleteItemAt(indexOneBased) {
    const row = this.page.locator(`#items-table tbody tr:nth-child(${indexOneBased})`);
    const delBtn = row.locator('button.delete-item');
    await delBtn.click();
  }

  // Get delete button aria-label for a specific row (1-based)
  async getDeleteAriaLabel(indexOneBased) {
    const row = this.page.locator(`#items-table tbody tr:nth-child(${indexOneBased})`);
    return await row.locator('button.delete-item').getAttribute('aria-label');
  }

  // Get weight and value inputs for a row (1-based)
  async getWeightValueForRow(indexOneBased) {
    const row = this.page.locator(`#items-table tbody tr:nth-child(${indexOneBased})`);
    const weight = await row.locator('td:nth-child(2) input').inputValue();
    const value = await row.locator('td:nth-child(3) input').inputValue();
    return { weight, value };
  }

  async setWeightValueForRow(indexOneBased, weight, value) {
    const row = this.page.locator(`#items-table tbody tr:nth-child(${indexOneBased})`);
    await row.locator('td:nth-child(2) input').fill(String(weight));
    await row.locator('td:nth-child(3) input').fill(String(value));
  }

  async clickSolve() {
    await this.page.click('#solve-btn');
  }

  async getResultText() {
    return await this.page.locator('#result').innerText();
  }

  async getWarningText() {
    return await this.page.locator('#warning-msg').innerText();
  }
}

/**
 * Global helper to capture console messages and page errors.
 * Tests will assert on these captured arrays as part of runtime validation.
 */
function setupConsoleAndPageErrorCapture(page) {
  const consoleMessages = [];
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    if (type === 'error') {
      consoleErrors.push({ type, text });
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });

  return { consoleMessages, consoleErrors, pageErrors };
}

test.describe('Knapsack Problem Demo - FSM states and transitions', () => {
  let knapsack;
  let captures;

  test.beforeEach(async ({ page }) => {
    // Set up capture of runtime console messages and errors for each test
    captures = setupConsoleAndPageErrorCapture(page);
    knapsack = new KnapsackPage(page);
    await knapsack.goto();
    // Ensure page loaded
    await expect(page).toHaveURL(BASE_URL);
  });

  test.afterEach(async ({ }, testInfo) => {
    // If there were any page errors or console errors, include them in the test output for debugging
    if (captures.pageErrors.length > 0 || captures.consoleErrors.length > 0) {
      // Attach to test output (Playwright will display this)
      testInfo.attach('consoleMessages', { body: JSON.stringify(captures.consoleMessages, null, 2) });
      testInfo.attach('consoleErrors', { body: JSON.stringify(captures.consoleErrors, null, 2) });
      testInfo.attach('pageErrors', { body: JSON.stringify(captures.pageErrors.map(e => (e && e.stack) || String(e)), null, 2) });
    }
  });

  test.describe('Initial state - S0_Idle', () => {
    test('renders main heading and initial capacity input (entry action: renderPage)', async () => {
      // Validate initial evidence: heading text exists
      await expect(await knapsack.getTitleText()).toBe('Knapsack Problem Solver Demo');

      // Capacity input exists and has default value 10
      const capacityVal = await knapsack.getCapacityValue();
      expect(capacityVal).toBe('10');

      // Validate initial item table has prefilled rows (4 rows as per HTML)
      const itemCount = await knapsack.getItemCount();
      expect(itemCount).toBe(4);

      // Check first item's weight input value evidence "2"
      const first = await knapsack.getWeightValueForRow(1);
      expect(first.weight).toBe('2');
      expect(first.value).toBe('3');

      // Assert no unexpected runtime errors occurred during initial render
      expect(captures.pageErrors.length).toBe(0);
      expect(captures.consoleErrors.length).toBe(0);
    });
  });

  test.describe('Add / Delete item transitions (S0 -> S1 -> S2)', () => {
    test('AddItem: clicking "➕ Add Item" appends a new row to the table (transition S0_Idle -> S1_ItemAdded)', async () => {
      const beforeCount = await knapsack.getItemCount();
      await knapsack.clickAddItem();

      // After click, row count increases by 1
      const afterCount = await knapsack.getItemCount();
      expect(afterCount).toBe(beforeCount + 1);

      // The last row should have inputs (weight/value), default empty values in the implementation
      const lastIndex = afterCount;
      const lastRow = await knapsack.getWeightValueForRow(lastIndex);
      // The implementation uses value="${weight}" default '' so inputValue returns '' when empty
      expect(lastRow.weight).toBe('');
      expect(lastRow.value).toBe('');

      // The delete button aria-label on the new row should include the correct index
      const aria = await knapsack.getDeleteAriaLabel(lastIndex);
      expect(aria).toContain(String(lastIndex));

      // Assert no runtime errors were emitted by performing this UI operation
      expect(captures.pageErrors.length).toBe(0);
      expect(captures.consoleErrors.length).toBe(0);
    });

    test('DeleteItem: clicking a row delete removes it and updates row numbers (transition S1_ItemAdded -> S2_ItemDeleted)', async () => {
      // Ensure there is at least one deletable row
      const initialCount = await knapsack.getItemCount();
      expect(initialCount).toBeGreaterThanOrEqual(1);

      // Delete the second row
      await knapsack.clickDeleteItemAt(2);

      // Count decreased by one
      const afterCount = await knapsack.getItemCount();
      expect(afterCount).toBe(initialCount - 1);

      // Row numbers and aria-labels should be updated: check that row 2 now has aria label deleting item 2
      const ariaLabelRow2 = await knapsack.getDeleteAriaLabel(2);
      expect(ariaLabelRow2).toContain('2');

      // Validate that remaining first row still contains original data
      const first = await knapsack.getWeightValueForRow(1);
      expect(first.weight).toBe('2');
      expect(first.value).toBe('3');

      // Assert runtime stayed clean
      expect(captures.pageErrors.length).toBe(0);
      expect(captures.consoleErrors.length).toBe(0);
    });
  });

  test.describe('Solve knapsack transitions (S0 -> S3 -> S4)', () => {
    test('SolveKnapsack: solving with default inputs displays expected result (S3_Solving -> S4_ResultDisplayed)', async () => {
      // With default capacity 10 and 4 items, expected max value is 15 (items 1,2,4)
      await knapsack.clickSolve();

      // Wait for result content to be non-empty
      await expect(async () => (await knapsack.getResultText()).length).toBeGreaterThan(0);

      const result = await knapsack.getResultText();

      // Validate displayResult evidence: result includes capacity, number of items, max value, selected items and dp table header
      expect(result).toContain('Knapsack Capacity: 10');
      expect(result).toContain('Number of Items: 4');
      expect(result).toContain('Max Total Value: 15');

      // Ensure selected items lines include the expected items
      expect(result).toContain('Item 1 (weight: 2, value: 3)');
      expect(result).toContain('Item 2 (weight: 3, value: 4)');
      expect(result).toContain('Item 4 (weight: 5, value: 8)');

      // Ensure DP table header snippet is present
      expect(result).toContain('DP Table');

      // No runtime errors expected during solve
      expect(captures.pageErrors.length).toBe(0);
      expect(captures.consoleErrors.length).toBe(0);
    });

    test('Edge case: invalid capacity (0) triggers warning and prevents solving', async () => {
      // Set invalid capacity and attempt to solve
      await knapsack.setCapacity(0);
      await knapsack.clickSolve();

      // Expect a specific warning message
      const warn = await knapsack.getWarningText();
      expect(warn).toBe('Capacity must be an integer ≥ 1.');

      // Result area should stay empty
      const res = await knapsack.getResultText();
      expect(res.trim()).toBe('');

      // No page errors expected
      expect(captures.pageErrors.length).toBe(0);
      expect(captures.consoleErrors.length).toBe(0);
    });

    test('Edge case: invalid item weight (0) triggers warning and prevents solving', async () => {
      // Set first row weight to 0 to produce validation error from getItems()
      await knapsack.setWeightValueForRow(1, 0, 3);
      await knapsack.clickSolve();

      const warn = await knapsack.getWarningText();
      expect(warn).toBe('Weights must be integers ≥ 1.');

      // Result area remains empty
      const res = await knapsack.getResultText();
      expect(res.trim()).toBe('');

      expect(captures.pageErrors.length).toBe(0);
      expect(captures.consoleErrors.length).toBe(0);
    });

    test('Edge case: extremely large capacity triggers warning and prevents solving', async () => {
      // Set capacity to >10000 to trigger heuristic limit
      await knapsack.setCapacity(20000);
      await knapsack.clickSolve();

      const warn = await knapsack.getWarningText();
      expect(warn).toBe('Capacity too large - computation might take a long time.');

      const res = await knapsack.getResultText();
      expect(res.trim()).toBe('');

      expect(captures.pageErrors.length).toBe(0);
      expect(captures.consoleErrors.length).toBe(0);
    });
  });

  test.describe('Additional validations and invariants', () => {
    test('Row numbering and delete aria-labels update correctly after multiple add/delete operations', async () => {
      // Start from current state; record initial count
      const startCount = await knapsack.getItemCount();

      // Add two items
      await knapsack.clickAddItem();
      await knapsack.clickAddItem();
      const addedCount = await knapsack.getItemCount();
      expect(addedCount).toBe(startCount + 2);

      // Delete the first of the newly added items (which will be at position addedCount - 1)
      const deleteIndex = addedCount - 1;
      await knapsack.clickDeleteItemAt(deleteIndex);

      // Ensure count decreased by one
      const afterDeleteCount = await knapsack.getItemCount();
      expect(afterDeleteCount).toBe(addedCount - 1);

      // Verify aria-labels on all remaining rows are consistent with their row numbers
      const finalCount = afterDeleteCount;
      for (let i = 1; i <= finalCount; i++) {
        const aria = await knapsack.getDeleteAriaLabel(i);
        expect(aria).toContain(String(i));
      }

      expect(captures.pageErrors.length).toBe(0);
      expect(captures.consoleErrors.length).toBe(0);
    });

    test('No unexpected console errors or page exceptions during normal use', async () => {
      // Perform a set of typical interactions
      await knapsack.clickAddItem();
      await knapsack.setWeightValueForRow(1, 2, 3);
      await knapsack.setCapacity(10);
      await knapsack.clickSolve();

      // Confirm that no console error messages or page errors were raised
      expect(captures.consoleErrors.length).toBe(0);
      expect(captures.pageErrors.length).toBe(0);
    });
  });
});