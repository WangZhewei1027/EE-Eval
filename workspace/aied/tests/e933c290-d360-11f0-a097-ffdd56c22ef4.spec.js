import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e933c290-d360-11f0-a097-ffdd56c22ef4.html';

/*
  Test suite for Merge Sort Visualizer (Application ID: e933c290-d360-11f0-a097-ffdd56c22ef4)

  What these tests cover:
  - Validate initial UI/state (Ready)
  - Validate control interactions described in the FSM:
    Randomize, Reverse, Apply custom input (valid & invalid), Start, Step, Pause, Reset
  - Validate size/speed/mode controls and their effects
  - Verify state transitions (Ready <-> Playing <-> Paused -> Reset -> Ready)
  - Observe console logs and page errors (assert none unexpected)
  - Edge cases: invalid custom input triggers alert; very small arrays step through to completion
  - Note: Tests intentionally do not modify application code; they exercise the app as-is.
*/

test.describe('Merge Sort Visualizer - e933c290-d360-11f0-a097-ffdd56c22ef4', () => {
  // Capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Wait for main elements to be present to ensure app has initialized
    await page.waitForSelector('#status');
    await page.waitForSelector('#visArea');
    await page.waitForSelector('#startBtn');
  });

  test.afterEach(async () => {
    // Assert that the page produced no uncaught exceptions during the test
    // If there were errors, fail the test and include error messages for debugging.
    if (pageErrors.length > 0) {
      // Throw to make test fail with collected errors
      const msgs = pageErrors.map(e => e.toString()).join('\n---\n');
      throw new Error(`Page encountered errors:\n${msgs}`);
    }
    // Also ensure there were no console error-level messages
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    if (errorConsole.length > 0) {
      const msgs = errorConsole.map(m => m.text).join('\n---\n');
      throw new Error(`Console had error messages:\n${msgs}`);
    }
  });

  // Page object to centralize selectors and common actions
  class MergeSortPage {
    constructor(page) {
      this.page = page;
      this.status = page.locator('#status');
      this.sizeRange = page.locator('#sizeRange');
      this.sizeLabel = page.locator('#sizeLabel');
      this.randomBtn = page.locator('#randomBtn');
      this.reverseBtn = page.locator('#reverseBtn');
      this.applyInput = page.locator('#applyInput');
      this.clearInput = page.locator('#clearInput');
      this.customInput = page.locator('#customInput');
      this.startBtn = page.locator('#startBtn');
      this.stepBtn = page.locator('#stepBtn');
      this.pauseBtn = page.locator('#pauseBtn');
      this.resetBtn = page.locator('#resetBtn');
      this.speedRange = page.locator('#speedRange');
      this.modeSelect = page.locator('#modeSelect');
      this.opLog = page.locator('#opLog');
      this.opCount = page.locator('#opCount');
      this.visArea = page.locator('#visArea');
      this.codeBox = page.locator('#codeBox');
    }

    async getBarCount() {
      return await this.page.locator('#visArea .bar').count();
    }

    async getBarValues() {
      // returns array of bar numeric text values
      const bars = this.page.locator('#visArea .bar .val');
      const n = await bars.count();
      const vals = [];
      for (let i = 0; i < n; i++) {
        const t = await bars.nth(i).innerText();
        vals.push(Number(t.trim()));
      }
      return vals;
    }

    async setRangeInput(locator, value) {
      // For <input type=range> we need to set value and dispatch events
      await locator.evaluate((el, v) => {
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, value);
    }

    async changeRangeInput(locator, value) {
      // set value and also dispatch change
      await locator.evaluate((el, v) => {
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
    }
  }

  test.describe('Initial state and basic UI', () => {
    test('Initial app state is Ready and UI elements are present', async ({ page }) => {
      const app = new MergeSortPage(page);

      // Validate status text
      await expect(app.status).toHaveText('Ready');

      // Size label should reflect default value from HTML (30)
      await expect(app.sizeLabel).toHaveText('30');

      // Visualization should have 30 bars initially (size = 30)
      const barCount = await app.getBarCount();
      expect(barCount).toBe(30);

      // No operations recorded initially
      await expect(app.opCount).toHaveText('0');

      // Code box should show pseudocode lines (topdown by default)
      await expect(app.codeBox).toContainText('function mergeSort(arr, l, r):');

      // No page errors or console errors recorded so far
      expect(pageErrors.length).toBe(0);
    });

    test('Changing size slider updates label and triggers randomize on change event', async ({ page }) => {
      const app = new MergeSortPage(page);

      // Change range input (input event updates label)
      await app.setRangeInput(app.sizeRange, 10);
      await expect(app.sizeLabel).toHaveText('10');

      // Trigger change to actually generate a new array of that size
      await app.changeRangeInput(app.sizeRange, 10);

      // After change event, application should have generated a new random array
      // Status is updated to "Array randomized" by generateRandom
      await expect(app.status).toHaveText(/Array randomized/);

      const barCount = await app.getBarCount();
      expect(barCount).toBe(10);

      // opCount should remain zero and opLog empty
      await expect(app.opCount).toHaveText('0');
      const logCount = await page.locator('#opLog .op').count();
      expect(logCount).toBe(0);
    });
  });

  test.describe('Array manipulation controls', () => {
    test('Randomize button sets "Array randomized" and clears ops/logs', async ({ page }) => {
      const app = new MergeSortPage(page);

      await app.randomBtn.click();
      await expect(app.status).toHaveText(/Array randomized/);

      // opCount remains 0 and opLog empty
      await expect(app.opCount).toHaveText('0');
      const logCount = await page.locator('#opLog .op').count();
      expect(logCount).toBe(0);
    });

    test('Apply valid custom input updates array and status', async ({ page }) => {
      const app = new MergeSortPage(page);

      // Provide a small custom array for easier tests
      await app.customInput.fill('5,3,9,1');
      await app.applyInput.click();

      await expect(app.status).toHaveText('Custom array applied');

      // Visualization should show 4 bars with these values in order
      const values = await app.getBarValues();
      expect(values).toEqual([5, 3, 9, 1]);

      // opCount should be 0 and opLog empty after applying custom input
      await expect(app.opCount).toHaveText('0');
      const logCount = await page.locator('#opLog .op').count();
      expect(logCount).toBe(0);
    });

    test('Apply invalid custom input triggers alert and does not apply changes', async ({ page }) => {
      const app = new MergeSortPage(page);

      // Start with a known array
      await app.customInput.fill('7,2');
      await app.applyInput.click();
      await expect(app.status).toHaveText('Custom array applied');
      const beforeVals = await app.getBarValues();
      expect(beforeVals).toEqual([7, 2]);

      // Listen for dialog and capture message
      let dialogMessage = null;
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      // Now set invalid input and try to apply
      await app.customInput.fill('5,notanumber,9');
      await app.applyInput.click();

      // Wait briefly to ensure dialog event fired
      await page.waitForTimeout(50);

      expect(dialogMessage).toContain('Invalid number: notanumber');

      // The array should remain unchanged (prior values)
      const afterVals = await app.getBarValues();
      expect(afterVals).toEqual(beforeVals);

      // Status should NOT have changed to 'Custom array applied' for the invalid attempt
      await expect(app.status).not.toHaveText('Custom array applied');
    });

    test('Clear input button empties the textarea', async ({ page }) => {
      const app = new MergeSortPage(page);
      await app.customInput.fill('1,2,3');
      await app.clearInput.click();
      await expect(app.customInput).toHaveValue('');
    });

    test('Reverse button reverses array order (visual check)', async ({ page }) => {
      const app = new MergeSortPage(page);

      // Apply a deterministic custom array
      await app.customInput.fill('10,20,30,40');
      await app.applyInput.click();
      await expect(app.status).toHaveText('Custom array applied');

      const before = await app.getBarValues();
      expect(before).toEqual([10, 20, 30, 40]);

      // Click reverse
      await app.reverseBtn.click();

      // The array should now be reversed visually
      const after = await app.getBarValues();
      expect(after).toEqual([40, 30, 20, 10]);

      // Note: The implementation does not update status on reverse, even though the FSM expected 'Array randomized'.
      // We assert the visual effect happened, and also assert the status did not incorrectly change to 'Array randomized' here.
      // This verifies a potential mismatch between FSM expectation and implementation behavior.
      await expect(app.status).not.toHaveText('Array randomized');
    });
  });

  test.describe('Playback controls and FSM transitions', () => {
    test('Start -> Playing, Pause -> Paused, Start from Paused -> Playing', async ({ page }) => {
      const app = new MergeSortPage(page);

      // Use a small custom array to keep operations limited
      await app.customInput.fill('3,1,2');
      await app.applyInput.click();
      await expect(app.status).toHaveText('Custom array applied');

      // Start playback: should record ops and enter Playing
      await app.startBtn.click();

      // After starting, status should be 'Playing'
      await expect(app.status).toHaveText('Playing');

      // Some operations should have been logged (playStep is called immediately)
      await page.waitForTimeout(100); // allow a few steps to run
      const logCountWhilePlaying = await page.locator('#opLog .op').count();
      expect(logCountWhilePlaying).toBeGreaterThan(0);

      // Pause playback
      await app.pauseBtn.click();
      await expect(app.status).toHaveText('Paused');

      // Starting from paused should resume playing
      await app.startBtn.click();
      await expect(app.status).toHaveText('Playing');

      // Cleanup: pause again
      await app.pauseBtn.click();
      await expect(app.status).toHaveText('Paused');
    });

    test('Reset from Playing or Paused goes to Reset and clears operations', async ({ page }) => {
      const app = new MergeSortPage(page);

      // Use a small deterministic array
      await app.customInput.fill('8,4,2,6');
      await app.applyInput.click();

      // Start playback to ensure we can test reset while playing
      await app.startBtn.click();
      await expect(app.status).toHaveText('Playing');

      // Click reset while playing
      await app.resetBtn.click();

      // After reset, status should be 'Reset'
      await expect(app.status).toHaveText('Reset');

      // opCount should be 0 and opLog empty
      await expect(app.opCount).toHaveText('0');
      const logCount = await page.locator('#opLog .op').count();
      expect(logCount).toBe(0);

      // Now from Reset, clicking Randomize should create a new array and transition to Ready (status 'Array randomized')
      await app.randomBtn.click();
      await expect(app.status).toHaveText(/Array randomized/);
      // The Ready state implementation sets status to 'Array randomized' on generateRandom,
      // while FSM's "Ready" evidence was "Ready". This validates the implemented transitions.
    });

    test('Step button prepares ops and advances a single operation; finishing yields Completed', async ({ page }) => {
      const app = new MergeSortPage(page);

      // Use a minimal array to keep steps small
      await app.customInput.fill('2,1');
      await app.applyInput.click();
      await expect(app.status).toHaveText('Custom array applied');

      // Step once: this should prepare ops and perform the first operation
      await app.stepBtn.click();
      // status should indicate a stepped state
      await expect(app.status).toContainText('Stepped (op');

      // There should be at least one op logged now
      let logCount = await page.locator('#opLog .op').count();
      expect(logCount).toBeGreaterThanOrEqual(1);

      // Keep stepping until completion (guard to avoid infinite loops)
      for (let i = 0; i < 50; i++) {
        // If status shows Completed, stop early
        const s = await app.status.innerText();
        if (s === 'Completed') break;
        await app.stepBtn.click();
        await page.waitForTimeout(20);
      }

      // After finishing, status should be 'Completed' and opLog contains 'Sorting complete'
      await expect(app.status).toHaveText('Completed');
      const doneEntry = await page.locator('#opLog .op', { hasText: 'Sorting complete' }).count();
      expect(doneEntry).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Settings: mode and speed', () => {
    test('Changing mode updates pseudocode and influences recording', async ({ page }) => {
      const app = new MergeSortPage(page);

      // Default mode is topdown. Change to bottomup.
      await app.modeSelect.selectOption('bottomup');

      // Code box should now contain bottom-up pseudocode
      await expect(app.codeBox).toContainText('function mergeSortBottomUp');

      // Now prepare operations by starting (small array) and ensure operations are recorded
      await app.customInput.fill('4,3,2,1');
      await app.applyInput.click();

      // Start playback to record bottom-up ops
      await app.startBtn.click();
      await expect(app.status).toHaveText('Playing');

      // Ensure some operations recorded
      await page.waitForTimeout(100);
      const opCountText = await app.opCount.innerText();
      const opCountNum = Number(opCountText);
      expect(opCountNum).toBeGreaterThan(0);

      // Pause to stop playback
      await app.pauseBtn.click();
      await expect(app.status).toHaveText('Paused');
    });

    test('Speed range updates internal speed (no crash) and does not throw errors', async ({ page }) => {
      const app = new MergeSortPage(page);

      // Change speed and ensure no page errors/console errors occur
      await app.setRangeInput(app.speedRange, 50);
      // No explicit visible effect to assert, but ensure app remains responsive
      await app.startBtn.click();
      await page.waitForTimeout(50);
      // Pause to avoid background timer running longer than necessary
      await app.pauseBtn.click();

      // If there were any runtime exceptions, test.afterEach would throw. Here we assert there were none.
      expect(true).toBeTruthy();
    });
  });

  test.describe('Edge cases & implementation mismatches vs FSM', () => {
    test('Reverse in Reset state does not emit "Array randomized" status (implementation vs FSM mismatch check)', async ({ page }) => {
      const app = new MergeSortPage(page);

      // Put app into Reset by hitting resetBtn
      await app.resetBtn.click();
      await expect(app.status).toHaveText('Reset');

      // Now click reverse
      await app.reverseBtn.click();

      // Implementation only reverses array and calls drawArray(); it does not call updateStatus('Array randomized')
      // We assert that the status remains 'Reset' (or at least is NOT 'Array randomized') to highlight the mismatch
      const statusText = await app.status.innerText();
      expect(statusText).not.toMatch(/Array randomized/);
    });

    test('Very large size slider value renders bars without crashing (sanity check)', async ({ page }) => {
      const app = new MergeSortPage(page);

      // Set size to a large value (but within allowed max 120)
      await app.changeRangeInput(app.sizeRange, 120);

      // Ensure we have 120 bars and no crash
      const barCount = await app.getBarCount();
      expect(barCount).toBe(120);

      // Sanity: ensure status indicates randomization occurred
      await expect(app.status).toHaveText(/Array randomized/);
    });
  });
});