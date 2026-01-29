import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3aef41-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object encapsulating interactions and queries for the Hash Table app
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
    this.resizeBtn = page.locator('#resizeBtn');
    this.operationLog = page.locator('#operationLog');
    this.bucketsContainer = page.locator('#bucketsContainer');
  }

  async insert(key, value) {
    await this.keyInput.fill(key);
    await this.valueInput.fill(value);
    await this.insertBtn.click();
  }

  async get(key) {
    await this.keyInput.fill(key);
    await this.getBtn.click();
  }

  async remove(key) {
    await this.keyInput.fill(key);
    await this.removeBtn.click();
  }

  async clear() {
    await this.clearBtn.click();
  }

  async resize() {
    await this.resizeBtn.click();
  }

  // Returns the most recent log entry element handle (newest first due to prepend)
  async latestLogEntry() {
    const handle = await this.page.evaluateHandle(() => {
      const log = document.getElementById('operationLog');
      return log.firstElementChild || null;
    });
    return handle.asElement();
  }

  // Read latest log's text and color (inline style)
  async readLatestLog() {
    const el = await this.latestLogEntry();
    if (!el) return null;
    const text = await el.evaluate(node => node.textContent);
    const color = await el.evaluate(node => node.style.color);
    return { text, color };
  }

  // Count bucket elements (each bucket has class 'bucket')
  async bucketCount() {
    return await this.bucketsContainer.locator('.bucket').count();
  }

  // Read the stats line (last child of bucketsContainer)
  async readStatsText() {
    return await this.page.evaluate(() => {
      const container = document.getElementById('bucketsContainer');
      if (!container) return '';
      const last = container.lastElementChild;
      return last ? last.textContent : '';
    });
  }

  // Check whether a key→value pair is present in visualization
  async isPairVisible(key, value) {
    const expectedText = `${key} → ${value}`;
    const found = await this.bucketsContainer.locator('.key-value-pair', { hasText: expectedText }).count();
    return found > 0;
  }

  // Get all log texts in order (newest first)
  async allLogTexts() {
    return await this.page.evaluate(() => {
      const log = document.getElementById('operationLog');
      if (!log) return [];
      return Array.from(log.children).map(c => c.textContent);
    });
  }
}

test.describe('Hash Table Demonstration — FSM state and transition tests', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let page;

  test.beforeEach(async ({ browser }) => {
    // New context/page per test to avoid cross-test interference
    const context = await browser.newContext();
    page = await context.newPage();

    // Capture uncaught page errors
    pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages of type "error" to detect runtime errors logged to console
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Assert there were no unexpected runtime page errors or console errors during test
    // These assertions are added as a safety net to surface runtime failures in the app
    expect(pageErrors.length, `No uncaught page errors should occur: ${pageErrors.map(e=>String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `No console.error messages should be emitted: ${consoleErrors.map(e=>e.text).join(' | ')}`).toBe(0);
    await page.close();
  });

  test('S0_Idle: initial render shows empty buckets and stats', async () => {
    // Validate initial idle state (S0_Idle): renderHashTable() was invoked on load
    const ht = new HashTablePage(page);

    // There should be 8 buckets initially
    const bucketCount = await ht.bucketCount();
    expect(bucketCount).toBe(8);

    // Stats should reflect size 8, items 0, load factor 0.00
    const stats = await ht.readStatsText();
    expect(stats).toContain('Table size: 8');
    expect(stats).toContain('Items: 0');
    expect(stats).toContain('Load factor: 0.00');

    // Operation log should be empty on initial render
    const logs = await ht.allLogTexts();
    expect(logs.length).toBe(0);
  });

  test.describe('Insert (S1_ItemInserted) and related behaviors', () => {
    test('Insert a key-value pair: state transitions to Item Inserted and UI updates', async () => {
      const ht = new HashTablePage(page);

      // Insert a pair
      await ht.insert('apple', 'red');

      // Latest log should indicate insertion and be styled green
      const latest = await ht.readLatestLog();
      expect(latest).not.toBeNull();
      expect(latest.text).toBe('Inserted: apple → red');
      expect(latest.color).toBe('green');

      // Visualization should show the pair
      const visible = await ht.isPairVisible('apple', 'red');
      expect(visible).toBe(true);

      // Stats should report 1 item
      const stats = await ht.readStatsText();
      expect(stats).toContain('Items: 1');

      // Inputs should be cleared after insertion
      const keyValue = await page.locator('#keyInput').inputValue();
      const valValue = await page.locator('#valueInput').inputValue();
      expect(keyValue).toBe('');
      expect(valValue).toBe('');
    });

    test('Inserting without key or value logs an error (edge case)', async () => {
      const ht = new HashTablePage(page);

      // Attempt to insert with missing key
      await ht.insert('', 'someValue');
      let latest = await ht.readLatestLog();
      expect(latest.text).toBe('Please enter both key and value');
      expect(latest.color).toBe('red');

      // Attempt to insert with missing value
      await ht.insert('someKey', '');
      latest = await ht.readLatestLog();
      expect(latest.text).toBe('Please enter both key and value');
      expect(latest.color).toBe('red');

      // No items should have been added
      const stats = await ht.readStatsText();
      expect(stats).toContain('Items: 0');
    });
  });

  test.describe('Get (S2_ItemRetrieved) behaviors', () => {
    test('Get existing key logs found value (Item Retrieved)', async () => {
      const ht = new HashTablePage(page);

      // Pre-insert an item
      await ht.insert('banana', 'yellow');

      // Use get on existing key
      await ht.get('banana');

      const latest = await ht.readLatestLog();
      expect(latest.text).toBe('Found value for key "banana": yellow');
      expect(latest.color).toBe('green');

      // Ensure item still visible and count unchanged
      const visible = await ht.isPairVisible('banana', 'yellow');
      expect(visible).toBe(true);
      const stats = await ht.readStatsText();
      expect(stats).toContain('Items: 1');
    });

    test('Get non-existent key logs not found (error scenario)', async () => {
      const ht = new HashTablePage(page);

      // Ensure searching for unknown key emits not found message
      await ht.get('nonexistent');

      const latest = await ht.readLatestLog();
      expect(latest.text).toBe('Key "nonexistent" not found in hash table');
      expect(latest.color).toBe('red');
    });

    test('Get with empty key logs validation error', async () => {
      const ht = new HashTablePage(page);

      await page.locator('#keyInput').fill('');
      await ht.get('');
      const latest = await ht.readLatestLog();
      expect(latest.text).toBe('Please enter a key to search');
      expect(latest.color).toBe('red');
    });
  });

  test.describe('Remove (S3_ItemRemoved) behaviors', () => {
    test('Remove existing key updates UI and logs removal', async () => {
      const ht = new HashTablePage(page);

      // Insert and then remove
      await ht.insert('cherry', 'darkred');
      // Ensure present
      expect(await ht.isPairVisible('cherry', 'darkred')).toBe(true);

      // Remove
      await ht.remove('cherry');

      // Latest log should indicate removal
      const latest = await ht.readLatestLog();
      expect(latest.text).toBe('Removed key: cherry');
      expect(latest.color).toBe('green');

      // Pair should no longer be visible and items count should be 0
      expect(await ht.isPairVisible('cherry', 'darkred')).toBe(false);
      const stats = await ht.readStatsText();
      expect(stats).toContain('Items: 0');
    });

    test('Remove non-existent key logs not found (error scenario)', async () => {
      const ht = new HashTablePage(page);

      await ht.remove('ghost');
      const latest = await ht.readLatestLog();
      expect(latest.text).toBe('Key "ghost" not found');
      expect(latest.color).toBe('red');
    });

    test('Remove with empty key logs validation error', async () => {
      const ht = new HashTablePage(page);

      await page.locator('#keyInput').fill('');
      await ht.remove('');
      const latest = await ht.readLatestLog();
      expect(latest.text).toBe('Please enter a key to remove');
      expect(latest.color).toBe('red');
    });
  });

  test.describe('Clear (S4_TableCleared) behavior', () => {
    test('Clear removes all items and logs hash table cleared', async () => {
      const ht = new HashTablePage(page);

      // Insert multiple items
      await ht.insert('a', '1');
      await ht.insert('b', '2');
      await ht.insert('c', '3');

      // Ensure items count > 0
      let stats = await ht.readStatsText();
      expect(stats).toContain('Items: 3');

      // Clear the table
      await ht.clear();

      // Latest log should report clearing
      const latest = await ht.readLatestLog();
      expect(latest.text).toBe('Hash table cleared');
      expect(latest.color).toBe('green');

      // All buckets should show Empty and items should be 0
      stats = await ht.readStatsText();
      expect(stats).toContain('Items: 0');

      // There should not be any key-value pair visible
      const foundPairs = await page.locator('.key-value-pair', { hasText: '→' }).count();
      // There may be "Empty" elements which also have class 'key-value-pair' - ensure no non-empty pairs remain
      const nonEmpty = await page.evaluate(() => {
        const pairs = Array.from(document.querySelectorAll('.key-value-pair'));
        return pairs.filter(p => !p.textContent.includes('Empty')).length;
      });
      expect(nonEmpty).toBe(0);
    });
  });

  test.describe('Resize (S5_TableResized) and rehashing behaviors', () => {
    test('Resize toggles table size and preserves items (rehashing)', async () => {
      const ht = new HashTablePage(page);

      // Insert items that will require rehashing correctness across resize
      await ht.insert('one', '1');
      await ht.insert('two', '2');
      await ht.insert('three', '3');

      // Confirm initial size 8
      let stats = await ht.readStatsText();
      expect(stats).toContain('Table size: 8');
      expect(stats).toContain('Items: 3');

      // Resize to 16 (toggle)
      await ht.resize();

      // Latest log should indicate resizing
      let latest = await ht.readLatestLog();
      expect(latest.text).toBe('Resized hash table to 16 buckets');
      expect(latest.color).toBe('green');

      // Stats should reflect new size and same number of items
      stats = await ht.readStatsText();
      expect(stats).toContain('Table size: 16');
      expect(stats).toContain('Items: 3');

      // All previously inserted items should remain visible
      expect(await ht.isPairVisible('one', '1')).toBe(true);
      expect(await ht.isPairVisible('two', '2')).toBe(true);
      expect(await ht.isPairVisible('three', '3')).toBe(true);

      // Resize back to 8 buckets
      await ht.resize();
      latest = await ht.readLatestLog();
      expect(latest.text).toBe('Resized hash table to 8 buckets');
      expect(latest.color).toBe('green');

      // Ensure items still preserved after second resize
      stats = await ht.readStatsText();
      expect(stats).toContain('Table size: 8');
      expect(stats).toContain('Items: 3');
      expect(await ht.isPairVisible('one', '1')).toBe(true);
      expect(await ht.isPairVisible('two', '2')).toBe(true);
      expect(await ht.isPairVisible('three', '3')).toBe(true);
    });
  });

  test('Operational logs order and styling sanity check', async () => {
    const ht = new HashTablePage(page);

    // Trigger a sequence: invalid insert -> valid insert -> get missing -> get existing
    await ht.insert('', ''); // invalid
    await ht.insert('k1', 'v1'); // valid
    await ht.get('missing'); // not found
    await ht.get('k1'); // found

    // Retrieve all logs (newest first)
    const logs = await ht.allLogTexts();

    // Ensure the last four messages correspond to our actions in reverse order (prepend behavior)
    expect(logs[0]).toBe('Found value for key "k1": v1');
    expect(logs[1]).toBe('Key "missing" not found in hash table');
    expect(logs[2]).toBe('Inserted: k1 → v1');
    expect(logs[3]).toBe('Please enter both key and value');

    // Check that color styling matches success/error expectations for the four entries
    // newest entry is index 0; check inline style color values by inspecting individual entries
    const firstLogEl = await page.locator('#operationLog').first();
    const color0 = await firstLogEl.evaluate(node => node.style.color);
    expect(color0).toBe('green'); // found

    const color1 = await page.locator('#operationLog > div').nth(1).evaluate(node => node.style.color);
    expect(color1).toBe('red'); // not found

    const color2 = await page.locator('#operationLog > div').nth(2).evaluate(node => node.style.color);
    expect(color2).toBe('green'); // inserted

    const color3 = await page.locator('#operationLog > div').nth(3).evaluate(node => node.style.color);
    expect(color3).toBe('red'); // invalid insert
  });
});