import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17640282-d5c1-11f0-938c-19d14b60ef51.html';

/**
 * Page Object for interacting with the Bellman-Ford visualization page.
 * Encapsulates common operations so tests remain readable and focused on behavior.
 */
class BellmanFordPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.edgesLocator = page.locator('#edges');
    this.sourceLocator = page.locator('#source');
    this.runButton = page.locator('button[onclick="runBellmanFord()"]');
    this.errorLocator = page.locator('#error');
    this.resultRows = page.locator('#result tr');
  }

  // Fill edges textarea
  async setEdges(value) {
    await this.edgesLocator.fill(value);
  }

  // Fill source input (accepts number or empty string)
  async setSource(value) {
    await this.sourceLocator.fill(String(value));
  }

  // Click the Run Bellman-Ford button
  async clickRun() {
    await this.runButton.click();
  }

  // Get current error text
  async getErrorText() {
    return (await this.errorLocator.innerText()).trim();
  }

  // Get results as array of { vertex: string, distance: string }
  async getResultEntries() {
    const rows = [];
    const count = await this.resultRows.count();
    for (let i = 0; i < count; i++) {
      const row = this.resultRows.nth(i);
      const cells = row.locator('td');
      const v = (await cells.nth(0).innerText()).trim();
      const d = (await cells.nth(1).innerText()).trim();
      rows.push({ vertex: v, distance: d });
    }
    return rows;
  }

  // Utility: check if result table is empty
  async isResultEmpty() {
    return (await this.resultRows.count()) === 0;
  }
}

test.describe('Bellman-Ford Algorithm Visualization - FSM states & transitions', () => {
  // Collect runtime console errors and page errors per test to assert no unexpected runtime exceptions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // ignore listener errors
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic assertions on runtime errors are done in individual tests.
    // Nothing to teardown specifically here.
  });

  test('Idle state: page renders initial UI elements (Idle onEnter renderPage())', async ({ page }) => {
    // This test validates the Idle state: elements rendered, Run button present, empty result and no error text
    const app = new BellmanFordPage(page);

    // Verify core UI components exist
    await expect(app.edgesLocator).toBeVisible();
    await expect(app.sourceLocator).toBeVisible();
    await expect(app.runButton).toBeVisible();

    // The Run button should have the onclick handler as described in the FSM evidence
    const onclick = await app.runButton.getAttribute('onclick');
    expect(onclick).toBe('runBellmanFord()');

    // Initial result tbody should be empty
    expect(await app.isResultEmpty()).toBe(true);

    // Initial error text should be empty
    expect(await app.getErrorText()).toBe('');

    // Ensure no runtime errors (console or page) occurred just on render
    expect(consoleErrors.length, 'no console.error messages on initial render').toBe(0);
    expect(pageErrors.length, 'no page errors on initial render').toBe(0);
  });

  test('RunBellmanFord transition: Running -> Completed (valid graph, no negative cycles)', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Running -> S3_Completed for a normal graph
    const app = new BellmanFordPage(page);

    // Provide a simple graph with no negative-weight cycles:
    // 0 -> 1 (4), 1 -> 2 (3), 0 -> 2 (7)
    const edges = '0,1,4;1,2,3;0,2,7';
    await app.setEdges(edges);
    await app.setSource('0');

    // Click Run (this triggers runBellmanFord() - S1_Running)
    await app.clickRun();

    // After running, expect no error message (transition to Completed)
    const errorText = await app.getErrorText();
    expect(errorText).toBe('', 'Expected no error message for a graph without negative cycles');

    // Expect result table to be populated with distances
    const entries = await app.getResultEntries();
    // We expect 3 vertices: 0,1,2. The algorithm uses a Set derived from edges - insertion order should follow edge discovery.
    // Validate that the expected vertices are present and have expected distances:
    const distances = {};
    for (const e of entries) distances[e.vertex] = e.distance;

    // Expected distances:
    // 0 -> 0
    // 1 -> 4
    // 2 -> 7 (via 0->1->2 gives 7, same as direct edge)
    expect(distances['0'] === '0' || distances['0'] === '0', 'vertex 0 distance').toBeTruthy();
    expect(distances['1']).toBe('4');
    // The distance for 2 could be '7' as number or '7' string - innerText returns string
    expect(distances['2']).toBe('7');

    // Ensure no runtime exceptions occurred during the run
    expect(consoleErrors.length, 'no console.error messages during successful run').toBe(0);
    expect(pageErrors.length, 'no page errors during successful run').toBe(0);
  });

  test('RunBellmanFord transition: Running -> Error (negative-weight cycle detected)', async ({ page }) => {
    // This test validates the transition S1_Running -> S2_Error when a negative-weight cycle exists
    const app = new BellmanFordPage(page);

    // Construct a negative-weight cycle: 0 -> 1 (1), 1 -> 0 (-2) => total cycle weight -1
    const edges = '0,1,1;1,0,-2';
    await app.setEdges(edges);
    await app.setSource('0');

    // Click Run, expecting the algorithm to detect negative cycle and set the error message
    await app.clickRun();

    // The algorithm should set the error paragraph text to exactly the message in FSM evidence
    const errorText = await app.getErrorText();
    expect(errorText).toBe('Graph contains a negative-weight cycle.');

    // The result tbody should remain empty after detecting negative cycle
    expect(await app.isResultEmpty()).toBe(true);

    // Ensure no uncaught runtime exceptions happened (algorithm reports error via DOM, not via thrown errors)
    expect(consoleErrors.length, 'no console.error messages when negative cycle detected').toBe(0);
    expect(pageErrors.length, 'no page errors when negative cycle detected').toBe(0);
  });

  test('Edge cases: empty inputs and non-numeric source should not crash the page', async ({ page }) => {
    // This test validates behavior when inputs are empty or malformed (edge cases)
    const app = new BellmanFordPage(page);

    // Leave edges and source empty
    await app.setEdges('');
    await app.setSource(''); // empty input leads to parseInt("") -> NaN in the page script

    // Click Run - page should handle gracefully (result empty, no thrown exceptions)
    await app.clickRun();

    // No error message expected (the implementation sets error only for negative cycles)
    const errorText = await app.getErrorText();
    expect(errorText).toBe('', 'No error message expected for empty input');

    // Result table should remain empty
    expect(await app.isResultEmpty()).toBe(true);

    // Ensure no runtime exceptions were thrown (pageerror / console.error)
    expect(consoleErrors.length, 'no console.error messages on empty input').toBe(0);
    expect(pageErrors.length, 'no page errors on empty input').toBe(0);
  });

  test('Behavior validation: multiple runs and DOM updates (onExit / onEnter side-effects)', async ({ page }) => {
    // This test exercises repeated runs to ensure result table is cleared and updated on subsequent runs (resultTable.innerHTML = "")
    const app = new BellmanFordPage(page);

    // First run: a graph with two vertices
    await app.setEdges('0,1,5');
    await app.setSource('0');
    await app.clickRun();

    let entries = await app.getResultEntries();
    expect(entries.length).toBeGreaterThan(0);
    // Ensure entry for vertex 1 is present with distance 5
    const d1 = entries.find(r => r.vertex === '1')?.distance;
    expect(d1).toBe('5');

    // Second run: different graph, should clear previous results and show new ones
    await app.setEdges('0,2,2;2,3,3');
    await app.setSource('0');
    await app.clickRun();

    entries = await app.getResultEntries();
    // Should now reflect vertices 0,2,3 (or at least include 2 and 3)
    const vertices = entries.map(e => e.vertex);
    expect(vertices.includes('2')).toBe(true);
    expect(vertices.includes('3')).toBe(true);

    // Confirm that the table was cleared between runs by ensuring no stale vertex '1' remains
    expect(vertices.includes('1')).toBe(false);

    // No runtime errors should have occurred across multiple runs
    expect(consoleErrors.length, 'no console.error messages across multiple runs').toBe(0);
    expect(pageErrors.length, 'no page errors across multiple runs').toBe(0);
  });
});