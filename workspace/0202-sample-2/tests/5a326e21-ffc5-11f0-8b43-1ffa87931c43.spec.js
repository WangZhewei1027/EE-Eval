import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a326e21-ffc5-11f0-8b43-1ffa87931c43.html';

// Page Object for the Hash Map demo page
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors from the provided HTML
    this.keyInput = '#keyInput';
    this.valueInput = '#valueInput';
    this.addBtn = '#addBtn';
    this.lookupKeyInput = '#lookupKeyInput';
    this.lookupBtn = '#lookupBtn';
    this.deleteKeyInput = '#deleteKeyInput';
    this.deleteBtn = '#deleteBtn';
    this.output = '#output';
    this.tableBody = '#hashmapTable tbody';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for demo container to ensure the script has run and DOM is ready
    await this.page.waitForSelector('#hashmap-demo');
    // Wait for output region to be populated initially
    await this.page.waitForSelector(this.output);
  }

  async getOutputText() {
    return (await this.page.locator(this.output).textContent()) || '';
  }

  async getTableRows() {
    // Return array of row data: { index, key, value, highlight }
    const rows = await this.page.$$(`${this.tableBody} > tr`);
    const results = [];
    for (const row of rows) {
      const cells = await row.$$('td');
      if (cells.length === 1) {
        // possibly the "Hash map is empty." row
        const text = (await cells[0].textContent()) || '';
        results.push({ emptyMessage: text.trim(), highlight: await row.getAttribute('class') });
        continue;
      }
      const index = (await cells[0].textContent())?.trim();
      const key = (await cells[1].textContent())?.trim();
      const value = (await cells[2].textContent())?.trim();
      const classAttr = await row.getAttribute('class');
      results.push({ index, key, value, highlight: classAttr });
    }
    return results;
  }

  async findRowByKey(key) {
    const rows = await this.getTableRows();
    return rows.find(r => r.key === key);
  }

  async addKeyValue(key, value) {
    await this.page.fill(this.keyInput, key);
    await this.page.fill(this.valueInput, value);
    await this.page.click(this.addBtn);
    // updates can be synchronous, but wait a short time for DOM updates
    await this.page.waitForTimeout(50);
  }

  async lookupKey(key) {
    await this.page.fill(this.lookupKeyInput, key);
    await this.page.click(this.lookupBtn);
    await this.page.waitForTimeout(50);
  }

  async deleteKey(key) {
    await this.page.fill(this.deleteKeyInput, key);
    await this.page.click(this.deleteBtn);
    await this.page.waitForTimeout(50);
  }

  async getActiveElementId() {
    return this.page.evaluate(() => document.activeElement?.id || '');
  }
}

test.describe('Hash Map Concept Demo - FSM states and transitions', () => {
  // Collect console errors and page errors in each test to ensure we observe runtime issues
  test.beforeEach(async ({ page }) => {
    // expose empty arrays on the page object to gather logs
    page._consoleErrors = [];
    page._pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        page._consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      // pageerror emits Error objects
      page._pageErrors.push(String(err && err.message ? err.message : err));
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test, assert that no uncaught page errors or console errors occurred.
    // This validates that the provided implementation runs without throwing unexpected exceptions.
    // If there are errors, print them in the failing assertion to aid debugging.
    const consoleErrs = page._consoleErrors || [];
    const pageErrs = page._pageErrors || [];

    expect(consoleErrs, `Unexpected console errors: ${JSON.stringify(consoleErrs, null, 2)}`).toHaveLength(0);
    expect(pageErrs, `Unexpected page errors: ${JSON.stringify(pageErrs, null, 2)}`).toHaveLength(0);
  });

  test('Initial state S0_Idle - updateTable() called and initial message shown', async ({ page }) => {
    // Validate initial state: table shows empty message and output contains the welcome message
    const app = new HashMapPage(page);
    await app.goto();

    const outputText = await app.getOutputText();
    expect(outputText).toBe('Add some key-value pairs to see them appear here!');

    const rows = await app.getTableRows();
    expect(rows.length).toBe(1);
    expect(rows[0].emptyMessage).toBe('Hash map is empty.');
  });

  test('Add new key transitions to S1_KeyAdded and updates table with highlight', async ({ page }) => {
    // This validates Add/Update event for a new key and the S1_KeyAdded evidence message and table highlight
    const app = new HashMapPage(page);
    await app.goto();

    await app.addKeyValue('apple', 'red');

    const outputText = await app.getOutputText();
    expect(outputText).toBe('Added new key "apple" with value "red".');

    const row = await app.findRowByKey('apple');
    expect(row).toBeTruthy();
    expect(row.value).toBe('red');
    // highlight class should be present on the row
    expect(row.highlight).toContain('highlight');
  });

  test('Update existing key transitions to S2_KeyUpdated and table shows new value + highlight', async ({ page }) => {
    // Add a key first
    const app = new HashMapPage(page);
    await app.goto();

    await app.addKeyValue('apple', 'red');
    // Update same key
    await app.addKeyValue('apple', 'green');

    const outputText = await app.getOutputText();
    expect(outputText).toBe('Updated key "apple" to new value "green".');

    const row = await app.findRowByKey('apple');
    expect(row).toBeTruthy();
    expect(row.value).toBe('green');
    expect(row.highlight).toContain('highlight');
  });

  test('Lookup existing key transitions to S3_KeyFound and highlights row', async ({ page }) => {
    // Ensure key present then perform lookup
    const app = new HashMapPage(page);
    await app.goto();

    await app.addKeyValue('apple', 'green');
    // Perform lookup using lookup inputs
    await app.lookupKey('apple');

    const outputText = await app.getOutputText();
    expect(outputText).toBe('Lookup Result: Key "apple" has value "green".');

    const row = await app.findRowByKey('apple');
    expect(row).toBeTruthy();
    expect(row.highlight).toContain('highlight');
  });

  test('Lookup non-existing key transitions to S4_KeyNotFound and clears highlights', async ({ page }) => {
    const app = new HashMapPage(page);
    await app.goto();

    // Ensure a different key exists so table isn't empty (and to test highlight clearing)
    await app.addKeyValue('apple', 'green');

    // Lookup a key that does not exist
    await app.lookupKey('banana');

    const outputText = await app.getOutputText();
    expect(outputText).toBe('Key "banana" not found in the hash map.');

    // After not found, updateTable() is called without highlights: ensure no row has highlight class
    const rows = await app.getTableRows();
    const highlighted = rows.some(r => (r.highlight || '').includes('highlight'));
    expect(highlighted).toBe(false);
  });

  test('Delete existing key transitions to S5_KeyDeleted and removes from table', async ({ page }) => {
    const app = new HashMapPage(page);
    await app.goto();

    // Add and then delete
    await app.addKeyValue('apple', 'green');
    await app.deleteKey('apple');

    const outputText = await app.getOutputText();
    expect(outputText).toBe('Key "apple" deleted from the hash map.');

    // Table should revert to empty message
    const rows = await app.getTableRows();
    expect(rows.length).toBe(1);
    expect(rows[0].emptyMessage).toBe('Hash map is empty.');
  });

  test('Delete non-existing key transitions to S6_KeyNotDeleted and reports not found', async ({ page }) => {
    const app = new HashMapPage(page);
    await app.goto();

    // Ensure map is empty, then attempt delete on non-existent key
    const rowsBefore = await app.getTableRows();
    expect(rowsBefore.length).toBeGreaterThanOrEqual(1);

    await app.deleteKey('ghostKey');

    const outputText = await app.getOutputText();
    expect(outputText).toBe('Key "ghostKey" not found, cannot delete.');
  });

  test('Edge cases: Add with empty key and empty value produce appropriate error messages and focus behavior', async ({ page }) => {
    const app = new HashMapPage(page);
    await app.goto();

    // Attempt to add with empty key
    await app.page.fill(app.keyInput, ''); // ensure empty
    await app.page.fill(app.valueInput, 'someValue');
    await app.page.click(app.addBtn);
    await app.page.waitForTimeout(20);

    let output = await app.getOutputText();
    expect(output).toBe('Error: Key cannot be empty.');
    let active = await app.getActiveElementId();
    // focus should move to keyInput
    expect(active).toBe('keyInput');

    // Attempt to add with empty value
    await app.page.fill(app.keyInput, 'key1');
    await app.page.fill(app.valueInput, '');
    await app.page.click(app.addBtn);
    await app.page.waitForTimeout(20);

    output = await app.getOutputText();
    expect(output).toBe('Error: Value cannot be empty.');
    active = await app.getActiveElementId();
    expect(active).toBe('valueInput');
  });

  test('Edge cases: Lookup and Delete with empty key show errors and set focus', async ({ page }) => {
    const app = new HashMapPage(page);
    await app.goto();

    // Lookup empty
    await app.page.fill(app.lookupKeyInput, '');
    await app.page.click(app.lookupBtn);
    await app.page.waitForTimeout(20);

    let output = await app.getOutputText();
    expect(output).toBe('Error: Key cannot be empty for lookup.');
    let active = await app.getActiveElementId();
    expect(active).toBe('lookupKeyInput');

    // Delete empty
    await app.page.fill(app.deleteKeyInput, '');
    await app.page.click(app.deleteBtn);
    await app.page.waitForTimeout(20);

    output = await app.getOutputText();
    expect(output).toBe('Error: Key cannot be empty for deletion.');
    active = await app.getActiveElementId();
    expect(active).toBe('deleteKeyInput');
  });

  test('Full interaction scenario: add, update, lookup, delete, and confirm table integrity throughout', async ({ page }) => {
    // This test walks through a realistic scenario covering multiple transitions in sequence
    const app = new HashMapPage(page);
    await app.goto();

    // Add two different keys that may collide in hashing algorithm
    await app.addKeyValue('cat', 'meow');
    await app.addKeyValue('tac', 'mirror'); // 'cat' and 'tac' may collide; we don't rely on collision behavior, just presence

    // Confirm both are present
    const catRow = await app.findRowByKey('cat');
    const tacRow = await app.findRowByKey('tac');
    expect(catRow).toBeTruthy();
    expect(tacRow).toBeTruthy();

    // Update one
    await app.addKeyValue('cat', 'purr');
    expect(await app.getOutputText()).toBe('Updated key "cat" to new value "purr".');
    expect((await app.findRowByKey('cat')).value).toBe('purr');

    // Lookup the other
    await app.lookupKey('tac');
    expect(await app.getOutputText()).toBe('Lookup Result: Key "tac" has value "mirror".');
    expect((await app.findRowByKey('tac')).highlight).toContain('highlight');

    // Delete both
    await app.deleteKey('cat');
    expect(await app.getOutputText()).toBe('Key "cat" deleted from the hash map.');

    await app.deleteKey('tac');
    expect(await app.getOutputText()).toBe('Key "tac" deleted from the hash map.');

    // Ensure empty finally
    const rows = await app.getTableRows();
    expect(rows.length).toBe(1);
    expect(rows[0].emptyMessage).toBe('Hash map is empty.');
  });
});