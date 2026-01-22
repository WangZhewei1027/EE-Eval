import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6affe6a0-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for the BST application to encapsulate interactions
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nodeValue = page.locator('#nodeValue');
    this.addBtn = page.locator('#addBtn');
    this.searchBtn = page.locator('#searchBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.inorderBtn = page.locator('#inorderBtn');
    this.preorderBtn = page.locator('#preorderBtn');
    this.postorderBtn = page.locator('#postorderBtn');
    this.levelorderBtn = page.locator('#levelorderBtn');
    this.minBtn = page.locator('#minBtn');
    this.maxBtn = page.locator('#maxBtn');
    this.depthBtn = page.locator('#depthBtn');
    this.status = page.locator('#status');
    this.canvas = page.locator('#treeCanvas');
  }

  // Set the input value
  async setInput(value) {
    await this.nodeValue.fill(String(value));
  }

  // Click add button (expects input to be set)
  async addNode(value) {
    if (value !== undefined) {
      await this.setInput(value);
    }
    await this.addBtn.click();
  }

  // Click search button (expects input to be set)
  async searchValue(value) {
    if (value !== undefined) {
      await this.setInput(value);
    }
    await this.searchBtn.click();
  }

  async resetTree() {
    await this.resetBtn.click();
  }

  async inorderTraversal() {
    await this.inorderBtn.click();
  }

  async preorderTraversal() {
    await this.preorderBtn.click();
  }

  async postorderTraversal() {
    await this.postorderBtn.click();
  }

  async levelorderTraversal() {
    await this.levelorderBtn.click();
  }

  async findMin() {
    await this.minBtn.click();
  }

  async findMax() {
    await this.maxBtn.click();
  }

  async calculateDepth() {
    await this.depthBtn.click();
  }

  // Get status text and classes
  async getStatusText() {
    return (await this.status.textContent())?.trim() ?? '';
  }

  async hasStatusClass(cls) {
    return await this.status.evaluate((el, c) => el.classList.contains(c), cls);
  }

  // Get canvas width/height attributes (numbers)
  async getCanvasSize() {
    return await this.canvas.evaluate((c) => ({ width: c.width, height: c.height, offsetWidth: c.offsetWidth, offsetHeight: c.offsetHeight }));
  }

  // Wait for status to clear (status is cleared after 3000ms by app)
  async waitForStatusClear(timeout = 4000) {
    await this.page.waitForTimeout(timeout);
  }
}

test.describe('Binary Search Tree Visualization - FSM and UI tests', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    // Navigate to application
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // After each test assert that there were no uncaught page errors
    // and that the browser console did not emit 'error' messages.
    // This validates that loading and interactions did not produce runtime exceptions.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
    expect(consoleErrors, `No console error messages expected. Found: ${consoleErrors.map(e => e.text).join('; ')}`).toEqual([]);
  });

  test.describe('Idle state and canvas initialization', () => {
    test('S0_Idle: canvas resized on load (resizeCanvas entry action)', async ({ page }) => {
      const bst = new BSTPage(page);

      // Validate that canvas width and offsetWidth are set and equal (entry action: resizeCanvas)
      const canvasSize = await bst.getCanvasSize();
      // Assert canvas dimensions are positive numbers
      expect(canvasSize.width).toBeGreaterThan(0);
      expect(canvasSize.height).toBeGreaterThan(0);
      // The script sets canvas.width = canvas.offsetWidth, so they should match
      expect(canvasSize.width).toBe(canvasSize.offsetWidth);
      expect(canvasSize.height).toBe(canvasSize.offsetHeight);
    });

    test('Window resize triggers canvas resize (responsive behavior)', async ({ page }) => {
      const bst = new BSTPage(page);

      // Resize the viewport to simulate a window resize and dispatch resize event
      await page.setViewportSize({ width: 800, height: 600 });
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));

      const sizeAfterResize = await bst.getCanvasSize();
      expect(sizeAfterResize.width).toBeGreaterThan(0);
      expect(sizeAfterResize.width).toBe(sizeAfterResize.offsetWidth);
    });
  });

  test.describe('Node insertion, duplicate handling and input validation', () => {
    test('S1_NodeAdded: Add a single node shows success status and clears input', async ({ page }) => {
      const bst = new BSTPage(page);

      // Add node 50
      await bst.addNode(50);

      // Status should indicate node added and class 'success' present
      const statusText = await bst.getStatusText();
      expect(statusText).toBe('Value 50 added to the tree');
      expect(await bst.hasStatusClass('success')).toBe(true);

      // Input should be cleared and focused
      const inputValue = await bst.nodeValue.inputValue();
      expect(inputValue).toBe('');
      const activeElementId = await page.evaluate(() => document.activeElement?.id || null);
      expect(activeElementId).toBe('nodeValue');

      // Wait for status to clear automatically (edge behavior)
      await bst.waitForStatusClear(3200);
      const statusAfterClear = await bst.getStatusText();
      expect(statusAfterClear).toBe('');
    });

    test('Adding invalid input (empty or non-number) shows error', async ({ page }) => {
      const bst = new BSTPage(page);

      // Ensure input is empty and click add
      await bst.nodeValue.fill('');
      await bst.addBtn.click();

      let statusText = await bst.getStatusText();
      expect(statusText).toBe('Please enter a valid number');
      expect(await bst.hasStatusClass('error')).toBe(true);

      // Test non-number via directly inputting text (though input type=number, Playwright can fill)
      await bst.nodeValue.fill('abc');
      await bst.addBtn.click();

      statusText = await bst.getStatusText();
      expect(statusText).toBe('Please enter a valid number');
      expect(await bst.hasStatusClass('error')).toBe(true);
    });

    test('Adding a duplicate value shows error and does not insert again', async ({ page }) => {
      const bst = new BSTPage(page);

      // Insert 25, then try to insert 25 again
      await bst.addNode(25);
      expect(await bst.getStatusText()).toBe('Value 25 added to the tree');

      // Add duplicate
      await bst.addNode(25);
      const statusText = await bst.getStatusText();
      expect(statusText).toBe('Value 25 already exists in the tree');
      expect(await bst.hasStatusClass('error')).toBe(true);
    });
  });

  test.describe('Search transitions: S2_ValueFound and S3_ValueNotFound', () => {
    test('Search for existing and non-existing values shows appropriate statuses', async ({ page }) => {
      const bst = new BSTPage(page);

      // Prepare tree with known values
      const values = [50, 30, 70];
      for (const v of values) {
        await bst.addNode(v);
        // allow status to be set; immediate subsequent actions are fine without waiting long
      }

      // Search for existing value
      await bst.searchValue(30);
      let status = await bst.getStatusText();
      expect(status).toBe('Value 30 found in the tree');
      expect(await bst.hasStatusClass('success')).toBe(true);

      // Search for non-existing value
      await bst.searchValue(999);
      status = await bst.getStatusText();
      expect(status).toBe('Value 999 not found in the tree');
      expect(await bst.hasStatusClass('error')).toBe(true);
    });

    test('Searching with invalid input shows validation error', async ({ page }) => {
      const bst = new BSTPage(page);

      await bst.nodeValue.fill('');
      await bst.searchBtn.click();
      const status = await bst.getStatusText();
      expect(status).toBe('Please enter a valid number');
      expect(await bst.hasStatusClass('error')).toBe(true);
    });
  });

  test.describe('Reset transition S4_TreeReset', () => {
    test('Reset clears the tree and shows info status', async ({ page }) => {
      const bst = new BSTPage(page);

      // Add some nodes
      await bst.addNode(10);
      await bst.addNode(20);

      // Reset tree
      await bst.resetTree();
      const status = await bst.getStatusText();
      expect(status).toBe('Tree has been reset');
      expect(await bst.hasStatusClass('info')).toBe(true);

      // After reset, searching for earlier value yields not found
      await bst.searchValue(10);
      const searchStatus = await bst.getStatusText();
      expect(searchStatus).toBe('Value 10 not found in the tree');
      expect(await bst.hasStatusClass('error')).toBe(true);
    });

    test('Find min/max on empty tree produce error', async ({ page }) => {
      const bst = new BSTPage(page);

      // Ensure tree is reset/empty
      await bst.resetTree();

      // Find minimum on empty tree
      await bst.findMin();
      let status = await bst.getStatusText();
      expect(status).toBe('Tree is empty');
      expect(await bst.hasStatusClass('error')).toBe(true);

      // Find maximum on empty tree
      await bst.findMax();
      status = await bst.getStatusText();
      expect(status).toBe('Tree is empty');
      expect(await bst.hasStatusClass('error')).toBe(true);
    });
  });

  test.describe('Traversals and traversal completion state S5_TraversalCompleted', () => {
    // Build a balanced BST for deterministic traversal results
    const treeValues = [50, 30, 70, 20, 40, 60, 80];

    test.beforeEach(async ({ page }) => {
      // nothing here; each test will prepare its own tree
    });

    test('In-Order traversal shows sorted result', async ({ page }) => {
      const bst = new BSTPage(page);
      for (const v of treeValues) {
        await bst.addNode(v);
      }

      await bst.inorderTraversal();
      const status = await bst.getStatusText();
      // In-order should be sorted ascending
      expect(status).toBe('In-Order Traversal: [20, 30, 40, 50, 60, 70, 80]');
      expect(await bst.hasStatusClass('info')).toBe(true);
    });

    test('Pre-Order traversal shows root-first ordering', async ({ page }) => {
      const bst = new BSTPage(page);
      for (const v of treeValues) {
        await bst.addNode(v);
      }

      await bst.preorderTraversal();
      const status = await bst.getStatusText();
      // For the insertion order given, expected pre-order: root, left subtree, right subtree
      expect(status).toBe('Pre-Order Traversal: [50, 30, 20, 40, 70, 60, 80]');
      expect(await bst.hasStatusClass('info')).toBe(true);
    });

    test('Post-Order traversal shows children-before-root ordering', async ({ page }) => {
      const bst = new BSTPage(page);
      for (const v of treeValues) {
        await bst.addNode(v);
      }

      await bst.postorderTraversal();
      const status = await bst.getStatusText();
      expect(status).toBe('Post-Order Traversal: [20, 40, 30, 60, 80, 70, 50]');
      expect(await bst.hasStatusClass('info')).toBe(true);
    });

    test('Level-Order traversal (BFS) shows expected ordering', async ({ page }) {
      const bst = new BSTPage(page);
      for (const v of treeValues) {
        await bst.addNode(v);
      }

      await bst.levelorderTraversal();
      const status = await bst.getStatusText();
      expect(status).toBe('Level-Order Traversal: [50, 30, 70, 20, 40, 60, 80]');
      expect(await bst.hasStatusClass('info')).toBe(true);
    });
  });

  test.describe('Minimum, Maximum and Depth transitions (S6_MinValueFound, S7_MaxValueFound, S8_DepthCalculated)', () => {
    test('Find minimum and maximum in a populated tree', async ({ page }) => {
      const bst = new BSTPage(page);
      const vals = [45, 20, 70, 10, 35, 60, 90];

      for (const v of vals) {
        await bst.addNode(v);
      }

      // Minimum should be 10
      await bst.findMin();
      let status = await bst.getStatusText();
      expect(status).toBe('Minimum value: 10');
      expect(await bst.hasStatusClass('info')).toBe(true);

      // Maximum should be 90
      await bst.findMax();
      status = await bst.getStatusText();
      expect(status).toBe('Maximum value: 90');
      expect(await bst.hasStatusClass('info')).toBe(true);
    });

    test('Calculate depth returns correct value for populated and empty tree', async ({ page }) => {
      const bst = new BSTPage(page);

      // Empty tree depth
      await bst.resetTree();
      await bst.calculateDepth();
      let status = await bst.getStatusText();
      expect(status).toBe('Tree depth: 0');
      expect(await bst.hasStatusClass('info')).toBe(true);

      // Build a tree and check depth
      const vals = [50, 30, 70, 20, 40]; // depth should be 3
      for (const v of vals) {
        await bst.addNode(v);
      }

      await bst.calculateDepth();
      status = await bst.getStatusText();
      expect(status).toBe('Tree depth: 3');
      expect(await bst.hasStatusClass('info')).toBe(true);
    });
  });

  test.describe('Edge case scenarios and status clearing behavior', () => {
    test('Status messages clear after timeout as implemented by showStatus', async ({ page }) => {
      const bst = new BSTPage(page);

      // Trigger a status by adding a node
      await bst.addNode(77);
      const immediateStatus = await bst.getStatusText();
      expect(immediateStatus).toBe('Value 77 added to the tree');

      // Wait a bit more than 3 seconds for automatic clear
      await bst.waitForStatusClear(3200);
      const laterStatus = await bst.getStatusText();
      expect(laterStatus).toBe('');
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No uncaught runtime errors (ReferenceError, SyntaxError, TypeError) should be present on load and interaction', async ({ page }) => {
      const bst = new BSTPage(page);

      // Perform a few interactions to ensure typical operations do not raise exceptions
      await bst.addNode(5);
      await bst.addNode(3);
      await bst.findMin();
      await bst.inorderTraversal();

      // Allow any asynchronous errors to surface
      await page.waitForTimeout(200);

      // Assertions performed in afterEach will validate that console and page errors arrays are empty.
      // Here we explicitly also assert local arrays to provide clearer failure messages if needed.
      // (Note: actual assertions executed in afterEach per test.)
      expect(pageErrors.length).toBe(0);
      const consoleErrs = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
      expect(consoleErrs.length).toBe(0);
    });
  });
});