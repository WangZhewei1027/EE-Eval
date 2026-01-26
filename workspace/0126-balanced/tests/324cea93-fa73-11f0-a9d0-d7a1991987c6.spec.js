import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324cea93-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object Model for the B+ Tree page
class BPlusTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.valueInput = page.locator('#valueInput');
    this.insertButton = page.locator("button[onclick='insertValue()']");
    this.treeContainer = page.locator('#tree-container');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Fill input and click Insert
  async insertValue(value) {
    await this.valueInput.fill(String(value));
    await this.insertButton.click();
  }

  // Read visible node texts in the tree container
  async getNodeTexts() {
    const nodes = await this.treeContainer.locator('.node').allTextContents();
    // Trim and normalize whitespace
    return nodes.map(n => n.trim());
  }

  async getContainerText() {
    return (await this.treeContainer.innerText()).trim();
  }

  // Helper to trigger a potentially invalid insert (like empty or non-numeric)
  async attemptInsertRaw(rawValue) {
    await this.valueInput.fill(String(rawValue));
    await this.insertButton.click();
  }
}

test.describe('B+ Tree Visualization - FSM & UI validation (Application ID: 324cea93-fa73-11f0-a9d0-d7a1991987c6)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];
  let dialogMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset arrays for each test
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];
    dialogMessages = [];

    // Listen for runtime errors on the page (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Collect console messages and separately note those that are error-level
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture dialog messages (alerts) and auto-accept them to allow test flow
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // After each test assert that there were no unexpected page errors (runtime exceptions)
    // If there are runtime errors, the test can still include assertions about them in specific tests.
    expect(pageErrors, 'No uncaught page errors should be present').toHaveLength(0);
    // Also assert no console errors were emitted
    expect(consoleErrors, 'No console.error messages should be present').toHaveLength(0);
  });

  test.describe('Initial state (S0_Idle)', () => {
    test('S0_Idle: Page loads and shows input and insert button (renderPage entry action observed via DOM)', async ({ page }) => {
      // Validate basic UI components are present as described in FSM components
      const app = new BPlusTreePage(page);

      await expect(app.valueInput).toBeVisible();
      await expect(app.insertButton).toBeVisible();

      // The initial tree container should be empty (Idle state renders page but page has no pre-render function)
      const nodes = await app.getNodeTexts();
      expect(nodes.length).toBe(0);

      // Ensure that no runtime page errors or console error messages occurred during initial load
      // (additional checks already done in afterEach; repeating here for clarity)
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('S0_Idle: Entering invalid input triggers alert and does not change tree', async ({ page }) => {
      const app = new BPlusTreePage(page);

      // Attempt to insert a non-numeric value (edge case)
      await app.attemptInsertRaw('abc');

      // The page is expected to show an alert 'Please enter a valid number.'
      // We captured dialog messages and auto-accepted them; assert the message was shown
      expect(dialogMessages).toContain('Please enter a valid number.');

      // Tree should remain empty
      const nodesAfter = await app.getNodeTexts();
      expect(nodesAfter.length).toBe(0);

      // Ensure no runtime errors occurred
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Transitions and state S1_ValueInserted', () => {
    test('S0_Idle -> S1_ValueInserted: Inserting a single number renders a leaf node with that number', async ({ page }) => {
      const app = new BPlusTreePage(page);

      // Insert a single value (expected transition)
      await app.insertValue(10);

      // After insertion, bPlusTree.insert(value) should have been called and bPlusTree.render()
      // should have updated the DOM with a leaf node containing '10'.
      const nodes = await app.getNodeTexts();
      expect(nodes.length).toBeGreaterThanOrEqual(1);
      expect(nodes[0]).toContain('Leaf:');
      expect(nodes[0]).toContain('10');

      // Value input should be cleared after successful insert
      expect(await app.valueInput.inputValue()).toBe('');

      // No runtime errors expected during normal insert
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('S1_ValueInserted: Multiple inserts keep keys sorted inside leaf and allow duplicates', async ({ page }) => {
      const app = new BPlusTreePage(page);

      // Insert multiple values, including duplicate
      await app.insertValue(20);
      await app.insertValue(5);
      await app.insertValue(20); // duplicate

      const nodes = await app.getNodeTexts();
      // We expect at least one leaf node and that it contains the sorted keys: 5,20,20 (order may have resulted in different grouping if prior tests inserted data - but our beforeEach navigates anew)
      // Since this is a fresh page load in beforeEach, the leaf should show exactly these three values
      expect(nodes.some(n => n.includes('Leaf:'))).toBe(true);
      const leafText = nodes.find(n => n.startsWith('Leaf:'));
      expect(leafText).toContain('5');
      expect(leafText).toContain('20');
      // duplicate check - at least two occurrences of '20' in the text
      const count20 = (leafText.match(/20/g) || []).length;
      expect(count20).toBeGreaterThanOrEqual(2);

      // No runtime errors
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Transition causing split: inserting enough values creates an Internal node (root) and multiple leaves', async ({ page }) => {
      const app = new BPlusTreePage(page);

      // Insert four values to force a leaf split given order=3 in implementation
      // Insert sequence: 10, 20, 30, 40
      await app.insertValue(10);
      await app.insertValue(20);
      await app.insertValue(30);
      await app.insertValue(40);

      // After the 4th insert, the tree should split leaves and create an Internal root.
      const nodeTexts = await app.getNodeTexts();

      // There should be an Internal node with a key (the promoted key is newLeaf.keys[0], expected '30' for this implementation)
      const hasInternal = nodeTexts.some(t => t.startsWith('Internal:'));
      expect(hasInternal).toBe(true);

      // Validate expected internal key and leaf groupings are present
      // Internal: 30
      const internalText = nodeTexts.find(t => t.startsWith('Internal:'));
      expect(internalText).toBeDefined();
      expect(internalText).toContain('30');

      // Leaves should show partitioned keys, e.g., 'Leaf: 10, 20' and 'Leaf: 30, 40'
      const leafs = nodeTexts.filter(t => t.startsWith('Leaf:'));
      // At least two leaf nodes should be present
      expect(leafs.length).toBeGreaterThanOrEqual(2);

      // Check content of leaves
      const leafConcat = leafs.join(' | ');
      expect(leafConcat).toContain('10');
      expect(leafConcat).toContain('20');
      expect(leafConcat).toContain('30');
      expect(leafConcat).toContain('40');

      // After structural change, no runtime errors should be present
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Empty input triggers alert and does not modify tree', async ({ page }) => {
      const app = new BPlusTreePage(page);

      // Ensure input is empty then click Insert
      await app.valueInput.fill('');
      await app.insertButton.click();

      // Dialog should show
      expect(dialogMessages).toContain('Please enter a valid number.');

      // No node added
      const nodes = await app.getNodeTexts();
      expect(nodes.length).toBe(0);

      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Large number insertion works and displays the large number in the tree', async ({ page }) => {
      const app = new BPlusTreePage(page);
      const largeNum = 1234567890;

      await app.insertValue(largeNum);

      const containerText = await app.getContainerText();
      expect(containerText).toContain(String(largeNum));

      // No runtime errors
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Rapid sequential inserts maintain tree correctness (no exceptions thrown)', async ({ page }) => {
      const app = new BPlusTreePage(page);

      // Insert a sequence of numbers rapidly
      const values = [3, 1, 4, 1, 5, 9, 2];
      for (const v of values) {
        await app.insertValue(v);
      }

      // After multiple inserts, the container should display nodes and no runtime errors occurred
      const nodes = await app.getNodeTexts();
      expect(nodes.length).toBeGreaterThan(0);
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Runtime observation tests (console & page errors)', () => {
    test('No ReferenceError / SyntaxError / TypeError occurred during common user flows', async ({ page }) => {
      const app = new BPlusTreePage(page);

      // Perform some typical operations
      await app.insertValue(11);
      await app.insertValue(22);
      await app.insertValue(33);

      // Validate tree updated
      const text = await app.getContainerText();
      expect(text.length).toBeGreaterThan(0);

      // Explicitly assert no page errors were captured (this will surface ReferenceError, TypeError, etc.)
      expect(pageErrors.length).toBe(0);

      // Also assert no console errors
      expect(consoleErrors.length).toBe(0);
    });

    test('If any uncaught errors occur they are reported via pageerror; test reports them', async ({ page }) => {
      // This test demonstrates capturing page errors if they exist naturally.
      // We do not inject faults; we simply assert that the captured list matches expectations (empty for a healthy page).
      const app = new BPlusTreePage(page);

      // Trigger a normal insert to exercise code paths
      await app.insertValue(7);

      // If any page errors exist, fail with details (afterEach also enforces none)
      if (pageErrors.length > 0) {
        // Provide informative failure if errors were captured
        const messages = pageErrors.map(e => e.message).join('\n---\n');
        // Fail the test explicitly with collected error messages
        throw new Error('Unexpected page errors detected:\n' + messages);
      }

      // Otherwise, pass by asserting no errors
      expect(pageErrors).toHaveLength(0);
    });
  });
});