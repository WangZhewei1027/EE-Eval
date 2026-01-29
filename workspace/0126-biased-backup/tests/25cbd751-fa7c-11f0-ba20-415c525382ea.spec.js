import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cbd751-fa7c-11f0-ba20-415c525382ea.html';

test.describe('CPU Scheduling Demo (FSM validation) - Application ID: 25cbd751-fa7c-11f0-ba20-415c525382ea', () => {
  // We'll capture console messages and page errors for each test to validate there are no unexpected runtime errors.
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console events and page errors (do not suppress or modify them)
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', err => {
      // Collect unhandled exceptions
      pageErrors.push(err.message || String(err));
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Ensure tests observe console and page errors after each test.
    // (Assertions about these are done inside individual tests.)
  });

  test('S0_Idle state: initial render should show Run Demo button and empty demo output', async ({ page }) => {
    // Validate initial "Idle" state (S0_Idle) according to FSM:
    // - renderPage() entry action is expected when page loads (we validate DOM elements rendered)
    // - The Run Demo button should exist with expected id, text and aria-label
    // - The demo output container should exist, be empty, and have correct accessibility attributes

    const demoButton = await page.locator('#demo-button');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Run Demo');
    await expect(demoButton).toHaveAttribute('aria-label', 'Run Round Robin Scheduling Demo');

    const demoOutput = await page.locator('#demo-output');
    await expect(demoOutput).toBeVisible();

    // Initially demo output should be empty
    await expect(demoOutput).toHaveText('');

    // Accessibility attributes asserted as part of component evidence
    await expect(demoOutput).toHaveAttribute('aria-live', 'polite');
    await expect(demoOutput).toHaveAttribute('tabindex', '0');

    // Assert no console errors or page errors were produced during initial render
    // (If the implementation had runtime errors on load, these would be captured above.)
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Transition RunDemo: clicking Run Demo moves from Idle to DemoRunning (S1) and produces expected timeline output and focus', async ({ page }) => {
    // This test validates the FSM transition:
    // - Event: clicking "#demo-button" (RunDemo)
    // - OnEnter of S1_DemoRunning: runRoundRobinSimulation() runs and updates #demo-output with scheduling timeline and focuses it.

    const demoButton = page.locator('#demo-button');
    const demoOutput = page.locator('#demo-output');

    // Click the demo button to trigger the Round Robin simulation
    await demoButton.click();

    // Wait for demoOutput to be populated with the expected header substring
    await expect(demoOutput).toHaveText(/Round Robin Scheduling Timeline/i, { timeout: 2000 });

    // Build the expected exact text as the page script constructs it.
    // We replicate the simulation output exactly as produced by the inline script.
    const expectedLines = [
      'Round Robin Scheduling Timeline (Quantum = 2 units):',
      '',
      'P1 executed from time 0 to 2 (duration: 2, remaining burst after: 3)',
      'P2 executed from time 2 to 4 (duration: 2, remaining burst after: 1)',
      'P3 executed from time 4 to 6 (duration: 2, remaining burst after: 6)',
      'P1 executed from time 6 to 8 (duration: 2, remaining burst after: 1)',
      'P2 executed from time 8 to 9 (duration: 1, remaining burst after: 0)',
      'P3 executed from time 9 to 11 (duration: 2, remaining burst after: 4)',
      'P1 executed from time 11 to 12 (duration: 1, remaining burst after: 0)',
      'P3 executed from time 12 to 14 (duration: 2, remaining burst after: 2)',
      'P3 executed from time 14 to 16 (duration: 2, remaining burst after: 0)',
      '',
      'All processes completed at time 16.'
    ];
    const expectedText = expectedLines.join('\n');

    // Compare exact content produced in the demo output
    const actualText = await demoOutput.textContent();
    // Normalize line endings just in case (page uses '\n')
    expect(actualText.replace(/\r\n/g, '\n')).toBe(expectedText);

    // Verify the demoOutput received focus as the script calls demoOutput.focus()
    const activeElementId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(activeElementId).toBe('demo-output');

    // Confirm no console errors or page errors were emitted during click handling / simulation
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Idempotency and reset behavior: clicking Run Demo multiple times clears previous output and regenerates timeline', async ({ page }) => {
    // This test checks edge-case behavior:
    // - Re-running the demo should clear previous output (demoOutput.textContent = '') and produce the timeline again.
    // - Rapid multiple clicks should not produce uncaught exceptions.

    const demoButton = page.locator('#demo-button');
    const demoOutput = page.locator('#demo-output');

    // First run
    await demoButton.click();
    await expect(demoOutput).toHaveText(/Round Robin Scheduling Timeline/i);

    const firstRunText = await demoOutput.textContent();
    expect(firstRunText.length).toBeGreaterThan(0);

    // Rapidly click the button multiple times to simulate repeated runs
    // We will not attempt to alter the page internals; we simply interact as a user.
    await Promise.all([
      demoButton.click(),
      demoButton.click(),
      demoButton.click()
    ]);

    // After rapid clicks, ensure final output again matches the expected timeline header and completes
    await expect(demoOutput).toHaveText(/Round Robin Scheduling Timeline/i);

    const secondRunText = await demoOutput.textContent();
    expect(secondRunText.length).toBeGreaterThan(0);

    // The final produced timeline should be the same canonical simulation result.
    // (Exact match to ensure the run produces deterministic output each time.)
    const canonicalHeader = 'Round Robin Scheduling Timeline (Quantum = 2 units):';
    expect(secondRunText.startsWith(canonicalHeader)).toBeTruthy();

    // Ensure that the output changed from the first run (i.e., it was overwritten), or at least is equal.
    // We assert it's equal to the canonical expected output computed previously.
    const expectedLines = [
      'Round Robin Scheduling Timeline (Quantum = 2 units):',
      '',
      'P1 executed from time 0 to 2 (duration: 2, remaining burst after: 3)',
      'P2 executed from time 2 to 4 (duration: 2, remaining burst after: 1)',
      'P3 executed from time 4 to 6 (duration: 2, remaining burst after: 6)',
      'P1 executed from time 6 to 8 (duration: 2, remaining burst after: 1)',
      'P2 executed from time 8 to 9 (duration: 1, remaining burst after: 0)',
      'P3 executed from time 9 to 11 (duration: 2, remaining burst after: 4)',
      'P1 executed from time 11 to 12 (duration: 1, remaining burst after: 0)',
      'P3 executed from time 12 to 14 (duration: 2, remaining burst after: 2)',
      'P3 executed from time 14 to 16 (duration: 2, remaining burst after: 0)',
      '',
      'All processes completed at time 16.'
    ];
    const expectedText = expectedLines.join('\n');
    expect(secondRunText.replace(/\r\n/g, '\n')).toBe(expectedText);

    // Validate there were no console errors or page errors as a result of multiple clicks
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Component contract checks: ensure #demo-button and #demo-output match FSM component evidence and attributes', async ({ page }) => {
    // This test ensures the DOM components match what the FSM expects (selectors, types, attributes).
    const demoButton = page.locator('button#demo-button');
    await expect(demoButton).toHaveAttribute('aria-label', 'Run Round Robin Scheduling Demo');
    await expect(demoButton).toHaveText('Run Demo');

    const demoOutput = page.locator('div#demo-output');
    await expect(demoOutput).toHaveClass(/demo-output/); // class contains demo-output
    await expect(demoOutput).toHaveAttribute('aria-live', 'polite');
    await expect(demoOutput).toHaveAttribute('tabindex', '0');

    // No runtime errors observed during simple attribute checks
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Observability: capture console output and page errors while running the demo (ensure no unexpected errors)', async ({ page }) => {
    // This test explicitly emphasizes observing console and errors and then asserting none occurred.
    // Start with a clean console/pagerrors capture
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    const demoButton = page.locator('#demo-button');
    const demoOutput = page.locator('#demo-output');

    // Run the demo
    await demoButton.click();
    await expect(demoOutput).toHaveText(/Round Robin Scheduling Timeline/i);

    // Wait briefly to allow any asynchronous console messages or errors to surface
    await page.waitForTimeout(200);

    // Log collected console messages for debugging in test output if needed
    // (We still assert that consoleErrors and pageErrors are empty arrays)
    // The test requires observing console logs and letting any errors happen naturally.
    expect(consoleErrors, 'expected no console.error messages during demo run').toEqual([]);
    expect(pageErrors, 'expected no uncaught page errors during demo run').toEqual([]);

    // We still assert there were console messages (optional informational check)
    // There may be zero console.log messages; that's acceptable. We only fail on console.error or pageerror.
  });
});