import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a99020-fa78-11f0-812d-c9788050701f.html';

// Page Object encapsulating interactions and queries for the graph page
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.animateBtn = page.locator('#animateBtn');
    this.rearrangeBtn = page.locator('#rearrangeBtn');
    this.graphContainer = page.locator('#graph');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait a short while to allow initial rendering & the queued initial animateFlow timeout to schedule
    await this.page.waitForTimeout(50);
  }

  async getNodeIds() {
    return this.page.evaluate(() => Array.from(document.querySelectorAll('.node')).map(n => n.id));
  }

  async getNodeCount() {
    return this.page.evaluate(() => document.querySelectorAll('.node').length);
  }

  async getEdgeCount() {
    return this.page.evaluate(() => document.querySelectorAll('.edge').length);
  }

  async getNodePosition(id) {
    return this.page.evaluate((nid) => {
      const el = document.getElementById(nid);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      // Return center coordinates relative to the graph container
      const graphRect = document.getElementById('graph').getBoundingClientRect();
      return {
        left: rect.left - graphRect.left,
        top: rect.top - graphRect.top,
        width: rect.width,
        height: rect.height
      };
    }, id);
  }

  async clickAnimate() {
    await this.animateBtn.click();
  }

  async clickRearrange() {
    await this.rearrangeBtn.click();
  }

  // Returns true if any node currently has the accent background color (rgb(253, 121, 168))
  async anyNodeHasAccentColor() {
    return this.page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.node'));
      return nodes.some(n => {
        const bg = getComputedStyle(n).backgroundColor;
        return bg === 'rgb(253, 121, 168)';
      });
    });
  }

  // Returns true if all nodes are primary color (rgb(108, 92, 231))
  async allNodesPrimaryColor() {
    return this.page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.node'));
      if (nodes.length === 0) return false;
      return nodes.every(n => {
        const bg = getComputedStyle(n).backgroundColor;
        return bg === 'rgb(108, 92, 231)';
      });
    });
  }

  // Returns bounding boxes of all edges (useful to assert edges exist)
  async getEdgeData() {
    return this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('.edge')).map(e => {
        const rect = e.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        };
      });
    });
  }
}

test.describe('Directed Graph Visualization - FSM and interaction tests', () => {
  // Arrays to collect console and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // initialize collectors
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and errors
    page.on('console', (msg) => {
      const type = msg.type(); // e.g., 'log', 'error'
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', (err) => {
      // pageerror fires for uncaught exceptions
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, ensure we did not get any uncaught page errors.
    // This asserts that runtime errors (ReferenceError, SyntaxError, TypeError) did not occur unexpectedly.
    // Tests below also explicitly check that no runtime errors happened during complex interactions.
    expect(pageErrors.length, `Expected no uncaught page errors but found: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
  });

  test('S0_Idle: Initial render shows controls, nodes and edges', async ({ page }) => {
    // Validate initial idle state (S0_Idle): renderPage() was invoked and page shows expected elements.
    const gp = new GraphPage(page);
    await gp.goto();

    // Verify control buttons exist and are visible
    await expect(gp.animateBtn).toBeVisible();
    await expect(gp.animateBtn).toHaveText('Animate Flow');
    await expect(gp.rearrangeBtn).toBeVisible();
    await expect(gp.rearrangeBtn).toHaveText('Rearrange');

    // Verify nodes A-E are present
    const nodeIds = await gp.getNodeIds();
    expect(nodeIds.sort(), 'Expected nodes A-E to be present').toEqual(['A','B','C','D','E'].sort());

    // Verify number of edges created equals expected count (6)
    const edgeCount = await gp.getEdgeCount();
    expect(edgeCount, 'Expected 6 edges to be present after initial render').toBe(6);

    // Verify nodes are inside container bounds (simple sanity check)
    for (const id of nodeIds) {
      const pos = await gp.getNodePosition(id);
      expect(pos, `Node ${id} should have a position`).not.toBeNull();
      expect(pos.left).toBeGreaterThanOrEqual(0);
      expect(pos.top).toBeGreaterThanOrEqual(0);
      // Node should not overflow container (width/height checks)
      expect(pos.left + pos.width).toBeLessThanOrEqual((await gp.graphContainer.boundingBox()).width + 1);
      expect(pos.top + pos.height).toBeLessThanOrEqual((await gp.graphContainer.boundingBox()).height + 1);
    }

    // Ensure no console 'error' messages were produced during load
    expect(consoleErrors.length, `Console errors on load: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  test('S1_Animating: Clicking Animate Flow triggers animateFlow and visual pulses', async ({ page }) => {
    // This test validates transition S0_Idle -> S1_Animating via AnimateFlow_Click,
    // checks visual feedback (accent background and pulse class) and that nodes revert to primary color.
    const gp = new GraphPage(page);
    await gp.goto();

    // Capture initial state: all nodes should be primary color (or at least after initial timed animation finishes)
    // Important: the page triggers an initial animateFlow via setTimeout(animateFlow, 1000).
    // Wait up to 2s to allow the initial scheduled animation to finish before asserting a clean state.
    await page.waitForTimeout(2500);

    // Ensure nodes are back to primary color before we start our explicit click-based animation
    const allPrimaryBefore = await gp.allNodesPrimaryColor();
    expect(allPrimaryBefore, 'Expected all nodes to be in primary color before explicit animate click').toBe(true);

    // Click the animate button to start animation
    await gp.clickAnimate();

    // Wait up to 5s for a node to show the accent color while animating.
    // The animation highlights nodes one per second; we wait to observe the accent color at least once.
    const accentObserved = await page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll('.node'));
      return nodes.some(n => getComputedStyle(n).backgroundColor === 'rgb(253, 121, 168)');
    }, null, { timeout: 5000 }).then(() => true).catch(() => false);

    expect(accentObserved, 'Expected at least one node to display the accent background color during animation').toBe(true);

    // After waiting long enough for the animation path to finish, all nodes should return to primary
    // The flow path is <= 8 seconds in total (8 steps each 1s), ensure we wait sufficiently.
    await page.waitForTimeout(8500);

    const allPrimaryAfter = await gp.allNodesPrimaryColor();
    expect(allPrimaryAfter, 'Expected all nodes to return to primary color after animation completes').toBe(true);

    // Assert no uncaught runtime errors during animation
    // (The global afterEach will also assert pageErrors is empty)
    expect(consoleErrors.length, `Console errors during animateFlow: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  test('S2_Rearranging: Clicking Rearrange moves nodes and updates edges', async ({ page }) => {
    // Validates transition S0_Idle -> S2_Rearranging via Rearrange_Click,
    // ensures nodes reposition and edges are rebuilt/updated.
    const gp = new GraphPage(page);
    await gp.goto();

    // Wait briefly to allow initial animate to finish to avoid interfering scheduled animations
    await page.waitForTimeout(2500);

    // Capture initial positions
    const ids = await gp.getNodeIds();
    const beforePositions = {};
    for (const id of ids) {
      beforePositions[id] = await gp.getNodePosition(id);
    }

    // Click rearrange
    await gp.clickRearrange();

    // The rearrange function moves nodes with a 0.5s transition and rebuilds edges after 500ms.
    // Wait slightly longer to ensure both movement and edge rebuild complete.
    await page.waitForTimeout(800);

    // Capture after positions
    const afterPositions = {};
    for (const id of ids) {
      afterPositions[id] = await gp.getNodePosition(id);
      expect(afterPositions[id], `Expected node ${id} to still exist after rearrange`).not.toBeNull();
    }

    // Assert at least one node moved by comparing top/left positions
    const moved = ids.some(id => {
      const before = beforePositions[id];
      const after = afterPositions[id];
      // If either coordinate changed more than a small epsilon, consider it moved
      return Math.abs(before.left - after.left) > 1 || Math.abs(before.top - after.top) > 1;
    });
    expect(moved, 'Expected at least one node to change position after rearrange').toBe(true);

    // After rearrange edges should be rebuilt; expect same number of edge elements (6)
    const edgeCountAfter = await gp.getEdgeCount();
    expect(edgeCountAfter, 'Expected edges to be rebuilt after rearrange (6 edges)').toBe(6);

    // Ensure edges appear to have non-zero widths (links between nodes)
    const edgeData = await gp.getEdgeData();
    expect(edgeData.length).toBeGreaterThan(0);
    for (const e of edgeData) {
      expect(e.width).toBeGreaterThan(0);
    }

    // Ensure no console errors occurred during rearrange
    expect(consoleErrors.length, `Console errors during rearrange: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  test('Edge cases: Rapid interactions (animate + rearrange) should not throw runtime errors or break DOM', async ({ page }) => {
    // This test stresses the app by performing rapid interactions: animate then immediate rearrange,
    // multiple rapid rearrange clicks, and then verifies DOM consistency and absence of runtime errors.
    const gp = new GraphPage(page);
    await gp.goto();

    // Wait for initial scheduled animate to finish to reduce interference
    await page.waitForTimeout(1500);

    // Rapidly start animation and then immediately rearrange
    await gp.clickAnimate();
    await gp.clickRearrange();

    // Also perform several quick rearrange clicks to simulate rapid user interaction
    await gp.clickRearrange();
    await gp.clickRearrange();

    // Wait enough time for any transitions and edge rebuilds to complete
    await page.waitForTimeout(1200);

    // Validate DOM integrity: nodes should still exist and edges count should be 6
    const nodeCount = await gp.getNodeCount();
    expect(nodeCount).toBe(5);

    const edgeCount = await gp.getEdgeCount();
    expect(edgeCount).toBe(6);

    // Validate no uncaught page errors and no console 'error' messages
    expect(pageErrors.length, `Expected no uncaught page errors after rapid interactions but found: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console errors after rapid interactions but found: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  test('Observation: collect console and page errors during a full interaction cycle', async ({ page }) => {
    // This test explicitly demonstrates observing console messages and page errors across interactions.
    // It will not fail if no errors are present; instead it asserts that pageErrors is empty and logs summary info.
    const gp = new GraphPage(page);
    await gp.goto();

    // Perform a typical user cycle: animate -> wait -> rearrange -> wait
    await gp.clickAnimate();
    await page.waitForTimeout(3500);
    await gp.clickRearrange();
    await page.waitForTimeout(700);

    // We expect zero uncaught page errors. If errors occurred, the earlier afterEach would fail the test.
    expect(pageErrors.length).toBe(0);

    // For completeness check if any console messages with type 'error' were emitted.
    // If present, assert they are captured and fail the test because we don't expect runtime errors.
    if (consoleErrors.length > 0) {
      // If any errors exist, include them in the assertion message
      expect(consoleErrors.length, `Unexpected console errors were emitted: ${consoleErrors.join(' | ')}`).toBe(0);
    } else {
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0); // no-op assertion to mark observation
    }
  });
});