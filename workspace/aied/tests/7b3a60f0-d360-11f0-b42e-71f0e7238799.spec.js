import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3a60f0-d360-11f0-b42e-71f0e7238799.html';

// Page Object encapsulating selectors and common interactions
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('#keyInput');
    this.valueInput = page.locator('#valueInput');
    this.addButton = page.locator('#addButton');
    this.getButton = page.locator('#getButton');
    this.hashmapList = page.locator('#hashmapList');
    this.retrievedValue = page.locator('#retrievedValue');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Fill inputs and click Add
  async addKeyValue(key, value) {
    await this.keyInput.fill(key);
    await this.valueInput.fill(value);
    await this.addButton.click();
    // Wait for DOM update: ensure list content or inputs cleared
    await this.page.waitForTimeout(50);
  }

  // Set key input and click Get
  async getValueForKey(key) {
    await this.keyInput.fill(key);
    await this.getButton.click();
    // Wait for DOM update
    await this.page.waitForTimeout(50);
  }

  async getListItemsText() {
    const items = await this.hashmapList.locator('li').allTextContents();
    return items;
  }

  async getRetrievedText() {
    return (await this.retrievedValue.textContent()) ?? '';
  }

  async getKeyValueInputs() {
    return {
      key: await this.keyInput.inputValue(),
      value: await this.valueInput.inputValue(),
    };
  }
}

test.describe('Hash Map Demonstration - FSM tests', () => {
  // Arrays to collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Observe console messages and uncaught page errors
    page.on('console', msg => {
      // Capture console.error messages
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('S0_Idle: Initial render shows inputs, buttons, and empty containers', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry evidence:
    // - inputs with placeholders exist
    // - buttons exist
    // - hashmap list and retrieved value are present and empty
    const app = new HashMapPage(page);
    await app.goto();

    // Basic presence and attributes
    await expect(app.keyInput).toBeVisible();
    await expect(app.keyInput).toHaveAttribute('placeholder', 'Enter Key');

    await expect(app.valueInput).toBeVisible();
    await expect(app.valueInput).toHaveAttribute('placeholder', 'Enter Value');

    await expect(app.addButton).toBeVisible();
    await expect(app.addButton).toHaveText('Add to Hash Map');

    await expect(app.getButton).toBeVisible();
    await expect(app.getButton).toHaveText('Get Value');

    // Containers initially empty
    await expect(app.hashmapList).toBeVisible();
    const items = await app.getListItemsText();
    expect(items.length).toBe(0);

    await expect(app.retrievedValue).toBeVisible();
    const retrievedText = await app.getRetrievedText();
    expect(retrievedText).toBe('');

    // Validate that updateHashMapList function exists (evidence of implementation)
    const hasUpdateFn = await page.evaluate(() => typeof window.updateHashMapList === 'function');
    expect(hasUpdateFn).toBe(true);

    // Ensure no unexpected runtime errors occurred during initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Transitions and state behaviors', () => {
    test('AddToHashMap: Adding a key-value pair transitions to Item Added (S1_ItemAdded)', async ({ page }) => {
      // This test validates the transition from S0_Idle -> S1_ItemAdded:
      // - hashmap.set(key, value) occurs (verify via window.hashmap.map)
      // - updateHashMapList updated the DOM
      // - input fields are cleared after adding (entry_actions evidence)
      const app = new HashMapPage(page);
      await app.goto();

      // Add a key-value pair
      await app.addKeyValue('fruit', 'apple');

      // Verify inputs cleared (evidence)
      const inputs = await app.getKeyValueInputs();
      expect(inputs.key).toBe('');
      expect(inputs.value).toBe('');

      // Verify list updated with the new item
      const listItems = await app.getListItemsText();
      expect(listItems.length).toBe(1);
      expect(listItems[0]).toBe('fruit: apple');

      // Verify internal hashmap state updated via window.hashmap.map
      const mapValue = await page.evaluate(() => window.hashmap && window.hashmap.map ? window.hashmap.map['fruit'] : undefined);
      expect(mapValue).toBe('apple');

      // Ensure no uncaught runtime errors occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('GetValue: Retrieving a value transitions to Value Retrieved (S2_ValueRetrieved)', async ({ page }) => {
      // This test validates the transition S0_Idle -> S2_ValueRetrieved:
      // - retrievedValue.textContent gets updated with hashmap.get(key)
      const app = new HashMapPage(page);
      await app.goto();

      // Prepare map with one entry
      await app.addKeyValue('color', 'blue');

      // After add, inputs are cleared; to retrieve, set key again
      await app.getValueForKey('color');

      // Validate retrieved value shown in DOM
      const retrieved = await app.getRetrievedText();
      expect(retrieved).toBe('blue');

      // Validate that retrieval uses hashmap.get: check internal map still has entry
      const internal = await page.evaluate(() => window.hashmap.get('color'));
      expect(internal).toBe('blue');

      // Ensure no runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Adding empty key and empty value creates an entry and clears inputs', async ({ page }) => {
      // Validate behavior when empty strings are used for key and value
      const app = new HashMapPage(page);
      await app.goto();

      // Add empty key and value
      await app.addKeyValue('', '');

      // Inputs cleared after add
      const inputs = await app.getKeyValueInputs();
      expect(inputs.key).toBe('');
      expect(inputs.value).toBe('');

      // List should contain an entry with ': ' (empty key and value)
      const listItems = await app.getListItemsText();
      // There might be other entries from previous tests if run in same worker; ensure at least one item includes ': '
      const containsEmptyPair = listItems.some(text => text.trim() === ':');
      // Some browsers/textContent might render as ':' or ': ' so we accept both patterns
      const containsEmptyPairAlt = listItems.some(text => text.trim() === ':');
      expect(containsEmptyPair || containsEmptyPairAlt || listItems.some(t => t.startsWith(':'))).toBeTruthy();

      // Retrieving empty key should return empty string (not "Key not found")
      await app.getValueForKey('');
      const retrieved = await app.getRetrievedText();
      // retrieved could be '' (empty string)
      expect(retrieved).toBe('');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Adding duplicate key replaces value in the map and list reflects latest value', async ({ page }) => {
      // Validate that setting the same key twice updates the value (hashmap.set semantics)
      const app = new HashMapPage(page);
      await app.goto();

      // Add key 'dup' with 'first'
      await app.addKeyValue('dup', 'first');

      // Add same key 'dup' with 'second'
      await app.addKeyValue('dup', 'second');

      // The list should contain a single entry for 'dup' with latest value 'second'
      const listItems = await app.getListItemsText();
      // Find entry for 'dup'
      const dupEntries = listItems.filter(t => t.startsWith('dup:'));
      expect(dupEntries.length).toBeGreaterThanOrEqual(1);
      // The last occurrence or only occurrence should have 'second'
      expect(dupEntries.some(t => t.trim() === 'dup: second')).toBeTruthy();

      // Internal map should reflect latest value
      const internal = await page.evaluate(() => window.hashmap.get('dup'));
      expect(internal).toBe('second');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Retrieving a non-existent key yields "Key not found" message', async ({ page }) => {
      // Validate behavior when requesting a key not in the map
      const app = new HashMapPage(page);
      await app.goto();

      // Ensure key not present
      const nonExistentKey = 'no-such-key-xyz';
      // Clear key input to be safe
      await app.keyInput.fill(nonExistentKey);
      await app.getButton.click();
      await page.waitForTimeout(50);

      const retrieved = await app.getRetrievedText();
      expect(retrieved).toBe('Key not found');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test('Console and runtime error observation - ensure no uncaught exceptions on typical usage', async ({ page }) => {
    // This test explicitly observes console and page errors while exercising the app.
    const app = new HashMapPage(page);

    await app.goto();

    // Exercise several operations in sequence
    await app.addKeyValue('x', '1');
    await app.getValueForKey('x');
    await app.addKeyValue('y', '2');
    await app.getValueForKey('unknown-key-should-not-exist');

    // After interactions, assert that no uncaught page errors were recorded
    expect(pageErrors.length).toBe(0, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('; ')}`);
    expect(consoleErrors.length).toBe(0, `Unexpected console.error messages: ${consoleErrors.join('; ')}`);
  });
});