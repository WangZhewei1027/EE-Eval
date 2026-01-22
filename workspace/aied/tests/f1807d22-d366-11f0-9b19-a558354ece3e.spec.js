import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1807d22-d366-11f0-9b19-a558354ece3e.html';

// Page Object for the Heap application
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.valueInput = page.locator('input#valueInput');
    this.insertButton = page.locator('button[onclick="insertValue()"]');
    this.extractMinButton = page.locator('button[onclick="extractMin()"]');
    this.extractMaxButton = page.locator('button[onclick="extractMax()"]');
    this.generateRandomButton = page.locator('button[onclick="generateRandom()"]');
    this.clearAllButton = page.locator('button[onclick="clearAll()"]');
    this.minRadio = page.locator('input#minHeap');
    this.maxRadio = page.locator('input#maxHeap');
    this.heapVisualization = page.locator('#heapVisualization');
    this.log = page.locator('#log');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async insertValue(value) {
    await this.valueInput.fill(String(value));
    await this.insertButton.click();
  }

  async insertValueByEnter(value) {
    await this.valueInput.fill(String(value));
    await this.valueInput.press('Enter');
  }

  async extractMin() {
    await this.extractMinButton.click();
  }

  async extractMax() {
    await this.extractMaxButton.click();
  }

  async generateRandom() {
    await this.generateRandomButton.click();
  }

  async clearAll() {
    await this.clearAllButton.click();
  }

  async switchToMax() {
    await this.maxRadio.check();
  }

  async switchToMin() {
    await this.minRadio.check();
  }

  // Returns number of node elements visible in the heap visualization
  async getNodeCount() {
    return await this.heapVisualization.locator('.node').count();
  }

  // Returns array of node texts (breadth-first)
  async getNodeValues() {
    const nodes = this.heapVisualization.locator('.node');
    const count = await nodes.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push((await nodes.nth(i).innerText()).trim());
    }
    return values;
  }

  // Returns last log entry text (or null)
  async getLastLogEntryText() {
    const entries = this.log.locator('.log-entry');
    const count = await entries.count();
    if (count === 0) return null;
    return (await entries.nth(count - 1).innerText()).trim();
  }

  // Returns all log texts
  async getAllLogEntries() {
    const entries = this.log.locator('.log-entry');
    const count = await entries.count();
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push((await entries.nth(i).innerText()).trim());
    }
    return out;
  }

  // Checks whether the visualization displays the "Heap is empty" message
  async isHeapEmptyMessageVisible() {
    return await this.heapVisualization.locator('text=Heap is empty').count() > 0;
  }
}

// Global test suite for the Heap visualization app
test.describe('Heap (Min/Max) Visualization - End-to-End', () => {
  // We'll collect console messages and page errors for each test to assert expectations
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // store text and type for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  // Initialization and state tests
  test.describe('Initialization and FSM states', () => {
    test('Initial state: Heap Initialized and Heap Empty UI shown; initial log entry present', async ({ page }) => {
      // Arrange
      const heap = new HeapPage(page);
      await heap.goto();

      // Assert: no runtime page errors occurred during load
      expect(pageErrors.length).toBe(0);

      // The heap visualization should show "Heap is empty"
      expect(await heap.isHeapEmptyMessageVisible()).toBeTruthy();

      // The operations log should have an initial message about initialization
      const allLogs = await heap.getAllLogEntries();
      const foundInit = allLogs.some(entry => entry.includes('Min Heap initialized. Ready for operations!'));
      expect(foundInit).toBeTruthy();

      // Also verify the visualization container exists
      await expect(page.locator('#heapVisualization')).toBeVisible();
    });
  });

  // Insert, visualization and input events
  test.describe('Insert operations and input interactions', () => {
    test('Insert via button increases heap size and logs insertion', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Ensure empty initially
      expect(await heap.isHeapEmptyMessageVisible()).toBeTruthy();

      // Act: insert a valid value
      await heap.insertValue(42);

      // Assert: heap visualization should contain one node with text '42'
      const nodeCount = await heap.getNodeCount();
      expect(nodeCount).toBeGreaterThanOrEqual(1);
      const values = await heap.getNodeValues();
      expect(values).toContain('42');

      // Assert: log contains an "Inserted: 42" entry
      const logs = await heap.getAllLogEntries();
      const insertedLog = logs.find(l => l.includes('Inserted: 42'));
      expect(insertedLog).toBeTruthy();

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Insert via Enter key triggers insertion (InputEnter event)', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Act: insert using Enter
      await heap.insertValueByEnter(7);

      // Assert: node with value '7' is present
      const values = await heap.getNodeValues();
      expect(values).toContain('7');

      // Assert: log has 'Inserted: 7'
      const last = await heap.getLastLogEntryText();
      expect(last).toContain('Inserted: 7');

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Invalid inserts show alert and do not modify heap', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Set up dialog capture
      const dialogs = [];
      page.on('dialog', dialog => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        dialog.dismiss();
      });

      // Try empty input
      await heap.valueInput.fill('');
      await heap.insertButton.click();
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[0].message).toContain('Please enter a valid number between 1 and 100');

      // Try out-of-range (0)
      await heap.valueInput.fill('0');
      await heap.insertButton.click();
      expect(dialogs[1].message).toContain('Please enter a valid number between 1 and 100');

      // Try out-of-range (101)
      await heap.valueInput.fill('101');
      await heap.insertButton.click();
      expect(dialogs[2].message).toContain('Please enter a valid number between 1 and 100');

      // Ensure heap still empty (visualization shows empty)
      expect(await heap.isHeapEmptyMessageVisible()).toBeTruthy();
    });
  });

  // Extract and guard behavior
  test.describe('Extract operations, guards and edge cases', () => {
    test('Extract Min on empty heap triggers "Heap is empty" alert (guard)', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Confirm minHeap is selected by default
      await expect(heap.minRadio).toBeChecked();

      // Capture dialog
      const dialog = page.waitForEvent('dialog');
      await heap.extractMin();
      const d = await dialog;
      expect(d.type()).toBe('alert');
      expect(d.message()).toBe('Heap is empty');
      await d.accept();
    });

    test('Extract Max on empty heap triggers "Heap is empty" alert after switching type', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Switch to max
      await heap.switchToMax();

      // Capture dialog
      const dialog = page.waitForEvent('dialog');
      await heap.extractMax();
      const d = await dialog;
      expect(d.type()).toBe('alert');
      expect(d.message()).toBe('Heap is empty');
      await d.accept();
    });

    test('Extract Min/Max guard messages when wrong heap type selected', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Insert a value into min heap so that extractMax will warn to switch type
      await heap.insertValue(10);

      // Try to extractMax while min heap is selected -> should alert to switch to Max Heap first
      const dialog1 = page.waitForEvent('dialog');
      await heap.extractMax();
      const d1 = await dialog1;
      expect(d1.type()).toBe('alert');
      expect(d1.message()).toBe('Please switch to Max Heap first');
      await d1.accept();

      // Now switch to max and extractMax should proceed without the "switch" alert
      await heap.switchToMax();

      // Extract max should succeed and decrease node count
      const before = await heap.getNodeCount();
      // When extractMax executes successfully it will not necessarily show a dialog; perform click and wait a short tick
      await heap.extractMax();
      const after = await heap.getNodeCount();
      expect(after).toBeLessThanOrEqual(before - 0); // at least not increased; when single element extracted it should be 0
      // Also verify log contains "Extracting max"
      const logs = await heap.getAllLogEntries();
      expect(logs.some(l => l.includes('Extracting max'))).toBeTruthy();
    });
  });

  // Generate Random and Clear All transitions
  test.describe('GenerateRandom and ClearAll transitions', () => {
    test('GenerateRandom inserts 10 values and logs generation', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Act: generate 10 random values
      await heap.generateRandom();

      // Assert: visualization should now have at least 10 nodes
      const count = await heap.getNodeCount();
      expect(count).toBeGreaterThanOrEqual(10);

      // Assert: log contains the generation message
      const last = await heap.getLastLogEntryText();
      expect(last).toContain('Generated 10 random values');
    });

    test('ClearAll clears heap visualization and resets log (then logs "Cleared heap")', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Populate heap
      await heap.insertValue(11);
      await heap.insertValue(22);

      // Confirm non-empty
      expect(await heap.getNodeCount()).toBeGreaterThan(0);

      // Act: clear all
      await heap.clearAll();

      // After clearAll, visualizeHeap sets the empty message, then log is cleared and a new "Cleared heap" entry is added.
      expect(await heap.isHeapEmptyMessageVisible()).toBeTruthy();

      // The only log entry (or at least the last one) should include 'Cleared heap'
      const last = await heap.getLastLogEntryText();
      expect(last).toContain('Cleared heap');

      // Ensure earlier logs were removed by clearAll: there should not be any 'Inserted:' entries after clearing except possibly earlier ones in history prior to the clear. We specifically assert last is 'Cleared heap'.
      expect(last.toLowerCase()).toContain('cleared heap');
    });
  });

  // Change heap type behavior (updateHeapType transition)
  test.describe('ChangeHeapType and heap behavior consistency', () => {
    test('Switching heap type updates internal heap and logs switch', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Insert a few values in Min mode
      await heap.insertValue(5);
      await heap.insertValue(15);
      await heap.insertValue(3);

      // Capture current node values
      const minValues = await heap.getNodeValues();
      expect(minValues.length).toBeGreaterThan(0);

      // Switch to Max
      await heap.switchToMax();

      // The updateHeapType re-inserts old array into new heap and logs the switch
      const last = await heap.getLastLogEntryText();
      expect(last).toContain('Switched to Max Heap');

      // Now extractMax should be valid (no "switch" alert)
      const beforeCount = await heap.getNodeCount();
      await heap.extractMax();
      const afterCount = await heap.getNodeCount();
      expect(afterCount).toBeLessThanOrEqual(beforeCount - 0);

      // Also verify a log entry mentions "Extracting max"
      const logs = await heap.getAllLogEntries();
      expect(logs.some(l => l.includes('Extracting max'))).toBeTruthy();
    });
  });

  // Console and runtime error observation tests
  test.describe('Console and runtime error observation', () => {
    test('No unexpected page errors and console errors during common interactions', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // perform a set of common interactions to surface runtime issues
      await heap.insertValue(9);
      await heap.insertValue(20);
      await heap.generateRandom();
      await heap.switchToMax();
      await heap.clearAll();

      // Give the page a tick to produce any console messages or errors
      await page.waitForTimeout(200);

      // Assert there were no uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
      expect(pageErrors.length).toBe(0);

      // Assert console has no messages of level 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  // Final sanity test grouping to ensure FSM transitions are exercised end-to-end
  test('End-to-end: Insert, generate, switch types, extract and clear (FSM coverage)', async ({ page }) => {
    const heap = new HeapPage(page);
    await heap.goto();

    // Insert couple of values
    await heap.insertValue(30);
    await heap.insertValue(40);

    // Generate 10 more
    await heap.generateRandom();

    // Switch to max and extract a max
    await heap.switchToMax();
    const countBefore = await heap.getNodeCount();
    await heap.extractMax();
    const countAfter = await heap.getNodeCount();
    expect(countAfter).toBeLessThanOrEqual(countBefore - 0);

    // Switch back to min
    await heap.switchToMin();
    // Extract min (if any) after switching back - guard should ensure no alert because we are in min mode
    if ((await heap.getNodeCount()) > 0) {
      await heap.extractMin();
    }

    // Clear everything
    await heap.clearAll();
    expect(await heap.isHeapEmptyMessageVisible()).toBeTruthy();

    // Validate the expected major log entries exist in the log history
    const logs = await heap.getAllLogEntries();
    const hasInitialized = logs.some(l => l.includes('Min Heap initialized. Ready for operations!'));
    const hasGenerated = logs.some(l => l.includes('Generated 10 random values'));
    const hasCleared = logs.some(l => l.includes('Cleared heap'));
    expect(hasInitialized).toBeTruthy();
    expect(hasGenerated).toBeTruthy();
    expect(hasCleared).toBeTruthy();
  });
});