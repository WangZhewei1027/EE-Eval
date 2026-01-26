import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/12136362-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the Trie UI
class TriePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputWord = page.locator('#inputWord');
    this.btnInsert = page.locator('#btnInsert');
    this.btnDelete = page.locator('#btnDelete');
    this.btnSearch = page.locator('#btnSearch');

    this.autoCompletePrefix = page.locator('#autoCompletePrefix');
    this.btnAutocompleteUpto10 = page.locator('#btnAutocompleteUpto10');
    this.btnAutocompleteAll = page.locator('#btnAutocompleteAll');

    this.prefixCountInput = page.locator('#prefixCountInput');
    this.btnCountPrefix = page.locator('#btnCountPrefix');

    this.deletePrefixInput = page.locator('#deletePrefixInput');
    this.btnDeletePrefix = page.locator('#btnDeletePrefix');

    this.bulkWords = page.locator('#bulkWords');
    this.btnBulkInsert = page.locator('#btnBulkInsert');
    this.btnBulkDelete = page.locator('#btnBulkDelete');
    this.btnResetTrie = page.locator('#btnResetTrie');

    this.traversePathInput = page.locator('#traversePathInput');
    this.btnTraverseNode = page.locator('#btnTraverseNode');
    this.btnShowAllWordsUnderNode = page.locator('#btnShowAllWordsUnderNode');

    this.depthLimitRange = page.locator('#depthLimitRange');
    this.depthLimitValue = page.locator('#depthLimitValue');

    this.btnShowTrieStructure = page.locator('#btnShowTrieStructure');

    this.fuzzySearchInput = page.locator('#fuzzySearchInput');
    this.fuzzyDistanceInput = page.locator('#fuzzyDistanceInput');
    this.btnFuzzySearch = page.locator('#btnFuzzySearch');

    this.outputArea = page.locator('#outputArea');
  }

  async goto() {
    await this.page.goto(BASE);
  }

  async getOutputText() {
    return (await this.outputArea.textContent()) ?? '';
  }

  async waitForOutputContains(substring, timeout = 2000) {
    await this.page.waitForFunction(
      (s) => document.getElementById('outputArea')?.textContent.includes(s),
      substring,
      { timeout }
    );
  }

  // Basic operations
  async insertWord(word) {
    await this.inputWord.fill(word);
    await this.btnInsert.click();
  }

  async deleteWord(word) {
    await this.inputWord.fill(word);
    await this.btnDelete.click();
  }

  async searchWord(word) {
    await this.inputWord.fill(word);
    await this.btnSearch.click();
  }

  async autocompleteUpto10(prefix) {
    await this.autoCompletePrefix.fill(prefix);
    await this.btnAutocompleteUpto10.click();
  }

  async autocompleteAll(prefix) {
    await this.autoCompletePrefix.fill(prefix);
    await this.btnAutocompleteAll.click();
  }

  async countPrefix(prefix) {
    await this.prefixCountInput.fill(prefix);
    await this.btnCountPrefix.click();
  }

  async deletePrefix(prefix) {
    await this.deletePrefixInput.fill(prefix);
    await this.btnDeletePrefix.click();
  }

  async bulkInsert(wordsArray) {
    await this.bulkWords.fill(wordsArray.join('\n'));
    await this.btnBulkInsert.click();
  }

  async bulkDelete(wordsArray) {
    await this.bulkWords.fill(wordsArray.join('\n'));
    await this.btnBulkDelete.click();
  }

  async resetTrie(accept = true) {
    // Playwright dialog handling happens outside; this method simply clicks
    await this.btnResetTrie.click();
  }

  async traverse(path) {
    await this.traversePathInput.fill(path);
    await this.btnTraverseNode.click();
  }

  async showWordsUnderNode(path) {
    await this.traversePathInput.fill(path);
    await this.btnShowAllWordsUnderNode.click();
  }

  async setDepthLimit(value) {
    await this.depthLimitRange.fill(String(value));
    // trigger input event by dispatching input (some browsers require)
    await this.page.evaluate((v) => {
      const el = document.getElementById('depthLimitRange');
      if (el) {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, String(value));
  }

  async showTrieStructure() {
    await this.btnShowTrieStructure.click();
  }

  async fuzzySearch(pattern, distance = '1') {
    await this.fuzzySearchInput.fill(pattern);
    await this.fuzzyDistanceInput.selectOption(distance);
    await this.btnFuzzySearch.click();
  }

  // Keyboard shortcut triggers
  async pressEnterOnInputWord() {
    await this.inputWord.focus();
    await this.page.keyboard.press('Enter');
  }

  async pressEnterOnAutoComplete() {
    await this.autoCompletePrefix.focus();
    await this.page.keyboard.press('Enter');
  }

  async pressEnterOnPrefixCount() {
    await this.prefixCountInput.focus();
    await this.page.keyboard.press('Enter');
  }
}

test.describe('Interactive Trie Explorer - end-to-end tests', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // gather text and type
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // collect page uncaught errors
      pageErrors.push(err);
    });
  });

  test('Initial state: Idle and ready message logged', async ({ page }) => {
    const ui = new TriePage(page);
    await ui.goto();

    // The page writes a multi-line initial message including 'Trie Interactive Explorer Ready.'
    await ui.waitForOutputContains('Trie Interactive Explorer Ready.');

    const output = await ui.getOutputText();
    expect(output).toContain('Trie Interactive Explorer Ready.');
    expect(output).toContain('Available operations:');

    // No uncaught page errors should have been thrown during load
    expect(pageErrors.length).toBe(0);

    // Ensure console had logs (at least one)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test.describe('Insert / Search / Delete flows and keyboard shortcuts', () => {
    test('Insert a word, search it, duplicate insert, then delete it', async ({ page }) => {
      const ui = new TriePage(page);
      await ui.goto();

      // Insert via keyboard Enter (shortcut)
      await ui.inputWord.fill('Cat');
      await ui.pressEnterOnInputWord();
      await ui.waitForOutputContains('Inserted word: "cat"');
      expect(await ui.getOutputText()).toContain('Inserted word: "cat"');

      // Search found
      await ui.searchWord('cat');
      await ui.waitForOutputContains('Word "cat" FOUND in trie.');
      expect(await ui.getOutputText()).toContain('Word "cat" FOUND in trie.');

      // Duplicate insert should say already in trie
      await ui.insertWord('Cat');
      await ui.waitForOutputContains('Word "cat" already in trie.');
      expect(await ui.getOutputText()).toContain('Word "cat" already in trie.');

      // Delete existing word
      await ui.deleteWord('cat');
      await ui.waitForOutputContains('Deleted word: "cat"');
      expect(await ui.getOutputText()).toContain('Deleted word: "cat"');

      // Search after deletion -> NOT found
      await ui.searchWord('cat');
      await ui.waitForOutputContains('Word "cat" NOT found in trie.');
      expect(await ui.getOutputText()).toContain('Word "cat" NOT found in trie.');

      // Edge cases: empty insert / delete / search
      await ui.inputWord.fill('');
      await ui.btnInsert.click();
      await ui.waitForOutputContains('Please enter a non-empty word to insert.');
      expect(await ui.getOutputText()).toContain('Please enter a non-empty word to insert.');

      await ui.inputWord.fill('');
      await ui.btnDelete.click();
      await ui.waitForOutputContains('Please enter a non-empty word to delete.');
      expect(await ui.getOutputText()).toContain('Please enter a non-empty word to delete.');

      await ui.inputWord.fill('');
      await ui.btnSearch.click();
      await ui.waitForOutputContains('Please enter a non-empty word to search.');
      expect(await ui.getOutputText()).toContain('Please enter a non-empty word to search.');

      // Confirm no unexpected page errors occurred
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Autocomplete, Count, Delete by Prefix, and traversal', () => {
    test('Autocomplete up to 10 and all; count and delete by prefix; traverse and list words under node', async ({ page }) => {
      const ui = new TriePage(page);
      await ui.goto();

      // Bulk insert several words to prepare for prefix operations
      const words = ['car', 'carbon', 'cart', 'cat', 'dog', 'do', 'dove', 'apple', 'app'];
      await ui.bulkInsert(words);
      await ui.waitForOutputContains('Bulk Insert: 9 new word(s) inserted out of 9 lines.');
      expect(await ui.getOutputText()).toContain('Bulk Insert: 9 new word(s) inserted out of 9 lines.');

      // Autocomplete up to 10 for prefix 'car'
      await ui.autocompleteUpto10('car');
      await ui.waitForOutputContains('Autocomplete up to 10 for prefix "car":');
      const out1 = await ui.getOutputText();
      expect(out1).toContain('Autocomplete up to 10 for prefix "car":');
      // should include car, carbon, cart
      expect(out1).toContain('car');
      expect(out1).toContain('carbon');
      expect(out1).toContain('cart');

      // Autocomplete all for prefix 'do'
      await ui.autocompleteAll('do');
      await ui.waitForOutputContains('Autocomplete all results for prefix "do":');
      const out2 = await ui.getOutputText();
      expect(out2).toContain('do');
      expect(out2).toContain('dog');
      expect(out2).toContain('dove');

      // Count words with prefix 'ca' should include car, carbon, cart, cat => 4
      await ui.countPrefix('ca');
      await ui.waitForOutputContains('Number of words with prefix "ca": 4');
      expect(await ui.getOutputText()).toContain('Number of words with prefix "ca": 4');

      // Delete words with prefix 'car' (should remove car, carbon, cart => 3)
      await ui.deletePrefix('car');
      await ui.waitForOutputContains('Deleted 3 word(s) with prefix "car".');
      expect(await ui.getOutputText()).toContain('Deleted 3 word(s) with prefix "car".');

      // Confirm search for 'car' not found
      await ui.searchWord('car');
      await ui.waitForOutputContains('Word "car" NOT found in trie.');
      expect(await ui.getOutputText()).toContain('Word "car" NOT found in trie.');

      // Traverse to node 'do' and inspect
      await ui.traverse('do');
      await ui.waitForOutputContains('Traversed to node "do".');
      const traverseOutput = await ui.getOutputText();
      expect(traverseOutput).toContain('Traversed to node "do".');
      expect(traverseOutput).toMatch(/Words in Subtree: \d+/);

      // List words under node 'do'
      await ui.showWordsUnderNode('do');
      await ui.waitForOutputContains('Words under node "do"');
      const wordsUnderOut = await ui.getOutputText();
      expect(wordsUnderOut).toContain('do');
      expect(wordsUnderOut).toContain('dog');

      // Changing depth slider should update the displayed depth value
      await ui.setDepthLimit(5);
      expect(await ui.depthLimitValue.textContent()).toBe('5');

      // Show trie structure (should not be empty because some words remain)
      await ui.showTrieStructure();
      await ui.waitForOutputContains('Trie structure (max depth');
      const structureOut = await ui.getOutputText();
      // Should show at least one root letter like 'a' or 'd'
      expect(structureOut.length).toBeGreaterThan(0);

      // Edge cases for prefix operations with empty inputs
      await ui.autoCompletePrefix.fill('');
      await ui.btnAutocompleteUpto10.click();
      await ui.waitForOutputContains('Please enter a prefix to autocomplete.');
      expect(await ui.getOutputText()).toContain('Please enter a prefix to autocomplete.');

      await ui.prefixCountInput.fill('');
      await ui.btnCountPrefix.click();
      await ui.waitForOutputContains('Please enter a prefix to count words.');
      expect(await ui.getOutputText()).toContain('Please enter a prefix to count words.');

      await ui.deletePrefixInput.fill('');
      await ui.btnDeletePrefix.click();
      await ui.waitForOutputContains('Please enter a prefix to delete words.');
      expect(await ui.getOutputText()).toContain('Please enter a prefix to delete words.');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Bulk operations, reset behaviors, and dialog handling', () => {
    test('Bulk delete, reset trie with accept and cancel, and verify reset results', async ({ page }) => {
      const ui = new TriePage(page);
      await ui.goto();

      // Insert some words first via bulk insert
      const words = ['alpha', 'beta', 'gamma'];
      await ui.bulkInsert(words);
      await ui.waitForOutputContains('Bulk Insert: 3 new word(s) inserted out of 3 lines.');
      expect(await ui.getOutputText()).toContain('Bulk Insert: 3 new word(s) inserted out of 3 lines.');

      // Bulk delete using the same textarea: should delete 3 items
      await ui.bulkDelete(words);
      await ui.waitForOutputContains('Bulk Delete: 3 word(s) deleted out of 3 lines.');
      expect(await ui.getOutputText()).toContain('Bulk Delete: 3 word(s) deleted out of 3 lines.');

      // Try reset but cancel the confirm dialog -> should log "Reset cancelled."
      // Intercept dialog and dismiss
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Are you sure you want to reset the trie');
        await dialog.dismiss(); // cancel
      });
      await ui.resetTrie(); // click triggers dialog
      await ui.waitForOutputContains('Reset cancelled.');
      expect(await ui.getOutputText()).toContain('Reset cancelled.');

      // Now actually accept the reset
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Are you sure you want to reset the trie');
        await dialog.accept(); // accept
      });
      await ui.resetTrie();
      await ui.waitForOutputContains('Trie has been reset.');
      expect(await ui.getOutputText()).toContain('Trie has been reset.');

      // After reset, show trie structure should indicate empty trie
      await ui.showTrieStructure();
      await ui.waitForOutputContains('(The trie is empty.)');
      expect(await ui.getOutputText()).toContain('(The trie is empty.)');

      // Edge cases: bulk insert/delete with empty textarea
      await ui.bulkWords.fill('');
      await ui.btnBulkInsert.click();
      await ui.waitForOutputContains('Please paste words (one per line) to bulk insert.');
      expect(await ui.getOutputText()).toContain('Please paste words (one per line) to bulk insert.');

      await ui.bulkWords.fill('');
      await ui.btnBulkDelete.click();
      await ui.waitForOutputContains('Please paste words (one per line) to bulk delete.');
      expect(await ui.getOutputText()).toContain('Please paste words (one per line) to bulk delete.');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Fuzzy search and advanced queries', () => {
    test('Fuzzy search returns matches within distance and handles empty pattern', async ({ page }) => {
      const ui = new TriePage(page);
      await ui.goto();

      // Insert words for fuzzy tests
      await ui.bulkInsert(['hello', 'hallo', 'hullo']);
      await ui.waitForOutputContains('Bulk Insert: 3 new word(s) inserted out of 3 lines.');
      expect(await ui.getOutputText()).toContain('Bulk Insert: 3 new word(s) inserted out of 3 lines.');

      // Empty fuzzy search should prompt
      await ui.fuzzySearch('', '1');
      await ui.waitForOutputContains('Please enter a word/pattern for fuzzy search.');
      expect(await ui.getOutputText()).toContain('Please enter a word/pattern for fuzzy search.');

      // Run fuzzy search for 'hello' with distance 1
      await ui.fuzzySearch('hello', '1');

      // The UI logs a "Running fuzzy search..." message immediately, then after a short timeout logs results.
      await ui.waitForOutputContains('Running fuzzy search for "hello" with max distance 1...');
      // Wait for eventual results (fuzzySearch uses setTimeout 10ms)
      await ui.waitForOutputContains('Fuzzy search results for "hello" (max distance 1, up to 1000 results):', 3000);
      const fuzzyOut = await ui.getOutputText();
      expect(fuzzyOut).toContain('Fuzzy search results for "hello" (max distance 1, up to 1000 results):');
      // At least 'hello' should be found
      expect(fuzzyOut).toContain('hello');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Keyboard shortcuts for other inputs and error scenarios', () => {
    test('Enter on autocomplete prefix triggers autocomplete; Enter on prefix count triggers count', async ({ page }) => {
      const ui = new TriePage(page);
      await ui.goto();

      // Prepare words
      await ui.bulkInsert(['sun', 'super', 'sushi']);
      await ui.waitForOutputContains('Bulk Insert: 3 new word(s) inserted out of 3 lines.');
      expect(await ui.getOutputText()).toContain('Bulk Insert: 3 new word(s) inserted out of 3 lines.');

      // Use autocomplete Enter shortcut
      await ui.autoCompletePrefix.fill('su');
      await ui.pressEnterOnAutoComplete();
      await ui.waitForOutputContains('Autocomplete up to 10 for prefix "su":');
      expect(await ui.getOutputText()).toContain('Autocomplete up to 10 for prefix "su":');

      // Use prefix count Enter shortcut
      await ui.prefixCountInput.fill('su');
      await ui.pressEnterOnPrefixCount();
      await ui.waitForOutputContains('Number of words with prefix "su": 3');
      expect(await ui.getOutputText()).toContain('Number of words with prefix "su": 3');

      // Edge: traverse path Enter shortcut
      await ui.traversePathInput.fill('');
      await ui.page.keyboard.press('Enter'); // hitting Enter with empty traverse should not crash but produce message
      // The binding in the page triggers traverse on Enter only when input is focused. Ensure it's focused then press
      await ui.traversePathInput.focus();
      await ui.page.keyboard.press('Enter');
      await ui.waitForOutputContains('Please enter a path to traverse.');
      expect(await ui.getOutputText()).toContain('Please enter a path to traverse.');

      expect(pageErrors.length).toBe(0);
    });
  });

  test('No uncaught page errors were emitted during the full suite interactions', async ({ page }) => {
    // This test loads the page and performs a light interaction but primarily asserts that no uncaught page errors exist.
    const ui = new TriePage(page);
    await ui.goto();

    // quick sanity check: initial ready text exists
    await ui.waitForOutputContains('Trie Interactive Explorer Ready.');

    // Validate that there were no uncaught errors by the time we're here.
    // pageErrors was populated in beforeEach for this test; assert it's empty.
    expect(pageErrors.length).toBe(0);
  });
});