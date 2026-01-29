import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3bd9a4-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('DFS Visualization - FSM validation (de3bd9a4-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Hold captured page errors and console errors for assertions
  let pageErrors;
  let consoleErrors;

  // Setup before each test: open the app and attach listeners to capture runtime errors and console.error messages.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught exceptions from the page (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object from the page context
      pageErrors.push(err);
    });

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the provided HTML page
    await page.goto(APP_URL);
    // Wait a short while to allow any synchronous parsing/runtime errors to surface and be captured.
    await page.waitForTimeout(250);
  });

  // Teardown is handled by Playwright fixtures; listeners are per-page and will be discarded.

  test('Initial Idle state: DOM elements present and default info displayed', async ({ page }) => {
    // This test validates the initial "Idle" state per FSM:
    // - Buttons exist (#start-dfs, #reset)
    // - Info spans show default values
    // - Graph container exists but likely empty due to truncated script
    // - Also assert that page/runtime errors occurred during load (we expect parsing/runtime errors from the truncated script)

    // Verify title and header render
    await expect(page.locator('h1')).toHaveText(/Depth-First Search/i);

    // Verify control buttons are present and visible
    const startBtn = page.locator('#start-dfs');
    const resetBtn = page.locator('#reset');
    await expect(startBtn).toBeVisible();
    await expect(resetBtn).toBeVisible();

    // Verify info elements show the expected initial values (evidence from FSM and HTML)
    const stepInfo = page.locator('#step-info');
    const stackInfo = page.locator('#stack-info');
    const visitedInfo = page.locator('#visited-info');

    await expect(stepInfo).toHaveText('Not started');
    await expect(stackInfo).toHaveText('[]');
    await expect(visitedInfo).toHaveText('[]');

    // Graph container should exist
    const graphContainer = page.locator('#graph-container');
    await expect(graphContainer).toBeVisible();

    // Because the provided HTML/JS is truncated, the script likely failed.
    // Assert that at least one page-level error or console.error was captured during page load.
    expect(pageErrors.length + consoleErrors.length).toBeGreaterThanOrEqual(1);

    // Make some informative assertions about the captured errors: they should have a message or text.
    if (pageErrors.length > 0) {
      // Ensure captured page error has a non-empty message
      expect(typeof pageErrors[0].message).toBe('string');
      expect(pageErrors[0].message.length).toBeGreaterThan(0);
    }
    if (consoleErrors.length > 0) {
      expect(typeof consoleErrors[0]).toBe('string');
      expect(consoleErrors[0].length).toBeGreaterThan(0);
    }

    // Because the script likely failed before rendering nodes, ensure graph container has no node children
    const nodeCount = await page.locator('#graph-container .node').count();
    expect(nodeCount).toBe(0);
  });

  test('StartDFS event: invoking start sequence should fail due to missing/broken script (expect error)', async ({ page }) => {
    // This test attempts to trigger the StartDFS transition.
    // Because the page's JS is incomplete, calling startDFS() should raise an error (ReferenceError or similar).
    // We intentionally call the function in page context (without try/catch) and assert the evaluation is rejected.

    // Clear previous captured errors
    pageErrors.length = 0;
    consoleErrors.length = 0;

    // Attempt to programmatically invoke the startDFS function as the FSM's onEnter would do.
    // We expect page.evaluate to reject because startDFS is not defined (or script failed), which lets a ReferenceError or similar surface.
    await expect(page.evaluate(() => {
      // Intentionally call the page function as-is; if it's missing this will throw in page context
      // and bubble up to Playwright as a rejected promise / pageerror.
      // NOTE: We do NOT catch this error here to allow the runtime error to be observed per requirements.
      return startDFS();
    })).rejects.toThrow();

    // Also attempt clicking the Start button (in case click handlers were attached before the error).
    // Clicking may do nothing if handlers were not attached; the primary assertion is that calling startDFS failed.
    await page.click('#start-dfs');

    // Wait briefly to collect any additional page errors emitted due to the attempted call/click
    await page.waitForTimeout(200);

    // Ensure that at least one runtime page error was captured during the test (ReferenceError / TypeError / SyntaxError)
    expect(pageErrors.length + consoleErrors.length).toBeGreaterThanOrEqual(1);

    // After the failed start, confirm that the visible step info remains at the idle value.
    await expect(page.locator('#step-info')).toHaveText('Not started');

    // Stack and visited info should remain unchanged
    await expect(page.locator('#stack-info')).toHaveText('[]');
    await expect(page.locator('#visited-info')).toHaveText('[]');
  });

  test('Reset event: invoking reset sequence should fail due to missing/broken script (expect error)', async ({ page }) => {
    // This test attempts to trigger the Reset transition.
    // Because the page's JS is incomplete, calling resetDFS() should raise an error (ReferenceError or similar).

    // Clear previously captured errors
    pageErrors.length = 0;
    consoleErrors.length = 0;

    // Attempt to programmatically invoke resetDFS in the page context (no catch)
    await expect(page.evaluate(() => {
      return resetDFS();
    })).rejects.toThrow();

    // Also click the Reset button (in case the UI had bound handlers prior to script failure)
    await page.click('#reset');

    // Allow time for any errors to be emitted and captured
    await page.waitForTimeout(200);

    // Verify that runtime errors were captured
    expect(pageErrors.length + consoleErrors.length).toBeGreaterThanOrEqual(1);

    // After the failed reset attempt, ensure the UI remains in the Idle state's expected final values
    await expect(page.locator('#step-info')).toHaveText('Not started');
    await expect(page.locator('#stack-info')).toHaveText('[]');
    await expect(page.locator('#visited-info')).toHaveText('[]');
  });

  test('Edge case: calling undefined functions directly in page context surfaces ReferenceError (explicit check)', async ({ page }) => {
    // This test explicitly demonstrates that invoking functions which are not defined on the page raises a ReferenceError.
    // We capture the thrown object from Playwright's rejection and assert that its message contains likely ReferenceError text.
    // Note: exact wording can vary across environments, so we assert that the evaluation fails.

    let evalError = null;
    try {
      // Call a clearly undefined function name
      await page.evaluate(() => nonExistentFunctionForTest123());
    } catch (err) {
      evalError = err;
    }

    // Ensure an error was thrown
    expect(evalError).not.toBeNull();

    // The thrown error message should be a non-empty string; it's environment-dependent whether it references "ReferenceError"
    expect(typeof evalError.message).toBe('string');
    expect(evalError.message.length).toBeGreaterThan(0);

    // Also ensure at least one pageerror was captured by the page error listener
    expect(pageErrors.length + consoleErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Sanity check: ensure the page did not silently transition to "DFS Running" or "Completed"', async ({ page }) => {
    // This verifies that due to script truncation, the FSM transitions did not occur automatically.
    // We check that UI elements that would indicate running/completed states are not present/changed.

    // FSM expected observables when running might be '...' text in step-info and non-empty stack/visited info.
    const stepText = await page.locator('#step-info').textContent();
    const stackText = await page.locator('#stack-info').textContent();
    const visitedText = await page.locator('#visited-info').textContent();

    // They should remain idle/default values from the provided HTML, not changed to running/completed markers.
    expect(stepText).toBe('Not started');
    expect(stackText).toBe('[]');
    expect(visitedText).toBe('[]');

    // Ensure no nodes were rendered into the graph-container (nodes would indicate visualization started)
    const nodeCount1 = await page.locator('#graph-container .node').count();
    expect(nodeCount).toBe(0);
  });
});