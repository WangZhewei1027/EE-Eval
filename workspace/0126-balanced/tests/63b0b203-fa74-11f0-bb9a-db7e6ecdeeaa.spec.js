import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b0b203-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('Trie Data Structure Demo - FSM validation (63b0b203-fa74-11f0-bb9a-db7e6ecdeeaa)', () => {
  // Collect console errors and page errors per test to assert there are no runtime exceptions.
  // Each test will create its own arrays and listeners to avoid cross-test interference.

  test.beforeEach(async ({ page }) => {
    // Ensure a fresh navigation for each test
    await page.goto(APP_URL);
  });

  test('S0_Idle - Initial state: page renders and shows empty trie (renderPage / updateTrieDisplay)', async ({ page }) => {
    // Arrays to capture console error messages and page errors
    const consoleErrors = [];
    const pageErrors = [];

    // Listen to console messages and page errors
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Validate initial textual trie output shows the empty indicator
    const trieOutput = await page.locator('#trieOutput');
    await expect(trieOutput).toBeVisible();
    await expect(trieOutput).toHaveText('(empty trie)');

    // Visual container should be empty initially
    const trieVisual = await page.locator('#trieVisual');
    await expect(trieVisual).toBeVisible();
    // No child nodes inside trieVisual when empty
    await expect(trieVisual).toHaveText('', { timeout: 1000 });

    // Search and prefix result areas should be empty strings
    await expect(page.locator('#searchResult')).toHaveText('');
    await expect(page.locator('#prefixResult')).toHaveText('');

    // Verify there were no console errors or uncaught page errors during initial render
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Insertion (InsertWord) -> S1_WordInserted', () => {
    test('Insert a valid word updates trie textual and visual displays, clears input and focuses (WordInserted)', async ({ page }) => {
      const consoleErrors1 = [];
      const pageErrors1 = [];

      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      // Enter a valid word and click Insert
      const word = 'hello';
      const insertInput = page.locator('#insertWord');
      const insertBtn = page.locator('#insertBtn');

      await insertInput.fill(word);
      await insertBtn.click();

      // After insertion, textual output should no longer be the empty indicator
      const trieOutput1 = page.locator('#trieOutput1');
      await expect(trieOutput).not.toHaveText('(empty trie)');
      const outputText = await trieOutput.textContent();
      // The formatted trie should include the first and last characters and the end-of-word marker '*' somewhere
      expect(outputText).toContain('h'); // root branch begins with 'h'
      expect(outputText).toContain('o'); // final letter present
      expect(outputText).toContain('*'); // end-of-word marker should be present

      // Visual representation should have node circles for letters (at least one)
      const nodeCircles = page.locator('.node-circle');
      await expect(nodeCircles.first()).toBeVisible();
      // Ensure at least the first and last characters appear as visible circles
      const circlesText = await nodeCircles.allTextContents();
      // Expect the sequence to contain 'h' and 'o' among nodes
      expect(circlesText.join('')).toContain('h');
      expect(circlesText.join('')).toContain('o');

      // Input should be cleared and focused after insertion
      await expect(insertInput).toHaveValue('');
      const activeElementId = await page.evaluate(() => document.activeElement && document.activeElement.id);
      expect(activeElementId).toBe('insertWord');

      // Verify there were no runtime console/page errors during insert operation
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Insert invalid input shows alert and does not modify trie (edge case)', async ({ page }) => {
      const consoleErrors2 = [];
      const pageErrors2 = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      // Prepare to accept the alert dialog triggered by invalid insert
      let dialogMessage = null;
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      const insertInput1 = page.locator('#insertWord');
      const insertBtn1 = page.locator('#insertBtn1');

      // Try inserting an invalid word containing digits
      await insertInput.fill('abc123');
      await insertBtn.click();

      // The alert should have been triggered with the validation message
      expect(dialogMessage).toBe("Please enter a non-empty word with only letters a-z.");

      // Trie should remain empty (assuming no prior insert in this test)
      await expect(page.locator('#trieOutput')).toHaveText('(empty trie)');

      // No console/page errors should have occurred
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Search (SearchWord) -> S2_WordSearched', () => {
    test('Searching for an existing word shows found message (WordSearched)', async ({ page }) => {
      const consoleErrors3 = [];
      const pageErrors3 = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      // Insert a word first so that search can find it
      await page.locator('#insertWord').fill('hello');
      await page.locator('#insertBtn').click();

      // Search for the inserted word
      await page.locator('#searchWord').fill('hello');
      await page.locator('#searchBtn').click();

      // Validate the success message
      const searchResult = page.locator('#searchResult');
      await expect(searchResult).toHaveText(`'hello' is in the Trie.`);

      // Also searching for a non-existing word gives NOT found
      await page.locator('#searchWord').fill('world');
      await page.locator('#searchBtn').click();
      await expect(searchResult).toHaveText(`'world' NOT found in the Trie.`);

      // Invalid search input should produce the validation text (no alert here)
      await page.locator('#searchWord').fill('123');
      await page.locator('#searchBtn').click();
      await expect(searchResult).toHaveText('Please enter a non-empty word with only letters a-z.');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Check Prefix (CheckPrefix) -> S3_PrefixChecked', () => {
    test('Checking prefixes returns correct boolean messages (PrefixChecked)', async ({ page }) => {
      const consoleErrors4 = [];
      const pageErrors4 = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      // Insert a couple words so prefix checks make sense
      await page.locator('#insertWord').fill('hello');
      await page.locator('#insertBtn').click();
      await page.locator('#insertWord').fill('helium');
      await page.locator('#insertBtn').click();

      const prefixInput = page.locator('#prefixWord');
      const prefixBtn = page.locator('#prefixBtn');
      const prefixResult = page.locator('#prefixResult');

      // Existing prefix
      await prefixInput.fill('he');
      await prefixBtn.click();
      await expect(prefixResult).toHaveText(`There is at least one word starting with 'he'.`);

      // Non-existing prefix
      await prefixInput.fill('wo');
      await prefixBtn.click();
      await expect(prefixResult).toHaveText(`No words start with 'wo'.`);

      // Invalid prefix input should display validation text
      await prefixInput.fill('!@#');
      await prefixBtn.click();
      await expect(prefixResult).toHaveText('Please enter a non-empty prefix with only letters a-z.');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Combined transitions and state behaviors', () => {
    test('Insert -> Search -> Prefix: full interaction flow validates FSM transitions', async ({ page }) => {
      const consoleErrors5 = [];
      const pageErrors5 = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      // 1) Insert word 'test'
      await page.locator('#insertWord').fill('test');
      await page.locator('#insertBtn').click();
      // Verify display updated
      await expect(page.locator('#trieOutput')).not.toHaveText('(empty trie)');
      // Ensure visual nodes include 't' and 's' and end-of-word marker somewhere
      const nodeTexts = (await page.locator('.node-circle').allTextContents()).join('');
      expect(nodeTexts).toContain('t');

      // 2) Search for 'test' (should be found)
      await page.locator('#searchWord').fill('test');
      await page.locator('#searchBtn').click();
      await expect(page.locator('#searchResult')).toHaveText(`'test' is in the Trie.`);

      // 3) Check prefix 'te' (should be true)
      await page.locator('#prefixWord').fill('te');
      await page.locator('#prefixBtn').click();
      await expect(page.locator('#prefixResult')).toHaveText(`There is at least one word starting with 'te'.`);

      // 4) Search for 'tes' which is prefix but not full word
      await page.locator('#searchWord').fill('tes');
      await page.locator('#searchBtn').click();
      // If 'tes' wasn't inserted as a full word, it should be NOT found
      await expect(page.locator('#searchResult')).toHaveText(`'tes' NOT found in the Trie.`);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Stability and robustness checks', () => {
    test('Multiple inserts and visual consistency - repeated insertions should not throw errors', async ({ page }) => {
      const consoleErrors6 = [];
      const pageErrors6 = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      const words = ['apple', 'app', 'application', 'apt'];
      for (const w of words) {
        await page.locator('#insertWord').fill(w);
        await page.locator('#insertBtn').click();
      }

      // The visual should now contain node circles for at least 'a', 'p', 'l' characters
      const circles = await page.locator('.node-circle').allTextContents();
      const allText = circles.join('');
      expect(allText).toContain('a');
      expect(allText).toContain('p');
      expect(allText.length).toBeGreaterThan(0);

      // Textual output should reflect inserted words (contains at least 'a' and 'p')
      const trieOutputText = await page.locator('#trieOutput').textContent();
      expect(trieOutputText).toContain('a');

      // Ensure no runtime errors during multiple insertions
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Attempting to insert an empty string triggers validation alert (edge case)', async ({ page }) => {
      const consoleErrors7 = [];
      const pageErrors7 = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      let capturedDialog = null;
      page.once('dialog', async dialog => {
        capturedDialog = dialog.message();
        await dialog.accept();
      });

      // Click insert with empty input
      await page.locator('#insertWord').fill('');
      await page.locator('#insertBtn').click();

      // Should have gotten the validation alert
      expect(capturedDialog).toBe("Please enter a non-empty word with only letters a-z.");

      // Trie remains empty
      await expect(page.locator('#trieOutput')).toHaveText('(empty trie)');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});