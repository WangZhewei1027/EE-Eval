import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1807d20-d366-11f0-9b19-a558354ece3e.html';

// Page Object for interacting with the BST application
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nodeValueInput = page.locator('#nodeValue');
    this.statusEl = page.locator('#status');
    this.container = page.locator('#treeContainer');
    this.insertBtn = page.locator("button[onclick='insertNode()']");
    this.deleteBtn = page.locator("button[onclick='deleteNode()']");
    this.searchBtn = page.locator("button[onclick='searchNode()']");
    this.clearBtn = page.locator("button[onclick='clearTree()']");
    this.generateBtn = page.locator("button[onclick='generateRandomTree()']");
    this.preOrderBtn = page.locator("button[onclick='traversePreOrder()']");
    this.inOrderBtn = page.locator("button[onclick='traverseInOrder()']");
    this.postOrderBtn = page.locator("button[onclick='traversePostOrder()']");
    this.findMinBtn = page.locator("button[onclick='findMin()']");
    this.findMaxBtn = page.locator("button[onclick='findMax()']");
    this.getHeightBtn = page.locator("button[onclick='getHeight()']");
    this.countNodesBtn = page.locator("button[onclick='countNodes()']");
    this.nodeElements = () => this.page.locator('.node');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async fillValue(value) {
    await this.nodeValueInput.fill(String(value));
  }

  async clearInput() {
    await this.nodeValueInput.fill('');
  }

  async clickInsert() {
    await this.insertBtn.click();
  }

  async clickDelete() {
    await this.deleteBtn.click();
  }

  async clickSearch() {
    await this.searchBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async clickGenerateRandom() {
    await this.generateBtn.click();
  }

  async clickPreOrder() {
    await this.preOrderBtn.click();
  }

  async clickInOrder() {
    await this.inOrderBtn.click();
  }

  async clickPostOrder() {
    await this.postOrderBtn.click();
  }

  async clickFindMin() {
    await this.findMinBtn.click();
  }

  async clickFindMax() {
    await this.findMaxBtn.click();
  }

  async clickGetHeight() {
    await this.getHeightBtn.click();
  }

  async clickCountNodes() {
    await this.countNodesBtn.click();
  }

  async getStatusText() {
    return (await this.statusEl.textContent())?.trim() ?? '';
  }

  // Returns computed background color for status element (rgb(...))
  async getStatusBackgroundColor() {
    return await this.page.$eval('#status', el => getComputedStyle(el).backgroundColor);
  }

  async getContainerInnerText() {
    return (await this.container.innerText()).trim();
  }

  async getNodeCountInDOM() {
    return await this.nodeElements().count();
  }

  async getNodeValuesInDOM() {
    return await this.page.$$eval('.node', nodes => nodes.map(n => (n.textContent || '').trim()));
  }
}

test.describe('Binary Search Tree Visualization - FSM tests', () => {
  // Capture console errors and page errors per test
  test.beforeEach(async ({ page }, testInfo) => {
    // attach arrays to testInfo so they are accessible in tests via testInfo
    testInfo.attachments = testInfo.attachments || {};
    testInfo.attachments.consoleErrors = [];
    testInfo.attachments.pageErrors = [];

    page.on('console', msg => {
      // capture only error-level console messages for investigation
      if (msg.type() === 'error') {
        testInfo.attachments.consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      // collect unhandled exceptions (ReferenceError, TypeError, etc.)
      testInfo.attachments.pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Ensure no uncaught page errors occurred during the test
    const pageErrors = testInfo.attachments?.pageErrors ?? [];
    const consoleErrors = testInfo.attachments?.consoleErrors ?? [];

    // Explicit assertions to surface runtime problems if present
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.join(' | ')}`).toBe(0);

    // Give a short pause to ensure any late async errors are captured before closing
    // (keeps tests deterministic)
    await page.waitForTimeout(10);
  });

  test.describe('Initial state and rendering (S0_Idle)', () => {
    test('Initial render: status shows Ready and container indicates tree is empty', async ({ page }, testInfo) => {
      const app = new BSTPage(page);

      // Navigate to app
      await app.goto();

      // Validate initial status message
      const statusText = await app.getStatusText();
      // FSM S0 evidence: statusEl.textContent = 'Ready to build a Binary Search Tree!'
      expect(statusText).toBe('Ready to build a Binary Search Tree!');

      // Container should show "Tree is empty" paragraph rendered by renderTree()
      const containerText = await app.getContainerInnerText();
      expect(containerText).toMatch(/Tree is empty/i);

      // No nodes should be present in the DOM initially
      const nodeCount = await app.getNodeCountInDOM();
      expect(nodeCount).toBe(0);
    });
  });

  test.describe('Insert/Delete/Search flows (S1_NodeInserted, S2_NodeDeleted, S3_NodeFound, S4_NodeNotFound)', () => {
    test('Insert node: node is added, status updated and visual node appears', async ({ page }, testInfo) => {
      const app = new BSTPage(page);
      await app.goto();

      // Insert a valid node (10)
      await app.fillValue(10);
      await app.clickInsert();

      // Expect success status and correct styling for success
      const statusText = await app.getStatusText();
      expect(statusText).toBe('Node 10 inserted successfully');

      const bgColor = await app.getStatusBackgroundColor();
      // success background set to '#d1ecf1' => rgb(209, 236, 241)
      expect(bgColor).toContain('rgb'); // sanity, computed style exists
      expect(statusText).toContain('Node 10 inserted successfully');

      // Visual node should be present
      await expect(app.nodeElements()).toHaveCount(1);
      const values = await app.getNodeValuesInDOM();
      expect(values).toContain('10');

      // Input should be cleared after insertion
      const inputValue = await page.$eval('#nodeValue', el => el.value);
      expect(inputValue).toBe('');
    });

    test('Insert duplicate node shows error message', async ({ page }, testInfo) => {
      const app = new BSTPage(page);
      await app.goto();

      // Insert 10 first time
      await app.fillValue(10);
      await app.clickInsert();

      // Insert duplicate 10 again
      await app.fillValue(10);
      await app.clickInsert();

      const statusText = await app.getStatusText();
      expect(statusText).toBe('Node 10 already exists in the tree');

      // Error styling expected: '#f8d7da' => rgb(248, 215, 218)
      const bgColor = await app.getStatusBackgroundColor();
      expect(bgColor).toContain('rgb');
      // verify it's the error color approximately (exact string depends on browser formatting)
      expect(bgColor.replace(/\s/g, '')).toContain('rgb(248,215,218)');
    });

    test('Search existing and non-existing nodes produce correct states', async ({ page }, testInfo) => {
      const app = new BSTPage(page);
      await app.goto();

      // Ensure tree is empty then insert one node
      await app.fillValue(42);
      await app.clickInsert();

      // Search for existing node
      await app.fillValue(42);
      await app.clickSearch();
      let statusText = await app.getStatusText();
      expect(statusText).toBe('Node 42 found in the tree');

      // Search for non-existing node
      await app.fillValue(999);
      await app.clickSearch();
      statusText = await app.getStatusText();
      expect(statusText).toBe('Node 999 not found in the tree');

      // Error styling should be applied when not found
      const bgColor = await app.getStatusBackgroundColor();
      expect(bgColor.replace(/\s/g, '')).toContain('rgb(248,215,218)');
    });

    test('Delete existing node removes it; deleting non-existent reports error', async ({ page }, testInfo) => {
      const app = new BSTPage(page);
      await app.goto();

      // Insert two nodes
      await app.fillValue(5);
      await app.clickInsert();
      await app.fillValue(15);
      await app.clickInsert();

      // Verify both present
      let count = await app.getNodeCountInDOM();
      expect(count).toBeGreaterThanOrEqual(2);

      // Delete one existing node (5)
      await app.fillValue(5);
      await app.clickDelete();
      let statusText = await app.getStatusText();
      expect(statusText).toBe('Node 5 deleted successfully');

      // Confirm it no longer appears in DOM node list
      const values = await app.getNodeValuesInDOM();
      expect(values).not.toContain('5');

      // Try deleting non-existent node
      await app.fillValue(12345);
      await app.clickDelete();
      statusText = await app.getStatusText();
      expect(statusText).toBe('Node 12345 not found in the tree');

      const bgColor = await app.getStatusBackgroundColor();
      expect(bgColor.replace(/\s/g, '')).toContain('rgb(248,215,218)');
    });
  });

  test.describe('Tree management and random generation (S5_TreeCleared, S6_RandomTreeGenerated)', () => {
    test('Clear tree transitions to Tree Cleared and container shows empty UI', async ({ page }, testInfo) => {
      const app = new BSTPage(page);
      await app.goto();

      // Insert a node then clear
      await app.fillValue(7);
      await app.clickInsert();

      await app.clickClear();

      const statusText = await app.getStatusText();
      expect(statusText).toBe('Tree cleared');

      // Container should indicate Tree is empty
      const containerText = await app.getContainerInnerText();
      expect(containerText).toMatch(/Tree is empty/i);

      // Node count must be zero
      const count = await app.getNodeCountInDOM();
      expect(count).toBe(0);
    });

    test('Generate random tree produces nodes and reports node count in status', async ({ page }, testInfo) => {
      const app = new BSTPage(page);
      await app.goto();

      await app.clickGenerateRandom();

      // Status should mention 'Generated random tree with X nodes'
      const statusText = await app.getStatusText();
      expect(statusText).toMatch(/Generated random tree with \d+ nodes/);

      // There should be at least 5 nodes according to implementation (5-14)
      const domCount = await app.getNodeCountInDOM();
      expect(domCount).toBeGreaterThanOrEqual(5);

      // Now click "Count Nodes" and verify the reported count matches DOM count
      await app.clickCountNodes();
      const countStatus = await app.getStatusText();
      // Format: "Number of nodes: <count>"
      expect(countStatus).toMatch(/Number of nodes: \d+/);
      const reported = parseInt(countStatus.replace(/[^\d]/g, ''), 10);
      expect(reported).toBe(domCount);
    });
  });

  test.describe('Traversal and analytics (S7_TraversalPerformed, S8_MinValueFound, S9_MaxValueFound, S10_TreeEmpty)', () => {
    test('Traversals produce correct status messages (pre/in/post)', async ({ page }, testInfo) => {
      const app = new BSTPage(page);
      await app.goto();

      // Create a small deterministic tree: insert [20, 10, 30, 5, 15]
      const valuesToInsert = [20, 10, 30, 5, 15];
      for (const v of valuesToInsert) {
        await app.fillValue(v);
        await app.clickInsert();
      }

      // Pre-order
      await app.clickPreOrder();
      let status = await app.getStatusText();
      expect(status).toMatch(/^Pre-order traversal: \[.*\]/);

      // In-order
      await app.clickInOrder();
      status = await app.getStatusText();
      expect(status).toMatch(/^In-order traversal: \[.*\]/);
      // In-order should be sorted ascending for BST
      const inOrderStr = status.replace(/^In-order traversal:\s*\[|\]$/g, '');
      const inOrderArr = inOrderStr.length ? inOrderStr.split(',').map(s => Number(s.trim())) : [];
      const sorted = [...inOrderArr].sort((a, b) => a - b);
      expect(inOrderArr).toEqual(sorted);

      // Post-order
      await app.clickPostOrder();
      status = await app.getStatusText();
      expect(status).toMatch(/^Post-order traversal: \[.*\]/);
    });

    test('Find min/max and get height on non-empty tree', async ({ page }, testInfo) => {
      const app = new BSTPage(page);
      await app.goto();

      // Build a known tree: [50, 30, 70, 20, 40, 60, 80]
      const vals = [50, 30, 70, 20, 40, 60, 80];
      for (const v of vals) {
        await app.fillValue(v);
        await app.clickInsert();
      }

      // Find min
      await app.clickFindMin();
      let status = await app.getStatusText();
      expect(status).toBe('Minimum value: 20');

      // Find max
      await app.clickFindMax();
      status = await app.getStatusText();
      expect(status).toBe('Maximum value: 80');

      // Get height (should be 2 for this balanced tree: root level 0, leaves level 2 => height 2)
      await app.clickGetHeight();
      status = await app.getStatusText();
      expect(status).toBe('Tree height: 2');
    });

    test('Find min/max on empty tree reports Tree is empty (error)', async ({ page }, testInfo) => {
      const app = new BSTPage(page);
      await app.goto();

      // Ensure tree cleared
      await app.clickClear();

      // Find min should produce an error 'Tree is empty'
      await app.clickFindMin();
      let status = await app.getStatusText();
      expect(status).toBe('Tree is empty');
      let bg = await app.getStatusBackgroundColor();
      expect(bg.replace(/\s/g, '')).toContain('rgb(248,215,218)');

      // Find max also should produce same
      await app.clickFindMax();
      status = await app.getStatusText();
      expect(status).toBe('Tree is empty');
      bg = await app.getStatusBackgroundColor();
      expect(bg.replace(/\s/g, '')).toContain('rgb(248,215,218)');
    });

    test('Get height on empty tree returns -1', async ({ page }, testInfo) => {
      const app = new BSTPage(page);
      await app.goto();

      await app.clickClear();
      await app.clickGetHeight();
      const status = await app.getStatusText();
      expect(status).toBe('Tree height: -1');
    });
  });

  test.describe('Validation and edge cases', () => {
    test('Operations with invalid input (empty or non-number) show validation error', async ({ page }, testInfo) => {
      const app = new BSTPage(page);
      await app.goto();

      // Ensure input is empty and attempt Insert
      await app.clearInput();
      await app.clickInsert();
      let status = await app.getStatusText();
      expect(status).toBe('Please enter a valid number');
      let bg = await app.getStatusBackgroundColor();
      expect(bg.replace(/\s/g, '')).toContain('rgb(248,215,218)');

      // Attempt Delete with empty input
      await app.clearInput();
      await app.clickDelete();
      status = await app.getStatusText();
      expect(status).toBe('Please enter a valid number');

      // Attempt Search with empty input
      await app.clearInput();
      await app.clickSearch();
      status = await app.getStatusText();
      expect(status).toBe('Please enter a valid number');
    });

    test('DOM rendering integrity: lines rendered behind nodes when tree non-empty', async ({ page }, testInfo) => {
      const app = new BSTPage(page);
      await app.goto();

      // Create a tree with multiple levels
      for (const v of [100, 50, 150, 25, 75]) {
        await app.fillValue(v);
        await app.clickInsert();
      }

      // There should be node elements and potentially .line elements
      const nodeCount = await app.getNodeCountInDOM();
      expect(nodeCount).toBeGreaterThanOrEqual(5);

      // Validate that container includes line elements when there are parent-child relationships
      const lineCount = await page.locator('.line').count();
      // There should be at least one connecting line for a non-trivial tree
      expect(lineCount).toBeGreaterThanOrEqual(1);

      // Ensure nodes are rendered after lines in the DOM (visual layering)
      const childrenHtml = await page.$eval('#treeContainer', el => Array.from(el.children).map(c => c.className || c.tagName.toLowerCase()));
      // At least one 'line' should appear before a 'node' in the child sequence
      const firstLineIndex = childrenHtml.findIndex(name => name.includes('line'));
      const firstNodeIndex = childrenHtml.findIndex(name => name.includes('node'));
      expect(firstLineIndex).toBeGreaterThanOrEqual(0);
      expect(firstNodeIndex).toBeGreaterThanOrEqual(0);
      expect(firstLineIndex).toBeLessThan(firstNodeIndex);
    });
  });
});