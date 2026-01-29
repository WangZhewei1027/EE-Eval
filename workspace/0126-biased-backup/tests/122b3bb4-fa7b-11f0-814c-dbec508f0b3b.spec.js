import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122b3bb4-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Trie app to encapsulate common interactions
class TriePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      input: '#input',
      addButton: '#add-button',
      removeButton: '#remove-button',
      searchButton: '#search-button',
      displayButton: '#display-button',
      searchInput: '#search-input',
      output: '#output',
      clearButton: '#clear-button',
      result: '#result',
      errorMessage: '#error-message'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main container to ensure page rendered
    await this.page.waitForSelector('#trie');
  }

  async setSearchInput(value) {
    await this.page.fill(this.selectors.searchInput, value);
  }

  async clickAdd() {
    await this.page.click(this.selectors.addButton);
  }

  async clickRemove() {
    await this.page.click(this.selectors.removeButton);
  }

  async clickSearch() {
    await this.page.click(this.selectors.searchButton);
  }

  async clickDisplay() {
    await this.page.click(this.selectors.displayButton);
  }

  async clickClear() {
    await this.page.click(this.selectors.clearButton);
  }

  async getOutputText() {
    return await this.page.textContent(this.selectors.output);
  }

  async getResultText() {
    return await this.page.textContent(this.selectors.result);
  }

  // Inspect the runtime trie object to validate internal state where appropriate.
  // This does not modify functions; it reads the global trie object from the page.
  async getTrieSnapshot() {
    return await this.page.evaluate(() => {
      // Return a serializable snapshot of the trie for assertions
      if (!window.trie) return null;
      function serialize(node) {
        const obj = {
          hasWord: 'word' in node && node.word !== undefined && node.word !== '',
          word: node.word || '',
          result: node.result || '',
          childrenKeys: Object.keys(node.children || {})
        };
        return obj;
      }
      return serialize(window.trie);
    });
  }

  // Find node at a given word and return its serializable info
  async getTrieNodeForWord(word) {
    return await this.page.evaluate((word) => {
      if (!window.trie) return null;
      let node = window.trie;
      for (let char of word) {
        if (!node.children[char]) return null;
        node = node.children[char];
      }
      return {
        hasWord: 'word' in node && node.word !== undefined && node.word !== '',
        word: node.word || '',
        result: node.result || '',
        childrenKeys: Object.keys(node.children || {})
      };
    }, word);
  }

  // Helper to append a child element into output or result for testing click handlers
  async appendChildToOutput(childText) {
    await this.page.evaluate((childText) => {
      const output = document.getElementById('output');
      const span = document.createElement('span');
      span.textContent = childText;
      output.appendChild(span);
    }, childText);
  }

  async appendChildToResult(childText) {
    await this.page.evaluate((childText) => {
      const result = document.getElementById('result');
      const span = document.createElement('span');
      span.textContent = childText;
      result.appendChild(span);
    }, childText);
  }
}

test.describe('Trie interactive application - FSM validation', () => {
  // Arrays to capture console and page errors so tests can assert their presence/absence
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and errors
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions
      pageErrors.push(err && err.message ? err.message : String(err));
    });
  });

  test.describe('Initial state (S0_Idle) and rendering', () => {
    test('renders main UI elements and starts in Idle state', async ({ page }) => {
      // This test validates the app rendered expected components on entry (renderPage())
      const triePage = new TriePage(page);
      await triePage.goto();

      // Check expected DOM elements exist
      await expect(page.locator('#input')).toBeVisible();
      await expect(page.locator('#add-button')).toBeVisible();
      await expect(page.locator('#remove-button')).toBeVisible();
      await expect(page.locator('#search-button')).toBeVisible();
      await expect(page.locator('#display-button')).toBeVisible();
      await expect(page.locator('#search-input')).toBeVisible();
      await expect(page.locator('#output')).toBeVisible();
      await expect(page.locator('#result')).toBeVisible();

      // Output and result should be empty initially
      expect(await triePage.getOutputText()).toBe('');
      expect(await triePage.getResultText()).toBe('');

      // The rune-time trie object should exist and be in cleared state
      const snapshot = await triePage.getTrieSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot.hasWord).toBe(false);
      expect(snapshot.word).toBe('');
      expect(snapshot.result).toBe('');

      // Assert no uncaught page errors happened during load
      expect(pageErrors.length).toBe(0);
      // Assert there were no console.error entries during load
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Add, Search, Display, Remove, and Clear transitions', () => {
    test('AddWord transition: adding a word stores node.word and does not set an output error', async ({ page }) => {
      const triePage = new TriePage(page);
      await triePage.goto();

      // Add the word 'hello'
      await triePage.setSearchInput('hello');
      await triePage.clickAdd();

      // After adding, trie should contain the word at the node for 'hello'
      const node = await triePage.getTrieNodeForWord('hello');
      expect(node).not.toBeNull();
      expect(node.hasWord).toBe(true);
      expect(node.word).toBe('hello');
      // node.result should be empty string per implementation after add
      expect(node.result).toBe('');

      // No output error should have been displayed
      expect(await triePage.getOutputText()).not.toBe('Error: Word cannot be empty');

      // No uncaught runtime errors during the operation
      expect(pageErrors.length).toBe(0);
    });

    test('AddWord error case: adding empty word displays Error: Word cannot be empty', async ({ page }) => {
      const triePage = new TriePage(page);
      await triePage.goto();

      // Ensure search input is empty then click Add
      await triePage.setSearchInput('');
      await triePage.clickAdd();

      // Expect the output div to show the appropriate error text
      expect(await triePage.getOutputText()).toBe('Error: Word cannot be empty');

      // No uncaught runtime exceptions
      expect(pageErrors.length).toBe(0);
    });

    test('SearchWord transition: successful search sets node.result to the word', async ({ page }) => {
      const triePage = new TriePage(page);
      await triePage.goto();

      // Add a word then perform search
      await triePage.setSearchInput('alpha');
      await triePage.clickAdd();

      // Ensure node exists
      let node = await triePage.getTrieNodeForWord('alpha');
      expect(node).not.toBeNull();
      expect(node.hasWord).toBe(true);
      expect(node.word).toBe('alpha');

      // Now search for it
      await triePage.setSearchInput('alpha');
      await triePage.clickSearch();

      // After search, the node.result should equal the word
      node = await triePage.getTrieNodeForWord('alpha');
      expect(node.result).toBe('alpha');

      // Output should not contain an error for successful search
      expect(await triePage.getOutputText()).not.toContain('Error');

      expect(pageErrors.length).toBe(0);
    });

    test('SearchWord error cases: searching nonexistent and empty word produce errors', async ({ page }) => {
      const triePage = new TriePage(page);
      await triePage.goto();

      // Search for a word that was never added
      await triePage.setSearchInput('nonexistent');
      await triePage.clickSearch();
      expect(await triePage.getOutputText()).toBe('Error: Word not found');

      // Searching with empty input
      await triePage.setSearchInput('');
      await triePage.clickSearch();
      expect(await triePage.getOutputText()).toBe('Error: Word cannot be empty');

      expect(pageErrors.length).toBe(0);
    });

    test('DisplayWord transition: display shows the word or error if empty', async ({ page }) => {
      const triePage = new TriePage(page);
      await triePage.goto();

      // Display a provided word
      await triePage.setSearchInput('displayMe');
      await triePage.clickDisplay();
      expect(await triePage.getOutputText()).toBe('displayMe');

      // Display when input empty should show error
      await triePage.setSearchInput('');
      await triePage.clickDisplay();
      expect(await triePage.getOutputText()).toBe('Error: Word cannot be empty');

      expect(pageErrors.length).toBe(0);
    });

    test('RemoveWord transition: removing existing word deletes node.word; errors for missing/empty', async ({ page }) => {
      const triePage = new TriePage(page);
      await triePage.goto();

      // Add a word then remove it
      await triePage.setSearchInput('toRemove');
      await triePage.clickAdd();

      // Remove the word
      await triePage.setSearchInput('toRemove');
      await triePage.clickRemove();

      // Node should exist but have no 'word' content
      const node = await triePage.getTrieNodeForWord('toRemove');
      // The implementation deletes node.word, which will make node.hasWord false
      expect(node).not.toBeNull();
      expect(node.hasWord).toBe(false);

      // Removing non-existent word should show 'Error: Word not found'
      await triePage.setSearchInput('definitelyNotThere');
      await triePage.clickRemove();
      expect(await triePage.getOutputText()).toBe('Error: Word not found');

      // Removing with empty input should show cannot be empty
      await triePage.setSearchInput('');
      await triePage.clickRemove();
      expect(await triePage.getOutputText()).toBe('Error: Word cannot be empty');

      expect(pageErrors.length).toBe(0);
    });

    test('ClearTrie transition: clears internal trie and UI output/result', async ({ page }) => {
      const triePage = new TriePage(page);
      await triePage.goto();

      // Add a word and set a result to ensure clear resets everything
      await triePage.setSearchInput('clearTest');
      await triePage.clickAdd();

      // Confirm added
      let node = await triePage.getTrieNodeForWord('clearTest');
      expect(node).not.toBeNull();
      expect(node.hasWord).toBe(true);

      // Now clear
      await triePage.clickClear();

      // Trie snapshot should be reset to initial cleared state
      const snapshot = await triePage.getTrieSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot.hasWord).toBe(false);
      expect(snapshot.word).toBe('');
      expect(snapshot.result).toBe('');
      expect(snapshot.childrenKeys.length).toBe(0);

      // UI output/result cleared
      expect(await triePage.getOutputText()).toBe('');
      expect(await triePage.getResultText()).toBe('');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Output and Result click handlers (OutputClick, ResultClick)', () => {
    test('OutputClick: with child in output uses child text + trie.result to populate result', async ({ page }) => {
      const triePage = new TriePage(page);
      await triePage.goto();

      // Add a word and search to set trie.result
      await triePage.setSearchInput('xword');
      await triePage.clickAdd();
      await triePage.setSearchInput('xword');
      await triePage.clickSearch();

      // Append a child element in output with text 'childText'
      await triePage.appendChildToOutput('childText');

      // Click output to trigger outputClick()
      await page.click('#output');

      // resultDiv.textContent should equal childText + ' ' + trie.result (which was set by search)
      const expectedResult = 'childText ' + 'xword';
      const actual = await triePage.getResultText();
      expect(actual).toBe(expectedResult);

      expect(pageErrors.length).toBe(0);
    });

    test('OutputClick: when no children in output sets result to empty string', async ({ page }) => {
      const triePage = new TriePage(page);
      await triePage.goto();

      // Ensure output has no children (page loaded state)
      await page.evaluate(() => {
        const output = document.getElementById('output');
        while (output.firstChild) output.removeChild(output.firstChild);
        output.textContent = ''; // ensure no text either
      });

      // Click the output container with no children
      await page.click('#output');

      // resultDiv should be empty string according to implementation
      expect(await triePage.getResultText()).toBe('');

      expect(pageErrors.length).toBe(0);
    });

    test('ResultClick: when result has child, clicking moves child text to output; otherwise displays No result found', async ({ page }) => {
      const triePage = new TriePage(page);
      await triePage.goto();

      // Case 1: result has a child
      await triePage.appendChildToResult('rchild');
      await page.click('#result');
      // outputDiv.textContent should be set to child text 'rchild'
      expect(await triePage.getOutputText()).toBe('rchild');

      // Clean up result and ensure no children
      await page.evaluate(() => {
        const result = document.getElementById('result');
        while (result.firstChild) result.removeChild(result.firstChild);
        result.textContent = '';
      });

      // Case 2: result has no children -> clicking should set output to 'No result found'
      await page.click('#result');
      expect(await triePage.getOutputText()).toBe('No result found');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness checks', () => {
    test('Multiple adds and repeated add transitions keep node.word stable', async ({ page }) => {
      const triePage = new TriePage(page);
      await triePage.goto();

      // Add same word multiple times
      await triePage.setSearchInput('repeat');
      await triePage.clickAdd();
      await triePage.setSearchInput('repeat');
      await triePage.clickAdd();

      // Node should still have the word
      const node = await triePage.getTrieNodeForWord('repeat');
      expect(node).not.toBeNull();
      expect(node.hasWord).toBe(true);
      expect(node.word).toBe('repeat');

      expect(pageErrors.length).toBe(0);
    });

    test('Ensure no unexpected runtime errors (ReferenceError/TypeError/etc.) occur during sequences', async ({ page }) => {
      const triePage = new TriePage(page);
      await triePage.goto();

      // Perform a sequence of operations to try to surface runtime errors
      await triePage.setSearchInput('a');
      await triePage.clickAdd();
      await triePage.setSearchInput('');
      await triePage.clickRemove(); // should produce empty error message in UI, not runtime error
      await triePage.setSearchInput('a');
      await triePage.clickSearch();
      await triePage.clickDisplay();
      await triePage.clickClear();

      // Capture any page errors that may have happened
      // The test requires observing console logs and page errors; assert there were none
      expect(pageErrors.length).toBe(0);

      // If any console.error messages exist, fail the test to indicate unexpected runtime logging
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // final assertion hooks could be placed here if needed; keeping minimal cleanup
    // Ensure there are no uncaught page errors across tests unless explicitly expected by a test
    // (tests already assert pageErrors where appropriate)
  });
});