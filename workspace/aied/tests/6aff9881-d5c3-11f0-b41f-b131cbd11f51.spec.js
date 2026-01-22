import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6aff9881-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for the HashMap demo page
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // inputs & buttons
    this.keyInput = page.locator('#keyInput');
    this.valueInput = page.locator('#valueInput');
    this.getKeyInput = page.locator('#getKeyInput');

    this.setBtn = page.locator('#setBtn');
    this.getBtn = page.locator('#getBtn');
    this.hasBtn = page.locator('#hasBtn');
    this.deleteBtn = page.locator('#deleteBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.showAllBtn = page.locator('#showAllBtn');

    // result and visualization
    this.operationResult = page.locator('#operationResult');
    this.hashMapViz = page.locator('#hashMapViz');
    this.entryCount = page.locator('#entryCount');
    this.bucketCount = page.locator('#bucketCount');
    this.loadFactor = page.locator('#loadFactor');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Helper to wait for operation result to appear and return its text & classes
  async getOperationResult() {
    await expect(this.operationResult).toBeVisible({ timeout: 2000 });
    const text = await this.operationResult.textContent();
    const className = await this.operationResult.getAttribute('class');
    return { text: text ? text.trim() : '', className: className || '' };
  }

  // Interactions
  async setKeyValue(key, value) {
    await this.keyInput.fill(key);
    await this.valueInput.fill(value);
    await this.setBtn.click();
    return this.getOperationResult();
  }

  async getValueForKey(key) {
    await this.getKeyInput.fill(key);
    await this.getBtn.click();
    return this.getOperationResult();
  }

  async checkKey(key) {
    await this.getKeyInput.fill(key);
    await this.hasBtn.click();
    return this.getOperationResult();
  }

  async deleteKey(key) {
    await this.getKeyInput.fill(key);
    await this.deleteBtn.click();
    return this.getOperationResult();
  }

  async clearHashMap() {
    await this.clearBtn.click();
    return this.getOperationResult();
  }

  async showAllEntries() {
    await this.showAllBtn.click();
    return this.getOperationResult();
  }

  // Helpers to read visualization and stats
  async getStats() {
    const entries = await this.entryCount.textContent();
    const buckets = await this.bucketCount.textContent();
    const load = await this.loadFactor.textContent();
    return {
      entries: Number(entries?.trim() || 0),
      buckets: Number(buckets?.trim() || 0),
      loadFactor: Number(load?.trim() || 0),
    };
  }

  async visualizationContainsText(text) {
    const content = await this.hashMapViz.textContent();
    return content ? content.includes(text) : false;
  }

  async countBucketsDisplayed() {
    // count .bucket elements inside the visualization
    return await this.page.locator('#hashMapViz .bucket').count();
  }
}

test.describe('Hash Map Implementation - FSM states and transitions', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console errors for each test
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // Uncaught exceptions in the page
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Collect console messages of type 'error' for later assertions
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), args: msg.args() });
      }
    });

    // Navigate to the app
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Assert that the page did not produce uncaught exceptions or console errors.
    // The application is expected to run without runtime errors; if errors do occur they
    // will be visible in the collected arrays and cause the tests to fail here, as required.
    expect(pageErrors, `Expected no uncaught page errors, found: ${pageErrors.length}`).toHaveLength(0);
    expect(consoleErrors, `Expected no console.error messages, found: ${consoleErrors.length}`).toHaveLength(0);
  });

  test.describe('Initial state (S0_Idle) and visualization', () => {
    test('Initial visualization and stats reflect empty hash map (S0_Idle entry action updateVisualization)', async ({ page }) => {
      // Validate the initial Idle state where updateVisualization() is called on load
      const hp = new HashMapPage(page);

      // Operation result should be hidden initially
      await expect(hp.operationResult).toBeHidden();

      // Visualization should indicate empty state text
      await expect(hp.hashMapViz).toBeVisible();
      const vizText = await hp.hashMapViz.textContent();
      expect(vizText).toMatch(/HashMap is empty|Add some key-value pairs/i);

      // Stats should show zeros and proper bucket count (initial default 16)
      const stats = await hp.getStats();
      expect(stats.entries).toBe(0);
      expect(stats.buckets).toBe(16);
      expect(stats.loadFactor).toBeGreaterThanOrEqual(0); // 0.00 expected
    });
  });

  test.describe('Set Key-Value (S1_SetKeyValue) transitions and effects', () => {
    test('Set a single key-value pair updates visualization, stats and shows success message', async ({ page }) => {
      // This test validates the SetKeyValue event/transition
      const hp = new HashMapPage(page);

      const { text, className } = await hp.setKeyValue('name', 'Alice');

      // Operation result text and success class
      expect(text).toContain('Key "name" set to value "Alice"');
      expect(className).toContain('success');

      // Inputs should be cleared after successful set
      expect(await hp.keyInput.inputValue()).toBe('');
      expect(await hp.valueInput.inputValue()).toBe('');

      // Stats should update: entries=1, buckets remains default (16)
      const stats = await hp.getStats();
      expect(stats.entries).toBe(1);
      expect(stats.buckets).toBe(16);
      expect(stats.loadFactor).toBeGreaterThanOrEqual(0);

      // Visualization should contain the key and value
      const containsPair = await hp.visualizationContainsText('name') && await hp.visualizationContainsText('Alice');
      expect(containsPair).toBeTruthy();

      // There should be at least one bucket shown
      const bucketCountDisplayed = await hp.countBucketsDisplayed();
      expect(bucketCountDisplayed).toBeGreaterThanOrEqual(1);
    });

    test('Attempt to set with empty key or value shows error (edge case)', async ({ page }) => {
      // Validate that empty key or value triggers error handling
      const hp = new HashMapPage(page);

      // Both empty
      let res = await hp.setKeyValue('', '');
      expect(res.text).toContain('Please enter both key and value');
      expect(res.className).toContain('error');

      // Empty value
      await hp.keyInput.fill('onlyKey');
      res = await hp.setKeyValue('onlyKey', '');
      // Because setKeyValue fills both inputs and clicks, this will simulate empty value
      // The message should still be the same
      expect(res.text).toContain('Please enter both key and value');
      expect(res.className).toContain('error');
    });
  });

  test.describe('Get Value (S2_GetValue) and Check Key (S3_CheckKey)', () => {
    test('Get existing key returns correct value and non-existing key returns not found', async ({ page }) => {
      const hp = new HashMapPage(page);

      // Add a key first
      await hp.setKeyValue('city', 'Paris');

      // Get existing key
      let res = await hp.getValueForKey('city');
      expect(res.text).toContain('Value for key "city": Paris');
      expect(res.className).toContain('success');

      // Get non-existing key
      res = await hp.getValueForKey('unknownKey123');
      expect(res.text).toContain('Key "unknownKey123" not found');
      expect(res.className).toContain('error');

      // Edge case: empty get input
      await hp.getKeyInput.fill('');
      await hp.getBtn.click();
      res = await hp.getOperationResult();
      expect(res.text).toContain('Please enter a key');
      expect(res.className).toContain('error');
    });

    test('has(key) reflects existence accurately (Check Key transition)', async ({ page }) => {
      const hp = new HashMapPage(page);

      // Ensure empty initially
      let res = await hp.checkKey('maybeKey');
      expect(res.text).toContain('Key "maybeKey" does not exist' || 'does not exist'); // fallback phrasing
      // The implementation uses "does not exist" or "exists" depending on boolean; check class
      expect(res.className).toContain('error');

      // Add key and check again
      await hp.setKeyValue('maybeKey', 'valueX');
      res = await hp.checkKey('maybeKey');
      expect(res.text).toContain('Key "maybeKey" exists');
      expect(res.className).toContain('success');

      // Edge case: empty input
      await hp.getKeyInput.fill('');
      await hp.hasBtn.click();
      res = await hp.getOperationResult();
      expect(res.text).toContain('Please enter a key');
      expect(res.className).toContain('error');
    });
  });

  test.describe('Delete Key (S4_DeleteKey) and Clear HashMap (S5_ClearHashMap)', () => {
    test('Delete existing and non-existing keys behave correctly', async ({ page }) => {
      const hp = new HashMapPage(page);

      // Add an entry
      await hp.setKeyValue('temp', '123');

      // Delete existing key
      let res = await hp.deleteKey('temp');
      expect(res.text).toContain('Key "temp" deleted');
      expect(res.className).toContain('success');

      // Stats should reflect deletion
      const statsAfterDelete = await hp.getStats();
      expect(statsAfterDelete.entries).toBe(0);

      // Delete non-existing key
      res = await hp.deleteKey('not-there');
      expect(res.text).toContain('Key "not-there" not found');
      expect(res.className).toContain('error');

      // Edge case: empty input for delete
      await hp.getKeyInput.fill('');
      await hp.deleteBtn.click();
      res = await hp.getOperationResult();
      expect(res.text).toContain('Please enter a key');
      expect(res.className).toContain('error');
    });

    test('Clear hash map removes all entries and updates visualization and stats', async ({ page }) => {
      const hp = new HashMapPage(page);

      // Add multiple entries
      await hp.setKeyValue('a', '1');
      await hp.setKeyValue('b', '2');

      // Ensure entries exist
      let stats = await hp.getStats();
      expect(stats.entries).toBeGreaterThanOrEqual(2);

      // Clear
      const res = await hp.clearHashMap();
      expect(res.text).toContain('HashMap cleared');
      expect(res.className).toContain('success');

      // Stats show zero
      stats = await hp.getStats();
      expect(stats.entries).toBe(0);

      // Visualization returns empty message
      const vizText = await hp.hashMapViz.textContent();
      expect(vizText).toMatch(/HashMap is empty/i);
    });
  });

  test.describe('Show All Entries (S6_ShowAllEntries) and entries() behavior', () => {
    test('ShowAll shows entries when present and appropriate message when empty', async ({ page }) => {
      const hp = new HashMapPage(page);

      // Ensure empty showAll returns error message
      let res = await hp.showAllEntries();
      expect(res.text).toContain('HashMap is empty');
      expect(res.className).toContain('error');

      // Add entries
      await hp.setKeyValue('k1', 'v1');
      await hp.setKeyValue('k2', 'v2');

      // Show all should list both entries
      res = await hp.showAllEntries();
      expect(res.text).toContain('All entries:');
      expect(res.text).toContain('k1: v1');
      expect(res.text).toContain('k2: v2');
      expect(res.className).toContain('success');
    });
  });

  test.describe('Resizing behavior and stress edge case', () => {
    test('Adding enough entries triggers resize (capacity increases) and rehashing preserves entries', async ({ page }) => {
      const hp = new HashMapPage(page);

      // Default capacity 16 with loadFactor 0.75 triggers resize when size > 12
      const totalToInsert = 13; // push over threshold
      for (let i = 0; i < totalToInsert; i++) {
        const k = `key${i}`;
        const v = `value${i}`;
        await hp.setKeyValue(k, v);
        // wait for visualization to update before next insertion
        await expect(hp.operationResult).toBeVisible();
      }

      // After insertions, capacity should have doubled from 16 to 32 (or more if multiple resizes)
      const stats = await hp.getStats();
      expect(stats.entries).toBeGreaterThanOrEqual(totalToInsert);
      expect(stats.buckets).toBeGreaterThanOrEqual(32);

      // Verify that a few sample keys are present in visualization (rehash preserved)
      const samplePresent = await hp.visualizationContainsText('key0') && await hp.visualizationContainsText('value0');
      expect(samplePresent).toBeTruthy();

      // ShowAll should include a sample of entries
      const showAllRes = await hp.showAllEntries();
      expect(showAllRes.text).toContain('All entries:');
      expect(showAllRes.className).toContain('success');
    }, 30_000); // allow extra time for repeated operations
  });

  test.describe('Console and runtime error observation', () => {
    test('No uncaught ReferenceError/TypeError/SyntaxError should occur during typical interactions', async ({ page }) => {
      // This test performs a few interactions and then asserts that no page errors were emitted
      const hp = new HashMapPage(page);

      await hp.setKeyValue('safeKey', 'safeValue');
      await hp.getValueForKey('safeKey');
      await hp.checkKey('safeKey');
      await hp.deleteKey('safeKey');
      await hp.showAllEntries();
      await hp.clearHashMap();

      // pageErrors and consoleErrors are asserted in afterEach to be empty.
      // For completeness, also assert here explicitly.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});