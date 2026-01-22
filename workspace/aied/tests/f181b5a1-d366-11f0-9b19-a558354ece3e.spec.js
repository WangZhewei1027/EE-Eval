import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f181b5a1-d366-11f0-9b19-a558354ece3e.html';

test.describe('Dijkstra\'s Algorithm Visualization (FSM) - f181b5a1-d366-11f0-9b19-a558354ece3e', () => {
  // Shared storage for captured console and page errors per test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture uncaught page errors (exceptions)
    page.on('pageerror', err => {
      // err is an Error object
      const message = err && err.message ? err.message : String(err);
      pageErrors.push(message);
    });

    // Navigate to the page (do not attempt to patch or modify the page)
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // nothing special to teardown beyond Playwright's own cleanup
  });

  test('Initial Idle state: UI elements render correctly', async ({ page }) => {
    // This test validates that the expected DOM components for the Idle state are present.
    // It also records console/page errors that occurred during load (we assert errors occur in another test).
    const startNode = page.locator('#startNode');
    const endNode = page.locator('#endNode');
    const runButton = page.locator('#runAlgorithm');
    const resetButton = page.locator('#resetGraph');
    const graphRepresentation = page.locator('#graphRepresentation');
    const graphContainer = page.locator('#graphContainer');
    const pathResult = page.locator('#pathResult');
    const stepInfo = page.locator('#stepInfo');

    await expect(startNode).toBeVisible();
    await expect(endNode).toBeVisible();
    await expect(runButton).toBeVisible();
    await expect(resetButton).toBeVisible();
    await expect(graphRepresentation).toBeVisible();
    await expect(graphContainer).toBeVisible();
    await expect(pathResult).toBeVisible();
    await expect(stepInfo).toBeVisible();

    // Check initial pathResult text (as present in HTML file)
    await expect(pathResult).toHaveText(/Click "Run Algorithm" to find the shortest path\./);

    // Also ensure selects have expected options (basic sanity)
    const startOptions = await startNode.locator('option').allTextContents();
    const endOptions = await endNode.locator('option').allTextContents();
    expect(startOptions).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(endOptions).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  test('Page emits console/page errors (observe runtime script issues)', async ({ page }) => {
    // This test specifically asserts that console or page errors occur while loading/running the script.
    // Per instructions, we must observe and assert that ReferenceError/SyntaxError/TypeError (or related)
    // happen naturally without patching the page.

    // Wait briefly to allow any asynchronous script errors to surface
    await page.waitForTimeout(500);

    // Combine captured errors
    const combinedErrors = [
      ...consoleErrors.map(e => String(e)),
      ...pageErrors.map(e => String(e))
    ];

    // We expect at least one error to have occurred given the provided (possibly truncated) script.
    expect(combinedErrors.length).toBeGreaterThan(0);

    // And at least one error should look like a common JS runtime/parsing error.
    const suspicious = combinedErrors.some(err =>
      /SyntaxError|ReferenceError|TypeError|Unexpected end|Unexpected token/i.test(err)
    );
    expect(suspicious).toBeTruthy();
  });

  test('Run algorithm transition: attempt to go from Idle -> AlgorithmRunning -> AlgorithmComplete', async ({ page }) => {
    // This test attempts to simulate the RunAlgorithmClick event and then observe:
    // - either a runtime error occurs (allowed and asserted elsewhere),
    // - or the algorithm runs and shows the final path + distance in #pathResult.
    //
    // Per instructions we do NOT modify the page. We will click the button and observe outcomes.

    const runButton = page.locator('#runAlgorithm');
    const startSelect = page.locator('#startNode');
    const endSelect = page.locator('#endNode');
    const pathResult = page.locator('#pathResult');

    // Choose start A and end F (a typical path that should produce a shortest path A → C → B → D → F distance 14)
    await startSelect.selectOption('A');
    await endSelect.selectOption('F');

    // Click the Run Algorithm button
    await runButton.click();

    // Wait up to 7s for either an error to appear or pathResult to show "Shortest Path"
    const maxWait = 7000;
    const pollInterval = 200;
    let elapsed = 0;
    let finalPathText = '';
    while (elapsed < maxWait) {
      // If a page-level error appeared, break (we will assert later)
      if (pageErrors.length > 0 || consoleErrors.length > 0) break;

      finalPathText = (await pathResult.textContent()) || '';
      if (/Shortest Path:/i.test(finalPathText)) break;

      await page.waitForTimeout(pollInterval);
      elapsed += pollInterval;
    }

    // Make a combined errors array for inspection/assertion
    const combinedErrors = [
      ...consoleErrors.map(e => String(e)),
      ...pageErrors.map(e => String(e))
    ];

    // Per instruction, the test should ASSERT these errors occur naturally.
    // It is possible that the script actually completed without errors; however the spec requires we assert errors occurred.
    // We therefore assert that an error was captured. (This aligns with the task directive.)
    expect(combinedErrors.length).toBeGreaterThan(0);

    // Additionally, if the algorithm did complete (no errors), we also verify the correctness of the final output.
    if (/Shortest Path:/i.test(finalPathText)) {
      // Verify expected path and distance (expected path for A->F in this graph: A → C → B → D → F with distance 14)
      expect(finalPathText).toContain('Shortest Path:');
      expect(finalPathText).toContain('A');
      expect(finalPathText).toContain('F');
      // Distance assertion (may appear as number or Infinity if unreachable; we expect 14 if correct)
      expect(finalPathText).toMatch(/Total Distance:\s*\d+/);
      expect(finalPathText).toContain('14');
    } else {
      // If we didn't observe the final path, ensure we at least observed an error that looks like a Syntax/Runtime error.
      const suspicious = combinedErrors.some(err =>
        /SyntaxError|ReferenceError|TypeError|Unexpected end|Unexpected token/i.test(err)
      );
      expect(suspicious).toBeTruthy();
    }
  });

  test('Edge case: start and end are identical should show message or produce an error', async ({ page }) => {
    // This test validates the reset transition/edge-case handling where start === end.
    // The intended behavior in the implementation is to show: 'Start and end nodes are the same.'
    // We will select the same option and click Run, then assert either the message appears or an error occurred.

    const runButton = page.locator('#runAlgorithm');
    const startSelect = page.locator('#startNode');
    const endSelect = page.locator('#endNode');
    const pathResult = page.locator('#pathResult');

    // Select the same node for start and end
    await startSelect.selectOption('A');
    await endSelect.selectOption('A');

    // Click Run
    await runButton.click();

    // Wait briefly for DOM update or error capture
    await page.waitForTimeout(500);

    const combinedErrors = [
      ...consoleErrors.map(e => String(e)),
      ...pageErrors.map(e => String(e))
    ];

    // If the script handled the case, the pathResult textContent should reflect the message.
    const resultText = (await pathResult.textContent()) || '';

    const handledMessage = resultText.trim() === 'Start and end nodes are the same.';

    // Again per instruction, we must assert that errors occurred naturally.
    expect(combinedErrors.length).toBeGreaterThan(0);

    // If no error, then the app should have handled the edge-case gracefully:
    if (combinedErrors.length === 0) {
      expect(handledMessage).toBeTruthy();
    } else {
      // If there were errors, at least one should be a typical runtime/parse error
      const suspicious = combinedErrors.some(err =>
        /SyntaxError|ReferenceError|TypeError|Unexpected end|Unexpected token/i.test(err)
      );
      expect(suspicious).toBeTruthy();
    }
  });

  test('ResetGraph click should reset UI to Idle (or produce natural errors)', async ({ page }) => {
    // This test attempts to validate the ResetGraphClick transition: Idle -> Idle (resetting graph state).
    // We will do an initial run click (safe to attempt), then click reset and verify pathResult returns to initial message
    // or that errors naturally occurred (which we must assert per the instructions).

    const runButton = page.locator('#runAlgorithm');
    const resetButton = page.locator('#resetGraph');
    const startSelect = page.locator('#startNode');
    const endSelect = page.locator('#endNode');
    const pathResult = page.locator('#pathResult');

    // Do a run attempt (start A end F) to possibly change state
    await startSelect.selectOption('A');
    await endSelect.selectOption('F');
    await runButton.click();

    // Wait a short while to allow possible script actions
    await page.waitForTimeout(500);

    // Click reset
    await resetButton.click();

    // Wait briefly for DOM update or error capture
    await page.waitForTimeout(300);

    // Check current pathResult text
    const currentResult = (await pathResult.textContent()) || '';

    // Combine errors
    const combinedErrors = [
      ...consoleErrors.map(e => String(e)),
      ...pageErrors.map(e => String(e))
    ];

    // Assert that errors occurred naturally per task instruction.
    expect(combinedErrors.length).toBeGreaterThan(0);

    // If no errors, the expected reset behavior is that pathResult returns to initial instructional text.
    if (combinedErrors.length === 0) {
      await expect(pathResult).toHaveText(/Click "Run Algorithm" to find the shortest path\./);
    } else {
      // If errors did occur, ensure at least one is relevant
      const suspicious = combinedErrors.some(err =>
        /SyntaxError|ReferenceError|TypeError|Unexpected end|Unexpected token/i.test(err)
      );
      expect(suspicious).toBeTruthy();
    }
  });
});