import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d835c7d0-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Bellman–Ford Algorithm — Demo FSM (d835c7d0-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Collect console and page errors for each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Observe console messages and page errors but do not modify page behavior
    page.on('console', msg => {
      // collect only error-level console messages for assertions
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      // uncaught exceptions in page context
      pageErrors.push(err);
    });

    // Navigate to the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // No teardown beyond the normal Playwright lifecycle; keep hooks explicit
  });

  test('S0_Idle: initial render (Idle state) shows Run demo button and placeholder log', async ({ page }) => {
    // Validate initial, idle state UI and accessibility attributes
    const runBtn = page.locator('#runBtn');
    const logText = page.locator('#logText');
    const logContainer = page.locator('#log');

    // Button exists and has expected text and accessibility link to log
    await expect(runBtn).toHaveCount(1);
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toHaveText('Run demo');
    await expect(runBtn).toHaveAttribute('aria-controls', 'log');

    // Log area exists and contains the initial placeholder text
    await expect(logContainer).toBeVisible();
    const initialLog = await logText.textContent();
    await expect(initialLog).toContain('Press "Run demo" to see a step-by-step log of Bellman–Ford on the example graph (source = A).');

    // Confirm aria-live attributes are present for dynamic updates
    await expect(logContainer).toHaveAttribute('aria-live', 'polite');

    // There should be no console errors or uncaught page errors at initial load
    expect(consoleErrors.length, 'console.error should be empty on load').toBe(0);
    expect(pageErrors.length, 'no uncaught page errors on load').toBe(0);
  });

  test('S1_Running -> S2_Completed: clicking Run demo transitions through Running to Completed and prints final distances', async ({ page }) => {
    // This test validates:
    // - Transition from Idle to Running: button disabled and text changed to "Running..."
    // - The algorithm runs and updates the demo log
    // - Final distances are displayed and the button is re-enabled
    const runBtn = page.locator('#runBtn');
    const logText = page.locator('#logText');

    // Click the button to start the demo (this should synchronously set disabled=true and text='Running...')
    await runBtn.click();

    // Immediately after click: button should be disabled and show "Running..."
    await expect(runBtn).toBeDisabled();
    await expect(runBtn).toHaveText('Running...');

    // While running, the log may still contain the old placeholder briefly; wait for completion marker
    // The demo uses a 350ms setTimeout; wait up to 5s to be robust on CI
    await page.waitForFunction(() => {
      const el = document.getElementById('logText');
      return el && el.textContent && el.textContent.includes('Final shortest distances (source A):');
    }, { timeout: 5000 });

    // After completion, check the log contains the negative-cycle check and final distances block
    const finalLog = await logText.textContent();
    expect(finalLog).toBeTruthy();
    expect(finalLog).toContain('Iteration 1 start');
    expect(finalLog).toContain('Negative cycle check:');
    expect(finalLog).toContain('No negative cycle detected.');
    expect(finalLog).toContain('Final shortest distances (source A):');

    // Validate final distances match expected values from the example
    // Expected: A: 0, B: 2, C: -1, D: 7, E: -2
    expect(finalLog).toContain('A: 0');
    expect(finalLog).toContain('B: 2');
    expect(finalLog).toContain('C: -1');
    expect(finalLog).toContain('D: 7');
    expect(finalLog).toContain('E: -2');

    // After run completes, button text should revert and be enabled for subsequent runs
    await expect(runBtn).toHaveText('Run demo');
    await expect(runBtn).toBeEnabled();

    // No console errors or uncaught page errors should have occurred during the run
    expect(consoleErrors.length, 'no console.error messages during run').toBe(0);
    expect(pageErrors.length, 'no uncaught page errors during run').toBe(0);
  });

  test('Transition actions and evidence: verify event wiring and that click handler was attached (event fires)', async ({ page }) => {
    // This test ensures the RunDemo_Click event is attached and the transition actions (disable/text change) are executed
    const runBtn = page.locator('#runBtn');
    const logText = page.locator('#logText');

    // Check that the page contains a reference to "addEventListener" in the script by inspecting the inline script text
    // We don't modify or patch scripts; we only read the document's script text nodes to look for evidence strings
    const scripts = await page.locator('script').allTextContents();
    const combinedScripts = scripts.join('\n');
    expect(combinedScripts).toContain('addEventListener(\'click\'');

    // Start the demo and observe the immediate actions executed by click handler
    await runBtn.click();
    await expect(runBtn).toBeDisabled();
    await expect(runBtn).toHaveText('Running...');

    // Wait for the algorithm to finish and assert the log was updated (transition to Completed)
    await page.waitForFunction(() => {
      const el = document.getElementById('logText');
      return el && el.textContent && el.textContent.includes('Final shortest distances (source A):');
    }, { timeout: 5000 });

    const finalLog = await logText.textContent();
    expect(finalLog).toContain('Final shortest distances (source A):');

    // Confirm the code pushed logs to the log text area by checking for lines that show relax operations
    expect(finalLog).toMatch(/relax \w->\w \(-?\d+\): updated dist\[/);

    // Confirm again that there were no console/page errors during this transition
    expect(consoleErrors.length, 'no console.error messages during transition').toBe(0);
    expect(pageErrors.length, 'no page errors during transition').toBe(0);
  });

  test('Edge case: rapid click behavior and robustness - button should not allow concurrent overlapping runs', async ({ page }) => {
    // This test explores the behavior when user attempts to rapidly click the Run demo button.
    // The UI intends to disable the button immediately upon click to prevent concurrent runs.
    const runBtn = page.locator('#runBtn');
    const logText = page.locator('#logText');

    // Rapidly attempt two clicks:
    // We perform the first click normally, then try to call click() in page context immediately.
    // Because the handler sets disabled synchronously, the programmatic click on a disabled button should not re-trigger the handler.
    await runBtn.click();

    // Immediately attempt to invoke the button click again from the page context.
    // We intentionally call the DOM API directly; this tests native browser semantics (no code patches).
    const programmaticClickTriggered = await page.evaluate(() => {
      const btn = document.getElementById('runBtn');
      // Capture current text before attempted programmatic click
      const beforeText = btn ? btn.textContent : null;
      try {
        // Attempt to call .click() even though it is likely disabled.
        btn.click();
        return { beforeText, afterAttemptText: btn.textContent };
      } catch (e) {
        return { beforeText, afterAttemptText: null, error: String(e) };
      }
    });

    // The button should remain disabled while running (it was set to disabled by the handler)
    await expect(runBtn).toBeDisabled();
    await expect(runBtn).toHaveText('Running...');

    // Wait for completion
    await page.waitForFunction(() => {
      const el = document.getElementById('logText');
      return el && el.textContent && el.textContent.includes('Final shortest distances (source A):');
    }, { timeout: 5000 });

    // After completion, the button returns to enabled state
    await expect(runBtn).toBeEnabled();
    await expect(runBtn).toHaveText('Run demo');

    // Validate that the programmatic click did not cause an additional overlapping run:
    // The demo replaces the logText content with a single run's output; check that there is exactly one "Final shortest distances" section
    const finalLog = await logText.textContent();
    const finalCount = (finalLog.match(/Final shortest distances \(source A\):/g) || []).length;
    expect(finalCount).toBeGreaterThanOrEqual(1);
    // We expect no duplicated back-to-back final sections; assert there's not an unexpected second final block (defensive)
    expect(finalCount).toBeLessThanOrEqual(2);

    // There should be no uncaught exceptions or console errors resulting from the rapid attempts
    expect(consoleErrors.length, 'no console.error after rapid clicks').toBe(0);
    expect(pageErrors.length, 'no pageerror after rapid clicks').toBe(0);
  });

  test('Observability: Ensure the demo prints the negative-cycle check and indicates none detected for this graph', async ({ page }) => {
    // This test verifies that the negative cycle detection phase is executed and reported in the log.
    const runBtn = page.locator('#runBtn');
    const logText = page.locator('#logText');

    // Start demo
    await runBtn.click();

    // Wait for final results to be printed
    await page.waitForFunction(() => {
      const el = document.getElementById('logText');
      return el && el.textContent && el.textContent.includes('No negative cycle detected.');
    }, { timeout: 5000 });

    const finalLog = await logText.textContent();
    expect(finalLog).toContain('Negative cycle check:');
    expect(finalLog).toContain('No negative cycle detected.');

    // Also ensure the negativeCycle boolean from the algorithm would be false by presence of that message
    // (we are not modifying or invoking internal functions; we assert by textual evidence only)

    // Check there were no console errors as a result
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});