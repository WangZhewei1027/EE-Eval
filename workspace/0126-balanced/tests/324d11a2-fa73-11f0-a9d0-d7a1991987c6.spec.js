import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d11a2-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Trie Demo page
class TriePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#wordInput');
    this.insertButton = page.locator('button[onclick="insertWord()"]');
    this.searchButton = page.locator('button[onclick="searchWord()"]');
    this.displayButton = page.locator('button[onclick="displayTrie()"]');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async insertWord(word) {
    // Type the word into the input and click Insert
    await this.input.fill(word);
    await this.insertButton.click();
  }

  async searchWord(word) {
    await this.input.fill(word);
    await this.searchButton.click();
  }

  async displayTrie() {
    await this.displayButton.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async isInputEmpty() {
    const v = await this.input.inputValue();
    return v === '';
  }
}

test.describe('Trie Data Structure Demo - FSM states and transitions', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // store type and text for easier assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Basic sanity: page loaded and has expected title
    await expect(page).toHaveTitle(/Trie Data Structure Demo/);
  });

  test.afterEach(async () => {
    // After each test ensure there were no unexpected runtime exceptions thrown on the page.
    // We assert no uncaught page errors and no console messages of type 'error'.
    expect(pageErrors, 'No page errors should have occurred').toEqual([]);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors, `No console.error() messages expected but found: ${consoleErrors.map(e => e.text).join(' | ')}`).toEqual([]);
  });

  test('Idle state: initial render - input, buttons, and output are present', async ({ page }) => {
    // Validate Idle (S0_Idle) state: DOM elements rendered as expected
    const trie = new TriePage(page);

    await expect(trie.input).toBeVisible();
    await expect(trie.insertButton).toBeVisible();
    await expect(trie.searchButton).toBeVisible();
    await expect(trie.displayButton).toBeVisible();
    await expect(trie.output).toBeVisible();

    // Output should be empty initially
    const out = await trie.getOutputText();
    expect(out).toBe('', 'Output should initially be empty in Idle state');
  });

  test('InsertWord transition (S0 -> S1): inserting a single word updates output and clears input', async ({ page }) => {
    // This test validates the InsertWord event and S1_WordInserted state evidence:
    // output.innerText = `Inserted: ${input}` and input is cleared after insert.
    const trie1 = new TriePage(page);

    await trie.insertWord('apple');

    // After insertion, the output should reflect the inserted word
    await expect(trie.output).toHaveText('Inserted: apple');

    // Input should be cleared as the implementation resets it
    expect(await trie.isInputEmpty()).toBe(true);
  });

  test('SearchWord transition (S0 -> S2): searching for existing and non-existing words', async ({ page }) => {
    // Validate searching behavior: Found vs Not Found
    const trie2 = new TriePage(page);

    // Ensure trie contains 'apple'
    await trie.insertWord('apple');
    await expect(trie.output).toHaveText('Inserted: apple');

    // Search for existing word -> Found
    await trie.searchWord('apple');
    await expect(trie.output).toHaveText('Search "apple": Found');

    // Search for prefix that is not marked as end -> Not Found
    await trie.searchWord('app');
    await expect(trie.output).toHaveText('Search "app": Not Found');

    // Search for completely absent word -> Not Found
    await trie.searchWord('banana');
    await expect(trie.output).toHaveText('Search "banana": Not Found');
  });

  test('DisplayTrie transition (S0 -> S3): displaying the trie shows inserted words', async ({ page }) => {
    // Validate display functionality lists words inserted into the trie
    const trie3 = new TriePage(page);

    // Insert multiple words
    await trie.insertWord('app');
    await expect(trie.output).toHaveText('Inserted: app');

    await trie.insertWord('apple');
    await expect(trie.output).toHaveText('Inserted: apple');

    await trie.insertWord('bat');
    await expect(trie.output).toHaveText('Inserted: bat');

    // Trigger display
    await trie.displayTrie();

    const out1 = await trie.getOutputText();
    // Output should start with 'Trie Structure:' and include each inserted word in some order
    expect(out.startsWith('Trie Structure:'), 'Display should begin with header').toBe(true);
    // Check presence of words - order not strictly guaranteed, but substrings must be present
    expect(out.includes('app'), 'Displayed trie structure should include "app"').toBe(true);
    expect(out.includes('apple'), 'Displayed trie structure should include "apple"').toBe(true);
    expect(out.includes('bat'), 'Displayed trie structure should include "bat"').toBe(true);
  });

  test('Edge case: inserting empty string and subsequent search/display behavior', async ({ page }) => {
    // Validate how the trie handles empty string insertion and searching
    const trie4 = new TriePage(page);

    // Insert empty string
    await trie.insertWord('');
    // Output should show Inserted: [empty] i.e., 'Inserted: '
    await expect(trie.output).toHaveText('Inserted: ');

    // Searching for empty string after insertion should be Found (root marked as end)
    await trie.searchWord('');
    await expect(trie.output).toHaveText('Search "": Found');

    // Displaying trie should include a blank line for the empty word (root is end of word)
    await trie.displayTrie();
    const out2 = await trie.getOutputText();
    expect(out.startsWith('Trie Structure:'), 'Display should begin with header').toBe(true);
    // There should be at least one newline after header representing the empty word entry
    expect(out.includes('\n'), 'Trie display should contain newline characters').toBe(true);
  });

  test('Robustness: multiple sequential operations and state consistency', async ({ page }) => {
    // Perform a sequence of operations and verify consistent state transitions and outputs
    const trie5 = new TriePage(page);

    // Insert words and validate each insertion message
    const words = ['car', 'card', 'care', 'dog'];
    for (const w of words) {
      await trie.insertWord(w);
      await expect(trie.output).toHaveText(`Inserted: ${w}`);
    }

    // Search for some of them
    await trie.searchWord('card');
    await expect(trie.output).toHaveText('Search "card": Found');

    await trie.searchWord('cars');
    await expect(trie.output).toHaveText('Search "cars": Not Found');

    // Display and assert that at least the known inserted words appear
    await trie.displayTrie();
    const out3 = await trie.getOutputText();
    expect(out.startsWith('Trie Structure:'), 'Display should begin with header').toBe(true);
    for (const w of words) {
      expect(out.includes(w), `Displayed trie should include "${w}"`).toBe(true);
    }
  });

  test('Monitoring console and page runtime: no unexpected errors during typical operations', async ({ page }) => {
    // This test explicitly performs a set of interactions and asserts that no runtime errors
    // (ReferenceError, TypeError, SyntaxError) or console.error messages occurred.
    const trie6 = new TriePage(page);

    // Perform typical interactions
    await trie.insertWord('alpha');
    await trie.insertWord('beta');
    await trie.searchWord('alpha');
    await trie.displayTrie();

    // At this point after interactions, the afterEach hook will assert there were no page errors
    // and no console.error messages. For additional explicitness, assert here as well:
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});