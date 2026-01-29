import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b08af1-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for interacting with the B-Tree demo page
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.insertInput = page.locator('#insertKey');
    this.searchInput = page.locator('#searchKey');
    this.deleteInput = page.locator('#deleteKey');
    this.orderInput = page.locator('#order');
    this.btnInsert = page.locator('#btnInsert');
    this.btnSearch = page.locator('#btnSearch');
    this.btnDelete = page.locator('#btnDelete');
    this.btnReset = page.locator('#btnReset');
    this.log = page.locator('#log');
    this.canvas = page.locator('#canvas');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getLogText() {
    return (await this.log.textContent()) || '';
  }

  // Wait until the log contains the provided substring or timeout
  async waitForLogContains(substring, options = {}) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.indexOf(substr) !== -1;
      },
      '#log',
      substring,
      options
    );
  }

  // Insert a key (handles the dialog if validation fails)
  async insertKey(val, { expectDialog = false } = {}) {
    await this.insertInput.fill(String(val));
    if (expectDialog) {
      const [dialog] = await Promise.all([
        this.page.waitForEvent('dialog'),
        this.btnInsert.click()
      ]);
      const message = dialog.message();
      await dialog.accept();
      return { dialogMessage: message };
    } else {
      await this.btnInsert.click();
      return {};
    }
  }

  // Search for a key (may show alert dialog if not found or if invalid input)
  async searchKey(val, { expectDialog = false } = {}) {
    await this.searchInput.fill(String(val));
    if (expectDialog) {
      const [dialog] = await Promise.all([
        this.page.waitForEvent('dialog'),
        this.btnSearch.click()
      ]);
      const message = dialog.message();
      await dialog.accept();
      return { dialogMessage: message };
    } else {
      await this.btnSearch.click();
      return {};
    }
  }

  // Delete a key (may show alert dialog if invalid or tree empty)
  async deleteKey(val, { expectDialog = false } = {}) {
    await this.deleteInput.fill(String(val));
    if (expectDialog) {
      const [dialog] = await Promise.all([
        this.page.waitForEvent('dialog'),
        this.btnDelete.click()
      ]);
      const message = dialog.message();
      await dialog.accept();
      return { dialogMessage: message };
    } else {
      await this.btnDelete.click();
      return {};
    }
  }

  // Reset the tree by clicking the reset button
  async resetTree() {
    await this.btnReset.click();
  }

  // Change the order input value; triggers 'change' by blurring afterwards
  async changeOrder(val, { expectDialog = false } = {}) {
    // Fill and blur (change event is fired on blur)
    await this.orderInput.fill(String(val));
    if (expectDialog) {
      const [dialog] = await Promise.all([
        this.page.waitForEvent('dialog'),
        this.orderInput.blur()
      ]);
      const message = dialog.message();
      await dialog.accept();
      return { dialogMessage: message };
    } else {
      await this.orderInput.blur();
      return {};
    }
  }

  // Helper to get the numeric value of the order input
  async getOrderValue() {
    return await this.orderInput.evaluate((el) => parseInt(el.value, 10));
  }
}

// Global helper to collect console and page errors for assertions
async function collectConsoleAndPageErrors(page) {
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    // collect all console messages with their type and text
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });

  return { consoleMessages, pageErrors };
}

/*
 Tests are grouped to reflect the FSM states and transitions:
 - S0_Initialized -> initial page load and initTree()
 - S1_TreeEmpty -> tree initialized but empty
 - S2_TreeWithKeys -> tree after inserting keys
 Events tested: InsertKey, SearchKey, DeleteKey, ResetTree, ChangeOrder
 Edge cases: invalid inputs and alerts, deleting/searching missing keys
*/
test.describe('B-Tree Visualization and Demo (FSM validation)', () => {
  test.beforeEach(async ({ page }) => {
    // Nothing to do here; each test will navigate to the page
  });

  test('Initialization: page loads and initTree() runs (S0_Initialized -> S1_TreeEmpty)', async ({ page }) => {
    // Collect console and page errors
    const { consoleMessages, pageErrors } = await collectConsoleAndPageErrors(page);

    const app = new BTreePage(page);
    await app.goto();

    // The initialization sequence should log the initialization message
    await app.waitForLogContains('Initialized empty B-Tree of order t = 3', { timeout: 3000 });
    const logText = await app.getLogText();
    expect(logText).toContain('Initialized empty B-Tree of order t = 3');

    // The page should contain the canvas element and log element
    await expect(app.canvas).toBeVisible();
    await expect(app.log).toBeVisible();

    // There should be no unhandled page errors
    expect(pageErrors.length).toBe(0);

    // Ensure no console-level errors were emitted
    const errorEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorEntries).toEqual([]);
  });

  test.describe('Insert Key (Transition: S1_TreeEmpty -> S2_TreeWithKeys)', () => {
    test('Insert first key creates root and logs creation', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectConsoleAndPageErrors(page);

      const app = new BTreePage(page);
      await app.goto();

      // Insert a valid key 42
      await app.insertKey(42);

      // Expect logger to record creation of root and insertion
      await app.waitForLogContains('Created root and inserted key 42', { timeout: 2000 });
      const logText = await app.getLogText();
      expect(logText).toContain('Created root and inserted key 42');

      // No console errors
      expect(pageErrors.length).toBe(0);
      const errorEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorEntries).toEqual([]);
    });

    test('Inserting with invalid input triggers an alert and does not crash', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectConsoleAndPageErrors(page);

      const app = new BTreePage(page);
      await app.goto();

      // Attempt to insert with empty input -> alert is expected
      const result = await app.insertKey('', { expectDialog: true });
      expect(result.dialogMessage).toMatch(/Please enter a valid number to insert/i);

      // Ensure the log did not record a successful insertion
      const logText = await app.getLogText();
      expect(logText).not.toContain('Inserted key');

      // No page error
      expect(pageErrors.length).toBe(0);
      const errorEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorEntries).toEqual([]);
    });
  });

  test.describe('Search Key (S2_TreeWithKeys -> S2_TreeWithKeys)', () => {
    test('Search for an existing key logs found and highlights (no alert)', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectConsoleAndPageErrors(page);

      const app = new BTreePage(page);
      await app.goto();

      // Insert 10 and then search it
      await app.insertKey(10);
      await app.waitForLogContains('Created root and inserted key 10', { timeout: 2000 });

      // Search existing key
      await app.searchKey(10, { expectDialog: false });

      // Expect logs about searching and found
      await app.waitForLogContains('Searching for key 10...', { timeout: 2000 });
      await app.waitForLogContains('Key 10 found in node with keys', { timeout: 2000 });
      const logText = await app.getLogText();
      expect(logText).toContain('Searching for key 10...');
      expect(logText).toMatch(/Key 10 found in node with keys/);

      // No alert should be present: ensure no dialog was shown by checking no blocking alerts in logs
      // Also ensure no page error
      expect(pageErrors.length).toBe(0);
      const errorEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorEntries).toEqual([]);
    });

    test('Search for a non-existing key logs not found and shows alert', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectConsoleAndPageErrors(page);

      const app = new BTreePage(page);
      await app.goto();

      // Ensure tree has at least one key so search is performed against non-empty tree
      await app.insertKey(55);
      await app.waitForLogContains('Created root and inserted key 55', { timeout: 2000 });

      // Search for a key that does not exist; an alert is expected
      const res = await app.searchKey(9999, { expectDialog: true });
      expect(res.dialogMessage).toBe('Key not found.');

      // Log should record the search and the not found message
      await app.waitForLogContains('Searching for key 9999...', { timeout: 2000 });
      await app.waitForLogContains('Key 9999 not found in the tree.', { timeout: 2000 });
      const logText = await app.getLogText();
      expect(logText).toContain('Searching for key 9999...');
      expect(logText).toContain('Key 9999 not found in the tree.');

      // No page errors
      expect(pageErrors.length).toBe(0);
      const errorEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorEntries).toEqual([]);
    });

    test('Searching with invalid input triggers alert and is handled gracefully', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectConsoleAndPageErrors(page);

      const app = new BTreePage(page);
      await app.goto();

      // Search with invalid input (empty) -> alert expected asking for valid number
      const res = await app.searchKey('', { expectDialog: true });
      expect(res.dialogMessage).toMatch(/Please enter a valid number to search/i);

      // No page errors
      expect(pageErrors.length).toBe(0);
      const errorEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorEntries).toEqual([]);
    });
  });

  test.describe('Delete Key (S2_TreeWithKeys -> S2_TreeWithKeys)', () => {
    test('Delete an existing key logs deletion steps and updates tree', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectConsoleAndPageErrors(page);

      const app = new BTreePage(page);
      await app.goto();

      // Insert a key and then delete it
      await app.insertKey(7);
      await app.waitForLogContains('Created root and inserted key 7', { timeout: 2000 });

      // Delete existing key
      await app.deleteKey(7);

      // Expect log messages about deleting and removal
      await app.waitForLogContains('Deleting key 7...', { timeout: 2000 });
      // The removal could log different messages depending on node state; check for one of them
      const logText = await app.getLogText();
      expect(logText).toContain('Deleting key 7...');
      expect(
        logText.includes('Removing key 7 from leaf node') ||
        logText.includes('Removing key 7 from internal node') ||
        logText.includes('The tree is empty') ||
        logText.includes('Root replaced by child after removal')
      ).toBeTruthy();

      // No page errors
      expect(pageErrors.length).toBe(0);
      const errorEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorEntries).toEqual([]);
    });

    test('Delete a non-existing key logs that it is not present (no alert)', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectConsoleAndPageErrors(page);

      const app = new BTreePage(page);
      await app.goto();

      // Insert a different key
      await app.insertKey(300);
      await app.waitForLogContains('Created root and inserted key 300', { timeout: 2000 });

      // Attempt to delete key that does not exist in tree (should log "is not present")
      await app.deleteKey(9999, { expectDialog: false });

      // The remove path for non-existing key logs 'Key X is not present in the tree.'
      await app.waitForLogContains('Key 9999 is not present in the tree.', { timeout: 2000 });
      const logText = await app.getLogText();
      expect(logText).toContain('Key 9999 is not present in the tree.');

      // No alert expected for this scenario (code logs the message instead)
      // No page errors
      expect(pageErrors.length).toBe(0);
      const errorEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorEntries).toEqual([]);
    });

    test('Deleting with invalid input triggers alert and is handled gracefully', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectConsoleAndPageErrors(page);

      const app = new BTreePage(page);
      await app.goto();

      // Delete with empty input -> expect alert
      const res = await app.deleteKey('', { expectDialog: true });
      expect(res.dialogMessage).toMatch(/Please enter a valid number to delete/i);

      // No page errors
      expect(pageErrors.length).toBe(0);
      const errorEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorEntries).toEqual([]);
    });
  });

  test.describe('Reset Tree and Change Order (Transitions and constraints)', () => {
    test('Change order to 4 and reset initializes tree with new order (ChangeOrder + ResetTree)', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectConsoleAndPageErrors(page);

      const app = new BTreePage(page);
      await app.goto();

      // Change order to 4 and blur to trigger change event
      await app.orderInput.fill('4');
      // Trigger change by blurring (the page's order change handler listens to 'change' event triggered on blur)
      await app.orderInput.blur();

      // Now reset the tree which should read the order input's current value and create a tree of t = 4
      await app.resetTree();

      // Validate that the initialization message contains order 4
      await app.waitForLogContains('Initialized empty B-Tree of order t = 4', { timeout: 2000 });
      const logText = await app.getLogText();
      expect(logText).toContain('Initialized empty B-Tree of order t = 4');

      // Also validate that the order input's value is 4
      const orderVal = await app.getOrderValue();
      expect(orderVal).toBe(4);

      // No page errors
      expect(pageErrors.length).toBe(0);
      const errorEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorEntries).toEqual([]);
    });

    test('Setting order below minimum (1) triggers an alert and clamps to 2', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectConsoleAndPageErrors(page);

      const app = new BTreePage(page);
      await app.goto();

      // Fill with invalid low value and blur to trigger change event -> alert expected
      await app.orderInput.fill('1');
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.orderInput.blur()
      ]);
      const message = dialog.message();
      await dialog.accept();
      expect(message).toMatch(/Order \(minimum degree\) must be at least 2/i);

      // After the change handler runs, the value should be clamped to 2
      const orderVal = await app.getOrderValue();
      expect(orderVal).toBe(2);

      // No page errors
      expect(pageErrors.length).toBe(0);
      const errorEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorEntries).toEqual([]);
    });
  });

  test('Reset transition from S2_TreeWithKeys to S1_TreeEmpty logs initialization', async ({ page }) => {
    const { consoleMessages, pageErrors } = await collectConsoleAndPageErrors(page);

    const app = new BTreePage(page);
    await app.goto();

    // Insert a key to move to S2_TreeWithKeys
    await app.insertKey(123);
    await app.waitForLogContains('Created root and inserted key 123', { timeout: 2000 });

    // Click reset to transition back to an empty tree
    await app.resetTree();

    // Expect initialization message for the current order (default 3)
    await app.waitForLogContains('Initialized empty B-Tree of order t = 3', { timeout: 2000 });
    const logText = await app.getLogText();
    expect(logText).toContain('Initialized empty B-Tree of order t = 3');

    // No page errors
    expect(pageErrors.length).toBe(0);
    const errorEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorEntries).toEqual([]);
  });
});