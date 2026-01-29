import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf1e82-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Bellman-Ford demo page
class BellmanFordPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.verticesInput = page.locator('#vertices');
    this.sourceInput = page.locator('#source');
    this.addEdgeButton = page.locator('button', { hasText: 'Add Edge' });
    this.runButton = page.locator('button', { hasText: 'Run Bellman-Ford' });
    this.resetButton = page.locator('button', { hasText: 'Reset' });
    this.edgesContainer = page.locator('#edges');
    this.resultDiv = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setVertices(n) {
    await this.verticesInput.fill(String(n));
  }

  async setSource(s) {
    await this.sourceInput.fill(String(s));
  }

  async clickAddEdge() {
    await this.addEdgeButton.click();
  }

  async clickRun() {
    await this.runButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async edgesCount() {
    // count direct children in edges container (div wrappers created by addEdgeInput)
    return await this.page.evaluate(() => {
      const container = document.getElementById('edges');
      if (!container) return 0;
      return container.children.length;
    });
  }

  async addEdgeInputsViaDOM(valuesArray) {
    // Insert plain input elements (only inputs with class 'edge-input') to avoid wrapper/div duplication
    // valuesArray is like ['0,1,1','1,0,-3']
    await this.page.evaluate((vals) => {
      const container = document.getElementById('edges');
      container.innerHTML = ''; // start fresh
      for (const v of vals) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'edge-input';
        inp.value = v;
        container.appendChild(inp);
      }
    }, valuesArray);
  }

  async getResultText() {
    return await this.resultDiv.innerText();
  }

  async clearEdgesAndResultViaDOM() {
    await this.page.evaluate(() => {
      const container = document.getElementById('edges');
      const result = document.getElementById('result');
      if (container) container.innerHTML = '';
      if (result) result.innerHTML = '';
    });
  }
}

test.describe('Interactive Bellman-Ford Algorithm - FSM states and transitions', () => {
  // We will capture page errors and console errors in each test individually to assert their presence/absence.
  test.beforeEach(async ({ page }) => {
    // Minimally ensure no test inherits listeners; each test will add its own listeners as needed.
    // Nothing else to do here.
  });

  // Test initial Idle state: presence of core UI elements and no page errors on load.
  test('Initial Idle state: page loads and UI elements are present', async ({ page }) => {
    // Arrange
    const errors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => errors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const demo = new BellmanFordPage(page);
    // Act
    await demo.goto();

    // Assert - verify presence of inputs and buttons (evidence for S0_Idle and S1_Input)
    await expect(demo.verticesInput).toBeVisible();
    await expect(demo.sourceInput).toBeVisible();
    await expect(demo.addEdgeButton).toBeVisible();
    await expect(demo.runButton).toBeVisible();
    await expect(demo.resetButton).toBeVisible();
    await expect(demo.edgesContainer).toBeVisible();
    await expect(demo.resultDiv).toBeVisible();

    // There should be no unexpected page errors on a clean load.
    expect(errors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition: Running with empty inputs (Idle -> Input attempted Run) causes a runtime error.
  test('Run without inputs triggers runtime error (observes page error)', async ({ page }) => {
    // This test validates that invoking RunBellmanFord with missing inputs causes an uncaught runtime error
    // (e.g., creating an Array with NaN length leads to a RangeError). We must observe and assert that error.
    const demo = new BellmanFordPage(page);
    await demo.goto();

    // Wait for the pageerror event that occurs when clicking Run with empty inputs.
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Act - click Run with empty inputs
    await demo.clickRun();

    // Assert - pageerror should be emitted naturally from the runtime; verify it contains an indicative message.
    const err = await pageErrorPromise;
    // We assert that some kind of RangeError/TypeError occurred by checking the message.
    // The implementation may produce "Invalid array length" (RangeError) when vertices is NaN.
    expect(err).toBeTruthy();
    const msg = String(err.message || err.toString() || '');
    expect(msg.length).toBeGreaterThan(0);
    // Accept either messages mentioning 'Invalid' or 'array' or similar runtime array errors.
    const indicatesArrayIssue =
      msg.toLowerCase().includes('invalid') ||
      msg.toLowerCase().includes('array') ||
      msg.toLowerCase().includes('range') ||
      msg.toLowerCase().includes('split') ||
      msg.toLowerCase().includes('cannot');
    expect(indicatesArrayIssue).toBeTruthy();
  });

  // Test valid run without edges: Input provided then Run -> Result displayed (Edge case: no edges)
  test('Valid run with vertices and source but no edges displays result (Input -> Result)', async ({ page }) => {
    // This test verifies the S1_Input -> S3_Result transition when there are vertices and source,
    // but no edges: algorithm should compute distances and display them.
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e));
    const consoleErrs = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrs.push(msg.text());
    });

    const demo = new BellmanFordPage(page);
    await demo.goto();

    // Arrange: input vertices and source
    await demo.setVertices(3);
    await demo.setSource(0);

    // Act: run
    await demo.clickRun();

    // Assert: result div shows computed distances and no page errors occurred
    const resultText = await demo.getResultText();
    expect(resultText).toContain('Shortest Distances');
    // For 3 vertices and no edges, distances: Vertex 0: 0, Vertex 1: Infinity, Vertex 2: Infinity
    expect(resultText).toContain('Vertex 0: 0');
    expect(resultText).toContain('Vertex 1: Infinity');
    expect(resultText).toContain('Vertex 2: Infinity');

    // No runtime errors should have occurred for this valid scenario
    expect(pageErrors.length).toBe(0);
    expect(consoleErrs.length).toBe(0);
  });

  // Test AddEdge behavior: add input field appears, removal works, and adding an edge then directly running
  // (without cleaning up the wrapper created by addEdgeInput) exposes a TypeError in getEdges (edge-case)
  test('Add Edge: adding and removing edge inputs; adding then running can produce runtime error', async ({ page }) => {
    const demo = new BellmanFordPage(page);
    await demo.goto();

    // Ensure edges container is initially empty
    let count = await demo.edgesCount();
    expect(count).toBe(0);

    // Click Add Edge -> wrapper div + inner input & remove button are added (per implementation)
    await demo.clickAddEdge();

    // Now there should be 1 child (the wrapper div)
    count = await demo.edgesCount();
    expect(count).toBeGreaterThanOrEqual(1);

    // Find the Remove button inside edges and click to remove the wrapper
    const removeButton = page.locator('#edges button', { hasText: 'Remove' });
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // After removal, container should be empty again
    count = await demo.edgesCount();
    expect(count).toBe(0);

    // Now we intentionally create the problematic scenario:
    // Use addEdgeButton to create the wrapper+inner-input structure, then run without removing wrapper.
    await demo.clickAddEdge();
    count = await demo.edgesCount();
    expect(count).toBeGreaterThanOrEqual(1);

    // Populate vertices and source so algorithm is attempted
    await demo.setVertices(2);
    await demo.setSource(0);

    // Running now is expected to produce a runtime error because getEdges() will querySelectorAll('.edge-input')
    // and will include both the wrapper div and the inner input, and the wrapper has no .value leading to TypeError.
    const pageErrorPromise = page.waitForEvent('pageerror');

    await demo.clickRun();

    const err = await pageErrorPromise;
    expect(err).toBeTruthy();
    const msg = String(err.message || err.toString() || '');
    // The message should reference inability to read properties or 'split' usage on undefined
    const indicatesTypeError =
      msg.toLowerCase().includes('split') ||
      msg.toLowerCase().includes('cannot read') ||
      msg.toLowerCase().includes('undefined') ||
      msg.toLowerCase().includes('typeerror');
    expect(indicatesTypeError).toBeTruthy();
  });

  // Test negative weight cycle detection: construct proper edge inputs (direct DOM insertion) to avoid wrapper bug,
  // run algorithm, and assert an alert dialog is shown indicating invalid graph input (implementation uses alert).
  test('Negative weight cycle triggers alert (Edge Input -> Run -> Alert)', async ({ page }) => {
    // This test creates clean input elements (not using addEdgeInput) so bellmanFord receives correct edges array.
    const demo = new BellmanFordPage(page);
    await demo.goto();

    // Insert edges that create a negative weight cycle: 0->1 weight 1, 1->0 weight -3 (total -2)
    await demo.addEdgeInputsViaDOM(['0,1,1', '1,0,-3']);

    // Set vertices and source
    await demo.setVertices(2);
    await demo.setSource(0);

    // Expect an alert dialog stating "Error: Invalid graph input." because bellmanFord returns null for negative cycles
    const dialogPromise = page.waitForEvent('dialog');

    await demo.clickRun();

    const dialog = await dialogPromise;
    expect(dialog).toBeTruthy();
    expect(dialog.message()).toContain('Error: Invalid graph input.');
    // Dismiss the alert to keep the page usable
    await dialog.dismiss();
  });

  // Test Reset behavior clears inputs, edges and result (S0_Idle -> Reset -> S0_Idle)
  test('Reset clears all inputs, edges and result', async ({ page }) => {
    const demo = new BellmanFordPage(page);
    await demo.goto();

    // Prepare the page with vertices, source, a result and edges
    await demo.setVertices(4);
    await demo.setSource(1);
    await demo.addEdgeInputsViaDOM(['0,1,5', '1,2,2']);
    // Force a result to exist in the result div
    await page.evaluate(() => {
      const r = document.getElementById('result');
      if (r) r.innerHTML = '<h3>Temp</h3>Temp content';
    });

    // Ensure things are present before reset
    expect(await demo.verticesInput.inputValue()).toBe('4');
    expect(await demo.sourceInput.inputValue()).toBe('1');
    expect(await demo.edgesCount()).toBeGreaterThanOrEqual(2);
    expect((await demo.getResultText()).length).toBeGreaterThan(0);

    // Act: Click Reset
    await demo.clickReset();

    // Assert: inputs emptied, edges cleared, result cleared
    expect((await demo.verticesInput.inputValue()).trim()).toBe('');
    expect((await demo.sourceInput.inputValue()).trim()).toBe('');
    expect(await demo.edgesCount()).toBe(0);
    expect((await demo.getResultText()).trim()).toBe('');
  });
});