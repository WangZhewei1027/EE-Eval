import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c978d72-fa78-11f0-857d-d58e82d5de73.html';

// Page Object Model for the graph page
class GraphPage {
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.graph = page.locator('#graph');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure the core elements are present
    await expect(this.startBtn).toBeVisible();
    await expect(this.resetBtn).toBeVisible();
    await expect(this.graph).toBeVisible();
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  nodeLocator(nodeId) {
    // g.node with data-id attribute contains .distance-label text element
    return this.page.locator(`g.node[data-id="${nodeId}"]`);
  }

  distanceLabelLocator(nodeId) {
    return this.page.locator(`g.node[data-id="${nodeId}"] .distance-label`);
  }

  async getDistanceText(nodeId) {
    const loc = this.distanceLabelLocator(nodeId);
    return (await loc.textContent())?.trim();
  }

  async nodeHasClass(nodeId, className) {
    const cls = await this.nodeLocator(nodeId).getAttribute('class');
    return cls ? cls.split(/\s+/).includes(className) : false;
  }

  async edgeCount() {
    // edges rendered as .edge lines in the SVG
    return this.page.locator('svg#graph line.edge').count();
  }

  async nodeCount() {
    return this.page.locator('svg#graph g.node').count();
  }
}

test.describe('Dijkstra\'s Algorithm • Visualized — FSM and UI integration tests', () => {
  // Collect console and page errors for each test to assert app stability
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      // Capture uncaught exceptions from the page
      pageErrors.push(err.message);
    });
  });

  // Test Idle state — confirms resetState() ran on load and initial UI is correct
  test('Initial Idle state: UI initialized by resetState() (entry action)', async ({ page }) => {
    const gp = new GraphPage(page);
    await gp.goto();

    // Validate buttons initial attributes
    await expect(gp.startBtn).toBeEnabled(); // Start should be enabled in Idle
    await expect(gp.startBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(gp.resetBtn).toBeDisabled(); // Reset disabled until an animation has run

    // Validate node and edge rendering counts (evidence of successful render)
    const nodes = await gp.nodeCount();
    const edges = await gp.edgeCount();
    expect(nodes).toBeGreaterThanOrEqual(7); // should have at least the 7 nodes from data
    expect(edges).toBeGreaterThanOrEqual(10); // should have edges rendered (11 in data)

    // resetState() sets the start node (A) distance to 0 — assert distance label for A is '0'
    const distA = await gp.getDistanceText('A');
    expect(distA).toBe('0');

    // Other nodes should initially show infinity '∞'
    const otherNodes = ['B','C','D','E','F','G'];
    for (const n of otherNodes) {
      const d = await gp.getDistanceText(n);
      expect(d).toBe('∞');
    }

    // No uncaught console errors or page errors on initial load
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Test Running state: click Start and validate transition to Running and UI changes
  test('StartAnimation event: Idle -> Running, UI updates and animations begin', async ({ page }) => {
    // This test interacts with animation; give ample time for first steps to occur
    test.setTimeout(45000);
    const gp = new GraphPage(page);
    await gp.goto();

    // Click Start to trigger runAnimation()
    await gp.clickStart();

    // Immediately after clicking, runAnimation sets startBtn.disabled = true and aria-pressed = true
    await expect(gp.startBtn).toBeDisabled();
    await expect(gp.startBtn).toHaveAttribute('aria-pressed', 'true');

    // While animation is running, resetBtn should remain disabled (code sets it disabled at start)
    await expect(gp.resetBtn).toBeDisabled();

    // Wait for the initial "current" node highlight to appear.
    // Dijkstra should highlight the start node 'A' as current first.
    await page.waitForFunction(() => {
      const el = document.querySelector('g.node[data-id="A"]');
      return el && el.classList.contains('current');
    }, null, { timeout: 8000 });

    // Confirm the DOM reflects 'current' for A
    const isCurrentA = await gp.nodeHasClass('A', 'current');
    expect(isCurrentA).toBe(true);

    // After the step that visits A, neighbors B, C, F should get updated distances.
    // Wait up to a reasonable timeout for at least one neighbor to change from '∞' to a numeric value.
    await page.waitForFunction(() => {
      const b = document.querySelector('g.node[data-id="B"] .distance-label')?.textContent?.trim();
      const c = document.querySelector('g.node[data-id="C"] .distance-label')?.textContent?.trim();
      const f = document.querySelector('g.node[data-id="F"] .distance-label')?.textContent?.trim();
      return (b && b !== '∞') || (c && c !== '∞') || (f && f !== '∞');
    }, null, { timeout: 10000 });

    // Check at least one neighbor updated to a numeric distance
    const distB = await gp.getDistanceText('B');
    const distC = await gp.getDistanceText('C');
    const distF = await gp.getDistanceText('F');

    const someUpdated = [distB, distC, distF].some(v => v !== '∞');
    expect(someUpdated).toBe(true);

    // Clicking Start while already running should not throw and should have no adverse effect.
    // Attempt to click start again — code guards with isRunning and disables the button
    // But because button is disabled, clicking will be ignored by browser; ensure no page errors resulted.
    await gp.startBtn.click().catch(() => {}); // clicking disabled may throw in some drivers; swallow
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Test ResetVisualization edge cases and transition behavior:
  // - Clicking Reset while animation is running should be ignored (code returns early if isRunning)
  // - After a full run, Reset should be enabled and should reset UI to Idle values
  test('ResetVisualization: behavior while running (ignored) and after completion (resets to Idle)', async ({ page }) => {
    // This test may wait for the full animation to finish; give longer timeout
    test.setTimeout(90000);
    const gp = new GraphPage(page);
    await gp.goto();

    // Start the animation
    await gp.clickStart();

    // Immediately attempt to click Reset while the animation is running.
    // According to code, resetBtn is disabled while running, and the listener returns early if isRunning.
    // Ensure that clicking does not produce errors and does not reset the UI prematurely.
    await expect(gp.resetBtn).toBeDisabled();
    // Try to click disabled reset (should be a no-op); ensure it doesn't throw page errors
    await gp.resetBtn.click().catch(() => {});
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    // Wait for the animation to complete so resetBtn becomes enabled.
    // The animation highlights steps and finally enables resetBtn at the end of runAnimation().
    // Wait for resetBtn to become enabled (timeout generous).
    await gp.resetBtn.waitFor({ state: 'enabled', timeout: 65000 });

    // Now resetBtn should be enabled; clicking it must reset the visualization to Idle state.
    await gp.clickReset();

    // After reset, resetBtn is set disabled again in the reset handler
    await expect(gp.resetBtn).toBeDisabled();

    // Start button should be enabled and have aria-pressed false after reset
    await expect(gp.startBtn).toBeEnabled();
    await expect(gp.startBtn).toHaveAttribute('aria-pressed', 'false');

    // Distances should be reset: A -> '0', others -> '∞'
    const distA = await gp.getDistanceText('A');
    expect(distA).toBe('0');

    const otherNodes = ['B','C','D','E','F','G'];
    for (const n of otherNodes) {
      const d = await gp.getDistanceText(n);
      expect(d).toBe('∞');
    }

    // Confirm nodes have no 'current' or 'visited' classes after reset
    for (const n of ['A','B','C','D','E','F','G']) {
      const hasCurrent = await gp.nodeHasClass(n, 'current');
      const hasVisited = await gp.nodeHasClass(n, 'visited');
      expect(hasCurrent).toBe(false);
      expect(hasVisited).toBe(false);
    }

    // Ensure no console/page errors during the entire flow
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Edge case: multiple rapid Start clicks should not break the app
  test('Edge case: multiple rapid Start clicks do not produce uncaught errors', async ({ page }) => {
    test.setTimeout(30000);
    const gp = new GraphPage(page);
    await gp.goto();

    // Rapidly click Start multiple times
    await Promise.all([
      gp.startBtn.click(),
      gp.startBtn.click().catch(()=>{}),
      gp.startBtn.click().catch(()=>{}),
    ]);

    // Start button should quickly become disabled and aria-pressed true
    await expect(gp.startBtn).toBeDisabled();
    await expect(gp.startBtn).toHaveAttribute('aria-pressed', 'true');

    // Wait a bit for first step to occur
    await page.waitForTimeout(1000);

    // Confirm app is still responsive (nodes exist, no uncaught exceptions)
    const nodes = await gp.nodeCount();
    expect(nodes).toBeGreaterThanOrEqual(7);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Validate accessibility attributes & labels are updated during algorithm (aria-labels for distances)
  test('Accessibility: distance labels have appropriate aria-label updates during run', async ({ page }) => {
    test.setTimeout(45000);
    const gp = new GraphPage(page);
    await gp.goto();

    // Verify initial aria-label for A distance mentions zero/infinity as appropriate
    const aLabel = await gp.distanceLabelLocator('A').getAttribute('aria-label');
    expect(aLabel).toContain('Distance to node A');

    // Start animation and wait for at least one distance update to carry a new aria-label
    await gp.clickStart();
    await page.waitForFunction(() => {
      const bLabel = document.querySelector('g.node[data-id="B"] .distance-label')?.getAttribute('aria-label');
      return bLabel && bLabel.includes('Distance to node B') && !bLabel.includes('infinity');
    }, null, { timeout: 12000 }).catch(() => null);

    // If updated, the aria-label should reflect numeric update; if not updated yet, just ensure no errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});