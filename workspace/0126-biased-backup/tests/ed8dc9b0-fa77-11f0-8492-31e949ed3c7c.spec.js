import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8dc9b0-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for interacting with the DFS visualizer
class DFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#startButton');
    this.nodes = page.locator('.node');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure page loaded and main elements exist
    await expect(this.startButton).toBeVisible();
    await expect(this.nodes.first()).toBeVisible();
  }

  async clickStart() {
    await this.startButton.click();
  }

  async nodeCount() {
    return await this.nodes.count();
  }

  // Returns number of nodes that have the 'visited' class
  async visitedCount() {
    const count = await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('.node')).filter(n => n.classList.contains('visited')).length;
    });
    return count;
  }

  // Returns array of booleans whether each node is visited
  async visitedArray() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('.node')).map(n => n.classList.contains('visited'));
    });
  }

  // Wait for visitedCount to reach at least target within timeout
  async waitForVisitedAtLeast(target, timeout = 5000) {
    await this.page.waitForFunction(
      (t) => {
        return Array.from(document.querySelectorAll('.node')).filter(n => n.classList.contains('visited')).length >= t;
      },
      target,
      { timeout }
    );
  }
}

test.describe('DFS Visualizer - FSM states and transitions', () => {
  // Capture console errors and page errors for assertions
  /** @type {Array<import('@playwright/test').ConsoleMessage>} */
  let consoleErrors;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Test: Idle state present on load (S0_Idle)
  test('Idle state is initial: Start button visible and no nodes visited', async ({ page }) => {
    const dfs = new DFSPage(page);
    // Load the app
    await dfs.goto();

    // Verify start button exists as evidence of Idle state (S0_Idle)
    await expect(dfs.startButton).toHaveText('Start DFS');

    // Verify no nodes are visited on load
    const visited = await dfs.visitedCount();
    expect(visited).toBe(0);

    // Verify there are exactly 6 nodes as per implementation
    const total = await dfs.nodeCount();
    expect(total).toBe(6);

    // Assert that no runtime errors occurred during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Starting DFS visits the first node immediately (S0 -> S1)
  test('Clicking Start DFS transitions to Visiting Node and first node becomes visited', async ({ page }) => {
    const dfs = new DFSPage(page);
    await dfs.goto();

    // Click start to initiate DFS
    await dfs.clickStart();

    // The implementation marks the current node as visited synchronously in dfs()
    // So we expect node 0 to be visited almost immediately.
    await expect(page.locator('.node').first()).toHaveClass(/visited/);

    // Only the first node should be visited at this moment
    const visitedArr = await dfs.visitedArray();
    expect(visitedArr[0]).toBe(true);
    // Ensure subsequent nodes are not yet visited
    for (let i = 1; i < visitedArr.length; i++) {
      expect(visitedArr[i]).toBe(false);
    }

    // No uncaught errors should appear as a result of starting the DFS
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test: DFS continues visiting the next node after ~1 second (S1 -> S1)
  test('DFS visits next node after 1 second (verifies setTimeout-based transition)', async ({ page }) => {
    const dfs = new DFSPage(page);
    await dfs.goto();

    // Start DFS
    await dfs.clickStart();

    // Wait for at least 2 nodes to be marked visited (first is immediate, second after ~1s)
    // Allow some buffer: timeout = 3000ms to account for potential scheduling delays
    await dfs.waitForVisitedAtLeast(2, 3000);

    const visitedArr = await dfs.visitedArray();
    // Validate first two nodes visited
    expect(visitedArr[0]).toBe(true);
    expect(visitedArr[1]).toBe(true);

    // No runtime errors occurred during asynchronous progression
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Clicking Start while traversal is active (S1 -> S1 with event) does not crash and is tolerated
  test('Clicking Start while DFS is traversing does not cause errors and traversal continues', async ({ page }) => {
    const dfs = new DFSPage(page);
    await dfs.goto();

    // Start the DFS
    await dfs.clickStart();

    // Click again quickly to simulate user interaction while traversal is in progress
    // This will exercise the code path where startButton event handler is triggered while index changes asynchronously
    await dfs.clickStart();

    // Wait for at least 2 nodes visited (to ensure traversal continued)
    await dfs.waitForVisitedAtLeast(2, 3000);

    const visitedArr = await dfs.visitedArray();
    expect(visitedArr[0]).toBe(true);
    expect(visitedArr[1]).toBe(true);

    // Reasonable expectation: no uncaught page errors or console errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: Clicking start repeatedly until all nodes visited, then clicking again should do nothing and not error
  test('After all nodes visited, clicking Start has no effect and causes no errors', async ({ page }) => {
    // Increase overall test timeout to allow waiting for full traversal (5 intervals ~ 5s plus buffers)
    test.setTimeout(15000);

    const dfs = new DFSPage(page);
    await dfs.goto();

    // Kick off traversal
    await dfs.clickStart();

    // Wait for all nodes to become visited. There are 6 nodes; first is immediate, 5 subsequent after ~1s each => ~5s
    // Allow a buffer: 9000ms total
    await dfs.waitForVisitedAtLeast(6, 9000);

    // Confirm all nodes are visited
    const visitedArr = await dfs.visitedArray();
    expect(visitedArr.every(v => v === true)).toBe(true);

    // Record current visited count
    const beforeClick = await dfs.visitedCount();
    expect(beforeClick).toBe(6);

    // Click Start after traversal is complete; according to code, nothing should happen (index >= nodes.length)
    await dfs.clickStart();

    // Allow a small delay to see if any unexpected behavior happens
    await page.waitForTimeout(500);

    const afterClick = await dfs.visitedCount();
    expect(afterClick).toBe(6); // still 6, no new changes

    // No runtime errors should have been emitted during or after full traversal
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test: Observability of DOM changes and transitions for debugging purposes
  test('DOM changes follow expected pattern: visited class is applied sequentially', async ({ page }) => {
    const dfs = new DFSPage(page);
    await dfs.goto();

    // Start DFS
    await dfs.clickStart();

    // Wait until all nodes visited (allow buffer)
    await dfs.waitForVisitedAtLeast(6, 9000);

    // Check ordering: because of implementation, nodes are visited in index order 0..n-1
    // We can verify text content mapping to ensure visited nodes correspond to expected letters A..F
    const nodeTexts = await page.$$eval('.node', nodes => nodes.map(n => n.textContent.trim()));
    expect(nodeTexts).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);

    const visitedArr = await dfs.visitedArray();
    // All should be visited
    expect(visitedArr).toEqual([true, true, true, true, true, true]);

    // No runtime errors during the operation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Teardown: ensure no unexpected errors were left uncaught across tests (this is redundant with per-test assertions but is an additional guard)
  test.afterEach(async () => {
    // If any uncaught page errors were captured in a test's beforeEach scope, fail early with helpful messages.
    if (pageErrors.length > 0) {
      // Throw to make the test fail and show details
      throw new Error('Page errors were observed during the test run: ' + pageErrors.map(e => e.message).join(' | '));
    }
    if (consoleErrors.length > 0) {
      throw new Error('Console error messages were emitted: ' + consoleErrors.map(c => c.text()).join(' | '));
    }
  });
});