import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17627be1-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object encapsulating interactions with the Hash Map Demo page
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('#key');
    this.valueInput = page.locator('#value');
    this.addButton = page.locator('button', { hasText: 'Add Key-Value Pair' });
    this.removeButton = page.locator('button', { hasText: 'Remove Key' });
    this.displayButton = page.locator('button', { hasText: 'Display Hash Map' });
    this.displayDiv = page.locator('#hashMapDisplay');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setKey(key) {
    await this.keyInput.fill(key);
  }

  async setValue(value) {
    await this.valueInput.fill(value);
  }

  // Clicks the add button and waits for the dialog to appear; returns the dialog message text
  async clickAddAndGetDialog() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.addButton.click()
    ]);
    const msg = dialog.message();
    await dialog.accept();
    return msg;
  }

  // Clicks the remove button and waits for the dialog to appear; returns the dialog message text
  async clickRemoveAndGetDialog() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.removeButton.click()
    ]);
    const msg = dialog.message();
    await dialog.accept();
    return msg;
  }

  async clickDisplay() {
    await this.displayButton.click();
  }

  async getDisplayHTML() {
    return this.displayDiv.innerHTML();
  }

  async getDisplayText() {
    return this.displayDiv.innerText();
  }

  async clearInputs() {
    await this.keyInput.fill('');
    await this.valueInput.fill('');
  }

  async keyValueInputsAreEmpty() {
    const k = await this.keyInput.inputValue();
    const v = await this.valueInput.inputValue();
    return k === '' && v === '';
  }
}

// Grouping all tests related to the Hash Map Demo and its FSM states/transitions
test.describe('Hash Map Demo - FSM states and transitions', () => {
  // Arrays to capture console messages and page errors for observation and assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions / troubleshooting
    page.on('console', (msg) => {
      // Store text for assertions, keep type and text for more detail if needed
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions) — tests will assert none occurred unless expected
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Extra safety: collect any late errors
    // Ensure no unexpected page errors occurred during the test
    // If there are page errors, include their messages to aid debugging
    if (pageErrors.length > 0) {
      // fail with details (Playwright will show thrown error)
      const messages = pageErrors.map((e) => e.message).join('\n---\n');
      throw new Error(`Unexpected page errors were emitted during the test:\n${messages}`);
    }

    // Optionally assert there are no console errors of type 'error'
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error');
    if (consoleErrors.length > 0) {
      const msgs = consoleErrors.map((c) => c.text).join('\n---\n');
      throw new Error(`Console error messages observed during the test:\n${msgs}`);
    }

    // Clear listeners by navigating away (ensures a clean slate for next test)
    await page.goto('about:blank');
  });

  // Test: Adding a valid key-value pair transitions to S1_KeyValueAdded and shows alert
  test('S1_KeyValueAdded - adding valid key/value shows alert, clears inputs, and updates display', async ({ page }) => {
    // This test validates:
    // - The AddKeyValue event triggers an alert with the added pair (FSM evidence)
    // - Inputs are cleared after adding
    // - Display shows the new pair after calling displayHashMap (S3 transition)
    const app = new HashMapPage(page);

    await app.goto();

    // Arrange: set key and value
    await app.setKey('fruit');
    await app.setValue('apple');

    // Act: click add and capture the alert message
    const dialogMsg = await app.clickAddAndGetDialog();

    // Assert: dialog message matches expected evidence
    expect(dialogMsg).toBe('Added: fruit -> apple');

    // Assert: inputs were cleared by the function
    const inputsEmpty = await app.keyValueInputsAreEmpty();
    expect(inputsEmpty).toBe(true);

    // Act: display the hash map
    await app.clickDisplay();

    // Assert: display contains the heading and the added key-value
    const displayHTML = await app.getDisplayHTML();
    expect(displayHTML).toContain('<h3>Current Hash Map:</h3>');
    expect(displayHTML).toContain('<li>fruit : apple</li>');
  });

  // Test: Adding with missing inputs triggers validation alert (edge case)
  test('Add with empty inputs shows validation alert (edge case)', async ({ page }) => {
    // This test validates input validation path when user attempts to add without providing both key and value
    const app = new HashMapPage(page);

    await app.goto();

    // Ensure inputs are empty
    await app.clearInputs();

    // Click add, expect validation alert
    const dialogMsg = await app.clickAddAndGetDialog();

    // Assert expected validation message (not part of FSM states but important edge case)
    expect(dialogMsg).toBe('Please enter both key and value.');

    // Inputs should remain empty after the attempt
    const inputsEmpty = await app.keyValueInputsAreEmpty();
    expect(inputsEmpty).toBe(true);
  });

  // Test: Remove existing key transitions to S2_KeyValueRemoved and removes the key from the map
  test('S2_KeyValueRemoved - removing existing key shows removed alert and removes entry', async ({ page }) => {
    // This test validates:
    // - Successful removal shows alert with removed key
    // - The removed key no longer appears when the map is displayed
    const app = new HashMapPage(page);

    await app.goto();

    // Setup: add a key to be removed
    await app.setKey('color');
    await app.setValue('blue');
    const addDialog = await app.clickAddAndGetDialog();
    expect(addDialog).toBe('Added: color -> blue');

    // Display to assert presence
    await app.clickDisplay();
    let displayText = await app.getDisplayText();
    expect(displayText).toContain('color : blue');

    // Now attempt to remove the existing key
    await app.setKey('color'); // removal reads key input only
    const removeDialog = await app.clickRemoveAndGetDialog();
    expect(removeDialog).toBe('Removed: color');

    // After removal, display again and assert entry is gone
    await app.clickDisplay();
    displayText = await app.getDisplayText();
    // If map became empty, the UI includes 'The hash map is empty.'
    expect(displayText).not.toContain('color : blue');
  });

  // Test: Attempting to remove a non-existent key shows appropriate alert (error scenario)
  test('Remove non-existent key shows "not found" alert (edge case)', async ({ page }) => {
    // This test validates the application's behavior when asked to remove a key that doesn't exist
    const app = new HashMapPage(page);

    await app.goto();

    // Ensure map is empty and provide a key that was never added
    await app.clearInputs();
    await app.setKey('nonexistent');

    const removeDialog = await app.clickRemoveAndGetDialog();

    // The implementation alerts with: `Key "${key}" not found.`
    expect(removeDialog).toBe('Key "nonexistent" not found.');

    // Key input should be cleared after the remove operation
    const keyVal = await page.locator('#key').inputValue();
    expect(keyVal).toBe('');
  });

  // Test: Displaying an empty hash map transitions to S3_HashMapDisplayed and shows empty message
  test('S3_HashMapDisplayed - display shows empty state when no entries exist', async ({ page }) => {
    // This test validates that the DisplayHashMap event renders the expected HTML when the map is empty
    const app = new HashMapPage(page);

    await app.goto();

    // Ensure fresh state (no entries)
    await app.clearInputs();

    // Act: Click display
    await app.clickDisplay();

    // Assert: the display contains the heading and the 'empty' list item
    const displayHTML = await app.getDisplayHTML();
    expect(displayHTML).toContain('<h3>Current Hash Map:</h3>');
    expect(displayHTML).toContain('<li>The hash map is empty.</li>');
  });

  // Test: Adding duplicate keys overwrites previous value (edge case) and display shows latest value
  test('Adding duplicate key overwrites value; display shows the latest value', async ({ page }) => {
    // This test validates that adding a second value for the same key overwrites it in the underlying map
    const app = new HashMapPage(page);

    await app.goto();

    // Add the key first time
    await app.setKey('planet');
    await app.setValue('earth');
    const dialog1 = await app.clickAddAndGetDialog();
    expect(dialog1).toBe('Added: planet -> earth');

    // Add the same key with a different value
    await app.setKey('planet');
    await app.setValue('mars');
    const dialog2 = await app.clickAddAndGetDialog();
    expect(dialog2).toBe('Added: planet -> mars');

    // Display and assert that only the latest value is shown
    await app.clickDisplay();
    const displayText = await app.getDisplayText();

    // Should show 'planet : mars' and not 'planet : earth'
    expect(displayText).toContain('planet : mars');
    expect(displayText).not.toContain('planet : earth');
  });

  // Additional test: Ensure that invoking display after multiple operations yields consistent DOM changes
  test('Combined operations produce consistent display and no runtime errors', async ({ page }) => {
    // This test sequences multiple operations (add, add, remove, display) verifying the final DOM and that no runtime errors occurred
    const app = new HashMapPage(page);

    await app.goto();

    // Add several entries
    await app.setKey('a');
    await app.setValue('1');
    expect(await app.clickAddAndGetDialog()).toBe('Added: a -> 1');

    await app.setKey('b');
    await app.setValue('2');
    expect(await app.clickAddAndGetDialog()).toBe('Added: b -> 2');

    // Remove one
    await app.setKey('a');
    expect(await app.clickRemoveAndGetDialog()).toBe('Removed: a');

    // Display final state
    await app.clickDisplay();
    const displayText = await app.getDisplayText();

    // Expect b:2 present, a removed
    expect(displayText).toContain('b : 2');
    expect(displayText).not.toContain('a : 1');

    // Finally, assert no page errors were captured during the whole sequence
    // (This check is redundant with afterEach but kept explicit for clarity)
    if (pageErrors.length > 0) {
      const messages = pageErrors.map((e) => e.message).join('\n---\n');
      throw new Error(`Unexpected page errors during combined operations:\n${messages}`);
    }
  });
});