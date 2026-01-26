import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d02ff2-fa79-11f0-8075-e54a10595dde.html';

/**
 * Page Object representing the B-Tree demo page.
 * Encapsulates selectors and common interactions.
 */
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.orderInput = page.locator('#order');
    this.createBtn = page.locator('#createTree');
    this.treeStructure = page.locator('#treeStructure');
    this.insertInput = page.locator('#insertValue');
    this.insertBtn = page.locator('#insertBtn');
    this.searchInput = page.locator('#searchValue');
    this.searchBtn = page.locator('#searchBtn');
    this.searchResult = page.locator('#searchResult');
    this.deleteInput = page.locator('#deleteValue');
    this.deleteBtn = page.locator('#deleteBtn');
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Create a b-tree with specified order (number)
  async createTree(order = 3) {
    await this.orderInput.fill(String(order));
    await this.createBtn.click();
    // Wait for the explicit created message to appear
    await expect(this.treeStructure).toHaveText(new RegExp(`B-Tree Created with Order: ${order}`));
  }

  // Insert a value (number or string)
  async insert(value) {
    await this.insertInput.fill(String(value));
    await this.insertBtn.click();
    // After insertion, treeStructure should update (may include the inserted value)
    // We'll wait briefly for DOM update; tests will assert specific textual content.
    await this.page.waitForTimeout(100);
  }

  // Search for a value and return the search result text
  async search(value) {
    await this.searchInput.fill(String(value));
    await this.searchBtn.click();
    await this.page.waitForTimeout(50);
    return this.searchResult.textContent();
  }

  // Delete a value
  async delete(value) {
    await this.deleteInput.fill(String(value));
    await this.deleteBtn.click();
    await this.page.waitForTimeout(100);
  }

  // Helper to read tree structure text
  async getTreeStructureText() {
    return (await this.treeStructure.textContent()) || '';
  }

  // Helper to read search result text
  async getSearchResultText() {
    return (await this.searchResult.textContent()) || '';
  }
}

test.describe('B-Tree Index Demo - FSM and UI behavior', () => {
  // Arrays to capture console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', error => {
      // The Error object includes name and message
      pageErrors.push({ name: error.name, message: error.message || String(error) });
    });
  });

  test.afterEach(async ({ page }) => {
    // For easier debugging in CI, if an unexpected page error occurred, print it.
    if (pageErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Captured page errors:', pageErrors);
    }
    // Also, print any console warnings/errors if they exist
    const interesting = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    if (interesting.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Captured console messages (warnings/errors):', interesting);
    }
    // Ensure arrays are cleared for next test (not strictly required since they are reinitialized).
  });

  test('Idle state (S0_Idle) - initial controls render correctly', async ({ page }) => {
    // Validate initial rendering of the page and presence of expected controls
    const btree = new BTreePage(page);
    await btree.goto();

    // Verify control existence
    await expect(btree.createBtn).toBeVisible();
    await expect(btree.insertBtn).toBeVisible();
    await expect(btree.searchBtn).toBeVisible();
    await expect(btree.deleteBtn).toBeVisible();
    await expect(btree.orderInput).toHaveValue('3'); // default value as per implementation

    // No page errors should occur on simple load
    expect(pageErrors).toHaveLength(0);
  });

  test('CreateTree event transitions to Tree Created (S1_TreeCreated)', async ({ page }) => {
    // This test validates clicking "Create B-Tree" sets the treeStructure to show creation message.
    const btree = new BTreePage(page);
    await btree.goto();

    await btree.createTree(3);

    const text = await btree.getTreeStructureText();
    expect(text).toContain('B-Tree Created with Order: 3');

    // Ensure no uncaught errors occurred during a normal create
    expect(pageErrors).toHaveLength(0);
  });

  test('InsertValue event updates tree structure (S2_ValueInserted)', async ({ page }) => {
    // This test validates insertion after creation updates the tree structure to include the inserted key.
    const btree = new BTreePage(page);
    await btree.goto();

    // Create tree first (FSM transition S0 -> S1)
    await btree.createTree(3);

    // Insert a single value and verify tree structure contains it
    await btree.insert(10);

    const structure = await btree.getTreeStructureText();
    // The toString method appends keys followed by space; ensure "10" appears
    expect(structure).toMatch(/(^| )10( |$)/);

    // No uncaught errors in normal insert
    expect(pageErrors).toHaveLength(0);
  });

  test('SearchValue event returns Value Found and Value Not Found (S3_ValueSearched)', async ({ page }) => {
    // Validates searching for existing and non-existing values after tree creation and insertion.
    const btree = new BTreePage(page);
    await btree.goto();

    // Setup: create and insert a value to search for
    await btree.createTree(3);
    await btree.insert(20);

    // Search for existing value
    const foundText = await btree.search(20);
    expect(foundText).toMatch(/Value Found/);

    // Search for a non-existing value
    const notFoundText = await btree.search(9999);
    expect(notFoundText).toMatch(/Value Not Found/);

    // No uncaught errors in the search flow
    expect(pageErrors).toHaveLength(0);
  });

  test('DeleteValue event calls delete and updates structure (S4_ValueDeleted)', async ({ page }) => {
    // The implementation's delete() is a stub (no-op), so we verify that calling Delete does not crash
    // and that the structure remains consistent (i.e., the deleted value remains because deletion is not implemented).
    const btree = new BTreePage(page);
    await btree.goto();

    await btree.createTree(3);
    await btree.insert(30);

    // Confirm the value is present before deletion
    const before = await btree.getTreeStructureText();
    expect(before).toMatch(/(^| )30( |$)/);

    // Perform delete (which is a no-op in provided implementation)
    await btree.delete(30);

    const after = await btree.getTreeStructureText();
    // Since delete is not implemented, the key should still be present
    expect(after).toMatch(/(^| )30( |$)/);

    // No uncaught errors during delete
    expect(pageErrors).toHaveLength(0);
  });

  test('Edge cases: invoking actions before creating a tree should raise TypeError (btree is undefined)', async ({ page }) => {
    // This test intentionally exercises the page without creating a tree first.
    // The code uses a global variable `btree` that is declared but not initialized.
    // Calling methods on undefined should produce a TypeError. We assert such errors are captured.
    const btree = new BTreePage(page);
    await btree.goto();

    // Clear any previously captured errors/messages
    pageErrors.length = 0;
    consoleMessages.length = 0;

    // Click insert/search/delete without creating the tree
    await btree.insertBtn.click();
    await btree.searchBtn.click();
    await btree.deleteBtn.click();

    // Wait a moment for pageerror events to be delivered
    await page.waitForTimeout(200);

    // We expect at least one TypeError to have been captured due to calling .insert/.search/.delete on undefined
    const hasTypeError = pageErrors.some(e => e.name === 'TypeError' || /TypeError/.test(e.message));
    expect(hasTypeError).toBeTruthy();

    // Optionally, ensure there is at least one error referencing 'btree' or 'undefined'
    const mentionsBtree = pageErrors.some(e => /btree/.test(e.message));
    // It's acceptable if the environment message varies; require either TypeError or mention of btree.
    expect(hasTypeError || mentionsBtree).toBeTruthy();
  });

  test('Edge case: inserting empty input results in NaN key (no crash, DOM shows NaN)', async ({ page }) => {
    // When insertValue is empty, parseInt('') -> NaN. The implementation will attempt to insert NaN.
    // We verify the treeStructure displays "NaN" and no uncaught exceptions occur.
    const btree = new BTreePage(page);
    await btree.goto();

    await btree.createTree(3);

    // Ensure insert input is empty and perform insert
    await btree.insertInput.fill('');
    await btree.insertBtn.click();

    // Wait for DOM update
    await page.waitForTimeout(100);

    const structure = await btree.getTreeStructureText();
    // The toString result should include "NaN" if NaN was inserted
    expect(structure).toContain('NaN');

    // No uncaught page errors expected for this behavior
    expect(pageErrors).toHaveLength(0);
  });

  test('Comprehensive flow: create -> insert multiple -> search each -> delete attempts (exercise FSM transitions)', async ({ page }) => {
    // This test walks through a sequence of operations to exercise multiple transitions and states.
    // It creates a tree, inserts several values, searches for them, and attempts to delete them.
    const btree = new BTreePage(page);
    await btree.goto();

    await btree.createTree(3);

    const values = [5, 15, 25, 35];
    for (const v of values) {
      await btree.insert(v);
    }

    // Verify each inserted value is present in the tree structure
    const structure = await btree.getTreeStructureText();
    for (const v of values) {
      expect(structure).toMatch(new RegExp(`(^| )${v}( |$)`));
    }

    // Search each value, expect "Value Found"
    for (const v of values) {
      const result = await btree.search(v);
      expect(result).toMatch(/Value Found/);
    }

    // Attempt to delete each value; since delete is a no-op, ensure no crashes and structure still contains values
    for (const v of values) {
      await btree.delete(v);
    }

    const finalStructure = await btree.getTreeStructureText();
    for (const v of values) {
      expect(finalStructure).toMatch(new RegExp(`(^| )${v}( |$)`));
    }

    // No uncaught errors expected in this normal multi-step flow
    expect(pageErrors).toHaveLength(0);
  });
});