import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12158640-fa7a-11f0-acf9-69409043402d.html';

// Utility to wait a little for UI updates/log writes
const shortWait = (ms = 100) => new Promise(r => setTimeout(r, ms));

test.describe('Context Switching Interactive Demo - FSM validation (12158640-fa7a-11f0-acf9-69409043402d)', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // capture console messages and page errors for each test
    consoleMessages = [];
    pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL);
    // Give the app a moment to initialize and write to the log
    await shortWait(150);
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: ensure no uncaught page errors occurred during the test
    // This asserts that the app didn't produce runtime exceptions (ReferenceError, TypeError, etc.)
    expect(pageErrors.map(e => e.message)).toEqual([]);
    // Provide a minimal assertion that the app wrote an initialization log entry
    const log = await page.locator('#interaction-log').innerText();
    expect(log).toContain('Context Switching demo initialized.');
  });

  test.describe('Initialization and Idle State (S0_Idle)', () => {
    test('should initialize (init entry action) and present default UI state', async ({ page }) => {
      // Validate initial UI - current context should be [None], buttons disabled appropriately
      await expect(page.locator('#current-context-name')).toHaveText('[None]');
      await expect(page.locator('#perform-switch-btn')).toBeDisabled();
      await expect(page.locator('#ctx-load-btn')).toBeDisabled();
      await expect(page.locator('#ctx-delete-btn')).toBeDisabled();
      await expect(page.locator('#undo-switch-btn')).toBeDisabled();
      await expect(page.locator('#redo-switch-btn')).toBeDisabled();

      // Verify the init() entry action produced a log line
      const log = await page.locator('#interaction-log').innerText();
      expect(log).toContain('Context Switching demo initialized.');
    });
  });

  test.describe('Create, Validate, Save and List Contexts (S2_ContextSaved)', () => {
    test('should show validation error for invalid JSON and prevent save', async ({ page }) => {
      // Enter a name and invalid JSON
      await page.fill('#ctx-name-input', 'InvalidJSONCtx');
      await page.fill('#ctx-data-input', '{ invalidJson: }'); // invalid
      await page.click('#ctx-save-btn');

      // Validation message should be shown and no "saved" log should appear
      await expect(page.locator('#ctx-validation-msg')).toHaveText(/Context Data must be valid JSON/);
      const logText = await page.locator('#interaction-log').innerText();
      expect(logText).not.toContain('Context "InvalidJSONCtx" saved.');
    });

    test('should save a valid context and update context list and logs', async ({ page }) => {
      // Provide a valid context
      await page.fill('#ctx-name-input', 'Alpha');
      await page.fill('#ctx-description-input', 'First test context');
      await page.fill('#ctx-data-input', '{"a":1, "nested": {"x": 10}}');

      // Save
      await page.click('#ctx-save-btn');

      // After saving:
      // - validation msg cleared
      await expect(page.locator('#ctx-validation-msg')).toHaveText('');
      // - inputs cleared
      await expect(page.locator('#ctx-name-input')).toHaveValue('');
      // - context list updated with 'Alpha'
      const options = page.locator('#ctx-list option');
      await expect(options).toHaveCount(1);
      await expect(options.first()).toHaveText('Alpha');
      // - switch-target-select also updated
      const targetOptions = page.locator('#switch-target-select option');
      await expect(targetOptions).toHaveCount(1);
      await expect(targetOptions.first()).toHaveText('Alpha');
      // - interaction log contains saved entry
      const logText = await page.locator('#interaction-log').innerText();
      expect(logText).toContain('Context "Alpha" saved.');
      expect(logText).toContain('Contexts saved to localStorage.');
    });
  });

  test.describe('Load Context into Editor (S1_ContextLoaded) and Deletion (S3_ContextDeleted)', () => {
    test('should load a saved context into editor and log the load', async ({ page }) => {
      // Precondition: create another context Beta
      await page.fill('#ctx-name-input', 'Beta');
      await page.fill('#ctx-description-input', 'Second context');
      await page.fill('#ctx-data-input', '{"b":2, "arr":[1,2]}');
      await page.click('#ctx-save-btn');
      await shortWait(100);

      // The ctx-list should now contain Alpha and Beta (alphabetical)
      const ctxList = page.locator('#ctx-list');
      await expect(ctxList.locator('option')).toHaveCount(2);
      // Select "Alpha" (first alphabetically is "Alpha")
      await page.selectOption('#ctx-list', 'Alpha');
      await page.click('#ctx-load-btn');

      // After load, editor inputs should show Alpha values, and log should have loaded entry
      await expect(page.locator('#ctx-name-input')).toHaveValue('Alpha');
      await expect(page.locator('#ctx-data-input')).toContainText('"a": 1');
      const log = await page.locator('#interaction-log').innerText();
      expect(log).toContain('Context "Alpha" loaded into editor.');
    });

    test('should delete a non-loaded context after confirm and log deletion (S3_ContextDeleted)', async ({ page }) => {
      // Ensure Beta exists in list, and it's not the currently loaded editor (Alpha is loaded)
      await page.selectOption('#ctx-list', 'Beta');

      // Intercept confirm dialog and accept
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('Delete context "Beta"');
        await dialog.accept();
      });

      // Click delete
      await page.click('#ctx-delete-btn');
      await shortWait(100);

      // Beta should be gone from ctx-list
      const opts = page.locator('#ctx-list option');
      const texts = await opts.allTextContents();
      expect(texts).not.toContain('Beta');

      // Deletion logged
      const log = await page.locator('#interaction-log').innerText();
      expect(log).toContain('Context "Beta" deleted.');
    });

    test('should prevent deleting a context that is currently loaded (alert shown)', async ({ page }) => {
      // Load Alpha into editor (ensure it's in editor but note currentContext is still null)
      await page.selectOption('#ctx-list', 'Alpha');
      await page.click('#ctx-load-btn');
      await shortWait(50);

      // Attempt to delete Alpha via ctx-delete-btn; the code checks currentContext and will alert
      // The alert should be presented and we accept it
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toContain('Cannot delete context currently loaded');
        await dialog.accept();
      });

      // Try to delete
      await page.click('#ctx-delete-btn');
      await shortWait(100);

      // Alpha should still exist in the list
      const texts = await page.locator('#ctx-list option').allTextContents();
      expect(texts).toContain('Alpha');
    });
  });

  test.describe('History-based current context load, perform switch, undo and redo (S4/S5/S6)', () => {
    test('should load a history state as current context, perform switch, undo and redo', async ({ page }) => {
      // Prepare storage with two contexts and one history entry so we can load a history state to set currentContext
      const contextsObj = {
        'Alpha': { name: 'Alpha', description: 'Alpha desc', dataObject: { a: 1 } },
        'Beta': { name: 'Beta', description: 'Beta desc', dataObject: { b: 2 } }
      };
      const historyEntry = {
        timestamp: Date.now(),
        fromContextName: 'Alpha',
        toContextName: 'Beta',
        mode: 'instant',
        stateSnapshot: { b: 2 }
      };
      const historyObj = { history: [historyEntry], undoIndex: 0 };

      // Write into localStorage and reload the page so the app picks up prepopulated history/contexts
      await page.evaluate(({ ctxKey, histKey, contextsObj, historyObj }) => {
        localStorage.setItem(ctxKey, JSON.stringify(contextsObj));
        localStorage.setItem(histKey, JSON.stringify(historyObj));
      }, { ctxKey: 'cs_contexts', histKey: 'cs_switch_history', contextsObj, historyObj });

      // Reload app to load the freshly set storage items
      await page.reload();
      await shortWait(150);

      // There should be one history entry visible
      await expect(page.locator('#switch-history-select option')).toHaveCount(1);

      // Select the history entry and click the load history button
      await page.selectOption('#switch-history-select', '0');
      // Ensure load button becomes enabled
      await expect(page.locator('#load-history-select-btn')).toBeEnabled();
      await page.click('#load-history-select-btn');
      await shortWait(100);

      // After loading a history entry as current context, current-context-name should reflect the entry's toContextName (Beta)
      await expect(page.locator('#current-context-name')).toHaveText('Beta');
      // And the log should reflect the loaded history state
      const logAfterLoad = await page.locator('#interaction-log').innerText();
      expect(logAfterLoad).toContain('Loaded history state #1 ("Beta") as current context');

      // Now attempt a perform switch from Beta to Alpha
      // Select 'Alpha' in switch-target-select; ensure performSwitchBtn becomes enabled
      await page.selectOption('#switch-target-select', 'Alpha');
      // Since currentContext is Beta, performSwitchBtn should become enabled
      await expect(page.locator('#perform-switch-btn')).toBeEnabled();

      // Click perform switch and observe the logged switch
      await page.click('#perform-switch-btn');
      await shortWait(200);

      const logAfterSwitch = await page.locator('#interaction-log').innerText();
      expect(logAfterSwitch).toContain('Switched context to "Alpha" using mode');

      // History list should now have 2 entries and undo should be available
      await expect(page.locator('#switch-history-select option')).toHaveCount(2);
      await expect(page.locator('#undo-switch-btn')).toBeEnabled();

      // Click Undo - this should move back in history
      await page.click('#undo-switch-btn');
      await shortWait(120);
      const logAfterUndo = await page.locator('#interaction-log').innerText();
      expect(logAfterUndo).toMatch(/Undo: switched back to ".*"/);

      // Redo should now be enabled
      await expect(page.locator('#redo-switch-btn')).toBeEnabled();
      await page.click('#redo-switch-btn');
      await shortWait(120);
      const logAfterRedo = await page.locator('#interaction-log').innerText();
      expect(logAfterRedo).toMatch(/Redo: switched forward to ".*"/);
    });
  });

  test.describe('Additional controls and edge-cases', () => {
    test('should update undo levels input and log change', async ({ page }) => {
      // Change undo levels; expect a log entry and value sanitized into range
      await page.fill('#switch-undo-levels', '5');
      await page.dispatchEvent('#switch-undo-levels', 'change');
      await shortWait(80);
      const log = await page.locator('#interaction-log').innerText();
      expect(log).toContain('Undo levels set to 5');
      // The input's value should reflect the number (sanitized)
      await expect(page.locator('#switch-undo-levels')).toHaveValue('5');
    });

    test('should clear interaction log when clear button clicked', async ({ page }) => {
      // Add something to the log by toggling undo levels
      await page.fill('#switch-undo-levels', '7');
      await page.dispatchEvent('#switch-undo-levels', 'change');
      await shortWait(50);

      // Clear the log
      await page.click('#clear-log-btn');
      await shortWait(50);
      const logText = await page.locator('#interaction-log').innerText();
      expect(logText.trim()).toBe('');
    });

    test('should not allow perform switch when no current context (guard behavior)', async ({ page }) => {
      // Ensure currentContext is null (initial state). perform-switch button should be disabled.
      await expect(page.locator('#current-context-name')).toHaveText('[None]');
      await expect(page.locator('#perform-switch-btn')).toBeDisabled();

      // Attempting to press Enter on switchTargetSelect should not trigger a switch because button is disabled
      // We simulate pressing Enter on the switch target select
      await page.focus('#switch-target-select');
      await page.keyboard.press('Enter');
      // No new switch log should be present beyond initialization
      const log = await page.locator('#interaction-log').innerText();
      // Only initialization log exists or other innocuous logs; ensure no "Switched context" entry
      expect(log).not.toContain('Switched context to');
    });
  });

  test.describe('Console and runtime observations', () => {
    test('should not produce uncaught runtime errors (no ReferenceError/SyntaxError/TypeError)', async ({ page }) => {
      // Collect console messages that are errors
      const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      // Expect no uncaught console errors
      expect(errorConsole.map(m => m.text)).toEqual([]);
      // And pageErrors was asserted in afterEach to be empty as well
    });
  });
});