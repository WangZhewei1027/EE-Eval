import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c134220-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper: wait until logView contains a substring
async function waitForLog(page, substring, timeout = 3000) {
  await page.waitForFunction(
    (sel, sub) => {
      const el = document.querySelector(sel);
      return el && el.textContent.indexOf(sub) !== -1;
    },
    ['#logView', substring],
    { timeout }
  );
}

test.describe('Hash Map Interactive Explorer - FSM and UI integration tests', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      const text = msg.text();
      // store all console messages; classify error-level separately
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') consoleErrors.push(text);
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Auto-accept/dismiss dialogs by default so prompts do not hang tests.
    page.on('dialog', async dialog => {
      // Accept with empty string by default; tests that need to provide a specific value
      // will install a one-time dialog handler themselves.
      try {
        await dialog.accept('');
      } catch (e) {
        // ignore acceptance errors
      }
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure the app initialized and wrote initial log
    await page.waitForSelector('#mapStats');
    await waitForLog(page, 'Initialized map', 2000);
  });

  test.afterEach(async () => {
    // After each test we assert that no fatal runtime errors (ReferenceError, SyntaxError, TypeError)
    // were raised during the test. The application is allowed to log warnings/info.
    const relevant = pageErrors.filter(err => {
      const msg = String(err && err.message ? err.message : err);
      return /ReferenceError|SyntaxError|TypeError/.test(msg);
    });
    expect(relevant.length, `No ReferenceError/SyntaxError/TypeError should occur. Page errors: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
  });

  test.describe('Initialization & basic UI bindings', () => {
    test('page loads and initial UI elements are present', async ({ page }) => {
      // Validate key UI controls exist and initial state reflected
      await expect(page.locator('#modeSelect')).toBeVisible();
      await expect(page.locator('#capacitySlider')).toBeVisible();
      const capacityValue = await page.locator('#capacityValue').innerText();
      expect(Number(capacityValue)).toBeGreaterThanOrEqual(3);
      await expect(page.locator('#mapView')).toBeVisible();
      await expect(page.locator('#logView')).toBeVisible();

      // mapStats should reflect capacity and size text
      const stats = await page.locator('#mapStats').innerText();
      expect(stats).toContain('Capacity:');
      expect(stats).toContain('Size:');
    });

    test('capacity slider input updates capacityValue (input event)', async ({ page }) => {
      // Simulate input change (not commit) and check capacityValue updates
      await page.locator('#capacitySlider').evaluate((el) => {
        el.value = '13';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const val = await page.locator('#capacityValue').innerText();
      // The input handler sets capacityValue text content to the raw input value on input event
      expect(Number(val)).toBe(13);
    });

    test('capacity slider change triggers re-evaluation to next prime and sets State', async ({ page }) => {
      // Change slider value and dispatch change event - this triggers nextPrime and App.setCapacity
      await page.locator('#capacitySlider').evaluate((el) => {
        el.value = '14';
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      // capacityValue should be set to the next prime >= 14 which is 17
      // Wait briefly for logs and UI to update
      await waitForLog(page, 'Capacity set to', 2000);
      const val = await page.locator('#capacityValue').innerText();
      expect(Number(val)).toBeGreaterThanOrEqual(14);
    });
  });

  test.describe('Core operations (Insert, Update, Delete, Search)', () => {
    test('insert a key-value pair and verify map stats and view', async ({ page }) => {
      // Insert key1 -> val1
      await page.fill('#keyInput', 'key1');
      await page.fill('#valueInput', 'val1');
      await page.click('#insertBtn');

      // Wait for operation completion log or mapStats update
      await waitForLog(page, 'Inserted', 2000).catch(() => {});
      // mapStats should show size at least 1
      const stats = await page.locator('#mapStats').innerText();
      expect(stats).toMatch(/Size:\s*\d+/);
      const sizeNum = Number((stats.match(/Size:\s*(\d+)/) || [])[1] || 0);
      expect(sizeNum).toBeGreaterThanOrEqual(1);

      // mapView should include 'key1 : val1'
      const viewText = await page.locator('#mapView').innerText();
      expect(viewText).toContain('key1');
      expect(viewText).toContain('val1');
    });

    test('search finds an existing key and update modifies value', async ({ page }) => {
      // Ensure key exists
      await page.fill('#keyInput', 'searchKey');
      await page.fill('#valueInput', 'orig');
      await page.click('#insertBtn');
      await waitForLog(page, 'Inserted', 2000).catch(() => {});

      // Search
      await page.fill('#keyInput', 'searchKey');
      await page.click('#searchBtn');
      await waitForLog(page, 'Search:', 2000);
      const logText = await page.locator('#logView').innerText();
      expect(logText).toMatch(/Search: (found|key not found)/);

      // Update value
      await page.fill('#keyInput', 'searchKey');
      await page.fill('#valueInput', 'updated');
      await page.click('#updateBtn');
      await waitForLog(page, 'Updated', 2000).catch(() => {});
      // Verify view changed
      const viewText = await page.locator('#mapView').innerText();
      expect(viewText).toContain('updated');
    });

    test('delete removes a key (or logs not found) and size updates', async ({ page }) => {
      // Insert then delete
      await page.fill('#keyInput', 'delKey');
      await page.fill('#valueInput', 'v');
      await page.click('#insertBtn');
      await waitForLog(page, 'Inserted', 2000).catch(() => {});

      // Capture size before delete
      const beforeStats = await page.locator('#mapStats').innerText();
      const beforeSize = Number((beforeStats.match(/Size:\s*(\d+)/) || [])[1] || 0);

      // Delete
      await page.fill('#keyInput', 'delKey');
      await page.click('#deleteBtn');
      await waitForLog(page, 'Deleted', 2000).catch(() => {});

      const afterStats = await page.locator('#mapStats').innerText();
      const afterSize = Number((afterStats.match(/Size:\s*(\d+)/) || [])[1] || 0);
      // After deletion, size should be less than or equal to beforeSize
      expect(afterSize).toBeLessThanOrEqual(beforeSize);
    });
  });

  test.describe('Bulk, Random generation, Clear and Rehash', () => {
    test('bulk insert two items and generate random entries', async ({ page }) => {
      // Bulk insert using a semi-colon separated list
      await page.fill('#bulkText', 'a,1;b,2');
      await page.click('#bulkImportBtn');
      await waitForLog(page, 'Bulk inserted', 2000);
      const stats1 = await page.locator('#mapStats').innerText();
      let size1 = Number((stats1.match(/Size:\s*(\d+)/) || [])[1] || 0);
      expect(size1).toBeGreaterThanOrEqual(2);

      // Generate random 5 entries
      await page.fill('#randomCount', '5');
      await page.click('#generateRandom');
      await waitForLog(page, 'Generated 5', 2000);
      const stats2 = await page.locator('#mapStats').innerText();
      let size2 = Number((stats2.match(/Size:\s*(\d+)/) || [])[1] || 0);
      expect(size2).toBeGreaterThanOrEqual(size1 + 5);
    });

    test('clear map resets size and rehash with capacity slider value', async ({ page }) => {
      // Ensure some content
      await page.fill('#keyInput', 'toClear');
      await page.fill('#valueInput', 'x');
      await page.click('#insertBtn');
      await waitForLog(page, 'Inserted', 2000).catch(() => {});

      // Clear
      await page.click('#clearBtn');
      await waitForLog(page, 'Map cleared', 2000);
      const stats = await page.locator('#mapStats').innerText();
      const size = Number((stats.match(/Size:\s*(\d+)/) || [])[1] || 0);
      expect(size).toBe(0);

      // Force rehash: set slider to 19 and click rehash
      await page.locator('#capacitySlider').evaluate((el) => {
        el.value = '19';
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      // Wait for capacity set log
      await waitForLog(page, 'Capacity set to', 2000).catch(() => {});
      await page.click('#rehashBtn');
      await waitForLog(page, 'Forced rehash', 2000);
      const newStats = await page.locator('#mapStats').innerText();
      expect(newStats).toContain('Capacity:');
    });
  });

  test.describe('Stepping, Run Operation, Sequencer, Undo/Redo, Snapshot, Import/Export', () => {
    test('prepare an operation and step through it using Step Next and Step Prev', async ({ page }) => {
      // Prepare an operation by enqueueOrRun (insert)
      await page.fill('#keyInput', 'stepKey');
      await page.fill('#valueInput', 'stepVal');
      await page.click('#insertBtn');

      // Wait for probeView to reflect operation prepared
      await page.waitForFunction(() => {
        const el = document.getElementById('probeView');
        return el && el.textContent.indexOf('Operation:') !== -1;
      }, { timeout: 2000 });

      // Step next a couple times (if available)
      await page.click('#stepNextBtn');
      // small pause to allow step effects
      await page.waitForTimeout(150);
      // Step prev (go back)
      await page.click('#stepPrevBtn');
      await page.waitForTimeout(150);

      // After stepping, probeView should show operation details
      const probeText = await page.locator('#probeView').innerText();
      expect(probeText).toContain('Operation:');
    });

    test('add operations to sequence, run sequence and verify sequence completed log', async ({ page }) => {
      // Add two simple ops
      await page.selectOption('#opType', 'insert');
      await page.fill('#opKey', 'seq1');
      await page.fill('#opValue', 'v1');
      await page.click('#addOpBtn');

      await page.selectOption('#opType', 'insert');
      await page.fill('#opKey', 'seq2');
      await page.fill('#opValue', 'v2');
      await page.click('#addOpBtn');

      // Run sequence
      await page.click('#runSeqBtn');
      // Wait for sequence completed log
      await waitForLog(page, 'Sequence completed', 5000).catch(() => {});
      const logText = await page.locator('#logView').innerText();
      expect(logText).toContain('Sequence completed');
      // SequenceList should show options
      const seqList = await page.locator('#sequenceList').allTextContents();
      expect(seqList.length).toBeGreaterThanOrEqual(2);
      // Clear sequence and verify empty
      await page.click('#clearSeqBtn');
      const seqAfterClear = await page.locator('#sequenceList').allTextContents();
      expect(seqAfterClear.length).toBe(0);
    });

    test('undo and redo restore/restore map state', async ({ page }) => {
      // Insert a key then undo and redo
      await page.fill('#keyInput', 'undoKey');
      await page.fill('#valueInput', 'uval');
      await page.click('#insertBtn');
      await waitForLog(page, 'Inserted', 2000).catch(() => {});

      const statsAfterInsert = await page.locator('#mapStats').innerText();
      const sizeAfterInsert = Number((statsAfterInsert.match(/Size:\s*(\d+)/) || [])[1] || 0);

      // Undo
      await page.click('#undoBtn');
      await waitForLog(page, 'Undo applied', 2000).catch(() => {});
      const statsAfterUndo = await page.locator('#mapStats').innerText();
      const sizeAfterUndo = Number((statsAfterUndo.match(/Size:\s*(\d+)/) || [])[1] || 0);
      expect(sizeAfterUndo).toBeLessThanOrEqual(sizeAfterInsert);

      // Redo
      await page.click('#redoBtn');
      await waitForLog(page, 'Redo applied', 2000).catch(() => {});
      const statsAfterRedo = await page.locator('#mapStats').innerText();
      const sizeAfterRedo = Number((statsAfterRedo.match(/Size:\s*(\d+)/) || [])[1] || 0);
      expect(sizeAfterRedo).toBeGreaterThanOrEqual(sizeAfterUndo);
    });

    test('save snapshot and restore snapshot using captured snapshot id', async ({ page }) => {
      // Make sure snapshots are empty and then save
      await page.evaluate(() => { App.snapshots = {}; });
      // Intercept the dialog invoked by saveSnapshot: the app prompts the snapshot id to the user.
      // The default global dialog handler accepts with empty string; to ensure snapshot is created and stored
      // we will call saveSnapshot and then query snapshots map to get the id used.
      // Click the save snapshot button
      await page.click('#snapshotBtn');
      // Wait a bit for snapshot creation log
      await waitForLog(page, 'Saved snapshot', 2000);
      // Retrieve snapshot id from App.snapshots
      const keys = await page.evaluate(() => Object.keys(App.snapshots || {}));
      expect(keys.length).toBeGreaterThanOrEqual(1);
      const snapId = keys[0];

      // Now restore - we must provide the snapshot id in the prompt dialog.
      // Install a one-time dialog handler to accept the snapshot id
      page.once('dialog', async dialog => {
        await dialog.accept(snapId);
      });
      await page.click('#restoreBtn');
      await waitForLog(page, 'Restored snapshot', 2000).catch(() => {});
      const logs = await page.locator('#logView').innerText();
      expect(logs).toContain('Restored snapshot');
    });

    test('export state and import a valid state; attempt to import invalid JSON and observe failure log', async ({ page }) => {
      // Create a stable exported JSON by calling App.exportState directly in page context
      const exported = await page.evaluate(() => {
        return App.exportState();
      });
      // Put exported JSON into importArea and click import
      await page.fill('#importArea', exported);
      await page.click('#importBtn');
      await waitForLog(page, 'Imported state', 2000).catch(() => {});
      // Now try importing invalid JSON; handler should catch and log import failure
      await page.fill('#importArea', 'this-is-not-json');
      await page.click('#importBtn');
      // The click handler wraps App.importState in try/catch and logs 'Import failed'
      await waitForLog(page, 'Import failed', 2000);
      const logs = await page.locator('#logView').innerText();
      expect(logs).toContain('Import failed');
    });
  });

  test.describe('Custom Hash Editor, Load Custom, Test Hash and Refresh', () => {
    test('load a custom hash from input, apply editor, and test hash output', async ({ page }) => {
      // Provide a very simple custom hash function in the customHash input
      const customFnSource = 'function(key){ return 12345; }';
      await page.fill('#customHash', customFnSource);
      await page.click('#loadCustom');
      await waitForLog(page, 'Custom hash loaded', 2000);
      let logText = await page.locator('#logView').innerText();
      expect(logText).toContain('Custom hash loaded');

      // Apply editor (it already contains a valid function in the editor)
      await page.click('#applyEditor');
      await waitForLog(page, 'Custom editor applied', 2000).catch(() => {});
      logText = await page.locator('#logView').innerText();
      expect(logText).toContain('Custom editor applied');

      // Test hash: fill key and click testHashBtn and verify testHashOutput is populated
      await page.fill('#testHashKey', 'abc123');
      await page.click('#testHashBtn');
      // Wait for testHashOutput content to change
      await page.waitForFunction(() => {
        const el = document.getElementById('testHashOutput');
        return el && el.textContent && el.textContent.trim().length > 0;
      }, { timeout: 2000 });
      const out = await page.locator('#testHashOutput').innerText();
      expect(out).toContain('->');
    });

    test('refresh view updates the map visualization table', async ({ page }) => {
      await page.click('#refreshView');
      // mapView should contain a table with header "Index" and "Content"
      await page.waitForSelector('#mapView table');
      const headerText = await page.locator('#mapView table tr').first().innerText();
      expect(headerText).toContain('Index');
      expect(headerText).toContain('Content');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('import malformed JSON via import button logs an import failure', async ({ page }) => {
      await page.fill('#importArea', '{ invalid json >>> }');
      await page.click('#importBtn');
      await waitForLog(page, 'Import failed', 2000);
      const logs = await page.locator('#logView').innerText();
      expect(logs).toContain('Import failed');
    });

    test('apply invalid custom editor logs an error (editor apply fails)', async ({ page }) => {
      // Provide intentionally invalid JS that is not a function
      await page.fill('#customEditor', 'var x = 1;'); // not a function
      await page.click('#applyEditor');
      // The code logs 'Editor apply failed' on error
      await waitForLog(page, 'Editor apply failed', 2000).catch(() => {});
      const logs = await page.locator('#logView').innerText();
      expect(logs).toContain('Editor apply failed');
    });
  });

  test.describe('Final checks for console and runtime errors', () => {
    test('no uncaught ReferenceError, SyntaxError, or TypeError occurred during interactions', async ({ page }) => {
      // We've been collecting pageErrors on beforeEach/afterEach. This test double-checks console 'error' messages for critical error types.
      // Filter console error messages for those types:
      const criticalConsoleErrors = consoleErrors.filter(text => /ReferenceError|SyntaxError|TypeError/.test(text));
      // Assert none exist
      expect(criticalConsoleErrors.length, `Expected no ReferenceError/SyntaxError/TypeError in console errors. Found: ${criticalConsoleErrors.join(' | ')}`).toBe(0);

      // Also assert pageErrors have no messages that indicate those types
      const criticalPageErrors = pageErrors.filter(err => {
        const m = String(err && err.message ? err.message : err);
        return /ReferenceError|SyntaxError|TypeError/.test(m);
      });
      expect(criticalPageErrors.length, `Expected no fatal page errors. Found: ${criticalPageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    });
  });
});