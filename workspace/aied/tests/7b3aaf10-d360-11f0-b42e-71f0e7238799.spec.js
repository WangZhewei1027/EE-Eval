import { test, expect } from '@playwright/test';

// Test file for application 7b3aaf10-d360-11f0-b42e-71f0e7238799
// This suite validates the Red-Black Tree Visualization interactive application.
// It follows the FSM states: S0_Idle (initial) and S1_ValueInserted (after inserting a value).
// It also observes console messages and page errors and asserts that no unexpected runtime errors occur.

// Page Object representing the app
class RBTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url =
      'http://127.0.0.1:5500/workspace/batch-1207/html/7b3aaf10-d360-11f0-b42e-71f0e7238799.html';
    this.selectors = {
      title: 'h1',
      treeContainer: '#tree-container',
      valueInput: '#valueInput',
      insertBtn: '#insertBtn',
      node: '#tree-container .node',
    };
  }

  async goto() {
    await this.page.goto(this.url);
    // Wait for the main heading to ensure the page has rendered (S0_Idle entry evidence)
    await this.page.waitForSelector(this.selectors.title);
  }

  async insertValue(value) {
    const input = this.page.locator(this.selectors.valueInput);
    await input.fill(String(value));
    await this.page.click(this.selectors.insertBtn);
  }

  async getNodeElements() {
    return this.page.locator(this.selectors.node);
  }

  async getNodeCount() {
    return await this.getNodeElements().count();
  }

  async getNodeTexts() {
    const count = await this.getNodeCount();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.getNodeElements().nth(i).innerText());
    }
    return texts;
  }

  async getNodeClassesAt(index) {
    return await this.getNodeElements().nth(index).getAttribute('class');
  }

  async isInputCleared() {
    return (await this.page.locator(this.selectors.valueInput).inputValue()) === '';
  }
}

test.describe('Red-Black Tree Visualization - FSM and UI tests', () => {
  let page;
  let app;
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    app = new RBTreePage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // Close the page after each test to isolate tests
    await page.close();
  });

  test('S0_Idle: initial render shows title and empty tree container', async () => {
    // Validate the page rendered the expected heading (evidence of renderPage())
    const title = await page.locator(app.selectors.title).innerText();
    expect(title).toContain('Red-Black Tree Visualization');

    // Initially, there should be no nodes rendered in the tree container
    const nodeCount = await app.getNodeCount();
    expect(nodeCount).toBe(0);

    // No uncaught page errors should have occurred during initial render
    expect(pageErrors.length).toBe(0);

    // No console messages of type 'error' should have been emitted
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_ValueInserted: inserting a single value updates visualization and clears input', async () => {
    // Insert a single value (trigger InsertValue event)
    await app.insertValue(10);

    // After insertion, there should be at least one node element in the container
    await page.waitForSelector(app.selectors.node); // wait until node appears
    const nodeCount = await app.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    // The root node should display the inserted value "10"
    const texts = await app.getNodeTexts();
    expect(texts).toContain('10');

    // By implementation, root color is set to 'black' at the end of fixViolations()
    // Find the first node that has text '10' and assert it has class 'black' (visual feedback)
    let foundBlack = false;
    for (let i = 0; i < texts.length; i++) {
      if (texts[i] === '10') {
        const cls = await app.getNodeClassesAt(i);
        if (cls && cls.split(/\s+/).includes('black')) {
          foundBlack = true;
          break;
        }
      }
    }
    expect(foundBlack).toBe(true);

    // Input should be cleared after successful insertion
    expect(await app.isInputCleared()).toBe(true);

    // Confirm no uncaught page errors or console errors occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Multiple inserts: structure and colors reflect tree state (in-order of visualization traversal)', async () => {
    // Insert multiple values to create a small tree
    await app.insertValue(50);
    await app.insertValue(30);
    await app.insertValue(70);
    await app.insertValue(20);
    await app.insertValue(40);

    // Wait until at least 5 nodes are present
    await page.waitForFunction(
      (sel, expected) => document.querySelectorAll(sel).length >= expected,
      app.selectors.node,
      5
    );
    const nodeCount = await app.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(5);

    // Collect texts and ensure all inserted values are present
    const texts = await app.getNodeTexts();
    expect(texts).toEqual(expect.arrayContaining(['50', '30', '70', '20', '40']));

    // There should be at least one red and one black node rendered (visual color diversity)
    const classes = [];
    for (let i = 0; i < await app.getNodeCount(); i++) {
      classes.push(await app.getNodeClassesAt(i));
    }
    const hasRed = classes.some((c) => c && c.split(/\s+/).includes('red'));
    const hasBlack = classes.some((c) => c && c.split(/\s+/).includes('black'));
    expect(hasRed).toBe(true);
    expect(hasBlack).toBe(true);

    // No page errors or console errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: non-numeric input should be ignored and produce no errors', async () => {
    // Capture current node count
    const beforeCount = await app.getNodeCount();

    // Fill with non-numeric value and click insert
    await page.locator(app.selectors.valueInput).fill('abc');
    await page.click(app.selectors.insertBtn);

    // Ensure node count did not change
    // Small timeout to allow any DOM changes if code attempted to handle it
    await page.waitForTimeout(200);
    const afterCount = await app.getNodeCount();
    expect(afterCount).toBe(beforeCount);

    // No page errors or console errors emitted as a result
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: inserting duplicate values results in additional nodes (duplicates go to right)', async () => {
    // Insert the same value twice
    await app.insertValue(15);
    await page.waitForSelector(app.selectors.node);
    const countAfterFirst = await app.getNodeCount();

    await app.insertValue(15);
    // Wait until node count increases (duplicates create additional node)
    await page.waitForFunction(
      (sel, minCount) => document.querySelectorAll(sel).length >= minCount,
      app.selectors.node,
      countAfterFirst + 1
    );

    const texts = await app.getNodeTexts();
    // There should be at least two nodes with text '15'
    const occurrences = texts.filter((t) => t === '15').length;
    expect(occurrences).toBeGreaterThanOrEqual(2);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture and assert console and page errors during interactions', async () => {
    // Reset captured messages for clarity
    consoleMessages = [];
    pageErrors = [];

    // Perform a series of interactions that exercise the code paths
    await app.insertValue(1);
    await app.insertValue(2);
    await app.insertValue(3);
    await page.waitForSelector(app.selectors.node);

    // Allow short time for any asynchronous runtime errors to surface
    await page.waitForTimeout(200);

    // We assert that there are no page errors (uncaught exceptions)
    expect(pageErrors.length).toBe(0);

    // Also assert that console did not log any 'error' type messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // It's acceptable if informational console messages exist; we merely ensure no errors were logged.
  });
});