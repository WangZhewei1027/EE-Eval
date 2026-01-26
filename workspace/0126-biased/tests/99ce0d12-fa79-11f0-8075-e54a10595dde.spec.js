import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce0d12-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Hash Table app
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Controls
    this.keyInput = page.locator('#keyInput');
    this.valueInput = page.locator('#valueInput');
    this.addBtn = page.locator('#addBtn');
    this.removeBtn = page.locator('#removeBtn');
    // Search area
    this.searchKeyInput = page.locator('#searchKey');
    this.searchKeyBtn = page.locator('#searchKeyBtn');
    this.searchResult = page.locator('#searchResult');
    // Hash table display
    this.hashTableContent = page.locator('#hashTableContent');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Add a key/value and wait a tick for UI updates
  async addItem(key, value) {
    await this.keyInput.fill(key);
    await this.valueInput.fill(value);
    await this.addBtn.click();
    // allow UI update
    await this.page.waitForTimeout(50);
  }

  async removeItem(key) {
    await this.keyInput.fill(key);
    await this.removeBtn.click();
    await this.page.waitForTimeout(50);
  }

  async searchKey(key) {
    await this.searchKeyInput.fill(key);
    await this.searchKeyBtn.click();
    await this.page.waitForTimeout(20);
  }

  async getHashContentText() {
    return (await this.hashTableContent.innerText()).trim();
  }

  async getSearchResultText() {
    return (await this.searchResult.innerText()).trim();
  }

  async getInputValues() {
    return {
      key: await this.keyInput.inputValue(),
      value: await this.valueInput.inputValue(),
      searchKey: await this.searchKeyInput.inputValue(),
    };
  }
}

// Helper to collect console.error messages and page errors
async function attachErrorCollectors(page) {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    // push the error stack/message
    pageErrors.push(String(err));
  });

  return { consoleErrors, pageErrors };
}

test.describe('Interactive Hash Table - FSM states and transitions', () => {
  // Basic smoke test for initial Idle state and presence of components
  test('S0_Idle: initial render shows inputs, buttons and hash table container', async ({ page }) => {
    // Comment: Validate Idle state (S0_Idle) - inputs and controls present.
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
    const app = new HashTablePage(page);
    await app.goto();

    // Verify presence of main controls (evidence for Idle)
    await expect(app.keyInput).toBeVisible();
    await expect(app.valueInput).toBeVisible();
    await expect(app.addBtn).toBeVisible();
    await expect(app.removeBtn).toBeVisible();
    await expect(app.searchKeyInput).toBeVisible();
    await expect(app.searchKeyBtn).toBeVisible();
    await expect(app.hashTableContent).toBeVisible();

    // The HTML does not guarantee updateHashTableContent on load, so we only assert the element exists.
    const content = await app.getHashContentText();
    // content may be empty string or JSON; assert it is a string (no runtime error occurred retrieving it)
    expect(typeof content).toBe('string');

    // Assert no console/page runtime errors occurred during load
    expect(consoleErrors.length, 'No console.error messages on load').toBe(0);
    expect(pageErrors.length, 'No page errors on load').toBe(0);
  });

  test.describe('Transitions from Idle (S0_Idle)', () => {
    test('AddItem -> S1_ItemAdded: adding an item updates hash table and clears inputs (onExit)', async ({ page }) => {
      // Comment: Validate transition AddItem and onEnter (updateHashTableContent) and onExit (clearInputs)
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
      const app = new HashTablePage(page);
      await app.goto();

      // Add an item
      await app.addItem('foo', 'bar');

      // Hash table content should include the stored key and value
      const content = await app.getHashContentText();
      expect(content.length).toBeGreaterThan(0);
      // The stringified entry should include "key":"foo" and "value":"bar"
      expect(content.includes('"key":"foo"') || content.includes('"key": "foo"')).toBeTruthy();
      expect(content.includes('"value":"bar"') || content.includes('"value": "bar"')).toBeTruthy();

      // Verify clearInputs was called as exit action: inputs should be empty
      const inputs = await app.getInputValues();
      expect(inputs.key).toBe('', 'keyInput should be cleared after add (clearInputs)');
      expect(inputs.value).toBe('', 'valueInput should be cleared after add (clearInputs)');
      // search key should also be cleared by clearInputs implementation
      expect(inputs.searchKey).toBe('', 'searchKey should be cleared after add');

      // Ensure no runtime errors occurred during add
      expect(consoleErrors.length, 'No console.error messages during add').toBe(0);
      expect(pageErrors.length, 'No page errors during add').toBe(0);
    });

    test('RemoveItem -> S2_ItemRemoved: removing an existing item updates hash table and clears inputs', async ({ page }) => {
      // Comment: Validate RemoveItem transition: item removed from data structure and inputs cleared.
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
      const app = new HashTablePage(page);
      await app.goto();

      // Add an item first to then remove it
      await app.addItem('remKey', 'remVal');

      // Sanity: ensure it exists
      let content = await app.getHashContentText();
      expect(content.includes('"key":"remKey"') || content.includes('"key": "remKey"')).toBeTruthy();

      // Now remove it
      await app.removeItem('remKey');

      // After removal, the JSON content should no longer contain "remKey"
      content = await app.getHashContentText();
      const containsRemKey = content.includes('"key":"remKey"') || content.includes('"key": "remKey"');
      expect(containsRemKey).toBeFalsy();

      // Verify clearInputs was called on exit
      const inputs = await app.getInputValues();
      expect(inputs.key).toBe('', 'keyInput should be cleared after remove (clearInputs)');
      expect(inputs.value).toBe('', 'valueInput should be cleared after remove (clearInputs)');
      expect(inputs.searchKey).toBe('', 'searchKey should be cleared after remove');

      // Ensure no runtime errors occurred during remove
      expect(consoleErrors.length, 'No console.error messages during remove').toBe(0);
      expect(pageErrors.length, 'No page errors during remove').toBe(0);
    });

    test('SearchItem -> S3_ItemSearched: searching existing and non-existing keys shows expected results', async ({ page }) => {
      // Comment: Validate SearchItem transition: correct value for existing key and "Key not found" for missing keys.
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
      const app = new HashTablePage(page);
      await app.goto();

      // Add a known key
      await app.addItem('alpha', 'one');

      // Search for existing key
      await app.searchKey('alpha');
      let result = await app.getSearchResultText();
      expect(result).toBe('one', 'Searching existing key should return stored value');

      // Search for a non-existing key
      await app.searchKey('doesNotExist');
      result = await app.getSearchResultText();
      expect(result).toBe('Key not found', 'Searching a missing key should show "Key not found"');

      // Ensure no runtime errors occurred during searches
      expect(consoleErrors.length, 'No console.error messages during search').toBe(0);
      expect(pageErrors.length, 'No page errors during search').toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Adding empty key stores at hash index 0 and clears inputs (edge case)', async ({ page }) => {
      // Comment: The implementation hashes empty key to index 0; ensure it stores and clears inputs.
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
      const app = new HashTablePage(page);
      await app.goto();

      // Add an empty key with a value
      await app.addItem('', 'emptyValue');

      // Hash table should contain an entry where key is empty string and value is 'emptyValue'
      const content = await app.getHashContentText();
      // Look for '"key":""' and the value
      expect(content.includes('"key":""') || content.includes('"key": ""')).toBeTruthy();
      expect(content.includes('"value":"emptyValue"') || content.includes('"value": "emptyValue"')).toBeTruthy();

      // Inputs should be cleared after add
      const inputs = await app.getInputValues();
      expect(inputs.key).toBe('', 'keyInput should be cleared after adding empty key');
      expect(inputs.value).toBe('', 'valueInput should be cleared after adding empty key');

      // Ensure no runtime errors occurred during this edge-case add
      expect(consoleErrors.length, 'No console.error messages when adding empty key').toBe(0);
      expect(pageErrors.length, 'No page errors when adding empty key').toBe(0);
    });

    test('Removing a non-existent key does not crash and results in no matching entry', async ({ page }) => {
      // Comment: Attempt to remove a key that does not exist; ensure app remains stable and inputs cleared.
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
      const app = new HashTablePage(page);
      await app.goto();

      // Ensure the key is not present initially
      let contentBefore = await app.getHashContentText();
      const mayContain = contentBefore.includes('"key":"ghost"') || contentBefore.includes('"key": "ghost"');
      // If it exists (very unlikely), remove it first; otherwise proceed
      if (mayContain) {
        await app.removeItem('ghost');
      }

      // Now attempt to remove a definitely non-existing key
      await app.removeItem('ghost');

      // The UI should remain responsive; the hash table should not contain "ghost"
      const contentAfter = await app.getHashContentText();
      const containsGhost = contentAfter.includes('"key":"ghost"') || contentAfter.includes('"key": "ghost"');
      expect(containsGhost).toBeFalsy();

      // Inputs cleared
      const inputs = await app.getInputValues();
      expect(inputs.key).toBe('', 'keyInput should be cleared after attempting to remove non-existent key');
      expect(inputs.value).toBe('', 'valueInput should be cleared after attempting to remove non-existent key');

      // There should be no console/page runtime errors (function returns "Key not found" internally but does not throw)
      expect(consoleErrors.length, 'No console.error messages when removing non-existent key').toBe(0);
      expect(pageErrors.length, 'No page errors when removing non-existent key').toBe(0);
    });

    test('Observe console and page errors for any ReferenceError/SyntaxError/TypeError during interactions', async ({ page }) => {
      // Comment: Explicitly collect console.error and page errors and assert none mention JS engine errors.
      const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
      const app = new HashTablePage(page);
      await app.goto();

      // Perform a sequence of interactions to try to surface runtime errors
      await app.addItem('x', '1');
      await app.searchKey('x');
      await app.removeItem('x');
      await app.searchKey('x');

      // Give a moment for any async errors to surface
      await page.waitForTimeout(100);

      // Assert that no console error messages were emitted
      expect(consoleErrors.length, `Expected 0 console.error messages but found: ${consoleErrors.join(' | ')}`).toBe(0);

      // Assert that no page errors were thrown
      expect(pageErrors.length, `Expected 0 page errors but found: ${pageErrors.join(' | ')}`).toBe(0);

      // Additionally, make sure none of the captured messages (if any) mention common JS error types
      const joinedConsole = consoleErrors.join(' ');
      const joinedPage = pageErrors.join(' ');
      const errorTypes = ['ReferenceError', 'SyntaxError', 'TypeError'];
      for (const t of errorTypes) {
        expect(joinedConsole.includes(t)).toBeFalsy();
        expect(joinedPage.includes(t)).toBeFalsy();
      }
    });
  });
});