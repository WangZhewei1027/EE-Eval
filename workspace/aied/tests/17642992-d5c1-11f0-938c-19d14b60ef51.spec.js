import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17642992-d5c1-11f0-938c-19d14b60ef51.html';

test.describe("Prim's Algorithm Visualization - FSM comprehensive tests", () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Setup: navigate to the page and capture console and page errors for each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // collect console messages for later assertions/inspection
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', error => {
      // collect uncaught page errors (ReferenceError, TypeError, etc.)
      pageErrors.push(error);
    });

    await page.goto(APP_URL);
    // basic load sanity check
    await expect(page).toHaveURL(APP_URL);
    await expect(page).toHaveTitle(/Prim's Algorithm Visualization/);
  });

  test.afterEach(async ({ page }) => {
    // allow a brief moment for any delayed errors or logs to surface
    await page.waitForTimeout(50);
  });

  test('S0_Idle: Page loads into Idle state and initial UI is rendered', async ({ page }) => {
    // This test validates the initial (Idle) state S0_Idle:
    // - The "Run Prim's Algorithm" button exists
    // - The result container exists and is initially empty
    // - The global variable selectedEdges exists and is initially an empty array
    // - The expected entry action "renderPage" is NOT present as a global function in the page (renderPage not defined)
    // - No runtime errors occurred on page load

    // Button presence
    const runButton = page.locator("button[onclick='runPrimsAlgorithm()']");
    await expect(runButton).toBeVisible();
    await expect(runButton).toHaveText("Run Prim's Algorithm");

    // Result container exists and is initially empty
    const resultHtml = await page.locator('#result').innerHTML();
    expect(resultHtml).toBe('');

    // selectedEdges should be defined and empty initially
    const selectedEdgesLen = await page.evaluate(() => {
      return typeof selectedEdges !== 'undefined' ? selectedEdges.length : null;
    });
    expect(selectedEdgesLen).toBe(0);

    // renderPage is specified as an entry action for S0 in the FSM but it is not implemented in the page.
    // Verify it is indeed undefined (we must not modify or create it).
    const renderPageType = await page.evaluate(() => typeof renderPage);
    expect(renderPageType).toBe('undefined');

    // Ensure no page-level runtime errors occurred during initial load
    expect(pageErrors.length).toBe(0);

    // Capture that no error-level console messages were emitted (info/warn allowed)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('S0 -> S1 (RunPrimsAlgorithm): Clicking the button runs the algorithm (Running Algorithm state)', async ({ page }) => {
    // This test validates the transition from Idle (S0) to Running Algorithm (S1):
    // - Clicking the Run button invokes runPrimsAlgorithm (function exists)
    // - After running, the selectedEdges global is populated (algorithm executed)
    // - drawGraph should be invoked as part of the algorithm's completion (checked via DOM side-effect)
    // - No runtime errors occurred during execution

    // Ensure runPrimsAlgorithm exists
    const runType = await page.evaluate(() => typeof runPrimsAlgorithm);
    expect(runType).toBe('function');

    // Click the Run Prim's Algorithm button
    await page.click("button[onclick='runPrimsAlgorithm()']");

    // After click, selectedEdges should be populated with MST edges (for 5-node graph, length should be 4)
    const selectedEdgesLenAfter = await page.evaluate(() => selectedEdges.length);
    expect(selectedEdgesLenAfter).toBe(4);

    // Confirm drawGraph side-effect: the result div should contain the MST header and list entries
    const resultContent = await page.locator('#result').innerHTML();
    expect(resultContent).toContain('Minimum Spanning Tree Edges');

    // Check a few expected MST edge strings produced by the algorithm
    // Expected MST edges (order produced by the implementation): 
    // "0 - 1 (Weight: 2)", "1 - 2 (Weight: 3)", "1 - 4 (Weight: 5)", "0 - 3 (Weight: 6)"
    expect(resultContent).toContain('0 - 1 (Weight: 2)');
    expect(resultContent).toContain('1 - 2 (Weight: 3)');
    expect(resultContent).toContain('1 - 4 (Weight: 5)');
    expect(resultContent).toContain('0 - 3 (Weight: 6)');

    // Verify canvas context retrieval (drawGraph uses canvas 2D context)
    const hasCanvasContext = await page.evaluate(() => {
      const c = document.getElementById('graphCanvas');
      return !!(c && c.getContext && c.getContext('2d'));
    });
    expect(hasCanvasContext).toBe(true);

    // Ensure no runtime errors were thrown while running the algorithm
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('S1 -> S2 (GraphDrawn): After running, graph is drawn and result reflects drawn MST (Graph Drawn state)', async ({ page }) => {
    // This test validates the transition from Running Algorithm (S1) to Graph Drawn (S2):
    // - drawGraph() is executed (verified by content in #result)
    // - The result content exactly lists the selectedEdges entries (4 edges)
    // - The graphCanvas remains present and is not cleared of required attributes

    // Run the algorithm
    await page.click("button[onclick='runPrimsAlgorithm()']");

    // Verify number of edges listed in the result corresponds to selectedEdges length
    const resultContent = await page.locator('#result').innerHTML();
    const selectedEdgesLen = await page.evaluate(() => selectedEdges.length);
    expect(selectedEdgesLen).toBe(4);

    // The drawGraph content uses <br> separators; count occurrences to ensure 4 edges are listed
    const edgesListedCount = await page.evaluate(() => {
      const raw = document.getElementById('result').innerHTML;
      // Count occurrences of pattern " (Weight: " which appears once per edge
      return (raw.match(/\(Weight:/g) || []).length;
    });
    expect(edgesListedCount).toBe(4);

    // Ensure the canvas element still has the declared width/height attributes from the HTML
    const canvasAttrs = await page.evaluate(() => {
      const c = document.getElementById('graphCanvas');
      return { width: c.getAttribute('width'), height: c.getAttribute('height') };
    });
    expect(canvasAttrs.width).toBe('800');
    expect(canvasAttrs.height).toBe('600');

    // No runtime errors during drawing
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Clicking Run multiple times appends results (selectedEdges persists) and does not throw errors', async ({ page }) => {
    // This test validates an important edge-case described by the implementation:
    // - selectedEdges is not reset between runs, so running multiple times will append duplicate edges
    // - Verify behavior by clicking twice and ensuring selectedEdges length doubles
    // - Verify the result DOM reflects duplicates (each MST edge appears at least twice)
    // - Ensure no runtime errors are thrown even when the algorithm is re-run

    // First run
    await page.click("button[onclick='runPrimsAlgorithm()']");
    const lenAfterFirst = await page.evaluate(() => selectedEdges.length);
    expect(lenAfterFirst).toBe(4);

    // Second run (without resetting selectedEdges)
    await page.click("button[onclick='runPrimsAlgorithm()']");
    const lenAfterSecond = await page.evaluate(() => selectedEdges.length);
    // Expect appended edges: 4 + 4 = 8
    expect(lenAfterSecond).toBe(8);

    // Verify that the result innerHTML contains duplicated entries
    const resultHtml = await page.locator('#result').innerHTML();
    // Count occurrences of one typical edge label to ensure duplication
    const occurrencesOfEdge_0_1 = (resultHtml.match(/0 - 1 \(Weight: 2\)/g) || []).length;
    expect(occurrencesOfEdge_0_1).toBeGreaterThanOrEqual(2);

    // Also check that the result content length (number of "(Weight:" strings) equals 8
    const weightCount = (resultHtml.match(/\(Weight:/g) || []).length;
    expect(weightCount).toBe(8);

    // No runtime errors were thrown during repeated runs
    expect(pageErrors.length).toBe(0);
  });

  test('Verify onEnter/onExit action presence and side-effects as per FSM description', async ({ page }) => {
    // This test checks for the presence (or intentional absence) of functions referenced in the FSM:
    // - S0 entry action lists renderPage() which is NOT implemented => confirm it's undefined
    // - S1 entry action is runPrimsAlgorithm() which DOES exist and can be invoked
    // - S1 exit action drawGraph() exists and is observable by its DOM side-effect
    // We must not modify page code; only observe.

    // renderPage should not be present
    const isRenderPageDefined = await page.evaluate(() => typeof renderPage !== 'undefined');
    expect(isRenderPageDefined).toBe(false);

    // runPrimsAlgorithm should be present
    const isRunDefined = await page.evaluate(() => typeof runPrimsAlgorithm === 'function');
    expect(isRunDefined).toBe(true);

    // drawGraph should be present
    const isDrawGraphDefined = await page.evaluate(() => typeof drawGraph === 'function');
    expect(isDrawGraphDefined).toBe(true);

    // Invoke runPrimsAlgorithm and ensure drawGraph side-effect occurs (result updated)
    await page.click("button[onclick='runPrimsAlgorithm()']");
    const resultText = await page.locator('#result').innerText();
    expect(resultText).toContain('Minimum Spanning Tree Edges');

    // No page errors triggered by calling the functions
    expect(pageErrors.length).toBe(0);
  });

  test('Console and page error observation: collect logs and assert absence of uncaught errors', async ({ page }) => {
    // This test purposefully only observes console and page errors over a normal usage path.
    // It asserts that no uncaught ReferenceError/TypeError/SyntaxError happened,
    // while making the expected interactions (run once).

    // Run once
    await page.click("button[onclick='runPrimsAlgorithm()']");

    // Give a short pause for any asynchronous page errors (even though this page is synchronous)
    await page.waitForTimeout(50);

    // Assert that no uncaught errors were captured via pageerror
    expect(pageErrors.length).toBe(0, `Expected no uncaught page errors, got: ${pageErrors.map(e => String(e)).join('; ')}`);

    // Inspect console messages - there should be no console.error messages emitted by the page
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Also assert that at least some console info/warn may be present or none; this is just observational
    // (we don't require specific console output for this app)
  });
});