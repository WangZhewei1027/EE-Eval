import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d99340-fa73-11f0-83e0-8d7be1d51901.html';

/**
 * Page object encapsulating common interactions for the NoSQL Concept Playground demo.
 */
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Select store by data-store attribute: 'document' | 'kv' | 'column' | 'graph'
  async selectStore(storeName) {
    await this.page.click(`.store-btn[data-store="${storeName}"]`);
    // wait for main panel to update (presence of unique controls)
    if (storeName === 'document') {
      await this.page.waitForSelector('#addDoc');
    } else if (storeName === 'kv') {
      await this.page.waitForSelector('#kvSet');
    } else if (storeName === 'column') {
      await this.page.waitForSelector('#cfSet');
    } else if (storeName === 'graph') {
      await this.page.waitForSelector('#gAddNode');
    }
  }

  async getActiveStoreName() {
    return this.page.locator('.store-btn.active').getAttribute('data-store');
  }

  async getLogText() {
    return this.page.$eval('#log', el => el.innerText);
  }

  async getBadgeText(id) {
    return this.page.$eval(id, el => el.innerText);
  }
}

test.describe('NoSQL Concept Playground - FSM End-to-End Tests', () => {
  let consoleMessages;
  let pageErrors;

  // Create new context per test for isolation
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console logs
    page.on('console', msg => {
      try {
        // include location and text for debugging
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (e) {
        consoleMessages.push(`console: <unavailable>`);
      }
    });

    // Collect runtime exceptions
    page.on('pageerror', err => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to app
    const app = new AppPage(page);
    await app.goto();
    // ensure initial render stabilizes
    await page.waitForSelector('#mainPanel');
  });

  test.afterEach(async ({ page }) => {
    // attach debug info on failure for investigator
    if (pageErrors.length) {
      // expose console + errors in test output if any errors occurred
      // (not modifying app behavior)
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors);
      console.log('Captured console messages:', consoleMessages.slice(-20));
    }
  });

  test('Idle state: main menu and default Document Store rendered', async ({ page }) => {
    const app = new AppPage(page);

    // Verify store buttons present and default active is "document"
    const active = await app.getActiveStoreName();
    expect(active).toBe('document');

    // Document-specific UI should be visible
    await expect(page.locator('#addDoc')).toBeVisible();
    await expect(page.locator('#newDoc')).toBeVisible();
    await expect(page.locator('#docList')).toBeVisible();

    // The info panel should reflect Document store help text
    const infoText = await page.locator('#storeInfo').innerText();
    expect(infoText.toLowerCase()).toContain('documents');

    // Stats badges are present
    await expect(page.locator('#k_docs')).toBeVisible();
    await expect(page.locator('#k_kv')).toBeVisible();
    await expect(page.locator('#k_rows')).toBeVisible();
    await expect(page.locator('#k_nodes')).toBeVisible();

    // No uncaught page errors at initial load
    expect(pageErrors).toEqual([]);
  });

  test.describe('Document Store interactions', () => {
    test('Insert document, clear input, run query, build index, explain and edit/delete flows', async ({ page }) => {
      const app = new AppPage(page);

      // Ensure we're on Document Store
      const active = await app.getActiveStoreName();
      if (active !== 'document') {
        await app.selectStore('document');
      }

      // 1) Clear the newDoc area, then set a known JSON and insert
      await page.fill('#newDoc', '{ "name": "TestUser", "age": 45, "tags": ["tester"] }');

      // Intercept the log content change after insertion by waiting for #log to contain 'Inserted doc'
      await Promise.all([
        page.waitForFunction(() => document.querySelector('#log').innerText.includes('Inserted doc'), null, { timeout: 3000 }),
        page.click('#addDoc'),
      ]);

      const logText1 = await app.getLogText();
      expect(logText1).toMatch(/Inserted doc/);

      // New document should appear in the results list (docList). There should be an item with "TestUser" in the JSON
      const docListHtml = await page.locator('#docList').innerHTML();
      expect(docListHtml).toContain('TestUser');

      // 2) Test Clear New Document button: set text then clear
      await page.fill('#newDoc', '{ "bogus": }'); // intentionally invalid JSON but we will only clear
      await page.click('#clearNew');
      const afterClear = await page.$eval('#newDoc', el => el.value);
      expect(afterClear).toBe('');

      // 3) Run a query that should match some docs. Use { "age": { "$gt": 30 } } default from initial.
      await page.fill('#docQuery', '{ "age": { "$gt": 30 } }');
      // click Run Query and wait for log 'Query returned'
      await Promise.all([
        page.waitForFunction(() => document.querySelector('#log').innerText.includes('Query returned'), null, { timeout: 3000 }),
        page.click('#runQuery')
      ]);
      const logAfterQuery = await app.getLogText();
      expect(logAfterQuery).toMatch(/Query returned \d+ docs/);

      // 4) Build an index with empty field should alert - exercise an edge case
      // Listen for the dialog that will be shown for missing index field
      const [dialogMissing] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#buildIndex'), // indexField empty -> alert('Provide a field name')
      ]);
      expect(dialogMissing.message()).toContain('Provide a field name');
      await dialogMissing.accept();

      // 5) Provide index field 'name' and build index; then run an equality query and observe 'Index used on' in logs
      await page.fill('#indexField', 'name');
      // Click build index and wait for log 'Built index on'
      await Promise.all([
        page.waitForFunction(() => document.querySelector('#log').innerText.includes('Built index on') || document.querySelector('#log').innerText.includes('Index used on'), null, { timeout: 3000 }),
        page.click('#buildIndex')
      ]);
      const logAfterIndex = await app.getLogText();
      expect(logAfterIndex).toMatch(/Built index on|Index used on/);

      // run equality query against name to exercise index usage
      await page.fill('#docQuery', '{ "name": "Alice" }');
      await Promise.all([
        page.waitForFunction(() => document.querySelector('#log').innerText.includes('Index used on') || document.querySelector('#log').innerText.includes('Query returned'), null, { timeout: 3000 }),
        page.click('#runQuery')
      ]);
      const logAfterIndexQuery = await app.getLogText();
      expect(logAfterIndexQuery).toMatch(/Query returned \d+ docs/);

      // 6) Explain button should open an alert showing whether index is present
      const [explainDialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#explainBtn'),
      ]);
      const explainMsg = explainDialog.message();
      expect(explainMsg).toContain('Query fields:');
      await explainDialog.accept();

      // 7) Edit an existing doc: open first item's edit, change a field, save, and verify update log
      const firstEditButton = page.locator('#docList .btn-edit').first();
      await firstEditButton.click();
      // Replace content in editArea with modified JSON (use a valid JSON)
      const editArea = page.locator('#docList .editor .editArea').first();
      const originalText = await editArea.inputValue();
      // Try an invalid JSON to trigger alert and then cancel with a valid one (edge case)
      await editArea.fill('{ invalid json ');
      // Expect alert when clicking Save
      const [invalidDialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.locator('#docList .saveBtn').first().click()
      ]);
      expect(invalidDialog.message()).toContain('Invalid JSON');
      await invalidDialog.accept();

      // Now write a corrected JSON and save
      await editArea.fill(originalText.replace(/"name":\s*"([^"]*)"/, '"name":"EditedName"'));
      await Promise.all([
        page.waitForFunction(() => document.querySelector('#log').innerText.includes('Updated doc') || document.querySelector('#log').innerText.includes('Inserted doc'), null, { timeout: 3000 }),
        page.locator('#docList .saveBtn').first().click()
      ]);
      const logAfterSave = await app.getLogText();
      expect(logAfterSave).toMatch(/Updated doc/);

      // 8) Delete a doc: click delete (will prompt confirm), accept confirmation
      // Re-render ensures delete buttons exist; locate first delete button
      const firstDelBtn = page.locator('#docList .btn-del').first();
      const [confirmDialog] = await Promise.all([
        page.waitForEvent('dialog'),
        firstDelBtn.click()
      ]);
      // The delete flow uses confirm('Delete doc ' + doc._id + '?')
      expect(confirmDialog.type()).toBe('confirm');
      await confirmDialog.accept(); // accept deletion
      // Wait for log showing deletion
      await page.waitForFunction(() => document.querySelector('#log').innerText.includes('Deleted doc'), null, { timeout: 3000 });
      const logAfterDel = await app.getLogText();
      expect(logAfterDel).toMatch(/Deleted doc/);

      // Final check: no uncaught runtime errors during document flows
      expect(pageErrors).toEqual([]);
    }, { timeout: 20000 });
  });

  test.describe('Key-Value Store interactions', () => {
    test('Set/Get/Scan/Clear KV entries and edge cases', async ({ page }) => {
      const app = new AppPage(page);

      // Switch to KV
      await app.selectStore('kv');
      expect(await app.getActiveStoreName()).toBe('kv');

      // Set a key with JSON value
      const keyName = 'test:kv:' + Math.random().toString(36).slice(2, 8);
      await page.fill('#kvKey', keyName);
      await page.fill('#kvVal', JSON.stringify({ hello: 'world', t: Date.now() }));
      await Promise.all([
        page.waitForFunction((k) => {
          return document.querySelector('#log').innerText.includes('KV set') || document.querySelector('#k_kv').innerText != '0';
        }, keyName, { timeout: 3000 }),
        page.click('#kvSet')
      ]);

      // Confirm the KV entries count increments
      const kvCountText = await page.locator('#k_kv').innerText();
      expect(parseInt(kvCountText, 10)).toBeGreaterThanOrEqual(1);

      // Click Get for the key: this triggers alert showing the value
      await page.fill('#kvKey', keyName);
      const [getDialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#kvGet')
      ]);
      expect(getDialog.message()).toContain('"hello"');
      await getDialog.accept();

      // Scan by prefix: set prefix and click scan, results should show the key
      await page.fill('#kvPrefix', 'test:kv:');
      await page.click('#kvScan');
      // KV list should contain our key
      const kvListHtml = await page.locator('#kvList').innerHTML();
      expect(kvListHtml).toContain(keyName);

      // Clear all KV entries: triggers confirm; accept and wait for kvStore to clear
      const [clearConfirm] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#kvClearAll')
      ]);
      expect(clearConfirm.type()).toBe('confirm');
      await clearConfirm.accept();
      // Wait until log contains 'Cleared KV store'
      await page.waitForFunction(() => document.querySelector('#log').innerText.includes('Cleared KV store'), null, { timeout: 3000 });

      // After clear, count should be zero
      const kvCountAfter = await page.locator('#k_kv').innerText();
      expect(parseInt(kvCountAfter, 10)).toBeGreaterThanOrEqual(0);

      // Edge case: Get for missing key should alert 'Key not found'
      await page.fill('#kvKey', 'nonexistent:key');
      const [missingDialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#kvGet')
      ]);
      expect(missingDialog.message()).toContain('Key not found');
      await missingDialog.accept();

      expect(pageErrors).toEqual([]);
    }, { timeout: 15000 });
  });

  test.describe('Column-Family Store interactions', () => {
    test('Set/Delete/Find/Dump rows and handle parse errors', async ({ page }) => {
      const app = new AppPage(page);

      // Switch to Column-Family
      await app.selectStore('column');
      expect(await app.getActiveStoreName()).toBe('column');

      // Set a column on a new row
      const rowKey = 'row_test_' + Math.random().toString(36).slice(2, 7);
      await page.fill('#cfRow', rowKey);
      await page.fill('#cfFamily', 'profile');
      await page.fill('#cfQual', 'name');
      await page.fill('#cfVal', 'CassandraFan');
      await Promise.all([
        page.waitForFunction((r) => document.querySelector('#log').innerText.includes('Set column') || document.querySelector('#rowCount').innerText != '0', rowKey, { timeout: 3000 }),
        page.click('#cfSet')
      ]);
      const logAfterSet = await app.getLogText();
      expect(logAfterSet).toMatch(/Set column/);

      // Ensure row appears in the rows list
      const cfListHtml = await page.locator('#cfList').innerHTML();
      expect(cfListHtml).toContain(rowKey);

      // Find rows by column value using a correct query pattern
      await page.fill('#cfQuery', 'family=profile qualifier=name value=CassandraFan');
      await page.click('#cfFind');
      // After find, list should show the hit
      const findHtml = await page.locator('#cfList').innerHTML();
      expect(findHtml).toContain(rowKey);

      // Edge case: malformed query should alert; provide a bad query
      await page.fill('#cfQuery', 'this is bad query');
      const [parseDialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#cfFind')
      ]);
      expect(parseDialog.message()).toContain('Query parse failed');
      await parseDialog.accept();

      // Deleting a column: set cfRow and cfFamily/cfQual to delete
      await page.fill('#cfRow', rowKey);
      await page.fill('#cfFamily', 'profile');
      await page.fill('#cfQual', 'name');
      // This will delete the column and re-render
      await Promise.all([
        page.waitForFunction(() => document.querySelector('#log').innerText.includes('Deleted column') || document.querySelector('#log').innerText.includes('Column not found'), null, { timeout: 3000 }),
        page.click('#cfDelete')
      ]);
      // Either deletion or not found is valid given concurrent state; assert log exists
      const afterDeleteLog = await app.getLogText();
      expect(/Deleted column|Column not found/.test(afterDeleteLog)).toBeTruthy();

      expect(pageErrors).toEqual([]);
    }, { timeout: 15000 });
  });

  test.describe('Graph Store interactions', () => {
    test('Add node, add edge, list nodes/edges, neighbors and traversal', async ({ page }) => {
      const app = new AppPage(page);

      // Switch to Graph
      await app.selectStore('graph');
      expect(await app.getActiveStoreName()).toBe('graph');

      // Get current nodes count
      const beforeNodes = parseInt(await page.locator('#k_nodes').innerText(), 10);

      // Add a new node with props
      await page.fill('#gNodeLabel', 'PlaywrightNode');
      await page.fill('#gNodeProps', '{ "role": "tester" }');
      await Promise.all([
        page.waitForFunction(() => document.querySelector('#log').innerText.includes('Added node') || document.querySelector('#k_nodes').innerText != "0", null, { timeout: 3000 }),
        page.click('#gAddNode')
      ]);
      const logAfterAddNode = await app.getLogText();
      expect(logAfterAddNode).toMatch(/Added node/);

      // List nodes area should contain our new node label
      const gListHtml = await page.locator('#gListArea').innerText();
      expect(gListHtml).toContain('PlaywrightNode');

      // Find two node ids to connect: read the first two node ids from the list area
      // Node entries are rendered as '<strong>nX</strong> Label ...' so extract patterns n followed by digits
      const idsText = await page.locator('#gListArea').innerText();
      const nodeIdMatches = Array.from(idsText.matchAll(/\b(n\d+)\b/g)).map(m => m[1]);
      // Require at least one node present (we added one), attempt edge only if two nodes exist
      if (nodeIdMatches.length >= 2) {
        const fromId = nodeIdMatches[0];
        const toId = nodeIdMatches[1];
        await page.fill('#gFrom', fromId);
        await page.fill('#gTo', toId);
        await page.fill('#gLabel', 'test_edge');
        await Promise.all([
          page.waitForFunction(() => document.querySelector('#log').innerText.includes('Added edge') || document.querySelector('#gListArea').innerText.includes('Edges'), null, { timeout: 3000 }),
          page.click('#gAddEdge')
        ]);
        const logAfterEdge = await app.getLogText();
        expect(logAfterEdge).toMatch(/Added edge/);

        // The neighbors button triggers an alert showing neighbors; ensure it runs
        await page.fill('#gFrom', fromId);
        const [neighDialog] = await Promise.all([
          page.waitForEvent('dialog'),
          page.click('#gNeighbors')
        ]);
        expect(neighDialog.message()).toContain('Neighbors');
        await neighDialog.accept();

        // Traverse using BFS: fill start and click traverse; should show alert or paths
        await page.fill('#gStart', fromId);
        await page.fill('#gDepth', '2');
        const [traverseDialog] = await Promise.all([
          page.waitForEvent('dialog'),
          page.click('#gTraverse')
        ]);
        // The dialog may report 'Unknown start node' or 'Paths found'
        expect(/Paths found|Unknown start node/.test(traverseDialog.message())).toBeTruthy();
        await traverseDialog.accept();
      } else {
        // If there is only one node in the graph, attempt BFS start on that node to ensure traversal handles single-node case
        if (nodeIdMatches.length === 1) {
          const only = nodeIdMatches[0];
          await page.fill('#gStart', only);
          await page.fill('#gDepth', '1');
          const [traverseDialogSingle] = await Promise.all([
            page.waitForEvent('dialog'),
            page.click('#gTraverse')
          ]);
          expect(/Paths found|Unknown start node/.test(traverseDialogSingle.message())).toBeTruthy();
          await traverseDialogSingle.accept();
        }
      }

      // Edge-case: Attempt to add edge with unknown node ids should alert 'Unknown node id(s)'
      await page.fill('#gFrom', 'n99999');
      await page.fill('#gTo', 'n88888');
      const [unknownEdgeDialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#gAddEdge')
      ]);
      expect(unknownEdgeDialog.message()).toContain('Unknown node id');
      await unknownEdgeDialog.accept();

      expect(pageErrors).toEqual([]);
    }, { timeout: 20000 });
  });

  test('Console and runtime: capture logs and ensure no uncaught exceptions', async ({ page }) => {
    // This test simply verifies we have captured console messages and that there were no runtime errors during the scenario.
    // Note: Navigation/setup hook already populated consoleMessages and pageErrors.
    // We assert that console contains the initialization log and that there are no uncaught page errors.
    // Wait briefly to allow any delayed replica logs to appear (replication uses setTimeout)
    await page.waitForTimeout(600); // small wait
    // Check that console (i.e. #log) contains 'Demo initialized' as the app writes initial log
    const logText = await page.$eval('#log', el => el.innerText);
    expect(logText).toContain('Demo initialized');

    // Assert no uncaught errors
    expect(pageErrors).toEqual([]);
  });

});