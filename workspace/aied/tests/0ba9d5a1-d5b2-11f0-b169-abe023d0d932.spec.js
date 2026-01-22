import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba9d5a1-d5b2-11f0-b169-abe023d0d932.html';

test.describe('Bellman-Ford Algorithm - FSM and runtime validation', () => {
  let pageErrors;
  let consoleMessages;

  // Attach listeners before navigation so we capture errors emitted during initial script execution.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture unhandled page errors (exceptions thrown in page context)
    page.on('pageerror', (err) => {
      // store Error object (has message, stack)
      pageErrors.push(err);
    });

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      // store text for easier assertions
      try {
        consoleMessages.push(msg.text());
      } catch {
        consoleMessages.push(String(msg));
      }
    });

    // Navigate to the application page. Listeners are already attached.
    await page.goto(APP_URL);
    // Wait a short moment to allow any async console messages/errors to flush
    await page.waitForTimeout(200);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: remove listeners to avoid cross-test leakage (Playwright isolates pages per test,
    // but explicit cleanup is good practice).
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test('S0_Idle: initial render - header and canvas present (renderPage entry_action)', async ({ page }) => {
    // This validates the Idle state's evidence: the page rendered and header is present.
    // Assert the main title exists and matches expected content from FSM evidence.
    const header = page.locator('h1');
    await expect(header).toBeVisible();
    await expect(header).toHaveText('Bellman-Ford Algorithm');

    // Validate the graph container and canvas exist in the DOM (visual elements rendered).
    const graphDiv = page.locator('#graph');
    await expect(graphDiv).toBeVisible();

    const canvas = page.locator('#graph-canvas');
    await expect(canvas).toBeVisible();

    // Sanity: ensure the graph container has expected inline style border (from provided HTML).
    const border = await graphDiv.evaluate((el) => window.getComputedStyle(el).border);
    expect(border).toBeTruthy();
  });

  test('S1_Calculating: bellmanFord() exists and its automatic execution produced a runtime error (entry_action executed)', async ({ page }) => {
    // Validate that bellmanFord is defined as a function on the page (the function is present in the script).
    const typeofBellmanFord = await page.evaluate(() => typeof bellmanFord);
    expect(typeofBellmanFord).toBe('function');

    // The FSM indicates bellmanFord(graph, sourceVertex) is executed on entering Calculating.
    // The page's script is known to have issues that cause a runtime TypeError during destructuring of the return.
    // Assert that the page emitted at least one unhandled exception.
    expect(pageErrors.length).toBeGreaterThan(0);

    // Look for a TypeError / "not iterable" message which is expected given the implementation:
    // the function returns "distance, predecessor" (comma operator) yielding a non-iterable predecessor object,
    // and code attempts: let [distances, predecessor] = bellmanFord(...);
    const messages = pageErrors.map((e) => (e && e.message) ? e.message : String(e));
    const matched = messages.find((m) => /not iterable|TypeError|is not iterable|not iterable\./i.test(m));
    expect(matched).toBeTruthy();
  });

  test('Transition S1 -> S2: Results entry_action (console.log(result)) should NOT be executed due to earlier error', async ({ page }) => {
    // The FSM specifies console.log(result) as the entry action for the Results state.
    // Because a runtime error occurs during the automatic calculation, we expect no "Vertex ..." output in console logs.
    // Assert that none of the captured console messages contain typical result lines ("Vertex <n>").
    const hasVertexOutput = consoleMessages.some((m) => /Vertex\s+\d|Vertex\s+[A-Za-z]|has infinite distance/i.test(m));
    expect(hasVertexOutput).toBeFalsy();

    // Additionally assert that there was at least one page error preventing the result logging.
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  test('Error diagnostics and environment after failure: globals and types', async ({ page }) => {
    // After the failed destructuring, check the global variables' types to verify how the script left the environment.
    // The HTML declares global `distances` and `predecessor` before the function; the failed destructuring should not have turned them into arrays.

    const globals = await page.evaluate(() => {
      return {
        distancesType: typeof distances,
        isDistancesArray: Array.isArray(distances),
        predecessorType: typeof predecessor,
        isPredecessorArray: Array.isArray(predecessor),
        // Was the result string ever defined as a global variable? (script declares `let result = "";` after destructuring)
        hasResult: typeof result !== 'undefined',
      };
    });

    // The global distances declared at top was an object ({}), not an array. The destructuring would have failed before reassigning distances.
    expect(globals.distancesType).toBe('object');
    expect(globals.isDistancesArray).toBe(false);

    // The predecessor should remain an object as originally declared.
    expect(globals.predecessorType).toBe('object');
    expect(globals.isPredecessorArray).toBe(false);

    // Because the script failed during the destructuring assignment, the subsequent `result` variable and its console.log
    // are unlikely to have been defined/executed. We expect `result` to be undefined in the global scope.
    expect(globals.hasResult).toBe(false);
  });

  test('Edge case assertion: verify the runtime error details are descriptive (stack/message exist)', async ({ page }) => {
    // Ensure captured page errors include stack traces or messages that help identify the failure.
    expect(pageErrors.length).toBeGreaterThan(0);
    const err = pageErrors[0];
    // Error objects should have message and stack properties; assert they are non-empty strings.
    expect(typeof err.message).toBe('string');
    expect(err.message.length).toBeGreaterThan(0);

    // Stack may be engine-specific; if present, it should be a non-empty string.
    if (typeof err.stack === 'string') {
      expect(err.stack.length).toBeGreaterThan(0);
    }
  });

  test('Sanity check: confirm no result printed to console and no silent success', async ({ page }) => {
    // Double-check that the result logging from the script did not occur.
    // The expected successful output would include lines like "Vertex 0" or "has infinite distance".
    const resultPrinted = consoleMessages.some((m) => /Vertex\s+\d|has infinite distance|Vertex\s+/.test(m));
    expect(resultPrinted).toBe(false);

    // Also ensure there are no console logs indicating success (no "result" content).
    const genericResultLog = consoleMessages.some((m) => /Vertex\s+|distance|:\s*\d/.test(m));
    expect(genericResultLog).toBe(false);
  });
});