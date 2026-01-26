import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c14c8c1-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Greedy Algorithms Explorer - FSM and interactions (Application ID: 9c14c8c1-fa79-11f0-8fe7-a5317bd8e2c6)', () => {
  // Collect console messages and page errors per test to assert on them
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for debugging/verification
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure the page basic UI loaded
    await expect(page.locator('h1')).toHaveText('Greedy Algorithms Explorer');
  });

  test.afterEach(async () => {
    // Strictly assert that there were no uncaught page errors like ReferenceError, SyntaxError, TypeError.
    // These are collected naturally by the page; we do not alter runtime behavior.
    const errorTypes = pageErrors.map(e => (e && e.name) || String(e));
    // If there are any page errors at all, fail the test with details to aid debugging.
    expect(pageErrors, `Unexpected page errors: ${errorTypes.join(', ')}`).toEqual([]);
  });

  test.describe('State transitions and core events', () => {
    test('S0 Idle -> S1 Algorithm Selected: selecting algorithm updates state and config UI', async ({ page }) => {
      // Comment: Validate algorithm selection transition and that per-algo config is rendered.
      const algoSelect = page.locator('#algoSelect');

      // Ensure default selected value initially is 'coin'
      await expect(algoSelect).toHaveValue('coin');

      // Change to fractional_knapsack to simulate ALGORITHM_CHANGE
      await algoSelect.selectOption('fractional_knapsack');

      // After change, per-algo config should include the capacity input
      await expect(page.locator('#fracCap')).toBeVisible();

      // Verify that the global state.algo was updated by reading stateView JSON
      const stateObj = await page.evaluate(() => {
        try { return window.state ? window.state.algo : null; } catch (e) { return { err: String(e) }; }
      });
      expect(stateObj).toBe('fractional_knapsack');

      // Ensure renderAlgoConfig() was called (presence of apply button)
      await expect(page.locator('#applyFrac')).toBeVisible();
    });

    test('S1 Algorithm Selected -> S2 Dataset Edited: add item and clear dataset behavior', async ({ page }) => {
      // Comment: Validate ADD_ITEM and CLEAR_DATASET transitions and dataset editor updates.
      // Start with coin algorithm (default)
      await page.locator('#algoSelect').selectOption('coin');
      // Ensure dataset initially may be empty - renderDatasetEditor shows '(no items)' when empty
      const datasetArea = page.locator('#datasetArea');
      await expect(datasetArea).toBeVisible();

      // Click Add Item -> should create one item row
      await page.locator('#addItem').click();
      // Wait for datasetArea to contain an item row element
      await expect(page.locator('.item-row')).toHaveCount(1);

      // Verify state.items length increased to 1
      const itemsLength = await page.evaluate(() => window.state.items.length);
      expect(itemsLength).toBeGreaterThanOrEqual(1);

      // Now click Clear Dataset to simulate CLEAR_DATASET
      await page.locator('#clearDataset').click();
      await expect(datasetArea).toHaveText('(no items)');

      // Verify state.items is empty now
      const itemsLengthAfterClear = await page.evaluate(() => window.state.items.length);
      expect(itemsLengthAfterClear).toBe(0);
    });

    test('GENERATE_RANDOM_ITEMS produces correct count and updates sim state', async ({ page }) => {
      // Comment: Validate generating random items triggers dataset change and simulation reset.
      await page.locator('#algoSelect').selectOption('fractional_knapsack');

      // Set count and seed, then click generate
      await page.fill('#randCount', '4');
      await page.fill('#randSeed', 'test-seed-123');
      await page.locator('#randomItems').click();

      // datasetArea should now contain 4 rows
      await expect(page.locator('.item-row')).toHaveCount(4);

      // state.sim should be initialized for fractional_knapsack
      const simAlgo = await page.evaluate(() => window.state.sim ? window.state.sim.algo : null);
      expect(simAlgo).toBe('fractional_knapsack');
    });

    test('RUN_FULL_GREEDY triggers algorithm execution and populates resultView and log', async ({ page }) => {
      // Comment: Validate running full greedy for coin algorithm with sample data
      await page.locator('#algoSelect').selectOption('coin');
      await page.locator('#loadSample').click();

      // Ensure sample applied and coins input exists
      await expect(page.locator('#coinsInput')).toBeVisible();

      // Run full greedy
      await page.locator('#runFull').click();

      // resultView should contain JSON of chosen coins (non-empty)
      await expect(page.locator('#resultView')).not.toHaveText('');

      // Log should include 'Greedy' or 'completed' messages
      const logText = await page.locator('#log').innerText();
      expect(/Greedy|completed|Completed|Target amount reached|reached target/i.test(logText)).toBeTruthy();
    });

    test('STEP_FORWARD and STEP_BACK update simulation state and history/future stacks', async ({ page }) => {
      // Comment: Step through a simulation then step back to verify history/future behavior
      await page.locator('#algoSelect').selectOption('huffman');
      await page.locator('#applyHuff').click();

      // Ensure sim exists
      let initialNodesLen = await page.evaluate(() => window.state.sim ? window.state.sim.nodes.length : -1);
      expect(initialNodesLen).toBeGreaterThan(1);

      // Step forward once
      await page.locator('#stepForward').click();

      // After one step, history should have length 1
      const historyLenAfterStep = await page.evaluate(() => window.state.history.length);
      expect(historyLenAfterStep).toBeGreaterThanOrEqual(1);

      // Step back
      await page.locator('#stepBack').click();

      // After stepping back, a 'Stepped back.' message should be in log
      const logText = await page.locator('#log').innerText();
      expect(/Stepped back\./i.test(logText)).toBeTruthy();

      // Ensure future contains an item after stepping back
      const futureLen = await page.evaluate(() => window.state.future.length);
      expect(futureLen).toBeGreaterThanOrEqual(1);
    });

    test('PLAY_PAUSE toggles playback and updates UI text and logs', async ({ page }) => {
      // Comment: Validate toggling playback starts/stops automatic stepping
      await page.locator('#algoSelect').selectOption('huffman');
      await page.locator('#applyHuff').click();

      // Start playback
      await page.locator('#playPause').click();
      await expect(page.locator('#playPause')).toHaveText('Pause');

      // Playback should have started message
      let logText = await page.locator('#log').innerText();
      expect(/Playback started\./i.test(logText)).toBeTruthy();

      // Pause playback
      await page.locator('#playPause').click();
      await expect(page.locator('#playPause')).toHaveText('Play');

      logText = await page.locator('#log').innerText();
      expect(/Playback paused\./i.test(logText) || /Playback finished\./i.test(logText)).toBeTruthy();
    });

    test('RESET_SIM resets simulation state and logs reset action', async ({ page }) => {
      // Comment: Validate reset action (S3 -> S5)
      await page.locator('#algoSelect').selectOption('coin');
      await page.locator('#loadSample').click();
      // Perform some steps to change state
      await page.locator('#stepForward').click();

      // Now click Reset
      await page.locator('#resetSim').click();

      // log contains 'Simulation reset.'
      const logText = await page.locator('#log').innerText();
      expect(/Simulation reset\./i.test(logText)).toBeTruthy();

      // state.sim should be reinitialized (not null and matching current algo)
      const simAlgo = await page.evaluate(() => window.state.sim ? window.state.sim.algo : null);
      expect(simAlgo).toBe('coin');
    });
  });

  test.describe('Optimal computation, comparison, and batch tests', () => {
    test('COMPUTE_OPTIMAL and COMPARE_GREEDY_OPTIMAL for 0/1 Knapsack', async ({ page }) => {
      // Comment: Validate computing optimal via DP and comparing greedy vs optimal
      await page.locator('#algoSelect').selectOption('zero_one_knapsack');
      await page.locator('#kpCap').fill('50');
      await page.locator('#applyKP').click();

      // Run greedy then compute optimal
      await page.locator('#runFull').click();
      await page.locator('#computeOptimal').click();

      // resultView should contain 'Optimal' or DP message for 0/1 knapsack
      const resultText = await page.locator('#resultView').innerText();
      expect(/Optimal|DP|Optimal DP|Optimal value/i.test(resultText)).toBeTruthy();

      // Now trigger compare once
      await page.locator('#compareOnce').click();

      // The log should include that a comparison occurred
      const logText = await page.locator('#log').innerText();
      expect(/Compared greedy vs optimal/i.test(logText)).toBeTruthy();
    });

    test('BATCH_TEST reports summary and supports detection of counterexamples (job_seq too many jobs edge-case)', async ({ page }) => {
      // Comment: Run batch test in a mode that triggers an edge-case message for optimal computation
      await page.locator('#algoSelect').selectOption('job_seq');

      // Generate more than 12 jobs to trigger 'Too many jobs for brute force optimal search' when computeOptimal is called inside batchTest
      await page.fill('#randCount', '13');
      await page.locator('#randomItems').click();

      // Set trials small for speed
      await page.fill('#batchTrials', '2');

      // Click Batch Test (it is async and yields resultView)
      await page.locator('#batchTest').click();

      // Wait for resultView to be populated
      await expect(page.locator('#resultView')).not.toHaveText('');

      const rv = await page.locator('#resultView').innerText();
      // Batch test limited support message or summary must be present
      expect(/Batch results|Batch test|Too many jobs|Counterexamples|Greedy matched optimal/i.test(rv)).toBeTruthy();
    });
  });

  test.describe('Inspector, overrides, save/load JSON and error scenarios', () => {
    test('SAVE_JSON places JSON into resultView and LOAD_JSON with invalid input reports error', async ({ page }) => {
      // Comment: Validate saving dataset to JSON and error handling for invalid JSON load
      await page.locator('#algoSelect').selectOption('activity');
      await page.locator('#applyAct').click();

      // Click save JSON
      await page.locator('#saveJson').click();
      const saved = await page.locator('#resultView').innerText();
      expect(saved).toContain('"algo"');
      expect(saved).toContain('"items"');

      // Place invalid JSON in input and click loadJson -> should show Invalid JSON message in resultView
      await page.fill('#jsonInput', '{ invalidJson: ,,, }');
      await page.locator('#loadJson').click();
      const loadResult = await page.locator('#resultView').innerText();
      expect(/Invalid JSON:/i.test(loadResult)).toBeTruthy();

      // Now test valid JSON load restores algo and items and logs a message
      const validJson = JSON.stringify({ algo: 'coin', items: [{ id: 'x1', coin: 10, name: 'coin_10' }] });
      await page.fill('#jsonInput', validJson);
      await page.locator('#loadJson').click();

      // The status log should say 'Loaded JSON dataset.'
      const logText = await page.locator('#log').innerText();
      expect(/Loaded JSON dataset\./i.test(logText)).toBeTruthy();

      // And the algoSelect should be updated to 'coin'
      await expect(page.locator('#algoSelect')).toHaveValue('coin');
    });

    test('Overrides (include/exclude) affect greedy choices and recomputeFromOverrides works', async ({ page }) => {
      // Comment: Test forced include/exclude changes greedy outcomes and recomputeFromOverrides triggers run
      await page.locator('#algoSelect').selectOption('coin');
      await page.locator('#loadSample').click();

      // Ensure coin item rows present
      await expect(page.locator('.item-row')).toHaveCountGreaterThan(0);

      // Force-exclude the largest coin by selecting option in the first item row forced select
      const forcedSelect = page.locator('.item-row').first().locator('select[data-field="forced"]');
      await forcedSelect.selectOption('exclude');

      // Trigger recomputeFromOverrides
      await page.locator('#forceRecompute').click();

      // After recompute, log should mention 'Recomputed using current overrides.'
      const logText = await page.locator('#log').innerText();
      expect(/Recomputed using current overrides\./i.test(logText)).toBeTruthy();
    });

    test('Edge-case: computeOptimal on job_seq with >12 items shows "Too many jobs" message', async ({ page }) => {
      // Comment: Specifically validate the error/edge-case handling path described in computeJobOptimalBrute
      await page.locator('#algoSelect').selectOption('job_seq');

      // Create >12 jobs via randomItems
      await page.fill('#randCount', '13');
      await page.locator('#randomItems').click();

      // Click computeOptimal
      await page.locator('#computeOptimal').click();

      // resultView should indicate too many jobs
      const rv = await page.locator('#resultView').innerText();
      expect(/Too many jobs for brute force optimal search/i.test(rv)).toBeTruthy();
    });
  });

  test.describe('Internal state invariants and safety checks', () => {
    test('state.history and state.future behave correctly when stepping and resetting', async ({ page }) => {
      // Comment: Validate history/future stacks behave as expected when stepping, stepping back and resetting
      await page.locator('#algoSelect').selectOption('huffman');
      await page.locator('#applyHuff').click();

      // Step twice
      await page.locator('#stepForward').click();
      await page.locator('#stepForward').click();

      const hLen = await page.evaluate(() => window.state.history.length);
      expect(hLen).toBeGreaterThanOrEqual(2);

      // Step back once
      await page.locator('#stepBack').click();
      const futureLenAfterBack = await page.evaluate(() => window.state.future.length);
      expect(futureLenAfterBack).toBeGreaterThanOrEqual(1);

      // Reset simulation -> history and future cleared
      await page.locator('#resetSim').click();
      const historyAfterReset = await page.evaluate(() => window.state.history.length);
      const futureAfterReset = await page.evaluate(() => window.state.future.length);
      expect(historyAfterReset).toBe(0);
      expect(futureAfterReset).toBe(0);
    });

    test('UI toggles like showLog and allowOverride update behavior and DOM', async ({ page }) => {
      // Comment: Toggle showLog off should clear log display; toggling allowOverride should update state.overridesEnabled
      // Ensure showLog checkbox exists
      await expect(page.locator('#showLog')).toBeVisible();
      // Uncheck showLog
      const showLog = page.locator('#showLog');
      await showLog.uncheck();

      // Log should be cleared
      const logTextAfterUncheck = await page.locator('#log').innerText();
      expect(logTextAfterUncheck).toBe('');

      // Toggle allowOverride off and verify state changes
      const allowOverride = page.locator('#allowOverride');
      await allowOverride.uncheck();
      const overridesEnabled = await page.evaluate(() => window.state.overridesEnabled);
      expect(overridesEnabled).toBe(false);

      // Turn them back on for subsequent tests
      await showLog.check();
      await allowOverride.check();
    });
  });
});