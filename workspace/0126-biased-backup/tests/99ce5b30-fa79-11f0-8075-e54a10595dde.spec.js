import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce5b30-fa79-11f0-8075-e54a10595dde.html';

test.describe('Binary Search Tree Interactive Demo - Application ID: 99ce5b30-fa79-11f0-8075-e54a10595dde', () => {
  // Arrays to collect console error messages and page errors for each test
  let consoleErrors = [];
  let pageErrors = [];

  // Page Object for the BST demo page
  class BSTPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
      this.page = page;
      this.selectors = {
        h1: 'h1',
        insertInput: '#insertValue',
        insertButton: "button[onclick='insertNode()']",
        searchInput: '#searchValue',
        searchButton: "button[onclick='searchNode()']",
        searchResult: '#searchResult',
        deleteInput: '#deleteValue',
        deleteButton: "button[onclick='deleteNode()']",
        bstDisplay: '#bstDisplay',
      };
    }

    async goto() {
      await this.page.goto(APP_URL);
      // Wait for main heading to ensure the page rendered
      await this.page.waitForSelector(this.selectors.h1);
    }

    // Insert a numeric (or string) value using the Insert UI
    async insertValue(value) {
      await this.page.fill(this.selectors.insertInput, String(value));
      await this.page.click(this.selectors.insertButton);
    }

    // Search for a value using the Search UI
    async searchValue(value) {
      await this.page.fill(this.selectors.searchInput, String(value));
      await this.page.click(this.selectors.searchButton);
    }

    // Delete a value using the Delete UI
    async deleteValue(value) {
      await this.page.fill(this.selectors.deleteInput, String(value));
      await this.page.click(this.selectors.deleteButton);
    }

    // Get current BST inorder display text
    async getDisplayText() {
      const el = await this.page.waitForSelector(this.selectors.bstDisplay);
      return (await el.innerText()).trim();
    }

    // Get search result text
    async getSearchResultText() {
      const el = await this.page.waitForSelector(this.selectors.searchResult);
      return (await el.innerText()).trim();
    }

    // Get current value of an input (by selector)
    async getInputValue(selector) {
      return (await this.page.$eval(selector, el => el.value)).toString();
    }
  }

  // Setup listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console errors
    page.on('console', msg => {
      // We only collect messages that are of type 'error' to treat them as console errors
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Navigate to the application under test
    const bstPage = new BSTPage(page);
    await bstPage.goto();
  });

  // After each test, assert that there were no console errors or page errors observed.
  // This validates that runtime ReferenceError/SyntaxError/TypeError did not occur during interactions.
  test.afterEach(async () => {
    expect(consoleErrors.length, `Console errors were found:\n${consoleErrors.join('\n')}`).toBe(0);
    expect(pageErrors.length, `Page errors were found:\n${pageErrors.join('\n')}`).toBe(0);
  });

  // Test the Idle state (S0_Idle): page renders and initial DOM elements exist
  test('Idle state renders page with correct heading and empty BST display', async ({ page }) => {
    const bstPage = new BSTPage(page);

    // Validate h1 text evidence for Idle state
    const heading = await page.textContent('h1');
    expect(heading).toContain('Binary Search Tree (BST) Interactive Demo');

    // Initially, the bstDisplay should be empty (no nodes inserted)
    const displayText = await bstPage.getDisplayText();
    expect(displayText).toBe('', 'Expected initial BST display to be empty');

    // Ensure inputs exist
    await expect(page.locator('#insertValue')).toBeVisible();
    await expect(page.locator('#searchValue')).toBeVisible();
    await expect(page.locator('#deleteValue')).toBeVisible();
  });

  // Test insertion transitions (S1_NodeInserted)
  test('Insert node transitions to NodeInserted and updates display (single and multiple inserts)', async ({ page }) => {
    const bstPage = new BSTPage(page);

    // Insert a single value and validate display updates and input clears
    await bstPage.insertValue(50);
    const displayAfterOne = await bstPage.getDisplayText();
    expect(displayAfterOne).toBe('50', 'After inserting 50, display should show "50"');

    // Confirm insert input is cleared after insertion (entry/exit behavior)
    const insertInputVal = await bstPage.getInputValue(bstPage.selectors.insertInput);
    expect(insertInputVal).toBe('', 'Insert input should be cleared after insertion');

    // Insert additional nodes and validate inorder display ordering
    await bstPage.insertValue(30);
    await bstPage.insertValue(70);
    const displayAfterThree = await bstPage.getDisplayText();
    // inorder of 50,30,70 should be "30, 50, 70"
    expect(displayAfterThree).toBe('30, 50, 70', 'BST inorder display should reflect sorted elements after inserts');
  });

  // Test search transitions (S2_NodeFound and S3_NodeNotFound)
  test('Search existing node returns "Found" (NodeFound) and non-existing returns "Not Found" (NodeNotFound)', async ({ page }) => {
    const bstPage = new BSTPage(page);

    // Arrange: insert some values
    await bstPage.insertValue(42);
    await bstPage.insertValue(21);
    await bstPage.insertValue(84);

    // Search for an existing value -> should display "Found"
    await bstPage.searchValue(42);
    const foundResult = await bstPage.getSearchResultText();
    expect(foundResult).toBe('Found', 'Searching for an existing node should display "Found"');

    // After search, search input should be cleared
    const searchInputValAfterFound = await bstPage.getInputValue(bstPage.selectors.searchInput);
    expect(searchInputValAfterFound).toBe('', 'Search input should be cleared after searching');

    // Search for a non-existing value -> should display "Not Found"
    await bstPage.searchValue(9999);
    const notFoundResult = await bstPage.getSearchResultText();
    expect(notFoundResult).toBe('Not Found', 'Searching for a non-existing node should display "Not Found"');
  });

  // Test deletion transitions (S4_NodeDeleted)
  test('Delete node transitions to NodeDeleted and updates display correctly', async ({ page }) => {
    const bstPage = new BSTPage(page);

    // Arrange: build a small tree
    await bstPage.insertValue(40);
    await bstPage.insertValue(20);
    await bstPage.insertValue(60);
    await bstPage.insertValue(10); // left-left
    await bstPage.insertValue(30); // left-right

    // Confirm initial inorder
    const beforeDelete = await bstPage.getDisplayText();
    expect(beforeDelete).toBe('10, 20, 30, 40, 60', 'Initial inorder before deletion');

    // Delete a node with two children (40) -> root replacement should occur
    await bstPage.deleteValue(40);
    const afterDelete = await bstPage.getDisplayText();
    // After deleting 40, inorder should not include 40, and should maintain sorted order
    expect(afterDelete).toBe('10, 20, 30, 60', 'After deleting 40, BST inorder should update and exclude the deleted value');

    // Delete a leaf node and ensure display updates
    await bstPage.deleteValue(10);
    const afterDeleteLeaf = await bstPage.getDisplayText();
    expect(afterDeleteLeaf).toBe('20, 30, 60', 'After deleting leaf 10, BST inorder should reflect removal');

    // Verify delete input cleared after deletion
    const deleteInputVal = await bstPage.getInputValue(bstPage.selectors.deleteInput);
    expect(deleteInputVal).toBe('', 'Delete input should be cleared after deletion');
  });

  // Edge cases and error scenarios
  test('Edge cases: inserting non-number, duplicate inserts, deleting non-number and deleting non-existing value', async ({ page }) => {
    const bstPage = new BSTPage(page);

    // Attempt to insert a non-numeric value -> should be ignored (no change to display)
    await bstPage.insertValue('abc');
    let displayAfterInvalidInsert = await bstPage.getDisplayText();
    expect(displayAfterInvalidInsert).toBe('', 'Inserting non-number should not change BST display');

    // Insert a numeric value twice -> duplicate should not be added twice (BST code ignores equal keys)
    await bstPage.insertValue(10);
    await bstPage.insertValue(10); // duplicate
    let displayAfterDuplicates = await bstPage.getDisplayText();
    expect(displayAfterDuplicates).toBe('10', 'Duplicate insertion should not create a second identical node');

    // Attempt to delete with non-numeric input -> should be ignored (no change)
    await bstPage.deleteValue('notanumber');
    const displayAfterInvalidDelete = await bstPage.getDisplayText();
    expect(displayAfterInvalidDelete).toBe('10', 'Deleting with non-number should not change BST display');

    // Attempt to delete a non-existing numeric value -> display remains unchanged
    await bstPage.deleteValue(999);
    const displayAfterDeletingNonExisting = await bstPage.getDisplayText();
    expect(displayAfterDeletingNonExisting).toBe('10', 'Deleting a non-existing value should not change BST display');
  });

  // Validate that the page does not produce runtime errors during typical user flows
  test('No runtime ReferenceError/SyntaxError/TypeError should be emitted during typical interactions', async ({ page }) => {
    const bstPage = new BSTPage(page);

    // Perform a variety of interactions
    await bstPage.insertValue(5);
    await bstPage.insertValue(3);
    await bstPage.insertValue(7);

    await bstPage.searchValue(3);
    expect(await bstPage.getSearchResultText()).toBe('Found');

    await bstPage.deleteValue(5);
    expect(await bstPage.getDisplayText()).toBe('3, 7');

    // At this point, the afterEach hook will assert that consoleErrors and pageErrors are empty.
    // Here we also assert them explicitly to provide clearer failure message in this specific test flow.
    expect(consoleErrors.length, `Console errors were found during interactions:\n${consoleErrors.join('\n')}`).toBe(0);
    expect(pageErrors.length, `Page errors were found during interactions:\n${pageErrors.join('\n')}`).toBe(0);
  });
});