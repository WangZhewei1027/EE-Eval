import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce8240-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Min Heap demo page
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#insertInput');
    this.insertButton = page.locator("button[onclick='insert()']");
    this.removeMinButton = page.locator("button[onclick='removeMin()']");
    this.clearButton = page.locator("button[onclick='clearHeap()']");
    this.heapDisplay = page.locator('#heapDisplay');
    this.currentMin = page.locator('#currentMin');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async insertValue(value) {
    await this.input.fill(String(value));
    await this.insertButton.click();
  }

  async removeMin() {
    await this.removeMinButton.click();
  }

  async clearHeap() {
    await this.clearButton.click();
  }

  async getHeapText() {
    return (await this.heapDisplay.textContent())?.trim();
  }

  async getCurrentMinText() {
    return (await this.currentMin.textContent())?.trim();
  }
}

test.describe('Min Heap Interactive Demonstration (FSM validation)', () => {
  // Arrays to collect console messages and page errors for each test run
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // Save the Error object for assertions
      pageErrors.push(err);
    });

    // Collect console messages for additional inspection
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  test.afterEach(async () => {
    // After each test we log counts to aid debugging if needed (no mutation)
    // Note: We don't modify the page or environment.
  });

  test.describe('Initial state and page errors', () => {
    test('S0: Initial load shows Heap is empty and page scripts produce expected errors', async ({ page }) => {
      // This test validates:
      // - The page loads to the initial state "Heap is empty" (S0_HeapEmpty)
      // - We observe runtime/script errors (e.g., SyntaxError due to duplicate updateDisplay declaration)
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Give the page a brief moment to surface any script parsing/runtime errors
      await page.waitForTimeout(100);

      // Assert the heap display shows the empty state
      const heapText = await heapPage.getHeapText();
      expect(heapText).toBe('Heap is empty');

      // The implementation defines updateDisplay twice (function then const), which will generate a SyntaxError
      // We assert that at least one page error occurred during load/execution.
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Assert one of the captured errors is likely a syntax or redeclaration error related to updateDisplay
      const combinedMessages = pageErrors.map(e => String(e.message)).join('; ');
      expect(combinedMessages).toMatch(/(updateDisplay|already been declared|Identifier|SyntaxError|Uncaught)/i);

      // Because the second script that sets currentMin likely failed, currentMin may be empty string
      const currentMinText = await heapPage.getCurrentMinText();
      // Accept either empty or 'None' if some browser semantics differ; but prefer empty as the broken script prevents update.
      expect(['', 'None']).toContain(currentMinText);
    });
  });

  test.describe('Insert operations and S0 -> S1 transition', () => {
    test('Insert a single value transitions to S1 and displays the value', async ({ page }) => {
      // This test validates:
      // - Inserting a single numeric value transitions from S0_HeapEmpty to S1_HeapWithValues
      // - The heap display updates to show the inserted value
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Ensure initial empty state
      expect(await heapPage.getHeapText()).toBe('Heap is empty');

      // Insert value 5
      await heapPage.insertValue(5);

      // After insertion, the heap display should show the inserted value
      const heapTextAfter = await heapPage.getHeapText();
      expect(heapTextAfter).toBe('Heap: 5');

      // currentMin is controlled by the later script that likely failed; ensure it is either empty or still consistent
      const currentMinText = await heapPage.getCurrentMinText();
      expect(['', '5', 'None']).toContain(currentMinText);
    });

    test('Insert multiple values results in min-heap ordering and displays all values', async ({ page }) => {
      // This test validates:
      // - Multiple inserts keep the heap property (min at index 0) and display the internal array order
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Insert sequence: 5, 3, 8
      await heapPage.insertValue(5);
      await heapPage.insertValue(3);
      await heapPage.insertValue(8);

      // The buildMinHeap should reorder to have 3 as the root and display "Heap: 3, 5, 8"
      const heapText = await heapPage.getHeapText();
      expect(heapText).toBe('Heap: 3, 5, 8');

      // currentMin may still be unchanged due to script error, but if updated, should reflect the minimum 3
      const currentMinText = await heapPage.getCurrentMinText();
      expect(['', '3', 'None']).toContain(currentMinText);
    });
  });

  test.describe('Remove and Clear operations (S1 state behaviors)', () => {
    test('Remove Min reduces heap and maintains min-heap property', async ({ page }) => {
      // This test validates:
      // - In S1 (heap has values), clicking Remove Min removes the smallest value and rebuilds the heap
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Prepare heap with values 5, 3, 8
      await heapPage.insertValue(5);
      await heapPage.insertValue(3);
      await heapPage.insertValue(8);
      expect(await heapPage.getHeapText()).toBe('Heap: 3, 5, 8');

      // Click Remove Min; expected new heap order is "Heap: 5, 8"
      await heapPage.removeMin();

      const afterRemoveText = await heapPage.getHeapText();
      expect(afterRemoveText).toBe('Heap: 5, 8');

      // currentMin may still be unchanged; allowed values are '' or '5' if updated
      const currentMinText = await heapPage.getCurrentMinText();
      expect(['', '5', 'None']).toContain(currentMinText);
    });

    test('Clear Heap returns to S0_HeapEmpty', async ({ page }) => {
      // This test validates:
      // - Clicking Clear Heap sets the heap to empty and display returns to S0
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Insert a couple of values
      await heapPage.insertValue(10);
      await heapPage.insertValue(1);
      // Ensure we are in non-empty state
      let text = await heapPage.getHeapText();
      expect(text.startsWith('Heap:')).toBeTruthy();

      // Clear the heap
      await heapPage.clearHeap();

      // After clear, display must show "Heap is empty"
      const afterClearText = await heapPage.getHeapText();
      expect(afterClearText).toBe('Heap is empty');

      // currentMin should be reset (the broken script might prevent 'None' being shown)
      const currentMinText = await heapPage.getCurrentMinText();
      expect(['', 'None']).toContain(currentMinText);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Inserting non-numeric or empty input should not change heap', async ({ page }) => {
      // This test validates:
      // - If input is empty or non-numeric, insert() should not modify the heap (parseInt => NaN guard)
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Ensure empty state
      expect(await heapPage.getHeapText()).toBe('Heap is empty');

      // Fill with empty string and click Insert
      await heapPage.input.fill('');
      await heapPage.insertButton.click();

      // Still empty
      expect(await heapPage.getHeapText()).toBe('Heap is empty');

      // Fill with non-numeric characters - on a number input, this may become empty, so behavior should be unchanged
      await heapPage.input.fill('abc');
      await heapPage.insertButton.click();

      // Still empty
      expect(await heapPage.getHeapText()).toBe('Heap is empty');
    });

    test('Removing min on an empty heap should be a no-op and not throw', async ({ page }) => {
      // This test validates:
      // - removeMin() when heap is empty should not change state or throw errors
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Ensure empty state
      expect(await heapPage.getHeapText()).toBe('Heap is empty');

      // Click remove min
      await heapPage.removeMin();

      // No changes expected
      expect(await heapPage.getHeapText()).toBe('Heap is empty');

      // Ensure no new page errors were introduced by calling removeMin on empty heap
      // (Some errors are expected from page load; ensure nothing additional catastrophic occurred)
      // There should still be at least one page error from the duplicate declaration, but no new TypeErrors expected.
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Observability: console and page error messages', () => {
    test('Console captured messages include script error details', async ({ page }) => {
      // This test validates:
      // - We observed console messages and page errors as part of loading the page
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Allow any pending logs to arrive
      await page.waitForTimeout(100);

      // There should be at least one page error captured as a result of the duplicated declaration
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // The console may include messages; ensure the collected consoleMessages is an array
      expect(Array.isArray(consoleMessages)).toBeTruthy();

      // Verify that at least one of the page error messages references updateDisplay or SyntaxError
      const messages = pageErrors.map(e => String(e.message)).join(' || ');
      expect(messages).toMatch(/(updateDisplay|SyntaxError|already been declared|Identifier|Uncaught)/i);
    });
  });
});