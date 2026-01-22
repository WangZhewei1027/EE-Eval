import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3a8801-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the BST app to encapsulate common interactions and observations
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Attach listeners to capture console messages and runtime errors for assertions
    this.page.on('console', (msg) => {
      // Record all console messages for investigation (info/debug/error)
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', (err) => {
      // Record runtime errors (ReferenceError, TypeError, etc.)
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Helpers for DOM access
  async inputHandle() {
    return this.page.locator('#inputValue');
  }
  async insertButton() {
    return this.page.locator('#insertButton');
  }
  async clearButton() {
    return this.page.locator('#clearButton');
  }
  async canvasHandle() {
    return this.page.locator('#bstCanvas');
  }

  // Returns the canvas data URL (string) to compare visual changes
  async getCanvasDataURL() {
    return this.page.evaluate(() => {
      const canvas = document.getElementById('bstCanvas');
      // toDataURL will give a string that represents pixel content
      return canvas.toDataURL();
    });
  }

  // Fill the input with a number and click Insert, then wait for the input to clear
  async insertValue(value) {
    const input = await this.inputHandle();
    await input.fill(String(value));
    await this.insertButton().then(btn => btn.click());
    // The app clears the input after a successful insert.
    await this.page.waitForFunction(() => {
      const el = document.getElementById('inputValue');
      return el && el.value === '';
    });
  }

  // Click Clear and wait for input to be cleared (app clears input on clear)
  async clickClear() {
    await this.clearButton().then(btn => btn.click());
    await this.page.waitForFunction(() => {
      const el = document.getElementById('inputValue');
      return el && el.value === '';
    });
  }

  // Wait until canvas data URL changes from a provided previous value or timeout
  async waitForCanvasChange(previousDataURL, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const current = await this.getCanvasDataURL();
      if (current !== previousDataURL) return current;
      await this.page.waitForTimeout(50);
    }
    // Return the last observed even if unchanged (caller will assert)
    return await this.getCanvasDataURL();
  }
}

test.describe('Binary Search Tree Visualization - FSM behavior and UI checks', () => {
  // Each test gets a fresh page and BSTPage instance
  test.beforeEach(async ({ page }) => {
    // noop here; navigation performed in each test to ensure independence
  });

  test('Idle state: UI elements exist and canvas is initially blank (S0_Idle)', async ({ page }) => {
    // Validate that the Idle state UI is present: input, Insert, Clear, canvas
    const bst = new BSTPage(page);
    await bst.goto();

    // Assert elements are present in DOM
    await expect(page.locator('#inputValue')).toHaveCount(1);
    await expect(page.locator('#insertButton')).toHaveCount(1);
    await expect(page.locator('#clearButton')).toHaveCount(1);
    await expect(page.locator('#bstCanvas')).toHaveCount(1);

    // Capture initial canvas data URL (blank canvas)
    const initialCanvas = await bst.getCanvasDataURL();
    expect(typeof initialCanvas).toBe('string');
    expect(initialCanvas.length).toBeGreaterThan(0); // should be a valid data URL string

    // Ensure no runtime page errors were thrown at load
    expect(bst.pageErrors.length).toBe(0);

    // Keep console messages for debugging if needed; assert none are error-level
    const errorConsoles = bst.consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  test('Insert a number updates the tree visualization (S0_Idle -> S1_TreeUpdated)', async ({ page }) => {
    // This test validates inserting a number causes the canvas to change (visual update)
    const bst = new BSTPage(page);
    await bst.goto();

    const blank = await bst.getCanvasDataURL();

    // Insert a value and wait for canvas to change
    await bst.insertValue(42);
    const afterInsert = await bst.waitForCanvasChange(blank);

    // The canvas should differ from the blank one, indicating drawing occurred
    expect(afterInsert).not.toBe(blank);

    // Input should have been cleared by the app
    const inputVal = await page.locator('#inputValue').inputValue();
    expect(inputVal).toBe('');

    // No runtime errors should have been emitted during insertion
    expect(bst.pageErrors.length).toBe(0);
    const errorConsoles = bst.consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  test('Multiple inserts update the visualization repeatedly (S1_TreeUpdated -> S0_Idle via Insert)', async ({ page }) => {
    // Validate repeated insertions update the canvas each time (transition S1 -> S0 or S0 -> S1 accordingly)
    const bst = new BSTPage(page);
    await bst.goto();

    const blank = await bst.getCanvasDataURL();

    // First insert
    await bst.insertValue(50);
    const afterFirst = await bst.waitForCanvasChange(blank);
    expect(afterFirst).not.toBe(blank);

    // Second insert should also change the canvas visually
    await bst.insertValue(25);
    const afterSecond = await bst.waitForCanvasChange(afterFirst);
    expect(afterSecond).not.toBe(afterFirst);

    // Third insert (right child) should change again
    await bst.insertValue(75);
    const afterThird = await bst.waitForCanvasChange(afterSecond);
    expect(afterThird).not.toBe(afterSecond);

    // No runtime errors during multiple inserts
    expect(bst.pageErrors.length).toBe(0);
    const errorConsoles = bst.consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  test('Clear button clears the tree visualization (S0_Idle -> S2_TreeCleared) and resets to blank', async ({ page }) => {
    // Validate that Clear removes the drawn tree and returns canvas to blank state
    const bst = new BSTPage(page);
    await bst.goto();

    const blank = await bst.getCanvasDataURL();

    // Insert some nodes first to ensure the canvas is non-blank
    await bst.insertValue(10);
    const filled = await bst.waitForCanvasChange(blank);
    expect(filled).not.toBe(blank);

    // Click clear and wait a short moment for canvas to be cleared
    await bst.clickClear();
    // After clear, the canvas should revert to blank. Allow some time for drawing operations to finish.
    await page.waitForTimeout(100);
    const afterClear = await bst.getCanvasDataURL();

    // Expect after clearing to match the original blank image
    expect(afterClear).toBe(blank);

    // No runtime errors during clear
    expect(bst.pageErrors.length).toBe(0);
    const errorConsoles = bst.consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  test('Clicking Clear on an already empty tree should be safe and produce no errors (S2_TreeCleared -> S0_Idle)', async ({ page }) => {
    // Edge case: Clear when empty should not throw and canvas stays blank
    const bst = new BSTPage(page);
    await bst.goto();

    const blank = await bst.getCanvasDataURL();

    // Directly click Clear without any insertions
    await bst.clickClear();
    await page.waitForTimeout(50);
    const afterClear = await bst.getCanvasDataURL();

    // Canvas should remain blank
    expect(afterClear).toBe(blank);

    // No runtime errors should have been thrown
    expect(bst.pageErrors.length).toBe(0);
    const errorConsoles = bst.consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  test('Inserting with empty input should be ignored and not produce errors (invalid input edge case)', async ({ page }) => {
    // Validate clicking Insert with an empty input does nothing and doesn't throw
    const bst = new BSTPage(page);
    await bst.goto();

    const blank = await bst.getCanvasDataURL();

    // Ensure input is empty
    await page.locator('#inputValue').fill('');
    // Click Insert; app should ignore empty (NaN) values and not modify canvas
    await page.locator('#insertButton').click();

    // Wait briefly and capture canvas
    await page.waitForTimeout(100);
    const after = await bst.getCanvasDataURL();

    // Expect no visual change
    expect(after).toBe(blank);

    // No runtime errors should be present
    expect(bst.pageErrors.length).toBe(0);
    const errorConsoles = bst.consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  test('Observe console and runtime errors during normal operation (capturing environment state)', async ({ page }) => {
    // This test explicitly demonstrates capturing console messages and page errors
    // while performing a small sequence of interactions.
    const bst = new BSTPage(page);
    await bst.goto();

    // Perform operations
    const blank = await bst.getCanvasDataURL();
    await bst.insertValue(7);
    await bst.waitForCanvasChange(blank);
    await bst.clickClear();

    // At the end ensure we collected console messages and that no page errors occurred
    // We do not assert that there are errors — we assert that any page errors would be visible via bst.pageErrors
    expect(Array.isArray(bst.consoleMessages)).toBe(true);
    expect(bst.pageErrors.length).toBe(0);
  });
});