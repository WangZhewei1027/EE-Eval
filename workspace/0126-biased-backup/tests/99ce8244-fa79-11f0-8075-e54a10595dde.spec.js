import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce8244-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Suffix Tree demo page
class SuffixPage {
  constructor(page) {
    this.page = page;
    this.insertInput = page.locator('#insertInput');
    this.searchInput = page.locator('#searchInput');
    this.insertButton = page.locator("button[onclick='insertText()']");
    this.searchButton = page.locator("button[onclick='searchPattern()']");
    this.suffixListItems = page.locator('#suffixes li');
    this.suffixList = page.locator('#suffixes');
    this.heading = page.locator('h1');
  }

  // Insert text via the UI and click Insert
  async insertText(text) {
    await this.insertInput.fill(text);
    await this.insertButton.click();
  }

  // Trigger search and return the dialog that appears
  // Caller must handle the dialog (accept/dismiss) as needed
  async triggerSearchAndGetDialog(pattern) {
    await this.searchInput.fill(pattern);
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.searchButton.click()
    ]);
    return dialog;
  }

  async getInsertInputValue() {
    return this.insertInput.inputValue();
  }

  async getSearchInputValue() {
    return this.searchInput.inputValue();
  }

  async getSuffixes() {
    return this.suffixListItems.allTextContents();
  }

  async getSuffixCount() {
    return this.suffixListItems.count();
  }

  async reload() {
    await this.page.reload();
  }
}

test.describe('Suffix Tree Interactive Demo - Application ID: 99ce8244-fa79-11f0-8075-e54a10595dde', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Attach global listeners for console and page errors before each test.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Collect all console messages for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions on the page
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  // Test initial idle state (S0_Idle): page renders, heading present, inputs exist and suffix list empty
  test('S0_Idle: initial render shows heading and empty suffix list', async ({ page }) => {
    const suffixPage = new SuffixPage(page);

    // Validate the main heading is present
    await expect(suffixPage.heading).toHaveText('Suffix Tree Interactive Demo');

    // Inputs should exist and be empty initially
    await expect(suffixPage.insertInput).toHaveValue('');
    await expect(suffixPage.searchInput).toHaveValue('');

    // Suffix list should be empty at initial state
    const count = await suffixPage.getSuffixCount();
    expect(count).toBe(0);

    // No page errors were thrown during initial load
    expect(pageErrors.length).toBe(0);
  });

  // Test inserting text transitions to S1_TextInserted and updates suffixes
  test('S1_TextInserted: inserting "abc" updates suffix list and clears insert input', async ({ page }) => {
    const suffixPage = new SuffixPage(page);

    // Insert the text 'abc'
    await suffixPage.insertText('abc');

    // After insertion, the insert input should be cleared (evidence for exit action)
    const insertValue = await suffixPage.getInsertInputValue();
    expect(insertValue).toBe('', 'insertInput should be cleared after insertText()');

    // The suffix list should now include all suffixes of 'abc': 'abc', 'bc', 'c'
    const suffixes = await suffixPage.getSuffixes();

    // Validate expected suffixes exist and in expected order (insertion order of root children: a, b, c)
    expect(suffixes.length).toBeGreaterThanOrEqual(3);
    // Look for specific expected suffixes
    expect(suffixes).toEqual(expect.arrayContaining(['abc', 'bc', 'c']));

    // No runtime exceptions should have been thrown during insert
    expect(pageErrors.length).toBe(0);
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });

  // Test inserting an empty string does not alter suffixes (transition back to Idle with no-op)
  test('Insert with empty input is a no-op and preserves current suffixes', async ({ page }) => {
    const suffixPage = new SuffixPage(page);

    // Ensure we have known suffixes by inserting 'ab' first
    await suffixPage.insertText('ab');
    const before = await suffixPage.getSuffixes();

    // Click insert with empty input (should be a no-op)
    await suffixPage.insertText(''); // fill then click; empty fill

    // Suffixes should remain unchanged
    const after = await suffixPage.getSuffixes();
    expect(after).toEqual(before);

    // insertInput should remain empty
    const insertValue = await suffixPage.getInsertInputValue();
    expect(insertValue).toBe('');

    // No runtime exceptions produced
    expect(pageErrors.length).toBe(0);
  });

  // Test searching for a pattern that exists (S2_PatternSearched): expect 'Pattern found!' alert and cleared input
  test('S2_PatternSearched: search for existing pattern shows "Pattern found!" alert and clears search input', async ({ page }) => {
    const suffixPage = new SuffixPage(page);

    // Prepare data: insert 'abc' to create suffixes 'abc', 'bc', 'c'
    await suffixPage.insertText('abc');

    // Search for 'bc' which is a suffix and should be found
    const dialog = await suffixPage.triggerSearchAndGetDialog('bc');
    try {
      expect(dialog.message()).toBe('Pattern found!');
    } finally {
      await dialog.accept();
    }

    // After handling dialog, search input should be cleared
    const searchValue = await suffixPage.getSearchInputValue();
    expect(searchValue).toBe('', 'searchInput should be cleared after searchPattern()');

    // Ensure no page-level errors occurred
    expect(pageErrors.length).toBe(0);
  });

  // Test searching for a pattern that does not exist: expect 'Pattern not found!' alert and cleared input
  test('S2_PatternSearched: search for non-existing pattern shows "Pattern not found!" alert and clears search input', async ({ page }) => {
    const suffixPage = new SuffixPage(page);

    // Ensure tree has some content but not the searched pattern
    await suffixPage.insertText('xyz');

    const dialog = await suffixPage.triggerSearchAndGetDialog('not-present');
    try {
      expect(dialog.message()).toBe('Pattern not found!');
    } finally {
      await dialog.accept();
    }

    const searchValue = await suffixPage.getSearchInputValue();
    expect(searchValue).toBe('', 'searchInput should be cleared after searchPattern()');

    // Assert no runtime exceptions
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: search for a prefix that exists as path but not marked as endOfString -> should be "not found"
  test('Edge case: searching a path that is not an end-of-string should return "Pattern not found!"', async ({ page }) => {
    const suffixPage = new SuffixPage(page);

    // Insert 'abc' again to ensure state
    await suffixPage.insertText('abc');

    // 'a' is a prefix of suffix 'abc' but only full suffixes are marked as endOfString
    const dialog = await suffixPage.triggerSearchAndGetDialog('a');
    try {
      expect(dialog.message()).toBe('Pattern not found!');
    } finally {
      await dialog.accept();
    }

    // No page errors expected
    expect(pageErrors.length).toBe(0);
  });

  // Test multiple inserts and confirm suffix list grows / contains combined suffixes
  test('Multiple inserts combine suffixes from all inserted strings', async ({ page }) => {
    const suffixPage = new SuffixPage(page);

    // Insert two different strings
    await suffixPage.insertText('ab');
    await suffixPage.insertText('cd');

    // The suffix list should contain suffixes from both 'ab' and 'cd'
    const suffixes = await suffixPage.getSuffixes();
    expect(suffixes).toEqual(expect.arrayContaining(['ab', 'b', 'cd', 'd']));

    // No runtime exceptions during multiple inserts
    expect(pageErrors.length).toBe(0);
  });

  // Monitor console and page error state: this test asserts that there were no uncaught runtime errors
  test('Console and page error monitoring: there should be no page errors or console errors', async ({ page }) => {
    // We rely on the listeners attached in beforeEach; assert collected arrays

    // Assert that no uncaught exceptions were emitted on the page
    expect(pageErrors.length).toBe(0);

    // Assert there are no console messages of type 'error'
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);

    // Optionally log collected console messages for debugging if assertions fail (kept passive here)
    // But we assert that console messages, if any, are not errors
  });

  // Teardown is handled by Playwright test runner; include an afterEach to optionally reload
  test.afterEach(async ({ page }) => {
    // reload the page to ensure isolation for next test (defensive cleanup)
    await page.reload();
  });
});