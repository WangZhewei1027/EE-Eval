import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79c2b70-d361-11f0-8438-11a56595a476.html';

// Page Object for the Heap demo page
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.minInput = page.locator('#minHeapInput');
    this.minInsertBtn = page.locator('button[onclick="minHeapInsert()"]');
    this.minExtractBtn = page.locator('button[onclick="minHeapExtract()"]');
    this.minClearBtn = page.locator('button[onclick="minHeapClear()"]');
    this.minHeapArray = page.locator('#minHeapArray');
    this.minHeapExtracted = page.locator('#minHeapExtracted');

    this.maxInput = page.locator('#maxHeapInput');
    this.maxInsertBtn = page.locator('button[onclick="maxHeapInsert()"]');
    this.maxExtractBtn = page.locator('button[onclick="maxHeapExtract()"]');
    this.maxClearBtn = page.locator('button[onclick="maxHeapClear()"]');
    this.maxHeapArray = page.locator('#maxHeapArray');
    this.maxHeapExtracted = page.locator('#maxHeapExtracted');
  }

  // Helper to parse JSON content from heap array element
  async getMinHeapArray() {
    const txt = await this.minHeapArray.textContent();
    try {
      return JSON.parse(txt || '[]');
    } catch {
      return [];
    }
  }
  async getMaxHeapArray() {
    const txt = await this.maxHeapArray.textContent();
    try {
      return JSON.parse(txt || '[]');
    } catch {
      return [];
    }
  }

  async getMinExtractedText() {
    return (await this.minHeapExtracted.textContent())?.trim() ?? '';
  }
  async getMaxExtractedText() {
    return (await this.maxHeapExtracted.textContent())?.trim() ?? '';
  }

  async minInsert(value) {
    await this.minInput.fill(String(value));
    await this.minInsertBtn.click();
  }
  async minExtract() {
    await this.minExtractBtn.click();
  }
  async minClear() {
    await this.minClearBtn.click();
  }

  async maxInsert(value) {
    await this.maxInput.fill(String(value));
    await this.maxInsertBtn.click();
  }
  async maxExtract() {
    await this.maxExtractBtn.click();
  }
  async maxClear() {
    await this.maxClearBtn.click();
  }
}

test.describe('Min and Max Heap Demonstration (FSM validation)', () => {
  // Collect console error messages and page errors to inspect them in assertions.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors
    page.on('console', (msg) => {
      // Only consider real errors as issues to assert on later.
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(String(err?.message ?? err));
    });

    // Navigate to the app page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Ensure no uncaught page errors or console errors occurred during interaction.
    // The application code should run without raising runtime exceptions.
    expect(pageErrors, 'No uncaught page exceptions should occur').toEqual([]);
    expect(consoleErrors, 'No console.error calls should be emitted').toEqual([]);
  });

  test('Initial state: Min and Max heaps are initialized and displays updated (S0 & S1 entry actions)', async ({ page }) => {
    // Validate that on page load, updateMinHeapDisplay() and updateMaxHeapDisplay() ran,
    // leaving both heap arrays displayed as empty arrays: []
    const heapPage = new HeapPage(page);

    // The entry actions should have set both displays to an empty JSON array string.
    const minText = await heapPage.minHeapArray.textContent();
    const maxText = await heapPage.maxHeapArray.textContent();

    // Trim whitespace for reliable comparison
    expect(minText?.trim(), 'Min heap display initialized to []').toBe('[]');
    expect(maxText?.trim(), 'Max heap display initialized to []').toBe('[]');
  });

  test('Min Heap: insert multiple values and maintain min-heap property, extract min and clear (transitions)', async ({ page }) => {
    const heapPage = new HeapPage(page);

    // Insert sequence: 5, 3, 8
    // After inserts, expected heap array ordering for min-heap (heapify up) should be [3,5,8]
    await heapPage.minInsert(5);
    await heapPage.minInsert(3);
    await heapPage.minInsert(8);

    const minHeapAfterInsert = await heapPage.getMinHeapArray();
    // Validate length and contents (min element should be at index 0)
    expect(Array.isArray(minHeapAfterInsert)).toBeTruthy();
    expect(minHeapAfterInsert.length).toBe(3);
    expect(minHeapAfterInsert[0]).toBe(3);
    // Ensure all inserted values present
    expect(minHeapAfterInsert.sort((a, b) => a - b)).toEqual([3, 5, 8]);

    // Extract min: should show "Extracted Min: 3" and remove 3 from heap
    await heapPage.minExtract();
    const extractedText = await heapPage.getMinExtractedText();
    expect(extractedText).toBe('Extracted Min: 3');

    const minHeapAfterExtract = await heapPage.getMinHeapArray();
    expect(minHeapAfterExtract.length).toBe(2);
    // extracted value should no longer exist
    expect(minHeapAfterExtract.includes(3)).toBe(false);

    // Clear heap: should empty array and clear extracted text
    await heapPage.minClear();
    const minHeapAfterClear = await heapPage.getMinHeapArray();
    const minExtractedAfterClear = await heapPage.getMinExtractedText();
    expect(minHeapAfterClear).toEqual([]);
    expect(minExtractedAfterClear).toBe('');
  });

  test('Max Heap: insert multiple values and maintain max-heap property, extract max and clear (transitions)', async ({ page }) => {
    const heapPage = new HeapPage(page);

    // Insert sequence: 2, 9, 6
    // After inserts, max element should be at index 0 (likely [9,2,6])
    await heapPage.maxInsert(2);
    await heapPage.maxInsert(9);
    await heapPage.maxInsert(6);

    const maxHeapAfterInsert = await heapPage.getMaxHeapArray();
    expect(Array.isArray(maxHeapAfterInsert)).toBeTruthy();
    expect(maxHeapAfterInsert.length).toBe(3);
    expect(maxHeapAfterInsert[0]).toBe(9);
    // Ensure all inserted values present (order aside, values should exist)
    expect(maxHeapAfterInsert.sort((a, b) => a - b)).toEqual([2, 6, 9]);

    // Extract max: should show "Extracted Max: 9" and remove 9 from heap
    await heapPage.maxExtract();
    const extractedText = await heapPage.getMaxExtractedText();
    expect(extractedText).toBe('Extracted Max: 9');

    const maxHeapAfterExtract = await heapPage.getMaxHeapArray();
    expect(maxHeapAfterExtract.length).toBe(2);
    expect(maxHeapAfterExtract.includes(9)).toBe(false);

    // Clear heap: should empty array and clear extracted text
    await heapPage.maxClear();
    const maxHeapAfterClear = await heapPage.getMaxHeapArray();
    const maxExtractedAfterClear = await heapPage.getMaxExtractedText();
    expect(maxHeapAfterClear).toEqual([]);
    expect(maxExtractedAfterClear).toBe('');
  });

  test('Edge case: extracting from empty heaps displays "Heap is empty." (S2 and S3 transitions)', async ({ page }) => {
    const heapPage = new HeapPage(page);

    // Ensure heaps are empty initially (they should be)
    const initialMin = await heapPage.getMinHeapArray();
    const initialMax = await heapPage.getMaxHeapArray();
    expect(initialMin).toEqual([]);
    expect(initialMax).toEqual([]);

    // Extract from empty min heap
    await heapPage.minExtract();
    const minExtractedText = await heapPage.getMinExtractedText();
    expect(minExtractedText).toBe('Heap is empty.');

    // Extract from empty max heap
    await heapPage.maxExtract();
    const maxExtractedText = await heapPage.getMaxExtractedText();
    expect(maxExtractedText).toBe('Heap is empty.');
  });

  test('Input validation: inserting non-number triggers alert and does not modify heap', async ({ page }) => {
    const heapPage = new HeapPage(page);
    const dialogs = [];

    // Listen for dialog and capture it
    page.on('dialog', async (dialog) => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      // Accept the dialog to continue test
      await dialog.accept();
    });

    // Ensure starting empty
    await heapPage.minClear();
    const beforeMin = await heapPage.getMinHeapArray();
    expect(beforeMin).toEqual([]);

    // Try inserting invalid value into min heap
    await heapPage.minInput.fill('not-a-number');
    await heapPage.minInsertBtn.click();

    // The page should have produced an alert asking for valid number
    // One dialog should have been captured
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].message).toBe('Please enter a valid number.');
    expect(dialogs[0].type).toBe('alert');

    // Heap should remain unchanged
    const afterMin = await heapPage.getMinHeapArray();
    expect(afterMin).toEqual([]);

    // Repeat for max heap
    dialogs.length = 0; // reset
    await heapPage.maxClear();
    await heapPage.maxInput.fill('NaN');
    await heapPage.maxInsertBtn.click();

    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].message).toBe('Please enter a valid number.');
    expect(dialogs[0].type).toBe('alert');
    const afterMax = await heapPage.getMaxHeapArray();
    expect(afterMax).toEqual([]);
  });

  test('Robustness: repeated operations and DOM state consistency', async ({ page }) => {
    // This test performs a mixture of operations to validate stability over many transitions.
    const heapPage = new HeapPage(page);

    // Insert a bunch of values into min heap
    const minValues = [10, 1, 4, 7, 0, 3];
    for (const v of minValues) {
      await heapPage.minInsert(v);
    }
    const minHeapNow = await heapPage.getMinHeapArray();
    expect(minHeapNow.length).toBe(minValues.length);
    // Min at index 0
    expect(minHeapNow[0]).toBe(Math.min(...minValues));

    // Extract twice
    await heapPage.minExtract();
    await heapPage.minExtract();
    const afterTwoExtracts = await heapPage.getMinHeapArray();
    expect(afterTwoExtracts.length).toBe(minValues.length - 2);

    // Clear and ensure DOM updated
    await heapPage.minClear();
    expect(await heapPage.getMinHeapArray()).toEqual([]);

    // Do same for max heap
    const maxValues = [5, 12, -1, 8, 20];
    for (const v of maxValues) {
      await heapPage.maxInsert(v);
    }
    const maxHeapNow = await heapPage.getMaxHeapArray();
    expect(maxHeapNow.length).toBe(maxValues.length);
    expect(maxHeapNow[0]).toBe(Math.max(...maxValues));

    // Extract all one by one and ensure extracted text corresponds to removed top
    const extractedValues = [];
    for (let i = 0; i < maxValues.length; i++) {
      await heapPage.maxExtract();
      const text = await heapPage.getMaxExtractedText();
      // parse the number from "Extracted Max: N" if present
      if (text.startsWith('Extracted Max:')) {
        const num = Number(text.split(':')[1].trim());
        extractedValues.push(num);
      } else {
        // If empty heap, text will indicate that
        extractedValues.push(null);
      }
    }
    // The sequence of extracted values should be non-increasing (max heap pops highest each time)
    const filtered = extractedValues.filter((v) => v !== null);
    for (let i = 1; i < filtered.length; i++) {
      expect(filtered[i] <= filtered[i - 1]).toBeTruthy();
    }
    // After extracting all, heap should be empty
    expect(await heapPage.getMaxHeapArray()).toEqual([]);
  });
});