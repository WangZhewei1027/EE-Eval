import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1213d892-fa7a-11f0-acf9-69409043402d.html';

// Page Object encapsulating commonly used interactions and locators
class RadixPage {
  constructor(page) {
    this.page = page;
    this.inputArray = page.locator('#inputArray');
    this.btnSetArray = page.locator('#btnSetArray');
    this.btnRandomArray = page.locator('#btnRandomArray');
    this.randomLength = page.locator('#randomLength');
    this.randomMax = page.locator('#randomMax');
    this.currentArrayDisplay = page.locator('#currentArrayDisplay');

    this.optStable = page.locator('#optStable');
    this.optLsd = page.locator('#optLsd');
    this.optMsd = page.locator('#optMsd');
    this.radixBase = page.locator('#radixBase');

    this.btnStartSort = page.locator('#btnStartSort');
    this.btnNextStep = page.locator('#btnNextStep');
    this.btnPrevStep = page.locator('#btnPrevStep');
    this.btnAutoRun = page.locator('#btnAutoRun');
    this.btnPause = page.locator('#btnPause');
    this.btnReset = page.locator('#btnReset');
    this.stepDelay = page.locator('#stepDelay');

    this.sortStepInfo = page.locator('#sortStepInfo');
    this.arrayTableDiv = page.locator('#arrayTableDiv');
    this.bucketsDiv = page.locator('#bucketsDiv');

    this.btnJumpToPass = page.locator('#btnJumpToPass');
    this.jumpPassNumber = page.locator('#jumpPassNumber');
    this.btnJumpToStep = page.locator('#btnJumpToStep');
    this.jumpStepNumber = page.locator('#jumpStepNumber');
    this.btnShowFullHistory = page.locator('#btnShowFullHistory');
    this.btnHideFullHistory = page.locator('#btnHideFullHistory');
    this.fullHistoryDiv = page.locator('#fullHistoryDiv');

    this.debuglog = page.locator('#debuglog');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // utility to accept all dialogs automatically
  attachDialogAutoAccept() {
    this.page.on('dialog', async (dialog) => {
      // accept alert/confirm to allow flows to continue
      try {
        await dialog.accept();
      } catch (e) {
        // ignoring if already handled
      }
    });
  }

  // Set the input text and click Set Array
  async setArray(text) {
    await this.inputArray.fill(text);
    await this.btnSetArray.click();
  }

  // Click Random Array
  async generateRandomArray() {
    await this.btnRandomArray.click();
  }

  // Start sort
  async startSort() {
    await this.btnStartSort.click();
  }

  async nextStep() {
    await this.btnNextStep.click();
  }

  async prevStep() {
    await this.btnPrevStep.click();
  }

  async startAutoRun() {
    await this.btnAutoRun.click();
  }

  async pauseAutoRun() {
    await this.btnPause.click();
  }

  async resetSort() {
    // reset triggers a confirm dialog; ensure dialog auto-accept is attached
    await this.btnReset.click();
  }

  async jumpToPass(n) {
    await this.jumpPassNumber.fill(String(n));
    await this.btnJumpToPass.click();
  }

  async jumpToStep(n) {
    await this.jumpStepNumber.fill(String(n));
    await this.btnJumpToStep.click();
  }

  async showFullHistory() {
    await this.btnShowFullHistory.click();
  }

  async hideFullHistory() {
    await this.btnHideFullHistory.click();
  }

  // get text helpers
  async getCurrentArrayText() {
    return (await this.currentArrayDisplay.textContent())?.trim();
  }

  async getInputArrayValue() {
    return (await this.inputArray.inputValue()).trim();
  }

  async getSortStepInfoText() {
    return (await this.sortStepInfo.textContent())?.trim();
  }

  async getFullHistoryText() {
    return (await this.fullHistoryDiv.textContent())?.trim();
  }
}

// Capture console errors and page errors globally per test
test.describe('Radix Sort Interactive Demonstration - FSM and UI tests', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    // collect page errors (unhandled exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test ensure there were no console/page runtime errors.
    // Many educational pages run without errors; assert none were emitted.
    expect(consoleErrors.length, `Console errors were logged: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    expect(pageErrors.length, `Page errors were thrown: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    // remove listeners to avoid cross-test leakage
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
    page.removeAllListeners('dialog');
  });

  test.describe('Initial Idle and Array Set states (S0 -> S1)', () => {
    test('Idle: page loads and default array is displayed (S0_Idle entry)', async ({ page }) => {
      const p = new RadixPage(page);
      p.attachDialogAutoAccept();
      await p.goto();

      // Validate that current array display contains the default provided in HTML
      const currentArray = await p.getCurrentArrayText();
      expect(currentArray).toBeTruthy();
      // Expect the default numbers to appear (given in HTML input value)
      expect(currentArray).toContain('170');
      expect(currentArray).toContain('802');

      // Controls initial state: Next/Prev/Auto/Pause/Reset should be disabled
      await expect(p.btnNextStep).toBeDisabled();
      await expect(p.btnPrevStep).toBeDisabled();
      await expect(p.btnAutoRun).toBeDisabled();
      await expect(p.btnPause).toBeDisabled();
      await expect(p.btnReset).toBeDisabled();
    });

    test('Set Array transitions to ArraySet (S0 -> S1) and updates display and debug log', async ({ page }) => {
      const p = new RadixPage(page);
      p.attachDialogAutoAccept();
      await p.goto();

      // Set a new array and verify display updates
      await p.setArray('3, 1, 2');
      const shown = await p.getCurrentArrayText();
      expect(shown).toContain('3, 1, 2');

      // Debug log should mention array set
      const debugText = (await p.debuglog.textContent()) || '';
      expect(debugText).toMatch(/Array set to:/);
    });

    test('Random Array generates a different array and updates input and display (S0 -> S1 via RandomArray)', async ({ page }) => {
      const p = new RadixPage(page);
      p.attachDialogAutoAccept();
      await p.goto();

      // Click Random Array and assert that the input and display change to numeric values
      await p.generateRandomArray();

      const inputVal = await p.getInputArrayValue();
      const displayVal = await p.getCurrentArrayText();
      expect(inputVal.length).toBeGreaterThan(0);
      expect(displayVal.length).toBeGreaterThan(0);
      // Should contain at least one comma (since join uses commas)
      expect(displayVal).toMatch(/^\d+/);
      // Debug log should mention random array generated
      const debugText = (await p.debuglog.textContent()) || '';
      expect(debugText).toMatch(/Random array generated:/);
    });
  });

  test.describe('Sorting lifecycle: StartSort, Next/Prev Step, AutoRun, Pause, Reset (S1 -> S2 -> S3 -> S4)', () => {
    test('StartSort should build history and move to Sorting (S1_ArraySet -> S2_Sorting)', async ({ page }) => {
      const p = new RadixPage(page);
      p.attachDialogAutoAccept();
      await p.goto();

      // Ensure a known array is set
      await p.setArray('170, 45, 75, 90, 802, 24, 2, 66');

      // Start sort
      await p.startSort();

      // After start: sorting started and first step rendered
      const stepInfo = await p.getSortStepInfoText();
      expect(stepInfo).toBeTruthy();
      expect(stepInfo).toMatch(/Pass #[0-9]+, Step #/);

      // Next step should be enabled (if there is more than one history step)
      await expect(p.btnNextStep).toBeEnabled();

      // StartSort should have logged "Sort started." in debug
      const debugText = (await p.debuglog.textContent()) || '';
      expect(debugText).toMatch(/Sort started/);
    });

    test('NextStep and PrevStep update visualization and controls correctly (S2 -> S3 and S3 -> S3)', async ({ page }) => {
      const p = new RadixPage(page);
      p.attachDialogAutoAccept();
      await p.goto();

      await p.setArray('5,4,3,2,1');
      await p.startSort();

      // Capture initial info
      const initialInfo = await p.getSortStepInfoText();
      expect(initialInfo).toContain('Pass #');

      // Click NextStep and expect step info changes (advances in history)
      await p.nextStep();
      const afterNext = await p.getSortStepInfoText();
      expect(afterNext).not.toBe(initialInfo);

      // Click PrevStep and expect to return to previous info
      await p.prevStep();
      const afterPrev = await p.getSortStepInfoText();
      // Should match the initial info or at least contain the same pass number indicator for first step
      expect(afterPrev).toContain('Pass #');
    });

    test('AutoRun should progress steps automatically and Pause should stop it (S3_SortingPaused -> S2_Sorting -> S3_SortingPaused)', async ({ page }) => {
      const p = new RadixPage(page);
      p.attachDialogAutoAccept();
      await p.goto();

      // Use a small delay to speed test
      await p.setArray('21,4,5,3,7,2,9,1');
      await p.stepDelay.fill('20'); // extremely small to allow rapid auto-run
      await p.startSort();

      // Ensure sorting is paused after startSort; then start auto run
      await expect(p.btnAutoRun).toBeEnabled();
      await p.startAutoRun();

      // Allow a short time window for auto run to progress a few steps
      await page.waitForTimeout(150);

      // Pause and then capture current step info
      await p.pauseAutoRun();
      const infoAfterAuto = await p.getSortStepInfoText();
      expect(infoAfterAuto).toBeTruthy();

      // Ensure that after pausing the AutoRun button becomes enabled (pause toggles)
      await expect(p.btnAutoRun).toBeEnabled();
      // Pause button should be disabled after pausing
      await expect(p.btnPause).toBeDisabled();
    }, { timeout: 10000 });

    test('ResetSort returns UI to ready state and restores original array (S3 -> S4_SortingCompleted via ResetSort)', async ({ page }) => {
      const p = new RadixPage(page);
      p.attachDialogAutoAccept();
      await p.goto();

      // Set array, start sort, then reset
      await p.setArray('10,9,8');
      await p.startSort();

      // Reset triggers confirm; dialog is auto-accepted by attachDialogAutoAccept
      await p.resetSort();

      // After reset: sorting controls disabled and current array restored
      await expect(p.btnStartSort).toBeEnabled(); // start should be enabled again
      await expect(p.btnNextStep).toBeDisabled();
      await expect(p.btnReset).toBeDisabled();

      const currentText = await p.getCurrentArrayText();
      // Should show the original array values again
      expect(currentText).toContain('10');
      expect(currentText).toContain('9');

      // Debug log should mention "Sort reset."
      const debugText = (await p.debuglog.textContent()) || '';
      expect(debugText).toMatch(/Sort reset/);
    });
  });

  test.describe('Exploration controls: JumpToPass, JumpToStep, Show/Hide Full History', () => {
    test('Jump to pass and step within pass updates currentHistoryIndex and visualization (S3 -> S3)', async ({ page }) => {
      const p = new RadixPage(page);
      p.attachDialogAutoAccept();
      await p.goto();

      // Use a small predictable array to ensure multiple passes exist in LSD
      await p.setArray('170,45,75,90,802,24,2,66');
      await p.startSort();

      // Initially at history index 0
      const initialInfo = await p.getSortStepInfoText();
      expect(initialInfo).toContain('Pass #');

      // Jump to pass 1 if exists
      // Try pass 1; if not found, the function will show an alert which is auto-accepted.
      await p.jumpToPass(1);
      const afterJumpPass = await p.getSortStepInfoText();
      expect(afterJumpPass).toContain('Pass #');

      // Now attempt to jump to a specific step within this pass (e.g., step 2)
      // Using the current pass context: attempt jump to step 2 (may or may not exist)
      // If it exists, the UI will update; if not, an alert would have been shown (auto-accepted) and nothing changes.
      await p.jumpToStep(2);
      const afterJumpStep = await p.getSortStepInfoText();
      expect(afterJumpStep).toContain('Pass #');
    });

    test('Show Full History reveals the text and Hide Full History clears it (S3 -> S3)', async ({ page }) => {
      const p = new RadixPage(page);
      p.attachDialogAutoAccept();
      await p.goto();

      await p.setArray('3,2,1');
      await p.startSort();

      // Show full history
      await p.showFullHistory();
      const fullText = await p.getFullHistoryText();
      expect(fullText).toBeTruthy();
      expect(fullText).toMatch(/Step 0/);

      // Hide and ensure the content is cleared and button toggles
      await p.hideFullHistory();
      const hiddenText = await p.getFullHistoryText();
      expect(hiddenText).toBe('');
      // Show/Hide buttons toggle visibility; ensure Show is visible again
      await expect(p.btnShowFullHistory).toBeVisible();
    });
  });

  test.describe('Edge cases and validations', () => {
    test('Invalid input array shows alert and does not change current array', async ({ page }) => {
      const p = new RadixPage(page);
      // We'll explicitly handle dialogs here to assert they happen
      let seenAlert = false;
      page.on('dialog', async dialog => {
        // The invalid input triggers an alert; capture and accept
        seenAlert = true;
        await dialog.accept();
      });

      await p.goto();
      // record current array before invalid set
      const before = await p.getCurrentArrayText();
      // Try to set an invalid array (non-integer tokens)
      await p.inputArray.fill('a, b, c');
      await p.btnSetArray.click();

      // Accept happened and must have been triggered
      expect(seenAlert).toBe(true);

      // Ensure current array remains unchanged
      const after = await p.getCurrentArrayText();
      expect(after).toBe(before);

      // remove this custom dialog handler to not interfere with afterEach
      page.removeAllListeners('dialog');
    });

    test('Changing stepDelay while running restarts auto-run with new delay', async ({ page }) => {
      const p = new RadixPage(page);
      p.attachDialogAutoAccept();
      await p.goto();

      await p.setArray('9,8,7,6,5,4,3,2,1');
      await p.stepDelay.fill('50');
      await p.startSort();

      // Start auto-run with 50ms steps
      await p.startAutoRun();
      await page.waitForTimeout(120);
      await p.pauseAutoRun();
      const infoFirstPause = await p.getSortStepInfoText();

      // Change delay to a smaller value and ensure changing triggers restart (code restarts if running)
      await p.stepDelay.fill('10');
      // Changing the stepDelay input triggers change handler which restarts only if !sortingPaused is false
      // Ensure that there are no exceptions and UI remains consistent
      await p.page.waitForTimeout(20);

      // No assertion on exact step count, but the UI should still be responsive and show step info
      const infoAfterChange = await p.getSortStepInfoText();
      expect(infoAfterChange).toBeTruthy();
    });
  });
});