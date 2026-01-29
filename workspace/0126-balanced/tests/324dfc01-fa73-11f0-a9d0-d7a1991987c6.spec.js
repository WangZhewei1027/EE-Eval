import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324dfc01-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe("Prim's Algorithm Visualization (FSM) - 324dfc01-fa73-11f0-a9d0-d7a1991987c6", () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for inspection in tests
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // Store text for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // Uncaught exceptions in the page will be captured here
      pageErrors.push(err);
    });

    // Load the application exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // cleanup arrays (not strictly necessary, but explicit)
    consoleMessages = [];
    pageErrors = [];
  });

  test('Idle state (S0_Idle): page renders initial UI elements', async ({ page }) => {
    // This test validates the initial Idle state:
    // - Start button is present
    // - Canvas is present with expected attributes
    // - No vertices or edges exist yet
    // - Entry action renderPage() noted in FSM is not implemented in the page (we assert absence)

    // Ensure the start button is rendered and visible
    const startBtn = await page.locator('#startBtn');
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toHaveText("Start Prim's Algorithm");

    // Ensure the canvas exists and has expected width/height attributes
    const canvas = await page.locator('#canvas');
    await expect(canvas).toBeVisible();
    const width = await canvas.getAttribute('width');
    const height = await canvas.getAttribute('height');
    expect(width).toBe('600');
    expect(height).toBe('600');

    // The implementation uses global arrays 'vertices' and 'edges' populated only after createGraph()
    // Initially they should be empty arrays (or undefined if not created yet) - assert safe state
    const initialState = await page.evaluate(() => {
      return {
        verticesType: typeof vertices,
        edgesType: typeof edges,
        verticesLength: (typeof vertices !== 'undefined') ? vertices.length : null,
        edgesLength: (typeof edges !== 'undefined') ? edges.length : null,
      };
    });

    // If arrays exist, they should be empty initially; otherwise, their absence is acceptable but noted.
    if (initialState.verticesType === 'object') {
      expect(initialState.verticesLength).toBe(0);
    } else {
      expect(initialState.verticesType).not.toBe('function'); // ensure it's not unexpectedly a function
    }

    if (initialState.edgesType === 'object') {
      expect(initialState.edgesLength).toBe(0);
    }

    // FSM mentions an entry action renderPage() for Idle state.
    // The implementation does NOT define renderPage; verify that calling it would result in its absence.
    // We will NOT inject or define renderPage. Instead we assert that it is not defined in the page context.
    const renderPageType = await page.evaluate(() => typeof renderPage);
    expect(renderPageType).toBe('undefined');
  });

  test('Graph Created (S1_GraphCreated): clicking start populates graph and draws to canvas', async ({ page }) => {
    // This test validates the transition S0 -> S1:
    // - Clicking the start button should call createGraph() and drawGraph()
    // - The global arrays vertices and edges should be populated
    // - The canvas should contain drawn content (non-empty data URL)

    // Click the start button once
    await page.click('#startBtn');

    // After click, createGraph should have populated vertices and edges
    const graphState = await page.evaluate(() => {
      return {
        verticesDefined: typeof vertices !== 'undefined',
        edgesDefined: typeof edges !== 'undefined',
        verticesLength: (typeof vertices !== 'undefined') ? vertices.length : 0,
        edgesLength: (typeof edges !== 'undefined') ? edges.length : 0,
        numVerticesConst: (typeof numVertices !== 'undefined') ? numVertices : null,
      };
    });

    // Expect vertices to be present and match the defined numVertices
    expect(graphState.verticesDefined).toBe(true);
    expect(graphState.edgesDefined).toBe(true);
    // numVertices in source is 10
    expect(graphState.numVerticesConst).toBe(10);
    expect(graphState.verticesLength).toBe(graphState.numVerticesConst);
    expect(graphState.edgesLength).toBeGreaterThan(0);

    // Verify the canvas was drawn on by checking its data URL is a valid image string
    const dataUrl = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      try {
        return c.toDataURL();
      } catch (e) {
        return null;
      }
    });
    expect(dataUrl).toBeTruthy();
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);

    // Confirm that createGraph and drawGraph functions exist on the page (evidence of implementation)
    const functionsExist = await page.evaluate(() => {
      return {
        hasCreateGraph: typeof createGraph === 'function',
        hasDrawGraph: typeof drawGraph === 'function',
      };
    });
    expect(functionsExist.hasCreateGraph).toBe(true);
    expect(functionsExist.hasDrawGraph).toBe(true);

    // Confirm that no uncaught page errors happened immediately after the click
    expect(pageErrors.length).toBe(0);
  });

  test('Algorithm Running (S2_AlgorithmRunning) and Algorithm Completed (S3_AlgorithmCompleted): primsAlgorithm runs and logs MST', async ({ page }) => {
    // This test validates:
    // - primsAlgorithm is invoked (part of the click handler)
    // - The algorithm runs (vertices get visited over time)
    // - On completion, the application logs the MST to the console: "MST: ..."

    // Listen specifically for a console message containing "MST:"
    // Click start to initiate createGraph(), drawGraph(), and primsAlgorithm()
    await page.click('#startBtn');

    // Wait for the console message "MST:" which indicates AlgorithmCompleted (S3)
    // The algorithm uses setTimeout with speed=1000 and numVertices=10, allow generous timeout
    const mstConsole = await page.waitForEvent('console', {
      predicate: msg => msg.type() === 'log' && msg.text().startsWith('MST:'),
      timeout: 30000, // 30s should be sufficient for up to ~10 iterations
    });

    // Assert that the MST console message was produced and captured
    expect(mstConsole).toBeTruthy();
    expect(mstConsole.text()).toMatch(/^MST:\s*/);

    // Verify that the page did not emit uncaught exceptions during the algorithm run
    expect(pageErrors.length).toBe(0);

    // For additional assurance, inspect that the logged MST structure (stringified) is present
    // We will examine the console messages collected and locate the MST entry; it should be present.
    const hasMSTInCollected = consoleMessages.some(m => m.type === 'log' && m.text.startsWith('MST:'));
    expect(hasMSTInCollected).toBe(true);
  }, { timeout: 45000 });

  test('Edge case: clicking the start button multiple times appends graphs and still completes', async ({ page }) => {
    // This test validates edge-case transition behavior:
    // - Clicking the start button multiple times (without page reload) will call createGraph multiple times
    //   (implementation pushes into existing arrays rather than clearing them)
    // - Verify vertices and edges lengths increase accordingly
    // - Ensure the algorithm still eventually logs MST and no uncaught errors occur

    // Click start twice quickly
    await page.click('#startBtn');
    await page.click('#startBtn');

    // After two clicks, vertices length should be double numVertices (10 * 2 = 20)
    const graphState1 = await page.evaluate(() => {
      return {
        verticesLength: (typeof vertices !== 'undefined') ? vertices.length : 0,
        edgesLength: (typeof edges !== 'undefined') ? edges.length : 0,
        numVerticesConst: (typeof numVertices !== 'undefined') ? numVertices : null,
      };
    });

    expect(graphState.numVerticesConst).toBe(10);
    // Because createGraph pushes new vertices onto the existing array, we expect 20 after two clicks
    expect(graphState.verticesLength).toBeGreaterThanOrEqual(20);
    expect(graphState.edgesLength).toBeGreaterThan(0);

    // Wait for at least one MST console log (algorithm(s) should complete)
    const mstConsole1 = await page.waitForEvent('console', {
      predicate: msg => msg.type() === 'log' && msg.text().startsWith('MST:'),
      timeout: 30000,
    });
    expect(mstConsole).toBeTruthy();

    // Ensure no uncaught errors happened
    expect(pageErrors.length).toBe(0);
  }, { timeout: 45000 });

  test('FSM onEnter/onExit verification: renderPage absence causes ReferenceError when invoked', async ({ page }) => {
    // The FSM lists renderPage() as an entry action for the Idle state,
    // but the implementation does not define renderPage. This test intentionally
    // attempts to call renderPage from the page context to observe the natural ReferenceError,
    // as required by the testing constraints (do NOT patch or define the function).
    //
    // We will not redefine anything on the page; we simply attempt the call and assert the error.

    let caughtError = null;
    try {
      // Attempt to call a function that is not defined in the page - this should throw a ReferenceError in the page context.
      await page.evaluate(() => {
        // Intentionally call renderPage which does not exist in the app code
        return renderPage();
      });
    } catch (err) {
      // The Playwright error message wraps the page error; capture it for assertion.
      caughtError = err;
    }

    // We expect a ReferenceError or at least an error indicating 'renderPage' is not defined.
    expect(caughtError).toBeTruthy();
    // The message can vary depending on environment; check that it mentions 'renderPage' or 'not defined'
    const message = (caughtError && caughtError.message) ? caughtError.message : '';
    expect(message).toMatch(/renderPage|not defined/);
  });

  test('Implementation sanity checks: ensure key functions exist and do not throw on inspection', async ({ page }) => {
    // This test inspects the presence of the functions referenced by the FSM:
    // - createGraph
    // - drawGraph
    // - primsAlgorithm
    // We will verify they exist and that converting them to string does not throw.

    const funcInfo = await page.evaluate(() => {
      return {
        createGraphType: typeof createGraph,
        drawGraphType: typeof drawGraph,
        primsAlgorithmType: typeof primsAlgorithm,
      };
    });

    expect(funcInfo.createGraphType).toBe('function');
    expect(funcInfo.drawGraphType).toBe('function');
    expect(funcInfo.primsAlgorithmType).toBe('function');

    // Safely inspect toString of the functions to ensure no serialization issues (done in page context)
    const toStringResults = await page.evaluate(() => {
      return {
        createGraphStrStartsWith: createGraph.toString().slice(0, 20),
        drawGraphStrStartsWith: drawGraph.toString().slice(0, 20),
        primsAlgorithmStrStartsWith: primsAlgorithm.toString().slice(0, 20),
      };
    });

    expect(toStringResults.createGraphStrStartsWith.length).toBeGreaterThan(0);
    expect(toStringResults.drawGraphStrStartsWith.length).toBeGreaterThan(0);
    expect(toStringResults.primsAlgorithmStrStartsWith.length).toBeGreaterThan(0);
  });
});