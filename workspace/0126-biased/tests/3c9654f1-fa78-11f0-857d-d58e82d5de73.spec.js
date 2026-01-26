import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9654f1-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for the B-Tree visualization page.
 * Encapsulates DOM selectors and common assertions to keep tests readable.
 */
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.svg = page.locator('#btree-svg');
    this.btnHighlight = page.locator('#btnHighlightLeaves');
    this.btnReset = page.locator('#btnReset');

    // Node groups: node0..node12
    this.node = (id) => page.locator(`#node${id}`);
    this.nodeRect = (id) => page.locator(`#node${id} rect`);
    this.nodeText = (id) => page.locator(`#node${id} text.bkey`);
    // Edges by id
    this.edge = (id) => page.locator(`#${id}`);
  }

  // Returns array of locators for leaf node ids 4..12
  leafNodeIds() {
    return Array.from({ length: 12 - 4 + 1 }).map((_, i) => 4 + i);
  }

  // Helper: get computed inline style fill of a rect element
  async getRectInlineFill(id) {
    return await this.page.evaluate((nodeId) => {
      const node = document.getElementById(nodeId);
      if (!node) return null;
      const rect = node.querySelector('rect');
      if (!rect) return null;
      return rect.style.fill || '';
    }, `node${id}`);
  }

  // Helper: get element's inline opacity style (returns string)
  async getInlineOpacity(selector) {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return el.style.opacity || '';
    }, selector);
  }

  // Helper: get aria-pressed of highlight button
  async ariaPressed() {
    return await this.btnHighlight.getAttribute('aria-pressed');
  }

  // Helper: whether a button is disabled
  async isDisabled(locator) {
    return await locator.evaluate((b) => !!b.disabled);
  }

  // Returns path d attribute of an edge
  async edgePathD(edgeId) {
    return await this.page.locator(`#${edgeId}`).getAttribute('d');
  }
}

test.describe('B-Tree Visualization — FSM states and transitions', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen to uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // After each test, assert that there were no uncaught runtime errors (ReferenceError, SyntaxError, TypeError, etc.)
    // This validates that loading and interactions did not produce unexpected page errors.
    // If there are pageErrors, print them to aid debugging in test output.
    if (pageErrors.length > 0) {
      console.error('Page errors observed:', pageErrors);
    }
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    if (consoleErrors.length > 0) {
      console.error('Console errors/warnings observed:', consoleErrors);
    }

    // Expectation: No uncaught page errors and no console errors were produced during the test.
    expect(pageErrors.length, `Expected no uncaught page errors, got: ${pageErrors.length}`).toBe(0);
    expect(consoleErrors.length, `Expected no console errors/warnings, got: ${consoleErrors.length}`).toBe(0);
  });

  test('Initial state S0_Idle: edges drawn, controls initialized, and nodes animated', async ({ page }) => {
    const tree = new BTreePage(page);

    // Validate initial button states (per FSM S0_Idle evidence/setup)
    // Highlight button should exist and aria-pressed should be "false"
    await expect(tree.btnHighlight).toBeVisible();
    const aria = await tree.ariaPressed();
    expect(aria).toBe('false');

    // Reset button should exist and be disabled initially
    await expect(tree.btnReset).toBeVisible();
    expect(await tree.isDisabled(tree.btnReset)).toBe(true);

    // drawAllEdges() is invoked on load; ensure key edges have a non-empty 'd' attribute.
    // We check a representative set of edges from each subtree.
    const representativeEdges = [
      'edge-0-1', 'edge-0-2', 'edge-0-3',
      'edge-1-4', 'edge-2-8', 'edge-3-12'
    ];
    for (const eid of representativeEdges) {
      const d = await tree.edgePathD(eid);
      // The implementation sets d to '' if centers missing; we expect edges drawn (non-empty)
      expect(d, `Edge ${eid} should have a non-empty path 'd' attribute`).toBeTruthy();
      expect(d.length, `Edge ${eid} path should be longer than 10 characters`).toBeGreaterThan(10);
    }

    // Nodes are animated on load: each node should have an inline animation style (bounceIn)
    // Check a few nodes for the animation style being present
    await expect(tree.node(0)).toBeVisible();
    const anim0 = await tree.node(0).getAttribute('style');
    expect(anim0).toContain('animation');

    const animLeaf = await tree.node(4).getAttribute('style');
    expect(animLeaf).toContain('animation');

    // Ensure leaf nodes have no inline fill set initially (they use CSS fills)
    for (const id of tree.leafNodeIds()) {
      const fill = await tree.getRectInlineFill(id);
      expect(fill).toBe('', `Leaf node${id} should not have inline fill initially`);
    }
  });

  test('Transition: HighlightLeavesClick moves S0_Idle -> S1_LeavesHighlighted', async ({ page }) => {
    const tree = new BTreePage(page);

    // Click the Highlight Leaves button
    await tree.btnHighlight.click();

    // Verify leaf nodes are highlighted: their rect.style.fill should be set to '#00ffdbbb'
    for (const id of tree.leafNodeIds()) {
      const fill = await tree.getRectInlineFill(id);
      expect(fill).toBe('#00ffdbbb', `Leaf node${id} rect should have inline fill '#00ffdbbb' after highlight`);
    }

    // Verify internal nodes (nodes 0..3) dimmed by opacity 0.5
    const internalNodeIds = [0, 1, 2, 3];
    for (const id of internalNodeIds) {
      const op = await tree.getInlineOpacity(`#node${id}`);
      // Implementation sets n.style.opacity = '0.5'
      expect(op).toBe('0.5', `Internal node${id} should have inline opacity 0.5 when leaves highlighted`);
    }

    // Edges should be dimmed to opacity 0.3
    const edges = await page.locator('path.edge').elementHandles();
    for (const e of edges) {
      const opacity = await e.evaluate(n => n.style.opacity || '');
      expect(opacity).toBe('0.3');
    }

    // Button states: Highlight disabled and aria-pressed true, Reset enabled
    expect(await tree.isDisabled(tree.btnHighlight)).toBe(true);
    expect(await tree.ariaPressed()).toBe('true');
    expect(await tree.isDisabled(tree.btnReset)).toBe(false);

    // As an extra check, verify that edges remained present (d attribute unchanged to empty)
    const d0 = await tree.edgePathD('edge-0-2');
    expect(d0).toBeTruthy();
  });

  test('Transition: ResetClick moves S1_LeavesHighlighted -> S0_Idle and resets visuals', async ({ page }) => {
    const tree = new BTreePage(page);

    // First highlight leaves to reach S1_LeavesHighlighted
    await tree.btnHighlight.click();

    // Sanity: ensure highlight applied
    expect(await tree.ariaPressed()).toBe('true');
    expect(await tree.isDisabled(tree.btnHighlight)).toBe(true);

    // Click reset to move back to Idle
    await tree.btnReset.click();

    // Leaf node rect fills should be cleared (empty string)
    for (const id of tree.leafNodeIds()) {
      const fill = await tree.getRectInlineFill(id);
      // resetHighlight sets rect.style.fill = '' (empty)
      expect(fill).toBe('', `After reset, leaf node${id} inline fill should be cleared`);
    }

    // All nodes should have opacity '1'
    for (let i = 0; i <= 12; i++) {
      const op = await tree.getInlineOpacity(`#node${i}`);
      expect(op).toBe('1', `After reset, node${i} inline opacity should be '1'`);
    }

    // All edges should have opacity '0.8'
    const edges = await page.locator('path.edge').elementHandles();
    for (const e of edges) {
      const opacity = await e.evaluate(n => n.style.opacity || '');
      expect(opacity).toBe('0.8', 'After reset, edges should have inline opacity 0.8');
    }

    // Buttons: highlight enabled, aria-pressed false, reset disabled
    expect(await tree.isDisabled(tree.btnHighlight)).toBe(false);
    expect(await tree.ariaPressed()).toBe('false');
    expect(await tree.isDisabled(tree.btnReset)).toBe(true);
  });

  test('Edge cases: clicking disabled buttons and repeated interactions produce no errors', async ({ page }) => {
    const tree = new BTreePage(page);

    // Initially reset button is disabled. Attempt to click it; should be ignored and produce no errors.
    // Using Playwright, clicking a disabled button will throw by default; use evaluate to call click() on the element if present
    // BUT we must not modify page functions globally; calling .click() on disabled element from page context simulates a DOM click that will not fire the handler.
    await page.evaluate(() => {
      const btn = document.getElementById('btnReset');
      if (btn) {
        try { btn.click(); } catch (e) { /* swallow in-page exceptions to allow test to capture pageerror */ }
      }
    });

    // Ensure still disabled and no change
    expect(await tree.isDisabled(tree.btnReset)).toBe(true);
    expect(await tree.ariaPressed()).toBe('false');

    // Now highlight once
    await tree.btnHighlight.click();
    expect(await tree.isDisabled(tree.btnHighlight)).toBe(true);

    // Attempt to click highlight again programmatically (should have no effect and should not throw)
    await page.evaluate(() => {
      const btn = document.getElementById('btnHighlightLeaves');
      if (btn) {
        try { btn.click(); } catch (e) { /* ignore */ }
      }
    });

    // State should remain highlighted
    expect(await tree.ariaPressed()).toBe('true');
    expect(await tree.isDisabled(tree.btnHighlight)).toBe(true);
    expect(await tree.isDisabled(tree.btnReset)).toBe(false);

    // Finally reset and ensure no console/page errors from these interactions
    await tree.btnReset.click();

    // Validate one post-condition to ensure reset worked
    expect(await tree.ariaPressed()).toBe('false');
    expect(await tree.isDisabled(tree.btnReset)).toBe(true);
  });

  test('Sanity checks: verify presence and accessibility attributes for key components', async ({ page }) => {
    const tree = new BTreePage(page);

    // Buttons have expected aria-labels
    await expect(tree.btnHighlight).toHaveAttribute('aria-label', 'Highlight leaf nodes');
    await expect(tree.btnReset).toHaveAttribute('aria-label', 'Reset highlight');

    // SVG container has role=img and a title element for accessibility
    await expect(page.locator('#btree-svg[role="img"]')).toBeVisible();
    const title = await page.locator('#treeTitle').textContent();
    expect(title).toContain('B-Tree');

    // Each node group should have tabindex and role=group for keyboard accessibility
    const someNodes = [0, 4, 9, 12];
    for (const id of someNodes) {
      await expect(page.locator(`#node${id}`)).toHaveAttribute('role', 'group');
      await expect(page.locator(`#node${id}`)).toHaveAttribute('tabindex', '0');
    }
  });
});