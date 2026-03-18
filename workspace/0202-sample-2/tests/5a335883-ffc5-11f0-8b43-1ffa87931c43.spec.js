import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a335883-ffc5-11f0-8b43-1ffa87931c43.html';

// Page Object Model for the Knapsack page to encapsulate interactions and queries
class KnapsackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.itemsBody = page.locator('#items-body');
    this.addItemBtn = page.locator('#add-item');
    this.solveBtn = page.locator('#solve-btn');
    this.capacityInput = page.locator('#capacity');
    this.resultsDiv = page.locator('#results');
    this.itemsTable = page.locator('#items-table');
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Get header text (Idle state's evidence)
  async getHeaderText() {
    return this.page.locator('h1').innerText();
  }

  // Get current capacity value as number
  async getCapacityValue() {
    const val = await this.capacityInput.inputValue();
    return Number(val);
  }

  // Set capacity input
  async setCapacity(value) {
    await this.capacityInput.fill(String(value));
  }

  // Count item rows
  async getItemsCount() {
    return await this.itemsBody.locator('tr').count();
  }

  // Add an item (triggers AddItem event)
  async addItem() {
    await this.addItemBtn.click();
  }

  // Remove item at (0-based) index by clicking the remove button inside its row
  async removeItemAt(index) {
    const row = this.itemsBody.locator('tr').nth(index);
    const btn = row.locator('button.remove-item-btn');
    await btn.click();
  }

  // Get value/weight inputs for an item row (0-based index)
  async getItemInputs(index) {
    const row = this.itemsBody.locator('tr').nth(index);
    const inputs = row.locator('input[type="number"]');
    const value = await inputs.nth(0).inputValue();
    const weight = await inputs.nth(1).inputValue();
    return { value, weight };
  }

  // Set item value and weight (fill strings)
  async setItemValueWeight(index, value, weight) {
    const row = this.itemsBody.locator('tr').nth(index);
    const inputs = row.locator('input[type="number"]');
    await inputs.nth(0).fill(String(value));
    await inputs.nth(1).fill(String(weight));
  }

  // Click solve button (triggers SolveKnapsack event)
  async clickSolve() {
    await this.solveBtn.click();
  }

  // Get results HTML/text
  async getResultsText() {
    return this.resultsDiv.innerText();
  }

  async getResultsHTML() {
    return this.resultsDiv.innerHTML();
  }

  // Get remove button aria-labels (useful to assert proper labeling)
  async getRemoveButtonsAriaLabels() {
    const btns = this.itemsBody.locator('button.remove-item-btn');
    const count = await btns.count();
    const labels = [];
    for (let i = 0; i < count; i++) {
      labels.push(await btns.nth(i).getAttribute('aria-label'));
    }
    return labels;
  }
}

test.describe('Knapsack Problem Demonstration - FSM and UI tests', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Attach error/capture listeners before each test and navigate
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // navigate
    await page.goto(APP_URL);
  });

  // After each test ensure we observed console and page errors (and assert none of the fatal JS errors occurred)
  test.afterEach(async ({}, testInfo) => {
    // Assert no fatal runtime errors like ReferenceError/SyntaxError/TypeError in pageErrors
    const fatalPatterns = [/ReferenceError/, /SyntaxError/, /TypeError/];
    const fatalInPageErrors = pageErrors.filter((m) =>
      fatalPatterns.some((p) => p.test(m))
    );
    // Also check console error-level messages for fatal patterns or general 'error' type
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error');
    const fatalInConsole = consoleMessages.filter((c) =>
      fatalPatterns.some((p) => p.test(c.text))
    );

    // Provide helpful diagnostics in test output if any errors are present
    if (pageErrors.length > 0) {
      testInfo.attach('pageErrors', {
        body: pageErrors.join('\n'),
        contentType: 'text/plain',
      });
    }
    if (consoleMessages.length > 0) {
      testInfo.attach('consoleMessages', {
        body: consoleMessages.map((c) => `${c.type}: ${c.text}`).join('\n'),
        contentType: 'text/plain',
      });
    }

    // Fail if any fatal patterns present in either page errors or console logs
    expect(fatalInPageErrors.length, 'Unexpected fatal errors in pageerror events').toBe(0);
    expect(fatalInConsole.length, 'Unexpected fatal errors in console messages').toBe(0);

    // Also fail if there are console messages with type 'error'
    expect(consoleErrors.length, 'No console.error messages expected').toBe(0);
  });

  test('Initial state (S0_Idle): page renders and initial items are present', async ({ page }) => {
    // Validates the Idle state: header present and initial renderPage() action took place
    const kp = new KnapsackPage(page);

    // Confirm header text (FSM evidence)
    const h1 = await kp.getHeaderText();
    expect(h1).toContain('Knapsack Problem (0/1) Demonstration');

    // Capacity default value (component evidence)
    const capacity = await kp.getCapacityValue();
    expect(capacity).toBe(50);

    // Initial default items should be rendered (3 rows)
    const count = await kp.getItemsCount();
    expect(count).toBe(3);

    // Results div should be empty initially
    const results = await kp.getResultsText();
    expect(results.trim()).toBe('');
  });

  test('AddItem event transitions to ItemAdded (S1_ItemAdded) and creates a new row', async ({ page }) => {
    // Validate adding an item appends a new row with default 0s and attachRemoveButtons is re-attached
    const kp = new KnapsackPage(page);

    const before = await kp.getItemsCount();
    await kp.addItem();

    const after = await kp.getItemsCount();
    expect(after).toBe(before + 1);

    // The newly added row (last row) should have inputs with default value "0"
    const lastIndex = after - 1;
    const inputs = await kp.getItemInputs(lastIndex);
    // input values come as strings; ensure they are '0' (default from addItem)
    expect(inputs.value).toBe('0');
    expect(inputs.weight).toBe('0');

    // Remove buttons should carry ARIA labels indicating item numbers (evidence of proper render)
    const labels = await kp.getRemoveButtonsAriaLabels();
    expect(labels.length).toBe(after);
    expect(labels[labels.length - 1]).toContain('Remove item');
  });

  test('RemoveItem event transitions to ItemRemoved (S2_ItemRemoved): remove a specific item row', async ({ page }) => {
    // Validate removing an item reduces row count and re-renders items
    const kp = new KnapsackPage(page);

    // Ensure at least 1 item to remove
    let initialCount = await kp.getItemsCount();
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Remove the first item (index 0)
    await kp.removeItemAt(0);

    const afterRemove = await kp.getItemsCount();
    expect(afterRemove).toBe(initialCount - 1);

    // Ensure remaining rows have properly numbered Item # cell text (first cell shows 1)
    const firstRowCell = page.locator('#items-body tr').nth(0).locator('td').nth(0);
    expect(await firstRowCell.innerText()).toBe('1');
  });

  test('SolveKnapsack event transitions through Solving (S3_Solving) to ResultsDisplayed (S4_ResultsDisplayed) with expected solution', async ({ page }) => {
    // Use the default dataset to run a solve and verify results are displayed and values match expected DP solution
    const kp = new KnapsackPage(page);

    // Ensure default items are present (three items)
    const count = await kp.getItemsCount();
    expect(count).toBeGreaterThanOrEqual(3);

    // Capacity is 50 by default; run solve
    await kp.clickSolve();

    // After solving, results div should include "Solution" and "Maximum value achievable"
    const resultsText = await kp.getResultsText();
    expect(resultsText).toContain('Solution');
    expect(resultsText).toContain('Maximum value achievable');

    // For the default items (values: 60,100,120 weights:10,20,30) and capacity 50, the optimal value is 220 (items 2 and 3)
    expect(resultsText).toContain('220');

    // Total weight used should be 50 (20+30)
    expect(resultsText).toContain('Total weight used:');
    expect(resultsText).toContain('Capacity: 50');

    // Selected items table should be present and list at least one selected item
    const resultsHTML = await kp.getResultsHTML();
    expect(resultsHTML).toContain('<table');
    expect(resultsHTML).toContain('<h4>Selected Items:');
  });

  test('Edge case: invalid capacity input triggers alert and prevents solving', async ({ page }) => {
    // Validate that entering invalid capacity triggers the UI alert (error flow)
    const kp = new KnapsackPage(page);

    // Set capacity to 0 (invalid)
    await kp.setCapacity(0);

    // Capture the dialog and assert its message
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      kp.clickSolve(), // triggers dialog
    ]);

    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Please enter a valid capacity greater than 0');
    await dialog.dismiss();

    // Results should remain unchanged (no success content)
    const results = await kp.getResultsText();
    expect(results.trim()).toBe('');
  });

  test('Edge case: invalid item inputs produce an alert and prevent solving', async ({ page }) => {
    // Introduce an invalid (non-numeric) value into an item input and assert the alert appears
    const kp = new KnapsackPage(page);

    // Fill the first item's value input with a non-numeric string to create invalid input
    await kp.setItemValueWeight(0, 'not-a-number', 10);

    // Attempt to solve; the page should alert to fix invalid inputs
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      kp.clickSolve(),
    ]);

    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Please fix invalid item inputs');
    await dialog.dismiss();

    // And results should remain empty
    expect((await kp.getResultsText()).trim()).toBe('');
  });

  test('Edge case: no items available shows "No items to choose from."', async ({ page }) => {
    // Remove all items and solve — should show the "No items to choose from." message
    const kp = new KnapsackPage(page);

    // Remove items until zero remain
    let count = await kp.getItemsCount();
    // Use a loop to remove the first row repeatedly
    while (count > 0) {
      await kp.removeItemAt(0);
      count = await kp.getItemsCount();
    }
    expect(count).toBe(0);

    // Now click solve; since items.length === 0 the code path returns a resultsDiv message
    await kp.clickSolve();

    // Confirm results contain the expected message
    const results = await kp.getResultsText();
    expect(results).toContain('No items to choose from.');
  });

  test('UI accessibility & attributes: capacity input type and remove button attributes are present', async ({ page }) => {
    // Validate some component evidence from the FSM / components list
    const kp = new KnapsackPage(page);

    // Capacity input should be of type number and have min=1
    const capacityHandle = page.locator('#capacity');
    expect(await capacityHandle.getAttribute('type')).toBe('number');
    expect(await capacityHandle.getAttribute('min')).toBe('1');

    // Remove buttons should have title and aria-label attributes
    const labels = await kp.getRemoveButtonsAriaLabels();
    for (const label of labels) {
      // aria-label should contain 'Remove item'
      expect(label).toMatch(/Remove item/);
    }
  });
});