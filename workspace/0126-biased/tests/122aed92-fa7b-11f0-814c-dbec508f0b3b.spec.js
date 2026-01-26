import { test, expect } from '@playwright/test';

// Test file for Application ID: 122aed92-fa7b-11f0-814c-dbec508f0b3b
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/122aed92-fa7b-11f0-814c-dbec508f0b3b.html
// Filename requirement: 122aed92-fa7b-11f0-814c-dbec508f0b3b.spec.js

// Page Object encapsulating operations against the Multiset page
class MultisetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#input');
    this.addBtn = page.locator('#add-word-btn');
    this.removeBtn = page.locator('#remove-word-btn');
    this.clearBtn = page.locator('#clear-btn');
    this.wordsEl = page.locator('#multiset-words');
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/122aed92-fa7b-11f0-814c-dbec508f0b3b.html', { waitUntil: 'domcontentloaded' });
  }

  async typeIntoInput(text) {
    await this.input.fill(text);
    // Trigger input event (fill triggers it automatically, but keep for clarity)
    await this.input.press('End');
  }

  async addWord(word) {
    if (word !== undefined) {
      await this.typeIntoInput(word);
    }
    await this.addBtn.click();
  }

  async removeWord(word) {
    if (word !== undefined) {
      await this.typeIntoInput(word);
    }
    await this.removeBtn.click();
  }

  async clearMultiset() {
    await this.clearBtn.click();
  }

  async getWordsInnerHTML() {
    return await this.wordsEl.evaluate(node => node.innerHTML);
  }

  async getWordsTextContent() {
    return await this.wordsEl.evaluate(node => node.textContent);
  }

  async getWordsSizeFromPage() {
    // Access the internal 'words' Set declared on the page
    return await this.page.evaluate(() => {
      try {
        return typeof words !== 'undefined' ? words.size : null;
      } catch (e) {
        return { error: String(e) };
      }
    });
  }

  async getCurrentWordFromPage() {
    return await this.page.evaluate(() => {
      try {
        return typeof currentWord !== 'undefined' ? currentWord : null;
      } catch (e) {
        return { error: String(e) };
      }
    });
  }

  async getInputValue() {
    return await this.input.evaluate((el) => el.value);
  }
}

test.describe('Multiset App - FSM validation and behavior', () => {
  // Collect console and page errors to assert on them or inspect
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and errors
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', err => {
      // pageerror captures uncaught exceptions in page context
      pageErrors.push(String(err));
    });

    // Navigate to the page under test
    const p = new MultisetPage(page);
    await p.goto();
  });

  test.afterEach(async ({ }, testInfo) => {
    // After each test, include a note about any console logs or errors for debugging
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      // Attach details to test report - not modifying runtime behavior, just informative
      testInfo.attachments = testInfo.attachments || [];
      testInfo.attachments.push({ name: 'consoleErrors', body: JSON.stringify(consoleErrors, null, 2) });
      testInfo.attachments.push({ name: 'pageErrors', body: JSON.stringify(pageErrors, null, 2) });
    }
  });

  // Sanity check: page loads and all expected components exist
  test('Page should load and render expected components (Idle state S0_Idle)', async ({ page }) => {
    const app = new MultisetPage(page);

    // Verify presence of input and buttons
    await expect(app.input).toBeVisible();
    await expect(app.addBtn).toBeVisible();
    await expect(app.removeBtn).toBeVisible();
    await expect(app.clearBtn).toBeVisible();
    await expect(app.wordsEl).toBeVisible();

    // The input should have the placeholder as described in FSM
    await expect(app.input).toHaveAttribute('placeholder', 'Enter a word');

    // No runtime page errors should have occurred during initial load
    expect(pageErrors.length, 'No uncaught page errors on load').toBe(0);
    expect(consoleErrors.length, 'No console.error messages on load').toBe(0);
  });

  test.describe('Add Word (Transition S0_Idle -> S1_WordAdded)', () => {
    test('Adding a non-empty word appends a <p> element and clears the input', async ({ page }) => {
      const app = new MultisetPage(page);

      // Add a word and validate DOM update and internal state
      await app.addWord('apple');

      // After add, the code clears the input
      expect(await app.getInputValue()).toBe('');

      // The page's words Set should reflect the added word (size = 1)
      const size = await app.getWordsSizeFromPage();
      expect(size).toBe(1);

      // The visible container should include the added word text
      const innerHTML = await app.getWordsInnerHTML();
      expect(innerHTML).toContain('<p>apple</p>');
      const textContent = await app.getWordsTextContent();
      expect(textContent.trim()).toContain('apple');

      // Ensure no console errors or uncaught exceptions occurred during interaction
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Adding duplicate words: Set prevents duplicates but DOM appends every time (edge case)', async ({ page }) => {
      const app = new MultisetPage(page);

      // Add the same word twice
      await app.addWord('banana');
      await app.addWord('banana');

      // The Set on the page should only have one unique entry
      const size = await app.getWordsSizeFromPage();
      expect(size).toBe(1, 'words Set should contain only unique entries');

      // The DOM, however, is appended to each time; expect two occurrences of the word in innerHTML
      const innerHTML = await app.getWordsInnerHTML();
      const occurrences = (innerHTML.match(/<p>banana<\/p>/g) || []).length;
      expect(occurrences).toBe(2, 'innerHTML should contain two appended paragraphs even if Set is unique');

      // No errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Adding an empty word should not modify the multiset (edge case)', async ({ page }) => {
      const app = new MultisetPage(page);

      // Get initial state
      const initialHTML = await app.getWordsInnerHTML();
      const initialSize = await app.getWordsSizeFromPage();

      // Attempt to add empty string
      await app.addWord('');

      // State should be unchanged
      expect(await app.getWordsInnerHTML()).toBe(initialHTML);
      expect(await app.getWordsSizeFromPage()).toBe(initialSize);

      // No errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Remove Word (Transition S0_Idle -> S2_WordRemoved)', () => {
    test('Removing an existing word updates the Set and replaces multiset-words innerHTML with words.size', async ({ page }) => {
      const app = new MultisetPage(page);

      // Prepare by adding a word
      await app.addWord('cherry');

      // Now type the word into input (add cleared the input)
      await app.removeWord('cherry');

      // After removal, the code sets multiset-words.innerHTML = words.size (which should be 0)
      const innerHTML = await app.getWordsInnerHTML();
      expect(innerHTML).toBe('0');

      const size = await app.getWordsSizeFromPage();
      expect(size).toBe(0);

      // No errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Removing a non-existent word sets multiset-words to words.size and does not throw', async ({ page }) => {
      const app = new MultisetPage(page);

      // Ensure multiset is cleared first
      await app.clearMultiset();

      // Try to remove a word that doesn't exist
      await app.removeWord('dragonfruit');

      // Should display size (0) and not throw
      const innerHTML = await app.getWordsInnerHTML();
      expect(innerHTML).toBe('0');

      const size = await app.getWordsSizeFromPage();
      expect(size).toBe(0);

      // No page errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Remove operation uses current input value - removing without input should be no-op', async ({ page }) => {
      const app = new MultisetPage(page);

      // Add a word to ensure set isn't empty
      await app.addWord('elderberry');

      // Clear input explicitly
      await app.input.fill('');

      // Click remove without typing - nothing should change because empty string is falsy
      await app.removeBtn.click();

      // The code checks if (word) so no deletion should happen and innerHTML should remain as it was (contains a <p>)
      const innerHTML = await app.getWordsInnerHTML();
      // Because earlier add appended <p>elderberry</p>, expect that to remain (not replaced by numeric size)
      expect(innerHTML).toContain('elderberry');

      // The Set should still have size 1
      const size = await app.getWordsSizeFromPage();
      expect(size).toBe(1);

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Clear Multiset (Transition S0_Idle -> S3_MultisetCleared)', () => {
    test('Clearing the multiset empties internal Set and clears displayed words', async ({ page }) => {
      const app = new MultisetPage(page);

      // Add multiple words
      await app.addWord('fig');
      await app.addWord('grape');

      // Clear the multiset
      await app.clearMultiset();

      // After clear, words.size should be 0 and innerHTML should be empty string
      const size = await app.getWordsSizeFromPage();
      expect(size).toBe(0);

      const innerHTML = await app.getWordsInnerHTML();
      expect(innerHTML).toBe('');

      // No errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Clear on an already empty multiset remains stable and does not throw', async ({ page }) => {
      const app = new MultisetPage(page);

      // Ensure empty state
      await app.clearMultiset();

      // Clear again - should be idempotent
      await app.clearMultiset();

      // Still empty
      expect(await app.getWordsSizeFromPage()).toBe(0);
      expect(await app.getWordsInnerHTML()).toBe('');

      // No errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Input change event (InputChange event)', () => {
    test('Typing into the input updates the global currentWord variable via input event handler', async ({ page }) => {
      const app = new MultisetPage(page);

      // Type a value - input event listener updates currentWord
      await app.typeIntoInput('honeydew');

      // Evaluate the currentWord variable from the page
      const currentWord = await app.getCurrentWordFromPage();
      expect(currentWord).toBe('honeydew');

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Robustness and error observation', () => {
    test('There should be no uncaught runtime errors or console.error emitted during normal operation', async ({ page }) => {
      const app = new MultisetPage(page);

      // Perform a sequence of typical interactions
      await app.addWord('kiwi');
      await app.addWord('lime');
      await app.removeWord('kiwi');
      await app.clearMultiset();

      // Inspect recorded console errors and page errors
      // We expect zero errors in normal functioning of this page implementation.
      expect(consoleErrors.length, `console.error messages captured: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `uncaught page errors captured: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('Capture and report any runtime errors if they occur (test will fail if any are present)', async ({ page }) => {
      // This test intentionally asserts that no runtime errors occurred.
      // If a ReferenceError, SyntaxError, or TypeError occurs naturally, it will be captured by pageErrors / consoleErrors and this test will fail, per requirements.
      const app = new MultisetPage(page);

      // Quick interaction to potentially trigger runtime problems
      await app.addWord('mango');

      // Assert none recorded
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});