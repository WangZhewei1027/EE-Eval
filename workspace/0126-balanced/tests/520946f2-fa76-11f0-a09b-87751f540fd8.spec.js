import { test, expect } from '@playwright/test';

// Test file for Application ID: 520946f2-fa76-11f0-a09b-87751f540fd8
// URL: http://127.0.0.1:5500/workspace/0126-balanced/html/520946f2-fa76-11f0-a09b-87751f540fd8.html
//
// This test suite validates the single FSM state (S0_Idle) described in the FSM,
// verifies entry evidence is rendered, observes console output from the page script,
// asserts behavior of the bellmanFord function for normal and error cases, and
// verifies the presence (or absence) of the entry action function renderPage().
//
// IMPORTANT: The tests do not modify the page code; they load the page exactly as-is,
// invoke existing functions where available, and intentionally call a missing function
// to confirm natural ReferenceError behavior. All errors/exceptions are allowed to
// occur naturally and are asserted accordingly.

// Page object model for the Bellman-Ford page
class BellmanFordPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  // Attach listeners to capture console messages and page errors
  async attachListeners() {
    this.consoleMessages = [];
    this.pageErrors = [];
    this.page.on('console', (msg) => {
      // store type and text for assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // uncaught exceptions in the page context
      this.pageErrors.push(err);
    });
  }

  async goto(url) {
    await this.page.goto(url);
  }

  // Read the main header text
  async getHeaderText() {
    return this.page.textContent('h1');
  }

  // Read the first paragraph text
  async getIntroParagraph() {
    // There are multiple paragraphs; this selects the first paragraph node after the header
    return this.page.textContent('p');
  }

  // Return captured console messages
  getConsoleMessages() {
    return this.consoleMessages.map((m) => ({ type: m.type, text: m.text }));
  }

  // Return captured page errors
  getPageErrors() {
    return this.pageErrors;
  }

  // Attempt to call the globally defined bellmanFord function in page context with given args
  // Returns the resolved value or throws if the function throws.
  async callBellmanFord(graph, source) {
    // Use structured cloneable arguments via evaluate
    return this.page.evaluate(
      ({ graph, source }) => {
        // call the global bellmanFord defined in the page (if available)
        return bellmanFord(graph, source);
      },
      { graph, source }
    );
  }

  // Attempt to invoke renderPage in the page context (expected to be missing -> ReferenceError)
  async callRenderPage() {
    // Intentionally call a possibly undefined function; the test will assert that this throws.
    return this.page.evaluate(() => {
      // This will throw ReferenceError in the page context if renderPage is not defined.
      // We do not catch it here so it propagates out to the test.
      return renderPage();
    });
  }

  // Check if a global variable is present in the page
  async hasGlobal(name) {
    return this.page.evaluate((name) => {
      return typeof globalThis[name] !== 'undefined';
    }, name);
  }
}

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-balanced/html/520946f2-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Bellman-Ford interactive page - FSM S0_Idle validation', () => {
  // Ensure each test has a fresh page and attached listeners
  test.beforeEach(async ({ page }) => {
    // nothing here; each test will create its own PageModel and navigate
  });

  test('S0_Idle: Page renders expected header and introductory text (entry evidence)', async ({ page }) => {
    // This test validates the FSM 'evidence' for the Idle state is present in the DOM.
    const bfPage = new BellmanFordPage(page);
    await bfPage.attachListeners();
    await bfPage.goto(APP_URL);

    // Assert header exists and matches expected text
    const header = await bfPage.getHeaderText();
    expect(header).toBe('Bellman-Ford Algorithm');

    // Assert the first paragraph contains expected explanation about algorithm
    const paragraph = await bfPage.getIntroParagraph();
    expect(paragraph).toContain(
      'The Bellman-Ford algorithm is used to find the shortest path from a source vertex to all other vertices in a weighted graph'
    );

    // Ensure there were no uncaught page errors on initial load
    const pageErrors = bfPage.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });

  test('Console output on load includes shortest distances logged by the script', async ({ page }) => {
    // This test listens to console logs emitted during page load and asserts
    // that the sample run of bellmanFord logged the expected lines (A 0, B 4, C 2).
    const bfPage = new BellmanFordPage(page);
    await bfPage.attachListeners();
    await bfPage.goto(APP_URL);

    // Collect textual console.log messages
    const logs = bfPage.getConsoleMessages().filter((m) => m.type === 'log').map((m) => m.text);

    // Expect the summary line followed by individual vertex logs.
    // The script logs "Shortest distances from A to all other vertices:"
    expect(logs.some((t) => t.includes('Shortest distances from'))).toBeTruthy();

    // The script logs vertex and distance pairs like "A 0"
    const expectedPairs = ['A 0', 'B 4', 'C 2'];
    for (const pair of expectedPairs) {
      expect(logs.some((t) => t.includes(pair))).toBeTruthy();
    }

    // Ensure no console error messages appeared during load
    const errorLogs = bfPage.getConsoleMessages().filter((m) => m.type === 'error');
    expect(errorLogs.length).toBe(0);
  });

  test('Entry action "renderPage" is not defined: invoking it throws a ReferenceError', async ({ page }) => {
    // FSM lists renderPage() as an entry_action. The implementation does not define renderPage.
    // This test asserts that the global renderPage is missing and that calling it produces a ReferenceError.
    const bfPage = new BellmanFordPage(page);
    await bfPage.attachListeners();
    await bfPage.goto(APP_URL);

    // Verify renderPage is not defined on globalThis
    const hasRender = await bfPage.hasGlobal('renderPage');
    expect(hasRender).toBe(false);

    // Attempting to call renderPage inside page context should reject with a ReferenceError.
    // We assert that the evaluation promise rejects and the error message indicates renderPage is not defined.
    await expect(bfPage.callRenderPage()).rejects.toThrow(/renderPage is not defined|ReferenceError/);
  });

  test('bellmanFord returns correct distances for the built-in example when invoked directly', async ({ page }) => {
    // Validate that bellmanFord is available globally and calling it directly via evaluate returns
    // the expected distances object for a known graph.
    const bfPage = new BellmanFordPage(page);
    await bfPage.attachListeners();
    await bfPage.goto(APP_URL);

    // The graph used in the page initial example:
    const graph = {
      A: { B: 4, C: 2 },
      B: { A: 1, C: 3 },
      C: { A: 1, B: 2 },
    };

    // Call bellmanFord and assert returned distances
    const distances = await bfPage.callBellmanFord(graph, 'A');
    // Expect an object with numeric distance values
    expect(distances).toBeTruthy();
    expect(distances.A).toBe(0);
    expect(distances.B).toBe(4);
    expect(distances.C).toBe(2);
  });

  test('bellmanFord throws "Negative cycle detected" for graphs with a negative cycle', async ({ page }) => {
    // Edge case: ensure the function detects negative cycles and throws the expected Error.
    const bfPage = new BellmanFordPage(page);
    await bfPage.attachListeners();
    await bfPage.goto(APP_URL);

    // Construct a simple graph with a negative cycle: A -> B (-5), B -> A (-1) has total negative cycle
    const negativeCycleGraph = {
      A: { B: -5 },
      B: { A: -1 },
    };

    // Calling bellmanFord with this graph should reject with an Error containing "Negative cycle detected"
    await expect(bfPage.callBellmanFord(negativeCycleGraph, 'A')).rejects.toThrow(/Negative cycle detected/);

    // Ensure that this thrown error did not appear as an uncaught pageerror (it was caught by evaluate)
    // We still expect no uncaught page errors because the evaluate handled the exception propagation.
    const pageErrors = bfPage.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });

  test('Calling bellmanFord with disconnected nodes yields Infinity distances for unreachable nodes', async ({ page }) => {
    // Edge case: some nodes unreachable from the source should have Infinity distances.
    const bfPage = new BellmanFordPage(page);
    await bfPage.attachListeners();
    await bfPage.goto(APP_URL);

    const graph = {
      A: { B: 1 },
      B: {}, // B has no outgoing edges
      C: { D: 2 }, // C and D are disconnected from A/B component
      D: {},
    };

    const distances = await bfPage.callBellmanFord(graph, 'A');
    // A reachable from itself
    expect(distances.A).toBe(0);
    // B reachable from A via edge weight 1
    expect(distances.B).toBe(1);
    // C and D unreachable, should be Infinity
    // Note: Infinity in structured clone becomes null? In practice, Infinity is serializable in JSON via evaluate,
    // but Playwright structured-clone preserves Infinity. Assert using global isFinite checks.
    // We check that numeric values are Infinity by comparing to the global Infinity.
    expect(distances.C).toBe(Number.POSITIVE_INFINITY);
    expect(distances.D).toBe(Number.POSITIVE_INFINITY);
  });
});