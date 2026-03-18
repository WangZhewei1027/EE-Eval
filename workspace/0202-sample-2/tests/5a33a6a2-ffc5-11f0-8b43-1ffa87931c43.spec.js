import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a33a6a2-ffc5-11f0-8b43-1ffa87931c43.html';

// Page object to encapsulate DOM interactions for the Merge Sort demo
class MergeSortPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async startButton() {
    return this.page.locator('#startBtn');
  }

  async resetButton() {
    return this.page.locator('#resetBtn');
  }

  async inputField() {
    return this.page.locator('#arrayInput');
  }

  async stepsContainer() {
    return this.page.locator('#stepsContainer');
  }

  async clickStart() {
    await (await this.startButton()).click();
  }

  async clickReset() {
    await (await this.resetButton()).click();
  }

  async setInput(value) {
    const input = await this.inputField();
    await input.fill(''); // clear
    await input.type(value);
  }

  async getStartDisabled() {
    return (await this.startButton()).isDisabled();
  }

  async getResetDisabled() {
    return (await this.resetButton()).isDisabled();
  }

  async getInputDisabled() {
    return (await this.inputField()).isDisabled();
  }

  async countSteps() {
    return this.stepsContainer().locator('.step').count();
  }

  async firstStepText() {
    return this.stepsContainer().locator('.step').first().innerHTML();
  }
}

test.describe('Divide and Conquer Demonstration - Merge Sort FSM Tests', () => {
  // Arrays to collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;
  let dialogs;
  let msPage;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Collect console error messages
    page.on('console', msg => {
      // collect only error level console messages for assertion
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Collect uncaught exceptions / page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Collect dialogs (alerts) so tests can assert them
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // Accept the dialog so it doesn't block test flow
      await dialog.accept();
    });

    msPage = new MergeSortPage(page);
    await msPage.goto();
  });

  test.afterEach(async () => {
    // After each test, ensure there were no unexpected runtime errors
    // Tests explicitly assert error conditions when expected; for normal flows we expect no page errors
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.map(c => c.text).join('; ')}`).toBe(0);
  });

  test('S0_Idle state: initial render shows controls in Idle configuration', async () => {
    // Validate initial (Idle) state: start enabled, reset disabled, input has default value, no steps rendered
    const startDisabled = await msPage.getStartDisabled();
    const resetDisabled = await msPage.getResetDisabled();
    const inputDisabled = await msPage.getInputDisabled();
    const inputVal = await (await msPage.inputField()).inputValue();
    const stepCount = await msPage.countSteps();

    // Start should be enabled in Idle state
    expect(startDisabled).toBe(false);
    // Reset should be disabled initially
    expect(resetDisabled).toBe(true);
    // Input should be enabled
    expect(inputDisabled).toBe(false);
    // Default value as per implementation evidence
    expect(inputVal).toContain('8,3,5,4,7,6,1,2');
    // No steps displayed initially
    expect(stepCount).toBe(0);
  });

  test('StartSorting transition (S0 -> S1): clicking Start begins animateSteps and displays steps', async ({ page }) => {
    // This validates the StartSorting event and transition into Sorting state.
    // Because animateSteps appends at least the first step synchronously before awaiting,
    // we can immediately assert that a step was added and buttons/input states updated.
    const startBtn = await msPage.startButton();
    const resetBtn = await msPage.resetButton();
    const input = await msPage.inputField();

    // Click start to trigger mergeSort + animateSteps
    await startBtn.click();

    // Immediately after click, animateSteps should have set startBtn disabled and resetBtn enabled, and input disabled
    expect(await startBtn.isDisabled()).toBe(true);
    expect(await resetBtn.isDisabled()).toBe(false);
    expect(await input.isDisabled()).toBe(true);

    // There should be at least one step appended synchronously
    const stepCount = await msPage.countSteps();
    expect(stepCount).toBeGreaterThanOrEqual(1);

    // The first step should contain highlight text like 'Divide' or 'Base case' depending on processing;
    // assert that it contains some expected keywords from the implementation (evidence)
    const firstText = await msPage.firstStepText();
    expect(firstText.length).toBeGreaterThan(0);
    const containsKeyword = ['Base case', 'Divide', 'Merge Start', 'Merge Step', 'Merge End']
      .some(keyword => firstText.includes(keyword));
    expect(containsKeyword).toBe(true);

    // Stop the long-running animation by clicking Reset to exit sorting (transition S1 -> S2)
    await resetBtn.click();

    // After reset: steps cleared and resetBtn becomes disabled, start enabled, input enabled
    expect(await msPage.countSteps()).toBe(0);
    expect(await startBtn.isDisabled()).toBe(false);
    expect(await resetBtn.isDisabled()).toBe(true);
    expect(await input.isDisabled()).toBe(false);
  });

  test('ResetSorting transition (S1 -> S2) followed by StartSorting (S2 -> S1): restart after reset', async () => {
    // Start the sorting process
    await msPage.clickStart();

    // Ensure animation started (first step present)
    expect(await msPage.countSteps()).toBeGreaterThanOrEqual(1);
    expect(await msPage.getStartDisabled()).toBe(true);
    expect(await msPage.getResetDisabled()).toBe(false);

    // Click reset to transition to Reset state
    await msPage.clickReset();

    // After reset: steps cleared
    expect(await msPage.countSteps()).toBe(0);
    expect(await msPage.getResetDisabled()).toBe(true);
    expect(await msPage.getStartDisabled()).toBe(false);

    // Now from Reset state, start again to transition back to Sorting (S2 -> S1)
    await msPage.clickStart();

    // Immediately we should observe steps again and inputs disabled
    expect(await msPage.countSteps()).toBeGreaterThanOrEqual(1);
    expect(await msPage.getInputDisabled()).toBe(true);

    // Clean up by resetting
    await msPage.clickReset();
    expect(await msPage.countSteps()).toBe(0);
  });

  test('Edge case: empty input triggers alert and does not start sorting', async () => {
    // This validates the error handling path when user input is invalid (empty).
    await msPage.setInput(''); // empty input

    // Click start; implementation shows an alert when no valid numbers present
    await msPage.clickStart();

    // Assert a dialog was shown with the expected message
    // Note: the page 'dialog' handler in beforeEach accepted the dialog and recorded it
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const alert = dialogs.find(d => d.type === 'alert');
    expect(alert, `Expected an alert dialog when starting with empty input; dialogs: ${JSON.stringify(dialogs)}`).toBeTruthy();
    expect(alert.message).toContain('Please enter a valid list of comma separated numbers.');

    // Ensure that sorting did not start: no steps appended and start button remains enabled
    expect(await msPage.countSteps()).toBe(0);
    expect(await msPage.getStartDisabled()).toBe(false);
    // Reset should remain disabled
    expect(await msPage.getResetDisabled()).toBe(true);
  });

  test('Edge case: non-numeric values filtered out; single numeric value produces Base case step', async () => {
    // Input with non-numeric values. parseInputArray filters non-numeric, so only numbers remain.
    // If only one numeric value remains, mergeSort should record a baseCase step and animateSteps will run.
    await msPage.setInput('a, b, 42, foo');

    // Click start to trigger processing
    await msPage.clickStart();

    // First step should be baseCase for single element [42]
    const firstHTML = await msPage.firstStepText();
    // Confirm presence of 'Base case' and the number 42 in the message or array output
    expect(firstHTML).toContain('Base case');
    expect(firstHTML).toContain('42');

    // Clean up: reset to stop animation and restore Idle
    await msPage.clickReset();
    expect(await msPage.countSteps()).toBe(0);
    expect(await msPage.getResetDisabled()).toBe(true);
    expect(await msPage.getStartDisabled()).toBe(false);
  });
});