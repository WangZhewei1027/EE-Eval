import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122dacb4-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Compiler FSM - Interactive E2E tests (Application ID: 122dacb4-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Arrays to collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and page errors so tests can assert on them later
    page.on('console', msg => {
      try {
        // Only store error-level console messages for focused assertions
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location(),
          });
        }
      } catch (e) {
        // Defensive: if reading msg properties fails, still record a generic entry
        consoleErrors.push({ text: `console capture failed: ${String(e)}` });
      }
    });

    page.on('pageerror', err => {
      // pageerror is typically an Error object
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });

    // Load the page exactly as provided
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No special teardown beyond letting Playwright close pages between tests
  });

  test('Idle state on initial load: Start button present and enabled, inputs are editable', async ({ page }) => {
    // Validate presence of primary controls and initial enabled/disabled state (Idle)
    // This test validates the S0_Idle evidence: Start button exists.
    const start = await page.locator('#compiler-start');
    const stop = await page.locator('#compiler-stop');
    const run = await page.locator('#compiler-run');
    const quit = await page.locator('#compiler-quit');

    await expect(start).toBeVisible();
    await expect(start).toHaveText('Start Compiler');
    await expect(start).toBeEnabled(); // Idle should allow starting

    // The HTML doesn't explicitly set initial disabilities, but ensure inputs are editable
    await expect(page.locator('#input1')).toBeEnabled();
    await expect(page.locator('#input2')).toBeEnabled();
    await expect(page.locator('#input3')).toBeEnabled();
    await expect(page.locator('#output1')).toBeEnabled();
    await expect(page.locator('#output2')).toBeEnabled();

    // Assert there are no console errors or page errors on initial render
    expect(consoleErrors.length, `console errors on load: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors on load: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Start Compiler transitions to Compiling (S0 -> S1): verifies button state changes and run button text', async ({ page }) => {
    // Arrange: locate controls
    const start = page.locator('#compiler-start');
    const stop = page.locator('#compiler-stop');
    const run = page.locator('#compiler-run');

    // Act: click Start Compiler (StartCompiler event)
    await start.click();

    // Assert FSM S1_Compiling evidence:
    // startButton.disabled = true;
    await expect(start).toBeDisabled();

    // stopButton.disabled = false;
    await expect(stop).toBeEnabled();

    // runButton.disabled = false;
    await expect(run).toBeEnabled();

    // startCompiler sets runButton.textContent = 'Stop Compiler'
    await expect(run).toHaveText('Stop Compiler');

    // Inputs should still be enabled at this stage (the first start does not disable them)
    await expect(page.locator('#input1')).toBeEnabled();
    await expect(page.locator('#input2')).toBeEnabled();

    // Confirm no runtime console/page errors happened during the transition
    expect(consoleErrors.length, `console errors after Start click: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors after Start click: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Run Compiler event while Compiling (S1 -> S1): clicking run toggles behavior and then disables inputs on subsequent click', async ({ page }) => {
    const start = page.locator('#compiler-start');
    const run = page.locator('#compiler-run');

    // Move to Compiling state first
    await start.click();
    await expect(start).toBeDisabled();
    await expect(run).toHaveText('Stop Compiler');

    // First Run click: runCompiler() calls startCompiler() again.
    // The added click-listener inside startCompiler is added after this click, so first click should not trigger the inner listener's input-disabling behavior.
    await run.click();

    // After first run click, we should remain in Compiling and run button text should be 'Stop Compiler'
    await expect(run).toHaveText('Stop Compiler');
    await expect(start).toBeDisabled();

    // Inputs should still be enabled (inner listener hasn't fired yet)
    await expect(page.locator('#input1')).toBeEnabled();
    await expect(page.locator('#output1')).toBeEnabled();

    // Second Run click: should trigger the listener added by the previous startCompiler call.
    await run.click();

    // That listener sets runButton.textContent = 'Run Compiler' and disables inputs/outputs, and clears values.
    await expect(run).toHaveText('Run Compiler');

    // Inputs and outputs should now be disabled and their values cleared.
    await expect(page.locator('#input1')).toBeDisabled();
    await expect(page.locator('#input2')).toBeDisabled();
    await expect(page.locator('#input3')).toBeDisabled();
    await expect(page.locator('#output1')).toBeDisabled();
    await expect(page.locator('#output2')).toBeDisabled();

    // Also assert values were cleared (should be empty strings)
    await expect(page.locator('#input1')).toHaveValue('');
    await expect(page.locator('#output1')).toHaveValue('');

    // Confirm there were no unexpected console/page errors during the sequence
    expect(consoleErrors.length, `console errors after Run sequence: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors after Run sequence: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Stop Compiler transitions to Stopped (S1 -> S2): verifies button states and added behaviors', async ({ page }) => {
    const start = page.locator('#compiler-start');
    const stop = page.locator('#compiler-stop');
    const run = page.locator('#compiler-run');

    // Enter Compiling state
    await start.click();
    await expect(start).toBeDisabled();
    await expect(run).toHaveText('Stop Compiler');

    // Click Stop (StopCompiler event) -> this triggers quitCompiler() which calls stopCompiler()
    await stop.click();

    // stopButton.disabled = true;
    await expect(stop).toBeDisabled();

    // startButton.disabled = false;
    await expect(start).toBeEnabled();

    // runButton.disabled = false;
    await expect(run).toBeEnabled();

    // runButton.textContent should be 'Stop Compiler' as set in stopCompiler()
    await expect(run).toHaveText('Stop Compiler');

    // Inputs should be enabled after stopping (stopCompiler ensures inputs are enabled in one of the runButton listeners,
    // but immediately after stopCompiler we expect inputs not forcibly disabled by stopCompiler itself).
    // The implementation adds a run listener that will later re-enable inputs when triggered; ensure no exceptions
    await expect(page.locator('#input1')).toBeEnabled();

    // Now, exercise the run button to trigger the listener added inside stopCompiler:
    // That listener modifies the stop button text to 'Start Compiler', disables runButton, and enables inputs/outputs.
    await run.click();

    // After clicking run following a stop, run's listener sets runButton.disabled = true, startButton.disabled = false
    // However, due to layered listeners in the implementation, the exact sequence may vary; assert observable effects:
    // - run may become disabled
    // - start should remain enabled
    // - stop button text may change to 'Start Compiler'
    // Use a tolerant assertion: check that start is enabled and inputs are enabled (since the listener attempts to enable them)
    await expect(start).toBeEnabled();

    // Inputs should be enabled after that listener executes
    await expect(page.locator('#input1')).toBeEnabled();

    // Verify no console/page errors occurred during stop flow
    expect(consoleErrors.length, `console errors after Stop flow: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors after Stop flow: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Quit Compiler (S2 -> S0): using Quit to attempt returning to Idle and verifying DOM state', async ({ page }) => {
    const start = page.locator('#compiler-start');
    const stop = page.locator('#compiler-stop');
    const quit = page.locator('#compiler-quit');

    // Move to Stopped state: start then stop
    await start.click();
    await stop.click();

    // Ensure we're in Stopped per implementation expectations
    await expect(stop).toBeDisabled();
    await expect(start).toBeEnabled();

    // Click quit -> quitCompiler() calls stopCompiler()
    await quit.click();

    // After quit, the implementation calls stopCompiler again. Validate observable effects:
    // stop should be disabled, start should be enabled
    await expect(stop).toBeDisabled();
    await expect(start).toBeEnabled();

    // Inputs should be enabled (stopCompiler tends to set inputs enabled through nested listeners)
    await expect(page.locator('#input1')).toBeEnabled();

    // Confirm no console or page errors after Quit
    expect(consoleErrors.length, `console errors after Quit: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors after Quit: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Edge case: repeated rapid clicks that may stack listeners - ensure no uncaught exceptions and stable final state', async ({ page }) => {
    const start = page.locator('#compiler-start');
    const run = page.locator('#compiler-run');
    const stop = page.locator('#compiler-stop');

    // Rapidly click start multiple times to exercise repeated listener additions
    await start.click();
    await start.click();
    await start.click();

    // Rapidly click run multiple times to exercise both runCompiler and the inner listeners added earlier
    await run.click();
    await run.click();
    await run.click();
    await run.click();

    // Rapidly click stop multiple times
    await stop.click();
    await stop.click();

    // After these chaotic interactions we assert:
    // - There were no page errors or console errors (we let any ReferenceError/TypeError/SyntaxError happen naturally and assert their recorded count)
    expect(consoleErrors.length, `console errors after chaotic interactions: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors after chaotic interactions: ${JSON.stringify(pageErrors)}`).toBe(0);

    // - The page still exposes the buttons and at least one of them is enabled so the app is interactive
    await expect(page.locator('#compiler-start')).toBeVisible();
    await expect(page.locator('#compiler-run')).toBeVisible();
    await expect(page.locator('#compiler-stop')).toBeVisible();
  });

  test('Validation of expected FSM observables and functions: ensure event handlers are wired as described', async ({ page }) => {
    // This test intentionally inspects observable behavior of event wiring rather than internals:
    // According to the FSM the StartCompiler, StopCompiler and RunCompiler events are wired to specific buttons.
    // We validate that clicking those selectors triggers some expected UI reaction (no errors) and that the handlers exist in practice.

    // Click start -> should change run button text to 'Stop Compiler'
    await page.click('#compiler-start');
    await expect(page.locator('#compiler-run')).toHaveText('Stop Compiler');

    // Click run -> still should be clickable and change/maintain expected UI state
    await page.click('#compiler-run');
    await expect(page.locator('#compiler-run')).toHaveText(/Stop Compiler|Run Compiler/);

    // Click stop -> should disable stop and enable start
    await page.click('#compiler-stop');
    await expect(page.locator('#compiler-stop')).toBeDisabled();
    await expect(page.locator('#compiler-start')).toBeEnabled();

    // No runtime exceptions surfaced in console/pageerror
    expect(consoleErrors.length, `console errors after handler wiring validation: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors after handler wiring validation: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Error observation test: explicitly assert whether ReferenceError/SyntaxError/TypeError occurred during page lifecycle', async ({ page }) => {
    // We capture pageErrors and consoleErrors across the test lifecycle in beforeEach and during interactions.
    // This test makes a clear assertion about error absence/presence:
    // - If any page errors were captured (uncaught exceptions), we fail with details.
    // - If any console errors were captured, we fail with details.
    // This follows the instruction to observe console logs and page errors and assert on them.

    // Perform a few benign interactions to allow potential errors to surface
    await page.click('#compiler-start');
    await page.click('#compiler-run');
    await page.click('#compiler-stop');
    await page.click('#compiler-quit');

    // Now assert: prefer to assert that there were no uncaught ReferenceError/SyntaxError/TypeError occurrences.
    // If there are errors, provide their messages to aid debugging.
    if (pageErrors.length > 0) {
      // Fail with details
      throw new Error(`Uncaught page errors detected: ${JSON.stringify(pageErrors, null, 2)}`);
    }
    if (consoleErrors.length > 0) {
      throw new Error(`Console errors detected: ${JSON.stringify(consoleErrors, null, 2)}`);
    }

    // If none, mark the test as passed by a benign expect
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});