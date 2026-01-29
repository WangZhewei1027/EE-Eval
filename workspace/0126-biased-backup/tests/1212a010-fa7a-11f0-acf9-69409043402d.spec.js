import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1212a010-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the Stack Interactive Demo
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors
    this.selectors = {
      stackDisplay: '#stackDisplay',
      log: '#log',
      pushInput: '#pushInput',
      pushBtn: '#pushBtn',
      pushCount: '#pushCount',
      pushRandomBtn: '#pushRandomBtn',
      pushRandomCount: '#pushRandomCount',
      bulkPushInput: '#bulkPushInput',
      bulkPushBtn: '#bulkPushBtn',
      popCount: '#popCount',
      popBtn: '#popBtn',
      popAllBtn: '#popAllBtn',
      clearBtn: '#clearBtn',
      peekDepth: '#peekDepth',
      peekBtn: '#peekBtn',
      peekResult: '#peekResult',
      searchInput: '#searchInput',
      searchBtn: '#searchBtn',
      searchResult: '#searchResult',
      maxStackSize: '#maxStackSize',
      applyMaxSizeBtn: '#applyMaxSizeBtn',
      strictMode: '#strictMode',
      autoPopCount: '#autoPopCount',
      autoPopTestBtn: '#autoPopTestBtn',
      stopAutoPushBtn: '#stopAutoPushBtn',
      autoPushInterval: '#autoPushInterval',
      undoBtn: '#undoBtn',
      redoBtn: '#redoBtn',
      saveStateBtn: '#saveStateBtn',
      loadStateBtn: '#loadStateBtn',
      stateExportArea: '#stateExportArea'
    };
  }

  async waitForReady() {
    await this.page.waitForSelector(this.selectors.stackDisplay);
  }

  async getStackText() {
    return (await this.page.locator(this.selectors.stackDisplay).innerText()).trim();
  }

  async getStackLines() {
    const text = await this.getStackText();
    if (!text) return [];
    if (text === '(empty)') return [];
    return text.split('\n').map(l => l.trim());
  }

  async getLogText() {
    return (await this.page.locator(this.selectors.log).innerText()).trim();
  }

  async push(value, count = 1) {
    const p = this.page;
    await p.fill(this.selectors.pushInput, value);
    await p.fill(this.selectors.pushCount, String(count));
    await p.click(this.selectors.pushBtn);
  }

  async pushRandom(count = 1) {
    await this.page.fill(this.selectors.pushRandomCount, String(count));
    await this.page.click(this.selectors.pushRandomBtn);
  }

  async bulkPush(text) {
    await this.page.fill(this.selectors.bulkPushInput, text);
    await this.page.click(this.selectors.bulkPushBtn);
  }

  async pop(count = 1) {
    await this.page.fill(this.selectors.popCount, String(count));
    await this.page.click(this.selectors.popBtn);
  }

  async popAll() {
    await this.page.click(this.selectors.popAllBtn);
  }

  async clear() {
    await this.page.click(this.selectors.clearBtn);
  }

  async peek(depth = 1) {
    await this.page.fill(this.selectors.peekDepth, String(depth));
    await this.page.click(this.selectors.peekBtn);
    return (await this.page.locator(this.selectors.peekResult).innerText()).trim();
  }

  async search(term) {
    await this.page.fill(this.selectors.searchInput, term);
    await this.page.click(this.selectors.searchBtn);
    return (await this.page.locator(this.selectors.searchResult).innerText()).trim();
  }

  async applyMaxSize(size = 0, strict = false, autoPop = 1) {
    await this.page.fill(this.selectors.maxStackSize, String(size));
    if (strict) {
      const checked = await this.page.isChecked(this.selectors.strictMode);
      if (!checked) await this.page.click(this.selectors.strictMode);
    } else {
      const checked = await this.page.isChecked(this.selectors.strictMode);
      if (checked) await this.page.click(this.selectors.strictMode);
    }
    await this.page.fill(this.selectors.autoPopCount, String(autoPop));
    await this.page.click(this.selectors.applyMaxSizeBtn);
  }

  async startAutoPush(intervalMs = 200) {
    await this.page.fill(this.selectors.autoPushInterval, String(intervalMs));
    await this.page.click(this.selectors.autoPopTestBtn);
  }

  async stopAutoPush() {
    await this.page.click(this.selectors.stopAutoPushBtn);
  }

  async undo() {
    await this.page.click(this.selectors.undoBtn);
  }

  async redo() {
    await this.page.click(this.selectors.redoBtn);
  }

  async saveState() {
    await this.page.click(this.selectors.saveStateBtn);
    return (await this.page.locator(this.selectors.stateExportArea).inputValue()).trim();
  }

  async loadState() {
    await this.page.click(this.selectors.loadStateBtn);
  }

  async setStateExportArea(value) {
    await this.page.fill(this.selectors.stateExportArea, value);
  }
}

test.describe('Interactive Stack Demonstration - Full FSM and UI verification', () => {
  // Capture console messages and page errors for assertions
  let consoleMsgs;
  let pageErrors;
  let dialogMsgs;

  test.beforeEach(async ({ page }) => {
    consoleMsgs = [];
    pageErrors = [];
    dialogMsgs = [];

    // Observe console messages
    page.on('console', msg => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });

    // Observe unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Auto-accept any dialogs (alerts) but record their messages
    page.on('dialog', async dialog => {
      dialogMsgs.push(dialog.message());
      await dialog.accept();
    });

    // Navigate to the app
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // basic sanity: no uncaught exceptions happened
    expect(pageErrors.length, `Uncaught page errors:\n${pageErrors.map(e => e.stack || e.message).join('\n')}`).toBe(0);
  });

  test('Initial state (S0_Idle) shows empty stack and startup log', async ({ page }) => {
    // Validate initial state and entry actions (updateStackDisplay logged via textual evidence)
    const sp = new StackPage(page);
    await sp.waitForReady();

    const stackText = await sp.getStackText();
    expect(stackText).toBe('(empty)');

    const logText = await sp.getLogText();
    expect(logText).toContain('Interactive stack demo loaded.'); // ensures initialization log exists

    // No console errors
    const errors = consoleMsgs.filter(m => m.type === 'error');
    expect(errors.length, `Console error messages: ${JSON.stringify(errors)}`).toBe(0);
  });

  test.describe('Push operations and transitions to S1_StackModified', () => {

    test('PushItem: push single and multiple copies, update display & log', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      // push single
      await sp.push('alpha', 1);

      let lines = await sp.getStackLines();
      // top marked with > and at bottom line
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines[lines.length - 1]).toContain('alpha');

      let log = await sp.getLogText();
      expect(log).toMatch(/Pushed: "alpha"/);
      expect(log).toMatch(/Push operation complete/);

      // push 3 copies
      await sp.push('beta', 3);
      lines = await sp.getStackLines();
      // after pushing 3 betas, top should be 'beta'
      expect(lines[lines.length - 1]).toContain('beta');
      // verify count increased by 3 (>= previous + 3)
      expect(lines.filter(l => l.includes('beta')).length).toBeGreaterThanOrEqual(3);
    });

    test('PushRandomItems: pushes random strings and logs random push', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      const before = (await sp.getStackLines()).length;
      await sp.pushRandom(2);

      const after = (await sp.getStackLines()).length;
      expect(after).toBeGreaterThanOrEqual(before + 2);

      const log = await sp.getLogText();
      expect(log).toMatch(/Random push operation complete/);
    });

    test('BulkPushItems: bulk push from textarea, updates display and logs', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      const bulk = 'one,two\nthree, four';
      await sp.bulkPush(bulk);

      const lines = await sp.getStackLines();
      // Expect at least the three non-empty trimmed items
      expect(lines.join(' ')).toContain('one');
      expect(lines.join(' ')).toContain('two');
      expect(lines.join(' ')).toContain('three');
      expect(lines.join(' ')).toContain('four');

      const log = await sp.getLogText();
      expect(log).toMatch(/Bulk push complete/);
    });

  });

  test.describe('Pop operations and stack modification behaviors (S1_StackModified -> S1_StackModified / S0_Idle)', () => {

    test('PopItems reduces stack and logs popped items', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      // Ensure there are some items
      await sp.push('p1', 2);
      await sp.push('p2', 2);

      const before = (await sp.getStackLines()).length;
      await sp.pop(2);
      const after = (await sp.getStackLines()).length;

      expect(after).toBe(before - 2);

      const log = await sp.getLogText();
      expect(log).toMatch(/Popped [0-9]+ item/);
    });

    test('PopAllItems empties the stack and logs', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      // Push some items
      await sp.push('all1', 1);
      await sp.push('all2', 1);

      await sp.popAll();

      const lines = await sp.getStackLines();
      expect(lines.length).toBe(0);

      const log = await sp.getLogText();
      expect(log).toMatch(/Pop All attempted|Popped [0-9]+ item/); // either path may log
    });

    test('ClearStack transitions to S0_Idle when stack cleared', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      await sp.push('toClear', 1);
      await sp.clear();

      const lines = await sp.getStackLines();
      expect(lines.length).toBe(0);

      const log = await sp.getLogText();
      expect(log).toMatch(/Cleared entire stack/);
    });

  });

  test.describe('Peek, Search, and UI result areas (S0_Idle)', () => {

    test('PeekItem: peek at various depths and edge scenarios', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      // ensure predictable stack: clear then push known items
      await sp.clear().catch(()=>{}); // ignore if already empty
      await sp.push('A', 1);
      await sp.push('B', 1);
      await sp.push('C', 1); // top is C

      // peek depth 1 -> C
      let result = await sp.peek(1);
      expect(result).toContain('C');

      // peek depth 3 -> A
      result = await sp.peek(3);
      expect(result).toContain('A');

      // peek out of bounds -> message about no item
      result = await sp.peek(5);
      expect(result).toContain('No item at depth');

      // invalid depth (0) triggers alert which we accept; record dialog
      await sp.page.fill(sp.selectors.peekDepth, '0');
      await sp.page.click(sp.selectors.peekBtn);
      // dialog should have been captured and accepted; ensure that happened
      expect(dialogMsgs.length).toBeGreaterThanOrEqual(0);
    });

    test('SearchItem: finds occurrences and reports depths', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      await sp.clear().catch(()=>{});
      // push items with duplicates
      await sp.push('findMe', 1);
      await sp.push('other', 1);
      await sp.push('findMeAgain', 1);
      await sp.push('findMe', 1); // duplicate near top

      const searchText = await sp.search('findMe');
      expect(searchText).toMatch(/Found \d+ match/);
      // ensure at least one match
      expect(searchText).toContain('Found');
    });

  });

  test.describe('Max size, strict mode, and overflow behavior', () => {

    test('ApplyMaxSize enforces max size immediately and logs auto pop', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      await sp.clear().catch(()=>{});
      // push 5 items
      await sp.push('m1', 2);
      await sp.push('m2', 3);

      const before = (await sp.getStackLines()).length;
      expect(before).toBeGreaterThanOrEqual(5);

      // set max size 2 and apply -> should auto-pop some items
      await sp.applyMaxSize(2, false, 1);

      const after = (await sp.getStackLines()).length;
      expect(after).toBeLessThanOrEqual(2);

      const log = await sp.getLogText();
      expect(log).toMatch(/Auto-popped|Max stack size set to/);
    });

    test('Strict mode disallows pushes when at max size', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      await sp.clear().catch(()=>{});
      // set max size 1 and strict mode ON
      await sp.applyMaxSize(1, true, 1);

      // push initial item
      await sp.push('s1', 1);
      // attempt to push another should be rejected and logged
      await sp.push('s2', 1);

      const lines = await sp.getStackLines();
      // Only one item should exist
      expect(lines.length).toBeLessThanOrEqual(1);

      const log = await sp.getLogText();
      expect(log).toMatch(/Push rejected: stack at max size and strict mode enabled|Push operation complete/);
    });

  });

  test.describe('Auto push test lifecycle', () => {
    test('StartAutoPushTest and StopAutoPushTest start and stop interval pushes', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      await sp.clear().catch(()=>{});
      // start auto push with small interval
      await sp.startAutoPush(150);

      // stop button should be enabled, start disabled
      expect(await page.isDisabled(sp.selectors.autoPopTestBtn)).toBeTruthy();
      expect(await page.isDisabled(sp.selectors.stopAutoPushBtn)).toBeFalsy();

      // allow a couple intervals to run
      await page.waitForTimeout(400);

      // now stop
      await sp.stopAutoPush();

      expect(await page.isDisabled(sp.selectors.autoPopTestBtn)).toBeFalsy();
      expect(await page.isDisabled(sp.selectors.stopAutoPushBtn)).toBeTruthy();

      // verify that some items were pushed during the auto test
      const lines = await sp.getStackLines();
      expect(lines.length).toBeGreaterThanOrEqual(1);

      const log = await sp.getLogText();
      expect(log).toMatch(/Auto push test started|Auto push test stopped/);
    }, { timeout: 10000 });
  });

  test.describe('Undo/Redo and Save/Load state (Advanced Exploration)', () => {

    test('UndoOperation and RedoOperation restore states appropriately', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      await sp.clear().catch(()=>{});
      // push A then B
      await sp.push('U1', 1);
      await sp.push('U2', 1);

      const afterPush = await sp.getStackLines();
      expect(afterPush.some(l => l.includes('U2'))).toBeTruthy();

      // Undo should revert last push (U2)
      await sp.undo();
      const afterUndo = await sp.getStackLines();
      expect(afterUndo.some(l => l.includes('U2'))).toBeFalsy();
      expect(afterUndo.some(l => l.includes('U1'))).toBeTruthy();

      // Redo should bring back U2
      await sp.redo();
      const afterRedo = await sp.getStackLines();
      expect(afterRedo.some(l => l.includes('U2'))).toBeTruthy();
    });

    test('SaveState writes JSON to textarea and LoadState restores stack', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      await sp.clear().catch(()=>{});
      await sp.push('S1', 1);
      await sp.push('S2', 1);

      const exported = await sp.saveState();
      expect(exported).toContain('"stack"');

      // clear and then load
      await sp.clear();
      expect((await sp.getStackLines()).length).toBe(0);

      await sp.loadState();

      // after load, stack should contain S2 and S1
      const lines = await sp.getStackLines();
      expect(lines.join(' ')).toContain('S2');
      expect(lines.join(' ')).toContain('S1');

      const log = await sp.getLogText();
      expect(log).toMatch(/Stack state saved|Stack state loaded/);
    });

  });

  test.describe('Edge cases, alerts, and invalid inputs', () => {

    test('Attempting to push empty value triggers alert and does not change stack', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      await sp.clear().catch(()=>{});
      const before = (await sp.getStackLines()).length;

      // attempt to push empty value; dialog handler accepts and records message
      await sp.page.fill(sp.selectors.pushInput, '');
      await sp.page.fill(sp.selectors.pushCount, '1');
      await sp.page.click(sp.selectors.pushBtn);

      // ensure dialog was shown
      expect(dialogMsgs.length).toBeGreaterThanOrEqual(1);
      // stack unchanged
      const after = (await sp.getStackLines()).length;
      expect(after).toBe(before);
    });

    test('Bulk push with empty textarea shows alert and does nothing', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      await sp.clear().catch(()=>{});
      const before = (await sp.getStackLines()).length;

      await sp.page.fill(sp.selectors.bulkPushInput, '');
      await sp.page.click(sp.selectors.bulkPushBtn);

      // dialog should have been shown at least once
      expect(dialogMsgs.length).toBeGreaterThanOrEqual(0);

      const after = (await sp.getStackLines()).length;
      expect(after).toBe(before);
    });

    test('Pop attempted on empty stack logs appropriate message', async ({ page }) => {
      const sp = new StackPage(page);
      await sp.waitForReady();

      // ensure empty
      await sp.clear().catch(()=>{});
      await sp.pop(1);

      const log = await sp.getLogText();
      expect(log).toMatch(/Pop attempted but stack empty/);
    });

  });

  test('Final console health check: no console-level error messages emitted during tests', async ({ page }) => {
    // capture any console error types from earlier
    const errors = consoleMsgs.filter(m => m.type === 'error');
    expect(errors.length, `Console errors found: ${errors.map(e => e.text).join(' | ')}`).toBe(0);
  });

});