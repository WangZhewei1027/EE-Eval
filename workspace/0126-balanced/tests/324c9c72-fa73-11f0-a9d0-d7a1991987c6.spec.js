import { test, expect } from '@playwright/test';

// Test file: 324c9c72-fa73-11f0-a9d0-d7a1991987c6.spec.js
// This test suite validates the Hash Map Demonstration interactive application
// served at http://127.0.0.1:5500/workspace/0126-balanced/html/324c9c72-fa73-11f0-a9d0-d7a1991987c6.html
//
// The tests cover all FSM states and transitions described in the FSM definition:
// - Idle (initial render)
// - Item Added (add a key/value pair)
// - Item Retrieved (get a value by key)
// - Item Removed (remove a key/value pair)
// Additionally, edge cases are exercised and console/page errors are observed and asserted.
//
// Important: Tests load the page exactly as-is and only observe runtime behavior (console logs and page errors).
// No modifications or patches are applied to the page environment.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324c9c72-fa73-11f0-a9d0-d7a1991987c6.html';

class HashMapPage {
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('#key');
    this.valueInput = page.locator('#value');
    this.addButton = page.locator('#addButton');
    this.getButton = page.locator('#getButton');
    this.removeButton = page.locator('#removeButton');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async addItem(key, value) {
    await this.keyInput.fill(key);
    await this.valueInput.fill(value);
    await this.addButton.click();
  }

  async getItem(key) {
    await this.keyInput.fill(key);
    await this.getButton.click();
  }

  async removeItem(key) {
    await this.keyInput.fill(key);
    await this.removeButton.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async clearInputs() {
    await this.keyInput.fill('');
    await this.valueInput.fill('');
  }

  async getInputs() {
    return {
      key: await this.keyInput.inputValue(),
      value: await this.valueInput.inputValue()
    };
  }
}

test.describe('Hash Map Demonstration - States, Transitions and Edge Cases', () => {
  // Arrays to capture console errors and page errors for each test.
  let consoleErrors;
  let pageErrors;
  let page; // available from fixture in tests

  test.beforeEach(async ({ page: p }) => {
    page = p;
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });
  });

  test.afterEach(async () => {
    // Basic assertion that no console errors or page errors occurred during the test run.
    // If there are any, the tests will fail here and the captured details will be visible in the test output.
    expect(consoleErrors, 'No console.error messages should be emitted during test').toHaveLength(0);
    expect(pageErrors, 'No uncaught page errors should occur during test').toHaveLength(0);
  });

  test.describe('Initial Idle State', () => {
    test('Idle: Page renders controls and empty output', async ({ page: p }) => {
      // Validate the initial render (Idle state)
      const hm = new HashMapPage(p);
      await hm.goto();

      // Ensure controls exist
      await expect(hm.keyInput).toBeVisible();
      await expect(hm.valueInput).toBeVisible();
      await expect(hm.addButton).toBeVisible();
      await expect(hm.getButton).toBeVisible();
      await expect(hm.removeButton).toBeVisible();
      await expect(hm.output).toBeVisible();

      // On initial load the output should be empty (no JSON rendered by updateOutput on load)
      const out = await hm.getOutputText();
      expect(out, 'Initial output should be empty string').toBe('');
    });
  });

  test.describe('Add / Get / Remove Transitions', () => {
    test('AddItem: adding a key-value pair updates output and clears inputs', async ({ page: p }) => {
      // This validates transition S0_Idle -> S1_ItemAdded
      const hm1 = new HashMapPage(p);
      await hm.goto();

      // Add a key/value pair
      await hm.addItem('alpha', '123');

      // After adding, the output should show JSON containing the new pair
      const out1 = await hm.getOutputText();
      // output is JSON string produced by hashMap.getAll()
      let parsed;
      try {
        parsed = JSON.parse(out);
      } catch (e) {
        parsed = null;
      }
      expect(parsed, 'Output after adding should be valid JSON').not.toBeNull();
      expect(parsed.alpha, 'Added key "alpha" should have value "123"').toBe('123');

      // Inputs should have been cleared by clearInputs()
      const inputs = await hm.getInputs();
      expect(inputs.key, 'Key input should be cleared after add').toBe('');
      expect(inputs.value, 'Value input should be cleared after add').toBe('');
    });

    test('GetItem: retrieving existing and non-existing keys shows correct messages', async ({ page: p }) => {
      // This validates transition S0_Idle -> S2_ItemRetrieved
      const hm2 = new HashMapPage(p);
      await hm.goto();

      // Precondition: add a known key
      await hm.addItem('beta', '456');

      // Retrieve existing key
      await hm.getItem('beta');
      let out2 = await hm.getOutputText();
      expect(out, 'Get on existing key should display a value message').toBe('Value for "beta": 456');

      // Retrieve non-existing key should show "Key not found."
      await hm.getItem('nonexistent');
      out = await hm.getOutputText();
      expect(out, 'Get on non-existing key should display "Key not found." message').toBe('Value for "nonexistent": Key not found.');
    });

    test('RemoveItem: removing a key updates the hash map output (key removed)', async ({ page: p }) => {
      // This validates transition S0_Idle -> S3_ItemRemoved
      const hm3 = new HashMapPage(p);
      await hm.goto();

      // Add two keys
      await hm.addItem('k1', 'v1');
      await hm.addItem('k2', 'v2');

      // Ensure both are present
      let out3 = await hm.getOutputText();
      let parsed = JSON.parse(out);
      expect(parsed.k1).toBe('v1');
      expect(parsed.k2).toBe('v2');

      // Remove k1
      await hm.removeItem('k1');

      // After removal, output should reflect map without k1
      out = await hm.getOutputText();
      parsed = JSON.parse(out);
      expect(parsed.k1, 'Removed key "k1" should not be present in output').toBeUndefined();
      expect(parsed.k2, 'Other key "k2" should remain after removal').toBe('v2');
    });
  });

  test.describe('Edge cases and additional behaviors', () => {
    test('Adding a duplicate key overwrites the previous value', async ({ page: p }) => {
      const hm4 = new HashMapPage(p);
      await hm.goto();

      await hm.addItem('dup', 'first');
      let out4 = await hm.getOutputText();
      let parsed1 = JSON.parse(out);
      expect(parsed.dup).toBe('first');

      // Add same key with different value
      await hm.addItem('dup', 'second');
      out = await hm.getOutputText();
      parsed = JSON.parse(out);
      expect(parsed.dup, 'Duplicate key should be overwritten with new value').toBe('second');
    });

    test('Empty key is accepted and retrievable/removable (edge case)', async ({ page: p }) => {
      const hm5 = new HashMapPage(p);
      await hm.goto();

      // Add empty key
      await hm.addItem('', 'emptyValue');

      // Output JSON should contain an empty-string key
      let out5 = await hm.getOutputText();
      let parsed2 = JSON.parse(out);
      expect(Object.prototype.hasOwnProperty.call(parsed, ''), 'Map should contain empty string key').toBeTruthy();
      expect(parsed['']).toBe('emptyValue');

      // Get empty key should return the value
      await hm.getItem('');
      out = await hm.getOutputText();
      expect(out, 'Get on empty key should return its value').toBe('Value for "": emptyValue');

      // Remove empty key and confirm it is gone
      await hm.removeItem('');
      out = await hm.getOutputText();
      parsed = JSON.parse(out);
      expect(Object.prototype.hasOwnProperty.call(parsed, ''), 'Empty key should be removed').toBeFalsy();
    });

    test('Removing a non-existent key does not alter the map', async ({ page: p }) => {
      const hm6 = new HashMapPage(p);
      await hm.goto();

      // Setup a key
      await hm.addItem('x', '1');
      let before = JSON.parse(await hm.getOutputText());

      // Remove a non-existent key
      await hm.removeItem('no-such-key');

      // Final output should still contain the original key unchanged
      const after = JSON.parse(await hm.getOutputText());
      expect(after.x).toBe(before.x);
      expect(Object.keys(after).length).toBe(Object.keys(before).length);
    });
  });
});