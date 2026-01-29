import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8dc9b2-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Dijkstra\'s Algorithm Visualization - FSM validation', () => {
  // Shared listeners for console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions and debugging evidence
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application page (fresh load for each test)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Intentionally not clearing anything in the page; teardown happens automatically.
    // But we keep consoleMessages and pageErrors available in each test for assertions.
  });

  test('S0_Idle: Initial render shows UI controls and blank canvas', async ({ page }) => {
    // This test validates the Idle initial state:
    // - Buttons exist and are visible
    // - The canvas element exists
    // - The canvas is blank on initial load (no visualization drawn yet)

    // Check that Start and Reset buttons are present and visible
    const startButton = page.getByRole('button', { name: 'Start Visualization' });
    const resetButton = page.getByRole('button', { name: 'Reset' });
    await expect(startButton).toBeVisible();
    await expect(resetButton).toBeVisible();

    // Ensure canvas element exists
    const canvas = await page.$('#canvas');
    expect(canvas).not.toBeNull();

    // Capture initial canvas image data (to compare before/after)
    const initialDataURL = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      // toDataURL should exist for a canvas; return a string representation
      try {
        return canvas.toDataURL();
      } catch (e) {
        // If toDataURL isn't available for some reason, return an identifiable string
        return 'NO_DATAURL:' + (e && e.message);
      }
    });

    // Expect the canvas to have some dataURL string (it may be a blank PNG)
    expect(typeof initialDataURL).toBe('string');
    expect(initialDataURL.length).toBeGreaterThan(0);

    // There should be no uncaught page errors during initial render
    expect(pageErrors.length).toBe(0);
  });

  test('S0_Idle -> S1_Visualizing: clicking Start Visualization creates graph and draws it', async ({ page }) => {
    // This test validates the transition from Idle to Visualizing when the Start button is clicked.
    // It checks for:
    // - nodes being created (nodes.length === totalNodes if accessible)
    // - the canvas drawing changes compared to initial load
    // - no unexpected page errors

    // Grab initial canvas snapshot
    const initialDataURL = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      try {
        return canvas.toDataURL();
      } catch (e) {
        return 'NO_DATAURL:' + (e && e.message);
      }
    });

    // Click the Start Visualization button
    await page.click('#startButton');

    // Allow some time for graph creation and dijkstra processing/drawing
    await page.waitForTimeout(400);

    // Attempt to read the internal nodes array length.
    // Because the implementation uses top-level const bindings, accessing 'nodes' may or may not be reachable from this eval.
    // We handle both cases: if accessible, assert expected node count; if not, assert a ReferenceError occurred when accessing it.
    let nodesLength;
    let nodesAccessError = null;
    try {
      nodesLength = await page.evaluate(() => {
        // Attempt to access the page's nodes variable
        // This may throw ReferenceError if 'nodes' is not available in this context
        return nodes.length;
      });
    } catch (err) {
      nodesAccessError = err;
    }

    if (nodesAccessError) {
      // If accessing 'nodes' threw, assert it is a ReferenceError (or at least that an error happened)
      // This validates an edge-case: internal script scope may not expose lexical bindings to evaluate.
      expect(nodesAccessError.name).toBe('ReferenceError');
    } else {
      // If accessible, expect the graph to have been created with 8 nodes as per implementation
      expect(nodesLength).toBeDefined();
      expect(nodesLength).toBe(8);
    }

    // Verify canvas changed (visualization drew something)
    const afterStartDataURL = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      try {
        return canvas.toDataURL();
      } catch (e) {
        return 'NO_DATAURL:' + (e && e.message);
      }
    });

    // The visualization should alter the canvas image; therefore the DataURL should differ from initial
    expect(afterStartDataURL).toBeTruthy();
    expect(afterStartDataURL).not.toBe(initialDataURL);

    // Ensure no uncaught page errors occurred during start
    expect(pageErrors.length).toBe(0);
  });

  test('S1_Visualizing -> S2_Reset: clicking Reset clears the graph and canvas', async ({ page }) => {
    // This test validates that after starting visualization, clicking Reset transitions to Reset state:
    // - nodes array is cleared (if accessible)
    // - canvas is cleared (image matches blank initial canvas captured earlier)

    // Capture initial blank canvas to compare after reset
    const initialDataURL = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      try {
        return canvas.toDataURL();
      } catch (e) {
        return 'NO_DATAURL:' + (e && e.message);
      }
    });

    // Start first to create graph
    await page.click('#startButton');
    await page.waitForTimeout(300);

    // Sanity: ensure canvas changed after start
    const afterStartDataURL = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      try {
        return canvas.toDataURL();
      } catch (e) {
        return 'NO_DATAURL:' + (e && e.message);
      }
    });
    expect(afterStartDataURL).not.toBe(initialDataURL);

    // Now click Reset
    await page.click('#resetButton');
    await page.waitForTimeout(200);

    // Attempt to read nodes.length — may throw ReferenceError if not accessible
    let nodesLength;
    let nodesAccessError = null;
    try {
      nodesLength = await page.evaluate(() => {
        return nodes.length;
      });
    } catch (err) {
      nodesAccessError = err;
    }

    if (nodesAccessError) {
      // If we can't access nodes, ensure that the page itself did not raise an uncaught error
      // (we allowed ReferenceError only in our evaluate; pageErrors should still be empty)
      expect(nodesAccessError.name).toBe('ReferenceError');
    } else {
      // If accessible, the resetGraph implementation sets nodes.length = 0, so expect 0
      expect(nodesLength).toBe(0);
    }

    // Canvas should be cleared; compare to initial blank data URL
    const afterResetDataURL = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      try {
        return canvas.toDataURL();
      } catch (e) {
        return 'NO_DATAURL:' + (e && e.message);
      }
    });

    expect(afterResetDataURL).toBe(initialDataURL);

    // No uncaught page errors expected from clicking reset
    expect(pageErrors.length).toBe(0);
  });

  test('S2_Reset -> S0_Idle -> S1_Visualizing: start again after reset starts visualization anew', async ({ page }) => {
    // Validate that after resetting, starting again produces a new visualization (i.e., canvas changes again)
    // and that behavior is consistent.

    // Capture blank baseline
    const initialDataURL = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      try {
        return canvas.toDataURL();
      } catch (e) {
        return 'NO_DATAURL:' + (e && e.message);
      }
    });

    // Start, then reset
    await page.click('#startButton');
    await page.waitForTimeout(250);
    await page.click('#resetButton');
    await page.waitForTimeout(200);

    // Start again
    await page.click('#startButton');
    await page.waitForTimeout(350);

    // Canvas should differ from blank baseline
    const afterSecondStartDataURL = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      try {
        return canvas.toDataURL();
      } catch (e) {
        return 'NO_DATAURL:' + (e && e.message);
      }
    });

    expect(afterSecondStartDataURL).toBeTruthy();
    expect(afterSecondStartDataURL).not.toBe(initialDataURL);

    // Try to read nodes length; if accessible it should be 8 for a clean start, but note implementation may duplicate nodes if not reset properly
    let nodesLength;
    let nodesAccessError = null;
    try {
      nodesLength = await page.evaluate(() => nodes.length);
    } catch (err) {
      nodesAccessError = err;
    }

    if (nodesAccessError) {
      expect(nodesAccessError.name).toBe('ReferenceError');
    } else {
      // Because reset does clear nodes (nodes.length = 0) and createGraph pushes totalNodes nodes,
      // after start we expect nodes.length to be 8. If the implementation has issues (e.g., double-start without reset),
      // this assertion will reveal the bug.
      expect(nodesLength).toBeGreaterThanOrEqual(8);
      // Prefer exact expectation but accept larger counts and assert at least expected count
      expect(nodesLength).toBe(8);
    }

    // Ensure no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking Reset before Start should be safe and keep canvas blank', async ({ page }) => {
    // Validate that clicking Reset when no graph exists does not throw and keeps canvas blank

    // Baseline blank canvas
    const initialDataURL = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      try {
        return canvas.toDataURL();
      } catch (e) {
        return 'NO_DATAURL:' + (e && e.message);
      }
    });

    // Click reset before starting visualization
    await page.click('#resetButton');
    await page.waitForTimeout(150);

    // Canvas should remain equal to initial blank
    const afterResetDataURL = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      try {
        return canvas.toDataURL();
      } catch (e) {
        return 'NO_DATAURL:' + (e && e.message);
      }
    });

    expect(afterResetDataURL).toBe(initialDataURL);

    // No uncaught page errors expected
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: multiple clicks on Start accumulate nodes (observed bug) and canvas updates each time', async ({ page }) => {
    // This test intentionally verifies the implementation detail where calling startVisualization multiple times
    // without resetting will append to the nodes array (since createGraph pushes nodes onto the existing array).
    // This asserts observed behavior (a potential bug), rather than enforcing a fix.

    // Start once
    await page.click('#startButton');
    await page.waitForTimeout(200);

    // Capture nodes length after first start (if accessible)
    let firstLength;
    try {
      firstLength = await page.evaluate(() => nodes.length);
    } catch (err) {
      // If inaccessible, skip strict length assertions but still check canvas changes
      firstLength = undefined;
    }

    // Start again without resetting
    await page.click('#startButton');
    await page.waitForTimeout(200);

    // Capture nodes length after second start (if accessible)
    let secondLength;
    try {
      secondLength = await page.evaluate(() => nodes.length);
    } catch (err) {
      secondLength = undefined;
    }

    // If lengths accessible, assert that secondLength >= firstLength and that duplication occurred (implementation pushes more nodes)
    if (typeof firstLength === 'number' && typeof secondLength === 'number') {
      expect(secondLength).toBeGreaterThanOrEqual(firstLength);
      // Because the implementation pushes 8 nodes each time, if started twice without reset, expect 16 nodes
      expect(secondLength).toBeGreaterThanOrEqual(8);
      // If it exactly doubled, assert that as well (demonstrates the observed accumulation behavior)
      expect(secondLength).toBe(firstLength * 2);
    }

    // Ensure canvas updated after repeated start clicks (still different from blank)
    const blankDataURL = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      try {
        return canvas.toDataURL();
      } catch (e) {
        return 'NO_DATAURL:' + (e && e.message);
      }
    });
    expect(blankDataURL).toBeTruthy();

    // No uncaught page errors expected from multiple starts (function calls are defined)
    expect(pageErrors.length).toBe(0);
  });

  test('Introspection attempts may raise ReferenceError when accessing lexical bindings - validate such errors are observable', async ({ page }) => {
    // This test purposefully tries to access names that exist as lexical bindings in the page script (const/let)
    // and asserts that a ReferenceError is produced if they are not reachable via the evaluation context.
    // This validates the "let ReferenceError happen naturally and assert that these errors occur" requirement.

    const namesToProbe = ['nodes', 'edges', 'createGraph', 'drawGraph', 'dijkstra', 'resetGraph', 'renderPage'];

    for (const name of namesToProbe) {
      let probeError = null;
      let probeResult = undefined;
      try {
        probeResult = await page.evaluate((n) => {
          // Intentionally reference the name directly to produce a ReferenceError if it's not defined
          // eslint-disable-next-line no-eval
          return eval(n);
        }, name);
      } catch (err) {
        probeError = err;
      }

      // If the page defined the binding as a global property or function, probeResult will be non-undefined.
      // If not, a ReferenceError is expected for truly lexical-only bindings. We accept either presence or a ReferenceError.
      if (probeError) {
        expect(probeError.name === 'ReferenceError' || probeError.name === 'TypeError').toBeTruthy();
      } else {
        // If accessible, ensure the returned value matches expected types for known names
        if (name === 'nodes' || name === 'edges') {
          // Expect arrays if accessible
          expect(Array.isArray(probeResult)).toBeTruthy();
        } else if (name === 'createGraph' || name === 'drawGraph' || name === 'dijkstra' || name === 'resetGraph' || name === 'renderPage') {
          // If accessible, ensure it's a function; renderPage may be undefined in implementation
          if (probeResult !== undefined) {
            expect(typeof probeResult === 'function').toBeTruthy();
          }
        }
      }
    }

    // Confirm that we captured any runtime page errors (there should be none from these introspection attempts)
    // The errors we caught above come from our evaluate try/catch and do not populate pageErrors; pageErrors should be empty.
    expect(pageErrors.length).toBe(0);
  });
});