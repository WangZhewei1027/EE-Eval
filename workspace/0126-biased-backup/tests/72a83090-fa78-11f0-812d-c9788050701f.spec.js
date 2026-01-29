import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a83090-fa78-11f0-812d-c9788050701f.html';

// Page Object helpers for the Dynamic Array Visualizer
class DynamicArrayPage {
  constructor(page) {
    this.page = page;
    this.addBtn = page.locator('#addBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.arrayContainer = page.locator('#arrayContainer');
    this.memoryBlocks = page.locator('#memoryBlocks');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for DOMContentLoaded and initial animations to start
    await this.page.waitForSelector('.array-container');
    // ensure initial memory blocks are present
    await this.page.waitForSelector('.memory-block');
  }

  // Returns number of array cells currently in DOM (capacity)
  async getArrayCellsCount() {
    return await this.page.$$eval('.array-cell', els => els.length);
  }

  // Returns number of cells that are non-empty (size)
  async getArraySize() {
    return await this.page.$$eval('.array-cell', els =>
      els.reduce((acc, el) => acc + (el.classList.contains('empty') ? 0 : 1), 0)
    );
  }

  // Returns text content of a particular cell index (may be '' for empty)
  async getCellText(index) {
    const selector = `.array-cell:nth-child(${index + 1})`;
    const exists = await this.page.$(selector);
    if (!exists) return null;
    return await this.page.$eval(selector, el => el.textContent.trim());
  }

  // Returns number of allocated memory blocks (blocks with 'allocated' class)
  async getAllocatedMemoryCount() {
    return await this.page.$$eval('.memory-block.allocated', els => els.length);
  }

  // Click the Add Element button
  async clickAdd() {
    await this.addBtn.click();
  }

  // Click the Reset Array button
  async clickReset() {
    await this.resetBtn.click();
  }

  // Returns the inline style.opacity of the first array cell (useful to detect fade during resizing)
  async getFirstCellOpacity() {
    const el = await this.page.$('.array-cell');
    if (!el) return null;
    return await this.page.$eval('.array-cell', e => e.style.opacity || window.getComputedStyle(e).opacity);
  }

  // Returns whether any memory-block currently has 'highlight' class
  async anyMemoryHighlighted() {
    return await this.page.$$eval('.memory-block.highlight', els => els.length > 0);
  }
}

// Group tests for clarity and proper setup/teardown
test.describe('Dynamic Array Visualizer (FSM states & transitions)', () => {
  // Arrays to collect console errors and page errors
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async () => {
    // After each test assert there were no console errors or page errors.
    // This validates that the application does not throw unexpected runtime errors
    // during normal interactions. If there are errors, include details for debugging.
    expect(consoleErrors.length, `Console errors detected: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Page errors detected: ${pageErrors.map(e => e.message).join('\n')}`).toBe(0);
  });

  // Validate initial state S0_Idle: initArray() and initMemory() expected
  test('S0_Idle: Initial state - array and memory initialized', async ({ page }) => {
    const app = new DynamicArrayPage(page);
    await app.goto();

    // Initial capacity should be 4 -> 4 array cells
    const cells = await app.getArrayCellsCount();
    expect(cells).toBe(4);

    // Initially no elements added -> size 0
    const size = await app.getArraySize();
    expect(size).toBe(0);

    // Memory blocks: there are 16 blocks and first `capacity` should be allocated.
    const allocated = await app.getAllocatedMemoryCount();
    expect(allocated).toBe(4);

    // All array cells should be empty (class 'empty') -> text content blank
    for (let i = 0; i < cells; i++) {
      const text = await app.getCellText(i);
      // The index element may still be present as part of innerHTML; after initArray they set `<span class="array-index">i</span>`
      // But visually the .empty class implies no visible value; check that only digits from index span aren't treated as a value in cell text.
      // Accept either empty or the index text only (which is fine as initialization).
      // We'll assert that the non-index content (value) is absent by ensuring cell text length <= 3 (index digits)
      expect(text.length).toBeLessThanOrEqual(3);
    }
  });

  // Validate AddElement event and transition to S3_Element_Added
  test('AddElement: clicking Add Element adds a new element (S0 -> S3_Element_Added)', async ({ page }) => {
    const app = new DynamicArrayPage(page);
    await app.goto();

    // Click Add Element once
    await app.clickAdd();

    // After clicking, one cell should be non-empty (size == 1)
    // There's an animation applied for 800ms; wait for that to complete before final assertions
    await page.waitForTimeout(900);

    const size = await app.getArraySize();
    expect(size).toBe(1);

    // The first cell should contain a numeric value (the random value assigned)
    const firstText = await app.getCellText(0);
    // The value should be a number string of at least 1 character and not equal to the small index label
    expect(firstText.length).toBeGreaterThanOrEqual(1);
    // Memory allocation should remain unchanged (capacity still 4, allocated 4)
    const allocated = await app.getAllocatedMemoryCount();
    expect(allocated).toBe(4);
  });

  // Validate full capacity behavior and resizing transitions (S3 -> S1 -> S2 -> S0)
  test('Resizing: filling to capacity then triggering resize doubles capacity and preserves elements', async ({ page }) => {
    const app = new DynamicArrayPage(page);
    await app.goto();

    // Fill array to initial capacity (4) by clicking 4 times
    for (let i = 0; i < 4; i++) {
      await app.clickAdd();
      // wait a bit for animation to settle for each add
      await page.waitForTimeout(250);
    }

    // Confirm size is 4 (full)
    let size = await app.getArraySize();
    expect(size).toBe(4);

    // Now click Add to trigger resize. According to implementation, addElement() will call resizeArray() and return.
    // resizeArray() immediately sets inline styles (opacity 0.3, transform scale(0.9)) on current cells and sets isResizing=true.
    await app.clickAdd();

    // Immediately after clicking, detect that cells have opacity '0.3' to evidence S1_Array_Full -> S2_Array_Resizing
    const opacity = await app.getFirstCellOpacity();
    // The inline style should reflect the change; accept either '0.3' or computed style '0.3'
    expect(Number(opacity)).toBeCloseTo(0.3, 2);

    // While resizing (there are setTimeouts), attempts to add should be ignored (isResizing guards addElement)
    // Click add again quickly and verify size does not change during resize
    await app.clickAdd();
    await page.waitForTimeout(100); // small wait while still resizing
    size = await app.getArraySize();
    expect(size).toBe(4); // still 4 during resizing

    // Wait enough time for resizeArray() to complete (1000ms for final step + small buffer)
    await page.waitForTimeout(1200);

    // After resizing completes, capacity should have doubled to 8 -> array cells count 8
    const newCellCount = await app.getArrayCellsCount();
    expect(newCellCount).toBe(8);

    // Allocated memory blocks (visualization) should be updated to match new capacity (first 8 allocated)
    const allocated = await app.getAllocatedMemoryCount();
    expect(allocated).toBe(8);

    // Elements that were present before resizing should still be present in the first 'size' cells
    const preservedSize = await app.getArraySize();
    expect(preservedSize).toBe(4);

    // Now that resizing is complete, clicking Add should add the next element (5th element)
    await app.clickAdd();
    // wait for animation to finish
    await page.waitForTimeout(900);
    const sizeAfter = await app.getArraySize();
    expect(sizeAfter).toBe(5);

    // Verify that the 5th cell now contains a value (non-empty)
    const fifthText = await app.getCellText(4);
    expect(fifthText.length).toBeGreaterThan(0);
  });

  // Edge case: clicking Add while isResizing should be ignored. Confirm size unchanged.
  test('Edge case: Add clicks during resizing are ignored until resizing completes', async ({ page }) => {
    const app = new DynamicArrayPage(page);
    await app.goto();

    // Fill to capacity
    for (let i = 0; i < 4; i++) {
      await app.clickAdd();
      await page.waitForTimeout(150);
    }
    const sizeBefore = await app.getArraySize();
    expect(sizeBefore).toBe(4);

    // Trigger resize by clicking add once
    await app.clickAdd();

    // Immediately click Add multiple times while resizing should be in progress
    await app.clickAdd();
    await app.clickAdd();
    await app.clickAdd();

    // Small wait to ensure rapid clicks registered while resizing
    await page.waitForTimeout(200);

    // Size should still be 4 during resizing
    const sizeDuring = await app.getArraySize();
    expect(sizeDuring).toBe(4);

    // Wait until resizing completes
    await page.waitForTimeout(1200);

    // After resizing, one of the clicks after resize should not retroactively add elements;
    // only further clicks after resizing would add elements. So size should remain 4 until we click again.
    const sizeAfter = await app.getArraySize();
    expect(sizeAfter).toBe(4);

    // Click add once to add the next element
    await app.clickAdd();
    await page.waitForTimeout(900);
    const finalSize = await app.getArraySize();
    expect(finalSize).toBe(5);
  });

  // Validate Reset behavior (S0_Idle -> S4_Array_Reset)
  test('ResetArray: clicking Reset Array returns array to initial state (S4_Array_Reset)', async ({ page }) => {
    const app = new DynamicArrayPage(page);
    await app.goto();

    // Add some elements so state is different from initial
    await app.clickAdd();
    await page.waitForTimeout(300);
    await app.clickAdd();
    await page.waitForTimeout(300);

    const sizeBeforeReset = await app.getArraySize();
    expect(sizeBeforeReset).toBeGreaterThanOrEqual(1);

    // Click Reset
    await app.clickReset();

    // Wait a short time for reset to take effect
    await page.waitForTimeout(200);

    // After reset, capacity should be back to 4 (array cells count 4)
    const cells = await app.getArrayCellsCount();
    expect(cells).toBe(4);

    // Allocated memory blocks should be back to 4
    const allocated = await app.getAllocatedMemoryCount();
    expect(allocated).toBe(4);

    // Size should be 0 (all cells empty)
    const sizeAfterReset = await app.getArraySize();
    expect(sizeAfterReset).toBe(0);

    // Ensure the first cell has empty semantics (text limited to index only or blank)
    const first = await app.getCellText(0);
    expect(first.length).toBeLessThanOrEqual(3);
  });
});