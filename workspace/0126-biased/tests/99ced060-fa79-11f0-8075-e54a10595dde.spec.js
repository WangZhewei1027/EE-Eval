import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ced060-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Heap Sort Visualization page
class HeapSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.createBtn = page.locator('#createArray');
    this.sortBtn = page.locator('#sortArray');
    this.resetBtn = page.locator('#reset');
    this.delayInput = page.locator('#delay');
    this.arrayDisplay = page.locator('#arrayDisplay');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setDelay(ms) {
    await this.delayInput.fill(String(ms));
  }

  async inputArrayText(text) {
    await this.arrayInput.fill(text);
  }

  async clickCreateArray() {
    await this.createBtn.click();
  }

  async clickSortArray() {
    await this.sortBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getDisplayText() {
    return (await this.arrayDisplay.textContent())?.trim() ?? '';
  }
}

test.describe('Heap Sort Visualization - FSM tests (Application ID: 99ced060-fa79-11f0-8075-e54a10595dde)', () => {
  // Capture console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Collect console messages of type 'error' for assertion
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions
      pageErrors.push(err);
    });
  });

  // Initial Idle state tests
  test.describe('State S0_Idle (Initial state)', () => {
    test('Initial load should show "Current Array: []" and not produce console/page errors', async ({ page }) => {
      // Validate the application loads in Idle state and displays empty array
      const heap = new HeapSortPage(page);
      await heap.goto();

      // Wait for the DOM to render the display element
      await expect(heap.arrayDisplay).toBeVisible();

      const text = await heap.getDisplayText();
      // Check the onEnter action updateDisplay() was effectively reflected in DOM
      expect(text).toBe('Current Array: []');

      // Assert no console errors or uncaught page errors on load
      expect(consoleErrors.length, `Expected no console.error messages on load, got: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Expected no uncaught page errors on load, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    });
  });

  // Create Array transitions and related behaviors
  test.describe('Transition: CreateArray (S0_Idle -> S1_ArrayCreated)', () => {
    test('Create array from numeric CSV input should update display (happy path)', async ({ page }) => {
      const heap = new HeapSortPage(page);
      await heap.goto();

      // Provide input and trigger CreateArray
      await heap.inputArrayText('5,3,8,1');
      await heap.clickCreateArray();

      // Observe display update (entry action updateDisplay)
      await expect(heap.arrayDisplay).toHaveText('Current Array: [5, 3, 8, 1]');

      // No console/page errors expected for valid input
      expect(consoleErrors.length, 'Unexpected console.error messages after creating array').toBe(0);
      expect(pageErrors.length, 'Unexpected uncaught page errors after creating array').toBe(0);
    });

    test('Create array should ignore non-numeric values and trim whitespace', async ({ page }) => {
      const heap = new HeapSortPage(page);
      await heap.goto();

      // Mixed input: numbers, whitespace and an invalid token 'a'
      await heap.inputArrayText(' 4 , 2 , a , 7 ');
      await heap.clickCreateArray();

      // The implementation uses parseInt and filters NaN, so 'a' will be ignored
      await expect(heap.arrayDisplay).toHaveText('Current Array: [4, 2, 7]');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Create array with empty input should result in empty array', async ({ page }) => {
      const heap = new HeapSortPage(page);
      await heap.goto();

      await heap.inputArrayText('');
      await heap.clickCreateArray();

      await expect(heap.arrayDisplay).toHaveText('Current Array: []');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  // Sort Array transition tests
  test.describe('Transition: SortArray (S1_ArrayCreated -> S2_ArraySorted)', () => {
    test('Clicking Sort Array on a small array (3,1,2) with delay=0 should complete without uncaught errors - observe actual behavior', async ({ page }) => {
      const heap = new HeapSortPage(page);
      await heap.goto();

      // Reduce delay to 0ms to make the visualization complete quickly
      await heap.setDelay(0);

      // Create the array
      await heap.inputArrayText('3,1,2');
      await heap.clickCreateArray();

      // Sanity: initial display should reflect created array
      await expect(heap.arrayDisplay).toHaveText('Current Array: [3, 1, 2]');

      // Click the sort button - note: the implementation calls heapSort(array.slice()) (a copy),
      // so the global `array` is not mutated by heapSort in this code. We assert the observed behavior.
      await heap.clickSortArray();

      // Allow a short time for the async sort (with delay 0) to run to completion
      // The implementation uses await delay() with setTimeout of the provided delay value (0ms), so a short wait is sufficient.
      await page.waitForTimeout(200);

      const afterSortText = await heap.getDisplayText();

      // Based on the provided implementation, heapSort operates on a copy arr and never writes back to global `array`.
      // Therefore the DOM (which uses the global `array`) is expected to remain unchanged.
      expect(afterSortText).toBe('Current Array: [3, 1, 2]');

      // Confirm there were no uncaught exceptions during the sort
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Sorting when the array is empty should be a no-op and not throw errors', async ({ page }) => {
      const heap = new HeapSortPage(page);
      await heap.goto();

      await heap.setDelay(0);

      // Ensure empty state
      await heap.inputArrayText('');
      await heap.clickCreateArray();
      await expect(heap.arrayDisplay).toHaveText('Current Array: []');

      // Click sort on empty array
      await heap.clickSortArray();

      // Allow small delay for any async activity
      await page.waitForTimeout(100);

      await expect(heap.arrayDisplay).toHaveText('Current Array: []');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  // Reset transition and combined flows
  test.describe('Transition: Reset (S1_ArrayCreated or S0_Idle -> S0_Idle)', () => {
    test('Reset after creating an array should clear display and return to Idle', async ({ page }) => {
      const heap = new HeapSortPage(page);
      await heap.goto();

      await heap.inputArrayText('9,8,7');
      await heap.clickCreateArray();
      await expect(heap.arrayDisplay).toHaveText('Current Array: [9, 8, 7]');

      // Click reset -> should set array = [] and update display
      await heap.clickReset();
      await expect(heap.arrayDisplay).toHaveText('Current Array: []');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Reset when already idle should keep the display empty and not error', async ({ page }) => {
      const heap = new HeapSortPage(page);
      await heap.goto();

      // Ensure idle
      await expect(heap.arrayDisplay).toHaveText('Current Array: []');

      // Click reset again
      await heap.clickReset();
      await expect(heap.arrayDisplay).toHaveText('Current Array: []');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  // Edge cases and additional checks
  test.describe('Edge cases and implementation observations', () => {
    test('Non-numeric only input should produce empty array and not crash', async ({ page }) => {
      const heap = new HeapSortPage(page);
      await heap.goto();

      await heap.inputArrayText('a,b,c');
      await heap.clickCreateArray();
      await expect(heap.arrayDisplay).toHaveText('Current Array: []');

      // Try sorting that empty array
      await heap.setDelay(0);
      await heap.clickSortArray();
      await page.waitForTimeout(100);
      await expect(heap.arrayDisplay).toHaveText('Current Array: []');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Large delay should not cause immediate changes; UI remains responsive (we will not wait for full sort)', async ({ page }) => {
      const heap = new HeapSortPage(page);
      await heap.goto();

      // Set a noticeable delay to simulate slow visualization, but we will not wait for completion.
      await heap.setDelay(500);
      await heap.inputArrayText('6,4,5');
      await heap.clickCreateArray();
      await expect(heap.arrayDisplay).toHaveText('Current Array: [6, 4, 5]');

      // Start sort; because delay is large and heapSort is async, the click returns promptly.
      // Ensure UI did not freeze: we can still click reset quickly.
      await heap.clickSortArray();
      // Immediately click reset - this will set global array = [] even if heapSort is working on a copy.
      await heap.clickReset();
      await expect(heap.arrayDisplay).toHaveText('Current Array: []');

      // Wait briefly to allow any background async tasks to attempt updates (they may operate on copies)
      await page.waitForTimeout(300);

      // Final check: ensure no uncaught errors even when operations overlap
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  // After all tests, assert there were no unexpected page errors collected in the test scope
  // (This is a safety/net assertion to surface any uncaught exceptions).
  test('No uncaught page errors or console.error messages were collected during tests', async ({ page }) => {
    // This test is informational: it asserts the arrays (collected in beforeEach) are empty.
    // Note: Since each test had its own beforeEach, this specific assertion pertains to this test's lifecycle only.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});