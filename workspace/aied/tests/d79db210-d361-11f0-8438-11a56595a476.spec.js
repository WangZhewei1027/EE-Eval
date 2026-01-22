import { test, expect } from '@playwright/test';

// Test file for application:
// http://127.0.0.1:5500/workspace/batch-1207/html/d79db210-d361-11f0-8438-11a56595a476.html
// File name required: d79db210-d361-11f0-8438-11a56595a476.spec.js

// Page object encapsulating interactions with the Knapsack demo page
class KnapsackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.itemsInput = page.locator('#items-input');
    this.capacityInput = page.locator('#capacity-input');
    this.solveBtn = page.locator('#solve-btn');
    this.errorMsg = page.locator('#error-msg');
    this.outputArea = page.locator('#output-area');
    this.resultDiv = page.locator('#result');
    this.dpTable = page.locator('table[aria-label="Dynamic programming table for knapsack"]');
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/d79db210-d361-11f0-8438-11a56595a476.html', { waitUntil: 'load' });
  }

  async getHeadingText() {
    return this.page.locator('h1').textContent();
  }

  async getInitialItemsValue() {
    return this.itemsInput.inputValue();
  }

  async setItems(value) {
    await this.itemsInput.fill(value);
  }

  async setCapacity(value) {
    // capacity input is type=number; using fill ensures we can provide decimals too
    await this.capacityInput.fill(String(value));
    // blur to ensure any change is registered
    await this.capacityInput.evaluate((el) => el.blur());
  }

  async clickSolve() {
    await this.solveBtn.click();
  }

  async getErrorText() {
    return (await this.errorMsg.textContent()).trim();
  }

  async isOutputVisible() {
    // check computed style display
    const display = await this.outputArea.evaluate((el) => window.getComputedStyle(el).display);
    return display !== 'none';
  }

  async getResultHtml() {
    return this.resultDiv.innerHTML();
  }

  async getResultText() {
    return (await this.resultDiv.textContent()).trim();
  }

  async dpTableExists() {
    return this.dpTable.count().then(c => c > 0);
  }

  async getDpCellText(rowIndexZeroBased, colIndexZeroBased) {
    // table rows include header; we will read from tbody rows
    return this.dpTable.locator('tbody tr').nth(rowIndexZeroBased).locator('td').nth(colIndexZeroBased).textContent();
  }

  async findTakenItemSpans() {
    return this.resultDiv.locator('.item-list span').allTextContents();
  }

  async getHighlightedCells() {
    // return list of td elements that have inline background highlight (the code adds inline style only for the last cell at last row)
    return this.dpTable.locator('td').filter({ has: this.page.locator(':scope') }).evaluateAll((els) =>
      els.filter(e => e.getAttribute('style') && e.getAttribute('style').includes('background')).map(e => ({ text: e.textContent, style: e.getAttribute('style') }))
    );
  }
}

test.describe('Knapsack Problem Demo - FSM and UI tests', () => {
  // Collect console errors and page errors for each test and assert none are raised unexpectedly
  test.beforeEach(async ({ page }) => {
    // nothing global here; listeners will be attached per test below
  });

  // Test group for initial rendering (S0_Idle) and initial inputs (S1_Input)
  test.describe('Initial state and input validation (S0_Idle -> S1_Input)', () => {
    test('Initial render shows heading, input area and pre-filled example items', async ({ page }) => {
      // Attach listeners to capture console error messages and page errors
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
      });
      page.on('pageerror', err => pageErrors.push(err));

      const kp = new KnapsackPage(page);
      await kp.goto();

      // Validate S0_Idle evidence: header present
      await expect(page.locator('h1')).toHaveText('0/1 Knapsack Problem Solver');

      // Validate S1_Input evidence: textarea and capacity input present
      await expect(page.locator('#items-input')).toBeVisible();
      await expect(page.locator('#capacity-input')).toBeVisible();

      // The script pre-fills example items; verify that the textarea has the expected prefilled content
      const itemsVal = await kp.getInitialItemsValue();
      expect(itemsVal).toContain('60 10');
      expect(itemsVal).toContain('100 20');
      expect(itemsVal).toContain('120 30');

      // The capacity input has default value "50"
      const capacityVal = await page.locator('#capacity-input').inputValue();
      expect(capacityVal).toBe('50');

      // No unexpected console errors or page errors should have occurred during initial render
      expect(consoleErrors.length, `Console error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  // Test group for solving with valid input (S1_Input -> S3_Output)
  test.describe('Solve action and output rendering (S1_Input -> S3_Output)', () => {
    test('Clicking Solve with valid items and capacity displays correct result and dp table', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
      });
      page.on('pageerror', err => pageErrors.push(err));

      const kp = new KnapsackPage(page);
      await kp.goto();

      // Use the pre-filled example items and default capacity 50
      // Click Solve and verify output is displayed (S3_Output evidence)
      await kp.clickSolve();

      // Output area should be visible
      await expect(kp.outputArea).toBeVisible();
      expect(await kp.isOutputVisible()).toBe(true);

      // The result should indicate the correct maximum value for the example:
      // With items (60,10), (100,20), (120,30) and capacity 50 -> optimal is 220 (items 2 and 3)
      await expect(kp.resultDiv).toContainText('Maximum total value achievable: 220');

      // It should list items taken; ensure items 2 and 3 are present in the "Items taken" list
      const takenSpans = await kp.findTakenItemSpans();
      // The spans should include entries for Item 2 and Item 3
      const foundItem2 = takenSpans.some(s => s.includes('Item 2'));
      const foundItem3 = takenSpans.some(s => s.includes('Item 3'));
      expect(foundItem2, `Expected Item 2 to be in taken list: ${JSON.stringify(takenSpans)}`).toBeTruthy();
      expect(foundItem3, `Expected Item 3 to be in taken list: ${JSON.stringify(takenSpans)}`).toBeTruthy();

      // DP table should be present and contain final value 220 at last row, last column
      await expect(kp.dpTable).toBeVisible();
      const dpExists = await kp.dpTableExists();
      expect(dpExists).toBe(true);

      // Verify last cell (row for items.length, column capacity) contains 220
      // Find number of rows to determine last row index
      const rowCount = await kp.dpTable.locator('tbody tr').count();
      const lastRowIndex = rowCount - 1; // zero-based
      const colCount = await kp.dpTable.locator('thead tr th').count();
      const lastColIndex = colCount - 2; // subtract 1 for the initial header cell "i \ w" -> so last col index zero-based for td is (colCount - 2)
      // Acquire the text content of the last cell in tbody:
      const lastCellText = await kp.getDpCellText(lastRowIndex, lastColIndex);
      expect(String(lastCellText).trim()).toBe('220');

      // Check that the highlighted cell (inline background) exists and corresponds to the final cell (simple heuristic)
      const highlighted = await kp.dpTable.locator('td[style*="background:#d4edda"]').first();
      if (await highlighted.count() > 0) {
        const highlightedText = (await highlighted.textContent()).trim();
        // If highlight exists, it should show the maximum value 220
        expect(highlightedText).toBe('220');
      }

      // No unexpected console errors or page errors should have occurred during solving
      expect(consoleErrors.length, `Console error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  // Test group for input error handling (S1_Input -> S2_Error)
  test.describe('Input error scenarios leading to error state (S2_Error)', () => {
    test('Entering capacity 0 should show capacity positive integer error', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
      });
      page.on('pageerror', err => pageErrors.push(err));

      const kp = new KnapsackPage(page);
      await kp.goto();

      // Set capacity to 0 (invalid)
      await kp.setCapacity(0);
      await kp.clickSolve();

      // Expect an error message to be displayed in #error-msg
      await expect(kp.errorMsg).toBeVisible();
      const errText = await kp.getErrorText();
      expect(errText).toBe('Capacity must be a positive integer.');

      // Output area should remain hidden
      expect(await kp.isOutputVisible()).toBe(false);

      // No unexpected console/page errors (runtime) should have occurred
      expect(consoleErrors.length, `Console error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('Entering non-integer capacity (e.g., 2.5) should show capacity positive integer error', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
      });
      page.on('pageerror', err => pageErrors.push(err));

      const kp = new KnapsackPage(page);
      await kp.goto();

      // Set capacity to a non-integer
      await kp.setCapacity('2.5');
      await kp.clickSolve();

      await expect(kp.errorMsg).toBeVisible();
      const errText = await kp.getErrorText();
      expect(errText).toBe('Capacity must be a positive integer.');

      // Output must remain hidden
      expect(await kp.isOutputVisible()).toBe(false);

      expect(consoleErrors.length, `Console error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('Entering malformed item lines should show parse error (e.g., missing weight)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
      });
      page.on('pageerror', err => pageErrors.push(err));

      const kp = new KnapsackPage(page);
      await kp.goto();

      // Put malformed content into the items textarea
      await kp.setItems('100\n50 10'); // first line malformed: single number only
      // Set capacity to valid integer
      await kp.setCapacity(20);
      await kp.clickSolve();

      // Expect an error describing which line is invalid
      await expect(kp.errorMsg).toBeVisible();
      const errText = await kp.getErrorText();
      expect(errText).toMatch(/Line 1 invalid format/);

      // Output should remain hidden
      expect(await kp.isOutputVisible()).toBe(false);

      expect(consoleErrors.length, `Console error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('Entering items with non-numeric values should show parse error (value or weight invalid)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
      });
      page.on('pageerror', err => pageErrors.push(err));

      const kp = new KnapsackPage(page);
      await kp.goto();

      // Malformed numeric content
      await kp.setItems('abc def\n10 5');
      await kp.setCapacity(20);
      await kp.clickSolve();

      await expect(kp.errorMsg).toBeVisible();
      const errText = await kp.getErrorText();
      expect(errText).toMatch(/Line 1 has invalid value or weight/);

      // Output should remain hidden
      expect(await kp.isOutputVisible()).toBe(false);

      expect(consoleErrors.length, `Console error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('Empty items input should report "No valid items found."', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
      });
      page.on('pageerror', err => pageErrors.push(err));

      const kp = new KnapsackPage(page);
      await kp.goto();

      // Clear items
      await kp.setItems('');
      await kp.setCapacity(10);
      await kp.clickSolve();

      await expect(kp.errorMsg).toBeVisible();
      const errText = await kp.getErrorText();
      expect(errText).toBe('No valid items found.');

      // Output should remain hidden
      expect(await kp.isOutputVisible()).toBe(false);

      expect(consoleErrors.length, `Console error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  // Edge case: capacity smaller than any item weight -> no items can be taken
  test.describe('Edge case: capacity too small to take any item', () => {
    test('When capacity cannot fit any item, output indicates no items taken', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
      });
      page.on('pageerror', err => pageErrors.push(err));

      const kp = new KnapsackPage(page);
      await kp.goto();

      // Use pre-filled items but set capacity to 5 (too small for any item)
      await kp.setCapacity(5);
      await kp.clickSolve();

      // Output should be visible but indicate that no items can be taken
      await expect(kp.outputArea).toBeVisible();
      await expect(kp.resultDiv).toContainText('No items can be taken with the given capacity.');

      // Ensure maximum total value is 0
      await expect(kp.resultDiv).toContainText('Maximum total value achievable: 0');

      expect(consoleErrors.length, `Console error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });
});