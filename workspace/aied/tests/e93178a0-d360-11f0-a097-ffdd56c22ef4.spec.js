import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e93178a0-d360-11f0-a097-ffdd56c22ef4.html';

// Page object to encapsulate interactions and assertions for the Array Explorer app
class ArrayExplorerPage {
  constructor(page) {
    this.page = page;
    this.arrInput = page.locator('#arrInput');
    this.createBtn = page.locator('button:has-text("Create Array")');
    this.resetBtn = page.locator('button:has-text("Reset")');
    this.randomBtn = page.locator('button:has-text("Random")');
    this.arrayBox = page.locator('#arrayBox');
    this.jsonOut = page.locator('#jsonOut');
    this.log = page.locator('#log');
    this.codePreview = page.locator('#codePreview');

    // common operation inputs/buttons
    this.pushVal = page.locator('#pushVal');
    this.pushBtn = page.locator('button:has-text("Push")');
    this.popBtn = page.locator('button:has-text("Pop")');
    this.unshiftVal = page.locator('#unshiftVal');
    this.unshiftBtn = page.locator('button:has-text("Unshift")');
    this.shiftBtn = page.locator('button:has-text("Shift")');

    this.spliceStart = page.locator('#spliceStart');
    this.spliceDelete = page.locator('#spliceDelete');
    this.spliceItems = page.locator('#spliceItems');
    this.spliceBtn = page.locator('button:has-text("Run")');

    this.sliceStart = page.locator('#sliceStart');
    this.sliceEnd = page.locator('#sliceEnd');
    this.sliceBtn = page.locator('button:has-text("Slice")');

    this.mapExpr = page.locator('#mapExpr');
    this.mapBtn = page.locator('button:has-text("Map")');

    this.filterExpr = page.locator('#filterExpr');
    this.filterBtn = page.locator('button:has-text("Filter")');

    this.reduceExpr = page.locator('#reduceExpr');
    this.reduceInit = page.locator('#reduceInit');
    this.reduceBtn = page.locator('button:has-text("Reduce")');

    this.sortExpr = page.locator('#sortExpr');
    this.sortBtn = page.locator('button:has-text("Sort")');
    this.reverseBtn = page.locator('button:has-text("Reverse")');
    this.joinBtn = page.locator('button:has-text("Join")');
    this.joinSep = page.locator('#joinSep');

    this.concatInput = page.locator('#concatInput');
    this.concatBtn = page.locator('button:has-text("Concat")');

    this.flatDepth = page.locator('#flatDepth');
    this.flatBtn = page.locator('button:has-text("Flat")');

    this.searchVal = page.locator('#searchVal');
    this.findExpr = page.locator('#findExpr');
    this.includesBtn = page.locator('button:has-text("includes / indexOf / find")');

    this.fillVal = page.locator('#fillVal');
    this.fillStart = page.locator('#fillStart');
    this.fillEnd = page.locator('#fillEnd');
    this.fillBtn = page.locator('button:has-text("fill(value,start,end)")');

    this.cwTarget = page.locator('#cwTarget');
    this.cwStart = page.locator('#cwStart');
    this.cwEnd = page.locator('#cwEnd');
    this.copyWithinBtn = page.locator('button:has-text("copyWithin(target,start,end)")');

    this.lengthInput = page.locator('#lengthInput');
    this.setLengthBtn = page.locator('button:has-text("Set")');
    this.showLengthBtn = page.locator('button:has-text("Show .length")');

    this.copyJsonBtn = page.locator('button:has-text("Copy JSON")');
    this.downloadBtn = page.locator('button:has-text("Download .json")');

    this.arrType = page.locator('#arrType');

    // Clear log button in the right panel
    this.clearLogBtn = page.locator('button:has-text("Clear")');
  }

  async waitForAppReady() {
    // wait until the jsonOut exists and codePreview has some content
    await this.page.waitForSelector('#jsonOut');
    await this.page.waitForSelector('#codePreview');
    // initial script sets arrInput value and creates array; wait for arrayBox to render cells or empty state
    await this.page.waitForTimeout(100); // slight pause for DOM updates
  }

  async getArrayValues() {
    // returns array of text values shown in the visual cells
    const cells = await this.arrayBox.locator('.cell .val').allTextContents();
    // if empty array view, the arrayBox contains a small-muted div
    if (cells.length === 0) {
      const txt = await this.arrayBox.textContent();
      if (txt && txt.toLowerCase().includes('empty')) return [];
      return [];
    }
    return cells;
  }

  async getJsonOutText() {
    return (await this.jsonOut.textContent()) || '';
  }

  async getLatestLogText() {
    // logs are prepended: first child is latest
    const first = this.log.locator('div').first();
    return (await first.textContent()) || '';
  }

  async waitForLogIncludes(text, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, text) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return Array.from(el.querySelectorAll('div')).some(d => d.textContent && d.textContent.includes(text));
      },
      this.log.selector,
      text,
      { timeout }
    );
  }

  async clearLog() {
    await this.clearLogBtn.click();
    // wait for the log to be empty
    await expect(this.log).toHaveText('', { timeout: 2000 });
  }
}

test.describe('Array Explorer — FSM / UI Integration Tests', () => {
  // Capture console errors and page errors for each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Ensure tests did not produce uncaught page errors or console errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('States and Initialization', () => {
    test('Initial state: app initializes and creates default array (S1_ArrayCreated)', async ({ page }) => {
      // Validate entry actions and initial rendering
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();

      // The initialization IIFE sets arrInput to '[1,2,3,4]' and calls createArray()
      await expect(app.arrInput).toHaveValue('[1,2,3,4]');

      // jsonOut should reflect the created array
      const jsonText = await app.getJsonOutText();
      expect(jsonText).toContain('1');
      expect(jsonText).toContain('2');
      expect(jsonText).toContain('3');
      expect(jsonText).toContain('4');

      // visual cells should show the four items
      const cells = await app.getArrayValues();
      expect(cells.length).toBeGreaterThanOrEqual(4);
      expect(cells).toEqual(expect.arrayContaining(['1', '2', '3', '4']));

      // code preview should contain preview code for creation
      const codePreviewText = await app.codePreview.textContent();
      expect(codePreviewText).toContain('const arr');

      // Log should contain the 'Created array' and the welcome message
      await app.waitForLogIncludes('Created array');
      await app.waitForLogIncludes('Welcome to Array Explorer');
    });

    test('Create Array transition from Idle to Array Created (CreateArray event)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();

      // Enter a new array and click Create Array
      await app.arrInput.fill('[5,6,7]');
      await app.createBtn.click();

      // Confirm that jsonOut updated and array visual updated
      await expect(app.jsonOut).toContainText('"5"'); // JSON.stringify numeric values may be numbers or strings depending on parsing; check for 5
      // Wait for log entry for Created array
      await app.waitForLogIncludes('Created array');
      // Visual check
      const vals = await app.getArrayValues();
      // values should include '5' '6' '7' or their string forms
      expect(vals.some(v => v.includes('5'))).toBeTruthy();
      expect(vals.some(v => v.includes('6'))).toBeTruthy();
      expect(vals.some(v => v.includes('7'))).toBeTruthy();
    });
  });

  test.describe('Basic mutating operations (Push/Pop/Unshift/Shift/Reset/Random)', () => {
    test('Push and Pop update visual and logs', async ({ page }) => {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();

      // Clear log for deterministic checks
      await app.clearLog();

      // Push a value
      await app.pushVal.fill('99');
      await app.pushBtn.click();

      // After push, new length log should appear
      await app.waitForLogIncludes('push -> new length');
      const afterPushCells = await app.getArrayValues();
      expect(afterPushCells.some(v => v.includes('99'))).toBeTruthy();

      // Pop should remove and produce a log
      await app.popBtn.click();
      await app.waitForLogIncludes('pop ->');
      const afterPopCells = await app.getArrayValues();
      // 99 should no longer be present
      expect(afterPopCells.some(v => v.includes('99'))).toBe(false);
    });

    test('Unshift and Shift update visual and logs', async ({ page }) => {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();
      await app.clearLog();

      await app.unshiftVal.fill('"start"');
      await app.unshiftBtn.click();
      await app.waitForLogIncludes('unshift -> new length');
      let vals = await app.getArrayValues();
      expect(vals[0]).toContain('start');

      await app.shiftBtn.click();
      await app.waitForLogIncludes('shift ->');
      vals = await app.getArrayValues();
      // first value should no longer be "start"
      expect(vals[0]).not.toContain('start');
    });

    test('Reset and Random transitions', async ({ page }) => {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();

      // Reset
      await app.resetBtn.click();
      await app.waitForLogIncludes('Reset');
      // arrInput emptied, arrayBox shows empty array
      await expect(app.arrInput).toHaveValue('');
      const valsAfterReset = await app.getArrayValues();
      expect(valsAfterReset.length).toBe(0);
      await expect(app.jsonOut).toHaveText(/\[\]/);

      // Random - creates a new array (S1_ArrayCreated again)
      await app.randomBtn.click();
      await app.waitForLogIncludes('Created array');
      const valsAfterRandom = await app.getArrayValues();
      // random array length should be > 0 (8 elements per implementation)
      expect(valsAfterRandom.length).toBeGreaterThan(0);
    });
  });

  test.describe('Splice, Slice, Map, Filter, Reduce, Sort, Reverse, Join', () => {
    test('Splice removes items and logs removed array', async ({ page }) => {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();
      await app.clearLog();

      // Ensure known array
      await app.arrInput.fill('[10,11,12,13,14]');
      await app.createBtn.click();
      await app.waitForLogIncludes('Created array');

      // Remove two elements at index 1 and insert 'x'
      await app.spliceStart.fill('1');
      await app.spliceDelete.fill('2');
      await app.spliceItems.fill('"x"');
      await app.spliceBtn.click();
      await app.waitForLogIncludes('splice removed');
      const vals = await app.getArrayValues();
      // After splice, values should include 'x' and not include 11 or 12
      expect(vals.some(v => v.includes('x'))).toBeTruthy();
      expect(vals.some(v => v.includes('11'))).toBe(false);
      expect(vals.some(v => v.includes('12'))).toBe(false);
    });

    test('Slice produces log output without mutating', async ({ page }) => {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();
      await app.clearLog();

      await app.arrInput.fill('[1,2,3,4,5]');
      await app.createBtn.click();
      await app.waitForLogIncludes('Created array');

      await app.sliceStart.fill('1');
      await app.sliceEnd.fill('4');
      await app.sliceBtn.click();
      await app.waitForLogIncludes('slice ->');
      // ensure original array still intact in visual
      const vals = await app.getArrayValues();
      expect(vals.length).toBeGreaterThanOrEqual(5);
    });

    test('Map / Filter / Reduce produce logs and results', async ({ page }) => {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();
      await app.clearLog();

      await app.arrInput.fill('[1,2,3,4]');
      await app.createBtn.click();
      await app.waitForLogIncludes('Created array');

      // Map x*2
      await app.mapExpr.fill('x * 2');
      await app.mapBtn.click();
      await app.waitForLogIncludes('map ->');
      // Filter even
      await app.filterExpr.fill('x % 2 == 0');
      await app.filterBtn.click();
      await app.waitForLogIncludes('filter ->');
      // Reduce sum with initial 0
      await app.reduceExpr.fill('acc + x');
      await app.reduceInit.fill('0');
      await app.reduceBtn.click();
      await app.waitForLogIncludes('reduce ->');
    });

    test('Sort / Reverse / Join create appropriate logs and update visuals', async ({ page }) => {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();
      await app.clearLog();

      await app.arrInput.fill('[3,1,4,2]');
      await app.createBtn.click();
      await app.waitForLogIncludes('Created array');

      await app.sortBtn.click();
      await app.waitForLogIncludes('sorted');
      // After sort, first element likely '1'
      const valsAfterSort = await app.getArrayValues();
      expect(valsAfterSort[0]).toContain('1');

      await app.reverseBtn.click();
      await app.waitForLogIncludes('reversed');
      const valsAfterReverse = await app.getArrayValues();
      expect(valsAfterReverse[0]).not.toContain('1'); // reversed order

      await app.joinSep.fill('-');
      await app.joinBtn.click();
      await app.waitForLogIncludes('join ->');
    });
  });

  test.describe('Concat, Flat, Includes, Fill, CopyWithin, Length & Export/Download', () => {
    test('Concat and Flat operations log outputs', async ({ page }) => {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();
      await app.clearLog();

      await app.arrInput.fill('[1,2,[3,4]]');
      await app.createBtn.click();
      await app.waitForLogIncludes('Created array');

      await app.concatInput.fill('[9,10]');
      await app.concatBtn.click();
      await app.waitForLogIncludes('concat ->');

      await app.flatDepth.fill('1');
      await app.flatBtn.click();
      await app.waitForLogIncludes('flat ->');
    });

    test('Includes / indexOf / find produce expected log', async ({ page }) => {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();
      await app.clearLog();

      await app.arrInput.fill('[7,8,9]');
      await app.createBtn.click();
      await app.waitForLogIncludes('Created array');

      await app.searchVal.fill('8');
      await app.findExpr.fill('x>7');
      await app.includesBtn.click();
      await app.waitForLogIncludes('includes ->');
      // Validate that indexOf for 8 is present in json/text of log
      // We can't guarantee formatting, but the log should contain 'indexOf' and 'includes'
      await app.waitForLogIncludes('indexOf ->');
    });

    test('Fill and copyWithin mutate array and log completion', async ({ page }) {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();
      await app.clearLog();

      await app.arrInput.fill('[0,1,2,3,4]');
      await app.createBtn.click();
      await app.waitForLogIncludes('Created array');

      await app.fillVal.fill('5');
      await app.fillStart.fill('1');
      await app.fillEnd.fill('3');
      await app.fillBtn.click();
      await app.waitForLogIncludes('fill done');

      // copyWithin
      await app.cwTarget.fill('0');
      await app.cwStart.fill('3');
      await app.cwEnd.fill('5');
      await app.copyWithinBtn.click();
      await app.waitForLogIncludes('copyWithin done');
    });

    test('Set length and Show .length work and are logged', async ({ page }) => {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();
      await app.clearLog();

      await app.arrInput.fill('[1,2,3,4,5]');
      await app.createBtn.click();
      await app.waitForLogIncludes('Created array');

      // set length smaller
      await app.lengthInput.fill('3');
      await app.setLengthBtn.click();
      await app.waitForLogIncludes('.length set to');
      let json = await app.getJsonOutText();
      // JSON should have 3 elements now
      const arrJson = JSON.parse(json);
      expect(arrJson.length).toBe(3);

      // show .length
      await app.showLengthBtn.click();
      await app.waitForLogIncludes('.length ->');
    });

    test('Export (Copy JSON) and Download .json produce log entries', async ({ page }) => {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();
      await app.clearLog();

      // Clicking Copy JSON may or may not succeed depending on browser clipboard support.
      await app.copyJsonBtn.click();
      // Either 'Copied JSON to clipboard' or fallback message with JSON should be logged
      await page.waitForTimeout(200); // small delay to allow clipboard promise resolution
      const logText = await app.log.textContent();
      expect(logText.length).toBeGreaterThan(0);
      expect(
        logText.includes('Copied JSON to clipboard') || logText.includes('Could not copy to clipboard')
      ).toBeTruthy();

      // Download
      await app.downloadBtn.click();
      await app.waitForLogIncludes('Downloaded array.json');
    });
  });

  test.describe('Typed Arrays and Edge/Error Scenarios', () => {
    test('Using typed arrays (Int32Array) and performing push/pop (conversion logic)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();
      await app.clearLog();

      // Choose Int32 typed array and create from input
      await app.arrType.selectOption('int32');
      await app.arrInput.fill('[1,2,3]');
      await app.createBtn.click();
      await app.waitForLogIncludes('Created array');

      // Push a value (should convert to normal list, then back)
      await app.pushVal.fill('4');
      await app.pushBtn.click();
      await app.waitForLogIncludes('push -> new length');

      const valsAfterPush = await app.getArrayValues();
      expect(valsAfterPush.some(v => v.includes('4'))).toBeTruthy();

      // Pop should also work
      await app.popBtn.click();
      await app.waitForLogIncludes('pop ->');
    });

    test('Invalid expressions and missing inputs are handled gracefully (error scenarios)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);
      await app.waitForAppReady();
      await app.clearLog();

      // Map with empty expression -> app should log request to provide expression
      await app.mapExpr.fill('');
      await app.mapBtn.click();
      await app.waitForLogIncludes('Provide a map expression');

      // Filter with malformed expression should lead to 'Invalid expression' or similar handling
      await app.filterExpr.fill('x ***');
      await app.filterBtn.click();
      // The buildFn will return null for bad syntax and the code logs 'Invalid expression'
      await app.waitForLogIncludes('Invalid expression');

      // Reduce with missing expression
      await app.reduceExpr.fill('');
      await app.reduceBtn.click();
      await app.waitForLogIncludes('Provide a reduce expression');

      // Trying to set negative length logs an error message and should not throw
      await app.lengthInput.fill('-5');
      await app.setLengthBtn.click();
      await app.waitForLogIncludes('Length must be >= 0');
    });
  });
});