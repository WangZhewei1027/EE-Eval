import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52083580-fa76-11f0-a09b-87751f540fd8.html';

// Page object encapsulating interactions and log/error capturing
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages for assertions
    this.page.on('console', (msg) => {
      // convert to string to avoid Playwright ConsoleMessage objects in arrays
      try {
        this.consoleMessages.push(msg.text());
      } catch (e) {
        this.consoleMessages.push(String(msg));
      }
    });

    // Capture page errors (uncaught exceptions)
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err && err.message ? err.message : String(err));
    });
  }

  // Navigate to the app and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // allow any synchronous scripts to execute
    await this.page.waitForTimeout(50);
  }

  // Utility to call global functions defined by the page
  async add(key, value) {
    await this.page.evaluate((k, v) => {
      // call the global add function as defined in the page if available
      // do not redefine or patch anything
      // this will naturally throw if add is not present; the outer test will observe that via pageerror
      window.add(k, v);
    }, key, value);
  }

  async remove(key) {
    await this.page.evaluate((k) => {
      window.remove(k);
    }, key);
  }

  async update(key, value) {
    await this.page.evaluate((k, v) => {
      window.update(k, v);
    }, key, value);
  }

  async search(key) {
    await this.page.evaluate((k) => {
      window.search(k);
    }, key);
  }

  async clear() {
    await this.page.evaluate(() => {
      window.clear();
    });
  }

  async display() {
    await this.page.evaluate(() => {
      window.display();
    });
  }

  // Wait for a console message that includes expected text. Returns true if found within timeout.
  async waitForConsoleMessageContaining(text, timeout = 2000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (this.consoleMessages.some((m) => m.includes(text))) return true;
      await this.page.waitForTimeout(50);
    }
    return false;
  }

  // Get a snapshot of console messages
  getMessages() {
    return Array.from(this.consoleMessages);
  }

  getErrors() {
    return Array.from(this.pageErrors);
  }

  // Query the DOM table to check static content (the HTML table in the markup)
  async getTableRowsText() {
    return this.page.$$eval('#hash-table tr', (rows) =>
      rows.map((r) => Array.from(r.querySelectorAll('th,td')).map((c) => c.textContent?.trim() ?? '').join('|'))
    );
  }
}

test.describe('Hash Table FSM - Interactive Application Tests', () => {
  // New page per test for isolation
  test.describe.configure({ mode: 'parallel' });

  test('Initial state: display() called on load logs "Hash Table:"', async ({ page }) => {
    // Validate that on load the initial display() was invoked and logged
    const app = new HashTablePage(page);
    await app.goto();

    // The first display call should have at least logged "Hash Table:"
    const found = await app.waitForConsoleMessageContaining('Hash Table:', 2000);
    expect(found).toBe(true);

    // Ensure there are no uncaught page errors on initial load
    expect(app.getErrors()).toEqual([]);
  });

  test('Add keys: page scripts add Apple, Orange, Banana and logs observed', async ({ page }) => {
    // This verifies the AddKey transitions executed during page load and the logs they produced
    const app1 = new HashTablePage(page);
    await app.goto();

    // The page script calls add for three keys; expect three "Key added successfully" messages
    // Wait until at least 3 occurrences are present (or timeout)
    const deadline1 = Date.now() + 2000;
    while (Date.now() < deadline) {
      const count = app.getMessages().filter((m) => m.includes('Key added successfully')).length;
      if (count >= 3) break;
      await page.waitForTimeout(50);
    }
    const addedCount = app.getMessages().filter((m) => m.includes('Key added successfully')).length;
    expect(addedCount).toBeGreaterThanOrEqual(3);

    // After additions, display() should have printed the current entries; check for Apple: 5, Orange: 3, Banana: 2
    expect(app.getMessages().some((m) => m.includes('Apple: 5'))).toBe(true);
    expect(app.getMessages().some((m) => m.includes('Orange: 3'))).toBe(true);
    expect(app.getMessages().some((m) => m.includes('Banana: 2'))).toBe(true);

    // The static HTML table in the document still contains the initial rows (DOM integrity)
    const rows = await app.getTableRowsText();
    // Expect at least header + 3 data rows (exact structure may vary due to malformed th; we check presence of items)
    expect(rows.some((r) => r.includes('Apple'))).toBe(true);
    expect(rows.some((r) => r.includes('Orange'))).toBe(true);
    expect(rows.some((r) => r.includes('Banana'))).toBe(true);

    expect(app.getErrors()).toEqual([]);
  });

  test('Adding an existing key logs "Key already exists in the Hash Table"', async ({ page }) => {
    // This validates the FSM self-loop on AddKey when the key already exists (S1 -> S1)
    const app2 = new HashTablePage(page);
    await app.goto();

    // Ensure Apple exists (added on load). Now attempt to add Apple again and assert appropriate log.
    await app.add('Apple', 5);

    const found1 = await app.waitForConsoleMessageContaining('Key already exists in the Hash Table', 2000);
    expect(found).toBe(true);

    // No page errors should be present
    expect(app.getErrors()).toEqual([]);
  });

  test('Remove key transition: add Orange then remove it and verify logs and display', async ({ page }) => {
    // Tests RemoveKey transition and that display() reflects removal when invoked
    const app3 = new HashTablePage(page);
    await app.goto();

    // Add Orange to ensure it exists, then remove it
    await app.add('Orange', 3);
    await app.waitForConsoleMessageContaining('Key added successfully', 1000);

    await app.remove('Orange');
    const removed = await app.waitForConsoleMessageContaining('Key removed successfully', 1000);
    expect(removed).toBe(true);

    // Call display() and confirm Orange is not listed in display logs
    await app.display();
    // Wait a bit for display messages
    await page.waitForTimeout(100);
    const messages = app.getMessages();
    expect(messages.some((m) => m.includes('Orange:'))).toBe(false);

    expect(app.getErrors()).toEqual([]);
  });

  test('Update key transition: update Banana to 4 and verify logs and search result', async ({ page }) => {
    // This validates UpdateKey and subsequent SearchKey behavior (S2 -> S3 -> S4)
    const app4 = new HashTablePage(page);
    await app.goto();

    // Ensure Banana exists (added on load), update it
    await app.update('Banana', 4);
    const updated = await app.waitForConsoleMessageContaining('Key updated successfully', 1000);
    expect(updated).toBe(true);

    // Search Banana to confirm its value changed
    await app.search('Banana');
    const foundSearch = await app.waitForConsoleMessageContaining('Key: Banana, Value: 4', 1000);
    expect(foundSearch).toBe(true);

    expect(app.getErrors()).toEqual([]);
  });

  test('Search key transition: search Apple logs correct key/value', async ({ page }) => {
    // Validates SearchKey transition and logged search result (S3 -> S4)
    const app5 = new HashTablePage(page);
    await app.goto();

    // Apple should exist; search and assert expected output
    await app.search('Apple');
    const found2 = await app.waitForConsoleMessageContaining('Key: Apple, Value: 5', 1000);
    expect(found).toBe(true);

    expect(app.getErrors()).toEqual([]);
  });

  test('Clear table transition: clear returns "Hash Table cleared successfully" and display shows no keys', async ({ page }) => {
    // Validates ClearTable transition (S4 -> S5) and that clear works on non-empty and subsequent empty table
    const app6 = new HashTablePage(page);
    await app.goto();

    // Clear the hash table
    await app.clear();
    const cleared = await app.waitForConsoleMessageContaining('Hash Table cleared successfully', 1000);
    expect(cleared).toBe(true);

    // After clear, display() should print "Hash Table:" and no key lines
    await app.display();
    await page.waitForTimeout(100);
    const messages1 = app.getMessages();
    // ensure no "Key:" lines remain that show specific key/value pairs
    const hasKeyLines = messages.some((m) => /.+:\s*\d+/.test(m) && !m.includes('Hash Table:'));
    expect(hasKeyLines).toBe(false);

    // Clearing again when empty should still report cleared successfully
    await app.clear();
    const clearedAgain = await app.waitForConsoleMessageContaining('Hash Table cleared successfully', 1000);
    expect(clearedAgain).toBe(true);

    expect(app.getErrors()).toEqual([]);
  });

  test('Edge cases: remove/update/search for non-existent keys log appropriate messages', async ({ page }) => {
    // Test error/edge conditions when interacting with keys that do not exist
    const app7 = new HashTablePage(page);
    await app.goto();

    // Ensure starting from a clean state
    await app.clear();
    await app.waitForConsoleMessageContaining('Hash Table cleared successfully', 1000);

    // Attempt to remove a non-existent key
    await app.remove('NoSuchKey');
    const removeMsg = await app.waitForConsoleMessageContaining('Key does not exist in the Hash Table', 1000);
    expect(removeMsg).toBe(true);

    // Attempt to update a non-existent key
    await app.update('NoSuchKey', 99);
    const updateMsg = await app.waitForConsoleMessageContaining('Key does not exist in the Hash Table', 1000);
    expect(updateMsg).toBe(true);

    // Attempt to search a non-existent key
    await app.search('NoSuchKey');
    const searchMsg = await app.waitForConsoleMessageContaining('Key does not exist in the Hash Table', 1000);
    expect(searchMsg).toBe(true);

    expect(app.getErrors()).toEqual([]);
  });

  test('DOM and script consistency: static table remains unchanged by script display() (display only logs)', async ({ page }) => {
    // The page's display() only logs; it does not mutate DOM. Validate that static HTML table still contains initial entries.
    const app8 = new HashTablePage(page);
    await app.goto();

    // Call display intentionally to ensure it doesn't change the DOM
    await app.display();
    await page.waitForTimeout(50);

    const rows1 = await app.getTableRowsText();
    // The static table markup included "Apple", "Orange", "Banana" rows; we validate their presence in the DOM
    expect(rows.some((r) => r.includes('Apple'))).toBe(true);
    expect(rows.some((r) => r.includes('Orange'))).toBe(true);
    expect(rows.some((r) => r.includes('Banana'))).toBe(true);

    expect(app.getErrors()).toEqual([]);
  });

  test('Sanity: capture and report any runtime page errors (test will fail if unexpected errors exist)', async ({ page }) => {
    // This test ensures we actively observe runtime errors. If any page error occurred earlier in other tests (parallel), it will be captured here for this page instance.
    const app9 = new HashTablePage(page);
    await app.goto();

    // Give some time for any late errors
    await page.waitForTimeout(100);

    const errors = app.getErrors();
    // Fail the test if there were uncaught page errors, but provide the messages for debugging
    expect(errors, `Expected no uncaught page errors, but found: ${errors.join('; ')}`).toEqual([]);
  });
});