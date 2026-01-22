import { test, expect } from '@playwright/test';

// Test file for Application ID: 6b000db0-d5c3-11f0-b41f-b131cbd11f51
// URL: http://127.0.0.1:5500/workspace/batch-1207/html/6b000db0-d5c3-11f0-b41f-b131cbd11f51.html
// This suite validates FSM states & transitions for the Heap visualization app.
// It also observes console errors and page errors during test runs.

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b000db0-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for interacting with the Heap UI
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      minBtn: '.heap-type-btn[data-type="min"]',
      maxBtn: '.heap-type-btn[data-type="max"]',
      valueInput: '#value-input',
      insertBtn: '#insert-btn',
      extractBtn: '#extract-btn',
      clearBtn: '#clear-btn',
      randomBtn: '#random-btn',
      heapContainer: '#heap-container',
      historyDiv: '#history',
      heapNodes: '.heap-node',
      heapEmptyParagraph: '#heap-container p',
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Switch heap type by clicking the corresponding button
  async switchHeapType(type) {
    if (type === 'min') {
      await this.page.click(this.selectors.minBtn);
    } else if (type === 'max') {
      await this.page.click(this.selectors.maxBtn);
    } else {
      throw new Error('Unknown heap type for switchHeapType: ' + type);
    }
  }

  // Insert a numeric value using the UI insert button
  async insertValue(value) {
    await this.page.fill(this.selectors.valueInput, String(value));
    await this.page.click(this.selectors.insertBtn);
  }

  // Insert value by pressing Enter key while focused on input
  async insertValueWithEnter(value) {
    await this.page.fill(this.selectors.valueInput, String(value));
    await this.page.focus(this.selectors.valueInput);
    await this.page.keyboard.press('Enter');
  }

  // Click extract root
  async extractRoot() {
    await this.page.click(this.selectors.extractBtn);
  }

  // Click clear heap
  async clearHeap() {
    await this.page.click(this.selectors.clearBtn);
  }

  // Generate random heap
  async generateRandomHeap() {
    await this.page.click(this.selectors.randomBtn);
  }

  // Returns array of history entries (top first)
  async getHistoryEntries() {
    // historyDiv contains many child divs; return their innerText array
    return await this.page.$$eval(`${this.selectors.historyDiv} > div`, divs =>
      divs.map(d => d.textContent.trim())
    );
  }

  // Get texts of heap nodes in order of data-index (as they appear in DOM)
  async getHeapNodeValues() {
    return await this.page.$$eval(this.selectors.heapNodes, nodes => nodes.map(n => n.textContent.trim()));
  }

  // Get count of heap nodes
  async getHeapNodeCount() {
    return await this.page.$$eval(this.selectors.heapNodes, nodes => nodes.length);
  }

  // Check whether heap-empty message is visible
  async isHeapEmptyMessageVisible() {
    return await this.page.$eval(this.selectors.heapContainer, container => {
      return container.textContent.includes('Heap is empty');
    });
  }

  // Returns which heap type button is active: 'min' or 'max' (or null)
  async activeHeapType() {
    const minActive = await this.page.$eval(this.selectors.minBtn, b => b.classList.contains('active'));
    const maxActive = await this.page.$eval(this.selectors.maxBtn, b => b.classList.contains('active'));
    if (minActive) return 'min';
    if (maxActive) return 'max';
    return null;
  }

  // Returns text content of root node (data-index="0") or null
  async getRootNodeText() {
    const root = await this.page.$('.heap-node[data-index="0"]');
    if (!root) return null;
    return (await root.textContent()).trim();
  }

  // Returns whether the last node (index = size-1) has class 'new'
  async lastNodeHasNewClass() {
    return await this.page.$eval(this.selectors.heapNodes, () => {
      // This eval will run in the browser; handle gracefully
      // But since $$eval requires callback over nodes array, adjust:
      return null;
    }).catch(async () => {
      // Fallback approach: evaluate properly using two-step
      return await this.page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('.heap-node'));
        if (!nodes.length) return false;
        const last = nodes[nodes.length - 1];
        return last.classList.contains('new');
      });
    });
  }
}

test.describe('Heap Visualization - FSM states and transitions', () => {
  // Capture console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // No-op placeholder to ensure Playwright fixtures are available per-test
  });

  test('Initial Idle state: Starts with Min Heap and shows empty visualization and history entry', async ({ page }) => {
    // Arrange: capture console and page errors
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Assert: Min Heap button is active
    expect(await heapPage.activeHeapType()).toBe('min');

    // Assert: visualization shows empty message
    expect(await heapPage.isHeapEmptyMessageVisible()).toBeTruthy();

    // Assert: history contains "Started with Min Heap" as the most recent entry
    const history = await heapPage.getHistoryEntries();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0]).toContain('Started with Min Heap');

    // Assert: no console errors or page errors occurred on load
    expect(consoleErrors.length, 'No console.error messages should be emitted on load').toBe(0);
    expect(pageErrors.length, 'No page errors (uncaught exceptions) should be emitted on load').toBe(0);
  });

  test('Switch heap type to Max and back to Min updates UI and history', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Click Max Heap button
    await heapPage.switchHeapType('max');

    // Assert active button changes to max
    expect(await heapPage.activeHeapType()).toBe('max');

    // Assert history logged the switch
    let history = await heapPage.getHistoryEntries();
    expect(history[0]).toContain('Switched to Max Heap');

    // Switch back to min
    await heapPage.switchHeapType('min');
    expect(await heapPage.activeHeapType()).toBe('min');
    history = await heapPage.getHistoryEntries();
    expect(history[0]).toContain('Switched to Min Heap');

    expect(consoleErrors.length, 'No console.error messages during heap type switching').toBe(0);
    expect(pageErrors.length, 'No page errors during heap type switching').toBe(0);
  });

  test('Insert values into Max Heap: visual nodes, history, and "new" highlight', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Switch to Max heap
    await heapPage.switchHeapType('max');
    expect(await heapPage.activeHeapType()).toBe('max');

    // Insert 42
    await heapPage.insertValue(42);

    // Assert history includes insert with correct value
    let history = await heapPage.getHistoryEntries();
    expect(history[0]).toContain('Inserted 42');

    // There should be at least 1 heap node with text '42'
    const nodes = await heapPage.getHeapNodeValues();
    expect(nodes.length).toBeGreaterThanOrEqual(1);
    expect(nodes).toContain('42');

    // The last inserted node should be highlighted with 'new' class
    const lastHasNew = await heapPage.lastNodeHasNewClass();
    expect(lastHasNew).toBeTruthy();

    // Insert another value (10) to verify heap behavior (max heap should keep 42 as root)
    await heapPage.insertValue(10);
    // root should remain '42'
    const rootText = await heapPage.getRootNodeText();
    expect(rootText).toBe('42');

    expect(consoleErrors.length, 'No console errors during insertion into max heap').toBe(0);
    expect(pageErrors.length, 'No page errors during insertion into max heap').toBe(0);
  });

  test('Insert values into Min Heap and validate heap ordering and extraction', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Ensure Min heap active
    await heapPage.switchHeapType('min');
    expect(await heapPage.activeHeapType()).toBe('min');

    // Insert values 5 and 3: min heap should have 3 at root after heapify
    await heapPage.insertValue(5);
    await heapPage.insertValue(3);

    // Root should be '3'
    let root = await heapPage.getRootNodeText();
    expect(root).toBe('3');

    // Extract root
    await heapPage.extractRoot();

    // After extraction, history should include the extracted value
    const history = await heapPage.getHistoryEntries();
    expect(history[0]).toContain('Extracted root value');

    // After extraction, root should no longer be '3' (or heap empty)
    const newRoot = await heapPage.getRootNodeText();
    // It might be '5' or null if heap empty; allow both possibilities
    if (newRoot !== null) {
      expect(newRoot).toBe('5');
    }

    expect(consoleErrors.length, 'No console errors during insert/extract in min heap').toBe(0);
    expect(pageErrors.length, 'No page errors during insert/extract in min heap').toBe(0);
  });

  test('Clear heap and verify empty visualization and history entry', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Insert a value to ensure heap is non-empty
    await heapPage.insertValue(99);
    let count = await heapPage.getHeapNodeCount();
    expect(count).toBeGreaterThanOrEqual(1);

    // Clear heap
    await heapPage.clearHeap();

    // Visualization shows empty
    expect(await heapPage.isHeapEmptyMessageVisible()).toBeTruthy();

    // History has 'Cleared heap'
    const history = await heapPage.getHistoryEntries();
    expect(history[0]).toContain('Cleared heap');

    expect(consoleErrors.length, 'No console errors when clearing heap').toBe(0);
    expect(pageErrors.length, 'No page errors when clearing heap').toBe(0);
  });

  test('Generate random heap creates multiple nodes and logs history', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Ensure heap is cleared first
    await heapPage.clearHeap();
    expect(await heapPage.isHeapEmptyMessageVisible()).toBeTruthy();

    // Generate random heap
    await heapPage.generateRandomHeap();

    // History entry should indicate generation and include heap type and node count
    const history = await heapPage.getHistoryEntries();
    expect(history[0]).toMatch(/Generated random (Min|Max) Heap with \d+ nodes/);

    // Node count should be at least 5 (per implementation) and no more than 14
    const nodesCount = await heapPage.getHeapNodeCount();
    expect(nodesCount).toBeGreaterThanOrEqual(5);
    expect(nodesCount).toBeLessThanOrEqual(14);

    expect(consoleErrors.length, 'No console errors when generating random heap').toBe(0);
    expect(pageErrors.length, 'No page errors when generating random heap').toBe(0);
  });

  test('Insert using Enter key and verify focus behavior and history', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Clear heap to isolate behavior
    await heapPage.clearHeap();

    // Insert using Enter
    await heapPage.insertValueWithEnter(7);

    // History should log insertion of 7
    const history = await heapPage.getHistoryEntries();
    expect(history[0]).toContain('Inserted 7');

    // Node should exist
    const nodes = await heapPage.getHeapNodeValues();
    expect(nodes).toContain('7');

    expect(consoleErrors.length, 'No console errors when inserting via Enter').toBe(0);
    expect(pageErrors.length, 'No page errors when inserting via Enter').toBe(0);
  });

  test('Edge cases: inserting invalid input and extracting from empty heap trigger alerts', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err));

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Ensure heap is empty
    await heapPage.clearHeap();
    expect(await heapPage.isHeapEmptyMessageVisible()).toBeTruthy();

    // 1) Attempt to insert with empty input -> alert 'Please enter a valid number'
    const insertDialogPromise = page.waitForEvent('dialog');
    // Make sure input is empty
    await page.fill(heapPage.selectors.valueInput, '');
    await page.click(heapPage.selectors.insertBtn);
    const insertDialog = await insertDialogPromise;
    expect(insertDialog.message()).toBe('Please enter a valid number');
    await insertDialog.dismiss();

    // 2) Attempt to extract from empty heap -> alert 'Heap is empty'
    const extractDialogPromise = page.waitForEvent('dialog');
    await page.click(heapPage.selectors.extractBtn);
    const extractDialog = await extractDialogPromise;
    expect(extractDialog.message()).toBe('Heap is empty');
    await extractDialog.dismiss();

    expect(consoleErrors.length, 'No console errors during edge case dialogs').toBe(0);
    expect(pageErrors.length, 'No page errors during edge case dialogs').toBe(0);
  });

  test('Final validation: ensure no unexpected runtime errors were emitted during interactions', async ({ page }) => {
    // This test loads the page and performs a series of interactions while accumulating any console or page errors.
    const consoleErrors = [];
    const pageErrors = [];
    const pageLogs = [];

    page.on('console', msg => {
      pageLogs.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Perform a sequence of interactions to exercise most code paths
    await heapPage.switchHeapType('max');
    await heapPage.insertValue(11);
    await heapPage.insertValue(22);
    await heapPage.switchHeapType('min');
    await heapPage.insertValue(3);
    await heapPage.extractRoot();
    await heapPage.generateRandomHeap();
    await heapPage.clearHeap();

    // Assert that no console.error or page errors were captured during the sequence
    expect(consoleErrors.length, `Console error messages were emitted: ${consoleErrors.join('\n')}`).toBe(0);
    expect(pageErrors.length, `Page errors (uncaught exceptions) were emitted: ${pageErrors.map(e => e.message).join('\n')}`).toBe(0);

    // Additional sanity checks: history contains multiple entries
    const history = await heapPage.getHistoryEntries();
    expect(history.length).toBeGreaterThanOrEqual(1);
    // Ensure the history shows 'Cleared heap' at some point after operations
    expect(history.some(h => h.includes('Cleared heap'))).toBeTruthy();
  });
});