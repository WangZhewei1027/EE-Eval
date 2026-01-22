import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/1762f110-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object for the Red-Black Tree page
class RBTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputNumber');
    this.insertButton = page.locator('button[onclick="insertNode()"]');
    this.tree = page.locator('#tree');
    this.nodeLocator = (text) => this.page.locator('#tree .node', { hasText: String(text) });
    this.allNodes = () => this.page.locator('#tree .node');
    this.allLines = () => this.page.locator('#tree .line');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure page has loaded expected controls
    await expect(this.input).toBeVisible();
    await expect(this.insertButton).toBeVisible();
    await expect(this.tree).toBeVisible();
  }

  async insertNode(value) {
    // Use fill to simulate user typing (works for number input as well)
    await this.input.fill(String(value));
    await this.insertButton.click();
  }

  async getNodeCount() {
    return await this.allNodes().count();
  }

  async getLineCount() {
    return await this.allLines().count();
  }

  async hasNodeWithText(text) {
    const locator = this.nodeLocator(text);
    return await locator.count() > 0;
  }

  async getNodeClassesWithText(text) {
    const locator = this.nodeLocator(text);
    const count = await locator.count();
    const classes = [];
    for (let i = 0; i < count; i++) {
      classes.push(await locator.nth(i).getAttribute('class'));
    }
    return classes;
  }

  async getInputValue() {
    return await this.input.inputValue();
  }
}

test.describe('Red-Black Tree Visualization - FSM validation', () => {
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console errors and page errors for assertions
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // Collect runtime errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Collect console.error messages
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    // Nothing to clean up globally; tests clean up their own state by reloading the page
  });

  test.describe('S0_Idle (Initial state) - renderPage()', () => {
    test('Initial render shows input, button and empty tree (Idle state)', async ({ page }) => {
      // Validate that the page renders the expected components per FSM evidence.
      const rbt = new RBTPage(page);
      await rbt.goto();

      // Expect the numeric input and insert button present (evidence of S0_Idle)
      await expect(rbt.input).toBeVisible();
      await expect(rbt.insertButton).toBeVisible();

      // The tree should be empty on initial load (no .node elements)
      await expect(rbt.allNodes()).toHaveCount(0);

      // No runtime/page errors on initial load
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition: InsertNode (S0_Idle -> S1_NodeInserted)', () => {
    test('Inserting a single node adds a node to the visualization and clears input', async ({ page }) => {
      // This test validates the transition actions including:
      // - rbt.insert(parseInt(input));
      // - document.getElementById("tree").innerHTML = '';
      // - rbt.visualizeTree() (visual evidence)
      const rbt = new RBTPage(page);
      await rbt.goto();

      // Insert node with value 10
      await rbt.insertNode(10);

      // After insertion, tree should contain a node with text '10'
      await page.waitForSelector('#tree .node:has-text("10")');
      expect(await rbt.hasNodeWithText('10')).toBe(true);

      // The inserted root node is set to black when it has no parent
      const classes = await rbt.getNodeClassesWithText('10');
      // At least one node with text '10' exists; ensure class includes 'black'
      expect(classes.some(c => c && c.split(/\s+/).includes('black'))).toBe(true);

      // Input should be cleared after insertion
      expect(await rbt.getInputValue()).toBe('');

      // No runtime errors produced during normal insert
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Inserting multiple nodes produces multiple node elements and lines', async ({ page }) => {
      // Validate that subsequent inserts update the DOM and show multiple nodes and connecting lines
      const rbt = new RBTPage(page);
      await rbt.goto();

      // Insert a sequence: 30, 20, 40, 10, 25
      const values = [30, 20, 40, 10, 25];
      for (const v of values) {
        await rbt.insertNode(v);
        // Wait briefly for visualization to update
        await page.waitForTimeout(50);
      }

      // There should be at least as many .node elements as unique inserted values
      const nodeCount = await rbt.getNodeCount();
      expect(nodeCount).toBeGreaterThanOrEqual(values.length);

      // There should be some line elements created for child connections
      const lineCount = await rbt.getLineCount();
      expect(lineCount).toBeGreaterThanOrEqual(1);

      // Check that each inserted value is present as a node (text-based)
      for (const v of values) {
        expect(await rbt.hasNodeWithText(String(v))).toBe(true);
      }

      // No runtime errors during multi-insert
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking Insert Node with empty input should not modify the tree (edge case)', async ({ page }) => {
      // This validates the guard: if (input) { ... } prevents operations on empty input
      const rbt = new RBTPage(page);
      await rbt.goto();

      // Insert one node to establish a non-empty tree state
      await rbt.insertNode(7);
      await page.waitForSelector('#tree .node:has-text("7")');
      const countBefore = await rbt.getNodeCount();

      // Ensure input is empty
      await rbt.input.fill('');
      // Click Insert Node with empty input
      await rbt.insertButton.click();
      // Wait a bit for any unexpected changes
      await page.waitForTimeout(50);

      // Tree should remain unchanged
      const countAfter = await rbt.getNodeCount();
      expect(countAfter).toBe(countBefore);

      // No runtime errors produced by clicking insert with empty input
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Inserting a non-numeric value (via fill) results in NaN node being inserted (edge case)', async ({ page }) => {
      // The input is type="number" but filling arbitrary text via Playwright simulates
      // a user trying to submit bad input. The application uses parseInt on the value,
      // and if the raw input string is truthy it will attempt insertion.
      const rbt = new RBTPage(page);
      await rbt.goto();

      // Fill a non-numeric string - browsers allow setting input.value via scripting
      await rbt.input.fill('abc');
      await rbt.insertButton.click();

      // The code will call parseInt('abc') -> NaN; the tree should render a node with text 'NaN'
      // Wait for a node containing 'NaN'
      await page.waitForSelector('#tree .node:has-text("NaN")');
      expect(await rbt.hasNodeWithText('NaN')).toBe(true);

      // After insertion the input should be cleared
      expect(await rbt.getInputValue()).toBe('');

      // No unhandled runtime errors should have occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('FSM State Evidence and Actions Verification', () => {
    test('S1_NodeInserted evidence: rbt.insert and tree cleared before visualizeTree', async ({ page }) => {
      // This test inspects the observable outcomes that demonstrate the transition actions:
      // - rbt.insert(...) results in nodes present in tree
      // - document.getElementById("tree").innerHTML = '' leads to a fresh rendering (we observe replaced DOM)
      const rbt = new RBTPage(page);
      await rbt.goto();

      // Insert two nodes sequentially and verify each insertion results in a fresh redraw
      // Insert first value
      await rbt.insertNode(100);
      await page.waitForSelector('#tree .node:has-text("100")');
      const nodesAfterFirst = await rbt.getNodeCount();

      // Modify DOM artificially by adding a dummy node to detect if innerHTML was cleared on next insert
      // We will add this dummy purely via page.evaluate (not altering app code) to check clearing behavior.
      // This does NOT patch app code; it simulates a transient DOM change to observe clearing behavior.
      await page.evaluate(() => {
        const tree = document.getElementById('tree');
        const dummy = document.createElement('div');
        dummy.id = 'dummy-marker';
        dummy.innerText = 'DUMMY';
        tree.appendChild(dummy);
      });

      // Confirm dummy exists
      await expect(page.locator('#tree #dummy-marker')).toBeVisible();

      // Insert second value which should clear the tree element first (innerHTML = '')
      await rbt.input.fill('200');
      await rbt.insertButton.click();
      await page.waitForSelector('#tree .node:has-text("200")');

      // Dummy marker should have been removed by the innerHTML clearing operation
      const dummyCount = await page.locator('#tree #dummy-marker').count();
      expect(dummyCount).toBe(0);

      // Ensure at least one node exists and contains the newly inserted '200'
      expect(await rbt.hasNodeWithText('200')).toBe(true);

      // The number of nodes after re-render may be different; but we assert the clearing behavior occurred
      expect(await rbt.getNodeCount()).toBeGreaterThanOrEqual(1);

      // No runtime/page errors during this behavior check
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});