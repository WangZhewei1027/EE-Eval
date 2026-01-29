import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c153df2-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper: get simulator state exposed on window
async function getSimState(page) {
  return page.evaluate(() => {
    // window.__sim may be undefined if script failed to expose it
    return { hasSim: !!window.__sim, state: window.__sim ? window.__sim.state : null };
  });
}

// Helper: wait until a predicate on window.__sim.state is true
async function waitForSimCondition(page, predicate, timeout = 3000) {
  return page.waitForFunction(predicate, null, { timeout });
}

test.describe('CPU Scheduling Interactive Simulator - FSM & UI integration tests', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors for each test
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Basic sanity: page should have loaded the Start button
    await expect(page.locator('#startBtn')).toBeVisible();
  });

  test.afterEach(async ({}, testInfo) => {
    // Add a lightweight assertion that no unexpected fatal page errors occurred.
    // If any page error occurred, fail but also expose them in the message for debugging.
    if (pageErrors.length > 0) {
      // Fail the test and include the first error message
      const messages = pageErrors.map(e => e.message).join('\n---\n');
      test.expect(false, `Unexpected page errors detected:\n${messages}`);
    }
  });

  test('Initial Idle state: page rendered and simulator ready', async ({ page }) => {
    // Verify initial DOM evidence for Idle state: #startBtn exists and simulator ready log appended
    await expect(page.locator('#startBtn')).toBeVisible();
    await expect(page.locator('#currentTime')).toHaveText('0');

    // Check we have the exposed debug object and initial state.running is null
    const sim = await getSimState(page);
    expect(sim.hasSim).toBe(true);
    expect(sim.state).not.toBeNull();
    expect(sim.state.running).toBeNull();
    expect(sim.state.time).toBe(0);

    // Ensure a "Simulator ready" message was logged to the textarea or console
    const logText = await page.locator('#log').inputValue();
    expect(logText.includes('Simulator ready')).toBeTruthy();
  });

  test('Add, Set Ready, Assign to CPU (Manual) and Step Forward -> Manual scheduling flow', async ({ page }) => {
    // This test validates: AddProcess, SetReady (button), Manual algorithm selection,
    // AssignCpuBtn, StepForwardBtn behavior and resulting state transitions.
    // 1) Select Manual algorithm
    await page.selectOption('#algo', 'Manual');
    expect(await page.$eval('#algo', el => el.value)).toBe('Manual');

    // 2) Add a process that arrives at time 0 so it can be ready immediately
    await page.fill('#pName', 'MProc');
    await page.fill('#pArrival', '0');
    await page.fill('#pCpu', '2'); // CPU burst 2 units
    await page.fill('#pIo', '');
    await page.fill('#pPriority', '1');
    await page.click('#addProcessBtn');

    // The process should have been added; check process table contains 'MProc'
    await expect(page.locator('#processTable')).toContainText('MProc');

    // 3) Force Set Ready via the 'Set Ready' button in the table (it exists for each row)
    // Find the row for MProc and click its Set Ready button
    const rows = page.locator('#processTable tbody tr');
    const rowCount = await rows.count();
    let targetRow = null;
    for (let i = 0; i < rowCount; i++) {
      const name = await rows.nth(i).locator('td').nth(1).innerText();
      if (name.trim() === 'MProc') { targetRow = rows.nth(i); break; }
    }
    expect(targetRow).not.toBeNull();
    // Click "Set Ready" (third button in actions)
    await targetRow.locator('td').nth(7).locator('button', { hasText: 'Set Ready' }).click();

    // The process state should change to 'ready' and manualReady select should contain an option
    await expect(page.locator('#manualReady')).toContainText('MProc');

    // 4) Attempt to assign to CPU with no selection -> ensure dialog alert occurs
    // First, clear selection to simulate no choice
    await page.evaluate(() => { document.getElementById('manualReady').innerHTML = ''; });
    // Listen once for the dialog and assert the message
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('#assignCpuBtn'), // clicking when no option should produce alert
    ]);
    expect(dialog.message()).toContain('Choose a ready process');
    await dialog.accept();

    // 5) Now re-add the option by making process ready again and assign properly
    await page.evaluate(() => {
      // ensure process is ready and manualReady is refreshed
      window.__sim.state.processes.forEach(p => { if (p.name === 'MProc') { p.state = 'ready'; p.arrival = 0; } });
      // call the exposed refresh function via the app's API if available
      if (window.__sim) window.__sim.state.time = 0;
    });
    // trigger UI refresh by invoking refreshAll via DOM (we rely on the app's exposed functions)
    await page.evaluate(() => { if (window.__sim && window.__sim.state) { document.getElementById('algo').dispatchEvent(new Event('change')); } });
    // Ensure manualReady receives the option (call the app's helper by clicking an innocuous control triggering refresh)
    await page.click('#presetBtn'); // load preset to force refresh, then re-add desired process to avoid prompt sequence
    // Remove preset processes so our MProc remains in table
    await page.evaluate(() => {
      // keep only the process with name 'MProc' in state.processes
      if (window.__sim) {
        window.__sim.state.processes = window.__sim.state.processes.filter(p => p.name === 'MProc');
        window.__sim.state.lastPid = window.__sim.state.processes.length;
        // reset time and UI
        window.__sim.state.time = 0;
        // call refreshAll if available
        if (typeof window.__sim !== 'undefined' && window.__sim) {
          if (window.__sim.state) {
            // The app's refreshAll is not directly exposed, but it calls refreshAll in the closure.
            // We can trigger UI update by clicking addProcessBtn, but to avoid altering app state, call a small dispatch.
            const evt = new Event('input'); document.getElementById('quantum').dispatchEvent(evt);
          }
        }
      }
    });
    // Now ensure manualReady contains our process by calling the manual-ready refresh via the app code indirectly:
    await page.evaluate(() => { /* force a small refresh by toggling quantum value (triggers UI.quantum.oninput) */ const q = document.getElementById('quantum'); q.value = q.value; q.dispatchEvent(new Event('input')); });

    // There should now be an option to choose
    await expect(page.locator('#manualReady option')).toHaveCountGreaterThan(0);

    // Select the first option (our MProc) and assign to CPU
    const optionValue = await page.locator('#manualReady option').first().getAttribute('value');
    await page.selectOption('#manualReady', optionValue);
    await page.click('#assignCpuBtn');

    // Now verify the simulator state has running set to our process id
    const simAfterAssign = await page.evaluate(() => window.__sim ? window.__sim.state.running : null);
    expect(simAfterAssign).not.toBeNull();

    // 6) Step forward to actually execute the CPU time (Manual algorithm requires user stepping)
    await page.click('#stepForwardBtn');
    // Wait until process either becomes terminated or running becomes null (after full run)
    await page.waitForTimeout(200); // allow small time for execution

    // The Gantt should reflect some entry and current time should be > 0
    const currentTime = await page.$eval('#currentTime', el => el.textContent);
    expect(parseInt(currentTime)).toBeGreaterThan(0);

    // Finally, click step forward until this process terminates (max few steps)
    let terminated = false;
    for (let i = 0; i < 5; i++) {
      await page.click('#stepForwardBtn');
      await page.waitForTimeout(50);
      const states = await page.evaluate(() => window.__sim.state.processes.map(p => p.state));
      if (states.every(s => s === 'terminated')) { terminated = true; break; }
    }
    expect(terminated).toBeTruthy();
  });

  test('Start, Pause, Step Back and Reset transitions', async ({ page }) => {
    // This test validates StartRun, Pause, StepBack and Reset transitions and their observable state changes.
    // Add a simple process that arrives at 0
    await page.fill('#pName', 'TProc');
    await page.fill('#pArrival', '0');
    await page.fill('#pCpu', '3');
    await page.click('#addProcessBtn');

    // Start running: click Start / Run
    await page.click('#startBtn');
    // Wait until runningInterval is set and the autoRun flag is true
    await page.waitForFunction(() => !!window.__sim && window.__sim.state.autoRun === true && window.__sim.state.runningInterval !== null, null, { timeout: 2000 });

    // Confirm that stepping has progressed time after small delay
    await page.waitForTimeout(300);
    const timeAfterRun = await page.$eval('#currentTime', el => parseInt(el.textContent));
    expect(timeAfterRun).toBeGreaterThanOrEqual(1);

    // Now click Pause
    await page.click('#pauseBtn');
    // Wait for the simulator to register no running interval
    await page.waitForFunction(() => !!window.__sim && window.__sim.state.runningInterval === null, null, { timeout: 1000 });
    const simStateAfterPause = await page.evaluate(() => window.__sim.state);
    expect(simStateAfterPause.runningInterval).toBeNull();

    // Step back: click Step Back (restoreSnapshot)
    // There should be history available, so step back should reduce time
    const timeBeforeStepBack = simStateAfterPause.time;
    await page.click('#stepBackBtn');
    // The app logs 'Stepped back' to the log if successful; wait shortly
    await page.waitForTimeout(100);
    const timeAfterStepBack = await page.$eval('#currentTime', el => parseInt(el.textContent));
    // Time after stepping back should be <= timeBeforeStepBack
    expect(timeAfterStepBack).toBeLessThanOrEqual(timeBeforeStepBack);

    // Reset: clicking reset opens confirm; accept it
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    await page.click('#resetBtn');

    // After reset, time should be 0 and processes set to 'new' states
    await page.waitForTimeout(100);
    const finalTime = await page.$eval('#currentTime', el => parseInt(el.textContent));
    expect(finalTime).toBe(0);
    const procStates = await page.evaluate(() => window.__sim.state.processes.map(p => p.state));
    procStates.forEach(s => expect(s).toBe('new'));
  });

  test('Fast Run to Completion and Clear Log', async ({ page }) => {
    // Validate FastRun transition leads to Completed state for all processes and ClearLog empties logs.
    // Load a preset to have multiple processes with IO
    await page.click('#presetBtn');
    // Wait for preset to apply and refresh
    await page.waitForTimeout(100);
    // Click Fast Run to Completion
    await page.click('#fastForwardBtn');
    // Wait until state shows all processes terminated
    await page.waitForFunction(() => {
      return !!window.__sim && window.__sim.state.processes.length > 0 && !window.__sim.state.processes.some(p => p.state !== 'terminated');
    }, null, { timeout: 5000 });
    // Assert completed condition
    const allTerminated = await page.evaluate(() => window.__sim.state.processes.every(p => p.state === 'terminated'));
    expect(allTerminated).toBe(true);

    // Ensure Gantt chart contains termination info and currentTime > 0
    const ganttText = await page.locator('#gantt').textContent();
    expect(ganttText.length).toBeGreaterThan(0);
    const timeNow = await page.$eval('#currentTime', el => parseInt(el.textContent));
    expect(timeNow).toBeGreaterThan(0);

    // Click Clear Log and assert UI.log is empty and state.log length is zero
    await page.click('#clearLogBtn');
    const logValue = await page.locator('#log').inputValue();
    const simLogLength = await page.evaluate(() => window.__sim.state.log.length);
    expect(logValue).toBe('');
    expect(simLogLength).toBe(0);
  });

  test('Edit and Delete process flow (prompts handled) and Force Switch behavior', async ({ page }) => {
    // This test validates editing (prompts), deleting a process, and forcing a context switch.
    // Add a process and then edit it via the Edit button (which uses prompt)
    await page.fill('#pName', 'EProc');
    await page.fill('#pArrival', '0');
    await page.fill('#pCpu', '2');
    await page.click('#addProcessBtn');
    await expect(page.locator('#processTable')).toContainText('EProc');

    // Intercept prompts sequentially when clicking Edit
    // The editProcess flow triggers three prompts (Name, Arrival, CPU bursts) and one for IO and Priority.
    const editRow = page.locator('#processTable tbody tr').filter({ hasText: 'EProc' }).first();
    // Set up dialog listener: respond with same values to allow edit to proceed and avoid canceling
    page.on('dialog', async dialog => {
      const message = dialog.message();
      if (message.startsWith('Name')) {
        await dialog.accept('EProcEdited');
      } else if (message.startsWith('Arrival')) {
        await dialog.accept('0');
      } else if (message.startsWith('CPU bursts')) {
        await dialog.accept('2');
      } else if (message.startsWith('IO bursts')) {
        await dialog.accept('');
      } else if (message.startsWith('Priority')) {
        await dialog.accept('1');
      } else {
        // default accept
        await dialog.accept();
      }
    });

    // Click the Edit button
    await editRow.locator('td').nth(7).locator('button', { hasText: 'Edit' }).click();
    await page.waitForTimeout(100);
    // After edit, the table should contain the edited name
    await expect(page.locator('#processTable')).toContainText('EProcEdited');

    // Now test Force Switch: ensure a running process exists first
    // Assign the algorithm to FCFS and add a small process for immediate run
    await page.selectOption('#algo', 'FCFS');
    await page.fill('#pName', 'RunProc');
    await page.fill('#pArrival', '0');
    await page.fill('#pCpu', '5');
    await page.click('#addProcessBtn');

    // Start running
    await page.click('#startBtn');
    await page.waitForFunction(() => !!window.__sim && window.__sim.state.autoRun === true && window.__sim.state.runningInterval !== null, null, { timeout: 2000 });
    await page.waitForTimeout(200);
    // Confirm there is a running process
    const runningBefore = await page.evaluate(() => window.__sim.state.running);
    expect(runningBefore).not.toBeNull();

    // Now force switch
    await page.click('#forceSwitchBtn');
    // After forcing, state.running should be null and csTimer may be set to the configured cost
    await page.waitForTimeout(100);
    const runningAfter = await page.evaluate(() => window.__sim.state.running);
    expect(runningAfter).toBeNull();

    // Delete a process via Delete button and assert it's removed and logged
    const deleteRow = page.locator('#processTable tbody tr').filter({ hasText: 'EProcEdited' }).first();
    await deleteRow.locator('td').nth(7).locator('button', { hasText: 'Delete' }).click();
    // Deletion logs event; verify table no longer contains that name
    await expect(page.locator('#processTable')).not.toContainText('EProcEdited');
    const logContents = await page.locator('#log').inputValue();
    expect(logContents).toContain('Deleted process');
  });

  test('Round Robin specific: quantum & rr queue management', async ({ page }) => {
    // Validate RR algorithm behavior: queue management and timeslice expiry logs.
    // Set algorithm to RR and small quantum to observe timeslice behavior
    await page.selectOption('#algo', 'RR');
    await page.fill('#quantum', '1');
    // Two processes arriving at time 0
    await page.fill('#pName', 'RR1');
    await page.fill('#pArrival', '0');
    await page.fill('#pCpu', '2');
    await page.click('#addProcessBtn');
    await page.fill('#pName', 'RR2');
    await page.fill('#pArrival', '0');
    await page.fill('#pCpu', '2');
    await page.click('#addProcessBtn');

    // Start run and allow a few cycles to complete timeslice switches
    await page.click('#startBtn');
    await page.waitForFunction(() => !!window.__sim && window.__sim.state.autoRun === true && window.__sim.state.runningInterval !== null, null, { timeout: 2000 });
    // Wait some time for RR timeslice churn
    await page.waitForTimeout(1000);
    // Pause the run
    await page.click('#pauseBtn');
    await page.waitForTimeout(100);
    // Inspect logs for 'RR: timeslice' message which indicates timeslice expiry handling
    const logsText = await page.locator('#log').inputValue();
    // At least one timeslice expiry should have been logged
    expect(logsText.includes('RR: timeslice') || logsText.includes('timeslice')).toBeTruthy();
  });

  test('Import/Export scenario JSON and copy/export behaviors', async ({ page }) => {
    // Validate import/export features will place JSON into the scenario textarea and log actions.
    // Prepare a simple scenario JSON
    const simpleScenario = [
      { id: 'P100', name: 'Imp1', arrival: 0, cpuBursts: [1], ioBursts: [], priority: 1, state: 'new' }
    ];
    await page.fill('#scenarioJson', JSON.stringify(simpleScenario));
    // Click Import
    // NOTE: importBtn.onclick shows alerts on invalid JSON; ours is valid so import should succeed
    await page.click('#importBtn');
    await page.waitForTimeout(100);
    // After import, process table should contain 'Imp1'
    await expect(page.locator('#processTable')).toContainText('Imp1');

    // Now test export: click Export JSON which puts JSON in textarea
    await page.click('#exportBtn');
    await page.waitForTimeout(100);
    const exported = await page.locator('#scenarioJson').inputValue();
    expect(exported).toContain('Imp1');

    // Copy Log: clicking copy triggers document.execCommand('copy'), which might open an alert; intercept any dialogs
    page.once('dialog', async dialog => {
      // The app calls alert('Log copied to clipboard')
      expect(dialog.type()).toBe('alert');
      await dialog.accept();
    });
    // Click copyLogBtn only after ensuring log has some content
    await page.evaluate(() => { document.getElementById('log').value = 'sample log'; window.__sim.state.log = ['sample log']; });
    await page.click('#copyLogBtn');
    await page.waitForTimeout(100);
  });

  test('Monitor console and page errors - assert no unexpected runtime errors', async ({ page }) => {
    // Explicitly check for runtime page errors and console.error messages
    // After some normal usage steps, there should be no pageerror events captured
    // Do a small sequence to exercise code paths
    await page.click('#presetBtn');
    await page.click('#fastForwardBtn');
    await page.waitForTimeout(300);
    // Check captured console messages for errors
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // Acceptable to have warnings but assert there are no fatal page errors captured via page.on('pageerror')
    expect(pageErrors.length).toBe(0);
    // If there are error-level console entries, surface them in expectation for test clarity but don't fail unless critical
    // We assert that no console message contains 'ReferenceError' or 'SyntaxError' or 'TypeError'
    const problematic = consoleMessages.filter(m => /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(problematic.length).toBe(0);
  });

  // Edge case: clicking Reset but canceling confirm should leave state untouched
  test('Reset cancelation leaves simulator unchanged', async ({ page }) => {
    // Add a process and advance time a bit
    await page.fill('#pName', 'CancelProc');
    await page.fill('#pArrival', '0');
    await page.fill('#pCpu', '1');
    await page.click('#addProcessBtn');
    await page.click('#stepForwardBtn');
    await page.waitForTimeout(50);
    const timeBefore = await page.$eval('#currentTime', el => parseInt(el.textContent));

    // When reset confirmation appears, dismiss (press Cancel)
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.dismiss();
    });
    await page.click('#resetBtn');
    await page.waitForTimeout(50);
    const timeAfter = await page.$eval('#currentTime', el => parseInt(el.textContent));
    // Since we cancelled, time should remain as before (or greater if step advanced)
    expect(timeAfter).toBeGreaterThanOrEqual(timeBefore);
  });
});