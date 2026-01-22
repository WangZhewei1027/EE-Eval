import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17631820-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object for interacting with the Heap application
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = '#heapContainer';
    this.input = '#valueInput';
    this.insertMinBtn = "button[onclick='insertMinHeap()']";
    this.insertMaxBtn = "button[onclick='insertMaxHeap()']";
    this.removeMinBtn = "button[onclick='removeMinHeap()']";
    this.removeMaxBtn = "button[onclick='removeMaxHeap()']";
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async insertMin(value) {
    await this.page.fill(this.input, String(value));
    await this.page.click(this.insertMinBtn);
  }

  async insertMax(value) {
    await this.page.fill(this.input, String(value));
    await this.page.click(this.insertMaxBtn);
  }

  async removeMin() {
    await this.page.click(this.removeMinBtn);
  }

  async removeMax() {
    await this.page.click(this.removeMaxBtn);
  }

  // Returns array of numbers representing Min Heap DOM order (array representation)
  async getMinHeapArray() {
    return await this.page.evaluate(() => {
      const container = document.getElementById('heapContainer');
      if (!container || container.children.length === 0) return [];
      const minDiv = container.children[0];
      if (!minDiv) return [];
      const nodes = Array.from(minDiv.querySelectorAll('.node'));
      return nodes.map(n => {
        const v = n.textContent.trim();
        const num = Number(v);
        return isNaN(num) ? v : num;
      });
    });
  }

  // Returns array of numbers representing Max Heap DOM order (array representation)
  async getMaxHeapArray() {
    return await this.page.evaluate(() => {
      const container = document.getElementById('heapContainer');
      if (!container || container.children.length < 2) return [];
      const maxDiv = container.children[1];
      if (!maxDiv) return [];
      const nodes = Array.from(maxDiv.querySelectorAll('.node'));
      return nodes.map(n => {
        const v = n.textContent.trim();
        const num = Number(v);
        return isNaN(num) ? v : num;
      });
    });
  }

  // Helper to check if input cleared
  async isInputEmpty() {
    return (await this.page.$eval(this.input, el => el.value === ''));
  }
}

test.describe('Min/Max Heap Visualization - FSM validation', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors to assert later
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
  });

  test.afterEach(async () => {
    // After each test ensure there are no uncaught errors in the page
    // If there are any, fail the test with their messages for visibility
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  test('Idle state: initial render shows controls and empty heap container', async ({ page }) => {
    // Validate the Idle state S0_Idle: page loads, controls exist, heaps not yet displayed
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Controls should exist
    await expect(page.locator(heapPage.input)).toBeVisible();
    await expect(page.locator(heapPage.insertMinBtn)).toBeVisible();
    await expect(page.locator(heapPage.insertMaxBtn)).toBeVisible();
    await expect(page.locator(heapPage.removeMinBtn)).toBeVisible();
    await expect(page.locator(heapPage.removeMaxBtn)).toBeVisible();

    // Heap container should be empty initially (displayHeaps not invoked automatically)
    const heapChildren = await page.$eval('#heapContainer', el => el.children.length);
    expect(heapChildren).toBe(0);

    // FSM expected entry action for Idle was renderPage(), but the implementation does not define it.
    // Verify renderPage is not defined on the window (this demonstrates a mismatch between FSM and implementation)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');
  });

  test.describe('Insert operations', () => {
    test('Insert to Min Heap: single and multiple inserts result in proper min-heap root and DOM update (S1_MinHeapUpdated)', async ({ page }) => {
      // This validates transition S0_Idle -> S1_MinHeapUpdated for InsertMinHeap events
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Insert a single value and verify DOM updates
      await heapPage.insertMin(10);
      await expect(page.locator('#heapContainer')).toBeVisible();
      let minArray = await heapPage.getMinHeapArray();
      expect(minArray).toEqual([10]);
      expect(await heapPage.isInputEmpty()).toBe(true); // input cleared after insert

      // Insert more values to validate bubbleUpMin behavior
      await heapPage.insertMin(5);
      await heapPage.insertMin(15);
      minArray = await heapPage.getMinHeapArray();
      // The root should be the smallest value (5)
      expect(minArray.length).toBeGreaterThanOrEqual(3);
      expect(minArray[0]).toBe(5);
      // Children should include the other inserted values (10 and 15) in array representation
      expect(minArray).toEqual(expect.arrayContaining([5, 10, 15]));
    });

    test('Insert to Max Heap: single and multiple inserts result in proper max-heap root and DOM update (S2_MaxHeapUpdated)', async ({ page }) => {
      // This validates transition S0_Idle -> S2_MaxHeapUpdated for InsertMaxHeap events
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Insert single value to max heap
      await heapPage.insertMax(10);
      let maxArray = await heapPage.getMaxHeapArray();
      expect(maxArray).toEqual([10]);
      expect(await heapPage.isInputEmpty()).toBe(true);

      // Insert more values to validate bubbleUpMax behavior
      await heapPage.insertMax(20);
      await heapPage.insertMax(5);
      maxArray = await heapPage.getMaxHeapArray();
      // The root should be the largest value (20)
      expect(maxArray.length).toBeGreaterThanOrEqual(3);
      expect(maxArray[0]).toBe(20);
      expect(maxArray).toEqual(expect.arrayContaining([20, 10, 5]));
    });
  });

  test.describe('Remove operations', () => {
    test('Remove from Min Heap: removal with multiple elements updates heap root correctly (S3_MinHeapRemoved)', async ({ page }) => {
      // Validate S0_Idle -> S3_MinHeapRemoved when removing from a populated min heap
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Build a min heap: insert 10,5,15 -> array should be [5,10,15]
      await heapPage.insertMin(10);
      await heapPage.insertMin(5);
      await heapPage.insertMin(15);

      let before = await heapPage.getMinHeapArray();
      expect(before[0]).toBe(5);
      expect(before).toEqual(expect.arrayContaining([5, 10, 15]));

      // Perform removal (should remove root and bubble down)
      await heapPage.removeMin();

      const after = await heapPage.getMinHeapArray();
      // After removing root (5), new root should be next smallest (10)
      expect(after[0]).toBe(10);
      // Ensure that the heap length decreased (from 3 to 2)
      expect(after.length).toBe(before.length - 1);
    });

    test('Remove from Max Heap: removal with multiple elements updates heap root correctly (S4_MaxHeapRemoved)', async ({ page }) => {
      // Validate S0_Idle -> S4_MaxHeapRemoved when removing from a populated max heap
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Build a max heap: insert 10,20,5 -> array should be [20,10,5]
      await heapPage.insertMax(10);
      await heapPage.insertMax(20);
      await heapPage.insertMax(5);

      const before = await heapPage.getMaxHeapArray();
      expect(before[0]).toBe(20);
      expect(before).toEqual(expect.arrayContaining([20, 10, 5]));

      // Perform removal (should remove root and bubble down)
      await heapPage.removeMax();

      const after = await heapPage.getMaxHeapArray();
      // After removing root (20), new root should be next largest (10)
      expect(after[0]).toBe(10);
      expect(after.length).toBe(before.length - 1);
    });

    test('Edge case: removing single element behaves unexpectedly due to implementation details (documented bug)', async ({ page }) => {
      // The implementation uses minHeap[0] = minHeap.pop(); which for a single-element heap
      // will pop the element and then assign it back to index 0 -> element remains.
      // This test demonstrates that behavior (S3_MinHeapRemoved & S4_MaxHeapRemoved edge case)
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Min heap single element removal
      await heapPage.insertMin(7);
      let minBefore = await heapPage.getMinHeapArray();
      expect(minBefore).toEqual([7]);

      await heapPage.removeMin();
      // Due to the implementation bug, the single element remains instead of being removed.
      const minAfter = await heapPage.getMinHeapArray();
      // Assert observed (buggy) behavior: element remains
      expect(minAfter).toEqual([7]);

      // Max heap single element removal
      await heapPage.insertMax(9);
      let maxBefore = await heapPage.getMaxHeapArray();
      expect(maxBefore).toEqual([9]);

      await heapPage.removeMax();
      const maxAfter = await heapPage.getMaxHeapArray();
      // Observed behavior: element remains
      expect(maxAfter).toEqual([9]);
    });

    test('Edge case: removing from empty heap does nothing and does not throw', async ({ page }) => {
      // Validate no-op behavior when removing from empty heaps and ensure no errors thrown
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Ensure heaps are empty
      let minArray = await heapPage.getMinHeapArray();
      let maxArray = await heapPage.getMaxHeapArray();
      expect(minArray).toEqual([]);
      expect(maxArray).toEqual([]);

      // Removing from empty heaps should not throw and heaps remain empty
      await heapPage.removeMin();
      await heapPage.removeMax();

      minArray = await heapPage.getMinHeapArray();
      maxArray = await heapPage.getMaxHeapArray();
      expect(minArray).toEqual([]);
      expect(maxArray).toEqual([]);
    });
  });

  test.describe('Input validation and robustness', () => {
    test('Non-numeric or empty input does not alter heaps and does not throw', async ({ page }) => {
      // Ensure that parseInt of empty input leads to no change (isNaN guard)
      const heapPage = new HeapPage(page);
      await heapPage.goto();

      // Start with empty heaps
      expect(await heapPage.getMinHeapArray()).toEqual([]);
      expect(await heapPage.getMaxHeapArray()).toEqual([]);

      // Try to insert empty input into min heap
      await page.fill('#valueInput', '');
      await page.click("button[onclick='insertMinHeap()']");
      expect(await heapPage.getMinHeapArray()).toEqual([]);

      // Try to insert empty input into max heap
      await page.fill('#valueInput', '');
      await page.click("button[onclick='insertMaxHeap()']");
      expect(await heapPage.getMaxHeapArray()).toEqual([]);

      // Try invalid non-numeric string via direct JS (page input type is number, but simulate)
      await page.evaluate(() => {
        const input = document.getElementById('valueInput');
        // Directly set a non-numeric value (bypassing browser number input constraints)
        input.value = 'abc';
      });
      await page.click("button[onclick='insertMinHeap()']");
      await page.click("button[onclick='insertMaxHeap()']");

      // No changes expected
      expect(await heapPage.getMinHeapArray()).toEqual([]);
      expect(await heapPage.getMaxHeapArray()).toEqual([]);
    });
  });
});