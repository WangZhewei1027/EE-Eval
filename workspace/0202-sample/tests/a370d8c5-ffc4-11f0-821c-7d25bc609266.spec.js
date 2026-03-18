import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a370d8c5-ffc4-11f0-821c-7d25bc609266.html';

test.describe('a370d8c5-ffc4-11f0-821c-7d25bc609266 - Radix Sort Demo FSM', () => {
  // Helper to attach console and pageerror listeners and collect events
  async function attachLogCollectors(page) {
    const consoleMessages = [];
    const pageErrors = [];

    const consoleListener = (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    };
    const pageErrorListener = (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
    };

    page.on('console', consoleListener);
    page.on('pageerror', pageErrorListener);

    return {
      consoleMessages,
      pageErrors,
      dispose: () => {
        page.removeListener('console', consoleListener);
        page.removeListener('pageerror', pageErrorListener);
      },
    };
  }

  test.beforeEach(async ({ page }) => {
    // Nothing special here; tests load the page individually.
  });

  test.afterEach(async ({ page }) => {
    // Ensure listener cleanup if any tests attach their own (they do via helper).
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial Idle state: page renders Run Radix Sort Demo button and empty demo output', async ({ page }) => {
    // Attach log collectors to observe console messages and runtime errors
    const logs = await attachLogCollectors(page);

    // Load the page and wait for the main button to appear to confirm renderPage() entry action behavior
    await page.goto(APP_URL, { waitUntil: 'load' });
    const runBtn = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');

    // Ensure button exists and has expected initial label
    await expect(runBtn).toBeAttached();
    await expect(runBtn).toHaveText('Run Radix Sort Demo');

    // Button should be enabled initially (Idle state)
    await expect(runBtn).toBeEnabled();

    // demo output area should be present and initially empty (or whitespace)
    await expect(demoOutput).toBeAttached();
    const initialOutputText = (await demoOutput.textContent()) || '';
    expect(initialOutputText.trim()).toBe('');

    // Verify that the demo function is encapsulated in the IIFE (not globally exposed)
    const globalRunFnType = await page.evaluate(() => (window.runRadixSortDemo === undefined ? 'undefined' : typeof window.runRadixSortDemo));
    expect(globalRunFnType).toBe('undefined');

    // Assert there were no page runtime errors emitted while loading the page
    expect(logs.pageErrors.length).toBe(0);
    // We don't expect any console errors for a correct render, but capture any console messages for diagnosis
    // Allow informational console logs (none expected), but ensure no severe errors
    const consoleErrorOrWarn = logs.consoleMessages.filter(m => m.type === 'error' || m.type === 'warning' || m.type === 'trace');
    expect(consoleErrorOrWarn.length).toBe(0);

    // cleanup listeners
    logs.dispose();
  });

  test('Transition: clicking Run Radix Sort Demo triggers runRadixSortDemo(), updates output and disables button (S0 -> S1)', async ({ page }) => {
    // Capture console and page errors during the interaction
    const logs = await attachLogCollectors(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    const runBtn = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');

    // Click the button to start demo - this should invoke runRadixSortDemo() (entry action for DemoRunning)
    await runBtn.click();

    // After clicking, the demo outputs step-by-step logs into #demoOutput.
    // Wait for the demoOutput to contain the expected final sorted array marker
    await expect(demoOutput).toContainText('Final sorted array:');

    // Ensure that final sorted array is present in the output
    const outputText = await demoOutput.textContent();
    expect(outputText).toBeTruthy();
    expect(outputText).toContain('[2, 24, 45, 66, 75, 90, 170, 802]');

    // The button should now be disabled and have text "Demo Completed" - evidence of S1_DemoRunning state entry
    await expect(runBtn).toBeDisabled();
    await expect(runBtn).toHaveText('Demo Completed');

    // Confirm no page runtime errors occurred during the demo execution
    // If there were runtime exceptions (ReferenceError, TypeError, etc.), they would be collected in pageErrors
    expect(logs.pageErrors.length).toBe(0);

    // Assert that no console error-level messages were emitted during demo execution
    const consoleErrors = logs.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Check that the demo output contains intermediate "Sort by digit" phase logs (verifies step-by-step behavior)
    expect(outputText).toContain('Sort by digit (exp = 1):');
    expect(outputText).toContain('Sort by digit (exp = 10):');
    expect(outputText).toContain('Sort by digit (exp = 100):');

    // cleanup listeners
    logs.dispose();
  });

  test('Edge case: after demo completion, button remains disabled and further user clicks are prevented', async ({ page }) => {
    // Collect logs
    const logs = await attachLogCollectors(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    const runBtn = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');

    // Trigger demo once
    await runBtn.click();

    // Ensure transition completed
    await expect(runBtn).toBeDisabled();
    const outputAfterFirstRun = (await demoOutput.textContent()) || '';

    // Attempt a second user click: Playwright will throw when trying to click a disabled element.
    // We assert that clicking a disabled button from the user perspective is not allowed.
    await expect(page.click('#runDemo')).rejects.toThrow();

    // Confirm output did not change after the failed second click attempt (idempotency)
    const outputAfterSecondAttempt = (await demoOutput.textContent()) || '';
    expect(outputAfterSecondAttempt).toBe(outputAfterFirstRun);

    // For robustness, verify that programmatic invocation via a synthetic dispatch (which bypasses disabled) is not performed by our tests,
    // but show that the function is not globally callable (ensures the only way to start demo is the rendered button)
    const globalRunFnType = await page.evaluate(() => (window.runRadixSortDemo === undefined ? 'undefined' : typeof window.runRadixSortDemo));
    expect(globalRunFnType).toBe('undefined');

    // Ensure no runtime page errors were emitted during these interactions
    expect(logs.pageErrors.length).toBe(0);

    logs.dispose();
  });

  test('DOM verification: semantic attributes and structure for accessibility and live region updates', async ({ page }) => {
    // Validate that the demo output pre has the expected ARIA attributes and is used as a live region
    await page.goto(APP_URL, { waitUntil: 'load' });

    const demoOutput = page.locator('#demoOutput');

    // Should have aria-live="polite" and aria-atomic="true"
    await expect(demoOutput).toHaveAttribute('aria-live', 'polite');
    await expect(demoOutput).toHaveAttribute('aria-atomic', 'true');

    // Ensure the demo output element uses the expected class for styling
    await expect(demoOutput).toHaveClass(/demo-output/);

    // No runtime errors on simple DOM inspection
    // Listen for page errors for the short duration of the check
    const logs = await attachLogCollectors(page);
    expect(logs.pageErrors.length).toBe(0);
    logs.dispose();
  });
});