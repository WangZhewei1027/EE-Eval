import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324cc382-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page object for the Binary Tree Visualization page.
 * Encapsulates common interactions and queries used by the tests.
 */
class BinaryTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator("button[onclick='createBinaryTree()']");
    this.treeDiv = page.locator('#tree');
    this.nodeLocator = page.locator('#tree .node');
    this.lineLocator = page.locator('#tree .line');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickGenerate() {
    await this.button.click();
  }

  async countNodes() {
    return await this.nodeLocator.count();
  }

  async countLines() {
    return await this.lineLocator.count();
  }

  async getNodeTexts() {
    return await this.nodeLocator.allTextContents();
  }

  async getNodePositions() {
    // Returns array of { left, top } for each node in px (numbers)
    return await this.page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('#tree .node'));
      return nodes.map(n => {
        const rect = n.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      });
    });
  }

  async treeChildCount() {
    return await this.page.locator('#tree').evaluate((el) => el ? el.children.length : 0);
  }
}

test.describe('Binary Tree Visualization FSM tests', () => {
  // Basic sanity test to ensure the page loads and initial Idle state is correct.
  test('Initial state (S0_Idle): button is present and tree is empty', async ({ page }) => {
    // Capture console messages and page errors for this test
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const treePage = new BinaryTreePage(page);
    // Navigate to the app
    await treePage.goto();

    // Validate the "Generate Binary Tree" button exists and is visible
    await expect(treePage.button).toBeVisible();
    await expect(treePage.button).toHaveText('Generate Binary Tree');

    // Validate that #tree is present but initially empty
    await expect(treePage.treeDiv).toBeVisible();
    const childCount = await treePage.treeChildCount();
    expect(childCount).toBe(0);

    // Ensure no uncaught errors were emitted during initial load
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console.error messages on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition GenerateTree (S0_Idle -> S1_TreeGenerated): clicking button draws full tree', async ({ page }) => {
    // This test validates the event and transition: clicking the button calls createBinaryTree()
    // which should result in drawTree(tree) populating the #tree div with nodes and lines.

    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Ensure function createBinaryTree exists on the page (sanity check)
    const createType = await page.evaluate(() => typeof createBinaryTree);
    expect(createType).toBe('function');

    // Click to generate the tree
    await treePage.clickGenerate();

    // Wait for nodes to appear - expect 15 nodes to be rendered
    await expect(treePage.nodeLocator).toHaveCount(15, { timeout: 3000 });

    // Check lines drawn are nodes - 1 (since each node except root has one parent)
    await expect(treePage.lineLocator).toHaveCount(14);

    // Validate node labels are the numbers 1..15 (inserted in order)
    const texts = await treePage.getNodeTexts();
    // Remove any extra whitespace and ensure they match strings "1".."15"
    const normalized = texts.map(t => t.trim());
    const expected = Array.from({ length: 15 }, (_, i) => String(i + 1));
    expect(normalized).toEqual(expected);

    // Validate node positions are inside the #tree bounding box
    const treeBox = await page.locator('#tree').boundingBox();
    expect(treeBox).not.toBeNull();
    const positions = await treePage.getNodePositions();
    // every node should have left/top within the tree bounding rectangle (with small tolerance)
    for (const pos of positions) {
      expect(pos.left + pos.width / 2).toBeGreaterThanOrEqual(treeBox.x - 1);
      expect(pos.left + pos.width / 2).toBeLessThanOrEqual(treeBox.x + treeBox.width + 1);
      expect(pos.top + pos.height / 2).toBeGreaterThanOrEqual(treeBox.y - 1);
      expect(pos.top + pos.height / 2).toBeLessThanOrEqual(treeBox.y + treeBox.height + 1);
    }

    // Ensure no uncaught page errors occurred during tree generation
    expect(pageErrors.length).toBe(0);

    // Ensure no console.error messages occurred during the generation step
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);

    // Additional check: subsequent DOM structure count equals nodes + lines
    const childCount = await treePage.treeChildCount();
    expect(childCount).toBe(15 + 14);
  });

  test('Idempotency: clicking Generate Binary Tree multiple times does not accumulate nodes', async ({ page }) => {
    // This test checks the exit/entry behavior: createBinaryTree should clear previous drawing
    // (drawTree starts with treeDiv.innerHTML = ''), so multiple clicks should re-render same number,
    // not accumulate.

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // First generation
    await treePage.clickGenerate();
    await expect(treePage.nodeLocator).toHaveCount(15);

    const firstChildCount = await treePage.treeChildCount();
    expect(firstChildCount).toBe(29); // 15 nodes + 14 lines

    // Click again to regenerate
    await treePage.clickGenerate();

    // Wait for nodes to be present again and ensure count is still 15 and child count unchanged
    await expect(treePage.nodeLocator).toHaveCount(15);
    const secondChildCount = await treePage.treeChildCount();
    expect(secondChildCount).toBe(29);

    // No uncaught errors should be present
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case / error scenario: missing #tree element causes a runtime error when generating', async ({ page }) => {
    // This test intentionally removes the #tree element before clicking the button to
    // surface the natural runtime error (TypeError) that occurs when drawTree attempts to
    // access properties on null. We do not patch or redefine any functions; we only manipulate
    // the DOM to create an error scenario and assert that an error is thrown naturally.

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Remove the #tree element from the DOM to simulate a missing target container.
    await page.evaluate(() => {
      const el = document.getElementById('tree');
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });

    // Click the generate button which will attempt to access #tree and should throw.
    await treePage.clickGenerate();

    // Wait briefly to allow any pageerror event to be emitted
    // We wait up to 2s for a page error to be captured.
    if (pageErrors.length === 0) {
      // If the event hasn't fired yet, wait for it explicitly
      try {
        const err = await page.waitForEvent('pageerror', { timeout: 2000 });
        pageErrors.push(err);
      } catch (e) {
        // ignore timeout; we'll assert below based on the captured array
      }
    }

    // We expect at least one page error to have occurred due to missing #tree element.
    expect(pageErrors.length).toBeGreaterThan(0);

    // The error message should indicate inability to access properties on null/undefined.
    const messages = pageErrors.map(e => (e && e.message) ? e.message : String(e));
    // Use a non-strict assertion that at least one message mentions 'null' or 'innerHTML' or 'Cannot'
    const indicative = messages.some(m => /null|innerHTML|Cannot|reading|set properties/i.test(m));
    expect(indicative).toBe(true);
  });
});