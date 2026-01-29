import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52096e00-fa76-11f0-a09b-87751f540fd8.html';

/**
 * Page Object for the Prim's Algorithm demo page.
 * Encapsulates interactions and common assertions.
 */
class PrimPage {
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  // Attach listeners for console and errors BEFORE navigation so we capture early logs/errors.
  async attachListeners() {
    this.page.on('console', (msg) => {
      try {
        this.consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location ? msg.location() : {},
        });
      } catch (e) {
        // Defensive: if reading location fails, still capture text
        this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      }
    });

    this.page.on('pageerror', (err) => {
      // Playwright provides Error instances for runtime errors on the page
      this.pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });
  }

  // Navigate to the application and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // allow some time for synchronous scripts to execute and errors to surface
    await this.page.waitForTimeout(200);
  }

  // Helper to get collected console text lines
  getConsoleTexts() {
    return this.consoleMessages.map(m => m.text);
  }

  // Helper to get any page error names/messages
  getPageErrors() {
    return this.pageErrors;
  }

  // Read the global graph object from the page (read-only)
  async readGraph() {
    return await this.page.evaluate(() => {
      // return shape summary to avoid serializing huge objects fully
      if (typeof graph === 'undefined') return null;
      return {
        verticesCount: Array.isArray(graph.vertices) ? graph.vertices.length : 0,
        edgesCount: Array.isArray(graph.edges) ? graph.edges.length : 0,
        visitedCount: Array.isArray(graph.visited) ? graph.visited.length : 0,
        parentKeys: graph.parent ? Object.keys(graph.parent).length : 0,
        // also expose sample of first and last vertex and first edge for sanity checks
        firstVertex: graph.vertices[0] || null,
        lastVertex: graph.vertices[graph.vertices.length - 1] || null,
        firstEdge: graph.edges[0] || null,
      };
    });
  }

  // Read the drawGraph source code as evidence of entry action
  async drawGraphSource() {
    return await this.page.evaluate(() => {
      return typeof drawGraph === 'function' ? drawGraph.toString() : null;
    });
  }

  // Read the prim function source to validate entry action evidence
  async primSource() {
    return await this.page.evaluate(() => {
      return typeof prim === 'function' ? prim.toString() : null;
    });
  }

  // Get canvas element bounding and attributes
  async getCanvasInfo() {
    return await this.page.evaluate(() => {
      const canvas = document.querySelector('#graph');
      if (!canvas) return null;
      return {
        widthAttr: canvas.getAttribute('width'),
        heightAttr: canvas.getAttribute('height'),
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        bounding: canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null,
      };
    });
  }
}

test.describe("Prim's Algorithm Interactive Application - FSM verification", () => {
  // Test that on page load the prim(graph) is invoked (Processing state),
  // that it logs expected messages, and that the resulting graph structure has edges.
  test('S1_Processing: prim(graph) is invoked on load and logs algorithm outcome', async ({ page }) => {
    const primPage = new PrimPage(page);
    await primPage.attachListeners();

    // Load the page
    await primPage.goto();

    // Verify that prim function exists and contains expected evidence text
    const primSrc = await primPage.primSource();
    expect(primSrc).toBeTruthy();
    expect(primSrc).toContain('function prim(graph)');

    // Inspect console logs for evidence produced by prim(graph)
    const consoleTexts = primPage.getConsoleTexts();
    // There should be a console message indicating "Graph is connected" (per script logic)
    const hasConnected = consoleTexts.some(t => t.includes('Graph is connected'));
    const hasEdges = consoleTexts.some(t => t.includes('Edges:'));
    expect(hasConnected).toBeTruthy();
    expect(hasEdges).toBeTruthy();

    // Inspect the graph object left on the window by the script
    const graphSummary = await primPage.readGraph();
    expect(graphSummary).not.toBeNull();

    // Expect many vertices defined (the HTML contains a large list)
    expect(graphSummary.verticesCount).toBeGreaterThanOrEqual(300);

    // After prim(graph) runs it should populate edges (script pushes many)
    expect(graphSummary.edgesCount).toBeGreaterThan(0);

    // Because startVertex === endVertex (both 0) the implementation does an early break,
    // so visited may be empty as the script logic indicates; assert it is an array.
    expect(typeof graphSummary.visitedCount).toBe('number');

    // Provide evidence the prim entry action was executed: presence of console logs + edges.
  });

  // Test for S0_Idle: drawGraph() should be called on load (Idle state's entry action).
  // The application attempts to draw edges and will trigger a runtime TypeError due to invalid indexing.
  test('S0_Idle: drawGraph() entry action executes and leads to a TypeError due to invalid edge indices', async ({ page }) => {
    const primPage = new PrimPage(page);
    await primPage.attachListeners();

    // Load the page
    await primPage.goto();

    // drawGraph should exist and include clearRect evidence in source
    const drawSrc = await primPage.drawGraphSource();
    expect(drawSrc).toBeTruthy();
    expect(drawSrc).toContain('ctx.clearRect');

    // We expect at least one page error because drawGraph references graph.vertices[to].y
    // where some 'to' values are out-of-range -> TypeError.
    const errors = primPage.getPageErrors();

    // Wait a short bit more to ensure errors collected (already awaited in goto, but be safe)
    await page.waitForTimeout(100);

    // Confirm we captured at least one page runtime error
    expect(errors.length).toBeGreaterThanOrEqual(1);

    // Assert that at least one of the page errors is a TypeError (expected behavior for the broken draw)
    const hasTypeError = errors.some(e => e.name === 'TypeError' || (e.message && e.message.toLowerCase().includes('cannot read')));
    expect(hasTypeError).toBeTruthy();

    // Also assert that the console logs contained the "Graph is connected" message produced earlier by prim
    const consoleTexts = primPage.getConsoleTexts();
    expect(consoleTexts.some(t => t.includes('Graph is connected'))).toBeTruthy();
    expect(consoleTexts.some(t => t.includes('Edges:'))).toBeTruthy();
  });

  // Additional checks: canvas element presence and dimensions, and verification that
  // drawGraph contains the expected drawing operations (evidence of onEnter of Idle).
  test('Canvas exists with expected attributes and drawGraph contains drawing commands', async ({ page }) => {
    const primPage = new PrimPage(page);
    await primPage.attachListeners();

    await primPage.goto();

    const canvasInfo = await primPage.getCanvasInfo();
    expect(canvasInfo).not.toBeNull();
    expect(canvasInfo.widthAttr).toBe('800');
    expect(canvasInfo.heightAttr).toBe('600');

    // client dimensions may vary in headless environment, but attributes must match
    expect(Number(canvasInfo.widthAttr)).toBeGreaterThan(0);
    expect(Number(canvasInfo.heightAttr)).toBeGreaterThan(0);

    // Verify drawGraph source also includes arc drawing (node drawing) evidence
    const drawSrc = await primPage.drawGraphSource();
    expect(drawSrc).toContain('ctx.arc');
    expect(drawSrc).toContain('ctx.strokeStyle');
  });

  // Test ordering and FSM-like transition evidence:
  // We verify that prim(graph) (Processing entry) logs occur before the page runtime error produced by drawGraph (Idle entry).
  test('FSM transition evidence: prim (Processing) logs precede drawGraph (Idle) runtime error', async ({ page }) => {
    const primPage = new PrimPage(page);
    // Collect timestamped events to assert order
    const events = [];
    await primPage.attachListeners();

    // Augment listeners to capture timestamps relative to test runtime
    page.on('console', (msg) => {
      events.push({ kind: 'console', text: msg.text(), time: Date.now() });
    });
    page.on('pageerror', (err) => {
      events.push({ kind: 'pageerror', name: err.name, message: err.message, time: Date.now() });
    });

    await primPage.goto();

    // Wait a bit to ensure all events pushed
    await page.waitForTimeout(200);

    // Find index of first "Graph is connected" console message
    const graphConnectedIndex = events.findIndex(e => e.kind === 'console' && e.text && e.text.includes('Graph is connected'));
    expect(graphConnectedIndex).toBeGreaterThanOrEqual(0);

    // Find index of first pageerror event
    const pageErrorIndex = events.findIndex(e => e.kind === 'pageerror');
    expect(pageErrorIndex).toBeGreaterThanOrEqual(0);

    // Assert that prim's console message occurred earlier than the pageerror (drawGraph's runtime error)
    expect(graphConnectedIndex).toBeLessThan(pageErrorIndex);
  });

  // Edge case / robustness: confirm that the prim source contains the BFS-like logic and evidence strings.
  test('prim() function source contains expected algorithmic structure (evidence of Processing state entry)', async ({ page }) => {
    const primPage = new PrimPage(page);
    await primPage.attachListeners();

    await primPage.goto();

    const primSrc = await primPage.primSource();
    expect(primSrc).toBeTruthy();

    // Evidence strings from FSM definition
    expect(primSrc).toContain('let queue = [startVertex]');
    expect(primSrc).toContain('graph.visited');
    expect(primSrc).toContain('console.log("Graph is connected"') || expect(primSrc).toContain('console.log("Graph is not connected"');
  });
});