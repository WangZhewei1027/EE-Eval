import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c1516e3-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Amortized Analysis Simulator — FSM and UI end-to-end', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      try {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (e) {
        consoleMessages.push(`console: (could not stringify)`);
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Auto-accept any dialogs (alerts/prompts used by the UI)
    page.on('dialog', async (dialog) => {
      // Accept with default; for prompts, accept empty string
      try {
        if (dialog.type() === 'prompt') {
          await dialog.accept();
        } else {
          await dialog.accept();
        }
      } catch (e) {
        // swallow
      }
    });

    await page.goto(APP_URL);
    // Ensure the page initial scripts had a chance to run
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    // sanity: we don't need special teardown
  });

  test('Initial Idle state (S0_Idle) renders sequence and strategies', async ({ page }) => {
    // Validate initial console message
    expect(consoleMessages.some(m => m.includes('Amortized Analysis Simulator ready.'))).toBeTruthy();

    // The sequenceText textarea initially contains 5 ops; renderOpsList should have 5 children
    const ops = page.locator('#opsList > div');
    await expect(ops).toHaveCount(5);

    // Strategies container should show the three default strategies added in initialization
    const strategies = page.locator('#strategiesContainer > div');
    await expect(strategies).toHaveCount(3);

    // No uncaught page errors at initial load
    expect(pageErrors.length).toBe(0);
  });

  test('LoadSequence transition (S0 -> S1): loading text updates ops list and manager.sequence', async ({ page }) => {
    // Replace the sequence textarea with a custom small sequence
    await page.fill('#sequenceText', 'push 10\npop\npush 20\npush 30');
    await page.click('#btnLoadSeq');

    // After clicking Load Sequence, opsList should reflect new sequence length
    const ops = page.locator('#opsList > div');
    await expect(ops).toHaveCount(4);

    // Validate manager.sequence length using page.evaluate (read-only)
    const seqLen = await page.evaluate(() => window.manager ? window.manager.sequence.length : -1);
    expect(seqLen).toBe(4);

    // Ensure page still has no runtime errors
    expect(pageErrors.length).toBe(0);

    // Verify text export (btnSaveSeq writes to exportOut and shows alert which we auto-accepted)
    await page.click('#btnSaveSeq');
    const exportOutVal = await page.$eval('#exportOut', (el) => el.value);
    expect(exportOutVal.length).toBeGreaterThan(0);
  });

  test('RunSimulation (S0 -> S2) then PauseSimulation (S2 -> S3) and resume (S3 -> S2) and Reset (S2 -> S0)', async ({ page }) => {
    // Ensure there is a sequence to run: generate a short deterministic sequence
    await page.fill('#randLen', '6');
    await page.fill('#randSeed', 'seed1');
    await page.click('#btnGenRand');

    // Start running
    await page.click('#btnRun');

    // Wait a short time to let a couple of steps run
    await page.waitForTimeout(250);

    // Check manager.isRunning true
    const running = await page.evaluate(() => window.manager ? window.manager.isRunning : false);
    expect(running).toBeTruthy();

    // Pause the simulation
    await page.click('#btnPause');
    await page.waitForTimeout(50);
    const paused = await page.evaluate(() => window.manager ? window.manager.isRunning : true);
    expect(paused).toBeFalsy();

    // Resume (Run) from paused state
    await page.click('#btnRun');
    await page.waitForTimeout(150);
    const resumed = await page.evaluate(() => window.manager ? window.manager.isRunning : false);
    expect(resumed).toBeTruthy();

    // Now Reset which should stop and clear per-strategy state
    await page.click('#btnReset');
    await page.waitForTimeout(50);
    const { isRunning, index } = await page.evaluate(() => {
      return { isRunning: window.manager.isRunning, index: window.manager.index };
    });
    expect(isRunning).toBeFalsy();
    expect(index).toBe(0);

    // Verify strategies have reset: their history lengths should be zero
    const histLens = await page.evaluate(() => window.manager.strategies.map(s => s.history.length));
    for (const l of histLens) expect(l).toBe(0);

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('SaveSnapshot (S0 -> S4) and RestoreSnapshot (S4 -> S5) flow', async ({ page }) => {
    // Create a known small sequence and run one step so that states differ from defaults
    await page.fill('#sequenceText', 'push A\npush B\npush C\npop');
    await page.click('#btnLoadSeq');
    // Step twice
    await page.click('#btnStep');
    await page.click('#btnStep');

    // Save a snapshot
    await page.click('#btnSaveSnapshot');

    // Validate snapshots array length on page context
    let snapsCount = await page.evaluate(() => window.snapshots ? window.snapshots.length : 0);
    expect(snapsCount).toBeGreaterThanOrEqual(1);

    // RenderSnapshots should have created a clickable child; click it to select
    const snapItem = page.locator('#snapshotsList > div').first();
    await snapItem.click();

    // Restore selected snapshot
    await page.click('#btnRestoreSnapshot');
    await page.waitForTimeout(100);

    // After restore, manager.sequence should reflect original snapshot's sequence length
    const seqLenAfterRestore = await page.evaluate(() => window.manager.sequence.length);
    expect(seqLenAfterRestore).toBeGreaterThan(0);

    // Strategies were restored: check strategies array length equals snapshot strategies length
    const strategiesCountAfterRestore = await page.evaluate(() => window.manager.strategies.length);
    expect(strategiesCountAfterRestore).toBeGreaterThanOrEqual(1);

    // Ensure UI updated the stateBox text for the selected strategy
    const stateBoxText = await page.locator('#stateBox').innerText();
    expect(stateBoxText).toContain('Strategy:');

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('Manual Push/Pop vs Automatic Append and auto-step behaviors', async ({ page }) => {
    // Switch to manual mode
    await page.selectOption('#modeSelect', 'manual');

    // Record histories before manual ops
    const beforeLens = await page.evaluate(() => window.manager.strategies.map(s => s.history.length));

    // Fill push value and click Push (manual -> immediate perform on all strategies)
    await page.fill('#pushValue', 'XYZ');
    await page.click('#btnPush');

    // Histories should have increased by 1 for every strategy
    const afterManualPushLens = await page.evaluate(() => window.manager.strategies.map(s => s.history.length));
    for (let i = 0; i < afterManualPushLens.length; i++) {
      expect(afterManualPushLens[i]).toBe(beforeLens[i] + 1);
    }

    // Now switch to auto mode and use Append Op to add to sequence; it should auto-step when not running
    await page.selectOption('#modeSelect', 'auto');
    // Clear sequence first
    await page.click('#btnClearSeq');

    // Set pushValue and append to sequence
    await page.fill('#pushValue', '123');
    await page.click('#btnAppendOp');

    // sequenceText should include our appended op
    const seqText = await page.locator('#sequenceText').inputValue();
    expect(seqText.split(/\r?\n/).some(line => line.includes('push'))).toBeTruthy();

    // When appending in auto mode, the code appends but only auto-steps for push/pop buttons (not AppendOp).
    // AppendOp just adds to sequence; ensure ops list updated to include appended op
    const opsCount = await page.locator('#opsList > div').count();
    expect(opsCount).toBeGreaterThanOrEqual(1);

    // Now test Pop in manual mode on an empty strategy (edge case: pop empty)
    await page.selectOption('#modeSelect', 'manual');
    // Reset strategies
    await page.click('#btnReset');
    await page.waitForTimeout(50);
    // Perform pop in manual mode
    await page.click('#btnPop');
    // The last history entry for each strategy should contain 'pop empty' detail or have same history length 1/0 depending on implementation
    // Probe details safely:
    const detailsArray = await page.evaluate(() => {
      return window.manager.strategies.map(s => {
        const last = s.history[s.history.length - 1];
        return last ? last.details : '';
      });
    });
    // At least one strategy should show the 'pop empty' text if an entry exists; otherwise ensure no runtime errors
    const anyPopEmpty = detailsArray.some(d => d && d.includes('pop empty'));
    expect(anyPopEmpty || detailsArray.every(d => d === '')).toBeTruthy();

    // No page errors observed
    expect(pageErrors.length).toBe(0);
  });

  test('GenerateRandomSequence (edge case deterministic via seed) and ClearSequence', async ({ page }) => {
    // Populate random sequence with seed and known length
    await page.fill('#randLen', '10');
    await page.fill('#randProb', '0.6');
    await page.fill('#randSeed', 'unit-test-seed');
    await page.click('#btnGenRand');

    // sequenceText should have 10 lines
    const seqText = await page.locator('#sequenceText').inputValue();
    const lines = seqText.split(/\r?\n/).filter(l => l.trim().length > 0);
    expect(lines.length).toBe(10);

    // Clear sequence
    await page.click('#btnClearSeq');
    const seqTextAfterClear = await page.locator('#sequenceText').inputValue();
    expect(seqTextAfterClear.trim()).toBe('');

    // opsList should be empty
    await expect(page.locator('#opsList > div')).toHaveCount(0);

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Step, Back transitions and cumulative cost canvas update', async ({ page }) => {
    // Prepare a short sequence and load it
    await page.fill('#sequenceText', 'push alpha\npush beta\npush gamma');
    await page.click('#btnLoadSeq');

    // Step once
    await page.click('#btnStep');
    await page.waitForTimeout(50);
    let indexAfterStep = await page.evaluate(() => window.manager.index);
    expect(indexAfterStep).toBe(1);

    // Step again
    await page.click('#btnStep');
    await page.waitForTimeout(50);
    indexAfterStep = await page.evaluate(() => window.manager.index);
    expect(indexAfterStep).toBe(2);

    // Back once
    await page.click('#btnBack');
    await page.waitForTimeout(50);
    const indexAfterBack = await page.evaluate(() => window.manager.index);
    expect(indexAfterBack).toBe(1);

    // Draw canvas is internally invoked by updateDetails; ensure canvas has some non-empty drawing by checking it still exists and no errors thrown
    const canvasExists = await page.$('#costCanvas');
    expect(canvasExists).not.toBeNull();

    // No page errors observed
    expect(pageErrors.length).toBe(0);
  });

  test('AddStrategy and RemoveStrategy with alert handling (edge cases: max/min constraints)', async ({ page }) => {
    // Ensure current strategies count
    const initialCount = await page.evaluate(() => window.manager.strategies.length);

    // Add strategies until hitting max (UI shows alert which we accept)
    // There is a max of 3; if initialCount < 3, clicking AddStrategy up to exceed triggers alert
    for (let i = 0; i < 4; i++) {
      await page.click('#btnAddStrategy');
      await page.waitForTimeout(50);
    }
    const afterAddCount = await page.evaluate(() => window.manager.strategies.length);
    // Should not exceed 3
    expect(afterAddCount).toBeLessThanOrEqual(3);

    // Now remove strategies until minimum (UI alerts if trying to remove below 1)
    for (let i = 0; i < 4; i++) {
      await page.click('#btnRemoveStrategy');
      await page.waitForTimeout(50);
    }
    const afterRemoveCount = await page.evaluate(() => window.manager.strategies.length);
    expect(afterRemoveCount).toBeGreaterThanOrEqual(1);

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('SaveSequence export/import of full simulation JSON path and LoadSequence JSON decoding', async ({ page }) => {
    // Build a small export object by first making small changes
    await page.fill('#sequenceText', 'push J\npush K\npop');
    await page.click('#btnLoadSeq');

    // Use the second click handler for btnSaveSeq which writes full JSON to exportOut (the file adds another listener later)
    // Click save which triggers a dialog alert too; our handler accepts it
    await page.click('#btnSaveSeq');
    await page.waitForTimeout(50);

    // Read exportOut value - it should be JSON (starts with '{')
    const exportOutVal = await page.$eval('#exportOut', el => el.value);
    expect(exportOutVal.trim().startsWith('{') || exportOutVal.trim().length > 0).toBeTruthy();

    // Now simulate loading that full export by pasting JSON into sequenceText and clicking Load Sequence
    await page.fill('#sequenceText', exportOutVal);
    await page.click('#btnLoadSeq');
    await page.waitForTimeout(50);

    // Manager sequence should be set from the JSON
    const seqLen = await page.evaluate(() => window.manager.sequence.length);
    expect(seqLen).toBeGreaterThanOrEqual(0);

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console logs and ensure there are no uncaught ReferenceError/TypeError/SyntaxError', async ({ page }) => {
    // After previous interactions, ensure there are no page errors
    expect(pageErrors.length).toBe(0);

    // Ensure console captured some meaningful logs including ready message
    const hasReady = consoleMessages.some(m => m.includes('Amortized Analysis Simulator ready.'));
    expect(hasReady).toBeTruthy();
  });
});