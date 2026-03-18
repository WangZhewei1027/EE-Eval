import { test, expect } from '@playwright/test';

test.setTimeout(120000); // Allow enough time for the full DFS visualization to run

// Page object representing the DFS visualization page and common interactions
class DFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
    this.consoleMessages = [];

    // Collect console errors and page errors for assertions
    this.page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      this.consoleMessages.push({ type, text });
      if (type === 'error') this.consoleErrors.push(text);
    });

    this.page.on('pageerror', error => {
      this.pageErrors.push(error);
    });
  }

  // Navigate to the HTML page
  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0202-sample-2/html/5a333170-ffc5-11f0-8b43-1ffa87931c43.html');
    // ensure root elements are present
    await expect(this.page.locator('#startBtn')).toBeVisible();
    await expect(this.page.locator('#resetBtn')).toBeVisible();
    await expect(this.page.locator('#graph')).toBeVisible();
    await expect(this.page.locator('#log')).toBeVisible();
  }

  // Click the Start DFS button
  async clickStart() {
    await this.page.click('#startBtn');
  }

  // Click the Reset button (will be a no-op if disabled)
  async clickReset() {
    await this.page.click('#resetBtn');
  }

  // Return the text content of the log container
  async getLogText() {
    return this.page.locator('#log').innerText();
  }

  // Wait until the log contains a given substring (with a default timeout suitable for DFS)
  async waitForLogContains(substring, timeout = 60000) {
    await this.page.waitForFunction(
      (s) => {
        const log = document.getElementById('log');
        return log && log.innerText.includes(s);
      },
      substring,
      { timeout }
    );
  }

  // Get the count of occurrences of a substring inside the log
  async countLogOccurrences(substring) {
    const text = await this.getLogText();
    if (!text) return 0;
    return (text.match(new RegExp(substring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  }

  // Get a node circle locator by node id (uses aria-label on circles)
  nodeLocator(nodeId) {
    return this.page.locator(`svg circle[aria-label="Node ${nodeId}"]`);
  }

  // Check if a node has the 'visited' CSS class
  async isNodeVisited(nodeId) {
    const el = this.nodeLocator(nodeId);
    await expect(el).toHaveCount(1);
    const cls = await el.getAttribute('class');
    return cls && cls.split(/\s+/).includes('visited');
  }

  // Check if a node has the 'current' CSS class
  async isNodeCurrent(nodeId) {
    const el = this.nodeLocator(nodeId);
    await expect(el).toHaveCount(1);
    const cls = await el.getAttribute('class');
    return cls && cls.split(/\s+/).includes('current');
  }

  // Find an edge <line> element between two nodes by coordinates
  // Nodes coordinates are known from the implementation; this computes both permutations.
  async getEdgeLocatorBetween(uCoords, vCoords) {
    // Returns a locator for line element matching either direction
    const { page } = this;
    const [ux, uy] = uCoords;
    const [vx, vy] = vCoords;
    // Use evaluation to find the exact line element in the SVG
    const handle = await page.evaluateHandle(
      ({ ux, uy, vx, vy }) => {
        const lines = Array.from(document.querySelectorAll('#graph line'));
        const match = lines.find(l => {
          const x1 = l.getAttribute('x1');
          const y1 = l.getAttribute('y1');
          const x2 = l.getAttribute('x2');
          const y2 = l.getAttribute('y2');
          return (
            (x1 === String(ux) && y1 === String(uy) && x2 === String(vx) && y2 === String(vy)) ||
            (x1 === String(vx) && y1 === String(vy) && x2 === String(ux) && y2 === String(uy))
          );
        });
        return match || null;
      },
      { ux, uy, vx, vy }
    );
    return handle;
  }

  // Check if an edge between coordinates has the 'visited' class
  async isEdgeVisited(uCoords, vCoords) {
    const handle = await this.getEdgeLocatorBetween(uCoords, vCoords);
    if (!handle) return false;
    const className = await handle.getProperty('className');
    const cls = await className.jsonValue();
    // Release handle
    await handle.dispose();
    if (!cls) return false;
    return cls.split(/\s+/).includes('visited');
  }

  // Utility to clear listeners and dispose if needed
  async teardown() {
    // nothing special to do; listeners are bound to page which gets closed by Playwright
  }
}

// Coordinates used by the page's JS; using these to identify edges precisely
const NODE_COORDS = {
  A: [350, 40],
  B: [150, 130],
  C: [550, 130],
  D: [80, 220],
  E: [220, 220],
  F: [620, 220],
  G: [170, 330],
  H: [270, 320],
};

test.describe('DFS Visualization - FSM States and Transitions', () => {
  let dfs;

  test.beforeEach(async ({ page }) => {
    dfs = new DFSPage(page);
    await dfs.goto();
  });

  test.afterEach(async () => {
    await dfs.teardown();
  });

  test('Initial state (S0_Idle): reset() executed and UI initialized', async () => {
    // Verify initial state after reset() called on entry
    // - Start button enabled
    // - Reset button disabled
    // - No visited/current classes on nodes
    // - Log is empty
    // - No console/page errors occurred yet
    await expect(dfs.page.locator('#startBtn')).toBeEnabled();
    await expect(dfs.page.locator('#resetBtn')).toBeDisabled();

    const logText = await dfs.getLogText();
    expect(logText.trim()).toBe('', 'Log should be empty right after reset()');

    // Check a few nodes have no visited/current classes
    for (const id of ['A', 'B', 'C']) {
      const visited = await dfs.isNodeVisited(id);
      const current = await dfs.isNodeCurrent(id);
      expect(visited).toBeFalsy(`Node ${id} should not be marked visited initially`);
      expect(current).toBeFalsy(`Node ${id} should not be marked current initially`);
    }

    // No console or page errors captured on fresh load
    expect(dfs.consoleErrors.length).toBe(0);
    expect(dfs.pageErrors.length).toBe(0);
  });

  test('Start DFS (StartDfs event) transitions to Running (S1_Running) and logs start', async () => {
    // Clicking start should trigger dfs('A') (entry action for S1_Running)
    // Verify "Starting DFS from node A." appears and controls are appropriately disabled
    await dfs.clickStart();

    // After clicking, startBtn should be disabled and reset still disabled during run
    await expect(dfs.page.locator('#startBtn')).toBeDisabled();
    await expect(dfs.page.locator('#resetBtn')).toBeDisabled();

    await dfs.waitForLogContains('Starting DFS from node A.', 10000);
    const startCount = await dfs.countLogOccurrences('Starting DFS from node A.');
    expect(startCount).toBeGreaterThanOrEqual(1);

    // Try clicking start multiple times quickly; only one starting log should be produced
    await dfs.clickStart();
    await dfs.clickStart();
    // Give a small moment for any potential duplicate start logs (should not happen)
    await dfs.page.waitForTimeout(500);
    const startCountAfter = await dfs.countLogOccurrences('Starting DFS from node A.');
    expect(startCountAfter).toBe(startCount, 'Starting DFS should not be triggered multiple times while running');

    // At least one neighbor should be added to the stack for node A.
    // The implementation pushes neighbors sorted().reverse(), so expected neighbors are 'C' then 'B'.
    await dfs.waitForLogContains('Neighbor C added to stack.', 10000);
    const hasNeighborC = (await dfs.countLogOccurrences('Neighbor C added to stack.')) > 0;
    expect(hasNeighborC).toBeTruthy();

    // The edge between A and C should be marked visited when neighbor C is added
    const edgeVisitedAC = await dfs.isEdgeVisited(NODE_COORDS.A, NODE_COORDS.C);
    expect(edgeVisitedAC).toBeTruthy();
  });

  test('DFS runs to completion (S1_Running -> S2_Completed) and marks all nodes visited', async () => {
    // This test validates that the DFS finishes and produces the expected final log and UI state.
    await dfs.clickStart();

    // Wait for the completion log - allow enough time for full traversal of 8 nodes
    await dfs.waitForLogContains('DFS complete! All reachable nodes visited.', 90000);

    // Verify final message appears exactly once (or at least once)
    const completeCount = await dfs.countLogOccurrences('DFS complete! All reachable nodes visited.');
    expect(completeCount).toBeGreaterThanOrEqual(1);

    // After completion resetBtn should be enabled so user can reset; startBtn remains disabled (implementation detail)
    await expect(dfs.page.locator('#resetBtn')).toBeEnabled();
    await expect(dfs.page.locator('#startBtn')).toBeDisabled();

    // Check that all nodes A-H are visited
    for (const id of Object.keys(NODE_COORDS)) {
      const visited = await dfs.isNodeVisited(id);
      expect(visited).toBeTruthy(`Node ${id} should be visited after DFS completion`);
    }

    // No unexpected console / page errors occurred during the run
    expect(dfs.consoleErrors.length).toBe(0);
    expect(dfs.pageErrors.length).toBe(0);
  });

  test('Reset (ResetDfs event) brings the app back to Idle (S0_Idle) from Completed', async () => {
    // Start and wait for completion, then reset and verify idle state restored
    await dfs.clickStart();
    await dfs.waitForLogContains('DFS complete! All reachable nodes visited.', 90000);

    // Click reset and verify UI returns to initial state
    await dfs.clickReset();

    // After reset:
    await expect(dfs.page.locator('#startBtn')).toBeEnabled();
    await expect(dfs.page.locator('#resetBtn')).toBeDisabled();

    const logAfterReset = await dfs.getLogText();
    expect(logAfterReset.trim()).toBe('', 'Log should be cleared after reset()');

    // Verify nodes have no 'visited' or 'current' classes
    for (const id of Object.keys(NODE_COORDS)) {
      const visited = await dfs.isNodeVisited(id);
      const current = await dfs.isNodeCurrent(id);
      expect(visited).toBeFalsy(`Node ${id} should not be visited after reset`);
      expect(current).toBeFalsy(`Node ${id} should not be current after reset`);
    }

    // No console / page errors
    expect(dfs.consoleErrors.length).toBe(0);
    expect(dfs.pageErrors.length).toBe(0);
  });
});

test.describe('DFS Visualization - Edge cases and error observations', () => {
  let dfs;

  test.beforeEach(async ({ page }) => {
    dfs = new DFSPage(page);
    await dfs.goto();
  });

  test.afterEach(async () => {
    await dfs.teardown();
  });

  test('Attempting Reset while DFS is running should be a no-op (resetBtn disabled)', async () => {
    // Start DFS and immediately attempt to click Reset (should be disabled)
    await dfs.clickStart();

    // Confirm running state shortly after start
    await dfs.waitForLogContains('Starting DFS from node A.', 10000);
    await expect(dfs.page.locator('#resetBtn')).toBeDisabled();

    // Attempt to click reset (it is disabled; click should not throw, but also should not clear logs)
    const logBefore = await dfs.getLogText();
    // Ensure the element is disabled before "clicking" - use JavaScript click to simulate user event but it won't trigger handler since disabled.
    // We'll still call page.click which will be a no-op for disabled buttons.
    await dfs.clickReset();

    const logAfter = await dfs.getLogText();
    expect(logAfter).toContain('Starting DFS from node A.');
    expect(logAfter.length).toBeGreaterThanOrEqual(logBefore.length, 'Log should not be cleared by a reset click while running');

    // Allow run to finish for cleanup
    await dfs.waitForLogContains('DFS complete! All reachable nodes visited.', 90000);

    // No console / page errors throughout
    expect(dfs.consoleErrors.length).toBe(0);
    expect(dfs.pageErrors.length).toBe(0);
  });

  test('Multiple Start clicks do not cause multiple concurrent DFS runs', async () => {
    // Click start multiple times very quickly and verify only one "Starting DFS from node A." log
    await dfs.page.click('#startBtn');
    await dfs.page.click('#startBtn');
    await dfs.page.click('#startBtn');

    await dfs.waitForLogContains('Starting DFS from node A.', 10000);
    const occurrences = await dfs.countLogOccurrences('Starting DFS from node A.');
    expect(occurrences).toBe(1);

    // Let it finish cleanly
    await dfs.waitForLogContains('DFS complete! All reachable nodes visited.', 90000);

    // No console / page errors
    expect(dfs.consoleErrors.length).toBe(0);
    expect(dfs.pageErrors.length).toBe(0);
  });

  test('Observe console messages and ensure no runtime errors (ReferenceError/SyntaxError/TypeError) occurred', async () => {
    // Run a full DFS and inspect collected console and page errors
    await dfs.clickStart();
    await dfs.waitForLogContains('DFS complete! All reachable nodes visited.', 90000);

    // Collect console messages (info) and ensure expected key log lines exist
    const rawMessages = dfs.consoleMessages.map(m => `${m.type}: ${m.text}`).join('\n');

    // Ensure that the log container actually contains the expected "Visited node" messages and neighbor additions
    const logText = await dfs.getLogText();
    expect(logText).toContain('Visited node A.');
    expect(logText).toContain('Neighbor');
    expect(logText).toContain('DFS complete! All reachable nodes visited.');

    // Assert that there were no console errors or page errors during the run.
    // If any ReferenceError, SyntaxError, TypeError happened in the page, they would appear here.
    expect(dfs.consoleErrors.length).toBe(0, `No console errors expected, but got: ${dfs.consoleErrors.join('; ')}`);
    expect(dfs.pageErrors.length).toBe(0);
  });
});