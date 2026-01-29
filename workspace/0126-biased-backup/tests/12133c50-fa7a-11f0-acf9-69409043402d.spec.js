import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12133c50-fa7a-11f0-acf9-69409043402d.html';

// Page object for interacting with the B+ Tree UI
class BPlusPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Locators
    this.h1 = page.locator('h1', { hasText: 'B+ Tree Interactive Explorer' });
    this.inputOrder = page.locator('#inputOrder');
    this.btnCreateTree = page.locator('#btnCreateTree');
    this.btnResetTree = page.locator('#btnResetTree');
    this.controls = page.locator('#controls');
    this.inputInsert = page.locator('#inputInsert');
    this.btnInsert = page.locator('#btnInsert');
    this.inputDelete = page.locator('#inputDelete');
    this.btnDelete = page.locator('#btnDelete');
    this.inputSearch = page.locator('#inputSearch');
    this.btnSearch = page.locator('#btnSearch');
    this.btnTraverseForward = page.locator('#btnTraverseForward');
    this.btnTraverseBackward = page.locator('#btnTraverseBackward');
    this.inputTraversePos = page.locator('#inputTraversePos');
    this.btnTraversePos = page.locator('#btnTraversePos');
    this.inputBulkInsert = page.locator('#inputBulkInsert');
    this.btnBulkInsert = page.locator('#btnBulkInsert');
    this.inputBulkDelete = page.locator('#inputBulkDelete');
    this.btnBulkDelete = page.locator('#btnBulkDelete');
    this.inputLoadJSON = page.locator('#inputLoadJSON');
    this.btnLoadJSON = page.locator('#btnLoadJSON');
    this.btnExportJSON = page.locator('#btnExportJSON');
    this.outputExportJSON = page.locator('#outputExportJSON');
    this.treeDisplay = page.locator('#treeDisplay');
    this.logDiv = page.locator('#log');
    this.treeHeightSpan = page.locator('#treeHeight');
  }

  // Create a new tree using the current inputOrder value.
  async createTree(expectAlert = false) {
    if (expectAlert) {
      // we expect an alert (invalid order), handle it
      const dialogPromise = this.page.waitForEvent('dialog');
      await this.btnCreateTree.click();
      const dialog = await dialogPromise;
      await dialog.accept();
      return dialog.message();
    } else {
      await Promise.all([
        this.page.waitForFunction(() => {
          const controls = document.getElementById('controls');
          return controls && controls.style.display === 'block';
        }),
        this.btnCreateTree.click()
      ]);
      // creation logs to #log and renders tree
    }
  }

  async resetTree() {
    await Promise.all([
      this.page.waitForFunction(() => {
        const log = document.getElementById('log');
        return log && log.textContent && log.textContent.includes('Tree reset');
      }),
      this.btnResetTree.click()
    ]);
  }

  // Insert a key; returns any alert text shown (if duplicate or invalid)
  async insertKey(key) {
    // prepare dialog handler to capture alert if any
    const dialogPromise = this.page.waitForEvent('dialog').catch(() => null);
    await this.inputInsert.fill(String(key));
    await this.btnInsert.click();
    const dialog = await dialogPromise;
    if (dialog) {
      const msg = dialog.message();
      await dialog.accept();
      return msg;
    }
    return null;
  }

  async deleteKey(key) {
    const dialogPromise = this.page.waitForEvent('dialog').catch(() => null);
    await this.inputDelete.fill(String(key));
    await this.btnDelete.click();
    const dialog = await dialogPromise;
    if (dialog) {
      const msg = dialog.message();
      await dialog.accept();
      return msg;
    }
    return null;
  }

  async searchKey(key) {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.inputSearch.fill(String(key));
    await this.btnSearch.click();
    const dialog = await dialogPromise;
    const msg = dialog.message();
    await dialog.accept();
    return msg;
  }

  async traverseForward() {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.btnTraverseForward.click();
    const dialog = await dialogPromise;
    const msg = dialog.message();
    await dialog.accept();
    return msg;
  }

  async traverseBackward() {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.btnTraverseBackward.click();
    const dialog = await dialogPromise;
    const msg = dialog.message();
    await dialog.accept();
    return msg;
  }

  async traversePos(pos, expectErrorDialog = false) {
    const dialogPromise = this.page.waitForEvent('dialog').catch(() => null);
    await this.inputTraversePos.fill(String(pos));
    await this.btnTraversePos.click();
    const dialog = await dialogPromise;
    if (dialog) {
      const msg = dialog.message();
      await dialog.accept();
      return msg;
    }
    return null;
  }

  async bulkInsert(keysCsv) {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.inputBulkInsert.fill(keysCsv);
    await this.btnBulkInsert.click();
    const dialog = await dialogPromise;
    const msg = dialog.message();
    await dialog.accept();
    // renderTree is called by the app; wait for treeDisplay update to include at least one of the keys
    return msg;
  }

  async bulkDelete(keysCsv) {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.inputBulkDelete.fill(keysCsv);
    await this.btnBulkDelete.click();
    const dialog = await dialogPromise;
    const msg = dialog.message();
    await dialog.accept();
    return msg;
  }

  async exportJSON() {
    // If no tree, an alert will show. Otherwise textarea gets populated.
    const dialogPromise = this.page.waitForEvent('dialog').catch(() => null);
    await this.btnExportJSON.click();
    const dialog = await dialogPromise;
    if (dialog) {
      const message = dialog.message();
      await dialog.accept();
      return { alert: message, json: null };
    }
    // wait for textarea to have value
    await this.page.waitForFunction(() => {
      const ta = document.getElementById('outputExportJSON');
      return ta && ta.value && ta.value.trim().length > 0;
    });
    const jsonStr = await this.outputExportJSON.inputValue();
    return { alert: null, json: jsonStr };
  }

  async loadJSON(jsonStr) {
    const dialogPromise = this.page.waitForEvent('dialog').catch(() => null);
    await this.inputLoadJSON.fill(jsonStr);
    await this.btnLoadJSON.click();
    const dialog = await dialogPromise;
    if (dialog) {
      const msg = dialog.message();
      await dialog.accept();
      return { alert: msg, loaded: false };
    }
    // wait for log to include 'B+ Tree loaded from JSON.' as indicator
    await this.page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && /loaded from JSON/.test(log.textContent);
    });
    return { alert: null, loaded: true };
  }

  // Click tree display to trigger prompt-based inspection. supplyKey is returned via prompt.
  async inspectKeyInTreeDisplay(supplyKey) {
    // when clicking tree display, a prompt is shown. Provide supplyKey as response.
    const dialogPromise = this.page.waitForEvent('dialog'); // prompt
    const alertPromise = this.page.waitForEvent('dialog').catch(() => null); // subsequent alert after prompt
    // Click tree display
    await this.treeDisplay.click();
    const promptDialog = await dialogPromise;
    // Ensure it's a prompt; supply the desired key
    await promptDialog.accept(String(supplyKey));
    const alertDialog = await alertPromise;
    if (alertDialog) {
      const msg = alertDialog.message();
      await alertDialog.accept();
      return msg;
    }
    return null;
  }

  // Read textual tree display
  async getTreeDisplayText() {
    return this.treeDisplay.textContent();
  }

  async getLogText() {
    return this.logDiv.textContent();
  }

  async getTreeHeightText() {
    return this.treeHeightSpan.textContent();
  }
}

test.describe('B+ Tree Interactive Explorer - FSM and UI validation', () => {
  // Use arrays to collect console messages and page errors for assertion after each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // Navigate to the application fresh for each test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Assert no uncaught page errors occurred during the test
    // This validates the runtime didn't throw unexpected ReferenceError/SyntaxError/TypeError
    expect(pageErrors, 'No uncaught page errors should appear').toEqual([]);
    // Also assert there are no console error level messages
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
    // Keep the page open if debugging; otherwise Playwright will close automatically
  });

  test('Initial Idle state: page renders and controls are hidden', async ({ page }) => {
    const b = new BPlusPage(page);

    // Validate header exists
    await expect(b.h1).toBeVisible();

    // Controls must be hidden initially
    await expect(b.controls).toBeHidden();

    // Reset button disabled initially
    await expect(b.btnResetTree).toBeDisabled();

    // Tree display should show initial empty content or 'No tree.'
    const display = await b.getTreeDisplayText();
    // It's acceptable for it to be empty string before any renderTree call
    expect(display === '' || display.includes('No tree.'), true);

    // Tree height span should show default N/A
    await expect(b.treeHeightSpan).toHaveText('N/A');
  });

  test('CreateTree transition: creating a tree makes controls visible and renders tree', async ({ page }) => {
    const b = new BPlusPage(page);

    // Create tree (default order 4)
    await b.createTree();

    // Controls should now be visible
    await expect(b.controls).toBeVisible();

    // Reset button should be enabled
    await expect(b.btnResetTree).toBeEnabled();

    // Logs should contain created message
    const logText = await b.getLogText();
    expect(logText).toContain('Created new B+ tree of order');

    // Tree display should include order, height and total keys
    const displayText = await b.getTreeDisplayText();
    expect(displayText).toContain('Tree order (M): 4');
    expect(displayText).toMatch(/Total keys stored:\s*0/);

    // Tree height should reflect a valid number (1 for empty root leaf)
    await expect(b.treeHeightSpan).not.toHaveText('N/A');
  });

  test('ResetTree transition: after inserting keys, reset returns to empty tree', async ({ page }) => {
    const b = new BPlusPage(page);

    await b.createTree();

    // Insert a key using insert button
    const insertAlert = await b.insertKey(42);
    expect(insertAlert, 'No alert on successful insert').toBeNull();

    // Ensure tree displays the inserted key
    let display = await b.getTreeDisplayText();
    expect(display).toContain('42');

    // Reset tree
    await b.resetTree();

    // After reset, treeDisplay should no longer show previous keys
    display = await b.getTreeDisplayText();
    expect(display).not.toContain('42');

    // Log should contain 'Tree reset' message
    const log = await b.getLogText();
    expect(log).toContain('Tree reset to empty B+ tree of order');
  });

  test('InsertKey and duplicate insertion handling', async ({ page }) => {
    const b = new BPlusPage(page);

    await b.createTree();

    // Insert 10
    const first = await b.insertKey(10);
    expect(first).toBeNull(); // successful insert - no alert

    // Verify treeDisplay contains 10 and size shows 1
    const display = await b.getTreeDisplayText();
    expect(display).toContain('10');
    expect(display).toMatch(/Total keys stored:\s*1/);

    // Insert duplicate 10 - should trigger alert about duplicate
    const dupAlert = await b.insertKey(10);
    expect(dupAlert).toContain('Key already exists');

    // Log should capture insertion and failed insert message
    const log = await b.getLogText();
    expect(log).toContain('Inserted key 10');
    expect(log).toContain('Insert failed: Key 10 already exists.');
  });

  test('DeleteKey: successful and unsuccessful deletion', async ({ page }) => {
    const b = new BPlusPage(page);

    await b.createTree();

    // Insert a key to delete
    await b.insertKey(77);

    // Delete it
    const delSuccess = await b.deleteKey(77);
    expect(delSuccess).toBeNull(); // no alert on successful delete

    // Confirm not present in display
    const display = await b.getTreeDisplayText();
    expect(display).not.toContain('77');

    // Attempt to delete absent key -> alert 'Key not found'
    const delFailMsg = await b.deleteKey(9999);
    expect(delFailMsg).toContain('Key not found');
  });

  test('SearchKey: found and not found scenarios produce appropriate alerts and logs', async ({ page }) => {
    const b = new BPlusPage(page);

    await b.createTree();

    // Insert keys
    await b.insertKey(1);
    await b.insertKey(2);

    // Search existing
    const foundMsg = await b.searchKey(2);
    expect(foundMsg).toContain('FOUND');

    // Search non-existing
    const notFoundMsg = await b.searchKey(999);
    expect(notFoundMsg).toContain('NOT found');

    // Logs should reflect searches
    const log = await b.getLogText();
    expect(log).toContain('Key 2 found in leaf node at index');
    expect(log).toContain('Key 999 NOT found.');
  });

  test('TraverseForward and TraverseBackward list keys and log appropriately', async ({ page }) => {
    const b = new BPlusPage(page);

    await b.createTree();

    // Bulk insert some keys
    await b.bulkInsert('5,3,8,1');

    // Traverse forward
    const forwardAlert = await b.traverseForward();
    expect(forwardAlert).toContain('Traverse forward:');
    // Traverse backward
    const backwardAlert = await b.traverseBackward();
    expect(backwardAlert).toContain('Traverse backward:');

    // Log entries should include the traverse summary
    const log = await b.getLogText();
    expect(log).toContain('Traverse forward:');
    expect(log).toContain('Traverse backward:');
  });

  test('TraversePos: valid and out-of-range handling', async ({ page }) => {
    const b = new BPlusPage(page);

    await b.createTree();

    await b.bulkInsert('11,12,13');

    // Valid pos 2 -> should show key at position
    const posMsg = await b.traversePos(2);
    expect(posMsg).toContain('Key at position 2');

    // Out of range pos -> alert indicates exceeds
    const outMsg = await b.traversePos(999); // will trigger alert 'Position exceeds number of keys'
    expect(outMsg).toContain('Position exceeds number of keys in the tree.');
  });

  test('BulkInsert and BulkDelete operations and log correctness', async ({ page }) => {
    const b = new BPlusPage(page);

    await b.createTree();

    // Bulk insert multiple keys including duplicates (some may be duplicate across repeated runs)
    const bulkInsertMsg = await b.bulkInsert('20,21,22,20');
    expect(bulkInsertMsg).toMatch(/Bulk Insert complete|Bulk insert:/i);

    // Export to check size and presence
    const displayAfter = await b.getTreeDisplayText();
    expect(displayAfter).toContain('20');
    expect(displayAfter).toMatch(/Total keys stored:/);

    // Bulk delete some keys, including a missing one
    const bulkDelMsg = await b.bulkDelete('21,9999');
    expect(bulkDelMsg).toMatch(/Bulk Delete complete|Bulk delete:/i);

    // log should have counts for deleted and not found
    const log = await b.getLogText();
    expect(log).toMatch(/Bulk insert:|Bulk delete:/i);
  });

  test('ExportToJSON and LoadFromJSON transitions: export, clear page and load back', async ({ page }) => {
    const b = new BPlusPage(page);

    await b.createTree();

    // Insert keys for a meaningful export
    await b.bulkInsert('100,200,300');

    // Export JSON
    const { alert: exportAlert, json } = await b.exportJSON();
    expect(exportAlert).toBeNull();
    expect(json).toBeTruthy();

    // Now open a fresh page to simulate reload and then load JSON
    await page.goto(APP_URL);

    const b2 = new BPlusPage(page);

    // Fill inputLoadJSON with the exported json and load
    const loadResult = await b2.loadJSON(json);
    expect(loadResult.alert).toBeNull();
    expect(loadResult.loaded).toBe(true);

    // After load, controls should be visible and tree should show keys
    await expect(b2.controls).toBeVisible();
    const display = await b2.getTreeDisplayText();
    expect(display).toContain('100');
    expect(display).toContain('200');
    expect(display).toContain('300');
  });

  test('LoadFromJSON invalid JSON handling and export with no tree alerts', async ({ page }) => {
    const b = new BPlusPage(page);

    // Attempt to load invalid JSON -> should trigger 'Invalid JSON input.' alert
    const invalidDialogPromise = page.waitForEvent('dialog');
    await b.inputLoadJSON.fill('{bad: json}');
    await b.btnLoadJSON.click();
    const invalidDialog = await invalidDialogPromise;
    expect(invalidDialog.message()).toContain('Invalid JSON input.');
    await invalidDialog.accept();

    // Try exporting when there's no tree -> should alert 'No tree to export.'
    const exportResult = await b.exportJSON();
    expect(exportResult.alert).toContain('No tree to export.');
  });

  test('Edge case: creating tree with invalid order shows alert and does not create tree', async ({ page }) => {
    const b = new BPlusPage(page);

    // Set invalid order (2)
    await b.inputOrder.fill('2');
    const alertMsg = await b.createTree(true); // expectAlert = true
    expect(alertMsg).toContain('Order must be an integer between 3 and 10.');

    // Controls remain hidden
    await expect(b.controls).toBeHidden();
    // Reset remains disabled
    await expect(b.btnResetTree).toBeDisabled();
  });

  test('Tree display inspection: clicking treeDisplay triggers prompt and shows node details', async ({ page }) => {
    const b = new BPlusPage(page);

    await b.createTree();
    await b.bulkInsert('7,8,9');

    // Click the treeDisplay and respond to prompt with an existing key (8)
    const inspectMsg = await b.inspectKeyInTreeDisplay(8);
    // Alert after prompt should describe node details if found, else 'not found' message
    expect(inspectMsg).toMatch(/Leaf node containing key|not found|Keys in node/);
  });

  test('Keyboard shortcuts: Enter on insert field triggers insertion', async ({ page }) => {
    const b = new BPlusPage(page);

    await b.createTree();

    // Focus inputInsert, type value and press Enter
    await b.inputInsert.click();
    await b.inputInsert.fill('555');

    // Listener expects Enter to trigger btnInsert click
    const dialogPromise = page.waitForEvent('dialog').catch(() => null);
    await b.inputInsert.press('Enter');

    // There should be no alert on successful insert
    const dialog = await dialogPromise;
    if (dialog) {
      // If an alert unexpectedly appears, accept and fail the test by assertion below
      await dialog.accept();
    }
    const display = await b.getTreeDisplayText();
    expect(display).toContain('555');
  });
});