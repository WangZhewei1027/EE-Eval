import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e14572-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page object to encapsulate interactions and queries
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // controls
    this.valInput = page.locator('#valInput');
    this.insertBtn = page.locator('#insertBtn');
    this.extractBtn = page.locator('#extractBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.listInput = page.locator('#listInput');
    this.buildBtn = page.locator('#buildBtn');
    this.randBtn = page.locator('#randBtn');
    this.randCount = page.locator('#randCount');
    this.speed = page.locator('#speed');
    // status / visuals
    this.sizeEl = page.locator('#size');
    this.arrayView = page.locator('#arrayView');
    this.logEl = page.locator('#log');
    this.lastActionEl = page.locator('#lastAction');
    this.svg = page.locator('#svg');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setSpeed(ms) {
    // set the speed range input value to ms (string)
    await this.speed.fill(String(ms));
    // trigger input event to update UI text
    await this.page.evaluate((v) => {
      const el = document.getElementById('speed');
      el.value = v;
      el.dispatchEvent(new Event('input'));
    }, String(ms));
  }

  async insert(valuesText) {
    await this.valInput.fill(valuesText);
    await this.insertBtn.click();
  }

  async extract() {
    await this.extractBtn.click();
  }

  async peek() {
    await this.peekBtn.click();
  }

  async clear() {
    await this.clearBtn.click();
  }

  async heapify(listText) {
    await this.listInput.fill(listText);
    await this.buildBtn.click();
  }

  async generateRandom(count) {
    await this.randCount.fill(String(count));
    await this.randBtn.click();
  }

  async changeHeapType(kind) {
    // kind: 'min' or 'max'
    await this.page.locator(`input[name="type"][value="${kind}"]`).check();
  }

  async getSize() {
    return Number((await this.sizeEl.textContent()) || '0');
  }

  async getLogText() {
    return (await this.logEl.textContent())?.trim();
  }

  async getLastActionText() {
    return (await this.lastActionEl.textContent())?.trim();
  }

  async getArrayItemsText() {
    // returns array of strings or a single muted message for empty
    const children = await this.arrayView.locator(':scope > *').all();
    const texts = [];
    for (const c of children) {
      texts.push((await c.textContent()).trim());
    }
    return texts;
  }

  async getHighlightedArrayIndices() {
    const items = this.arrayView.locator('.item');
    const count = await items.count();
    const res = [];
    for (let i = 0; i < count; i++) {
      const hasClass = await items.nth(i).evaluate((el) => el.classList.contains('highlight'));
      if (hasClass) res.push(i);
    }
    return res;
  }
}

test.describe('Heap Visualizer — FSM transitions and UI behaviors', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // capture page errors and console for assertions later
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      // collect console messages (type & text)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async () => {
    // After each test ensure there were no uncaught page errors
    // This asserts the runtime did not throw unexpected errors during interactions
    expect(pageErrors, 'page should not emit uncaught exceptions').toEqual([]);
  });

  test('Initial Idle state: renders and logs Ready message', async ({ page }) => {
    // Validate S0_Idle entry actions and evidence:
    // - renderAll() was called on init (we check DOM rendered state)
    // - log contains "Ready. Insert values or heapify a list to begin."
    const hp = new HeapPage(page);
    await hp.goto();

    // wait for the ready log to appear
    await expect(hp.logEl).toHaveText(/Ready\.?/);

    // check size is 0
    await expect(hp.sizeEl).toHaveText('0');

    // array view should show the muted "Heap is empty" message
    const items = await hp.getArrayItemsText();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toMatch(/Heap is empty/);

    // no page errors and no fatal console errors
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Insert, Peek, Extract, and Clear - non-empty flows', () => {
    test('Insert multiple values and verify array, svg and size update', async ({ page }) => {
      // This validates transitions:
      // - S1_Heap_Empty -> S2_Heap_NonEmpty via Insert
      // - render changes (size, arrayView, svg nodes)
      const hp = new HeapPage(page);
      await hp.goto();
      // speed down animation to minimum to make tests fast
      await hp.setSpeed(50);

      // Insert three values
      await hp.insert('5,3,8');

      // Wait until size updates to 3 (heap operations animate asynchronously)
      await page.waitForFunction(() => document.getElementById('size').textContent === '3', null, { timeout: 5000 });

      // Verify array view shows numeric items
      const arrTexts = await hp.getArrayItemsText();
      expect(arrTexts.length).toBe(3);
      // ensure each item is a number string
      for (const t of arrTexts) {
        expect(t).toMatch(/^-?\d+$/);
      }

      // svg should contain node groups matching 3 nodes
      const svgNodeCount = await page.locator('#svg g').count();
      expect(svgNodeCount).toBeGreaterThanOrEqual(3);

      // lastAction should reflect insert operation (action label present)
      const lastAction = await hp.getLastActionText();
      expect(lastAction.toLowerCase()).toContain('insert');

      // no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Peek root shows root in log and highlights index 0', async ({ page }) => {
      // Validates PeekRoot event and S2_Heap_NonEmpty -> S2_Heap_NonEmpty transition
      const hp = new HeapPage(page);
      await hp.goto();
      await hp.setSpeed(50);

      // prefill heap
      await hp.insert('4,2,6');
      await page.waitForFunction(() => document.getElementById('size').textContent === '3', null, { timeout: 5000 });

      // click peek
      await hp.peek();

      // After peek, it should log the root and update lastAction
      await expect(hp.logEl).toHaveText(/Root:/);
      const last = await hp.getLastActionText();
      expect(last.toLowerCase()).toMatch(/peek/);

      // array index 0 should be highlighted briefly. We'll wait for the highlight to appear.
      // The highlight is applied and then cleared after ~520ms. So poll within 1s.
      await page.waitForFunction(() => {
        const el = document.querySelectorAll('#arrayView .item')[0];
        return el && el.classList.contains('highlight');
      }, null, { timeout: 1500 });

      // ensure heap remains size 3
      expect(await hp.getSize()).toBe(3);
    });

    test('Extract root reduces size and updates lastAction/log', async ({ page }) => {
      // Validates ExtractRoot event with both S2_Heap_NonEmpty->S2_Heap_NonEmpty (typical) and S2->S1 if empty
      const hp = new HeapPage(page);
      await hp.goto();
      await hp.setSpeed(50);

      // prepare heap with 3 elements
      await hp.insert('10,1,7');
      await page.waitForFunction(() => document.getElementById('size').textContent === '3', null, { timeout: 5000 });

      // click extract
      await hp.extract();

      // wait until size decrements to 2
      await page.waitForFunction(() => document.getElementById('size').textContent === '2', null, { timeout: 5000 });

      // Last action and log should indicate extraction or value
      const last = await hp.getLastActionText();
      expect(last.toLowerCase()).toMatch(/extract/);

      const logText = await hp.getLogText();
      // one of the animated logs includes 'Extract root' or 'Extract root →'
      expect(logText.toLowerCase()).toMatch(/extract|root/);

      // Ensure no page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Clear heap empties array view and logs Cleared heap.', async ({ page }) => {
      // Validates ClearHeap event and transition S2_Heap_NonEmpty -> S1_Heap_Empty
      const hp = new HeapPage(page);
      await hp.goto();
      await hp.setSpeed(50);

      await hp.insert('2,4');
      await page.waitForFunction(() => document.getElementById('size').textContent === '2', null, { timeout: 5000 });

      await hp.clear();

      // size should be 0, array view shows "Heap is empty"
      await expect(hp.sizeEl).toHaveText('0');
      const arr = await hp.getArrayItemsText();
      expect(arr[0]).toMatch(/Heap is empty/);

      const last = await hp.getLastActionText();
      expect(last.toLowerCase()).toContain('cleared');

      const logText = await hp.getLogText();
      expect(logText).toMatch(/Cleared heap/);
    });
  });

  test.describe('Heapify and Generate Random Heap flows', () => {
    test('Heapify from list input builds heap and updates visuals', async ({ page }) => {
      // Validates Heapify event and transition S0_Idle -> S2_Heap_NonEmpty
      const hp = new HeapPage(page);
      await hp.goto();
      await hp.setSpeed(50);

      await hp.heapify('9,4,7,1,3');

      // wait for size 5
      await page.waitForFunction(() => document.getElementById('size').textContent === '5', null, { timeout: 5000 });

      const size = await hp.getSize();
      expect(size).toBe(5);

      // lastAction should include Heapify (done) or similar
      const last = await hp.getLastActionText();
      expect(last.toLowerCase()).toContain('heapify');
    });

    test('Generate & Build creates random array of requested size and populates list input', async ({ page }) => {
      // Validates GenerateRandomHeap event and S0 -> S2 transition
      const hp = new HeapPage(page);
      await hp.goto();
      await hp.setSpeed(50);

      // request 5 random elements
      await hp.generateRandom(5);

      // listInput should be populated with 5 numbers (commas)
      await page.waitForFunction(() => {
        const el = document.getElementById('listInput');
        return el && el.value.split(',').filter(Boolean).length === 5;
      }, null, { timeout: 3000 });

      // size should update to 5 after heapify animation completes
      await page.waitForFunction(() => document.getElementById('size').textContent === '5', null, { timeout: 5000 });

      const size = await hp.getSize();
      expect(size).toBe(5);
    });
  });

  test.describe('Change heap type and edge cases', () => {
    test('ChangeHeapType toggles comparator and logs switch', async ({ page }) => {
      // Validates ChangeHeapType event that keeps data but changes comparator
      const hp = new HeapPage(page);
      await hp.goto();
      await hp.setSpeed(50);

      // insert some data then change type
      await hp.insert('3,1,4');
      await page.waitForFunction(() => document.getElementById('size').textContent === '3', null, { timeout: 5000 });

      // switch to max heap
      await hp.changeHeapType('max');

      // The app's log function prints "Switched to max-heap"
      // Wait for the log change
      await page.waitForFunction(() => document.getElementById('log').textContent.toLowerCase().includes('switched to max-heap'), null, { timeout: 2000 });

      const logText = await hp.getLogText();
      expect(logText.toLowerCase()).toContain('switched to max-heap');

      // switching heap kind triggers renderAll; size should remain intact
      expect(await hp.getSize()).toBe(3);
    });

    test('Insert with empty value shows prompt message (edge case)', async ({ page }) => {
      // Validates S0_Idle -> S1_Heap_Empty behavior when insert clicked with empty input
      const hp = new HeapPage(page);
      await hp.goto();

      // ensure valInput empty
      await hp.valInput.fill('');
      await hp.insert('');

      // log should guide the user
      await expect(hp.logEl).toHaveText(/Enter a value or comma-separated list to insert\./);
    });

    test('Insert with invalid numbers shows "No valid numbers found" message', async ({ page }) => {
      // Invalid input edge case
      const hp = new HeapPage(page);
      await hp.goto();

      await hp.insert('a,b, ,x');

      await expect(hp.logEl).toHaveText(/No valid numbers found in input\./);
      // size should remain 0
      expect(await hp.getSize()).toBe(0);
    });

    test('Heapify with empty list input logs the expected prompt', async ({ page }) => {
      // Edge case: build with empty list input
      const hp = new HeapPage(page);
      await hp.goto();

      // ensure listInput empty
      await hp.listInput.fill('');
      await hp.buildBtn.click();

      await expect(hp.logEl).toHaveText(/Enter a comma-separated list to heapify\./);
    });
  });

  test('Observe console messages and ensure no runtime errors during extended operations', async ({ page }) => {
    // This test performs a sequence of operations while collecting console events and page errors,
    // then asserts that the page did not throw unexpected runtime errors and that console messages are benign.
    const hp = new HeapPage(page);
    await hp.goto();

    // attach local collectors (these are in beforeEach but capture again for clarity)
    const localConsole = [];
    const localErrors = [];
    page.on('console', (m) => localConsole.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => localErrors.push(e));

    await hp.setSpeed(50);
    // Build a small heap and manipulate it
    await hp.heapify('12,8,15,3,7');
    await page.waitForFunction(() => document.getElementById('size').textContent === '5', null, { timeout: 5000 });
    await hp.peek();
    await hp.extract();
    await page.waitForFunction(() => Number(document.getElementById('size').textContent) < 5, null, { timeout: 5000 });
    await hp.clear();
    await page.waitForFunction(() => document.getElementById('size').textContent === '0', null, { timeout: 3000 });

    // small allowance for async logs / animations to settle
    await page.waitForTimeout(300);

    // validate there were no uncaught page errors
    expect(localErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // console messages (if any) should not include 'Error' type
    const errorsInConsole = localConsole.filter(c => c.type === 'error' || /error/i.test(c.text));
    expect(errorsInConsole.length).toBe(0);
  }, { timeout: 30000 }); // allow extended timeout for animations
});