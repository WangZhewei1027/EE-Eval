import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324dfc00-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe("Kruskal's Algorithm Visualization (Application ID: 324dfc00-fa73-11f0-a9d0-d7a1991987c6)", () => {
  // Keep track of any uncaught page errors reported by the page.
  let pageErrors = [];
  // Keep recent console messages (for debugging/assertions).
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture page errors and console messages for assertions.
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    page.on('console', async msg => {
      // Record simple string text for quick assertions and full args for deeper checks.
      try {
        const args = [];
        for (const arg of msg.args()) {
          // Attempt to stringify arg value where possible.
          try {
            args.push(await arg.jsonValue());
          } catch {
            // If jsonValue fails (e.g., functions), fallback to .toString()
            try {
              args.push(String(arg));
            } catch {
              args.push(undefined);
            }
          }
        }
        consoleMessages.push({ type: msg.type(), text: msg.text(), args });
      } catch (e) {
        // If any unexpected error occurs while processing console, still record raw text.
        consoleMessages.push({ type: msg.type(), text: msg.text(), args: [] });
      }
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No global teardown required beyond Playwright's default.
  });

  test('Initial Idle state: page renders canvas and Run button; renderPage() is not defined (FSM entry action missing)', async ({ page }) => {
    // Validate the page title is present
    await expect(page.locator('h1')).toHaveText(/Kruskal's Algorithm Visualization/);

    // Verify the canvas exists and has the expected attributes
    const canvas = page.locator('#canvas');
    await expect(canvas).toHaveCount(1);
    expect(await canvas.getAttribute('width')).toBe('600');
    expect(await canvas.getAttribute('height')).toBe('400');

    // Verify the button matching the FSM component exists and has correct text
    const runButton = page.locator("button[onclick='runKruskal()']");
    await expect(runButton).toHaveCount(1);
    await expect(runButton).toHaveText("Run Kruskal's Algorithm");

    // Verify that renderPage (an FSM-specified entry action) is not defined in the page.
    // This checks that the implementation does not provide the expected renderPage function.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // Attempt to call renderPage() in the page context to let a ReferenceError occur naturally.
    // We capture whether a ReferenceError was thrown during the evaluation.
    const callResult = await page.evaluate(() => {
      try {
        // This will throw since renderPage is not defined.
        // We intentionally do not define or patch anything on the page.
        // This mirrors the FSM expectation and checks for the natural ReferenceError.
        renderPage(); // eslint-disable-line no-undef
        return { threw: false };
      } catch (err) {
        // Return the error name so the test can assert it is a ReferenceError.
        return { threw: true, name: err && err.name, message: String(err) };
      }
    });

    expect(callResult.threw).toBe(true);
    // In most browsers missing global function call yields ReferenceError.
    expect(['ReferenceError', 'TypeError']).toContain(callResult.name);

    // Ensure no unexpected page errors aside from our intentional call that was caught inside evaluate.
    // Note: the above evaluate handled the exception and did not surface an uncaught pageerror event.
    expect(pageErrors.length).toBe(0);
  });

  test('RunKruskal transition: clicking the button sorts edges, performs unions, draws MST, and logs result', async ({ page }) => {
    // Prepare to wait for the console message that contains 'Minimum Spanning Tree:'
    let mstConsoleMessage = null;
    const consoleListener = (msg) => {
      if (msg.text && msg.text.includes('Minimum Spanning Tree:')) {
        mstConsoleMessage = msg;
      }
    };

    // We already capture console messages in beforeEach; use that array to detect desired message.
    // Click the "Run Kruskal's Algorithm" button and then wait a short while for console output and drawing.
    await page.click("button[onclick='runKruskal()']");

    // Wait for the specific console entry to appear (with a reasonable timeout).
    const timeout = 2000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const found = consoleMessages.find(m => typeof m.text === 'string' && m.text.includes('Minimum Spanning Tree:'));
      if (found) {
        mstConsoleMessage = found;
        break;
      }
      await new Promise(res => setTimeout(res, 50));
    }

    // Assert we got the console message about MST
    expect(mstConsoleMessage).not.toBeNull();

    // The console call in the app is: console.log('Minimum Spanning Tree:', mst);
    // Ensure the message args include the array representing the MST as the second arg.
    const args = mstConsoleMessage.args || [];
    // First argument should be the label string; second should be an array (the MST)
    expect(args.length).toBeGreaterThanOrEqual(2);
    expect(typeof args[0]).toBe('string');
    expect(args[0]).toContain('Minimum Spanning Tree');

    const mst = args[1];
    // The MST should be an array with exactly (vertices-1) edges; the implementation uses 4 vertices.
    expect(Array.isArray(mst)).toBe(true);
    expect(mst.length).toBe(3);

    // Validate that the MST contains edges with expected weights.
    // For the provided graph the MST is expected to have weights {4,5,10} (order-insensitive).
    const weights = mst.map(e => e.weight).sort((a, b) => a - b);
    expect(weights).toEqual([4, 5, 10]);

    // Verify that the global 'edges' array has been sorted in-place (edges[0].weight === smallest weight)
    const sortedFirstWeights = await page.evaluate(() => {
      return edges.map(e => e.weight);
    });
    const sortedCopy = [...sortedFirstWeights].sort((a, b) => a - b);
    expect(sortedFirstWeights).toEqual(sortedCopy);

    // Verify that the canvas has green pixels indicating selected edges were drawn in green.
    // We'll sample the canvas pixel buffer and assert presence of some pixels where green component is dominant.
    const hasGreen = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      const ctx = c.getContext('2d');
      // If context unavailable, return false (should not happen in real browser).
      if (!ctx) return false;
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const data = img.data;
      // Scan pixels for a strong green component (green > red and green > blue and green > 100)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a > 0 && g > 120 && g > r + 20 && g > b + 20) {
          return true;
        }
      }
      return false;
    });

    expect(hasGreen).toBe(true);

    // Ensure no uncaught page errors occurred during the run.
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking the Run button multiple times: algorithm runs again and logs MST each time without uncaught errors', async ({ page }) => {
    const loggedMSTs = [];
    // Clear prior consoleMessages
    consoleMessages = [];

    // Attach a lightweight monitor by polling the captured consoleMessages array
    const clickTimes = 3;
    for (let i = 0; i < clickTimes; i++) {
      await page.click("button[onclick='runKruskal()']");
      // Wait for console log for this run to appear
      const start = Date.now();
      let found = null;
      while (Date.now() - start < 2000) {
        found = consoleMessages.find(m => typeof m.text === 'string' && m.text.includes('Minimum Spanning Tree:'));
        if (found) break;
        await new Promise(res => setTimeout(res, 50));
      }
      expect(found).not.toBeNull();
      // Extract MST array arg; if multiple console entries exist, pick the latest matching one
      // Use the last matching entry
      const matching = consoleMessages.filter(m => typeof m.text === 'string' && m.text.includes('Minimum Spanning Tree:')).slice(-1)[0];
      expect(matching).toBeTruthy();
      const args = matching.args;
      expect(args.length).toBeGreaterThanOrEqual(2);
      const mst = args[1];
      expect(Array.isArray(mst)).toBe(true);
      expect(mst.length).toBe(3);
      loggedMSTs.push(mst.map(e => e.weight).sort((a, b) => a - b));
      // Short pause before next click to allow drawing to complete.
      await new Promise(res => setTimeout(res, 100));
    }

    // All logged MSTs should be identical (same set of weights) and equal to expected weights [4,5,10].
    for (const w of loggedMSTs) {
      expect(w).toEqual([4, 5, 10]);
    }

    // Ensure no uncaught page errors across multiple runs.
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid multiple clicks should not cause uncaught exceptions (stress click)', async ({ page }) => {
    // Rapidly click the run button several times.
    const runButton = page.locator("button[onclick='runKruskal()']");
    for (let i = 0; i < 8; i++) {
      await runButton.click();
    }

    // Allow some time for all runs to log and drawing to finish.
    await new Promise(res => setTimeout(res, 500));

    // There should be at least one MST console message logged.
    const found = consoleMessages.find(m => typeof m.text === 'string' && m.text.includes('Minimum Spanning Tree:'));
    expect(found).toBeTruthy();

    // No uncaught page errors should be present.
    expect(pageErrors.length).toBe(0);
  });

  test('Validation of canvas and 2D context availability', async ({ page }) => {
    // Ensure the page created a 2D context for the canvas (ctx usage in implementation)
    const ctxType = await page.evaluate(() => {
      try {
        const c = document.getElementById('canvas');
        const ctx = c.getContext('2d');
        return ctx ? '2d' : 'null';
      } catch (e) {
        return 'error';
      }
    });

    expect(['2d']).toContain(ctxType);
    // No page errors happened when querying context
    expect(pageErrors.length).toBe(0);
  });
});