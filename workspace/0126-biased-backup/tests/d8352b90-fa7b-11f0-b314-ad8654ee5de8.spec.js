import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8352b90-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Linear Search — Interactive Demo (FSM validation)', () => {
  // Helper to attach listeners for console and page errors and return collectors
  async function observeConsoleAndErrors(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // pageerror is an Error object
      pageErrors.push(err);
    });

    return { consoleMessages, pageErrors };
  }

  test.beforeEach(async ({ page }) => {
    // nothing global to set up beyond navigating inside each test
  });

  test.afterEach(async ({ page }) => {
    // Ensure any potential resources are cleaned up (Playwright closes pages automatically)
    await page.close();
  });

  test('Idle state (S0_Idle) is rendered correctly on load', async ({ page }) => {
    // This test validates the initial Idle state of the FSM:
    // - The page renders the demo button and trace area
    // - Button has expected attributes and text
    // - Trace shows the initial placeholder text
    const { consoleMessages, pageErrors } = await observeConsoleAndErrors(page);

    await page.goto(APP_URL);

    // Locate elements
    const runBtn = page.locator('#runDemoBtn');
    const trace = page.locator('#trace');

    // Assert the run demo button exists and is visible
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toHaveText('Run demo');

    // Check attributes mentioned in FSM evidence
    await expect(runBtn).toHaveAttribute('class', /demo/);
    await expect(runBtn).toHaveAttribute('aria-controls', 'trace');
    await expect(runBtn).toHaveAttribute('title', 'Run demonstration');

    // The trace area should be present and contain the initial placeholder
    await expect(trace).toBeVisible();
    await expect(trace).toContainText('(click "Run demo" to show a recorded linear-search trace)');

    // Accessibility-related attributes on trace (evidence / components)
    await expect(trace).toHaveAttribute('aria-live', 'polite');
    await expect(trace).toHaveAttribute('role', 'region');

    // Verify no unexpected page errors or console errors occurred during initial render
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `expected no console errors/warnings on initial load, got ${consoleErrors.length}`).toBe(0);
    expect(pageErrors.length, `expected no page errors on initial load, got ${pageErrors.length}`).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoRunning: clicking Run demo displays the recorded trace', async ({ page }) => {
    // This test validates the transition triggered by the RunDemoClick event:
    // - Clicking the #runDemoBtn executes runDemo() (entry action for S1_DemoRunning)
    // - The trace area is populated with the expected demonstration output
    // - No runtime exceptions are thrown during the demo
    const { consoleMessages, pageErrors } = await observeConsoleAndErrors(page);

    await page.goto(APP_URL);

    const runBtn = page.locator('#runDemoBtn');
    const trace = page.locator('#trace');

    // Click the button to start the demo (should be a one-time listener in the implementation)
    await runBtn.click();

    // Wait for the trace area to contain the known header produced by the script
    await expect(trace).toContainText('Linear Search Demonstration');

    // Validate core content from the demo output
    await expect(trace).toContainText('Array: [7, 3, 9, 2, 9, 5]');
    await expect(trace).toContainText('Search 1: key = 9');
    await expect(trace).toContainText('Search 2: key = 4');

    // Validate that the demonstration recorded the match in the first demo at index 2
    // The implementation prints: "    -> match found at index " + i + ". Stop."
    await expect(trace).toContainText('match found at index 2');

    // Validate that the second demo indicates not found and mentions return -1
    await expect(trace).toContainText('Key not found (return -1)');

    // Validate comparison counts produced by runDemo()
    // Implementation uses arr.indexOf(key1) + 1 => for key1=9 arr.indexOf(9)=2 so comparisons=3
    // and arr.length for search 2 => 6
    await expect(trace).toContainText('Comparisons performed for search 1: 3');
    await expect(trace).toContainText('Comparisons performed for search 2: 6');

    // Confirm the button still exists after clicking (listener was added with {once:true} but the element remains)
    await expect(runBtn).toBeVisible();

    // Assert there were no uncaught exceptions during demo run
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `expected no console errors/warnings when running demo, got ${consoleErrors.length}`).toBe(0);
    expect(pageErrors.length, `expected no page errors when running demo, got ${pageErrors.length}`).toBe(0);
  });

  test('Run demo is only executed once due to {once:true} listener: subsequent clicks do not change trace', async ({ page }) => {
    // This test validates the "once:true" behavior seen in the evidence:
    // - First click produces the demo output
    // - Subsequent clicks should NOT re-run the demo (trace should remain identical)
    const { consoleMessages, pageErrors } = await observeConsoleAndErrors(page);

    await page.goto(APP_URL);

    const runBtn = page.locator('#runDemoBtn');
    const trace = page.locator('#trace');

    // First click -> produce demo
    await runBtn.click();
    await expect(trace).toContainText('Linear Search Demonstration');

    // Capture the trace snapshot after first run
    const firstRunText = await trace.textContent();

    // Perform several additional clicks rapidly
    await runBtn.click();
    await runBtn.click();
    await runBtn.click();

    // Allow a short moment for any unexpected handlers to run if present
    await page.waitForTimeout(200);

    // Capture the trace after repeated clicks
    const afterClicksText = await trace.textContent();

    // The text should be identical because runDemo is attached with {once:true}
    expect(afterClicksText, 'trace changed after additional clicks, expected no change due to {once:true}').toBe(firstRunText);

    // No errors expected during repeated clicks
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `expected no console errors/warnings during repeated clicks, got ${consoleErrors.length}`).toBe(0);
    expect(pageErrors.length, `expected no page errors during repeated clicks, got ${pageErrors.length}`).toBe(0);
  });

  test('Edge-case: rapid multiple clicks in quick succession only triggers single demo output', async ({ page }) => {
    // This test tries to stress the click listener by triggering multiple click events
    // very quickly. Because the listener uses {once:true} it should only run the handler once.
    const { consoleMessages, pageErrors } = await observeConsoleAndErrors(page);

    await page.goto(APP_URL);

    const runBtn = page.locator('#runDemoBtn');
    const trace = page.locator('#trace');

    // Dispatching multiple clicks via Playwright's click sequentially is sufficient
    // to simulate rapid user clicks.
    const clickPromises = [];
    for (let i = 0; i < 10; i++) {
      clickPromises.push(runBtn.click().catch(() => {}));
    }
    await Promise.all(clickPromises);

    // Wait for the demo to populate if it ran
    await expect(trace).toContainText('Linear Search Demonstration');

    // Ensure the demo text appears only once (the content length should be consistent)
    const textAfter = await trace.textContent();
    // Check that header appears exactly once
    const occurrences = (textAfter.match(/Linear Search Demonstration/g) || []).length;
    expect(occurrences, 'expected the demo header to appear exactly once').toBe(1);

    // Confirm comparison counts are as expected (not multiplied by multiple runs)
    const occurrencesComp1 = (textAfter.match(/Comparisons performed for search 1: 3/g) || []).length;
    const occurrencesComp2 = (textAfter.match(/Comparisons performed for search 2: 6/g) || []).length;
    expect(occurrencesComp1, 'expected comparisons for search 1 to appear exactly once').toBe(1);
    expect(occurrencesComp2, 'expected comparisons for search 2 to appear exactly once').toBe(1);

    // No runtime exceptions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `expected no console errors/warnings during rapid clicks, got ${consoleErrors.length}`).toBe(0);
    expect(pageErrors.length, `expected no page errors during rapid clicks, got ${pageErrors.length}`).toBe(0);
  });

  test('Observes console and page error streams (reporting)', async ({ page }) => {
    // This test focuses on collecting console and page errors and asserting their absence.
    // Per requirements we observe and assert the runtime status rather than patching anything.
    const { consoleMessages, pageErrors } = await observeConsoleAndErrors(page);

    await page.goto(APP_URL);

    // No user action taken; ensure still no errors on load
    await page.waitForTimeout(100); // brief idle to catch asynchronous errors if any

    // Provide a useful diagnostic assertion: no page errors, and no console errors
    const consoleErrorEntries = consoleMessages.filter(m => m.type === 'error');
    const consoleWarningEntries = consoleMessages.filter(m => m.type === 'warning');

    expect(pageErrors.length, `expected no page errors, found: ${pageErrors.length}`).toBe(0);
    expect(consoleErrorEntries.length, `expected no console.error messages, found: ${consoleErrorEntries.length}`).toBe(0);

    // Warnings may be present in some environments; fail if there are warnings
    expect(consoleWarningEntries.length, `expected no console warnings, found: ${consoleWarningEntries.length}`).toBe(0);
  });
});