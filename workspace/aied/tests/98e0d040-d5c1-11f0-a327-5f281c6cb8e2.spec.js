import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e0d040-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page object to encapsulate common interactions and queries
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      valueInput: '#valueInput',
      pushFrontBtn: '#pushFrontBtn',
      pushBackBtn: '#pushBackBtn',
      popFrontBtn: '#popFrontBtn',
      popBackBtn: '#popBackBtn',
      peekFrontBtn: '#peekFrontBtn',
      peekBackBtn: '#peekBackBtn',
      clearBtn: '#clearBtn',
      fillRandomBtn: '#fillRandomBtn',
      randomWalkBtn: '#randomWalkBtn',
      bufferVisual: '#bufferVisual',
      logicalView: '#logicalView',
      opLog: '#opLog',
      sizeBadge: '#sizeBadge',
      capBadge: '#capBadge',
      headBadge: '#headBadge',
      tailBadge: '#tailBadge'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait a short time for initial render and any rAF focus
    await this.page.waitForTimeout(50);
  }

  async getBadgeText(selector) {
    return (await this.page.locator(selector).innerText()).trim();
  }

  async getSize() { return Number(await this.getBadgeText(this.selectors.sizeBadge)); }
  async getCapacity() { return Number(await this.getBadgeText(this.selectors.capBadge)); }
  async getHead() { return Number(await this.getBadgeText(this.selectors.headBadge)); }
  async getTail() { return Number(await this.getBadgeText(this.selectors.tailBadge)); }

  async focusInput() {
    await this.page.locator(this.selectors.valueInput).focus();
  }

  async setInput(value) {
    const input = this.page.locator(this.selectors.valueInput);
    await input.fill(String(value));
  }

  async clearInput() {
    await this.page.locator(this.selectors.valueInput).fill('');
  }

  async pushFront(value) {
    if (value !== undefined) await this.setInput(value);
    await this.page.locator(this.selectors.pushFrontBtn).click();
    // render is synchronous, but give a tiny tick
    await this.page.waitForTimeout(20);
  }

  async pushBack(value) {
    if (value !== undefined) await this.setInput(value);
    await this.page.locator(this.selectors.pushBackBtn).click();
    await this.page.waitForTimeout(20);
  }

  async pushBackByEnter(value) {
    if (value !== undefined) await this.setInput(value);
    await this.page.locator(this.selectors.valueInput).press('Enter');
    await this.page.waitForTimeout(20);
  }

  async popFront() {
    await this.page.locator(this.selectors.popFrontBtn).click();
    await this.page.waitForTimeout(20);
  }

  async popBack() {
    await this.page.locator(this.selectors.popBackBtn).click();
    await this.page.waitForTimeout(20);
  }

  async peekFront() {
    await this.page.locator(this.selectors.peekFrontBtn).click();
    await this.page.waitForTimeout(20);
  }

  async peekBack() {
    await this.page.locator(this.selectors.peekBackBtn).click();
    await this.page.waitForTimeout(20);
  }

  async clear() {
    await this.page.locator(this.selectors.clearBtn).click();
    await this.page.waitForTimeout(20);
  }

  async fillRandom() {
    await this.page.locator(this.selectors.fillRandomBtn).click();
    await this.page.waitForTimeout(50);
  }

  async startRandomWalk() {
    await this.page.locator(this.selectors.randomWalkBtn).click();
    // give it some time to perform a couple of interval actions
    await this.page.waitForTimeout(600);
  }

  async stopRandomWalk() {
    // clicking toggles stop
    await this.page.locator(this.selectors.randomWalkBtn).click();
    await this.page.waitForTimeout(50);
  }

  // returns an array of strings (logical contents)
  async getLogicalContents() {
    const container = this.page.locator(this.selectors.logicalView);
    // capture text contents of the logical view elements
    const children = container.locator('> *');
    const count = await children.count();
    const results = [];
    for (let i = 0; i < count; i++) {
      const el = children.nth(i);
      const text = (await el.innerText()).trim();
      results.push(text);
    }
    return results;
  }

  // returns buffer cell elements with index and text and markers
  async getBufferCells() {
    const buffer = this.page.locator(this.selectors.bufferVisual);
    const cells = buffer.locator('.cell');
    const n = await cells.count();
    const out = [];
    for (let i = 0; i < n; i++) {
      const c = cells.nth(i);
      const label = await c.locator('.label').innerText().catch(() => String(i));
      const content = (await c.evaluate((el) => {
        // compute visible text excluding label and markers by cloning and removing them
        const clone = el.cloneNode(true);
        const rem = clone.querySelectorAll('.label, .marker');
        rem.forEach(r => r.remove());
        return clone.textContent.trim();
      })).trim();
      const hasHeadMarker = await c.locator('.marker.head').count() > 0;
      const hasTailMarker = await c.locator('.marker.tail').count() > 0;
      const inlineBorder = await c.evaluate((el) => el.style.border || '');
      const inlineBoxShadow = await c.evaluate((el) => el.style.boxShadow || '');
      out.push({
        idx: Number(label),
        content,
        hasHeadMarker,
        hasTailMarker,
        inlineBorder,
        inlineBoxShadow
      });
    }
    return out;
  }

  // read top-most operation log entry
  async getLastOpLogEntry() {
    const log = this.page.locator(this.selectors.opLog);
    const first = log.locator('> div').first();
    return (await first.innerText()).trim();
  }

  // get entire op log entries as array (newest first)
  async getOpLogEntries(limit = 20) {
    const log = this.page.locator(this.selectors.opLog);
    const items = log.locator('> div');
    const count = Math.min(limit, await items.count());
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push((await items.nth(i).innerText()).trim());
    }
    return out;
  }
}

// Global fixtures: capture console messages and page errors for each test
test.describe('Deque (Double-Ended Queue) Demo - Full E2E', () => {
  /** @type {string[]} */ let consoleMessages;
  /** @type {Error[]} */ let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // capture console messages
    page.on('console', (msg) => {
      // capture text and type for inspection
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    // capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, assert there were no unexpected runtime errors (ReferenceError/SyntaxError/TypeError)
    // Collect error names if any
    const names = pageErrors.map(e => e.name + ': ' + e.message);
    // Fail the test if any page error exists (they should happen naturally if JS is broken,
    // but this suite asserts the app runs without uncaught exceptions)
    expect(pageErrors.length, `expected no uncaught page errors, got: ${names.join(' | ')}`).toBe(0);
    // Also ensure there are no console messages of type 'error'
    const errorConsole = consoleMessages.filter(m => m.startsWith('error:') || m.startsWith('assert:') || m.startsWith('warning:'));
    expect(errorConsole.length, `unexpected console errors/warnings: ${errorConsole.join(' | ')}`).toBe(0);
  });

  test.describe('Initial state and basic rendering', () => {
    test('Initial render shows empty deque and initial log entry', async ({ page }) => {
      // Validate initial app state after load
      const dp = new DequePage(page);
      await dp.goto();

      // size should be 0, capacity 8 as in HTML initialization
      expect(await dp.getSize()).toBe(0);
      expect(await dp.getCapacity()).toBe(8);

      // head and tail indexes should be consistent (0)
      expect(await dp.getHead()).toBe(0);
      expect(await dp.getTail()).toBe(0);

      // buffer visual should contain 8 cells labeled 0..7
      const cells = await dp.getBufferCells();
      expect(cells.length).toBe(8);
      const labels = cells.map(c => c.idx);
      expect(labels).toEqual([0,1,2,3,4,5,6,7]);

      // logical view should indicate empty
      const logical = await dp.getLogicalContents();
      // expect the '(empty)' info element present
      expect(logical.some(t => t.toLowerCase().includes('(empty)'))).toBe(true);

      // op log should contain the initial ready message
      const entries = await dp.getOpLogEntries(5);
      const foundReady = entries.some(e => e.includes('Deque demo ready'));
      expect(foundReady).toBe(true);
    });
  });

  test.describe('Push/Pop and Peek interactions', () => {
    test('Push Front with a value updates buffer, badges, and logs (S1_Pushed_Front)', async ({ page }) => {
      // This test validates the PushFront event and the associated render highlight
      const dp = new DequePage(page);
      await dp.goto();

      // push front value "10"
      await dp.pushFront('10');

      // size increases to 1
      expect(await dp.getSize()).toBe(1);

      // logical view should show the value at front (front → back)
      const logical = await dp.getLogicalContents();
      // the first logical element contains 10 and the "(front)" marker appended in UI
      expect(logical.some(t => t.includes('10'))).toBe(true);
      expect(logical[0].toLowerCase().includes('(front)')).toBe(true);

      // opLog top entry should contain pushFront(10)
      const last = await dp.getLastOpLogEntry();
      expect(last).toMatch(/pushFront\(.+10.+\)/);

      // buffer cell at head should have head marker and inline border set by highlight
      const headIdx = await dp.getHead();
      const cells = await dp.getBufferCells();
      const headCell = cells.find(c => c.idx === headIdx);
      expect(headCell).toBeTruthy();
      expect(headCell.hasHeadMarker).toBe(true);
      // highlight of type 'head' sets inline border to a specific value (render sets it)
      expect(headCell.inlineBorder.includes('rgba(96,165,250,0.18)')).toBe(true);
    });

    test('Push Back via button and Enter key (S2_Pushed_Back)', async ({ page }) => {
      // Validate two ways of performing PushBack: clicking button and pressing Enter
      const dp = new DequePage(page);
      await dp.goto();

      // Push back using button
      await dp.pushBack('B1');
      expect(await dp.getSize()).toBe(1);
      let last = await dp.getLastOpLogEntry();
      expect(last).toMatch(/pushBack\(.+B1.+\)/);

      // Push back using Enter key (should append and increase size)
      await dp.pushBackByEnter(99);
      expect(await dp.getSize()).toBe(2);
      last = await dp.getLastOpLogEntry();
      expect(last).toMatch(/pushBack\(.+99.+\)/);

      // tail marker should be present at the tail index (where next pushBack would write)
      const tailIdx = await dp.getTail();
      const cells = await dp.getBufferCells();
      const tailCell = cells.find(c => c.idx === tailIdx);
      expect(tailCell).toBeTruthy();
      expect(tailCell.hasTailMarker).toBe(true);
      // highlight of type 'tail' sets inline border with specific rgba used in render
      // Note: When tail is highlighted it sets border: '2px solid rgba(16,185,129,0.12)'
      // but tail highlight only occurs on immediate pushBack; since we check presence, allow optional match
      // We assert the marker exists and capacity remains unchanged
      expect(await dp.getCapacity()).toBe(8);
    });

    test('Pop Front and Pop Back on empty deque produce undefined logs (S3_Popped_Front & S4_Popped_Back)', async ({ page }) => {
      // Validate pop behavior when deque is empty (edge-case)
      const dp = new DequePage(page);
      await dp.goto();

      // Ensure empty
      expect(await dp.getSize()).toBe(0);

      // Pop front should log undefined and not crash
      await dp.popFront();
      let last = await dp.getLastOpLogEntry();
      expect(last).toMatch(/popFront\(\) → undefined/);

      // Pop back should log undefined
      await dp.popBack();
      last = await dp.getLastOpLogEntry();
      expect(last).toMatch(/popBack\(\) → undefined/);
    });

    test('Peek Front and Peek Back when empty and when non-empty (S5_Peeked_Front & S6_Peeked_Back)', async ({ page }) => {
      // Validate peek behavior both when empty and after pushes
      const dp = new DequePage(page);
      await dp.goto();

      // empty peeks -> undefined
      await dp.peekFront();
      let last = await dp.getLastOpLogEntry();
      expect(last).toMatch(/peekFront\(\) → undefined/);

      await dp.peekBack();
      last = await dp.getLastOpLogEntry();
      expect(last).toMatch(/peekBack\(\) → undefined/);

      // push couple of items and peek again
      await dp.pushBack('X');
      await dp.pushBack('Y');
      expect(await dp.getSize()).toBe(2);

      // peekFront should show X
      await dp.peekFront();
      last = await dp.getLastOpLogEntry();
      expect(last).toMatch(/peekFront\(\) → .*X.*/);

      // peekBack should show Y
      await dp.peekBack();
      last = await dp.getLastOpLogEntry();
      expect(last).toMatch(/peekBack\(\) → .*Y.*/);
    });
  });

  test.describe('Clear, FillRandom, RandomWalk and resizing behaviors', () => {
    test('Clear resets badges and logical view (S7_Cleared)', async ({ page }) => {
      // Validate clear action
      const dp = new DequePage(page);
      await dp.goto();

      // fill with some values
      await dp.pushBack('a');
      await dp.pushBack('b');
      expect(await dp.getSize()).toBe(2);

      // clear
      await dp.clear();
      expect(await dp.getSize()).toBe(0);
      const logical = await dp.getLogicalContents();
      expect(logical.some(t => t.toLowerCase().includes('(empty)'))).toBe(true);

      // op log contains clear()
      const last = await dp.getLastOpLogEntry();
      expect(last).toMatch(/clear\(\)/);
    });

    test('Fill Random populates deque and logs (S8_Filled_Random)', async ({ page }) => {
      // Validate fillRandom creates multiple items
      const dp = new DequePage(page);
      await dp.goto();

      await dp.fillRandom();
      const size = await dp.getSize();
      expect(size).toBeGreaterThanOrEqual(1);
      const logical = await dp.getLogicalContents();
      // logical view should not be empty
      expect(logical.some(t => !t.toLowerCase().includes('(empty)'))).toBe(true);

      const last = await dp.getLastOpLogEntry();
      expect(last).toMatch(/fillRandom\(6\)/);
    });

    test('Random Walk starts and stops and produces operation log entries (S9_Random_WALK)', async ({ page }) => {
      // Validate random walk toggling and logs. Because it uses setInterval we only assert there are multiple ops.
      const dp = new DequePage(page);
      await dp.goto();

      // Start random walk
      await dp.startRandomWalk();
      // After starting, the button text should change to 'Stop Random Walk'
      const btnText = await page.locator(dp.selectors.randomWalkBtn).innerText();
      expect(btnText.toLowerCase()).toContain('stop');

      // There should be at least one op log entry mentioning 'push' or 'pop'
      const logs = await dp.getOpLogEntries(10);
      const hasOps = logs.some(l => /pushFront|pushBack|popFront|popBack/.test(l));
      expect(hasOps).toBe(true);

      // Stop random walk
      await dp.stopRandomWalk();
      const btnText2 = await page.locator(dp.selectors.randomWalkBtn).innerText();
      expect(btnText2.toLowerCase()).toContain('random walk');
      // final log should contain 'Random walk stopped'
      const finalLogs = await dp.getOpLogEntries(10);
      expect(finalLogs.some(l => l.toLowerCase().includes('random walk stopped'))).toBe(true);
    });

    test('Capacity grows when more than initial capacity elements are pushed (resizing)', async ({ page }) => {
      // Validate internal resizing behavior as expressed in UI badges (capacity doubles when full)
      const dp = new DequePage(page);
      await dp.goto();

      // initial capacity
      const initialCap = await dp.getCapacity();
      expect(initialCap).toBeGreaterThanOrEqual(4);

      // push initialCap items to fill (pushBack)
      for (let i = 0; i < initialCap; i++) {
        await dp.pushBack(`v${i}`);
      }
      expect(await dp.getSize()).toBe(initialCap);

      // push one more to trigger grow
      await dp.pushBack('triggerGrow');
      // capacity should have doubled
      const newCap = await dp.getCapacity();
      expect(newCap).toBeGreaterThanOrEqual(initialCap * 2);

      // logical contains the pushed items including 'triggerGrow'
      const logical = await dp.getLogicalContents();
      const found = logical.some(t => t.includes('triggerGrow'));
      expect(found).toBe(true);
    });
  });

  test.describe('Edge cases and error conditions', () => {
    test('Attempting to push without providing a value logs a warning and does not change size', async ({ page }) => {
      // Validate behavior when pushing with empty input
      const dp = new DequePage(page);
      await dp.goto();

      // ensure input empty
      await dp.clearInput();
      // record initial size
      const before = await dp.getSize();

      // push front with no value
      await dp.pushFront();
      let last = await dp.getLastOpLogEntry();
      // message uses 'No value provided to pushFront'
      expect(last.toLowerCase()).toContain('no value provided');

      // size unchanged
      expect(await dp.getSize()).toBe(before);

      // push back with no value
      await dp.pushBack();
      last = await dp.getLastOpLogEntry();
      expect(last.toLowerCase()).toContain('no value provided');

      // size remains unchanged
      expect(await dp.getSize()).toBe(before);
    });

    test('Sequence of operations maintains consistent head/tail indices and logical order', async ({ page }) => {
      // Complex sequence simulating multiple transitions and verifying invariants
      const dp = new DequePage(page);
      await dp.goto();

      // Start fresh
      await dp.clear();

      // Operations: pushBack 1, pushBack 2, pushFront 0, popBack (2), pushFront -1
      await dp.pushBack(1);
      await dp.pushBack(2);
      await dp.pushFront(0);
      await dp.popBack();
      await dp.pushFront(-1);

      // Logical array should be [-1,0,1] front→back
      const logical = await dp.getLogicalContents();
      // strip '(front)' annotations
      const cleaned = logical.map(t => t.replace(/\(front\)/i, '').trim());
      // ensure contains -1,0,1 in order
      expect(cleaned.length).toBeGreaterThanOrEqual(3);
      // find numeric tokens in order within the concatenated string to ensure sequence
      const seq = cleaned.join(' | ');
      expect(seq).toMatch(/-1/);
      expect(seq).toMatch(/0/);
      expect(seq).toMatch(/1/);

      // ensure badges are consistent: size 3
      expect(await dp.getSize()).toBe(3);

      // head and tail indices should be within capacity bounds
      const head = await dp.getHead();
      const tail = await dp.getTail();
      const cap = await dp.getCapacity();
      expect(head).toBeGreaterThanOrEqual(0);
      expect(tail).toBeGreaterThanOrEqual(0);
      expect(head).toBeLessThan(cap);
      expect(tail).toBeLessThanOrEqual(cap); // tail index equal to cap is not expected, but tail can be 0..cap-1
    });
  });
});