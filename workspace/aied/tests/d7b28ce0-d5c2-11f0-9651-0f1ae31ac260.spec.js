import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b28ce0-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object Model for the Hash Table demo page
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('#keyInput');
    this.valueInput = page.locator('#valueInput');
    this.insertBtn = page.locator('#insertBtn');
    this.getBtn = page.locator('#getBtn');
    this.removeBtn = page.locator('#removeBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.output = page.locator('#output');
    this.tableBody = page.locator('#tableBody');
    this.table = page.locator('#tableDisplay');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure table body exists before proceeding
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

  async clickGet() {
    await this.getBtn.click();
  }

  async clickRemove() {
    await this.removeBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  async getOutputInlineColor() {
    // Return the inline style color set by the page code (expects 'black' or 'darkred')
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.style.color : null;
    }, '#output');
  }

  async tableHasText(text) {
    const bodyText = (await this.tableBody.textContent()) || '';
    return bodyText.includes(text);
  }

  async countRows() {
    return this.tableBody.locator('tr').count();
  }

  async getRowTextAt(index) {
    // zero-based index
    const tr = this.tableBody.locator('tr').nth(index);
    return (await tr.textContent()) || '';
  }

  async allRowsContainEmptyMarker() {
    const rows = await this.tableBody.locator('tr').all();
    for (const row of rows) {
      const txt = (await row.textContent()) || '';
      if (!txt.includes('— (empty)')) return false;
    }
    return true;
  }
}

test.describe('Hash Table Demo - FSM states and transitions', () => {
  // capture console errors and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events to capture errors/warnings/info
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen to uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test assert that there were no runtime page errors or console.error messages
    // This validates that the page loaded and executed without unexpected exceptions.
    const errorConsoles = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
    expect(errorConsoles.length, `Unexpected console.error messages: ${JSON.stringify(errorConsoles)}`).toBe(0);
  });

  test('Initial state (S0_Idle) - table initialized and updateTableDisplay called implicitly', async ({ page }) => {
    // This test validates the Idle state:
    // - updateTableDisplay() runs on load and populates the table with buckets
    // - the output area is present and initially empty
    const app = new HashTablePage(page);
    await app.goto();

    // There should be 16 rows (size default = 16)
    const rows = await app.countRows();
    expect(rows).toBe(16);

    // Check first row shows bucket index 0 and an empty indicator
    const firstRowText = await app.getRowTextAt(0);
    expect(firstRowText).toContain('0');
    expect(firstRowText).toContain('— (empty)');

    // Verify all rows initially show empty marker
    const allEmpty = await app.allRowsContainEmptyMarker();
    expect(allEmpty).toBeTruthy();

    // Output should be empty initially
    const out = await app.getOutputText();
    expect(out.trim()).toBe('');
  });

  test.describe('Insert / Update (InsertUpdate) and Key Inserted state (S1_KeyInserted)', () => {
    test('Insert a key-value pair and verify table and output', async ({ page }) => {
      // This validates inserting a new key (transition S0 -> S1)
      const app = new HashTablePage(page);
      await app.goto();

      await app.setKey('alpha');
      await app.setValue('1');
      await app.clickInsert();

      // Output should indicate insertion with exact message
      const out = await app.getOutputText();
      expect(out.trim()).toBe('Inserted/Updated key "alpha" with value "1".');

      // Inline color is not an error for successful insertion
      const color = await app.getOutputInlineColor();
      expect(color).toBe('black');

      // Table display should reflect the inserted key somewhere
      const containsPair = await app.tableHasText('alpha → 1');
      expect(containsPair).toBeTruthy();
    });

    test('Update an existing key and verify the new value is displayed', async ({ page }) => {
      // Insert, then update the same key with a new value
      const app = new HashTablePage(page);
      await app.goto();

      await app.setKey('k1');
      await app.setValue('v1');
      await app.clickInsert();
      expect(await app.getOutputText()).toContain('Inserted/Updated key "k1" with value "v1".');

      // Update
      await app.setValue('v2');
      await app.clickInsert();
      expect(await app.getOutputText()).toContain('Inserted/Updated key "k1" with value "v2".');

      // Table must contain updated pair, and not the old one
      const tableText = (await page.locator('#tableBody').textContent()) || '';
      expect(tableText).toContain('k1 → v2');
      expect(tableText).not.toContain('k1 → v1');
    });

    test('Insert with empty key should show validation error', async ({ page }) => {
      // Edge case: empty key should cause an error and not modify the table
      const app = new HashTablePage(page);
      await app.goto();

      await app.setKey(''); // empty key
      await app.setValue('somevalue');
      await app.clickInsert();

      const out = await app.getOutputText();
      expect(out.trim()).toBe('Please enter a valid key.');

      const color = await app.getOutputInlineColor();
      expect(color).toBe('darkred');

      // Table should remain empty (no key inserted)
      const allEmpty = await app.allRowsContainEmptyMarker();
      expect(allEmpty).toBeTruthy();
    });

    test('Insert with empty value should insert empty string as value', async ({ page }) => {
      // Edge case: empty value is allowed (value becomes empty string)
      const app = new HashTablePage(page);
      await app.goto();

      await app.setKey('emptyValKey');
      await app.setValue(''); // empty value
      await app.clickInsert();

      // Expect insertion message showing empty value with quotes
      const out = await app.getOutputText();
      expect(out.trim()).toBe('Inserted/Updated key "emptyValKey" with value "".');

      // Table should contain the key with an empty value representation
      const tableText = (await page.locator('#tableBody').textContent()) || '';
      expect(tableText).toContain('emptyValKey → ');
    });
  });

  test.describe('Get Value (GetValue) and Value Retrieved state (S2_ValueRetrieved)', () => {
    test('Retrieve existing value after insertion', async ({ page }) => {
      // Insert then get -> transition S0 -> S2
      const app = new HashTablePage(page);
      await app.goto();

      await app.setKey('myKey');
      await app.setValue('myValue');
      await app.clickInsert();
      expect(await app.getOutputText()).toContain('Inserted/Updated key "myKey" with value "myValue".');

      // Clear value input to test get only uses key input
      await app.setValue('shouldNotMatter');

      await app.setKey('myKey');
      await app.clickGet();

      const out = await app.getOutputText();
      expect(out.trim()).toBe('Value for key "myKey": "myValue".');

      const color = await app.getOutputInlineColor();
      expect(color).toBe('black');
    });

    test('Get for missing key shows not found error', async ({ page }) => {
      // Try to retrieve a key that doesn't exist
      const app = new HashTablePage(page);
      await app.goto();

      await app.setKey('noSuchKey');
      await app.clickGet();

      const out = await app.getOutputText();
      expect(out.trim()).toBe('Key "noSuchKey" not found.');

      const color = await app.getOutputInlineColor();
      expect(color).toBe('darkred');
    });

    test('Get with empty key triggers validation error', async ({ page }) => {
      const app = new HashTablePage(page);
      await app.goto();

      await app.setKey('');
      await app.clickGet();

      const out = await app.getOutputText();
      expect(out.trim()).toBe('Please enter a valid key.');
      expect(await app.getOutputInlineColor()).toBe('darkred');
    });
  });

  test.describe('Remove Key (RemoveKey) and Key Removed state (S3_KeyRemoved)', () => {
    test('Remove an existing key and verify table update', async ({ page }) => {
      // Insert key then remove -> transition S0 -> S3
      const app = new HashTablePage(page);
      await app.goto();

      await app.setKey('toRemove');
      await app.setValue('val');
      await app.clickInsert();
      expect(await app.getOutputText()).toContain('Inserted/Updated key "toRemove" with value "val".');

      // Remove it
      await app.setKey('toRemove');
      await app.clickRemove();

      const out = await app.getOutputText();
      expect(out.trim()).toBe('Removed key "toRemove" from the table.');
      expect(await app.getOutputInlineColor()).toBe('black');

      // Table must not contain the pair any more
      const contains = await app.tableHasText('toRemove → val');
      expect(contains).toBeFalsy();
    });

    test('Remove non-existing key shows an error', async ({ page }) => {
      const app = new HashTablePage(page);
      await app.goto();

      await app.setKey('absentKey');
      await app.clickRemove();

      const out = await app.getOutputText();
      expect(out.trim()).toBe('Key "absentKey" not found.');
      expect(await app.getOutputInlineColor()).toBe('darkred');
    });

    test('Remove with empty key triggers validation error', async ({ page }) => {
      const app = new HashTablePage(page);
      await app.goto();

      await app.setKey('');
      await app.clickRemove();

      const out = await app.getOutputText();
      expect(out.trim()).toBe('Please enter a valid key.');
      expect(await app.getOutputInlineColor()).toBe('darkred');
    });
  });

  test.describe('Clear Table (ClearTable) and Table Cleared state (S4_TableCleared)', () => {
    test('Clear the table after adding entries and verify all buckets empty', async ({ page }) => {
      // Insert several keys, then clear -> transition S0 -> S4
      const app = new HashTablePage(page);
      await app.goto();

      // Insert 2 keys
      await app.setKey('c1');
      await app.setValue('v1');
      await app.clickInsert();
      await app.setKey('c2');
      await app.setValue('v2');
      await app.clickInsert();

      // Verify the table has at least one non-empty entry
      const tableTextBefore = (await page.locator('#tableBody').textContent()) || '';
      expect(tableTextBefore.includes('c1 → v1') || tableTextBefore.includes('c2 → v2')).toBeTruthy();

      // Now clear
      await app.clickClear();

      const out = await app.getOutputText();
      expect(out.trim()).toBe('Hash table cleared.');
      expect(await app.getOutputInlineColor()).toBe('black');

      // After clearing, every row should show the empty marker again
      const allEmpty = await app.allRowsContainEmptyMarker();
      expect(allEmpty).toBeTruthy();

      // Ensure none of the previously inserted keys are present
      const tableTextAfter = (await page.locator('#tableBody').textContent()) || '';
      expect(tableTextAfter).not.toContain('c1 → v1');
      expect(tableTextAfter).not.toContain('c2 → v2');
    });
  });

  test.describe('Console and runtime observations', () => {
    test('Page should not produce console.error or uncaught exceptions during typical interactions', async ({ page }) => {
      // This test explicitly exercises common flows and asserts there are no console errors or page errors.
      const app = new HashTablePage(page);
      await app.goto();

      // Perform a sequence of typical interactions
      await app.setKey('x');
      await app.setValue('1');
      await app.clickInsert();

      await app.setKey('x');
      await app.clickGet();

      await app.setKey('x');
      await app.clickRemove();

      await app.setKey('');
      await app.clickGet();

      // At this point the afterEach hook will assert that there were no console.error messages or page errors.
      // We still assert here that we at least captured some console messages (informational) and no fatal errors.
      // This ensures we observed console activity.
      // The page may log zero console messages as well; we only assert absence of errors in afterEach.
      expect(Array.isArray(consoleMessages)).toBeTruthy();
    });
  });
});