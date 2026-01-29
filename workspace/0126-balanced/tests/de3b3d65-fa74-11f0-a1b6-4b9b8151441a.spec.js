import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b3d65-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object for the Min Heap page
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#heap-input');
    this.insertBtn = page.locator('button', { hasText: 'Insert' });
    this.extractBtn = page.locator('button', { hasText: 'Extract Min' });
    this.generateBtn = page.locator('button', { hasText: 'Generate Random Heap' });
    this.clearBtn = page.locator('button', { hasText: 'Clear Heap' });
    this.heapArray = page.locator('#heap-array');
    this.heapSize = page.locator('#heap-size');
    this.heapTree = page.locator('#heap-tree');
    this.heapNodes = page.locator('#heap-tree .node');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeapArrayText() {
    return (await this.heapArray.textContent())?.trim() ?? '';
  }

  async getHeapSizeNumber() {
    const txt = (await this.heapSize.textContent())?.trim() ?? '0';
    return Number(txt);
  }

  async getHeapNodeTexts() {
    const count = await this.heapNodes.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.heapNodes.nth(i).textContent())?.trim() ?? '');
    }
    return texts;
  }

  async insertValue(value) {
    await this.input.fill(String(value));
    await this.insertBtn.click();
  }

  async clickInsertExpectInvalidAlert() {
    // Click Insert with blank input and return dialog message
    await this.input.fill('');
    const dialog = await this.page.waitForEvent('dialog');
    // Trigger click after setting up dialog listener
    await Promise.all([
      this.page.waitForEvent('dialog'),
      this.insertBtn.click(),
    ]).catch(() => {
      // ignored - we will handle dialog via single wait below
    });
    // Wait for the dialog that was triggered by the click
    // Note: one of the waits above may have already consumed the dialog; ensure we capture using waitForEvent with timeout
  }

  async clickGenerateRandom() {
    await this.generateBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async clickExtract() {
    await this.extractBtn.click();
  }
}

test.describe('Min Heap Visualization - FSM validation', () => {
  // Track page errors and console errors for assertions
  test.beforeEach(async ({ page }) => {
    // No-op here; each test will create its own HeapPage and goto
  });

  // Helper to collect console errors and page errors during a run
  async function captureErrorsDuring(page, runAction) {
    const consoleMessages = [];
    const pageErrors = [];
    const consoleListener = (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    const pageErrorListener = (err) => {
      pageErrors.push(err);
    };
    page.on('console', consoleListener);
    page.on('pageerror', pageErrorListener);

    try {
      await runAction();
    } finally {
      page.off('console', consoleListener);
      page.off('pageerror', pageErrorListener);
    }

    return { consoleMessages, pageErrors };
  }

  test('Initial Heap State (S0_HeapInitialized): verify entry actions populated the heap and visualization', async ({ page }) => {
    // This test validates the initial state: heap was initialized with specific entry actions
    const heap = new HeapPage(page);

    const { consoleMessages, pageErrors } = await captureErrorsDuring(page, async () => {
      await heap.goto();
      // Wait for initial visualization to be rendered
      await expect(heap.heapArray).toHaveText(/\[/); // ensure array text exists
      await expect(heap.heapSize).toHaveText('5');
    });

    // Assert no runtime page errors occurred during load
    expect(pageErrors.length).toBe(0);

    // The MinHeap inserts [10,5,15,3,7] on init and heapifies to [3, 5, 15, 10, 7]
    const arrText = await heap.getHeapArrayText();
    expect(arrText).toBe('[3, 5, 15, 10, 7]');

    const size = await heap.getHeapSizeNumber();
    expect(size).toBe(5);

    const nodes = await heap.getHeapNodeTexts();
    // DOM nodes should reflect level-order representation of the heap
    expect(nodes.length).toBe(5);
    expect(nodes).toEqual(['3', '5', '15', '10', '7']);

    // Ensure there were no console 'error' type messages during initialization
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('InsertValue transition: inserting a new smaller value updates heap size and structure', async ({ page }) => {
    // This test validates insert transition from S0_HeapInitialized to S0_HeapInitialized
    const heap1 = new HeapPage(page);

    const { consoleMessages, pageErrors } = await captureErrorsDuring(page, async () => {
      await heap.goto();
      // Insert the value 2 which should become the new min
      await heap.insertValue(2);

      // After insert, size should increase to 6
      await expect(heap.heapSize).toHaveText('6');

      // Array should reflect heap ordering after insert of 2
      await expect(heap.heapArray).toHaveText('[2, 5, 3, 10, 7, 15]');
    });

    expect(pageErrors.length).toBe(0);
    const arr = await heap.getHeapArrayText();
    expect(arr).toBe('[2, 5, 3, 10, 7, 15]');

    const nodes1 = await heap.getHeapNodeTexts();
    expect(nodes.length).toBe(6);
    expect(nodes[0]).toBe('2'); // new min at the root

    // Ensure no console errors were emitted during insert
    const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('InsertValue edge case: inserting invalid input shows alert and does not change heap', async ({ page }) => {
    // This test validates the invalid input guard and alert behavior
    const heap2 = new HeapPage(page);
    await heap.goto();

    // Ensure starting size is 5
    await expect(heap.heapSize).toHaveText('5');

    // Set up dialog handling and click Insert with empty input
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      heap.insertBtn.click(), // input is empty by default
    ]);
    expect(dialog.message()).toBe('Please enter a valid number');
    await dialog.accept();

    // Heap should remain unchanged after invalid insert
    await expect(heap.heapSize).toHaveText('5');
    const arrText1 = await heap.getHeapArrayText();
    expect(arrText).toBe('[3, 5, 15, 10, 7]');
  });

  test('ExtractMin transition: extracting when non-empty returns the min and updates visualization', async ({ page }) => {
    // This test validates ExtractMin transition when heap is non-empty
    const heap3 = new HeapPage(page);
    await heap.goto();

    // The min at initialization should be 3
    // Click Extract Min and handle the alert showing the extracted value
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      heap.extractBtn.click(),
    ]);
    expect(dialog.message()).toBe('Extracted minimum value: 3');
    await dialog.accept();

    // After extraction, heap size should decrease to 4 and array changed accordingly
    await expect(heap.heapSize).toHaveText('4');
    const arrText2 = await heap.getHeapArrayText();
    expect(arrText).toBe('[5, 7, 15, 10]');

    const nodes2 = await heap.getHeapNodeTexts();
    expect(nodes.length).toBe(4);
    expect(nodes).toEqual(['5', '7', '15', '10']);
  });

  test('ExtractMin on Empty (S1_HeapEmpty): clearing then extracting triggers empty-heap alert', async ({ page }) => {
    // This test validates guard behavior that leads to S1_HeapEmpty with an alert
    const heap4 = new HeapPage(page);
    await heap.goto();

    // Clear the heap first
    await heap.clickClear();

    // After clearing, size should be 0 and visualization should show 'Heap is empty'
    await expect(heap.heapSize).toHaveText('0');
    await expect(heap.heapArray).toHaveText('[]');
    await expect(heap.heapTree).toContainText('Heap is empty');

    // Now attempt to extract min - should show 'Heap is empty!' and return null (no extracted alert)
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      heap.extractBtn.click(),
    ]);
    expect(dialog.message()).toBe('Heap is empty!');
    await dialog.accept();

    // Ensure still empty
    await expect(heap.heapSize).toHaveText('0');
    const nodesCount = await heap.heapNodes.count();
    expect(nodesCount).toBe(0);
  });

  test('GenerateRandomHeap transition: populates heap with random values and updates visualization', async ({ page }) => {
    // This test validates generation of a random heap (size between 5 and 14)
    const heap5 = new HeapPage(page);

    await heap.goto();

    // Click Generate Random Heap and wait for changes
    await heap.generateBtn.click();

    // Size should be between 5 and 14 inclusive
    // Wait until heap-size becomes >=5 (the function ensures 5-14)
    await page.waitForFunction(() => {
      const el = document.getElementById('heap-size');
      return el && Number(el.textContent) >= 5;
    });

    const size1 = await heap.getHeapSizeNumber();
    expect(size).toBeGreaterThanOrEqual(5);
    expect(size).toBeLessThanOrEqual(14);

    // The heap array should contain 'size' comma-separated numbers
    const arrText3 = await heap.getHeapArrayText();
    // Basic sanity checks on the array string
    expect(arrText.startsWith('[')).toBeTruthy();
    expect(arrText.endsWith(']')).toBeTruthy();
    // Count numbers by splitting on commas inside the brackets
    const inner = arrText.slice(1, -1).trim();
    const values = inner.length === 0 ? [] : inner.split(',').map(s => Number(s.trim()));
    expect(values.length).toBe(size);
    // Each value should be within 1-100 per implementation
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
    }

    // Ensure DOM nodes match the reported size
    const nodeCount = await heap.heapNodes.count();
    expect(nodeCount).toBe(size);

    // Now clear and ensure it goes to empty state
    await heap.clickClear();
    await expect(heap.heapSize).toHaveText('0');
    await expect(heap.heapTree).toContainText('Heap is empty');
  });

  test('No unexpected runtime errors emitted during typical interactions', async ({ page }) => {
    // Grouped test to perform a sequence of typical interactions and assert no page errors occur
    const heap6 = new HeapPage(page);

    const { consoleMessages, pageErrors } = await captureErrorsDuring(page, async () => {
      await heap.goto();

      // Insert a value
      await heap.insertValue(42);
      await expect(heap.heapSize).toHaveText(/^[0-9]+$/);

      // Extract min (handles dialog)
      const dlg1 = await page.waitForEvent('dialog');
      // trigger extract - we don't assert message content here, just close it
      await Promise.all([page.waitForEvent('dialog'), heap.extractBtn.click()]).catch(() => {});
      try {
        await dlg1.accept();
      } catch (e) {
        // ignore if already accepted by other wait
      }

      // Generate random heap
      await heap.generateBtn.click();
      await page.waitForFunction(() => Number(document.getElementById('heap-size').textContent) >= 5);

      // Clear heap
      await heap.clickClear();
    });

    // No page errors expected during the combined scenario
    expect(pageErrors.length).toBe(0);

    // No console.error messages
    const consoleErrors2 = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});