import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba9d5a0-d5b2-11f0-b169-abe023d0d932.html';

// Page object to encapsulate interactions with the app
class DijkstraPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#start');
    this.stopButton = page.locator('#stop');
    this.graphNodes = page.locator('#graph .node');
    this.graphContainer = page.locator('#graph');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click start and accept the prompt with the provided value.
  // If acceptValue is null, the prompt will be dismissed.
  async clickStartAndHandlePrompt(acceptValue) {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.startButton.click();
    const dialog = await dialogPromise;
    if (acceptValue === null) {
      await dialog.dismiss();
    } else {
      await dialog.accept(acceptValue);
    }
  }

  async clickStop() {
    await this.stopButton.click();
  }

  // returns array of node texts inside #graph
  async getGraphNodeTexts() {
    return await this.graphNodes.allTextContents();
  }

  async getGraphInnerHTML() {
    return await this.graphContainer.innerHTML();
  }

  async graphNodeCount() {
    return await this.graphNodes.count();
  }
}

// Utility to wait for a console message matching a substring
async function waitForConsoleMessage(consoleMessages, substring, timeout = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (consoleMessages.some(m => m.includes(substring))) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}

test.describe('Dijkstra Algorithm Interactive App - FSM validation', () => {
  // Per-test fixtures
  test.beforeEach(async ({ page }) => {
    // nothing global to do here; each test will navigate separately
  });

  // Test the Idle state (S0_Idle) - validate initial DOM and that visualizeGraph is not autonomously invoked in this implementation
  test('Idle state: initial DOM has Start/Stop buttons and graph reflects initial implementation', async ({ page }) => {
    // This test validates the Idle state's evidence: presence of start/stop and the actual initial graph rendering in the shipped HTML.
    const app = new DijkstraPage(page);
    await app.goto();

    // Buttons should be visible and enabled
    await expect(app.startButton).toBeVisible();
    await expect(app.stopButton).toBeVisible();
    await expect(app.startButton).toBeEnabled();
    await expect(app.stopButton).toBeEnabled();

    // According to the FSM, visualizeGraph(graph) would be run on entry to Idle.
    // In the shipped HTML the visualizeGraph is defined but not called on load.
    // We assert what the runtime actually shows: the graph container should exist but may be empty initially.
    const innerHTML = await app.getGraphInnerHTML();
    // It is acceptable for it to be empty string or whitespace; assert it does not contain node elements initially.
    expect(innerHTML).not.toMatch(/class="node"/);

    // Ensure there are zero node elements initially
    expect(await app.graphNodeCount()).toBe(0);
  });

  // Test Start transition to Running (S0_Idle -> S1_Running) with valid dialog input
  test('Start transition (successful input) -> Running: dijkstra invoked, logs emitted, graph visualized', async ({ page }) => {
    // This test validates that clicking Start, accepting the prompt with a valid node ('A'),
    // leads to execution of the algorithm handler: console logs "Shortest distances:" and "Previous nodes:"
    // and visualizeGraph(graph) results in node DOM elements being present.
    const app = new DijkstraPage(page);
    await app.goto();

    // Capture console and page errors for assertions
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => {
      try {
        consoleMessages.push(m.text());
      } catch (e) {
        // ignore any unexpected console read errors
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Start with accepting 'A' in the prompt
    await app.clickStartAndHandlePrompt('A');

    // Wait for expected console logs to appear
    const hasShortest = await waitForConsoleMessage(consoleMessages, 'Shortest distances:');
    const hasPrevious = await waitForConsoleMessage(consoleMessages, 'Previous nodes:');

    // Assert logs were emitted
    expect(hasShortest).toBeTruthy();
    expect(hasPrevious).toBeTruthy();

    // Ensure algorithm did not produce page errors in the successful path
    expect(pageErrors.length).toBe(0);

    // The visualizeGraph(graph) call at the end of the start handler should render nodes.
    // In the provided graph, there are nodes A,B,C,D so expect at least 4 nodes rendered.
    const nodeTexts = await app.getGraphNodeTexts();
    // At least one node, prefer to check that typical nodes are present
    expect(nodeTexts.length).toBeGreaterThanOrEqual(1);
    // Check that 'A' appears as one of the nodes (the graph originally includes A)
    expect(nodeTexts).toEqual(expect.arrayContaining(expect.arrayContaining ? ['A'] : ['A']));
  });

  // Test Start transition when the user dismisses the prompt -> expect runtime TypeError
  test('Start transition (prompt dismissed) -> leads to TypeError in page context', async ({ page }) => {
    // This test validates the edge case where the prompt is dismissed.
    // The implementation calls toLowerCase() on the prompt result without null-checking,
    // so dismissing the prompt should generate a TypeError in the page context.
    const app = new DijkstraPage(page);
    await app.goto();

    // Prepare to capture the pageerror event
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Click start and dismiss the prompt (simulate user cancelling)
    const dialogPromise = page.waitForEvent('dialog');
    await app.startButton.click();
    const dialog = await dialogPromise;
    await dialog.dismiss();

    // Wait for the pageerror to fire
    const err = await pageErrorPromise;

    // The error should be a TypeError or at least related to calling toLowerCase on null/undefined.
    // Assert that the error name indicates TypeError and message references toLowerCase or reading property
    expect(err).toBeTruthy();
    // Name should be 'TypeError' in browsers when calling a method on null
    expect(err.name).toBe('TypeError');
    // Message should mention toLowerCase or reading property; be permissive to accommodate engine differences
    expect(err.message).toMatch(/toLowerCase|Cannot read properties|Cannot read property/i);
  });

  // Test Stop transition (S1_Running -> S2_Stopped) clears graph and internal structures
  test('Stop transition from Running clears graph (Running -> Stopped)', async ({ page }) => {
    // This test ensures that when the Stop button is clicked after the algorithm was started,
    // the graph is cleared and the DOM updates accordingly.
    const app = new DijkstraPage(page);
    await app.goto();

    // Start first with valid input to get nodes rendered
    await app.clickStartAndHandlePrompt('A');

    // Ensure nodes are present
    const countBefore = await app.graphNodeCount();
    expect(countBefore).toBeGreaterThanOrEqual(1);

    // Click stop to trigger clearing of the graph
    await app.clickStop();

    // After stopping, visualizeGraph(graph) is called with graph = {} which should render no nodes
    // Give a small timeout for DOM update
    await page.waitForTimeout(100);

    const countAfter = await app.graphNodeCount();
    expect(countAfter).toBe(0);

    // Also ensure the innerHTML does not contain node elements
    const html = await app.getGraphInnerHTML();
    expect(html).not.toMatch(/class="node"/);
  });

  // Test Stopped -> Idle transition: clicking Start after Stop should operate against an empty graph
  test('From Stopped, Start leads to Idle semantics: starting after stop runs algorithm on empty graph and graph remains empty', async ({ page }) => {
    // This test validates the FSM transition S2_Stopped -> S0_Idle via StartClick (confidence 0.5).
    // In the provided implementation, Stop clears the graph object. Starting after Stop will
    // run dijkstra on an empty graph and visualizeGraph should render no nodes.
    const app = new DijkstraPage(page);
    await app.goto();

    // Stop immediately (graph is initially empty, but simulate reaching Stopped)
    await app.clickStop();

    // Ensure graph is empty after stop
    expect(await app.graphNodeCount()).toBe(0);

    // Capture console logs and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => consoleMessages.push(m.text()));
    page.on('pageerror', e => pageErrors.push(e));

    // Start and accept 'A'
    await app.clickStartAndHandlePrompt('A');

    // Wait shortly for handler to run and logs to appear
    await page.waitForTimeout(200);

    // Since graph is empty, visualizeGraph should produce no node elements
    expect(await app.graphNodeCount()).toBe(0);

    // The code still attempts to run dijkstra and console.log the results; ensure logs are present for both labels
    const hasShortest = consoleMessages.some(m => m.includes('Shortest distances:'));
    const hasPrevious = consoleMessages.some(m => m.includes('Previous nodes:'));
    expect(hasShortest).toBeTruthy();
    expect(hasPrevious).toBeTruthy();

    // Ensure that no page errors occurred in this path
    expect(pageErrors.length).toBe(0);
  });
});