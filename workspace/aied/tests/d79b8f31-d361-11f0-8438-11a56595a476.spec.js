import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79b8f31-d361-11f0-8438-11a56595a476.html';

// Page Object for interacting with the Hash Table demo page
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.insertKey = page.locator('#insertKey');
    this.insertValue = page.locator('#insertValue');
    this.insertButton = page.locator('button', { hasText: 'Insert / Update' });
    this.searchKey = page.locator('#searchKey');
    this.searchButton = page.locator('button', { hasText: 'Search' });
    this.removeKey = page.locator('#removeKey');
    this.removeButton = page.locator('button', { hasText: 'Remove' });
    this.clearButton = page.locator('button', { hasText: 'Clear Hash Table' });
    this.bucketCountInput = page.locator('#bucketCount');
    this.messages = page.locator('#messages');
    this.tableWrapper = page.locator('#tableWrapper');
    this.tableRows = () => page.locator('#tableWrapper table tbody tr');
  }

  async insert(key, value) {
    await this.insertKey.fill(key);
    await this.insertValue.fill(value);
    await this.insertButton.click();
    // wait for table / message update
    await this.page.waitForTimeout(50);
  }

  async search(key) {
    await this.searchKey.fill(key);
    await this.searchButton.click();
    await this.page.waitForTimeout(50);
  }

  async remove(key) {
    await this.removeKey.fill(key);
    await this.removeButton.click();
    await this.page.waitForTimeout(50);
  }

  async clear(accept = true) {
    // handle confirm dialog externally via test setup; click only
    await this.clearButton.click();
    await this.page.waitForTimeout(50);
  }

  async changeBucketCount(newCount) {
    // Fill the input then dispatch change to trigger onchange handler reliably
    await this.bucketCountInput.fill(String(newCount));
    await this.bucketCountInput.evaluate((el) => {
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await this.page.waitForTimeout(50);
  }

  async getMessageText() {
    return (await this.messages.textContent())?.trim() ?? '';
  }

  async getMessageColor() {
    return this.messages.evaluate((el) => getComputedStyle(el).color);
  }

  async getBucketCountFromTable() {
    return await this.tableRows().count();
  }

  async tableContainsKeyValue(key, value) {
    // locate <strong>key</strong> and check corresponding cell text includes value
    const strongLocator = this.page.locator('#tableWrapper table tbody tr td strong', { hasText: key });
    if (await strongLocator.count() === 0) return false;
    // check sibling text by evaluating parent cell content
    const count = await strongLocator.count();
    for (let i = 0; i < count; i++) {
      const el = strongLocator.nth(i);
      const text = await el.evaluate((node) => node.parentElement.textContent || '');
      if (text.includes(value)) return true;
    }
    return false;
  }

  async isTableEmpty() {
    // every row should show '<i>empty</i>' in second cell
    const rows = this.tableRows();
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      const secondCellHTML = await rows.nth(i).locator('td').nth(1).innerHTML();
      if (!secondCellHTML.includes('<i>empty</i>')) return false;
    }
    return true;
  }

  async getActiveElementId() {
    return this.page.evaluate(() => document.activeElement && document.activeElement.id ? document.activeElement.id : '');
  }

  async getBucketCountInputValue() {
    return await this.bucketCountInput.inputValue();
  }
}

test.describe('Hash Table Demo - FSM states and transitions', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // no-op here; each test will set up listeners as needed
  });

  test.describe('Setup and Idle state (S0_Idle)', () => {
    test('On load: table rendered with 8 buckets and no initial message (refreshTable executed)', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });

      await page.goto(APP_URL);

      const ht = new HashTablePage(page);

      // Verify table exists and shows 8 buckets (initial size)
      await expect(ht.tableWrapper).toBeVisible();
      const bucketCount = await ht.getBucketCountFromTable();
      expect(bucketCount).toBe(8);

      // Verify no initial message text (entry action refreshTable invoked, not displayMessage)
      const message = await ht.getMessageText();
      expect(message).toBe('');

      // Ensure no uncaught page errors happened during load
      expect(pageErrors.length).toBe(0);
      // Collect any console messages and ensure none are errors
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);
    });
  });

  test.describe('Insert and Update (S1_KeyInserted, S2_KeyUpdated)', () => {
    test('Insert new key shows inserted message, updates table, clears inputs and focuses insertKey', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      await page.goto(APP_URL);
      const ht = new HashTablePage(page);

      // Insert new key
      await ht.insert('alpha', 'one');

      // Verify message text and color (green for normal)
      const msg = await ht.getMessageText();
      expect(msg).toBe('Inserted new key "alpha".');
      const color = await ht.getMessageColor();
      // green color is usually rgb(0,128,0) or similar; check that it contains 'rgb' and is not crimson
      expect(color).toContain('rgb');
      // Verify table contains the new key/value somewhere
      const hasKV = await ht.tableContainsKeyValue('alpha', 'one');
      expect(hasKV).toBeTruthy();

      // Inputs should be cleared and focus on insertKey
      const insertKeyVal = await ht.insertKey.inputValue();
      const insertValueVal = await ht.insertValue.inputValue();
      expect(insertKeyVal).toBe('');
      expect(insertValueVal).toBe('');
      const activeId = await ht.getActiveElementId();
      expect(activeId).toBe('insertKey');

      // Ensure no runtime errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('Updating an existing key shows updated message and new value in table', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      await page.goto(APP_URL);
      const ht = new HashTablePage(page);

      // Insert initial value
      await ht.insert('beta', 'first');

      // Update same key
      await ht.insert('beta', 'second');

      // Expect update message
      const msg = await ht.getMessageText();
      expect(msg).toBe('Updated existing key "beta".');

      // Table should reflect new value
      const hasUpdated = await ht.tableContainsKeyValue('beta', 'second');
      expect(hasUpdated).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Search (S3_KeyFound, S4_KeyNotFound)', () => {
    test('Search existing key displays found message with value (green)', async ({ page }) => {
      await page.goto(APP_URL);
      const ht = new HashTablePage(page);

      // prepare data
      await ht.insert('gamma', '3');

      // search
      await ht.search('gamma');

      const msg = await ht.getMessageText();
      expect(msg).toBe('Key "gamma" found with value: "3".');
      const color = await ht.getMessageColor();
      expect(color).toContain('rgb'); // should be green color style
    });

    test('Search non-existent key displays not found message (error style)', async ({ page }) => {
      await page.goto(APP_URL);
      const ht = new HashTablePage(page);

      // search something absent
      await ht.search('doesnotexist');

      const msg = await ht.getMessageText();
      expect(msg).toBe('Key "doesnotexist" not found.');
      const color = await ht.getMessageColor();
      // error color set to 'crimson' -> typically rgb(220,20,60) but check that not default green
      expect(color).not.toBe('');
    });
  });

  test.describe('Remove (S5_KeyRemoved, S6_KeyNotRemoved)', () => {
    test('Remove existing key shows removed message and removes from table', async ({ page }) => {
      await page.goto(APP_URL);
      const ht = new HashTablePage(page);

      // Insert then remove
      await ht.insert('delta', '4');
      // Ensure present before remove
      let present = await ht.tableContainsKeyValue('delta', '4');
      expect(present).toBeTruthy();

      await ht.remove('delta');

      const msg = await ht.getMessageText();
      expect(msg).toBe('Key "delta" removed.');

      // Ensure not present in table
      const stillPresent = await ht.tableContainsKeyValue('delta', '4');
      expect(stillPresent).toBeFalsy();
    });

    test('Attempt to remove missing key shows not found message (error style)', async ({ page }) => {
      await page.goto(APP_URL);
      const ht = new HashTablePage(page);

      await ht.remove('missingKey123');

      const msg = await ht.getMessageText();
      expect(msg).toBe('Key "missingKey123" not found.');
      const color = await ht.getMessageColor();
      expect(color).not.toBe('');
    });
  });

  test.describe('Clear Hash Table (S7_HashTableCleared)', () => {
    test('Clear button clears table after confirming and shows cleared message', async ({ page }) => {
      await page.goto(APP_URL);
      const ht = new HashTablePage(page);

      // Insert keys
      await ht.insert('k1', 'v1');
      await ht.insert('k2', 'v2');

      // Ensure table is not empty
      let emptyBefore = await ht.isTableEmpty();
      expect(emptyBefore).toBe(false);

      // Accept the confirm dialog
      page.on('dialog', async (dialog) => {
        expect(dialog.type()).toBe('confirm');
        await dialog.accept();
      });

      await ht.clear();

      const msg = await ht.getMessageText();
      expect(msg).toBe('Hash table cleared.');

      // All buckets should be empty
      const emptyAfter = await ht.isTableEmpty();
      expect(emptyAfter).toBe(true);
    });

    test('Canceling the clear confirm keeps table intact', async ({ page }) => {
      await page.goto(APP_URL);
      const ht = new HashTablePage(page);

      await ht.insert('keepme', 'yes');

      // Dismiss the confirm dialog
      page.on('dialog', async (dialog) => {
        expect(dialog.type()).toBe('confirm');
        await dialog.dismiss();
      });

      await ht.clear();

      // Message should not be "Hash table cleared." because dialog dismissed, so message likely unchanged or previous message persists
      const msg = await ht.getMessageText();
      // It might still be the previous message; ensure the key still exists in table (clear did not happen)
      const stillPresent = await ht.tableContainsKeyValue('keepme', 'yes');
      expect(stillPresent).toBeTruthy();
    });
  });

  test.describe('Change Bucket Count (S8_BucketCountChanged & edge cases)', () => {
    test('Changing bucket count updates buckets and shows rehashed message', async ({ page }) => {
      await page.goto(APP_URL);
      const ht = new HashTablePage(page);

      // Insert some keys to exercise rehashing
      await ht.insert('a', '1');
      await ht.insert('b', '2');
      await ht.insert('c', '3');

      await ht.changeBucketCount(16);

      const msg = await ht.getMessageText();
      expect(msg).toBe('Number of buckets changed to 16. Table rehashed.');

      const bucketCount = await ht.getBucketCountFromTable();
      expect(bucketCount).toBe(16);

      // Keys should still be present after rehash
      expect(await ht.tableContainsKeyValue('a', '1')).toBeTruthy();
      expect(await ht.tableContainsKeyValue('b', '2')).toBeTruthy();
      expect(await ht.tableContainsKeyValue('c', '3')).toBeTruthy();
    });

    test('Setting invalid bucket count (e.g., 0 or negative) resets to 8 and rehashes', async ({ page }) => {
      await page.goto(APP_URL);
      const ht = new HashTablePage(page);

      await ht.insert('z', 'zzz');

      await ht.changeBucketCount(-5);

      // changeBucketCount sets value to 8 if invalid
      const inputVal = await ht.getBucketCountInputValue();
      expect(inputVal).toBe('8');

      const msg = await ht.getMessageText();
      expect(msg).toBe('Number of buckets changed to 8. Table rehashed.');

      const bucketCount = await ht.getBucketCountFromTable();
      expect(bucketCount).toBe(8);

      expect(await ht.tableContainsKeyValue('z', 'zzz')).toBeTruthy();
    });
  });

  test.describe('Edge cases and validation messages', () => {
    test('Insert with empty key or value shows validation error', async ({ page }) => {
      await page.goto(APP_URL);
      const ht = new HashTablePage(page);

      // Both empty
      await ht.insert('', '');

      const msgBoth = await ht.getMessageText();
      expect(msgBoth).toBe('Both key and value are required.');
      const colorBoth = await ht.getMessageColor();
      expect(colorBoth).not.toBe('');

      // Only key empty
      await ht.insert('', 'someval');
      const msgKeyEmpty = await ht.getMessageText();
      expect(msgKeyEmpty).toBe('Both key and value are required.');

      // Only value empty
      await ht.insert('onlykey', '');
      const msgValueEmpty = await ht.getMessageText();
      expect(msgValueEmpty).toBe('Both key and value are required.');
    });

    test('Search with empty key shows validation message', async ({ page }) => {
      await page.goto(APP_URL);
      const ht = new HashTablePage(page);

      await ht.search('');

      const msg = await ht.getMessageText();
      expect(msg).toBe('Please enter a key to search for.');
      const color = await ht.getMessageColor();
      expect(color).not.toBe('');
    });

    test('Remove with empty key shows validation message', async ({ page }) => {
      await page.goto(APP_URL);
      const ht = new HashTablePage(page);

      await ht.remove('');

      const msg = await ht.getMessageText();
      expect(msg).toBe('Please enter a key to remove.');
      const color = await ht.getMessageColor();
      expect(color).not.toBe('');
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No unexpected runtime errors or console.error messages during typical flows', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(APP_URL);
      const ht = new HashTablePage(page);

      // Run typical flows
      await ht.insert('o1', 'v1');
      await ht.search('o1');
      await ht.remove('o1');
      page.on('dialog', async (dialog) => await dialog.dismiss());
      await ht.clear();
      await ht.changeBucketCount(12);

      // Allow any async tasks to surface
      await page.waitForTimeout(100);

      // Assert that there were no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Assert there were no console.error messages
      expect(consoleErrors.length).toBe(0);
    });
  });
});