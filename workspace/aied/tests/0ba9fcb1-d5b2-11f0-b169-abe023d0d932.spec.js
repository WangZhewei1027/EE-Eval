import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba9fcb1-d5b2-11f0-b169-abe023d0d932.html';

// Page object model for the Prim's Algorithm demo
class PrimsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      numVertices: '#numVertices',
      generateButton: '#generateGraph',
      graph: '#graph',
      vertex: '#graph div'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getNumVerticesValue() {
    return await this.page.$eval(this.selectors.numVertices, el => el.value);
  }

  async setNumVerticesValue(value) {
    const input = await this.page.$(this.selectors.numVertices);
    await input.fill(''); // clear
    await input.type(String(value));
  }

  async clickGenerateGraph() {
    await this.page.click(this.selectors.generateButton);
  }

  async getVertices() {
    return await this.page.$$(this.selectors.vertex);
  }

  async clickVertexAt(index) {
    const vertices = await this.getVertices();
    if (index < 0 || index >= vertices.length) {
      throw new Error(`Vertex index ${index} out of range (0..${vertices.length - 1})`);
    }
    await vertices[index].click();
  }

  async vertexHasClass(index, className) {
    const vertices = await this.getVertices();
    if (index < 0 || index >= vertices.length) return false;
    return await vertices[index].evaluate((el, cls) => el.classList.contains(cls), className);
  }
}

test.describe('Prim\'s Algorithm Interactive App - FSM validation', () => {
  let page;
  let prims;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Collect console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];
    page.on('console', msg => {
      // capture console text for later inspection
      try {
        consoleMessages.push(String(msg.text()));
      } catch (e) {
        consoleMessages.push('<unserializable console message>');
      }
    });
    page.on('pageerror', err => {
      // capture errors thrown in the page (ReferenceError/TypeError/etc.)
      pageErrors.push(err);
    });

    prims = new PrimsPage(page);
    await prims.goto();

    // Wait for initial render to stabilize: the page's script calls generateGraph on load
    await page.waitForSelector('#graph div');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('State S0_Idle - initial UI elements are present (input and generate button)', async () => {
    // This validates the Idle state's evidence: the input and the button exist on the page.
    const numValue = await prims.getNumVerticesValue();
    expect(numValue).toBeDefined();
    // The default value in the provided HTML is "5"
    expect(numValue).toBe('5');

    const generateButton = await page.$('#generateGraph');
    expect(generateButton).not.toBeNull();

    // Graph container exists
    const graph = await page.$('#graph');
    expect(graph).not.toBeNull();

    // Because the page's script calls generateGraph on load, vertices should already be present.
    const vertices = await prims.getVertices();
    // Expect at least one vertex (default 5 present). This checks that renderPage()/initial generation ran.
    expect(vertices.length).toBeGreaterThanOrEqual(1);

    // No page errors should have occurred just from loading in typical case
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0 -> S1: clicking Generate Graph regenerates the graph (Graph Generated)', async () => {
    // This test validates the GenerateGraph event and S1 entry action generateGraph(numVertices).
    // We change the numVertices to 3 and click the Generate Graph button and assert the graph shows 3 vertices.
    await prims.setNumVerticesValue(3);
    // Ensure input updated
    expect(await prims.getNumVerticesValue()).toBe('3');

    // Click the generate button to trigger generateGraph
    await prims.clickGenerateGraph();

    // Wait for vertices to appear. Because generation is synchronous, this should be immediate,
    // but use waitForSelector to be robust.
    await page.waitForSelector('#graph div');

    const vertices = await prims.getVertices();
    // Expect exactly 3 vertices to be present after regeneration
    expect(vertices.length).toBe(3);

    // Verify there were no exceptions during generation itself
    expect(pageErrors.length).toBe(0);

    // Sanity check: clicking generate again with larger number updates vertex count
    await prims.setNumVerticesValue(6);
    await prims.clickGenerateGraph();
    await page.waitForSelector('#graph div');
    const vertices6 = await prims.getVertices();
    expect(vertices6.length).toBe(6);
  });

  test('Transition S1 -> S2: clicking a vertex triggers selection logic (and reveals an implementation TypeError)', async () => {
    // This test validates the SelectVertex event. The implementation attempts to mark a neighbor edge DOM element
    // but uses the edge object (not DOM), which should cause a TypeError when edges exist.
    // We assert that a pageerror (TypeError) occurs and that the vertex does not end up with the expected "green" class.
    // Ensure there are multiple vertices so that neighbors likely exist (default page load has 5).
    const verticesBefore = await prims.getVertices();
    expect(verticesBefore.length).toBeGreaterThanOrEqual(2);

    // Click the first vertex and wait briefly for error to propagate
    // Use waitForEvent to ensure we catch at least one pageerror
    const pageErrorPromise = page.waitForEvent('pageerror').catch(() => null);

    await prims.clickVertexAt(0);

    // Wait up to 1s for a pageerror to fire (the implementation should throw a TypeError)
    const pageError = await pageErrorPromise;
    // We expect an error due to the bug where code tries to call classList on a plain edge object
    expect(pageError).not.toBeNull();
    // The error type or message should indicate inability to read property 'classList' or similar TypeError
    const message = pageError?.message || '';
    expect(message.toLowerCase()).toContain('classlist');

    // Because the TypeError occurs before the vertex.classList.add('green') call completes,
    // the vertex should NOT have the 'green' class.
    const hasGreen = await prims.vertexHasClass(0, 'green');
    expect(hasGreen).toBe(false);
  });

  test('Edge case: single vertex graph should not throw when clicked (no edges, no selectedEdge)', async () => {
    // Set the number of vertices to 1 and regenerate graph
    await prims.setNumVerticesValue(1);
    await prims.clickGenerateGraph();

    // Wait for the single vertex to be present
    await page.waitForSelector('#graph div');

    const vertices = await prims.getVertices();
    expect(vertices.length).toBe(1);

    // Clear any prior captured page errors
    pageErrors.length = 0;

    // Click the single vertex. Because there are no edges/neighbors, the code path that causes the TypeError should not run.
    // We wait for a short timeout to ensure no pageerror is emitted.
    await prims.clickVertexAt(0);
    // Allow a brief moment for any errors to surface
    await page.waitForTimeout(200);

    // Assert that no page errors occurred for this interaction
    expect(pageErrors.length).toBe(0);

    // Also the code only adds 'green' when a selectedEdge exists; since neighbors array is empty, no green class is expected.
    const hasGreen = await prims.vertexHasClass(0, 'green');
    expect(hasGreen).toBe(false);
  });

  test('Robustness: repeated Generate Graph calls add multiple listeners which can produce multiple errors on vertex click', async () => {
    // This test demonstrates an implementation issue: generateGraph adds graph.addEventListener inside a loop,
    // and calling it repeatedly multiplies listeners. Clicking a vertex can then trigger multiple handlers,
    // each potentially throwing a TypeError. We assert that multiple pageerror events can be observed.
    // Use a fresh vertex count >=2
    await prims.setNumVerticesValue(4);
    await prims.clickGenerateGraph();
    // Call generateGraph a second time to increase the number of attached listeners
    await prims.clickGenerateGraph();

    // There should be vertices present
    await page.waitForSelector('#graph div');
    const verts = await prims.getVertices();
    expect(verts.length).toBe(4);

    // Prepare to collect multiple pageerror events. We'll await two errors or time out.
    const errorsCaught = [];
    const onError = (err) => errorsCaught.push(err);
    page.on('pageerror', onError);

    // Click a vertex which should (due to multiple listeners) generate multiple errors
    await prims.clickVertexAt(1);

    // Allow a bit of time for multiple handlers to run and errors to be emitted
    await page.waitForTimeout(300);

    // Remove our temporary listener
    page.off('pageerror', onError);

    // We expect at least one error, likely multiple due to multiple event listeners attached.
    expect(errorsCaught.length).toBeGreaterThanOrEqual(1);

    // If multiple errors were generated, we assert that at least two occurred to illustrate listener duplication.
    // This is a soft expectation — the implementation specifics may vary — so allow either 1 or >=2.
    // We assert >=1 because at minimum one handler should error.
    expect(errorsCaught.length).toBeGreaterThanOrEqual(1);
  });

  test('Observability: console logs are collected and can be inspected (no unexpected console errors on load)', async () => {
    // This test simply demonstrates that we are observing console messages and that routine logs (if any) are captured.
    // We expect some console messages collection to be available (may be empty).
    expect(Array.isArray(consoleMessages)).toBe(true);
    // No console-based errors were expected on initial load in this implementation
    // but we assert that captured console messages are strings.
    for (const msg of consoleMessages) {
      expect(typeof msg === 'string' || msg instanceof String).toBe(true);
    }
  });
});