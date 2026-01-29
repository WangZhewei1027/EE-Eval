import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324c4e51-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Linked List page
class LinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#nodeValue');
    this.addBtn = page.locator('#addNodeButton');
    this.deleteBtn = page.locator('#deleteNodeButton');
    this.clearBtn = page.locator('#clearListButton');
    this.listContainer = page.locator('#listContainer');
    this.nodeLocator = page.locator('#listContainer .node');
    this.arrowLocator = page.locator('#listContainer .arrow');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setInput(value) {
    await this.input.fill(String(value));
  }

  async clickAdd() {
    await this.addBtn.click();
  }

  async clickDelete() {
    await this.deleteBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async addNode(value) {
    await this.setInput(value);
    await this.clickAdd();
  }

  async deleteNode(value) {
    await this.setInput(value);
    await this.clickDelete();
  }

  async getNodeTexts() {
    const count = await this.nodeLocator.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.nodeLocator.nth(i).textContent())?.trim() ?? '');
    }
    return texts;
  }

  async getArrowCount() {
    return await this.arrowLocator.count();
  }

  async inputValue() {
    return await this.input.inputValue();
  }

  async waitForNodesCount(expected, timeout = 1000) {
    await this.page.waitForFunction(
      (selector, exp) => document.querySelectorAll(selector).length === exp,
      '#listContainer .node',
      expected,
      { timeout }
    ).catch(() => {}); // allow tests to assert actual state later
  }
}

// Helper to capture console errors and page errors
function attachErrorCollectors(page) {
  const pageErrors = [];
  const consoleErrors = [];
  const allConsole = [];

  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });

  page.on('console', (msg) => {
    allConsole.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  return { pageErrors, consoleErrors, allConsole };
}

// Group tests related to the Linked List FSM and UI
test.describe('Linked List Visualization - FSM states and transitions', () => {
  test.describe.configure({ mode: 'parallel' });

  test('Initial Idle state: UI elements present and list is empty', async ({ page }) => {
    // Capture runtime page errors and console messages during load and interactions
    const { pageErrors, consoleErrors, allConsole } = attachErrorCollectors(page);

    // Navigate to the page (attach listeners before navigation to catch load-time issues)
    const listPage = new LinkedListPage(page);
    await listPage.goto();

    // Verify presence of UI controls specified in Idle state
    await expect(page.locator('#nodeValue')).toBeVisible();
    await expect(page.locator('#addNodeButton')).toBeVisible();
    await expect(page.locator('#deleteNodeButton')).toBeVisible();
    await expect(page.locator('#clearListButton')).toBeVisible();
    await expect(page.locator('#listContainer')).toBeVisible();

    // List should initially be empty
    await expect(page.locator('#listContainer .node')).toHaveCount(0);

    // Ensure no runtime page errors of major types occurred during load
    expect(pageErrors.length).toBe(0);
    // Ensure no console errors were emitted
    expect(consoleErrors.length).toBe(0);

    // Sanity: collect console output for debugging if needed (not an assertion)
    // This ensures we observed console messages even if none are errors
    expect(Array.isArray(allConsole)).toBe(true);
  });

  test('Add Node event: transitions to Node Added and returns to Idle (nodes render, input cleared)', async ({ page }) => {
    // Attach error collectors before navigation
    const { pageErrors, consoleErrors } = attachErrorCollectors(page);

    const listPage = new LinkedListPage(page);
    await listPage.goto();

    // Add first node "A"
    await listPage.addNode('A');

    // After adding, the list should show one node with value "A"
    await expect(page.locator('#listContainer .node')).toHaveCount(1);
    const nodesAfterA = await listPage.getNodeTexts();
    expect(nodesAfterA).toEqual(['A']);

    // Input should be cleared after successful add (evidence: document.getElementById('nodeValue').value = '')
    expect(await listPage.inputValue()).toBe('');

    // Add second node "B" to validate linking and arrow rendering
    await listPage.addNode('B');

    // Now there should be two node elements and one arrow between them
    await expect(page.locator('#listContainer .node')).toHaveCount(2);
    const nodesAfterB = await listPage.getNodeTexts();
    expect(nodesAfterB).toEqual(['A', 'B']);
    const arrowCount = await listPage.getArrowCount();
    expect(arrowCount).toBe(1);

    // No runtime page errors or console errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Delete Node event: transitions to Node Deleted and returns to Idle (deletes correct node, input cleared)', async ({ page }) => {
    const { pageErrors, consoleErrors } = attachErrorCollectors(page);

    const listPage = new LinkedListPage(page);
    await listPage.goto();

    // Prepare list: add nodes A, B, C
    await listPage.addNode('A');
    await listPage.addNode('B');
    await listPage.addNode('C');

    await expect(page.locator('#listContainer .node')).toHaveCount(3);
    expect(await listPage.getNodeTexts()).toEqual(['A', 'B', 'C']);

    // Delete middle node "B"
    await listPage.deleteNode('B');

    // After delete, nodes should be A and C
    await expect(page.locator('#listContainer .node')).toHaveCount(2);
    expect(await listPage.getNodeTexts()).toEqual(['A', 'C']);

    // Input should be cleared after delete
    expect(await listPage.inputValue()).toBe('');

    // Deleting non-existent value should not alter the list
    await listPage.deleteNode('Z'); // 'Z' does not exist
    // allow a short wait for any render calls (should be none)
    await page.waitForTimeout(100);
    expect(await listPage.getNodeTexts()).toEqual(['A', 'C']);

    // Deleting head node "A"
    await listPage.deleteNode('A');
    await expect(page.locator('#listContainer .node')).toHaveCount(1);
    expect(await listPage.getNodeTexts()).toEqual(['C']);
    expect(await listPage.inputValue()).toBe('');

    // No runtime errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clear List event: transitions to List Cleared and returns to Idle (all nodes removed)', async ({ page }) => {
    const { pageErrors, consoleErrors } = attachErrorCollectors(page);

    const listPage = new LinkedListPage(page);
    await listPage.goto();

    // Add some nodes first
    await listPage.addNode('1');
    await listPage.addNode('2');
    await listPage.addNode('3');

    await expect(page.locator('#listContainer .node')).toHaveCount(3);

    // Click clear list
    await listPage.clickClear();

    // After clearing, the container should have zero nodes
    await expect(page.locator('#listContainer .node')).toHaveCount(0);
    // Arrows should be zero too
    await expect(page.locator('#listContainer .arrow')).toHaveCount(0);

    // There is no explicit input clearing on clear(), but confirm input remains as-is (expected behavior: unchanged)
    // The FSM states show returning to Idle; ensure no items are visible
    // Confirm no runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases and error scenarios: adding empty value, deleting when empty, duplicates handling', async ({ page }) => {
    const { pageErrors, consoleErrors } = attachErrorCollectors(page);

    const listPage = new LinkedListPage(page);
    await listPage.goto();

    // Edge: Add empty string should not add a node
    await listPage.setInput(''); // input empty
    await listPage.clickAdd();
    await page.waitForTimeout(100); // give any handlers time (should do nothing)
    await expect(page.locator('#listContainer .node')).toHaveCount(0);
    // Input should remain empty
    expect(await listPage.inputValue()).toBe('');

    // Edge: Delete with empty value should do nothing and not throw
    await listPage.setInput('');
    await listPage.clickDelete();
    await page.waitForTimeout(100);
    await expect(page.locator('#listContainer .node')).toHaveCount(0);

    // Add duplicate values and ensure delete removes only first occurrence
    await listPage.addNode('X');
    await listPage.addNode('Y');
    await listPage.addNode('X'); // duplicate 'X'
    expect(await listPage.getNodeTexts()).toEqual(['X', 'Y', 'X']);

    // Delete 'X' should remove the first 'X' only
    await listPage.deleteNode('X');
    expect(await listPage.getNodeTexts()).toEqual(['Y', 'X']);

    // Delete remaining 'X'
    await listPage.deleteNode('X');
    expect(await listPage.getNodeTexts()).toEqual(['Y']);

    // Delete 'Y' (last node) -> list empty
    await listPage.deleteNode('Y');
    expect(await listPage.getNodeTexts()).toEqual([]);

    // Deleting when list empty should be safe (no exceptions)
    await listPage.deleteNode('NON_EXISTENT');
    await page.waitForTimeout(50);
    expect(await listPage.getNodeTexts()).toEqual([]);

    // Final check: no runtime page errors or console errors were emitted
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Visual verification: nodes and arrows styling present in DOM (basic rendering checks)', async ({ page }) => {
    const { pageErrors, consoleErrors } = attachErrorCollectors(page);

    const listPage = new LinkedListPage(page);
    await listPage.goto();

    // Add nodes to create arrows
    await listPage.addNode('Alpha');
    await listPage.addNode('Beta');
    await listPage.addNode('Gamma');

    // Verify that node elements have expected class and text
    const nodes = page.locator('#listContainer .node');
    await expect(nodes).toHaveCount(3);
    await expect(nodes.nth(0)).toHaveClass(/node/);
    await expect(nodes.nth(1)).toHaveClass(/node/);
    await expect(nodes.nth(2)).toHaveClass(/node/);

    // Verify arrow elements exist between nodes and have expected class
    const arrows = page.locator('#listContainer .arrow');
    await expect(arrows).toHaveCount(2);
    await expect(arrows.nth(0)).toHaveClass(/arrow/);

    // Hovering over a node should not throw and should be allowed (visual feedback)
    await nodes.nth(1).hover();
    // Hover doesn't change DOM content in this implementation, but ensure no errors
    await page.waitForTimeout(50);

    // No runtime errors expected from these visual interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});