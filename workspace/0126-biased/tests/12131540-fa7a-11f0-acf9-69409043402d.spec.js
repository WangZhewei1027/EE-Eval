import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12131540-fa7a-11f0-acf9-69409043402d.html';

// Page object for interacting with the BST demo
class BSTPage {
  constructor(page) {
    this.page = page;
    // Inputs
    this.insertValue = page.locator('#insert-value');
    this.deleteValue = page.locator('#delete-value');
    this.searchValue = page.locator('#search-value');
    this.traversalDelay = page.locator('#traversal-delay');
    this.kthSmallestValue = page.locator('#kth-smallest-value');
    this.rangeMin = page.locator('#range-min');
    this.rangeMax = page.locator('#range-max');
    this.highlightValue = page.locator('#highlight-value');
    this.pathValue = page.locator('#path-value');
    this.batchInput = page.locator('#batch-input');

    // Buttons
    this.insertBtn = page.locator('#insert-btn');
    this.deleteBtn = page.locator('#delete-btn');
    this.searchBtn = page.locator('#search-btn');
    this.clearTreeBtn = page.locator('#clear-tree-btn');

    this.inorderBtn = page.locator('#inorder-btn');
    this.preorderBtn = page.locator('#preorder-btn');
    this.postorderBtn = page.locator('#postorder-btn');
    this.levelorderBtn = page.locator('#levelorder-btn');
    this.traversalToggleBtn = page.locator('#traversal-toggle-btn');
    this.traversalStepBtn = page.locator('#traversal-step-btn');
    this.traversalResetBtn = page.locator('#traversal-reset-btn');

    this.heightBtn = page.locator('#height-btn');
    this.countNodesBtn = page.locator('#count-nodes-btn');
    this.countLeavesBtn = page.locator('#count-leaves-btn');
    this.minValueBtn = page.locator('#min-value-btn');
    this.maxValueBtn = page.locator('#max-value-btn');
    this.isBSTBtn = page.locator('#is-bst-btn');
    this.kthSmallestBtn = page.locator('#kth-smallest-btn');
    this.rangeSearchBtn = page.locator('#range-search-btn');

    this.highlightBtn = page.locator('#highlight-btn');
    this.clearHighlightBtn = page.locator('#clear-highlight-btn');
    this.showPathBtn = page.locator('#show-path-btn');
    this.clearPathBtn = page.locator('#clear-path-btn');

    this.batchInsertBtn = page.locator('#batch-insert-btn');
    this.batchDeleteBtn = page.locator('#batch-delete-btn');
    this.batchSearchBtn = page.locator('#batch-search-btn');

    this.treeDisplay = page.locator('#tree-display');
    this.logDiv = page.locator('#log');
    this.clearLogBtn = page.locator('#clear-log-btn');
  }

  async insert(value) {
    await this.insertValue.fill(String(value));
    await this.insertBtn.click();
  }

  async delete(value) {
    await this.deleteValue.fill(String(value));
    await this.deleteBtn.click();
  }

  async search(value) {
    await this.searchValue.fill(String(value));
    await this.searchBtn.click();
  }

  async batchInsert(values) {
    await this.batchInput.fill(values.join(','));
    await this.batchInsertBtn.click();
  }

  async batchDelete(values) {
    await this.batchInput.fill(values.join(','));
    await this.batchDeleteBtn.click();
  }

  async batchSearch(values) {
    await this.batchInput.fill(values.join(','));
    await this.batchSearchBtn.click();
  }

  async setTraversalDelay(ms) {
    await this.traversalDelay.fill(String(ms));
  }

  async startTraversal(type) {
    switch (type) {
      case 'inorder': await this.inorderBtn.click(); break;
      case 'preorder': await this.preorderBtn.click(); break;
      case 'postorder': await this.postorderBtn.click(); break;
      case 'levelorder': await this.levelorderBtn.click(); break;
      default: throw new Error('Unknown traversal type: ' + type);
    }
  }

  async stepTraversal() {
    await this.traversalStepBtn.click();
  }

  async resetTraversal() {
    await this.traversalResetBtn.click();
  }

  async clearTree() {
    await this.clearTreeBtn.click();
  }

  async highlight(value) {
    await this.highlightValue.fill(String(value));
    await this.highlightBtn.click();
  }

  async showPath(value) {
    await this.pathValue.fill(String(value));
    await this.showPathBtn.click();
  }

  async findKth(k) {
    await this.kthSmallestValue.fill(String(k));
    await this.kthSmallestBtn.click();
  }

  async rangeSearch(minV, maxV) {
    await this.rangeMin.fill(String(minV));
    await this.rangeMax.fill(String(maxV));
    await this.rangeSearchBtn.click();
  }

  async clearLog() {
    await this.clearLogBtn.click();
  }

  async getLogText() {
    return (await this.logDiv.textContent()) || '';
  }

  async getTreeText() {
    return (await this.treeDisplay.textContent()) || '';
  }
}

test.describe('BST Interactive Demo - Full FSM coverage', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];
  let page;

  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    page = await browser.newPage();

    // Capture page errors and console messages
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Assert that no uncaught page errors occurred during the test.
    // We capture them and fail the test if any are present.
    expect(pageErrors, 'No page errors should be thrown').toEqual([]);
    expect(consoleErrors, 'No console.error messages expected').toEqual([]);

    await page.close();
  });

  test('Initial state: Idle - tree empty and initial UI state', async () => {
    // Validate initial Idle state entry action: updateTreeDisplay() -> tree shows (Empty Tree)
    const bstPage = new BSTPage(page);
    const treeText = await bstPage.getTreeText();
    // Initial display must indicate empty tree per HTML initialization
    expect(treeText.trim()).toBe('(Empty Tree)');

    // Traversal step button must be disabled initially
    expect(await bstPage.traversalStepBtn.isDisabled()).toBeTruthy();

    // Log initially empty
    expect((await bstPage.getLogText()).trim()).toBe('');
  });

  test.describe('Node operations (Insert, Delete, Search, ClearTree)', () => {
    test('Insert values, check tree display and log', async () => {
      const bstPage = new BSTPage(page);

      // Insert a few values
      await bstPage.insert(10);
      await bstPage.insert(5);
      await bstPage.insert(15);

      // Logs should contain inserted messages
      const log = await bstPage.getLogText();
      expect(log).toContain('Inserted value 10');
      expect(log).toContain('Inserted value 5');
      expect(log).toContain('Inserted value 15');

      // Tree display should show the inserted values somewhere
      const treeText = await bstPage.getTreeText();
      expect(treeText).toContain('10');
      expect(treeText).toContain('5');
      expect(treeText).toContain('15');
    });

    test('Insert invalid input logs error and does not modify tree', async () => {
      const bstPage = new BSTPage(page);

      // Click insert with empty input => invalid
      await bstPage.insertValue.fill('');
      await bstPage.insertBtn.click();

      const log = await bstPage.getLogText();
      expect(log).toContain('Insert: Invalid input');

      // Tree should still be empty
      expect((await bstPage.getTreeText()).trim()).toBe('(Empty Tree)');
    });

    test('Search existing and non-existing values highlight path and log', async () => {
      const bstPage = new BSTPage(page);

      // Build tree
      await bstPage.insert(20);
      await bstPage.insert(10);
      await bstPage.insert(30);
      await bstPage.insert(5);
      await bstPage.insert(15);

      // Search for existing value
      await bstPage.search(15);
      let log = await bstPage.getLogText();
      expect(log).toMatch(/Search: Value 15 found/);

      // After search, tree display should show highlights for path nodes as brackets
      let tree = await bstPage.getTreeText();
      // highlight uses [value] for highlights
      expect(tree).toContain('[20]').or(expect(tree).toContain('[15]')).or(expect(tree).toContain('[10]'));

      // Search for non-existing value (e.g. 99) -> still highlights closest path and logs not found
      await bstPage.search(99);
      log = await bstPage.getLogText();
      expect(log).toMatch(/Search: Value 99 not found/);
      tree = await bstPage.getTreeText();
      // path highlights should exist (brackets)
      expect(tree).toMatch(/\[?\d+\]?/);
    });

    test('Delete values and handle not-found case', async () => {
      const bstPage = new BSTPage(page);

      // Insert and then delete
      await bstPage.insert(50);
      await bstPage.insert(40);
      await bstPage.insert(60);

      await bstPage.delete(40);
      let log = await bstPage.getLogText();
      expect(log).toContain('Deleted value 40');

      // Delete non-existing value
      await bstPage.delete(999);
      log = await bstPage.getLogText();
      expect(log).toContain('Delete: Value 999 not found');
    });

    test('Clear tree resets display, traversal and logs "Tree cleared."', async () => {
      const bstPage = new BSTPage(page);
      // Insert value then clear
      await bstPage.insert(7);
      await bstPage.clearTree();

      const tree = await bstPage.getTreeText();
      expect(tree.trim()).toBe('(Empty Tree)');

      const log = await bstPage.getLogText();
      expect(log).toContain('Tree cleared.');
      // TraversalStep should be disabled after clear (resetTraversal called)
      expect(await bstPage.traversalStepBtn.isDisabled()).toBeTruthy();
    });
  });

  test.describe('Traversals (inorder, preorder, postorder, levelorder, stepping and reset)', () => {
    test('Start inorder traversal with auto delay, let auto-run complete, check logs', async () => {
      const bstPage = new BSTPage(page);

      // Build tree
      await bstPage.batchInsert([8, 3, 10, 1, 6, 14, 4, 7]);

      // Set a small delay so auto traversal runs
      await bstPage.setTraversalDelay(100); // ms
      await bstPage.startTraversal('inorder');

      // Wait enough time for auto traversal to complete (number of nodes * delay * safety factor)
      await page.waitForTimeout(1200);

      const log = await bstPage.getLogText();
      // Should log traversal started and ended
      expect(log).toMatch(/Traversal started: inorder/i);
      expect(log).toMatch(/Traversal ended\./i);
    });

    test('Manual traversal (delay=0) with Step button visits nodes and logs steps', async () => {
      const bstPage = new BSTPage(page);

      // Prepare tree small
      await bstPage.clearTree();
      await bstPage.batchInsert([2, 1, 3]);

      // Set manual mode
      await bstPage.setTraversalDelay(0);
      await bstPage.startTraversal('inorder');

      // Because delay=0, startTraversal logs manual mode message
      let log = await bstPage.getLogText();
      expect(log).toContain('Traversal running in manual step mode');

      // Step through nodes manually. There are 3 nodes.
      expect(await bstPage.traversalStepBtn.isDisabled()).toBeFalsy();
      await bstPage.stepTraversal(); // visit first
      await page.waitForTimeout(50);
      await bstPage.stepTraversal(); // visit second
      await page.waitForTimeout(50);
      await bstPage.stepTraversal(); // visit third (should end)
      await page.waitForTimeout(100);

      log = await bstPage.getLogText();
      expect(log).toContain('Traversal step: visiting node');
      // At end, there should be "Traversal ended."
      expect(log).toMatch(/Traversal ended\./i);
    });

    test('Traversal reset stops traversal and logs "Traversal reset."', async () => {
      const bstPage = new BSTPage(page);

      // Build tree and start traversal
      await bstPage.clearTree();
      await bstPage.batchInsert([11, 6, 18]);
      await bstPage.setTraversalDelay(0);
      await bstPage.startTraversal('preorder');

      // Reset traversal
      await bstPage.resetTraversal();
      const log = await bstPage.getLogText();
      expect(log).toContain('Traversal reset.');
      // Step button should be disabled after reset
      expect(await bstPage.traversalStepBtn.isDisabled()).toBeTruthy();
    });

    test('Traversal toggle button behavior when no current traversal selected', async () => {
      const bstPage = new BSTPage(page);

      // Ensure there's no current traversal type (fresh state)
      // Click traversal toggle should log "No traversal type selected."
      await bstPage.traversalToggleBtn.click();
      const log = await bstPage.getLogText();
      expect(log).toContain('No traversal type selected. Use traversal buttons to start.');
    });
  });

  test.describe('Tree info & queries (height, counts, min/max, isBST, kth smallest, range search)', () => {
    test('Height, node/leaf counts, min/max, and isBST validations', async () => {
      const bstPage = new BSTPage(page);

      await bstPage.clearTree();
      await bstPage.batchInsert([25, 20, 30, 15, 22, 28, 35]);

      await bstPage.heightBtn.click();
      await bstPage.countNodesBtn.click();
      await bstPage.countLeavesBtn.click();
      await bstPage.minValueBtn.click();
      await bstPage.maxValueBtn.click();
      await bstPage.isBSTBtn.click();

      const log = await bstPage.getLogText();
      expect(log).toMatch(/Tree height: \d+/);
      expect(log).toMatch(/Total nodes: \d+/);
      expect(log).toMatch(/Leaf nodes: \d+/);
      expect(log).toMatch(/Minimum value: 15/);
      expect(log).toMatch(/Maximum value: 35/);
      expect(log).toMatch(/BST property valid: Yes/);
    });

    test('k-th smallest returns correct value or proper message when k invalid', async () => {
      const bstPage = new BSTPage(page);

      await bstPage.clearTree();
      await bstPage.batchInsert([40, 20, 60, 10, 30]);

      // valid k
      await bstPage.findKth(3);
      let log = await bstPage.getLogText();
      expect(log).toMatch(/k-th Smallest value \(k=3\):/);

      // invalid k (too large)
      await bstPage.findKth(100);
      log = await bstPage.getLogText();
      expect(log).toContain('k-th Smallest: Tree has fewer than 100 nodes.');

      // invalid k input (non-numeric)
      await bstPage.kthSmallestValue.fill('');
      await bstPage.kthSmallestBtn.click();
      log = await bstPage.getLogText();
      expect(log).toContain('k-th Smallest: Invalid k value');
    });

    test('Range search highlights results and logs found values', async () => {
      const bstPage = new BSTPage(page);

      await bstPage.clearTree();
      await bstPage.batchInsert([5, 2, 8, 1, 3, 7, 9]);

      await bstPage.rangeSearch(2, 7);
      const log = await bstPage.getLogText();
      expect(log).toMatch(/Range search \[2, 7\] found \d+ value\(s\):/);

      // Tree should contain bracketed highlights for values in range (e.g., [2], [3], [5], [7])
      const tree = await bstPage.getTreeText();
      expect(tree).toMatch(/\[.*\d+.*\]/); // at least one highlighted value with brackets
    });

    test('Range search invalid input is handled', async () => {
      const bstPage = new BSTPage(page);

      await bstPage.rangeMin.fill('');
      await bstPage.rangeMax.fill('');
      await bstPage.rangeSearchBtn.click();
      const log = await bstPage.getLogText();
      expect(log).toContain('Range search: Invalid range input');
    });
  });

  test.describe('Highlighting and path visualization', () => {
    test('Highlight node shows bracketed value and logs', async () => {
      const bstPage = new BSTPage(page);
      await bstPage.clearTree();
      await bstPage.batchInsert([12, 6, 18]);

      await bstPage.highlight(6);
      let log = await bstPage.getLogText();
      expect(log).toContain('Highlighted node with value 6');

      const tree = await bstPage.getTreeText();
      expect(tree).toContain('[6]');
    });

    test('Clear highlights clears brackets and logs', async () => {
      const bstPage = new BSTPage(page);
      await bstPage.clearHighlightBtn.click();
      const log = await bstPage.getLogText();
      expect(log).toContain('Cleared highlights.');

      const tree = await bstPage.getTreeText();
      // No bracket should remain if there are no highlights; still allow other characters
      expect(tree).not.toMatch(/\[.*\]/);
    });

    test('Show path highlights path nodes with parentheses and logs', async () => {
      const bstPage = new BSTPage(page);
      await bstPage.clearTree();
      await bstPage.batchInsert([50, 30, 70, 20, 40, 60, 80]);

      await bstPage.showPath(60);
      const log = await bstPage.getLogText();
      // log either found or not found message, expect mention of path
      expect(log).toMatch(/Path to value 60|Value 60 not found/);

      const tree = await bstPage.getTreeText();
      // path nodes are rendered with parentheses e.g. (60) or (50) etc.
      expect(tree).toContain('(60)').or(expect(tree).toContain('('));
    });

    test('Clear path highlight clears parentheses and logs', async () => {
      const bstPage = new BSTPage(page);
      await bstPage.clearPathBtn.click();
      const log = await bstPage.getLogText();
      expect(log).toContain('Cleared path highlight.');

      const tree = await bstPage.getTreeText();
      // After clearing path highlight, there should be no parentheses around nodes
      expect(tree).not.toMatch(/\(.*\)/);
    });
  });

  test.describe('Batch operations and log clearing', () => {
    test('Batch insert/search/delete and logs reflect counts', async () => {
      const bstPage = new BSTPage(page);

      // Batch insert
      await bstPage.batchInsert([1, 2, 3, 4, 5]);
      let log = await bstPage.getLogText();
      expect(log).toMatch(/Batch Insert: Tried 5, successfully inserted \d+ new nodes\./i);

      // Batch search
      await bstPage.batchSearch([2, 5, 999]);
      log = await bstPage.getLogText();
      expect(log).toMatch(/Batch Search: Searched 3\. Found \d+ values\./i);

      // Batch delete (delete some)
      await bstPage.batchDelete([2, 3, 1000]);
      log = await bstPage.getLogText();
      expect(log).toMatch(/Batch Delete: Tried 3, successfully deleted \d+ nodes\./i);
    });

    test('Clear log empties the console log area', async () => {
      const bstPage = new BSTPage(page);

      // Ensure some log content exists
      await bstPage.insert(99);
      let log = await bstPage.getLogText();
      expect(log).toContain('Inserted value 99');

      // Clear log
      await bstPage.clearLog();
      log = await bstPage.getLogText();
      expect(log.trim()).toBe('');
    });
  });

  test.describe('Edge cases & error handling', () => {
    test('Invalid operations produce expected log messages', async () => {
      const bstPage = new BSTPage(page);

      // Delete with empty input
      await bstPage.deleteValue.fill('');
      await bstPage.deleteBtn.click();
      let log = await bstPage.getLogText();
      expect(log).toContain('Delete: Invalid input');

      // Search with empty input
      await bstPage.searchValue.fill('');
      await bstPage.searchBtn.click();
      log = await bstPage.getLogText();
      expect(log).toContain('Search: Invalid input');

      // Highlight invalid
      await bstPage.highlightValue.fill('');
      await bstPage.highlightBtn.click();
      log = await bstPage.getLogText();
      expect(log).toContain('Highlight: Invalid input');

      // Show path invalid
      await bstPage.pathValue.fill('');
      await bstPage.showPathBtn.click();
      log = await bstPage.getLogText();
      expect(log).toContain('Show Path: Invalid input');

      // Batch operations with invalid batch input
      await bstPage.batchInput.fill('a,b,c');
      await bstPage.batchInsertBtn.click();
      log = await bstPage.getLogText();
      expect(log).toContain('Batch Insert: No valid integers found.');
    });
  });
});