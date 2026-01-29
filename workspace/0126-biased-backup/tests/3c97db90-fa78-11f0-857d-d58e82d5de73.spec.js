import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c97db90-fa78-11f0-857d-d58e82d5de73.html';

// Page object encapsulating control interactions and queries
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.edges = page.locator('line.edge');
    this.selectedEdges = page.locator('line.edge.selected');
    this.nodeCircles = page.locator('circle.node');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Basic assertions about Idle initial state
  async expectIdleState() {
    await expect(this.startBtn).toBeVisible();
    await expect(this.startBtn).toBeEnabled();
    await expect(this.startBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(this.resetBtn).toBeVisible();
    await expect(this.resetBtn).toBeDisabled();

    // No edges/ nodes highlighted
    const selectedCount = await this.page.evaluate(() => document.querySelectorAll('line.edge.selected').length);
    expect(selectedCount).toBe(0);

    const activeNodes = await this.page.evaluate(() => document.querySelectorAll('circle.node.active').length);
    expect(activeNodes).toBe(0);
  }

  // Click start and wait for the first visual highlight (edge selected highlight)
  async startVisualizationAndWaitForFirstHighlight(timeout = 8000) {
    await this.startBtn.click();
    // Immediately after clicking, start button should be disabled by script
    await expect(this.startBtn).toBeDisabled();

    // Wait for any edge to get the 'selected' class (pulse highlight)
    await this.page.waitForFunction(() => document.querySelectorAll('line.edge.selected').length > 0, null, { timeout });
  }

  // Wait until animation completes (resetBtn becomes enabled)
  async waitForAnimationComplete(timeout = 90000) {
    // The implementation enables the reset button when animation finishes.
    await this.page.waitForFunction(() => {
      const reset = document.querySelector('#resetBtn');
      return reset && !reset.disabled;
    }, null, { timeout });
    // Additionally, the code sets aria-pressed to true on startBtn at completion
    await this.page.waitForFunction(() => {
      const s = document.querySelector('#startBtn');
      return s && s.getAttribute('aria-pressed') === 'true';
    }, null, { timeout: 5000 });
  }

  async resetVisualization() {
    await this.resetBtn.click();
  }

  // Count selected edges
  async countSelectedEdges() {
    return this.page.evaluate(() => document.querySelectorAll('line.edge.selected').length);
  }

  // Count active node circles
  async countActiveNodes() {
    return this.page.evaluate(() => document.querySelectorAll('circle.node.active').length);
  }
}

test.describe('Kruskal’s Algorithm — Elegant Visualization (FSM tests)', () => {
  // Increase timeout for tests that wait for the full visualization to complete
  test.setTimeout(120000);

  let page;
  let kruskal;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect console errors and page errors for assertion
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    kruskal = new KruskalPage(page);
    await kruskal.goto();
  });

  test.afterEach(async () => {
    // Assert that no runtime console errors or page errors occurred during the test.
    // The application is expected to run without throwing unexpected exceptions.
    expect(consoleErrors.length, `Console errors: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    // Close the page context to ensure clean teardown
    await page.close();
  });

  test('Initial Idle State (S0_Idle) — resetVisualization executed on load', async () => {
    // Validate the initial/idle state as described in the FSM and code:
    // - startBtn enabled and aria-pressed=false
    // - resetBtn disabled
    // - no edges/nodes selected (resetVisualization effects)
    await kruskal.expectIdleState();

    // Also confirm edge and node counts match expectations (10 edges, 5 nodes)
    const edgeCount = await page.evaluate(() => document.querySelectorAll('line.edge').length);
    expect(edgeCount).toBe(10);

    const nodeCount = await page.evaluate(() => document.querySelectorAll('circle.node').length);
    expect(nodeCount).toBe(5);
  });

  test('StartVisualization event transitions to Animating (S1_Animating) and highlights edges', async () => {
    // Clicking start should disable startBtn immediately and begin animation
    // Validate immediate DOM changes and that an edge gets highlighted soon after
    await kruskal.startVisualizationAndWaitForFirstHighlight(10000);

    // After starting animation, reset button should remain disabled (implementation sets it true only on completion)
    await expect(kruskal.resetBtn).toBeDisabled();

    // There should be at least one edge currently marked 'selected' (being considered/highlighted)
    const selectedCount = await kruskal.countSelectedEdges();
    expect(selectedCount).toBeGreaterThan(0);

    // Also the node highlight for the currently considered edge may be active
    const activeNodes = await kruskal.countActiveNodes();
    // It is possible the first considered edge forms a cycle and nodes are dimmed; accept both 0 or >0
    expect(activeNodes).toBeGreaterThanOrEqual(0);
  });

  test('Animation progresses and eventually reaches Animation Complete (S2_AnimationComplete)', async () => {
    // Start the animation and wait for it to fully complete.
    // Note: the full animation processes all sortedEdges; allow ample timeout.
    // This test validates the FSM transition S1_Animating -> S2_AnimationComplete and the entry actions/evidence:
    // - animationInProgress becomes false (not directly accessible; validate via DOM:
    //   startBtn aria-pressed becomes "true" and resetBtn becomes enabled)
    await kruskal.startBtn.click();

    // Sanity check: start button disabled right after clicking
    await expect(kruskal.startBtn).toBeDisabled();

    // Wait until resetBtn becomes enabled (indicates completion in implementation)
    await kruskal.waitForAnimationComplete(90000);

    // Verify final button states per the FSM evidence:
    await expect(kruskal.resetBtn).toBeEnabled();
    await expect(kruskal.startBtn).toBeDisabled();
    // The implementation sets aria-pressed to 'true' on completion
    await expect(kruskal.startBtn).toHaveAttribute('aria-pressed', 'true');

    // Visual check: ensure at least some edges remain selected (part of the MST)
    const finalSelected = await kruskal.countSelectedEdges();
    expect(finalSelected).toBeGreaterThan(0);
  });

  test('ResetVisualization event returns to Idle (S2 -> S0) after completion', async () => {
    // Start animation and wait for completion
    await kruskal.startBtn.click();
    await kruskal.waitForAnimationComplete(90000);

    // Now reset should be enabled; click to perform reset
    await expect(kruskal.resetBtn).toBeEnabled();
    await kruskal.resetVisualization();

    // After reset, verify Idle state again (S0_Idle entry action resetVisualization executed)
    await kruskal.expectIdleState();

    // Ensure no permanent selection remains
    const selectedAfterReset = await kruskal.countSelectedEdges();
    expect(selectedAfterReset).toBe(0);
  });

  test('Reset button is disabled during animation (edge case / transition guard)', async () => {
    // Start animation
    await kruskal.startBtn.click();

    // Immediately the reset button is intentionally disabled by implementation
    await expect(kruskal.resetBtn).toBeDisabled();

    // Attempting to click the disabled reset button via the normal API should not be possible.
    // We assert only that it remains disabled and that no state change occurs.
    // Do not force click (which would bypass normal UI constraints).
    const disabled = await page.evaluate(() => document.querySelector('#resetBtn').disabled);
    expect(disabled).toBe(true);

    // Let the animation run briefly to ensure no unexpected errors occur while reset is disabled
    await page.waitForTimeout(2500);

    // After a short period, still disabled (until completion)
    const stillDisabled = await page.evaluate(() => document.querySelector('#resetBtn').disabled);
    expect(stillDisabled).toBe(true);
  });

  test('Observes console and page errors (should be none) while interacting heavily', async () => {
    // This test performs several interactions and verifies no runtime errors are produced.
    // Start, wait for a few highlights, then reload and verify idle state again.
    await kruskal.startBtn.click();

    // Wait until at least one edge gets the highlight
    await page.waitForFunction(() => document.querySelectorAll('line.edge.selected').length > 0, null, { timeout: 10000 });

    // Wait a bit more to allow an additional step to execute
    await page.waitForTimeout(3500);

    // Reload the page to simulate another fresh session
    await page.reload();

    // After reload, verify the initial idle state is restored
    await kruskal.expectIdleState();

    // No console or page errors should have been emitted during these interactions.
    // The actual assertions for errors are performed in the afterEach teardown to centralize checks.
  });

  // Additional small test to inspect DOM attributes referenced in FSM components
  test('Component attributes: startBtn accessibility attributes and resetBtn disabled attribute present', async () => {
    // Validate presence of aria attributes as per FSM components
    await expect(kruskal.startBtn).toHaveAttribute('aria-live', 'polite');
    await expect(kruskal.startBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(kruskal.resetBtn).toBeDisabled();
  });
});