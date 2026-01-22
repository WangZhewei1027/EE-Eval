import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3c0ea1-d360-11f0-b42e-71f0e7238799.html';

test.describe("Prim's Algorithm Visualization (FSM) - 7b3c0ea1-d360-11f0-b42e-71f0e7238799", () => {
  // We'll capture console messages and page errors for each test run
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught exceptions (page errors)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the exact page (do not modify the page)
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // Helpful debug output if a test fails - kept minimal to avoid noise
    if (pageErrors.length) {
      // Attach to test output by throwing if necessary; but we don't throw here.
      // Tests themselves will assert expected errors.
    }
    // Clear listeners implicitly by closing page fixture after each test
  });

  test('Initial Idle State (S0_Idle): UI elements are present and no graph exists', async ({ page }) => {
    // This validates the initial (Idle) state: buttons and canvas exist and the page script has initialized nodes/edges globals.
    const generateGraphBtn = await page.$('#generateGraph');
    const generateMSTBtn = await page.$('#generateMST');
    const canvas = await page.$('#canvas');

    expect(generateGraphBtn).not.toBeNull();
    expect(generateMSTBtn).not.toBeNull();
    expect(canvas).not.toBeNull();

    // Validate that global variables nodes and edges exist and are empty initially
    const { nodesLen, edgesLen, renderPageType } = await page.evaluate(() => {
      return {
        nodesLen: typeof nodes !== 'undefined' ? nodes.length : null,
        edgesLen: typeof edges !== 'undefined' ? edges.length : null,
        renderPageType: typeof renderPage
      };
    });

    // FSM S0 entry_actions lists renderPage(), but the implementation doesn't define it.
    // We assert that renderPage is not defined (so entry_action is effectively a no-op in practice).
    expect(renderPageType).toBe('undefined');

    // nodes/edges should be defined and empty on load from the script
    expect(nodesLen).toBe(0);
    expect(edgesLen).toBe(0);

    // There should be no page-level errors just from loading the idle page
    expect(pageErrors.length).toBe(0);

    // And there should be no console error messages recorded
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_GraphGenerated: Clicking "Generate Random Graph" creates nodes and edges', async ({ page }) => {
    // Click Generate Random Graph and assert graph is generated as per FSM expectations.
    await page.click('#generateGraph');

    // Give the page a moment to draw & compute
    await page.waitForTimeout(100);

    // Verify nodes and edges count in the page context
    const { nodesLen, edgesLen } = await page.evaluate(() => {
      return { nodesLen: nodes.length, edgesLen: edges.length };
    });

    // The implementation creates 10 nodes and n*(n-1)/2 edges for undirected complete graph
    expect(nodesLen).toBe(10);
    expect(edgesLen).toBe(10 * 9 / 2); // 45

    // Verify canvas has non-blank pixels (some drawing happened).
    const nonBlank = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      // Count non-transparent/non-white pixels as heuristic for drawing.
      let nonEmpty = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        // consider pixel non-blank if alpha > 0 and not equal to white
        if (a !== 0 && !(r === 255 && g === 255 && b === 255)) {
          nonEmpty++;
          if (nonEmpty > 10) return true; // early exit
        }
      }
      return nonEmpty > 0;
    });

    expect(nonBlank).toBe(true);

    // Ensure no uncaught errors occurred during graph generation
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_GraphGenerated -> S2_MSTGenerated: Generating MST after graph draws MST edges and returns mstEdges', async ({ page }) => {
    // Prepare graph
    await page.click('#generateGraph');
    await page.waitForTimeout(100);

    // Directly invoke primsAlgorithm in page context to retrieve return value (mstEdges)
    const mstEdges = await page.evaluate(() => {
      // call the function directly; this will draw edges on canvas and return mstEdges
      // The script defines primsAlgorithm globally.
      return primsAlgorithm();
    });

    // Expect mstEdges length to be nodes.length - 1 (9 for 10 nodes)
    expect(Array.isArray(mstEdges)).toBe(true);
    expect(mstEdges.length).toBe(9);

    // Validate each edge object structure
    for (const e of mstEdges) {
      expect(typeof e.from).toBe('number');
      expect(typeof e.to).toBe('number');
      expect(typeof e.weight).toBe('number');
    }

    // Verify canvas has MST edges drawn (more drawn pixels than just nodes)
    const drawnPixels = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a !== 0 && !(r === 255 && g === 255 && b === 255)) {
          count++;
          if (count > 100) return count; // early exit
        }
      }
      return count;
    });

    expect(drawnPixels).toBeGreaterThan(10);

    // No uncaught page errors expected in normal flow
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Clicking "Generate MST" before graph generation should produce a runtime error (TypeError)', async ({ page }) => {
    // Ensure we're in the idle state (no nodes)
    const nodesBefore = await page.evaluate(() => nodes.length);
    expect(nodesBefore).toBe(0);

    // Click Generate MST button that calls primsAlgorithm() without nodes - this is expected to cause a runtime error
    // We will click and then allow the pageerror listener to capture any uncaught exception.
    await page.click('#generateMST');

    // Give the runtime a moment to produce any errors
    await page.waitForTimeout(100);

    // There should be at least one page error captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one of the errors should be a TypeError or mention inability to read properties of undefined
    const messages = pageErrors.map(e => (e && e.message) ? e.message : String(e));
    const matched = messages.some(msg =>
      /TypeError/i.test(msg) ||
      /Cannot read properties of undefined/i.test(msg) ||
      /Cannot read property/i.test(msg) ||
      /undefined/.test(msg)
    );

    expect(matched).toBe(true);
  });

  test('Edge case: Clicking the canvas (UI text claims it generates graph) should not create nodes as no handler is attached', async ({ page }) => {
    // Ensure initial state: no nodes
    await page.evaluate(() => { /* ensure we're at idle */ });
    const nodesBefore = await page.evaluate(() => nodes.length);
    expect(nodesBefore).toBe(0);

    // Click on the canvas element
    const canvasBox = await page.locator('#canvas').boundingBox();
    // Safety: boundingBox could be null in some circumstances; guard it
    if (canvasBox) {
      await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
      await page.waitForTimeout(50);
    } else {
      // If bounding box isn't available, perform a click via the locator
      await page.click('#canvas');
      await page.waitForTimeout(50);
    }

    // After clicking the canvas (contrary to help text), the current script does not attach click to canvas,
    // so nodes should still be zero.
    const nodesAfter = await page.evaluate(() => nodes.length);
    expect(nodesAfter).toBe(0);

    // Ensure no new page errors occurred due to the click
    const canvasRelatedErrors = pageErrors.filter(e => {
      const m = e && e.message ? e.message : '';
      return /canvas/i.test(m) || /click/i.test(m);
    });
    expect(canvasRelatedErrors.length).toBe(0);
  });

  test('Sanity checks: FSM evidence functions exist where implemented (generateRandomGraph & primsAlgorithm) and behave as functions', async ({ page }) => {
    // Verify the functions exist on window and are of type function
    const types = await page.evaluate(() => {
      return {
        generateRandomGraphType: typeof generateRandomGraph,
        primsAlgorithmType: typeof primsAlgorithm
      };
    });

    expect(types.generateRandomGraphType).toBe('function');
    expect(types.primsAlgorithmType).toBe('function');

    // Call generateRandomGraph and ensure it returns undefined (it populates globals) and doesn't throw
    const genResult = await page.evaluate(() => {
      try {
        const r = generateRandomGraph();
        return { threw: false, resultType: typeof r };
      } catch (err) {
        return { threw: true, message: err && err.message ? err.message : String(err) };
      }
    });

    expect(genResult.threw).toBe(false);
    // generateRandomGraph has no explicit return -> undefined
    expect(genResult.resultType).toBe('undefined');

    // Now call primsAlgorithm in context where nodes exist (we just generated)
    const mstCall = await page.evaluate(() => {
      try {
        const mst = primsAlgorithm();
        return { threw: false, length: Array.isArray(mst) ? mst.length : null };
      } catch (err) {
        return { threw: true, message: err && err.message ? err.message : String(err) };
      }
    });

    expect(mstCall.threw).toBe(false);
    expect(mstCall.length).toBeGreaterThanOrEqual(0);
  });
});