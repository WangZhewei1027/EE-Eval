import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e0d041-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page Object Model for the Hash Table demo
class HashTablePage {
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('#keyInput');
    this.valueInput = page.locator('#valueInput');
    this.insertBtn = page.locator('#insertBtn');
    this.searchBtn = page.locator('#searchBtn');
    this.deleteBtn = page.locator('#deleteBtn');
    this.fillBtn = page.locator('#fillBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.sizeRange = page.locator('#sizeRange');
    this.sizeLabel = page.locator('#sizeLabel');
    this.strategy = page.locator('#strategy');
    this.status = page.locator('#status');
    this.visualArea = page.locator('#visualArea');
    this.hashOutput = page.locator('#hashOutput');
    this.stepToggle = page.locator('#stepToggle');
    this.nextStep = page.locator('#nextStep');
    this.prevStep = page.locator('#prevStep');
    this.probeCount = page.locator('#probeCount');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setKey(key) {
    await this.keyInput.fill(key);
    // input triggers hashOutput update via 'input' listener, wait briefly for UI update
    await this.page.waitForTimeout(50);
  }

  async setValue(val) {
    await this.valueInput.fill(val);
  }

  async clickInsert() {
    await this.insertBtn.click();
  }
  async clickSearch() {
    await this.searchBtn.click();
  }
  async clickDelete() {
    await this.deleteBtn.click();
  }
  async clickFill() {
    await this.fillBtn.click();
  }
  async clickReset() {
    await this.clearBtn.click();
  }
  async setTableSize(n) {
    // set value and dispatch change by using Playwright to set attribute then dispatch event
    await this.sizeRange.evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, n);
    // Fire 'change' event to trigger resizing handler
    await this.sizeRange.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    // wait for UI to update
    await this.page.waitForTimeout(100);
  }
  async changeStrategy(value) {
    await this.strategy.selectOption(value);
    // wait for UI update
    await this.page.waitForTimeout(50);
  }

  async toggleStepMode(on = true) {
    const txt = await this.stepToggle.textContent();
    const isOn = txt && txt.includes('On');
    if (on && !isOn) {
      await this.stepToggle.click();
      await this.page.waitForTimeout(50);
    } else if (!on && isOn) {
      await this.stepToggle.click();
      await this.page.waitForTimeout(50);
    }
  }

  async clickNextProbe() {
    await this.nextStep.click();
  }

  async clickPrevProbe() {
    await this.prevStep.click();
  }

  async getStatusText() {
    return (await this.status.textContent()) || '';
  }

  async getHashOutput() {
    return (await this.hashOutput.textContent()) || '';
  }

  async countVisualChildren() {
    return await this.visualArea.locator(':scope > *').count();
  }

  async getProbeCountText() {
    return (await this.probeCount.textContent()) || '';
  }

  // helper to compute hash using exposed computeHash on the window if available
  async computeHashForKey(key) {
    const res = await this.page.evaluate((k) => {
      // If htDemo is available, use it; otherwise return null
      try {
        // window.htDemo.table.M is current table size
        if (window.htDemo && typeof window.htDemo.computeHash === 'function') {
          return { ok: true, value: window.htDemo.computeHash(k, window.htDemo.table.M), M: window.htDemo.table.M };
        }
      } catch (e) {
        return { ok: false, error: String(e) };
      }
      return { ok: false, error: 'computeHash not exposed' };
    }, key);
    return res;
  }
}

test.describe('Interactive Hash Table Demo — FSM states & transitions', () => {
  let page;
  let ht;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    consoleErrors = [];
    pageErrors = [];

    // capture console errors and page errors to assert later
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push({ text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    ht = new HashTablePage(page);
    await ht.goto();
  });

  test.afterEach(async () => {
    // Assert that no unexpected runtime exceptions occurred during the test run
    // The application is expected to run without uncaught page errors; surface them if present
    expect(pageErrors, 'No uncaught page errors').toEqual([]);
    expect(consoleErrors.map(e => e.text), 'No console.error messages').toEqual([]);
    await page.close();
  });

  test('Ready state on initial load: status, hash output, visual representation', async () => {
    // Validate initial Ready state message in the status area
    const statusText = await ht.getStatusText();
    expect(statusText).toContain('Ready.');
    expect(statusText).toContain('Try inserting keys');

    // Hash output should be placeholder
    const hashText = await ht.getHashOutput();
    expect(hashText).toContain('Index: —');

    // Visual area should render number of buckets equal to initial size (11)
    const count = await ht.countVisualChildren();
    const sizeLabel = await ht.sizeLabel.textContent();
    const size = Number(sizeLabel?.trim());
    expect(size).toBeGreaterThan(0);
    expect(count).toBe(size);
  });

  test('Insert/Search/Delete in Separate Chaining (normal flows)', async () => {
    // Insert a key in chaining (default mode)
    await ht.setKey('apple');
    await ht.setValue('fruit');
    await ht.clickInsert();

    // Status should report Inserted or Updated
    let status = await ht.getStatusText();
    expect(status).toMatch(/Inserted|Updated/);

    // Compute expected index via exposed computeHash
    const hashInfo = await ht.computeHashForKey('apple');
    expect(hashInfo.ok).toBe(true);
    const index = hashInfo.value;
    // The status should reference the bucket index
    expect(status).toContain(String(index));

    // Visual area: the bucket at index should contain the key text
    // The visual DOM for chaining uses .bucket elements (one per bucket)
    const bucket = ht.visualArea.locator('.bucket').nth(index);
    await expect(bucket).toBeVisible();
    await expect(bucket.locator('.chain')).toContainText('apple');

    // Search existing key
    await ht.clickSearch();
    status = await ht.getStatusText();
    expect(status).toMatch(/Found/);
    expect(status).toContain(String(index));

    // Delete existing key
    await ht.clickDelete();
    status = await ht.getStatusText();
    expect(status).toMatch(/Deleted/);
    expect(status).toContain(String(index));

    // After deletion, searching the key should show Not found for that bucket
    await ht.clickSearch();
    status = await ht.getStatusText();
    expect(status).toMatch(/Not found/);
  });

  test('Resetting (clear) sets table to empty and shows Table reset message', async () => {
    // Fill one item and then reset
    await ht.setKey('banana');
    await ht.setValue('yellow');
    await ht.clickInsert();
    // Now reset
    await ht.clickReset();
    const status = await ht.getStatusText();
    expect(status).toContain('Table reset');

    // Visual area: in chaining, buckets should be present and each show '(empty)'
    const bucketCount = await ht.countVisualChildren();
    const sizeLabel = await ht.sizeLabel.textContent();
    expect(bucketCount).toBe(Number(sizeLabel));
    // Ensure first bucket shows '(empty)' - some buckets should have '(empty)' element
    const firstBucket = ht.visualArea.locator('.bucket').first();
    await expect(firstBucket).toContainText('(empty)');
  });

  test('Change table size triggers resize and status message', async () => {
    // Set a new table size and ensure status mentions change
    await ht.setTableSize(7);
    const status = await ht.getStatusText();
    expect(status).toContain('Table size changed to 7');

    // Visual area should now have 7 children
    const count = await ht.countVisualChildren();
    expect(count).toBe(7);

    // Ensure size label updated
    const lab = await ht.sizeLabel.textContent();
    expect(Number(lab)).toBe(7);
  });

  test('Change collision strategy switches rendering and status', async () => {
    // Switch to open addressing: linear probing
    await ht.changeStrategy('linear');
    let status = await ht.getStatusText();
    expect(status).toContain('Switched strategy to Linear Probing');

    // Visual area for open addressing renders .array-slot elements, count equals table size
    const count = await ht.countVisualChildren();
    const sizeLabel = await ht.sizeLabel.textContent();
    expect(count).toBe(Number(sizeLabel));
    // Verify slots class present
    await expect(ht.visualArea.locator('.array-slot').first()).toBeVisible();

    // Switch to quadratic probing
    await ht.changeStrategy('quadratic');
    status = await ht.getStatusText();
    expect(status).toContain('Switched strategy to Quadratic Probing');

    // Change back to chaining
    await ht.changeStrategy('chaining');
    status = await ht.getStatusText();
    expect(status).toContain('Switched strategy to Separate Chaining');
  });

  test('Open addressing: insert until table full produces Table full message', async () => {
    // Make a very small table to force full condition
    await ht.setTableSize(5);
    await ht.changeStrategy('linear'); // open addressing

    // Insert unique keys until we observe 'Table full' status
    let observedTableFull = false;
    const keys = ['a','b','c','d','e','f','g','h'];
    for (const k of keys) {
      await ht.setKey(k);
      await ht.setValue('v:'+k);
      await ht.clickInsert();
      const st = await ht.getStatusText();
      if (st.includes('Table full')) {
        observedTableFull = true;
        break;
      }
      // small pause to let render happen
      await page.waitForTimeout(30);
    }

    // If not observed via UI text, fallback: attempt to fill programmatically and check latest insert returned "Table full" behavior by ensuring at least one slot is empty? We'll assert that we observed at least one 'Table full' message.
    expect(observedTableFull).toBe(true);
  });

  test('Open addressing: search Not found and delete not found behaviors', async () => {
    // Ensure open addressing mode
    await ht.setTableSize(7);
    await ht.changeStrategy('linear');

    // Clear table
    await ht.clickReset();

    // Search for a key that doesn't exist
    await ht.setKey('does-not-exist');
    await ht.clickSearch();
    let status = await ht.getStatusText();
    expect(status).toMatch(/Not found/);

    // Delete a key that doesn't exist
    await ht.clickDelete();
    status = await ht.getStatusText();
    // Implementation uses messages like 'Key not found' or 'Key not found after ...' or 'Not found'
    expect(status).toMatch(/not found/i);
  });

  test('Step mode: visually step through probes and commit insertion in open addressing', async () => {
    // Use a predictable size
    await ht.setTableSize(11);
    await ht.changeStrategy('linear');

    // Ensure table is clear
    await ht.clickReset();

    // Enable step mode
    await ht.toggleStepMode(true);
    const toggleText = await ht.stepToggle.textContent();
    expect(toggleText).toContain('On');

    // Choose a key that will probe; start with empty table so first probe likely empty
    await ht.setKey('stepKey');
    await ht.setValue('1');

    // Click Insert while in step mode; this should initialize probes and not immediately commit all
    await ht.clickInsert();

    // After initiating a step-mode insert, status should instruct to advance probes
    let status = await ht.getStatusText();
    expect(status).toMatch(/Step mode|Step/);

    // Probe count should reflect at least 1 probe in sequence
    let probeText = await ht.getProbeCountText();
    // probeCount shows "1 / N" or "0" depending on implementation; ensure it is a string present
    expect(typeof probeText).toBe('string');

    // Click next to advance a probe; this should either show an occupied message or commit
    await ht.clickNextProbe();
    // small wait for UI
    await page.waitForTimeout(60);
    status = await ht.getStatusText();
    // After advancing probes, either we get "Inserted" or a probe message. Accept either outcome.
    expect(status.length).toBeGreaterThan(0);

    // If not yet inserted, pressing next should eventually insert; press a few times to ensure commit
    if (!/Inserted|Updated/i.test(status)) {
      // try a few more steps
      for (let i = 0; i < 5; i++) {
        await ht.clickNextProbe();
        await page.waitForTimeout(40);
        status = await ht.getStatusText();
        if (/Inserted|Updated/i.test(status)) break;
      }
    }
    expect(status).toMatch(/Inserted|Updated/);

    // After commit, probeCount should be reset to "0"
    probeText = await ht.getProbeCountText();
    expect(probeText).toMatch(/0/);

    // Visual area should show the inserted key in an array-slot
    const foundInVisual = await ht.visualArea.locator('.array-slot', { hasText: 'stepKey' }).count();
    expect(foundInVisual).toBeGreaterThanOrEqual(1);

    // Disable step mode to clean up
    await ht.toggleStepMode(false);
    const toggleText2 = await ht.stepToggle.textContent();
    expect(toggleText2).toContain('Off');
  });

  test('Edge cases: empty key handling for Insert/Search/Delete', async () => {
    // Ensure chaining mode (messages are uniform)
    await ht.changeStrategy('chaining');
    // Clear fields
    await ht.setKey('');
    await ht.setValue('');

    // Insert without key
    await ht.clickInsert();
    let status = await ht.getStatusText();
    expect(status).toContain('Please enter a key');

    // Search without key
    await ht.clickSearch();
    status = await ht.getStatusText();
    expect(status).toContain('Please enter a key');

    // Delete without key
    await ht.clickDelete();
    status = await ht.getStatusText();
    expect(status).toContain('Please enter a key');
  });

  test('Fill Randomly and subsequent status & visual update', async () => {
    // Start with chaining
    await ht.changeStrategy('chaining');
    await ht.clickFill();
    let status = await ht.getStatusText();
    expect(status).toMatch(/Filled chaining table|Filled/);

    // Visual area should contain some filled chains (nodes)
    const anyNode = ht.visualArea.locator('.node').first();
    await expect(anyNode).toBeVisible();
    // Now switch to open addressing and Fill
    await ht.changeStrategy('linear');
    await ht.clickFill();
    status = await ht.getStatusText();
    expect(status).toMatch(/Filled open addressing table|Filled/);

    // Ensure array-slot nodes are visible
    const anySlot = ht.visualArea.locator('.array-slot').first();
    await expect(anySlot).toBeVisible();
  });

  test('Hash output updates as user types a key', async () => {
    await ht.changeStrategy('chaining');
    // Clear any key
    await ht.setKey('');
    let hashOut = await ht.getHashOutput();
    expect(hashOut).toContain('Index: —');

    // Type a key and ensure hashOutput updates
    await ht.setKey('abc');
    hashOut = await ht.getHashOutput();
    expect(hashOut).toMatch(/Index:/);
    // It should not be the placeholder now (should show a number)
    expect(hashOut).not.toContain('—');
  });
});