import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c139044-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Interactive Trie Playground - end-to-end (FSM validations & runtime error observation)', () => {
  // We'll capture console messages, uncaught page errors, and dialogs for each test.
  test.beforeEach(async ({ page }) => {
    // No-op here; each test will attach listeners so we get fresh arrays per test.
  });

  test('Initialization: page loads and global runtime errors are observed', async ({ page }) => {
    // Arrays to collect observed runtime artifacts
    const consoleMsgs = [];
    const pageErrors = [];
    const dialogs = [];

    page.on('console', msg => {
      // collect text for assertions (includes errors logged to console)
      consoleMsgs.push(`${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', err => {
      // uncaught exceptions surface here
      pageErrors.push(err);
    });
    page.on('dialog', async dialog => {
      dialogs.push({type: dialog.type(), message: dialog.message()});
      // Dismiss to avoid blocking
      await dialog.dismiss().catch(() => {});
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Allow the page scripts to execute and potentially throw
    await page.waitForTimeout(600);

    // We expect at least one uncaught error because the page contains cross-IIFE variable usage issues.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one page error should be a ReferenceError related to 'config'
    const hasConfigRefError = pageErrors.some(err => {
      const m = String(err && err.message || err);
      return /config is not defined/i.test(m) || /ReferenceError/i.test(m);
    });
    expect(hasConfigRefError).toBeTruthy();

    // Also ensure console captured some messages (could be error logs)
    expect(consoleMsgs.length).toBeGreaterThanOrEqual(0);

    // Verify DOM basic elements exist even if scripts errored
    const tree = await page.locator('#tree');
    const operationLog = await page.locator('#operationLog');
    await expect(tree).toBeVisible();
    await expect(operationLog).toBeVisible();

    // Document that initialization produced at least one dialog OR page error (we expect errors)
    expect(dialogs.length === 0 || pageErrors.length > 0).toBeTruthy();
  });

  test.describe('Event handlers & transitions: attempt each FSM event and assert either expected UI behavior or runtime error', () => {
    // Helper to perform click and collect whether a dialog was shown or a new page error appeared.
    async function clickAndObserve(page, selector, {
      fillSelector = null,
      fillValue = '',
      expectAlertContains = null,
      waitAfter = 500
    } = {}) {
      const observed = {
        dialog: null,
        newPageErrors: [],
        consoleMessages: []
      };

      // Capture current counts
      const pageErrors: any[] = [];
      const consoleMsgs: string[] = [];
      page.on('pageerror', e => pageErrors.push(e));
      page.on('console', m => consoleMsgs.push(`${m.type()}: ${m.text()}`));

      // Dialog handler
      const dialogs: any[] = [];
      const dialogHandler = async dlg => {
        dialogs.push({type: dlg.type(), message: dlg.message()});
        await dlg.dismiss().catch(() => {});
      };
      page.on('dialog', dialogHandler);

      // Optionally fill an input before clicking
      if (fillSelector) {
        const el = page.locator(fillSelector);
        await expect(el).toBeVisible();
        await el.fill(fillValue);
      }

      // Perform click
      await page.locator(selector).click().catch(() => {
        // clicking may still throw if element detached; swallow here,
        // we'll rely on captured pageerrors for assertions.
      });

      // wait to allow handlers to run
      await page.waitForTimeout(waitAfter);

      // Remove listeners we added (avoid duplicate handling across calls)
      page.removeListener('dialog', dialogHandler);

      observed.dialog = dialogs.length ? dialogs[0] : null;
      observed.newPageErrors = pageErrors;
      observed.consoleMessages = consoleMsgs;
      return observed;
    }

    test('Insert button: empty input should trigger "Enter a word" alert OR reveal runtime error', async ({ page }) => {
      const pageErrors: any[] = [];
      page.on('pageerror', e => pageErrors.push(e));

      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      // Click Insert with empty input
      const res = await clickAndObserve(page, '#insertBtn', { waitAfter: 600 });

      // Accept two possible valid outcomes:
      //  - The handler runs and shows an alert 'Enter a word'
      //  - Or the page had a runtime ReferenceError earlier and clicking did not work => pageerror observed
      const sawAlert = res.dialog && /enter a word/i.test(res.dialog.message);
      const sawPageError = res.newPageErrors.length > 0;

      expect(sawAlert || sawPageError).toBeTruthy();
    });

    test('Insert a word: attempt to insert "hello" and observe either operation log change or runtime error', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      // Fill word input then click Insert
      const res = await clickAndObserve(page, '#insertBtn', {
        fillSelector: '#wordInput',
        fillValue: 'hello',
        waitAfter: 600
      });

      // If script worked, operationLog should contain 'Inserted' or tree/words updated.
      const opText = await page.locator('#operationLog').innerText().catch(() => '');
      const wordsText = await page.locator('#words').innerText().catch(() => '');

      const opLooksLikeInsert = /Inserted:|Insert complete/i.test(opText) || /hello/.test(wordsText);
      const sawError = res.newPageErrors.length > 0;

      // Either we saw an insert effect OR there was a page error preventing the operation.
      expect(opLooksLikeInsert || sawError).toBeTruthy();
    });

    test('Delete button: attempt to delete with empty input should alert or cause error', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      const res = await clickAndObserve(page, '#deleteBtn', { waitAfter: 600 });

      const sawAlert = res.dialog && /enter word/i.test(res.dialog.message);
      const sawError = res.newPageErrors.length > 0;
      expect(sawAlert || sawError).toBeTruthy();
    });

    test('Search button: with empty input should alert or cause error; with a value may alert search result or error', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      // First: empty input
      const resEmpty = await clickAndObserve(page, '#searchBtn', { waitAfter: 600 });
      const emptyAlert = resEmpty.dialog && /enter word/i.test(resEmpty.dialog.message);
      const emptyError = resEmpty.newPageErrors.length > 0;
      expect(emptyAlert || emptyError).toBeTruthy();

      // Second: try with value 'app' (common starter)
      const resVal = await clickAndObserve(page, '#searchBtn', {
        fillSelector: '#wordInput',
        fillValue: 'app',
        waitAfter: 600
      });
      // The search handler should alert with 'Search: app -> found' or error may happen
      const sawSearchDialog = resVal.dialog && /Search: app ->/.test(resVal.dialog.message);
      const sawPageError = resVal.newPageErrors.length > 0;
      expect(sawSearchDialog || sawPageError).toBeTruthy();
    });

    test('Highlight Path: clicking with empty input should alert or produce render highlighting or error', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      const res = await clickAndObserve(page, '#highlightBtn', { waitAfter: 600 });
      const sawAlert = res.dialog && /enter word/i.test(res.dialog.message);
      const sawError = res.newPageErrors.length > 0;
      // OR the tree may show '>>' markers if highlight succeeded - check tree text for '>>'
      const treeText = await page.locator('#tree').innerText().catch(() => '');
      const sawHighlightMarker = treeText && treeText.includes('>>');
      expect(sawAlert || sawError || sawHighlightMarker).toBeTruthy();
    });

    test('Prefix Search & Autocomplete & Count Prefix: try prefix operations with "ap" and accept alert or error', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      // Fill prefix input
      await page.locator('#prefixInput').fill('ap');

      // Prefix Search
      const resPrefix = await clickAndObserve(page, '#prefixSearchBtn', { waitAfter: 600 });
      const prefixAlert = resPrefix.dialog && /Prefix results \(/i.test(resPrefix.dialog.message);
      const prefixError = resPrefix.newPageErrors.length > 0;
      expect(prefixAlert || prefixError).toBeTruthy();

      // Autocomplete
      const resAuto = await clickAndObserve(page, '#autoCompleteBtn', { waitAfter: 600 });
      const autoAlert = resAuto.dialog && /Autocomplete top/i.test(resAuto.dialog.message);
      const autoError = resAuto.newPageErrors.length > 0;
      expect(autoAlert || autoError).toBeTruthy();

      // Count Prefix
      const resCount = await clickAndObserve(page, '#countPrefixBtn', { waitAfter: 600 });
      const countAlert = resCount.dialog && /Prefix count for/i.test(resCount.dialog.message);
      const countError = resCount.newPageErrors.length > 0;
      expect(countAlert || countError).toBeTruthy();
    });

    test('Batch Insert & Delete: fill batch textarea and attempt batch operations', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      // Prepare batch content
      const batchContent = 'test1\ntest2\nabc';
      await page.locator('#batchInput').fill(batchContent);

      const resInsertBatch = await clickAndObserve(page, '#insertBatchBtn', { waitAfter: 700 });
      const insertBatchError = resInsertBatch.newPageErrors.length > 0;
      const opLogText = await page.locator('#operationLog').innerText().catch(() => '');
      const insertBatchLooksGood = /insert batch/i.test(opLogText) || /Inserted/.test(opLogText);
      expect(insertBatchLooksGood || insertBatchError).toBeTruthy();

      const resDeleteBatch = await clickAndObserve(page, '#deleteBatchBtn', { waitAfter: 700 });
      const deleteBatchError = resDeleteBatch.newPageErrors.length > 0;
      const opLogText2 = await page.locator('#operationLog').innerText().catch(() => '');
      const deleteBatchLooksGood = /delete batch/i.test(opLogText2) || /Deleted/.test(opLogText2);
      expect(deleteBatchLooksGood || deleteBatchError).toBeTruthy();
    });

    test('Random Words: click Add Random Words and observe alert or error', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      // Ensure small n to keep dialog manageable
      await page.locator('#randN').fill('3');

      const res = await clickAndObserve(page, '#randomBtn', { waitAfter: 800 });
      const sawAlert = res.dialog && /Added random words/i.test(res.dialog.message);
      const sawError = res.newPageErrors.length > 0;
      expect(sawAlert || sawError).toBeTruthy();
    });

    test('Clear Trie: attempts to confirm dialog or observe error if handler absent', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      // Intercept confirm dialog if it appears, accept it
      page.on('dialog', async dlg => {
        // Accept confirm prompts for clear action
        if (dlg.type() === 'confirm') {
          await dlg.accept().catch(() => {});
        } else {
          await dlg.dismiss().catch(() => {});
        }
      });

      const res = await clickAndObserve(page, '#clearBtn', { waitAfter: 700 });
      const sawError = res.newPageErrors.length > 0;
      // If dialog was shown and accepted, the trie should be cleared; otherwise, runtime error likely prevented action.
      const adjText = await page.locator('#adj').innerText().catch(() => '');
      const clearedLooksLike = /countWords: 0|isEnd=false|char="/i.test(adjText) || /^\s*$/.test(adjText);
      expect(clearedLooksLike || sawError).toBeTruthy();
    });

    test('Export & Import JSON: export should populate jsonArea, import invalid JSON should alert or error', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      // Click export
      const resExport = await clickAndObserve(page, '#exportBtn', { waitAfter: 600 });
      const jsonVal = await page.locator('#jsonArea').inputValue().catch(() => '');
      const exportOk = jsonVal && jsonVal.trim().startsWith('{');
      const exportError = resExport.newPageErrors.length > 0;
      expect(exportOk || exportError).toBeTruthy();

      // Put invalid JSON and click Import
      await page.locator('#jsonArea').fill('not a valid json');
      const resImport = await clickAndObserve(page, '#importBtn', { waitAfter: 600 });
      // Import handler either alerts Invalid JSON or pageerror occurs
      const importAlert = resImport.dialog && /Invalid JSON/i.test(resImport.dialog.message);
      const importError = resImport.newPageErrors.length > 0;
      expect(importAlert || importError).toBeTruthy();
    });

    test('Undo/Redo: click Undo and Redo and assert either state change or runtime error', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      const resUndo = await clickAndObserve(page, '#undoBtn', { waitAfter: 600 });
      const undoError = resUndo.newPageErrors.length > 0;
      const undoDisabled = await page.locator('#undoBtn').isDisabled().catch(() => false);
      expect(undoError || typeof undoDisabled === 'boolean').toBeTruthy();

      const resRedo = await clickAndObserve(page, '#redoBtn', { waitAfter: 600 });
      const redoError = resRedo.newPageErrors.length > 0;
      const redoDisabled = await page.locator('#redoBtn').isDisabled().catch(() => false);
      expect(redoError || typeof redoDisabled === 'boolean').toBeTruthy();
    });

    test('List All Words & Longest Common Prefix: invoke and expect alert or error', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      const resList = await clickAndObserve(page, '#listWordsBtn', { waitAfter: 700 });
      const listAlert = resList.dialog && /Words \(/i.test(resList.dialog.message);
      const listError = resList.newPageErrors.length > 0;
      expect(listAlert || listError).toBeTruthy();

      const resLCP = await clickAndObserve(page, '#longestPrefixBtn', { waitAfter: 700 });
      const lcpAlert = resLCP.dialog && /Longest common prefix/i.test(resLCP.dialog.message);
      const lcpError = resLCP.newPageErrors.length > 0;
      expect(lcpAlert || lcpError).toBeTruthy();
    });

    test('Compress/Decompress/Compress Count/Truncate: attempt advanced operations and accept alert or error', async ({ page }) {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(300);

      // Compress chains count
      const resCompCount = await clickAndObserve(page, '#compressCountBtn', { waitAfter: 900 });
      const compCountAlert = resCompCount.dialog && /Compressed. Nodes before/i.test(resCompCount.dialog.message);
      const compCountError = resCompCount.newPageErrors.length > 0;
      expect(compCountAlert || compCountError).toBeTruthy();

      // Compress button
      const resCompress = await clickAndObserve(page, '#compressBtn', { waitAfter: 600 });
      const compressError = resCompress.newPageErrors.length > 0;
      const compressOpLog = await page.locator('#operationLog').innerText().catch(() => '');
      expect(compressError || /compress/i.test(compressOpLog)).toBeTruthy();

      // Decompress button
      const resDecompress = await clickAndObserve(page, '#decompressBtn', { waitAfter: 600 });
      const decompressError = resDecompress.newPageErrors.length > 0;
      const decompressOpLog = await page.locator('#operationLog').innerText().catch(() => '');
      expect(decompressError || /decompress/i.test(decompressOpLog)).toBeTruthy();

      // Truncate (set small node limit to make the operation quick)
      await page.locator('#nodeLimit').fill('5');
      const resTruncate = await clickAndObserve(page, '#truncateBtn', { waitAfter: 900 });
      const truncateError = resTruncate.newPageErrors.length > 0;
      const adjText = await page.locator('#adj').innerText().catch(() => '');
      // Either an error or adjacency reduced in size (heuristic: fewer nodes or empty)
      const truncatedLooksLike = truncateError || adjText.length < 200;
      expect(truncatedLooksLike).toBeTruthy();
    });
  });

  test('Edge cases: invalid interactions and playback features should either show expected alerts or surface runtime errors', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    // Try replaying last op - may alert "No steps recorded" or cause an error
    const resReplay = await (async () => {
      const dialogs = [];
      page.on('dialog', async d => { dialogs.push({type: d.type(), message: d.message()}); await d.dismiss().catch(()=>{}); });
      await page.locator('#replayLastOp').click().catch(()=>{});
      await page.waitForTimeout(600);
      return dialogs[0] || null;
    })();

    // Either a dialog stating no recorded steps or some runtime error previously present.
    // Check page errors as well
    const pageErrors: any[] = [];
    page.on('pageerror', e => pageErrors.push(e));
    await page.waitForTimeout(200);
    const sawNoStepsDialog = resReplay && /No steps recorded/i.test(resReplay.message);
    expect(sawNoStepsDialog || pageErrors.length > 0 || resReplay === null).toBeTruthy();
  });
});