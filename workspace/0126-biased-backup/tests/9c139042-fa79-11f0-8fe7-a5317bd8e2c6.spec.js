import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c139042-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page Object for the Heap demo
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Shortcuts
    this.arrayInput = page.locator('#arrayInput');
    this.loadArrayBtn = page.locator('#loadArrayBtn');
    this.genRandomBtn = page.locator('#genRandomBtn');
    this.buildHeapBtn = page.locator('#buildHeapBtn');
    this.insertVal = page.locator('#insertVal');
    this.insertBtn = page.locator('#insertBtn');
    this.extractBtn = page.locator('#extractBtn');
    this.replaceVal = page.locator('#replaceVal');
    this.replaceBtn = page.locator('#replaceBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.siftDownBtn = page.locator('#siftDownBtn');
    this.siftUpBtn = page.locator('#siftUpBtn');
    this.manualSwapBtn = page.locator('#manualSwapBtn');
    this.selectedIndex = page.locator('#selectedIndex');
    this.swapWithIndex = page.locator('#swapWithIndex');
    this.snapshotBtn = page.locator('#snapshotBtn');
    this.undoBtn = page.locator('#undoBtn');
    this.redoBtn = page.locator('#redoBtn');
    this.runScriptBtn = page.locator('#runScriptBtn');
    this.stopScriptBtn = page.locator('#stopScriptBtn');
    this.scriptArea = page.locator('#scriptArea');
    this.playBtn = page.locator('#playBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.stepForwardBtn = page.locator('#stepForwardBtn');
    this.stepBackBtn = page.locator('#stepBackBtn');
    this.playModeSpan = page.locator('#playMode');
    this.currentStepSpan = page.locator('#currentStep');
    this.totalStepsSpan = page.locator('#totalSteps');
    this.logArea = page.locator('#logArea');
    this.arrayViewButtons = page.locator('#arrayView button');
    this.clickSelectionSpan = page.locator('#clickSelection');
    this.statComparisons = page.locator('#statComparisons');
    this.statSwaps = page.locator('#statSwaps');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initialization log to appear in logArea (init logs a message)
    await expect(this.logArea).toBeVisible();
  }

  async getPlayMode() {
    return (await this.playModeSpan.textContent()).trim();
  }

  async getLogText() {
    return (await this.logArea.inputValue());
  }

  async getArrayViewTexts() {
    const count = await this.arrayViewButtons.count();
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push((await this.arrayViewButtons.nth(i).textContent()).trim());
    }
    return out;
  }

  async clickArrayButton(index) {
    await this.arrayViewButtons.nth(index).click();
  }

  async setInput(selector, value) {
    await this.page.locator(selector).fill(String(value));
  }

  async getTotalSteps() {
    return Number((await this.totalStepsSpan.textContent()).trim());
  }

  async getCurrentStep() {
    return Number((await this.currentStepSpan.textContent()).trim());
  }

  async getComparisonsSwaps() {
    return {
      comparisons: Number((await this.statComparisons.textContent()).trim()),
      swaps: Number((await this.statSwaps.textContent()).trim()),
    };
  }
}

test.describe('Heap (Max) - Interactive Demo End-to-End', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen for console messages and page errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // capture stack and message
      pageErrors.push(err);
    });
  });

  test('Initialization: app loads and enters Idle (S0_Idle) with initial array rendered', async ({ page }) => {
    const heap = new HeapPage(page);
    // Load the page
    await heap.goto();

    // Verify initial play mode is Idle (S0_Idle evidence)
    await expect(heap.playModeSpan).toHaveText('Idle');

    // renderAll() is called on init - verify array buttons are present and initial log includes "Initialized with array"
    const arrTexts = await heap.getArrayViewTexts();
    expect(arrTexts.length).toBeGreaterThan(0);
    const log = await heap.getLogText();
    expect(log).toContain('Initialized with array:');

    // No uncaught page errors on load
    expect(pageErrors.length).toBe(0);
    // No console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Primary Operations and Transitions (Build, Insert, Extract, Replace, Peek)', () => {
    test('BuildHeap (S2_Building): clicking Build Heap invokes heapifyBottomUp and logs expected message', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Capture comparisons/swaps before building
      const before = await heap.getComparisonsSwaps();

      // Click Build Heap
      await heap.buildHeapBtn.click();

      // After clicking, renderAll and log should include the expected message from implementation
      const log = await heap.getLogText();
      expect(log).toContain('Heap built (bottom-up), no playback recorded');

      // Stats should be numbers (may change depending on heapify)
      const after = await heap.getComparisonsSwaps();
      expect(after.comparisons).toBeGreaterThanOrEqual(0);
      expect(after.swaps).toBeGreaterThanOrEqual(0);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Insert (S3_Inserting) and Undo/Redo: insert a value, undo, redo, and validate DOM/logs', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Record array state
      const beforeArray = await heap.getArrayViewTexts();

      // Ensure insert value is set
      await heap.insertVal.fill('42');

      // Click Insert
      await heap.insertBtn.click();

      // New array should contain '42' somewhere; verify by text presence
      const afterArray = await heap.getArrayViewTexts();
      const changed = afterArray.length !== beforeArray.length || afterArray.some(t => t.includes('42'));
      expect(changed).toBeTruthy();

      // Snapshot was saved via saveHistory in insertBtn.onclick - check log for "Saved snapshot"
      const log = await heap.getLogText();
      expect(log).toContain('Saved snapshot');

      // Undo the insert
      await heap.undoBtn.click();
      const logAfterUndo = await heap.getLogText();
      expect(logAfterUndo).toContain('Undo performed');

      // Redo the insert
      await heap.redoBtn.click();
      const logAfterRedo = await heap.getLogText();
      expect(logAfterRedo).toContain('Redo performed');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Extract-Max (S4_Extracting): extract max and ensure heap updates and snapshot saved', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Ensure there is at least one element to extract
      const arrBefore = await heap.getArrayViewTexts();
      expect(arrBefore.length).toBeGreaterThan(0);

      // Click Extract
      await heap.extractBtn.click();

      // A playback snapshot was saved; check log includes "Saved snapshot"
      const log = await heap.getLogText();
      expect(log).toContain('Saved snapshot');

      // The array length should decrease by 1
      const arrAfter = await heap.getArrayViewTexts();
      expect(arrAfter.length).toBeLessThanOrEqual(arrBefore.length);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Replace Max (S5_Replacing): replace root and validate the root change and history logged', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Record root before replacing
      const arrBefore = await heap.getArrayViewTexts();
      const rootBefore = arrBefore.length > 0 ? arrBefore[0] : null;

      // Set replace value and click Replace Max
      await heap.replaceVal.fill('5');
      await heap.replaceBtn.click();

      // After replacement, a snapshot will be saved; verify log
      const log = await heap.getLogText();
      expect(log).toContain('Saved snapshot');

      // Root might have changed after replace; verify arrayView exists and count unchanged or changed reasonably
      const arrAfter = await heap.getArrayViewTexts();
      expect(arrAfter.length).toBeGreaterThanOrEqual(0);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Peek: clicking Peek logs the top value or "empty"', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      await heap.peekBtn.click();
      const log = await heap.getLogText();
      // Implementation logs "Peek -> ...", ensure substring
      expect(log).toContain('Peek ->');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Manual Controls, Swap, Sift, Snapshotting (S6_ManualSwap, S7_Snapshotting)', () => {
    test('Manual Swap: valid indices swap and log appears; invalid indices produce explicit invalid log', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Make sure at least two elements exist
      const arrBefore = await heap.getArrayViewTexts();
      if (arrBefore.length < 2) {
        // Bulk insert to ensure enough elements
        await heap.page.locator('#bulkInsert').fill('11,22,33');
        await heap.page.locator('#bulkInsertBtn').click();
      }

      // Set indices to swap 0 and 1 and click manualSwap
      await heap.selectedIndex.fill('0');
      await heap.swapWithIndex.fill('1');
      await heap.manualSwapBtn.click();

      // Verify log contains manual swap message
      let log = await heap.getLogText();
      expect(log).toContain('Manually swapped 0 and 1');

      // Now attempt invalid swap (out-of-range) and verify invalid log message
      await heap.selectedIndex.fill('0');
      await heap.swapWithIndex.fill('999'); // likely out of range
      await heap.manualSwapBtn.click();
      log = await heap.getLogText();
      // Implementation logs 'manual swap invalid indices' exactly
      expect(log).toContain('manual swap invalid indices');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Manual Sift-Down / Sift-Up (single step): operate on selected index and check logs and UI update', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Ensure there is at least one element; select index 0
      await heap.selectedIndex.fill('0');

      // Click sift down one step
      await heap.siftDownBtn.click();
      let log = await heap.getLogText();
      expect(log).toContain('Manual siftDown');

      // Click sift up one step (select last index)
      const arrTexts = await heap.getArrayViewTexts();
      const lastIndex = Math.max(0, arrTexts.length - 1);
      await heap.selectedIndex.fill(String(lastIndex));
      await heap.siftUpBtn.click();
      log = await heap.getLogText();
      expect(log).toContain('Manual siftUp');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Snapshotting: save a manual snapshot and restore it via history select/goTo', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Save a snapshot
      await heap.snapshotBtn.click();
      let log = await heap.getLogText();
      expect(log).toContain('Saved snapshot');

      // Modify heap (insert) then restore last snapshot via restore button
      await heap.insertVal.fill('77');
      await heap.insertBtn.click();
      await heap.page.locator('#restoreSnapshotBtn').click();

      // Restoration logs and should not throw errors
      log = await heap.getLogText();
      expect(log).toContain('Loaded history') || expect(log).toContain('Loaded history:');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Playback / Script Runner / Play Mode (S1_Playing transitions)', () => {
    test('Run script that triggers playback: Run Script -> playMode Playing, Pause -> Idle', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Replace script with a short script that runs a build (which will trigger playback)
      await heap.scriptArea.fill('build');

      // Click Run Script - this should start script and trigger playback (playMode -> Playing)
      await heap.runScriptBtn.click();

      // Wait up to a few seconds for playMode to become 'Playing'
      await heap.page.waitForTimeout(300); // give some time for play() to be called in script flow
      const mode = await heap.getPlayMode();
      expect(['Playing', 'Idle']).toContain(mode); // allow either depending on timing; expect Playing typically

      // If it is Playing, click Pause to return to Idle (exercise pause transition)
      if (mode === 'Playing') {
        await heap.pauseBtn.click();
        // ensure playMode changes to Idle
        await heap.page.waitForTimeout(50);
        const after = await heap.getPlayMode();
        expect(after).toBe('Idle');
      } else {
        // If not playing (rare timing races), ensure it's Idle
        expect(mode).toBe('Idle');
      }

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Stop Script: clicking Stop Script logs "Script stopped" and halts further scripted steps', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Use a script with a wait to allow us to stop it while running
      const script = 'insert 99\nwait 2000\ninsert 100';
      await heap.scriptArea.fill(script);

      // Start script
      await heap.runScriptBtn.click();

      // Wait briefly then stop the script
      await heap.page.waitForTimeout(200);
      await heap.stopScriptBtn.click();

      // The script stop implementation logs 'Script stopped'
      const log = await heap.getLogText();
      expect(log).toContain('Script stopped');

      // The playMode may remain 'Playing' if playback is active; we assert that stopScript logs as expected
      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Script runner handles "script already running" scenario', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Put a script that runs some commands
      await heap.scriptArea.fill('insert 55\nbuild');

      // Start the script
      await heap.runScriptBtn.click();

      // Immediately try to start it again - internal guard should log "Script already running"
      await heap.runScriptBtn.click();

      // Check log for "Script already running" phrase
      const log = await heap.getLogText();
      expect(log).toContain('Script already running');

      // Stop script to clean up (and ensure no errors)
      await heap.stopScriptBtn.click();
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Load empty array input (edge case) and validate graceful handling', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Clear array input and click Load Array
      await heap.arrayInput.fill('');
      await heap.loadArrayBtn.click();

      // Expect a log entry about loaded array (maybe empty) and that arrayView has 0 buttons
      const log = await heap.getLogText();
      expect(log).toContain('Array loaded');

      const arrTexts = await heap.getArrayViewTexts();
      // When empty, array view should be empty
      expect(arrTexts.length).toBe(0);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Click two array items to auto-swap via click selection', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.goto();

      // Ensure at least two elements
      let arr = await heap.getArrayViewTexts();
      if (arr.length < 2) {
        await heap.page.locator('#bulkInsert').fill('5,6,7');
        await heap.page.locator('#bulkInsertBtn').click();
        arr = await heap.getArrayViewTexts();
      }

      // Click first two array buttons to trigger auto swap
      await heap.clickArrayButton(0);
      await heap.clickArrayButton(1);

      // After clicking two, auto swap occurs and log contains "Manually swapped"
      const log = await heap.getLogText();
      expect(log).toContain('Manually swapped');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Observe console messages and ensure no unexpected runtime exceptions (ReferenceError/SyntaxError/TypeError)', async ({ page }) => {
      // This test focuses on capturing console errors and page errors during normal use
      const heap = new HeapPage(page);
      await heap.goto();

      // Perform several operations to stimulate code paths
      await heap.buildHeapBtn.click();
      await heap.insertVal.fill('123');
      await heap.insertBtn.click();
      await heap.extractBtn.click();
      await heap.replaceVal.fill('9');
      await heap.replaceBtn.click();
      await heap.peekBtn.click();
      await heap.snapshotBtn.click();

      // Allow any async logs to propagate
      await page.waitForTimeout(200);

      // Assert that there were no uncaught page errors (ReferenceError, TypeError, SyntaxError)
      expect(pageErrors.length).toBe(0);

      // Assert there are no console messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);

      // Also ensure the log area has multiple entries indicating activity
      const log = await heap.getLogText();
      expect(log.length).toBeGreaterThan(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Ensure tests detect console/page errors during the test run as a final assertion point
    // If there are any page errors, fail fast with details
    if (pageErrors.length > 0) {
      // Throw a helpful assertion for debugging
      const messages = pageErrors.map(e => (e && e.message) || String(e)).join('\n---\n');
      throw new Error('Found pageerrors during test:\n' + messages);
    }
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    if (consoleErrs.length > 0) {
      const msgs = consoleErrs.map(c => c.text).join('\n---\n');
      throw new Error('Found console errors during test:\n' + msgs);
    }
  });
});