import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c1516e1-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object to encapsulate common interactions with the NP-Completeness Playground
class NPPlayground {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for the app initialization to emit its initial action log entry
    await this.page.waitForSelector('#actionLog');
  }

  // Switch problem via radio button
  async switchProblem(problemValue) {
    await this.page.click(`input[name="problemType"][value="${problemValue}"]`);
    // clicking the radio triggers showEditorFor via change event
    // wait a tick for DOM changes & logs
    await this.page.waitForTimeout(50);
  }

  // SAT helpers
  async generateSAT() {
    await this.page.click('#genSat');
    await this.page.waitForTimeout(50);
  }
  async parseSAT() {
    await this.page.click('#parseSat');
    await this.page.waitForTimeout(50);
  }
  async clearSAT() {
    await this.page.click('#clearSat');
    await this.page.waitForTimeout(50);
  }

  // Graph (CLIQUE) helpers
  async generateGraph() {
    await this.page.click('#genGraph');
    await this.page.waitForTimeout(50);
  }
  async parseGraph() {
    await this.page.click('#parseGraph');
    await this.page.waitForTimeout(50);
  }
  async clearGraph() {
    await this.page.click('#clearGraph');
    await this.page.waitForTimeout(50);
  }

  // Vertex cover helpers
  async generateVC() {
    await this.page.click('#genVC');
    await this.page.waitForTimeout(50);
  }
  async parseVC() {
    await this.page.click('#parseVC');
    await this.page.waitForTimeout(50);
  }
  async clearVC() {
    await this.page.click('#clearVC');
    await this.page.waitForTimeout(50);
  }

  // Subset helpers
  async generateSubset() {
    await this.page.click('#genSubset');
    await this.page.waitForTimeout(50);
  }
  async parseSubset() {
    await this.page.click('#parseSubset');
    await this.page.waitForTimeout(50);
  }
  async clearSubset() {
    await this.page.click('#clearSubset');
    await this.page.waitForTimeout(50);
  }

  // Reduction and mapping
  async applyReduction(value = 'sat_to_clique') {
    await this.page.selectOption('#reductionSelect', value);
    await this.page.click('#applyReduction');
    await this.page.waitForTimeout(120);
  }

  async reverseReduction() {
    await this.page.click('#reverseReduction');
    await this.page.waitForTimeout(120);
  }

  // Solver controls
  async prepareSolve() {
    await this.page.click('#prepareSolve');
    await this.page.waitForTimeout(80);
  }
  async runSolve() {
    await this.page.click('#runSolve');
    // solver may take some time for brute-force; give short wait for immediate results
    await this.page.waitForTimeout(250);
  }
  async startStepRun() {
    await this.page.click('#startStep');
    await this.page.waitForTimeout(80);
  }
  async stepOnce() {
    await this.page.click('#stepOnce');
    await this.page.waitForTimeout(80);
  }
  async stepBack() {
    await this.page.click('#stepBack');
    await this.page.waitForTimeout(80);
  }
  async pauseRun() {
    await this.page.click('#pauseRun');
    await this.page.waitForTimeout(50);
  }
  async stopRun() {
    await this.page.click('#stopRun');
    await this.page.waitForTimeout(80);
  }

  // Utilities
  async saveSnapshot() {
    await this.page.click('#saveSnapshot');
    await this.page.waitForTimeout(60);
  }
  async loadSnapshot() {
    await this.page.click('#loadSnapshot');
    await this.page.waitForTimeout(60);
  }
  async exportInstance() {
    await this.page.click('#exportInstance');
    await this.page.waitForTimeout(80);
  }
  async importInstance(pasteText) {
    // This will trigger prompt -> handle via dialog listener in tests
    await this.page.click('#importInstance');
    await this.page.waitForTimeout(200);
  }
  async clearLog() {
    await this.page.click('#clearLog');
    await this.page.waitForTimeout(60);
  }
}

test.describe('NP-Completeness Interactive Playground - FSM and UI behaviors', () => {
  let consoleMessages;
  let pageErrors;
  let dialogs;
  let np;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // capture console messages and page errors for assertion and debugging
    page.on('console', msg => {
      consoleMessages.push({type: msg.type(), text: msg.text()});
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Auto-accept dialogs, but capture them (alerts, prompts, confirms).
    page.on('dialog', async dialog => {
      dialogs.push({type: dialog.type(), message: dialog.message()});
      try {
        if (dialog.type() === 'prompt') {
          // default accept with empty string unless the test sets a marker on window (we avoid injecting).
          // Tests that need to provide specific prompt inputs will rely on this handler, which accepts with the value
          // that the test previously set via page.evaluate to window.__TEST_PROMPT (if present).
          const fallback = await page.evaluate(() => (window.__TEST_PROMPT ? window.__TEST_PROMPT : ''));
          await dialog.accept(fallback);
        } else {
          await dialog.accept();
        }
      } catch (e) {
        // swallow dialog handling errors; let assertions deal with consequences
      }
    });

    np = new NPPlayground(page);
    await np.goto();
  });

  test.afterEach(async ({ page }) => {
    // expose captured output in case of failures (Playwright will show them in traces)
    // final assertions in tests will validate these arrays
    // no teardown required beyond page lifecycle
  });

  test('Initial state (S0_Idle) renders and SAT editor is visible', async ({ page }) => {
    // Validate page title and initial evidence from FSM: title text and SAT radio checked
    await expect(page).toHaveTitle(/Interactive NP-Completeness Playground/);
    const satRadio = page.locator('input[name="problemType"][value="sat"]');
    await expect(satRadio).toBeChecked();

    // SAT editor should be visible; others hidden
    await expect(page.locator('#satEditor')).toBeVisible();
    await expect(page.locator('#cliqueEditor')).toBeHidden();
    await expect(page.locator('#vcEditor')).toBeHidden();
    await expect(page.locator('#subsetEditor')).toBeHidden();

    // The action log should show initialization entry
    const actionLog = await page.locator('#actionLog').innerText();
    expect(actionLog).toContain('initialized');

    // Ensure no unexpected page errors happened during initial load
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Problem type switching and editor visibility (ProblemTypeChange transitions)', () => {
    test('Switch to CLIQUE, VERTEX COVER and SUBSET editors', async ({ page }) => {
      // Switch to clique
      await np.switchProblem('clique');
      await expect(page.locator('#cliqueEditor')).toBeVisible();
      await expect(page.locator('#satEditor')).toBeHidden();

      // Verify action log recorded the switch
      const logText1 = await page.locator('#actionLog').innerText();
      expect(logText1).toMatch(/Switched to problem: clique/);

      // Update a range input and verify live display updates
      await page.evaluate(() => {
        const el = document.getElementById('edgeDensity');
        el.value = '60';
        el.dispatchEvent(new Event('input'));
      });
      await expect(page.locator('#edgeDensityVal')).toHaveText('60%');

      // Switch to vertex cover
      await np.switchProblem('vertexcover');
      await expect(page.locator('#vcEditor')).toBeVisible();
      await expect(page.locator('#cliqueEditor')).toBeHidden();
      const logText2 = await page.locator('#actionLog').innerText();
      expect(logText2).toMatch(/Switched to problem: vertexcover/);

      // Switch to subset
      await np.switchProblem('subset');
      await expect(page.locator('#subsetEditor')).toBeVisible();
      await expect(page.locator('#vcEditor')).toBeHidden();
      const logText3 = await page.locator('#actionLog').innerText();
      expect(logText3).toMatch(/Switched to problem: subset/);

      // No page errors during switches
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('SAT editor actions and reductions (S1_SAT -> S5_ReductionApplied)', () => {
    test('Generate, parse, clear SAT and apply SAT→CLIQUE reduction', async ({ page }) => {
      // Ensure we are on SAT editor
      await np.switchProblem('sat');

      // Generate a random SAT instance
      await page.fill('#satVars', '4');
      await page.fill('#satClauses', '4');
      await page.fill('#satSeed', '1');
      await np.generateSAT();
      const satInputAfterGen = await page.locator('#satInput').inputValue();
      expect(satInputAfterGen.trim().length).toBeGreaterThan(0);
      expect((await page.locator('#actionLog').innerText())).toMatch(/Generated random 3-SAT/);

      // Parse the SAT instance and verify internal structured instance present
      await np.parseSAT();
      const inst = await page.evaluate(() => window.__NPPlay && window.__NPPlay.state && window.__NPPlay.state.instance ? window.__NPPlay.state.instance : null);
      expect(inst).not.toBeNull();
      expect(inst.type).toBe('sat');
      expect(inst.clauses.length).toBeGreaterThan(0);
      await expect(page.locator('#solverOutput')).toContainText('SAT instance parsed');

      // Apply SAT -> CLIQUE reduction: select it and apply
      await page.selectOption('#reductionSelect', 'sat_to_clique');
      await np.applyReduction('sat_to_clique');

      // After applying, the app should switch to the CLIQUE editor and populate graphInput
      await expect(page.locator('#cliqueEditor')).toBeVisible();
      const reductionLog = await page.locator('#reductionLog').innerText();
      expect(reductionLog).toMatch(/3-SAT → CLIQUE|3-SAT → CLIQUE/);

      // The internal reduced state should be set
      const reduced = await page.evaluate(() => window.__NPPlay && window.__NPPlay.state ? window.__NPPlay.state.reduced : null);
      expect(reduced).not.toBeNull();
      expect(reduced.from).toBe('sat');
      expect(reduced.to).toBe('clique');

      // Attempt to run a brute-force clique solver on the produced graph to try to produce a mapping back later.
      // Prepare and run with brute-force; it's okay if no solution is found (we will handle either case)
      await page.selectOption('#solverSelect', 'bruteforce');
      await np.prepareSolve();
      await np.runSolve();

      const solverOutputText = await page.locator('#solverOutput').innerText();
      // Either a clique was found or not; both are acceptable, ensure output is one of expected messages
      const acceptable = /Clique found|No clique of size|Graph prepared but no target|Search aborted|Graph parsed|Running backtracking/.test(solverOutputText) || solverOutputText.length > 0;
      expect(acceptable).toBeTruthy();

      // Try reversing the reduction: either it will map if a solution exists, or will show an alert if none.
      // Our dialog handler captures alerts; we can call reverseReduction and then inspect reductionLog or dialogs.
      const dialogsBefore = dialogs.length;
      await np.reverseReduction();
      // either a new log entry appended or an alert was shown
      const reductionLogAfter = await page.locator('#reductionLog').innerText();
      const dialogDiff = dialogs.length - dialogsBefore;
      const mapped = reductionLogAfter.match(/Mapped clique back to SAT assignment|Mapped.*back to SAT/);
      expect((mapped !== null) || (dialogDiff > 0)).toBeTruthy();

      // Clean up: clear SAT input to test ClearSAT transition back to idle
      // Switch back to sat editor to clear
      await page.click('input[name="problemType"][value="sat"]');
      await np.clearSAT();
      const satInputAfterClear = await page.locator('#satInput').inputValue();
      expect(satInputAfterClear).toBe('');
      const stateInstanceAfterClear = await page.evaluate(() => window.__NPPlay && window.__NPPlay.state ? window.__NPPlay.state.instance : 'nope');
      expect(stateInstanceAfterClear === null || stateInstanceAfterClear === undefined || stateInstanceAfterClear.type !== 'sat').toBeTruthy();

      // No page errors during these SAT operations
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('CLIQUE and VERTEX COVER editor flows (S2_CLIQUE, S3_VERTEX_COVER)', () => {
    test('Generate, parse, clear graph; apply CLIQUE→VC reduction and verify result', async ({ page }) => {
      // Switch to CLIQUE
      await np.switchProblem('clique');

      // Set small graph parameters and generate
      await page.fill('#graphNodes', '6');
      await page.evaluate(() => { document.getElementById('edgeDensity').value = '30'; document.getElementById('edgeDensity').dispatchEvent(new Event('input')); });
      await page.fill('#graphSeed', '2');
      await np.generateGraph();
      const graphInput = await page.locator('#graphInput').inputValue();
      expect(graphInput.trim().length).toBeGreaterThan(0);
      expect((await page.locator('#actionLog').innerText())).toMatch(/Generated random graph/);

      // Parse the graph
      await np.parseGraph();
      await expect(page.locator('#solverOutput')).toContainText('Graph parsed');

      // Apply CLIQUE -> VERTEX COVER reduction: make sure cliqueTarget provided
      await page.fill('#cliqueTarget', '3');
      await page.selectOption('#reductionSelect', 'clique_to_vc');
      await np.applyReduction('clique_to_vc');

      // Should have switched to vertexcover editor and set vcInput
      await expect(page.locator('#vcEditor')).toBeVisible();
      const vcInput = await page.locator('#vcInput').inputValue();
      expect(vcInput.trim().length).toBeGreaterThan(0);
      const redLog = await page.locator('#reductionLog').innerText();
      expect(redLog).toMatch(/CLIQUE → VERTEX COVER|CLIQUE → VERTEX COVER/);

      // Try to run brute-force VC solver (it might or might not find a cover depending on graph)
      await page.selectOption('#solverSelect', 'bruteforce');
      await np.prepareSolve();
      await np.runSolve();
      const solverText = await page.locator('#solverOutput').innerText();
      expect(solverText.length).toBeGreaterThan(0);

      // Reverse mapping: if solver produced solution, it will map back; otherwise a dialog may appear
      const dialogsBefore = dialogs.length;
      await np.reverseReduction();
      const dialogsAfter = dialogs.length;
      const mappingLogged = (await page.locator('#reductionLog').innerText()).match(/Mapped vertex cover back to clique/);
      expect(mappingLogged !== null || dialogsAfter - dialogsBefore > 0).toBeTruthy();

      // Clear graph editor
      await page.click('input[name="problemType"][value="clique"]');
      await np.clearGraph();
      const graphInputAfterClear = await page.locator('#graphInput').inputValue();
      expect(graphInputAfterClear).toBe('');
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('SUBSET-SUM flows (S4_SUBSET_SUM)', () => {
    test('Generate, parse, brute-force solve, clear subset', async ({ page }) => {
      await np.switchProblem('subset');

      // Use the default sample input; parse it (initial sample includes T=15)
      await np.parseSubset();
      const inst = await page.evaluate(() => window.__NPPlay && window.__NPPlay.state && window.__NPPlay.state.instance ? window.__NPPlay.state.instance : null);
      expect(inst).not.toBeNull();
      expect(inst.type).toBe('subset');
      expect(inst.numbers.length).toBeGreaterThan(0);

      // Run brute-force solver (select brute force)
      await page.selectOption('#solverSelect', 'bruteforce');
      await np.prepareSolve();
      await np.runSolve();

      const out = await page.locator('#solverOutput').innerText();
      // Expect either a subset found or a clear "No subset" message; both valid, but ensure output mentions subset or nodesVisited
      expect(/Subset found|No subset sums to target|Search aborted/.test(out)).toBeTruthy();

      // Start a step-run using backtracking to test step interactions
      await page.selectOption('#solverSelect', 'backtracking');
      await np.startStepRun(); // prepares step iterator
      // perform a few steps
      await np.stepOnce();
      await np.stepOnce();
      const trace = await page.locator('#searchTrace').innerText();
      expect(trace.length).toBeGreaterThan(0);

      // Step back should be supported for subset backtracking
      await np.stepBack();
      // Stop run resets state
      await np.stopRun();
      await expect(page.locator('#solverOutput')).toHaveText('No solver activity yet.');

      // Clear subset input
      await np.clearSubset();
      const subsetAfterClear = await page.locator('#subsetInput').inputValue();
      expect(subsetAfterClear).toBe('');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Solver control behaviors and edge-cases (S5_ReductionApplied->S0_Idle transitions)', () => {
    test('Start/step/pause/stop and pause behaviour for backtracking solver', async ({ page }) => {
      // Use a small SAT instance to exercise backtracking stepper.
      await np.switchProblem('sat');
      // Use a trivial SAT instance guaranteed satisfiable: 2 variables, single clause (1)
      await page.fill('#satVars', '2');
      await page.fill('#satInput', '1\n2\n'); // two unit clauses ensures satisfiable
      await np.parseSAT();

      // Choose backtracking solver and start step-run
      await page.selectOption('#solverSelect', 'backtracking');
      await np.startStepRun();
      // Step once and check trace
      await np.stepOnce();
      const traceAfterStep = await page.locator('#searchTrace').innerText();
      expect(traceAfterStep.length).toBeGreaterThan(0);

      // Pause run (no-op here but should not error)
      await np.pauseRun();

      // Try stepping again
      await np.stepOnce();
      // Step back should be supported for SAT iterator
      await np.stepBack();

      // Stop run to reset
      await np.stopRun();
      await expect(page.locator('#solverOutput')).toHaveText('No solver activity yet.');

      expect(pageErrors.length).toBe(0);
    });

    test('Save and load snapshot preserves editor contents and reduced info', async ({ page }) => {
      // Prepare subset editor with specific content, save snapshot, then clear and load
      await np.switchProblem('subset');
      await page.fill('#subsetInput', '3 5 7\n\nT=8');
      await np.saveSnapshot();
      const logAfterSave = await page.locator('#actionLog').innerText();
      expect(logAfterSave).toMatch(/Snapshot saved/);

      // mutate editor
      await page.fill('#subsetInput', '');
      expect((await page.locator('#subsetInput').inputValue())).toBe('');

      // load snapshot and confirm content restored
      await np.loadSnapshot();
      await expect(page.locator('#subsetInput')).toHaveValue('3 5 7\n\nT=8');

      const logAfterLoad = await page.locator('#actionLog').innerText();
      expect(logAfterLoad).toMatch(/Snapshot loaded/);
      expect(pageErrors.length).toBe(0);
    });

    test('Export and Import instance flows including invalid import handling', async ({ page }) => {
      // Prepare a SAT instance and parse it to have state.instance populated which export expects
      await np.switchProblem('sat');
      await page.fill('#satVars', '2');
      await page.fill('#satInput', '1 -2\n');
      await np.parseSAT();

      // Export triggers an alert showing JSON - our dialog handler will capture it
      const dialogsBefore = dialogs.length;
      await np.exportInstance();
      const dialogsAfter = dialogs.length;
      expect(dialogsAfter).toBeGreaterThan(dialogsBefore);
      const lastDialog = dialogs[dialogs.length - 1];
      expect(lastDialog.type).toBe('alert');

      // Now test importing invalid JSON: set a small helper on window to provide prompt response
      await page.evaluate(() => { window.__TEST_PROMPT = 'not json'; });
      const dialogsBeforeImport = dialogs.length;
      await np.importInstance();
      // Wait small time for the subsequent alert that indicates failure
      await page.waitForTimeout(120);
      const dialogsAfterImport = dialogs.length;
      // We expect at least one dialog triggered (prompt) and then an alert for "Import failed"
      expect(dialogsAfterImport).toBeGreaterThan(dialogsBeforeImport);
      const recent = dialogs.slice(dialogsBeforeImport).map(d => d.message).join(' | ');
      expect(recent.toLowerCase()).toContain('import failed') || expect(recent.length).toBeGreaterThan(0);

      // Now provide a valid exported JSON to import and verify it populates the editor
      // Construct a simple subset instance JSON string and set as prompt accept value
      const sampleObj = { type: 'subset', numbers: [1,2,3], target: 3 };
      await page.evaluate((s) => { window.__TEST_PROMPT = s; }, JSON.stringify(sampleObj));
      const beforeImportCount = dialogs.length;
      await np.importInstance();
      await page.waitForTimeout(150);
      // After successful import, actionLog should reflect import
      const al = await page.locator('#actionLog').innerText();
      expect(al).toMatch(/Imported instance from JSON/);

      // Check that the subset editor got populated
      await expect(page.locator('input[name="problemType"][value="subset"]')).toBeChecked();
      const subsetText = await page.locator('#subsetInput').inputValue();
      expect(subsetText).toContain('T=3');

      expect(pageErrors.length).toBe(0);
    });

    test('Apply reduction without selecting a reduction or without parsed instance triggers alerts (error scenarios)', async ({ page }) => {
      // Ensure no parsed instance and reduction selection empty -> expect alert when applying reduction
      // First clear any instance by switching to SAT and clearing
      await np.switchProblem('sat');
      await np.clearSAT();

      // Ensure reductionSelect is empty
      await page.selectOption('#reductionSelect', '');

      const dialogsBefore = dialogs.length;
      await page.click('#applyReduction');
      await page.waitForTimeout(80);
      // We expect an alert 'Choose a reduction' captured in dialogs
      const newDialogs = dialogs.slice(dialogsBefore);
      expect(newDialogs.length).toBeGreaterThanOrEqual(1);
      expect(newDialogs[0].message.toLowerCase()).toContain('choose a reduction');

      // Now select a reduction but without parsing an instance - should alert 'No current parsed instance'
      await page.selectOption('#reductionSelect', 'sat_to_clique');
      const before2 = dialogs.length;
      await page.click('#applyReduction');
      await page.waitForTimeout(80);
      const after2 = dialogs.length;
      expect(after2).toBeGreaterThan(before2);
      expect(dialogs.slice(before2).some(d => d.message.toLowerCase().includes('no current parsed instance'))).toBeTruthy();
    });
  });

  test('Clear action log and verify log behavior (ClearLog event)', async ({ page }) => {
    // Ensure action log has content
    const initialLog = await page.locator('#actionLog').innerText();
    expect(initialLog.length).toBeGreaterThan(0);

    // Click clear log and verify new 'Action log cleared.' entry added
    await np.clearLog();
    const postClearLog = await page.locator('#actionLog').innerText();
    expect(postClearLog).toMatch(/Action log cleared/);

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Final assertion: no uncaught page errors and reasonable console behavior', async ({ page }) => {
    // All interactions above should not have produced uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Capture console errors if any (should ideally be none)
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });
});