import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6aff9880-d5c3-11f0-b41f-b131cbd11f51.html';

/**
 * Page Object Model for the Hash Table Visualization app.
 * Encapsulates common interactions and queries used throughout the tests.
 */
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('#keyInput');
    this.valueInput = page.locator('#valueInput');
    this.insertBtn = page.locator('button[onclick="insert()"]');
    this.searchBtn = page.locator('button[onclick="search()"]');
    this.removeBtn = page.locator('button[onclick="remove()"]');
    this.insertRandomBtn = page.locator('button[onclick="insertRandom()"]');
    this.clearTableBtn = page.locator('button[onclick="clearTable()"]');
    this.showHashFnBtn = page.locator('button[onclick="showHashFunction()"]');
    this.searchResult = page.locator('#searchResult .search-result');
    this.bucketSelector = (i) => page.locator(`#bucket-${i}`);
    this.bucketEntries = (i) => page.locator(`#bucket-${i} .entry`);
    this.buckets = page.locator('.bucket');
    this.info = page.locator('.info');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait until buckets are rendered by initVisualization
    await expect(this.buckets).toHaveCount(10);
    // Ensure visualization finished updating
    await expect(this.info).toBeVisible();
  }

  async insert(key, value) {
    await this.keyInput.fill(key);
    await this.valueInput.fill(value);
    await this.insertBtn.click();
    // Wait for message to appear
    await expect(this.searchResult).toBeVisible();
  }

  async search(key) {
    await this.keyInput.fill(key);
    await this.searchBtn.click();
    await expect(this.searchResult).toBeVisible();
  }

  async remove(key) {
    await this.keyInput.fill(key);
    await this.removeBtn.click();
    await expect(this.searchResult).toBeVisible();
  }

  async insertRandom() {
    await this.insertRandomBtn.click();
    await expect(this.searchResult).toBeVisible();
  }

  async clearTable() {
    await this.clearTableBtn.click();
    await expect(this.searchResult).toBeVisible();
  }

  async showHashFunction() {
    await this.showHashFnBtn.click();
    await expect(this.searchResult).toBeVisible();
  }

  async getSearchResultText() {
    return (await this.searchResult.textContent()) ?? '';
  }

  async getSearchResultClass() {
    const el = this.page.locator('#searchResult .search-result');
    const classAttr = await el.getAttribute('class');
    // class could be "search-result found" or "search-result not-found"
    return classAttr ?? '';
  }

  async getBucketEntriesText(index) {
    const entries = this.page.locator(`#bucket-${index} .entry`);
    const count = await entries.count();
    const result = [];
    for (let i = 0; i < count; i++) {
      const key = await entries.nth(i).locator('.key').textContent();
      const value = await entries.nth(i).locator('.value').textContent();
      result.push({
        key: (key ?? '').trim(),
        value: (value ?? '').trim(),
      });
    }
    return result;
  }

  async findEntryAcrossBuckets(key) {
    for (let i = 0; i < 10; i++) {
      const entries = await this.getBucketEntriesText(i);
      for (const entry of entries) {
        if (entry.key === key) {
          return { index: i, entry };
        }
      }
    }
    return null;
  }

  async getLoadFactor() {
    const infoText = (await this.info.textContent()) ?? '';
    // Info contains: "<p><strong>Hash Table Stats:</strong> Size: 10 | Load Factor: 0.00</p>"
    const match = infoText.match(/Load Factor:\s*([\d.]+)/);
    if (match) return parseFloat(match[1]);
    return NaN;
  }
}

test.describe('Hash Table Visualization - FSM and UI tests', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors to observe runtime issues per requirements
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app and ensure initial rendering completes
    const htp = new HashTablePage(page);
    await htp.goto();
  });

  test.afterEach(async ({ page }) => {
    // Basic teardown: ensure no uncaught exceptions occurred during the test run
    // We assert that there were no page errors and no console errors of severity 'error'.
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error');
    // Provide informative failure messages if errors are present
    expect(pageErrors.length, `Page had unexpected errors: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Console had error messages: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
    // Close page context handled by Playwright fixtures
  });

  test.describe('Initialization (S0_Idle)', () => {
    test('Initial state creates 10 buckets and displays stats', async ({ page }) => {
      // Validate initial state: buckets exist and info shows size 10 and load factor 0.00
      const htp = new HashTablePage(page);
      await expect(htp.buckets).toHaveCount(10);
      const loadFactor = await htp.getLoadFactor();
      expect(loadFactor).toBeCloseTo(0.0, 2);
      const infoText = (await htp.info.textContent()) ?? '';
      expect(infoText).toContain('Hash Table Stats');
      expect(infoText).toContain('Size: 10');
    });
  });

  test.describe('Insert/Search/Remove transitions (S1, S2, S3)', () => {
    test('Insert -> state S1_ItemInserted: message shown and bucket updated', async ({ page }) => {
      // Insert a key/value and verify message & visualization updated
      const htp = new HashTablePage(page);
      await htp.insert('apple', 'fruit');

      const resultText = await htp.getSearchResultText();
      expect(resultText).toMatch(/Inserted:\s*"apple"\s*->\s*"fruit"\s*at bucket \d+/);
      expect(await htp.getSearchResultClass()).toContain('found');

      // Parse bucket index from message and assert the entry exists in that bucket
      const match = resultText.match(/at bucket (\d+)/);
      expect(match).not.toBeNull();
      const index = parseInt(match[1], 10);
      const entries = await htp.getBucketEntriesText(index);
      const found = entries.find(e => e.key === 'apple' && e.value === 'fruit');
      expect(found, `Inserted entry not found in bucket ${index}`).toBeTruthy();

      // Load factor should be 0.1 (1/10)
      const loadFactor = await htp.getLoadFactor();
      expect(loadFactor).toBeCloseTo(0.1, 2);
    });

    test('Search existing key returns Found (S1_ItemInserted -> S1 check)', async ({ page }) => {
      // Ensure search finds existing key
      const htp = new HashTablePage(page);
      // Insert first to guarantee presence
      await htp.insert('banana', 'yellow');
      // Wait briefly for message to clear naturally could happen, but we search immediately
      await htp.search('banana');
      const txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Found:\s*"banana"\s*->\s*"yellow"/);
      expect(await htp.getSearchResultClass()).toContain('found');
    });

    test('Search non-existent key -> state S3_ItemNotFound', async ({ page }) => {
      // Searching a key that was not inserted should produce not-found message
      const htp = new HashTablePage(page);
      await htp.search('thisKeyDoesNotExist');
      const txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Key "thisKeyDoesNotExist" not found/);
      expect(await htp.getSearchResultClass()).toContain('not-found');
    });

    test('Remove existing key -> state S2_ItemRemoved and visualization updated', async ({ page }) => {
      // Insert then remove and verify bucket no longer contains the key
      const htp = new HashTablePage(page);
      await htp.insert('toRemove', 'temp');
      // find inserted entry
      const found = await htp.findEntryAcrossBuckets('toRemove');
      expect(found, 'precondition: toRemove must exist after insertion').not.toBeNull();
      await htp.remove('toRemove');
      const txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Removed key: "toRemove"/);
      expect(await htp.getSearchResultClass()).toContain('found');

      // Ensure it's actually removed
      const stillThere = await htp.findEntryAcrossBuckets('toRemove');
      expect(stillThere).toBeNull();
    });

    test('Remove non-existent key -> state S3_ItemNotFound', async ({ page }) => {
      const htp = new HashTablePage(page);
      await htp.remove('nonexistentKey123');
      const txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Key "nonexistentKey123" not found/);
      expect(await htp.getSearchResultClass()).toContain('not-found');
    });
  });

  test.describe('Other operations (InsertRandom, ClearTable, ShowHashFunction)', () => {
    test('Insert Random -> behaves like S1_ItemInserted and shows which key was inserted', async ({ page }) => {
      // Insert random and extract key/value from message; ensure entry exists in indicated bucket
      const htp = new HashTablePage(page);
      await htp.insertRandom();
      const txt = await htp.getSearchResultText();

      // Message format: Inserted random: "key" -> "value" at bucket X
      const match = txt.match(/Inserted random:\s*"([^"]+)"\s*->\s*"([^"]+)"\s*at bucket\s*(\d+)/);
      expect(match, `Unexpected insertRandom message format: ${txt}`).not.toBeNull();
      const [, key, value, indexStr] = match;
      const index = parseInt(indexStr, 10);

      // Verify the indicated bucket contains the inserted entry
      const entries = await htp.getBucketEntriesText(index);
      const found = entries.find(e => e.key === key && e.value === value);
      expect(found, `Random-inserted entry "${key}" not found in bucket ${index}`).toBeTruthy();
      expect(await htp.getSearchResultClass()).toContain('found');
    });

    test('Clear Table -> state S4_TableCleared resets buckets and shows message', async ({ page }) => {
      // Insert some entries first, then clear and assert buckets empty
      const htp = new HashTablePage(page);
      await htp.insert('k1', 'v1');
      await htp.insert('k2', 'v2');

      // Confirm something is present
      let load = await htp.getLoadFactor();
      expect(load).toBeGreaterThan(0);

      await htp.clearTable();
      const txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Hash table cleared/);
      expect(await htp.getSearchResultClass()).toContain('found');

      // All buckets should be empty and load factor 0
      for (let i = 0; i < 10; i++) {
        const entries = await htp.getBucketEntriesText(i);
        expect(entries.length, `Bucket ${i} should be empty after clear`).toBe(0);
      }
      const loadAfter = await htp.getLoadFactor();
      expect(loadAfter).toBeCloseTo(0.0, 2);
    });

    test('Show Hash Function -> state S5_HashFunctionShown displays hash for "example"', async ({ page }) => {
      const htp = new HashTablePage(page);
      await htp.showHashFunction();
      const txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Hash function for "example": \d+/);
      expect(await htp.getSearchResultClass()).toContain('found');
    });
  });

  test.describe('Edge cases and validation messages', () => {
    test('Insert with empty fields shows validation message (edge case)', async ({ page }) => {
      const htp = new HashTablePage(page);
      // Ensure inputs are empty
      await htp.keyInput.fill('');
      await htp.valueInput.fill('');
      await htp.insertBtn.click();
      const txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Please enter both key and value/);
      expect(await htp.getSearchResultClass()).toContain('not-found');
    });

    test('Search with empty input prompts for key', async ({ page }) => {
      const htp = new HashTablePage(page);
      await htp.keyInput.fill('');
      await htp.searchBtn.click();
      const txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Please enter a key to search/);
      expect(await htp.getSearchResultClass()).toContain('not-found');
    });

    test('Remove with empty input prompts for key', async ({ page }) => {
      const htp = new HashTablePage(page);
      await htp.keyInput.fill('');
      await htp.removeBtn.click();
      const txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Please enter a key to remove/);
      expect(await htp.getSearchResultClass()).toContain('not-found');
    });

    test('Inserting the same key updates value (collision/update scenario)', async ({ page }) => {
      const htp = new HashTablePage(page);
      await htp.insert('dupKey', 'value1');
      // Insert same key with new value
      await htp.insert('dupKey', 'value2');
      // Search to verify updated value
      await htp.search('dupKey');
      const txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Found:\s*"dupKey"\s*->\s*"value2"/);
      expect(await htp.getSearchResultClass()).toContain('found');

      // Verify only one entry exists for that key across buckets
      let occurrences = 0;
      for (let i = 0; i < 10; i++) {
        const entries = await htp.getBucketEntriesText(i);
        for (const e of entries) {
          if (e.key === 'dupKey') occurrences++;
        }
      }
      expect(occurrences).toBe(1);
    });
  });

  test.describe('FSM transitions coverage summary', () => {
    test('Trigger all FSM events and verify their visible effects', async ({ page }) => {
      // This test ensures all event triggers listed in the FSM fire and display expected messages.
      const htp = new HashTablePage(page);

      // Insert (explicit)
      await htp.insert('fsmKey', 'fsmValue');
      let txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Inserted:\s*"fsmKey"\s*->\s*"fsmValue"/);
      expect(await htp.getSearchResultClass()).toContain('found');

      // Search for non-existing to validate S3
      await htp.search('___notPresent___');
      txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Key "___notPresent___" not found/);
      expect(await htp.getSearchResultClass()).toContain('not-found');

      // Remove (existing)
      await htp.remove('fsmKey');
      txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Removed key: "fsmKey"/);
      expect(await htp.getSearchResultClass()).toContain('found');

      // InsertRandom
      await htp.insertRandom();
      txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Inserted random:/);
      expect(await htp.getSearchResultClass()).toContain('found');

      // ShowHashFunction
      await htp.showHashFunction();
      txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Hash function for "example": \d+/);
      expect(await htp.getSearchResultClass()).toContain('found');

      // ClearTable
      await htp.clearTable();
      txt = await htp.getSearchResultText();
      expect(txt).toMatch(/Hash table cleared/);
      expect(await htp.getSearchResultClass()).toContain('found');
    });
  });
});