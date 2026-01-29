import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aa5370-fa78-11f0-812d-c9788050701f.html';

// Page Object for the BFS visualization app
class BFSPage {
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];

    // capture console errors and page errors for assertions
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Controls
  startButton() {
    return this.page.locator('#startBtn');
  }
  resetButton() {
    return this.page.locator('#resetBtn');
  }

  // Graph and queue
  graphContainer() {
    return this.page.locator('#graph');
  }
  queueDisplay() {
    return this.page.locator('#queue');
  }
  queueItems() {
    return this.page.locator('#queue .queue-item');
  }
  nodeById(id) {
    return this.page.locator(`#node-${id}`);
  }

  // Actions
  async clickStart() {
    await this.startButton().click();
  }
  async clickReset() {
    await this.resetButton().click();
  }

  // State queries
  async isStartDisabled() {
    return await this.startButton().isDisabled();
  }

  async getQueueText() {
    return await this.queueDisplay().innerText();
  }

  async getQueueValues() {
    const count = await this.queueItems().count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await this.queueItems().nth(i).innerText());
    }
    return values;
  }

  async nodeHasClass(nodeId, className) {
    const node = this.nodeById(nodeId);
    return await node.evaluate((el, cls) => el.classList.contains(cls), className);
  }

  // Wait helper: wait until a node has a specific class
  async waitForNodeClass(nodeId, className, options = {}) {
    const timeout = options.timeout ?? 5000;
    await this.page.waitForFunction(
      (id, cls) => {
        const el = document.getElementById(`node-${id}`);
        return el && el.classList.contains(cls);
      },
      nodeId,
      className,
      { timeout }
    );
  }

  // Wait until queue includes a given node label
  async waitForQueueIncludes(label, options = {}) {
    const timeout = options.timeout ?? 5000;
    await this.page.waitForFunction(
      lbl => {
        const q = document.querySelectorAll('#queue .queue-item');
        return Array.from(q).some(el => el.textContent === lbl);
      },
      label,
      { timeout }
    );
  }

  // Wait for BFS completion: start button becomes enabled again
  async waitForCompletion(options = {}) {
    const timeout = options.timeout ?? 35000;
    await this.page.waitForFunction(
      () => {
        const startBtn = document.getElementById('startBtn');
        return startBtn && !startBtn.disabled;
      },
      { timeout }
    );
  }
}

test.describe('BFS Visualization - FSM and DOM behavior', () => {
  // Global per-test setup/teardown handled by Playwright fixtures
  test.beforeEach(async ({ page }) => {
    // noop (each test instantiates BFSPage and navigates)
  });

  test('Initial (Idle) state should render graph and empty queue (S0_Idle)', async ({ page }) => {
    // This test verifies the initial/idle state:
    // - Graph nodes and edges are rendered as per implementation
    // - Queue display only contains the title initially
    // - Start button is enabled (not running)
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Verify there are nodes present (implementation creates 7 nodes)
    const nodeCount = await page.locator('.node').count();
    expect(nodeCount).toBeGreaterThanOrEqual(1); // At least one node should exist
    // Confirm queue-display has only the title (no queue items)
    const queueItemCount = await page.locator('#queue .queue-item').count();
    expect(queueItemCount).toBe(0);

    // Start button should be enabled in idle state
    expect(await bfs.isStartDisabled()).toBe(false);

    // Assert that no console or page errors appeared on initial load
    expect(bfs.consoleErrors.length, 'No console.error calls on load').toBe(0);
    expect(bfs.pageErrors.length, 'No page errors on load').toBe(0);
  });

  test('Start Visualization triggers Visualizing state and marks nodes as current/visited (S0 -> S1, NodeVisited, NeighborAdded)', async ({ page }) => {
    // This test validates:
    // - Clicking start begins the visualization (start button disabled)
    // - Initial node A is added to the queue
    // - Node A becomes "current" and later "visited"
    // - Neighbor nodes are added to the queue
    // Note: Uses real timers from the app; timeouts account for animation scheduling
    test.setTimeout(45000);
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Click start to begin BFS
    await bfs.clickStart();

    // Start button should be disabled immediately after starting
    expect(await bfs.isStartDisabled()).toBe(true);

    // The queue should include 'A' fairly quickly (initial push occurs inside visualizeBFS)
    await bfs.waitForQueueIncludes('A', { timeout: 3000 });

    // The first interval tick will set node A as 'current' — wait for it
    await bfs.waitForNodeClass('A', 'current', { timeout: 5000 });
    expect(await bfs.nodeHasClass('A', 'current')).toBe(true);

    // After the internal setTimeout, node A should become 'visited' and neighbors should be enqueued
    // Wait for 'visited' class on A
    await bfs.waitForNodeClass('A', 'visited', { timeout: 8000 });
    expect(await bfs.nodeHasClass('A', 'visited')).toBe(true);

    // After visit, neighbors (B and C) should be added to queue; wait for at least 'B' and 'C'
    await bfs.waitForQueueIncludes('B', { timeout: 4000 });
    await bfs.waitForQueueIncludes('C', { timeout: 4000 });

    // Check queue contains at least the discovered neighbors (order may vary due to edges & implementation)
    const queueValues = await bfs.getQueueValues();
    expect(queueValues.length).toBeGreaterThanOrEqual(1);
    expect(queueValues).toContain('B');
    expect(queueValues).toContain('C');

    // Ensure no console or page errors happened during visualization start and first steps
    expect(bfs.consoleErrors.length, 'No console errors during start/first steps').toBe(0);
    expect(bfs.pageErrors.length, 'No page errors during start/first steps').toBe(0);
  });

  test('Starting when already running should not duplicate initial queue item (Edge case)', async ({ page }) => {
    // This test validates the app handles redundant Start events gracefully:
    // - Start button becomes disabled so further clicks are prevented
    // - If a second click is attempted quickly, the queue should still contain a single initial 'A'
    test.setTimeout(20000);
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Click start twice in quick succession
    await bfs.clickStart();
    // Attempt to click again; the button should be disabled so this should be a no-op.
    // We still attempt a click with force: false (default). If disabled, Playwright will throw if trying to click a disabled element.
    // Instead, we attempt to evaluate a manual click to mimic user trying to click a disabled element (but we must not patch code).
    // We'll attempt a normal click and catch if it fails (Playwright throws). We do not modify page behavior.
    try {
      await bfs.clickStart();
    } catch (err) {
      // If Playwright prevented clicking because the button is disabled, that's acceptable — it demonstrates the guard is in place.
    }

    // Allow initial queue update to occur
    await bfs.waitForQueueIncludes('A', { timeout: 4000 });

    // Ensure 'A' appears only once in the visible queue items initially
    const values = await bfs.getQueueValues();
    // There should be at least one 'A' and not multiple 'A' duplicates immediately
    const aCount = values.filter(v => v === 'A').length;
    expect(aCount).toBe(1);

    // Ensure no console/page errors were produced by attempting to start again
    expect(bfs.consoleErrors.length, 'No console errors when attempting to start twice').toBe(0);
    expect(bfs.pageErrors.length, 'No page errors when attempting to start twice').toBe(0);
  });

  test('Reset during visualization returns to Idle (S1 -> S0) and stops animation', async ({ page }) => {
    // This test validates:
    // - Clicking Reset while visualizing clears interval, re-initializes graph, and leaves queue empty
    // - Start button becomes enabled again after reset
    test.setTimeout(30000);
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Start visualization
    await bfs.clickStart();
    expect(await bfs.isStartDisabled()).toBe(true);

    // Wait until at least node A is current or in queue, then perform reset
    await bfs.waitForQueueIncludes('A', { timeout: 4000 });

    // Click reset during visualization
    await bfs.clickReset();

    // After reset, queue should be cleared (only the title present)
    await page.waitForFunction(
      () => document.querySelectorAll('#queue .queue-item').length === 0,
      { timeout: 3000 }
    );
    const queueCountAfterReset = await page.locator('#queue .queue-item').count();
    expect(queueCountAfterReset).toBe(0);

    // Start button should be enabled after reset
    expect(await bfs.isStartDisabled()).toBe(false);

    // Graph nodes should exist but none should have 'visited' or 'current' classes immediately after reset
    const nodes = await page.locator('.node').count();
    expect(nodes).toBeGreaterThanOrEqual(1);
    // Sample a few nodes to ensure they are not marked visited/current
    const sampleIds = ['A', 'B', 'C'].filter(async id => {
      // nothing, just for collection
      return id;
    });

    for (const id of ['A', 'B', 'C']) {
      const hasVisited = await bfs.nodeHasClass(id, 'visited');
      const hasCurrent = await bfs.nodeHasClass(id, 'current');
      expect(hasVisited || hasCurrent).toBe(false);
    }

    // Ensure no console/page errors from resetting while running
    expect(bfs.consoleErrors.length, 'No console errors during reset').toBe(0);
    expect(bfs.pageErrors.length, 'No page errors during reset').toBe(0);
  });

  test('Full BFS run should eventually complete and transition to Completed (S1 -> S2)', async ({ page }) => {
    // This test validates:
    // - After starting, the algorithm visits nodes and eventually completes
    // - On completion, the interval is cleared, isRunning false (observed via start button being re-enabled)
    // Note: The real app uses timers; allow sufficient timeout for full traversal.
    test.setTimeout(60000);
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Start the BFS
    await bfs.clickStart();

    // Ensure BFS started
    expect(await bfs.isStartDisabled()).toBe(true);

    // Wait for completion signaled by startBtn becoming enabled again
    await bfs.waitForCompletion({ timeout: 45000 });

    // After completion, start button should be enabled
    expect(await bfs.isStartDisabled()).toBe(false);

    // Queue should be empty (no queue items)
    const finalQueueCount = await page.locator('#queue .queue-item').count();
    expect(finalQueueCount).toBe(0);

    // Check that several nodes have 'visited' class indicating they were processed
    const visitedCount = await page.locator('.node.visited').count();
    expect(visitedCount).toBeGreaterThanOrEqual(1);

    // Ensure no console or page errors occurred during full run
    expect(bfs.consoleErrors.length, 'No console errors during full run').toBe(0);
    expect(bfs.pageErrors.length, 'No page errors during full run').toBe(0);
  });

  test('Sanity check: No unexpected ReferenceError/SyntaxError/TypeError in console or page errors', async ({ page }) => {
    // This test explicitly checks the console/page errors for the presence of common JS errors.
    // It does NOT modify the runtime; it only observes and asserts no such errors occurred.
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Perform a quick interaction to stimulate code paths (start and reset)
    await bfs.clickStart();
    await bfs.waitForQueueIncludes('A', { timeout: 4000 }).catch(() => {});
    await bfs.clickReset();

    // Aggregate error messages as strings
    const consoleErrorTexts = bfs.consoleErrors.map(e => String(e.text || e));
    const pageErrorTexts = bfs.pageErrors.map(e => String(e.message || e));

    // Assert that no ReferenceError, SyntaxError, or TypeError strings appear in logs
    const combined = consoleErrorTexts.concat(pageErrorTexts).join(' | ');
    expect(combined.includes('ReferenceError')).toBe(false);
    expect(combined.includes('SyntaxError')).toBe(false);
    expect(combined.includes('TypeError')).toBe(false);

    // Additionally assert there are no console or page errors at all
    expect(bfs.consoleErrors.length, 'No console.error messages should be present').toBe(0);
    expect(bfs.pageErrors.length, 'No page errors should be present').toBe(0);
  });
});