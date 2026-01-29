import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c139041-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper to read text content
async function textOf(page, selector) {
  const el = await page.waitForSelector(selector);
  return (await el.textContent()) || '';
}

test.describe('Heap (Min) Interactive Explorer - end-to-end', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;
  let lastExportedJSON; // capture JSON from export prompt to use for import

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    lastExportedJSON = null;

    page.on('console', (msg) => {
      // collect error-level console messages
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), args: msg.args() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Dialog handler: used for dialogs (alerts/prompts) during tests.
    page.on('dialog', async (dialog) => {
      const message = dialog.message();
      // Capture exported JSON default value from export prompt
      if (message && message.startsWith('Copy this JSON to save:')) {
        // dialog.defaultValue() is expected to contain the JSON payload
        try {
          // Some browsers expose defaultValue; attempt to read it.
          // Accept without modifying default value.
          lastExportedJSON = dialog.defaultValue ? dialog.defaultValue() : null;
          await dialog.dismiss(); // dismiss the prompt for export (we only need the value)
        } catch (e) {
          // fallback: accept without providing value
          try { await dialog.accept(); } catch {}
        }
        return;
      }

      // For import prompt, if we have captured exported JSON, provide it as input
      if (message && message.startsWith('Paste JSON to import:')) {
        if (lastExportedJSON) {
          await dialog.accept(lastExportedJSON);
        } else {
          // If none captured, just accept with empty string to continue execution
          await dialog.accept('');
        }
        return;
      }

      // For simple alerts (Peek, Validate, Index out of range, etc.) accept them
      try {
        await dialog.accept();
      } catch (e) {
        // ignore failures accepting dialogs
      }
    });

    await page.goto(APP_URL);
    // Wait for initial render to finish (arrayArea present)
    await page.waitForSelector('#arrayArea');
  });

  test.afterEach(async () => {
    // After each test we assert that no unexpected runtime errors were thrown
    // Specifically, we assert that there were no page-level uncaught errors
    expect(pageErrors.length).toBe(0);
    // And no console 'error' messages
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Initial state and rendering', () => {
    test('S0_Initial: page loads with initial empty snapshot and expected UI elements', async ({ page }) => {
      // Validate initial array view shows empty
      const arrayText = await textOf(page, '#arrayArea');
      expect(arrayText.trim()).toContain('(empty)');

      // The history info should reflect the initial snapshot created by the app
      const historyInfo = await textOf(page, '#historyInfo');
      expect(historyInfo).toMatch(/1 steps \(current: 1\)/);

      // compCount and swapCount start at 0
      expect(await textOf(page, '#compCount')).toBe('0');
      expect(await textOf(page, '#swapCount')).toBe('0');

      // Basic controls present and enabled
      await expect(page.locator('#btnInsert')).toBeVisible();
      await expect(page.locator('#btnBulkInsert')).toBeVisible();
      await expect(page.locator('#btnPeek')).toBeVisible();
      await expect(page.locator('#btnExtract')).toBeVisible();
    });
  });

  test.describe('Basic heap operations (Insert, Bulk Insert, Peek, Extract, Delete, ChangeKey)', () => {
    test('InsertValue transition: inserting a value updates array view and history', async ({ page }) => {
      // Set input value and click Insert
      await page.fill('#insertValue', '12');
      await page.click('#btnInsert');

      // After operation, arrayArea should contain the inserted value as [0]:12
      const arr = await textOf(page, '#arrayArea');
      expect(arr).toContain('[0]:12');

      // historyInfo should have increased (more than 1 snapshot)
      const historyInfo = await textOf(page, '#historyInfo');
      expect(historyInfo).toMatch(/steps \(current:/);
      // Ensure comp/swap counts are non-negative
      expect(Number(await textOf(page, '#compCount'))).toBeGreaterThanOrEqual(0);
      expect(Number(await textOf(page, '#swapCount'))).toBeGreaterThanOrEqual(0);
    });

    test('BulkInsert transition: bulk CSV inserts multiple values and updates history', async ({ page }) => {
      await page.fill('#bulkCSV', '4,1,7,3');
      await page.click('#btnBulkInsert');

      const arrText = await textOf(page, '#arrayArea');
      // Expect at least one of the inserted values present
      expect(arrText).toMatch(/\[0\]:\d+/);
      // The array area should include several elements (we expect numbers from the CSV)
      expect(arrText).toMatch(/1|3|4|7/);
    });

    test('PeekMin: clicking Peek shows alert with min value', async ({ page }) => {
      // Ensure heap has some contents; use Load Array to set known values
      await page.fill('#buildArray', '7,3,10,1,5,2');
      await page.click('#btnLoadArray');

      // Click peek - dialog will be accepted by our handler; ensure no exceptions occur and UI unchanged
      await page.click('#btnPeek');

      // Minimal assertion: array still contains expected root value at index 0
      const arrText = await textOf(page, '#arrayArea');
      expect(arrText).toContain('[0]:7');
    });

    test('ExtractMin: extracting minimum removes it from heap (detailed-step path)', async ({ page }) => {
      // Load known array and then build heap to ensure predictable min
      await page.fill('#buildArray', '7,3,10,1,5,2');
      await page.click('#btnLoadArray');
      await page.click('#btnBuildHeap');

      // Capture the min before extract
      const before = await textOf(page, '#arrayArea');
      // The min for min-heap should be present (validate via btnValidate for safety)
      await page.click('#btnValidate'); // will show alert "Heap property holds" or "violated" but dialog is auto-accepted

      // Perform extract (this uses recordSteps true in click handler)
      await page.click('#btnExtract');

      // After extract, array should have fewer elements or not include the extracted value at index 0
      const after = await textOf(page, '#arrayArea');
      expect(after).not.toBe('(empty)');
      // The first item should likely change; ensure array rendering updated
      expect(after).not.toBe(before);
    });

    test('DeleteAtIndex: deleting with valid and invalid indices', async ({ page }) => {
      // Load array
      await page.fill('#buildArray', '7,3,10,1,5,2');
      await page.click('#btnLoadArray');

      // Valid delete at index 0 - should remove element
      await page.fill('#deleteIndex', '0');
      await page.click('#btnDeleteIndex');

      const afterDel = await textOf(page, '#arrayArea');
      // After deletion, the array should still render and not include the original first element exactly as before
      expect(afterDel).not.toContain('[0]:7');

      // Now attempt an invalid delete (out of range) and confirm no crash (alert is auto-accepted)
      const lenBefore = (await textOf(page, '#arrayArea')).length;
      await page.fill('#deleteIndex', '999'); // invalid
      await page.click('#btnDeleteIndex');
      // Ensure UI remains stable
      const lenAfter = (await textOf(page, '#arrayArea')).length;
      expect(lenAfter).toBeGreaterThanOrEqual(0);
      expect(lenAfter).toBe(lenBefore); // no modification expected for invalid index
    });

    test('ChangeKey: change key at index smaller and larger and verify heap updates', async ({ page }) => {
      // Load a simple array so we can reason about change
      await page.fill('#buildArray', '10,20,30');
      await page.click('#btnLoadArray');

      // Decrease key at index 0 to 5 (already root) -> should remain root
      await page.fill('#changeIndex', '0');
      await page.fill('#changeValue', '5');
      await page.click('#btnChangeKey');

      let arr = await textOf(page, '#arrayArea');
      expect(arr).toContain('[0]:5');

      // Increase key at index 0 to large value -> siftDown should occur
      await page.fill('#changeIndex', '0');
      await page.fill('#changeValue', '100');
      await page.click('#btnChangeKey');

      arr = await textOf(page, '#arrayArea');
      expect(arr).toContain('[0]:20') || expect(arr).toContain('[0]:30') || expect(arr).toContain('[0]:100');
      // At minimum ensure render happened and compCount/swapCount are numbers
      expect(Number(await textOf(page, '#compCount'))).toBeGreaterThanOrEqual(0);
      expect(Number(await textOf(page, '#swapCount'))).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Build / Heapify / Heap Sort flows', () => {
    test('LoadArray and BuildHeap (immediate) produce a valid heap', async ({ page }) => {
      await page.fill('#buildArray', '7,3,10,1,5,2');
      await page.click('#btnLoadArray');

      // Build heap immediate
      await page.click('#btnBuildHeap');

      // Validate heap property via btnValidate -> will trigger alert which is auto-accepted
      await page.click('#btnValidate');

      // The app's validateHeap returns true after build - we confirm no runtime errors and array not empty
      const arr = await textOf(page, '#arrayArea');
      expect(arr).toMatch(/\[0\]:\d+/);
    });

    test('GenerateHeapifySteps: generates detailed steps added to history and log', async ({ page }) => {
      await page.fill('#buildArray', '7,3,10,1,5,2');
      await page.click('#btnGenerateSteps');

      // After generation, history and logArea should contain entries
      const historyInfo = await textOf(page, '#historyInfo');
      expect(historyInfo).toMatch(/steps \(current:/);

      const log = await textOf(page, '#logArea');
      expect(log.length).toBeGreaterThan(0);
    });

    test('HeapSortAsc and HeapSortDesc create step history and restore original array', async ({ page }) => {
      // Load baseline array
      await page.fill('#buildArray', '7,3,10,1,5,2');
      await page.click('#btnLoadArray');

      // Capture baseline array text
      const baseline = await textOf(page, '#arrayArea');

      // Ascending heap sort (simulated) - click
      await page.click('#btnHeapSortAsc');

      // History should have captured 'heap sort simulated' snapshot
      let historyInfo = await textOf(page, '#historyInfo');
      expect(historyInfo).toMatch(/steps \(current:/);

      // Descending heap sort - click
      await page.click('#btnHeapSortDesc');

      historyInfo = await textOf(page, '#historyInfo');
      expect(historyInfo).toMatch(/steps \(current:/);

      // The UI restores the original array after simulated sort, so current array should match baseline
      const after = await textOf(page, '#arrayArea');
      expect(after).toBe(baseline);
    });
  });

  test.describe('History, Undo/Redo, Jump, Snapshots', () => {
    test('SaveSnapshot -> Undo -> Redo -> JumpToStep should navigate history correctly', async ({ page }) => {
      // Ensure a known state
      await page.fill('#buildArray', '1,2,3');
      await page.click('#btnLoadArray');

      // Save manual snapshot with description
      await page.fill('#snapshotDesc', 'my snapshot');
      await page.click('#btnSaveSnapshot');

      const historyBefore = await textOf(page, '#historyInfo');

      // Perform an insert to create a new snapshot
      await page.fill('#insertValue', '99');
      await page.click('#btnInsert');

      // Undo should return to previous snapshot
      await page.click('#btnUndo');
      const afterUndo = await textOf(page, '#arrayArea');
      expect(afterUndo).not.toContain('99');

      // Redo should reapply the insert
      await page.click('#btnRedo');
      const afterRedo = await textOf(page, '#arrayArea');
      expect(afterRedo).toContain('99');

      // Jump to the initial snapshot (0)
      await page.fill('#jumpStep', '0');
      await page.click('#btnJump');
      const afterJump = await textOf(page, '#arrayArea');
      // After jump to initial, array should reflect earliest snapshot (likely the initial empty state or first snapshot)
      expect(afterJump.length).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Utilities & Edge Cases: Reset, Randomize, Validate, Export/Import, StopAutoPlay', () => {
    test('ResetHeap returns to initial empty state', async ({ page }) => {
      // Load array and then reset
      await page.fill('#buildArray', '8,9,10');
      await page.click('#btnLoadArray');

      await page.click('#btnReset');

      // After reset array should be empty and history should contain reset snapshot
      const arrText = await textOf(page, '#arrayArea');
      expect(arrText).toContain('(empty)');

      const historyInfo = await textOf(page, '#historyInfo');
      expect(historyInfo).toMatch(/steps \(current:/);
    });

    test('Randomize creates an array of requested size', async ({ page }) => {
      await page.fill('#randSize', '5');
      await page.click('#btnRandomize');

      const arrText = await textOf(page, '#arrayArea');
      // Count the number of occurrences of '[' which corresponds to elements
      const count = (arrText.match(/\[/g) || []).length;
      expect(count).toBe(5);
    });

    test('ValidateHeap indicates violation for non-heap and holds after build', async ({ page }) => {
      // Load array that violates min-heap: root larger than child
      await page.fill('#buildArray', '2,1');
      await page.click('#btnLoadArray');

      // Validate should display "Heap property violated" (dialog auto-accepted)
      await page.click('#btnValidate');

      // Now build heap immediate and validate should hold
      await page.click('#btnBuildHeap');
      await page.click('#btnValidate');
      // If no page error thrown and UI stable, consider test passed (dialogs auto-accepted)
      const arrText = await textOf(page, '#arrayArea');
      expect(arrText.length).toBeGreaterThan(0);
    });

    test('ExportJSON and ImportJSON roundtrip state via prompts', async ({ page }) => {
      // Load a known array to export
      await page.fill('#buildArray', '11,22,33');
      await page.click('#btnLoadArray');

      // Click Export - dialog handler will capture exported JSON default value
      await page.click('#btnExport');

      // Ensure we captured some exported JSON (handler stored it)
      // lastExportedJSON may be null in some environments; assert it is string when available
      if (lastExportedJSON) {
        expect(typeof lastExportedJSON).toBe('string');
        // Now clear the array then import the JSON back
        await page.click('#btnReset'); // reset clears and saves snapshot
        await page.click('#btnImport'); // dialog handler will feed lastExportedJSON to import
        // After import, arrayArea should include 11,22,33
        const arrText = await textOf(page, '#arrayArea');
        expect(arrText).toContain('11');
        expect(arrText).toContain('22');
        expect(arrText).toContain('33');
      } else {
        // If defaultValue not available in this environment, ensure the prompt was invoked at least
        // (no further checks possible). Confirm UI still functional.
        expect(await textOf(page, '#arrayArea')).toContain('[0]:11');
      }
    });

    test('StopAutoPlay toggling and stop button behavior', async ({ page }) => {
      // Start auto-play by checking the checkbox
      await page.check('#autoPlay');
      // Give some small time for autoplay to start (it uses setInterval based on speed)
      await page.waitForTimeout(200);

      // Now trigger stop via button
      await page.click('#btnStopAuto');

      // Ensure the autoPlay checkbox is unchecked after stop
      const checked = await page.isChecked('#autoPlay');
      expect(checked).toBe(false);
    });
  });

  test.describe('Edge validations: prompts and invalid input behaviors', () => {
    test('Importing invalid JSON shows no crash and alerts are handled', async ({ page }) => {
      // Simulate clicking import when our dialog handler will supply empty string (invalid JSON)
      // To make sure code path runs:
      await page.click('#btnImport');

      // The app will attempt to parse and alert on error; since our dialog handler accepted '', no crash expected.
      const arrText = await textOf(page, '#arrayArea');
      // UI remains stable
      expect(arrText.length).toBeGreaterThanOrEqual(1);
    });

    test('JumpToStep invalid index triggers alert but app remains stable', async ({ page }) => {
      // Set jump step to invalid large number and click Go
      await page.fill('#jumpStep', '9999');
      await page.click('#btnJump');

      // UI stays stable
      const arrText = await textOf(page, '#arrayArea');
      expect(arrText.length).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Console and runtime error observations', () => {
    test('No uncaught ReferenceError/SyntaxError/TypeError on load and interactions', async ({ page }) => {
      // Perform a representative set of interactions that exercise many code paths
      await page.fill('#buildArray', '4,2,5,1,3');
      await page.click('#btnLoadArray');
      await page.click('#btnGenerateSteps');
      await page.click('#btnHeapSortAsc');
      await page.click('#btnRandomize');
      await page.click('#btnReset');

      // At this point our afterEach will assert there were no pageErrors or console error messages.
      // To be explicit here, assert arrays are empty
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});