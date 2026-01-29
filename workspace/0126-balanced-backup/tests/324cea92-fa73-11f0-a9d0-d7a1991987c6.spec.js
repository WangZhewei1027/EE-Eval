import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324cea92-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object encapsulating interactions with the B-Tree page
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('input#input');
    this.insertButton = page.locator('button[onclick="insert()"]');
    this.tree = page.locator('#tree');
    this.nodeSelector = '#tree .node';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async insertNumber(n) {
    await this.input.fill(String(n));
    await this.insertButton.click();
  }

  async getTreeText() {
    return this.tree.innerText();
  }

  async getAllNodeTexts() {
    return this.page.locator(this.nodeSelector).allTextContents();
  }

  async inputValue() {
    return this.input.inputValue();
  }

  // Evaluate bTree object information from the page
  async evaluate(fn) {
    return this.page.evaluate(fn);
  }
}

test.describe('B-Tree Visualization - FSM and UI tests', () => {
  // Collects console errors and page errors for each test to assert on them
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console error messages
      if (msg.type() === 'error') {
        try {
          consoleErrors.push(msg.text());
        } catch (e) {
          consoleErrors.push(String(msg));
        }
      }
    });

    page.on('pageerror', (err) => {
      // capture uncaught exceptions
      pageErrors.push(err.message || String(err));
    });
  });

  test.afterEach(async () => {
    // After each test we assert there were no runtime errors in the page console or uncaught exceptions.
    // This follows the requirement to observe console logs and page errors and assert on them.
    expect(consoleErrors, `console.error messages: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('Initial Idle state: page renders input, button, and empty tree', async ({ page }) => {
    // This test validates the S0_Idle state rendering and entry action renderPage()
    const btPage = new BTreePage(page);
    await btPage.goto();

    // Verify main controls exist
    await expect(btPage.input).toBeVisible();
    await expect(btPage.insertButton).toBeVisible();
    await expect(btPage.tree).toBeVisible();

    // The input should have the placeholder "Enter a number"
    expect(await btPage.input.getAttribute('placeholder')).toBe('Enter a number');

    // Tree should be empty initially (no node elements or empty innerText)
    const nodeCount = await page.locator(btPage.nodeSelector).count();
    expect(nodeCount).toBe(0);
    const treeText = await btPage.getTreeText();
    expect(treeText.trim()).toBe('');

    // Verify the BTree object exists on the page and has initial root node
    const hasBTree = await btPage.evaluate(() => typeof window.bTree !== 'undefined' && window.bTree !== null);
    expect(hasBTree).toBe(true);

    // The root keys array should be empty initially
    const rootKeys = await btPage.evaluate(() => window.bTree.root.keys);
    expect(Array.isArray(rootKeys)).toBe(true);
    expect(rootKeys.length).toBe(0);
  });

  test('InsertNumber event: inserting a valid number transitions to NumberInserted and updates DOM', async ({ page }) => {
    // This test validates the InsertNumber event and the transition S0_Idle -> S1_NumberInserted
    const btPage = new BTreePage(page);
    await btPage.goto();

    // Insert a single value and verify UI updates and bTree state
    await btPage.insertNumber(42);

    // After insert, input should be cleared
    expect(await btPage.inputValue()).toBe('');

    // Tree visualization should contain the inserted number
    const nodeTexts = await btPage.getAllNodeTexts();
    // There should be at least one node and one of them should include '42'
    expect(nodeTexts.length).toBeGreaterThanOrEqual(1);
    const concatenated = nodeTexts.join(' | ');
    expect(concatenated).toContain('42');

    // Verify the bTree data structure contains the value in the root keys (or somewhere in the tree)
    const contains42 = await btPage.evaluate(() => {
      function search(node) {
        if (!node) return false;
        if (node.keys.includes(42)) return true;
        for (let c of node.children || []) {
          if (search(c)) return true;
        }
        return false;
      }
      return search(window.bTree.root);
    });
    expect(contains42).toBe(true);
  });

  test('Inserting multiple numbers triggers splits and creates multiple nodes in visualization', async ({ page }) => {
    // This test inserts a sequence of numbers to exercise insertNonFull and splitChild logic,
    // ensuring the tree transitions to an internal (non-leaf) structure and DOM reflects multiple nodes.
    const btPage = new BTreePage(page);
    await btPage.goto();

    // Insert several numbers to force splits for t=2 (max keys per node = 3)
    const values = [10, 20, 5, 6, 12];
    for (const v of values) {
      await btPage.insertNumber(v);
    }

    // After multiple inserts, the visualization should show multiple .node elements (split happened)
    const nodes = await page.locator(btPage.nodeSelector).count();
    expect(nodes).toBeGreaterThan(1);

    // Ensure tree text contains all inserted numbers
    const allTexts = (await btPage.getAllNodeTexts()).join(' ');
    for (const v of values) {
      expect(allTexts).toContain(String(v));
    }

    // Verify the root is no longer necessarily the only node and may have keys (internal node)
    const rootIsLeaf = await btPage.evaluate(() => window.bTree.root.leaf);
    // root may or may not be leaf depending on insertion order; we at least expect keys to be present in structure
    const totalKeys = await btPage.evaluate(() => {
      let count = 0;
      function countKeys(n) {
        if (!n) return;
        count += n.keys.length;
        for (let c of n.children || []) countKeys(c);
      }
      countKeys(window.bTree.root);
      return count;
    });
    expect(totalKeys).toBeGreaterThanOrEqual(values.length);
  });

  test('Edge case: clicking Insert with empty or invalid input shows an alert (error scenario)', async ({ page }) => {
    // This test validates the alert path when input is invalid (S0_Idle -> stays S0_Idle with alert)
    const btPage = new BTreePage(page);
    await btPage.goto();

    // Ensure input is empty
    await btPage.input.fill('');
    // Listen for dialog
    const dialogPromise = page.waitForEvent('dialog');

    // Click Insert with empty input
    await btPage.insertButton.click();

    // Capture dialog and assert message
    const dialog = await dialogPromise;
    try {
      expect(dialog.message()).toBe('Please enter a valid number');
    } finally {
      await dialog.accept();
    }

    // Ensure tree remains unchanged (no nodes added)
    const nodeCountAfter = await page.locator(btPage.nodeSelector).count();
    expect(nodeCountAfter).toBe(0);
  });

  test('Verify draw() is invoked indirectly by checking DOM updates; no runtime exceptions during operations', async ({ page }) => {
    // This test replays a few operations and ensures the page does not emit page errors or console errors
    const btPage = new BTreePage(page);
    await btPage.goto();

    // Perform some inserts
    await btPage.insertNumber(1);
    await btPage.insertNumber(2);
    await btPage.insertNumber(3);

    // Ensure DOM contains expected nodes
    const nodeTexts = await btPage.getAllNodeTexts();
    expect(nodeTexts.join(' ')).toContain('1');
    expect(nodeTexts.join(' ')).toContain('2');
    expect(nodeTexts.join(' ')).toContain('3');

    // Additionally ensure the internal draw() result matches DOM by comparing total keys count in bTree to number of values inserted
    const totalKeys = await btPage.evaluate(() => {
      let keys = [];
      function collect(n) {
        if (!n) return;
        keys = keys.concat(n.keys);
        for (let c of n.children || []) collect(c);
      }
      collect(window.bTree.root);
      return keys.slice().sort((a, b) => a - b);
    });
    expect(totalKeys).toEqual([1, 2, 3]);

    // No explicit assertion on draw() invocation is possible without modifying page code.
    // We infer draw() was called because the DOM updated and bTree internal structure matches expectations.
  });
});