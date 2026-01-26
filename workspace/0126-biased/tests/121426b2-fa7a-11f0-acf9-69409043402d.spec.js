import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121426b2-fa7a-11f0-acf9-69409043402d.html';

// Page object abstraction for the Ternary Search Explorer
class ExplorerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // element selectors used across tests
    this.selectors = {
      arrayInput: '#arrayInput',
      targetInput: '#targetInput',
      loadSearch: '#loadSearch',
      loadError: '#loadError',
      stateInfo: '#stateinfo',
      log: '#log',
      stepForward: '#stepForward',
      stepBackward: '#stepBackward',
      autoPlay: '#autoPlay',
      pauseAutoPlay: '#pauseAutoPlay',
      resetSearch: '#resetSearch',
      speedRange: '#speedRange',
      speedValue: '#speedValue',
      jumpStep: '#jumpStep',
      stepJump: '#stepJump',
      clearLog: '#clearLog',
      manualSetLow: '#manualSetLow',
      manualLowInput: '#manualLowInput',
      manualSetHigh: '#manualSetHigh',
      manualHighInput: '#manualHighInput',
      manualEvalBoth: '#manualEvalBoth',
      manualAddLog: '#manualAddLog',
      manualLogText: '#manualLogText',
      modeExact: '#modeFindExact',
      modeMax: '#modeFindMax',
      lowIndex: '#lowIndex',
      highIndex: '#highIndex',
      pauseBtn: '#pauseAutoPlay'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getStateInfoText() {
    return (await this.page.locator(this.selectors.stateInfo).innerText()).trim();
  }

  async getLogText() {
    return (await this.page.locator(this.selectors.log).innerText()).trim();
  }

  async clickLoadSearch() {
    await this.page.click(this.selectors.loadSearch);
  }

  async clickStepForward() {
    await this.page.click(this.selectors.stepForward);
  }

  async clickStepBackward() {
    await this.page.click(this.selectors.stepBackward);
  }

  async clickAutoPlay() {
    await this.page.click(this.selectors.autoPlay);
  }

  async clickPause() {
    await this.page.click(this.selectors.pauseBtn);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetSearch);
  }

  async setArray(text) {
    await this.page.fill(this.selectors.arrayInput, text);
  }

  async setTarget(value) {
    await this.page.fill(this.selectors.targetInput, String(value));
  }

  async setSpeed(value) {
    await this.page.locator(this.selectors.speedRange).fill(String(value));
    // trigger input event via evaluation if needed
    await this.page.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, this.selectors.speedRange, String(value));
  }

  async getSpeedValueText() {
    return (await this.page.locator(this.selectors.speedValue).innerText()).trim();
  }

  async jumpTo(stepN) {
    await this.page.fill(this.selectors.stepJump, String(stepN));
    await this.page.click(this.selectors.jumpStep);
  }

  async clickClearLog() {
    await this.page.click(this.selectors.clearLog);
  }

  async manualSetLow(value) {
    await this.page.fill(this.selectors.manualLowInput, String(value));
    await this.page.click(this.selectors.manualSetLow);
  }

  async manualSetHigh(value) {
    await this.page.fill(this.selectors.manualHighInput, String(value));
    await this.page.click(this.selectors.manualSetHigh);
  }

  async clickManualEvalBoth() {
    await this.page.click(this.selectors.manualEvalBoth);
  }

  async manualAddLog(text) {
    await this.page.fill(this.selectors.manualLogText, text);
    await this.page.click(this.selectors.manualAddLog);
  }

  async toggleModeExact(checked) {
    const el = this.page.locator(this.selectors.modeExact);
    const cur = await el.isChecked();
    if (cur !== checked) await el.click();
  }

  async toggleModeMax(checked) {
    const el = this.page.locator(this.selectors.modeMax);
    const cur = await el.isChecked();
    if (cur !== checked) await el.click();
  }

  async getLoadErrorText() {
    return (await this.page.locator(this.selectors.loadError).innerText()).trim();
  }

  async getLowIndexValue() {
    return (await this.page.locator(this.selectors.lowIndex).inputValue()).trim();
  }

  async getHighIndexValue() {
    return (await this.page.locator(this.selectors.highIndex).inputValue()).trim();
  }

  async isEnabled(selector) {
    return !(await this.page.locator(selector).isDisabled());
  }

  async isDisabled(selector) {
    return await this.page.locator(selector).isDisabled();
  }
}

// Global setup per test to collect console errors and page errors
test.describe('Ternary Search Interactive Explorer - FSM and UI tests', () => {
  let page;
  let explorer;
  let consoleErrors;
  let consoleWarnings;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    explorer = new ExplorerPage(page);

    consoleErrors = [];
    consoleWarnings = [];
    pageErrors = [];

    // capture console events
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') consoleErrors.push(text);
      if (type === 'warning') consoleWarnings.push(text);
    });

    // capture page errors (unhandled exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await explorer.goto();
  });

  test.afterEach(async () => {
    // Assert no unexpected console errors or page errors occurred during the test
    // Note: We intentionally observe console and page errors and assert none occurred.
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);

    await page.close();
  });

  test.describe('Initial state and loading behavior', () => {
    test('Initial Idle state: page renders and shows "No search loaded."', async () => {
      // Verify initial UI when page is first loaded (FSM S0_Idle)
      const stateText = await explorer.getStateInfoText();
      expect(stateText).toContain('No search loaded.');

      // Buttons that should be disabled when idle
      expect(await explorer.isDisabled(explorer.selectors.stepForward)).toBe(true);
      expect(await explorer.isDisabled(explorer.selectors.stepBackward)).toBe(true);
      expect(await explorer.isDisabled(explorer.selectors.autoPlay)).toBe(true);
      expect(await explorer.isDisabled(explorer.selectors.pauseAutoPlay)).toBe(true);
    });

    test('Load Search transitions to Search Loaded (S1_SearchLoaded) and initializes generator', async () => {
      // Pre-filled example data exists; click Load Search to initialize search generator
      await explorer.clickLoadSearch();

      // After loading, stateinfo should no longer be 'No search loaded.'
      const stateText = await explorer.getStateInfoText();
      expect(stateText).not.toContain('No search loaded.');
      expect(stateText).toMatch(/Current search range:/);

      // After first load, stepBackward should be disabled (we are at first step)
      expect(await explorer.isDisabled(explorer.selectors.stepBackward)).toBe(true);

      // Step forward should be enabled (there should be further steps unless found immediately)
      expect(await explorer.isDisabled(explorer.selectors.stepForward)).toBe(false);

      // Auto play should be enabled (unless the first step was a found state)
      expect(await explorer.isDisabled(explorer.selectors.autoPlay)).toBe(false);
    });
  });

  test.describe('Stepping and navigation', () => {
    test('Step Forward and Step Backward update current range and UI', async () => {
      // Load search first
      await explorer.clickLoadSearch();

      // Capture initial low/high from the first step
      const lowBefore = await explorer.getLowIndexValue();
      const highBefore = await explorer.getHighIndexValue();

      // Step forward (should move to next state)
      await explorer.clickStepForward();
      const lowAfter = await explorer.getLowIndexValue();
      const highAfter = await explorer.getHighIndexValue();

      // Expect the range to have been updated (not identical to initial unless trivial)
      expect(lowAfter === lowBefore && highAfter === highBefore).toBe(false);

      // Step backward restores prior state
      await explorer.clickStepBackward();
      const lowRestore = await explorer.getLowIndexValue();
      const highRestore = await explorer.getHighIndexValue();
      expect(lowRestore).toBe(lowBefore);
      expect(highRestore).toBe(highBefore);
    });

    test('Jump to step works and respects stepJump max', async () => {
      await explorer.clickLoadSearch();

      // Advance a couple steps to build history
      await explorer.clickStepForward();
      await explorer.clickStepForward();

      // Determine max (stepJump input max attribute should be set)
      const maxVal = await page.$eval('#stepJump', el => el.max);
      expect(Number(maxVal)).toBeGreaterThanOrEqual(1);

      // Jump back to step 0
      await explorer.jumpTo(0);
      const stateText = await explorer.getStateInfoText();
      expect(stateText).toMatch(/^Step 0 of/);
    });

    test('Reset Search resets to initial step (S6_ResetSearch)', async () => {
      await explorer.clickLoadSearch();
      // Move forward, then reset
      await explorer.clickStepForward();
      await explorer.clickReset();

      const stateText = await explorer.getStateInfoText();
      // Should be showing Step 0 after reset
      expect(stateText).toMatch(/^Step 0 of/);
    });
  });

  test.describe('Auto Play and Pause behavior', () => {
    test('Auto Play starts and Pause stops autoplay (S4_AutoPlay -> S5_PauseAutoPlay)', async () => {
      await explorer.clickLoadSearch();

      // Change speed to make autoplay progress fast
      await explorer.setSpeed(5);
      const speedText = await explorer.getSpeedValueText();
      expect(speedText).toBe('5');

      // Start autoplay
      await explorer.clickAutoPlay();

      // Auto play should enable the pause button
      expect(await explorer.isEnabled(explorer.selectors.pauseAutoPlay)).toBe(true);

      // Pause autoplay
      await explorer.clickPause();

      // After pausing, pause button should be disabled and autoPlay enabled again
      expect(await explorer.isDisabled(explorer.selectors.pauseAutoPlay)).toBe(true);
      expect(await explorer.isEnabled(explorer.selectors.autoPlay)).toBe(true);
    }, { timeout: 10000 });
  });

  test.describe('Manual overrides and logs (S7_ManualOverride)', () => {
    test('Manual Set Low triggers validation alert for invalid input and accepts valid input', async () => {
      await explorer.clickLoadSearch();

      // Provide an invalid low index (-1) to trigger alert dialog
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        explorer.manualSetLow(-1)
      ]);
      expect(dialog.message()).toContain('Invalid low index.');
      await dialog.accept();

      // Provide invalid low that is > high to trigger "Low index cannot be greater than high index."
      // First get current high value
      const curHigh = await explorer.getHighIndexValue();
      const invalidLow = Number(curHigh) + 1;
      const [dialog2] = await Promise.all([
        page.waitForEvent('dialog'),
        explorer.manualSetLow(invalidLow)
      ]);
      expect(dialog2.message()).toContain('Low index cannot be greater than high index.');
      await dialog2.accept();

      // Provide a valid low index (e.g., set to low of current step)
      // Obtain current low value and set to that (idempotent but valid)
      const curLow = await explorer.getLowIndexValue();
      await explorer.manualSetLow(Number(curLow));
      // After a valid manual override, forward navigation should be disabled because generator is trimmed/stopped
      expect(await explorer.isDisabled(explorer.selectors.stepForward)).toBe(true);
      expect(await explorer.isDisabled(explorer.selectors.autoPlay)).toBe(true);
    });

    test('Manual Set High triggers validation and accepts valid input', async () => {
      await explorer.clickLoadSearch();

      // Invalid high (too large)
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        explorer.manualSetHigh(9999)
      ]);
      expect(dialog.message()).toContain('Invalid high index.');
      await dialog.accept();

      // Provide a high < low to trigger alert
      const curLow = Number(await explorer.getLowIndexValue());
      const invalidHigh = curLow - 1;
      const [dialog2] = await Promise.all([
        page.waitForEvent('dialog'),
        explorer.manualSetHigh(invalidHigh)
      ]);
      expect(dialog2.message()).toContain('High index cannot be less than low index.');
      await dialog2.accept();

      // Now set valid high equal to current high (idempotent but valid)
      const curHigh = await explorer.getHighIndexValue();
      await explorer.manualSetHigh(Number(curHigh));
      expect(await explorer.isDisabled(explorer.selectors.stepForward)).toBe(true);
      expect(await explorer.isDisabled(explorer.selectors.autoPlay)).toBe(true);
    });

    test('Manual Evaluate m1 and m2 updates state and produces manual override log entry', async () => {
      await explorer.clickLoadSearch();

      // Trigger manual eval both
      await explorer.clickManualEvalBoth();

      // After manualEvalBoth, forward navigation should be disabled (generator trimmed)
      expect(await explorer.isDisabled(explorer.selectors.stepForward)).toBe(true);

      // Log should contain 'Manual override step' or similar message produced by recalcCurrentStepMids
      const logs = await explorer.getLogText();
      expect(logs).toMatch(/Manual override step:/);
    });

    test('Manual Add Log appends manual log and empty input triggers alert', async () => {
      await explorer.clickLoadSearch();

      // Empty log attempt should trigger alert
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        explorer.manualAddLog('') // click will cause alert
      ]);
      expect(dialog.message()).toContain('Enter some text to add to log.');
      await dialog.accept();

      // Now add a real manual log
      await explorer.manualAddLog('Testing manual log entry');

      // Log should now contain our manual log entry
      const logs = await explorer.getLogText();
      expect(logs).toMatch(/Manual log \(step \d+\): Testing manual log entry/);

      // Clear manual logs via Clear Log button
      await explorer.clickClearLog();
      const logsAfterClear = await explorer.getLogText();
      // The manual entry should not remain after clearing manual logs
      expect(logsAfterClear).not.toMatch(/Testing manual log entry/);
    });
  });

  test.describe('Error cases and input validation', () => {
    test('Loading invalid array shows parse errors', async () => {
      // Non-integer in array
      await explorer.setArray('1,2,foo');
      await explorer.setTarget(5);
      await explorer.clickLoadSearch();
      const errText = await explorer.getLoadErrorText();
      expect(errText).toContain('All values must be integers.');

      // Unsorted array
      await explorer.setArray('5,3,1');
      await explorer.clickLoadSearch();
      const errText2 = await explorer.getLoadErrorText();
      expect(errText2).toContain('Array must be sorted');

      // No mode selected
      await explorer.toggleModeExact(false);
      await explorer.toggleModeMax(false);
      await explorer.setArray('1,2,3');
      await explorer.clickLoadSearch();
      const errText3 = await explorer.getLoadErrorText();
      expect(errText3).toContain('Select at least one mode.');

      // Both modes selected
      await explorer.toggleModeExact(true);
      await explorer.toggleModeMax(true);
      await explorer.clickLoadSearch();
      const errText4 = await explorer.getLoadErrorText();
      expect(errText4).toContain('Select only one mode at a time.');

      // Restore mode to Exact for subsequent tests
      await explorer.toggleModeMax(false);
      await explorer.toggleModeExact(true);
    });

    test('Clear Log when no search loaded should not crash and state remains Idle', async () => {
      // Ensure we're in Idle (we loaded initially in beforeEach, but updateUI default sets example data in inputs; no search loaded until user clicks)
      // Click Clear Log without loading a search
      await explorer.clickClearLog();
      const stateText = await explorer.getStateInfoText();
      expect(stateText).toContain('No search loaded.');
    });
  });

  test.describe('Max Mode behavior and final state', () => {
    test('Switch to Max mode and load search produces a final step with foundIndex (ternarySearchMax)', async () => {
      // Set array to unimodal sample and switch to Max mode
      await explorer.setArray('1,3,7,9,10,9,5,2');
      await explorer.toggleModeExact(false);
      await explorer.toggleModeMax(true);

      // Load search in Max mode
      await explorer.clickLoadSearch();

      // Keep stepping forward until generator yields final foundIndex
      // We'll step until stepForward becomes disabled
      let safeGuard = 0;
      while (!(await explorer.isDisabled(explorer.selectors.stepForward)) && safeGuard < 30) {
        await explorer.clickStepForward();
        safeGuard++;
      }

      // Now check that stateInfo has "Maximum" or "max" notice in decision text (final step)
      const stateText = await explorer.getStateInfoText();
      expect(stateText.toLowerCase()).toMatch(/max|maximum|max found|maximum at/);
    });
  });
});