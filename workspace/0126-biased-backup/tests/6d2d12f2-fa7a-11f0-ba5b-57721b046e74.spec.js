import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2d12f2-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the AVL Tree page
class AVLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      nodeValue: '#nodeValue',
      randomCount: '#randomCount',
      nodeSize: '#nodeSize',
      treeSpacing: '#treeSpacing',
      animationSpeed: '#animationSpeed',
      insertBtn: "button[onclick='insertNode()']",
      deleteBtn: "button[onclick='deleteNode()']",
      findBtn: "button[onclick='findNode()']",
      clearBtn: "button[onclick='clearTree()']",
      generateRandomBtn: "button[onclick='generateRandomTree()']",
      generateBalancedBtn: "button[onclick='generateBalancedTree()']",
      toggleDetailsBtn: "button[onclick='toggleDetails()']",
      inorderBtn: "button[onclick=\"traverse('inorder')\"]",
      preorderBtn: "button[onclick=\"traverse('preorder')\"]",
      postorderBtn: "button[onclick=\"traverse('postorder')\"]",
      levelorderBtn: "button[onclick=\"traverse('levelorder')\"]",
      canvas: '#treeCanvas',
      treeStats: '#treeStats',
      operationLog: '#operationLog',
      traversalResult: '#traversalResult'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure initial draw/update calls have taken place
    await this.page.waitForTimeout(50);
  }

  async fillNodeValue(value) {
    await this.page.fill(this.selectors.nodeValue, String(value));
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async getTreeStatsText() {
    return this.page.textContent(this.selectors.treeStats);
  }

  async getOperationLogText() {
    return this.page.textContent(this.selectors.operationLog);
  }

  async getTraversalResultText() {
    return this.page.textContent(this.selectors.traversalResult);
  }

  async setRangeValue(selector, value) {
    await this.page.evaluate(
      (sel, val) => {
        const el = document.querySelector(sel);
        if (!el) return;
        el.value = String(val);
        // dispatch change event for inputs that listen to onchange
        const ev = new Event('change', { bubbles: true });
        el.dispatchEvent(ev);
      },
      selector,
      value
    );
  }

  // Helper to capture JS state from the page safely (no writing)
  async evaluate(fn) {
    return this.page.evaluate(fn);
  }
}

test.describe('AVL Tree Interactive Visualization - FSM and UI validation', () => {
  // Collect console.error and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Nothing global to initialize beyond navigation per test
  });

  test.describe('Initial state (S0_Idle) and basic UI checks', () => {
    test('Initial Idle state: tree stats and operation log reflect empty tree', async ({ page }) => {
      const avl = new AVLPage(page);
      await avl.goto();

      // Validate tree stats show zero nodes, height 0, balanced yes
      const stats = await avl.getTreeStatsText();
      expect(stats).toBeTruthy();
      expect(stats).toContain('Nodes: 0');
      expect(stats).toContain('Height: 0');
      expect(stats).toContain('Balanced: Yes');

      // Validate initial operation log shows 'No operations yet'
      const opLog = await avl.getOperationLogText();
      expect(opLog).toBe('No operations yet');

      // Canvas exists and has expected size attributes
      const canvasExists = await page.$(avl.selectors.canvas);
      expect(canvasExists).not.toBeNull();
      const canvasDimensions = await page.evaluate(() => {
        const c = document.getElementById('treeCanvas');
        return { w: c.width, h: c.height };
      });
      expect(canvasDimensions.w).toBe(1200);
      expect(canvasDimensions.h).toBe(600);
    });
  });

  test.describe('Events that are expected to surface runtime errors (validate natural errors)', () => {
    // We intentionally do NOT patch or fix the page. We observe runtime errors that occur naturally.

    test('InsertNode: clicking Insert with a valid numeric value results in a runtime error (TypeError) due to operations name conflict', async ({ page }) => {
      const avl = new AVLPage(page);
      await avl.goto();

      // Capture console.error and page errors
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(String(err.message || err)));

      await avl.fillNodeValue(42);

      // Click insert, which is expected to cause a TypeError when calling this.operations(...)
      await avl.click(avl.selectors.insertBtn);

      // Give the page a moment to process and emit console/page errors
      await page.waitForTimeout(200);

      // We expect at least one error either in console or pageerror
      const hasTypeError =
        consoleErrors.some(txt => /TypeError|not a function/i.test(txt)) ||
        pageErrors.some(txt => /TypeError|not a function/i.test(txt));

      expect(hasTypeError).toBeTruthy();
    });

    test('DeleteNode: clicking Delete with a valid numeric value results in a runtime error (TypeError)', async ({ page }) => {
      const avl = new AVLPage(page);
      await avl.goto();

      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(String(err.message || err)));

      await avl.fillNodeValue(42);
      await avl.click(avl.selectors.deleteBtn);

      await page.waitForTimeout(200);

      const hasTypeError =
        consoleErrors.some(txt => /TypeError|not a function/i.test(txt)) ||
        pageErrors.some(txt => /TypeError|not a function/i.test(txt));

      expect(hasTypeError).toBeTruthy();
    });

    test('ClearTree: clicking Clear Tree surfaces a runtime error when clearing operations array', async ({ page }) => {
      const avl = new AVLPage(page);
      await avl.goto();

      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(String(err.message || err)));

      await avl.click(avl.selectors.clearBtn);

      await page.waitForTimeout(200);

      const hasTypeError =
        consoleErrors.some(txt => /TypeError|not a function/i.test(txt)) ||
        pageErrors.some(txt => /TypeError|not a function/i.test(txt));

      expect(hasTypeError).toBeTruthy();
    });

    test('GenerateRandomTree: clicking Generate Random Tree surfaces runtime error (TypeError) from tree.clear/this.operations conflict', async ({ page }) => {
      const avl = new AVLPage(page);
      await avl.goto();

      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(String(err.message || err)));

      // set count to a small valid value and click
      await page.fill(avl.selectors.randomCount, '5');
      await avl.click(avl.selectors.generateRandomBtn);

      await page.waitForTimeout(300);

      const hasTypeError =
        consoleErrors.some(txt => /TypeError|not a function/i.test(txt)) ||
        pageErrors.some(txt => /TypeError|not a function/i.test(txt));

      expect(hasTypeError).toBeTruthy();
    });

    test('GenerateBalancedTree: clicking Generate Balanced Tree surfaces runtime error (TypeError) during build', async ({ page }) => {
      const avl = new AVLPage(page);
      await avl.goto();

      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(String(err.message || err)));

      await page.fill(avl.selectors.randomCount, '5');
      await avl.click(avl.selectors.generateBalancedBtn);

      await page.waitForTimeout(300);

      const hasTypeError =
        consoleErrors.some(txt => /TypeError|not a function/i.test(txt)) ||
        pageErrors.some(txt => /TypeError|not a function/i.test(txt));

      expect(hasTypeError).toBeTruthy();
    });
  });

  test.describe('Events and interactions that should NOT crash and should update UI (ToggleDetails, UpdateVisualization, Traversals, Find on empty)', () => {
    test('ToggleDetails toggles the showDetails flag and updates drawing without runtime errors', async ({ page }) => {
      const avl = new AVLPage(page);
      await avl.goto();

      // Capture page errors
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(String(err.message || err)));

      // showDetails should be true initially
      const initialShow = await page.evaluate(() => typeof showDetails !== 'undefined' ? showDetails : null);
      expect(initialShow).toBe(true);

      // Click toggle - should flip
      await avl.click(avl.selectors.toggleDetailsBtn);
      await page.waitForTimeout(50);
      const afterToggle = await page.evaluate(() => showDetails);
      expect(afterToggle).toBe(false);

      // Click again - should flip back
      await avl.click(avl.selectors.toggleDetailsBtn);
      await page.waitForTimeout(50);
      const afterSecond = await page.evaluate(() => showDetails);
      expect(afterSecond).toBe(true);

      // No page errors should have been thrown during toggling
      expect(pageErrors.length).toBe(0);
    });

    test('UpdateVisualization via range inputs triggers draw without errors', async ({ page }) => {
      const avl = new AVLPage(page);
      await avl.goto();

      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(String(err.message || err)));

      // Change node size and spacing which have onchange handlers
      await avl.setRangeValue(avl.selectors.nodeSize, 60);
      await page.waitForTimeout(50);
      await avl.setRangeValue(avl.selectors.treeSpacing, 200);
      await page.waitForTimeout(50);

      // No page errors expected
      expect(pageErrors).toHaveLength(0);

      // Ensure input values took effect
      const nodeSizeVal = await page.$eval(avl.selectors.nodeSize, el => el.value);
      const spacingVal = await page.$eval(avl.selectors.treeSpacing, el => el.value);
      expect(Number(nodeSizeVal)).toBe(60);
      expect(Number(spacingVal)).toBe(200);
    });

    test('Traverse buttons on empty tree produce traversal result text and do not throw errors', async ({ page }) => {
      const avl = new AVLPage(page);
      await avl.goto();

      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(String(err.message || err)));

      // Click inorder traversal
      await avl.click(avl.selectors.inorderBtn);
      // Allow animation interval to run and clear
      await page.waitForTimeout(600);
      const inorderText = await avl.getTraversalResultText();
      expect(inorderText).toContain('INORDER Traversal:');

      // Click preorder traversal
      await avl.click(avl.selectors.preorderBtn);
      await page.waitForTimeout(600);
      const preorderText = await avl.getTraversalResultText();
      expect(preorderText).toContain('PREORDER Traversal:');

      // Click postorder traversal
      await avl.click(avl.selectors.postorderBtn);
      await page.waitForTimeout(600);
      const postorderText = await avl.getTraversalResultText();
      expect(postorderText).toContain('POSTORDER Traversal:');

      // Click levelorder traversal
      await avl.click(avl.selectors.levelorderBtn);
      await page.waitForTimeout(600);
      const levelText = await avl.getTraversalResultText();
      expect(levelText).toContain('LEVELORDER Traversal:');

      // Ensure no page errors were thrown
      expect(pageErrors.length).toBe(0);
    });

    test('FindNode on empty tree: clicking Find with a value yields no highlight and no runtime errors', async ({ page }) => {
      const avl = new AVLPage(page);
      await avl.goto();

      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(String(err.message || err)));

      await avl.fillNodeValue(7);
      await avl.click(avl.selectors.findBtn);

      // findNode sets highlightedNode then clears it after timeout if found.
      // On empty tree, nothing should be highlighted. We wait briefly to ensure any timeouts would have run.
      await page.waitForTimeout(150);

      // Inspect highlightedNode state
      const highlighted = await page.evaluate(() => (typeof tree !== 'undefined' ? tree.highlightedNode : null));
      expect(highlighted).toBeNull();

      // Operation log should remain unchanged since find does not push operations
      const opLog = await avl.getOperationLogText();
      // It might be the initial "No operations yet" or empty due to earlier failures; ensure it did not contain "Inserted" or "Deleted"
      expect(opLog).not.toContain('Inserted');
      expect(opLog).not.toContain('Deleted');

      // Ensure no page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and invalid inputs', () => {
    test('Clicking Insert with invalid (empty) input should be a no-op and not crash', async ({ page }) => {
      const avl = new AVLPage(page);
      await avl.goto();

      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => pageErrors.push(String(err.message || err)));

      // Ensure nodeValue is empty
      await page.fill(avl.selectors.nodeValue, '');

      // Click Insert - insertNode should return early due to isNaN check
      await avl.click(avl.selectors.insertBtn);

      await page.waitForTimeout(150);

      // No errors expected
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // Operation log should remain initial or unchanged
      const opLog = await avl.getOperationLogText();
      expect(opLog).toBeTruthy();
    });

    test('Set invalid randomCount (e.g., 0 or >50) and click Generate Random Tree should be ignored without throwing', async ({ page }) => {
      const avl = new AVLPage(page);
      await avl.goto();

      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(String(err.message || err)));

      // invalid low
      await page.fill(avl.selectors.randomCount, '0');
      await avl.click(avl.selectors.generateRandomBtn);
      await page.waitForTimeout(100);

      // invalid high
      await page.fill(avl.selectors.randomCount, '999');
      await avl.click(avl.selectors.generateRandomBtn);
      await page.waitForTimeout(100);

      // No page errors expected for invalid parameter checks
      expect(pageErrors.length).toBeGreaterThanOrEqual(0);
      // There should be no thrown errors (pageErrors remains empty)
      expect(pageErrors.length).toBe(0);
    });
  });
});