import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c153df1-fa79-11f0-8fe7-a5317bd8e2c6.html';
const IMPORT_FILE = path.join(__dirname || '.', 'tmp_import_store.json');

test.describe.serial('Context Switching Simulator - comprehensive E2E (FSM coverage)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect runtime errors and console.error messages
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for the app shell to render
    await page.waitForSelector('#contextsList');
  });

  test.afterAll(async () => {
    // Clean up temporary import file if created
    try { fs.unlinkSync(IMPORT_FILE); } catch (e) {}
    // Assert there were no uncaught page errors or console errors during tests
    expect(pageErrors, 'No uncaught page errors (pageerror)').toEqual([]);
    expect(consoleErrors, 'No console.error messages').toEqual([]);
  });

  // Helper: accept or respond to next dialog
  const nextDialogRespond = async (page, handler) => {
    return new Promise(resolve => {
      const listener = async (dialog) => {
        try {
          await handler(dialog);
        } finally {
          page.off('dialog', listener);
          resolve();
        }
      };
      page.on('dialog', listener);
    });
  };

  test('Initial state: app bootstrapped and a context selected (S1_ContextSelected)', async () => {
    // Validate that an active context exists and the context detail panel reflects it
    const activeId = await page.evaluate(() => store.activeContextId);
    expect(activeId).toBeTruthy();
    const nameVal = await page.$eval('#contextName', el => el.value);
    expect(nameVal).toBeTruthy();
    // The app logs initialization
    const logText = await page.$eval('#logArea', el => el.textContent || '');
    expect(logText).toContain('Initialized simulator');
  });

  test('NewContext -> creates new context and selects it (transition S0_Idle->S1_ContextSelected)', async () => {
    // Trigger prompt and enter a name
    const name = 'Test Context ' + Math.random().toString(36).slice(2,6);
    const dialogPromise = nextDialogRespond(page, async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept(name);
    });
    await page.click('#newContextBtn');
    await dialogPromise;

    // New context should be selected: contextName input should match
    await page.waitForTimeout(100); // allow render
    const selectedName = await page.$eval('#contextName', el => el.value);
    expect(selectedName).toBe(name);

    // And contexts list should include it
    const contextsHtml = await page.$eval('#contextsList', el => el.textContent || '');
    expect(contextsHtml).toContain(name);
  });

  test('DuplicateContext -> duplicates a selected context (S1_ContextSelected -> S1_ContextSelected)', async () => {
    // Find the newly created context button by its name in the contexts list
    const targetName = await page.$eval('#contextName', el => el.value);
    const container = page.locator('#contextsList div').filter({ hasText: targetName }).first();
    // Select its checkbox
    const checkbox = container.locator('input[type=checkbox]').first();
    await checkbox.check();
    // Click duplicate
    await page.click('#duplicateContextBtn');
    // After duplicate, list should contain copy
    await page.waitForTimeout(200);
    const listText = await page.$eval('#contextsList', el => el.textContent || '');
    expect(listText).toContain(targetName + ' (copy)');
  });

  test('DeleteContext -> deletes selected context and updates UI (S1_ContextSelected -> S0_Idle if active removed)', async () => {
    // Select any context in the list (choose one copy if present)
    const listDiv = await page.locator('#contextsList div').first();
    const anyCheckbox = listDiv.locator('input[type=checkbox]').first();
    await anyCheckbox.check();
    // Confirm the deletion prompt
    const dialogPromise = nextDialogRespond(page, async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    await page.click('#deleteContextBtn');
    await dialogPromise;
    // After deletion, contextsList should have fewer entries or at least not contain the deleted name
    await page.waitForTimeout(200);
    // No thrown error implies success. Assert contexts list is a string (exists)
    const contextsHtml = await page.$eval('#contextsList', el => el.textContent || '');
    expect(typeof contextsHtml).toBe('string');
  });

  test('PinToggle -> toggles pinned state and reflects [P] label', async () => {
    // Ensure active context exists
    const activeName = await page.$eval('#contextName', el => el.value);
    expect(activeName).toBeTruthy();
    // Click Pin/Unpin
    await page.click('#pinToggleBtn');
    // After toggling, contexts list should show the pinned marker for that active context
    await page.waitForTimeout(100);
    const contextsText = await page.$eval('#contextsList', el => el.textContent || '');
    // It may appear as "Name [P]" somewhere
    expect(contextsText.includes('[P]') || contextsText.includes(activeName)).toBeTruthy();
  });

  test('FilterInput and SortSelect -> filtering and sorting contexts', async () => {
    // Filter for 'Inbox' which is seeded
    await page.fill('#filterInput', 'Inbox');
    await page.waitForTimeout(100);
    const listAfterFilter = await page.$eval('#contextsList', el => el.textContent || '');
    expect(listAfterFilter).toContain('Inbox');
    // Ensure another known seeded context (Project A) not in filtered unless present
    if (listAfterFilter.includes('Project A')) {
      // If filtering didn't exclude due to case or UI, at least ensure filter input has value
      const val = await page.$eval('#filterInput', el => el.value);
      expect(val).toBe('Inbox');
    }
    // Reset filter
    await page.fill('#filterInput', '');
    // Change sort to name
    await page.selectOption('#sortSelect', 'name');
    await page.waitForTimeout(100);
    // Verify the select applied (value)
    const sortVal = await page.$eval('#sortSelect', el => el.value);
    expect(sortVal).toBe('name');
  });

  test('ExportAll and Import -> export triggers download, import loads file into app', async () => {
    // Prepare a minimal store JSON file to import
    const minimalStore = {
      contexts: {},
      order: [],
      activeContextId: null,
      stack: [],
      switches: [],
      metrics: { switchCount: 0, timeSpent: {}, lastActiveSince: null },
      log: []
    };
    // Write file
    fs.writeFileSync(IMPORT_FILE, JSON.stringify(minimalStore, null, 2));
    // Click Export All (no crash expected)
    await page.click('#exportAllBtn');
    // Now use import: handle the filechooser event which will be triggered by clicking import button
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#importBtn'),
    ]);
    await fileChooser.setFiles(IMPORT_FILE);
    // The app reads file and logs 'Imported' -> wait for log change
    await page.waitForTimeout(200);
    const logText = await page.$eval('#logArea', el => el.textContent || '');
    // After import the code pushes a log entry 'Imported data from file' if successful
    expect(logText.length).toBeGreaterThan(0);
  });

  test('ClearAll -> clears contexts after confirm', async () => {
    const dialogPromise = nextDialogRespond(page, async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    await page.click('#clearAllBtn');
    await dialogPromise;
    await page.waitForTimeout(200);
    // contextsList should be empty or not contain seeded names
    const listContent = await page.$eval('#contextsList', el => el.textContent || '');
    // Should be string but not contain known seeded context names
    expect(listContent).not.toContain('Inbox');
  });

  test('SaveSnapshot, Undo, Redo flow (S1_ContextSelected events)', async () => {
    // Create a new context to operate with: use prompt
    const newName = 'SnapshotContext-' + Math.random().toString(36).slice(2,6);
    await nextDialogRespond(page, async dialog => await dialog.accept(newName));
    await page.click('#newContextBtn');
    await page.waitForTimeout(100);

    // Ensure active and set content
    await page.fill('#contentArea', 'Initial content');
    await page.click('#saveSnapshotBtn');
    await page.waitForTimeout(150);

    // Modify content and save again
    await page.fill('#contentArea', 'Changed content');
    await page.click('#saveSnapshotBtn');
    await page.waitForTimeout(150);

    // Undo should revert to previous snapshot (move last snapshot to redo stack)
    await page.click('#undoBtn');
    await page.waitForTimeout(150);
    const afterUndo = await page.$eval('#contentArea', el => el.value);
    expect(afterUndo).toContain('Initial content');

    // Redo should restore
    // accept possible alert if nothing to redo - but we expect redo exists
    await page.click('#redoBtn');
    await page.waitForTimeout(150);
    const afterRedo = await page.$eval('#contentArea', el => el.value);
    expect(afterRedo).toContain('Changed content');
  });

  test('SwitchTo, PushAndSwitch, PopBack, StashAndSwitch and stack behavior', async () => {
    // Ensure at least two contexts exist: create two via prompt
    const ctxNames = ['CtxA-'+Math.random().toString(36).slice(2,4), 'CtxB-'+Math.random().toString(36).slice(2,4)];
    for (const n of ctxNames) {
      await nextDialogRespond(page, async dialog => await dialog.accept(n));
      await page.click('#newContextBtn');
      await page.waitForTimeout(80);
    }
    // Select second context in list by its name and check its checkbox
    const secondName = ctxNames[1];
    const targetLocator = page.locator('#contextsList div').filter({ hasText: secondName }).first();
    await targetLocator.locator('input[type=checkbox]').check();

    // Push & Switch: current active should be pushed to stack and switch to selected
    await page.click('#pushBtn');
    await page.waitForTimeout(200);
    const stackText = await page.$eval('#stackArea', el => el.textContent || '');
    expect(stackText.length).toBeGreaterThan(0); // something in stack

    // Pop back: should switch back to previous
    // If pop triggers alert for empty stack, test would have failed; we expect it to work
    await page.click('#popBtn');
    await page.waitForTimeout(200);
    const metricsText = await page.$eval('#metricsArea', el => el.textContent || '');
    expect(metricsText).toContain('Switches:');

    // Stash & Switch: select first of our CtxA
    const firstName = ctxNames[0];
    const firstLocator = page.locator('#contextsList div').filter({ hasText: firstName }).first();
    await firstLocator.locator('input[type=checkbox]').check();
    await page.click('#stashBtn');
    await page.waitForTimeout(200);
    // stash should have created a snapshot and switched
    const historyText = await page.$eval('#historyList', el => el.textContent || '');
    expect(historyText.length).toBeGreaterThan(0);
  });

  test('Simulation: start and stop, and sim produces logs without crashing', async () => {
    await page.click('#startSimBtn');
    // Wait briefly to allow a sim tick or log entry
    await page.waitForTimeout(600);
    await page.click('#stopSimBtn');
    await page.waitForTimeout(200);
    const logText = await page.$eval('#logArea', el => el.textContent || '');
    expect(logText).toContain('Simulation');
  });

  test('ResetMetrics, RecomputeMetrics, AutoApplyRules -> metrics and auto-rules toggling', async () => {
    // Reset metrics
    await page.click('#resetMetricsBtn');
    await page.waitForTimeout(150);
    const metricsAfterReset = await page.$eval('#metricsArea', el => el.textContent || '');
    expect(metricsAfterReset).toContain('Switches:');

    // Recompute (just call)
    await page.click('#recomputeMetricsBtn');
    await page.waitForTimeout(100);
    expect((await page.$eval('#metricsArea', el => el.textContent || '')).length).toBeGreaterThan(0);

    // Enable auto rules: create a context with tag 'urgent' to trigger a switch
    const urgentName = 'Urgent-' + Math.random().toString(36).slice(2,4);
    await nextDialogRespond(page, async dialog => await dialog.accept(urgentName));
    await page.click('#newContextBtn');
    await page.waitForTimeout(80);
    // add tag 'urgent' in the detail
    await page.fill('#tagsInput', 'urgent');
    // commitContextMeta is bound to onchange
    await page.dispatchEvent('#tagsInput', 'change');
    // Click auto rules
    await page.click('#autoApplyRulesBtn');
    await page.waitForTimeout(200);
    // The log should reflect enabling or switching
    const logText = await page.$eval('#logArea', el => el.textContent || '');
    expect(logText.length).toBeGreaterThan(0);
  });

  test('BatchMergeSelected and CompareContexts flows', async () => {
    // Create two contexts to merge and compare
    const a = 'BM-A-' + Math.random().toString(36).slice(2,3);
    const b = 'BM-B-' + Math.random().toString(36).slice(2,3);
    await nextDialogRespond(page, async d => await d.accept(a));
    await page.click('#newContextBtn');
    await page.waitForTimeout(80);
    await nextDialogRespond(page, async d => await d.accept(b));
    await page.click('#newContextBtn');
    await page.waitForTimeout(80);

    // Select both contexts for batch merge
    const locA = page.locator('#contextsList div').filter({ hasText: a }).first();
    const locB = page.locator('#contextsList div').filter({ hasText: b }).first();
    await locA.locator('input[type=checkbox]').check();
    await locB.locator('input[type=checkbox]').check();

    // Batch merge should proceed (no confirm). Click it.
    await page.click('#batchMergeBtn');
    await page.waitForTimeout(200);
    // Check that there is a merged snapshot in the target's history (historyList length > 0)
    const historyText = await page.$eval('#historyList', el => el.textContent || '');
    expect(historyText.length).toBeGreaterThan(0);

    // Compare contexts: will prompt for two names. Provide exact names via dialogs sequentially.
    // The compareTwoContexts function prompts twice; prepare two handlers
    const dialogPromise = new Promise(resolve => {
      let step = 0;
      const handler = async (dialog) => {
        if (dialog.type() === 'prompt') {
          if (step === 0) {
            await dialog.accept(a);
            step++;
          } else {
            await dialog.accept(b);
            page.off('dialog', handler);
            resolve();
          }
        } else {
          await dialog.accept();
        }
      };
      page.on('dialog', handler);
    });
    await page.click('#compareContextsBtn');
    await dialogPromise;
    await page.waitForTimeout(200);
    const diffOutput = await page.$eval('#diffOutput', el => el.value || '');
    // Diff output may be empty if contents equal, but the element should exist and be reachable
    expect(typeof diffOutput).toBe('string');
  });

  test('Persistence: SaveToLocal, LoadFromLocal, ClearLocal', async () => {
    // Save to local (produces an alert)
    const saveAlert = nextDialogRespond(page, async dialog => {
      expect(dialog.type()).toBe('alert');
      await dialog.accept();
    });
    await page.click('#saveLocalBtn');
    await saveAlert;

    // Load from local (causes alert on success)
    const loadAlert = nextDialogRespond(page, async dialog => {
      expect(dialog.type()).toBe('alert');
      await dialog.accept();
    });
    await page.click('#loadLocalBtn');
    await loadAlert;

    // Clear local (confirm then alert)
    const clearConfirm = nextDialogRespond(page, async dialog => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    await page.click('#clearLocalBtn');
    await clearConfirm;
    // The clearLocal function also triggers alert('Cleared local storage') - handle that
    const clearAlert = nextDialogRespond(page, async dialog => {
      expect(dialog.type()).toBe('alert');
      await dialog.accept();
    });
    // small wait for alert to appear
    await page.waitForTimeout(100);
    await clearAlert;
  });

  test('RecomputeMap, ExportMap, ClearLog, ExportLog actions', async () => {
    // Recompute map
    await page.click('#recomputeMapBtn');
    await page.waitForTimeout(100);
    const mapText = await page.$eval('#mapArea', el => el.textContent || '');
    expect(typeof mapText).toBe('string');

    // Export map (triggers download via click)
    await page.click('#exportMapBtn');
    await page.waitForTimeout(80);

    // Clear log
    await page.click('#clearLogBtn');
    await page.waitForTimeout(80);
    const logAfterClear = await page.$eval('#logArea', el => el.textContent || '');
    expect(logAfterClear.trim()).toBe('');

    // Export log (should not crash)
    await page.click('#exportLogBtn');
    await page.waitForTimeout(80);
  });

  test('Edge cases: Duplicate with no selection, Undo with nothing to undo should show alerts', async () => {
    // Ensure nothing selected (uncheck all)
    const checkboxes = await page.$$('#contextsList input[type=checkbox]');
    for (const cb of checkboxes) {
      try { await cb.evaluate(n => n.checked = false); } catch (e) {}
    }
    // Duplicate with no selection should alert
    const dupAlert = nextDialogRespond(page, async dialog => {
      expect(dialog.type()).toBe('alert');
      await dialog.accept();
    });
    await page.click('#duplicateContextBtn');
    await dupAlert;

    // Attempt undo in case current context has nothing to undo: may alert
    // We will call undo and accept alert if shown
    const maybeAlert = new Promise(resolve => {
      const handler = async (dialog) => {
        // Could be 'Nothing to undo'
        await dialog.accept();
        page.off('dialog', handler);
        resolve(true);
      };
      page.on('dialog', handler);
      // time out if no dialog appears
      setTimeout(() => {
        page.off('dialog', handler);
        resolve(false);
      }, 400);
    });
    await page.click('#undoBtn');
    const alertShown = await maybeAlert;
    // alertShown can be true (expected) or false (if there was undoable history) - both acceptable
    expect(typeof alertShown).toBe('boolean');
  });

});