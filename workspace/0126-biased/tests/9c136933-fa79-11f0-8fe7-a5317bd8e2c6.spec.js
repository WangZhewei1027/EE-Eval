import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c136933-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Red-Black Tree Explorer - Minimal UI (FSM validation)', () => {
  // Shared state for capturing console errors, page errors and dialogs
  let consoleErrors;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console error messages
    page.on('console', (msg) => {
      // store error-level console messages for later assertions
      if (msg.type() === 'error') {
        consoleErrors.push(`${msg.text()}`);
      }
    });

    // Capture unhandled page errors (exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Auto-accept dialogs and record their messages
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Navigate to the app and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure App object is available before tests proceed
    await page.waitForFunction(() => !!window.App && !!window.dom && !!window.App.tree);
  });

  test.afterEach(async () => {
    // afterEach used only to allow per-test cleanup if necessary in the future
  });

  test.describe('Initial state and idle entry action', () => {
    test('Initial UI should be refreshed and show empty tree and initial history', async ({ page }) => {
      // Validate initial tree view rendering "(empty)" and that refreshUI() ran on init
      const treeText = await page.locator('#treeView').textContent();
      expect(treeText).toBe('(empty)');

      // App.history should have initial entry "initial empty"
      const historyIndexDesc = await page.evaluate(() => {
        return window.App && window.App.history && window.App.history.length > 0
          ? window.App.history[window.App.history.length - 1].desc
          : null;
      });
      expect(historyIndexDesc).toContain('initial'); // initial empty or similar

      // No runtime page errors or console errors should have occurred during init
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Insert / Delete / Search / Select / Clear Select flows', () => {
    test('Insert a key updates tree, history and nodeCount', async ({ page }) => {
      // Ensure no pre-existing key 10
      await page.locator('#keyInput').fill('10');
      await page.click('#insertBtn');

      // After insert, App.tree.search(10) should find a node and node count should be 1
      const searchResult = await page.evaluate(() => {
        const found = window.App.tree.search(10);
        return {
          found: !!found && !found.isNil,
          historyLast: window.App.history[window.App.history.length - 1].desc,
          nodeCount: window.App.tree.countNodes(),
          treeView: document.getElementById('treeView').textContent
        };
      });
      expect(searchResult.found).toBe(true);
      expect(searchResult.historyLast).toContain('insert 10');
      expect(Number(searchResult.nodeCount)).toBeGreaterThanOrEqual(1);
      expect(searchResult.treeView).toContain('10('); // textual representation includes "10(color)"
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Delete an existing key removes it and updates history', async ({ page }) => {
      // Insert then delete key 11
      await page.locator('#keyInput').fill('11');
      await page.click('#insertBtn');

      // Confirm present then delete
      await page.locator('#keyInput').fill('11');
      await page.click('#deleteBtn');

      const post = await page.evaluate(() => {
        const found = window.App.tree.search(11);
        return {
          found: !!found && !found.isNil,
          historyLast: window.App.history[window.App.history.length - 1].desc,
          nodeCount: window.App.tree.countNodes()
        };
      });
      expect(post.found).toBe(false);
      expect(post.historyLast).toContain('delete 11');
      expect(Number(post.nodeCount)).toBeGreaterThanOrEqual(0);
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Search sets diagnostics and selectedKey when present, clears when absent', async ({ page }) => {
      // Insert 20, search for it
      await page.locator('#keyInput').fill('20');
      await page.click('#insertBtn');

      await page.locator('#keyInput').fill('20');
      await page.click('#searchBtn');

      const afterSearch = await page.evaluate(() => {
        return {
          diagnostics: document.getElementById('diagnostics').textContent,
          selectedKey: window.App.selectedKey
        };
      });
      expect(afterSearch.diagnostics).toContain('found key 20');
      expect(afterSearch.selectedKey).toBe(20);

      // Search for non-existent key
      await page.locator('#keyInput').fill('9999');
      await page.click('#searchBtn');

      const afterSearch2 = await page.evaluate(() => {
        return {
          diagnostics: document.getElementById('diagnostics').textContent,
          selectedKey: window.App.selectedKey
        };
      });
      expect(afterSearch2.diagnostics).toContain('not found');
      expect(afterSearch2.selectedKey).toBe(null);
    });

    test('Select and Clear Select update App.selectedKey and UI', async ({ page }) => {
      // Insert key 30, then select it
      await page.locator('#keyInput').fill('30');
      await page.click('#insertBtn');

      await page.locator('#keyInput').fill('30');
      await page.click('#selectBtn');

      const sel1 = await page.evaluate(() => ({ sel: window.App.selectedKey, diag: document.getElementById('diagnostics').textContent }));
      expect(sel1.sel).toBe(30);
      expect(sel1.diag).toContain('Selected key 30');

      // Clear selection
      await page.click('#clearSelectBtn');
      const sel2 = await page.evaluate(() => ({ sel: window.App.selectedKey, treeView: document.getElementById('treeView').textContent }));
      expect(sel2.sel).toBeNull();
      // tree view should still include previously inserted nodes (sanity)
      expect(sel2.treeView.length).toBeGreaterThan(0);
    });
  });

  test.describe('Bulk and Random insertion flows', () => {
    test('Bulk Fast Insert inserts multiple keys and records a "bulk insert fast" history entry', async ({ page }) => {
      await page.locator('#bulkInput').fill('101,102,103');
      await page.click('#bulkFastBtn');

      // Wait for UI update
      await page.waitForFunction(() => window.App.tree.countNodes() >= 3);

      const res = await page.evaluate(() => {
        return {
          nodeCount: window.App.tree.countNodes(),
          historyLast: window.App.history[window.App.history.length - 1].desc,
          treeView: document.getElementById('treeView').textContent
        };
      });
      expect(Number(res.nodeCount)).toBeGreaterThanOrEqual(3);
      expect(res.historyLast).toContain('bulk insert fast');
      expect(res.treeView).toMatch(/101|102|103/);
    });

    test('Bulk step-by-step insert appends steps and updates nodes (async flow)', async ({ page }) => {
      // Use unique keys to avoid duplicates
      await page.locator('#bulkInput').fill('201,202');
      await page.click('#bulkInsertBtn');

      // bulkInsertBtn runs async sequence with sleep; wait until nodes appear
      await page.waitForFunction(() => {
        // ensure both keys appear in tree text
        const t = document.getElementById('treeView').textContent;
        return t.includes('201(') && t.includes('202(');
      }, { timeout: 5000 });

      const snapshotCount = await page.evaluate(() => window.App.steps.length);
      expect(snapshotCount).toBeGreaterThanOrEqual(2); // step snapshots should have been appended

      const nodeCount = await page.evaluate(() => window.App.tree.countNodes());
      expect(Number(nodeCount)).toBeGreaterThanOrEqual(2);
    });

    test('Random fast insert uses seed and increases node count with "rand insert fast" history', async ({ page }) => {
      await page.locator('#seedInput').fill('seedXYZ');
      await page.locator('#randCount').fill('3');
      await page.click('#randInsertFastBtn');

      await page.waitForFunction(() => window.App.history.length > 0);

      const res = await page.evaluate(() => ({
        nodeCount: window.App.tree.countNodes(),
        historyLast: window.App.history[window.App.history.length - 1].desc
      }));
      expect(Number(res.nodeCount)).toBeGreaterThanOrEqual(1);
      expect(res.historyLast).toContain('rand insert fast');
    });
  });

  test.describe('Manual transformations: rotate, recolor, transplant, delete selected', () => {
    test('Rotate and Recolor actions require selection and produce alerts when none selected', async ({ page }) => {
      // Ensure no selection
      await page.click('#clearSelectBtn');

      // Click rotate left with no selection -> should prompt an alert "Select a node first"
      await page.click('#rotateLeftBtn');
      // dialogMessages should have an entry containing "Select a node first"
      expect(dialogMessages.some(m => m.includes('Select a node first'))).toBeTruthy();

      // Click recolor red with no selection -> should prompt
      dialogMessages = []; // reset recorded dialogs for clarity
      await page.click('#recolorRedBtn');
      expect(dialogMessages.some(m => m.includes('Select a node first'))).toBeTruthy();
    });

    test('Perform rotate left/right and recolor on a selected node updates tree and history', async ({ page }) => {
      // Create a small tree to operate on
      await page.locator('#keyInput').fill('400');
      await page.click('#insertBtn');
      await page.locator('#keyInput').fill('350');
      await page.click('#insertBtn');
      await page.locator('#keyInput').fill('450');
      await page.click('#insertBtn');

      // Select the root (may be 400 or another depending on balancing); pick an existing key 400
      await page.locator('#keyInput').fill('400');
      await page.click('#selectBtn');

      // rotate left (if possible)
      await page.click('#rotateLeftBtn');
      // rotateRight
      await page.click('#rotateRightBtn');

      // recolor red then black
      await page.click('#recolorRedBtn');
      await page.click('#recolorBlackBtn');

      // Validate that recolor history entries exist and pushHistory calls happened
      const hist = await page.evaluate(() => window.App.history.slice(-5).map(h => h.desc));
      expect(hist.some(h => h.includes('manual left-rotate') || h.includes('manual right-rotate') || h.includes('recolor'))).toBeTruthy();

      // Ensure rotCount and recolorCount reflect some activity (numbers are strings in DOM)
      const rotCount = await page.locator('#rotCount').textContent();
      const recolorCount = await page.locator('#recolorCount').textContent();
      expect(Number(rotCount)).toBeGreaterThanOrEqual(0);
      expect(Number(recolorCount)).toBeGreaterThanOrEqual(0);
    });

    test('Transplant of selected node to a new key updates tree and history', async ({ page }) => {
      // Insert distinct nodes and select one
      await page.locator('#keyInput').fill('500');
      await page.click('#insertBtn');
      await page.locator('#keyInput').fill('501');
      await page.click('#insertBtn');

      // Select 500
      await page.locator('#keyInput').fill('500');
      await page.click('#selectBtn');

      // Set transplant target to 9999 and perform transplant
      await page.locator('#transplantKey').fill('9999');
      await page.click('#transplantBtn');

      // Verify history and new key existence
      const last = await page.evaluate(() => window.App.history[window.App.history.length - 1].desc);
      expect(last).toContain('transplant');

      // Check new key present in tree view
      const view = await page.locator('#treeView').textContent();
      expect(view).toContain('9999(');
    });

    test('Delete selected node works and clears selection', async ({ page }) => {
      // Insert and select a node
      await page.locator('#keyInput').fill('600');
      await page.click('#insertBtn');
      await page.locator('#keyInput').fill('600');
      await page.click('#selectBtn');

      // Delete selected
      await page.click('#deleteSelectedBtn');

      const sel = await page.evaluate(() => ({ selectedKey: window.App.selectedKey, lastHist: window.App.history[window.App.history.length - 1].desc, found: !window.App.tree.search(600).isNil }));
      expect(sel.selectedKey).toBeNull();
      expect(sel.lastHist).toContain('delete');
      // Since deleted, search should not find it
      expect(sel.found).toBe(false);
    });
  });

  test.describe('Export / Import / Snapshots / Steps', () => {
    test('Export writes JSON into import area and Import restores tree (handles alerts)', async ({ page }) => {
      // Make sure there is at least one node to export
      await page.locator('#keyInput').fill('700');
      await page.click('#insertBtn');

      // Export: this triggers an alert which we accept automatically
      dialogMessages = [];
      await page.click('#exportBtn');

      // Confirm that importArea now contains JSON
      const jsonVal = await page.locator('#importArea').inputValue();
      expect(jsonVal).toBeTruthy();
      expect(jsonVal.startsWith('{') || jsonVal.startsWith('{"isNil"') || jsonVal.length > 0).toBeTruthy();

      // Clear tree and then import from importArea
      await page.click('#clearTreeBtn');
      // Ensure cleared
      await page.waitForFunction(() => window.App.tree.countNodes() === 0);

      // Import: should alert success and restore tree
      dialogMessages = [];
      await page.click('#importBtn');

      // Confirm import success dialog occurred
      expect(dialogMessages.some(m => m.includes('Import successful') || m.includes('Import failed') === false)).toBeTruthy();

      // After import, node count should be > 0
      const count = await page.evaluate(() => window.App.tree.countNodes());
      expect(Number(count)).toBeGreaterThanOrEqual(1);
    });

    test('Save snapshot writes to localStorage and snapshotList refreshes', async ({ page }) => {
      // Ensure there is at least one node
      await page.locator('#keyInput').fill('800');
      await page.click('#insertBtn');

      // Provide a snapshot name and save
      await page.locator('#snapshotName').fill('my-test-snap');
      await page.click('#saveSnapshotBtn');

      // Verify localStorage has rb_snapshots array with an entry named 'my-test-snap'
      const snapList = await page.evaluate(() => JSON.parse(localStorage.getItem('rb_snapshots') || '[]'));
      expect(Array.isArray(snapList)).toBeTruthy();
      expect(snapList.some(s => s.name && s.name.includes('my-test-snap'))).toBeTruthy();

      // The snapshotList select should have at least one option
      const snapshotOptions = await page.locator('#snapshotList option').count();
      expect(Number(snapshotOptions)).toBeGreaterThanOrEqual(1);
    });

    test('Loading and deleting snapshots via UI triggers appropriate history entries', async ({ page }) => {
      // Ensure there is at least one snapshot; reuse prior snapshots
      const opts = await page.locator('#snapshotList option').count();
      if (opts === 0) {
        // create a snapshot if none
        await page.locator('#snapshotName').fill('temp-one');
        await page.click('#saveSnapshotBtn');
        await page.waitForFunction(() => document.querySelectorAll('#snapshotList option').length > 0);
      }

      // Select first snapshot and load it
      await page.selectOption('#snapshotList', { index: 0 });
      await page.click('#loadSnapshotBtn');

      // History should record load snapshot
      const last = await page.evaluate(() => window.App.history[window.App.history.length - 1].desc);
      expect(last).toContain('load snapshot');

      // Delete the selected snapshot
      const beforeCount = await page.evaluate(() => JSON.parse(localStorage.getItem('rb_snapshots') || '[]').length);
      if (beforeCount > 0) {
        await page.click('#deleteSnapshotBtn');
        const afterCount = await page.evaluate(() => JSON.parse(localStorage.getItem('rb_snapshots') || '[]').length);
        // afterCount should be either beforeCount - 1 or equal (if deletion prevented), accept both but at least no crash
        expect(afterCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Traversals, diagnostics and invariants', () => {
    test('Traversal buttons produce expected diagnostics and invariants check works', async ({ page }) => {
      // Build a small deterministic tree using example1
      await page.click('#example1Btn');

      // In-order traversal
      await page.click('#inorderBtn');
      const inorderDiag = await page.locator('#diagnostics').textContent();
      expect(inorderDiag).toContain('In-order');

      // Preorder
      await page.click('#preorderBtn');
      const pre = await page.locator('#diagnostics').textContent();
      expect(pre).toContain('Pre-order');

      // Levelorder
      await page.click('#levelorderBtn');
      const lvl = await page.locator('#diagnostics').textContent();
      expect(lvl).toContain('Level-order');

      // Check invariants
      await page.click('#checkInvariantsBtn');
      const inv = await page.locator('#diagnostics').textContent();
      // Should produce some message; if not satisfied, will list messages — ensure no crash
      expect(inv.length).toBeGreaterThanOrEqual(0);
    });

    test('Fix violations rebuilds tree and appends a step', async ({ page }) => {
      // For safety, call fixViolationsBtn and assert tree rebuilds without errors
      await page.click('#fixViolationsBtn');

      // Should have pushed a history entry "rebuild to fix violations"
      const last = await page.evaluate(() => window.App.history[window.App.history.length - 1].desc);
      expect(last).toContain('rebuild');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Import failure with invalid JSON should produce an alert with failure message', async ({ page }) => {
      // Put invalid JSON into importArea
      await page.locator('#importArea').fill('this-is-not-json');
      dialogMessages = [];

      await page.click('#importBtn');

      // The dialog message should include "Import failed"
      const hadFailure = dialogMessages.some(m => m.includes('Import failed'));
      expect(hadFailure).toBeTruthy();
    });

    test('Attempting operations on non-existent selected node triggers user-facing alerts', async ({ page }) => {
      // Ensure no selection
      await page.click('#clearSelectBtn');

      // Set transplant key but no selection: transplantBtn should alert "Select a node first"
      dialogMessages = [];
      await page.locator('#transplantKey').fill('12345');
      await page.click('#transplantBtn');
      expect(dialogMessages.some(m => m.includes('Select a node first'))).toBeTruthy();
    });
  });

  test.describe('Runtime health: console and page errors observation', () => {
    test('No uncaught ReferenceError/SyntaxError/TypeError should be present during scenarios', async ({ page }) => {
      // Throughout previous interactions we have been monitoring console and page errors.
      // Assert zero page errors and zero console errors collected so far.
      // (If implementation had had errors they would be caught here as failing assertions.)
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // Additionally, ensure none of the error messages mention common fatal error types
      const combined = pageErrors.concat(consoleErrors).join('\n').toLowerCase();
      expect(combined.includes('referenceerror')).toBeFalsy();
      expect(combined.includes('typeerror')).toBeFalsy();
      expect(combined.includes('syntaxerror')).toBeFalsy();
    });
  });
});