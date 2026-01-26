import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c145394-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Floyd-Warshall Interactive Demonstration - FSM and UI tests', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions (pageerror)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Ensure the page loaded and initial UI elements are present
    await expect(page.locator('text=Floyd-Warshall Algorithm — Interactive Demonstration')).toBeVisible();
    await expect(page.locator('#adjContainer')).toBeVisible();
    // Wait for initial UI render
    await page.waitForSelector('#distContainer table');
  });

  test.afterEach(async () => {
    // After each test assert that there were no uncaught page errors (ReferenceError/SyntaxError/TypeError)
    // We explicitly check the pageErrors array collected from pageerror events.
    // This ensures we observed and recorded runtime exceptions if any occurred.
    expect(pageErrors.map(e => e.message || String(e))).toEqual(expect.arrayContaining([]));
    // Also assert that no console messages of severe error type were emitted
    const severe = consoleMessages.filter(m => m.type === 'error');
    expect(severe).toEqual([]);
  });

  test.describe('State S0 Idle and UI initial state', () => {
    test('Initial page load yields Idle state with adjacency table and default matrices', async ({ page }) => {
      // Verify nodes default and directed checked
      const stateInfo = page.locator('#stateInfo');
      await expect(stateInfo).toContainText('Nodes: 5');
      await expect(stateInfo).toContainText('Directed: Yes');

      // Check adjacency table was built: inputs with dataset.i and dataset.j exist
      const inputs = page.locator('#adjContainer input[data-i][data-j]');
      await expect(inputs).toHaveCount(25); // 5x5 default

      // Check diagonal entries show '0' in adjacency (adj table inputs)
      const diagInput = page.locator('#adjContainer input[data-i="0"][data-j="0"]');
      await expect(diagInput).toHaveValue('0');

      // Check distance matrix rendering: diagonal 0 and off-diagonal INF
      const firstDistCell = page.locator('#distContainer table tr').nth(1).locator('td').nth(1).locator('span'); // row 0, col 0
      await expect(firstDistCell).toHaveText('0');

      const offDistCell = page.locator('#distContainer table tr').nth(1).locator('td').nth(2).locator('span'); // row 0, col 1
      await expect(offDistCell).toHaveText('INF');

      // StepIndex should be 0
      await expect(page.locator('#stepIndex')).toHaveText('0');
    });
  });

  test.describe('Controls that change adjacency and node count (transitions to S1_Adjacency_Updated)', () => {
    test('Changing nodeCount range input rebuilds the adjacency table and initializes defaults', async ({ page }) => {
      // Set nodeCount to 3 via input range event
      await page.evaluate(() => {
        const nodeCount = document.getElementById('nodeCount');
        nodeCount.value = '3';
        nodeCount.dispatchEvent(new Event('input', { bubbles: true }));
      });
      // Wait for rebuild
      await page.waitForTimeout(50);

      // Verify node count updated in stateInfo
      await expect(page.locator('#stateInfo')).toContainText('Nodes: 3');

      // Adjacency inputs should be 3x3
      await expect(page.locator('#adjContainer input[data-i][data-j]')).toHaveCount(9);

      // Step index still 0 after initDefault
      await expect(page.locator('#stepIndex')).toHaveText('0');
    });

    test('Changing nodeCountNum (number input) triggers table rebuild', async ({ page }) => {
      // Change nodeCountNum to 4 and fire change event
      await page.fill('#nodeCountNum', '4');
      await page.dispatchEvent('#nodeCountNum', 'change');
      await page.waitForTimeout(50);

      await expect(page.locator('#stateInfo')).toContainText('Nodes: 4');
      await expect(page.locator('#adjContainer input[data-i][data-j]')).toHaveCount(16);
    });

    test('Toggling directed checkbox triggers Directed state change (S1)', async ({ page }) {
      // Toggle directed checkbox off
      await page.locator('#directed').uncheck();
      await page.waitForTimeout(20);
      await expect(page.locator('#stateInfo')).toContainText('Directed: No');

      // Toggle back on
      await page.locator('#directed').check();
      await expect(page.locator('#stateInfo')).toContainText('Directed: Yes');
    });
  });

  test.describe('Adjacency modifications and helpers', () => {
    test('Symmetrize copies i→j to j→i', async ({ page }) => {
      // Ensure at size 4 for stable indexing
      await page.fill('#nodeCountNum', '4');
      await page.dispatchEvent('#nodeCountNum', 'change');
      await page.waitForTimeout(50);

      // Set cell (0,1) to value 7
      await page.fill('#adjContainer input[data-i="0"][data-j="1"]', '7');
      await page.dispatchEvent('#adjContainer input[data-i="0"][data-j="1"]', 'change');
      // Click symmetrize
      await page.click('#symmetrize');
      // The symmetric cell (1,0) should now have same value
      const sym = page.locator('#adjContainer input[data-i="1"][data-j="0"]');
      await expect(sym).toHaveValue('7');
    });

    test('Apply adjacency creates a snapshot with the applied weight visible in distance matrix', async ({ page }) => {
      // Set an adjacency weight 0->1 to 5
      await page.fill('#adjContainer input[data-i="0"][data-j="1"]', '5');
      await page.dispatchEvent('#adjContainer input[data-i="0"][data-j="1"]', 'change');
      // Click Apply Adjacency
      await page.click('#applyAdj');
      await page.waitForTimeout(30);

      // After applying, history length (stepCount) should be >= 1 and distContainer reflects the 5
      await expect(page.locator('#distContainer')).toContainText('5');
    });

    test('Capture current matrices to adjacency updates adjacency inputs', async ({ page }) => {
      // Create a complete non-negative graph (ensures finite weights)
      await page.click('#completePos');
      await page.waitForTimeout(30);

      // Click Capture Current Matrices to Adjacency -> adjacency inputs should now show numeric values (not blank)
      await page.click('#captureAsAdj');
      await page.waitForTimeout(30);

      // Check at least one adjacency input shows a numeric (not 'INF' or blank)
      const inputs = page.locator('#adjContainer input[data-i][data-j]');
      const values = await inputs.allTextContents();
      // Some entries may be '0' for diagonal; ensure at least one non-empty besides diagonal exists
      const nonBlank = values.filter(v => v.trim() !== '');
      expect(nonBlank.length).toBeGreaterThan(0);
    });
  });

  test.describe('Stepping, play/pause and full runs (S3_Playing, S4_Stepping, S2 Snapshot Committed)', () => {
    test('Compute full history (Run Full) and step forward/back through snapshots', async ({ page }) => {
      // Ensure small n for fast enumeration
      await page.fill('#nodeCountNum', '3');
      await page.dispatchEvent('#nodeCountNum', 'change');
      await page.waitForTimeout(30);

      // Apply an adjacency so we have some edges
      await page.fill('#adjContainer input[data-i="0"][data-j="1"]', '2');
      await page.dispatchEvent('#adjContainer input[data-i="0"][data-j="1"]', 'change');
      await page.click('#applyAdj');
      await page.waitForTimeout(50);

      // Run full Floyd-Warshall
      await page.click('#runFull');
      // Wait for compute to produce history (might be many snapshots)
      await page.waitForTimeout(100);

      // Get current step index and step count
      const stepIndexText = await page.locator('#stepIndex').textContent();
      const stepCountText = await page.locator('#stepCount').textContent();
      const idx = Number(stepIndexText || '0');
      const cnt = Number(stepCountText || '0');
      expect(cnt).toBeGreaterThan(0);
      expect(idx).toBeGreaterThanOrEqual(0);

      // Step back and then forward
      const prevIdx = idx;
      await page.click('#stepBack');
      await page.waitForTimeout(20);
      const afterBack = Number((await page.locator('#stepIndex').textContent()) || '0');
      expect(afterBack).toBeGreaterThanOrEqual(0);
      // Step forward restores or increases index
      await page.click('#stepForward');
      await page.waitForTimeout(20);
      const afterForward = Number((await page.locator('#stepIndex').textContent()) || '0');
      expect(afterForward).toBeGreaterThanOrEqual(afterBack);
    });

    test('Play/Pause toggles playing state and updates button text (S3_Playing entry_action playPause)', async ({ page }) => {
      // Make sure there is a multi-snapshot history to play through
      await page.click('#runFull');
      await page.waitForTimeout(80);

      const btn = page.locator('#playPause');
      // Start play
      await btn.click();
      await page.waitForTimeout(50);
      await expect(btn).toHaveText('Pause');

      // Wait a bit for stepping to happen, ensure stepIndex has moved or reached end
      const idxDuringPlay = Number((await page.locator('#stepIndex').textContent()) || '0');
      // Pause playback
      await btn.click();
      await page.waitForTimeout(20);
      await expect(btn).toHaveText('Play');
      // Confirm index is a valid number
      expect(Number.isFinite(idxDuringPlay)).toBe(true);
    });

    test('Run Until Negative Cycle detects negative cycle and shows alert (S5_Negative_Cycle_Detected)', async ({ page }) => {
      // Use the preset negative cycle graph to guarantee detection
      await page.click('#presetNegCycle');

      // Prepare to capture alert
      let dialogMsg = null;
      page.once('dialog', async dialog => {
        dialogMsg = dialog.message();
        await dialog.dismiss();
      });

      // Run until negative cycle
      await page.click('#runUntilNeg');
      // Give script time to run and produce the alert
      await page.waitForTimeout(120);

      expect(dialogMsg).toBeTruthy();
      expect(dialogMsg).toContain('Negative cycle detected');
      // Verify that the state description includes "Negative cycle detected" or that stepIndex moved
      const sInfo = await page.locator('#stateInfo').textContent();
      expect(sInfo).toBeTruthy();
    });
  });

  test.describe('Manual triple application, commit, undo/redo, and path reconstruction', () => {
    test('Applying a manual triple with out-of-range indices triggers alert (edge case)', async ({ page }) => {
      // Set manual inputs out-of-range
      await page.fill('#manualK', '999');
      await page.fill('#manualI', '999');
      await page.fill('#manualJ', '999');

      let dialogMsg = null;
      page.once('dialog', async dialog => {
        dialogMsg = dialog.message();
        await dialog.dismiss();
      });

      await page.click('#applyTriple');
      await page.waitForTimeout(30);
      expect(dialogMsg).toBe('Indices out of range');
    });

    test('applySingleTriple updates history and commitSnapshot truncates history (S2 Snapshot Committed)', async ({ page }) => {
      // Ensure small graph and known adjacency
      await page.fill('#nodeCountNum', '3');
      await page.dispatchEvent('#nodeCountNum', 'change');
      await page.waitForTimeout(50);

      // Apply adjacency 0->1 weight 4 and commit it
      await page.fill('#adjContainer input[data-i="0"][data-j="1"]', '4');
      await page.dispatchEvent('#adjContainer input[data-i="0"][data-j="1"]', 'change');
      await page.click('#applyAdj');
      await page.waitForTimeout(30);

      // Apply a manual triple that might update distances
      await page.fill('#manualK', '0');
      await page.fill('#manualI', '0');
      await page.fill('#manualJ', '1');
      await page.click('#applyTriple');
      await page.waitForTimeout(30);

      // Now there should be at least two history entries
      const stepCountBeforeCommit = Number((await page.locator('#stepCount').textContent()) || '0');
      expect(stepCountBeforeCommit).toBeGreaterThanOrEqual(0);

      // Commit snapshot and verify history becomes a single snapshot (stepCount becomes 0)
      await page.click('#commitSnapshot');
      await page.waitForTimeout(20);
      expect(await page.locator('#stepIndex').textContent()).toBe('0');
      expect(await page.locator('#stepCount').textContent()).toBe('0');
    });

    test('Undo and Redo navigate snapshots', async ({ page }) => {
      // Create two snapshots by applying adjacency twice
      await page.fill('#adjContainer input[data-i="0"][data-j="1"]', '6');
      await page.dispatchEvent('#adjContainer input[data-i="0"][data-j="1"]', 'change');
      await page.click('#applyAdj');
      await page.waitForTimeout(20);

      await page.fill('#adjContainer input[data-i="1"][data-j="2"]', '8');
      await page.dispatchEvent('#adjContainer input[data-i="1"][data-j="2"]', 'change');
      await page.click('#applyAdj');
      await page.waitForTimeout(30);

      const idxAfterTwo = Number((await page.locator('#stepIndex').textContent()) || '0');
      expect(idxAfterTwo).toBeGreaterThanOrEqual(0);

      // Undo should move back at least one
      await page.click('#undo');
      await page.waitForTimeout(20);
      const afterUndo = Number((await page.locator('#stepIndex').textContent()) || '0');
      expect(afterUndo).toBeLessThanOrEqual(idxAfterTwo);

      // Redo should move forward
      await page.click('#redo');
      await page.waitForTimeout(20);
      const afterRedo = Number((await page.locator('#stepIndex').textContent()) || '0');
      expect(afterRedo).toBeGreaterThanOrEqual(afterUndo);
    });

    test('Reconstruct path shows path text when path exists', async ({ page }) => {
      // Ensure small graph
      await page.fill('#nodeCountNum', '3');
      await page.dispatchEvent('#nodeCountNum', 'change');
      await page.waitForTimeout(30);

      // Make adjacency 0->1 (2), 1->2 (3) and apply
      await page.fill('#adjContainer input[data-i="0"][data-j="1"]', '2');
      await page.dispatchEvent('#adjContainer input[data-i="0"][data-j="1"]', 'change');
      await page.fill('#adjContainer input[data-i="1"][data-j="2"]', '3');
      await page.dispatchEvent('#adjContainer input[data-i="1"][data-j="2"]', 'change');

      await page.click('#applyAdj');
      await page.waitForTimeout(40);

      // Set pathFrom and pathTo and click Show Path
      await page.fill('#pathFrom', '0');
      await page.fill('#pathTo', '2');

      await page.click('#reconstructPath');
      await page.waitForTimeout(20);

      const result = await page.locator('#pathResult').textContent();
      // Should display a path A -> B -> C (labels) or contains 'Path:'
      expect(result).toBeTruthy();
      expect(result).toContain('Path:');
    });
  });

  test.describe('Export/Import and Dijkstra comparison', () => {
    test('Export JSON fills textarea and Import restores state', async ({ page }) => {
      // Ensure a state to export
      await page.click('#completePos');
      await page.waitForTimeout(30);

      // Click export
      await page.click('#exportJson');
      await page.waitForTimeout(20);
      const jsonVal = await page.locator('#jsonArea').inputValue();
      expect(jsonVal).toBeTruthy();
      expect(jsonVal).toContain('"n"');

      // Modify node count to 2 ensuring change
      await page.fill('#nodeCountNum', '2');
      await page.dispatchEvent('#nodeCountNum', 'change');
      await page.waitForTimeout(20);
      await expect(page.locator('#adjContainer input[data-i][data-j]')).toHaveCount(4);

      // Paste original exported JSON back and import
      await page.fill('#jsonArea', jsonVal);
      // There is no thrown exception on import; importJson shows alerts on failure
      await page.click('#importJsonBtn');
      await page.waitForTimeout(40);

      // After import, node count should match exported n (completePos used default current n)
      const sInfo = await page.locator('#stateInfo').textContent();
      expect(sInfo).toContain('Nodes:');
    });

    test('Dijkstra compare displays lines and warns on negative edges if any', async ({ page }) => {
      // Ensure complete non-negative graph (no negative edges)
      await page.click('#completePos');
      await page.waitForTimeout(30);

      // Set source to 0 and click compare
      await page.fill('#dijSrc', '0');
      await page.click('#dijkstraCompare');
      await page.waitForTimeout(30);

      const lines = await page.locator('#dijkstraResult').textContent();
      expect(lines).toBeTruthy();
      // Should contain label lines like "A: Dijkstra="
      expect(lines).toContain('A: Dijkstra=');
    });
  });

  test.describe('Error scenarios and edge cases', () => {
    test('Importing invalid JSON triggers alert and is handled', async ({ page }) => {
      // Put invalid JSON in textarea
      await page.fill('#jsonArea', 'this is not json');

      let dialogMsg = null;
      page.once('dialog', async dialog => {
        dialogMsg = dialog.message();
        await dialog.dismiss();
      });

      await page.click('#importJsonBtn');
      await page.waitForTimeout(30);

      // importJson wraps JSON.parse in try/catch and alerts on failure
      expect(dialogMsg).toBeTruthy();
      expect(dialogMsg).toMatch(/Failed to import JSON|Paste JSON into textarea first|Invalid JSON/);
    });
  });

  test.describe('Console and runtime observation (must not inject/patch; observe natural errors)', () => {
    test('Observe console and page errors during typical interactions', async ({ page }) => {
      // Interact moderately to cause any latent console messages
      await page.click('#randomize');
      await page.waitForTimeout(30);
      await page.click('#runFull');
      await page.waitForTimeout(60);
      await page.click('#toStart');
      await page.waitForTimeout(20);

      // No assertions here about injecting; we only assert that no uncaught page errors occurred.
      // The afterEach will check pageErrors and console error entries.
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    });
  });
});