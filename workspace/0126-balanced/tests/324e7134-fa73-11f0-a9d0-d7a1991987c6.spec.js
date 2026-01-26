import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e7134-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('NP-Completeness Demonstration - App 324e7134-fa73-11f0-a9d0-d7a1991987c6', () => {
  let consoleMessages;
  let pageErrors;

  // Setup a fresh page for each test and collect console logs / page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events for assertions about FSM entry actions (console.log)
    page.on('console', msg => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
          argsCount: msg.args().length
        });
      } catch (e) {
        // Defensive: record if console message inspection fails
        consoleMessages.push({
          type: 'error-inspect',
          text: String(e),
          argsCount: 0
        });
      }
    });

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the page and wait for load so the script runs (solveThreeColoring is called on load)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No global teardown required; each test uses Playwright's isolated context
  });

  test('Idle state: page renders and shows the main heading (S0_Idle evidence)', async ({ page }) => {
    // This test validates the Idle state entry evidence: the page is rendered and contains the main title.
    // FSM S0_Idle entry action mentioned renderPage() but page exposes static HTML. We assert the static evidence.
    const h1 = await page.locator('h1').innerText();
    expect(h1).toContain('Understanding NP-Completeness');

    // Check that the example graph block exists
    const exampleExists = await page.locator('.example h3').innerText();
    expect(exampleExists).toContain('3-Coloring Example Graph');

    // Ensure no immediate fatal page errors occurred during load
    expect(pageErrors).toEqual([]);
  });

  test('On load solveThreeColoring() runs and logs a "can be colored" message (S1_Solved entry action)', async ({ page }) => {
    // This validates that the solveThreeColoring function was invoked on load
    // and that the Solved state's entry action (console.log with "The graph can be colored with 3 colors:") occurred.

    // Wait briefly to ensure console messages produced during script execution are captured
    await page.waitForTimeout(100);

    // Find at least one console message that starts with the expected Solved message text
    const solvedMessages = consoleMessages.filter(m => m.type === 'log' && m.text.startsWith('The graph can be colored with 3 colors:'));
    expect(solvedMessages.length).toBeGreaterThanOrEqual(1);

    // Also ensure no unhandled page errors were emitted
    expect(pageErrors).toEqual([]);
  });

  test('Algorithm behavior: threeColor returns true for triangle and false for K4 (covers S1_Solved and S2_NotSolved algorithmically)', async ({ page }) => {
    // This test directly exercises the threeColor function exposed by the page.
    // It does not modify page functions; it simply invokes existing functions with different graphs.
    // We use two graphs:
    //   - triangle (A-B-C fully connected triangle) -> should be true (3-colorable)
    //   - K4 (complete graph on 4 vertices) -> should be false (not 3-colorable with 3 colors)

    const results = await page.evaluate(() => {
      // Build the triangle graph (same as the page's example)
      const triangle = [
        ['A', 'B'],
        ['A', 'C'],
        ['B', 'C']
      ];
      const triangleVertices = ['A', 'B', 'C'];
      const triColoring = {};
      for (const v of triangleVertices) triColoring[v] = -1;
      const triangleResult = threeColor(triangle, triangleVertices, 0, triColoring);

      // Build K4 (complete graph on 4 vertices)
      const k4Vertices = ['A', 'B', 'C', 'D'];
      const k4Edges = [];
      for (let i = 0; i < k4Vertices.length; i++) {
        for (let j = i + 1; j < k4Vertices.length; j++) {
          k4Edges.push([k4Vertices[i], k4Vertices[j]]);
        }
      }
      const k4Coloring = {};
      for (const v of k4Vertices) k4Coloring[v] = -1;
      const k4Result = threeColor(k4Edges, k4Vertices, 0, k4Coloring);

      return { triangleResult, k4Result };
    });

    // The triangle should be 3-colorable
    expect(results.triangleResult).toBe(true);

    // K4 is not 3-colorable, so algorithm should return false
    expect(results.k4Result).toBe(false);

    // No page errors should have occurred while executing these evaluations
    expect(pageErrors).toEqual([]);
  });

  test('Calling solveThreeColoring() again triggers another solved console log (transition event: SolveThreeColoring)', async ({ page }) => {
    // This test explicitly triggers the top-level event (function call) mentioned in the FSM.
    // We call the function and verify it results in the expected console log (Solved).
    const initialSolvedCount = consoleMessages.filter(m => m.type === 'log' && m.text.startsWith('The graph can be colored with 3 colors:')).length;

    // Call the solveThreeColoring function in the page context
    await page.evaluate(() => {
      // Calling the existing function; not redefining it
      if (typeof solveThreeColoring === 'function') {
        solveThreeColoring();
      } else {
        // If function is not defined, throw so test captures a pageerror
        throw new Error('solveThreeColoring is not available on window');
      }
    });

    // Wait for console to capture logs
    await page.waitForTimeout(100);

    const newSolvedCount = consoleMessages.filter(m => m.type === 'log' && m.text.startsWith('The graph can be colored with 3 colors:')).length;
    expect(newSolvedCount).toBeGreaterThan(initialSolvedCount);

    // Ensure no page errors were generated by invoking the function
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: threeColor with a self-loop edge yields false and does not throw (robustness)', async ({ page }) => {
    // This test passes a malformed graph (self-loop) to ensure the algorithm correctly rejects invalid colorings
    // and that no runtime exceptions are thrown (TypeError / ReferenceError).
    const result = await page.evaluate(() => {
      const vertices = ['A'];
      const graph = [['A', 'A']]; // self-loop
      const coloring = { 'A': -1 };
      try {
        const r = threeColor(graph, vertices, 0, coloring);
        return { returned: r, threw: false };
      } catch (e) {
        return { returned: null, threw: true, message: String(e) };
      }
    });

    // For a self-loop, the coloring is invalid; threeColor should eventually return false.
    expect(result.threw).toBe(false);
    expect(result.returned).toBe(false);

    // No page errors should be present as a result
    expect(pageErrors).toEqual([]);
  });

  test('Verify NotSolved console entry action did not occur on page load (S2_NotSolved absence)', async ({ page }) => {
    // The FSM lists a NotSolved entry action involving: console.log("The graph cannot be colored with 3 colors.");
    // The provided example graph is a triangle which is 3-colorable, so we expect NOT to see the NotSolved message in console logs.
    const notSolvedMessages = consoleMessages.filter(m => m.type === 'log' && m.text.startsWith('The graph cannot be colored with 3 colors.'));
    expect(notSolvedMessages.length).toBe(0);

    // We also verify that the Solved message did occur (sanity)
    const solvedMessages = consoleMessages.filter(m => m.type === 'log' && m.text.startsWith('The graph can be colored with 3 colors:'));
    expect(solvedMessages.length).toBeGreaterThanOrEqual(1);

    // No page errors were observed
    expect(pageErrors).toEqual([]);
  });

  test('Observe console and pageerror behavior: ensure no unexpected ReferenceError/SyntaxError/TypeError occurred during load', async ({ page }) => {
    // This test explicitly asserts that no JS runtime errors occurred (the app runs without uncaught exceptions).
    // If the application had syntax or reference errors, they would appear in the pageErrors array.
    expect(pageErrors.length).toBe(0);

    // Provide additional helpful diagnostic in test output if something did go wrong:
    if (pageErrors.length > 0) {
      // Fail with collected errors
      throw new Error('Unexpected page errors detected: ' + pageErrors.join('; '));
    }

    // Confirm that we have at least the expected console log from solveThreeColoring
    const hasSolvedLog = consoleMessages.some(m => m.type === 'log' && m.text.includes('The graph can be colored with 3 colors:'));
    expect(hasSolvedLog).toBe(true);
  });
});