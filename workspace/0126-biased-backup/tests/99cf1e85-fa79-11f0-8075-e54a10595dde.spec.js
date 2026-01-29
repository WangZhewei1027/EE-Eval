import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf1e85-fa79-11f0-8075-e54a10595dde.html';

/**
 * Page Object for the Prim's Algorithm demo page.
 * Encapsulates common interactions and queries to keep tests readable.
 */
class PrimPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async numNodesValue() {
    return await this.page.$eval('#numNodes', el => el.value);
  }

  async setNumNodes(value) {
    await this.page.fill('#numNodes', String(value));
  }

  async clickGenerateGraph() {
    await this.page.click('#generateGraph');
  }

  async clickRunPrim() {
    await this.page.click('#runPrim');
  }

  async graphRepresentationText() {
    return await this.page.$eval('#graphRepresentation', el => el.innerText);
  }

  async edgeWeightsText() {
    return await this.page.$eval('#edgeWeights', el => el.innerText);
  }

  async mstOutputText() {
    return await this.page.$eval('#mstOutput', el => el.innerText);
  }

  // Returns boolean indicating presence of global window.currentGraph
  async hasCurrentGraph() {
    return await this.page.evaluate(() => !!window.currentGraph);
  }

  // Runs prim on the window.currentGraph and returns the serialized result if available.
  async runPrimAndGetResultFromPage() {
    return await this.page.evaluate(() => {
      if (!window.currentGraph) return null;
      try {
        const result = window.currentGraph.prim();
        // Return a lightweight representation
        return {
          mstLength: Array.isArray(result.mst) ? result.mst.length : null,
          totalWeight: result.totalWeight
        };
      } catch (err) {
        return { error: String(err) };
      }
    });
  }
}

test.describe('Prim Algorithm Interactive Demo - FSM and UI validation', () => {
  // We will capture console errors and page errors for each test individually.
  // This helps us assert that no unexpected ReferenceError / TypeError / SyntaxError occurred
  // during interactions unless a test explicitly expects an error.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and page errors for assertions
    page.on('console', msg => {
      // Capture console messages with type 'error' and all messages text for diagnostics
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });
  });

  test.afterEach(async () => {
    // After each test ensure that no unexpected runtime errors were emitted.
    // If there are any errors, include them in the assertion message to aid debugging.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);
    expect(consoleErrors.map(c => c.text), `Unexpected console.error messages: ${consoleErrors.map(c => c.text).join(' | ')}`).toEqual([]);
  });

  test('Initial state (S0_Idle): UI elements present and empty outputs', async ({ page }) => {
    // Verify initial idle state - presence of controls and initial content
    const primPage = new PrimPage(page);
    await primPage.goto();

    // Ensure components from FSM are present
    await expect(page.locator('#generateGraph')).toBeVisible();
    await expect(page.locator('#runPrim')).toBeVisible();
    await expect(page.locator('#numNodes')).toBeVisible();
    await expect(page.locator('#graphRepresentation')).toBeVisible();
    await expect(page.locator('#edgeWeights')).toBeVisible();
    await expect(page.locator('#mstOutput')).toBeVisible();

    // Verify default input value (onEnter renderPage() implied)
    const defaultNum = await primPage.numNodesValue();
    expect(defaultNum).toBe('5'); // as specified in HTML attributes

    // Verify outputs are initially empty (Idle state's evidence expectations)
    const graphRep = await primPage.graphRepresentationText();
    const edgeWeights = await primPage.edgeWeightsText();
    const mstOutput = await primPage.mstOutputText();
    expect(graphRep.trim()).toBe('', 'Expected no graph representation in idle state');
    expect(edgeWeights.trim()).toBe('', 'Expected no edge weights displayed in idle state');
    expect(mstOutput.trim()).toBe('', 'Expected no MST output in idle state');
  });

  test('Transition S0_Idle -> S1_GraphGenerated: Generate Graph populates graph and sets window.currentGraph', async ({ page }) => {
    // This test validates clicking "Generate Graph" generates a graph, updates DOM and sets window.currentGraph
    const primPage = new PrimPage(page);
    await primPage.goto();

    // Use a deterministic number of nodes to assert expected number of edge lines
    const numNodes = 5;
    await primPage.setNumNodes(numNodes);

    // Click Generate Graph and wait for UI update (no network, so just small wait for DOM update)
    await primPage.clickGenerateGraph();

    // Ensure window.currentGraph global exists per FSM evidence
    const hasGraph = await primPage.hasCurrentGraph();
    expect(hasGraph).toBe(true);

    // Check that graphRepresentation got populated: lines correspond to edges (n*(n-1)/2)
    const graphRepText = await primPage.graphRepresentationText();
    const lines = graphRepText.split('\n').map(l => l.trim()).filter(Boolean);
    const expectedEdgeCount = (numNodes * (numNodes - 1)) / 2;
    // The implementation lists each undirected edge once, so expect that many lines
    expect(lines.length, `Expected ${expectedEdgeCount} edges shown, got ${lines.length} lines`).toBe(expectedEdgeCount);

    // EdgeWeights should contain a serialized adjacency matrix string (non-empty)
    const edgeWeightsText = await primPage.edgeWeightsText();
    expect(edgeWeightsText.trim().length).toBeGreaterThan(0);

    // Ensure adjacency matrix contains diagonal zeros (sanity check)
    expect(edgeWeightsText).toContain('0');

    // Also verify that calling prim() on the stored graph via page.evaluate returns expected shape
    const primResult = await primPage.runPrimAndGetResultFromPage();
    // The prim algorithm on the stored graph should return an object with numeric totalWeight
    expect(primResult).not.toBeNull();
    expect(typeof primResult.totalWeight === 'number' || typeof primResult.totalWeight === 'bigint').toBe(true);
  });

  test('Transition S1_GraphGenerated -> S2_PrimExecuted: Run Prim displays MST and total weight', async ({ page }) => {
    // This test validates that once a graph is generated, clicking "Run Prim" displays MST and total weight
    const primPage = new PrimPage(page);
    await primPage.goto();

    // Generate a graph first
    await primPage.setNumNodes(6);
    await primPage.clickGenerateGraph();

    // Confirm graph exists
    expect(await primPage.hasCurrentGraph()).toBe(true);

    // Click Run Prim and then assert MST output content
    await primPage.clickRunPrim();

    // MST output should contain the header "MST Edges:" and "Total Weight:"
    const mstText = await primPage.mstOutputText();
    expect(mstText).toContain('MST Edges:');
    expect(mstText).toMatch(/Total Weight:/);

    // Extract the numeric total weight from the output (basic parse)
    const totalWeightMatch = mstText.match(/Total Weight:\s*([-\d.]+)/);
    expect(totalWeightMatch, 'Total Weight not found or not numeric in MST output').not.toBeNull();
    const totalWeight = Number(totalWeightMatch ? totalWeightMatch[1] : NaN);
    expect(Number.isFinite(totalWeight), 'Parsed total weight should be a finite number').toBe(true);

    // The MST edges block should contain at least one edge line (for n>=2)
    const edgesBlock = mstText.split('MST Edges:')[1] || '';
    const edgeLines = edgesBlock.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('Total Weight'));
    expect(edgeLines.length).toBeGreaterThanOrEqual(1);
  });

  test('Edge case: Clicking Run Prim without generating graph should alert the user (error scenario)', async ({ page }) => {
    // This test validates that attempting to run Prim before generating a graph
    // triggers the expected alert message "Generate a graph first!"
    const primPage = new PrimPage(page);
    await primPage.goto();

    // Ensure there is no currentGraph initially
    expect(await primPage.hasCurrentGraph()).toBe(false);

    // Listen for dialog and capture message
    let dialogMessage = null;
    page.on('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    // Click Run Prim; per implementation this should trigger an alert
    await primPage.clickRunPrim();

    // Wait briefly to allow dialog event to fire
    await page.waitForTimeout(100);

    expect(dialogMessage).toBe('Generate a graph first!');
  });

  test('Robustness: Generate graph with a low number of nodes (min allowed) and run prim', async ({ page }) => {
    // This test explores an edge input value (min 2) to ensure the app handles small graphs gracefully
    const primPage = new PrimPage(page);
    await primPage.goto();

    // Set numNodes to 2 (lower bound) and generate
    await primPage.setNumNodes(2);
    await primPage.clickGenerateGraph();

    // Confirm window.currentGraph exists
    expect(await primPage.hasCurrentGraph()).toBe(true);

    // Check graphRepresentation: for 2 nodes there should be exactly 1 edge
    const graphRepText = await primPage.graphRepresentationText();
    const lines = graphRepText.split('\n').map(l => l.trim()).filter(Boolean);
    expect(lines.length).toBe(1);

    // Run Prim and validate output is well-formed
    await primPage.clickRunPrim();
    const mstText = await primPage.mstOutputText();
    expect(mstText).toContain('MST Edges:');
    expect(mstText).toMatch(/Total Weight:/);
  });

  test('Console and runtime error detection: ensure no ReferenceError/SyntaxError/TypeError occur during typical flows', async ({ page }) => {
    // This test purposefully performs typical interactions and asserts that no unexpected runtime errors
    // (ReferenceError, SyntaxError, TypeError) are emitted to the page console or as uncaught exceptions.

    const primPage = new PrimPage(page);
    await primPage.goto();

    // Perform a set of typical interactions
    await primPage.clickGenerateGraph();
    await primPage.clickRunPrim();

    // Also generate again with different size
    await primPage.setNumNodes(4);
    await primPage.clickGenerateGraph();
    await primPage.clickRunPrim();

    // At the end of the test, the afterEach hook asserts that consoleErrors and pageErrors are empty.
    // Here we additionally assert that no console error text contains common JS error names.
    // (This will be redundant with afterEach, but provides a clearer failure message if found here.)
    // Collect all console entries - we cannot access the closure arrays here, but our afterEach will fail if any exist.
    expect(true).toBe(true); // dummy assertion to ensure test registers activity; actual error checks are in afterEach
  });
});