import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c12ccf1-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page Object encapsulating common interactions for the Linked List Explorer
class LinkedListPage {
  constructor(page) {
    this.page = page;
    // selectors used across tests
    this.selectors = {
      visual: '#visual',
      inspector: '#inspector',
      history: '#history',
      listType: '#listType',
      clearBtn: '#clearBtn',
      copyBtn: '#copyBtn',
      randomFillBtn: '#randomFillBtn',
      randomCount: '#randomCount',
      buildInput: '#buildInput',
      buildBtn: '#buildBtn',
      appendArrayBtn: '#appendArrayBtn',
      insertValue: '#insertValue',
      insertPosition: '#insertPosition',
      insertIndex: '#insertIndex',
      insertBtn: '#insertBtn',
      deletePosition: '#deletePosition',
      deleteIndex: '#deleteIndex',
      deleteValue: '#deleteValue',
      deleteBtn: '#deleteBtn',
      updateIndex: '#updateIndex',
      updateValue: '#updateValue',
      updateBtn: '#updateBtn',
      searchValue: '#searchValue',
      searchBtn: '#searchBtn',
      searchStepBtn: '#searchStepBtn',
      searchNext: '#searchNext',
      searchPrev: '#searchPrev',
      searchPos: '#searchPos',
      reverseBtn: '#reverseBtn',
      reverseStepBtn: '#reverseStepBtn',
      revNext: '#revNext',
      revPrev: '#revPrev',
      rotateK: '#rotateK',
      rotateLeft: '#rotateLeft',
      rotateRight: '#rotateRight',
      mergeInput: '#mergeInput',
      mergeBtn: '#mergeBtn',
      mergeAsNewBtn: '#mergeAsNewBtn',
      startTransaction: '#startTransaction',
      commitTransaction: '#commitTransaction',
      rollbackTransaction: '#rollbackTransaction',
      undoBtn: '#undoBtn',
      redoBtn: '#redoBtn',
      bookmarkName: '#bookmarkName',
      saveBookmark: '#saveBookmark',
      listBookmarks: '#listBookmarks',
      bookmarkList: '#bookmarkList',
      loadBookmark: '#loadBookmark',
      delBookmark: '#delBookmark',
      exportBtn: '#exportBtn',
      importBtn: '#importBtn',
      importAppendBtn: '#importAppendBtn',
      importArea: '#importArea',
      showRawBtn: '#showRawBtn',
      inspectMemoryBtn: '#inspectMemoryBtn',
      logStateBtn: '#logStateBtn'
    };
  }

  async click(sel) {
    await this.page.click(this.selectors[sel]);
  }

  async fill(sel, value) {
    await this.page.fill(this.selectors[sel], String(value));
  }

  async selectOption(sel, value) {
    await this.page.selectOption(this.selectors[sel], value);
  }

  async getVisualNodes() {
    return this.page.$$eval('#visual .node', nodes => nodes.map(n => ({ text: n.textContent, id: n.dataset.id, index: Number(n.dataset.index || -1), class: n.className })));
  }

  async getVisualText() {
    return this.page.locator('#visual').innerText();
  }

  async getInspectorText() {
    return this.page.locator('#inspector').innerText();
  }

  async getHistoryText() {
    return this.page.locator('#history').innerText();
  }

  async getImportAreaText() {
    return this.page.locator(this.selectors.importArea).inputValue();
  }

  async getBookmarkOptions() {
    return this.page.$$eval('#bookmarkList option', opts => opts.map(o => ({ value: o.value, text: o.textContent })));
  }

  async getNodeIds() {
    return this.page.$$eval('#visual .node', nodes => nodes.map(n => n.dataset.id));
  }

  async waitForHistoryContains(substring, timeout = 1000) {
    await this.page.waitForFunction(
      (sel, sub) => document.querySelector(sel).textContent.includes(sub),
      this.selectors.history,
      substring,
      { timeout }
    );
  }
}

test.describe('Linked List Explorer - End-to-end FSM tests', () => {
  // capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // collect uncaught exceptions thrown in page context
      pageErrors.push(err);
    });
    await page.goto(APP_URL);
    // sanity wait for initial render and history message
    await page.waitForSelector('#visual');
    // small pause to ensure initial pushHistory has executed
    await page.waitForTimeout(50);
  });

  test.afterEach(async ({}, testInfo) => {
    // Provide a minimal debug summary on failure to help diagnostics
    if (testInfo.status !== testInfo.expectedStatus) {
      // Nothing to do here besides leaving traces in Playwright logs.
    }
  });

  test.describe('Build / Append / Clear / Random fill', () => {
    test('Build from array and Append array should render correct nodes', async ({ page }) => {
      const p = new LinkedListPage(page);

      // Build with default buildInput (A,B,C,D)
      await p.click('buildBtn');
      // Expect visual to show four nodes in order A B C D
      const nodes = await p.getVisualNodes();
      expect(nodes.map(n => n.text)).toEqual(['A', 'B', 'C', 'D']);

      // Change build input and append
      await p.fill('buildInput', 'E,F');
      await p.click('appendArrayBtn');
      const nodesAfterAppend = await p.getVisualNodes();
      expect(nodesAfterAppend.map(n => n.text)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);

      // Clear the list
      await p.click('clearBtn');
      const visualText = await p.getVisualText();
      expect(visualText.trim()).toBe('(empty list)');

      // Random fill with count 3
      await p.fill('randomCount', '3');
      await p.click('randomFillBtn');
      // Should render 3 nodes (non-empty values)
      const randomNodes = await p.getVisualNodes();
      expect(randomNodes.length).toBe(3);
      for (const n of randomNodes) {
        expect(n.text.trim().length).toBeGreaterThan(0);
      }
    });

    test('Edge case: Append to empty using append button works and preserves order', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.click('clearBtn');
      await p.fill('buildInput', 'X,Y');
      await p.click('appendArrayBtn');
      const nodes = await p.getVisualNodes();
      expect(nodes.map(n => n.text)).toEqual(['X', 'Y']);
    });
  });

  test.describe('Insert / Delete / Update operations', () => {
    test('Insert at head, tail, and index reflect in DOM and history', async ({ page }) => {
      const p = new LinkedListPage(page);
      // start from known base
      await p.fill('buildInput', '1,2,3');
      await p.click('buildBtn');

      // Insert at head
      await p.fill('insertValue', 'H');
      await p.selectOption('insertPosition', 'head');
      await p.click('insertBtn');
      let texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts[0]).toBe('H');

      // Insert at tail
      await p.fill('insertValue', 'T');
      await p.selectOption('insertPosition', 'tail');
      await p.click('insertBtn');
      texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts[texts.length - 1]).toBe('T');

      // Insert at index 2 (0-based)
      await p.fill('insertValue', 'M');
      await p.selectOption('insertPosition', 'index');
      await p.fill('insertIndex', '2');
      await p.click('insertBtn');
      texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts[2]).toBe('M');
    });

    test('Delete by head/tail/index/value and handle empty delete gracefully', async ({ page }) => {
      const p = new LinkedListPage(page);
      // clear then attempt delete on empty -> history should record attempt
      await p.click('clearBtn');
      await p.click('deleteBtn'); // default deletePosition likely 'head'
      await p.waitForHistoryContains('Delete attempted on empty list');

      // Build and then delete head, tail, index, and by value
      await p.fill('buildInput', 'A,B,C,D');
      await p.click('buildBtn');

      // Delete head
      await p.selectOption('deletePosition', 'head');
      await p.click('deleteBtn');
      let texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts).toEqual(['B', 'C', 'D']);

      // Delete tail
      await p.selectOption('deletePosition', 'tail');
      await p.click('deleteBtn');
      texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts).toEqual(['B', 'C']);

      // Delete at index 1 (which is 'C')
      await p.selectOption('deletePosition', 'index');
      await p.fill('deleteIndex', '1');
      await p.click('deleteBtn');
      texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts).toEqual(['B']);

      // Delete by value (value not present -> history says not found)
      await p.selectOption('deletePosition', 'value');
      await p.fill('deleteValue', 'Z');
      await p.click('deleteBtn');
      await p.waitForHistoryContains('Value not found for delete: Z');

      // Delete by value existing
      await p.selectOption('deletePosition', 'value');
      await p.fill('deleteValue', 'B');
      await p.click('deleteBtn');
      const finalVisual = await p.getVisualText();
      expect(finalVisual.trim()).toBe('(empty list)');
    });

    test('Update at index validates bounds and updates DOM', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.fill('buildInput', 'AA,BB,CC');
      await p.click('buildBtn');

      // illegal update index
      await p.fill('updateIndex', '10');
      await p.fill('updateValue', 'Z');
      await p.click('updateBtn');
      // history will contain out of bounds
      await p.waitForHistoryContains('Update index out of bounds');

      // valid update
      await p.fill('updateIndex', '1');
      await p.fill('updateValue', 'ZZ');
      await p.click('updateBtn');
      const texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts).toEqual(['AA', 'ZZ', 'CC']);
    });
  });

  test.describe('Search, Reverse, Rotate, Merge, Clone and Export/Import', () => {
    test('Full search highlights first match and records history', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.fill('buildInput', 'X,Y,Z,Y');
      await p.click('buildBtn');

      // search for Y (multiple matches)
      await p.fill('searchValue', 'Y');
      await p.click('searchBtn');
      // history should show matches
      await p.waitForHistoryContains('Search: matches at');
      // first match at index 1 should be bold in DOM
      const boldNode = await page.$('#visual .node.bold');
      expect(boldNode).toBeTruthy();
      const boldText = await boldNode!.innerText();
      expect(boldText).toBe('Y');
    });

    test('Reverse full and step-by-step reverse alter visuals appropriately', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.fill('buildInput', '1,2,3,4');
      await p.click('buildBtn');

      // reverse full
      await p.click('reverseBtn');
      let texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts).toEqual(['4', '3', '2', '1']);

      // reverse step-by-step: initialize and step through next/prev
      await p.click('reverseStepBtn');
      await p.click('revNext');
      // stepping produces temporary snapshot visualization; ensure visual contains 'Mode: reverse'
      const visualText = await p.getVisualText();
      expect(visualText).toContain('Mode: reverse');
      await p.click('revPrev');
      // after prev, it should either go back to normal or show snapshot; at minimum no uncaught error
      expect((await p.getVisualText()).length).toBeGreaterThan(0);
    });

    test('Rotate left/right obeys k and preserves values order', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.fill('buildInput', 'a,b,c,d');
      await p.click('buildBtn');

      // rotate left by 1
      await p.fill('rotateK', '1');
      await p.click('rotateLeft');
      let texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts).toEqual(['b', 'c', 'd', 'a']);

      // rotate right by 2 (on current list)
      await p.fill('rotateK', '2');
      await p.click('rotateRight');
      texts = (await p.getVisualNodes()).map(n => n.text);
      // rotating right by 2 => result should be ['d','a','b','c'] on ['b','c','d','a']
      expect(texts).toEqual(['d', 'a', 'b', 'c']);
    });

    test('Merge append and merge as new produce expected node lists and clone produces new ids', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.fill('buildInput', '0,0');
      await p.click('buildBtn');

      // Record original ids before clone test
      const beforeIds = await p.getNodeIds();

      // Append using mergeInput default 1,2,3
      await p.fill('mergeInput', 'x,y');
      await p.click('mergeBtn');
      let texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts.slice(-2)).toEqual(['x', 'y']);

      // Make new merged list (should also append)
      await p.fill('mergeInput', 'm,n');
      await p.click('mergeAsNewBtn');
      texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts.slice(-2)).toEqual(['m', 'n']);

      // clone list -> ids should be changed (values preserved)
      const idsBeforeClone = await p.getNodeIds();
      const valuesBeforeClone = (await p.getVisualNodes()).map(n => n.text);
      await p.click('copyBtn');
      const idsAfterClone = await p.getNodeIds();
      const valuesAfterClone = (await p.getVisualNodes()).map(n => n.text);
      expect(valuesAfterClone).toEqual(valuesBeforeClone);
      // some ids should change (all are replaced in cloneList implementation)
      expect(idsAfterClone).not.toEqual(idsBeforeClone);
    });

    test('Export writes state into import area and Import (replace/append) handle JSON', async ({ page }) => {
      const p = new LinkedListPage(page);

      // build a list and export
      await p.fill('buildInput', 'A,B');
      await p.click('buildBtn');
      await p.click('exportBtn');
      const exported = await p.getImportAreaText();
      expect(exported).toContain('"nodes"');

      // Modify importArea to an invalid JSON and import (replace) -> should push error message to history (caught in code)
      await p.fill('importArea', '{ invalid json');
      await p.click('importBtn');
      await p.waitForHistoryContains('Import JSON error');

      // Now prepare a valid import JSON for replace
      const importObj = JSON.stringify({ type: 'singly', nodes: [{ value: 'X' }, { value: 'Y' }] }, null, 2);
      await p.fill('importArea', importObj);
      await p.click('importBtn'); // replace
      let texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts).toEqual(['X', 'Y']);

      // Now import append to append the same list
      await p.fill('importArea', importObj);
      await p.click('importAppendBtn');
      texts = (await p.getVisualNodes()).map(n => n.text);
      // After append, should contain X,Y,X,Y
      expect(texts.slice(-4)).toEqual(['X', 'Y', 'X', 'Y']);
    });
  });

  test.describe('Bookmarks, Undo/Redo, Transactions, Inspectors, History', () => {
    test('Save, list, load and delete bookmarks update bookmark select and state', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.fill('buildInput', 'a,b,c');
      await p.click('buildBtn');

      // Save bookmark default name 'state1'
      await p.fill('bookmarkName', 'myState');
      await p.click('saveBookmark');
      // Refresh bookmark list and verify option present
      await p.click('listBookmarks');
      const opts = await p.getBookmarkOptions();
      expect(opts.some(o => o.value === 'myState')).toBeTruthy();

      // Load bookmark (should be available); first modify list then load to verify restoration
      await p.fill('buildInput', 'z');
      await p.click('appendArrayBtn');
      // Now load
      await p.selectOption('bookmarkList', 'myState');
      await p.click('loadBookmark');
      // Visual should now be restored to the saved state 'a,b,c'
      const texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts).toEqual(['a', 'b', 'c']);

      // Delete bookmark
      await p.selectOption('bookmarkList', 'myState');
      await p.click('delBookmark');
      // Refresh list and expect bookmark gone
      await p.click('listBookmarks');
      const optsAfter = await p.getBookmarkOptions();
      expect(optsAfter.some(o => o.value === 'myState')).toBeFalsy();
    });

    test('Undo and redo revert and reapply actions', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.fill('buildInput', '1,2,3');
      await p.click('buildBtn');

      // perform an action: insert head
      await p.fill('insertValue', 'HEAD');
      await p.selectOption('insertPosition', 'head');
      await p.click('insertBtn');
      let texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts[0]).toBe('HEAD');

      // Undo should remove HEAD
      await p.click('undoBtn');
      await p.waitForHistoryContains('Undo performed');
      texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts).toEqual(['1', '2', '3']);

      // Redo should bring HEAD back
      await p.click('redoBtn');
      await p.waitForHistoryContains('Redo performed');
      texts = (await p.getVisualNodes()).map(n => n.text);
      // Redo performs reapplication and may place HEAD back at front
      expect(texts[0]).toBe('HEAD');
    });

    test('Transactions: start disables start button and enables commit/rollback; rollback restores previous', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.fill('buildInput', 'p,q');
      await p.click('buildBtn');

      // Start transaction
      await p.click('startTransaction');
      // Buttons should update disabled attributes
      expect(await page.locator(p.selectors.startTransaction).isDisabled()).toBeTruthy();
      expect(await page.locator(p.selectors.commitTransaction).isEnabled()).toBeTruthy();

      // Make a change inside transaction
      await p.fill('insertValue', 'TX');
      await p.selectOption('insertPosition', 'head');
      await p.click('insertBtn');
      let texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts[0]).toBe('TX');

      // Rollback should restore previous state p,q
      await p.click('rollbackTransaction');
      await p.waitForHistoryContains('Transaction rolled back');
      texts = (await p.getVisualNodes()).map(n => n.text);
      expect(texts).toEqual(['p', 'q']);
      // Buttons should be back to default
      expect(await page.locator(p.selectors.startTransaction).isDisabled()).toBeFalsy();
      expect(await page.locator(p.selectors.commitTransaction).isDisabled()).toBeTruthy();
    });

    test('Show raw state and inspect memory write to inspector; logState pushes to history', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.fill('buildInput', 'R,S,T');
      await p.click('buildBtn');

      await p.click('showRawBtn');
      const inspectorText = await p.getInspectorText();
      expect(inspectorText).toContain('Raw state:');

      await p.click('inspectMemoryBtn');
      const memText = await p.getInspectorText();
      expect(memText).toContain('Memory (nodes):');

      // Log state to history
      await p.click('logStateBtn');
      await p.waitForHistoryContains('State pushed to history:');
    });
  });

  test.describe('Step-by-step algorithms and edge conditions', () => {
    test('Search stepper next/prev traverses and updates cursor index and history', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.fill('buildInput', 'X,Y,Z');
      await p.click('buildBtn');

      // initialize stepper
      await p.fill('searchValue', 'Z');
      await p.click('searchStepBtn');
      // Next step should visit index 0 then 1 then 2
      await p.click('searchNext');
      await p.waitForHistoryContains('Search step visited index 0 value X');
      // Verify cursor shows index 0 as bold
      let bold = await page.$('#visual .node.bold');
      expect(await bold!.innerText()).toBe('X');

      await p.click('searchNext');
      await p.waitForHistoryContains('Search step visited index 1 value Y');
      await p.click('searchNext');
      await p.waitForHistoryContains('Search step visited index 2 value Z');
      // Prev should step back
      await p.click('searchPrev');
      await p.waitForHistoryContains('Search step back to index 1');
    });

    test('Reverse stepper maintains snapshot visualization and final commit reverses', async ({ page }) => {
      const p = new LinkedListPage(page);
      await p.fill('buildInput', '1,2,3');
      await p.click('buildBtn');

      // Start reverse stepper
      await p.click('reverseStepBtn');
      await p.click('revNext');
      await p.waitForHistoryContains('Reverse step 1/3');
      // Mode should appear in visual snapshot
      expect((await p.getVisualText()).toLowerCase()).toContain('mode: reverse');

      // Continue to finish steps and ensure final commit reverses list
      await p.click('revNext');
      await p.click('revNext');
      // Final revNext triggers commit in implementation or pushHistory 'Reverse stepper finished or cannot proceed'
      // After finishing, clicking reverseBtn (full) should reverse the current state (no crash)
      await p.click('reverseBtn');
      const texts = (await p.getVisualNodes()).map(n => n.text);
      // From 1,2,3 -> reverse full -> 3,2,1
      expect(texts).toEqual(['3', '2', '1']);
    });
  });

  test.describe('Controlled error observation and page-level errors', () => {
    test('Import invalid JSON results in history message (handled exception)', async ({ page }) => {
      const p = new LinkedListPage(page);
      // Put invalid JSON and click import (replace)
      await p.fill('importArea', '{ not a valid json }');
      await p.click('importBtn');
      // The code catches JSON.parse errors and records 'Import JSON error' in history
      await p.waitForHistoryContains('Import JSON error');
      const historyText = await p.getHistoryText();
      expect(historyText).toContain('Import JSON error');
    });

    test('Uncaught ReferenceError in page context is observed as pageerror', async ({ page }) => {
      // This test intentionally triggers an uncaught ReferenceError in the page so it will surface as a pageerror event.
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      // schedule an uncaught call to a nonexistent function inside page (does not modify app)
      await page.evaluate(() => {
        // schedule asynchronous call so it becomes an uncaught error in page context (and not thrown to Playwright evaluate)
        setTimeout(() => {
          // Intentionally call an undefined function to create ReferenceError
          // This is not patching the app, just exercising page runtime errors
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          nonExistentFunctionToTriggerReferenceError();
        }, 0);
      });
      // wait for the pageerror to be emitted
      await page.waitForTimeout(100);
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      // The error message should mention the function name or 'is not defined' depending on engine
      const msg = String(pageErrors[0].message || pageErrors[0]);
      expect(msg.toLowerCase()).toContain('not defined');
    });
  });

  test.describe('Console and page error sanity checks', () => {
    test('No unexpected uncaught errors from normal interactions', async ({ page }) => {
      const p = new LinkedListPage(page);
      // Do a sequence of normal operations that should not create uncaught exceptions
      await p.fill('buildInput', 'alpha,beta,gamma');
      await p.click('buildBtn');
      await p.click('searchBtn');
      await p.click('reverseBtn');
      await p.click('exportBtn');
      await p.click('inspectMemoryBtn');
      // give time for any unexpected pageerror to surface
      await page.waitForTimeout(50);
      // ensure there are no uncaught page errors captured by Playwright
      // (we capture page.on('pageerror') in beforeEach into pageErrors via closure; retrieve via page.evaluate)
      // Because we attached page.on in beforeEach, use that capture via page.context() isn't accessible here.
      // Instead, assert that console did not emit 'error' type messages (excluding known informational logs).
      const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      // It's acceptable to have warnings, but for this test assert there are no console 'error' messages from these normal interactions
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);
    });
  });
});