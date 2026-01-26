import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c153df3-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Deadlock Interactive Simulator - end-to-end', () => {
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  // Setup: before each test load the page, attach listeners for console / errors / dialogs,
  // and perform a full reset to start from a clean state.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console and page errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    // Record any dialogs (alert/confirm) and automatically accept them so flows continue
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      try { await dialog.accept(); } catch (e) { /* ignore acceptance errors */ }
    });

    await page.goto(APP_URL);
    // Ensure we start from a clean slate: full reset (accepting confirm via dialog handler)
    await page.click('#fullResetBtn');
    // Wait briefly for UI to refresh
    await page.waitForTimeout(100);
    // Sanity: after reset SIM should exist and be empty
    const sim = await page.evaluate(() => window.SIM ? { resourcesCount: Object.keys(window.SIM.resources).length, processesCount: Object.keys(window.SIM.processes).length } : null);
    expect(sim).not.toBeNull();
    expect(sim.resourcesCount).toBe(0);
    expect(sim.processesCount).toBe(0);
    // Clear recorded dialogs that happened during reset so tests can assert on dialogs they cause
    dialogMessages = [];
    consoleMessages = [];
    pageErrors = [];
  });

  test.afterEach(async ({ page }) => {
    // Assert there were no uncaught page errors during interactions
    expect(pageErrors.length, 'no uncaught page errors').toBe(0);
  });

  test.describe('Resources UI and actions', () => {
    test('Add, modify, and clear resources', async ({ page }) => {
      // Ensure inputs default values are present
      const resNameVal = await page.$eval('#newResName', el => el.value);
      const resUnitsVal = await page.$eval('#newResUnits', el => el.value);
      expect(resNameVal).toBe('R1');
      expect(resUnitsVal).toBe('1');

      // Add resource using button
      await page.fill('#newResName', 'TestR');
      await page.fill('#newResUnits', '2');
      await page.click('#addResBtn');

      // Wait for table refresh
      await page.waitForSelector('#resTable tbody tr');
      // Assert SIM shows resource with expected totals
      const r = await page.evaluate(() => window.SIM.resources['TestR'] || null);
      expect(r).not.toBeNull();
      expect(r.total).toBe(2);
      expect(r.available).toBe(2);

      // Click increment units button for that resource and verify change
      const incBtn = page.locator('#resTable button.incUnits[data-res="TestR"]');
      await incBtn.click();
      // Wait for DOM update
      await page.waitForTimeout(50);
      const rAfterInc = await page.evaluate(() => window.SIM.resources['TestR']);
      expect(rAfterInc.total).toBe(3);
      expect(rAfterInc.available).toBeGreaterThanOrEqual(0);

      // Try clearing resources - confirm dialog will be auto-accepted
      await page.click('#clearResBtn');
      await page.waitForTimeout(50);
      const afterClear = await page.evaluate(() => Object.keys(window.SIM.resources).length);
      expect(afterClear).toBe(0);

      // Verify log contains expected messages recorded via UI log function
      const logText = await page.$eval('#log', el => el.value);
      expect(logText).toContain('Cleared resources');
    });

    test('Adding resource with empty name triggers alert and no addition', async ({ page }) => {
      dialogMessages = [];
      // Set empty name and try to add
      await page.fill('#newResName', '');
      await page.click('#addResBtn');

      // After click, we expect an alert dialog message captured
      await page.waitForTimeout(50);
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      // The alert message should indicate resource name required
      expect(dialogMessages.some(m => /Resource name required/i.test(m))).toBeTruthy();

      // Ensure no new resource was created
      const count = await page.evaluate(() => Object.keys(window.SIM.resources).length);
      expect(count).toBe(0);
    });
  });

  test.describe('Processes and operations', () => {
    test('Add process, append and clear operations', async ({ page }) => {
      // Add a resource and a process to allow operations to reference resources
      await page.fill('#newResName', 'R_A');
      await page.fill('#newResUnits', '1');
      await page.click('#addResBtn');
      await page.fill('#newProcName', 'P_A');
      await page.fill('#newProcPriority', '5');
      await page.fill('#newProcTimestamp', '10');
      await page.click('#addProcBtn');

      // Verify process exists
      const p = await page.evaluate(() => window.SIM.processes['P_A'] || null);
      expect(p).not.toBeNull();
      expect(p.priority).toBe(5);
      expect(p.ts).toBe(10);
      expect(p.state).toBe('ready');

      // Append a request operation via the UI
      // Ensure opProc select contains the process and select it
      await page.selectOption('#opProc', 'P_A');
      await page.selectOption('#opType', 'request');
      await page.selectOption('#opRes', 'R_A');
      await page.fill('#opUnits', '1');
      await page.click('#addOpBtn');

      // After appending, process ops should include the new op and procOps textarea should reflect it
      const ops = await page.evaluate(() => window.SIM.processes['P_A'].ops.slice());
      expect(ops.length).toBe(1);
      expect(ops[0].type).toBe('request');
      const procOpsText = await page.$eval('#procOps', el => el.value);
      expect(procOpsText).toContain('REQ R_A(1)');

      // Clear ops for selected process and assert cleared
      await page.click('#clearOpsBtn');
      await page.waitForTimeout(50);
      const clearedOps = await page.evaluate(() => window.SIM.processes['P_A'].ops.length);
      expect(clearedOps).toBe(0);
      const logText = await page.$eval('#log', el => el.value);
      expect(logText).toContain('Cleared ops for P_A');
    });

    test('Clear processes triggers confirm and empties process list', async ({ page }) => {
      // Create a process
      await page.fill('#newProcName', 'P_clear');
      await page.click('#addProcBtn');
      let count = await page.evaluate(() => Object.keys(window.SIM.processes).length);
      expect(count).toBe(1);

      // Clear processes - confirm accepted automatically
      await page.click('#clearProcBtn');
      await page.waitForTimeout(50);
      count = await page.evaluate(() => Object.keys(window.SIM.processes).length);
      expect(count).toBe(0);
    });
  });

  test.describe('Simulation scheduling and deadlock detection', () => {
    test('Classic 2x2 scenario reaches waiting state and detect finds deadlock', async ({ page }) => {
      // Use generator to create classic 2x2 deadlock (confirm accepted)
      await page.click('#genClassicBtn');
      // Wait for UI update
      await page.waitForTimeout(100);

      // Verify resources and processes were created
      const simInfo = await page.evaluate(() => ({
        resources: Object.keys(window.SIM.resources),
        processes: Object.keys(window.SIM.processes)
      }));
      expect(simInfo.resources).toContain('R1');
      expect(simInfo.resources).toContain('R2');
      expect(simInfo.processes).toContain('P1');
      expect(simInfo.processes).toContain('P2');

      // Step through the simulation: after 3 steps both processes should be waiting for the second resource (deadlock)
      await page.click('#stepBtn'); // Step 1: both request first resources -> should be granted
      await page.waitForTimeout(50);
      await page.click('#stepBtn'); // Step 2: compute step
      await page.waitForTimeout(50);
      await page.click('#stepBtn'); // Step 3: both request second resource -> will likely wait
      await page.waitForTimeout(100);

      // Check that both processes are in waiting state
      const states = await page.evaluate(() => {
        return {
          P1: window.SIM.processes['P1'] ? window.SIM.processes['P1'].state : null,
          P2: window.SIM.processes['P2'] ? window.SIM.processes['P2'].state : null
        };
      });
      expect(states.P1).toBe('waiting');
      expect(states.P2).toBe('waiting');

      // Click detect deadlocks and capture dialog message (alert)
      dialogMessages = [];
      await page.click('#detectBtn');
      await page.waitForTimeout(100);
      // There should be an alert message indicating deadlocks detected
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const found = dialogMessages.some(m => /Deadlocks detected/i.test(m) || /cycles found/i.test(m));
      expect(found).toBeTruthy();

      // The RAG textarea should contain edges indicating waiting and allocations
      const ragText = await page.$eval('#rag', el => el.value);
      expect(ragText.length).toBeGreaterThan(0);
      expect(ragText).toContain('->');
    });

    test('Run / Pause auto-run starts and stops the simulator', async ({ page }) => {
      // Generate a small scenario to run
      await page.click('#genClassicBtn');
      await page.waitForTimeout(100);

      // Start auto-run
      await page.click('#runBtn');
      // Let it run a little (it uses an interval). Then pause.
      await page.waitForTimeout(300);
      await page.click('#pauseBtn');
      await page.waitForTimeout(50);

      // Verify log shows start and pause
      const log = await page.$eval('#log', el => el.value);
      expect(log).toContain('Auto-run started');
      expect(log).toContain('Auto-run paused');
    });

    test('Banker safe-state check identifies SAFE and NOT SAFE states', async ({ page }) => {
      // Setup: single resource R1 with 2 units, two processes with allocations that should be safe given max claims
      await page.fill('#newResName', 'R_B');
      await page.fill('#newResUnits', '2');
      await page.click('#addResBtn');
      await page.fill('#newProcName', 'P1b');
      await page.click('#addProcBtn');
      await page.fill('#newProcName', 'P2b');
      await page.click('#addProcBtn');

      // Manually allocate 1 unit to P1b and 1 to P2b via manual controls
      await page.selectOption('#manualProc', 'P1b');
      await page.selectOption('#manualRes', 'R_B');
      await page.fill('#manualUnits', '1');
      await page.click('#manualAllocateBtn');
      await page.waitForTimeout(50);

      await page.selectOption('#manualProc', 'P2b');
      await page.selectOption('#manualRes', 'R_B');
      await page.fill('#manualUnits', '1');
      await page.click('#manualAllocateBtn');
      await page.waitForTimeout(50);

      // Provide max claims that make the system safe: P1b max 2, P2b max 1
      dialogMessages = [];
      await page.fill('#maxClaims', '{"P1b":{"R_B":2},"P2b":{"R_B":1}}');
      await page.click('#safeCheckBtn');
      await page.waitForTimeout(50);
      // Expect an alert saying SAFE
      expect(dialogMessages.some(m => /SAFE/i.test(m))).toBeTruthy();

      // Now create an unsafe claim: both claim 2 but only 2 units, both hold 1 => unsafe
      dialogMessages = [];
      await page.fill('#maxClaims', '{"P1b":{"R_B":2},"P2b":{"R_B":2}}');
      await page.click('#safeCheckBtn');
      await page.waitForTimeout(50);
      // Expect an alert saying NOT safe
      expect(dialogMessages.some(m => /NOT safe|NOT SAFE|NOT SAFE/i.test(m))).toBeTruthy();
    }, 20000);
  });

  test.describe('Detection & Recovery actions', () => {
    test('Abort selected process removes held resources and marks aborted', async ({ page }) => {
      // Setup: add resource and process, allocate resource manually
      await page.fill('#newResName', 'R_abort');
      await page.fill('#newResUnits', '1');
      await page.click('#addResBtn');
      await page.fill('#newProcName', 'P_abort');
      await page.click('#addProcBtn');

      // Manual allocate to ensure the process holds something
      await page.selectOption('#manualProc', 'P_abort');
      await page.selectOption('#manualRes', 'R_abort');
      await page.fill('#manualUnits', '1');
      await page.click('#manualAllocateBtn');
      await page.waitForTimeout(50);

      // Ensure abortSelect contains the process; select it
      await page.selectOption('#abortSelect', 'P_abort');
      // Click abort selected - should abort and release held resources
      await page.click('#abortSelectedBtn');
      await page.waitForTimeout(50);

      const pState = await page.evaluate(() => window.SIM.processes['P_abort'] ? window.SIM.processes['P_abort'].state : null);
      expect(pState).toBe('aborted');
      const resourceAllocated = await page.evaluate(() => (window.SIM.resources['R_abort'].allocated['P_abort'] || 0));
      expect(resourceAllocated).toBe(0);
    });

    test('Preempt selected releases held resources and sets processes ready', async ({ page }) => {
      // Setup: 1 resource and 2 processes; give P1 some hold and then preempt it
      await page.fill('#newResName', 'R_pre');
      await page.fill('#newResUnits', '2');
      await page.click('#addResBtn');
      await page.fill('#newProcName', 'P_pre_A');
      await page.click('#addProcBtn');
      await page.fill('#newProcName', 'P_pre_B');
      await page.click('#addProcBtn');

      // Allocate some units to P_pre_A
      await page.selectOption('#manualProc', 'P_pre_A');
      await page.selectOption('#manualRes', 'R_pre');
      await page.fill('#manualUnits', '2');
      await page.click('#manualAllocateBtn');
      await page.waitForTimeout(50);

      // Select P_pre_A in abortSelect and click preemptSelected
      await page.selectOption('#abortSelect', 'P_pre_A');
      await page.click('#preemptSelectedBtn');
      await page.waitForTimeout(50);

      // After preemption, process should be set to 'ready' and hold nothing
      const pState = await page.evaluate(() => window.SIM.processes['P_pre_A'].state);
      const held = await page.evaluate(() => Object.keys(window.SIM.processes['P_pre_A'].held).length === 0);
      expect(pState).toBe('ready');
      expect(held).toBeTruthy();
    });

    test('Release all releases all held resources across processes', async ({ page }) => {
      // Setup: resource and two processes that hold it
      await page.fill('#newResName', 'R_allRel');
      await page.fill('#newResUnits', '2');
      await page.click('#addResBtn');
      await page.fill('#newProcName', 'P_rel_A');
      await page.click('#addProcBtn');
      await page.fill('#newProcName', 'P_rel_B');
      await page.click('#addProcBtn');

      // Allocate 1 to each
      await page.selectOption('#manualProc', 'P_rel_A');
      await page.selectOption('#manualRes', 'R_allRel');
      await page.fill('#manualUnits', '1');
      await page.click('#manualAllocateBtn');
      await page.waitForTimeout(50);

      await page.selectOption('#manualProc', 'P_rel_B');
      await page.selectOption('#manualRes', 'R_allRel');
      await page.fill('#manualUnits', '1');
      await page.click('#manualAllocateBtn');
      await page.waitForTimeout(50);

      // Force release all held resources (confirm auto-accepted)
      await page.click('#releaseAllBtn');
      await page.waitForTimeout(50);

      // Ensure no process holds the resource
      const totalAllocated = await page.evaluate(() => {
        const alloc = window.SIM.resources['R_allRel'].allocated;
        return Object.values(alloc).reduce((a,b)=>a+(b||0),0);
      });
      expect(totalAllocated).toBe(0);
    });
  });

  test.describe('Manual control and reset flows', () => {
    test('Manual allocate, request insertion, release and simulator resets', async ({ page }) => {
      // Create resource and process
      await page.fill('#newResName', 'R_man');
      await page.fill('#newResUnits', '1');
      await page.click('#addResBtn');
      await page.fill('#newProcName', 'P_man');
      await page.click('#addProcBtn');

      // Manual allocate: should be granted immediately
      await page.selectOption('#manualProc', 'P_man');
      await page.selectOption('#manualRes', 'R_man');
      await page.fill('#manualUnits', '1');
      await page.click('#manualAllocateBtn');
      await page.waitForTimeout(50);
      const heldAfterAlloc = await page.evaluate(() => window.SIM.processes['P_man'].held['R_man'] || 0);
      expect(heldAfterAlloc).toBe(1);

      // Manual request: insert immediate request op at current PC (but since process holds resource, request might be for same or other resource)
      await page.fill('#newResName', 'R_man2');
      await page.fill('#newResUnits', '1');
      await page.click('#addResBtn');
      // Use manual request to put request for R_man2 into P_man
      await page.selectOption('#manualProc', 'P_man');
      await page.selectOption('#manualRes', 'R_man2');
      await page.fill('#manualUnits', '1');
      await page.click('#manualRequestBtn');
      await page.waitForTimeout(50);

      // Step to attempt the inserted request
      await page.click('#stepBtn');
      await page.waitForTimeout(50);

      // The P_man should now be waiting (if R_man2 not available) or granted if available
      const pState = await page.evaluate(() => window.SIM.processes['P_man'].state);
      expect(['running', 'waiting', 'finished', 'aborted']).toContain(pState);

      // Manual release the originally held resource
      await page.selectOption('#manualProc', 'P_man');
      await page.selectOption('#manualRes', 'R_man');
      await page.fill('#manualUnits', '1');
      // manualRelease triggers alert if invalid; ensure it works
      await page.click('#manualReleaseBtn');
      await page.waitForTimeout(50);
      const heldAfterRel = await page.evaluate(() => window.SIM.processes['P_man'].held['R_man'] || 0);
      expect(heldAfterRel).toBe(0);

      // Reset simulator state (killAll) should clear allocations but keep definitions
      await page.click('#killAllBtn');
      await page.waitForTimeout(50);
      const resourceCount = await page.evaluate(() => Object.keys(window.SIM.resources).length);
      const processCount = await page.evaluate(() => Object.keys(window.SIM.processes).length);
      expect(resourceCount).toBeGreaterThanOrEqual(1);
      expect(processCount).toBeGreaterThanOrEqual(1);
      // Confirm logs show reset
      const log = await page.$eval('#log', el => el.value);
      expect(log).toContain('Simulator state reset');
    });

    test('Full reset clears everything after confirmation', async ({ page }) => {
      // Create some definitions then full reset
      await page.fill('#newResName', 'R_x');
      await page.click('#addResBtn');
      await page.fill('#newProcName', 'P_x');
      await page.click('#addProcBtn');
      // Now perform full reset (confirm auto-accepted)
      await page.click('#fullResetBtn');
      await page.waitForTimeout(50);

      // Everything should be cleared: resources and processes count zero
      const counts = await page.evaluate(() => ({ r: Object.keys(window.SIM.resources).length, p: Object.keys(window.SIM.processes).length, logLen: window.SIM.logLines.length }));
      expect(counts.r).toBe(0);
      expect(counts.p).toBe(0);
      // Log was cleared by fullReset handler
      expect(counts.logLen).toBe(0);
    });
  });

  test.describe('Edge cases and error flows', () => {
    test('Attempting operations with invalid names triggers alerts', async ({ page }) => {
      dialogMessages = [];
      // Try to manual allocate with invalid proc/res (select remains empty)
      // Ensure selects are empty by performing full reset first
      await page.click('#fullResetBtn');
      await page.waitForTimeout(50);
      // Try manual allocate - should alert 'Invalid proc or res' and be captured
      await page.selectOption('#manualProc', ''); // no-op if empty
      await page.selectOption('#manualRes', '');
      await page.fill('#manualUnits', '1');
      await page.click('#manualAllocateBtn');
      await page.waitForTimeout(50);
      expect(dialogMessages.some(m => /Invalid proc or res/i.test(m) || /Invalid/i.test(m))).toBeTruthy();
    });

    test('No uncaught exceptions emitted during heavy interaction scenario', async ({ page }) => {
      // Perform many interactions: add resources, processes, runs steps, random generator to stress code
      for (let i = 1; i <= 3; i++) {
        await page.fill('#newResName', `StressR${i}`);
        await page.fill('#newResUnits', `${i}`);
        await page.click('#addResBtn');
      }
      for (let j = 1; j <= 3; j++) {
        await page.fill('#newProcName', `StressP${j}`);
        await page.fill('#newProcPriority', `${j}`);
        await page.click('#addProcBtn');
      }
      // Generate random scenario (confirm accepted)
      await page.click('#genRandomBtn');
      await page.waitForTimeout(150);
      // Step a few times
      await page.click('#stepBtn'); await page.waitForTimeout(30);
      await page.click('#stepBtn'); await page.waitForTimeout(30);
      await page.click('#runBtn'); // start auto-run briefly then pause
      await page.waitForTimeout(200);
      await page.click('#pauseBtn');
      // Ensure no uncaught page errors recorded
      expect(pageErrors.length).toBe(0);
    });
  });

  // Final check: ensure we captured console logs that indicate simulator activity during tests
  test('Console and log area show simulator activity', async ({ page }) => {
    // Add a resource and a process to produce log events
    await page.fill('#newResName', 'R_console');
    await page.fill('#newResUnits', '1');
    await page.click('#addResBtn');
    await page.fill('#newProcName', 'P_console');
    await page.click('#addProcBtn');
    await page.click('#stepBtn');
    await page.waitForTimeout(50);

    // There should be log entries in the log textarea
    const logArea = await page.$eval('#log', el => el.value);
    expect(logArea.length).toBeGreaterThan(0);

    // And the console messages captured by Playwright (if any) should not contain uncaught exceptions
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(errorConsoleEntries.length).toBe(0);
  });
});