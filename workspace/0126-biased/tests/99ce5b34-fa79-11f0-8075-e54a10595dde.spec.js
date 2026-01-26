import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce5b34-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the B+ Tree Demo page
class BPlusTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.degreeInput = page.locator('#degree');
    this.valueInput = page.locator('#value');
    this.deleteInput = page.locator('#deleteValue');
    this.createButton = page.locator("button[onclick='createBPlusTree()']");
    this.insertButton = page.locator("button[onclick='insertValue()']");
    this.deleteButton = page.locator("button[onclick='deleteValue()']");
    this.showButton = page.locator("button[onclick='showTree()']");
    this.treePre = page.locator('#tree');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setDegree(degree) {
    await this.degreeInput.fill(String(degree));
  }

  async createTree() {
    await this.createButton.click();
  }

  async insertValue(value) {
    await this.valueInput.fill(String(value));
    await this.insertButton.click();
  }

  async deleteValue(value) {
    await this.deleteInput.fill(String(value));
    await this.deleteButton.click();
  }

  async showTree() {
    await this.showButton.click();
  }

  async getTreeText() {
    return (await this.treePre.textContent()) || '';
  }

  // helper to evaluate bPlusTree.display() in page context if present
  async getBPlusTreeDisplay() {
    return this.page.evaluate(() => {
      if (window.bPlusTree && typeof window.bPlusTree.display === 'function') {
        return window.bPlusTree.display();
      }
      return null;
    });
  }

  async hasBPlusTreeInstance() {
    return this.page.evaluate(() => {
      return typeof window.bPlusTree === 'object' && window.bPlusTree !== null;
    });
  }
}

test.describe('B+ Tree Demonstration - FSM state & transition tests', () => {
  let page;
  let app;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // create a new page per test to isolate state
    page = await browser.newPage();

    // capture console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture text for easier assertions
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    app = new BPlusTreePage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial Idle state: page renders inputs, buttons, and empty tree (S0_Idle)', async () => {
    // Validate presence of controls and initial state of the tree visual
    await expect(app.degreeInput).toBeVisible();
    await expect(app.valueInput).toBeVisible();
    await expect(app.deleteInput).toBeVisible();
    await expect(app.createButton).toBeVisible();
    await expect(app.insertButton).toBeVisible();
    await expect(app.deleteButton).toBeVisible();
    await expect(app.showButton).toBeVisible();

    // The initial tree area should be empty (no B+ Tree yet)
    const treeText = await app.getTreeText();
    expect(treeText.trim()).toBe('', 'Expected the tree display to be empty on initial render.');

    // No uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Create B+ Tree transition: clicking Create moves to TreeCreated (S0_Idle -> S1_TreeCreated)', async () => {
    // Comment: This validates the CreateTree event and S1 entry_action displayTree()
    await app.setDegree(3);
    await app.createTree();

    // The page's tree <pre> should contain the creation message as per implementation
    const treeText = await app.getTreeText();
    expect(treeText.trim()).toBe('B+ Tree has been created.');

    // The global bPlusTree instance should now exist
    const hasInstance = await app.hasBPlusTreeInstance();
    expect(hasInstance).toBe(true);

    // No uncaught page errors during create
    expect(pageErrors.length).toBe(0);
  });

  test('Insert Value transition from created tree: S1_TreeCreated -> S2_ValueInserted', async () => {
    // Comment: validate insert event and that tree display updates to include the inserted key
    await app.createTree();

    // Insert a single value and assert it's present in the tree display
    await app.insertValue(5);

    const treeText = await app.getTreeText();
    // The BPlusTree.display produces a string with keys; after one insert expect '5'
    expect(treeText).toContain('5');

    // Also verify that calling bPlusTree.display() in the page context matches DOM output
    const displayFromObject = await app.getBPlusTreeDisplay();
    expect(displayFromObject).not.toBeNull();
    expect(treeText.trim()).toBe(displayFromObject.trim());

    // No uncaught page errors during insert
    expect(pageErrors.length).toBe(0);
  });

  test('Insert without creating tree: edge case validation', async () => {
    // Comment: validate inserting before creating the tree produces a helpful message
    // Ensure bPlusTree is not created
    const hasInstanceBefore = await app.hasBPlusTreeInstance();
    expect(hasInstanceBefore).toBe(false);

    await app.insertValue(10);

    const treeText = await app.getTreeText();
    expect(treeText).toBe('Please create a B+ Tree first.');

    // No uncaught page errors on this invalid flow
    expect(pageErrors.length).toBe(0);
  });

  test('Delete Value transition: S1_TreeCreated -> S3_ValueDeleted and log observed', async () => {
    // Comment: the delete implementation logs the deletion attempt and re-displays the tree
    await app.createTree();

    // Insert some values first so display will show something
    await app.insertValue(7);
    await app.insertValue(3);

    const beforeDeleteText = await app.getTreeText();

    // Now attempt deletion; implementation logs to console
    await app.deleteValue(7);

    // The display uses bPlusTree.display() even though delete is a placeholder, so display should still exist
    const afterDeleteText = await app.getTreeText();
    expect(afterDeleteText).toBe(beforeDeleteText, 'Placeholder delete does not modify tree; display should be unchanged.');

    // Ensure console captured the delete attempt message
    const matchingLog = consoleMessages.find((m) => m.includes('Attempting to delete:') && m.includes('7'));
    expect(matchingLog).toBeTruthy();

    // No uncaught page errors during delete
    expect(pageErrors.length).toBe(0);
  });

  test('Delete without creating tree: edge case shows prompt to create tree first', async () => {
    // Comment: ensure delete before create shows the proper message
    const hasInstanceBefore = await app.hasBPlusTreeInstance();
    expect(hasInstanceBefore).toBe(false);

    await app.deleteValue(42);

    const treeText = await app.getTreeText();
    expect(treeText).toBe('Please create a B+ Tree first.');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Show Tree transitions: before create and after create/insert (S1_TreeCreated & S4_TreeDisplayed)', async () => {
    // Comment: ShowTree should indicate absence initially
    await app.showTree();
    const beforeCreate = await app.getTreeText();
    expect(beforeCreate).toBe('No B+ Tree to display.');

    // Now create and insert values, then show tree should display underlying structure
    await app.createTree();
    await app.insertValue(1);
    await app.insertValue(2);
    await app.insertValue(3);

    // Use showTree explicitly to trigger transition to S4_TreeDisplayed
    await app.showTree();
    const afterShow = await app.getTreeText();
    // Display should contain inserted keys
    expect(afterShow).toContain('1');
    expect(afterShow).toContain('2');
    expect(afterShow).toContain('3');

    // Ensure bPlusTree.display() matches DOM after showTree
    const displayFromObject = await app.getBPlusTreeDisplay();
    expect(displayFromObject.trim()).toBe(afterShow.trim());

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Multiple inserts to exercise splitChild and deeper display (behavioral validation)', async () => {
    // Comment: Insert multiple values to try to cause splits and ensure display returns a multi-line structure
    await app.setDegree(3);
    await app.createTree();

    // Insert a sequence of values; for degree 3, repeated inserts may create splits
    const values = [10, 20, 5, 15, 25, 30, 1];
    for (const v of values) {
      await app.insertValue(v);
    }

    const display = await app.getTreeText();
    // At minimum we expect to see the inserted values somewhere in the display
    for (const v of values) {
      expect(display).toContain(String(v));
    }

    // The display should be multi-line if splits occurred
    const lines = display.split('\n').filter((l) => l.trim().length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(1);

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Console and page error observation: ensure we capture logs and that no Syntax/Reference/Type errors were thrown', async () => {
    // Comment: Explicitly validate consoleMessages and pageErrors arrays shape and contents
    // Perform actions that produce console logs: attempt deletion (logs) and create (no log), insert (no log)
    await app.createTree();
    await app.insertValue(99);
    await app.deleteValue(99);

    // Confirm that the console includes the delete log
    const deleteLog = consoleMessages.find((m) => m.includes('Attempting to delete:'));
    expect(deleteLog).toBeTruthy();

    // Assert there were no uncaught runtime errors (ReferenceError, SyntaxError, TypeError)
    // If any pageErrors exist, fail the test and output the error messages for debugging
    if (pageErrors.length > 0) {
      const errorMessages = pageErrors.map(e => e.message || String(e)).join('\n---\n');
      // Fail with detailed message
      throw new Error(`Unexpected page errors were emitted:\n${errorMessages}`);
    } else {
      // Explicit positive assertion: zero uncaught page errors
      expect(pageErrors.length).toBe(0);
    }
  });
});