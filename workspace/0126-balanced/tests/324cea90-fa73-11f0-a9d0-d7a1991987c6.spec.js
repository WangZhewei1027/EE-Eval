import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324cea90-fa73-11f0-a9d0-d7a1991987c6.html';

// Page object for interacting with the AVL visualization page
class AVLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages and page errors for assertions
    this.page.on('console', msg => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isButtonPresent() {
    return await this.page.$("button[onclick='insertNode()']") !== null;
  }

  async isInputPresent() {
    return await this.page.$('#nodeValue') !== null;
  }

  async getTreeContainer() {
    return await this.page.$('#tree-container');
  }

  async getNodeCount() {
    return await this.page.$$eval('#tree-container .node', nodes => nodes.length);
  }

  async getLinkCount() {
    return await this.page.$$eval('#tree-container .link', links => links.length);
  }

  async getNodeValues() {
    return await this.page.$$eval('#tree-container .node', nodes => nodes.map(n => n.innerText));
  }

  async getInputValue() {
    return await this.page.$eval('#nodeValue', el => el.value);
  }

  async fillInput(value) {
    await this.page.fill('#nodeValue', String(value));
  }

  async clickInsert() {
    await this.page.click("button[onclick='insertNode()']");
  }

  async getGlobalAvlRootValue() {
    // Read the global avlTree.root.value if available; return null if not available
    return await this.page.evaluate(() => {
      try {
        if (window.avlTree && window.avlTree.root) {
          return window.avlTree.root.value;
        }
        return null;
      } catch (e) {
        // If reading throws for some reason, propagate the error message
        return { __error__: String(e) };
      }
    });
  }
}

test.describe('AVL Tree Visualization (324cea90-fa73-11f0-a9d0-d7a1991987c6)', () => {

  // Validate the Idle state (S0_Idle)
  test('Idle state on load: UI elements present and tree empty', async ({ page }) => {
    const app = new AVLPage(page);
    await app.goto();

    // Verify no runtime page errors occurred during load
    expect(app.pageErrors.length).toBe(0);

    // The Idle state should render the basic UI
    expect(await app.isInputPresent()).toBeTruthy();
    expect(await app.isButtonPresent()).toBeTruthy();

    // The FSM's S0 entry_action indicates renderTree() should run on entry.
    // The actual implementation does not call renderTree on load, so the expected
    // visual evidence is an empty tree container (no .node elements).
    const nodeCount = await app.getNodeCount();
    expect(nodeCount).toBe(0);

    // Ensure tree container exists
    const container = await app.getTreeContainer();
    expect(container).not.toBeNull();

    // No console errors emitted
    const errors = app.consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  // Validate the InsertNode transition and S1_NodeInserted state
  test('Insert Node transition: inserting single node updates visualization and clears input', async ({ page }) => {
    const app = new AVLPage(page);
    await app.goto();

    // Insert a single value and verify DOM updates
    await app.fillInput(10);

    // Sanity check that input has the value before clicking
    expect(await app.getInputValue()).toBe('10');

    await app.clickInsert();

    // After insertion, renderTree() should have created one node with innerText '10'
    await page.waitForSelector('#tree-container .node'); // wait for at least one node

    const nodeCount = await app.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(1); // at least the inserted node

    const values = await app.getNodeValues();
    expect(values).toContain('10');

    // The input should be cleared by the implementation after a successful insert
    expect(await app.getInputValue()).toBe('');

    // The global avlTree.root should reflect the inserted value
    const rootValue = await app.getGlobalAvlRootValue();
    expect(rootValue).toBe(10);

    // Observe that S1 entry action renderTree resulted in DOM update: at least one .node exists
    expect(await app.getNodeCount()).toBeGreaterThan(0);

    // Ensure no unexpected page errors after insert
    expect(app.pageErrors.length).toBe(0);
  });

  // Test AVL balancing behavior using a sequence that should cause rotation
  test('AVL balancing: insert [30, 20, 10] results in a balanced tree with root 20', async ({ page }) => {
    const app = new AVLPage(page);
    await app.goto();

    // Insert 30, 20, 10 in that order to trigger a right rotation (LL case)
    await app.fillInput(30);
    await app.clickInsert();
    await page.waitForSelector('#tree-container .node');

    await app.fillInput(20);
    await app.clickInsert();

    await app.fillInput(10);
    await app.clickInsert();

    // Wait for DOM updates
    await page.waitForTimeout(200); // small pause to let rendering complete

    // Expect three node elements in the container
    const nodeCount = await app.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(3);

    // Expect a node with value '20' to be present and, per AVL logic, be the root
    const values = await app.getNodeValues();
    expect(values).toContain('20');

    // Verify the global avlTree.root value is 20 (evidence that internal rotation happened)
    const rootValue = await app.getGlobalAvlRootValue();
    // rootValue might be null if avlTree not accessible; assert accordingly
    expect(rootValue).toBe(20);

    // There should be two links for a root with two children (if layout created them)
    const linkCount = await app.getLinkCount();
    // The visualization creates a link for each child: with 3 nodes, we expect at least 2 links
    expect(linkCount).toBeGreaterThanOrEqual(2);

    // Ensure no page errors occurred
    expect(app.pageErrors.length).toBe(0);
  });

  // Edge case: clicking insert with empty input should trigger an alert and not insert a node
  test('Edge case: clicking Insert Node with empty input shows alert and does not modify tree', async ({ page }) => {
    const app = new AVLPage(page);
    await app.goto();

    // Ensure input is empty
    await page.fill('#nodeValue', '');

    // Wait for dialog event when clicking
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      app.clickInsert(),
    ]);

    // Validate dialog message matches expected alert text from implementation
    expect(dialog.message()).toBe('Please enter a valid number');

    // Accept the alert so the test can continue
    await dialog.accept();

    // Verify no nodes were added
    const nodeCount = await app.getNodeCount();
    expect(nodeCount).toBe(0);

    // Ensure no page errors resulting from this interaction
    expect(app.pageErrors.length).toBe(0);
  });

  // Validate that the button uses the expected onclick attribute (evidence from FSM)
  test('Button has onclick attribute pointing to insertNode()', async ({ page }) => {
    const app = new AVLPage(page);
    await app.goto();

    // Query the button and assert it has the onclick attribute text
    const buttonHandle = await page.$("button[onclick='insertNode()']");
    expect(buttonHandle).not.toBeNull();

    // Ensure that the onclick attribute exists and includes the function name
    const onclickAttr = await buttonHandle.getAttribute('onclick');
    expect(onclickAttr).toBe('insertNode()');

    // No errors should have occurred
    expect(app.pageErrors.length).toBe(0);
  });

  // Observe console output and ensure no hidden runtime errors (smoke test)
  test('Console and runtime error monitoring during common interactions', async ({ page }) => {
    const app = new AVLPage(page);
    await app.goto();

    // Monitor console while performing some interactions
    await app.fillInput(5);
    await app.clickInsert();
    await page.waitForSelector('#tree-container .node');

    await app.fillInput(15);
    await app.clickInsert();
    await page.waitForSelector('#tree-container .node');

    // Small timeout to allow any asynchronous errors to surface
    await page.waitForTimeout(100);

    // Assert that there were no uncaught page errors
    expect(app.pageErrors.length).toBe(0);

    // Assert there are no console.error messages
    const consoleErrors = app.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});