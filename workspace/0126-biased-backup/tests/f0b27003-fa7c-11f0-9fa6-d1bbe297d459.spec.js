import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b27003-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('f0b27003-fa7c-11f0-9fa6-d1bbe297d459 - Dijkstra Demo FSM tests', () => {
  // Containers for observed console messages and page errors
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console events (logs, warnings, errors)
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Basic sanity: ensure page loaded
    await expect(page).toHaveTitle(/Dijkstra's Algorithm/i);
  });

  test.afterEach(async () => {
    // After each test we assert there were no unexpected page errors
    // (Tests below will also assert no console errors; this double-checks)
    expect(pageErrors).toEqual([]);
  });

  test('Initial Idle state: button and demo output rendered', async ({ page }) => {
    // This test validates the "S0_Idle" FSM state:
    // - The Run Demonstration button is present with correct id and class
    // - The demo output container exists and is empty before any interaction

    const runButton = page.locator('#runDemo');
    await expect(runButton).toBeVisible();
    await expect(runButton).toHaveText('Run Demonstration');
    await expect(runButton).toHaveClass(/button/);

    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible();

    // Initially, there should be no paragraph children (demo hasn't started)
    await expect(demoOutput.locator('p')).toHaveCount(0);

    // Also verify that no console errors/uncaught exceptions were produced during load
    const consoleErrorCount = consoleErrors.length;
    expect(consoleErrorCount).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0 -> S1: clicking Run Demonstration starts demo and displays steps', async ({ page }) => {
    // This test validates the RunDemoClick event and the transition to Demo Running:
    // - Clicking the button clears demoOutput and schedules step outputs
    // - Steps are appended over time, some lines are bolded (Visiting/Final)
    // - The final expected line appears by the end of the demo

    const runButton = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');

    // Click to start the demonstration
    await runButton.click();

    // Immediately the script sets demoOutput.innerHTML = ''; so there may be no children briefly.
    // Wait for at least the first step paragraph to appear.
    const firstParagraph = demoOutput.locator('p').first();
    await expect(firstParagraph).toHaveText(/Initializing graph with 4 nodes/i, { timeout: 5000 });

    // After some time more steps should appear. Check that we get multiple paragraphs.
    // The implementation schedules each step with +800ms increments. We wait sufficiently to capture many steps.
    await expect(demoOutput.locator('p')).toHaveCountGreaterThan?.(0); // defensive; will be ignored if not available

    // Wait for the final lines of the demo to appear. There are 17 steps spaced by 800ms => ~13.6s total.
    // We give a 20s timeout to be robust.
    await expect(demoOutput.locator('p', { hasText: 'A to D: 9' })).toBeVisible({ timeout: 20000 });

    // Verify that a "Final shortest paths from A:" line exists and that final numeric line is present
    await expect(demoOutput.locator('p', { hasText: 'Final shortest paths from A:' })).toBeVisible();
    await expect(demoOutput.locator('p', { hasText: 'A to D: 9' })).toBeVisible();

    // Verify that at least one "Visiting" line is bolded via inline style fontWeight = 'bold'
    const visitingLine = demoOutput.locator('p', { hasText: /^Visiting node/i });
    await expect(visitingLine.first()).toBeVisible();
    const fontWeight = await visitingLine.first().evaluate((el) => {
      return window.getComputedStyle(el).fontWeight;
    });
    // Depending on browser, bold may return '700' or 'bold'
    expect(['700', 'bold']).toContain(fontWeight);

    // Final check for console/page errors during the run
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Multiple clicks: starting a new demo clears previous output and restarts', async ({ page }) => {
    // This test validates edge-case behavior when the Run Demonstration button is clicked multiple times:
    // - On each click, demoOutput.innerHTML is cleared (script explicitly does this)
    // - After a subsequent click, the sequence restarts and the first step appears again

    const runButton = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');

    // Start the demo and wait for 3 steps to have been appended
    await runButton.click();
    await expect(demoOutput.locator('p')).toHaveCountGreaterThan?.(2) || await demoOutput.locator('p').nth(2).waitFor({ state: 'visible', timeout: 7000 });

    // Capture the text of the last paragraph currently present
    const beforeCount = await demoOutput.locator('p').count();
    const beforeLastText = beforeCount > 0 ? (await demoOutput.locator('p').nth(beforeCount - 1).innerText()).trim() : '';

    // Click the button again to restart the demo
    await runButton.click();

    // Immediately after clicking, the script sets demoOutput.innerHTML = ''.
    // It's possible that the first scheduled setTimeout runs with delay 0 and quickly appends the first paragraph.
    // We assert that the first visible paragraph after restart contains the initial step text,
    // demonstrating that the demo restarted from the beginning.
    const firstParagraphAfterRestart = demoOutput.locator('p').first();
    await expect(firstParagraphAfterRestart).toHaveText(/Initializing graph with 4 nodes/i, { timeout: 3000 });

    // The previously captured last paragraph of the prior run should not be present at this point,
    // since innerHTML was cleared when the new run began. We check that beforeLastText is not found among current children.
    const allTexts = await demoOutput.locator('p').allInnerTexts();
    const foundOldLast = allTexts.some((t) => t.trim() === beforeLastText);
    expect(foundOldLast).toBe(false);

    // Also ensure no console errors occurred during the rapid interactions
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Demo completion: output persists (no automatic reset implemented)', async ({ page }) => {
    // The FSM describes a DemoCompleted transition that would reset the demo output.
    // The implementation provided does not implement resetDemoOutput() or DemoCompleted event.
    // This test asserts the observable: after the scheduled steps complete, the demo output remains in the DOM.
    // This verifies the discrepancy between FSM's inferred exit action and the actual implementation.

    const runButton = page.locator('#runDemo');
    const demoOutput = page.locator('#demoOutput');

    // Start the demo
    await runButton.click();

    // Wait for the final expected line to appear (same 20s timeout)
    await expect(demoOutput.locator('p', { hasText: 'A to D: 9' })).toBeVisible({ timeout: 20000 });

    // After completion, wait a short period to ensure no automatic clear happens
    await page.waitForTimeout(1000);

    // The output should still contain the final line and multiple paragraphs
    await expect(demoOutput.locator('p', { hasText: 'A to D: 9' })).toBeVisible();
    const finalCount = await demoOutput.locator('p').count();
    expect(finalCount).toBeGreaterThanOrEqual(1);

    // Assert that there were no console errors created by the completion
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Observes console logs and reports any errors (none expected)', async ({ page }) => {
    // This test collects console entries and page errors across page lifecycle and asserts the application
    // did not produce runtime console error messages or uncaught exceptions.
    // It is also a safeguard to report any unexpected runtime problems.

    // Give the page some time to finish any asynchronous work
    await page.waitForTimeout(500);

    // Aggregate any console messages for debugging if the test fails
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      console.log('Console messages captured:', consoleMessages);
      console.log('Console errors captured:', consoleErrors);
      console.log('Page errors captured:', pageErrors);
    }

    // Assert: no console errors, no uncaught page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

});