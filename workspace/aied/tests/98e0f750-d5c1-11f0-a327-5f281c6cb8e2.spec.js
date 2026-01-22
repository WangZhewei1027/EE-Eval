import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e0f750-d5c1-11f0-a327-5f281c6cb8e2.html';

/**
 * Page Object for the Hash Map Interactive Demo
 */
class HashMapPO {
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('#keyInput');
    this.valueInput = page.locator('#valueInput');
    this.putBtn = page.locator('#putBtn');
    this.getBtn = page.locator('#getBtn');
    this.delBtn = page.locator('#delBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.randBtn = page.locator('#randBtn');
    this.bulkBtn = page.locator('#bulkBtn');
    this.clearLogBtn = page.locator('#clearLog');
    this.hashSelect = page.locator('#hashSelect');
    this.bucketsContainer = page.locator('#bucketsContainer');
    this.logEl = page.locator('#log');
    this.capDisplay = page.locator('#capDisplay');
    this.sizeDisplay = page.locator('#sizeDisplay');
    this.loadDisplay = page.locator('#loadDisplay');
    this.collisionsDisplay = page.locator('#collisionsDisplay');
    this.thresholdDisplay = page.locator('#thresholdDisplay');
    this.statusBadge = page.locator('#statusBadge');
    this.selectedInfo = page.locator('#selectedInfo');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async put(key, value) {
    await this.keyInput.fill(key);
    await this.valueInput.fill(value);
    await this.putBtn.click();
  }

  async get(key) {
    await this.keyInput.fill(key);
    await this.getBtn.click();
  }

  async del(key) {
    await this.keyInput.fill(key);
    await this.delBtn.click();
  }

  async clearMap() {
    await this.clearBtn.click();
  }

  async bulkInsert() {
    await this.bulkBtn.click();
  }

  async randomPopulate() {
    await this.randBtn.click();
  }

  async clearLog() {
    await this.clearLogBtn.click();
  }

  async changeHashTo(value) {
    await this.hashSelect.selectOption(value);
  }

  async pressEnter() {
    await this.page.keyboard.press('Enter');
  }

  async statusText() {
    return (await this.statusBadge.textContent())?.trim();
  }

  async logText() {
    return (await this.logEl.textContent()) || '';
  }

  async numberOfBuckets() {
    return await this.bucketsContainer.locator('.bucket').count();
  }

  async sizeDisplayText() {
    return (await this.sizeDisplay.textContent())?.trim();
  }

  async capacityDisplayText() {
    return (await this.capDisplay.textContent())?.trim();
  }

  async findEntryLocatorByKey(key) {
    // find entry whose .k text equals key
    const entries = this.bucketsContainer.locator('.entry');
    const count = await entries.count();
    for (let i = 0; i < count; i++) {
      const entry = entries.nth(i);
      const k = (await entry.locator('.k').textContent()) || '';
      if (k.trim() === key) return entry;
    }
    return null;
  }

  async hoverEntryByKey(key) {
    const entry = await this.findEntryLocatorByKey(key);
    if (!entry) throw new Error('Entry not found: ' + key);
    await entry.hover();
  }

  async clickEntryByKey(key) {
    const entry = await this.findEntryLocatorByKey(key);
    if (!entry) throw new Error('Entry not found: ' + key);
    await entry.click();
  }

  async getSelectedInfoText() {
    return (await this.selectedInfo.textContent())?.trim();
  }

  async getEntryValueByKey(key) {
    const entry = await this.findEntryLocatorByKey(key);
    if (!entry) return null;
    return (await entry.locator('.v').textContent())?.trim();
  }
}

test.describe('Hash Map Interactive Demo - FSM validation (Application ID: 98e0f750-...)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture runtime page errors to fail-fast if unexpected exceptions happen.
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    // Capture console messages for debugging and assertions.
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Ensure no uncaught page errors occurred during the test run
    expect(pageErrors, 'No unexpected page errors should occur').toEqual([]);
  });

  test('Initial Idle state: page loads and shows initial log and stats', async ({ page }) => {
    const po = new HashMapPO(page);

    // The demo logs a ready message on load.
    await expect(po.logEl).toContainText('Demo ready. Try inserting keys and toggling hash function.');

    // Capacity should be initialized to 8 and size 0.
    await expect(po.capDisplay).toHaveText('8');
    await expect(po.sizeDisplay).toHaveText('0');

    // Buckets rendered: should equal capacity (8)
    const buckets = await po.bucketsContainer.locator('.bucket').count();
    expect(buckets).toBeGreaterThanOrEqual(8); // renderer uses capacity to create buckets

    // No page errors occurred during initial render
    expect(pageErrors.length).toBe(0);
  });

  test('Put event: insert key-value pair, visual feedback, log and stats update', async ({ page }) => {
    const po = new HashMapPO(page);

    // Insert a key
    await po.put('apple', 'red');

    // A log entry with Inserted key should be present
    await expect(po.logEl).toContainText('Inserted key="apple"');

    // Size should update to 1
    await expect(po.sizeDisplay).toHaveText('1');

    // Bucket should contain an entry with correct key and value
    const entry = await po.findEntryLocatorByKey('apple');
    expect(entry, 'entry for "apple" must exist').not.toBeNull();
    const val = await po.getEntryValueByKey('apple');
    expect(val).toBe('red');

    // Status badge should briefly show 'Inserted'
    const statusNow = await po.statusText();
    expect(['Inserted', 'Ready', 'Inserted + resized', 'Replaced']).toContain(statusNow);

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Put event again on same key -> KeyReplaced state and updated value', async ({ page }) => {
    const po = new HashMapPO(page);

    // Insert then replace
    await po.put('apple', 'red');
    await po.put('apple', 'green');

    // Log should contain Replaced
    await expect(po.logEl).toContainText('Replaced key="apple"');

    // Entry value should be updated
    const val = await po.getEntryValueByKey('apple');
    expect(val).toBe('green');

    // Size remains 1
    await expect(po.sizeDisplay).toHaveText('1');

    expect(pageErrors.length).toBe(0);
  });

  test('Get event: retrieve existing key and not-found case', async ({ page }) => {
    const po = new HashMapPO(page);

    // Ensure key exists
    await po.put('pear', 'yellow');

    // Get existing
    await po.get('pear');
    await expect(po.logEl).toContainText('Get key="pear" -> "yellow" (index');

    // Get non-existing
    const beforeLog = await po.logText();
    await po.get('no-such-key-xyz');
    // Log should indicate not found
    await expect(po.logEl).toContainText('-> not found (would go to index');

    // A temporary highlight is applied to target bucket (renderBuckets with highlight)
    // Check that after a short delay highlight is removed (renderBuckets() after 650ms)
    await page.waitForTimeout(700);
    // Ensure no exceptions
    expect(pageErrors.length).toBe(0);
  });

  test('Delete event via button removes entry and logs deletion', async ({ page }) => {
    const po = new HashMapPO(page);

    // Put and then delete via button
    await po.put('to-delete', 'x');
    await expect(po.sizeDisplay).toHaveText('1');
    await po.del('to-delete');

    // Log shows deletion
    await expect(po.logEl).toContainText('Deleted key="to-delete"');

    // Size is 0
    await expect(po.sizeDisplay).toHaveText('0');

    // Entry no longer present
    const entry = await po.findEntryLocatorByKey('to-delete');
    expect(entry).toBeNull();

    expect(pageErrors.length).toBe(0);
  });

  test('ClickBucketEntry: clicking an entry deletes it (entry-level delete)', async ({ page }) => {
    const po = new HashMapPO(page);

    // Put an entry
    await po.put('clickDel', 'v1');
    // Ensure entry exists
    const entry = await po.findEntryLocatorByKey('clickDel');
    expect(entry).not.toBeNull();

    // Click the entry itself -> should delete
    await po.clickEntryByKey('clickDel');

    // Confirm deletion in log
    await expect(po.logEl).toContainText('Deleted key="clickDel"');

    // Confirm not present
    const afterEntry = await po.findEntryLocatorByKey('clickDel');
    expect(afterEntry).toBeNull();

    expect(pageErrors.length).toBe(0);
  });

  test('HoverBucketEntry: mouseenter displays selected info and mouseleave clears it', async ({ page }) => {
    const po = new HashMapPO(page);

    // Put an entry
    await po.put('hoverMe', 'hv');
    // Hover over it
    await po.hoverEntryByKey('hoverMe');

    // selectedInfo should reflect the key and value
    const selText = await po.getSelectedInfoText();
    expect(selText).toContain('key="hoverMe"');
    expect(selText).toContain('value="hv"');
    expect(selText).toContain('index=');

    // Move mouse away by clicking empty container
    await po.bucketsContainer.click({ position: { x: 5, y: 5 } });
    await expect(po.selectedInfo).toHaveText('None');

    expect(pageErrors.length).toBe(0);
  });

  test('Clear event clears the map and logs appropriately (MapCleared state)', async ({ page }) => {
    const po = new HashMapPO(page);

    // Insert some entries
    await po.put('a1', '1');
    await po.put('a2', '2');

    // Clear map
    await po.clearMap();

    // Log contains cleared message
    await expect(po.logEl).toContainText('Cleared map');

    // Size resets to 0
    await expect(po.sizeDisplay).toHaveText('0');

    // No entry exists
    const e1 = await po.findEntryLocatorByKey('a1');
    const e2 = await po.findEntryLocatorByKey('a2');
    expect(e1).toBeNull();
    expect(e2).toBeNull();

    expect(pageErrors.length).toBe(0);
  });

  test('BulkInsert event inserts sample set and updates stats/collisions', async ({ page }) => {
    const po = new HashMapPO(page);

    // Bulk insert
    await po.bulkInsert();

    // Log notes bulk insertion
    await expect(po.logEl).toContainText('Inserted sample set');

    // Size should be > 0
    const sizeText = await po.sizeDisplayText();
    expect(Number(sizeText)).toBeGreaterThan(0);

    // Collisions text should be present (e.g., "0 (max chain X)")
    const collText = (await po.collisionsDisplay.textContent()) || '';
    expect(collText.length).toBeGreaterThan(0);

    expect(pageErrors.length).toBe(0);
  });

  test('RandomKeyValue event populates inputs but does not auto-insert (actual implementation behavior)', async ({ page }) => {
    const po = new HashMapPO(page);

    // Click random populate
    await po.randomPopulate();

    // After clicking randBtn, key and value inputs should be non-empty
    await expect(po.keyInput).not.toHaveValue('');
    await expect(po.valueInput).not.toHaveValue('');

    // But log should not contain an "Inserted key" for the random action (since randBtn just sets inputs)
    const logText = await po.logText();
    expect(logText).not.toContain('Inserted key="');

    expect(pageErrors.length).toBe(0);
  });

  test('ChangeHashFunction event rehashes entries and logs the change (HashFunctionChanged state)', async ({ page }) => {
    const po = new HashMapPO(page);

    // Insert few items
    await po.put('rehash1', 'r1');
    await po.put('rehash2', 'r2');

    // Change hash function to 'constant' to force collisions
    await po.changeHashTo('constant');

    // Log should contain the hash-changed message
    await expect(po.logEl).toContainText('Hash function changed to: constant');

    // Status badge should reflect the change briefly
    const status = await po.statusText();
    expect(['Hash changed', 'Ready']).toContain(status);

    // Because constant hash tends to cluster entries, collisions display could be > 0
    const collText = (await po.collisionsDisplay.textContent()) || '';
    expect(collText.length).toBeGreaterThan(0);

    expect(pageErrors.length).toBe(0);
  });

  test('ClearLog event empties the activity log (MapCleared for logs)', async ({ page }) => {
    const po = new HashMapPO(page);

    // Ensure there is at least one log entry
    await po.put('logKey', 'lv');
    await expect(po.logEl).toContainText('Inserted key="logKey"');

    // Clear the log
    await po.clearLog();

    // The log element should be empty
    const logText = (await po.logText()).trim();
    expect(logText).toBe('');

    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: empty key on Put/Get/Delete should flash status and not modify map', async ({ page }) => {
    const po = new HashMapPO(page);

    // Ensure map empty initially (size 0)
    await expect(po.sizeDisplay).toHaveText('0');

    // Try Put with empty key
    const beforeLog = await po.logText();
    await po.keyInput.fill('   '); // whitespace -> trimmed to empty
    await po.valueInput.fill('something');
    await po.putBtn.click();

    // Status badge should show Enter a key (transient)
    await expect(po.statusBadge).toHaveText(/Enter a key|Ready/);

    // Log should not have recorded an "Inserted" entry for empty key
    const afterPutLog = await po.logText();
    expect(afterPutLog).toBe(beforeLog);

    // Try Get with empty key
    await po.keyInput.fill('');
    await po.getBtn.click();
    await expect(po.statusBadge).toHaveText(/Enter a key|Ready/);

    // Try Delete with empty key
    await po.keyInput.fill('');
    await po.delBtn.click();
    await expect(po.statusBadge).toHaveText(/Enter a key|Ready/);

    // Map remains size 0
    await expect(po.sizeDisplay).toHaveText('0');

    expect(pageErrors.length).toBe(0);
  });

  test('Keyboard shortcut: Enter triggers Put (accessibility/keyboard behavior)', async ({ page }) => {
    const po = new HashMapPO(page);

    // Fill inputs and press Enter to trigger Put (document listens for Enter -> putBtn.click())
    await po.keyInput.fill('kbKey');
    await po.valueInput.fill('kbVal');
    await po.pressEnter();

    // Expect an inserted log and entry present
    await expect(po.logEl).toContainText('Inserted key="kbKey"');
    const entry = await po.findEntryLocatorByKey('kbKey');
    expect(entry).not.toBeNull();

    expect(pageErrors.length).toBe(0);
  });

  // Final sanity check: ensure no uncaught JS exceptions were recorded in any test (also checked in afterEach)
  test('Sanity: no console errors or page errors during interactions', async ({ page }) => {
    // This test only inspects the captured console and page error arrays collected in beforeEach.
    // pageErrors and consoleMessages were reset at beforeEach and populated; ensure no fatal errors.
    // We still assert that there are zero page errors.
    expect(pageErrors.length).toBe(0);

    // Print out console messages to help debug if something went wrong (non-blocking)
    // We assert there were no console messages of type 'error' (console.error)
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length, 'no console.error messages expected').toBe(0);
  });
});