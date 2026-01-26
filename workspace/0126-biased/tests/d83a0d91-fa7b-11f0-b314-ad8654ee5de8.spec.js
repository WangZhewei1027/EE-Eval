import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83a0d91-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Interpreter demo — FSM states and transitions', () => {
  // Collect runtime console messages and page errors for each test.
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages and page errors without modifying page behavior.
    page.on('console', msg => {
      // Keep the message object so tests can inspect type/text
      consoleMessages.push(msg);
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the exact provided HTML page.
    await page.goto(APP_URL);
    // Ensure the main content is loaded and the run button exists.
    await expect(page.locator('main h1')).toHaveText(/Interpreter — Comprehensive Explanation/);
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright-managed fixtures.
  });

  test.describe('S0_Idle (initial) state validations', () => {
    test('Initial idle state: Run button and trace area are present with expected attributes and text', async ({ page }) => {
      // This test validates the initial "Idle" state per FSM:
      // - The Run button exists with the expected id, title and text.
      // - The trace region exists with role and aria-label and initial helper text.
      const runButton = page.locator('#runButton');
      await expect(runButton).toHaveCount(1);
      await expect(runButton).toHaveAttribute('title', 'Run the tiny interpreter demonstration once');
      await expect(runButton).toHaveText('Run tiny interpreter demo');

      const trace = page.locator('#trace');
      await expect(trace).toHaveCount(1);
      await expect(trace).toHaveAttribute('role', 'region');
      await expect(trace).toHaveAttribute('aria-label', 'Interpreter trace output');

      // Initial content text described in the HTML implementation.
      await expect(trace).toHaveText(/Click "Run tiny interpreter demo" to see the evaluation trace for a small example program\./);

      // Confirm that loading the page did not produce immediate console errors or page errors.
      const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
      expect(consoleErrors.length, 'No console.error messages on initial render').toBe(0);
      expect(pageErrors.length, 'No uncaught page errors on initial render').toBe(0);

      // Also assert none of the console messages indicate ReferenceError/SyntaxError/TypeError.
      const badText = consoleMessages.map(m => m.text()).join('||');
      expect(badText.includes('ReferenceError') || badText.includes('SyntaxError') || badText.includes('TypeError')).toBe(false);
    });
  });

  test.describe('S1_DemoRunning (after RunDemo event) validations', () => {
    test('Clicking the run button runs the tiny interpreter demo and displays a complete trace including output', async ({ page }) => {
      // This test validates the transition S0_Idle -> S1_DemoRunning:
      // - Clicking #runButton executes the demo, populates #trace with a sequence of log lines,
      //   includes the start/finished markers and the expected output ">>> OUTPUT: 9".
      const traceLocator = page.locator('#trace');
      const runButton = page.locator('#runButton');

      // Click to trigger the demo run.
      await runButton.click();

      // Wait for trace to include the finished marker (evaluations are synchronous but ensure stability).
      await expect(traceLocator).toHaveText(/--- Tiny Interpreter Demo: finished ---/, { timeout: 2000 });

      const traceText = await traceLocator.textContent();
      expect(traceText, 'Trace should include start marker').toMatch(/--- Tiny Interpreter Demo: start ---/);
      expect(traceText, 'Trace should include finished marker').toMatch(/--- Tiny Interpreter Demo: finished ---/);
      // The demo should produce the printed numeric output for the example program (expected "9").
      expect(traceText, 'Trace should contain printed output ">>> OUTPUT: 9"').toMatch(/>>> OUTPUT: 9/);

      // Check that the evaluation logs include evidence of defining variables and lookups.
      expect(traceText).toMatch(/Defined x = 2/);
      expect(traceText).toMatch(/Lookup y/); // at least identifiers should be looked up somewhere

      // Ensure there were no console.error messages or uncaught page errors during demo run.
      const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
      expect(consoleErrors.length, 'No console.error during demo run').toBe(0);
      expect(pageErrors.length, 'No uncaught page errors during demo run').toBe(0);

      // Verify no console messages contain ReferenceError/SyntaxError/TypeError strings.
      const allConsoleText = consoleMessages.map(m => m.text()).join('||');
      expect(allConsoleText.includes('ReferenceError') || allConsoleText.includes('SyntaxError') || allConsoleText.includes('TypeError')).toBe(false);
    });

    test('Second click behavior: run handler is registered with {once:true} so a second click does not re-run the demo', async ({ page }) => {
      // This test asserts the implemented behavior (not the FSM textual expectation):
      // Because the page registers the click handler with { once: true }, after the first click
      // the listener is removed. Therefore a second click should have no effect on the trace content.
      const traceLocator = page.locator('#trace');
      const runButton = page.locator('#runButton');

      // First click - run the demo.
      await runButton.click();
      await expect(traceLocator).toHaveText(/--- Tiny Interpreter Demo: finished ---/, { timeout: 2000 });
      const traceAfterFirst = await traceLocator.textContent();

      // Attempt a second click. Because the handler used { once: true }, this should not change the trace.
      await runButton.click();

      // Small pause to allow any possible handlers (if present) to run; but we do not modify the page.
      await page.waitForTimeout(200);

      const traceAfterSecond = await traceLocator.textContent();

      // Assert the trace is unchanged after the second click.
      expect(traceAfterSecond, 'Trace should remain identical after second click when handler was once:true').toBe(traceAfterFirst);

      // Also assert that the DOM did not update to the 'already run' message (that code path would only run if the handler remained).
      expect(traceAfterSecond).not.toMatch(/Demo has already run/);

      // Confirm no new console errors or page errors occurred as a result of the second click.
      const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
      expect(consoleErrors.length, 'No console.error after second click').toBe(0);
      expect(pageErrors.length, 'No uncaught page errors after second click').toBe(0);
    });

    test('Edge case and error observation: ensure no uncaught runtime errors (ReferenceError/SyntaxError/TypeError) are observed across interactions', async ({ page }) => {
      // This test deliberately observes the console and pageerror streams and asserts that
      // no common JS runtime errors occurred during page load and interaction.
      const traceLocator = page.locator('#trace');
      const runButton = page.locator('#runButton');

      // Interact: click to run demo.
      await runButton.click();
      await expect(traceLocator).toHaveText(/--- Tiny Interpreter Demo: finished ---/, { timeout: 2000 });

      // Inspect collected messages and errors.
      const consoleErrorMsgs = consoleMessages.filter(m => m.type() === 'error').map(m => m.text());
      const pageErrorMsgs = pageErrors.map(e => (e && e.message) || String(e));

      // Assert there are no console.error notifications.
      expect(consoleErrorMsgs.length, 'No console.error messages emitted').toBe(0);

      // Assert there are no uncaught exceptions surfaced to pageerror.
      expect(pageErrorMsgs.length, 'No uncaught page errors emitted').toBe(0);

      // Additionally assert that none of the collected console messages contain "ReferenceError", "TypeError" or "SyntaxError".
      const allConsoleText = consoleMessages.map(m => m.text()).join('\n');
      expect(allConsoleText.includes('ReferenceError') || allConsoleText.includes('TypeError') || allConsoleText.includes('SyntaxError')).toBe(false);

      // Finally assert that the trace content does not report a runtime error line (the demo code would push 'Runtime error:' on failure).
      const traceText = await traceLocator.textContent();
      expect(traceText).not.toMatch(/Runtime error:/);
    });
  });

  test.describe('Accessibility and component contract checks derived from FSM components', () => {
    test('Demo container and components declare accessible attributes and live region', async ({ page }) => {
      // Validate the demo container has aria-live and that trace exposes role/aria-label per FSM
      const demoContainer = page.locator('.demo');
      await expect(demoContainer).toHaveAttribute('aria-live', 'polite');

      const trace = page.locator('#trace');
      await expect(trace).toHaveAttribute('role', 'region');
      await expect(trace).toHaveAttribute('aria-label', 'Interpreter trace output');

      const runButton = page.locator('#runButton');
      await expect(runButton).toHaveAttribute('title', 'Run the tiny interpreter demonstration once');
    });
  });
});