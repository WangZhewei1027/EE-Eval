import { test, expect } from '@playwright/test';

// Page Object Model for the Hash Table page
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      key: '#key',
      value: '#value',
      addBtn: '#addBtn',
      displayBtn: '#displayBtn',
      hashTableBody: '#hashTableBody',
    };
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/17627be0-d5c1-11f0-938c-19d14b60ef51.html', { waitUntil: 'load' });
  }

  async fillKey(key) {
    await this.page.fill(this.selectors.key, key);
  }

  async fillValue(value) {
    await this.page.fill(this.selectors.value, value);
  }

  async clickAddAndHandleDialog(expectedMessage) {
    // Wait for the dialog that is expected on clicking Add
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.click(this.selectors.addBtn),
    ]);
    // Assert the dialog message and accept it
    expect(dialog.message()).toBe(expectedMessage);
    await dialog.accept();
  }

  async clickAddWithoutExpectingDialog() {
    await this.page.click(this.selectors.addBtn);
  }

  async clickDisplay() {
    await this.page.click(this.selectors.displayBtn);
  }

  async getTableRows() {
    return await this.page.$$eval(`${this.selectors.hashTableBody} tr`, rows =>
      rows.map(r => {
        const cells = Array.from(r.querySelectorAll('td')).map(td => td.textContent);
        return cells;
      })
    );
  }

  async getHashTableRaw() {
    return await this.page.evaluate(() => {
      // Return the underlying table structure for deeper assertions
      try {
        return window.hashTable ? window.hashTable.display() : null;
      } catch (e) {
        return { __error__: String(e) };
      }
    });
  }

  async clearInputs() {
    await this.page.fill(this.selectors.key, '');
    await this.page.fill(this.selectors.value, '');
  }

  async getInputValues() {
    return {
      key: await this.page.inputValue(this.selectors.key),
      value: await this.page.inputValue(this.selectors.value),
    };
  }
}

// Collects console error messages and page errors for assertions
function attachErrorCollectors(page, ctx) {
  ctx.consoleErrors = [];
  ctx.pageErrors = [];
  ctx.consoleListener = msg => {
    if (msg.type() === 'error') {
      ctx.consoleErrors.push({ text: msg.text(), location: msg.location() });
    }
  };
  ctx.pageErrorListener = err => {
    // pageerror event provides Error object
    ctx.pageErrors.push(String(err));
  };
  page.on('console', ctx.consoleListener);
  page.on('pageerror', ctx.pageErrorListener);
}

function detachErrorCollectors(page, ctx) {
  if (ctx.consoleListener) page.off('console', ctx.consoleListener);
  if (ctx.pageErrorListener) page.off('pageerror', ctx.pageErrorListener);
}

/**
 * Test suite for the Hash Table Example application.
 *
 * These tests validate the FSM states:
 * - S0_Idle: initial render (inputs/buttons present)
 * - S1_ItemAdded: adding items via UI shows alert and stores data
 * - S2_DisplayHashTable: clicking display populates table rows
 *
 * They also cover edge cases and verify there are no runtime console/page errors.
 */
test.describe('Hash Table Example - FSM validation', () => {
  // Shared context to collect errors for each test
  let ctx = {};

  test.beforeEach(async ({ page }) => {
    ctx = {};
    attachErrorCollectors(page, ctx);
  });

  test.afterEach(async ({ page }) => {
    // Ensure we detach listeners to avoid cross-test interference
    detachErrorCollectors(page, ctx);
  });

  test('Idle state: page renders inputs, buttons, and empty table (S0_Idle)', async ({ page }) => {
    // Test validates initial render and Idle state evidence:
    // Inputs #key and #value, buttons #addBtn and #displayBtn, and empty table body.
    const app = new HashTablePage(page);
    await app.goto();

    // Elements exist
    await expect(page.locator('#key')).toBeVisible();
    await expect(page.locator('#value')).toBeVisible();
    await expect(page.locator('#addBtn')).toBeVisible();
    await expect(page.locator('#displayBtn')).toBeVisible();
    await expect(page.locator('#hashTable')).toBeVisible();

    // Table body should be empty initially
    const rows = await app.getTableRows();
    expect(rows.length).toBe(0);

    // There should be no console error messages or uncaught page errors on initial load
    expect(ctx.consoleErrors.length).toBe(0);
    expect(ctx.pageErrors.length).toBe(0);
  });

  test('AddToHashTable event transitions to ItemAdded (S1_ItemAdded) and stores data', async ({ page }) => {
    // This test:
    // - fills key and value
    // - clicks Add and asserts the alert message (onEnter action)
    // - verifies inputs are cleared after add
    // - verifies the underlying hashTable stores the new entry
    const app = new HashTablePage(page);
    await app.goto();

    // Fill inputs
    await app.fillKey('apple');
    await app.fillValue('fruit');

    // Click add and expect alert 'Added to Hash Table'
    await app.clickAddAndHandleDialog('Added to Hash Table');

    // Inputs should be cleared as per implementation
    const inputs = await app.getInputValues();
    expect(inputs.key).toBe('');
    expect(inputs.value).toBe('');

    // Verify underlying data stored in hashTable
    const raw = await app.getHashTableRaw();
    // raw should be an array (length 10) with at least one bucket containing our item
    expect(Array.isArray(raw)).toBe(true);
    // Flatten buckets and check for matching key/value
    const flattened = (raw || []).flat().filter(Boolean);
    const found = flattened.some(item => item && item.key === 'apple' && item.value === 'fruit');
    expect(found).toBe(true);

    // No console or page errors during this interaction
    expect(ctx.consoleErrors.length).toBe(0);
    expect(ctx.pageErrors.length).toBe(0);
  });

  test('AddToHashTable edge case: missing inputs triggers validation alert', async ({ page }) => {
    // This test validates the error scenario when user clicks Add without entering key/value.
    const app = new HashTablePage(page);
    await app.goto();

    // Ensure inputs are empty
    await app.clearInputs();

    // Click add and expect alert 'Please enter both key and value'
    await app.clickAddAndHandleDialog('Please enter both key and value');

    // Table should still be empty
    const rows = await app.getTableRows();
    expect(rows.length).toBe(0);

    // No console/page runtime errors from this flow
    expect(ctx.consoleErrors.length).toBe(0);
    expect(ctx.pageErrors.length).toBe(0);
  });

  test('DisplayHashTable event populates table rows (S2_DisplayHashTable)', async ({ page }) => {
    // This test:
    // - adds multiple items via UI (verifying alerts)
    // - clicks Display and verifies table rows match stored entries
    const app = new HashTablePage(page);
    await app.goto();

    // Add first item
    await app.fillKey('cat');
    await app.fillValue('animal');
    await app.clickAddAndHandleDialog('Added to Hash Table');

    // Add second item (different key)
    await app.fillKey('dog');
    await app.fillValue('pet');
    await app.clickAddAndHandleDialog('Added to Hash Table');

    // Add duplicate key to test multiple entries in same bucket or duplicates allowed
    await app.fillKey('cat');
    await app.fillValue('pet');
    await app.clickAddAndHandleDialog('Added to Hash Table');

    // Now click Display to populate the table
    await app.clickDisplay();

    // Get table rows and validate content presence
    const rows = await app.getTableRows();
    // We expect at least three rows corresponding to the three additions
    expect(rows.length).toBeGreaterThanOrEqual(3);

    // Transform rows to easier to assert set of key/value pairs
    const pairs = rows.map(cells => ({ index: cells[0], key: cells[1], value: cells[2] }));

    // Ensure at least one row has cat/animal, one has dog/pet, one has cat/pet
    const hasCatAnimal = pairs.some(p => p.key === 'cat' && p.value === 'animal');
    const hasDogPet = pairs.some(p => p.key === 'dog' && p.value === 'pet');
    const hasCatPet = pairs.some(p => p.key === 'cat' && p.value === 'pet');

    expect(hasCatAnimal).toBe(true);
    expect(hasDogPet).toBe(true);
    expect(hasCatPet).toBe(true);

    // No console/page runtime errors during this interaction
    expect(ctx.consoleErrors.length).toBe(0);
    expect(ctx.pageErrors.length).toBe(0);
  });

  test('DisplayHashTable when empty results in no rows (edge case)', async ({ page }) => {
    // Reload page to get fresh empty hash table
    const app = new HashTablePage(page);
    await app.goto();

    // Ensure fresh state: do not add anything, click display
    await app.clickDisplay();

    const rows = await app.getTableRows();
    expect(rows.length).toBe(0);

    // No console/page errors
    expect(ctx.consoleErrors.length).toBe(0);
    expect(ctx.pageErrors.length).toBe(0);
  });

  test('Direct inspection of JS runtime: verify HashTable API exists and behaves', async ({ page }) => {
    // This test validates that the HashTable class and its methods exist on the page.
    // It also ensures that calling display() returns an array of expected size.
    const app = new HashTablePage(page);
    await app.goto();

    const apiInfo = await page.evaluate(() => {
      const result = {};
      result.hasHashTable = typeof window.hashTable !== 'undefined';
      result.displayType = null;
      result.size = null;
      try {
        if (window.hashTable && typeof window.hashTable.display === 'function') {
          const disp = window.hashTable.display();
          result.displayType = Array.isArray(disp) ? 'array' : typeof disp;
          result.size = window.hashTable.size || null;
        }
      } catch (e) {
        result.error = String(e);
      }
      return result;
    });

    expect(apiInfo.hasHashTable).toBe(true);
    expect(apiInfo.displayType).toBe('array');
    // The constructor in the page sets size to 10
    expect(apiInfo.size === 10).toBe(true);

    // There should be no runtime evaluation errors
    expect(apiInfo.error).toBeUndefined();

    // No console/page errors
    expect(ctx.consoleErrors.length).toBe(0);
    expect(ctx.pageErrors.length).toBe(0);
  });
});