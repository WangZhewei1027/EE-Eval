import { test, expect } from '@playwright/test';

// Increase default timeout to allow the step-by-step BFS (each step delays 1s)
test.setTimeout(90_000);

// Page object model for the BFS visualization page
class BFSPage {
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.startNodeSelect = page.locator('#startNode');
    this.graph = page.locator('#graph');
    this.log = page.locator('#log');
    this.nodeLocator = id => page.locator('#graph .node', { hasText: id });
    this.allNodes = page.locator('#graph .node');
    this.logSteps = page.locator('#log .step');
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/63b17552-fa74-11f0-bb9a-db7e6ecdeeaa.html');
    // Wait for initial UI to settle
    await expect(this.graph).toBeVisible();
    await expect(this.startBtn).toBeVisible();
    await expect(this.resetBtn).toBeVisible();
  }

  // Start BFS from a given node id
  async startBFS(startId) {
    if (startId) {
      await this.startNodeSelect.selectOption(startId);
    }
    await this.startBtn.click();
  }

  // Click reset button
  async reset() {
    await this.resetBtn.click();
  }

  // Wait for any log entry that contains the given substring
  async waitForLogText(text, timeout = 30_000) {
    await this.page.waitForFunction(
      (t) => {
        const el = document.querySelector('#log');
        return el && el.innerText.includes(t);
      },
      text,
      { timeout }
    );
  }

  // Get the text content of the full log
  async getLogText() {
    return this.page.locator('#log').innerText();
  }

  // Count nodes rendered in the graph
  async nodeCount() {
    return this.allNodes.count();
  }

  // Get options available in the start node select
  async getStartOptions() {
    return this.page.evaluate(() => {
      const sel = document.getElementById('startNode');
      if (!sel) return [];
      return Array.from(sel.options).map(o => o.value);
    });
  }

  // Check if any node has the given CSS class
  async anyNodeHasClass(className) {
    return this.page.evaluate((cls) => {
      return Array.from(document.querySelectorAll('#graph .node')).some(n => n.classList.contains(cls));
    }, className);
  }

  // Get the class list of a specific node by id
  async getNodeClasses(id) {
    return this.page.evaluate((nodeId) => {
      const n = Array.from(document.querySelectorAll('#graph .node')).find(x => x.textContent.trim() === nodeId);
      return n ? Array.from(n.classList) : [];
    }, id);
  }
}

test.describe('BFS Visualization - FSM states and transitions (63b17552-fa74-11f0-bb9a-db7e6ecdeeaa)', () => {
  let bfs;
  let consoleMessages;
  let pageErrors;

  // Attach listeners and initialize page object for each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (type and text)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    bfs = new BFSPage(page);
    await bfs.goto();
  });

  // After each test, assert there were no uncaught page errors or console errors
  test.afterEach(async () => {
    // Expose any console.error messages for debugging in test failure reports
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;

    // The application is expected to run without runtime exceptions.
    // Assert that there were no uncaught page errors and no console.error messages.
    expect(pageErrors, 'There should be no uncaught page errors').toHaveLength(0);
    expect(consoleErrorCount, `No console.error messages expected, got: ${JSON.stringify(consoleMessages.filter(m => m.type === 'error'))}`).toBe(0);
  });

  test('Initial Idle state (S0_Idle) - UI initialized and entry actions executed', async () => {
    // Validate that createGraph() populated nodes and populateStartNodeSelect() populated the select
    const nodeCount = await bfs.nodeCount();
    expect(nodeCount).toBe(8); // graphData.nodes length is 8

    const startOptions = await bfs.getStartOptions();
    expect(startOptions.length).toBe(8);
    // Verify first option equals first node id as defined in HTML script -> 'A'
    expect(startOptions[0]).toBe('A');

    // Entry action reset() should ensure startBtn is enabled and resetBtn disabled
    await expect(bfs.startBtn).toBeEnabled();
    await expect(bfs.resetBtn).toBeDisabled();

    // Log should be empty in initial idle state
    const logText = await bfs.getLogText();
    expect(logText.trim()).toBe('');

    // No nodes should be marked visited or current on idle
    expect(await bfs.anyNodeHasClass('visited')).toBe(false);
    expect(await bfs.anyNodeHasClass('current')).toBe(false);
  });

  test('Start BFS transitions to BFS Running (S1_BFS_Running) and completes (S2_BFS_Complete)', async ({ page }) => {
    // Comment: This test validates the StartBFS event causes runBFS(startNode) to execute,
    // the UI updates during running, and the BFS eventually completes with expected visited order.

    // Start BFS from node 'A'
    await bfs.startBFS('A');

    // Immediately after starting, startBtn should be disabled, resetBtn enabled, and select disabled
    await expect(bfs.startBtn).toBeDisabled();
    await expect(bfs.resetBtn).toBeEnabled();
    await expect(bfs.startNodeSelect).toBeDisabled();

    // Wait for the first visit log (should be "Visited node: A")
    await bfs.waitForLogText('Visited node: A', 10_000);
    const firstStep = await page.locator('#log .step').first().innerText();
    expect(firstStep).toContain('Visited node: A');

    // Verify the node 'A' has been marked as visited (and was current at some point)
    const classesA = await bfs.getNodeClasses('A');
    // At some point 'current' class is removed at the end of BFS, but 'visited' should be present
    expect(classesA).toContain('visited');

    // Wait for BFS to finish and produce the final "BFS complete" log entry
    await bfs.waitForLogText('BFS complete. Order of visit:', 60_000);
    const logText = await bfs.getLogText();
    expect(logText).toContain('BFS complete. Order of visit:');

    // Validate the visited order is as expected for BFS starting at 'A'
    // Expected order derived from adjacency and the enqueue order in implementation:
    // A, B, H, C, G, F, D, E
    expect(logText).toContain('A, B, H, C, G, F, D, E');

    // After completion the app sets startBtn disabled and resetBtn enabled (per implementation),
    // and startNodeSelect remains disabled.
    await expect(bfs.startBtn).toBeDisabled();
    await expect(bfs.resetBtn).toBeEnabled();
    await expect(bfs.startNodeSelect).toBeDisabled();
  });

  test('Reset (S2_BFS_Complete -> S0_Idle) clears UI and returns to idle state', async ({ page }) => {
    // Comment: start a full BFS run, wait for completion, then reset and verify UI returns to Idle.

    // Start BFS and wait for completion
    await bfs.startBFS('A');
    await bfs.waitForLogText('BFS complete. Order of visit:', 60_000);

    // Now click reset to transition back to Idle
    await bfs.reset();

    // After reset, startBtn should be enabled and resetBtn disabled, select enabled
    await expect(bfs.startBtn).toBeEnabled();
    await expect(bfs.resetBtn).toBeDisabled();
    await expect(bfs.startNodeSelect).toBeEnabled();

    // Log should be cleared by reset()
    const logTextAfterReset = await bfs.getLogText();
    expect(logTextAfterReset.trim()).toBe('');

    // Nodes should have no visited/current classes after reset
    expect(await bfs.anyNodeHasClass('visited')).toBe(false);
    expect(await bfs.anyNodeHasClass('current')).toBe(false);
  });

  test('Edge case: Clicking Start with empty selection should not start BFS', async ({ page }) => {
    // Comment: ensure the guard if (startNode) prevents runBFS if selection is empty.

    // Clear selection value by setting it to empty string (simulates no selection)
    await page.evaluate(() => {
      const sel = document.getElementById('startNode');
      if (sel) sel.value = '';
    });

    // Click start; runBFS should NOT be called because startNode is falsy
    await bfs.startBtn.click();

    // Ensure no log entries were created and UI did not transition to running
    // Slight pause to let any accidental actions occur
    await page.waitForTimeout(500);
    const logText = await bfs.getLogText();
    expect(logText.trim()).toBe('');

    // Buttons should remain in idle configuration
    await expect(bfs.startBtn).toBeEnabled();
    await expect(bfs.resetBtn).toBeDisabled();
    await expect(bfs.startNodeSelect).toBeEnabled();
  });

  test('Edge case: Clicking Reset while BFS is running stops traversal', async ({ page }) => {
    // Comment: Start BFS, wait for a single visit, then click reset to ensure traversal halts and cleanup occurs.

    // Start BFS
    await bfs.startBFS('A');

    // Wait for the first visit to be logged
    await bfs.waitForLogText('Visited node: A', 10_000);

    // Now click reset while the BFS loop is still running (before completion)
    await bfs.reset();

    // After reset, ensure log is cleared and Idle state restored
    const logAfterReset = await bfs.getLogText();
    expect(logAfterReset.trim()).toBe('');

    await expect(bfs.startBtn).toBeEnabled();
    await expect(bfs.resetBtn).toBeDisabled();
    await expect(bfs.startNodeSelect).toBeEnabled();

    // Ensure that 'BFS complete' does NOT appear after some delay (i.e., traversal was stopped)
    await page.waitForTimeout(2000);
    const logAfterWait = await bfs.getLogText();
    expect(logAfterWait).not.toContain('BFS complete. Order of visit:');
    // Ensure no nodes remain marked visited/current
    expect(await bfs.anyNodeHasClass('visited')).toBe(false);
    expect(await bfs.anyNodeHasClass('current')).toBe(false);
  });

  test('Observability: No runtime errors logged to console or uncaught page errors during typical flows', async ({ page }) => {
    // Comment: This test exercises common flows and ensures no console errors or page errors occur.

    // Start and immediately reset
    await bfs.startBFS('A');
    await bfs.reset();

    // Run a full BFS to completion
    await bfs.startBFS('B');
    await bfs.waitForLogText('BFS complete. Order of visit:', 60_000);

    // Reset again
    await bfs.reset();

    // Validate we captured no page errors or console.error messages so far
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(pageErrors.length).toBe(0);
    expect(consoleErrorCount).toBe(0);
  });
});