import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52096e01-fa76-11f0-a09b-87751f540fd8.html';

// Page Object representing the graph page and helpers to observe errors and DOM
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Arrays to collect runtime problems
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];

    // Capture console events (including runtime errors logged to console)
    this.page.on('console', (msg) => {
      this.consoleMessages.push(msg);
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg);
      }
    });

    // Capture uncaught exceptions thrown on the page
    this.page.on('pageerror', (err) => {
      // err is an Error instance; store it for assertions
      this.pageErrors.push(err);
    });
  }

  // Navigate to the application URL
  async goto() {
    // We attach listeners in constructor, navigate and wait for load
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // short pause to let synchronous scripts run and any errors surface
    await this.page.waitForTimeout(200);
  }

  // Count number of canvas elements inside #graph container
  async getCanvasCount() {
    return await this.page.locator('#graph canvas').count();
  }

  // Click the graph container (triggers the GraphClick event)
  async clickGraph() {
    // Use try/catch to avoid Playwright throwing if click leads to page errors
    try {
      await this.page.click('#graph', { timeout: 2000 });
    } catch (err) {
      // swallow Playwright-level errors; runtime errors will be captured by pageerror
    }
    // wait briefly to let click handler run and any exceptions be emitted
    await this.page.waitForTimeout(200);
  }

  // Helpers to examine collected errors/messages
  getConsoleErrorMessages() {
    return this.consoleErrors.map((m) => `${m.type()}: ${m.text()}`);
  }

  getAllConsoleMessages() {
    return this.consoleMessages.map((m) => `${m.type()}: ${m.text()}`);
  }

  getPageErrorMessages() {
    return this.pageErrors.map((e) => (e && e.message) ? e.message : String(e));
  }
}

test.describe('Topological Sort FSM - Interactive App (52096e01-...)', () => {
  // Setup per-test: create page object and navigate
  test.beforeEach(async ({ page }) => {
    // nothing here; individual tests create GraphPage and navigate to ensure fresh listeners
  });

  // Validate initial state S0_Idle: application attempts drawGraph(edges, nodes) on load
  test('S0_Idle: initial drawGraph should be attempted on load and runtime errors may occur', async ({ page }) => {
    const gp = new GraphPage(page);
    await gp.goto();

    // The implementation attempts to draw using edges/nodes that are arrays of strings,
    // which will cause property accesses like .x to fail -> expect at least one page error (TypeError)
    expect(gp.pageErrors.length).toBeGreaterThan(0);

    const pageErrMsgs = gp.getPageErrorMessages();
    // Assert at least one page error mentions property access on undefined or .x to indicate the draw failure
    const matched = pageErrMsgs.some((m) => /Cannot read properties of undefined|Cannot read property 'x'|reading 'x'|undefined is not an object|TypeError/i.test(m));
    expect(matched).toBeTruthy();

    // Because drawGraph likely throws before appending a new canvas element, the #graph container is expected to have zero canvas children
    const canvasCount = await gp.getCanvasCount();
    expect(canvasCount).toBe(0);

    // Also assert that some console errors were recorded (some browsers may route the error to console)
    const consoleErrs = gp.getConsoleErrorMessages();
    expect(consoleErrs.length).toBeGreaterThanOrEqual(0); // allow zero for environments that only use pageerror
    // If any console errors exist, at least one should reference 'x' or 'drawGraph' or 'TypeError'
    if (consoleErrs.length > 0) {
      const cMatched = consoleErrs.some((m) => /drawGraph|x|TypeError|Cannot read/i.test(m));
      expect(cMatched).toBeTruthy();
    }
  });

  // Validate the click event transition GraphClick from S0_Idle -> S1_Sorted
  test('GraphClick event: clicking #graph triggers click handler and leads to runtime error (assignment to const) in implementation', async ({ page }) => {
    const gp = new GraphPage(page);
    await gp.goto();

    const beforePageErrors = gp.pageErrors.length;

    // Perform the click that should invoke the graph click handler.
    // The handler attempts to reassign a const 'event', which should throw a TypeError.
    await gp.clickGraph();

    // After clicking, expect additional page errors (assignment to constant variable)
    expect(gp.pageErrors.length).toBeGreaterThan(beforePageErrors);

    const newPageErrMsgs = gp.getPageErrorMessages().slice(beforePageErrors);
    // Verify at least one of the new errors mentions assignment to constant or similar wording
    const foundAssignConst = newPageErrMsgs.some((m) => /Assignment to constant variable|assignment to constant|can't assign to const|Cannot assign to read only property|TypeError/i.test(m));
    expect(foundAssignConst).toBeTruthy();

    // Ensure clicking didn't magically produce a valid canvas drawing (still zero canvases expected)
    const canvasCountAfterClick = await gp.getCanvasCount();
    expect(canvasCountAfterClick).toBe(0);
  });

  // Validate final state S1_Sorted attempt: the script attempts to sort and draw sorted graph at the end;
  // because of earlier errors the final drawGraph may not succeed - assert that a sorting attempt produced errors or no visual result.
  test('S1_Sorted: application attempts sort(graph) and drawGraph(sortedEdges, sortedNodes) - verify errors or absence of sorted visualization', async ({ page }) => {
    const gp = new GraphPage(page);
    await gp.goto();

    // The page's sort() is executed during script evaluation; because the DOM structure isn't as expected,
    // sort(graph) is also likely to cause TypeError or other runtime errors. We assert that a TypeError exists among page errors.
    const pageErrMsgs = gp.getPageErrorMessages();
    const hasTypeError = pageErrMsgs.some((m) => /TypeError|Cannot read properties of undefined|Cannot read property 'x'|undefined is not an object/i.test(m));
    expect(hasTypeError).toBeTruthy();

    // Additionally, check that there is no clear textual representation of sorted nodes appended to DOM.
    // The app uses a canvas for visual output; if sorting succeeded, we'd expect a canvas child inside #graph.
    // Confirm that no canvas exists (sorted drawing not present)
    const canvasCount = await gp.getCanvasCount();
    expect(canvasCount).toBe(0);

    // Edge-case: If some environments managed to produce a canvas despite errors, ensure its dimensions are as attempted by drawGraph (if present)
    if (canvasCount > 0) {
      // Inspect the first canvas element's properties in page context
      const dims = await page.evaluate(() => {
        const c = document.querySelector('#graph canvas');
        return c ? { width: c.width, height: c.height } : null;
      });
      // drawGraph in the implementation sets width=800 and height=600 when it runs correctly
      expect(dims).not.toBeNull();
      expect(dims.width).toBe(800);
      expect(dims.height).toBe(600);
    }
  });

  // Edge-case and robustness: multiple clicks should at least reproduce the click-handler error each time
  test('Repeated GraphClick: multiple clicks produce repeated runtime errors (robustness)', async ({ page }) => {
    const gp = new GraphPage(page);
    await gp.goto();

    const initialErrors = gp.pageErrors.length;

    // Click the graph multiple times to ensure repeated handler execution triggers repeated errors
    await gp.clickGraph();
    await gp.clickGraph();
    await gp.clickGraph();

    // There should be at least one new error beyond initial; likely multiple
    expect(gp.pageErrors.length).toBeGreaterThan(initialErrors);

    // Confirm that the last few errors continue to indicate assignment-to-const or handler problems
    const recentErrors = gp.getPageErrorMessages().slice(initialErrors);
    const someMatch = recentErrors.some((m) => /Assignment to constant variable|assignment to constant|TypeError|Cannot read properties of undefined/i.test(m));
    expect(someMatch).toBeTruthy();
  });

  // Sanity check: log summary of collected console and page errors to help diagnose failures in CI (test output)
  test('Diagnostics: collect and assert presence of runtime error summaries', async ({ page }) => {
    const gp = new GraphPage(page);
    await gp.goto();

    // At least one of: page errors or console errors should be non-empty in this intentionally buggy implementation.
    const hasPageErrors = gp.pageErrors.length > 0;
    const hasConsoleErrors = gp.consoleErrors.length > 0;

    // Assert that the application produced runtime diagnostic output in one of the channels
    expect(hasPageErrors || hasConsoleErrors).toBeTruthy();

    // Optionally surface the messages as test attachments (Playwright test runner will show them)
    // But we will assert that any message contains expected substrings for easier debugging
    const allMessages = gp.getAllConsoleMessages().concat(gp.getPageErrorMessages());
    const anyRelevant = allMessages.some((m) => /drawGraph|sort|Assignment to constant variable|Cannot read properties of undefined|TypeError|x/.test(m));
    expect(anyRelevant).toBeTruthy();
  });
});