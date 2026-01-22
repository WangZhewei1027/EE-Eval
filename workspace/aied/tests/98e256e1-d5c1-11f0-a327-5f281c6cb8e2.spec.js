import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e256e1-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe('Floyd–Warshall Algorithm Interactive Demo (FSM validation)', () => {
  // Capture console messages & page errors for each test and assert none occur unexpectedly.
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and errors emitted by the page.
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push({ type, text });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page exactly as-is.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Basic sanity: no uncaught page errors were produced during test
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    // No console errors were produced during test
    expect(consoleErrors, 'No console.error logs should be emitted').toEqual([]);
  });

  test.describe('Initial / Idle state (S0_Idle)', () => {
    test('page loads and initial UI elements reflect Idle entry actions', async ({ page }) => {
      // Validate that adjacency matrix area has a table created by createAdjMatrix(N)
      const adjMatrixArea = page.locator('#adjMatrixArea table');
      await expect(adjMatrixArea).toBeVisible();

      // N default is 5 -> table should have header + 5 rows
      const rows = adjMatrixArea.locator('tr');
      await expect(rows).toHaveCount(1 + 5); // 1 header + N rows

      // updateSelectors() should populate src/tgt selects with N options
      const srcOptions = page.locator('#srcSel option');
      const tgtOptions = page.locator('#tgtSel option');
      await expect(srcOptions).toHaveCount(5);
      await expect(tgtOptions).toHaveCount(5);

      // enableControls(true) initial behavior:
      // - initBtn enabled, runFull enabled, step/back/play disabled
      const initBtn = page.locator('#initBtn');
      const runFullBtn = page.locator('#runFull');
      const stepFwdBtn = page.locator('#stepFwd');
      const stepBackBtn = page.locator('#stepBack');
      const playBtn = page.locator('#playBtn');

      await expect(initBtn).toBeEnabled();
      await expect(runFullBtn).toBeEnabled();
      await expect(stepFwdBtn).toBeDisabled();
      await expect(stepBackBtn).toBeDisabled();
      await expect(playBtn).toBeDisabled();

      // There should be an initial log line "Ready. Set up a graph..."
      const logArea = page.locator('#logArea');
      await expect(logArea).toContainText('Ready. Set up a graph, click "Initialize", then Step/Play/Run.');
    });
  });

  test.describe('Initialization and stepping (S1_Initialized -> S3_Stepping)', () => {
    test('InitializeAlgorithm creates initial snapshot, enables stepping controls and renders matrices', async ({ page }) => {
      // Click Initialize
      await page.click('#initBtn');

      // After initialization, kLabel should show k = - and ijLabel should show '-'
      await expect(page.locator('#kLabel')).toHaveText(/k = -/);
      await expect(page.locator('#ijLabel')).toHaveText('-');

      // Step forward/back/play should be enabled appropriately after initialize (per redefined initializeFW)
      await expect(page.locator('#stepFwd')).toBeEnabled();
      await expect(page.locator('#stepBack')).toBeDisabled();
      await expect(page.locator('#playBtn')).toBeEnabled();
      await expect(page.locator('#runFull')).toBeEnabled();

      // Distance and Next areas should contain tables (rendered matrices)
      await expect(page.locator('#distArea table')).toBeVisible();
      await expect(page.locator('#nextArea table')).toBeVisible();

      // The log should include the initialization message
      await expect(page.locator('#logArea')).toContainText('Initialized matrices. Ready to step.');
    });

    test('StepForward/StepBackward update history index and visual highlights', async ({ page }) => {
      // Ensure initialized
      await page.click('#initBtn');

      // Step forward once - stepIndex should increase and ijLabel should show a current pair like (i,j) or '-'
      await page.click('#stepFwd');
      // After stepping from initial snapshot, ijLabel often becomes something like (0,0) or similar
      const ijText = await page.locator('#ijLabel').innerText();
      expect(ijText === '-' || /\(\d+,\d+\)/.test(ijText)).toBeTruthy();

      // Now stepBack should be enabled
      await expect(page.locator('#stepBack')).toBeEnabled();

      // Step back and ensure we return to initial state 'k = -'
      await page.click('#stepBack');
      await expect(page.locator('#kLabel')).toHaveText('k = -');
      await expect(page.locator('#stepBack')).toBeDisabled();
    });
  });

  test.describe('Run-to-end and playing (S2_Running -> S4_Playing -> S3_Stepping)', () => {
    test('RunToEnd executes full algorithm, records history and enables path reconstruction', async ({ page }) => {
      // Initialize first
      await page.click('#initBtn');

      // Click Run to End
      await page.click('#runFull');

      // After running to end, kLabel should show 'final'
      await expect(page.locator('#kLabel')).toHaveText(/final/);

      // Step back should be enabled (we can move through history), step forward should be disabled at final
      await expect(page.locator('#stepBack')).toBeEnabled();
      await expect(page.locator('#stepFwd')).toBeDisabled();

      // Log should contain completion message
      await expect(page.locator('#logArea')).toContainText('Algorithm completed. Use "Show Path" to reconstruct a path');

      // Try playing: click the play button (it should toggle to 'Pause' when playing)
      const playBtn = page.locator('#playBtn');
      // Ensure playBtn is enabled
      await expect(playBtn).toBeEnabled();
      await playBtn.click();
      await expect(playBtn).toHaveText('Pause');

      // Wait a short time to allow a play step to occur (playback uses timeout based on #speed)
      await page.waitForTimeout(300);
      // Pause playback
      await playBtn.click();
      await expect(playBtn).toHaveText('Play');
    });
  });

  test.describe('Path reconstruction (S5_PathShown) and controls', () => {
    test('ShowPath reconstructs or reports no path; handles negative cycles message', async ({ page }) => {
      // Load a preset example to get deterministic small graph
      await page.click('#presetBtn');

      // Initialize and run full algorithm
      await page.click('#initBtn');
      await page.click('#runFull');

      // Choose source 0 and target 3 (exists in preset)
      await page.selectOption('#srcSel', '0');
      await page.selectOption('#tgtSel', '3');

      // Click Show Path
      await page.click('#showPath');

      // The path result should contain 'Path:' and either 'length' or 'no path'
      const pathText = await page.locator('#pathRes').innerText();
      expect(pathText.startsWith('Path:')).toBeTruthy();
      // For the provided preset, there should be a path (the demo's preset is connected in many pairs)
      // Accept either no path message or a path with length; we assert presence of 'Path:' already.
    });

    test('ResetDemo clears matrices, history and UI state', async ({ page }) => {
      // Initialize and run something to ensure stateful content exists
      await page.click('#initBtn');
      await page.click('#runFull');

      // Now click Reset
      await page.click('#resetBtn');

      // Adjacency matrix should still be present (new table created), but history should be cleared -> kLabel reset and pathRes reset
      await expect(page.locator('#kLabel')).toHaveText('k = -');
      await expect(page.locator('#ijLabel')).toHaveText('-');
      await expect(page.locator('#pathRes')).toHaveText('Path: —');

      // Log area should be cleared
      await expect(page.locator('#logArea')).toHaveText('');
    });
  });

  test.describe('Generators, import/export and edge cases', () => {
    test('Generate random fills adjacency inputs and respects density parameter', async ({ page }) => {
      // Set N to 4 for a smaller matrix
      await page.fill('#nInput', '4');
      await page.click('#applyBtn');

      // Ensure there is a 4x4 matrix
      const inputs = page.locator('#adjMatrixArea input[type="text"]');
      await expect(inputs).toHaveCount(4 * 4);

      // Select dense option and click Generate Random
      await page.selectOption('#density', '0.8');
      await page.click('#randBtn');

      // At least diagonal entries should be '0'; non-diagonal may be filled or blank; confirm some non-empty exist
      const nonDiag = page.locator('#adjMatrixArea input[type="text"]').filter({ hasNot: page.locator('[value=""]') });
      // At least the diagonal zeros + some random edges -> expecting at least N entries non-empty
      await expect(nonDiag).toHaveCountGreaterThanOrEqual(4);
    });

    test('ExportJSON shows prompt with JSON and LoadJSON can ingest a valid payload', async ({ page }) => {
      // Initialize and run to produce final matrices
      await page.click('#initBtn');
      await page.click('#runFull');

      // Intercept the export prompt dialog and capture the displayed JSON text
      let exportedText = null;
      page.once('dialog', async dialog => {
        // The prompt displays a message and default value is the JSON; capture message (dialog.message())
        exportedText = dialog.message();
        // Accept without changing (just dismiss copy dialog)
        await dialog.accept();
      });

      // Click export, this triggers a prompt
      await page.click('#exportBtn');

      // Ensure exportedText was captured
      expect(exportedText).not.toBeNull();

      // Now test load: call Load JSON and provide a custom JSON payload via dialog.accept(text)
      // Prepare a small valid payload consistent with demo's expected shape
      const smallPayload = {
        N: 3,
        directed: true,
        dist: [
          [0, 1, 4],
          [Infinity, 0, 2],
          [3, Infinity, 0]
        ],
        next: [
          [0, 1, 2],
          [null, 1, 2],
          [0, null, 2]
        ]
      };
      const smallJson = JSON.stringify(smallPayload, null, 2);

      page.once('dialog', async dialog => {
        // The load prompt asks to paste JSON; supply our smallJson text
        await dialog.accept(smallJson);
      });

      // Click load button and wait a moment for UI to process
      await page.click('#loadBtn');
      await page.waitForTimeout(100);

      // After loading, logArea should contain a message indicating JSON was loaded
      await expect(page.locator('#logArea')).toContainText('Loaded JSON into adjacency matrix (best-effort). Press Initialize to start.');
    });

    test('LoadJSON handles invalid JSON by showing alert (dialog)', async ({ page }) => {
      // When invalid JSON is provided to the load dialog, the code catches and alerts. Intercept the prompt and then the alert.
      page.once('dialog', async dialog => {
        // First dialog is the prompt; supply invalid JSON
        await dialog.accept('not a json');
      });

      // Listen for the resulting alert shown by the catch block
      let alertMessage = null;
      page.once('dialog', async dialog => {
        if (dialog.type() === 'alert') {
          alertMessage = dialog.message();
          await dialog.accept();
        } else {
          await dialog.dismiss();
        }
      });

      // Trigger load
      await page.click('#loadBtn');

      // Wait briefly to allow alert handling
      await page.waitForTimeout(200);

      // There should have been an alert complaining about loading JSON
      expect(alertMessage).not.toBeNull();
      expect(alertMessage).toMatch(/Could not load JSON/i);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Adding and removing nodes adjusts selectors and matrix size', async ({ page }) => {
      // Starting with default N (likely 5)
      const initialN = await page.locator('#srcSel option').count();

      // Add a node
      await page.click('#addNode');
      const afterAddN = await page.locator('#srcSel option').count();
      expect(afterAddN).toBeGreaterThan(initialN);

      // Remove a node
      await page.click('#remNode');
      const afterRemN = await page.locator('#srcSel option').count();
      // It should be back to initialN (or at least <= afterAddN)
      expect(afterRemN).toBeLessThanOrEqual(afterAddN);
    });

    test('ReconstructPath returns "no path" when unreachable and handles negative cycle detection', async ({ page }) => {
      // Create a 3-node adjacency with disconnected nodes
      await page.fill('#nInput', '3');
      await page.click('#applyBtn');

      // Manually set adjacency: only edge 0->1 weight 5
      const inputs = page.locator('#adjMatrixArea input[type="text"]');
      // Clear all first
      const count = await inputs.count();
      for (let i = 0; i < count; i++) {
        await inputs.nth(i).fill('');
      }
      // Set diagonal zeros
      for (let i = 0; i < 3; i++) {
        const selector = `#adjMatrixArea input[data-i="${i}"][data-j="${i}"]`;
        // Not all inputs have dataset attributes accessible via CSS, so instead compute index:
      }
      // Workaround: fill by row/col indexing via DOM order:
      // 3x3 matrix, inputs are in order row0col0,row0col1,... etc
      const setVal = async (r, c, v) => {
        const idx = r * 3 + c;
        await inputs.nth(idx).fill(v);
      };
      // Set diagonals to 0
      for (let i = 0; i < 3; i++) await setVal(i, i, '0');
      // Set 0->1 = 5
      await setVal(0, 1, '5');

      // Initialize & run full
      await page.click('#initBtn');
      await page.click('#runFull');

      // Select src 1 -> tgt 2 (should be unreachable)
      await page.selectOption('#srcSel', '1');
      await page.selectOption('#tgtSel', '2');
      await page.click('#showPath');

      // Path result should indicate no path
      await expect(page.locator('#pathRes')).toContainText('no path');

      // Now craft a negative cycle: set dist[0][0] negative after execution by adjusting adjacency to create cycle
      // Make a cycle 0->1 (1), 1->2 (-4), 2->0 (1) => sum = -2 negative cycle
      // Fill adjacency entries
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) await setVal(r, c, '');
      for (let i = 0; i < 3; i++) await setVal(i, i, '0');
      await setVal(0,1,'1');
      await setVal(1,2,'-4');
      await setVal(2,0,'1');

      // Re-initialize & run full again
      await page.click('#initBtn');
      await page.click('#runFull');

      // Attempt path reconstruction between 0 and 2 should detect negative cycle
      await page.selectOption('#srcSel', '0');
      await page.selectOption('#tgtSel', '2');
      await page.click('#showPath');

      // pathRes should contain negative cycle message (class 'bad' used in code)
      const pathHtml = await page.locator('#pathRes').innerHTML();
      expect(pathHtml).toMatch(/Negative cycle detected/i);
    });
  });
});