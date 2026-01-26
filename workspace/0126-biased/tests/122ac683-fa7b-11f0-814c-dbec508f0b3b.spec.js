import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122ac683-fa7b-11f0-814c-dbec508f0b3b.html';

// Lightweight page object for interacting with the Hash Table demo
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      h1: page.locator('h1'),
      input1: page.locator('#input1'),
      input2: page.locator('#input2'),
      input3: page.locator('#input3'),
      input4: page.locator('#input4'),
      input5: page.locator('#input5'),
      input6: page.locator('#input6'),
      addBtn: page.locator('#add-btn'),
      removeBtn: page.locator('#remove-btn'),
      searchBtn: page.locator('#search-btn'),
      updateBtn: page.locator('#update-btn'),
      clearBtn: page.locator('#clear-btn'),
      toggleBtn: page.locator('#toggle-btn'),
      transitionBtn: page.locator('#transition-btn'),
      exploreBtn: page.locator('#explore-btn'),
      pathBtn: page.locator('#path-btn'),
      resultDivs: page.locator('.result'),
      errorDivs: page.locator('.error'),
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Helpers to perform actions
  async addElement(key, value) {
    await this.locators.input1.fill(key ?? '');
    // input2 is number, convert to string
    await this.locators.input2.fill(value !== undefined ? String(value) : '');
    // return a promise that resolves when a pageerror is emitted OR after click completes
    return this.page.click('#add-btn');
  }

  async removeElement(key) {
    await this.locators.input3.fill(key ?? '');
    return this.page.click('#remove-btn');
  }

  async searchElement(key) {
    await this.locators.input4.fill(key ?? '');
    return this.page.click('#search-btn');
  }

  async updateElement(key, newValue) {
    await this.locators.input5.fill(key ?? '');
    await this.locators.input6.fill(newValue !== undefined ? String(newValue) : '');
    return this.page.click('#update-btn');
  }

  async clearHashTable() {
    return this.page.click('#clear-btn');
  }

  async clickToggle() {
    return this.page.click('#toggle-btn');
  }

  async clickTransition() {
    return this.page.click('#transition-btn');
  }

  async clickExplore() {
    return this.page.click('#explore-btn');
  }

  async clickPath() {
    return this.page.click('#path-btn');
  }

  async getToggleText() {
    return this.locators.toggleBtn.textContent();
  }

  async getButtonComputedBgColor(selector) {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).backgroundColor;
    }, selector);
  }
}

test.describe('Hash Table FSM - interactive application (122ac683-fa7b-11f0-814c-dbec508f0b3b)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // reset collectors
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught page errors (ReferenceError/TypeError/SyntaxError etc.)
    page.on('pageerror', (err) => {
      // store the raw message for assertions
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Collect console messages (including error-level console events)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test('Initial render: page shows heading and expected sets of result/error containers', async ({ page }) => {
    // Validate the page rendered (onEnter renderPage() evidence in FSM suggests initial render)
    const ht = new HashTablePage(page);

    // The main heading should be present
    await expect(ht.locators.h1).toHaveText('Hash Table');

    // Verify there are multiple result containers (HTML contains several .result divs)
    const resultCount = await ht.locators.resultDivs.count();
    // The page includes one .result for each interactive section (expected at least 7+)
    expect(resultCount).toBeGreaterThanOrEqual(7);

    // Verify there are two .error containers as per HTML
    const errorCount = await ht.locators.errorDivs.count();
    expect(errorCount).toBeGreaterThanOrEqual(2);

    // No runtime errors should have occurred during initial load
    expect(pageErrors.length).toBe(0);
    // Console might have no errors on load
    const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(errorConsoleCount).toBe(0);
  });

  test('Add Element (non-empty key): event handler will attempt to write to missing #result -> runtime error', async ({ page }) => {
    // This test validates the "Add Element" transition. The implementation uses document.getElementById('result')
    // even though the HTML uses class="result" (no id), so this should throw a runtime TypeError when the handler runs.
    const ht = new HashTablePage(page);

    // Prepare to wait for the pageerror that is expected when the handler executes.
    const waitForError = page.waitForEvent('pageerror');

    // Trigger the Add action with a non-empty key/value
    await ht.locators.input1.fill('myKey');
    await ht.locators.input2.fill('123');
    await ht.locators.addBtn.click();

    // Await the pageerror event and assert it includes evidence of innerHTML access / null dereference
    const err = await waitForError;
    expect(err).toBeTruthy();
    // Message from the runtime should indicate trying to set 'innerHTML' or setting property on null
    expect(String(err.message || err)).toMatch(/innerHTML|Cannot set properties of null|Cannot read properties of null/i);

    // Console should also record an error-level message
    const errorConsole = consoleMessages.find(m => m.type === 'error' && /innerHTML|Cannot set|null/i.test(m.text));
    expect(errorConsole).toBeTruthy();
  });

  test('Add Element (empty key): Branch that attempts to write to missing #error -> runtime error', async ({ page }) => {
    // Validate error scenario when user clicks Add without entering a key.
    // Implementation tries to set document.getElementById('error').innerHTML but there is no #error element -> runtime error.
    const ht = new HashTablePage(page);

    const waitForError = page.waitForEvent('pageerror');
    // Click Add with empty inputs
    await ht.locators.input1.fill('');
    await ht.locators.input2.fill('');
    await ht.locators.addBtn.click();

    const err = await waitForError;
    expect(err).toBeTruthy();
    expect(String(err.message || err)).toMatch(/error|innerHTML|Cannot set properties of null|Cannot read properties of null/i);

    // Confirm console received an error message consistent with the page error
    const errorConsole = consoleMessages.find(m => m.type === 'error' && /Please enter a key|error|innerHTML/i.test(m.text));
    // This might or might not include 'Please enter a key' (because JS error may prevent setting it),
    // so just assert we have an error-level console message
    expect(errorConsole).toBeTruthy();
  });

  test('Remove Element (non-empty key): triggers runtime error due to missing #result', async ({ page }) => {
    // Remove handler writes to document.getElementById('result') which does not exist -> TypeError expected.
    const ht = new HashTablePage(page);

    const waitForError = page.waitForEvent('pageerror');
    await ht.locators.input3.fill('someKey');
    await ht.locators.removeBtn.click();

    const err = await waitForError;
    expect(err).toBeTruthy();
    expect(String(err.message || err)).toMatch(/innerHTML|Cannot set properties of null|Cannot read properties of null/i);
  });

  test('Search Element (non-empty key): implementation loops over empty hash and produces no result and no runtime error', async ({ page }) => {
    // The search handler creates an empty hashTable and loops over its entries.
    // For a non-empty key this yields no iterations and should not throw. The FSM expects Found/Not Found,
    // but the current implementation simply produces no DOM updates in this path.
    const ht = new HashTablePage(page);

    // record current pageErrors length
    const beforeErrors = pageErrors.length;

    await ht.locators.input4.fill('someKey');
    await ht.locators.searchBtn.click();

    // wait briefly to allow any synchronous errors to surface
    await page.waitForTimeout(150);

    // There should be no new pageerror for the non-empty search path
    expect(pageErrors.length).toBe(beforeErrors);

    // Also confirm that there is no result text injected into any .result container for this search
    // (the implementation would have attempted to set #result, which is missing; but in this path no attempt occurs)
    const resultTexts = await ht.locators.resultDivs.allTextContents();
    // Ensure none of the result containers contain 'Found' or the key
    expect(resultTexts.join(' ')).not.toMatch(/Found\s+someKey|someKey/);
  });

  test('Search Element (empty key): triggers runtime error for missing #error element', async ({ page }) => {
    // Empty key path will attempt to write to document.getElementById('error') which doesn't exist -> runtime error.
    const ht = new HashTablePage(page);

    const waitForError = page.waitForEvent('pageerror');

    await ht.locators.input4.fill('');
    await ht.locators.searchBtn.click();

    const err = await waitForError;
    expect(err).toBeTruthy();
    expect(String(err.message || err)).toMatch(/error|innerHTML|Cannot set properties of null|Cannot read properties of null/i);
  });

  test('Update Element (non-empty key): implementation loops over empty hash and produces no runtime error', async ({ page }) => {
    // Update with a non-empty key will iterate over an empty hashTable and do nothing -> no error expected.
    const ht = new HashTablePage(page);

    const beforeErrors = pageErrors.length;
    await ht.locators.input5.fill('k1');
    await ht.locators.input6.fill('999');
    await ht.locators.updateBtn.click();

    // wait a short while to allow synchronous handler to run
    await page.waitForTimeout(150);

    // No new page errors expected
    expect(pageErrors.length).toBe(beforeErrors);

    // Because no update happened (empty internal hash), there should be no "Updated" text in any result div
    const resultTexts = await ht.locators.resultDivs.allTextContents();
    expect(resultTexts.join(' ')).not.toMatch(/Updated\s+k1|Updated/);
  });

  test('Update Element (empty key): triggers runtime error for missing #error element', async ({ page }) => {
    // Update with empty key triggers code path that tries to set document.getElementById('error').innerHTML (missing)
    const ht = new HashTablePage(page);

    const waitForError = page.waitForEvent('pageerror');

    await ht.locators.input5.fill('');
    await ht.locators.input6.fill('');
    await ht.locators.updateBtn.click();

    const err = await waitForError;
    expect(err).toBeTruthy();
    expect(String(err.message || err)).toMatch(/error|innerHTML|Cannot set properties of null|Cannot read properties of null/i);
  });

  test('Clear Hash Table: handler writes to missing #result -> runtime error', async ({ page }) => {
    // The clearHashTable function tries to use document.getElementById('result') (nonexistent) -> TypeError
    const ht = new HashTablePage(page);

    // Some implementations have duplicate clearHashTable functions; still should error the same way
    const waitForError = page.waitForEvent('pageerror');

    await ht.locators.clearBtn.click();

    const err = await waitForError;
    expect(err).toBeTruthy();
    expect(String(err.message || err)).toMatch(/innerHTML|Cannot set properties of null|Cannot read properties of null/i);
  });

  test('Toggle button: toggles label and updates style (no runtime error)', async ({ page }) => {
    // Validate Toggle state change in the application's implementation
    const ht = new HashTablePage(page);

    // Ensure no errors before toggling
    expect(pageErrors.length).toBe(0);

    // Clicking toggle sets textContent to 'On' in the current implementation (because button.value !== 'on' by default)
    await ht.locators.toggleBtn.click();
    const textAfterFirst = await ht.getToggleText();
    expect(textAfterFirst.trim()).toBe('On');

    // The implementation sets style.backgroundColor to 'red' in the else-clause
    const bgColor = await ht.getButtonComputedBgColor('#toggle-btn');
    // Accept variations like 'red' or 'rgb(255, 0, 0)'
    expect(bgColor).toBeTruthy();
    expect(bgColor).toMatch(/rgb|red|rgba/i);

    // Clicking again will follow same branch (value is still not 'on') — ensure it's stable rather than throwing
    await ht.locators.toggleBtn.click();
    const textAfterSecond = await ht.getToggleText();
    expect(textAfterSecond.trim()).toBe('On');

    // Confirm no runtime errors came from toggling (toggle doesn't reference missing nodes)
    expect(pageErrors.length).toBe(0);
  });

  test('Transition, Explore, and Path buttons: behave similarly to Toggle and do not crash', async ({ page }) => {
    // Validate other state transition-like buttons that mirror toggle behavior
    const ht = new HashTablePage(page);

    // Transition button
    await ht.locators.transitionBtn.click();
    const transitionText = await ht.locators.transitionBtn.textContent();
    expect(transitionText.trim()).toBe('On');
    const transitionBg = await ht.getButtonComputedBgColor('#transition-btn');
    expect(transitionBg).toBeTruthy();

    // Explore button
    await ht.locators.exploreBtn.click();
    const exploreText = await ht.locators.exploreBtn.textContent();
    expect(exploreText.trim()).toBe('On');
    const exploreBg = await ht.getButtonComputedBgColor('#explore-btn');
    expect(exploreBg).toBeTruthy();

    // Path button
    await ht.locators.pathBtn.click();
    const pathText = await ht.locators.pathBtn.textContent();
    expect(pathText.trim()).toBe('On');
    const pathBg = await ht.getButtonComputedBgColor('#path-btn');
    expect(pathBg).toBeTruthy();

    // These buttons don't reference missing #result or #error, so they should not produce page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: multiple sequential interactions accumulate expected runtime errors where present', async ({ page }) => {
    // This test runs through a sequence of interactions to ensure runtime errors are thrown at the points
    // where the implementation attempts to access missing DOM nodes, and that other actions remain safe.
    const ht = new HashTablePage(page);

    // 1) Safe action: search with non-empty key -> no error
    await ht.locators.input4.fill('a');
    await ht.locators.searchBtn.click();
    await page.waitForTimeout(100);
    const errorsAfterSearch = pageErrors.length;
    expect(errorsAfterSearch).toBe(0);

    // 2) Dangerous action: add with non-empty key -> error expected
    const waitForAddError = page.waitForEvent('pageerror');
    await ht.locators.input1.fill('k');
    await ht.locators.input2.fill('1');
    await ht.locators.addBtn.click();
    const addErr = await waitForAddError;
    expect(addErr).toBeTruthy();
    expect(String(addErr.message || addErr)).toMatch(/innerHTML|Cannot set properties of null|Cannot read properties of null/i);

    // 3) Another dangerous action: clear -> error expected
    const waitForClearError = page.waitForEvent('pageerror');
    await ht.locators.clearBtn.click();
    const clearErr = await waitForClearError;
    expect(clearErr).toBeTruthy();
    expect(String(clearErr.message || clearErr)).toMatch(/innerHTML|Cannot set properties of null|Cannot read properties of null/i);

    // Total pageErrors should be at least 2 now
    expect(pageErrors.length).toBeGreaterThanOrEqual(2);
  });
});