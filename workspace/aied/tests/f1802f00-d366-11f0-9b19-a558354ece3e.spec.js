import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1802f00-d366-11f0-9b19-a558354ece3e.html';

// Page Object for interacting with the HashMap page
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('#keyInput');
    this.valueInput = page.locator('#valueInput');
    this.insertButton = page.locator('button', { hasText: 'Insert Key-Value Pair' });
    this.searchKeyInput = page.locator('#searchKey');
    this.searchButton = page.locator('button', { hasText: 'Search Key' });
    this.removeKeyInput = page.locator('#removeKey');
    this.removeButton = page.locator('button', { hasText: 'Remove Key' });
    this.clearButton = page.locator('button', { hasText: 'Clear All' });
    this.statusMessage = page.locator('#statusMessage');
    this.bucketEntries = page.locator('.entry');
    this.bucketsContainer = page.locator('#bucketsContainer');
  }

  async insert(key, value) {
    await this.keyInput.fill(key);
    await this.valueInput.fill(value);
    await this.insertButton.click();
  }

  async search(key) {
    await this.searchKeyInput.fill(key);
    await this.searchButton.click();
  }

  async remove(key) {
    await this.removeKeyInput.fill(key);
    await this.removeButton.click();
  }

  async clear() {
    await this.clearButton.click();
  }

  async getStatusText() {
    return (await this.statusMessage.innerText()).trim();
  }

  async getStatusClass() {
    return (await this.statusMessage.getAttribute('class')) || '';
  }

  async getAllEntryTexts() {
    const count = await this.bucketEntries.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.bucketEntries.nth(i).innerText()).trim());
    }
    return texts;
  }

  // Helper to get the displayed stats text (size and capacity)
  async getStatsFromStatus() {
    const text = await this.getStatusText();
    // Expected format: "HashMap Stats: X entries, Y buckets, Load Factor: Z.ZZ" OR other messages
    const match = text.match(/HashMap Stats:\s*(\d+)\s*entries,\s*(\d+)\s*buckets/i);
    if (match) {
      return { size: Number(match[1]), capacity: Number(match[2]) };
    }
    return null;
  }

  // Directly read hashMap object on the page (read-only)
  async getHashMapState() {
    return await this.page.evaluate(() => {
      // Return relevant snapshot of the global hashMap without modifying it.
      if (typeof hashMap === 'undefined' || hashMap === null) return null;
      return {
        capacity: hashMap.capacity,
        size: hashMap.size,
        bucketsLengths: hashMap.buckets.map(b => b.length),
      };
    });
  }

  // Get bucket index for a key using the page's hash function
  async computeHashIndex(key) {
    return await this.page.evaluate(k => {
      return hashMap.hash(k);
    }, key);
  }
}

test.describe('HashMap Visualization - FSM and UI tests', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for assertions later
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app page (load exactly as-is)
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No teardown beyond Playwright default; leaving hooks for clarity
  });

  test('S0_Idle: Initial state shows preloaded entries and correct stats', async ({ page }) => {
    // Validate the initial Idle state (S0_Idle)
    const hm = new HashMapPage(page);

    // Wait for initial display to be populated
    await expect(hm.bucketsContainer).toBeVisible();

    // The page script initialized 5 entries in the VM (apple, banana, grape, orange, kiwi)
    const entries = await hm.getAllEntryTexts();
    // Ensure at least these keys appear somewhere in the entries text
    const joined = entries.join(' ');
    expect(joined).toContain('"apple": "red"');
    expect(joined).toContain('"banana": "yellow"');
    expect(joined).toContain('"grape": "purple"');
    expect(joined).toContain('"orange": "orange"');
    expect(joined).toContain('"kiwi": "green"');

    // Status message should include "5 entries"
    const status = await hm.getStatusText();
    expect(status).toMatch(/5 entries/i);

    // Ensure no page errors were thrown during initial load
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were emitted
    const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(errorConsoleCount).toBe(0);
  });

  test('InsertEntry -> S1_EntryInserted: inserting a new key updates display, status and size', async ({ page }) => {
    // Validate the InsertEntry transition and entry insertion behavior
    const hm = new HashMapPage(page);

    // Read initial size
    const before = await hm.getHashMapState();
    expect(before).not.toBeNull();
    const initialSize = before.size;

    // Insert a new unique key
    const newKey = 'mango_test';
    const newValue = 'sweet';
    const hashIndex = await hm.computeHashIndex(newKey);

    await hm.insert(newKey, newValue);

    // Status should show the inserted message with the correct bucket index and success class
    const statusText = await hm.getStatusText();
    expect(statusText).toContain(`Inserted: "${newKey}": "${newValue}" at bucket index ${hashIndex}`);
    expect((await hm.getStatusClass())).toContain('success');

    // New entry should appear in the DOM
    const entries = await hm.getAllEntryTexts();
    const found = entries.some(t => t.includes(`"${newKey}": "${newValue}"`));
    expect(found).toBe(true);

    // Size should have incremented by 1
    const after = await hm.getHashMapState();
    expect(after.size).toBe(initialSize + 1);
  });

  test('SearchEntry -> S2_EntrySearched: successful and unsuccessful search scenarios', async ({ page }) => {
    // Validate searching for existing and non-existing keys
    const hm = new HashMapPage(page);

    // Search for an existing key 'apple' (preloaded)
    await hm.search('apple');
    let statusText = await hm.getStatusText();
    // The page's hash function determines bucket index; compute it
    const appleIndex = await hm.computeHashIndex('apple');
    expect(statusText).toContain(`Found: "apple" -> "red" in bucket index ${appleIndex}`);
    expect((await hm.getStatusClass())).toContain('success');

    // Search for a nonexistent key
    const missingKey = 'pear_nonexistent';
    await hm.search(missingKey);
    statusText = await hm.getStatusText();
    expect(statusText).toContain(`Key "${missingKey}" not found`);
    expect((await hm.getStatusClass())).toContain('error');
  });

  test('RemoveEntry -> S3_EntryRemoved: removing existing and non-existing keys updates display and status', async ({ page }) => {
    // Validate remove behavior
    const hm = new HashMapPage(page);

    // Ensure 'apple' exists then remove it
    const entriesBefore = await hm.getAllEntryTexts();
    expect(entriesBefore.some(t => t.includes('"apple": "red"'))).toBe(true);

    const beforeState = await hm.getHashMapState();
    const beforeSize = beforeState.size;

    await hm.remove('apple');

    // Status should indicate removal and have success class
    let statusText = await hm.getStatusText();
    expect(statusText).toContain(`Removed key: "apple"`);
    expect((await hm.getStatusClass())).toContain('success');

    // 'apple' should no longer be present
    const entriesAfter = await hm.getAllEntryTexts();
    expect(entriesAfter.some(t => t.includes('"apple": "red"'))).toBe(false);

    // Size decreased by 1
    const afterState = await hm.getHashMapState();
    expect(afterState.size).toBe(beforeSize - 1);

    // Attempt to remove a non-existent key should yield an error message
    const nonExistent = 'definitely_not_present';
    await hm.remove(nonExistent);
    statusText = await hm.getStatusText();
    expect(statusText).toContain(`Key "${nonExistent}" not found for removal`);
    expect((await hm.getStatusClass())).toContain('error');
  });

  test('ClearHashMap -> S4_HashMapCleared: clearing empties all entries and resets size', async ({ page }) => {
    // Validate clearing the HashMap resets entries to empty
    const hm = new HashMapPage(page);

    // Ensure there are entries to clear
    const stateBefore = await hm.getHashMapState();
    expect(stateBefore.size).toBeGreaterThanOrEqual(0);

    // Clear the map
    await hm.clear();

    // Status should indicate cleared and class success
    const status = await hm.getStatusText();
    expect(status).toContain('HashMap cleared');
    expect((await hm.getStatusClass())).toContain('success');

    // All buckets should have zero entries and size should be 0
    const stateAfter = await hm.getHashMapState();
    expect(stateAfter.size).toBe(0);
    for (const len of stateAfter.bucketsLengths) {
      expect(len).toBe(0);
    }

    // Visual entries should be empty
    const entries = await hm.getAllEntryTexts();
    expect(entries.length).toBe(0);
  });

  test('Edge cases: empty key insertion and large inserts trigger resizing', async ({ page }) => {
    // Validate error on empty key insert and that heavy inserts resize the map correctly
    const hm = new HashMapPage(page);

    // 1) Empty key insert should show an error and not increase size
    const beforeState = await hm.getHashMapState();
    const beforeSize = beforeState.size;

    // Clear key input and attempt insert
    await hm.keyInput.fill('   '); // whitespace only -> trimmed to empty
    await hm.valueInput.fill('someValue');
    await hm.insertButton.click();

    let statusText = await hm.getStatusText();
    expect(statusText).toContain('Please enter a key');
    expect((await hm.getStatusClass())).toContain('error');

    // Size should not change
    const afterAttemptState = await hm.getHashMapState();
    expect(afterAttemptState.size).toBe(beforeSize);

    // 2) Trigger resize by inserting multiple unique keys.
    // Determine how many inserts needed: resizing occurs when size/capacity > loadFactor (0.75)
    // We'll compute current capacity and insert until capacity increases.
    let current = await hm.getHashMapState();
    const startCapacity = current.capacity;

    // Generate unique keys and insert until capacity changes or up to a safe upper bound
    const keysToInsert = [];
    for (let i = 0; i < 20; i++) {
      keysToInsert.push(`bulk_key_${Date.now()}_${i}_${Math.random().toString(36).slice(2,7)}`);
    }

    let capacityIncreased = false;
    for (const k of keysToInsert) {
      await hm.insert(k, 'v');
      const s = await hm.getHashMapState();
      if (s.capacity > startCapacity) {
        capacityIncreased = true;
        break;
      }
    }

    // Expect capacity eventually increases (given enough inserts)
    expect(capacityIncreased).toBe(true);

    // After resize, ensure entries count equals reported size and entries are present in DOM
    const finalState = await hm.getHashMapState();
    expect(finalState.size).toBeGreaterThanOrEqual(beforeSize);

    // There should be at least some .entry elements corresponding to entries
    const entries = await hm.getAllEntryTexts();
    expect(entries.length).toBe(finalState.size);
  });

  test('Console and page error observation: ensure no unexpected runtime errors', async ({ page }) => {
    // This test observes the console and page errors captured during navigation and interactions.
    // We assert there are no uncaught page errors and no console.error logs emitted.
    // Note: The test harness collected messages in beforeEach.

    // Assert that no uncaught exceptions were thrown on the page
    expect(pageErrors.length).toBe(0);

    // Assert there are no console.error messages
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // Optionally record debug info for failures (not modifying runtime)
    // For visibility during test runs, attach the first few console messages if any exist
    // (We are not asserting content beyond absence of errors.)
    // Confirm at least that the console was used (info/log) for some outputs like stats or other logs
    const logMessages = consoleMessages.filter(m => m.type === 'log' || m.type === 'info');
    // It's okay if there are zero log messages; we don't assert they must exist.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});