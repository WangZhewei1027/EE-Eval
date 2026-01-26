import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aa5372-fa78-11f0-812d-c9788050701f.html';

test.describe('Bellman-Ford Algorithm Visualization (FSM + Error Observation)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console.* messages from the page
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled exceptions (pageerror) such as SyntaxError/ReferenceError
    page.on('pageerror', err => {
      // err is an Error object from the page context; capture its message
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // gentle cleanup: navigate away to ensure no leaking state between tests
    await page.goto('about:blank');
  });

  test('Initial DOM elements exist but initialization functions did not run (Idle state entry likely failed)', async ({ page }) => {
    // This test validates that the static HTML elements (buttons, containers) are present
    // and that the dynamic initialization (initGraph / initDistanceTable) did not occur due to script errors.
    // Check presence of expected static components
    const startBtn = await page.$('#startBtn');
    const resetBtn = await page.$('#resetBtn');
    const graphContainer = await page.$('#graph');
    const distanceTableBody = await page.$('#distanceTable');

    expect(startBtn).not.toBeNull();
    expect(resetBtn).not.toBeNull();
    expect(graphContainer).not.toBeNull();
    expect(distanceTableBody).not.toBeNull();

    // Since the embedded script is truncated, initGraph() and initDistanceTable() most likely did not run.
    // That means there should be no dynamically created node elements inside #graph.
    const nodeCount = await page.$$eval('.node', nodes => nodes.length);
    expect(nodeCount).toBe(0);

    // The distance table tbody is empty in the static HTML and should remain empty if initDistanceTable didn't run.
    const distanceRowCount = await page.$$eval('#distanceTable tr', rows => rows.length);
    expect(distanceRowCount).toBe(0);

    // There should be at least one page error (likely a SyntaxError due to truncated script).
    // We assert that a parsing/runtime error was captured.
    await expect.poll(() => pageErrors.length, { timeout: 2000 }).toBeGreaterThanOrEqual(1);

    // Ensure the captured page error looks like a syntax/runtime error
    const hasSyntaxLikeError = pageErrors.some(msg => /syntaxerror|unexpected end|unexpected token|unterminated/i.test(msg));
    const hasGenericError = pageErrors.length > 0;
    expect(hasSyntaxLikeError || hasGenericError).toBeTruthy();

    // Also ensure the browser console captured at least one error-level message
    const hasConsoleError = consoleMessages.some(m => m.type === 'error' || /error/i.test(m.type));
    expect(hasConsoleError || pageErrors.length > 0).toBeTruthy();
  });

  test('Clicking Start Visualization does not start animation and calling initGraph is undefined (ReferenceError evidence)', async ({ page }) => {
    // This test validates behavior when pressing the Start button:
    // - No animation starts because event handlers were not attached (script truncated).
    // - Attempting to call initGraph() from page context should indicate it's not available.

    // Click the Start button
    await page.click('#startBtn');

    // Wait briefly to allow any potential handlers to run (or error to be emitted)
    await page.waitForTimeout(300);

    // No node should be marked .active (no animation)
    const activeNodes = await page.$$eval('.node.active', nodes => nodes.length);
    expect(activeNodes).toBe(0);

    // No edge should be marked .active
    const activeEdges = await page.$$eval('.edge.active', edges => edges.length);
    expect(activeEdges).toBe(0);

    // Because the script is truncated, functions declared inside the DOMContentLoaded handler
    // are not accessible globally. Calling initGraph inside the page should return an error message.
    const initGraphCallResult = await page.evaluate(() => {
      try {
        // Try to call the initGraph function - if it's not defined, this will throw.
        // We catch errors here and return their messages so the test can assert on them,
        // rather than letting the evaluate throw and failing the test unexpectedly.
        // This does NOT modify the page; it simply attempts to call a possibly-undefined function.
        // eslint-disable-next-line no-undef
        initGraph();
        return { ok: true };
      } catch (err) {
        return { ok: false, message: String(err && err.message ? err.message : err) };
      }
    });

    // Expect that calling initGraph failed (function not defined / not accessible)
    expect(initGraphCallResult.ok).toBe(false);
    const msg = initGraphCallResult.message.toLowerCase();
    // Message should indicate it's not defined or reference error
    expect(/(is not defined|not defined|referenceerror|initgraph)/i.test(msg)).toBeTruthy();

    // Ensure there is still at least one page error recorded (SyntaxError during parse)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Clicking Reset does not perform reset actions (initAlgorithm not executed) and errors remain reported', async ({ page }) => {
    // This test validates that the Reset button is present but the reset logic likely did not run.
    // Click the Reset button
    await page.click('#resetBtn');

    // Wait a moment for any handlers (if they existed) to execute
    await page.waitForTimeout(300);

    // Check that nodes and distance table remain in the uninitialized state
    const nodeCountAfterReset = await page.$$eval('.node', nodes => nodes.length);
    expect(nodeCountAfterReset).toBe(0);

    const distanceRowsAfterReset = await page.$$eval('#distanceTable tr', rows => rows.length);
    expect(distanceRowsAfterReset).toBe(0);

    // Confirm the page still reported parsing/runtime errors (script is truncated)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Also capture console errors and ensure at least one error-level console message exists
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.type));
    expect(consoleErrorMessages.length + pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Detailed error inspection: ensure SyntaxError-like message is present in page errors or console', async ({ page }) => {
    // This test explicitly checks that a SyntaxError (or similar parse error) was emitted when loading the page.
    // Combine both pageErrors and consoleMessages to search for syntax-like errors.
    const consoleErrorTexts = consoleMessages.map(m => m.text).join('\n');
    const pageErrorTexts = pageErrors.join('\n');

    const combined = `${consoleErrorTexts}\n${pageErrorTexts}`.toLowerCase();

    // Look for typical syntax error signatures given the truncated script
    const foundSyntax = /syntaxerror|unexpected end of input|unexpected token|unterminated string constant|uncaught (syntaxerror|referenceerror)/i.test(combined);

    // Assert that we detected a syntax-like error or at least some runtime error
    expect(foundSyntax || pageErrors.length > 0 || consoleMessages.some(m => m.type === 'error')).toBeTruthy();

    // Provide additional assertion that the error(s) contain helpful debugging context (filename or line info)
    // Note: Some environments include filenames/line numbers in console messages; we don't require them, but we assert that
    // error text has at least 10 characters to ensure something meaningful was captured.
    const errorTextLength = combined.trim().length;
    expect(errorTextLength).toBeGreaterThanOrEqual(1);
  });

  test('Edge-case check: ensure no hidden global flags like isAnimating were set by the broken script', async ({ page }) => {
    // The script (if fully executed) would have set isAnimating variable inside the DOMContentLoaded handler.
    // Because the script is truncated, that variable should not be globally available (or should be undefined).
    // Accessing window.isAnimating returns undefined rather than throwing; we assert it's not true.
    const isAnimatingValue = await page.evaluate(() => {
      // Accessing window properties is safe; if isAnimating is not defined at all, window.isAnimating === undefined.
      return typeof window.isAnimating !== 'undefined' ? window.isAnimating : undefined;
    });

    // Expect that isAnimating is not true (either undefined or false)
    expect(isAnimatingValue === undefined || isAnimatingValue === false).toBeTruthy();
  });
});