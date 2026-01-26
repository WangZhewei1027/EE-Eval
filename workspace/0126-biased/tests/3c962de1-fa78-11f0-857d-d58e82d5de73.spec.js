import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c962de1-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for interacting with the BST visualization page.
 * Encapsulates common actions and queries used across tests.
 */
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.svg = page.locator('#bst-svg');
    this.insertButton = page.locator('#buttonInsert');
    this.resetButton = page.locator('#buttonReset');
    this.tooltip = page.locator('#tooltip');
    this.nodes = () => this.svg.locator('g.node');
    this.links = () => this.svg.locator('path.link');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async insertOnce() {
    await this.insertButton.click();
  }

  async reset() {
    await this.resetButton.click();
  }

  async waitForNodeCount(expected, opts = {}) {
    await expect(this.nodes()).toHaveCount(expected, opts);
  }

  async nodeValues() {
    const count = await this.nodes().count();
    const vals = [];
    for (let i = 0; i < count; i++) {
      vals.push(await this.nodes().nth(i).getAttribute('data-value'));
    }
    return vals;
  }

  async firstNodeBoundingBox() {
    const firstNode = this.nodes().first();
    const circle = firstNode.locator('circle').first();
    return await circle.boundingBox();
  }

  async promptText() {
    // There may be multiple <text> elements; find one that contains the prompt phrase
    const texts = this.svg.locator('text');
    const count = await texts.count();
    for (let i = 0; i < count; i++) {
      const txt = await texts.nth(i).textContent();
      if (txt && txt.includes('Click') && txt.includes('Insert Node')) return txt.trim();
    }
    return null;
  }

  async svgInnerHTML() {
    return await this.page.evaluate((selector) => {
      const el = document.querySelector(selector);
      return el ? el.innerHTML : null;
    }, '#bst-svg');
  }
}

test.describe('Binary Search Tree Visualization - FSM states and transitions', () => {
  let bst;
  let consoleMsgs;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    consoleMsgs = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMsgs.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', err => {
      // Capture runtime errors (ReferenceError, TypeError, SyntaxError etc.)
      pageErrors.push(err);
    });

    bst = new BSTPage(page);
    await bst.goto();
  });

  test.afterEach(async () => {
    // Ensure there were no uncaught page errors during the test
    // If any errors appeared, surface them in the assertion message
    expect(pageErrors.length, `Expected no page errors, but got: ${pageErrors.map(e => e.message).join(' || ')}`).toBe(0);

    // Assert there are no console.error messages emitted
    const errorConsole = consoleMsgs.filter(m => m.type === 'error');
    expect(errorConsole.length, `Console errors were emitted: ${errorConsole.map(c => c.text).join(' || ')}`).toBe(0);
  });

  test('S0_Idle (Initial Idle State): page renders prompt, SVG and controls', async () => {
    // Validate that SVG exists and initial prompt text is rendered (entry_action: renderPage())
    await expect(bst.svg).toBeVisible();

    const prompt = await bst.promptText();
    // The page includes a prompt text "Click "Insert Node" to build the BST"
    expect(prompt).not.toBeNull();
    expect(prompt).toContain('Insert Node');

    // Buttons should be present with attributes as described in FSM components
    await expect(bst.insertButton).toBeVisible();
    await expect(bst.resetButton).toBeVisible();

    // Insert button initial aria-pressed should be "false"
    const ariaPressed = await bst.insertButton.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('false');

    // No nodes present initially
    await bst.waitForNodeCount(0);
    // No links present initially
    await expect(bst.links()).toHaveCount(0);
  });

  test('S1_Inserting: Single insertion adds first node with expected value and no links', async () => {
    // Click Insert (event = InsertNodeClick) -> onEnter action insertNextNode()
    await bst.insertOnce();

    // After first insertion, there should be exactly 1 node
    await bst.waitForNodeCount(1, { timeout: 2000 });

    // Verify the inserted node's data-value corresponds to the first value in insertionSequence (50)
    const values = await bst.nodeValues();
    expect(values.length).toBeGreaterThanOrEqual(1);
    expect(values[0]).toBe('50');

    // For the first node, there should be 0 links drawn
    await expect(bst.links()).toHaveCount(0);

    // aria-pressed should remain false until all insertions are exhausted
    const ariaPressed = await bst.insertButton.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('false');
  });

  test('S1_Inserting (Repeated): Multiple insert clicks create nodes and eventually disable Insert button', async ({ page }) => {
    // Click Insert repeatedly until the button is disabled (transition S1 -> S1 on InsertNodeClick, with final disable)
    // There are 15 values in insertionSequence; we'll click until disabled or until 25 attempts to be safe
    let attempts = 0;
    while (attempts < 25) {
      const disabled = await bst.insertButton.isDisabled();
      if (disabled) break;
      await bst.insertButton.click();
      attempts++;
      // small pause to allow DOM updates that happen synchronously but with small timeouts for transitions
      await page.waitForTimeout(30);
    }

    // Ensure the button eventually disabled
    const disabledFinal = await bst.insertButton.isDisabled();
    expect(disabledFinal).toBe(true);

    // When disabled, aria-pressed should be set to 'true' by the implementation
    const ariaPressed = await bst.insertButton.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('true');

    // Node count should equal insertionSequence length (15)
    await bst.waitForNodeCount(15, { timeout: 5000 });

    // Links should be nodes - 1 (14)
    await expect(bst.links()).toHaveCount(14);
  });

  test('S2_Reset: Reset clears the tree and allows re-insertion from initial state', async () => {
    // Ensure we can insert one node, then reset, then insert again and get the same initial value.
    await bst.insertOnce();
    await bst.waitForNodeCount(1, { timeout: 2000 });

    // Confirm a node exists
    let values = await bst.nodeValues();
    expect(values[0]).toBe('50');

    // Now Reset (event = ResetClick) -> entry action resetTree()
    await bst.reset();

    // After reset, BSTree.clear() should have cleared svg.innerHTML: expect 0 nodes and 0 links
    await bst.waitForNodeCount(0);
    await expect(bst.links()).toHaveCount(0);

    // Also check that the insert button is enabled again and aria-pressed reset to 'false'
    expect(await bst.insertButton.isDisabled()).toBe(false);
    expect(await bst.insertButton.getAttribute('aria-pressed')).toBe('false');

    // Insert again and check first value is again 50 (insertionIndex reset effectively)
    await bst.insertOnce();
    await bst.waitForNodeCount(1, { timeout: 2000 });
    values = await bst.nodeValues();
    expect(values[0]).toBe('50');
  });

  test('Tooltip behavior: hovering over a node shows tooltip with the node value', async ({ page }) => {
    // Insert two nodes so there is at least one visible node
    await bst.insertOnce();
    await bst.insertOnce();
    await bst.waitForNodeCount(2, { timeout: 2000 });

    // Move mouse to the first node's circle center and expect tooltip to appear
    const bbox = await bst.firstNodeBoundingBox();
    expect(bbox).not.toBeNull();

    // Move mouse to the center of the first node's circle
    await page.mouse.move(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);

    // Tooltip should become visible and contain the value of the node
    await expect(bst.tooltip).toHaveClass(/visible/, { timeout: 1000 });
    const tooltipText = await bst.tooltip.textContent();
    expect(tooltipText).toContain('Value:');

    // Move mouse away to hide tooltip
    await page.mouse.move(0, 0);
    await expect(bst.tooltip).not.toHaveClass(/visible/, { timeout: 1000 });
  });

  test('Edge case: Clicking Reset when empty is a no-op (no runtime errors) and Insert works after', async () => {
    // Reset immediately on page load (empty tree)
    await bst.reset();

    // SVG should be empty after reset
    const inner = await bst.svgInnerHTML();
    // Implementation clears innerHTML; it may be an empty string
    expect(inner === '' || inner === null || inner === undefined).toBeTruthy();

    // No page errors should have been emitted (checked in afterEach)
    // Now insert should still work and produce the first node
    await bst.insertOnce();
    await bst.waitForNodeCount(1, { timeout: 2000 });
    const vals = await bst.nodeValues();
    expect(vals[0]).toBe('50');
  });
});