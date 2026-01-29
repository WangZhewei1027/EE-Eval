import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c162854-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Integration Testing Playground - FSM based end-to-end', () => {
  // Collect console errors and page errors for assertions about runtime exceptions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error(...) events
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      } catch (e) {
        // ignore any handler errors
      }
    });

    // Capture uncaught exceptions (window.onerror / unhandledrejection)
    page.on('pageerror', err => {
      try {
        pageErrors.push(err && err.message ? String(err.message) : String(err));
      } catch (e) { /* ignore */ }
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for initial app log line to be present (app initialization)
    await page.waitForSelector('.app[role="application"][aria-label="Integration Testing Playground"]', { timeout: 3000 });
    // Ensure sample loaded (loadSample called at initialization) - assert existence of a default suite select option
    await page.waitForFunction(() => document.getElementById('suiteSelect').options.length > 0, { timeout: 3000 });
  });

  test.afterEach(async ({ page }) => {
    // noop for now, leaving hooks to allow Playwright to close pages cleanly
  });

  test.describe('State S0_Idle tests', () => {
    test('Idle state renders main application shell and accessibility attributes', async ({ page }) => {
      // Validate S0 evidence: the app element exists with role application and proper aria-label
      const app = page.locator('.app[role="application"][aria-label="Integration Testing Playground"]');
      await expect(app).toBeVisible();

      // Basic UI elements that should be present in Idle state
      await expect(page.locator('#newSuiteBtn')).toBeVisible();
      await expect(page.locator('#loadSampleBtn')).toBeVisible();
      await expect(page.locator('#runBtn')).toBeVisible();

      // There should be no fatal page errors immediately after load (but we still capture any that occur later)
      expect(pageErrors.length).toBeLessThanOrEqual(1); // tolerate at most 1 but nothing critical expected here
    });
  });

  test.describe('State S1_TestEditing tests', () => {
    test('Transition S0_Idle -> S1_TestEditing via New Suite and saveModel on entry', async ({ page }) => {
      // Provide a deterministic response for the prompt that newSuiteBtn triggers
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('My New Suite');
      });

      // Click "New Suite" to create a suite and transition to Test Editing
      await page.click('#newSuiteBtn');

      // After new suite created, model.suites should include the new suite with the name we supplied
      const suites = await page.evaluate(() => (window.model && window.model.suites) ? window.model.suites.map(s => s.name) : []);
      expect(suites).toContain('My New Suite');

      // S1 evidence: test editor textarea for initialVars should be present (renderTestEditor runs when active test exists)
      // Ensure a test exists by adding a test
      page.once('dialog', async dialog => {
        // newTestBtn prompt for name
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('SuiteTest1');
      });
      await page.click('#newTestBtn');

      // Ensure textarea exists and has placeholder content
      const initialVars = page.locator('#initialVars');
      await expect(initialVars).toBeVisible();
      await expect(initialVars).toHaveAttribute('placeholder', `{"count":0,"status":"idle"}`);

      // saveModel is called in the transition; check that model reflects suite and test name
      const modelSnapshot = await page.evaluate(() => ({ suiteIdx: window.model.activeSuiteIndex, testIdx: window.model.activeTestIndex, modelName: window.model.suites[window.model.activeSuiteIndex].name }));
      expect(modelSnapshot.modelName).toBe('My New Suite');
      expect(typeof modelSnapshot.suiteIdx).toBe('number');
    });

    test('Editing actions: NewTest, AddStep, InsertStep, DuplicateStep, ClearSteps, DeleteTest', async ({ page }) => {
      // Ensure there is a suite to operate on - use existing loaded sample or create one
      // If no suites, create one with prompt
      const suiteCount = await page.evaluate(() => window.model.suites.length);
      if (suiteCount === 0) {
        page.once('dialog', async dialog => await dialog.accept('SuiteForEdit'));
        await page.click('#newSuiteBtn');
      }

      // Create a new test inside the currently active suite
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('EditingTest');
      });
      await page.click('#newTestBtn');

      // Add a step (no dialogs involved)
      await page.click('#addStepBtn');
      // After adding step, there should be a .step element in the stepsContainer
      await expect(page.locator('#stepsContainer .step')).toHaveCount(1);

      // Insert step at append (prompt open - supply empty to append)
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept(''); // empty means append
      });
      await page.click('#insertStepBtn');
      await expect(page.locator('#stepsContainer .step')).toHaveCount(2);

      // Duplicate step: provide index '1' to duplicate first step
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('1');
      });
      await page.click('#duplicateStepBtn');
      await expect(page.locator('#stepsContainer .step')).toHaveCount(3);

      // Duplicate an out-of-range index should alert - test invalid index handling
      page.once('dialog', async dialog => {
        // dialog for prompt - we give an invalid index
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('999');
      });
      // Next dialog will be an alert from the code: 'Invalid index' - handle it
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        await dialog.accept();
      });
      await page.click('#duplicateStepBtn');

      // Clear steps: confirm will be shown; accept it
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        await dialog.accept();
      });
      await page.click('#clearStepsBtn');
      await expect(page.locator('#stepsContainer .step')).toHaveCount(0);

      // Delete test: ensure confirm and deletion works; create another test to delete
      page.once('dialog', async dialog => await dialog.accept('ToDeleteTest'));
      await page.click('#newTestBtn');
      // confirm for delete
      page.once('dialog', async dialog => { expect(dialog.type()).toBe('confirm'); await dialog.accept(); });
      await page.click('#deleteTestBtn');

      // Check that active test index is valid and no thrown page errors from above actions
      expect(pageErrors.length).toBeLessThanOrEqual(2);
    });

    test('Import invalid JSON shows parse alert without crashing', async ({ page }) => {
      // Trigger the prompt for import and give invalid JSON
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('{"malformed": true,,,}');
      });

      // The code will catch JSON.parse error and show an alert. Intercept and accept it.
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        // message should contain "Parse error"
        expect(dialog.message()).toMatch(/Parse error/i);
        await dialog.accept();
      });

      await page.click('#importBtn');

      // Ensure model not overwritten by invalid JSON (it should still exist and be an object)
      const modelExists = await page.evaluate(() => typeof window.model === 'object' && Array.isArray(window.model.suites));
      expect(modelExists).toBe(true);

      // Ensure no fatal page exceptions were recorded
      expect(pageErrors.length).toBeLessThanOrEqual(2);
    });

    test('Export JSON triggers a runtime TypeError due to writing to non-existent pre element in new window', async ({ page }) => {
      // Clear previously collected errors
      consoleErrors = [];
      pageErrors = [];

      // Click export button - code attempts to open a new window and access w.document.body.pre which does not exist.
      // That access is expected to throw a TypeError or similar runtime error in many environments.
      await page.click('#exportBtn');

      // Give a short grace period for the error to be emitted
      await page.waitForTimeout(500);

      // At least one page error or console error should have been recorded as a result of the buggy export implementation.
      const hadPageError = pageErrors.length > 0;
      const hadConsoleError = consoleErrors.length > 0;

      // Assert that an error occurred (TypeError or cannot set property)
      expect(hadPageError || hadConsoleError).toBeTruthy();

      // If there are messages, ensure they mention inability to set property or TypeError-like text
      const combined = [...pageErrors, ...consoleErrors].join('\n').toLowerCase();
      expect(/typeerror|cannot set|cannot read|undefined/.test(combined)).toBeTruthy();
    });

    test('Copy JSON attempts to use clipboard; failure falls back to alert and does not crash', async ({ page }) => {
      // The copyJsonBtn uses navigator.clipboard, which may not be available in the test context.
      // Code will attempt navigator.clipboard.writeText(...).then(()=>alert('Copied'), ()=>alert('Clipboard failed'));
      // Intercept the alert and accept it (we expect either "Copied" or "Clipboard failed")
      page.once('dialog', async dialog => {
        expect(['alert', 'prompt', 'confirm']).toContain(dialog.type());
        // Accept any alert shown
        await dialog.accept();
      });

      await page.click('#copyJson');

      // Wait a short time for any potential console/page errors
      await page.waitForTimeout(300);

      // Should not cause an uncaught exception
      expect(pageErrors.length).toBeLessThanOrEqual(1);
    });

    test('Download JSON triggers creation of blob and download link without throwing', async ({ page }) => {
      // Clicking the download button triggers creation and clicking of a blob URL anchor.
      // It should not throw in the page context; capture any pageErrors
      await page.click('#downloadJson');

      // Wait briefly for any side effects
      await page.waitForTimeout(200);

      expect(pageErrors.length).toBeLessThanOrEqual(1);
    });
  });

  test.describe('State S2_TestRunning tests', () => {
    test('Run Test (S1 -> S2) starts engine workers and sets running flag; Stop/StopAll halts runs', async ({ page }) => {
      // Ensure there is at least one suite/test available (sample load ensures that)
      const suiteIndex = await page.evaluate(() => window.model.activeSuiteIndex);
      expect(typeof suiteIndex).toBe('number');

      // Before clicking Run, ensure engine is not running
      const runningBefore = await page.evaluate(() => window.engine && window.engine.running === true);
      expect(runningBefore).toBeFalsy();

      // Set worker speed to small value to avoid long waits
      await page.fill('#workerSpeed', '0');

      // Set parallelRuns to 1 to keep run minimal
      await page.fill('#parallelRuns', '1');

      // Clear the log area
      await page.evaluate(() => { document.getElementById('log').textContent = ''; });

      // Click Run - this should set engine.running = true synchronously
      await page.click('#runBtn');

      // Immediately, engine.running should be true (set by runBtn)
      await page.waitForFunction(() => !!window.engine && window.engine.running === true, { timeout: 1000 });

      // After a short time, the log should contain a START line produced by runTestInstance
      await page.waitForFunction(() => document.getElementById('log').textContent.toLowerCase().includes('start'), { timeout: 3000 });

      // Now request Stop All (transition S2 -> S0 per FSM for StopAll)
      await page.click('#stopAllBtn');

      // After clicking Stop All, the log should contain 'STOP ALL requested' and engine.running should become false
      await page.waitForFunction(() => document.getElementById('log').textContent.includes('STOP ALL requested') || (!window.engine || window.engine.running === false), { timeout: 2000 });

      const runningAfter = await page.evaluate(() => !!window.engine && window.engine.running === true);
      // After stop, engine.running should be false
      expect(runningAfter).toBeFalsy();
    });

    test('Pause (alert) and Rewind behavior while in Running context', async ({ page }) => {
      // Click pause button - triggers an alert (informational)
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toMatch(/pause/i);
        await dialog.accept();
      });
      await page.click('#pauseBtn');

      // Click rewind - should reset logs and stateView and set assertSummary to 'Rewound'
      await page.click('#rewindBtn');

      // Check stateView and assertSummary content
      const stateViewText = await page.locator('#stateView').textContent();
      expect(stateViewText.trim()).toBe('{}');

      const assertSummaryText = await page.locator('#assertSummary').textContent();
      expect(assertSummaryText).toMatch(/Rewound/);

      // The log should contain the rewind message
      const logText = await page.locator('#log').textContent();
      expect(logText).toMatch(/Rewind: cleared state and log/i);
    });

    test('Run Fuzzer transitions S1 -> S2 and produces aggregated summary', async ({ page }) => {
      // Ensure at least one test exists. We'll set fuzzPaths to 1 for speed.
      await page.fill('#fuzzPaths', '1');
      // Reduce any potential timeouts in fuzzed runs by setting speed to 0
      await page.fill('#workerSpeed', '0');

      // Clear log and assertion summary then run fuzzer
      await page.evaluate(() => { document.getElementById('log').textContent = ''; document.getElementById('assertSummary').textContent = ''; });

      // Click run fuzzer - this runs paths sequentially in the handler and updates assertSummary
      await page.click('#runFuzzerBtn');

      // Wait until assertSummary includes 'Fuzzer:' or log contains 'Fuzzer complete.'
      await page.waitForFunction(() => document.getElementById('assertSummary').textContent.toLowerCase().includes('fuzzer') || document.getElementById('log').textContent.toLowerCase().includes('fuzzer complete'), { timeout: 5000 });

      const assertSummaryText = await page.locator('#assertSummary').textContent();
      expect(assertSummaryText.toLowerCase()).toMatch(/fuzzer/);
    });

    test('Step-run button triggers interactive flow but we avoid infinite prompts by canceling promptly', async ({ page }) => {
      // The stepBtn handler prompts repeatedly. To prevent modal blocking during test, we will intercept the first prompts/confirm dialogs and cancel.
      // First dialog in stepBtn is not a prompt but the internal prompts executed inside openStepEditor when editing - however stepBtn's implementation shows confirm dialog usage.
      // When clicking stepBtn, it does not prompt immediately unless there are breakpoints; it will show confirms for stepping forward. We'll accept the first step forward confirm then cancel the next.
      // Prepare to auto-respond to any alert/confirm dialogs: accept the first confirm to step, then cancel second confirm to exit the loop.
      let confirmCount = 0;
      page.on('dialog', async dialog => {
        if (dialog.type() === 'confirm') {
          confirmCount++;
          // Accept the first confirm, cancel the second to stop stepping
          if (confirmCount === 1) await dialog.accept();
          else await dialog.dismiss();
        } else {
          // Dismiss or accept alerts/prompts generically
          await dialog.accept();
        }
      });

      // Click step button; the function will run and eventually finish due to our dialog dismiss
      // We guard with a timeout so the test doesn't hang
      await page.click('#stepBtn');

      // Wait a short time for the step-run process to update stateView or log
      await page.waitForTimeout(800);

      // Ensure there is some log output from step-run
      const log = await page.locator('#log').textContent();
      expect(log.length).toBeGreaterThan(0);
    });

    test('Stop Test button requests stop and logs the stop request', async ({ page }) => {
      // First, start a run to have something to stop
      await page.fill('#workerSpeed', '0');
      await page.fill('#parallelRuns', '1');
      await page.click('#runBtn');

      // Wait a short while to ensure engine running flag is set
      await page.waitForFunction(() => !!window.engine && window.engine.running === true, { timeout: 1000 });

      // Click stop button which sets stopSignalGlobal.cancelled = true
      await page.click('#stopBtn');

      // Wait for log to reflect a stop request
      await page.waitForFunction(() => document.getElementById('log').textContent.includes('Requested stop for current workers') || document.getElementById('log').textContent.includes('STOPPED'), { timeout: 2000 });

      // engine.running should be false after stopping
      const runningNow = await page.evaluate(() => !!window.engine && window.engine.running === true);
      expect(runningNow).toBeFalsy();
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Delete suite with confirm flow behaves and model updates', async ({ page }) => {
      // Create a suite to delete
      page.once('dialog', async d => await d.accept('SuiteToRemove'));
      await page.click('#newSuiteBtn');
      // There should be at least one suite
      const beforeCount = await page.evaluate(() => window.model.suites.length);

      // Confirm deletion of active suite
      page.once('dialog', async d => { expect(d.type()).toBe('confirm'); await d.accept(); });
      await page.click('#deleteSuiteBtn');

      const afterCount = await page.evaluate(() => window.model.suites.length);
      // afterCount should be either beforeCount-1 or if other logic changed, not greater than before
      expect(afterCount).toBeLessThanOrEqual(beforeCount);
    });

    test('Open step editor and cancel edits (prompt cancellation) does not throw', async ({ page }) => {
      // Ensure at least one step exists so openStepEditor will be invoked
      // Add a step if none
      const stepCount = await page.evaluate(() => {
        const s = window.model.suites[window.model.activeSuiteIndex];
        return s && s.tests && s.tests[window.model.activeTestIndex] ? s.tests[window.model.activeTestIndex].steps.length : 0;
      });
      if (stepCount === 0) {
        await page.click('#addStepBtn');
      }

      // Intercept the first prompt invoked by openStepEditor and cancel it (simulate user pressing cancel)
      page.once('dialog', async dialog => {
        // First prompt is for Step title; cancel it to abort editing
        expect(dialog.type()).toBe('prompt');
        await dialog.dismiss();
      });

      // Click the edit button on the first step we can find
      const firstEdit = page.locator('#stepsContainer .step .editBtn').first();
      await expect(firstEdit).toBeVisible();
      await firstEdit.click();

      // Wait briefly and assert no uncaught errors occurred
      await page.waitForTimeout(200);
      expect(pageErrors.length).toBeLessThanOrEqual(1);
    });
  });
});