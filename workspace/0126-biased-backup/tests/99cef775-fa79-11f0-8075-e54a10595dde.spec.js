import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cef775-fa79-11f0-8075-e54a10595dde.html';

// Page object encapsulating interactions with the DFS Visualizer page
class DFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startNode = page.locator('#startNode');
    this.graph = page.locator('#graph');
    this.runButton = page.locator('#runDFS');
    this.resetButton = page.locator('#reset');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setStartNode(value) {
    // Use evaluate to set the value even if input is type=number to simulate edge cases
    await this.page.evaluate((v) => {
      const el = document.getElementById('startNode');
      el.value = v;
    }, String(value));
    // Trigger input event to ensure page state reflects change if needed
    await this.startNode.dispatchEvent('input');
  }

  async setGraph(value) {
    await this.graph.fill('');
    await this.graph.type(String(value));
  }

  async clickRun() {
    await this.runButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async getStartNodeValue() {
    return await this.page.evaluate(() => document.getElementById('startNode').value);
  }

  async getGraphValue() {
    return await this.page.evaluate(() => document.getElementById('graph').value);
  }

  async getAdjacencyList() {
    // Read the global adjacencyList variable from the page
    return await this.page.evaluate(() => window.adjacencyList);
  }
}

test.describe('DFS Visualizer - FSM states and transitions (Application ID: 99cef775-fa79-11f0-8075-e54a10595dde)', () => {
  // Collect console error messages and page errors for each test run
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and page errors to assert on them later
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test, ensure there were no unexpected runtime errors logged to the console
    // The FSM test harness requires observing console and page errors; we assert none occurred.
    expect(consoleErrors, `Console errors occurred: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `Page errors occurred: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test('S0 Idle: initial render shows default inputs and empty output', async ({ page }) => {
    // Validate initial state S0_Idle: inputs are present and hold default values, output empty
    const app = new DFSPage(page);

    // Check DOM elements exist and have expected default values per FSM evidence
    await expect(app.startNode).toHaveCount(1);
    await expect(app.graph).toHaveCount(1);
    await expect(app.runButton).toHaveCount(1);
    await expect(app.resetButton).toHaveCount(1);
    await expect(app.output).toHaveCount(1);

    // Verify default values match FSM extracted components
    const startVal = await app.getStartNodeValue();
    const graphVal = await app.getGraphValue();
    const outputText = await app.getOutputText();

    expect(startVal).toBe('0'); // entry action or initial attribute
    expect(graphVal).toBe('0,1,0,0,0,2,1,3,0,4,0,0'); // default graph string
    expect(outputText).toBe(''); // no output in idle state
  });

  test('S0 -> S1: Run DFS (default graph, start 0) produces expected DFS order', async ({ page }) => {
    // Validate transition from Idle to DFS Running and output correctness
    const app = new DFSPage(page);

    // Ensure we start from defaults
    expect(await app.getStartNodeValue()).toBe('0');

    // Click Run DFS and verify output text is the expected DFS traversal order
    await app.clickRun();

    // Expectation derived from application's buildGraph and dfs behavior:
    // adjacencyList[0] = [1,0,2,4,0]; adjacencyList[1] = [3]
    // DFS starting at 0 should give: 0,1,3,2,4
    await expect(app.output).toHaveText('DFS Order: 0, 1, 3, 2, 4');
    // Verify adjacencyList was built as an array and contains entries for 0 and 1
    const adjacency = await app.getAdjacencyList();
    expect(Array.isArray(adjacency)).toBe(true);
    expect(adjacency[0]).toBeTruthy();
    expect(adjacency[1]).toBeTruthy();
  });

  test('S1 -> S0 via Reset: after running DFS, Reset returns inputs and output to defaults', async ({ page }) => {
    // Validate resetting from a running state clears output and restores defaults (S2_Reset -> S0_Idle)
    const app = new DFSPage(page);

    // Run DFS first
    await app.clickRun();
    await expect(app.output).toHaveText(/DFS Order:/);

    // Now click Reset
    await app.clickReset();

    // Verify expected observables after reset per FSM S2_Reset entry actions
    const startVal = await app.getStartNodeValue();
    const graphVal = await app.getGraphValue();
    const outputText = await app.getOutputText();
    const adjacency = await app.getAdjacencyList();

    expect(startVal).toBe('0');
    expect(graphVal).toBe('0,1,0,0,0,2,1,3,0,4,0,0');
    expect(outputText).toBe('');
    // adjacencyList should be cleared to an empty array
    // The code sets adjacencyList = []; so adjacency should be an array with length 0
    expect(Array.isArray(adjacency)).toBe(true);
    expect(adjacency.length).toBe(0);
  });

  test('S0 -> S2 Reset (from idle): clicking Reset without running restores defaults', async ({ page }) => {
    // Validate Reset from idle state restores defaults as per S2_Reset
    const app = new DFSPage(page);

    // Change inputs away from defaults to ensure reset restores them
    await app.setStartNode('2');
    await app.setGraph('2,3,3,4');
    expect(await app.getStartNodeValue()).toBe('2');
    expect(await app.getGraphValue()).toBe('2,3,3,4');

    // Click Reset
    await app.clickReset();

    // Validate restored defaults
    expect(await app.getStartNodeValue()).toBe('0');
    expect(await app.getGraphValue()).toBe('0,1,0,0,0,2,1,3,0,4,0,0');
    expect(await app.getOutputText()).toBe('');
    const adjacency = await app.getAdjacencyList();
    expect(Array.isArray(adjacency)).toBe(true);
    expect(adjacency.length).toBe(0);
  });

  test('Running DFS from a different start node (1) produces expected partial traversal', async ({ page }) => {
    // Validate running DFS with start node 1 yields traversal 1,3 per adjacency list
    const app = new DFSPage(page);

    // Set start node to 1 and run
    await app.setStartNode('1');
    expect(await app.getStartNodeValue()).toBe('1');

    await app.clickRun();

    // Expected traversal starting at node 1: 1,3
    await expect(app.output).toHaveText('DFS Order: 1, 3');
  });

  test('Edge case: non-numeric start node leads to NaN in output (let runtime behavior occur naturally)', async ({ page }) => {
    // This test exercises error-prone input: set a non-numeric value in the number input and run DFS.
    // Per instructions, we must not patch code; let the page behave naturally and assert observed behavior.
    const app = new DFSPage(page);

    // Force a non-numeric value into the startNode input via DOM (bypassing validation)
    await app.setStartNode('abc');

    // Confirm DOM now has the non-numeric value (string)
    expect(await app.getStartNodeValue()).toBe('abc');

    // Click Run and observe the output. parseInt('abc') -> NaN, dfs called with NaN will lead to "NaN" in result
    await app.clickRun();

    // The output should reflect NaN in traversal; we assert that the output contains "NaN"
    const outputText = await app.getOutputText();
    expect(outputText).toMatch(/NaN/);
  });

  test('Consecutive runs update output (Run DFS twice with different start nodes)', async ({ page }) => {
    // Validate multiple invocations update output each time
    const app = new DFSPage(page);

    // First run with start 0
    await app.setStartNode('0');
    await app.clickRun();
    await expect(app.output).toHaveText('DFS Order: 0, 1, 3, 2, 4');

    // Then run with start 1
    await app.setStartNode('1');
    await app.clickRun();
    await expect(app.output).toHaveText('DFS Order: 1, 3');
  });

  test('Verify there are no unexpected runtime exceptions on load (observe console / page errors)', async ({ page }) => {
    // This test explicitly verifies that loading the page did not produce any runtime errors.
    // The beforeEach and afterEach handlers already collect console/page errors and assert none.
    // Here we do a no-op interaction and re-assert.
    const app = new DFSPage(page);

    // Minimal checks to ensure page is responsive
    await expect(app.runButton).toBeVisible();
    await expect(app.resetButton).toBeVisible();

    // No additional actions; actual assertions about console/page errors occur in afterEach
  });

  // Additional edge case: malformed graph input - ensure function tolerates or produces observable output
  test('Edge case: malformed graph input (non-numeric entries) - application should handle gracefully', async ({ page }) => {
    const app = new DFSPage(page);

    // Set graph to include non-numeric tokens; this will cause Number() to yield NaN for those entries
    await app.setGraph('0,foo,bar,3');

    // Use an integer start node
    await app.setStartNode('0');

    // Run DFS and observe output. We don't patch code; we assert the application outputs something predictable
    await app.clickRun();

    const outputText = await app.getOutputText();
    // The output should at minimum start with "DFS Order: "
    expect(outputText.startsWith('DFS Order:')).toBe(true);
    // If NaN entries exist in the traversal, they will appear as "NaN" in the output string - accept either case
    // Ensure no uncaught exceptions were emitted; this is asserted in afterEach
  });
});