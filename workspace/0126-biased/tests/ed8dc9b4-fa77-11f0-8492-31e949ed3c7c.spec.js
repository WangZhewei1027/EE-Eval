import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8dc9b4-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Floyd-Warshall Visualization - FSM states and transitions', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events and record error-level messages
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location ? msg.location() : undefined,
          });
        }
      } catch (e) {
        // swallow listener errors (shouldn't happen)
      }
    });

    // Capture any uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });

    // Navigate to the app page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // nothing to teardown manually here; page fixture handled by Playwright
  });

  test('S0_Idle: on load the initial graph is drawn and distance matrix is defined', async ({ page }) => {
    // This test validates the Idle initial state:
    // - drawGraph() is executed on load (we assert canvas has some drawing)
    // - the global `distance` matrix exists and equals the initial adjacency graph

    // Ensure the start button and canvas exist
    const startBtn = await page.$('#startBtn');
    expect(startBtn).not.toBeNull();

    const canvas = await page.$('#canvas');
    expect(canvas).not.toBeNull();

    // Check canvas dimensions match attributes
    const width = await page.evaluate(() => document.getElementById('canvas').width);
    const height = await page.evaluate(() => document.getElementById('canvas').height);
    expect(width).toBe(600);
    expect(height).toBe(600);

    // Grab the canvas data URL to ensure something was drawn on load.
    const dataUrlBefore = await page.evaluate(() => document.getElementById('canvas').toDataURL());
    // The data URL for a blank canvas is non-empty but we assert that it is a PNG data URL.
    expect(dataUrlBefore.startsWith('data:image/png')).toBeTruthy();
    // Expect the data URL to have a reasonable length (> 1000). This guards against completely blank or tiny outputs.
    expect(dataUrlBefore.length).toBeGreaterThan(1000);

    // Verify the `distance` global exists and matches the initial graph from the HTML.
    const distance = await page.evaluate(() => window.distance);
    const expectedInitial = [
      [0, 3, 8, Infinity, -4],
      [Infinity, 0, Infinity, 1, 7],
      [Infinity, 4, 0, Infinity, Infinity],
      [2, Infinity, -5, 0, Infinity],
      [Infinity, Infinity, Infinity, 6, 0],
    ];
    expect(distance).toEqual(expectedInitial);

    // Assert no uncaught page errors occurred during initial load
    expect(pageErrors).toEqual([]);
    // Assert there were no console.error messages during load
    expect(consoleErrors).toEqual([]);
  });

  test('Transition S0_Idle -> S1_Visualizing: clicking Start Visualization runs Floyd-Warshall and updates distances', async ({ page }) => {
    // This validates the transition:
    // - clicking #startBtn triggers floydWarshall()
    // - the global distance matrix is mutated to the final shortest-path distances
    // - the canvas is updated (dataURL changes)
    // - no uncaught page errors occur during the algorithm run

    // Capture canvas image before starting visualization
    const beforeDataUrl = await page.evaluate(() => document.getElementById('canvas').toDataURL());

    // Ensure initial distance matrix exists
    const initialDistance = await page.evaluate(() => window.distance);
    expect(initialDistance[0][0]).toBe(0); // quick sanity check

    // Click the start button to run floydWarshall()
    await page.click('#startBtn');

    // After clicking, floydWarshall is synchronous in this app; we can immediately read the distance matrix
    const afterDistance = await page.evaluate(() => window.distance);

    // Expected final distances matrix derived from the algorithm (classic example)
    const expectedFinal = [
      [0, 1, -3, 2, -4],
      [3, 0, -4, 1, -1],
      [7, 4, 0, 5, 3],
      [2, -1, -5, 0, -2],
      [8, 5, 1, 6, 0],
    ];

    expect(afterDistance).toEqual(expectedFinal);

    // Confirm that the canvas has changed after visualization (some redraws should have occurred)
    const afterDataUrl = await page.evaluate(() => document.getElementById('canvas').toDataURL());
    expect(afterDataUrl).toBeTruthy();
    // The data URL should differ from the data URL captured prior to visualization
    expect(afterDataUrl).not.toEqual(beforeDataUrl);

    // No uncaught errors should have happened during the run
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Idempotence and re-click behavior: clicking Start Visualization multiple times does not throw and results remain stable', async ({ page }) => {
    // This test validates an edge-case transition: starting an already-completed visualization
    // - The floydWarshall function should not throw when invoked again
    // - The final distance matrix should remain the same after subsequent clicks

    // Run the algorithm once
    await page.click('#startBtn');
    const firstFinal = await page.evaluate(() => window.distance);

    // Click again - should be safe and deterministic
    await page.click('#startBtn');
    const secondFinal = await page.evaluate(() => window.distance);

    // The matrix should be unchanged by the second run
    expect(secondFinal).toEqual(firstFinal);

    // Ensure no page errors or console errors occurred
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge-case: validate that functions and globals exist and are callable (without patching)', async ({ page }) => {
    // This test asserts existence of the main functions and variables as implemented in the page.
    // According to the CRITICAL constraints we must not modify or patch any globals — we only observe.

    const hasDrawGraph = await page.evaluate(() => typeof window.drawGraph === 'function');
    const hasFloyd = await page.evaluate(() => typeof window.floydWarshall === 'function');
    const hasCanvas = await page.evaluate(() => !!document.getElementById('canvas'));
    const hasStartBtn = await page.evaluate(() => !!document.getElementById('startBtn'));

    expect(hasDrawGraph).toBeTruthy();
    expect(hasFloyd).toBeTruthy();
    expect(hasCanvas).toBeTruthy();
    expect(hasStartBtn).toBeTruthy();

    // Also ensure that invoking these functions (read-only observation) doesn't throw when invoked through the page.
    // We will call drawGraph() which should redraw the canvas. This is allowed because we are not modifying the code.
    await page.evaluate(() => {
      // call drawGraph once more as an observation (function is synchronous). If it throws, the pageerror listener will capture it.
      window.drawGraph();
    });

    // Confirm no page errors or console error messages were produced by this invocation
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Observability: capture any console.error or uncaught exceptions if they occur (fail test if present)', async ({ page }) => {
    // This test is explicit about observing console errors and page errors. It will fail if any such errors occurred.
    // It ensures the runtime environment didn't generate ReferenceError/SyntaxError/TypeError etc.

    // At this point the page has loaded in beforeEach. We assert that no page-level errors were recorded.
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    // For additional safety, perform a click and re-check
    await page.click('#startBtn');
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});