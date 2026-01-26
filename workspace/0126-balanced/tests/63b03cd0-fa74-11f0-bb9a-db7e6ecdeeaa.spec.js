import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b03cd0-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object Model for the Hash Map demo page
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('#keyInput');
    this.valueInput = page.locator('#valueInput');
    this.putBtn = page.locator('#putBtn');
    this.getBtn = page.locator('#getBtn');
    this.removeBtn = page.locator('#removeBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.hashmapBody = page.locator('#hashmapBody');
    this.logArea = page.locator('#logArea');
  }

  async navigate() {
    await this.page.goto(APP_URL);
    // Wait for initial render to complete (table rows present)
    await expect(this.hashmapBody.locator('tr')).toHaveCount(10);
  }

  async fillKey(key) {
    await this.keyInput.fill(key);
  }

  async fillValue(value) {
    await this.valueInput.fill(value);
  }

  // Performs a normal put (assumes key and value are provided)
  async put(key, value) {
    await this.fillKey(key);
    await this.fillValue(value);
    await this.putBtn.click();
  }

  async get(key) {
    await this.fillKey(key);
    await this.getBtn.click();
  }

  async remove(key) {
    await this.fillKey(key);
    await this.removeBtn.click();
  }

  // Trigger clear and handle confirm externally in tests
  async triggerClear() {
    await this.clearBtn.click();
  }

  // Helper to read log text
  async getLogText() {
    return (await this.logArea.textContent()) || '';
  }

  // Returns true if any bucket cell contains the pair text "key: value"
  async hasPairText(key, value) {
    const text = `${key}: ${value}`;
    return (await this.hashmapBody.textContent())?.includes(text) ?? false;
  }

  // Returns the number of rows in the table body (should be stable 10 for this app)
  async rowCount() {
    return await this.hashmapBody.locator('tr').count();
  }
}

test.describe('Hash Map Demo (63b03cd0-fa74-11f0-bb9a-db7e6ecdeeaa)', () => {
  // Store console messages and page errors for inspection in each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture runtime/page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Nothing special to tear down here; the Playwright fixture will close pages automatically.
  });

  test('Initial render: table and logs are set up (validates onEnter renderHashMap)', async ({ page }) => {
    // This test validates the initial state rendered by the page (FSM S0_Idle entry action: renderHashMap)
    const app = new HashMapPage(page);
    await app.navigate();

    // There should be 10 bucket rows (size = 10)
    await expect(app.rowCount()).resolves.toBe(10);

    // Each row's pairs cell should say "(empty)" initially
    // Check a few representative rows
    const firstPairsCell = page.locator('#hashmapBody tr:nth-child(1) td:nth-child(2)');
    await expect(firstPairsCell).toHaveText('(empty)');

    const lastPairsCell = page.locator('#hashmapBody tr:nth-child(10) td:nth-child(2)');
    await expect(lastPairsCell).toHaveText('(empty)');

    // Logs should be empty at initial render
    const logText = await app.getLogText();
    expect(logText.trim()).toBe('');

    // Assert no runtime page errors occurred on load
    expect(pageErrors.length, `Expected no runtime errors on initial load, got: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
  });

  test('Put key-value pair: inserts and renders new entry and logs the action', async ({ page }) => {
    // Validates the PutKeyValue event and transition actions (map.put, log, renderHashMap)
    const app = new HashMapPage(page);
    await app.navigate();

    const key = 'alpha';
    const value = 'one';

    await app.put(key, value);

    // After put, log should contain an "Inserted" or "Updated" message for the key
    await expect(app.logArea).toContainText(`Inserted key "${key}"`);
    // And the table should render the pair text "alpha: one"
    await expect(app.hashmapBody).toContainText(`${key}: ${value}`);

    // No runtime errors during the operation
    expect(pageErrors.length, `Expected no runtime errors during put, got: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
  });

  test('Put same key updates value and re-renders (update path)', async ({ page }) => {
    // Validates updating an existing key: should log "Updated" and render new value
    const app = new HashMapPage(page);
    await app.navigate();

    const key = 'alpha';
    const initialValue = 'one';
    const updatedValue = 'uno';

    // Insert initial pair
    await app.put(key, initialValue);
    await expect(app.hashmapBody).toContainText(`${key}: ${initialValue}`);

    // Update the same key with a new value
    await app.put(key, updatedValue);

    // Log should reflect update
    await expect(app.logArea).toContainText(`Updated key "${key}" with new value "${updatedValue}"`);
    // Table should contain the updated value and not the old one
    const bodyText = await app.hashmapBody.textContent();
    expect(bodyText).toContain(`${key}: ${updatedValue}`);
    expect(bodyText).not.toContain(`${key}: ${initialValue}`);

    expect(pageErrors.length).toBe(0);
  });

  test('Get value by key: logs found message and does not change map rendering', async ({ page }) => {
    // Validates GetValue event and associated log action
    const app = new HashMapPage(page);
    await app.navigate();

    const key = 'beta';
    const value = 'two';

    // Insert entry to be retrieved
    await app.put(key, value);

    // Clear value input to ensure get relies only on key
    await app.fillValue('');

    // Trigger get
    await app.get(key);

    // Log should show that the value was found for the key
    await expect(app.logArea).toContainText(`Value for key "${key}" found: "${value}"`);

    // Rendering should remain consistent (pair still present)
    await expect(app.hashmapBody).toContainText(`${key}: ${value}`);

    expect(pageErrors.length).toBe(0);
  });

  test('Get non-existent key: logs not found message', async ({ page }) => {
    // Validates get when key is absent (edge case)
    const app = new HashMapPage(page);
    await app.navigate();

    const key = 'nonexistent';

    // Ensure key input has the non-existent key and trigger get
    await app.get(key);

    await expect(app.logArea).toContainText(`Key "${key}" not found`);

    expect(pageErrors.length).toBe(0);
  });

  test('Remove key-value pair: removes, re-renders and logs removal', async ({ page }) => {
    // Validates RemoveKeyValue transition, renderHashMap and logging
    const app = new HashMapPage(page);
    await app.navigate();

    const key = 'gamma';
    const value = 'three';

    // Insert then remove
    await app.put(key, value);
    await expect(app.hashmapBody).toContainText(`${key}: ${value}`);

    await app.remove(key);

    // Log should indicate removal
    await expect(app.logArea).toContainText(`Key "${key}" removed`);

    // Table should no longer show the pair
    await expect(app.hashmapBody).not.toContainText(`${key}: ${value}`);

    expect(pageErrors.length).toBe(0);
  });

  test('Remove non-existent key: logs cannot remove message (edge case)', async ({ page }) => {
    // Validates removing a key that doesn't exist
    const app = new HashMapPage(page);
    await app.navigate();

    const key = 'absent';

    await app.remove(key);

    await expect(app.logArea).toContainText(`Cannot remove: key "${key}" not found`);

    expect(pageErrors.length).toBe(0);
  });

  test('Put with empty key triggers alert and aborts insertion (error scenario)', async ({ page }) => {
    // Validates alert handling when key is missing on put
    const app = new HashMapPage(page);
    await app.navigate();

    // Ensure inputs are empty
    await app.fillKey('');
    await app.fillValue('somevalue');

    // Wait for alert dialog that the page will show and accept it
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      app.putBtn.click()
    ]);
    expect(dialog.message()).toBe('Please enter a key.');
    await dialog.accept();

    // No insertion should have occurred; table should not contain 'somevalue'
    await expect(app.hashmapBody).not.toContainText('somevalue');

    // And the log should not have an insertion message
    const logText = await app.getLogText();
    expect(logText).not.toContain('Inserted key');

    expect(pageErrors.length).toBe(0);
  });

  test('Put with empty value triggers alert and aborts insertion (error scenario)', async ({ page }) => {
    // Validates alert handling when value is missing on put
    const app = new HashMapPage(page);
    await app.navigate();

    await app.fillKey('delta');
    await app.fillValue('');

    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      app.putBtn.click()
    ]);
    expect(dialog.message()).toBe('Please enter a value.');
    await dialog.accept();

    // Ensure nothing was inserted for key 'delta'
    await expect(app.hashmapBody).not.toContainText('delta:');

    expect(pageErrors.length).toBe(0);
  });

  test('Clear map: dismiss confirm preserves entries, accept confirm clears and logs', async ({ page }) => {
    // Validates ClearHashMap transition, both cancel and accept paths
    const app = new HashMapPage(page);
    await app.navigate();

    const key = 'toClear';
    const value = 'temp';

    // Insert an entry to be affected by clear
    await app.put(key, value);
    await expect(app.hashmapBody).toContainText(`${key}: ${value}`);

    // Case 1: Dismiss the confirm -> map should remain unchanged
    const dismissPromise = page.waitForEvent('dialog');
    await app.clearBtn.click();
    const dismissDialog = await dismissPromise;
    expect(dismissDialog.type()).toBe('confirm');
    // Dismiss the confirm dialog to cancel clearing
    await dismissDialog.dismiss();

    // Map should still contain the entry
    await expect(app.hashmapBody).toContainText(`${key}: ${value}`);
    // Ensure no "Hash map cleared." log entry was added by this dismissal
    const logAfterDismiss = await app.getLogText();
    expect(logAfterDismiss).not.toContain('Hash map cleared.');

    // Case 2: Accept the confirm -> map should be cleared and log entry added
    const acceptPromise = page.waitForEvent('dialog');
    await app.clearBtn.click();
    const acceptDialog = await acceptPromise;
    expect(acceptDialog.type()).toBe('confirm');
    await acceptDialog.accept();

    // After acceptance, log should contain "Hash map cleared."
    await expect(app.logArea).toContainText('Hash map cleared.');

    // And the table should show all buckets as (empty)
    // Checking first and last row as representative
    const firstPairsCell = page.locator('#hashmapBody tr:nth-child(1) td:nth-child(2)');
    await expect(firstPairsCell).toHaveText('(empty)');
    const lastPairsCell = page.locator('#hashmapBody tr:nth-child(10) td:nth-child(2)');
    await expect(lastPairsCell).toHaveText('(empty)');

    expect(pageErrors.length).toBe(0);
  });

  test('Console and runtime monitoring: collect console messages and ensure no unexpected errors', async ({ page }) => {
    // This test demonstrates collection of console messages and page errors while performing operations.
    const app = new HashMapPage(page);
    await app.navigate();

    // Perform a couple of operations
    await app.put('monitorKey', 'monitorValue');
    await app.get('monitorKey');
    await app.remove('monitorKey');

    // Validate that console messages have been captured (the app does not intentionally console.log,
    // but we capture whatever the environment emitted)
    // We don't assert specific console entries because the app uses the DOM logArea instead of console.
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // Assert that no runtime page errors were emitted
    expect(pageErrors.length, `Expected no runtime JS errors, found: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
  });
});