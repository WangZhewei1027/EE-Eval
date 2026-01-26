import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c1516e4-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object for the Process Simulator UI
class ProcessSimulatorPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(BASE);
    // ensure initial render settled
    await this.page.waitForSelector('#procName');
  }

  // Designer actions
  async clickNew() { await this.page.click('#newProc'); }
  async clickLoadSample() { await this.page.click('#loadSample'); }
  async setProcName(name) { await this.page.fill('#procName', name); }
  async setStepName(name) { await this.page.fill('#stepName', name); }
  async setStepType(type) { await this.page.selectOption('#stepType', type); }
  async clickAddStep() { await this.page.click('#addStep'); }
  async getStepsCount() {
    return await this.page.$$eval('#stepsList option', opts => opts.length);
  }
  async selectStepByIndex(index) {
    const vals = await this.page.$$eval('#stepsList option', opts => opts.map(o => o.value));
    if (vals[index] === undefined) throw new Error('Step index out of range');
    await this.page.selectOption('#stepsList', vals[index]);
    // selection triggers change handler which shows editor
    await this.page.waitForTimeout(50);
  }
  async getStepEditorDisplay() {
    return await this.page.$eval('#stepEditor', el => el.style.display || '');
  }
  async setEditDuration(ms) { await this.page.fill('#editDuration', String(ms)); }
  async clickSaveStep() { await this.page.click('#saveStep'); }
  async clickDeleteStep() { await this.page.click('#deleteStep'); }

  // Runner actions
  async clickStartRun() { await this.page.click('#startRun'); }
  async clickStartMultiple() { await this.page.click('#startMultiple'); }
  async setStartCount(n) { await this.page.fill('#startCount', String(n)); }
  async clickPauseAll() { await this.page.click('#pauseAll'); }
  async clickResumeAll() { await this.page.click('#resumeAll'); }
  async clickAbortAll() { await this.page.click('#abortAll'); }
  async clickApproveManual() { await this.page.click('#approveManual'); }
  async clickRejectManual() { await this.page.click('#rejectManual'); }
  async clickSelectFirstRun() {
    // click first "Select" button in runs list
    const sel = await this.page.$('text=Select');
    if (!sel) throw new Error('No Select button for runs found');
    await sel.click();
  }
  async getRunsSnapshot() {
    return await this.page.evaluate(() => {
      if (!window.__processSimulator) return null;
      return {
        runs: window.__processSimulator.getRuns().map(r => ({
          id: r.id, status: r.status, paused: r.paused, waitingManual: r.waitingManual.length, tokens: r.tokens.length
        }))
      };
    });
  }

  // Inspector actions
  async setVarKeyVal(k, v) {
    await this.page.fill('#varKey', k);
    await this.page.fill('#varVal', v);
    await this.page.click('#setVar');
  }
  async clickAddWatch(expr) {
    await this.page.fill('#watchExpr', expr);
    await this.page.click('#addWatch');
  }
  async getWatchesText() {
    return await this.page.$$eval('#watches div span', spans => spans.map(s => s.textContent || '').join('\n'));
  }

  // Import using prompt: supply answer via dialog handler in tests
  async clickImportProc() { await this.page.click('#importProc'); }

  // Utilities for logs and internal state
  async getLatestLogs(count = 10) {
    return await this.page.evaluate((c) => {
      if (!window.__processSimulator) return [];
      return window.__processSimulator.getLogs().slice(0, c).map(l => l.toString ? l.toString() : JSON.stringify(l));
    }, count);
  }
  async getInternalRuns() {
    return await this.page.evaluate(() => {
      return window.__processSimulator ? window.__processSimulator.getRuns().map(r => ({
        id: r.id, status: r.status, paused: r.paused, waitingManual: r.waitingManual.length, historyLen: r.history.length
      })) : [];
    });
  }
}

// Test suite
test.describe('Process Simulator — FSM tests (Application ID: 9c1516e4-fa79-11f0-8fe7-a5317bd8e2c6)', () => {
  let page;
  let sim;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    sim = new ProcessSimulatorPage(page);
    await sim.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  // S0_Idle tests: New process and initial render
  test('S0_Idle: initial render and New process triggers resetProcess (renderAll called)', async () => {
    // The page initializes and calls resetProcess() at the end of the script; ensure procName exists.
    const initialProcName = await page.$eval('#procName', el => el.value);
    expect(initialProcName).toBeTruthy();

    // Click New which is wired to resetProcess
    await sim.clickNew();

    // After reset, logs should contain 'Created new process' at top
    const logs = await page.$$eval('#logs div', divs => divs.map(d => d.textContent));
    const found = logs.find(t => t && t.indexOf('Created new process') !== -1);
    expect(found).toBeTruthy();
  });

  // Transition S0 -> S1 via AddStep
  test('S0 -> S1 AddStep: adding a step updates steps list and shows evidence (step added log)', async () => {
    // Ensure no steps initially
    let before = await sim.getStepsCount();
    // Add a step
    await sim.setStepName('Test Step A');
    await sim.setStepType('task');
    await sim.clickAddStep();

    const after = await sim.getStepsCount();
    expect(after).toBeGreaterThan(before);

    // The logs should include "Added step"
    const logs = await page.$$eval('#logs div', divs => divs.map(d => d.textContent || ''));
    expect(logs.some(t => t.includes('Added step'))).toBeTruthy();

    // Select the newly added step to enter Editing Step state (S1_EditingStep)
    await sim.selectStepByIndex(after - 1); // last added
    const display = await sim.getStepEditorDisplay();
    expect(display === 'block' || display === 'block').toBeTruthy(); // stepEditor should be visible
  });

  // S1 -> S2 StartRun
  test('S1 -> S2 StartRun: starting a run creates run and executeRun invoked (Process started evidence)', async () => {
    // Ensure there is at least one step; add one if none
    if ((await sim.getStepsCount()) === 0) {
      await sim.setStepName('RunStep');
      await sim.setStepType('task');
      await sim.clickAddStep();
    }

    // Start a run
    await sim.clickStartRun();

    // Wait for a run to appear in internal runs
    await page.waitForFunction(() => window.__processSimulator && window.__processSimulator.getRuns().length > 0, { timeout: 5000 });

    const runs = await sim.getInternalRuns();
    expect(runs.length).toBeGreaterThan(0);
    // There should be a "Created run" log entry
    const logTexts = await page.$$eval('#logs div', divs => divs.map(d => d.textContent || ''));
    expect(logTexts.some(l => l.includes('Created run'))).toBeTruthy();

    // Wait until a run reaches either running/completed (executeRun processed)
    await page.waitForFunction(() => {
      const rs = window.__processSimulator ? window.__processSimulator.getRuns() : [];
      return rs.some(r => r.status === 'running' || r.status === 'completed' || r.status === 'aborted');
    }, { timeout: 8000 });
  });

  // S2 Running -> S3 Paused via PauseAll and back via ResumeAll
  test('S2 Running -> S3 Paused and back: PauseAll and ResumeAll update run paused state', async () => {
    // Add a long-duration step to reliably observe pause
    await sim.setStepName('LongStep');
    await sim.setStepType('task');
    await sim.clickAddStep();
    const idx = (await sim.getStepsCount()) - 1;
    await sim.selectStepByIndex(idx);
    // Set a long duration so the run is still active when we pause
    await sim.setEditDuration(4000);
    await sim.clickSaveStep();

    // Start run
    await sim.clickStartRun();

    // Wait for run creation
    await page.waitForFunction(() => window.__processSimulator && window.__processSimulator.getRuns().length > 0, { timeout: 3000 });

    // Immediately pause all
    await sim.clickPauseAll();

    // Confirm that at least one run has paused === true
    await page.waitForFunction(() => {
      const rs = window.__processSimulator.getRuns();
      return rs.some(r => r.paused === true);
    }, { timeout: 3000 });

    let internal = await sim.getInternalRuns();
    expect(internal.some(r => r.paused === true)).toBeTruthy();

    // Resume all
    await sim.clickResumeAll();

    await page.waitForFunction(() => {
      const rs = window.__processSimulator.getRuns();
      return rs.some(r => r.paused === false);
    }, { timeout: 3000 });

    internal = await sim.getInternalRuns();
    expect(internal.some(r => r.paused === false)).toBeTruthy();
  });

  // AbortAll transition
  test('AbortAll: aborts all running processes and logs abort', async () => {
    // Ensure at least one run exists
    await sim.setStepName('Abortable');
    await sim.setStepType('task');
    await sim.clickAddStep();
    await sim.clickStartRun();

    await page.waitForFunction(() => window.__processSimulator && window.__processSimulator.getRuns().length > 0, { timeout: 3000 });

    // Trigger abort all
    await sim.clickAbortAll();

    // Confirm a run has status 'aborted'
    await page.waitForFunction(() => {
      const rs = window.__processSimulator.getRuns();
      return rs.some(r => r.status === 'aborted');
    }, { timeout: 3000 });

    const runs = await sim.getInternalRuns();
    expect(runs.some(r => r.status === 'aborted')).toBeTruthy();

    // Confirm logs include 'Aborted all runs'
    const logs = await page.$$eval('#logs div', divs => divs.map(d => d.textContent || ''));
    expect(logs.some(l => l.includes('Aborted all runs'))).toBeTruthy();
  });

  // Manual approval flows: Approve and Reject transitions
  test('Manual approval flow: ApproveManual and RejectManual transition behavior', async () => {
    // Load the sample process which includes a manual step
    await sim.clickLoadSample();

    // Start a run that will eventually reach a manual approval step
    await sim.clickStartRun();

    // Wait until a run reports waitingManual > 0 OR logs show awaiting manual approval
    await page.waitForFunction(() => {
      const rs = window.__processSimulator.getRuns();
      if (!rs || rs.length === 0) return false;
      return rs.some(r => r.waitingManual && r.waitingManual.length > 0) ||
             (window.__processSimulator.getLogs && window.__processSimulator.getLogs().some(l => typeof l.msg === 'string' && l.msg.includes('awaiting manual approval')));
    }, { timeout: 20000 });

    // Select the first run to enable global approve/reject buttons to operate on it
    await sim.clickSelectFirstRun();

    // Ensure that a selected run exists and has waitingManual
    const internalRuns = await sim.getInternalRuns();
    const runWithManual = internalRuns.find(r => r.waitingManual > 0);
    expect(runWithManual).toBeTruthy();

    // Approve manual via global control
    await sim.clickApproveManual();

    // After approval, the selected run should have waitingManual === 0 (or run proceeded)
    await page.waitForFunction(() => {
      const rId = document.getElementById('selectedRunId').value;
      if (!rId) return false;
      const r = window.__processSimulator.getRuns().find(x => x.id === rId);
      return r && r.waitingManual.length === 0;
    }, { timeout: 5000 });

    // Check logs contain approval message
    const logs = await page.$$eval('#logs div', divs => divs.map(d => d.textContent || ''));
    expect(logs.some(l => l.includes('manual approved') || l.includes('manual approved') === false ? l.includes('manual approved') : true || l.includes('manual approved'))).toBeTruthy();

    // For a new run test rejection: start another run and wait for manual again
    await sim.clickStartRun();

    await page.waitForFunction(() => {
      const rs = window.__processSimulator.getRuns();
      return rs.some(r => r.waitingManual && r.waitingManual.length > 0);
    }, { timeout: 20000 });

    // Select the run that is waiting
    // We will click the first Select button again (selectedRunId will change)
    await sim.clickSelectFirstRun();

    // Click Reject
    await sim.clickRejectManual();

    // Confirm that selected run has waitingManual === 0 and that step state is failed for that manual step
    await page.waitForFunction(() => {
      const rId = document.getElementById('selectedRunId').value;
      if (!rId) return false;
      const r = window.__processSimulator.getRuns().find(x => x.id === rId);
      if (!r) return false;
      // check that waitingManual cleared and that some step state is 'failed' (manual rejection marks failed)
      const failed = Object.values(r.stepStates).some(s => s.status === 'failed');
      return r.waitingManual.length === 0 && failed;
    }, { timeout: 5000 });
  });

  // Edge cases: Approve without manual waiting triggers alert; Import invalid JSON triggers alert
  test('Edge cases: clicking approve with no manual waiting shows alert; importing invalid JSON alerts', async () => {
    // Start a run and immediately select it (likely no manual waiting yet)
    await sim.setStepName('EdgeCaseStep');
    await sim.setStepType('task');
    await sim.clickAddStep();
    await sim.clickStartRun();

    await page.waitForFunction(() => window.__processSimulator && window.__processSimulator.getRuns().length > 0, { timeout: 3000 });

    // Select run
    await sim.clickSelectFirstRun();

    // Prepare to capture alert dialogs
    const dialogs = [];
    page.once('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Click approveManual when there is no manual waiting -> should alert 'No manual waiting'
    await sim.clickApproveManual();

    // Wait briefly for dialog to be captured
    await page.waitForTimeout(200);

    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].message.toLowerCase()).toContain('no manual waiting');

    // Now test import invalid JSON: importProc uses prompt, which will be shown as 'dialog' with type 'prompt'
    const dialogMessages = [];
    page.on('dialog', async dialog => {
      // record and handle prompt or subsequent alert
      dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      if (dialog.type() === 'prompt') {
        // respond with invalid JSON
        await dialog.accept('this is not json');
      } else {
        // alert: just accept
        await dialog.accept();
      }
    });

    // Trigger import
    await sim.clickImportProc();

    // Allow handlers to run
    await page.waitForTimeout(500);

    // Check that we saw an invalid JSON alert among dialogs
    const sawInvalidAlert = dialogMessages.some(d => d.type === 'alert' && d.message.toLowerCase().includes('invalid json'));
    expect(sawInvalidAlert).toBeTruthy();
  });

  // Eval/watch errors and script errors: ensure UI surfaces errors and logs mention script errors
  test('Eval/watch and script errors: watch shows ERR and script errors are logged during runs', async () => {
    // Add a watch expression that will throw (referencing undefined property)
    await sim.clickLoadSample();
    // Add a watch that will error (e.g., referencing property of undefined)
    await sim.clickAddWatch('vars.nonexistent.prop'); // safe expression but might throw
    // Wait for renderWatches to update
    await page.waitForTimeout(200);
    const watchesText = await sim.getWatchesText();
    // The watch UI wraps evaluation in try/catch and displays ERR: <message>
    expect(watchesText.toUpperCase()).toContain('ERR');

    // Create a step with a script that throws and then run it to ensure script error is logged
    await sim.setStepName('ScriptThrow');
    await sim.setStepType('task');
    await sim.clickAddStep();
    const idx = (await sim.getStepsCount()) - 1;
    await sim.selectStepByIndex(idx);
    await page.fill('#editScript', 'throw new Error("boom-script");');
    await sim.clickSaveStep();

    // Start a run that will execute that step
    await sim.clickStartRun();

    // Wait for logs to include 'Script error at step' (the code logs script errors)
    await page.waitForFunction(() => {
      const logs = window.__processSimulator.getLogs();
      return logs.some(l => typeof l.msg === 'string' && l.msg.toLowerCase().includes('script error'));
    }, { timeout: 8000 });

    const logTexts = await page.$$eval('#logs div', divs => divs.map(d => d.textContent || ''));
    expect(logTexts.some(t => t.toLowerCase().includes('script error'))).toBeTruthy();
  });

  // Observing page errors: we intentionally trigger a ReferenceError inside the page context to ensure pageerror is captured
  test('Page error observation: unhandled ReferenceError on page is captured by pageerror listener', async () => {
    // Ensure no page errors yet
    expect(pageErrors.length).toBe(0);

    // Execute code in page context that calls an undefined function -> ReferenceError occurs
    // We do not modify the application's code; we simply cause a runtime ReferenceError by invoking a nonexistent function
    await page.evaluate(() => {
      // Intentionally cause a ReferenceError (will be unhandled in page context)
      // eslint-disable-next-line no-undef
      nonExistentFunctionForTestPurpose();
    }).catch(() => {
      // Playwright might surface the evaluation rejection; ignore here because we want to capture pageerror
    });

    // Wait for pageerror event to be recorded
    await page.waitForTimeout(200);
    expect(pageErrors.length).toBeGreaterThan(0);
    // Ensure the error message contains 'nonExistentFunctionForTestPurpose' or 'is not defined'
    const msg = String(pageErrors[0].message || pageErrors[0]);
    expect(msg.toLowerCase()).toContain('nonexistentfunctionfortestpurpose'.toLowerCase() || 'is not defined');
  });

});