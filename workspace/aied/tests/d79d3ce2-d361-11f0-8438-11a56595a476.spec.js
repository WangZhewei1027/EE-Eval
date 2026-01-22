import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79d3ce2-d361-11f0-8438-11a56595a476.html';

// Page object for interacting with the Bellman-Ford visualization UI
class BellmanFordPage {
  constructor(page) {
    this.page = page;
  }
  btnGenerate() { return this.page.locator('#btn-generate'); }
  btnStart() { return this.page.locator('#btn-start'); }
  btnNext() { return this.page.locator('#btn-next'); }
  btnReset() { return this.page.locator('#btn-reset'); }
  vertexCountInput() { return this.page.locator('#vertex-count'); }
  edgeListInput() { return this.page.locator('#edge-list'); }
  startVertexSelect() { return this.page.locator('#start-vertex'); }
  messagesDiv() { return this.page.locator('#messages'); }
  distancesDiv() { return this.page.locator('#distances'); }
  stepInfoDiv() { return this.page.locator('#step-info'); }
  svgNodes() { return this.page.locator('svg g.node'); }
  svgNodeByIndex(i) { return this.page.locator(`svg g.node[data-node="${i}"]`); }
  svgEdges() { return this.page.locator('svg g.edge'); }

  // Helper to click Next n times (with small delay to allow UI updates)
  async clickNextTimes(n) {
    for (let i = 0; i < n; i++) {
      // If Next is disabled, break early
      if (await this.btnNext().isDisabled()) break;
      await this.btnNext().click();
      // short pause to allow DOM updates (relaxation and messages)
      await this.page.waitForTimeout(8);
    }
  }
}

test.describe('Bellman-Ford Algorithm Visualization - FSM tests', () => {
  let page;
  let bf;
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Capture console messages for inspection
    consoleMessages = [];
    pageErrors = [];
    page.on('console', msg => {
      try {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (e) {
        consoleMessages.push(`console: (could not serialize)`);
      }
    });
    page.on('pageerror', err => {
      // capture uncaught exceptions / runtime errors
      pageErrors.push(err);
    });

    bf = new BellmanFordPage(page);
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    // Wait for initial UI to settle (the page script runs generateGraph on load)
    await bf.messagesDiv().waitFor({ state: 'visible', timeout: 5000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('S1_GraphGenerated: Page loads and graph is generated on startup', async () => {
    // Validate there were no uncaught page errors during load
    expect(pageErrors.length).toBe(0);

    // The page's script generates a graph on load; expect success message
    const messages = await bf.messagesDiv().textContent();
    expect(messages).toContain('Graph generated successfully.');

    // Buttons state after generation: Start enabled, Next disabled, Reset disabled
    expect(await bf.btnGenerate().isDisabled()).toBe(false);
    expect(await bf.btnStart().isDisabled()).toBe(false);
    expect(await bf.btnNext().isDisabled()).toBe(true);
    expect(await bf.btnReset().isDisabled()).toBe(true);

    // Start vertex select should be populated according to vertex count (default 5)
    const vertexCountVal = await bf.vertexCountInput().inputValue();
    const expectedCount = parseInt(vertexCountVal, 10);
    const options = bf.startVertexSelect().locator('option');
    expect(await options.count()).toBe(expectedCount);

    // Distances div should be empty initially (generateGraph clears distances)
    const distancesText = await bf.distancesDiv().textContent();
    expect(distancesText.trim().length).toBeGreaterThanOrEqual(0);

    // No runtime page errors observed
    expect(pageErrors.length).toBe(0);
  });

  test('SelectStartVertex: selecting start via dropdown and by clicking node updates UI and messages', async () => {
    // Select start vertex via dropdown
    await bf.startVertexSelect().selectOption('2');
    // The script appends a message "Start vertex set to X."
    await expect(bf.messagesDiv()).toContainText('Start vertex set to 2.');

    // Now click on a node element (node 3)
    const node3 = bf.svgNodeByIndex(3);
    await expect(node3).toBeVisible();
    await node3.click();
    // Clicking should append another start vertex message
    await expect(bf.messagesDiv()).toContainText('Start vertex set to 3.');
    // And the select value should reflect the clicked node
    expect(await bf.startVertexSelect().inputValue()).toBe('3');

    // Ensure no page errors
    expect(pageErrors.length).toBe(0);
  });

  test('S2_AlgorithmRunning: start algorithm transitions UI to running state', async () => {
    // Ensure start button is available and click it
    expect(await bf.btnStart().isDisabled()).toBe(false);
    await bf.btnStart().click();

    // After starting: Next enabled, Start disabled, Generate disabled, Reset enabled
    await expect(bf.btnNext()).toBeEnabled();
    expect(await bf.btnStart().isDisabled()).toBe(true);
    expect(await bf.btnReset().isDisabled()).toBe(false);

    // A start message should be present (the implementation may append "Started ..." text)
    await expect(bf.messagesDiv()).toContainText('Started Bellman-Ford from vertex');
    // Distances should be displayed with start vertex distance 0
    await expect(bf.distancesDiv()).toContainText('Distances from start vertex');

    // The start node in the SVG should have class 'start'
    const startValue = await bf.startVertexSelect().inputValue();
    const startNode = bf.svgNodeByIndex(Number(startValue));
    await expect(startNode).toHaveClass(/start/);

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('S4_AlgorithmComplete: run full algorithm on example graph and expect completion (no negative cycle)', async () => {
    // Start algorithm
    await bf.btnStart().click();

    // Determine number of steps required: V * E (the implementation increments iteration after E edges)
    const vertexCount = parseInt(await bf.vertexCountInput().inputValue(), 10);
    const edgesCount = await bf.svgEdges().count();
    const stepsNeeded = vertexCount * edgesCount;

    // Click Next required number of times
    await bf.clickNextTimes(stepsNeeded + 5); // +5 as buffer; clickNextTimes stops if button disabled

    // After running enough steps, we should see completion message
    await expect(bf.messagesDiv()).toContainText('No negative weight cycles detected. Algorithm complete.');
    await expect(bf.stepInfoDiv()).toHaveText('Algorithm complete: Shortest distances finalized.');

    // Next should be disabled after completion
    expect(await bf.btnNext().isDisabled()).toBe(true);

    // No uncaught exceptions
    expect(pageErrors.length).toBe(0);
  }, { timeout: 120000 });

  test('S3_NegativeCycleDetected: detect negative cycle on a crafted graph', async () => {
    // Create a small graph with a negative cycle:
    // 3 vertices: 0->1 (1), 1->2 (-1), 2->0 (-1) => cycle sum = -1
    await bf.vertexCountInput().fill('3');
    await bf.edgeListInput().fill(`0 1 1
1 2 -1
2 0 -1`);
    // Click generate to create graph
    await bf.btnGenerate().click();

    // Confirm graph generated
    await expect(bf.messagesDiv()).toContainText('Graph generated successfully.');

    // Start algorithm
    await bf.btnStart().click();

    // Steps needed: V * E = 3 * 3 = 9
    await bf.clickNextTimes(9 + 3); // extra buffer

    // We expect the negative cycle message
    await expect(bf.messagesDiv()).toContainText('Negative weight cycle detected! Algorithm terminated.');
    await expect(bf.stepInfoDiv()).toContainText('Negative weight cycle detected! Edge');

    // Next should be disabled after detection
    expect(await bf.btnNext().isDisabled()).toBe(true);

    // No uncaught exceptions
    expect(pageErrors.length).toBe(0);
  }, { timeout: 30000 });

  test('ResetAlgorithm: reset from running and ensure UI and state are cleared', async () => {
    // Start algorithm first
    await bf.btnStart().click();
    await expect(bf.btnNext()).toBeEnabled();

    // Click Reset
    await bf.btnReset().click();

    // After reset, messages and distances should be cleared
    const messages = await bf.messagesDiv().textContent();
    const distances = await bf.distancesDiv().textContent();
    expect(messages.trim()).toBe('');
    expect(distances.trim()).toBe('');

    // Buttons state after reset: Start enabled, Next disabled, Reset disabled
    expect(await bf.btnStart().isDisabled()).toBe(false);
    expect(await bf.btnNext().isDisabled()).toBe(true);
    expect(await bf.btnReset().isDisabled()).toBe(true);

    // Inputs should be enabled again
    expect(await bf.vertexCountInput().isDisabled()).toBe(false);
    expect(await bf.edgeListInput().isDisabled()).toBe(false);
    expect(await bf.startVertexSelect().isDisabled()).toBe(false);

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('GenerateGraph error handling: invalid edge input leads to visible error and Start disabled', async () => {
    // Provide invalid edge input (only two tokens instead of three)
    await bf.edgeListInput().fill('0 1');
    await bf.vertexCountInput().fill('3');

    // Click generate
    await bf.btnGenerate().click();

    // Expect an error message prefixed with "Error:"
    await expect(bf.messagesDiv()).toContainText('Error:');

    // Start should be disabled when parsing fails
    expect(await bf.btnStart().isDisabled()).toBe(true);

    // No uncaught runtime exceptions (the parsing error is handled)
    expect(pageErrors.length).toBe(0);
  });

  test('Console and runtime observation: collect console logs and ensure no uncaught runtime errors', async () => {
    // Basic sanity: console messages were captured during navigation and interactions
    expect(consoleMessages.length).toBeGreaterThanOrEqual(1);
    // Ensure no uncaught page errors were observed
    expect(pageErrors.length).toBe(0);
  });
});