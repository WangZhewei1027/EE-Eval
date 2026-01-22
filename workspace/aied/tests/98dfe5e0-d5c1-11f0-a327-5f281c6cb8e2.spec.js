import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98dfe5e0-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page Object for interacting with the Arrays playground
class ArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      visual: '#visual',
      arrLength: '#arr-length',
      logArea: '#log-area',
      codePreview: '#code-preview',
      valueInput: '#value-input',
      indexInput: '#index-input',
      atValueInput: '#at-value-input',
      spliceIndex: '#splice-index',
      spliceDelete: '#splice-delete',
      spliceItems: '#splice-items',
      sliceStart: '#slice-start',
      sliceEnd: '#slice-end',
      findThreshold: '#find-threshold',
      includesValue: '#includes-value',
      customSnippet: '#custom-snippet',
      pushBtn: '#push-btn',
      unshiftBtn: '#unshift-btn',
      popBtn: '#pop-btn',
      shiftBtn: '#shift-btn',
      shuffleBtn: '#shuffle-btn',
      sortBtn: '#sort-btn',
      insertBtn: '#insert-btn',
      removeIndexBtn: '#remove-index-btn',
      spliceBtn: '#splice-btn',
      sliceBtn: '#slice-btn',
      mapBtn: '#map-btn',
      filterBtn: '#filter-btn',
      reduceBtn: '#reduce-btn',
      findBtn: '#find-btn',
      includesBtn: '#includes-btn',
      flatBtn: '#flat-btn',
      showCloneBtn: '#show-clone-btn',
      mutateCloneBtn: '#mutate-clone-btn',
      multiBtn: '#multi-btn',
      typedBtn: '#typed-btn',
      sparseBtn: '#sparse-btn',
      resetBtn: '#reset-btn',
      runSnippetBtn: '#run-snippet-btn',
      clearLogBtn: '#clear-log-btn'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for initial render to finish (arr-length should be updated)
    await this.page.waitForSelector(this.selectors.arrLength);
    await expect(this.page.locator(this.selectors.arrLength)).not.toHaveText('');
  }

  async getArrLengthText() {
    return (await this.page.locator(this.selectors.arrLength).textContent())?.trim();
  }

  async getVisualCells() {
    // returns array of visible cells' texts (value portion)
    const cells = this.page.locator(`${this.selectors.visual} .cell`);
    const count = await cells.count();
    const list = [];
    for (let i = 0; i < count; i++) {
      const cell = cells.nth(i);
      // cell contains index element and then value; we'll take the textContent and remove index text (which is in .index)
      const indexText = (await cell.locator('.index').textContent()) || '';
      // get full text then remove index line
      const full = (await cell.textContent()) || '';
      // remove indexText or trim
      const val = full.replace(indexText, '').trim();
      list.push(val);
    }
    return list;
  }

  async getVisualIndices() {
    const indices = [];
    const idxs = this.page.locator(`${this.selectors.visual} .index`);
    const count = await idxs.count();
    for (let i = 0; i < count; i++) {
      const t = (await idxs.nth(i).textContent()) || '';
      indices.push(t.trim());
    }
    return indices;
  }

  async getLogText() {
    return (await this.page.locator(this.selectors.logArea).textContent()) || '';
  }

  async getCodePreview() {
    return (await this.page.locator(this.selectors.codePreview).inputValue()) || '';
  }

  // Basic actions
  async setValueInput(val) {
    await this.page.fill(this.selectors.valueInput, String(val));
  }
  async setIndexInput(val) {
    await this.page.fill(this.selectors.indexInput, String(val));
  }
  async setAtValueInput(val) {
    await this.page.fill(this.selectors.atValueInput, String(val));
  }
  async setSpliceInputs(idx, del, itemsStr) {
    await this.page.fill(this.selectors.spliceIndex, String(idx));
    await this.page.fill(this.selectors.spliceDelete, String(del));
    await this.page.fill(this.selectors.spliceItems, String(itemsStr));
  }
  async setSliceInputs(start, end) {
    await this.page.fill(this.selectors.sliceStart, String(start));
    await this.page.fill(this.selectors.sliceEnd, String(end));
  }
  async setFindThreshold(val) {
    await this.page.fill(this.selectors.findThreshold, String(val));
  }
  async setIncludesValue(val) {
    await this.page.fill(this.selectors.includesValue, String(val));
  }
  async setCustomSnippet(code) {
    await this.page.fill(this.selectors.customSnippet, code);
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async push(val) {
    await this.setValueInput(val);
    await this.click(this.selectors.pushBtn);
  }
  async unshift(val) {
    await this.setValueInput(val);
    await this.click(this.selectors.unshiftBtn);
  }
  async pop() {
    await this.click(this.selectors.popBtn);
  }
  async shift() {
    await this.click(this.selectors.shiftBtn);
  }
  async shuffle() {
    await this.click(this.selectors.shuffleBtn);
  }
  async sort() {
    await this.click(this.selectors.sortBtn);
  }
  async insertAt(idx, val) {
    await this.setIndexInput(idx);
    await this.setAtValueInput(val);
    await this.click(this.selectors.insertBtn);
  }
  async removeAt(idx) {
    await this.setIndexInput(idx);
    await this.click(this.selectors.removeIndexBtn);
  }
  async splice(idx, del, itemsStr) {
    await this.setSpliceInputs(idx, del, itemsStr);
    await this.click(this.selectors.spliceBtn);
  }
  async slice(start, end) {
    await this.setSliceInputs(start, end);
    await this.click(this.selectors.sliceBtn);
  }
  async mapDouble() {
    await this.click(this.selectors.mapBtn);
  }
  async filterEven() {
    await this.click(this.selectors.filterBtn);
  }
  async reduceSum() {
    await this.click(this.selectors.reduceBtn);
  }
  async findFirstGreaterThan(n) {
    await this.setFindThreshold(n);
    await this.click(this.selectors.findBtn);
  }
  async includesValue(val) {
    await this.setIncludesValue(val);
    await this.click(this.selectors.includesBtn);
  }
  async flat() {
    await this.click(this.selectors.flatBtn);
  }
  async showCloneDemo() {
    await this.click(this.selectors.showCloneBtn);
  }
  async mutateClone() {
    await this.click(this.selectors.mutateCloneBtn);
  }
  async show2DArray() {
    await this.click(this.selectors.multiBtn);
  }
  async typedDemo() {
    await this.click(this.selectors.typedBtn);
  }
  async sparseDemo() {
    await this.click(this.selectors.sparseBtn);
  }
  async reset() {
    await this.click(this.selectors.resetBtn);
  }
  async runSnippet() {
    await this.click(this.selectors.runSnippetBtn);
  }
  async clearLog() {
    await this.click(this.selectors.clearLogBtn);
  }
}

test.describe('Arrays — Interactive Guide & Playground (FSM coverage)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // capture uncaught exceptions (pageerror) and console messages
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.describe('Initial state and rendering (S0_Idle)', () => {
    test('renders initial array and welcome logs', async ({ page }) => {
      const app = new ArrayPage(page);
      await app.goto();

      // Verify initial array length is 5 (from HTML script)
      const lenText = await app.getArrLengthText();
      expect(lenText).toBe('5');

      // Visual should contain 5 cells with indices 0..4 and values 1..5
      const indices = await app.getVisualIndices();
      expect(indices).toEqual(['0', '1', '2', '3', '4']);

      const values = await app.getVisualCells();
      // As values are rendered as "1", "2", ... ensure they match
      expect(values).toEqual(['1', '2', '3', '4', '5']);

      // Log area should have welcome message inserted by initial script
      const log = await app.getLogText();
      expect(log).toContain('Welcome — this is an interactive demonstration of JavaScript arrays.');

      // No uncaught page errors at initial load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Mutation actions (transitions from S0_Idle -> S1_ArrayModified)', () => {
    test('push, unshift, pop, shift update visual and length, and produce code preview/logs', async ({ page }) => {
      const app = new ArrayPage(page);
      await app.goto();

      // Reset to ensure deterministic baseline
      await app.reset();
      // After reset, arr should be back to 1..5 and codePreview updated
      await expect(page.locator('#arr-length')).toHaveText('5');

      // Push a number (42)
      await app.push('42');
      await expect(page.locator('#arr-length')).toHaveText('6');
      let vals = await app.getVisualCells();
      expect(vals[vals.length - 1]).toBe('42'); // last element is 42
      const codeAfterPush = await app.getCodePreview();
      expect(codeAfterPush).toContain('arr.push(42)');
      const logAfterPush = await app.getLogText();
      expect(logAfterPush).toContain('Action executed:');

      // Unshift a string ("hello")
      await app.unshift('hello');
      await expect(page.locator('#arr-length')).toHaveText('7');
      vals = await app.getVisualCells();
      expect(vals[0]).toBe('hello');

      // Pop: should remove last element
      await app.pop();
      await expect(page.locator('#arr-length')).toHaveText('6'); // popped once
      const logPop = await app.getLogText();
      expect(logPop).toContain('pop ->');

      // Shift: should remove first element
      await app.shift();
      // back to length 5 after both pop and shift (push/unshift changed)
      await expect(page.locator('#arr-length')).toHaveText(/^[0-9]+$/);
      const logShift = await app.getLogText();
      expect(logShift).toContain('shift ->');

      // Ensure no uncaught page errors during these mutations
      expect(pageErrors.length).toBe(0);
    });

    test('shuffle and sort maintain length and update visual (shuffle randomizes, sort orders)', async ({ page }) => {
      const app = new ArrayPage(page);
      await app.goto();
      await app.reset();

      // Shuffle - cannot assert exact order but length must remain 5
      await app.shuffle();
      await expect(page.locator('#arr-length')).toHaveText('5');
      const afterShuffle = await app.getVisualCells();
      expect(afterShuffle.length).toBe(5);

      // Sort - numeric sort expected with initial numeric array; length stays same, order should be ascending
      await app.sort();
      await expect(page.locator('#arr-length')).toHaveText('5');
      const afterSort = await app.getVisualCells();
      expect(afterSort).toEqual(['1', '2', '3', '4', '5']);

      expect(pageErrors.length).toBe(0);
    });

    test('insert and remove at index update array length and visual accordingly (including out-of-range removal)', async ({ page }) => {
      const app = new ArrayPage(page);
      await app.goto();
      await app.reset();

      // Insert 'x' at index 2
      await app.insertAt(2, '"x"'); // pass a JSON string so parseInputValue will interpret as string "x"
      await expect(page.locator('#arr-length')).toHaveText('6');
      const indices = await app.getVisualIndices();
      // After insertion, index '2' should exist and value at that index be '"x"' or x (render strips quotes)
      const vals = await app.getVisualCells();
      expect(vals[2]).toBe('x');

      // Remove at index 2
      await app.removeAt(2);
      await expect(page.locator('#arr-length')).toHaveText('5');

      // Attempt to remove at out-of-range index (e.g., 999) - should not throw; arr length remains unchanged
      await app.removeAt(999);
      // Expect length still 5
      await expect(page.locator('#arr-length')).toHaveText('5');
      const log = await app.getLogText();
      // The script logs 'removed ->' even if removed array is empty - ensure log recorded
      expect(log).toContain('removed ->');

      expect(pageErrors.length).toBe(0);
    });

    test('splice operations with items change values and logs removed items', async ({ page }) => {
      const app = new ArrayPage(page);
      await app.goto();
      await app.reset();

      // Splice: at index 1, delete 2 items, insert 8,9
      await app.splice(1, 2, '8,9');
      // After splice, arr length: initial 5 -2 +2 = 5
      await expect(page.locator('#arr-length')).toHaveText('5');
      const cells = await app.getVisualCells();
      // Check that values include '8' and '9' in expected neighborhood
      expect(cells).toContain('8');
      expect(cells).toContain('9');
      const log = await app.getLogText();
      expect(log).toContain('splice removed ->');

      expect(pageErrors.length).toBe(0);
    });

    test('slice is non-mutating and logs result but does not change visual array', async ({ page }) {
      const app = new ArrayPage(page);
      await app.goto();
      await app.reset();

      // Capture visual snapshot before slice
      const before = await app.getVisualCells();

      // Slice from 1 to 3
      await app.slice(1, 3);
      // visual remains unchanged
      const after = await app.getVisualCells();
      expect(after).toEqual(before);

      // codePreview updated to include 'arr.slice' snippet
      const cp = await app.getCodePreview();
      expect(cp).toContain('arr.slice');

      expect(pageErrors.length).toBe(0);
    });

    test('map, filter, reduce, find, includes, flat behaviors are exercised and logged', async ({ page }) => {
      const app = new ArrayPage(page);
      await app.goto();
      await app.reset();

      // Map (double) - modifies arr
      await app.mapDouble();
      await expect(page.locator('#arr-length')).toHaveText('5');
      let vals = await app.getVisualCells();
      expect(vals).toEqual(['2', '4', '6', '8', '10']);

      // Filter (even) - numbers remain even; filter will keep all, but still should run
      await app.filterEven();
      // arr might remain same; ensure arr-length is a number
      const lenAfterFilter = await app.getArrLengthText();
      expect(Number(lenAfterFilter)).toBeGreaterThanOrEqual(0);

      // Reset and then reduce
      await app.reset();
      await app.reduceSum();
      const log = await app.getLogText();
      expect(log).toContain('reduce sum ->');

      // Find first > n
      await app.findFirstGreaterThan(3);
      expect((await app.getLogText())).toContain('find ->');

      // Includes check for '3' should be true in default arr
      await app.includesValue('3');
      expect((await app.getLogText())).toContain('includes ->');

      // For flat: push a nested array then flat
      await app.reset();
      // Push a nested array by pushing JSON string that parseInputValue will JSON.parse
      await app.setValueInput('[6,7]');
      await app.click('#push-btn'); // push nested array
      // Now array contains numbers and one nested array. flat should flatten it.
      await app.flat();
      // After flat, visual should include '6' and '7' as separate cells
      const flatVals = await app.getVisualCells();
      expect(flatVals).toContain('6');
      expect(flatVals).toContain('7');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Clone, multi-dimensional, typed, sparse demos and snippet runner', () => {
    test('clone demo and mutate clone show reference behavior in logs', async ({ page }) => {
      const app = new ArrayPage(page);
      await app.goto();

      // Show clone demo: should log objArr and clonedArr
      await app.showCloneDemo();
      const logAfter = await app.getLogText();
      expect(logAfter).toContain('objArr ->');
      expect(logAfter).toContain('clonedArr (shallow) ->');

      // Mutate clone: should modify nested object and log both arrays showing modified tag
      await app.mutateClone();
      const logAfterMutate = await app.getLogText();
      expect(logAfterMutate).toContain('After modifying clonedArr[0].tag ->');
      expect(logAfterMutate).toContain('objArr ->');
      expect(logAfterMutate).toContain('clonedArr ->');

      expect(pageErrors.length).toBe(0);
    });

    test('multi-dimensional, typed array and sparse demos update visual/length and logs', async ({ page }) {
      const app = new ArrayPage(page);
      await app.goto();

      // Show 2D array: visual is reconstructed and lengthEl shows "3x3"
      await app.show2DArray();
      const lenText = await app.getArrLengthText();
      expect(lenText).toContain('x'); // e.g., "3x3"
      const visualCells = await app.page.locator('#visual .cell').count();
      expect(visualCells).toBeGreaterThanOrEqual(9); // 3x3 -> at least 9 cells present

      // Typed array demo logs Int16Array converted to array
      await app.typedDemo();
      const typedLog = await app.getLogText();
      expect(typedLog).toContain('Int16Array ->');

      // Sparse array demo: length should update to 6 and visual has empty markers
      await app.sparseDemo();
      const sparseLen = await app.getArrLengthText();
      expect(sparseLen).toBe('6');
      const sparseLog = await app.getLogText();
      expect(sparseLog).toContain('sparse ->');

      expect(pageErrors.length).toBe(0);
    });

    test('reset restores array and code preview, and clear log empties the log area', async ({ page }) {
      const app = new ArrayPage(page);
      await app.goto();

      // Make a change then reset
      await app.push('99');
      await expect(page.locator('#arr-length')).not.toHaveText('5'); // ensure change
      await app.reset();
      await expect(page.locator('#arr-length')).toHaveText('5');
      // codePreview should reflect reset code (arr = [1,2,3,4,5]; // reset)
      const cp = await app.getCodePreview();
      expect(cp).toContain('reset');

      // Clear log and verify log is empty
      await app.clearLog();
      const logAfterClear = await app.getLogText();
      expect(logAfterClear.trim()).toBe('');

      expect(pageErrors.length).toBe(0);
    });

    test('run-snippet executes safe snippet and logs result; erroneous snippet logs error', async ({ page }) => {
      const app = new ArrayPage(page);
      await app.goto();

      // Valid snippet that returns doubled numbers (uses arr parameter)
      const snippet = 'return arr.map(x => (typeof x === "number" ? x*2 : x));';
      await app.setCustomSnippet(snippet);
      await app.runSnippet();
      // codePreview should contain the snippet
      const cp = await app.getCodePreview();
      expect(cp).toContain('return arr.map');
      const log = await app.getLogText();
      expect(log).toContain('snippet result ->');

      // Erroneous snippet - should be caught by the runner and logged as 'snippet error ->'
      const badSnippet = 'throw new Error("boom from snippet")';
      await app.setCustomSnippet(badSnippet);
      await app.runSnippet();
      const logAfterBad = await app.getLogText();
      expect(logAfterBad).toContain('snippet error ->');

      // There should be no uncaught page errors even if snippet throws (runner handles it)
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('remove and splice with negative indices and empty inputs handled gracefully', async ({ page }) => {
      const app = new ArrayPage(page);
      await app.goto();
      await app.reset();

      // Remove at negative index - will cause splice with negative index; ensure it doesn't throw
      await app.removeAt(-2);
      // After removal, arr length should be a number and page not crashed
      const len = await app.getArrLengthText();
      expect(Number(len)).toBeGreaterThanOrEqual(0);

      // Splice with deleteCount omitted (empty) - UI uses Number(...) || 0, so 0 expected
      await app.setSpliceInputs(1, '', '');
      await app.click('#splice-btn');
      // ensure no crash and log shows 'splice removed ->' even if nothing removed
      const log = await app.getLogText();
      expect(log).toContain('splice removed ->');

      expect(pageErrors.length).toBe(0);
    });

    test('ensure no unexpected console errors occurred during the whole test session', async ({ page }) => {
      // This test ensures the capture we set up in beforeEach did not detect unexpected page errors.
      // Note: It's run in its own context; we will still visit the page to check typical behavior.
      const app = new ArrayPage(page);
      await app.goto();
      await app.reset();

      // Do a few interactions
      await app.push(7);
      await app.unshift('start');
      await app.splice(0, 1, 'foo');

      // Validate there were no uncaught errors recorded by the page
      expect(pageErrors.length).toBe(0);
    });
  });
});