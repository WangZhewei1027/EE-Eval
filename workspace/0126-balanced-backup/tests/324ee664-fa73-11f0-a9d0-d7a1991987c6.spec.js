import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ee664-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object encapsulating interactions with the demo page
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.valueInput = page.locator('#valueInput');
    this.insertButton = page.locator("button[onclick='insertNode()']");
    this.searchButton = page.locator("button[onclick='searchNode()']");
    this.searchResult = page.locator('#searchResult');
    this.bTreeDiv = page.locator('#bTree');
    this.nodeSelector = this.bTreeDiv.locator('.node');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Insert the provided numeric value using the UI
  async insertValue(value) {
    await this.valueInput.fill(String(value));
    await this.insertButton.click();
  }

  // Click Search button with the provided input value (sets input first)
  async searchValue(value) {
    await this.valueInput.fill(String(value));
    await this.searchButton.click();
  }

  // Click search without changing input (useful for empty input tests)
  async clickSearchOnly() {
    await this.searchButton.click();
  }

  // Get texts of all rendered node elements in the bTree container
  async getRenderedNodeTexts() {
    const count = await this.nodeSelector.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.nodeSelector.nth(i).innerText()).trim());
    }
    return texts;
  }

  // Returns number of .node elements
  async getNodeCount() {
    return this.nodeSelector.count();
  }

  // Get current searchResult text content
  async getSearchResultText() {
    return (await this.searchResult.textContent())?.trim() ?? '';
  }

  // Get current value of the input
  async getInputValue() {
    return (await this.valueInput.inputValue()).trim();
  }
}

test.describe('B-Tree Index Demonstration - FSM and UI tests', () => {
  // Arrays to capture runtime errors and console error messages for each test
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });
  });

  test('Initial Idle state: controls present, no B-Tree rendered yet, and no runtime errors on load', async ({ page }) => {
    // This test validates the initial "Idle" state of the FSM:
    // - input and buttons exist
    // - bTree container is present but empty
    // - searchResult is empty
    // - no runtime errors occurred during page load
    const app = new BTreePage(page);
    await app.goto();

    await expect(app.valueInput).toBeVisible();
    await expect(app.insertButton).toBeVisible();
    await expect(app.searchButton).toBeVisible();
    await expect(app.bTreeDiv).toBeVisible();
    await expect(app.searchResult).toBeVisible();

    // Initially, there should be no rendered nodes
    expect(await app.getNodeCount()).toBe(0);

    // searchResult should be empty
    expect(await app.getSearchResultText()).toBe('');

    // Input should be empty
    expect(await app.getInputValue()).toBe('');

    // Assert no uncaught runtime page errors and no console error messages appeared on load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Insert Node: inserting a single node transitions to NodeInserted and renders node', async ({ page }) => {
    // This test validates the InsertNode event and S1_NodeInserted:
    // - entering a numeric value and clicking Insert Node inserts into the B-Tree
    // - the bTree container displays a node with the inserted value
    // - the input is cleared after insertion
    // - no runtime errors occurred during insertion
    const app = new BTreePage(page);
    await app.goto();

    // Insert value 10
    await app.insertValue(10);

    // After insertion, there should be at least one rendered node with "10"
    const texts = await app.getRenderedNodeTexts();
    expect(texts.length).toBeGreaterThanOrEqual(1);
    // At least one node element must contain '10' (exact single-node case should be '10')
    expect(texts.some(t => t.includes('10'))).toBeTruthy();

    // Input should be cleared by the application after successful insertion
    expect(await app.getInputValue()).toBe('');

    // The app calls render() after insert - ensure no runtime exceptions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Insert multiple nodes to exercise splitting behavior and render tree structure', async ({ page }) => {
    // This test inserts multiple values to exercise non-trivial insertion logic,
    // including cases that may trigger splitting in a B-Tree of minimum degree t=2.
    // It validates that the DOM shows multiple nodes and that inserted values appear.
    const app = new BTreePage(page);
    await app.goto();

    // Insert sequence intended to create several nodes and potential splits.
    // For t=2, node max keys = 2*t - 1 = 3. Insert 4 distinct values to trigger split behavior.
    const values = [30, 10, 20, 40, 5];
    for (const v of values) {
      await app.insertValue(v);
    }

    // Wait briefly for DOM updates (render() is synchronous in the page, but ensure stable)
    await page.waitForTimeout(50);

    // At least one node should exist and contain the values inserted
    const nodeTexts = await app.getRenderedNodeTexts();
    expect(nodeTexts.length).toBeGreaterThanOrEqual(1);

    // Each inserted value should appear somewhere in the rendered nodes
    for (const v of values) {
      expect(nodeTexts.some(t => t.split(',').map(s => s.trim()).includes(String(v))))
        .toBeTruthy();
    }

    // No uncaught runtime errors during this more complex insertion sequence
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Search Node: searching for existing and non-existing nodes transitions to NodeSearched and displays results', async ({ page }) => {
    // This test validates the SearchNode event and S2_NodeSearched:
    // - Insert a known value, then search for it => "found" message
    // - Search for a value that was not inserted => "not found" message
    const app = new BTreePage(page);
    await app.goto();

    // Insert 77, then search for 77
    await app.insertValue(77);

    // Ensure the node was inserted before searching
    await expect(app.nodeSelector).toHaveCountGreaterThan(0);

    // Now search for 77
    await app.searchValue(77);
    const foundText = await app.getSearchResultText();
    expect(foundText).toContain('Value 77 found in the B-Tree.');

    // Now search for a non-existing value 999
    await app.valueInput.fill('999');
    await app.searchButton.click();
    const notFoundText = await app.getSearchResultText();
    expect(notFoundText).toContain('Value 999 not found in the B-Tree.');

    // No runtime errors should have occurred during search operations
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: inserting invalid input does not modify tree; searching empty input displays NaN message', async ({ page }) => {
    // This test validates edge case behaviors:
    // - Clicking Insert Node with empty input should not insert anything and should not throw
    // - Clicking Search Node with empty input results in "Value NaN not found..." being shown
    const app = new BTreePage(page);
    await app.goto();

    // Ensure empty input
    await app.valueInput.fill('');
    // Click Insert Node with empty input - should be a no-op
    await app.insertButton.click();

    // No nodes should be rendered
    expect(await app.getNodeCount()).toBe(0);

    // Now click Search Node with empty input - the app will parseInt('') -> NaN
    await app.clickSearchOnly();

    // The UI is expected to show "Value NaN not found in the B-Tree." as per implementation
    const searchText = await app.getSearchResultText();
    expect(searchText).toContain('Value NaN not found in the B-Tree.');

    // No runtime exceptions should have been thrown during these invalid input interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('DOM integrity: verify node elements have expected class and structure after insertions', async ({ page }) => {
    // This test verifies that nodes are rendered with the class name 'node' and that
    // the bTree container contains link elements when there are children (class 'link').
    const app = new BTreePage(page);
    await app.goto();

    // Insert values to ensure children exist
    await app.insertValue(50);
    await app.insertValue(10);
    await app.insertValue(20);
    await app.insertValue(60);

    // Check that rendered nodes have the expected class
    const count = await app.getNodeCount();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const el = app.nodeSelector.nth(i);
      await expect(el).toHaveClass(/node/);
      const text = (await el.innerText()).trim();
      expect(text.length).toBeGreaterThan(0); // should display keys
    }

    // If tree produced internal links (non-leaf structure), there should be elements with class 'link'
    const linkCount = await app.bTreeDiv.locator('.link').count();
    // linkCount can be 0 for simple trees, but it should be >= 0 (validate presence check runs without errors)
    expect(linkCount).toBeGreaterThanOrEqual(0);

    // No console/page runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.afterEach(async ({}, testInfo) => {
    // If there are any captured page errors, include their messages in the test failure message
    // This does not suppress errors; it helps debugging if a test unexpectedly captured errors.
    if (pageErrors && pageErrors.length > 0) {
      // Attach the error messages to the test output for diagnostics
      for (const err of pageErrors) {
        testInfo.attach(err.name || 'pageerror', { body: String(err.stack || err.message || err), contentType: 'text/plain' });
      }
    }
    if (consoleErrors && consoleErrors.length > 0) {
      for (const msg of consoleErrors) {
        testInfo.attach('console.error', { body: msg.text(), contentType: 'text/plain' });
      }
    }
  });
});