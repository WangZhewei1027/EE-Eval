import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b2fbf2-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object encapsulating interactions with the B-Tree app
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputKey');
    this.insertBtn = page.locator('#insertBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.container = page.locator('#btree');
    this.keysLocator = page.locator('#btree .key');
    this.nodesLocator = page.locator('#btree .node');
    this.svgLocator = page.locator('#btree svg');
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for the initial render to complete - the script appends nodes into #btree
    await this.page.waitForSelector('#btree .node', { timeout: 5000 });
    // give a short pause to allow connections and layout calculations
    await this.page.waitForTimeout(100);
  }

  async getAllKeyTexts() {
    return (await this.keysLocator.allTextContents()).map(s => s.trim()).filter(Boolean);
  }

  async getNodeCount() {
    return await this.nodesLocator.count();
  }

  async getKeyCount() {
    return await this.keysLocator.count();
  }

  async insertKey(value, { expectAlert = false } = {}) {
    // If an alert is expected, set up a one-time dialog handler to capture message
    let dialogMessage = null;
    if (expectAlert) {
      this.page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });
    } else {
      // In normal flow dismiss any unexpected dialogs so test doesn't hang
      this.page.once('dialog', async dialog => {
        await dialog.dismiss();
      });
    }
    await this.input.fill(String(value));
    await this.insertBtn.click();
    // short wait for DOM updates
    await this.page.waitForTimeout(150);
    return dialogMessage;
  }

  async resetTree() {
    await this.resetBtn.click();
    // short wait for DOM updates
    await this.page.waitForTimeout(150);
  }

  async svgHasLines() {
    // Check if there are <line> elements inside svg
    const lines = await this.page.locator('#btree svg line').count();
    return lines > 0;
  }
}

test.describe('B-Tree Index Visualization (FSM) - 63b2fbf2-fa74-11f0-bb9a-db7e6ecdeeaa', () => {
  /** collect console errors and page errors across each test */
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', error => {
      pageErrors.push(String(error && error.message ? error.message : error));
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test assert there were no uncaught page errors or console errors.
    // We allow tests to intentionally trigger alerts (dialogs) but runtime errors should not occur.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    // clean listeners to avoid leaking between tests
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
    page.removeAllListeners('dialog');
  });

  test('Initial render should reflect S0_Idle (initialKeys rendered and tree drawn)', async ({ page }) => {
    // Validate initial FSM Idle state produces a rendered tree (onEntry renderTree(btree.root))
    const app = new BTreePage(page);
    await app.navigate();

    // The example seeds initialKeys = [10,20,5,6,12,30,7,17]
    const expectedInitialKeys = ['10', '20', '5', '6', '12', '30', '7', '17'];
    const presentKeys = await app.getAllKeyTexts();

    // All expected initial keys should be present in the visualization (order may vary)
    for (const k of expectedInitialKeys) {
      expect(presentKeys, `Expected initial key ${k} to be rendered`).toContain(k);
    }

    // SVG lines should exist to show connections between nodes (visual feedback)
    const hasLines = await app.svgHasLines();
    expect(hasLines).toBeTruthy();
  });

  test('Insert Key transitions from S0_Idle to S1_KeyInserted and updates DOM', async ({ page }) => {
    // Insert a new key not in initial set and verify it's rendered afterwards
    const app1 = new BTreePage(page);
    await app.navigate();

    const newKey = 25;
    const beforeCount = await app.getKeyCount();
    await app.insertKey(newKey, { expectAlert: false });

    const afterKeys = await app.getAllKeyTexts();
    expect(afterKeys).toContain(String(newKey));
    const afterCount = await app.getKeyCount();
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
  });

  test('Repeated InsertKey events keep tree in S1_KeyInserted (multiple inserts)', async ({ page }) => {
    // Insert multiple keys in succession and ensure they all appear
    const app2 = new BTreePage(page);
    await app.navigate();

    const keysToInsert = [22, 24, 27];
    for (const k of keysToInsert) {
      await app.insertKey(k);
    }

    const allKeys = await app.getAllKeyTexts();
    for (const k of keysToInsert) {
      expect(allKeys).toContain(String(k));
    }

    // Node count should increase or remain consistent (structure updated)
    const nodeCount = await app.getNodeCount();
    expect(nodeCount).toBeGreaterThan(0);
  });

  test('Insert invalid key (out of range / empty) triggers validation alert (edge case)', async ({ page }) => {
    // When inserting invalid values, app shows an alert. Capture and assert message.
    const app3 = new BTreePage(page);
    await app.navigate();

    // Empty input
    let dialogMsg = await app.insertKey('', { expectAlert: true });
    expect(dialogMsg).toBeTruthy();
    expect(dialogMsg).toContain('Please enter a valid integer key between 1 and 99');

    // Zero (out of allowed range)
    dialogMsg = await app.insertKey(0, { expectAlert: true });
    expect(dialogMsg).toContain('Please enter a valid integer key between 1 and 99');

    // Too large
    dialogMsg = await app.insertKey(150, { expectAlert: true });
    expect(dialogMsg).toContain('Please enter a valid integer key between 1 and 99');
  });

  test('Insert duplicate key triggers alert and does not add duplicate', async ({ page }) => {
    // Attempt to insert a key that exists in the seeded initialKeys (e.g., 10)
    const app4 = new BTreePage(page);
    await app.navigate();

    const duplicateKey = 10;
    const beforeKeys = await app.getAllKeyTexts();
    const dialogMsg1 = await app.insertKey(duplicateKey, { expectAlert: true });

    expect(dialogMsg).toBeTruthy();
    expect(dialogMsg).toContain(`Key ${duplicateKey} already exists in the tree.`);

    const afterKeys1 = await app.getAllKeyTexts();
    // No new duplication - number of occurrences of duplicateKey should remain same (1)
    const occurrencesBefore = beforeKeys.filter(k => k === String(duplicateKey)).length;
    const occurrencesAfter = afterKeys.filter(k => k === String(duplicateKey)).length;
    expect(occurrencesAfter).toBe(occurrencesBefore);
  });

  test('Reset Tree from Idle (S0 -> S2_TreeReset) clears the B-Tree visualization', async ({ page }) => {
    // Reset when in Idle should clear all keys and re-render an empty root
    const app5 = new BTreePage(page);
    await app.navigate();

    // Ensure there are keys initially
    const beforeCount1 = await app.getKeyCount();
    expect(beforeCount).toBeGreaterThan(0);

    await app.resetTree();

    // After reset, tree should be empty (no .key elements)
    const afterCount1 = await app.getKeyCount();
    expect(afterCount).toBe(0);

    // The container still should have a node representing empty root
    const nodeCount1 = await app.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(1);
  });

  test('Reset Tree after insert (S1 -> S2) clears the structure and allows reinsertion', async ({ page }) => {
    // Insert a key, then reset, then insert the same key and verify it's allowed (no duplicate)
    const app6 = new BTreePage(page);
    await app.navigate();

    const testKey = 44;
    await app.insertKey(testKey);
    let keys = await app.getAllKeyTexts();
    expect(keys).toContain(String(testKey));

    // Now reset the tree
    await app.resetTree();
    let afterResetCount = await app.getKeyCount();
    expect(afterResetCount).toBe(0);

    // Insert the same key again - should be allowed now (no duplicate alert)
    const dialogMsg2 = await app.insertKey(testKey, { expectAlert: false });
    // If a dialog unexpectedly appears, previous setup dismisses it automatically; we assert it didn't produce duplicate message
    const keysAfter = await app.getAllKeyTexts();
    expect(keysAfter).toContain(String(testKey));
  });

  test('Visualization draws connections and retains structure after several inserts (structural checks)', async ({ page }) => {
    // Insert several keys to provoke splitting and structural changes; verify nodes and svg lines update
    const app7 = new BTreePage(page);
    await app.navigate();

    const manyKeys = [33, 34, 35, 36, 37];
    for (const k of manyKeys) {
      await app.insertKey(k);
    }

    // Ensure keys are present
    const allKeys1 = await app.getAllKeyTexts();
    for (const k of manyKeys) {
      expect(allKeys).toContain(String(k));
    }

    // Node count should be greater than 1 (splits cause multiple nodes)
    const nodes = await app.getNodeCount();
    expect(nodes).toBeGreaterThan(1);

    // SVG should contain connecting lines after structural changes
    const hasLines1 = await app.svgHasLines();
    expect(hasLines).toBeTruthy();
  });
});