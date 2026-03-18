import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a326e20-ffc5-11f0-8b43-1ffa87931c43.html';

/**
 * Page Object for interacting with the Hash Table demo page.
 * Encapsulates common actions and queries to keep tests readable.
 */
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.keyInput = '#keyInput';
    this.valueInput = '#valueInput';
    this.insertBtn = '#insertBtn';
    this.searchBtn = '#searchBtn';
    this.deleteBtn = '#deleteBtn';
    this.clearBtn = '#clearBtn';
    this.output = '#output';
    this.tableBody = '#tableBody';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for main elements
    await Promise.all([
      this.page.waitForSelector(this.keyInput),
      this.page.waitForSelector(this.valueInput),
      this.page.waitForSelector(this.insertBtn),
      this.page.waitForSelector(this.tableBody),
    ]);
  }

  async fillKey(key) {
    await this.page.fill(this.keyInput, key);
  }

  async fillValue(value) {
    await this.page.fill(this.valueInput, value);
  }

  async clickInsert() {
    await this.page.click(this.insertBtn);
  }

  async clickSearch() {
    await this.page.click(this.searchBtn);
  }

  async clickDelete() {
    await this.page.click(this.deleteBtn);
  }

  async clickClear() {
    await this.page.click(this.clearBtn);
  }

  async getOutputText() {
    return (await this.page.$eval(this.output, el => el.textContent || '')).trim();
  }

  async getOutputColor() {
    // Return computed color (e.g., 'rgb(217, 83, 79)' for error)
    return await this.page.$eval(this.output, el => getComputedStyle(el).color);
  }

  async getTableRowsText() {
    return await this.page.$$eval(`${this.tableBody} tr`, rows =>
      rows.map(r => {
        const index = r.querySelector('.index-cell')?.textContent?.trim() ?? '';
        const content = Array.from(r.querySelectorAll('td'))[1]?.textContent?.trim() ?? '';
        return { index, content };
      })
    );
  }

  async tableContainsText(substring) {
    const rows = await this.getTableRowsText();
    return rows.some(r => r.content.includes(substring));
  }

  async countTableRows() {
    return await this.page.$$eval(`${this.tableBody} tr`, rows => rows.length);
  }

  async clearInputs() {
    await this.page.fill(this.keyInput, '');
    await this.page.fill(this.valueInput, '');
  }
}

test.describe('Hash Table Demo - FSM states and transitions', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown globally here
  });

  test.describe('State: Idle (initial rendering and onEnter verification)', () => {
    test('Initial load renders table and shows ready message (Idle onEnter actions)', async ({ page }) => {
      // This test validates the Idle state's entry actions:
      // - renderTable() should populate 10 rows
      // - showMessage should display the ready message
      const ht = new HashTablePage(page);
      await ht.goto();

      // Verify no runtime page errors occurred during initial load
      expect(pageErrors, 'No page errors should be thrown during initial load').toHaveLength(0);

      // Verify the welcome message (evidence of showMessage on Idle entry)
      const output = await ht.getOutputText();
      expect(output).toContain('Hash Table is ready. Insert keys and values to see how it works.');

      // Table should have 10 rows (size = 10)
      const rowCount = await ht.countTableRows();
      expect(rowCount).toBe(10);

      // Each row should show either 'empty' or a slot string; at initial load all should be empty.
      const rows = await ht.getTableRowsText();
      for (let r of rows) {
        expect(r.content.toLowerCase()).toContain('empty');
      }

      // Ensure no console errors were logged
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });

  test.describe('State: Inserting (InsertEvent)', () => {
    test('Insert new key populates table and outputs insertion message', async ({ page }) => {
      // Validate inserting a key-value results in:
      // - output message indicating insertion
      // - updated table display showing the key:value
      const ht = new HashTablePage(page);
      await ht.goto();
      await ht.clearInputs();

      await ht.fillKey('apple');
      await ht.fillValue('red');
      await ht.clickInsert();

      // Verify no runtime page errors occurred during insert
      expect(pageErrors, 'No page errors during insert').toHaveLength(0);

      const output = await ht.getOutputText();
      expect(output).toContain('Inserted key "apple" with value "red"');
      expect(output).toContain('at index'); // index part present

      // Table should now contain the inserted pair
      const contains = await ht.tableContainsText('apple: red');
      expect(contains).toBeTruthy();
    });

    test('Update existing key updates value and outputs update message', async ({ page }) => {
      // Insert a key then update it and verify the update message and table content
      const ht = new HashTablePage(page);
      await ht.goto();
      await ht.clearInputs();

      // Insert initial
      await ht.fillKey('fruit');
      await ht.fillValue('banana');
      await ht.clickInsert();
      const insertedMsg = await ht.getOutputText();
      expect(insertedMsg).toContain('Inserted key "fruit" with value "banana"');

      // Update same key
      await ht.fillKey('fruit');
      await ht.fillValue('plantain');
      await ht.clickInsert();
      const updatedMsg = await ht.getOutputText();
      expect(updatedMsg).toContain('Updated key "fruit" with new value "plantain"');

      // Table must reflect updated value
      const contains = await ht.tableContainsText('fruit: plantain');
      expect(contains).toBeTruthy();

      // Old value should not be present for that key
      expect(await ht.tableContainsText('fruit: banana')).toBeFalsy();
    });
  });

  test.describe('State: Searching (SearchEvent)', () => {
    test('Search for existing key returns Found message with value and index', async ({ page }) => {
      // Insert then search to validate SearchEvent transition and output
      const ht = new HashTablePage(page);
      await ht.goto();
      await ht.clearInputs();

      // Insert an item to search for
      await ht.fillKey('key1');
      await ht.fillValue('value1');
      await ht.clickInsert();

      // Search for it
      await ht.fillKey('key1');
      // clear value input (not used for search)
      await ht.fillValue('');
      await ht.clickSearch();

      const output = await ht.getOutputText();
      expect(output).toContain('Found key "key1" with value "value1"');
      expect(output).toContain('at index');
    });

    test('Search for non-existent key shows not found error message and error styling', async ({ page }) => {
      // Validate search for missing key triggers the not-found branch and error styling
      const ht = new HashTablePage(page);
      await ht.goto();
      await ht.clearInputs();

      await ht.fillKey('thisKeyDoesNotExist');
      await ht.fillValue('');
      await ht.clickSearch();

      const output = await ht.getOutputText();
      expect(output).toContain('Key "thisKeyDoesNotExist" not found');

      // Verify error coloring (#d9534f -> rgb(217, 83, 79))
      const color = await ht.getOutputColor();
      expect(color).toBe('rgb(217, 83, 79)');
    });

    test('Search with empty key shows validation error', async ({ page }) => {
      // Edge case: empty key input
      const ht = new HashTablePage(page);
      await ht.goto();
      await ht.clearInputs();

      await ht.fillKey(''); // empty
      await ht.clickSearch();

      const output = await ht.getOutputText();
      expect(output).toContain('Please enter a key to search.');
      const color = await ht.getOutputColor();
      expect(color).toBe('rgb(217, 83, 79)');
    });
  });

  test.describe('State: Deleting (DeleteEvent)', () => {
    test('Delete existing key removes it and shows deleted message', async ({ page }) => {
      // Insert an item then delete it and verify table update and message
      const ht = new HashTablePage(page);
      await ht.goto();
      await ht.clearInputs();

      // Insert item
      await ht.fillKey('temp');
      await ht.fillValue('123');
      await ht.clickInsert();
      expect((await ht.getOutputText()).includes('Inserted key "temp"')).toBeTruthy();

      // Delete item
      await ht.fillKey('temp');
      await ht.fillValue('');
      await ht.clickDelete();

      const output = await ht.getOutputText();
      expect(output).toContain('Deleted key "temp" from the hash table.');

      // Verify it no longer appears in the table
      const stillThere = await ht.tableContainsText('temp: 123');
      expect(stillThere).toBeFalsy();
    });

    test('Delete non-existent key shows not-found message with error styling', async ({ page }) => {
      const ht = new HashTablePage(page);
      await ht.goto();
      await ht.clearInputs();

      await ht.fillKey('no-such-key');
      await ht.clickDelete();

      const output = await ht.getOutputText();
      expect(output).toContain('Key "no-such-key" not found. Nothing deleted.');

      const color = await ht.getOutputColor();
      expect(color).toBe('rgb(217, 83, 79)');
    });

    test('Delete with empty key shows validation error', async ({ page }) => {
      const ht = new HashTablePage(page);
      await ht.goto();
      await ht.clearInputs();

      await ht.fillKey('');
      await ht.clickDelete();

      const output = await ht.getOutputText();
      expect(output).toContain('Please enter a key to delete.');
      const color = await ht.getOutputColor();
      expect(color).toBe('rgb(217, 83, 79)');
    });
  });

  test.describe('State: Clearing (ClearEvent)', () => {
    test('Clearing the table empties all slots and shows cleared message', async ({ page }) => {
      // Insert a couple items, clear, and validate table empty + message
      const ht = new HashTablePage(page);
      await ht.goto();
      await ht.clearInputs();

      // Insert two items
      await ht.fillKey('a');
      await ht.fillValue('1');
      await ht.clickInsert();
      await ht.fillKey('b');
      await ht.fillValue('2');
      await ht.clickInsert();

      // Ensure they are present
      expect(await ht.tableContainsText('a: 1')).toBeTruthy();
      expect(await ht.tableContainsText('b: 2')).toBeTruthy();

      // Clear table
      await ht.clickClear();

      const output = await ht.getOutputText();
      expect(output).toBe('Hash table cleared.');

      // All rows should be empty now
      const rows = await ht.getTableRowsText();
      for (let r of rows) {
        expect(r.content.toLowerCase()).toContain('empty');
      }
    });
  });

  test.describe('Edge cases & validation (expected error scenarios)', () => {
    test('Insert with empty key triggers validation error', async ({ page }) => {
      // Tests the input validation path of InsertEvent
      const ht = new HashTablePage(page);
      await ht.goto();
      await ht.clearInputs();

      await ht.fillKey(''); // missing key
      await ht.fillValue('someValue');
      await ht.clickInsert();

      const output = await ht.getOutputText();
      expect(output).toContain('Please enter a key to insert.');
      const color = await ht.getOutputColor();
      expect(color).toBe('rgb(217, 83, 79)');
    });

    test('Insert with empty value triggers validation error', async ({ page }) => {
      const ht = new HashTablePage(page);
      await ht.goto();
      await ht.clearInputs();

      await ht.fillKey('someKey');
      await ht.fillValue(''); // missing value
      await ht.clickInsert();

      const output = await ht.getOutputText();
      expect(output).toContain('Please enter a value to insert.');
      const color = await ht.getOutputColor();
      expect(color).toBe('rgb(217, 83, 79)');
    });

    test('No unexpected console errors or runtime exceptions occurred during interactions', async ({ page }) => {
      // Run through a small sequence of interactions and ensure no page errors were emitted.
      const ht = new HashTablePage(page);
      await ht.goto();
      await ht.clearInputs();

      // Interact: insert, search, delete, clear
      await ht.fillKey('z');
      await ht.fillValue('zzz');
      await ht.clickInsert();

      await ht.fillKey('z');
      await ht.fillValue('');
      await ht.clickSearch();

      await ht.fillKey('z');
      await ht.clickDelete();

      await ht.clickClear();

      // Assert that the page did not produce any uncaught page errors
      expect(pageErrors, 'There should be no uncaught page errors during normal operations').toHaveLength(0);

      // Also assert that no console messages of type "error" were emitted during this test
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });
});