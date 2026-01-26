import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf1e81-fa79-11f0-8075-e54a10595dde.html';

/**
 * Page Object for the Dijkstra demo page.
 * Encapsulates common interactions used across tests.
 */
class DijkstraPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nodesInput = page.locator('#nodes');
    this.edgesInput = page.locator('#edges');
    this.createBtn = page.locator('#createGraph');
    this.findBtn = page.locator('#findShortestPath');
    this.result = page.locator('#result');
    this.graph = page.locator('#graph');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the page has loaded the primary controls before proceeding.
    await expect(this.createBtn).toBeVisible();
    await expect(this.findBtn).toBeVisible();
    await expect(this.nodesInput).toBeVisible();
    await expect(this.edgesInput).toBeVisible();
  }

  async fillNodes(nodesCsv) {
    await this.nodesInput.fill(nodesCsv);
  }

  async fillEdges(edgesCsv) {
    await this.edgesInput.fill(edgesCsv);
  }

  async clickCreateGraph() {
    await this.createBtn.click();
  }

  /**
   * Clicks the 'Find Shortest Path' button while automatically answering
   * sequential prompt dialogs with provided responses.
   * @param {string[]} promptResponses - array of string responses (first = start, second = end)
   */
  async clickFindShortestPathWithPrompts(promptResponses = []) {
    // Set up a dialog handler that will accept dialogs sequentially with the provided responses.
    const responses = Array.from(promptResponses);
    const dialogHandler = async (dialog) => {
      const response = responses.shift() ?? '';
      await dialog.accept(response);
    };
    this.page.on('dialog', dialogHandler);
    try {
      await this.findBtn.click();
      // Wait a short time for the handlers and the page's JS to run (prompts and then computation).
      // Tests that expect specific outcomes will wait explicitly for those outcomes.
      await this.page.waitForTimeout(200); // small stabilization wait
    } finally {
      // Clean up the dialog handler to avoid interfering with other tests.
      this.page.off('dialog', dialogHandler);
    }
  }

  async getResultText() {
    return (await this.result.textContent())?.trim() ?? '';
  }
}

test.describe('Dijkstra Algorithm Interactive Demo - FSM validation', () => {
  // Common page variable for tests
  let page;
  let dijkstraPage;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    dijkstraPage = new DijkstraPage(page);
    // Navigate to the app before each test
    await dijkstraPage.goto();
  });

  test.afterEach(async () => {
    // small cleanup delay to ensure page completes any pending microtasks
    await page.waitForTimeout(50);
  });

  test('S0_Idle: initial UI is rendered with expected components', async () => {
    // Validate the Idle state's evidence: presence of inputs, placeholders, buttons, and result area.
    await expect(dijkstraPage.nodesInput).toBeVisible();
    await expect(dijkstraPage.edgesInput).toBeVisible();
    await expect(dijkstraPage.createBtn).toBeVisible();
    await expect(dijkstraPage.findBtn).toBeVisible();
    await expect(dijkstraPage.graph).toBeVisible();
    await expect(dijkstraPage.result).toBeVisible();

    // Validate placeholders match the FSM/HTML evidence
    await expect(dijkstraPage.nodesInput).toHaveAttribute('placeholder', 'A,B,C,D,E');
    await expect(dijkstraPage.edgesInput).toHaveAttribute('placeholder', 'A-B:1,B-C:2');

    // Result area should initially be empty
    const initialResult = await dijkstraPage.getResultText();
    expect(initialResult).toBe('');
  });

  test('Transition S0 -> S1: Create Graph sets "Graph created..." message', async () => {
    // This test validates the CreateGraph event and transition to GraphCreated state.
    // Fill nodes and edges, click create, and verify the result text per FSM evidence.
    await dijkstraPage.fillNodes('A,B,C');
    await dijkstraPage.fillEdges('A-B:1,B-C:2');
    await dijkstraPage.clickCreateGraph();

    // Verify the expected observable text
    await expect(dijkstraPage.result).toHaveText('Graph created. You can now find the shortest path.');
  });

  test('Transition S1 -> S2 (path exists): invoking FindShortestPath leads to internal TypeError due to implementation bug', async () => {
    // This test intentionally reproduces the scenario where a shortest path exists.
    // According to the provided inline JS, the dijkstra function contains a bug:
    // it declares currentNode as const and then attempts to reassign it during path reconstruction,
    // which should cause a TypeError at runtime. We must let that error happen and assert it.
    // Steps:
    // 1. Create a graph with a valid path A -> C via B
    // 2. Click Find Shortest Path and answer prompts with start=A, end=C
    // 3. Observe a page 'pageerror' event and assert it's a TypeError

    // Create graph
    await dijkstraPage.fillNodes('A,B,C');
    await dijkstraPage.fillEdges('A-B:1,B-C:2');
    await dijkstraPage.clickCreateGraph();
    await expect(dijkstraPage.result).toHaveText('Graph created. You can now find the shortest path.');

    // Prepare to capture page errors
    const pageErrors = [];
    const pageErrorHandler = (err) => {
      pageErrors.push(err);
    };
    page.on('pageerror', pageErrorHandler);

    // Provide dialog responses for start and end nodes
    const prompts = ['A', 'C'];

    // Perform the click which will open two prompts in sequence; accept them.
    // Use clickFindShortestPathWithPrompts to manage dialogs.
    await dijkstraPage.clickFindShortestPathWithPrompts(prompts);

    // Wait for a pageerror to be emitted - the buggy dijkstra should cause one.
    // Use waitForEvent so the test doesn't flake if the error is delayed slightly.
    const err = await page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);

    // Clean up listener
    page.off('pageerror', pageErrorHandler);

    // The error should exist and be a TypeError caused by assignment to a const variable.
    expect(err).not.toBeNull();
    // The Error object emitted by the page should have a name 'TypeError'
    expect(err.name).toBe('TypeError');

    // The result text should NOT have been updated to a valid shortest path string
    const resultText = await dijkstraPage.getResultText();
    // It is acceptable that the result remains "Graph created..." or is unchanged; ensure it's not the expected success message format
    expect(resultText).not.toMatch(/Shortest path from A to C/);
  });

  test('Transition S1 -> S2 (path not found): FindShortestPath when end node absent returns "Path not found."', async () => {
    // This test validates the "Path not found." branch of the transition.
    // Create a graph, then request a path to a node not in the graph (Z) to avoid hitting the bug that reconstructs a path.
    await dijkstraPage.fillNodes('A,B,C');
    await dijkstraPage.fillEdges('A-B:1,B-C:2');
    await dijkstraPage.clickCreateGraph();
    await expect(dijkstraPage.result).toHaveText('Graph created. You can now find the shortest path.');

    // Capture any page errors to ensure none occur for this path-not-found scenario.
    const errors = [];
    const onErr = (e) => errors.push(e);
    page.on('pageerror', onErr);

    // Answer prompts: start A, end Z (not in graph)
    await dijkstraPage.clickFindShortestPathWithPrompts(['A', 'Z']);

    // Wait for the result text to update to "Path not found."
    await expect(dijkstraPage.result).toHaveText('Path not found.');

    // Ensure no page errors occurred during this operation
    page.off('pageerror', onErr);
    expect(errors.length).toBe(0);
  });

  test('Edge case: Click Find Shortest Path before creating graph -> should show "Path not found." and not throw', async () => {
    // This test validates the behavior when a user attempts to find a path without creating a graph first.
    // The implementation initializes graph = {} by default. We expect the algorithm to return null and the UI to show "Path not found."
    const errors = [];
    const onErr = (e) => errors.push(e);
    page.on('pageerror', onErr);

    // Answer prompts for start and end (these nodes don't exist in the empty graph)
    await dijkstraPage.clickFindShortestPathWithPrompts(['A', 'B']);

    // Expect the UI to show "Path not found."
    await expect(dijkstraPage.result).toHaveText('Path not found.');

    // No errors should have been emitted
    page.off('pageerror', onErr);
    expect(errors.length).toBe(0);
  });

  test('Edge case: malformed edges input (missing weight) still allows Create Graph and FindShortestPath returns "Path not found." for unknown end', async () => {
    // This test checks how the app handles malformed edge specifications like "A-B" (no ":weight").
    // We assert that Create Graph does not crash and that later a search to a non-existent node returns "Path not found."
    await dijkstraPage.fillNodes('A,B');
    await dijkstraPage.fillEdges('A-B'); // malformed edge, missing weight
    await dijkstraPage.clickCreateGraph();

    // Even with malformed input, the UI should still indicate graph creation (no JS thrown)
    await expect(dijkstraPage.result).toHaveText('Graph created. You can now find the shortest path.');

    // Ensure no pageerror during the next operation
    const errors = [];
    const onErr = (e) => errors.push(e);
    page.on('pageerror', onErr);

    // Ask for a path to a node that doesn't exist to avoid triggering the path-reconstruction bug.
    await dijkstraPage.clickFindShortestPathWithPrompts(['A', 'Z']);
    await expect(dijkstraPage.result).toHaveText('Path not found.');

    page.off('pageerror', onErr);
    expect(errors.length).toBe(0);
  });
});