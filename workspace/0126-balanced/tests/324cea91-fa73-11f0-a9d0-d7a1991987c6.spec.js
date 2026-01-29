import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324cea91-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Red-Black Tree page
class RBTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getInputHandle() {
    return this.page.$('#value');
  }

  async getInsertButton() {
    return this.page.$('button[onclick="insert()"]');
  }

  async setInputValue(value) {
    const input = await this.getInputHandle();
    await input.fill(String(value));
  }

  async clickInsert() {
    const btn = await this.getInsertButton();
    await btn.click();
  }

  // Returns array of node text contents in the order they appear in the DOM
  async getDisplayedNodeTexts() {
    return this.page.$$eval('.node', nodes => nodes.map(n => n.innerText.trim()));
  }

  async getDisplayedNodeClasses() {
    return this.page.$$eval('.node', nodes => nodes.map(n => n.className));
  }

  async getLineCount() {
    return this.page.$$eval('.line', els => els.length);
  }

  async getTreeInnerHTML() {
    return this.page.$eval('#tree', el => el.innerHTML);
  }

  async getInputValue() {
    return this.page.$eval('#value', el => el.value);
  }

  // Access tree properties in page context safely to verify root exists and is not TNULL after inserts
  async getTreeRootData() {
    return this.page.evaluate(() => {
      if (!window.tree) return null;
      const root = window.tree.root;
      // Avoid serializing nodes with cyclic refs; only return sentinel check and data/color if present
      if (!root) return null;
      const isTNULL = root === window.tree.TNULL;
      return {
        isTNULL,
        data: isTNULL ? null : root.data,
        color: isTNULL ? window.tree.TNULL.color : root.color
      };
    });
  }
}

test.describe('Red-Black Tree Visualization - FSM states and transitions', () => {
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Collect console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture dialogs (alerts) triggered by the page
    page.on('dialog', async dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.dismiss(); // Dismiss to allow test to continue
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Safety: remove listeners to avoid cross-test leakage (Playwright will often clean up page)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
    page.removeAllListeners('dialog');
  });

  test('S0_Idle: page loads with input, insert button, and empty tree (initial state)', async ({ page }) => {
    // Validate page UI elements and initial FSM Idle evidence
    const rb = new RBTreePage(page);

    // Input exists and has correct placeholder
    const input1 = await rb.getInputHandle();
    expect(input).not.toBeNull();
    const placeholder = await page.$eval('#value', el => el.getAttribute('placeholder'));
    expect(placeholder).toBe('Enter value');

    // Insert button exists
    const btn1 = await rb.getInsertButton();
    expect(btn).not.toBeNull();
    const btnText = await page.$eval('button[onclick="insert()"]', el => el.innerText.trim());
    expect(btnText).toBe('Insert');

    // Tree container exists and is initially empty (Idle state -> no displayed nodes)
    const treeHTML = await rb.getTreeInnerHTML();
    expect(treeHTML.trim()).toBe('');

    // No console errors or page errors should have occurred on initial load
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('InsertValue event transitions Idle -> TreeUpdated: inserting a single value updates DOM', async ({ page }) => {
    // This test validates the FSM transition from S0_Idle to S1_TreeUpdated when Insert is clicked with a valid value.
    const rb1 = new RBTreePage(page);

    // Insert a single value
    await rb.setInputValue(10);
    await rb.clickInsert();

    // After insert, input should be cleared (as per implementation)
    const inputValue = await rb.getInputValue();
    expect(inputValue).toBe('');

    // Tree should have one displayed node with the inserted value
    const nodeTexts = await rb.getDisplayedNodeTexts();
    expect(nodeTexts.length).toBeGreaterThanOrEqual(1); // At least one node (the inserted one) should be displayed
    // It should contain '10' somewhere in the displayed nodes
    expect(nodeTexts).toContain('10');

    // Root should be black after insert (fixInsert sets root.color = 'black')
    const nodeClasses = await rb.getDisplayedNodeClasses();
    // Find the node element that contains '10' and assert it has 'black' in its className
    const indexOf10 = nodeTexts.indexOf('10');
    expect(indexOf10).toBeGreaterThanOrEqual(0);
    const classOf10 = nodeClasses[indexOf10];
    expect(classOf10).toMatch(/black/);

    // Confirm that the tree object on the window reflects a non-sentinel root
    const rootInfo = await rb.getTreeRootData();
    expect(rootInfo).not.toBeNull();
    expect(rootInfo.isTNULL).toBe(false);
    expect(rootInfo.data).toBe(10);
    expect(rootInfo.color).toBe('black');

    // Check there were no page errors during this transition and no console error messages
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('S1_TreeUpdated: inserting additional values updates structure, colors and produces lines for red nodes', async ({ page }) => {
    // This test inserts multiple values to create red/black children and checks visual feedback (node classes and lines)
    const rb2 = new RBTreePage(page);

    // Insert root
    await rb.setInputValue(20);
    await rb.clickInsert();

    // Insert a left child value to force more complex balancing (e.g., 10)
    await rb.setInputValue(10);
    await rb.clickInsert();

    // Insert a right child value (e.g., 30)
    await rb.setInputValue(30);
    await rb.clickInsert();

    // Collect displayed nodes and classes after multiple inserts
    const texts = await rb.getDisplayedNodeTexts();
    const classes = await rb.getDisplayedNodeClasses();

    // We expect at least three nodes displayed
    expect(texts.length).toBeGreaterThanOrEqual(3);

    // There should be at least one red node among displayed nodes (internal coloring behavior may vary with rotations)
    const hasRed = classes.some(c => c.includes('red'));
    expect(hasRed).toBe(true);

    // The display function appends .line elements for non-black nodes; if there's any red node, line count should be > 0
    const lineCount = await rb.getLineCount();
    expect(lineCount).toBeGreaterThanOrEqual(1);

    // No page-level errors occurred during these manipulations
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Edge case: clicking Insert with empty input triggers alert and does not modify the tree', async ({ page }) => {
    // This test validates error handling branch where user clicks Insert with no value
    const rb3 = new RBTreePage(page);

    // Ensure tree is initially empty
    let initialHTML = await rb.getTreeInnerHTML();
    expect(initialHTML.trim()).toBe('');

    // Click insert without entering a value
    await rb.clickInsert();

    // We expect a dialog to have appeared with the exact message from the implementation
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const alertDialog = dialogs.find(d => d.type === 'alert' || d.type === 'beforeunload' || d.type === 'confirm');
    expect(alertDialog).toBeTruthy();
    // Verify the alert text
    expect(alertDialog.message).toBe('Please enter a valid number.');

    // Tree should still be empty (no DOM changes)
    const afterHTML = await rb.getTreeInnerHTML();
    expect(afterHTML.trim()).toBe('');

    // No uncaught page errors were thrown (the alert is expected and handled)
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Robustness: inserting duplicate and non-integer inputs (non-integer becomes integer via parseInt)', async ({ page }) => {
    // This test checks how the insertion handles duplicates and non-integer strings (parseInt behavior)
    const rb4 = new RBTreePage(page);

    // Insert a numeric value
    await rb.setInputValue('42');
    await rb.clickInsert();

    // Insert a duplicate value '42' again
    await rb.setInputValue('42');
    await rb.clickInsert();

    // Insert a value with extra characters; parseInt('15abc') => 15
    await rb.setInputValue('15abc');
    await rb.clickInsert();

    // Insert a value that results in NaN for parseInt '' or non-numeric leading => clicking insert with empty handled previously
    // For a value like 'abc', parseInt returns NaN; but form input of type=number will prevent non-numeric entries in many browsers.
    // We still attempt to set it (Playwright can fill it) and click; implementation checks if (value) so 'abc' is truthy and parseInt('abc') -> NaN.
    // The tree.insert will insert NaN; we let it happen and ensure page does not crash.
    await rb.setInputValue('abc');
    await rb.clickInsert();

    // After these inserts, ensure the page has not thrown errors
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);

    // There should be at least three .node elements (42, maybe duplicate, 15)
    const nodes = await rb.getDisplayedNodeTexts();
    expect(nodes.length).toBeGreaterThanOrEqual(3);

    // Confirm that '15' (from '15abc') appears in the displayed node texts
    expect(nodes).toContain('15');

    // If NaN was inserted from 'abc', it might be displayed as 'NaN' (string). Verify that insertion of 'abc' did not crash the page.
    // Presence of 'NaN' is acceptable as long as no uncaught exceptions occurred.
    // We do not assert presence/absence of 'NaN' specifically because behavior can vary; only check for no errors.
  });

  test('Console and page errors monitoring: assert no unexpected runtime errors occurred during test suite interactions', async ({ page }) => {
    // This test consolidates console and page error observations collected in beforeEach and during previous interactions.
    // It validates that the page did not produce runtime exceptions (ReferenceError/SyntaxError/TypeError).
    // Note: Because each test has its own fresh page and listeners, here we just navigate and perform a simple operation to ensure the page remains stable.

    const rb5 = new RBTreePage(page);
    await rb.goto();

    // Perform a quick insert to exercise code paths
    await rb.setInputValue(7);
    await rb.clickInsert();

    // Inspect collected errors and console messages
    const errorTypes = pageErrors.map(e => e && e.name ? `${e.name}: ${e.message}` : String(e));
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);

    // Assert there are no page-level uncaught errors
    expect(pageErrors.length).toBe(0);

    // Assert there are no console.error logs
    expect(consoleErrorMessages.length).toBe(0);

    // For clarity in failure cases, include their contents in expectation messages (Playwright will show these)
    if (pageErrors.length > 0) {
      console.error('Captured page errors:', errorTypes);
    }
    if (consoleErrorMessages.length > 0) {
      console.error('Captured console.error messages:', consoleErrorMessages);
    }
  });
});