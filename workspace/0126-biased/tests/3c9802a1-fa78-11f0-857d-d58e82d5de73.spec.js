import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9802a1-fa78-11f0-857d-d58e82d5de73.html';

// Page object to encapsulate interactions and queries for the visualization page
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#start-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.tooltip = page.locator('#tooltip');
    this.nodes = index => page.locator(`#node-${index}`);
    this.edge = (u, v) => page.locator(`#edge-${u}-${v}`);
    this.allNodes = page.locator('.node');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for SVG and controls to be available
    await Promise.all([
      this.page.waitForSelector('#graph-svg'),
      this.page.waitForSelector('#start-btn'),
      this.page.waitForSelector('#reset-btn')
    ]);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  // Helper to check if any node currently has the class (active|sorted)
  async anyNodeHasClass(className) {
    return await this.page.evaluate((c) => {
      return Array.from(document.querySelectorAll('.node')).some(n => n.classList.contains(c));
    }, className);
  }

  // Count nodes with class
  async countNodesWithClass(className) {
    return await this.page.evaluate((c) => {
      return Array.from(document.querySelectorAll('.node')).filter(n => n.classList.contains(c)).length;
    }, className);
  }

  // Get attribute of start button
  async startAriaPressed() {
    return await this.startBtn.getAttribute('aria-pressed');
  }

  async startDisabled() {
    return await this.startBtn.isDisabled();
  }

  async resetDisabled() {
    return await this.resetBtn.isDisabled();
  }

  // Get tooltip text and visibility
  async tooltipText() {
    return await this.tooltip.textContent();
  }

  async tooltipVisible() {
    // Use aria-hidden attribute and computed opacity as checks
    const ariaHidden = await this.tooltip.getAttribute('aria-hidden');
    const styleOpacity = await this.page.evaluate(() => {
      const el = document.getElementById('tooltip');
      return window.getComputedStyle(el).opacity;
    });
    return ariaHidden === 'false' || styleOpacity > 0;
  }
}

test.describe('Topological Sort — Visualized Elegance (FSM validation)', () => {
  // Capture console errors and page errors across each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages; collect errors for assertion.
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // ignore instrumentation errors
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test ensure there were no unexpected runtime errors
    // We assert this at the end of the test run as well, but include here as a safeguard.
    expect(pageErrors, 'No uncaught page errors should occur during tests').toEqual([]);
    expect(consoleErrors, 'No console.error messages should appear during tests').toEqual([]);
  });

  test('Idle state on load: Verify initial UI and clearAll initialization', async ({ page }) => {
    // Validate initial Idle state conditions as per FSM S0_Idle entry actions: initGraph() and clearAll()
    const gp = new GraphPage(page);
    await gp.goto();

    // The start button should be enabled and aria-pressed false (clearAll sets these)
    expect(await gp.startDisabled()).toBe(false);
    expect(await gp.startAriaPressed()).toBe('false');

    // The reset button should be disabled per clearAll()
    expect(await gp.resetDisabled()).toBe(true);

    // No nodes should be marked active or sorted initially
    const anyActive = await gp.anyNodeHasClass('active');
    const anySorted = await gp.anyNodeHasClass('sorted');
    expect(anyActive).toBe(false);
    expect(anySorted).toBe(false);

    // There should be 7 nodes in the DOM (as per HTML)
    const nodeCount = await page.evaluate(() => document.querySelectorAll('.node').length);
    expect(nodeCount).toBe(7);

    // Also ensure the tooltip is hidden initially
    expect(await gp.tooltipVisible()).toBe(false);

    // Confirm no runtime errors were captured during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Start Animation transitions Idle -> Animating and shows progressive highlights', async ({ page }) => {
    // This test validates the StartAnimation event and S1_Animating entry behavior (runTopologicalSortAnimation).
    const gp = new GraphPage(page);
    await gp.goto();

    // Click start to begin animation
    await gp.clickStart();

    // After clicking start:
    // - startBtn should be disabled while animating
    // - startBtn aria-pressed should be true
    // - resetBtn should be enabled
    await expect(gp.startBtn).toBeDisabled();
    expect(await gp.startAriaPressed()).toBe('true');
    expect(await gp.resetDisabled()).toBe(false);

    // Wait for at least one node to become active (animated highlight)
    await page.waitForSelector('.node.active', { timeout: 5000 });

    // Verify tooltip becomes visible with a Processing message
    await page.waitForFunction(() => {
      const t = document.getElementById('tooltip');
      if (!t) return false;
      return t.textContent.includes('Processing node') && window.getComputedStyle(t).opacity !== '0';
    }, { timeout: 4000 });

    const tooltipText = await gp.tooltipText();
    expect(tooltipText).toMatch(/Processing node \d+/);

    // At least one edge from the starting node (0) should get the 'active' class during animation.
    // Either edge-0-1 or edge-0-2 should eventually have .active
    await page.waitForFunction(() => {
      const e1 = document.getElementById('edge-0-1');
      const e2 = document.getElementById('edge-0-2');
      return (e1 && e1.classList.contains('active')) || (e2 && e2.classList.contains('active'));
    }, { timeout: 6000 });

    // Eventually nodes are marked 'sorted' at the end of the animation; wait for at least one sorted node.
    // The final sorted styling is applied with staggered timeouts; allow enough timeout.
    await page.waitForFunction(() => {
      return document.querySelectorAll('.node.sorted').length > 0;
    }, { timeout: 12000 });

    // Confirm at least one node has sorted class
    const sortedCount = await gp.countNodesWithClass('sorted');
    expect(sortedCount).toBeGreaterThan(0);

    // Ensure no uncaught exceptions or console.error occurred during this flow
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Reset during animation transitions Animating -> Reset (clearAll) and returns to Idle', async ({ page }) => {
    // This test validates ResetVisualization event while animation is in progress, transitioning to S2_Reset
    const gp = new GraphPage(page);
    await gp.goto();

    // Start the animation
    await gp.clickStart();

    // Wait until reset becomes enabled (should happen early in runTopologicalSortAnimation)
    await page.waitForFunction(() => {
      const rb = document.getElementById('reset-btn');
      return rb && !rb.disabled;
    }, { timeout: 5000 });

    // Let the animation progress slightly so some active classes are applied
    await page.waitForTimeout(400);

    // Click reset to stop and clear
    await gp.clickReset();

    // After reset, clearAll should:
    // - remove 'active' & 'sorted' classes from nodes
    // - set startBtn.disabled = false and aria-pressed = 'false'
    // - set resetBtn.disabled = true
    await page.waitForFunction(() => {
      const start = document.getElementById('start-btn');
      const reset = document.getElementById('reset-btn');
      const anyActive = Array.from(document.querySelectorAll('.node')).some(n => n.classList.contains('active'));
      const anySorted = Array.from(document.querySelectorAll('.node')).some(n => n.classList.contains('sorted'));
      return start && !start.disabled && start.getAttribute('aria-pressed') === 'false' && reset && reset.disabled && !anyActive && !anySorted;
    }, { timeout: 3000 });

    // Double-check conditions
    expect(await gp.startDisabled()).toBe(false);
    expect(await gp.startAriaPressed()).toBe('false');
    expect(await gp.resetDisabled()).toBe(true);
    expect(await gp.anyNodeHasClass('active')).toBe(false);
    expect(await gp.anyNodeHasClass('sorted')).toBe(false);

    // Tooltip should be hidden after reset
    expect(await gp.tooltipVisible()).toBe(false);

    // Ensure no runtime errors were raised by the reset action
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Start after Reset transitions Reset -> Idle -> Animating and works again', async ({ page }) => {
    // This validates the FSM transition S2_Reset -> S0_Idle on Reset completion, then StartAnimation again to S1_Animating
    const gp = new GraphPage(page);
    await gp.goto();

    // Start animation then wait for reset to enable and click reset
    await gp.clickStart();
    await page.waitForFunction(() => !document.getElementById('reset-btn').disabled, { timeout: 5000 });
    await gp.clickReset();

    // Confirm we are back to Idle (start enabled, reset disabled)
    expect(await gp.startDisabled()).toBe(false);
    expect(await gp.resetDisabled()).toBe(true);

    // Click start again to ensure animation can be re-run
    await gp.clickStart();

    // Confirm animation started again (start disabled, aria-pressed true)
    await expect(gp.startBtn).toBeDisabled();
    expect(await gp.startAriaPressed()).toBe('true');

    // Wait for at least one active node and tooltip again, demonstrating re-run works
    await page.waitForSelector('.node.active', { timeout: 5000 });
    await page.waitForFunction(() => {
      const t = document.getElementById('tooltip');
      if (!t) return false;
      return t.textContent.includes('Processing node') && window.getComputedStyle(t).opacity !== '0';
    }, { timeout: 4000 });

    // Final sanity: no uncaught errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: Reset is disabled when Idle and should not trigger state change', async ({ page }) => {
    // Validate edge case of clicking Reset when it is disabled (FSM expects Reset only valid during Animating)
    const gp = new GraphPage(page);
    await gp.goto();

    // Reset should be disabled in Idle - clicking should not change anything (we will not force-click)
    expect(await gp.resetDisabled()).toBe(true);

    // Snapshot state before attempted interaction
    const startDisabledBefore = await gp.startDisabled();
    const ariaPressedBefore = await gp.startAriaPressed();
    const activeBefore = await gp.anyNodeHasClass('active');
    const sortedBefore = await gp.anyNodeHasClass('sorted');

    // Do not force click to respect disabled semantics; ensure inertness
    // Attempting to click disabled element would be blocked by user agent; we assert disabled property.
    expect(startDisabledBefore).toBe(false);
    expect(ariaPressedBefore).toBe('false');
    expect(activeBefore).toBe(false);
    expect(sortedBefore).toBe(false);

    // No errors should have been produced
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: verify no uncaught exceptions or console.error across typical flows', async ({ page }) => {
    // This test runs a typical scenario: start -> wait part -> reset -> start -> finish some portion
    // and asserts that no runtime errors were exposed to console or as page errors.
    const gp = new GraphPage(page);
    await gp.goto();

    // Start animation
    await gp.clickStart();
    // Wait a short bit for activity
    await page.waitForTimeout(500);

    // Click reset
    await page.waitForFunction(() => !document.getElementById('reset-btn').disabled, { timeout: 5000 });
    await gp.clickReset();

    // Start again
    await gp.clickStart();

    // Wait for some activity and then stop test
    await page.waitForSelector('.node.active', { timeout: 5000 });

    // Assert no uncaught exceptions were seen
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  }, { timeout: 45000 }); // Give extended time for animations and waits

});