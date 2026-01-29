import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d4d850-fa73-11f0-83e0-8d7be1d51901.html';

// Page object to encapsulate common interactions and queries
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      statusMsg: page.locator('#statusMsg'),
      sizeDisplay: page.locator('#sizeDisplay'),
      loadDisplay: page.locator('#loadDisplay'),
      tableArea: page.locator('#tableArea'),
      buckets: page.locator('#tableArea .bucket'),
      insertBtn: page.locator('#insertBtn'),
      searchBtn: page.locator('#searchBtn'),
      deleteBtn: page.locator('#deleteBtn'),
      clearBtn: page.locator('#clearBtn'),
      randomFillBtn: page.locator('#randomFill'),
      strategySel: page.locator('#strategy'),
      tableSizeInput: page.locator('#tableSize'),
      hashFnSel: page.locator('#hashFn'),
      speedInput: page.locator('#speed'),
      speedValue: page.locator('#speedValue'),
      stepMode: page.locator('#stepMode'),
      keyInput: page.locator('#keyInput'),
      valueInput: page.locator('#valueInput'),
      log: page.locator('#log'),
      codeBlock: page.locator('#codeBlock'),
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getStatusText() {
    return (await this.locators.statusMsg.innerText()).trim();
  }

  async getStatusClass() {
    return await this.locators.statusMsg.getAttribute('class');
  }

  async bucketCount() {
    return await this.locators.buckets.count();
  }

  async fillKeyValue(key, value) {
    await this.locators.keyInput.fill(String(key));
    if (value !== undefined) await this.locators.valueInput.fill(String(value));
  }

  async clickInsert() {
    await this.locators.insertBtn.click();
  }

  async clickSearch() {
    await this.locators.searchBtn.click();
  }

  async clickDelete() {
    await this.locators.deleteBtn.click();
  }

  async clickRandomFill() {
    await this.locators.randomFillBtn.click();
  }

  async clickClear() {
    await this.locators.clearBtn.click();
  }

  async changeStrategy(value) {
    await this.locators.strategySel.selectOption(String(value));
  }

  async changeTableSize(value) {
    // set the input value and dispatch change
    await this.page.evaluate((v) => {
      const el = document.querySelector('#tableSize');
      el.value = String(v);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }

  async changeHashFn(value) {
    await this.locators.hashFnSel.selectOption(String(value));
  }

  async setSpeed(value) {
    await this.page.evaluate((v) => {
      const el1 = document.querySelector('#speed');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async getBucketText(index) {
    const bucket = this.page.locator('#tableArea .bucket').nth(index).locator('.content');
    return (await bucket.innerText()).trim();
  }

  async bucketHasNodeWithKey(index, key) {
    const bucket1 = this.page.locator('#tableArea .bucket1').nth(index);
    // look for .node .k containing key
    const nodes = bucket.locator('.node .k');
    const count = await nodes.count();
    for (let i = 0; i < count; i++) {
      const text = (await nodes.nth(i).innerText()).trim();
      if (text === String(key)) return true;
    }
    return false;
  }

  async anyBucketHasClass(className) {
    const count1 = await this.bucketCount();
    for (let i = 0; i < count; i++) {
      const cls = await this.page.locator('#tableArea .bucket').nth(i).getAttribute('class');
      if (cls && cls.split(/\s+/).includes(className)) return true;
    }
    return false;
  }

  async waitForLogContains(substr, timeout = 5000) {
    await this.page.waitForFunction(
      (s) => document.querySelector('#log') && document.querySelector('#log').innerText.includes(s),
      substr,
      { timeout }
    );
  }

  async getLatestLogText() {
    return await this.locators.log.innerText();
  }

  async waitForStatusText(expected, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, text) => document.querySelector(sel) && document.querySelector(sel).innerText.trim().includes(text),
      '#statusMsg',
      expected,
      { timeout }
    );
  }
}

// Keep track of console and page errors for each test run
test.describe.configure({ mode: 'serial' });

test.describe('Hash Table Visualizer - FSM and UI integration tests', () => {
  let page;
  let app;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    app = new HashTablePage(page);
    consoleMessages = [];
    pageErrors = [];

    // collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // collect uncaught page errors
    page.on('pageerror', (err) => {
      // err is an Error object in Node context
      pageErrors.push(err);
    });

    await app.goto();
    // ensure initial log line appears
    await app.waitForLogContains('Demo started.', 3000);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial state S0_Ready renders table and displays Ready status', async () => {
    // Validate initial Ready state evidence: renderTable() and status message
    expect(await app.getStatusText()).toBe('Ready');
    const cls1 = await app.getStatusClass();
    // code sets className = 'status ok' on load; verify presence of 'ok'
    expect(cls).toContain('ok');

    // table size display should match initial input value (10)
    expect(await app.locators.sizeDisplay.innerText()).toBe('10');

    // bucket count should equal sizeDisplay
    const bucketCount = await app.bucketCount();
    expect(bucketCount).toBe(10);

    // loadDisplay should be 0.00 initially
    expect(await app.locators.loadDisplay.innerText()).toBe('0.00');

    // codeBlock should include class HashTable snippet
    const codeText = await app.locators.codeBlock.innerText();
    expect(codeText).toContain('class HashTable');

    // verify no uncaught page errors during initial render
    expect(pageErrors.length).toBe(0);
    // ensure console had demo started message
    const foundDemoLog = consoleMessages.some(m => /Demo started\./i.test(m.text));
    expect(foundDemoLog).toBe(true);
  });

  test('Insert transition: S0_Ready -> S1_Busy -> S0_Ready with visual and log updates', async () => {
    // Insert a key/value and assert Busy status appears then returns to Ready and the item is in table
    await app.fillKeyValue('apple', 'red');
    // ensure no dialog will interrupt insert
    const dialogs = [];
    page.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });

    // click insert and immediately assert busy state is set
    const insertPromise = app.clickInsert();
    // after clicking, status should change quickly to 'Inserting...'
    await app.waitForStatusText('Inserting...', 1000);
    expect(await app.getStatusText()).toContain('Inserting...');

    // wait for operation to finish: status returns to Ready
    await app.waitForStatusText('Ready', 5000);
    expect(await app.getStatusText()).toBe('Ready');

    // Log should contain the inserted message
    await app.waitForLogContains('Inserted key="apple"', 2000);
    const logText = await app.getLatestLogText();
    expect(logText).toContain('Inserted key="apple"');

    // One of the buckets should contain the inserted key (node with .k text)
    const bucketCount1 = await app.bucketCount1();
    let found = false;
    for (let i = 0; i < bucketCount; i++) {
      if (await app.bucketHasNodeWithKey(i, 'apple')) { found = true; break; }
    }
    expect(found).toBe(true);

    // ensure no uncaught page errors during insert
    expect(pageErrors.length).toBe(0);
  });

  test('Search transition: S0_Ready -> S1_Busy -> S0_Ready finds existing and not-found cases', async () => {
    // Prepare by inserting a known key
    await app.fillKeyValue('banana', 'yellow');
    // dismiss any alerts if shown
    page.once('dialog', d => d.dismiss().catch(() => {}));
    await app.clickInsert();
    await app.waitForStatusText('Ready', 5000);

    // Search for existing key
    await app.fillKeyValue('banana');
    const searchBtnClick = app.clickSearch();
    await app.waitForStatusText('Searching...', 1000);
    // After operation completes status goes back to Ready
    await app.waitForStatusText('Ready', 5000);
    // Log should indicate found
    await app.waitForLogContains('Found key="banana"', 2000);
    const foundReported = (await app.getLatestLogText()).includes('Found key="banana"');
    expect(foundReported).toBe(true);

    // UI should highlight found bucket with 'found' class on at least one bucket
    const anyFound = await app.anyBucketHasClass('found');
    expect(anyFound).toBe(true);

    // Search for non-existent key demonstrates visited highlighting and log message
    await app.fillKeyValue('no-such-key');
    await app.clickSearch();
    await app.waitForStatusText('Ready', 5000);
    await app.waitForLogContains('Key="no-such-key" not found.', 2000);
    const notFoundReported = (await app.getLatestLogText()).includes('Key="no-such-key" not found.');
    expect(notFoundReported).toBe(true);

    expect(pageErrors.length).toBe(0);
  });

  test('Delete transition: S0_Ready -> S1_Busy -> S0_Ready deletes existing key and creates tombstone for open strategy', async () => {
    // Ensure chaining strategy first and insert a key to delete
    await app.changeStrategy('chaining');
    await app.fillKeyValue('delta', '4');
    page.once('dialog', d => d.dismiss().catch(() => {}));
    await app.clickInsert();
    await app.waitForStatusText('Ready', 5000);

    // Delete the key
    await app.fillKeyValue('delta');
    await app.clickDelete();
    // Busy state check
    await app.waitForStatusText('Deleting...', 1000);
    await app.waitForStatusText('Ready', 5000);
    // Log should indicate deletion (or not found)
    await app.waitForLogContains('Deleted key="delta"', 2000);

    // Ensure in chaining strategy the node is removed from its bucket
    let stillPresent = false;
    const bucketCount2 = await app.bucketCount2();
    for (let i = 0; i < bucketCount; i++) {
      if (await app.bucketHasNodeWithKey(i, 'delta')) { stillPresent = true; break; }
    }
    expect(stillPresent).toBe(false);

    // Now switch to open addressing and test tombstone appearance after delete
    await app.changeStrategy('open');
    // insert a key
    await app.fillKeyValue('epsilon', '5');
    page.once('dialog', d => d.dismiss().catch(() => {}));
    await app.clickInsert();
    await app.waitForStatusText('Ready', 5000);

    // delete it and verify tombstone appears (content contains TOMB or "(deleted)")
    await app.fillKeyValue('epsilon');
    await app.clickDelete();
    await app.waitForStatusText('Ready', 5000);
    // At least one bucket content should include 'TOMB' or '(deleted)'
    const bucketTotal = await app.bucketCount();
    let tombFound = false;
    for (let i = 0; i < bucketTotal; i++) {
      const txt = await app.getBucketText(i);
      if (txt.includes('TOMB') || txt.includes('(deleted)')) { tombFound = true; break; }
    }
    expect(tombFound).toBe(true);

    expect(pageErrors.length).toBe(0);
  });

  test('Clear and RandomFill transitions: confirm/accept clear prompt and random fill adds many entries', async () => {
    // Random fill: click and ensure busy toggles and log updated
    // Set speed to small to speed test
    await app.setSpeed(120);
    const initialBucketCount = await app.bucketCount();
    await app.clickRandomFill();
    // Immediately Busy true due to setBusy call
    // setBusy(true,'Filling randomly...') executed; check quickly
    await app.waitForStatusText('Filling randomly...', 1000);
    // After random fill completes status returns to Ready
    await app.waitForStatusText('Ready', 5000);
    // Log contains Random fill
    await app.waitForLogContains('Random fill: added', 2000);
    expect((await app.getLatestLogText()).includes('Random fill: added')).toBe(true);

    // Now Clear: intercept confirm and accept it
    let dialogMessage = null;
    page.once('dialog', async d => {
      dialogMessage = d.message();
      await d.accept();
    });

    await app.clickClear();
    // Confirm that dialog popped with expected message fragment
    expect(dialogMessage).toContain('Clear entire table?');

    // After clear, status remains Ready and log notes cleared
    await app.waitForStatusText('Ready', 2000);
    await app.waitForLogContains('Cleared table.', 2000);
    expect((await app.getLatestLogText()).includes('Cleared table.')).toBe(true);

    // After clearing, all buckets should show '- empty -' (or similar)
    const bucketTotal1 = await app.bucketCount();
    for (let i = 0; i < bucketTotal; i++) {
      const txt1 = await app.getBucketText(i);
      expect(txt.toLowerCase()).toContain('empty');
    }

    expect(pageErrors.length).toBe(0);
  });

  test('Change settings: strategy, table size, hash function and speed update UI and code snippet', async () => {
    // Change strategy to open and validate codeblock updated and log entry
    await app.changeStrategy('open');
    await app.waitForLogContains('Strategy changed to open', 2000);
    expect((await app.getLatestLogText()).includes('Strategy changed to open')).toBe(true);

    // Change table size to an allowed value and validate table re-renders with new bucket count
    await app.changeTableSize(5);
    // wait for sizeDisplay update
    await page.waitForFunction(() => document.querySelector('#sizeDisplay').innerText === '5');
    expect(await app.locators.sizeDisplay.innerText()).toBe('5');
    expect(await app.bucketCount()).toBe(5);
    await app.waitForLogContains('Table resized to 5', 2000);

    // Changing hash function should update code snippet and log
    await app.changeHashFn('djb2');
    await app.waitForLogContains('Hash function changed to djb2', 2000);
    expect((await app.getLatestLogText()).includes('Hash function changed to djb2')).toBe(true);
    const codeText1 = await app.locators.codeBlock.innerText();
    expect(codeText).toContain('hashFn =');

    // Change speed and validate speedValue textual update
    await app.setSpeed(150);
    await page.waitForFunction(() => document.querySelector('#speedValue').innerText.includes('150 ms'));
    expect(await app.locators.speedValue.innerText()).toContain('150 ms');

    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases and error scenarios: empty key alerts and invalid table size handling', async () => {
    // Attempt to insert with empty key -> should trigger alert
    let alertMsg = null;
    page.once('dialog', async d => {
      alertMsg = d.message();
      await d.dismiss();
    });
    // ensure key input empty
    await app.fillKeyValue('', 'val');
    await app.clickInsert();
    // confirm alert occurred
    expect(alertMsg).toContain('Please enter a key to insert.');

    // Attempt to search with empty key
    alertMsg = null;
    page.once('dialog', async d => {
      alertMsg = d.message();
      await d.dismiss();
    });
    await app.fillKeyValue('');
    await app.clickSearch();
    expect(alertMsg).toContain('Please enter a key to search.');

    // Attempt to delete with empty key
    alertMsg = null;
    page.once('dialog', async d => {
      alertMsg = d.message();
      await d.dismiss();
    });
    await app.fillKeyValue('');
    await app.clickDelete();
    expect(alertMsg).toContain('Please enter a key to delete.');

    // Setting invalid table size (<3) should cause alert and revert input
    let invalidMsg = null;
    page.once('dialog', async d => {
      invalidMsg = d.message();
      await d.dismiss();
    });
    // set to 2 which is invalid
    await app.changeTableSize(2);
    // handler sets tableSizeInput.value back to ht.size; confirm alert message and that displayed size didn't become 2
    expect(invalidMsg).toContain('Size must be between 3 and 60.');

    const displayedSize = await app.locators.sizeDisplay.innerText();
    // displayed size should remain >=3 (initial was 5 from previous test if tests serial; but safe check >=3)
    expect(parseInt(displayedSize, 10)).toBeGreaterThanOrEqual(3);

    expect(pageErrors.length).toBe(0);
  });

  test('Console and runtime errors observation - ensure no unexpected ReferenceError/SyntaxError/TypeError during normal use', async () => {
    // Perform a few interactions to generate normal console logs
    await app.fillKeyValue('foo', 'bar');
    page.once('dialog', d => d.dismiss().catch(() => {}));
    await app.clickInsert();
    await app.waitForStatusText('Ready', 5000);
    await app.fillKeyValue('foo');
    await app.clickSearch();
    await app.waitForStatusText('Ready', 5000);

    // Inspect captured page errors and console messages
    // We assert that there were no uncaught page errors (ReferenceError/SyntaxError/TypeError) during normal usage.
    expect(pageErrors.length).toBe(0);

    // Confirm console contains likely informative messages like 'Demo started.' and 'Inserted key="foo"'
    const hasDemo = consoleMessages.some(m => /Demo started/i.test(m.text));
    const hasInsertLog = (await app.getLatestLogText()).includes('Inserted key="foo"');
    expect(hasDemo).toBe(true);
    expect(hasInsertLog).toBe(true);
  });
});