import { test, expect } from '@playwright/test';

// Test file for Application ID: 3c9877d1-fa78-11f0-857d-d58e82d5de73
// URL served at: http://127.0.0.1:5500/workspace/0126-biased/html/3c9877d1-fa78-11f0-857d-d58e82d5de73.html
// This suite validates the FSM states and transitions, visual DOM changes, and observes console/page errors.
// Notes: We do not patch page code. We let runtime errors happen naturally and assert about their presence/absence.

test.describe('Branch and Bound Visualization - FSM and UI E2E', () => {
  // Increase timeout for tests that wait for the full animation sequence (~8-10s)
  test.setTimeout(40000);

  // Page object wrapper for repeated interactions and assertions
  class VisualizerPage {
    constructor(page) {
      this.page = page;
      this.consoleErrors = [];
      this.pageErrors = [];
    }

    // Instrument console/pageerror listeners to collect errors
    async attachErrorListeners() {
      this.page.on('console', (msg) => {
        if (msg.type() === 'error') {
          this.consoleErrors.push(msg.text());
        }
      });
      this.page.on('pageerror', (err) => {
        this.pageErrors.push(err.message);
      });
    }

    async goto() {
      await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/3c9877d1-fa78-11f0-857d-d58e82d5de73.html', { waitUntil: 'domcontentloaded' });
    }

    start() {
      return this.page.click('#btn-start');
    }

    reset() {
      return this.page.click('#btn-reset');
    }

    // Helper queries
    async isButtonDisabled(selector) {
      return this.page.$eval(selector, (el) => el.disabled === true);
    }

    async getButtonAriaPressed(selector) {
      return this.page.$eval(selector, (el) => el.getAttribute('aria-pressed'));
    }

    async nodeCount() {
      return this.page.$$eval('.node', (els) => els.length);
    }

    async visibleNodeIds() {
      return this.page.$$eval('.node.show', (els) => els.map((n) => n.getAttribute('data-id')));
    }

    async isNodeShown(nodeId) {
      return this.page.$eval(`.node[data-id="${nodeId}"]`, (el) => el.classList.contains('show'));
    }

    async connectorCount() {
      return this.page.$eval('#connectors', (svg) => svg.children.length);
    }

    async boundNodesOpacity() {
      return this.page.$$eval('.node.bound', (els) => els.map((n) => getComputedStyle(n).opacity));
    }

    async fadedConnectorsCount() {
      return this.page.$$eval('#connectors .connector.faded', (els) => els.length);
    }

    async waitForAnimationComplete(timeout = 30000) {
      // The application sets both buttons enabled at the end of the sequence.
      await this.page.waitForFunction(() => {
        const b1 = document.getElementById('btn-start');
        const b2 = document.getElementById('btn-reset');
        return b1 && b2 && b1.disabled === false && b2.disabled === false;
      }, { timeout });
    }

    async waitForRootShown(timeout = 5000) {
      await this.page.waitForSelector('.node[data-id="N1"].show', { timeout });
    }

    // Clear listeners - in Playwright we won't explicitly remove handlers, rely on new page each test
  }

  test.beforeEach(async ({ page }) => {
    // Intentionally left blank: each test creates its own VisualizerPage and instrumentation
  });

  // ---------- Test: Initial State (S0_Idle) ----------
  test('S0_Idle: Initial page load builds base tree and buttons initial state', async ({ page }) => {
    const viz = new VisualizerPage(page);
    await viz.attachErrorListeners();

    // Load the page
    await viz.goto();

    // Validate FSM initial evidence: buildTreeBase() should have built nodes (nodes exist but not shown)
    const count = await viz.nodeCount();
    // There should be 7 nodes per implementation
    expect(count).toBe(7);

    // None should have class 'show' initially (hidden via CSS)
    const shown = await viz.visibleNodeIds();
    expect(shown.length).toBe(0);

    // Buttons: Start enabled, Reset disabled (evidence in FSM S0_Idle)
    expect(await viz.isButtonDisabled('#btn-start')).toBe(false);
    expect(await viz.isButtonDisabled('#btn-reset')).toBe(true);

    // Confirm aria-pressed attributes default to "false"
    expect(await viz.getButtonAriaPressed('#btn-start')).toBe('false');
    expect(await viz.getButtonAriaPressed('#btn-reset')).toBe('false');

    // No console or page errors at initial load
    expect(viz.consoleErrors, `Console errors: ${viz.consoleErrors.join('\n')}`).toHaveLength(0);
    expect(viz.pageErrors, `Page errors: ${viz.pageErrors.join('\n')}`).toHaveLength(0);
  });

  // ---------- Test: StartVisualization -> S1_Animating ----------
  test('StartVisualization transition: clicking Start disables Start and begins animation (S1_Animating)', async ({ page }) => {
    const viz = new VisualizerPage(page);
    await viz.attachErrorListeners();
    await viz.goto();

    // Click Start to trigger runAnimation()
    await viz.start();

    // Immediately, Start should become disabled and Reset should be enabled (entry evidence for S1_Animating)
    // We allow a small time for the click handler to run synchronously
    await page.waitForTimeout(50);
    expect(await viz.isButtonDisabled('#btn-start')).toBe(true);
    expect(await viz.isButtonDisabled('#btn-reset')).toBe(false);

    // During animating, the root node (N1) should show
    await viz.waitForRootShown(2000);
    expect(await viz.isNodeShown('N1')).toBe(true);

    // Confirm aria-pressed changes on Start button as part of runAnimation
    expect(await viz.getButtonAriaPressed('#btn-start')).toBe('true');

    // No uncaught console or page errors during initial animation trigger
    expect(viz.consoleErrors, `Console errors after start: ${viz.consoleErrors.join('\n')}`).toHaveLength(0);
    expect(viz.pageErrors, `Page errors after start: ${viz.pageErrors.join('\n')}`).toHaveLength(0);
  });

  // ---------- Test: Full animation completes (S1_Animating -> S2_Completed) ----------
  test('Animation completes: after sequence both Start and Reset enabled (S2_Completed) and final visual state applied', async ({ page }) => {
    const viz = new VisualizerPage(page);
    await viz.attachErrorListeners();
    await viz.goto();

    // Start animation
    await viz.start();

    // Wait for the app to signal completion by re-enabling both buttons
    await viz.waitForAnimationComplete(25000); // generous timeout

    // Final FSM: btnStart.disabled = false, btnReset.disabled = false
    expect(await viz.isButtonDisabled('#btn-start')).toBe(false);
    expect(await viz.isButtonDisabled('#btn-reset')).toBe(false);

    // aria-pressed should be false for both (runAnimation sets these on finish)
    expect(await viz.getButtonAriaPressed('#btn-start')).toBe('false');
    expect(await viz.getButtonAriaPressed('#btn-reset')).toBe('false');

    // Many nodes should be visible (most/all); at least the root and several leaves should be shown.
    const shownIds = await viz.visibleNodeIds();
    expect(shownIds.length).toBeGreaterThanOrEqual(7); // after entire sequence, all 7 nodes are shown

    // Bound nodes should have been dimmed in final step: check their computed opacity is reduced (approx 0.45)
    const boundOpacities = await viz.boundNodesOpacity();
    // There are 4 bound nodes in the dataset (N3,N5,N6 plus maybe others depending on class assignments)
    // Each opacity should be <= 1 and at least one should be less than 1 (dimmed)
    const anyDimmed = boundOpacities.some(op => parseFloat(op) < 1);
    expect(anyDimmed).toBe(true);

    // Connectors: there should be several <line> elements representing edges
    const connCount = await viz.connectorCount();
    expect(connCount).toBeGreaterThanOrEqual(6); // several edges drawn

    // Some connectors should have faded class applied during final dimming
    const fadedCount = await viz.fadedConnectorsCount();
    // At least one faded connector expected (pruned bound edges)
    expect(fadedCount).toBeGreaterThanOrEqual(1);

    // Ensure no console or page errors occurred during the long-running animation
    expect(viz.consoleErrors, `Console errors during animation: ${viz.consoleErrors.join('\n')}`).toHaveLength(0);
    expect(viz.pageErrors, `Page errors during animation: ${viz.pageErrors.join('\n')}`).toHaveLength(0);
  });

  // ---------- Test: ResetVisualization from S2_Completed -> S0_Idle ----------
  test('ResetVisualization: clicking Reset after completion returns to Idle (S0_Idle) and clears visual states', async ({ page }) => {
    const viz = new VisualizerPage(page);
    await viz.attachErrorListeners();
    await viz.goto();

    // Start and wait to completion
    await viz.start();
    await viz.waitForAnimationComplete(25000);

    // Click Reset to return to Idle state
    await viz.reset();

    // After reset, Start should be enabled and Reset disabled
    await page.waitForTimeout(50);
    expect(await viz.isButtonDisabled('#btn-start')).toBe(false);
    expect(await viz.isButtonDisabled('#btn-reset')).toBe(true);

    // Nodes are present but not visible (no 'show' class)
    const shownIds = await viz.visibleNodeIds();
    expect(shownIds.length).toBe(0);

    // Connectors should have been cleared
    const connCount = await viz.connectorCount();
    expect(connCount).toBe(0);

    // No console/page errors during reset transition
    expect(viz.consoleErrors, `Console errors during reset: ${viz.consoleErrors.join('\n')}`).toHaveLength(0);
    expect(viz.pageErrors, `Page errors during reset: ${viz.pageErrors.join('\n')}`).toHaveLength(0);
  });

  // ---------- Edge case: Clicking Start button while it's disabled should do nothing and not throw ----------
  test('Edge case: double-clicking Start (second click while disabled) should be ignored and not error', async ({ page }) => {
    const viz = new VisualizerPage(page);
    await viz.attachErrorListeners();
    await viz.goto();

    // Click Start to begin animation
    await viz.start();

    // Immediately attempt to click Start again (should be ignored by handler because it checks disabled flag)
    // We perform both clicks rapidly to simulate user double-click
    await page.click('#btn-start').catch(() => {}); // may be ignored but do not fail test if browser blocks it

    // Wait briefly to let any unintended effects occur
    await page.waitForTimeout(500);

    // Ensure still animating (Start disabled)
    expect(await viz.isButtonDisabled('#btn-start')).toBe(true);

    // Ensure no console or page errors from double click
    expect(viz.consoleErrors, `Console errors after double-start: ${viz.consoleErrors.join('\n')}`).toHaveLength(0);
    expect(viz.pageErrors, `Page errors after double-start: ${viz.pageErrors.join('\n')}`).toHaveLength(0);

    // Cleanup: wait for completion to avoid interfering with other tests
    await viz.waitForAnimationComplete(20000);
  });

  // ---------- Edge case: Reset mid-animation should stop further steps ----------
  test('Edge case: resetting mid-animation should halt sequence and clear connectors (ResetVisualization from S1_Animating)', async ({ page }) => {
    const viz = new VisualizerPage(page);
    await viz.attachErrorListeners();
    await viz.goto();

    // Start animation
    await viz.start();

    // Wait for a little while so some connectors/nodes are created (e.g. after step 2)
    await page.waitForTimeout(1600); // should allow at least first two steps to run

    // Capture number of connectors at this moment
    const beforeResetConnectors = await viz.connectorCount();
    expect(beforeResetConnectors).toBeGreaterThanOrEqual(1);

    // Now click Reset to stop animation
    await viz.reset();

    // After reset, connectors should be cleared
    await page.waitForTimeout(100); // small wait for reset to take effect
    const afterResetConnectors = await viz.connectorCount();
    expect(afterResetConnectors).toBe(0);

    // Ensure Start is enabled and Reset disabled (back to Idle)
    expect(await viz.isButtonDisabled('#btn-start')).toBe(false);
    expect(await viz.isButtonDisabled('#btn-reset')).toBe(true);

    // Wait for a period longer than a normal animation step and assert no new connectors appear (animation halted)
    await page.waitForTimeout(1200);
    const finalConnectors = await viz.connectorCount();
    expect(finalConnectors).toBe(0);

    // Verify no console/page errors during mid-animation reset
    expect(viz.consoleErrors, `Console errors during mid-reset: ${viz.consoleErrors.join('\n')}`).toHaveLength(0);
    expect(viz.pageErrors, `Page errors during mid-reset: ${viz.pageErrors.join('\n')}`).toHaveLength(0);
  });

  // ---------- Edge case: Clicking Reset when it's disabled should be a no-op and not throw ----------
  test('Edge case: clicking Reset while disabled (in Idle) should not error and not alter state', async ({ page }) => {
    const viz = new VisualizerPage(page);
    await viz.attachErrorListeners();
    await viz.goto();

    // Ensure Reset is disabled initially
    expect(await viz.isButtonDisabled('#btn-reset')).toBe(true);

    // Attempt to click Reset while disabled
    // In many browsers clicking a disabled button triggers no DOM event; still we attempt to click and catch any errors
    await page.click('#btn-reset').catch(() => {});

    // Validate state unchanged: Start still enabled, Reset disabled, nodes remain hidden
    expect(await viz.isButtonDisabled('#btn-start')).toBe(false);
    expect(await viz.isButtonDisabled('#btn-reset')).toBe(true);
    const shown = await viz.visibleNodeIds();
    expect(shown.length).toBe(0);

    // No console/page errors
    expect(viz.consoleErrors, `Console errors after clicking disabled reset: ${viz.consoleErrors.join('\n')}`).toHaveLength(0);
    expect(viz.pageErrors, `Page errors after clicking disabled reset: ${viz.pageErrors.join('\n')}`).toHaveLength(0);
  });

  // Final safety test: Ensure that loading the page does not produce any unexpected runtime errors (aggregated)
  test('Sanity: page should not emit uncaught exceptions or console errors on idle load + short interaction', async ({ page }) => {
    const viz = new VisualizerPage(page);
    await viz.attachErrorListeners();
    await viz.goto();

    // Perform a short interaction: focus the tree container to exercise focus event handlers
    await page.focus('#tree-container');

    // Short wait
    await page.waitForTimeout(200);

    // There should be no uncaught page errors or console error messages
    expect(viz.consoleErrors, `Console errors found: ${viz.consoleErrors.join('\n')}`).toHaveLength(0);
    expect(viz.pageErrors, `Page errors found: ${viz.pageErrors.join('\n')}`).toHaveLength(0);
  });
});