import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9bfa40-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page object for the Decision Tree visualization page.
 * Provides helpers for interacting with and inspecting the DOM in tests.
 */
class DecisionTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    // Load the exact page as provided by the specification.
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure the main container is present before continuing tests.
    await this.page.waitForSelector('#tree-container');
  }

  async clickHighlight() {
    await this.page.click('#btn-highlight');
  }

  async clickReset() {
    await this.page.click('#btn-reset');
  }

  async edgeHasHighlight(edgeId) {
    return this.page.$eval(`#${edgeId}`, el => el.classList.contains('path-highlight'));
  }

  async getNodeFilterStyle(nodeGroupId) {
    // Return the computed inline style.filter on the .node shape inside the group
    // (the app uses inline style changes like `shape.style.filter = '...'`).
    return this.page.$eval(`#${nodeGroupId} .node`, el => el.style.filter || '');
  }

  async focusNode(nodeGroupId) {
    await this.page.focus(`#${nodeGroupId}`);
  }

  async blurNode(nodeGroupId) {
    // Attempt to blur by focusing another focusable control; natural blur should occur.
    // If that fails for some reason, fall back to calling blur() in page context.
    try {
      // Focus the reset button which is present and focusable
      await this.page.focus('#btn-reset');
      // tiny wait to allow event handlers to run
      await this.page.waitForTimeout(50);
    } catch {
      // fallback: use evaluate to call blur() on the element
      await this.page.$eval(`#${nodeGroupId}`, el => el.blur());
      await this.page.waitForTimeout(20);
    }
  }

  async getAllEdgeIds() {
    return this.page.$$eval('.edge', els => els.map(e => e.id).filter(Boolean));
  }

  async getAllNodeGroupIds() {
    return this.page.$$eval('.node-group', els => els.map(g => g.id).filter(Boolean));
  }
}

test.describe('Decision Tree Visual Concept (FSM driven interactions)', () => {
  // Arrays to capture runtime errors and console messages for each test
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // reset collectors
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    // capture page errors (unhandled exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // capture console messages, including console.error
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });
  });

  test('Initial state: Idle (S0_Idle) - no highlights present', async ({ page }) => {
    // Validate initial Idle state: no edges have highlight class and node shapes have no inline filter
    const dt = new DecisionTreePage(page);
    await dt.goto();

    // Verify edges are present
    const edges = await dt.getAllEdgeIds();
    expect(edges.length).toBeGreaterThanOrEqual(6); // expect at least the 6 edges declared

    // None of the edges should have the highlight class in Idle state
    for (const id of edges) {
      const has = await dt.edgeHasHighlight(id);
      expect(has).toBe(false);
    }

    // All node shapes should have empty inline filter initially
    const nodes = await dt.getAllNodeGroupIds();
    expect(nodes.length).toBeGreaterThanOrEqual(7); // root + decision + leaves

    for (const nodeId of nodes) {
      const filter = await dt.getNodeFilterStyle(nodeId);
      expect(filter).toBe('', `Expected node ${nodeId} to have no inline filter in Idle state`);
    }

    // Assert there were no runtime pageerrors and no console.error messages during initial load.
    // (We capture and assert they are empty so tests fail if there are unexpected runtime errors.)
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Transition: HighlightExamplePath (S0_Idle -> S1_HighlightedPath) - highlights edges and nodes', async ({ page }) => {
    // This test verifies that clicking the highlight button results in the expected DOM changes:
    // - edges e1 and e4 should receive the 'path-highlight' class
    // - nodes node-root, node-left, node-left-false should receive an inline drop-shadow filter
    const dt = new DecisionTreePage(page);
    await dt.goto();

    // Sanity check initial conditions
    expect(await dt.edgeHasHighlight('e1')).toBe(false);
    expect(await dt.edgeHasHighlight('e4')).toBe(false);
    expect(await dt.getNodeFilterStyle('node-root')).toBe('');

    // Perform the event: click highlight button
    await dt.clickHighlight();

    // Small wait to allow transitions and DOM updates to apply
    await page.waitForTimeout(100);

    // Verify highlighted edges as specified by the FSM / script
    expect(await dt.edgeHasHighlight('e1')).toBe(true);
    expect(await dt.edgeHasHighlight('e4')).toBe(true);

    // Verify other edges are not highlighted
    const otherEdges = (await dt.getAllEdgeIds()).filter(id => !['e1', 'e4'].includes(id));
    for (const id of otherEdges) {
      expect(await dt.edgeHasHighlight(id)).toBe(false);
    }

    // Verify the nodes indicated by the FSM are visually highlighted via inline styles
    const rootFilter = await dt.getNodeFilterStyle('node-root');
    const leftFilter = await dt.getNodeFilterStyle('node-left');
    const leftFalseFilter = await dt.getNodeFilterStyle('node-left-false');

    expect(rootFilter).toContain('drop-shadow', 'root node should have drop-shadow after highlight');
    expect(leftFilter).toContain('drop-shadow', 'left node should have drop-shadow after highlight');
    expect(leftFalseFilter).toContain('drop-shadow', 'left-false (leaf) node should have drop-shadow after highlight');

    // Ensure highlighting happened via functions (we cannot access functions directly),
    // but the observable effects are present as evidence of highlightExamplePath() execution.

    // Validate that no unexpected page errors were emitted during the highlight action
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Transition: ResetHighlighting (S1_HighlightedPath -> S0_Idle) - removes highlights', async ({ page }) => {
    // This test covers the exit action resetHighlight() by:
    // - triggering highlight first
    // - then clicking reset and verifying highlights are removed
    const dt = new DecisionTreePage(page);
    await dt.goto();

    // Trigger highlight
    await dt.clickHighlight();
    await page.waitForTimeout(80);

    // Confirm precondition: highlight exists
    expect(await dt.edgeHasHighlight('e1')).toBe(true);
    expect((await dt.getNodeFilterStyle('node-root')).length).toBeGreaterThan(0);

    // Click reset to perform the exit action
    await dt.clickReset();
    await page.waitForTimeout(80);

    // After reset, no edges should have the highlight class
    const edges = await dt.getAllEdgeIds();
    for (const id of edges) {
      expect(await dt.edgeHasHighlight(id)).toBe(false);
    }

    // Node inline filters should be cleared
    const nodes = await dt.getAllNodeGroupIds();
    for (const nodeId of nodes) {
      const filter = await dt.getNodeFilterStyle(nodeId);
      expect(filter).toBe('', `Expected node ${nodeId} to have no inline filter after reset`);
    }

    // Validate no unexpected runtime errors
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Node focus and blur events (NodeFocus / NodeBlur) - focus highlights node, blur clears it (S0_Idle -> S0_Idle)', async ({ page }) => {
    // This test validates that focusing on a .node-group applies a focus-style filter
    // and blurring removes it. It also ensures focusing does not accidentally toggle path-highlight classes.
    const dt = new DecisionTreePage(page);
    await dt.goto();

    // Ensure starting state: no edges highlighted
    for (const e of await dt.getAllEdgeIds()) {
      expect(await dt.edgeHasHighlight(e)).toBe(false);
    }

    // Focus root node
    await dt.focusNode('node-root');
    await page.waitForTimeout(60);

    // The focused node should have the focus filter (the script sets a drop shadow of 14px)
    const rootFilter = await dt.getNodeFilterStyle('node-root');
    expect(rootFilter).toContain('drop-shadow', 'Focused node should get a drop-shadow filter');

    // Focusing a node should not add path-highlight to edges (focus is a separate interaction)
    for (const e of await dt.getAllEdgeIds()) {
      expect(await dt.edgeHasHighlight(e)).toBe(false);
    }

    // Now focus another node to cause blur of root (natural blur)
    await dt.focusNode('node-left');
    await page.waitForTimeout(60);

    // The root node should have cleared its inline filter after blur
    const rootFilterAfterBlur = await dt.getNodeFilterStyle('node-root');
    expect(rootFilterAfterBlur).toBe('', 'Root node filter should be cleared after blur');

    // The newly focused node should have the focus filter
    const leftFilter = await dt.getNodeFilterStyle('node-left');
    expect(leftFilter).toContain('drop-shadow', 'Newly focused node should have drop-shadow filter');

    // Clean up: blur by focusing a control
    await dt.blurNode('node-left');
    await page.waitForTimeout(40);
    const leftFilterAfterBlur = await dt.getNodeFilterStyle('node-left');
    expect(leftFilterAfterBlur).toBe('', 'Left node filter should be cleared after blur');

    // No runtime errors from focus/blur handlers
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Edge cases: repeated and rapid interactions are idempotent and stable', async ({ page }) => {
    // This test exercises some edge cases:
    // - clicking highlight repeatedly should not throw and should remain in Highlighted state
    // - clicking reset repeatedly should not throw and should remain in Idle state
    // - rapid toggling highlight/reset should leave the DOM in a consistent state
    const dt = new DecisionTreePage(page);
    await dt.goto();

    // Rapidly click highlight multiple times
    await Promise.all([
      dt.clickHighlight(),
      dt.clickHighlight(),
      dt.clickHighlight()
    ]);
    // wait for event handlers to settle
    await page.waitForTimeout(120);

    // The expected edges should be highlighted
    expect(await dt.edgeHasHighlight('e1')).toBe(true);
    expect(await dt.edgeHasHighlight('e4')).toBe(true);

    // Rapidly click reset multiple times
    await Promise.all([
      dt.clickReset(),
      dt.clickReset(),
      dt.clickReset()
    ]);
    await page.waitForTimeout(80);

    // After resets, no edges should be highlighted and node filters cleared
    for (const id of await dt.getAllEdgeIds()) {
      expect(await dt.edgeHasHighlight(id)).toBe(false);
    }
    for (const nodeId of await dt.getAllNodeGroupIds()) {
      const f = await dt.getNodeFilterStyle(nodeId);
      expect(f).toBe('', `Expected node ${nodeId} to have no inline filter after repeated resets`);
    }

    // Rapid toggling highlight/reset in quick succession
    for (let i = 0; i < 5; i++) {
      await dt.clickHighlight();
      // tiny gap
      await page.waitForTimeout(30);
      await dt.clickReset();
      await page.waitForTimeout(30);
    }

    // Final state should be Idle: no edges highlighted and no filters
    for (const id of await dt.getAllEdgeIds()) {
      expect(await dt.edgeHasHighlight(id)).toBe(false);
    }
    for (const nid of await dt.getAllNodeGroupIds()) {
      expect(await dt.getNodeFilterStyle(nid)).resolves.toBe('');
    }

    // Ensure no runtime exceptions were thrown during heavy interaction
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Observability: capture console messages and page errors during navigation and interaction', async ({ page }) => {
    // This test demonstrates how the runner observes console logs and runtime exceptions.
    // We intentionally do not modify page behavior; we merely assert the observed arrays,
    // and we document expectations as assertions so test will fail if unexpected runtime errors occur.

    const dt = new DecisionTreePage(page);
    await dt.goto();

    // Interact a bit to possibly trigger handlers
    await dt.clickHighlight();
    await page.waitForTimeout(40);
    await dt.clickReset();
    await page.waitForTimeout(40);
    await dt.focusNode('node-root');
    await page.waitForTimeout(40);
    await dt.blurNode('node-root');
    await page.waitForTimeout(40);

    // For this provided page, we expect no unhandled exceptions or console.error logs.
    // If any ReferenceError / SyntaxError / TypeError occurred naturally in the page,
    // they would be captured in pageErrors and consoleErrors and this expectation would fail,
    // surfacing the runtime issue.
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);

    // But we still assert that console messages were collected (could be empty).
    // The array may be empty — this is acceptable but we assert the data structure exists.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});