import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e93437c0-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Dijkstra Visualizer — FSM states and UI interactions', () => {
  // We'll capture console messages and page errors for each test run.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      // normalize text and type
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught exceptions emitted by the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Auto-accept alerts/confirms so the page's dialogs do not block tests.
    page.on('dialog', async dialog => {
      // Accept everything so confirm/alert do not block scripts.
      try {
        await dialog.accept();
      } catch (e) {
        // ignore
      }
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure canvas has been sized and initial draw called by waiting a short time.
    await page.waitForTimeout(200);
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity on console and page errors: record them (tests will assert expectations explicitly)
    // Add a small wait to allow any pending client-side timers to emit errors, if any.
    await page.waitForTimeout(50);
  });

  test('Initial state S0_Idle: page loads with seeded graph and Idle status', async ({ page }) => {
    // Validate that the UI reports Idle (S0_Idle entry action resetAlgorithm was called)
    const status = await page.locator('#status-text').innerText();
    expect(status.trim()).toBe('Idle');

    // seedDemo in the app sets start and target; verify these reflect in the UI
    const start = await page.locator('#start-node').innerText();
    const target = await page.locator('#target-node').innerText();
    expect(start.trim()).toBe('1');
    expect(target.trim()).toBe('3');

    // Adj box should not be empty (seedDemo created adjacency entries)
    const adjText = await page.locator('#adj-box').innerText();
    expect(adjText.trim().length).toBeGreaterThan(0);
    // Confirm adjacency contains node '1' and '3' entries
    expect(adjText).toContain('1 :');
    expect(adjText).toContain('3 :');

    // Priority queue box should show an empty queue after resetAlgorithm was called by seedDemo
    const pqText = await page.locator('#pq-box').innerText();
    // It may show '[]' for no algorithm started
    expect(pqText.trim()).toBe('[]');

    // Ensure no uncaught page errors were reported during load
    expect(pageErrors.length).toBe(0);
    // No console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Add Node and Add Edge events: S0 -> graph updates', async ({ page }) => {
    // Click "Add Node" mode to ensure mode is active
    await page.locator('#mode-add-node').click();
    await page.waitForTimeout(50);

    // Click on canvas to add a new node; coordinates chosen in top-left area
    const canvas = page.locator('#c');
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(150);

    // After adding, adjacency box should contain the new node id '6' (seed had 1..5)
    const adjTextAfterNode = await page.locator('#adj-box').innerText();
    expect(adjTextAfterNode).toContain('6 :');

    // Switch to Add Edge mode
    await page.locator('#mode-add-edge').click();
    await page.waitForTimeout(50);

    // Click first endpoint (the new node at ~50,50) then the seeded node 1 at ~120,120
    await canvas.click({ position: { x: 50, y: 50 } });   // select source for edge
    await page.waitForTimeout(80);
    await canvas.click({ position: { x: 120, y: 120 } }); // select target for edge
    await page.waitForTimeout(200);

    // The adjacency representation should now show the new edge
    const adjTextAfterEdge = await page.locator('#adj-box').innerText();
    // Because edges are undirected by default, node 6 should list neighbor 1 with weight (1)
    expect(adjTextAfterEdge).toContain('6 :');
    expect(adjTextAfterEdge).toMatch(/6\s*:\s*.*1\(/); // simple check that 1 appears as neighbor for 6 or vice-versa
    // Also node 1's line should now include a reference to 6
    expect(adjTextAfterEdge).toContain('1 :');

    // Verify no page errors occurred during these interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Set Start and Target nodes using buttons: transitions reflected in UI', async ({ page }) => {
    const canvas = page.locator('#c');

    // Set start node to the node we added earlier (id 6 at ~50,50)
    await page.locator('#set-start').click();
    await page.waitForTimeout(50);
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(150);

    const startSpan = await page.locator('#start-node').innerText();
    expect(startSpan.trim()).toBe('6');

    // Setting start triggers resetAlgorithm() in the code path, so status should be Idle
    const statusAfterStart = await page.locator('#status-text').innerText();
    expect(statusAfterStart.trim()).toBe('Idle');

    // Now set the target to seeded node '3' near (520,120)
    await page.locator('#set-target').click();
    await page.waitForTimeout(50);
    await canvas.click({ position: { x: 520, y: 120 } });
    await page.waitForTimeout(150);

    const targetSpan = await page.locator('#target-node').innerText();
    expect(targetSpan.trim()).toBe('3');

    // Verify no page errors or console errors during these operations
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Initialize, Step, Run, Pause transitions (S0 -> S1 -> S2 -> S3)', async ({ page }) => {
    // Initialize Dijkstra (S0 -> S1)
    await page.locator('#init-run').click();
    // initDijkstra sets status to 'Initialized'
    await page.waitForTimeout(150);
    const initializedStatus = await page.locator('#status-text').innerText();
    expect(initializedStatus.trim()).toBe('Initialized');

    // After initialization: pause button should be disabled, step and run enabled
    const pauseDisabled = await page.locator('#pause-btn').isDisabled();
    expect(pauseDisabled).toBe(true);
    const runDisabledBefore = await page.locator('#run-btn').isDisabled();
    // run is typically enabled right after init
    expect(runDisabledBefore).toBe(false);

    // Perform one step to exercise StepDijkstra (S2 may be entered when running/processing)
    await page.locator('#step-btn').click();
    await page.waitForTimeout(250);
    const statusAfterStep = await page.locator('#status-text').innerText();
    // The status should have changed from 'Initialized' — either 'Processing node X' or 'Finished'
    expect(['Initialized', 'Idle']).not.toContain(statusAfterStep.trim());

    // Now click Run to auto-run; this should disable Run button and enable Pause
    await page.locator('#run-btn').click();
    await page.waitForTimeout(200); // give it a bit to start interval-step
    const runDisabled = await page.locator('#run-btn').isDisabled();
    const pauseEnabled = !(await page.locator('#pause-btn').isDisabled());
    expect(runDisabled).toBe(true);
    expect(pauseEnabled).toBe(true);

    // Wait until we observe "Processing" in status or until finished; run should be making progress.
    let observedProcessing = false;
    for (let i = 0; i < 8; i++) {
      const st = (await page.locator('#status-text').innerText()).trim();
      if (st.toLowerCase().includes('processing') || st.toLowerCase().includes('finished')) {
        observedProcessing = true;
        break;
      }
      await page.waitForTimeout(250);
    }
    expect(observedProcessing).toBe(true);

    // Pause the auto-run (PauseDijkstra transition)
    await page.locator('#pause-btn').click();
    await page.waitForTimeout(100);
    // After pause, Run should be enabled again
    const runEnabledAfterPause = !(await page.locator('#run-btn').isDisabled());
    const pauseDisabledAfter = await page.locator('#pause-btn').isDisabled();
    expect(runEnabledAfterPause).toBe(true);
    expect(pauseDisabledAfter).toBe(true);

    // Now systematically Step until finished (S2_Running -> S3_Finished via StepDijkstra)
    let finishedObserved = false;
    for (let i = 0; i < 20; i++) {
      await page.locator('#step-btn').click();
      await page.waitForTimeout(120);
      const st = (await page.locator('#status-text').innerText()).trim().toLowerCase();
      if (st.includes('finished')) {
        finishedObserved = true;
        break;
      }
    }
    expect(finishedObserved).toBe(true);

    // When finished, statusText should include 'Finished'
    const finalStatus = (await page.locator('#status-text').innerText()).trim();
    expect(finalStatus.toLowerCase()).toContain('finished');

    // Ensure no uncaught page errors and no console errors during algorithm run
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ResetAlgorithm event: clicking Reset returns to Idle (S3 -> S0) and dialog handled', async ({ page }) => {
    // At this point the app may be Finished from previous interactions; ensure we are in a known state by initializing then stepping to finished quickly.
    // But for this test we simply click Reset and rely on our dialog handler to accept.
    await page.locator('#reset-btn').click();
    // The dialog is auto-accepted by the beforeEach handler; after resetAlgorithm executes, status should be 'Idle'
    await page.waitForTimeout(120);
    const statusAfterReset = (await page.locator('#status-text').innerText()).trim();
    expect(statusAfterReset).toBe('Idle');

    // PQ should show an empty '[]' after reset
    const pqAfterReset = await page.locator('#pq-box').innerText();
    expect(pqAfterReset.trim()).toBe('[]');

    // Also check that step and run are enabled after reset
    expect(await page.locator('#step-btn').isDisabled()).toBe(false);
    expect(await page.locator('#run-btn').isDisabled()).toBe(false);

    // Confirm no page errors and no console errors occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Delete node and edge via Delete mode (edge-case interaction)', async ({ page }) => {
    const canvas = page.locator('#c');

    // Switch to Delete mode
    await page.locator('#mode-delete').click();
    await page.waitForTimeout(50);

    // Attempt to delete the node we added earlier at ~50,50 (id 6)
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(200);

    // Verify adj-box no longer lists node '6'
    const adjTextPostDelete = await page.locator('#adj-box').innerText();
    expect(adjTextPostDelete).not.toContain('6 :');

    // Also make sure no page errors were produced by deletion logic
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: collect console output and page errors (no errors expected)', async ({ page }) => {
    // Report summary of captured messages (assert none are fatal)
    // There should be no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // There should be no console.error invocations logged
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);

    // We still expect some informative logs possibly; assert we captured console messages array
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});