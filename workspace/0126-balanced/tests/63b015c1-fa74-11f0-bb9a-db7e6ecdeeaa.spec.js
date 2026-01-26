import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b015c1-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Hash Table Demo
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('#keyInput');
    this.valueInput = page.locator('#valueInput');
    this.insertBtn = page.locator('#insertBtn');
    this.searchBtn = page.locator('#searchBtn');
    this.deleteBtn = page.locator('#deleteBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.outputArea = page.locator('#outputArea');
    this.tableBody = page.locator('#tableBody');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure initial rendering completed
    await expect(this.tableBody).toBeVisible();
  }

  async setKey(key) {
    await this.keyInput.fill(key);
  }

  async setValue(value) {
    await this.valueInput.fill(value);
  }

  async clickInsert() {
    await this.insertBtn.click();
  }

  async clickSearch() {
    await this.searchBtn.click();
  }

  async clickDelete() {
    await this.deleteBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async getOutputText() {
    return (await this.outputArea.textContent())?.trim() ?? '';
  }

  async getOutputColor() {
    return await this.page.evaluate(el => getComputedStyle(el).color, await this.outputArea.elementHandle());
  }

  // Returns array of rows where each row is { index, key, value }
  async getTableEntries() {
    const rows = await this.tableBody.locator('tr').elementHandles();
    const entries = [];
    for (const row of rows) {
      const cells = await row.$$('td');
      // If table empty message has single td with colspan
      if (cells.length === 1) {
        const text = (await (await cells[0].getProperty('textContent')).jsonValue()).trim();
        entries.push({ emptyMessage: text });
        continue;
      }
      const [indexEl, keyEl, valueEl] = cells;
      const index = (await (await indexEl.getProperty('textContent')).jsonValue()).trim();
      const key = (await (await keyEl.getProperty('textContent')).jsonValue()).trim();
      const value = (await (await valueEl.getProperty('textContent')).jsonValue()).trim();
      entries.push({ index, key, value });
    }
    return entries;
  }
}

// Utility helpers for color matching
function colorIsGreen(colorString) {
  if (!colorString) return false;
  return /0,\s*128,\s*0/.test(colorString) || colorString.toLowerCase().includes('green');
}
function colorIsCrimson(colorString) {
  if (!colorString) return false;
  return /220,\s*20,\s*60/.test(colorString) || colorString.toLowerCase().includes('crimson');
}

test.describe('Hash Table Demo - FSM comprehensive tests', () => {
  // capture console and page errors per test
  test.beforeEach(async ({ page }) => {
    // nothing here; listeners attached per test to allow collecting messages scoped to each test
  });

  test.describe('Console and runtime error observation', () => {
    test('no unexpected page errors or console errors emitted during normal usage', async ({ page }) => {
      // Collect console errors and page errors
      const consoleErrors = [];
      const pageErrors = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      const htPage = new HashTablePage(page);
      await htPage.goto();

      // Perform a few operations to exercise the app
      await htPage.setKey('alpha');
      await htPage.setValue('1');
      await htPage.clickInsert();

      await htPage.setKey('beta');
      await htPage.setValue('2');
      await htPage.clickInsert();

      await htPage.setKey('alpha');
      await htPage.clickSearch();

      await htPage.setKey('gamma');
      await htPage.clickDelete();

      // Allow microtasks to settle
      await page.waitForTimeout(50);

      // Assert that no unhandled runtime errors occurred
      // NOTE: The application code appears correct; this assertion verifies no ReferenceError/SyntaxError/TypeError bubbled up.
      expect(pageErrors.length, 'Expected no unhandled page errors').toBe(0);
      expect(consoleErrors.length, 'Expected no console.error messages').toBe(0);
    });
  });

  test.describe('FSM State: S0_Idle (Initial)', () => {
    test('initial page shows idle message and empty table (updateTable on enter)', async ({ page }) => {
      // Validate the Idle state's entry action updateTable() produced the empty-table message
      const htPage = new HashTablePage(page);
      await htPage.goto();

      // Output area initial content
      const output = await htPage.getOutputText();
      expect(output).toContain('Insert some key-value pairs', 'Initial output should prompt the user');

      // Table should indicate empty
      const entries = await htPage.getTableEntries();
      expect(entries.length).toBeGreaterThan(0);
      // The first row should have the empty message
      expect(entries[0].emptyMessage).toMatch(/Hash table is empty/i);
    });
  });

  test.describe('FSM Transition: InsertUpdate -> S1_Inserted', () => {
    test('inserting a new key-value pair updates the table and shows inserted message', async ({ page }) => {
      // This test validates the InsertUpdate event and S1_Inserted evidence and entry action updateTable()
      const htPage = new HashTablePage(page);
      await htPage.goto();

      await htPage.setKey('foo');
      await htPage.setValue('bar');
      await htPage.clickInsert();

      // Check output message and style (success)
      const output = await htPage.getOutputText();
      expect(output).toBe('Inserted new key: "foo" -> "bar"');

      const color = await htPage.getOutputColor();
      expect(colorIsGreen(color), `Expected success message color to look like green but got "${color}"`).toBeTruthy();

      // Table updated: should contain the inserted pair
      const entries = await htPage.getTableEntries();
      // Expect at least one row with key foo and value bar
      const found = entries.some(e => e.key === 'foo' && e.value === 'bar');
      expect(found, 'Table should contain the inserted key-value pair').toBeTruthy();
    });

    test('updating an existing key returns Updated existing key and table reflects new value', async ({ page }) => {
      // Insert then update same key
      const htPage = new HashTablePage(page);
      await htPage.goto();

      await htPage.setKey('dup');
      await htPage.setValue('one');
      await htPage.clickInsert();

      // Update value
      await htPage.setKey('dup');
      await htPage.setValue('two');
      await htPage.clickInsert();

      const output = await htPage.getOutputText();
      expect(output).toBe('Updated existing key: "dup" -> "two"');

      const color = await htPage.getOutputColor();
      expect(colorIsGreen(color)).toBeTruthy();

      const entries = await htPage.getTableEntries();
      const found = entries.some(e => e.key === 'dup' && e.value === 'two');
      expect(found).toBeTruthy();
    });

    test('insert edge cases: empty key or empty value produce error messages', async ({ page }) => {
      const htPage = new HashTablePage(page);
      await htPage.goto();

      // Empty key
      await htPage.setKey('');
      await htPage.setValue('val');
      await htPage.clickInsert();
      let output = await htPage.getOutputText();
      expect(output).toBe('Please enter a key to insert/update.');

      let color = await htPage.getOutputColor();
      expect(colorIsCrimson(color), 'Expected error message color for empty key').toBeTruthy();

      // Empty value
      await htPage.setKey('hasKey');
      await htPage.setValue('');
      await htPage.clickInsert();
      output = await htPage.getOutputText();
      expect(output).toBe('Please enter a value to insert/update.');

      color = await htPage.getOutputColor();
      expect(colorIsCrimson(color), 'Expected error message color for empty value').toBeTruthy();
    });
  });

  test.describe('FSM Transition: Search -> S2_SearchResult', () => {
    test('searching an existing key displays Found message', async ({ page }) => {
      // Insert a key then search it
      const htPage = new HashTablePage(page);
      await htPage.goto();

      await htPage.setKey('seek');
      await htPage.setValue('target');
      await htPage.clickInsert();

      await htPage.setKey('seek');
      await htPage.clickSearch();

      const output = await htPage.getOutputText();
      expect(output).toBe('Found: "seek" -> "target"');

      const color = await htPage.getOutputColor();
      expect(colorIsGreen(color)).toBeTruthy();
    });

    test('searching a non-existent key displays not-found error', async ({ page }) => {
      const htPage = new HashTablePage(page);
      await htPage.goto();

      await htPage.setKey('missing-key-xyz');
      await htPage.clickSearch();

      const output = await htPage.getOutputText();
      expect(output).toBe('Key "missing-key-xyz" not found in hash table.');

      const color = await htPage.getOutputColor();
      expect(colorIsCrimson(color)).toBeTruthy();
    });

    test('search edge case: empty key shows appropriate error', async ({ page }) => {
      const htPage = new HashTablePage(page);
      await htPage.goto();

      await htPage.setKey('');
      await htPage.clickSearch();

      const output = await htPage.getOutputText();
      expect(output).toBe('Please enter a key to search.');

      const color = await htPage.getOutputColor();
      expect(colorIsCrimson(color)).toBeTruthy();
    });
  });

  test.describe('FSM Transition: Delete -> S3_Deleted', () => {
    test('deleting an existing key removes it and updateTable is called', async ({ page }) => {
      // Insert then delete
      const htPage = new HashTablePage(page);
      await htPage.goto();

      await htPage.setKey('willDelete');
      await htPage.setValue('gone');
      await htPage.clickInsert();

      // Ensure present
      let entries = await htPage.getTableEntries();
      expect(entries.some(e => e.key === 'willDelete')).toBeTruthy();

      await htPage.setKey('willDelete');
      await htPage.clickDelete();

      const output = await htPage.getOutputText();
      expect(output).toBe('Deleted key "willDelete" from hash table.');

      const color = await htPage.getOutputColor();
      expect(colorIsGreen(color)).toBeTruthy();

      // Table should no longer contain the key
      entries = await htPage.getTableEntries();
      const stillThere = entries.some(e => e.key === 'willDelete');
      expect(stillThere).toBeFalsy();

      // If the table is empty after deletion, ensure empty message visible (updateTable effect)
      const hasOnlyEmptyMessage = entries.length === 1 && entries[0].emptyMessage;
      if (hasOnlyEmptyMessage) {
        expect(entries[0].emptyMessage).toMatch(/Hash table is empty/i);
      }
    });

    test('deleting a non-existent key shows not-found error', async ({ page }) => {
      const htPage = new HashTablePage(page);
      await htPage.goto();

      await htPage.setKey('no-such-key-123');
      await htPage.clickDelete();

      const output = await htPage.getOutputText();
      expect(output).toBe('Key "no-such-key-123" not found in hash table.');

      const color = await htPage.getOutputColor();
      expect(colorIsCrimson(color)).toBeTruthy();
    });

    test('delete edge case: empty key shows appropriate error', async ({ page }) => {
      const htPage = new HashTablePage(page);
      await htPage.goto();

      await htPage.setKey('');
      await htPage.clickDelete();

      const output = await htPage.getOutputText();
      expect(output).toBe('Please enter a key to delete.');

      const color = await htPage.getOutputColor();
      expect(colorIsCrimson(color)).toBeTruthy();
    });
  });

  test.describe('FSM Transition: Clear -> S4_Cleared', () => {
    test('clearing the hash table removes all entries and updates the view', async ({ page }) => {
      // Insert multiple keys then clear
      const htPage = new HashTablePage(page);
      await htPage.goto();

      await htPage.setKey('one');
      await htPage.setValue('1');
      await htPage.clickInsert();

      await htPage.setKey('two');
      await htPage.setValue('2');
      await htPage.clickInsert();

      // Ensure there are entries
      let entries = await htPage.getTableEntries();
      expect(entries.some(e => e.key === 'one')).toBeTruthy();
      expect(entries.some(e => e.key === 'two')).toBeTruthy();

      // Clear table
      await htPage.clickClear();

      const output = await htPage.getOutputText();
      expect(output).toBe('Cleared the entire hash table.');

      const color = await htPage.getOutputColor();
      expect(colorIsGreen(color)).toBeTruthy();

      // Table should show empty message
      entries = await htPage.getTableEntries();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].emptyMessage).toMatch(/Hash table is empty/i);
    });
  });

  test.describe('Observability and state/evidence validation', () => {
    test('UI messages contain the expected evidence strings after operations', async ({ page }) => {
      // This test ensures that the textual evidence described in the FSM appears in the UI output
      const htPage = new HashTablePage(page);
      await htPage.goto();

      // Insert evidence
      await htPage.setKey('evidenceKey');
      await htPage.setValue('evidenceVal');
      await htPage.clickInsert();
      let out = await htPage.getOutputText();
      expect(out).toContain('"evidenceKey" -> "evidenceVal"');

      // Search evidence
      await htPage.setKey('evidenceKey');
      await htPage.clickSearch();
      out = await htPage.getOutputText();
      expect(out).toContain('Found: "evidenceKey" -> "evidenceVal"');

      // Delete evidence
      await htPage.setKey('evidenceKey');
      await htPage.clickDelete();
      out = await htPage.getOutputText();
      expect(out).toContain('Deleted key "evidenceKey" from hash table.');

      // Clear evidence
      // Insert first to ensure clear has something to clear
      await htPage.setKey('toClear');
      await htPage.setValue('v');
      await htPage.clickInsert();
      await htPage.clickClear();
      out = await htPage.getOutputText();
      expect(out).toBe('Cleared the entire hash table.');
    });
  });
});