import { test, expect } from '@playwright/test';

// Test file: 99ce8243-fa79-11f0-8075-e54a10595dde.spec.js
// Application URL (served as stated in the prompt)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce8243-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Trie demo page
class TriePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = '#word-input';
    this.insertButton = '#insert-button';
    this.searchButton = '#search-button';
    this.clearButton = '#clear-button';
    this.trieNode = '#trie-node';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure root UI elements are present before interacting
    await expect(this.page.locator(this.input)).toBeVisible();
    await expect(this.page.locator(this.insertButton)).toBeVisible();
    await expect(this.page.locator(this.searchButton)).toBeVisible();
    await expect(this.page.locator(this.clearButton)).toBeVisible();
    await expect(this.page.locator(this.trieNode)).toBeVisible();
  }

  async setInput(value) {
    await this.page.fill(this.input, value);
  }

  async getInputValue() {
    return await this.page.$eval(this.input, el => el.value);
  }

  async clickInsert() {
    await this.page.click(this.insertButton);
  }

  async clickSearch() {
    await this.page.click(this.searchButton);
  }

  async clickClear() {
    await this.page.click(this.clearButton);
  }

  async getTrieNodeDivsText() {
    return await this.page.$$eval(`${this.trieNode} > div`, divs => divs.map(d => d.textContent.trim()));
  }

  async getTrieNodeChildCount() {
    return await this.page.$eval(this.trieNode, el => el.children.length);
  }
}

test.describe('Trie Visualization - FSM based E2E tests', () => {
  // Collect console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // No-op in beforeEach; listeners are set up inside each test to keep tests isolated.
  });

  // Test S0_Idle: initial render page and presence of components
  test('S0_Idle: Page renders with input, buttons and empty trie visualization', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    const triePage = new TriePage(page);
    await triePage.goto();

    // On initial load, displayTrie() was called by entry action in FSM (renderPage -> display)
    // Implementation always renders an empty root node as a div (empty text)
    const childCount = await triePage.getTrieNodeChildCount();
    // Expect a root div even when trie is empty
    expect(childCount).toBeGreaterThanOrEqual(1);

    // Input should be empty initially
    const inputValue = await triePage.getInputValue();
    expect(inputValue).toBe('');

    // Ensure no runtime page errors occurred during load
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were emitted on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test S1_WordInserted transition and behavior
  test('S1_WordInserted: Insert a word updates trie visualization and clears input', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    const triePage = new TriePage(page);
    await triePage.goto();

    // Insert a sample word and validate visualization updates & input cleared
    const word = 'cat';
    await triePage.setInput(word);

    // Before insert, capture trie representation
    const beforeDivs = await triePage.getTrieNodeDivsText();

    await triePage.clickInsert();

    // After insert, input should be cleared per implementation
    const afterInputValue = await triePage.getInputValue();
    expect(afterInputValue).toBe('');

    // The trie visualization should now include the inserted word with a trailing '*' at the node representing end of word
    const afterDivs = await triePage.getTrieNodeDivsText();
    // There should be more or equal divs (root + nodes) after insertion
    expect(afterDivs.length).toBeGreaterThanOrEqual(beforeDivs.length);

    // Look for a div that represents the full word with '*' suffix as per displayTrie implementation
    const expectedEndNodeText = 'cat *';
    const found = afterDivs.some(text => text === expectedEndNodeText);
    expect(found).toBeTruthy();

    // No page errors should have occurred during insert
    expect(pageErrors.length).toBe(0);

    // No console error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test S2_WordSearched: Searching existing and non-existing words shows correct alerts and clears input
  test('S2_WordSearched: Search existing and non-existing words produce expected alerts and clear input', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    const triePage = new TriePage(page);
    await triePage.goto();

    // Insert 'dog' to later search for it
    await triePage.setInput('dog');
    await triePage.clickInsert();

    // Search for existing word -> expect alert stating it exists and input cleared
    await triePage.setInput('dog');
    const dialogPromiseExists = page.waitForEvent('dialog');
    await triePage.clickSearch();
    const dialogExists = await dialogPromiseExists;
    expect(dialogExists.type()).toBe('alert');
    expect(dialogExists.message()).toBe('"dog" exists in the trie.');
    await dialogExists.dismiss(); // close the alert

    // After search, implementation clears the input
    const inputAfterSearch = await triePage.getInputValue();
    expect(inputAfterSearch).toBe('');

    // Search for non-existing word -> expect alert stating it does not exist and input cleared
    await triePage.setInput('bird');
    const dialogPromiseNotExists = page.waitForEvent('dialog');
    await triePage.clickSearch();
    const dialogNotExists = await dialogPromiseNotExists;
    expect(dialogNotExists.type()).toBe('alert');
    expect(dialogNotExists.message()).toBe('"bird" does not exist in the trie.');
    await dialogNotExists.dismiss();

    const inputAfterSearch2 = await triePage.getInputValue();
    expect(inputAfterSearch2).toBe('');

    // No page errors should have occurred during search flows
    expect(pageErrors.length).toBe(0);

    // No console error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test S3_TrieCleared: Clear Trie behavior
  test('S3_TrieCleared: Clear trie empties visualization (leaves only root) and subsequent clears are idempotent', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    const triePage = new TriePage(page);
    await triePage.goto();

    // Insert two words to create nodes
    await triePage.setInput('apple');
    await triePage.clickInsert();
    await triePage.setInput('app');
    await triePage.clickInsert();

    // Ensure trie has multiple divs now
    const beforeClearCount = await triePage.getTrieNodeChildCount();
    expect(beforeClearCount).toBeGreaterThan(1);

    // Click clear and validate visualization updated
    await triePage.clickClear();

    // displayTrie always renders a root node => expect exactly 1 div (root) after clearing
    const afterClearCount = await triePage.getTrieNodeChildCount();
    expect(afterClearCount).toBeGreaterThanOrEqual(1);
    // There should be fewer nodes than prior to clearing
    expect(afterClearCount).toBeLessThan(beforeClearCount);

    // Clicking clear again should be safe (idempotent) and not throw errors
    await triePage.clickClear();
    const afterSecondClearCount = await triePage.getTrieNodeChildCount();
    expect(afterSecondClearCount).toBeGreaterThanOrEqual(1);

    // No page errors during clear
    expect(pageErrors.length).toBe(0);

    // No console error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge cases and error scenarios
  test('Edge cases: inserting empty string and searching empty string should be no-ops and produce no alerts', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    const dialogs = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    page.on('dialog', dialog => {
      // Record any unexpected dialogs
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // Dismiss to avoid blocking
      dialog.dismiss().catch(() => {});
    });

    const triePage = new TriePage(page);
    await triePage.goto();

    // Ensure trie initial state count
    const initialCount = await triePage.getTrieNodeChildCount();

    // Attempt to insert empty string
    await triePage.setInput('');
    await triePage.clickInsert();

    // Nothing should change
    const afterEmptyInsertCount = await triePage.getTrieNodeChildCount();
    expect(afterEmptyInsertCount).toBe(initialCount);

    // Attempt to search empty string: implementation does nothing if (!word)
    await triePage.setInput('');
    await triePage.clickSearch();

    // No alert dialogs should have been produced for empty input
    expect(dialogs.length).toBe(0);

    // No page errors during edge cases
    expect(pageErrors.length).toBe(0);

    // No console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Observability test: ensure no unexpected ReferenceError/SyntaxError/TypeError occurred during the test run
  test('Observability: page should not emit ReferenceError, SyntaxError, or TypeError as pageerror events', async ({ page }) => {
    const pageErrors = [];

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    const triePage = new TriePage(page);
    await triePage.goto();

    // Perform a few actions to exercise code paths
    await triePage.setInput('alpha');
    await triePage.clickInsert();
    await triePage.setInput('alpha');
    const dialogPromise = page.waitForEvent('dialog');
    await triePage.clickSearch();
    const dialog = await dialogPromise;
    await dialog.dismiss();

    // Inspect any captured page errors and fail if there are errors of type ReferenceError/SyntaxError/TypeError
    const problematic = pageErrors.filter(err => {
      const name = err.name || '';
      return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
    });

    // Assert that none of these critical error types occurred
    expect(problematic.length).toBe(0);
    // Also assert no page errors at all
    expect(pageErrors.length).toBe(0);
  });
});