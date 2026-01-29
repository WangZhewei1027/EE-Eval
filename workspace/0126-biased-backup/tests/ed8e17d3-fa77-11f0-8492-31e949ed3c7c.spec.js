import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e17d3-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Backtracking Visualization page
class VisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  startButton() {
    return this.page.locator('#start-btn');
  }

  nodes() {
    return this.page.locator('.node');
  }

  async nodeAt(index) {
    return this.page.locator('.node').nth(index);
  }

  async clickStart() {
    await this.startButton().click();
  }

  // return array of booleans for visited/active states for debug/assertions
  async getNodeStates(count) {
    const states = [];
    for (let i = 0; i < count; i++) {
      const node = await this.nodeAt(i);
      const classAttr = await node.getAttribute('class');
      states.push({
        index: i,
        classAttr,
        isActive: classAttr ? classAttr.includes('active') : false,
        isVisited: classAttr ? classAttr.includes('visited') : false,
      });
    }
    return states;
  }

  async countVisited() {
    return await this.page.locator('.node.visited').count();
  }

  async countActive() {
    return await this.page.locator('.node.active').count();
  }
}

test.describe('Backtracking Visualization - FSM tests', () => {
  // Increase timeout for tests that rely on timeouts in the app
  test.setTimeout(60_000);

  let pageErrors;
  let consoleErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console errors/messages for each test run
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Collect runtime errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Navigate to the app and wait for it to fully load
    const vp = new VisualizerPage(page);
    await vp.goto();
  });

  test.afterEach(async () => {
    // Basic expectation: no uncaught page errors during the test
    // If there are errors, the test should fail so we assert zero errors here.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join('\n')}`).toHaveLength(0);
  });

  test('Initial Idle state: createGrid() invoked on load and Start button exists', async ({ page }) => {
    // This test validates the initial FSM Idle state entry action `createGrid()`.
    // It verifies that the grid is created (gridSize = 5 => 25 nodes),
    // the Start button is present, and no nodes are marked active/visited initially.
    const vp = new VisualizerPage(page);

    // Assert start button exists and is visible
    await expect(vp.startButton()).toBeVisible();
    await expect(vp.startButton()).toHaveText('Start Visualization');

    // Assert grid nodes count equals 5x5 = 25
    const nodeCount = await vp.nodes().count();
    expect(nodeCount).toBe(25);

    // Assert none of the nodes has 'active' or 'visited' class initially
    const activeCount = await vp.countActive();
    const visitedCount = await vp.countVisited();
    expect(activeCount, 'No nodes should be active on initial load').toBe(0);
    expect(visitedCount, 'No nodes should be visited on initial load').toBe(0);

    // Inspect first node styles/position to ensure grid placement
    const first = await vp.nodeAt(0);
    const left = await first.evaluate((el) => el.style.left);
    const top = await first.evaluate((el) => el.style.top);
    expect(left).toBe('0px');
    expect(top).toBe('0px');
  });

  test('Start Visualization transitions to Visualizing: node classes updated over time', async ({ page }) => {
    // This test validates the StartVisualization event and the Visualizing state behavior:
    // - Clicking Start should call backtracking()
    // - First node becomes 'active' immediately
    // - After ~1s first node becomes 'visited' and second node becomes 'active'
    const vp = new VisualizerPage(page);

    // Click start and immediately check first node active (onEnter of Visualizing)
    await vp.clickStart();

    // Immediately after click, index 0 should be active but not visited
    const node0 = await vp.nodeAt(0);
    await expect(node0).toHaveClass(/active/);
    expect(await node0.getAttribute('class')).not.toMatch(/visited/);

    // Second node should not yet be active
    const node1 = await vp.nodeAt(1);
    expect(await node1.getAttribute('class')).not.toMatch(/active/);

    // Wait a bit longer than the app's 1000ms timeout to allow the first step to complete
    await page.waitForTimeout(1100);

    // Now first node should have 'visited' and should no longer be active
    await expect(node0).toHaveClass(/visited/);
    const class0After = await node0.getAttribute('class');
    expect(class0After.includes('active')).toBe(false);

    // Second node should now be active
    await expect(node1).toHaveClass(/active/);

    // Validate counts: at least 1 visited and 1 active
    const visitedCount = await vp.countVisited();
    const activeCount = await vp.countActive();
    expect(visitedCount).toBeGreaterThanOrEqual(1);
    expect(activeCount).toBeGreaterThanOrEqual(1);
  });

  test('Clicking Start mid-visualization resets and restarts visualization', async ({ page }) => {
    // This test validates that clicking the Start button during an ongoing visualization:
    // - Clears 'active' and 'visited' classes on all nodes
    // - Restarts the backtracking from index 0 (so index 0 becomes active again)
    const vp = new VisualizerPage(page);

    // Start visualization and let it progress a bit (so some nodes become visited)
    await vp.clickStart();
    await page.waitForTimeout(1500); // after ~1.5s, node0 should be visited, node1 active

    // Ensure there is at least one visited node before the reset
    const visitedBeforeReset = await vp.countVisited();
    expect(visitedBeforeReset).toBeGreaterThanOrEqual(1);

    // Click Start again mid-run to reset and restart
    await vp.clickStart();

    // Immediately after restart, all nodes should have had their visited/active classes removed
    // then the new backtracking call should set node0 active
    const statesAfterReset = await vp.getNodeStates(5); // check first few nodes
    // Only index 0 should be active and not visited immediately after restart
    expect(statesAfterReset[0].isActive).toBe(true);
    expect(statesAfterReset[0].isVisited).toBe(false);

    for (let i = 1; i < statesAfterReset.length; i++) {
      expect(statesAfterReset[i].isActive).toBe(false);
      expect(statesAfterReset[i].isVisited).toBe(false);
    }
  });

  test('Rapid multiple clicks do not throw errors and visualization continues', async ({ page }) => {
    // Edge case: rapid consecutive clicks on the start button.
    // Validate no runtime errors occur and the algorithm still marks nodes.
    const vp = new VisualizerPage(page);

    // Rapidly click start multiple times
    await vp.startButton().click();
    await vp.startButton().click();
    await vp.startButton().click();

    // Wait a bit to allow timeouts to execute
    await page.waitForTimeout(1200);

    // There should be no page errors (checked in afterEach) and at least one node should be visited or active
    const visited = await vp.countVisited();
    const active = await vp.countActive();
    expect(visited + active).toBeGreaterThan(0);

    // Also, validate structure remains intact (grid still has 25 nodes)
    const totalNodes = await vp.nodes().count();
    expect(totalNodes).toBe(25);
  });

  test('Visual feedback consistency: visited nodes change class and active moves forward', async ({ page }) => {
    // Validate that the backtracking loop marks nodes 'active' then 'visited' in sequence,
    // i.e., active moves forward and visited accumulates behind the active node.
    const vp = new VisualizerPage(page);

    await vp.clickStart();

    // After about 3.2s we expect at least the first 3 nodes to have been processed:
    // - nodes 0 and 1 visited, node 2 active (timings can slightly vary, give margin)
    await page.waitForTimeout(3200);

    const nodeStates = await vp.getNodeStates(5);
    // There should be at least one visited node
    const visitedCount = nodeStates.filter(s => s.isVisited).length;
    expect(visitedCount).toBeGreaterThanOrEqual(2);

    // Find the currently active node (should be one and it's index >= visitedCount)
    const activeStates = nodeStates.filter(s => s.isActive);
    expect(activeStates.length).toBeGreaterThanOrEqual(1);

    // Ensure no previously visited node remains 'active' (active should be ahead)
    for (const s of nodeStates) {
      if (s.isVisited) {
        // visited nodes should not also be active in this snapshot
        expect(s.isActive).toBe(false);
      }
    }
  });

  test('No unexpected console or runtime errors during full short run', async ({ page }) => {
    // This test runs a short visualization and explicitly asserts that no ReferenceError/SyntaxError/TypeError occurred.
    const vp = new VisualizerPage(page);

    // Start and let a small number of steps run
    await vp.clickStart();
    await page.waitForTimeout(2500);

    // After the run fragment, ensure no errors were emitted to the console or as page errors
    // The afterEach will assert zero pageErrors and consoleErrors.
    // Additionally assert we have some console messages (not errors), if any
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0); // at least defined; not a strict check
  });
});