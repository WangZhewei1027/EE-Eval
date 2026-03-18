import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a329532-ffc5-11f0-8b43-1ffa87931c43.html';

/**
 * Page Object Model for the Heap Visualization page.
 * Encapsulates common interactions and queries against the DOM.
 */
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.insertBtn = page.locator('#insertBtn');
    this.extractBtn = page.locator('#extractBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.heapArray = page.locator('#heapArray');
    this.heapTree = page.locator('#heapTree');
    this.logArea = page.locator('#logArea');
    this.heapTypeRadio = (type) => page.locator(`input[name="heapType"][value="${type}"]`);
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for initial render to occur (heap renders and initial log)
    await expect(this.logArea).toBeVisible();
  }

  async insertValue(value) {
    await this.input.fill(String(value));
    await this.insertBtn.click();
  }

  async insertValueByEnter(value) {
    await this.input.fill(String(value));
    await this.input.press('Enter');
  }

  async extractRoot() {
    await this.extractBtn.click();
  }

  async clearHeap() {
    await this.clearBtn.click();
  }

  async changeHeapType(type) {
    const radio = this.heapTypeRadio(type);
    await radio.click();
  }

  async getLogText() {
    return (await this.logArea.textContent()) || '';
  }

  async getHeapArrayText() {
    return (await this.heapArray.textContent()) || '';
  }

  async getHeapArrayNodes() {
    return this.page.locator('#heapArray .heap-node');
  }

  async getHeapArrayNodeTexts() {
    const nodes = this.getHeapArrayNodes();
    const count = await nodes.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await nodes.nth(i).innerText()).trim());
    }
    return texts;
  }

  async heapTreeHasSvg() {
    return await this.heapTree.locator('svg').count() > 0;
  }

  async heapTreeText() {
    return (await this.heapTree.textContent()) || '';
  }
}

test.describe('Heap Visualization - FSM and UI tests', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    // Capture console messages and page errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app
    const heapPage = new HeapPage(page);
    await heapPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Ensure there were no uncaught runtime errors
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
    // Also make sure there are no console errors (type 'error')
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.map(c => c.text).join('\n')}`).toBe(0);
  });

  test('S0_Idle: Initial render shows empty heap and initialization log', async ({ page }) => {
    // Validate initial UI state: heap array & tree indicate empty and initial log exists
    const heapPage = new HeapPage(page);

    // Heap array should indicate empty
    await expect(heapPage.heapArray).toBeVisible();
    const heapArrayText = await heapPage.getHeapArrayText();
    expect(heapArrayText).toContain('Heap is empty.');

    // Heap tree should indicate empty
    await expect(heapPage.heapTree).toBeVisible();
    const heapTreeText = await heapPage.heapTreeText();
    expect(heapTreeText).toContain('Heap is empty.');

    // Log area should contain initialization message
    const logs = await heapPage.getLogText();
    expect(logs).toContain('Heap Visualization Initialized.');
    expect(logs).toContain('Use the controls above to insert or extract from the heap.');
  });

  test('S1_ValueInserted: Insert a value via Insert button and verify array/tree/log updates', async ({ page }) => {
    // Insert 42, verify log contains inserting message, array shows node, tree has svg and root highlighted
    const heapPage = new HeapPage(page);

    await heapPage.insertValue(42);

    const logs = await heapPage.getLogText();
    expect(logs).toContain('Inserting value: 42');

    // The heap array should now have one node with text '42' and be highlighted (index 0)
    const nodeTexts = await heapPage.getHeapArrayNodeTexts();
    expect(nodeTexts.length).toBeGreaterThanOrEqual(1);
    expect(nodeTexts[0]).toBe('42');

    // The heap array's first node should have the 'highlight' class
    const firstNode = page.locator('#heapArray .heap-node').first();
    await expect(firstNode).toHaveClass(/highlight/);

    // Heap tree should have an SVG and display the number
    expect(await heapPage.heapTreeHasSvg()).toBeTruthy();
    const treeText = await heapPage.heapTreeText();
    expect(treeText).toContain('42');
  });

  test('InsertValueByEnter: Insert a value using Enter key (keyboard event)', async ({ page }) => {
    // Insert 15 using Enter key and verify insertion logs and UI update
    const heapPage = new HeapPage(page);

    await heapPage.insertValueByEnter(15);

    const logs = await heapPage.getLogText();
    expect(logs).toContain('Inserting value: 15');

    const nodeTexts = await heapPage.getHeapArrayNodeTexts();
    // at least one node should exist and contain '15'
    expect(nodeTexts.some(t => t === '15')).toBeTruthy();
  });

  test('S2_RootExtracted: Extract root from non-empty heap and verify logs and UI', async ({ page }) => {
    // Prepare heap with known values so we can validate extraction behavior
    const heapPage = new HeapPage(page);

    // Clear any existing data first to make deterministic
    await heapPage.clearHeap();

    // Insert multiple values
    await heapPage.insertValue(10);
    await heapPage.insertValue(5);
    await heapPage.insertValue(20);

    // After inserts, root (min-heap by default) should be 5
    let nodeTexts = await heapPage.getHeapArrayNodeTexts();
    expect(nodeTexts[0]).toBe('5');

    // Now extract root
    await heapPage.extractRoot();

    const logs = await heapPage.getLogText();
    // extractRoot logs: "Extracting root: X" inside Heap.extractRoot and onExtract logs "Extracted root value: X"
    expect(logs).toMatch(/Extracting root: \d+/);
    expect(logs).toMatch(/Extracted root value: \d+/);

    // After extraction, the root should no longer be the previously extracted value
    nodeTexts = await heapPage.getHeapArrayNodeTexts();
    if (nodeTexts.length > 0) {
      expect(nodeTexts[0]).not.toBe('5');
    } else {
      // If all elements removed (unlikely here), heap displays empty
      const heapArrayText = await heapPage.getHeapArrayText();
      expect(heapArrayText).toContain('Heap is empty.');
    }
  });

  test('ExtractRoot when empty: edge case logs cannot extract root', async ({ page }) => {
    // Clearing heap and then extracting should log the "Heap is empty" message
    const heapPage = new HeapPage(page);

    // Ensure heap empty
    await heapPage.clearHeap();
    // Clear action logs "Heap cleared."
    const afterClearLogs = await heapPage.getLogText();
    expect(afterClearLogs).toContain('Heap cleared.');

    // Now extract when empty
    await heapPage.extractRoot();

    // The heap's internal extractRoot logs "Heap is empty, cannot extract root."
    const logs = await heapPage.getLogText();
    expect(logs).toContain('Heap is empty, cannot extract root.');
  });

  test('S3_HeapCleared: Clear the heap after inserts and verify state and logs', async ({ page }) => {
    // Insert some values then clear and assert UI reflects cleared state and log contains cleared message
    const heapPage = new HeapPage(page);

    await heapPage.insertValue(7);
    await heapPage.insertValue(3);

    // Ensure nodes present
    let nodeTexts = await heapPage.getHeapArrayNodeTexts();
    expect(nodeTexts.length).toBeGreaterThanOrEqual(1);

    // Clear heap
    await heapPage.clearHeap();

    // Verify log message for clear
    const logs = await heapPage.getLogText();
    expect(logs).toContain('Heap cleared.');

    // UI should report empty
    const heapArrayText = await heapPage.getHeapArrayText();
    expect(heapArrayText).toContain('Heap is empty.');
    const heapTreeText = await heapPage.heapTreeText();
    expect(heapTreeText).toContain('Heap is empty.');
  });

  test('S4_HeapTypeChanged: Change heap type to Max and ensure heap rebuilt (root becomes max)', async ({ page }) => {
    // Insert values, switch to max heap and verify root is max and logs mention switch & rebuild
    const heapPage = new HeapPage(page);

    // Start fresh
    await heapPage.clearHeap();

    // Insert values 5, 3, 8
    await heapPage.insertValue(5);
    await heapPage.insertValue(3);
    await heapPage.insertValue(8);

    // Confirm initial min-heap root is 3
    let nodeTexts = await heapPage.getHeapArrayNodeTexts();
    expect(nodeTexts[0]).toBe('3');

    // Change to Max Heap
    await heapPage.changeHeapType('max');

    // The onHeapTypeChange function logs "Switched to Max Heap. Rebuilding heap..." (with a possible leading newline)
    const logs = await heapPage.getLogText();
    expect(logs).toMatch(/Switched to Max Heap\. Rebuilding heap\.\.\./);

    // After rebuild, root should be the maximum value (8)
    nodeTexts = await heapPage.getHeapArrayNodeTexts();
    expect(nodeTexts[0]).toBe('8');

    // Tree should still have the numbers rendered
    expect(await heapPage.heapTreeHasSvg()).toBeTruthy();
    const treeText = await heapPage.heapTreeText();
    expect(treeText).toContain('8');
    expect(treeText).toContain('5');
    expect(treeText).toContain('3');
  });

  test('Edge cases: invalid input triggers alert and duplicates behave correctly', async ({ page }) => {
    // When inserting an invalid/non-numeric value, the app calls alert - we verify the dialog
    const heapPage = new HeapPage(page);

    // Listen for dialog and assert message
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    // Clear heap to have deterministic state
    await heapPage.clearHeap();

    // Try to insert empty string (invalid)
    await heapPage.input.fill('');
    await heapPage.insertBtn.click();

    // Wait briefly for dialog to appear
    await page.waitForTimeout(100); // small wait to allow dialog event to fire

    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].message).toBe('Please enter a valid number.');

    // Test duplicates: inserting the same number multiple times should add multiple nodes
    await heapPage.insertValue(4);
    await heapPage.insertValue(4);

    const nodeTexts = await heapPage.getHeapArrayNodeTexts();
    // There should be at least two '4' entries
    const countFours = nodeTexts.filter(t => t === '4').length;
    expect(countFours).toBeGreaterThanOrEqual(2);

    // Log area should include "Inserting value:" entries and possibly swap logs
    const logs = await heapPage.getLogText();
    expect(logs).toMatch(/Inserting value: 4/);
  });
});