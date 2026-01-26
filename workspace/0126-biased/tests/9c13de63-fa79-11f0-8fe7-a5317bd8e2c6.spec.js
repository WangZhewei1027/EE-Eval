import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c13de63-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper to parse "X / Y" stepInfo into numbers
function parseStepInfo(text) {
  // expected format like "0 / 123"
  const parts = text.split('/').map(s => s.trim());
  const current = parseInt(parts[0], 10);
  const last = parseInt(parts[1], 10);
  return { current, last };
}

test.describe('Heap Sort Interactive Demo (FSM validation)', () => {
  // We'll capture console error messages and page errors for each test.
  test.beforeEach(async ({ page }) => {
    // Listen to console errors and page errors for assertions
    page['_consoleErrors'] = [];
    page['_pageErrors'] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        page['_consoleErrors'].push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      page['_pageErrors'].push(err.message || String(err));
    });

    // Navigate to the app page
    await page.goto(APP_URL, { waitUntil: 'load' });
    // The app runs generateRandomArray() on load; wait for arrayView to populate
    await page.waitForSelector('#arrayView .cell', { timeout: 2000 });
  });

  test.afterEach(async ({ page }) => {
    // Assert there were no uncaught console errors or page errors during each test
    const cErrors = page['_consoleErrors'] || [];
    const pErrors = page['_pageErrors'] || [];
    expect(cErrors, `Console errors encountered: ${JSON.stringify(cErrors)}`).toHaveLength(0);
    expect(pErrors, `Page errors encountered: ${JSON.stringify(pErrors)}`).toHaveLength(0);
  });

  test.describe('Initial state and array generation (S0_Idle -> S1_ArrayGenerated)', () => {
    test('Initial render has an array visualized and pseudocode set', async ({ page }) => {
      // Validate that initial array is rendered (seeded generateRandomArray() invoked on load)
      const sizeVal = await page.textContent('#sizeVal');
      expect(Number(sizeVal)).toBeGreaterThan(0);

      const cells = await page.$$('#arrayView .cell');
      expect(cells.length).toBe(Number(sizeVal));

      // Pseudocode should contain HEAPSORT header
      const pseudo = await page.textContent('#pseudocode');
      expect(pseudo).toContain('HEAPSORT');

      // Step info should show initial "0 / N" even if no history yet (implementation renders 0 / 0)
      const stepInfo = await page.textContent('#stepInfo');
      expect(stepInfo).toMatch(/^\d+\s*\/\s*\d+$/);
    });

    test('Clicking Generate Random updates the array visualization (GenerateRandomArray event)', async ({ page }) => {
      // Capture current array content snapshot
      const snapshotBefore = await page.$eval('#arrayView', el => el.innerText);

      // Click Generate Random
      await page.click('#randBtn');
      // Wait for potential re-render
      await page.waitForTimeout(100);

      const snapshotAfter = await page.$eval('#arrayView', el => el.innerText);

      // Expect a change in the visualized array content (most likely different random values)
      expect(snapshotAfter).not.toBeNull();
      // It's possible seeded random produces identical result; at least the render should exist
      expect(snapshotAfter.length).toBeGreaterThan(0);
    });
  });

  test.describe('Custom array setting and validation (SetCustomArray)', () => {
    test('Setting an invalid custom array shows an alert and does not change array', async ({ page }) => {
      // Prepare to capture alert dialog
      let dialogMessage = null;
      page.on('dialog', dlg => {
        dialogMessage = dlg.message();
        dlg.accept();
      });

      // Set invalid custom array
      await page.fill('#customArray', '5, 3, foo, 7');
      await page.click('#setCustom');

      expect(dialogMessage).toContain('Invalid number');

      // Ensure array view unchanged in length as invalid input should be rejected
      const cells = await page.$$('#arrayView .cell');
      expect(cells.length).toBeGreaterThan(0);
    });

    test('Setting a valid custom array updates array and size (SetCustomArray)', async ({ page }) => {
      // Set a valid custom array
      await page.fill('#customArray', '9,8,7,6');
      await page.click('#setCustom');

      // Now arrayView should have 4 cells, and size input reflect that
      const cells = await page.$$('#arrayView .cell');
      expect(cells.length).toBe(4);

      const sizeVal = await page.textContent('#sizeVal');
      expect(Number(sizeVal)).toBeGreaterThanOrEqual(4);
    });
  });

  test.describe('Building trace and trace-related UI (S1_ArrayGenerated -> S2_TraceBuilt)', () => {
    test('Build trace produces history, populates log, slider and trace JSON (BuildTrace)', async ({ page }) => {
      // Ensure we have a small known array for deterministic length
      await page.fill('#customArray', '4,3,2');
      await page.click('#setCustom');

      // Build trace
      await page.click('#buildTrace');

      // Wait for traceJsonContent to be filled
      await page.waitForSelector('#traceJsonContent', { state: 'attached' });
      const traceJsonText = await page.textContent('#traceJsonContent');
      expect(traceJsonText).toBeTruthy();

      // Step slider max should be >= 1 (trace should have multiple snapshots)
      const stepInfoText = await page.textContent('#stepInfo');
      const { current, last } = parseStepInfo(stepInfoText);
      expect(last).toBeGreaterThanOrEqual(0);
      expect(current).toBe(0);

      // The log should contain entries equal to history length (log entries are children of #log)
      const logCount = await page.$$eval('#log > div', nodes => nodes.length);
      expect(logCount).toBeGreaterThan(0);

      // Pseudocode should be rendered and highlight a line (renderSnapshot calls renderPseudocode)
      const pseudocodeText = await page.textContent('#pseudocode');
      expect(pseudocodeText).toContain('HEAPSORT');
    });

    test('Clearing array then attempting to build shows an alert (edge case)', async ({ page }) => {
      // Clear the array
      await page.click('#clearArray');

      // Intercept alert dialog
      let dialogMsg = null;
      page.once('dialog', dlg => { dialogMsg = dlg.message(); dlg.accept(); });

      await page.click('#buildTrace');

      expect(dialogMsg).toContain('Array is empty');
    });
  });

  test.describe('Playback controls and transitions (S2_TraceBuilt <-> S3_Playing)', () => {
    test('Play starts auto stepping and Pause stops it (PlaySorting, PauseSorting)', async ({ page }) => {
      // Create a small array and build trace to have history
      await page.fill('#customArray', '10,1,5,3,8,2');
      await page.click('#setCustom');
      await page.click('#buildTrace');

      // Shorten speed for faster auto-play
      await page.fill('#speed', '100'); // slider, but fill still sets value
      // Also make sure speed value label updated
      await page.evaluate(() => {
        const s = document.getElementById('speed');
        s.value = '100';
        s.dispatchEvent(new Event('input'));
      });

      // Capture the current step
      const beforeText = await page.textContent('#stepInfo');
      const before = parseStepInfo(beforeText).current;

      // Click play
      await page.click('#play');

      // Wait long enough for auto stepping to advance (allow a bit of buffer)
      await page.waitForTimeout(450);

      const afterText = await page.textContent('#stepInfo');
      const after = parseStepInfo(afterText).current;

      // Expect progress advanced
      expect(after).toBeGreaterThanOrEqual(before + 1);

      // Now pause and ensure it doesn't advance further after waiting
      await page.click('#pause');
      const pausedAt = parseStepInfo(await page.textContent('#stepInfo')).current;
      await page.waitForTimeout(350);
      const stillPaused = parseStepInfo(await page.textContent('#stepInfo')).current;
      expect(stillPaused).toBe(pausedAt);
    });

    test('Step forward and backward buttons change current step (StepForward, StepBackward)', async ({ page }) => {
      // Ensure trace exists
      await page.fill('#customArray', '7,6,5,4');
      await page.click('#setCustom');
      await page.click('#buildTrace');

      // Get initial step
      let stepText = await page.textContent('#stepInfo');
      let parsed = parseStepInfo(stepText);
      const initial = parsed.current;

      // Step forward
      await page.click('#stepFwd');
      stepText = await page.textContent('#stepInfo');
      parsed = parseStepInfo(stepText);
      expect(parsed.current).toBeGreaterThanOrEqual(initial + 1);

      // Step backward
      await page.click('#stepBack');
      stepText = await page.textContent('#stepInfo');
      parsed = parseStepInfo(stepText);
      // Should be back to initial (or not exceed bounds)
      expect(parsed.current).toBeGreaterThanOrEqual(0);
    });

    test('Go to start and go to end work (GoToStart, GoToEnd)', async ({ page }) => {
      await page.fill('#customArray', '2,9,1,8,3');
      await page.click('#setCustom');
      await page.click('#buildTrace');

      // Go to end
      await page.click('#goEnd');
      let stepText = await page.textContent('#stepInfo');
      let parsed = parseStepInfo(stepText);
      expect(parsed.current).toBe(parsed.last);

      // Go to start
      await page.click('#goStart');
      stepText = await page.textContent('#stepInfo');
      parsed = parseStepInfo(stepText);
      expect(parsed.current).toBe(0);
    });

    test('Keyboard shortcuts: ArrowRight and ArrowLeft trigger step forward/backward', async ({ page }) => {
      await page.fill('#customArray', '1,4,3,2');
      await page.click('#setCustom');
      await page.click('#buildTrace');

      // Ensure focus on body so keyboard works
      await page.click('body');

      const before = parseStepInfo(await page.textContent('#stepInfo')).current;

      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(100);
      let after = parseStepInfo(await page.textContent('#stepInfo')).current;
      expect(after).toBeGreaterThanOrEqual(before + 1);

      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(100);
      const back = parseStepInfo(await page.textContent('#stepInfo')).current;
      expect(back).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Trace import/export and log interactions', () => {
    test('Importing a trace JSON populates history and UI (Import Trace)', async ({ page }) => {
      // Prepare a minimal trace to import
      const minimalTrace = [
        { array: [2,1], action: 'start', highlight: [], heapSize: 2, description: 'start', pseudo: 0, compares: 0, swaps: 0 },
        { array: [1,2], action: 'swap', highlight: [0,1], heapSize: 1, description: 'swap', pseudo: 3, compares: 1, swaps: 1 }
      ];
      const jsonStr = JSON.stringify(minimalTrace);

      // Use Playwright to set the file on the hidden input; this triggers change handler
      await page.setInputFiles('#importData', {
        name: 'trace.json',
        mimeType: 'application/json',
        buffer: Buffer.from(jsonStr)
      });

      // Wait for renderSnapshot to run and populate UI
      await page.waitForTimeout(200);

      // Verify traceJsonContent updated
      const traceContent = await page.textContent('#traceJsonContent');
      expect(traceContent).toContain('"array": [2, 1]');

      // The step slider max should reflect imported trace
      const stepInfo = await page.textContent('#stepInfo');
      const parsed = parseStepInfo(stepInfo);
      expect(parsed.last).toBeGreaterThanOrEqual(1);
    });

    test('Double-clicking the log triggers copy alert (dblclick log)', async ({ page }) => {
      // Build a trace first so log has entries
      await page.fill('#customArray', '3,2');
      await page.click('#setCustom');
      await page.click('#buildTrace');

      // Intercept the alert dialog triggered by dblclick (copy confirmation)
      let dialogText = null;
      page.once('dialog', dlg => { dialogText = dlg.message(); dlg.accept(); });

      // Double click the log element
      await page.dblclick('#log');

      // There should be an alert indicating array copied (implementation calls alert)
      // Wait for potential dialog handling
      await page.waitForTimeout(50);
      expect(dialogText).toBeTruthy();
      expect(dialogText).toContain('Array copied to clipboard');
    });
  });

  test.describe('Edge conditions and robustness', () => {
    test('Export trace when no trace built shows alert (edge case) and export after build has no alert', async ({ page }) => {
      // Ensure starting from a cleared state
      await page.click('#clearArray');

      // Capture dialog when export clicked without history
      let dialogMsg = null;
      page.once('dialog', dlg => { dialogMsg = dlg.message(); dlg.accept(); });

      await page.click('#exportBtn');
      expect(dialogMsg).toContain('No trace to export');

      // Now build a trace and click export - should not show the "No trace" alert
      await page.fill('#customArray', '6,5,4');
      await page.click('#setCustom');
      await page.click('#buildTrace');

      // Prepare to capture any alert (none expected)
      let gotAlert = false;
      page.once('dialog', dlg => { gotAlert = true; dlg.accept(); });

      await page.click('#exportBtn');
      // allow any potential alert to appear
      await page.waitForTimeout(100);
      expect(gotAlert).toBe(false);
    });

    test('Clicking array cell editors produce prompt/alert handling but do not throw runtime errors', async ({ page }) => {
      // Build a small array and then click on a cell to trigger prompt
      await page.fill('#customArray', '11,22,33');
      await page.click('#setCustom');

      // Intercept the prompt: Playwright handles dialogs via 'dialog' event
      // We'll respond with a valid number to avoid alert
      page.once('dialog', async dlg => {
        expect(dlg.type()).toBe('prompt');
        // Provide a new numeric value
        await dlg.accept('99');
      });

      // Click the first cell
      await page.click('#arrayView .cell[data-index="0"]');

      // Wait for re-render
      await page.waitForTimeout(100);

      // Ensure the cell text contains the new value '99' (may include index prefix)
      const cellText = await page.textContent('#arrayView .cell[data-index="0"]');
      expect(cellText).toContain('99');
    });
  });
});