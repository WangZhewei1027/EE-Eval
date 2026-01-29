import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce3420-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Hash Map Demo page
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('#keyInput');
    this.valueInput = page.locator('#valueInput');
    this.addButton = page.locator("button[onclick='addKeyValue()']");
    this.removeKeyInput = page.locator('#removeKeyInput');
    this.removeButton = page.locator("button[onclick='removeKey()']");
    this.getKeyInput = page.locator('#getKeyInput');
    this.getValueButton = page.locator("button[onclick='getValue()']");
    this.hashMapDisplay = page.locator('#hashMapDisplay');
    this.resultDisplay = page.locator('#resultDisplay');
    this.title = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Adds a key/value pair using the UI
  async addKeyValue(key, value) {
    await this.keyInput.fill(key);
    await this.valueInput.fill(value);
    await this.addButton.click();
  }

  // Click add without filling inputs
  async clickAdd() {
    await this.addButton.click();
  }

  // Remove a key using the UI
  async removeKey(key) {
    await this.removeKeyInput.fill(key);
    await this.removeButton.click();
  }

  // Click remove without filling
  async clickRemove() {
    await this.removeButton.click();
  }

  // Get a value by key
  async getValueForKey(key) {
    await this.getKeyInput.fill(key);
    await this.getValueButton.click();
  }

  async getHashMapText() {
    return (await this.hashMapDisplay.textContent()) || '';
  }

  async getResultText() {
    return (await this.resultDisplay.textContent()) || '';
  }

  async getKeyInputValue() {
    return (await this.keyInput.inputValue()) || '';
  }

  async getValueInputValue() {
    return (await this.valueInput.inputValue()) || '';
  }

  async getRemoveKeyInputValue() {
    return (await this.removeKeyInput.inputValue()) || '';
  }

  async getGetKeyInputValue() {
    return (await this.getKeyInput.inputValue()) || '';
  }
}

test.describe('Hash Map Interactive Demo (FSM Validation)', () => {
  let page;
  let mapPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Capture console messages and page errors so tests can assert on them
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    mapPage = new HashMapPage(page);
    await mapPage.goto();
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors during the test
    // This verifies runtime stability of the provided page implementation
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Also assert no console.error messages were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.map(m => m.text).join('; ')}`).toBe(0);

    await page.close();
  });

  test('Idle state: initial render shows title and empty hash map', async () => {
    // Validate Idle state (S0_Idle) evidence: <h1>Interactive Hash Map Demo</h1>
    await expect(mapPage.title).toHaveText('Interactive Hash Map Demo');

    // Validate the hash map display initially shows an empty object representation
    const displayText = await mapPage.getHashMapText();
    // The implementation uses JSON.stringify({}, null, 2) so expect "{}" or formatted version
    expect(displayText.trim()).toBe('{}');
  });

  test('Add key-value transition to Key-Value Added and inputs cleared (onEnter/onExit)', async () => {
    // Add a key-value pair (transition S0_Idle -> S1_KeyValueAdded)
    await mapPage.addKeyValue('apple', 'red');

    // After adding, updateDisplay() should have been called resulting in the hashMapDisplay containing the new pair
    const displayText = await mapPage.getHashMapText();
    expect(displayText).toContain('"apple": "red"');

    // clearInputs() is expected to be called on exit; verify inputs are cleared
    const keyVal = await mapPage.getKeyInputValue();
    const valueVal = await mapPage.getValueInputValue();
    expect(keyVal).toBe('');
    expect(valueVal).toBe('');

    // Ensure no page errors or console.errors happened (checked again in afterEach)
  });

  test('Adding with empty key or value triggers alert and does not modify hash map (edge case)', async () => {
    // Ensure display is empty initially
    const before = await mapPage.getHashMapText();
    expect(before.trim()).toBe('{}');

    // Click add with empty inputs should show an alert
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      mapPage.clickAdd()
    ]);
    expect(dialog.message()).toBe('Both key and value must be filled in.');
    await dialog.accept();

    // Hash map should remain unchanged
    const after = await mapPage.getHashMapText();
    expect(after.trim()).toBe('{}');
  });

  test('Remove existing key transition to Key Removed and remove input cleared', async () => {
    // Prepare state: add a key to remove later
    await mapPage.addKeyValue('banana', 'yellow');
    let display = await mapPage.getHashMapText();
    expect(display).toContain('"banana": "yellow"');

    // Now remove the key (transition S0_Idle -> S2_KeyRemoved)
    await mapPage.removeKey('banana');

    // After removal, the hash map display should no longer contain the key
    display = await mapPage.getHashMapText();
    expect(display).not.toContain('"banana": "yellow"');
    // If map empty, should be "{}"
    expect(display.trim()).toBe('{}');

    // clearRemoveKeyInput() should have been called; verify remove input is cleared
    const removeInputVal = await mapPage.getRemoveKeyInputValue();
    expect(removeInputVal).toBe('');
  });

  test('Removing non-existent key shows alert and does not change state (edge case)', async () => {
    // Ensure the key does not exist
    const candidate = 'nonexistent';
    const before = await mapPage.getHashMapText();
    expect(before).not.toContain(candidate);

    // Attempt to remove a non-existent key and expect an alert
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      mapPage.removeKey('nonexistent')
    ]);
    expect(dialog.message()).toBe('Key does not exist.');
    await dialog.accept();

    // Hash map should remain unchanged
    const after = await mapPage.getHashMapText();
    expect(after).toBe(before);
  });

  test('Get value for existing key displays the value (Value Retrieved)', async () => {
    // Add a key to retrieve
    await mapPage.addKeyValue('car', 'blue');
    let display = await mapPage.getHashMapText();
    expect(display).toContain('"car": "blue"');

    // Retrieve the value (transition S0_Idle -> S3_ValueRetrieved)
    await mapPage.getValueForKey('car');

    // resultDisplay should show the value 'blue'
    const result = await mapPage.getResultText();
    expect(result).toBe('blue');
  });

  test('Get value for non-existent key shows "Key not found." (edge case)', async () => {
    // Ensure key isn't present
    const key = 'ghost';
    const display = await mapPage.getHashMapText();
    expect(display).not.toContain(`"${key}"`);

    // Request the key and verify the resultDisplay shows the expected fallback
    await mapPage.getValueForKey(key);
    const result = await mapPage.getResultText();
    expect(result).toBe('Key not found.');
  });

  test('Sequence: Add -> Add again (empty inputs) to validate S1 -> S0 behavior implicitly', async () => {
    // Add first key
    await mapPage.addKeyValue('dog', 'bark');
    let display = await mapPage.getHashMapText();
    expect(display).toContain('"dog": "bark"');

    // Inputs should be cleared after add (clearInputs acts as exit action)
    expect(await mapPage.getKeyInputValue()).toBe('');
    expect(await mapPage.getValueInputValue()).toBe('');

    // Attempt to click Add again without filling fields; this simulates invoking AddKeyValue from S1_KeyValueAdded (invalid usage)
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      mapPage.clickAdd()
    ]);
    expect(dialog.message()).toBe('Both key and value must be filled in.');
    await dialog.accept();

    // Hash map remains unchanged (still contains the previous entry)
    display = await mapPage.getHashMapText();
    expect(display).toContain('"dog": "bark"');
  });

  test('Verify UI remains responsive and no unexpected runtime errors during multiple operations', async () => {
    // Perform multiple operations in a row
    await mapPage.addKeyValue('x', '1');
    await mapPage.addKeyValue('y', '2');
    await mapPage.getValueForKey('x');
    expect(await mapPage.getResultText()).toBe('1');
    await mapPage.removeKey('x');
    // x no longer present, y remains
    const display = await mapPage.getHashMapText();
    expect(display).not.toContain('"x": "1"');
    expect(display).toContain('"y": "2"');

    // Final sanity: no page errors and no console.error messages (also enforced in afterEach)
  });
});