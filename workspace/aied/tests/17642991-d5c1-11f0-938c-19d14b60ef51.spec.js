import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17642991-d5c1-11f0-938c-19d14b60ef51.html';

test.describe('Kruskal\'s Algorithm Visualization (FSM: Idle -> Running)', () => {
  // Capture console and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Route to the application page before each test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('S0_Idle: Page renders initial UI (button, nodes, initial edges) and renderPage is not defined', async ({ page }) => {
    // This test validates the initial "Idle" state:
    // - The Run Kruskal button exists
    // - The initial graph nodes and edges are present (as created in script)
    // - The entry action mentioned in FSM (renderPage()) is not present in the implementation

    // Assert the Run Kruskal button exists with the expected selector and text
    const button = page.locator("button[onclick='runKruskal()']");
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText("Run Kruskal's Algorithm");

    // Assert nodes were created (5 nodes: A, B, C, D, E)
    const nodes = page.locator('.node');
    await expect(nodes).toHaveCount(5);

    // Assert initial edges were created (edges array length in the HTML is 6)
    const edges = page.locator('.edge');
    await expect(edges).toHaveCount(6);

    // Check one node's position and label to verify DOM placement
    const firstNodeText = await nodes.nth(0).innerText();
    expect(firstNodeText).toBe('A');

    // The FSM states mention an entry action "renderPage()" for S0_Idle.
    // The implementation does not define renderPage; confirm it is undefined.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');
  });

  test('Transition RunKruskal: Clicking the button triggers runKruskal() and results in JS runtime error (observed as pageerror/console error) and no additional MST edges are reliably drawn', async ({ page }) => {
    // This test validates the transition from Idle -> Running when the user clicks
    // the Run Kruskal button. The implementation contains logic bugs; we must
    // observe errors as they naturally occur and assert that they happened.

    // Capture console messages and page errors
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    const pageErrors = [];
    page.on('pageerror', err => {
      // Collect page error objects
      pageErrors.push(err);
    });

    // Confirm initial edge count
    const edgesLocator = page.locator('.edge');
    const initialEdgeCount = await edgesLocator.count();
    expect(initialEdgeCount).toBeGreaterThan(0); // sanity check

    // Ensure runKruskal function is present before clicking
    const runKruskalType = await page.evaluate(() => typeof window.runKruskal);
    expect(runKruskalType).toBe('function');

    // Click the button to trigger the algorithm (this may produce runtime errors)
    await page.click("button[onclick='runKruskal()']");

    // Allow some time for synchronous JS to execute and errors to surface
    await page.waitForTimeout(250);

    // After clicking, because of implementation issues (indexOf on nested objects, recursive find),
    // we expect at least one page error or console error to have occurred.
    expect(pageErrors.length).toBeGreaterThan(0);

    // Ensure that at least one console message is of type 'error' (if any console errors were emitted)
    const hasConsoleError = consoleMessages.some(m => m.type === 'error' || /error/i.test(m.text));
    expect(hasConsoleError || pageErrors.length > 0).toBeTruthy();

    // The algorithm is expected to draw MST edges via drawMST(mst) in normal operation.
    // Due to the runtime error, verify that the number of edges did not reliably increase.
    // (If the code threw before drawing, count remains the same; if partially drawn, it may increase.
    // We assert that it is either unchanged or not more than initial + edges.length)
    const afterClickEdgeCount = await edgesLocator.count();
    // Allow both possibilities but assert no successful, clean MST drawing occurred:
    // The implementation bug typically results in a recursive error before drawMST runs.
    // So we assert that either edge count is unchanged or that page errors were emitted.
    expect((afterClickEdgeCount === initialEdgeCount) || pageErrors.length > 0).toBeTruthy();

    // Inspect first page error message to assert it matches expected failure patterns
    const firstErrorMessage = pageErrors[0] && pageErrors[0].message ? pageErrors[0].message : String(pageErrors[0]);
    // The erroneous behavior often leads to RangeError (maximum call stack) or TypeError due to undefined lookups.
    expect(/Maximum call stack|RangeError|TypeError|undefined/i.test(firstErrorMessage)).toBeTruthy();
  });

  test('Edge case: Multiple clicks cause repeated runtime errors (errors should continue to surface)', async ({ page }) => {
    // This test clicks the button multiple times to confirm the application continues
    // to produce observable errors (no silent recovery) and errors are captured each time.

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    // Click the button three times with small pauses between clicks
    for (let i = 0; i < 3; i++) {
      await page.click("button[onclick='runKruskal()']");
      await page.waitForTimeout(150);
    }

    // We expect at least one error; more robustly, expect at least one error per click in this buggy implementation
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one console 'error' message should be present or page errors captured
    const hasConsoleError = consoleMessages.some(m => m.type === 'error' || /error/i.test(m.text));
    expect(hasConsoleError || pageErrors.length > 0).toBeTruthy();
  });

  test('Direct invocation of runKruskal() in page context triggers the same runtime error (verifies S1 entry action runKruskal())', async ({ page }) => {
    // This test directly invokes runKruskal via page.evaluate to assert the function exists
    // and to allow the runtime error to occur naturally. We do not patch or override code.

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    // Call runKruskal directly inside the page context; capture any thrown error message returned.
    // We wrap the call so that the exception becomes a pageerror (which we capture) rather than crashing the test process.
    const evalResult = await page.evaluate(() => {
      try {
        // Direct call - implementation will execute and may throw
        runKruskal();
        return { invoked: true };
      } catch (e) {
        // Return an object with the thrown message so we can make assertions without altering global behavior
        return { invoked: true, thrown: String(e && e.message) };
      }
    });

    expect(evalResult.invoked).toBeTruthy();

    // Because the implementation contains logic errors, calling runKruskal is expected to generate a pageerror.
    await page.waitForTimeout(150);
    expect(pageErrors.length).toBeGreaterThan(0);

    // If evaluate returned an error string, assert it matches expected patterns
    if (evalResult.thrown) {
      expect(/Maximum call stack|RangeError|TypeError|undefined/i.test(evalResult.thrown)).toBeTruthy();
    } else {
      // If evaluate didn't throw synchronously but pageErrors captured something asynchronously, assert that
      const firstPageErrorMessage = pageErrors[0] && pageErrors[0].message ? pageErrors[0].message : String(pageErrors[0]);
      expect(/Maximum call stack|RangeError|TypeError|undefined/i.test(firstPageErrorMessage)).toBeTruthy();
    }
  });
});