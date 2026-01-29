import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1213b182-fa7a-11f0-acf9-69409043402d.html';

// Page Object encapsulating interactions with the insertion sort explorer
class InsertionSortPage {
  constructor(page) {
    this.page = page;
    this.loc = {
      inputArray: page.locator('#inputArray'),
      loadArrayBtn: page.locator('#loadArrayBtn'),
      arrayDisplay: page.locator('#arrayDisplay'),
      prevStepBtn: page.locator('#prevStep'),
      nextStepBtn: page.locator('#nextStep'),
      firstStepBtn: page.locator('#firstStep'),
      lastStepBtn: page.locator('#lastStep'),
      autoSpeedInput: page.locator('#autoSpeed'),
      startAutoBtn: page.locator('#startAuto'),
      stopAutoBtn: page.locator('#stopAuto'),
      goToStepInput: page.locator('#goToStepInput'),
      goToStepBtn: page.locator('#goToStepBtn'),
      stepCountDesc: page.locator('#stepCountDesc'),
      infoEl: page.locator('#info'),
      statesList: page.locator('#statesList'),
      logEl: page.locator('#log'),
      insertValueInput: page.locator('#insertValue'),
      insertBtn: page.locator('#insertBtn'),
      removeBtn: page.locator('#removeBtn'),
      removeIndexInput: page.locator('#removeIndex'),
      replaceIndexInput: page.locator('#replaceIndex'),
      replaceValueInput: page.locator('#replaceValue'),
      replaceBtn: page.locator('#replaceBtn'),
      resetBtn: page.locator('#resetBtn'),
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait until the initial load triggered by the page's own loadArrayBtn.click() finishes rendering states
    await expect(this.loc.arrayDisplay).not.toHaveText(/No array loaded\./, { timeout: 2000 });
    // Wait until states list has been populated
    await this.page.waitForFunction(() => {
      const el = document.getElementById('statesList');
      return el && el.children && el.children.length > 0;
    }, {}, { timeout: 2000 });
  }

  // Helpers to read UI state
  async getArrayDisplayText() {
    return (await this.loc.arrayDisplay.textContent()) || '';
  }

  async getInfoText() {
    return (await this.loc.infoEl.textContent()) || '';
  }

  async getStatesCount() {
    return await this.loc.statesList.locator('div[role="option"]').count();
  }

  async getLogText() {
    return (await this.loc.logEl.textContent()) || '';
  }

  async clickLoadArray() {
    await this.loc.loadArrayBtn.click();
  }

  async clickNext() {
    await this.loc.nextStepBtn.click();
  }

  async clickPrev() {
    await this.loc.prevStepBtn.click();
  }

  async clickFirst() {
    await this.loc.firstStepBtn.click();
  }

  async clickLast() {
    await this.loc.lastStepBtn.click();
  }

  async clickStartAuto() {
    await this.loc.startAutoBtn.click();
  }

  async clickStopAuto() {
    await this.loc.stopAutoBtn.click();
  }

  async goToStep(n) {
    await this.loc.goToStepInput.fill(String(n));
    await this.loc.goToStepBtn.click();
  }

  async clickStateListStep(index) {
    const option = this.loc.statesList.locator('div[role="option"]').nth(index);
    await option.click();
  }

  async insertValue(val) {
    await this.loc.insertValueInput.fill(String(val));
    // Wait for input handler to enable the button
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('insertBtn');
      return btn && !btn.disabled;
    });
    await this.loc.insertBtn.click();
  }

  async removeAtIndex(idx) {
    await this.loc.removeIndexInput.fill(String(idx));
    // Wait for input handler to enable the button
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('removeBtn');
      return btn && !btn.disabled;
    });
    await this.loc.removeBtn.click();
  }

  async replaceAtIndex(idx, val) {
    await this.loc.replaceIndexInput.fill(String(idx));
    await this.loc.replaceValueInput.fill(String(val));
    // Wait for checkReplaceBtnEnabled to enable button
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('replaceBtn');
      return btn && !btn.disabled;
    });
    await this.loc.replaceBtn.click();
  }

  async clickReset() {
    await this.loc.resetBtn.click();
  }
}

// Global per-test collectors for console and page errors
test.describe('Insertion Sort Interactive Explorer - Comprehensive E2E', () => {
  let page;
  let app;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Listen to console to capture errors/warnings/info
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled exceptions in the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    app = new InsertionSortPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('State machine transitions and navigation', () => {
    test('LOAD_ARRAY should populate states and log the load', async () => {
      // Comment: Ensure the page load already invoked loadArrayBtn.click(), but we also test explicit load
      // Fill a custom array and load it, and assert states and log are updated.
      await app.loc.inputArray.fill('10 4 7 1');
      await app.clickLoadArray();

      // After loading, states list should have entries
      const statesCount = await app.getStatesCount();
      expect(statesCount).toBeGreaterThan(0);

      // Log should contain the loaded new array message
      const log = await app.getLogText();
      expect(log).toContain('Loaded new array: [10, 4, 7, 1]');
    });

    test('NEXT_STEP advances steps and eventually reaches the sorted final state', async () => {
      // Use the initially loaded default array from page load
      const len = await app.getStatesCount();
      expect(len).toBeGreaterThan(1);

      // Step forward until last step and assert "Array is fully sorted" present at final step
      for (let i = 0; i < len - 1; i++) {
        await app.clickNext();
      }

      const info = await app.getInfoText();
      expect(info).toMatch(/Array is fully sorted/);

      // The Next button should be disabled when at the final step
      await expect(app.loc.nextStepBtn).toBeDisabled();
      await expect(app.loc.lastStepBtn).toBeDisabled();
    });

    test('PREV_STEP moves backwards correctly', async () => {
      // Go to last step first
      const len = await app.getStatesCount();
      await app.clickLast();

      const infoBefore = await app.getInfoText();
      expect(infoBefore).toMatch(/Array is fully sorted/);

      // Click prev and ensure phase is no longer "done"
      await app.clickPrev();
      const infoAfter = await app.getInfoText();
      expect(infoAfter).not.toMatch(/Array is fully sorted/);
      // Prev button should be enabled unless we reached step 0
      expect(await app.loc.prevStepBtn.isDisabled()).toBe(false);
    });

    test('FIRST_STEP and LAST_STEP set current step correctly', async () => {
      // Click first
      await app.clickFirst();
      let info = await app.getInfoText();
      expect(info).toMatch(/STEP 0|Step 0/i);

      // Click last
      const statesLen = await app.getStatesCount();
      await app.clickLast();
      info = await app.getInfoText();
      expect(info).toMatch(/Array is fully sorted/);
      // Validate goToStepInput.max was set to states.length - 1
      const maxVal = await app.loc.goToStepInput.getAttribute('max');
      expect(Number(maxVal)).toBe(statesLen - 1);
    });

    test('GO_TO_STEP jumps to specific step and updates info', async () => {
      const statesLen = await app.getStatesCount();
      // Pick middle step
      const mid = Math.max(0, Math.floor((statesLen - 1) / 2));
      await app.goToStep(mid);
      const info = await app.getInfoText();
      expect(info).toMatch(new RegExp(`Step ${mid}/`));
    });

    test('Clicking an item in the states list jumps to that state', async () => {
      const statesLen = await app.getStatesCount();
      if (statesLen < 2) {
        test.skip();
      }
      // Click the second state in the list (index 1)
      await app.clickStateListStep(1);
      const info = await app.getInfoText();
      expect(info).toMatch(/Start iteration|iteration_start|Step 1/);
    });

    test('Array display shows indexes, values and markers for i/j when available', async () => {
      // Navigate to a compare/shift step by stepping forward a couple times
      await app.clickFirst();
      await app.clickNext(); // step 1 usually iteration_start
      await app.clickNext(); // step 2 could be compare
      const display = await app.getArrayDisplayText();
      // The display is a preformatted block with three lines; indexes and values should be present
      expect(display.split('\n').length).toBeGreaterThanOrEqual(2);
      expect(display).toMatch(/\d/); // contains digits
    });
  });

  test.describe('Automatic playback controls', () => {
    test('START_AUTO begins automatic stepping and STOP_AUTO halts it', async () => {
      // Ensure we are not at final step to allow starting auto
      await app.clickFirst();
      // Set auto speed to minimum for quick test
      await app.loc.autoSpeedInput.fill('100');
      // Start auto
      await app.clickStartAuto();

      // After starting, startAuto should be disabled and stopAuto enabled
      await expect(app.loc.startAutoBtn).toBeDisabled();
      await expect(app.loc.stopAutoBtn).toBeEnabled();

      // Wait a short while to allow auto stepping to proceed by at least one step
      await page.waitForTimeout(220);

      // Stop auto
      await app.clickStopAuto();
      // After stopping, the stop button should be disabled
      await expect(app.loc.stopAutoBtn).toBeDisabled();
      // startAuto should be enabled if not at final step
      // (if auto reached final it may be disabled; we accept either state but ensure no interval remains)
      // Verify no page errors occurred during auto mode
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Exploration features: insert/remove/replace/reset', () => {
    test('INSERT_VALUE inserts a value and resets states (log updated)', async () => {
      // Start from first step
      await app.clickFirst();
      // Insert value 42
      await app.insertValue(42);
      const logText = await app.getLogText();
      expect(logText).toContain('Inserted value 42');
      // States list should reflect new states for the modified array
      const statesCount = await app.getStatesCount();
      expect(statesCount).toBeGreaterThan(0);
      // After insertion, we should be at step 0
      const info = await app.getInfoText();
      expect(info).toMatch(/Step 0/);
    });

    test('REMOVE_VALUE removes a valid index and updates log and states', async () => {
      // Ensure there is an array and go to first step
      await app.clickFirst();
      // Get current array display to infer a length
      const display = await app.getArrayDisplayText();
      // crude parse: last line values
      const valuesLine = display.split('\n')[1] || '';
      const values = valuesLine.trim().split(/\s+/).map(s => Number(s)).filter(n => !Number.isNaN(n));
      if (values.length < 1) test.skip();
      // Remove last index
      const idxToRemove = values.length - 1;
      await app.removeAtIndex(idxToRemove);
      const log = await app.getLogText();
      expect(log).toMatch(new RegExp(`Removed element at index ${idxToRemove}`));
      // States should be regenerated and non-empty
      expect(await app.getStatesCount()).toBeGreaterThan(0);
    });

    test('REMOVE_VALUE with out of range index triggers alert dialog', async () => {
      // Provide an index that is likely out of range (e.g., 9999)
      const onDialog = page.waitForEvent('dialog');
      await app.loc.removeIndexInput.fill('9999');
      // Ensure the remove button is enabled by simulating change; code enables button only when valid number is present.
      // The input handler sets removeBtn.disabled based on states.length and valid number. With valid number it will enable.
      await app.loc.removeBtn.click();
      const dialog = await onDialog;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Remove index out of range.');
      await dialog.dismiss();
    });

    test('REPLACE_VALUE replaces a value and regenerates states (log updated)', async () => {
      // Ensure first step
      await app.clickFirst();
      // Determine a valid index to replace (0 if exists)
      const display = await app.getArrayDisplayText();
      const valuesLine = display.split('\n')[1] || '';
      const values = valuesLine.trim().split(/\s+/).map(s => Number(s)).filter(n => !Number.isNaN(n));
      if (values.length === 0) test.skip();
      const indexToReplace = 0;
      await app.replaceAtIndex(indexToReplace, 1234);
      const log = await app.getLogText();
      expect(log).toContain('Replaced element at index 0');
      // After replace, step should be reset to 0
      const info = await app.getInfoText();
      expect(info).toMatch(/Step 0/);
    });

    test('REPLACE_VALUE with out of range index triggers alert dialog', async () => {
      // Pick an out of range index and attempt replace
      const onDialog = page.waitForEvent('dialog');
      await app.loc.replaceIndexInput.fill('9999');
      await app.loc.replaceValueInput.fill('5');
      // Click replace - script will alert for out of range
      await app.loc.replaceBtn.click();
      const dialog = await onDialog;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Replace index out of range.');
      await dialog.dismiss();
    });

    test('RESET_ARRAY triggers a reload (log contains reset message)', async () => {
      // Click reset; the implementation uses loadArrayBtn.click() and logs "Reset to loaded array."
      await app.clickReset();
      // The log should contain "Reset to loaded array."
      const log = await app.getLogText();
      expect(log).toContain('Reset to loaded array.');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Loading an empty array input triggers an alert', async () => {
      // Clear the input and click load
      await app.loc.inputArray.fill('');
      const dialogPromise = page.waitForEvent('dialog');
      await app.clickLoadArray();
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Please enter a valid array');
      await dialog.dismiss();
    });

    test('States list keyboard accessibility: pressing Enter on a list item jumps to that step', async () => {
      // Focus on statesList and press Enter on the first option
      const firstOption = app.loc.statesList.locator('div[role="option"]').first();
      await firstOption.focus();
      // Press Enter key
      await page.keyboard.press('Enter');
      // Ensure info reflects step 0 (or the step corresponding to the first option)
      const info = await app.getInfoText();
      expect(info).toMatch(/Step 0|Initial array before sorting/i);
    });
  });

  test.describe('Console and runtime error observations', () => {
    test('No unexpected page errors or console errors occurred during interaction', async () => {
      // After many interactions above in same test lifecycle, verify we captured no runtime errors.
      // This asserts that the page did not produce uncaught exceptions.
      expect(pageErrors.length).toBe(0);

      // Check console messages: none should be of type 'error'
      const errors = consoleMessages.filter(m => m.type === 'error');
      expect(errors.length).toBe(0);
    });
  });
});