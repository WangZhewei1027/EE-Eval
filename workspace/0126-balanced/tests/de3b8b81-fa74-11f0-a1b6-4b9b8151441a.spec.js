import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b8b81-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object to encapsulate interactions and queries for the sorting visualization
class SortingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      arrayDisplay: '#array-display',
      arrayElements: '#array-display .array-element',
      currentStep: '#current-step',
      resetBtn: '#reset-btn',
      startBtn: '#start-btn',
      nextBtn: '#next-btn',
      completeBtn: '#complete-btn'
    };
    // Collect console & page errors for assertions
    this.consoleMessages = [];
    this.pageErrors = [];
    this.consoleListener = (msg) => {
      // capture only non-trivial messages
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    this.pageErrorListener = (error) => {
      this.pageErrors.push(error);
    };
  }

  // Navigate to the application and attach listeners
  async goto() {
    this.page.on('console', this.consoleListener);
    this.page.on('pageerror', this.pageErrorListener);
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // ensure initial render has completed
    await this.page.waitForSelector(this.selectors.arrayDisplay);
  }

  async teardown() {
    this.page.removeListener('console', this.consoleListener);
    this.page.removeListener('pageerror', this.pageErrorListener);
  }

  // Basic actions
  async clickStart() {
    await this.page.click(this.selectors.startBtn);
  }

  async clickNext() {
    // Use normal click (will wait for enabled). Tests sometimes click when enabled after reset.
    await this.page.click(this.selectors.nextBtn);
  }

  async clickComplete() {
    await this.page.click(this.selectors.completeBtn);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }

  // Queries
  async getCurrentStepText() {
    return (await this.page.locator(this.selectors.currentStep).textContent())?.trim() ?? '';
  }

  async getArrayValues() {
    return await this.page.evaluate((sel) => {
      return Array.from(document.querySelectorAll(sel)).map(el => {
        const t = el.textContent?.trim() ?? '';
        const n = Number(t);
        return Number.isNaN(n) ? t : n;
      });
    }, this.selectors.arrayElements);
  }

  async getArrayElementClassAt(index) {
    return await this.page.evaluate(({ sel, i }) => {
      const el = document.querySelectorAll(sel)[i];
      return el ? Array.from(el.classList) : [];
    }, { sel: this.selectors.arrayElements, i: index });
  }

  async isButtonDisabled(selector) {
    return await this.page.locator(selector).isDisabled();
  }

  // Helpers to wait until a condition or timeout
  async waitForCurrentStep(expected, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, expectedText) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.trim() === expectedText;
      },
      this.selectors.currentStep,
      expected,
      { timeout }
    );
  }

  async waitForCurrentStepNotEqual(original, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, originalText) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.trim() !== originalText;
      },
      this.selectors.currentStep,
      original,
      { timeout }
    );
  }
}

test.describe('Selection Sort Visualization - FSM and UI behavior', () => {
  let sorting;
  test.beforeEach(async ({ page }) => {
    sorting = new SortingPage(page);
    await sorting.goto();
  });

  test.afterEach(async ({}, testInfo) => {
    // On failure, include console messages for debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', sorting.consoleMessages);
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', sorting.pageErrors.map(e => e.message));
    }
    // Assert no uncaught page errors occurred during tests
    expect(sorting.pageErrors.length).toBe(0);
    await sorting.teardown();
  });

  test('Initial Idle state (S0_Idle) renders correctly', async () => {
    // This test validates the initial "Idle" state per FSM S0_Idle:
    // - The current step text should be the idle prompt.
    // - Array is rendered with correct length and initial visual markers.
    // - Buttons initial enabled/disabled states match the implementation.
    const currentText = await sorting.getCurrentStepText();
    expect(currentText).toBe('Click "Start" to begin');

    const values = await sorting.getArrayValues();
    // The initial array declared in the implementation has 8 values
    expect(values.length).toBe(8);
    expect(values).toEqual([64, 25, 12, 22, 11, 35, 45, 3]);

    // Visual indicators: currentMin is index 0, comparing is index 1
    const classes0 = await sorting.getArrayElementClassAt(0);
    const classes1 = await sorting.getArrayElementClassAt(1);
    expect(classes0).toContain('current-min');
    expect(classes1).toContain('comparing');

    // Buttons: start enabled, next disabled (per HTML), complete enabled, reset enabled
    expect(await sorting.isButtonDisabled(sorting.selectors.startBtn)).toBeFalsy();
    expect(await sorting.isButtonDisabled(sorting.selectors.nextBtn)).toBeTruthy();
    expect(await sorting.isButtonDisabled(sorting.selectors.completeBtn)).toBeFalsy();
    expect(await sorting.isButtonDisabled(sorting.selectors.resetBtn)).toBeFalsy();
  });

  test('StartSorting transition to S1_Sorting triggers automatic stepping', async () => {
    // This test validates that clicking Start enters the "Sorting" state (S1_Sorting):
    // - startSorting() should be invoked (state.sorting becomes true in implementation).
    // - Start, Next, Complete should become disabled while automatic sorting is active.
    // - The current step text should update after at least one automatic step.
    const beforeText = await sorting.getCurrentStepText();
    await sorting.clickStart();

    // Buttons should be disabled as per startSorting()
    expect(await sorting.isButtonDisabled(sorting.selectors.startBtn)).toBeTruthy();
    expect(await sorting.isButtonDisabled(sorting.selectors.nextBtn)).toBeTruthy();
    expect(await sorting.isButtonDisabled(sorting.selectors.completeBtn)).toBeTruthy();

    // Wait for at least one automated step to happen (performStep called via setInterval every 1000ms)
    // We wait slightly longer than 1s to observe the change
    await sorting.waitForCurrentStepNotEqual(beforeText, 3000);
    const afterText = await sorting.getCurrentStepText();
    expect(afterText.length).toBeGreaterThan(0);
    expect(afterText).not.toBe(beforeText);

    // There should be no uncaught errors produced by starting the automatic sorter
    expect(sorting.pageErrors.length).toBe(0);
  });

  test('CompleteSorting transition to S2_Sorted completes sorting synchronously and updates UI', async () => {
    // This test validates the "Complete All" action from the FSM:
    // - Clicking Complete All invokes completeSorting(), which completes sorting synchronously.
    // - After completion the current step text should show 'Sorting complete!'.
    // - Buttons are disabled appropriately (cannot start or step further).
    // - The displayed array should be sorted ascending.
    await sorting.clickComplete();

    // Wait for UI update to reflect completion
    await sorting.waitForCurrentStep('Sorting complete!', 3000);
    const finalText = await sorting.getCurrentStepText();
    expect(finalText).toBe('Sorting complete!');

    // Buttons should be disabled once sorted (per stopSorting logic)
    expect(await sorting.isButtonDisabled(sorting.selectors.startBtn)).toBeTruthy();
    expect(await sorting.isButtonDisabled(sorting.selectors.nextBtn)).toBeTruthy();
    expect(await sorting.isButtonDisabled(sorting.selectors.completeBtn)).toBeTruthy();

    // Verify the array elements are sorted ascending
    const finalValues = await sorting.getArrayValues();
    const expectedSorted = [...finalValues].sort((a, b) => a - b);
    expect(finalValues).toEqual(expectedSorted);
  });

  test('Reset transition to S0_Idle restores initial state and UI', async () => {
    // This test validates the "Reset" transition:
    // - From any state (we'll first complete), clicking Reset should restore the initial UI and state.
    // - It should re-enable Start, Next, Complete and reset the current step text and array order.
    // First, complete the sorting to change state
    await sorting.clickComplete();
    await sorting.waitForCurrentStep('Sorting complete!', 3000);

    // Now perform reset
    await sorting.clickReset();

    // After reset, UI should go back to initial idle text
    const resetText = await sorting.getCurrentStepText();
    expect(resetText).toBe('Click "Start" to begin');

    // Buttons after reset: start enabled, next enabled (implementation sets next to false -> enabled),
    // complete enabled
    expect(await sorting.isButtonDisabled(sorting.selectors.startBtn)).toBeFalsy();
    expect(await sorting.isButtonDisabled(sorting.selectors.nextBtn)).toBeFalsy();
    expect(await sorting.isButtonDisabled(sorting.selectors.completeBtn)).toBeFalsy();

    // Array should be restored to the original ordering
    const values = await sorting.getArrayValues();
    expect(values).toEqual([64, 25, 12, 22, 11, 35, 45, 3]);
  });

  test('NextStep manual stepping (via Next) completes sorting step-by-step', async () => {
    // This test validates the manual Next Step transition:
    // - Reset to ensure Next is enabled.
    // - Repeatedly click Next to performStep() until the algorithm reports 'Sorting complete!'.
    // - Confirm that the array ends up sorted and UI reports completion.
    await sorting.clickReset();

    // Next should be enabled after reset
    expect(await sorting.isButtonDisabled(sorting.selectors.nextBtn)).toBeFalsy();

    // Click Next repeatedly until completion or until a safe iteration limit
    const maxClicks = 200; // guard to avoid infinite loops if something goes wrong
    let clicks = 0;
    let currentText = await sorting.getCurrentStepText();
    while (currentText !== 'Sorting complete!' && clicks < maxClicks) {
      await sorting.clickNext();
      // performStep runs synchronously on click; fetch new text immediately
      currentText = await sorting.getCurrentStepText();
      clicks++;
    }

    expect(currentText).toBe('Sorting complete!');
    expect(clicks).toBeGreaterThan(0);
    const finalValues = await sorting.getArrayValues();
    const expectedSorted = [...finalValues].sort((a, b) => a - b);
    expect(finalValues).toEqual(expectedSorted);
  });

  test('Edge case: Next button remains disabled on initial page load and cannot be clicked normally', async () => {
    // This test checks an edge case indicated by the initial HTML: #next-btn is disabled.
    // We assert that the button is disabled and that interacting with it (without forcing) would be non-actionable.
    // We avoid forcing the click so the test does not try to dispatch a click artificially.
    const isNextDisabled = await sorting.isButtonDisabled(sorting.selectors.nextBtn);
    expect(isNextDisabled).toBeTruthy();

    // To ensure the UI does not change inadvertently, assert the current step text remains the idle text
    const currentText = await sorting.getCurrentStepText();
    expect(currentText).toBe('Click "Start" to begin');

    // Confirm no page errors were produced by simply querying the page
    expect(sorting.pageErrors.length).toBe(0);
  });

  test('Starting while already sorting should be idempotent (no double intervals visible via UI)', async () => {
    // This test ensures clicking Start results in the sorter entering a sorting state and
    // that the UI shows disabled control buttons (idempotent behavior).
    await sorting.clickStart();

    // Immediately ensure controls are disabled
    expect(await sorting.isButtonDisabled(sorting.selectors.startBtn)).toBeTruthy();
    expect(await sorting.isButtonDisabled(sorting.selectors.nextBtn)).toBeTruthy();
    expect(await sorting.isButtonDisabled(sorting.selectors.completeBtn)).toBeTruthy();

    // Attempting to click start again is not possible via normal click (button disabled),
    // but the expected behavior is that there's no duplicate enabling or errors.
    // Wait a bit and ensure no uncaught errors
    await sorting.page.waitForTimeout(1200);
    expect(sorting.pageErrors.length).toBe(0);

    // Stop the automatic sorting by invoking Complete All after first stopping of interval (UI currently disables complete).
    // To return to a stable state for teardown, call Reset (reset is always enabled per implementation).
    await sorting.clickReset();
    const resetText = await sorting.getCurrentStepText();
    expect(resetText).toBe('Click "Start" to begin');
  });
});