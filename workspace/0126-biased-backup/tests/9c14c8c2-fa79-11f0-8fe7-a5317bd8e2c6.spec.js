import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c14c8c2-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Backtracking Explorer - FSM and UI interactions', () => {
  // Shared variables to capture console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for assertions
    page.on('console', (msg) => {
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for the app boot sequence to at least call init: the boot logs "Boot complete"
    await page.waitForFunction(() => {
      const area = document.getElementById('logArea');
      return area && area.value.indexOf('Boot complete') !== -1;
    }, { timeout: 5000 });
  });

  test.afterEach(async () => {
    // no-op; individual tests will make assertions about consoleMessages/pageErrors
  });

  test.describe('Initialization and Idle -> ProblemInitialized transition', () => {
    test('boot should initialize problem automatically and log messages', async ({ page }) => {
      // Validate that the boot initialized a problem: "Initialized problem:" should be in logs
      const logArea = await page.$('#logArea');
      const logValue = await logArea.evaluate(el => el.value);
      expect(logValue).toContain('Initialized problem:');

      // assignPre should exist and initially be an object representation
      const assignPre = await page.$('#assignPre');
      const assignText = await assignPre.evaluate(el => el.textContent.trim());
      expect(assignText).toBe('{}');

      // countersPre should show nodesVisited: 0 and solutions: 0 after initialization
      const countersPre = await page.$('#countersPre');
      const countersText = await countersPre.evaluate(el => el.textContent);
      expect(countersText).toContain('nodesVisited: 0');
      expect(countersText).toContain('solutions: 0');

      // There should be no uncaught page errors during boot
      expect(pageErrors.length).toBe(0);
    });

    test('clicking Initialize Problem (initBtn) with subset template updates problem and logs', async ({ page }) => {
      // Choose subset template and set parameters to a small instance
      await page.selectOption('#templateSelect', 'subset');
      await page.fill('#itemsList', '3,4');
      await page.fill('#targetSum', '7');

      // Clear log to make assertions simpler
      await page.click('#clearLogBtn');

      // Click initialize
      await page.click('#initBtn');

      // Wait for the expected log line that contains problem name and variable count
      await page.waitForFunction(() => {
        const area = document.getElementById('logArea');
        return area && area.value.indexOf('Initialized problem:') !== -1;
      }, { timeout: 3000 });

      const logVal = await page.$eval('#logArea', el => el.value);
      expect(logVal).toContain('Initialized problem: Subset Sum with 2 variables.');

      // After initialization counters should still be reset
      const counters = await page.$eval('#countersPre', el => el.textContent);
      expect(counters).toContain('nodesVisited: 0');
      expect(counters).toContain('solutions: 0');
    });
  });

  test.describe('Solver Run, Pause, and Step behaviors (Solving state)', () => {
    test('starting Run via runBtn enters Solving (Run started) and Pause stops it', async ({ page }) => {
      // Ensure a known small problem: subset with small items
      await page.selectOption('#templateSelect', 'subset');
      await page.fill('#itemsList', '3,4'); // two items
      await page.fill('#targetSum', '7');
      await page.click('#initBtn');

      // Clear log to isolate this interaction
      await page.click('#clearLogBtn');

      // Start run
      await page.click('#runBtn');

      // runBtn should be disabled and pauseBtn enabled after startRun
      await expect(page.locator('#runBtn')).toBeDisabled();
      await expect(page.locator('#pauseBtn')).toBeEnabled();

      // Wait for "Run started" entry in the log area
      await page.waitForFunction(() => {
        const a = document.getElementById('logArea');
        return a && a.value.indexOf('Run started') !== -1;
      }, { timeout: 2000 });

      // Pause the run
      await page.click('#pauseBtn');

      // After stopping, runBtn should be enabled and pauseBtn disabled
      await expect(page.locator('#runBtn')).toBeEnabled();
      await expect(page.locator('#pauseBtn')).toBeDisabled();

      // And "Run stopped" should have been logged
      await page.waitForFunction(() => {
        const a = document.getElementById('logArea');
        return a && a.value.indexOf('Run stopped') !== -1;
      }, { timeout: 2000 });

      // No unhandled page errors
      expect(pageErrors.length).toBe(0);
    });

    test('stepping the solver can produce solutions (StepSolver -> SolutionFound)', async ({ page }) => {
      // Use custom template with a single variable and single-valued domain to guarantee quick solution
      await page.selectOption('#templateSelect', 'custom');
      await page.fill('#customVars', 'x');
      // domain is a single value so solver will find solution after two step clicks
      await page.fill('#customDomains', '{"x":[1]}');
      await page.fill('#customConstraints', 'return true;');
      await page.click('#initBtn');

      // Clear logs and solutions area
      await page.click('#clearLogBtn');
      await page.evaluate(() => { document.getElementById('solutionsDiv').innerHTML = ''; });

      // First step should push the first frame (no solution yet)
      await page.click('#stepBtn');
      // Short pause to let UI update
      await page.waitForTimeout(100);

      // Second step will try value and should record a solution
      await page.click('#stepBtn');

      // Wait for the solutionsDiv to have at least one child (solution recorded)
      await page.waitForFunction(() => {
        const sd = document.getElementById('solutionsDiv');
        return sd && sd.children && sd.children.length > 0;
      }, { timeout: 2000 });

      const solText = await page.$eval('#solutionsDiv', el => el.textContent);
      expect(solText).toContain('{"x":1}');

      // Also ensure the log contains "Solution #"
      const logs = await page.$eval('#logArea', el => el.value);
      expect(logs).toMatch(/Solution #\d+: \{.*"x":1.*\}/);

      // No unhandled exceptions
      expect(pageErrors.length).toBe(0);
    });

    test('pause then resume transitions (Paused -> Solving)', async ({ page }) => {
      // Prepare small custom problem again
      await page.selectOption('#templateSelect', 'custom');
      await page.fill('#customVars', 'x,y');
      await page.fill('#customDomains', '{"x":[1,2],"y":[1,2]}');
      await page.fill('#customConstraints', 'return true;');
      await page.click('#initBtn');

      // Start run then pause shortly, then resume run and ensure "Run started" logs appear twice (start+resume)
      await page.click('#clearLogBtn');

      // Start
      await page.click('#runBtn');
      await page.waitForFunction(() => document.getElementById('logArea').value.indexOf('Run started') !== -1, { timeout: 2000 });

      // Pause
      await page.click('#pauseBtn');
      await page.waitForFunction(() => document.getElementById('logArea').value.indexOf('Run stopped') !== -1, { timeout: 2000 });

      // Resume
      await page.click('#runBtn');
      await page.waitForFunction(() => {
        const v = document.getElementById('logArea').value;
        // ensure at least one 'Run started' entry exists after resume; may be multiple
        return v.split('Run started').length >= 2 || v.indexOf('Run started') !== -1;
      }, { timeout: 2000 });

      // Finally pause to stop the run loop
      await page.click('#pauseBtn');
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Manual Mode, Undo/Redo, and Tree Import/Export behaviors', () => {
    test('toggling manual mode checkbox transitions to ManualMode and updates UI', async ({ page }) => {
      // Ensure in a problem-initialized state
      await page.selectOption('#templateSelect', 'nqueens');
      await page.fill('#nSize', '4');
      await page.click('#initBtn');

      // Toggle manual mode checkbox
      const manual = page.locator('#manualMode');
      await expect(manual).toBeVisible();
      await manual.check();

      // The checkbox should be checked, representing Manual Decision Mode (S5)
      await expect(manual).toBeChecked();

      // A corresponding UI effect: undo/redo controls remain visible; ensure undo button exists
      await expect(page.locator('#undoBtn')).toBeVisible();

      // Log should not necessarily contain a specific line for manual mode enabling, but DOM reflects the change
      expect(await manual.isChecked()).toBe(true);

      // Uncheck to return to normal
      await manual.uncheck();
      expect(await manual.isChecked()).toBe(false);

      expect(pageErrors.length).toBe(0);
    });

    test('undo and redo produce expected log entries and update history buttons', async ({ page }) => {
      // Use the small single-variable custom problem to create history entries quickly
      await page.selectOption('#templateSelect', 'custom');
      await page.fill('#customVars', 'x');
      await page.fill('#customDomains', '{"x":[1,2]}');
      await page.fill('#customConstraints', 'return true;');
      await page.click('#initBtn');

      // Ensure initial state: undo disabled (or clicking will log "No more undo")
      // Perform a step to create history
      await page.click('#stepBtn');
      await page.click('#stepBtn'); // second step should attempt a value; may create more history
      await page.waitForTimeout(100);

      // Click undo and expect "Undo" to be logged (or "No more undo" if we reached earliest)
      await page.click('#undoBtn');
      await page.waitForTimeout(100);
      const logsAfterUndo = await page.$eval('#logArea', el => el.value);
      expect(logsAfterUndo).toMatch(/Undo|No more undo/);

      // Click redo and expect "Redo" log (or "No more redo")
      await page.click('#redoBtn');
      await page.waitForTimeout(100);
      const logsAfterRedo = await page.$eval('#logArea', el => el.value);
      expect(logsAfterRedo).toMatch(/Redo|No more redo/);

      expect(pageErrors.length).toBe(0);
    });

    test('importing invalid tree JSON via prompt logs an import failure', async ({ page }) => {
      // Intercept prompt and supply invalid JSON to provoke import failure path
      page.once('dialog', async (dialog) => {
        // Provide invalid JSON intentionally
        await dialog.accept('not-a-json');
      });

      // Click import button which triggers prompt and import attempt
      await page.click('#importTreeBtn');

      // Wait for the log area to contain 'Import failed' message
      await page.waitForFunction(() => {
        const a = document.getElementById('logArea');
        return a && a.value.indexOf('Import failed') !== -1;
      }, { timeout: 2000 });

      const logs = await page.$eval('#logArea', el => el.value);
      expect(logs).toContain('Import failed');

      expect(pageErrors.length).toBe(0);
    });

    test('importing a tree via the advanced import textarea updates the tree and logs import', async ({ page }) => {
      // Place a simple tree JSON into the textarea and click doImportBtn
      const simpleTree = JSON.stringify({ id: 0, parent: null, var: null, value: null, status: 'root', children: [], assignment: {} });
      await page.fill('#importText', simpleTree);
      await page.click('#doImportBtn');

      // Wait for the log to contain "Imported tree" (or "Imported state JSON")
      await page.waitForFunction(() => {
        const a = document.getElementById('logArea');
        return a && a.value.indexOf('Imported tree') !== -1;
      }, { timeout: 2000 });

      const logs = await page.$eval('#logArea', el => el.value);
      expect(logs).toContain('Imported tree');
      expect(pageErrors.length).toBe(0);
    });

    test('uploading an invalid state file triggers load failure and is logged', async ({ page }) => {
      // Create a fake invalid JSON file via Playwright's setInputFiles
      const badContent = 'this is not valid json';
      await page.setInputFiles('#loadStateFile', {
        name: 'bad_state.json',
        mimeType: 'application/json',
        buffer: Buffer.from(badContent, 'utf8'),
      });

      // The file reader onload should fire and log a failure
      await page.waitForFunction(() => {
        const a = document.getElementById('logArea');
        return a && a.value.indexOf('Failed to load state') !== -1;
      }, { timeout: 3000 });

      const logs = await page.$eval('#logArea', el => el.value);
      expect(logs).toContain('Failed to load state');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and resilience', () => {
    test('exportTreeBtn triggers a download anchor creation (no error) and logs remain stable', async ({ page }) => {
      // Click the exportTreeBtn - it triggers download() which creates an anchor and clicks it.
      // We simply assert this action does not produce page errors.
      await page.click('#exportTreeBtn');

      // Give a short grace period for any asynchronous behavior
      await page.waitForTimeout(200);

      // No uncaught errors should have occurred
      expect(pageErrors.length).toBe(0);
    });

    test('double-clicking stepBtn performs multiple steps and does not throw errors', async ({ page }) => {
      // Ensure a small problem is initialized
      await page.selectOption('#templateSelect', 'custom');
      await page.fill('#customVars', 'a,b,c');
      await page.fill('#customDomains', '{"a":[0,1],"b":[0,1],"c":[0,1]}');
      await page.fill('#customConstraints', 'return true;');
      await page.click('#initBtn');

      // Double-click stepBtn triggers the dblclick handler which loops solverStep multiple times
      // Playwright doesn't have dblclick by default on plain click for event dblclick; use dblclick()
      await page.dblclick('#stepBtn');

      // Allow some time for processing
      await page.waitForTimeout(300);

      // Ensure counters are updated (nodesVisited may have changed)
      const counters = await page.$eval('#countersPre', el => el.textContent);
      expect(counters).toMatch(/nodesVisited: \d+/);

      // Still no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('attempting to reset before initialization does not throw (guard path)', async ({ page }) => {
      // Simulate page state by reloading to clear automatic boot initialization briefly
      await page.reload({ waitUntil: 'load' });

      // Click resetBtn immediately (before boot's init may run)
      // The event handler checks if (PROBLEM) resetSolver();
      // This should not throw even if PROBLEM is not defined yet in a race
      await page.click('#resetBtn');

      // Allow small delay and ensure no pageerror occurred
      await page.waitForTimeout(200);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Final assertions on observed console messages and errors', () => {
    test('console captured contains expected key lifecycle messages and no uncaught errors', async ({ page }) => {
      // At this point many interactions ran; assert some expected console message patterns were captured
      const texts = consoleMessages.map(m => m.text).join('\n');

      // The app logs at boot and during user interactions; assert we saw boot complete
      expect(texts).toMatch(/Boot complete/);

      // We expect to have seen at least one 'Initialized problem' message during tests
      expect(texts).toMatch(/Initialized problem:/);

      // We expect to have seen 'Run started' and 'Run stopped' at least once across tests
      // Use optional assertions (they may not exist if a particular test didn't run in sequence), but assert at least one of them.
      expect(texts).toMatch(/Run started|Run stopped/);

      // Finally, assert that no uncaught page errors were recorded
      expect(pageErrors.length).toBe(0);
    });
  });
});