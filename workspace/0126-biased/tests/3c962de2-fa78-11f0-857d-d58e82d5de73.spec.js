import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c962de2-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page object for the AVL visualization page.
 * Encapsulates common operations and queries used across tests.
 */
class AVLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.rotateBtn = page.locator('#btn-rotate');
    this.resetBtn = page.locator('#btn-reset');
    this.svg = page.locator('#avl-svg');
    this.tip = page.locator('#tip');
    this.container = page.locator('#avl-container');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for at least one node-group to render
    await this.page.waitForSelector('g.node-group', { timeout: 3000 });
  }

  async clickRotate() {
    await Promise.all([
      this.page.waitForTimeout(20), // minimal spacing to ensure event loop progression
      this.rotateBtn.click(),
    ]);
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  /**
   * Return a locator for a node-group by its displayed numeric value.
   * The implementation relies on aria-label="Node {value} balance factor {bf}"
   * @param {number|string} value
   */
  nodeGroupByValue(value) {
    // Using ^= for beginning match "Node {value}" may be fragile if other text; use *= to be safer.
    return this.page.locator(`g.node-group[aria-label*="Node ${value} "]`);
  }

  /**
   * Get the balance factor text of the node with given value.
   * Returns an integer.
   * @param {number|string} value
   */
  async getNodeBF(value) {
    const node = this.nodeGroupByValue(value);
    await expect(node).toBeVisible();
    const bfText = node.locator('text.balance-text');
    await expect(bfText.first()).toBeVisible();
    const txt = await bfText.first().textContent();
    return Number(txt?.trim());
  }

  /**
   * Checks whether the node circle of given value has a CSS class containing the substring.
   * e.g., 'balanced', 'balance-pos', 'balance-neg'
   * @param {number|string} value
   * @param {string} classSubstr
   */
  async nodeHasCircleClass(value, classSubstr) {
    const node = this.nodeGroupByValue(value);
    await expect(node).toBeVisible();
    const circle = node.locator('circle.node-circle');
    await expect(circle.first()).toBeVisible();
    const classAttr = await circle.first().getAttribute('class');
    return (classAttr || '').includes(classSubstr);
  }

  /**
   * Hover the node to reveal tooltip and return the tooltip text (aria-hidden should become "false").
   * @param {number|string} value
   */
  async hoverNodeAndGetTip(value) {
    const node = this.nodeGroupByValue(value);
    // Hovering the group may not always be possible; hover the visible circle inside it.
    const circle = node.locator('circle').first();
    await circle.hover();
    // The tooltip fade is immediate in code (opacity toggled), so wait briefly
    await this.page.waitForTimeout(80);
    await expect(this.tip).toBeVisible();
    const ariaHidden = await this.tip.getAttribute('aria-hidden');
    const text = await this.tip.textContent();
    return { ariaHidden, text: text?.trim() ?? '' };
  }

  /**
   * Get the svg width attribute as a number
   */
  async getSVGWidth() {
    const widthAttr = await this.svg.getAttribute('width');
    return Number(widthAttr);
  }
}

// Global containers for console errors / page errors to assert none occurred per-test
test.describe('AVL Tree Concept Showcase - FSM validation and UI tests', () => {
  // Each test will have fresh page; but we collect logs per test via beforeEach
  test.beforeEach(async ({ page }) => {
    // Attach listeners so we can assert there were no unexpected errors
    page._consoleErrors = [];
    page._pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Collect error messages for assertions
        page._consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      page._pageErrors.push(err.message);
    });
  });

  test.afterEach(async ({ page }) => {
    // Assert no console errors or unhandled page errors occurred during the test
    // This verifies the runtime executed without producing uncaught runtime exceptions.
    expect(page._consoleErrors, 'No console.error() messages expected').toEqual([]);
    expect(page._pageErrors, 'No page ' + 'errors expected').toEqual([]);
  });

  test('Initial render: S0_Balanced should be displayed on load (entry action renderState(0))', async ({ page }) => {
    // This test validates the initial entry action renderState(0) produced the Balanced AVL Tree (state0)
    const avl = new AVLPage(page);
    await avl.goto();

    // Root node should be value 30 with balance factor 0 and have "balanced" class
    const root = avl.nodeGroupByValue(30);
    await expect(root).toBeVisible({ timeout: 2000 });

    const bf = await avl.getNodeBF(30);
    expect(bf).toBe(0);

    const hasBalancedClass = await avl.nodeHasCircleClass(30, 'balanced');
    expect(hasBalancedClass).toBeTruthy();

    // Visual container accessibility attributes
    await expect(page.locator('#avl-container')).toHaveAttribute('role', 'img');
    await expect(page.locator('#avl-container')).toHaveAttribute('aria-live', 'polite');

    // Ensure some child nodes expected in state0 exist (e.g., node 10 and node 50)
    await expect(avl.nodeGroupByValue(10)).toBeVisible();
    await expect(avl.nodeGroupByValue(50)).toBeVisible();
  });

  test('NextRotation transitions through all FSM visual states and cycles back', async ({ page }) => {
    // This test validates the Next Rotation button cycles through S0 -> S1 -> S2 -> S3 -> S0
    const avl = new AVLPage(page);
    await avl.goto();

    // Initial (S0)
    await expect(avl.nodeGroupByValue(30)).toBeVisible();
    expect(await avl.getNodeBF(30)).toBe(0);

    // S1_LeftLeftImbalance (after 1 click) : root 30 bf +2, left child 20 bf +1
    await avl.clickRotate();
    await page.waitForSelector('g.node-group[aria-label*="Node 30 balance factor 2"]', { timeout: 2000 });
    expect(await avl.getNodeBF(30)).toBe(2);
    expect(await avl.getNodeBF(20)).toBe(1);

    // S2_AfterRightRotation (after 2 clicks) : root becomes 20 bf 0
    await avl.clickRotate();
    await page.waitForSelector('g.node-group[aria-label*="Node 20 balance factor 0"]', { timeout: 2000 });
    expect(await avl.getNodeBF(20)).toBe(0);
    // Ensure node 40 exists as a child in this configuration
    await expect(avl.nodeGroupByValue(40)).toBeVisible();

    // S3_LeftRightImbalance (after 3 clicks) : back to root 30 with bf +2 and left child 20 bf -1 and node 25 present
    await avl.clickRotate();
    await page.waitForSelector('g.node-group[aria-label*="Node 30 balance factor 2"]', { timeout: 2000 });
    expect(await avl.getNodeBF(30)).toBe(2);
    expect(await avl.getNodeBF(20)).toBe(-1);
    await expect(avl.nodeGroupByValue(25)).toBeVisible();

    // Next click should wrap to S0 (Balanced)
    await avl.clickRotate();
    await page.waitForSelector('g.node-group[aria-label*="Node 30 balance factor 0"]', { timeout: 2000 });
    expect(await avl.getNodeBF(30)).toBe(0);
  });

  test('Reset button returns the visualization to S0_Balanced from other states', async ({ page }) => {
    // This test validates Reset works from multiple states to bring back initial balanced state.
    const avl = new AVLPage(page);
    await avl.goto();

    // Move to S2 (click twice)
    await avl.clickRotate(); // S1
    await avl.clickRotate(); // S2
    await page.waitForSelector('g.node-group[aria-label*="Node 20 balance factor 0"]', { timeout: 2000 });
    // Now click reset
    await avl.clickReset();
    await page.waitForSelector('g.node-group[aria-label*="Node 30 balance factor 0"]', { timeout: 2000 });
    expect(await avl.getNodeBF(30)).toBe(0);

    // Move to S3 (three clicks)
    await avl.clickRotate(); // S1
    await avl.clickRotate(); // S2
    await avl.clickRotate(); // S3
    await page.waitForSelector('g.node-group[aria-label*="Node 30 balance factor 2"]', { timeout: 2000 });
    // Reset should bring back state0
    await avl.clickReset();
    await page.waitForSelector('g.node-group[aria-label*="Node 30 balance factor 0"]', { timeout: 2000 });
    expect(await avl.getNodeBF(30)).toBe(0);

    // Also test clicking Reset when already in S0 (idempotent)
    await avl.clickReset();
    await page.waitForSelector('g.node-group[aria-label*="Node 30 balance factor 0"]', { timeout: 2000 });
    expect(await avl.getNodeBF(30)).toBe(0);
  });

  test('Hovering node shows descriptive tooltip for balance factor (tip)', async ({ page }) => {
    // This test validates the tooltip behavior on node hover (mouseenter/mouseleave handlers)
    const avl = new AVLPage(page);
    await avl.goto();

    // Hover the root node (30, bf 0)
    const tipInfo = await avl.hoverNodeAndGetTip(30);
    // aria-hidden should be toggled to "false" on show
    expect(tipInfo.ariaHidden).toBe('false');
    expect(tipInfo.text).toContain('Balance Factor: 0 (Perfectly balanced)');

    // Move away from node to hide tip; hover some other area
    await page.mouse.move(10, 10);
    // Wait tiny bit for hideTip to take effect
    await page.waitForTimeout(100);
    const ariaHiddenAfter = await avl.tip.getAttribute('aria-hidden');
    expect(ariaHiddenAfter).toBe('true');
  });

  test('Resize behavior triggers responsive adjustments (resize handler)', async ({ page }) => {
    const avl = new AVLPage(page);
    await avl.goto();

    // Ensure default large svg width
    const initialWidth = await avl.getSVGWidth();
    expect(initialWidth).toBeGreaterThanOrEqual(900);

    // Resize viewport to small width to trigger responsive layout
    await page.setViewportSize({ width: 800, height: 600 });
    // Give the page time to process the resize handler
    await page.waitForTimeout(200);

    // The SVG width attribute should reflect the new computed width
    const smallWidth = await avl.getSVGWidth();
    // According to code the svg width is set to Math.min(window.innerWidth - 40, 900)
    // For viewport width 800, expected svg width = 800 - 40 = 760
    expect(smallWidth).toBe(760);

    // Restore viewport for other tests by setting back to a larger size
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(120);
  });

  test('Edge cases: multiple rapid rotations still produce valid states and no runtime errors', async ({ page }) => {
    // This test rapidly clicks the rotate button more times than states length to ensure cycling and stability.
    const avl = new AVLPage(page);
    await avl.goto();

    // Rapidly click rotate 10 times
    for (let i = 0; i < 10; i++) {
      await avl.clickRotate();
      // Small delay to allow renderState fade-out/in to execute - keep it short to emulate rapid interaction
      await page.waitForTimeout(120);
    }

    // After 10 clicks, index should be equivalent to 10 % 4 = 2 (S2) starting from 0
    // Expect root value to be 20 (from state2)
    await page.waitForSelector('g.node-group[aria-label*="Node 20"]', { timeout: 2000 });
    expect(await avl.getNodeBF(20)).toBe(0);

    // Also verify there were no console errors during the rapid interaction (handled in afterEach)
  });

  test('Verify FSM onEnter entry_actions are observable via DOM: each state render corresponds to expected node values', async ({ page }) => {
    // This test explicitly validates each FSM state's described entry_actions (renderState(index)) produce expected DOM signatures.
    const avl = new AVLPage(page);
    await avl.goto();

    // S0
    expect(await avl.getNodeBF(30)).toBe(0);

    // Go to S1
    await avl.clickRotate();
    await page.waitForSelector('g.node-group[aria-label*="Node 30 balance factor 2"]', { timeout: 2000 });
    // Verifies evidence: "const state1 = new Node('n1', 30, +2, ... )"
    expect(await avl.getNodeBF(30)).toBe(2);

    // Go to S2
    await avl.clickRotate();
    await page.waitForSelector('g.node-group[aria-label*="Node 20 balance factor 0"]', { timeout: 2000 });
    // Verifies evidence: "const state2 = new Node('n2', 20, 0, ... )"
    expect(await avl.getNodeBF(20)).toBe(0);

    // Go to S3
    await avl.clickRotate();
    await page.waitForSelector('g.node-group[aria-label*="Node 30 balance factor 2"]', { timeout: 2000 });
    // Verifies evidence: "const state3 = new Node('n1', 30, +2, ... )" and left child bf -1
    expect(await avl.getNodeBF(30)).toBe(2);
    expect(await avl.getNodeBF(20)).toBe(-1);

    // Reset and verify S0 is restored
    await avl.clickReset();
    await page.waitForSelector('g.node-group[aria-label*="Node 30 balance factor 0"]', { timeout: 2000 });
    expect(await avl.getNodeBF(30)).toBe(0);
  });
});