import { test, expect } from '@playwright/test';

test.setTimeout(30000); // Allow enough time for the visualization (includes deliberate delays)

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324dd4f0-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Dijkstra visualization page
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages for inspection by tests
    this.page.on('console', msg => {
      try {
        // stringify args for readability
        const text = msg.text();
        this.consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        this.consoleMessages.push({ type: 'unknown', text: '<unserializable console message>' });
      }
    });

    // Capture unhandled page errors
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure UI elements are present
    await Promise.all([
      this.page.waitForSelector('#graphCanvas', { state: 'visible' }),
      this.page.waitForSelector('#startButton', { state: 'visible' })
    ]);
  }

  async clickStart() {
    await this.page.click('#startButton');
  }

  // Read the in-page shortestPaths variable (global)
  async getShortestPaths() {
    return await this.page.evaluate(() => {
      // Return a copy to avoid serialization references
      if (typeof shortestPaths === 'undefined') return undefined;
      return Array.from(shortestPaths);
    });
  }

  // Wait until at least one node has been marked visited
  async waitForAnyVisitedNode(timeout = 7000) {
    return await this.page.waitForFunction(() => {
      if (typeof shortestPaths === 'undefined') return false;
      return shortestPaths.some(Boolean);
    }, { timeout });
  }

  // Wait for the final console log that contains the given substring and return all matching occurrences
  async waitForConsoleMessagesContaining(substring, requiredCount = 1, timeout = 15000) {
    const start = Date.now();
    return await new Promise((resolve, reject) => {
      const check = () => {
        const hits = this.consoleMessages.filter(m => m.text.includes(substring));
        if (hits.length >= requiredCount) {
          resolve(hits);
        } else if (Date.now() - start > timeout) {
          reject(new Error(`Timed out waiting for ${requiredCount} console messages containing "${substring}". Found ${hits.length}.`));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  // Capture the canvas data URL for visual-diff-ish assertion (simple change detection)
  async getCanvasDataURL() {
    return await this.page.evaluate(() => {
      const c = document.getElementById('graphCanvas');
      if (!c) return null;
      try {
        return c.toDataURL();
      } catch (e) {
        return null;
      }
    });
  }

  getConsoleMessages() {
    return Array.from(this.consoleMessages);
  }

  getPageErrors() {
    return Array.from(this.pageErrors);
  }
}

test.describe('Dijkstra Algorithm Visualization - FSM Validation', () => {
  // Each test gets a new page
  test('Initial Idle State (S0_Idle) - canvas and controls exist; drawGraph executed on load', async ({ page }) => {
    // Comment: Validate that the app loads into the Idle state (S0_Idle).
    // Expected: drawGraph() called on load which results in canvas being drawn and shortestPaths initialized (empty array).
    const gp = new GraphPage(page);
    await gp.goto();

    // Verify DOM components from FSM: canvas and start button
    const canvas = await page.$('#graphCanvas');
    const startBtn = await page.$('#startButton');
    expect(canvas).not.toBeNull();
    expect(startBtn).not.toBeNull();

    // Verify canvas has expected attributes from implementation
    const { width, height } = await page.evaluate(() => {
      const c = document.getElementById('graphCanvas');
      return { width: c ? c.getAttribute('width') : null, height: c ? c.getAttribute('height') : null };
    });
    expect(width).toBe('600');
    expect(height).toBe('400');

    // Verify that the global shortestPaths variable exists and is initialized as an empty array on load
    const shortestPaths = await gp.getShortestPaths();
    // Implementation declares: let shortestPaths = [];
    // Expectation: initial length is 0 (no nodes visited yet)
    expect(shortestPaths).toBeDefined();
    expect(Array.isArray(shortestPaths)).toBe(true);
    expect(shortestPaths.length).toBe(0);

    // Ensure no uncaught page errors occurred during initial load
    const errors = gp.getPageErrors();
    expect(errors.length).toBe(0);

    // Capture initial canvas snapshot (data URL). We assert it's a non-empty string (to show drawGraph drew something)
    const initialCanvasData = await gp.getCanvasDataURL();
    expect(typeof initialCanvasData).toBe('string');
    expect(initialCanvasData.length).toBeGreaterThan(0);
  });

  test('StartAlgorithm event triggers AlgorithmRunning (S1_AlgorithmRunning) and logs final distances', async ({ page }) => {
    // Comment: Clicking the start button should:
    // - reset shortestPaths to []
    // - call drawGraph()
    // - start dijkstra() which will eventually log "Shortest Distances: "
    const gp = new GraphPage(page);
    await gp.goto();

    // Capture canvas before starting
    const beforeCanvas = await gp.getCanvasDataURL();

    // Click start, which triggers the transition from S0_Idle -> S1_AlgorithmRunning
    await gp.clickStart();

    // Wait until the algorithm marks at least one node as visited (visualization step)
    await gp.waitForAnyVisitedNode(7000); // waits up to 7s for the first visited node
    // After at least one node visited, shortestPaths should have at least one truthy entry
    const duringShortestPaths = await gp.getShortestPaths();
    expect(duringShortestPaths.some(Boolean)).toBe(true);

    // Wait for the final console log indicating the algorithm finished.
    // The implementation prints: console.log("Shortest Distances: ", distances);
    const finalLogs = await gp.waitForConsoleMessagesContaining('Shortest Distances:', 1, 20000);
    expect(finalLogs.length).toBeGreaterThanOrEqual(1);
    expect(finalLogs[0].text).toContain('Shortest Distances:');

    // After algorithm completes, the shortestPaths should have truthy values for nodes that were reachable.
    // For the given graph all nodes are reachable, expect indices 0..3 to be truthy.
    const finalShortestPaths = await gp.getShortestPaths();
    expect(finalShortestPaths.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < 4; i++) {
      expect(finalShortestPaths[i]).toBeTruthy();
    }

    // Canvas should have been updated during/after algorithm: compare data URL before and after
    const afterCanvas = await gp.getCanvasDataURL();
    expect(afterCanvas).toBeTruthy();
    // It's expected to differ because nodes change color (visited) during the algorithm
    expect(afterCanvas).not.toBe(beforeCanvas);

    // Ensure no uncaught page errors during the run
    const errors = gp.getPageErrors();
    expect(errors.length).toBe(0);
  });

  test('Edge case: clicking Start multiple times - should produce multiple completion logs (concurrent runs allowed)', async ({ page }) => {
    // Comment: The implementation does not guard against multiple concurrent runs.
    // Clicking the Start button multiple times quickly will start multiple dijkstra() runs and result in multiple "Shortest Distances:" logs.
    const gp = new GraphPage(page);
    await gp.goto();

    // Click twice in quick succession to attempt to start overlapping runs
    await Promise.all([
      gp.clickStart(),
      gp.clickStart()
    ]);

    // Wait for at least two completion logs. Each run logs "Shortest Distances: "
    // Because runs include timeouts, we give enough timeout to allow both to complete.
    const logs = await gp.waitForConsoleMessagesContaining('Shortest Distances:', 2, 30000);
    expect(logs.length).toBeGreaterThanOrEqual(2);

    // After concurrent runs, ensure final shortestPaths still marks nodes as visited (consistency)
    const finalShortestPaths = await gp.getShortestPaths();
    expect(finalShortestPaths.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < 4; i++) {
      expect(finalShortestPaths[i]).toBeTruthy();
    }

    // Confirm absence of uncaught page errors even under concurrent runs
    const errors = gp.getPageErrors();
    expect(errors.length).toBe(0);
  });

  test('Robustness check: accessing internal data without modifying page - ensure variables are readable', async ({ page }) => {
    // Comment: Verify we can observe internal state like nodes and startNode without modifying globals.
    const gp = new GraphPage(page);
    await gp.goto();

    // Read nodes and startNode from the page
    const nodesInfo = await page.evaluate(() => {
      return {
        nodesDeclared: typeof nodes !== 'undefined',
        nodesLength: nodes ? nodes.length : 0,
        startNode: typeof startNode !== 'undefined' ? startNode : null
      };
    });

    expect(nodesInfo.nodesDeclared).toBe(true);
    expect(nodesInfo.nodesLength).toBeGreaterThanOrEqual(4);
    expect(nodesInfo.startNode).toBe(0);

    // There should still be no page errors
    expect(gp.getPageErrors().length).toBe(0);
  });
});