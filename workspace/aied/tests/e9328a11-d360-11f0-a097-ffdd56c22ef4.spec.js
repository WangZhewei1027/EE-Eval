import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9328a11-d360-11f0-a097-ffdd56c22ef4.html';

// Page object to encapsulate interactions with the demo UI
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.size = page.locator('#size');
    this.capacity = page.locator('#capacity');
    this.load = page.locator('#load');
    this.rehashes = page.locator('#rehashes');
    this.log = page.locator('#log');
    this.buckets = page.locator('#buckets');
    this.keysSummary = page.locator('#keysSummary');
    this.valuesSummary = page.locator('#valuesSummary');

    this.keyType = page.locator('#keyType');
    this.keyInput = page.locator('#keyInput');
    this.keyInputLabel = page.locator('#keyInputLabel');
    this.valueInput = page.locator('#valueInput');

    this.putBtn = page.locator('#putBtn');
    this.getBtn = page.locator('#getBtn');
    this.hasBtn = page.locator('#hasBtn');
    this.deleteBtn = page.locator('#deleteBtn');
    this.clearBtn = page.locator('#clearBtn');

    this.createObjBtn = page.locator('#createObjBtn');
    this.objCount = page.locator('#objCount');
    this.objList = page.locator('#objList');

    this.demoCollide = page.locator('#demoCollide');
    this.demoResize = page.locator('#demoResize');
    this.demoRandom = page.locator('#demoRandom');
  }

  // Helper: read visible log content
  async getLogText() {
    return (await this.log.textContent()) || '';
  }

  // Helper: perform a put using UI (keyType must be set appropriately)
  async uiPut({ keyType = 'string', key = '', value = '' } = {}) {
    await this.keyType.selectOption(keyType);
    // wait for change event and label update
    await this.page.waitForTimeout(10);
    // ensure key input type/label updated
    await this.keyInput.fill(String(key));
    await this.valueInput.fill(String(value));
    await this.putBtn.click();
    // render() is called in the page script, so wait a short time for DOM update
    await this.page.waitForTimeout(30);
  }

  // Helper: perform get/has/delete/clear
  async uiGet(keyType = 'string', key = '') {
    await this.keyType.selectOption(keyType);
    await this.page.waitForTimeout(10);
    await this.keyInput.fill(String(key));
    await this.getBtn.click();
    await this.page.waitForTimeout(20);
  }
  async uiHas(keyType = 'string', key = '') {
    await this.keyType.selectOption(keyType);
    await this.page.waitForTimeout(10);
    await this.keyInput.fill(String(key));
    await this.hasBtn.click();
    await this.page.waitForTimeout(20);
  }
  async uiDelete(keyType = 'string', key = '') {
    await this.keyType.selectOption(keyType);
    await this.page.waitForTimeout(10);
    await this.keyInput.fill(String(key));
    await this.deleteBtn.click();
    await this.page.waitForTimeout(20);
  }
  async uiClear() {
    await this.clearBtn.click();
    await this.page.waitForTimeout(20);
  }

  // Find first entry element (DOM .entry) that matches displayed key text exactly
  async findEntryByDisplayedKey(displayedKey) {
    // entries have .entry with a child .key containing prettyKey text
    const entries = this.buckets.locator('.entry');
    const count = await entries.count();
    for (let i = 0; i < count; i++) {
      const e = entries.nth(i);
      const k = await e.locator('.key').textContent();
      if ((k || '').trim() === displayedKey) return e;
    }
    return null;
  }

  // Click on the first object's 'use' button in object list (index 0 default) - this sets keyType to object and keyInput to index
  async selectObjectByIndex(i = 0) {
    const pill = this.objList.locator('.obj-pill').nth(i);
    await expect(pill).toBeVisible();
    const useBtn = pill.locator('button', { hasText: 'use' });
    await useBtn.click();
    await this.page.waitForTimeout(20);
  }

  // Create N objects via createObjBtn
  async createObjects(n = 1) {
    for (let i = 0; i < n; i++) {
      await this.createObjBtn.click();
      await this.page.waitForTimeout(10);
    }
    // wait for refreshObjList to update DOM
    await this.page.waitForTimeout(30);
  }

  // Utility to get numeric meta values
  async getMeta() {
    return {
      size: Number((await this.size.textContent()) || '0'),
      capacity: Number((await this.capacity.textContent()) || '0'),
      load: Number((await this.load.textContent()) || '0'),
      rehashes: Number((await this.rehashes.textContent()) || '0'),
    };
  }
}

test.describe('HashMap Demo (interactive) - FSM coverage', () => {
  // Collect console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // nothing here; each test will navigate & attach listeners
  });

  test('Initial page loads and renders Idle state', async ({ page }) => {
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', (m) => consoleMsgs.push(m));
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto(APP_URL);

    const ui = new HashMapPage(page);
    // initial meta should show size 0 and capacity 8
    await expect(ui.size).toHaveText('0');
    await expect(ui.capacity).toHaveText('8');

    const logText = await ui.getLogText();
    // appendLog('HashMap initialized.') is called at the end of script initialization
    expect(logText).toContain('HashMap initialized.');

    // No page errors during initial load
    expect(pageErrors.length).toBe(0);

    // Ensure there is at least one non-empty bucket UI and the code block is present
    await expect(page.locator('#codeBlock')).toBeVisible();
    const bucketCount = await page.locator('#buckets .bucket').count();
    expect(bucketCount).toBeGreaterThan(0);

    // There should be no console-level errors during initialization
    const errorConsole = consoleMsgs.filter(m => m.type() === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Put -> Get -> Has -> Delete transitions for string keys', async ({ page }) => {
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', (m) => consoleMsgs.push(m));
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto(APP_URL);
    const ui = new HashMapPage(page);

    // Put "foo" -> "bar"
    await ui.uiPut({ keyType: 'string', key: 'foo', value: 'bar' });

    // size should be 1 and log should contain put message
    const metaAfterPut = await ui.getMeta();
    expect(metaAfterPut.size).toBe(1);
    expect(await ui.getLogText()).toMatch(/put\("foo", "bar"\)/);

    // buckets should contain an entry with key text '"foo"' and value 'bar'
    const entry = await ui.findEntryByDisplayedKey('"foo"');
    expect(entry).not.toBeNull();
    const valText = await entry.locator('.val').textContent();
    expect(valText).toBe('bar');

    // Get the key
    await ui.uiGet('string', 'foo');
    // log should contain get => "bar"
    expect(await ui.getLogText()).toMatch(/get\("foo"\) => "bar"/);

    // Has should return true
    await ui.uiHas('string', 'foo');
    expect(await ui.getLogText()).toMatch(/has\("foo"\) => true/);

    // Delete via button should remove it and log delete => true
    await ui.uiDelete('string', 'foo');
    expect(await ui.getLogText()).toMatch(/delete\("foo"\) => true/);
    // size should be back to 0
    const metaAfterDelete = await ui.getMeta();
    expect(metaAfterDelete.size).toBe(0);

    // There should be no unexpected page errors
    expect(pageErrors.length).toBe(0);
    // No console errors
    const errorConsole = consoleMsgs.filter(m => m.type() === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Clear operation empties the map and logs clear()', async ({ page }) => {
    await page.goto(APP_URL);
    const ui = new HashMapPage(page);

    // Insert several keys
    await ui.uiPut({ keyType: 'string', key: 'a', value: '1' });
    await ui.uiPut({ keyType: 'string', key: 'b', value: '2' });
    await ui.uiPut({ keyType: 'string', key: 'c', value: '3' });

    let meta = await ui.getMeta();
    expect(meta.size).toBeGreaterThanOrEqual(3);

    // Clear
    await ui.uiClear();
    meta = await ui.getMeta();
    expect(meta.size).toBe(0);
    expect(await ui.getLogText()).toMatch(/clear\(\)/);
  });

  test('Object key lifecycle: create object, select, put entry (object), and delete via clicking entry', async ({ page }) => {
    const pageErrors = [];
    const dialogs = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // For confirm dialogs triggered by clicking an entry, accept to delete
      if (dialog.type() === 'confirm' || dialog.type() === 'alert') {
        await dialog.accept();
      } else {
        await dialog.accept();
      }
    });

    await page.goto(APP_URL);
    const ui = new HashMapPage(page);

    // Create one object
    await ui.createObjects(1);
    await expect(ui.objCount).toContainText('1 objects available');
    // Select the created object (Object[0]) via 'use' button
    await ui.selectObjectByIndex(0);

    // Put using object key: keyType should be 'object' and keyInput set to '0' by the 'use' handler
    // Provide a value and click put
    await ui.valueInput.fill('objVal');
    await ui.putBtn.click();
    await page.waitForTimeout(40); // wait for render

    // An entry with class 'object' should be present
    const objectEntry = ui.buckets.locator('.entry.object').first();
    await expect(objectEntry).toBeVisible();
    const displayedKeyText = await objectEntry.locator('.key').textContent();
    expect(displayedKeyText).toMatch(/^Object#/); // prettyKey formats objects as Object#<id>

    // Now click the entry to delete it - this will trigger a confirm dialog which we accept in dialog handler
    await objectEntry.click();
    await page.waitForTimeout(40);

    // After deletion, size should be 0
    const metaAfter = await ui.getMeta();
    expect(metaAfter.size).toBe(0);

    // There should be a delete log mentioning delete(Object#...)
    expect(await ui.getLogText()).toMatch(/delete\(Object#/);

    // No uncaught page errors expected
    expect(pageErrors.length).toBe(0);
    // We should have seen at least one dialog event (creation logs did append)
    expect(dialogs.length).toBeGreaterThan(0);
  });

  test('Demo collisions: triggers demo flow and logs relevant message', async ({ page }) => {
    await page.goto(APP_URL);
    const ui = new HashMapPage(page);

    await ui.demoCollide.click();
    // demoCollide calls render and inserts many keys; wait for it to complete
    await page.waitForTimeout(100);

    const log = await ui.getLogText();
    expect(log).toContain('Demo collisions: resized to capacity 4 and inserting keys that often collide.');

    const meta = await ui.getMeta();
    // after lots of inserts, size should be positive
    expect(meta.size).toBeGreaterThan(0);

    // buckets DOM should reflect some non-empty buckets
    const nonEmptyCount = await page.locator('#buckets .bucket .entry').count();
    expect(nonEmptyCount).toBeGreaterThan(0);
  });

  test('Demo resize: inserts many entries and increases capacity and rehash count', async ({ page }) => {
    await page.goto(APP_URL);
    const ui = new HashMapPage(page);

    await ui.demoResize.click();
    await page.waitForTimeout(200); // allow time for 30 inserts & rehashing

    const log = await ui.getLogText();
    expect(log).toContain('Demo resize: start with capacity 4 and insert many entries to trigger grow.');
    expect(log).toContain('Inserted 30 entries; map should have resized multiple times.');

    const meta = await ui.getMeta();
    expect(meta.size).toBeGreaterThanOrEqual(30);
    expect(meta.capacity).toBeGreaterThanOrEqual(8); // should have grown from 4
    expect(meta.rehashes).toBeGreaterThanOrEqual(1);
  });

  test('Random inserts demo: creates objects, inserts varied entries and updates summaries', async ({ page }) => {
    await page.goto(APP_URL);
    const ui = new HashMapPage(page);

    await ui.demoRandom.click();
    await page.waitForTimeout(200);

    const log = await ui.getLogText();
    expect(log).toContain('Random demo: inserting 12 random entries (mix of numbers/strings/objects).');

    const meta = await ui.getMeta();
    // Since 12 entries are inserted, size should be >= 12
    expect(meta.size).toBeGreaterThanOrEqual(12);

    // object list should have at least 4 new objects created by demoRandom
    await expect(ui.objCount).toContainText('objects available');
    const objCountText = await ui.objCount.textContent();
    const numObjs = Number((objCountText || '').split(' ')[0]);
    expect(numObjs).toBeGreaterThanOrEqual(4);

    // keys and values summaries should show something other than em dash
    const keysSummary = (await ui.keysSummary.textContent()) || '';
    expect(keysSummary.trim()).not.toBe('—');
    const valuesSummary = (await ui.valuesSummary.textContent()) || '';
    expect(valuesSummary.trim()).not.toBe('—');
  });

  test('Edge case: invalid object index triggers readKeyInput error (uncaught) and alert', async ({ page }) => {
    // This test intentionally triggers the error path in readKeyInput for object keys:
    // When keyType is 'object' but keyInput contains invalid index, readKeyInput alerts and throws Error('invalid object index').
    const pageErrors = [];
    const dialogs = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // accept alert so the handler continues
      await dialog.accept();
    });

    await page.goto(APP_URL);
    const ui = new HashMapPage(page);

    // Ensure no objects exist
    const objCountText = await ui.objCount.textContent();
    const initialNum = Number((objCountText || '').split(' ')[0]);
    if (initialNum > 0) {
      // If demo created objects earlier (stateful server), attempt to clear them by clicking clear() for safety
      // But per instructions we must not modify page scripts; we can override by selecting an invalid index deliberately
    }

    // Set keyType to object and set a deliberately invalid index
    await ui.keyType.selectOption('object');
    await ui.page.waitForTimeout(10);
    await ui.keyInput.fill('99999');

    // Click put - this will call readKeyInput which will alert and throw. We listen for dialog & pageerror.
    await ui.putBtn.click();

    // Wait a bit for dialog & pageerror to be emitted
    await page.waitForTimeout(50);

    // We expect an alert to have been shown indicating an invalid object index
    // The alert text in readKeyInput is 'Invalid object index. Create objects and choose one.'
    const alertDialogs = dialogs.filter(d => d.type === 'alert' || d.type === 'beforeunload' || d.type === 'confirm');
    expect(alertDialogs.length).toBeGreaterThanOrEqual(1);
    const foundAlert = alertDialogs.find(d => d.message.includes('Invalid object index'));
    expect(foundAlert).toBeTruthy();

    // We also expect a thrown error to be reported to pageerror with message 'invalid object index'
    // Note: browsers may report full error messages; check that at least one pageError contains that substring.
    const matchingErrors = pageErrors.filter(err => String(err).toLowerCase().includes('invalid object index'));
    expect(matchingErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Numeric key type behaves as expected (put/get/delete)', async ({ page }) => {
    await page.goto(APP_URL);
    const ui = new HashMapPage(page);

    // Use numeric key
    await ui.keyType.selectOption('number');
    await ui.page.waitForTimeout(10);
    await ui.keyInput.fill('42');
    await ui.valueInput.fill('answer');

    await ui.putBtn.click();
    await page.waitForTimeout(30);

    // size increased
    const meta = await ui.getMeta();
    expect(meta.size).toBeGreaterThanOrEqual(1);

    // get should return "answer" (log contains JSON-stringified "answer")
    await ui.getBtn.click();
    await page.waitForTimeout(20);
    expect(await ui.getLogText()).toMatch(/get\(42\) => "answer"/);

    // delete by clicking delete button
    await ui.deleteBtn.click();
    await page.waitForTimeout(20);
    expect(await ui.getLogText()).toMatch(/delete\(42\) => true/);

    // ensure map is empty
    const metaAfter = await ui.getMeta();
    expect(metaAfter.size).toBe(0);
  });
});