import { test, expect } from '@playwright/test';

// Test file: de3d1220-fa74-11f0-a1b6-4b9b8151441a.spec.js
// URL served for the HTML implementation
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d1220-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the B-Tree app to keep tests readable and DRY
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Helper to set key input value
  async setKeyInput(value) {
    await this.page.fill('#keyInput', String(value));
  }

  // Helper to set order input
  async setOrderInput(value) {
    await this.page.fill('#orderInput', String(value));
  }

  // Click the Insert Key button (uses the onclick attr)
  async clickInsert() {
    await Promise.all([
      // the action usually updates the DOM synchronously, but still use wait
      this.page.waitForTimeout(50),
      this.page.click("button[onclick='insertKey()']"),
    ]);
  }

  // Click the Find Key button
  async clickFind() {
    await Promise.all([
      this.page.waitForTimeout(50),
      this.page.click("button[onclick='findKey()']"),
    ]);
  }

  // Click Random Tree button
  async clickRandomTree() {
    await Promise.all([
      // randomTree generates a tree and renders
      this.page.waitForTimeout(100),
      this.page.click("button[onclick='randomTree()']"),
    ]);
  }

  // Click Reset Tree button
  async clickResetTree() {
    await Promise.all([
      this.page.waitForTimeout(50),
      this.page.click("button[onclick='resetTree()']"),
    ]);
  }

  // Get raw text content of the tree container
  async getTreeContainerText() {
    return this.page.textContent('#treeContainer');
  }

  // Count node elements rendered
  async countNodes() {
    return this.page.$$eval('.node', nodes => nodes.length);
  }

  // Get all keys' text content as array
  async getAllKeyTexts() {
    return this.page.$$eval('.key', els => els.map(e => e.textContent.trim()));
  }

  // Get highlighted keys (should be at most one in this app)
  async getHighlightedKeyTexts() {
    return this.page.$$eval('.key.highlight', els => els.map(e => e.textContent.trim()));
  }

  // Convenience: insert a single key via UI (handles clearing input afterward)
  async insertKeyViaUI(value) {
    await this.setKeyInput(value);
    await this.clickInsert();
    // wait a bit for DOM update
    await this.page.waitForTimeout(60);
  }

  // Convenience: find a key via UI and capture the dialog text
  async findKeyViaUI(value) {
    await this.setKeyInput(value);
    const dialogPromise = this.page.waitForEvent('dialog', { timeout: 2000 }).catch(() => null);
    await this.clickFind();
    const dialog = await dialogPromise;
    if (dialog) {
      const msg = dialog.message();
      await dialog.accept();
      // allow DOM highlight update
      await this.page.waitForTimeout(30);
      return msg;
    }
    return null;
  }
}

test.describe('B-Tree Index Visualization - FSM states and transitions', () => {
  // Capture console errors and page errors for each test and assert none occurred
  test.beforeEach(async ({ page }) => {
    // Prevent Playwright from failing tests automatically on dialogs; we will handle them
    // Attach console and pageerror listeners
    page.context()._consoleErrors = [];
    page.context()._pageErrors = [];

    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          page.context()._consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore listener errors
      }
    });

    page.on('pageerror', err => {
      try {
        page.context()._pageErrors.push(err.message || String(err));
      } catch (e) {
        // ignore
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // Ensure no runtime errors were emitted to console or uncaught exceptions
    const consoleErrors = page.context()._consoleErrors || [];
    const pageErrors = page.context()._pageErrors || [];

    // Comment: We expect the app to run without runtime console errors or uncaught page errors.
    expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Initial state S0_Idle: page renders initial B-Tree (not empty)', async ({ page }) => {
    // Validate initial render: the HTML script inserts several keys and renders
    const app = new BTreePage(page);
    await app.goto();

    // The initial script inserted keys and called render, so tree should not be "Tree is empty"
    const containerText = await app.getTreeContainerText();
    // It should not equal the empty text; better assert it contains numeric keys or .node elements exist
    const nodeCount = await app.countNodes();
    expect(nodeCount).toBeGreaterThan(0);

    const keys = await app.getAllKeyTexts();
    expect(keys.length).toBeGreaterThan(0);

    // ensure there is no "Tree is empty" literal
    expect(containerText).not.toContain('Tree is empty');
  });

  test('InsertKey transition -> S1_KeyInserted: inserting a key updates the DOM', async ({ page }) => {
    // This test validates inserting a key transitions to "Key Inserted" state by updating DOM
    const app = new BTreePage(page);
    await app.goto();

    const beforeKeys = await app.getAllKeyTexts();
    const beforeCount = beforeKeys.length;

    // Insert a unique key to avoid collision with initial values, e.g., 999
    await app.insertKeyViaUI(999);

    const afterKeys = await app.getAllKeyTexts();
    const afterCount = afterKeys.length;

    // Validate count increased by 1
    expect(afterCount).toBe(beforeCount + 1);

    // Validate the new key is present in rendered keys
    expect(afterKeys).toContain('999');

    // Ensure the key input was cleared by the UI handler (insertKey clears it)
    const keyInputValue = await page.$eval('#keyInput', el => el.value);
    expect(keyInputValue).toBe('');
  });

  test('FindKey -> S2_KeyFound: finding an existing key shows alert and highlights the key', async ({ page }) => {
    // Validate that finding an existing key triggers alert and highlights key in the DOM
    const app = new BTreePage(page);
    await app.goto();

    // The initial setup inserted '10' so find 10
    const dialogPromise = page.waitForEvent('dialog');
    await app.setKeyInput(10);
    // click find; we expect a dialog
    await app.clickFind();
    const dialog = await dialogPromise;
    expect(dialog).not.toBeNull();
    expect(dialog.message()).toBe('Found key 10 in the tree');
    await dialog.accept();

    // After accepting, the BTree.search sets highlightedKey and calls render()
    const highlights = await app.getHighlightedKeyTexts();
    // There should be at least one highlighted key and it should equal '10'
    expect(highlights.length).toBeGreaterThan(0);
    expect(highlights).toContain('10');
  });

  test('FindKey -> S3_KeyNotFound: finding a missing key shows not-found alert and no highlight', async ({ page }) => {
    // Validate searching for a key that doesn't exist triggers "not found" alert and no highlights
    const app = new BTreePage(page);
    await app.goto();

    // Choose a key very unlikely present (e.g., 123456)
    const missingKey = 123456;
    const dialogPromise = page.waitForEvent('dialog');
    await app.setKeyInput(missingKey);
    await app.clickFind();
    const dialog = await dialogPromise;
    expect(dialog).not.toBeNull();
    expect(dialog.message()).toBe(`Key ${missingKey} not found in the tree`);
    await dialog.accept();

    // There should be no highlight for that key
    const highlights = await app.getHighlightedKeyTexts();
    // Either no highlights or highlights that don't contain the missing key
    expect(highlights).not.toContain(String(missingKey));
  });

  test('RandomTree -> S5_RandomTreeGenerated: generates a random tree and renders nodes', async ({ page }) => {
    // Validate clicking Random Tree generates a new tree and re-renders DOM
    const app = new BTreePage(page);
    await app.goto();

    // Ensure order is valid (>=2)
    await app.setOrderInput(2);

    // Click Random Tree and wait a bit for generation & render
    const beforeNodeCount = await app.countNodes();
    await app.clickRandomTree();
    const afterNodeCount = await app.countNodes();

    // The random generation inserts multiple values, so node count should be >= 1
    expect(afterNodeCount).toBeGreaterThanOrEqual(1);
    // If there was a prior tree, the node count after random should likely be different or at least non-zero
    expect(afterNodeCount).toBeGreaterThan(0);

    // Ensure the container is not the textual "Tree is empty"
    const containerText = await app.getTreeContainerText();
    expect(containerText).not.toBe('Tree is empty');
  });

  test('ResetTree -> S4_TreeReset: reset clears the tree and renders "Tree is empty"', async ({ page }) => {
    // Validate that reset sets root to null and renders empty message
    const app = new BTreePage(page);
    await app.goto();

    // Ensure order is valid (>=2)
    await app.setOrderInput(2);

    // Click Reset Tree
    await app.clickResetTree();

    // After reset, treeContainer should display 'Tree is empty'
    const containerText = (await app.getTreeContainerText()) || '';
    expect(containerText.trim()).toBe('Tree is empty');

    // No .node elements should be present after reset
    const nodeCount = await app.countNodes();
    expect(nodeCount).toBe(0);
  });

  test('Edge case: InsertKey with invalid/no input shows validation alert', async ({ page }) => {
    // Validate that attempting to insert without a valid number shows the correct alert
    const app = new BTreePage(page);
    await app.goto();

    // Ensure key input is empty
    await app.setKeyInput('');
    const dialogPromise = page.waitForEvent('dialog');
    await app.clickInsert();
    const dialog = await dialogPromise;
    expect(dialog).not.toBeNull();
    expect(dialog.message()).toBe('Please enter a valid number');
    await dialog.accept();
  });

  test('Edge case: RandomTree and ResetTree with invalid order (<2) show order validation alert', async ({ page }) => {
    // Validate order validation both for randomTree and resetTree
    const app = new BTreePage(page);
    await app.goto();

    // Set invalid order = 1
    await app.setOrderInput(1);

    // randomTree should alert 'Order must be at least 2'
    const dialogPromise1 = page.waitForEvent('dialog');
    await app.clickRandomTree();
    const dialog1 = await dialogPromise1;
    expect(dialog1).not.toBeNull();
    expect(dialog1.message()).toBe('Order must be at least 2');
    await dialog1.accept();

    // resetTree should alert 'Order must be at least 2'
    const dialogPromise2 = page.waitForEvent('dialog');
    await app.clickResetTree();
    const dialog2 = await dialogPromise2;
    expect(dialog2).not.toBeNull();
    expect(dialog2.message()).toBe('Order must be at least 2');
    await dialog2.accept();
  });

  test('Split behavior and resilience: inserting many keys creates additional nodes without runtime errors', async ({ page }) => {
    // This test inserts many keys via the UI to trigger splits (splitChild) and validates DOM updates and no exceptions
    const app = new BTreePage(page);
    await app.goto();

    // Reset to a clean state first
    await app.setOrderInput(2);
    await app.clickResetTree();
    // insert a range of keys to cause multiple splits
    const valuesToInsert = [10, 20, 5, 6, 12, 30, 7, 17, 1, 2, 3, 4, 8, 9, 11, 13, 14, 15];
    for (const v of valuesToInsert) {
      await app.insertKeyViaUI(v);
    }

    // After many inserts, there should be multiple node elements
    const nodeCount = await app.countNodes();
    expect(nodeCount).toBeGreaterThan(1);

    // Validate that keys we inserted appear in the DOM
    const allKeys = await app.getAllKeyTexts();
    for (const v of valuesToInsert) {
      expect(allKeys).toContain(String(v));
    }
  });
});