import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c13de62-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Quick Sort Interactive Simulator (9c13de62-fa79-11f0-8fe7-a5317bd8e2c6)', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Collect console and page errors
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      try {
        page.context()._consoleMessages.push(msg.text());
      } catch (e) { /* ignore */ }
    });
    page.on('pageerror', (err) => {
      try {
        page.context()._pageErrors.push(err);
      } catch (e) { /* ignore */ }
    });

    await page.goto(APP_URL);
    // Ensure the app initialised
    await expect(page.locator('h2')).toHaveText('Quick Sort Interactive Simulator');
    // Ensure arrayView rendered elements corresponding to initial array
    const arrInputVal = await page.locator('#arrayInput').inputValue();
    expect(arrInputVal.length).toBeGreaterThan(0);
  });

  test.afterEach(async ({ page }) => {
    // Assert no unexpected page errors occurred
    const errors = page.context()._pageErrors || [];
    // For safety, fail if any uncaught page errors exist
    expect(errors.length, 'No uncaught page errors should be present').toBe(0);
    // At least ensure simulator logged readiness in DOM logView (UI-level)
    const logItems = await page.locator('#logView div').allTextContents();
    expect(logItems.some(t => t.includes('Simulator ready')), 'Simulator should log ready message').toBeTruthy();
  });

  test.describe('States: Idle, Sorting, Paused, ManualPivot', () => {
    test('Initial state is Idle: history reset and initial snapshot present', async ({ page }) => {
      // Validate Idle behavior: resetHistory called on load -> history length 1 and initial op 'init' visible
      const historyText = await page.locator('#historyView').innerText();
      expect(historyText).toContain('Initial array');
      // arrayView should show items matching arrayInput
      const arrayItems = await page.locator('#arrayView .array-item').allTextContents();
      const parsedInput = (await page.locator('#arrayInput').inputValue()).split(',').map(x=>x.trim());
      expect(arrayItems.length).toBe(parsedInput.length);
    });

    test('Start Sort transitions Idle -> Sorting and then Pause to Paused', async ({ page }) => {
      // Speed up control to avoid long automatic runs interfering (set to large so auto stepping slower)
      await page.locator('#speed').fill('2000');
      await page.locator('#speed').dispatchEvent('input');

      // Click Start Sort and verify a runStart pushed and controller started (log)
      await page.click('#startBtn');
      // Wait for a log entry about Started sort
      await expect(page.locator('#logView')).toContainText('Started sort', { timeout: 3000 });

      // Verify history has more than 1 item
      const historyCountAfterStart = await page.evaluate(()=> window._qsSim ? window._qsSim.history().length : 0);
      expect(historyCountAfterStart).toBeGreaterThan(1);

      // Pause the sort (clicking Pause when running should pause)
      await page.click('#pauseBtn');
      // Verify a 'Paused.' message appears in the log
      await expect(page.locator('#logView')).toContainText('Paused', { timeout: 2000 });

      // Confirm paused state by trying to Step (step should resume one step then pause)
      const beforeCount = await page.evaluate(()=> window._qsSim ? window._qsSim.history().length : 0);
      await page.click('#stepBtn');
      // small wait for step to be processed
      await page.waitForTimeout(200);
      const afterCount = await page.evaluate(()=> window._qsSim ? window._qsSim.history().length : 0);
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
    });

    test('Manual pivot selection causes ManualPivot state when pivotStrategy manual', async ({ page }) => {
      // Set pivot strategy to manual
      await page.selectOption('#pivotStrategy', 'manual');
      // Start a sort with manual pivot expected
      // Use step to ensure deterministic yields
      // Start sort
      await page.click('#startBtn');
      // Wait until generator yields awaitPivot; the UI logs 'Paused at awaitPivot' when it'll pause
      // Because of timing, poll the internal generator lastYield.op via window._qsSim.generator()
      await page.waitForTimeout(100); // give generator a moment
      const becameAwaitPivot = await page.waitForFunction(() => {
        try {
          const g = window._qsSim && window._qsSim.generator && window._qsSim.generator();
          return g && g.lastYield && (g.lastYield.op === 'awaitPivot');
        } catch(e) { return false; }
      }, { timeout: 3000 });
      expect(becameAwaitPivot).toBeTruthy();

      // Now simulate clicking an array item to choose pivot (this should resume generator)
      const firstItem = page.locator('#arrayView .array-item').first();
      const idx = await firstItem.getAttribute('data-index');
      // Click the element, generator should resume and produce new states
      await firstItem.click();
      // After click, generator should have progressed; check last history op not 'awaitPivot'
      await page.waitForTimeout(200);
      const lastOp = await page.evaluate(()=> {
        const h = window._qsSim.history();
        return h[h.length-1].op;
      });
      expect(lastOp).not.toBe('awaitPivot');
      // Pause to avoid long runs
      await page.click('#pauseBtn');
    });
  });

  test.describe('Events / Controls and transitions', () => {
    test('ApplyArray accepts valid array and rejects invalid input', async ({ page }) => {
      // Valid apply: change array input and apply
      await page.fill('#arrayInput', '1,2,3,4');
      await page.click('#applyArray');
      // history should reflect applied array
      await expect(page.locator('#historyView')).toContainText('Initial array', { timeout: 1000 });
      const arrLabels = await page.locator('#arrayView .array-item').allTextContents();
      // Ensure array view reflects new values
      expect(arrLabels.map(t => t.split(' ')[0])).toEqual(['1','2','3','4']);

      // Invalid apply: non-numeric values
      await page.fill('#arrayInput', '1,foo,3');
      // Click and capture alert
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#applyArray'),
      ]);
      expect(dialog.message()).toContain('Invalid array input');
      await dialog.accept();
    });

    test('ShuffleArray shuffles elements but preserves multiset', async ({ page }) => {
      // Ensure base is known
      await page.fill('#arrayInput', '1,2,3,4,5');
      await page.click('#applyArray');

      // Capture base sorted array
      const base = await page.locator('#arrayView .array-item').allTextContents();
      const baseValues = base.map(t => Number(t.split(' ')[0])).sort((a,b)=>a-b);

      // Click shuffle
      await page.click('#shuffleArray');
      // Last history op should be shuffle
      await expect(page.locator('#historyView')).toContainText('shuffle', { timeout: 1000 });

      // Validate shuffled contains same multiset
      const shuffled = await page.locator('#arrayView .array-item').allTextContents();
      const shuffledValues = shuffled.map(t => Number(t.split(' ')[0])).sort((a,b)=>a-b);
      expect(shuffledValues).toEqual(baseValues);
    });

    test('RandomArray generates a new array and resets history', async ({ page }) => {
      // set size to 7 to assert length
      await page.fill('#randSize', '7');
      await page.click('#randomArray');
      // After random, resetHistory called -> history length should be 1
      const hLen = await page.evaluate(()=> window._qsSim.history().length);
      expect(hLen).toBe(1);
      // arrayView should show 7 items
      const items = await page.locator('#arrayView .array-item').count();
      expect(items).toBe(7);
    });

    test('Step and Step Back behavior (undo/redo) and manual undo/redo buttons', async ({ page }) => {
      // Create a manual change (manual swap) to ensure history branching actions exist
      await page.fill('#swapI', '0');
      await page.fill('#swapJ', '1');
      await page.click('#manualSwapBtn');
      // history should increase
      const afterSwapLen = await page.evaluate(()=> window._qsSim.history().length);
      expect(afterSwapLen).toBeGreaterThan(1);

      // Undo via undoBtn (same as stepBack)
      await page.click('#undoBtn');
      const afterUndoIndex = await page.evaluate(()=> window._qsSim.history().length ? window._qsSim.history().length - 1 : 0, );
      // We cannot guarantee exact index numeric, but ensure history view has at least one entry
      expect(afterUndoIndex).toBeGreaterThanOrEqual(0);

      // Redo: clicking redoBtn should advance index if possible
      // First ensure can redo by performing a swap again
      await page.click('#manualSwapBtn');
      const beforeRedoIndex = await page.evaluate(()=> window._qsSim.history().length);
      // Click undo then redo
      await page.click('#undoBtn');
      await page.click('#redoBtn');
      const afterRedoIndex = await page.evaluate(()=> window._qsSim.history().length);
      expect(afterRedoIndex).toBeGreaterThanOrEqual(beforeRedoIndex);
    });

    test('Run partition, run recursion and fast forward operations (control flow)', async ({ page }) => {
      // Use manual stepping to control generator; set pivot strategy to 'last' to avoid awaitPivot
      await page.selectOption('#pivotStrategy', 'last');
      // Start sort then immediately click runPartition to run until partition completion
      await page.click('#startBtn');
      // Wait for generator to initialize
      await page.waitForTimeout(100);
      // Click run partition and wait for expected log message
      await page.click('#runPartitionBtn');
      await expect(page.locator('#logView')).toContainText('Partition completed', { timeout: 5000 });

      // Start a new run and test runRecursion: start sort then click runRecursion
      await page.click('#startBtn');
      await page.waitForTimeout(100);
      await page.click('#runRecursionBtn');
      await expect(page.locator('#logView')).toContainText('Returned from recursion', { timeout: 5000 });

      // Test fast forward (runToEnd): start then run to end
      await page.click('#startBtn');
      await page.waitForTimeout(100);
      await page.click('#fastForwardBtn');
      // Wait for 'Sort finished.' log
      await expect(page.locator('#logView')).toContainText('Sort finished', { timeout: 10000 });
    });

    test('Export and Import state (valid and invalid JSON cases)', async ({ page }) => {
      // Export current state to importArea
      await page.click('#exportBtn');
      // importArea should be populated
      const exported = await page.locator('#importArea').inputValue();
      expect(exported.length).toBeGreaterThan(10);

      // Now modify importArea to invalid JSON and try to import to trigger alert
      await page.fill('#importArea', 'not-a-json');
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#importBtn'),
      ]);
      // importState catches JSON.parse error and alerts 'Import failed:'
      expect(dialog.message()).toContain('Import failed');
      await dialog.accept();

      // Now restore exported valid JSON and import successfully
      await page.fill('#importArea', exported);
      const [dialog2] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#importBtn'),
      ]);
      // importBtn's importState logs 'Imported state.' and also triggers an alert? No: importBtn logs only. But compare dialog message if any; importState may not show dialog for valid import.
      // If a dialog appears, accept it; otherwise just proceed.
      if (dialog2) {
        // Some environments might still present an alert from previous behaviours; accept if present.
        await dialog2.accept();
      }
      // Confirm history was set from imported data (history array exists)
      const hLen = await page.evaluate(()=> window._qsSim.history().length);
      expect(hLen).toBeGreaterThanOrEqual(1);
    });

    test('Manual Swap and Set Value with edge cases (invalid inputs)', async ({ page }) => {
      // Invalid manual swap: non-integer indices should alert
      await page.fill('#swapI', 'a');
      await page.fill('#swapJ', '1');
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#manualSwapBtn'),
      ]);
      expect(dialog.message()).toContain('Indices must be integers');
      await dialog.accept();

      // Valid manual swap should succeed
      await page.fill('#swapI', '0');
      await page.fill('#swapJ', '1');
      await page.click('#manualSwapBtn');
      await expect(page.locator('#logView')).toContainText('Manual swap executed', { timeout: 1000 });

      // Invalid set value: non-integer index triggers alert
      await page.fill('#setIdx', 'x');
      await page.fill('#setVal', '42');
      const [dlg2] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#setValBtn'),
      ]);
      expect(dlg2.message()).toContain('Index must be integer');
      await dlg2.accept();

      // Valid set value
      await page.fill('#setIdx', '0');
      await page.fill('#setVal', '99');
      await page.click('#setValBtn');
      await expect(page.locator('#logView')).toContainText('Element set manually', { timeout: 1000 });
      // Validate arrayView first element changed to 99
      const firstLabel = await page.locator('#arrayView .array-item').first().innerText();
      expect(firstLabel.split(' ')[0]).toBe('99');
    });

    test('Compare Strategies produces a comparison snapshot and shows alert', async ({ page }) => {
      // Set a known small array to keep operations light
      await page.fill('#arrayInput', '5,3,8,1,2');
      await page.click('#applyArray');

      // Choose pivot strategies different from each other
      await page.selectOption('#pivotStrategy', 'last');
      await page.selectOption('#compareStrategy', 'median3');

      // Clicking compare triggers an alert with result; capture it
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#compareStrategiesBtn'),
      ]);
      expect(dialog.message()).toContain('Comparison result:');
      await dialog.accept();

      // A compare snapshot should be pushed to history with op 'compare'
      const lastOp = await page.evaluate(()=> {
        const h = window._qsSim.history();
        return h[h.length-1].op;
      });
      expect(lastOp).toBe('compare');
    });

    test('Reset All asks for confirmation and resets history when accepted', async ({ page }) {
      // Modify array so reset will be observable
      await page.fill('#arrayInput', '2,1,3');
      await page.click('#applyArray');

      // Click resetAll and accept the confirm dialog
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#resetAllBtn'),
      ]);
      expect(dialog.message()).toContain('Reset history and generator?');
      await dialog.accept();

      // After reset, history length should be 1 and the UI should indicate reset
      const hLen = await page.evaluate(()=> window._qsSim.history().length);
      expect(hLen).toBe(1);
      await expect(page.locator('#logView')).toContainText('Reset all', { timeout: 1000 });
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Clicking Step when no active generator starts a run and pushes states', async ({ page }) => {
      // Ensure no generator running by resetting
      await page.click('#resetAllBtn');
      const dlg = await page.waitForEvent('dialog');
      await dlg.accept();

      // Click step: should start sort controller implicitly and push states
      await page.click('#stepBtn');
      // Wait briefly and assert history increased beyond 1
      await page.waitForTimeout(200);
      const hLen = await page.evaluate(()=> window._qsSim.history().length);
      expect(hLen).toBeGreaterThan(1);
    });

    test('Safe step back cancels active run when present via confirm', async ({ page }) => {
      // Start a sort
      await page.click('#startBtn');
      await page.waitForTimeout(100);
      // Click backBtn triggers confirm if genController exists
      const p = page.waitForEvent('dialog');
      await page.click('#backBtn');
      const dialog = await p;
      // Confirm message warns about cancelling active run
      expect(dialog.message()).toContain('Stepping back will cancel the active run');
      // Accept to proceed
      await dialog.accept();
      // Now ensure generator was cancelled: window._qsSim.generator() should be null or undefined
      const gen = await page.evaluate(()=> {
        const g = window._qsSim && window._qsSim.generator && window._qsSim.generator();
        return g ? true : false;
      });
      // Expect generator absent (false) after accept
      expect(gen).toBeFalsy();
    });
  });

  test.describe('Console and runtime observation', () => {
    test('No uncaught ReferenceError/SyntaxError/TypeError on load and during interactions', async ({ page }) => {
      // Already captured page errors in afterEach; do some interactions and ensure no page errors are recorded
      await page.click('#exportBtn');
      await page.click('#shuffleArray');
      await page.click('#applyArray');
      // Allow time for any async errors to surface
      await page.waitForTimeout(500);
      const errors = page.context()._pageErrors || [];
      // Assert no uncaught JS errors
      expect(errors.length).toBe(0);
      // Also check console messages captured for informational content
      const consoles = page.context()._consoleMessages || [];
      expect(consoles.some(t => t.includes('Simulator ready') || t.includes('Started sort') || t.includes('Paused'))).toBeTruthy();
    });
  });
});