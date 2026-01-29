import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b6472-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Trie Data Structure Demo - FSM States and Transitions', () => {
  // Shared variables to collect console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // Store the message with type and text for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No teardown required beyond page lifecycle; collectors reset in beforeEach
  });

  test('Initial state S0_Idle: page renders and shows initial output', async ({ page }) => {
    // Validate Idle state's evidence: #output contains the initial prompt
    const output = page.locator('#output');
    await expect(output).toHaveText('Trie to insert some words!');

    // Ensure no runtime errors were emitted during load
    expect(pageErrors.length, `Expected no page errors on load, but got: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount, `Expected no console.error messages on load, but got: ${JSON.stringify(consoleMessages)}`).toBe(0);
  });

  test.describe('Insert, Search, Delete transitions (S1, S2, S3)', () => {
    test('InsertWord -> S1_WordInserted: inserting a word updates output and clears input', async ({ page }) => {
      const input = page.locator('#wordInput');
      const insertBtn = page.locator('button[onclick="insertWord()"]');
      const output1 = page.locator('#output1');

      // Enter word and insert
      await input.fill('test');
      await insertBtn.click();

      // Expect the output to reflect insertion and input to be cleared
      await expect(output).toHaveText('"test" inserted into trie.');
      await expect(input).toHaveValue('');

      // Validate no console errors or page errors during operation
      expect(pageErrors.length, 'No page errors expected after insert').toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length, 'No console.error expected after insert').toBe(0);
    });

    test('SearchWord -> S2_WordFound: find an existing word and not find a missing word', async ({ page }) => {
      const input1 = page.locator('#wordInput');
      const insertBtn1 = page.locator('button[onclick="insertWord()"]');
      const searchBtn = page.locator('button[onclick="searchWord()"]');
      const output2 = page.locator('#output2');

      // Insert a word to later search for it
      await input.fill('hello');
      await insertBtn.click();
      await expect(output).toHaveText('"hello" inserted into trie.');

      // Search for the inserted word (should be found)
      await input.fill('hello');
      await searchBtn.click();
      await expect(output).toHaveText('"hello" found in trie.');

      // Search for a non-existent word (should not be found)
      await input.fill('goodbye');
      await searchBtn.click();
      await expect(output).toHaveText('"goodbye" not found in trie.');

      // Validate no console errors or page errors during search flows
      expect(pageErrors.length, 'No page errors expected after searches').toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length, 'No console.error expected after searches').toBe(0);
    });

    test('DeleteWord -> S3_WordDeleted: delete existing word and attempt delete of non-existent word', async ({ page }) => {
      const input2 = page.locator('#wordInput');
      const insertBtn2 = page.locator('button[onclick="insertWord()"]');
      const deleteBtn = page.locator('button[onclick="deleteWord()"]');
      const searchBtn1 = page.locator('button[onclick="searchWord()"]');
      const output3 = page.locator('#output3');

      // Insert and then delete a word
      await input.fill('removeMe');
      await insertBtn.click();
      await expect(output).toHaveText('"removeMe" inserted into trie.');

      await input.fill('removeMe');
      await deleteBtn.click();
      await expect(output).toHaveText('"removeMe" deleted from trie.');

      // Ensure the word is no longer found
      await input.fill('removeMe');
      await searchBtn.click();
      await expect(output).toHaveText('"removeMe" not found in trie.');

      // Attempt to delete a non-existent word
      await input.fill('doesNotExist');
      await deleteBtn.click();
      await expect(output).toHaveText('"doesNotExist" not found in trie.');

      // Validate no console errors or page errors during delete flows
      expect(pageErrors.length, 'No page errors expected after deletes').toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length, 'No console.error expected after deletes').toBe(0);
    });
  });

  test.describe('Clear, Display, and ShowAllWords transitions (S4, S5, S6)', () => {
    test('ClearTrie -> S4_TrieCleared: clearing the trie resets its state and output', async ({ page }) => {
      const input3 = page.locator('#wordInput');
      const insertBtn3 = page.locator('button[onclick="insertWord()"]');
      const clearBtn = page.locator('button[onclick="clearTrie()"]');
      const showAllBtn = page.locator('button[onclick="showAllWords()"]');
      const output4 = page.locator('#output4');

      // Insert some words
      await input.fill('one');
      await insertBtn.click();
      await input.fill('two');
      await insertBtn.click();

      // Clear the trie
      await clearBtn.click();
      await expect(output).toHaveText('Trie cleared.');

      // Show all words should indicate trie is empty after clearing
      await showAllBtn.click();
      await expect(output).toHaveText('Trie is empty.');

      // Validate no page or console errors
      expect(pageErrors.length, 'No page errors expected after clear').toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length, 'No console.error expected after clear').toBe(0);
    });

    test('DisplayTrie -> S5_TrieDisplayed: display shows structure or empty message', async ({ page }) => {
      const input4 = page.locator('#wordInput');
      const insertBtn4 = page.locator('button[onclick="insertWord()"]');
      const displayBtn = page.locator('button[onclick="displayTrie()"]');
      const output5 = page.locator('#output5');

      // Ensure empty trie displays 'Trie is empty.'
      await displayBtn.click();
      await expect(output).toHaveText('Trie is empty.');

      // Insert words producing hierarchical structure
      await input.fill('a');
      await insertBtn.click();
      await input.fill('ab');
      await insertBtn.click();
      await input.fill('abc');
      await insertBtn.click();

      // Display should now show characters and possibly "(end)" markers
      await displayBtn.click();
      const text = await output.textContent();
      expect(text, 'Display output should contain at least character "a"').toContain('a');

      // Expect display to include subsequent characters and/or end markers
      // The implementation prints lines with characters and " (end)" where applicable
      expect(text).toContain('b'); // 'b' should be present in structure
      // It's reasonable to expect at least one "(end)" marker in the display for the inserted words
      expect(text.includes('(end)'), 'Expected display to include "(end)" marker for end-of-word nodes').toBeTruthy();

      // Validate no page or console errors
      expect(pageErrors.length, 'No page errors expected after display').toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length, 'No console.error expected after display').toBe(0);
    });

    test('ShowAllWords -> S6_AllWordsShown: shows all inserted words or empty message', async ({ page }) => {
      const input5 = page.locator('#wordInput');
      const insertBtn5 = page.locator('button[onclick="insertWord()"]');
      const showAllBtn1 = page.locator('button[onclick="showAllWords()"]');
      const output6 = page.locator('#output6');

      // Ensure empty trie first
      await showAllBtn.click();
      await expect(output).toHaveText('Trie is empty.');

      // Insert multiple words
      const words = ['alpha', 'beta', 'gamma'];
      for (const w of words) {
        await input.fill(w);
        await insertBtn.click();
        await expect(output).toHaveText(`"${w}" inserted into trie.`);
      }

      // Show all words and validate output formatting
      await showAllBtn.click();
      const displayed = await output.textContent();
      expect(displayed.startsWith('Words in trie:\n'), 'Expected output to start with header').toBeTruthy();
      for (const w of words) {
        expect(displayed).toContain(w);
      }

      // Validate no page or console errors
      expect(pageErrors.length, 'No page errors expected after showAllWords').toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length, 'No console.error expected after showAllWords').toBe(0);
    });
  });

  test.describe('Edge cases & error scenarios for empty input', () => {
    test('Insert without input should prompt for input', async ({ page }) => {
      const insertBtn6 = page.locator('button[onclick="insertWord()"]');
      const output7 = page.locator('#output7');

      // Ensure input is empty and click Insert
      await page.locator('#wordInput').fill('');
      await insertBtn.click();
      await expect(output).toHaveText('Please enter a word to insert.');

      // Validate no runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });

    test('Search without input should prompt for input', async ({ page }) => {
      const searchBtn2 = page.locator('button[onclick="searchWord()"]');
      const output8 = page.locator('#output8');

      await page.locator('#wordInput').fill('');
      await searchBtn.click();
      await expect(output).toHaveText('Please enter a word to search.');

      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });

    test('Delete without input should prompt for input', async ({ page }) => {
      const deleteBtn1 = page.locator('button[onclick="deleteWord()"]');
      const output9 = page.locator('#output9');

      await page.locator('#wordInput').fill('');
      await deleteBtn.click();
      await expect(output).toHaveText('Please enter a word to delete.');

      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });
  });

  test('Verify onEnter actions and FSM evidence (renderPage entry) and overall absence of runtime errors', async ({ page }) => {
    // The FSM indicates an entry action renderPage() for S0_Idle; in the provided implementation
    // the page renders initial content. We validate initial output again as the evidence of renderPage.
    const output10 = page.locator('#output10');
    await expect(output).toHaveText('Trie to insert some words!');

    // Also assert that throughout loading and basic interactions we observed no uncaught page errors
    // and no console.error entries. We include a simple interaction to ensure dynamic behavior is exercised.
    await page.locator('#wordInput').fill('x');
    await page.locator('button[onclick="insertWord()"]').click();
    await expect(output).toHaveText('"x" inserted into trie.');

    // Final checks for errors
    expect(pageErrors.length, `Expected zero page errors; found: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length, `Expected zero console.error messages; found: ${JSON.stringify(errorConsole)}`).toBe(0);
  });
});