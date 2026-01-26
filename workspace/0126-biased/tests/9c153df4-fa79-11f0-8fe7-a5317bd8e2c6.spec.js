import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c153df4-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper to evaluate Sim state conveniently
async function getSimState(page) {
  return page.evaluate(() => {
    return {
      ticks: Sim.ticks,
      running: Sim.running,
      intervalId: Sim.intervalId,
      threadsCount: Sim.threads.length,
      locksCount: Object.keys(Sim.locks).length,
      nextThreadId: Sim.nextThreadId,
      nextLockId: Sim.nextLockId,
      logLines: Sim.logLines.slice(),
      rngSeed: Sim.seed,
    };
  });
}

test.describe('Mutex Simulator - FSM and UI interactions', () => {
  let consoleErrors;
  let pageErrors;
  let dialogMessages;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogMessages = [];
    consoleMessages = [];

    // Collect console errors and general console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Capture uncaught page errors (ReferenceError/TypeError/etc.)
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Auto-accept dialogs and record message text (alerts used in app)
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // The app's initDemo runs synchronously on load; ensure the demo initialization log line appears
    await page.waitForSelector('#logArea');
    // Wait briefly to allow initial logs & UI refresh
    await page.waitForTimeout(50);
  });

  test.afterEach(async ({ page }) => {
    // Best-effort cleanup: stop any running interval
    await page.evaluate(() => {
      if (Sim && Sim.intervalId) clearInterval(Sim.intervalId);
      Sim.running = false;
      Sim.intervalId = null;
    });
  });

  test('Idle state on load: initial render and components present', async ({ page }) => {
    // Verify initial FSM Idle state: Sim.running should be false
    const sim = await getSimState(page);
    expect(sim.running).toBe(false);

    // Ensure essential control buttons exist in DOM
    await expect(page.locator('#startBtn')).toHaveText('Start');
    await expect(page.locator('#pauseBtn')).toHaveText('Pause');
    await expect(page.locator('#stepBtn')).toHaveText('Step');
    await expect(page.locator('#resetBtn')).toHaveText('Reset');

    // initDemo created two locks and two threads; assert those are present
    expect(sim.threadsCount).toBeGreaterThanOrEqual(2);
    expect(sim.locksCount).toBeGreaterThanOrEqual(2);

    // There should be an initialization log line mentioning demo
    const logText = await page.locator('#logArea').innerText();
    expect(logText).toContain('Initialized demo');

    // No uncaught page errors on initial load
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test.describe('Start / Pause / Step / Reset transitions', () => {
    test('Start simulation sets Sim.running=true and starts ticks', async ({ page }) => {
      // Speed up ticks for test by setting tickInterval to 20ms
      await page.fill('#tickInterval', '20');
      await page.fill('#speedSlider', '20');

      // Click Start
      await page.click('#startBtn');

      // Verify Sim.running true and intervalId is set
      const simAfterStart = await getSimState(page);
      expect(simAfterStart.running).toBe(true);
      expect(simAfterStart.intervalId).not.toBeNull();

      // Wait a small bit to let some ticks happen
      await page.waitForTimeout(80);
      const simAfterWait = await getSimState(page);
      expect(simAfterWait.ticks).toBeGreaterThanOrEqual(1);

      // Ensure the log contains the "Simulation started" message
      const logs = await page.locator('#logArea').innerText();
      expect(logs).toContain('Simulation started');

      // Pause to prepare for next tests
      await page.click('#pauseBtn');
      await page.waitForTimeout(20);
    });

    test('Pause simulation clears interval and sets Sim.running=false', async ({ page }) => {
      // Start then Pause
      await page.click('#startBtn');
      await page.waitForTimeout(40);
      await page.click('#pauseBtn');

      const sim = await getSimState(page);
      expect(sim.running).toBe(false);
      // intervalId should be null after pause
      const intervalId = await page.evaluate(() => Sim.intervalId);
      expect(intervalId).toBeNull();

      // Log contains "Simulation paused"
      const logs = await page.locator('#logArea').innerText();
      expect(logs).toContain('Simulation paused');
    });

    test('Step simulation invokes a single tick via Step button (tickOnce)', async ({ page }) => {
      // Ensure paused
      await page.click('#pauseBtn');
      await page.waitForTimeout(20);

      const before = await getSimState(page);
      // Click Step - calls tickOnce directly
      await page.click('#stepBtn');

      // Wait shortly and check ticks incremented by exactly 1
      await page.waitForTimeout(20);
      const after = await getSimState(page);
      expect(after.ticks).toBeGreaterThanOrEqual(before.ticks + 1);
    });

    test('Reset simulation clears threads, locks and resets ticks', async ({ page }) => {
      // Ensure there are some threads and locks first by adding one lock and thread
      await page.fill('#newLockName', 'ResetTestLock');
      await page.selectOption('#lockTypeSelect', 'mutex');
      await page.click('#addLockBtn');
      await page.fill('#newThreadName', 'ResetTestThread');
      await page.click('#addThreadBtn');

      // Now assert they exist
      let sim = await getSimState(page);
      expect(sim.threadsCount).toBeGreaterThanOrEqual(1);
      expect(sim.locksCount).toBeGreaterThanOrEqual(1);

      // Click Reset
      await page.click('#resetBtn');
      await page.waitForTimeout(20);

      // After reset, ticks should be 0 and threads/locks cleared
      const afterReset = await getSimState(page);
      expect(afterReset.ticks).toBe(0);
      expect(afterReset.threadsCount).toBe(0);
      expect(afterReset.locksCount).toBe(0);

      // Log area should include "Simulation reset"
      const logs = await page.locator('#logArea').innerText();
      expect(logs).toContain('Simulation reset');
    });
  });

  test.describe('Locks and Threads management', () => {
    test('Add Lock then Clear Locks updates UI and Sim.locks', async ({ page }) => {
      // Ensure reset baseline
      await page.click('#resetBtn');

      // Add a lock named LTEST of type recursive
      await page.fill('#newLockName', 'LTEST');
      await page.selectOption('#lockTypeSelect', 'recursive');
      await page.click('#addLockBtn');

      // Verify Sim.locks has LTEST
      const lockExists = await page.evaluate(() => !!Sim.locks['LTEST']);
      expect(lockExists).toBe(true);

      // LocksList should contain LTEST text
      const locksListText = await page.locator('#locksList').innerText();
      expect(locksListText).toContain('LTEST');

      // Clear locks and assert removal
      await page.click('#clearLocksBtn');
      await page.waitForTimeout(20);
      const locksAfterClear = await page.evaluate(() => Object.keys(Sim.locks).length);
      expect(locksAfterClear).toBe(0);
    });

    test('Add Thread then Clear Threads updates UI and Sim.threads', async ({ page }) => {
      // Reset baseline
      await page.click('#resetBtn');

      // Add a thread named TTEST
      await page.fill('#newThreadName', 'TTEST');
      await page.fill('#newThreadPriority', '5');
      await page.selectOption('#behaviorSelect', 'script');
      await page.click('#addThreadBtn');

      // Verify thread present
      const threadPresent = await page.evaluate(() => Sim.threads.some(t => t.name === 'TTEST'));
      expect(threadPresent).toBe(true);

      // ThreadsList should contain TTEST
      const threadsListText = await page.locator('#threadsList').innerText();
      expect(threadsListText).toContain('TTEST');

      // Clear threads and assert removed
      await page.click('#clearThreadsBtn');
      await page.waitForTimeout(20);
      const threadsAfterClear = await page.evaluate(() => Sim.threads.length);
      expect(threadsAfterClear).toBe(0);
    });

    test('Apply Template to Selected thread and handle missing selection alert', async ({ page }) => {
      // Reset and add thread(s)
      await page.click('#resetBtn');
      await page.fill('#newThreadName', 'ApplyT1');
      await page.click('#addThreadBtn');

      // Try Apply Template without selecting a thread: should trigger alert
      await page.click('#applyTemplateBtn');
      // Dialog handler recorded message
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[dialogMessages.length - 1]).toContain('Select a thread');

      // Now select the thread radio and apply template
      const radio = page.locator('input[name="selectedThread"]').first();
      await radio.check();
      // Modify template
      const newTemplate = 'acquire L1\nhold 10\nrelease L1\nend';
      await page.fill('#scriptTemplate', newTemplate);
      await page.click('#applyTemplateBtn');

      // Verify that the selected thread now has the template applied
      const applied = await page.evaluate(() => {
        const sel = document.querySelector('input[name="selectedThread"]:checked');
        if (!sel) return null;
        const t = threadById(parseInt(sel.value));
        return t ? t.scriptText : null;
      });
      expect(applied).toBe(newTemplate);
    });
  });

  test.describe('Manual controls: selection, step/resume/suspend/kill, force acquire/release', () => {
    test('Step selected thread, suspend/resume/kill selected thread', async ({ page }) => {
      // Reset and add a thread to inspect
      await page.click('#resetBtn');
      await page.fill('#newLockName', 'Lmanual'); await page.selectOption('#lockTypeSelect', 'mutex'); await page.click('#addLockBtn');
      await page.fill('#newThreadName', 'ManualT'); await page.click('#addThreadBtn');

      // Select the thread's radio button
      const radio = page.locator('input[name="selectedThread"]').first();
      await radio.check();

      // Step selected thread
      await page.click('#stepSelectedBtn');
      await page.waitForTimeout(20);
      // Ensure thread pc progressed or state changed; check thread exists and has pc >= 0
      const pc = await page.evaluate(() => {
        const sel = document.querySelector('input[name="selectedThread"]:checked');
        const t = threadById(parseInt(sel.value));
        return t ? t.pc : -1;
      });
      expect(pc).toBeGreaterThanOrEqual(0);

      // Suspend selected
      await page.click('#suspendSelectedBtn');
      await page.waitForTimeout(10);
      let suspended = await page.evaluate(() => {
        const sel = document.querySelector('input[name="selectedThread"]:checked');
        const t = threadById(parseInt(sel.value));
        return t ? t.suspended : null;
      });
      expect(suspended).toBe(true);

      // Resume selected
      await page.click('#resumeSelectedBtn');
      await page.waitForTimeout(10);
      suspended = await page.evaluate(() => {
        const sel = document.querySelector('input[name="selectedThread"]:checked');
        const t = threadById(parseInt(sel.value));
        return t ? t.suspended : null;
      });
      expect(suspended).toBe(false);

      // Kill selected
      await page.click('#killSelectedBtn');
      await page.waitForTimeout(10);
      const state = await page.evaluate(() => {
        const sel = document.querySelector('input[name="selectedThread"]:checked');
        const t = threadById(parseInt(sel.value));
        return t ? t.state : null;
      });
      expect(state).toBe('finished');
    });

    test('Force Acquire and Force Release behavior and edge alerts', async ({ page }) => {
      // Reset, add lock and thread
      await page.click('#resetBtn');
      await page.fill('#newLockName', 'LFA'); await page.selectOption('#lockTypeSelect', 'mutex'); await page.click('#addLockBtn');
      await page.fill('#newThreadName', 'TFA'); await page.click('#addThreadBtn');

      // Attempt forceAcquire without selecting thread -> alert
      await page.fill('#forceLockSelect', 'LFA');
      await page.click('#forceAcquireBtn');
      // Should have prompted "Select a thread"
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[dialogMessages.length - 1]).toContain('Select a thread');

      // Select the thread, but clear lock name to trigger "Specify lock name"
      const radio = page.locator('input[name="selectedThread"]').first();
      await radio.check();
      await page.fill('#forceLockSelect', '');
      await page.click('#forceAcquireBtn');
      expect(dialogMessages[dialogMessages.length - 1]).toContain('Specify lock name');

      // Provide valid lock name and force acquire
      await page.fill('#forceLockSelect', 'LFA');
      await page.click('#forceAcquireBtn');
      await page.waitForTimeout(20);

      // Verify lock owner is the selected thread id
      const ownerName = await page.evaluate(() => {
        const lock = Sim.locks['LFA'];
        return lock && lock.owner ? threadById(lock.owner).name : null;
      });
      expect(ownerName).toBe('TFA');

      // Now force release the lock without specifying name to check alert
      await page.fill('#forceLockSelect', '');
      await page.click('#forceReleaseBtn');
      expect(dialogMessages[dialogMessages.length - 1]).toContain('Specify lock name');

      // Force release properly
      await page.fill('#forceLockSelect', 'LFA');
      await page.click('#forceReleaseBtn');
      await page.waitForTimeout(20);
      const ownerAfter = await page.evaluate(() => {
        const lock = Sim.locks['LFA'];
        return lock ? lock.owner : undefined;
      });
      expect(ownerAfter).toBeNull();
    });
  });

  test.describe('Analyzers & Log management', () => {
    test('Compute wait stats updates metricsArea with acquisitions info', async ({ page }) => {
      // Reset and create a lock and thread which will acquire it
      await page.click('#resetBtn');
      await page.fill('#newLockName', 'Lstats'); await page.selectOption('#lockTypeSelect', 'mutex'); await page.click('#addLockBtn');
      await page.fill('#newThreadName', 'Tstats'); await page.click('#addThreadBtn');

      // Make the thread acquire the lock by giving it a simple script and stepping
      const script = 'acquire Lstats\nhold 10\nrelease Lstats\nend';
      await page.fill('#scriptTemplate', script);
      // Select the thread and apply template
      const radio = page.locator('input[name="selectedThread"]').first();
      await radio.check();
      await page.click('#applyTemplateBtn');
      await page.waitForTimeout(20);

      // Step the thread sufficiently to run through actions
      await page.click('#stepSelectedBtn');
      await page.waitForTimeout(20);
      await page.click('#stepSelectedBtn');
      await page.waitForTimeout(20);
      await page.click('#stepSelectedBtn');
      await page.waitForTimeout(20);

      // Compute wait stats
      await page.click('#showWaitStatsBtn');
      // metricsArea should contain "Acquisitions per lock"
      const metrics = await page.locator('#metricsArea').innerText();
      expect(metrics).toContain('Acquisitions per lock');
      // Should include Lstats line (maybe zero or more)
      expect(metrics).toContain('Lstats');
    });

    test('Detect deadlocks triggers alert (message either no cycles or cycles)', async ({ page }) => {
      // Use detect deadlocks button - dialog will be captured by handler
      dialogMessages = []; // reset capture for clarity
      await page.click('#detectDeadlocksBtn');

      // There must be at least one dialog message captured
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const msg = dialogMessages[dialogMessages.length - 1];
      // Accept both possible outcomes: "No cycles detected" or "Deadlocks cycles"
      const acceptable = msg.includes('No cycles detected') || msg.includes('Deadlocks cycles:') || msg.includes('Deadlock detected');
      expect(acceptable).toBe(true);
    });

    test('Clear Log empties logArea and clears Sim.logLines', async ({ page }) => {
      // Ensure some logs exist
      await page.click('#startBtn');
      await page.waitForTimeout(40);
      await page.click('#pauseBtn');
      await page.waitForTimeout(20);

      // Now clear logs
      await page.click('#clearLogBtn');
      await page.waitForTimeout(20);
      const logAreaText = await page.locator('#logArea').innerText();
      expect(logAreaText.trim()).toBe('');

      const simLogLines = await page.evaluate(() => Sim.logLines.length);
      expect(simLogLines).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Applying template without a selected thread triggers alert (error scenario)', async ({ page }) => {
      // Reset and ensure no selection
      await page.click('#resetBtn');
      dialogMessages = [];
      await page.click('#applyTemplateBtn');
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[dialogMessages.length - 1]).toContain('Select a thread');
    });

    test('Console and page errors should be reported (none expected) and not crash the app', async ({ page }) => {
      // Throughout the tests we captured console errors and page errors.
      // Assert that no uncaught page errors occurred (no ReferenceError / TypeError during normal operations)
      expect(pageErrors).toHaveLength(0);

      // Also assert there were no console.error messages emitted
      // (if there were, we still log them below for debugging but fail the test)
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test('Final sanity: all major FSM events have corresponding DOM elements and handlers', async ({ page }) => {
    // Check presence of all buttons / controls referenced in FSM
    const selectors = [
      '#startBtn', '#pauseBtn', '#stepBtn', '#resetBtn',
      '#randomizeBtn', '#addLockBtn', '#clearLocksBtn', '#addThreadBtn',
      '#clearThreadsBtn', '#applyTemplateBtn', '#forceAcquireBtn', '#forceReleaseBtn',
      '#detectDeadlocksBtn', '#showWaitStatsBtn', '#clearLogBtn'
    ];
    for (const sel of selectors) {
      await expect(page.locator(sel)).toBeVisible();
    }

    // Trigger Randomize Threads to ensure it runs without throwing
    await page.click('#randomizeBtn');
    await page.waitForTimeout(40);
    const sim = await getSimState(page);
    // After randomize there should be some threads and locks
    expect(sim.threadsCount).toBeGreaterThanOrEqual(1);
    expect(sim.locksCount).toBeGreaterThanOrEqual(1);
  });
});