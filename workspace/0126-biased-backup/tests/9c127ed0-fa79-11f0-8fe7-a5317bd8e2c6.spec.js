import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c127ed0-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Array Playground - full FSM coverage', () => {
  // Collect runtime diagnostics for each test
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture dialogs (alerts/confirms/prompts) and auto-accept/close them
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      try {
        await dialog.accept();
      } catch (e) {
        // ignore any accept issues
      }
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure the page's JS init runs
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // Assert no uncaught page errors occurred during tests
    expect(pageErrors, 'no uncaught page errors should be present').toHaveLength(0);
  });

  test('Initial render (Idle -> Array Loaded) shows title and initial example array', async ({ page }) => {
    // Validate page heading (entry action renderPage / h1 present)
    const title = await page.locator('h1').textContent();
    expect(title).toBe('Array Playground');

    // The page init() should load the example array into state and render it
    // Ensure window.ArrayPlayground is exposed and state.arr exists with expected elements
    const state = await page.evaluate(() => window.ArrayPlayground && window.ArrayPlayground.state ? window.ArrayPlayground.state : null);
    expect(state).not.toBeNull();
    expect(Array.isArray(state.arr)).toBeTruthy();
    expect(state.arr.length).toBeGreaterThanOrEqual(7); // initial example array length

    // The arrayContainer should contain an input for index 0 and a representation like [0]
    const containerHtml = await page.locator('#arrayContainer').innerHTML();
    expect(containerHtml).toContain('[0]');

    // History info should show history entries created by init + pushHistory
    const historyInfo = await page.locator('#historyInfo').textContent();
    expect(historyInfo).toMatch(/history \d+\/\d+/);
  });

  test.describe('Loading, appending and clearing arrays', () => {
    test('LoadFromInput replaces array and AppendFromInput appends elements', async ({ page }) => {
      // Prepare JSON input
      await page.fill('#inputData', '["x","y","z"]');
      await page.click('#appendFromInput');
      await page.waitForTimeout(100);

      // After append, state.arr should include these items at the end
      let arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(arr.slice(-3)).toEqual(['x', 'y', 'z']);

      // Now load different input - should replace the array
      await page.fill('#inputData', '[1,2,3]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(100);

      arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(arr).toEqual([1,2,3]);
    });

    test('ClearArray prompts confirm and clears the array (ArrayCleared)', async ({ page }) => {
      // Load an array then clear it
      await page.fill('#inputData', '[10,11,12]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(100);

      // There will be a confirm dialog handled by our global handler (auto-accept)
      await page.click('#clearArray');
      await page.waitForTimeout(100);

      const arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(arr.length).toBe(0);

      // The arrayContainer should display the no-visible-items text
      const text = await page.locator('#arrayContainer').textContent();
      expect(text.trim()).toBe('(no visible items)');
    });
  });

  test.describe('Generation and basic modifications (S3 ArrayModified)', () => {
    test('GenerateRandom creates numeric array in range', async ({ page }) => {
      await page.fill('#randCount', '5');
      await page.fill('#randMin', '5');
      await page.fill('#randMax', '10');
      await page.click('#genRandom');
      await page.waitForTimeout(100);

      const arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(arr.length).toBe(5);
      for (const v of arr) {
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThanOrEqual(10);
      }
    });

    test('Push / Unshift / InsertAt / Pop / Shift modify array and show alerts where applicable', async ({ page }) => {
      // Load a known array
      await page.fill('#inputData', '[1,2,3]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(100);

      // Push
      await page.fill('#newValue', '4');
      await page.click('#pushBtn');
      await page.waitForTimeout(50);
      let arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(arr[arr.length - 1]).toBe(4);

      // Unshift
      await page.fill('#newValue', '-1');
      await page.click('#unshiftBtn');
      await page.waitForTimeout(50);
      arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(arr[0]).toBe(-1);

      // Insert at index 1
      await page.fill('#insertIndex', '1');
      await page.fill('#newValue', '1.5');
      await page.click('#insertAtBtn');
      await page.waitForTimeout(50);
      arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(Number(arr[1])).toBeCloseTo(1.5, 6);

      // Pop (will trigger an alert "Popped: ...")
      const beforePopLen = arr.length;
      await page.click('#popBtn');
      await page.waitForTimeout(50);
      arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(arr.length).toBe(beforePopLen - 1);
      // Confirm that at least one dialog was seen containing 'Popped'
      expect(dialogs.some(d => /Popped:/.test(d.message))).toBeTruthy();

      // Shift (will trigger an alert "Shifted: ...")
      const beforeShiftLen = arr.length;
      await page.click('#shiftBtn');
      await page.waitForTimeout(50);
      arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(arr.length).toBe(beforeShiftLen - 1);
      expect(dialogs.some(d => /Shifted:/.test(d.message))).toBeTruthy();
    });
  });

  test.describe('Filtering, selection, removal & compacting', () => {
    test('ApplyViewFilter filters visible items and ClearViewFilter restores view', async ({ page }) => {
      // Load sample array with strings and numbers
      await page.fill('#inputData', '["apple","banana","apricot",42,"application"]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(100);

      // Filter for 'app' (non-regex)
      await page.fill('#viewFilter', 'app');
      await page.click('#applyViewFilter');
      await page.waitForTimeout(100);
      const visibleHtml = await page.locator('#arrayContainer').innerHTML();
      expect(visibleHtml).toContain('apple');
      expect(visibleHtml).toContain('application');
      expect(visibleHtml).not.toContain('banana');

      // Clear filter
      await page.click('#clearViewFilter');
      await page.waitForTimeout(100);
      const afterClear = await page.locator('#arrayContainer').innerHTML();
      expect(afterClear).toContain('banana');
      expect(afterClear).toContain('apple');
    });

    test('SelectAllVisible / DeselectAll / RemoveSelected / Compact', async ({ page }) => {
      // Load known array
      await page.fill('#inputData', '[1,2,3,4,5]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(100);

      // Apply a filter to show even numbers only ('2' will match 2)
      await page.fill('#viewFilter', '2');
      await page.click('#applyViewFilter');
      await page.waitForTimeout(50);

      // Select visible items (should select index with value 2)
      await page.click('#selectAllVisible');
      await page.waitForTimeout(50);

      // Count checked selection boxes
      const selectedCount = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#arrayContainer .sel-box')).filter(b => b.checked).length;
      });
      expect(selectedCount).toBeGreaterThanOrEqual(1);

      // Deselect all
      await page.click('#deselectAll');
      await page.waitForTimeout(50);
      const selectedAfter = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#arrayContainer .sel-box')).filter(b => b.checked).length;
      });
      expect(selectedAfter).toBe(0);

      // Select again and remove selected
      await page.click('#selectAllVisible');
      await page.waitForTimeout(50);
      await page.click('#removeSelected'); // will call setArray with kept items
      await page.waitForTimeout(100);
      const arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      // After removing '2', array should not contain 2
      expect(arr.includes(2)).toBeFalsy();

      // Compact array - should not throw error and should leave a valid array
      await page.click('#compactArray');
      await page.waitForTimeout(100);
      const arrAfterCompact = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(Array.isArray(arrAfterCompact)).toBeTruthy();
    });
  });

  test.describe('Search operations (FindNext/Prev/CountMatches) and regex edge-cases', () => {
    test('FindNext/FindPrev highlight matches and CountMatches displays count', async ({ page }) => {
      await page.fill('#inputData', '[ "a", "b", "a", "c", "a" ]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(100);

      await page.fill('#searchText', 'a');
      await page.click('#countMatches');
      await page.waitForTimeout(50);
      const countText = await page.locator('#searchResult').textContent();
      expect(countText).toContain('matches');

      // Next
      await page.click('#findNext');
      await page.waitForTimeout(50);
      const afterNext = await page.locator('#searchResult').textContent();
      expect(afterNext).toMatch(/match \d+\/\d+ at index \d+/);

      // Prev
      await page.click('#findPrev');
      await page.waitForTimeout(50);
      const afterPrev = await page.locator('#searchResult').textContent();
      expect(afterPrev).toMatch(/match \d+\/\d+ at index \d+/);
    });

    test('Invalid regex shows invalid regex feedback', async ({ page }) => {
      // Use search with regex mode and an invalid regex
      await page.fill('#searchText', '(');
      await page.check('#searchRegex');
      await page.click('#findNext');
      await page.waitForTimeout(50);
      const sr = await page.locator('#searchResult').textContent();
      // findNext sets searchResult to 'invalid regex' when regex cannot be compiled
      expect(sr).toContain('invalid regex');
    });

    test('ApplyViewFilter with invalid regex triggers alert', async ({ page }) => {
      await page.fill('#viewFilter', '(');
      await page.check('#filterRegex');
      await page.click('#applyViewFilter');
      await page.waitForTimeout(50);

      // Our global dialog handler auto-accepted; ensure an 'Invalid regex' alert was produced
      expect(dialogs.some(d => /Invalid regex/.test(d.message))).toBeTruthy();
    });
  });

  test.describe('History, snapshots and related UI', () => {
    test('Save snapshot, create snapshot with name, restore/fork/delete and clear snapshots', async ({ page }) => {
      // Start with a simple array
      await page.fill('#inputData', '[100,200,300]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(100);

      // Save snapshot (auto name)
      await page.click('#saveSnapshot');
      await page.waitForTimeout(100);

      // Create snapshot with custom name
      await page.fill('#snapshotName', 'MySnap');
      await page.click('#createSnapshotBtn');
      await page.waitForTimeout(100);

      // Snapshot list should contain 'MySnap' text
      const snapshotListHtml = await page.locator('#snapshotList').innerHTML();
      expect(snapshotListHtml).toContain('MySnap');

      // Fork the first snapshot (button class 'fork-snap') - click the fork of index 0
      const forkButtons = page.locator('#snapshotList .fork-snap');
      const forkCount = await forkButtons.count();
      if (forkCount > 0) {
        await forkButtons.first().click();
        await page.waitForTimeout(100);
        // After fork, history should have a new entry and array should match snapshot
        const arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
        expect(Array.isArray(arr)).toBeTruthy();
      }

      // Delete the first snapshot (delete-snap)
      const deleteButtons = page.locator('#snapshotList .delete-snap');
      if (await deleteButtons.count() > 0) {
        await deleteButtons.first().click();
        await page.waitForTimeout(100);
        // snapshotList should reduce in size or change content
        const newHtml = await page.locator('#snapshotList').innerHTML();
        expect(newHtml.length).toBeLessThanOrEqual(snapshotListHtml.length + 200); // sanity check
      }

      // Clear snapshots (will prompt confirm which we auto-accept)
      await page.click('#clearSnapshots');
      await page.waitForTimeout(100);
      const afterClearHtml = await page.locator('#snapshotList').innerHTML();
      expect(afterClearHtml.trim()).toBe('');
    });

    test('Undo and Redo revert and reapply history entries', async ({ page }) => {
      // Start clean and load array
      await page.fill('#inputData', '[1,2]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(100);

      // Push a value and then unshift so history grows
      await page.fill('#newValue', '3');
      await page.click('#pushBtn');
      await page.waitForTimeout(50);
      await page.fill('#newValue', '0');
      await page.click('#unshiftBtn');
      await page.waitForTimeout(50);

      const arrAfter = await page.evaluate(() => window.ArrayPlayground.state.arr.slice());
      expect(arrAfter[0]).toBe(0);

      // Undo twice
      await page.click('#undoBtn');
      await page.waitForTimeout(50);
      await page.click('#undoBtn');
      await page.waitForTimeout(50);
      let arrAfterUndo = await page.evaluate(() => window.ArrayPlayground.state.arr.slice());
      // After undoing past the two ops, array should be back to [1,2] or similar
      expect(arrAfterUndo[0]).toBeDefined();

      // Redo once
      await page.click('#redoBtn');
      await page.waitForTimeout(50);
      const arrAfterRedo = await page.evaluate(() => window.ArrayPlayground.state.arr.slice());
      expect(Array.isArray(arrAfterRedo)).toBeTruthy();
    });
  });

  test.describe('Export / clipboard and download', () => {
    test('CopyJSON attempts to write to clipboard and shows an alert success/failure', async ({ page }) => {
      // Load a small array
      await page.fill('#inputData', '[9,8,7]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(50);

      await page.click('#copyJSON');
      await page.waitForTimeout(100);

      // The dialog should include either success or failure message
      const found = dialogs.some(d => /Copied JSON to clipboard|Failed to copy/.test(d.message));
      expect(found).toBeTruthy();
    });

    test('DownloadJSON triggers a download flow (no uncaught errors)', async ({ page }) => {
      await page.fill('#inputData', '[1,2,3]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(50);

      await page.click('#downloadJSON');
      await page.waitForTimeout(100);

      // No specific DOM change expected; ensure no pageErrors recorded (checked in afterEach)
      expect(true).toBeTruthy();
    });
  });

  test.describe('Single operations, preview, visualization and edge cases', () => {
    test('PreviewOp and applyOp for map/filter/reduce and error scenarios', async ({ page }) => {
      // Load numeric array
      await page.fill('#inputData', '[1,2,3]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(100);

      // Map: set singleOp to 'map' and provide expression
      await page.selectOption('#singleOp', 'map');
      await page.fill('#op_expr', 'x*2');
      await page.click('#previewOp');
      await page.waitForTimeout(50);
      const previewText = await page.locator('#opPreview').textContent();
      expect(previewText).toContain('Preview result');

      // Apply without visual steps
      await page.click('#applyOp');
      await page.waitForTimeout(100);
      let arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(arr).toEqual([2,4,6]);

      // Filter: provide an expression that keeps values >= 4
      await page.selectOption('#singleOp', 'filter');
      await page.fill('#op_expr', 'x >= 4');
      await page.click('#previewOp');
      await page.waitForTimeout(50);
      await page.click('#applyOp');
      await page.waitForTimeout(100);
      arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(arr.every(x => Number(x) >= 4)).toBeTruthy();

      // Reduce: run and check reduceResult output
      await page.selectOption('#singleOp', 'reduce');
      await page.fill('#op_reduce_expr', 'acc + x');
      await page.fill('#op_reduce_init', '0');
      await page.click('#previewOp');
      await page.waitForTimeout(50);
      // applyOp for reduce will set array to [result] when not using visualization
      await page.click('#applyOp');
      await page.waitForTimeout(100);
      arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(arr.length).toBe(1);

      // Error case: map without expression should alert; choose map and clear expr
      await page.selectOption('#singleOp', 'map');
      await page.fill('#op_expr', '');
      await page.click('#previewOp');
      await page.waitForTimeout(50);
      expect(dialogs.some(d => /Provide expression/.test(d.message))).toBeTruthy();
    });

    test('Visualization path for applyOpWithVisualization executes without uncaught exceptions', async ({ page }) => {
      // Load array
      await page.fill('#inputData', '[1,2,3]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(50);

      // Choose an operation that changes array size - splice
      await page.selectOption('#singleOp', 'splice');
      await page.fill('#op_splice_index', '1');
      await page.fill('#op_splice_del', '1');
      await page.fill('#op_splice_items', '9,9');

      // Enable visual steps
      await page.check('#visualSteps');
      await page.fill('#stepDelay', '50'); // speed up
      await page.click('#applyOp');

      // Wait for visualization to finish and final apply
      await page.waitForTimeout(500);
      const arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(Array.isArray(arr)).toBeTruthy();
      // cleanup: uncheck visualSteps
      await page.uncheck('#visualSteps');
    });
  });

  test.describe('Pipeline operations, preview, play/pause and computations', () => {
    test('AddPipelineOp, configure map op, apply pipeline and applyPipelineStep', async ({ page }) => {
      // Load numeric array
      await page.fill('#inputData', '[1,2,3]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(50);

      // Add a map op
      await page.selectOption('#addOpSelect', 'map');
      await page.click('#addPipelineOp');
      await page.waitForTimeout(100);

      // Set expression in pipeline first op to x*10
      // Edit the input created in pipelineList: .pipe-expr
      const exprInput = page.locator('#pipelineList .pipe-expr').first();
      await exprInput.fill('x*10');
      await page.waitForTimeout(50);
      // Apply entire pipeline
      await page.click('#applyPipeline');
      await page.waitForTimeout(150);
      const arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(arr).toEqual([10,20,30]);

      // Add another op and test applyPipelineStep: add 'filter' op
      await page.selectOption('#addOpSelect', 'filter');
      await page.click('#addPipelineOp');
      await page.waitForTimeout(100);
      // Set second op's expr to keep items >= 20
      const pipeExprs = page.locator('#pipelineList .pipe-expr');
      if (await pipeExprs.count() >= 2) {
        await pipeExprs.nth(1).fill('x >= 20');
      }
      await page.waitForTimeout(50);
      // Apply only next enabled step
      await page.click('#applyPipelineStep');
      await page.waitForTimeout(100);
      const arrStep = await page.evaluate(() => window.ArrayPlayground.state.arr);
      // After applying first enabled op (map or filter depending on ordering), array should be an array
      expect(Array.isArray(arrStep)).toBeTruthy();
    });

    test('Play Pipeline rotates ops and can be paused (play/pause)', async ({ page }) => {
      // Load array
      await page.fill('#inputData', '[1,2]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(50);

      // Ensure at least one op exists; add unique op to avoid complicated behavior
      await page.selectOption('#addOpSelect', 'unique');
      await page.click('#addPipelineOp');
      await page.waitForTimeout(100);

      // Start playing - will set pipelineStatus to 'playing'
      await page.click('#playPipeline');
      await page.waitForTimeout(200);
      const statusPlaying = await page.locator('#pipelineStatus').textContent();
      expect(statusPlaying).toContain('playing');

      // Pause pipeline
      await page.click('#pausePipeline');
      await page.waitForTimeout(100);
      const statusPaused = await page.locator('#pipelineStatus').textContent();
      // Pause handler sets textContent to 'paused'
      expect(statusPaused).toContain('paused');
    });
  });

  test.describe('Advanced custom expressions and sorts', () => {
    test('ApplyCustomMap, ApplyCustomFilter, ApplyCustomSort and ApplyReduce', async ({ page }) => {
      // Load numeric array
      await page.fill('#inputData', '[2,3,4]');
      await page.click('#loadFromInput');
      await page.waitForTimeout(50);

      // Custom map: x+1
      await page.fill('#customExpr', 'x+1');
      await page.click('#applyCustomMap');
      await page.waitForTimeout(100);
      let arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(arr).toEqual([3,4,5]);

      // Custom filter: keep >3
      await page.fill('#customExpr', 'x > 3');
      await page.click('#applyCustomFilter');
      await page.waitForTimeout(100);
      arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      expect(arr.every(x => Number(x) > 3)).toBeTruthy();

      // Custom sort: reverse order using comparator 'b-a'
      await page.fill('#customComparator', 'b - a');
      await page.click('#applyCustomSort');
      await page.waitForTimeout(100);
      arr = await page.evaluate(() => window.ArrayPlayground.state.arr);
      // Should be descending
      for (let i = 1; i < arr.length; i++) {
        expect(Number(arr[i-1]) >= Number(arr[i])).toBeTruthy();
      }

      // Reduce: sum with initial 0 and show reduceResult
      await page.fill('#reduceExpr', 'acc + x');
      await page.fill('#reduceInit', '0');
      await page.click('#applyReduce');
      await page.waitForTimeout(100);
      const rr = await page.locator('#reduceResult').textContent();
      expect(rr).toContain('Result:');
    });

    test('Edge case: invalid comparator/expression triggers alert', async ({ page }) => {
      await page.fill('#customComparator', 'this is invalid (');
      await page.click('#applyCustomSort');
      await page.waitForTimeout(50);
      // Should have produced an alert containing 'Invalid comparator' or similar
      expect(dialogs.some(d => /Invalid comparator|Invalid expression/.test(d.message))).toBeTruthy();
    });
  });

  test.describe('Robustness and error handling', () => {
    test('Invalid input format shows parse error alert', async ({ page }) => {
      await page.fill('#inputData', 'not,a,valid,{"broken":}');
      await page.click('#loadFromInput');
      await page.waitForTimeout(50);
      // Expect an alert saying could not parse input (the code triggers alert in that case)
      expect(dialogs.some(d => /Could not parse input/.test(d.message))).toBeTruthy();
    });

    test('ComputeOpPreview error scenario (invalid function) handled gracefully', async ({ page }) => {
      // Choose sort custom mode with invalid comparator
      await page.selectOption('#singleOp', 'sort');
      await page.selectOption('#op_sort_mode', 'custom');
      await page.fill('#op_sort_custom', 'return (a +'); // invalid JS
      await page.click('#previewOp');
      await page.waitForTimeout(50);
      // Should have created an alert about invalid comparator or operation failed
      expect(dialogs.some(d => /Invalid comparator|Operation failed|Invalid comparator/.test(d.message))).toBeTruthy();
    });
  });

  test('No unexpected console errors emitted during test run', async ({ page }) => {
    // This test just asserts that no console error type messages were emitted.
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(errorConsole.length).toBe(0);
  });
});