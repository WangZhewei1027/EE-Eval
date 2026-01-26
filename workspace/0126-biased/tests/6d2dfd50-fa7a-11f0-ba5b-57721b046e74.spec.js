import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2dfd50-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the Radix Sort demo
class RadixPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    // Navigate and wait for load so that DOMContentLoaded handlers run
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait a short moment to allow initialization routines that run on DOMContentLoaded
    await this.page.waitForTimeout(50);
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async getText(selector) {
    return (await this.page.locator(selector).innerText()).trim();
  }

  async isVisible(selector) {
    return await this.page.locator(selector).isVisible();
  }

  async isDisabled(selector) {
    return await this.page.locator(selector).isDisabled();
  }

  async fill(selector, text) {
    await this.page.fill(selector, text);
  }

  async getArrayDisplayText() {
    return (await this.page.locator('#arrayDisplay').innerText()).trim();
  }

  async getStepDescription() {
    return (await this.page.locator('#stepDescription').innerText()).trim();
  }

  async getCountArrayHtml() {
    return await this.page.locator('#countArray').innerHTML();
  }

  async getBucketsHtml() {
    return await this.page.locator('#bucketsDisplay').innerHTML();
  }

  async getCurrentDigit() {
    return (await this.page.locator('#currentDigit').innerText()).trim();
  }

  async getMaxDigits() {
    return (await this.page.locator('#maxDigits').innerText()).trim();
  }

  async getSpeedValue() {
    return (await this.page.locator('#speedValue').innerText()).trim();
  }

  async getAutoStepText() {
    return (await this.page.locator('#autoStep').innerText()).trim();
  }

  // Expose some internal state via page.evaluate (reads existing globals, does not modify)
  async getSortState() {
    return await this.page.evaluate(() => {
      // Read the sortState object if present; return safe copy
      if (typeof sortState !== 'undefined') {
        return {
          isSorting: sortState.isSorting,
          currentPass: sortState.currentPass,
          currentDigit: sortState.currentDigit,
          maxDigits: sortState.maxDigits,
          base: sortState.base,
          direction: sortState.direction,
          hasAutoInterval: Boolean(sortState.autoStepInterval),
        };
      }
      return null;
    });
  }
}

test.describe('Radix Sort Interactive Demo - FSM and UI tests', () => {
  let radix;
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages (filter by severity)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    radix = new RadixPage(page);
    await radix.goto();
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected page errors or console errors remain (we assert in a dedicated test below as well)
    // Close page - Playwright will handle cleanup, but explicit for clarity
    await page.close();
  });

  test('Initial state (S0_Idle) - page initializes and displays ready state', async () => {
    // Validate initial visual state and controls after page load
    const stepText = await radix.getStepDescription();

    // The implementation runs generateRandomArray() on DOMContentLoaded which triggers resetSort.
    // Expect the UI to show that it's ready to sort.
    expect(stepText.toLowerCase()).toContain('ready to sort');

    // Next Step should be enabled (resetSort sets nextStep.disabled = false)
    expect(await radix.isDisabled('#nextStep')).toBe(false);

    // Counting and buckets panels should be hidden initially
    expect(await radix.isVisible('#countingPhase')).toBe(false);
    expect(await radix.isVisible('#bucketsPhase')).toBe(false);

    // No uncaught page errors at this point
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('GenerateRandomArray event transitions to Sorting (S0_Idle -> S1_Sorting) and resets state', async () => {
    // Click Generate Random Array
    await radix.click('#randomize');

    // Wait briefly for generation and resetSort to update display
    await radix.page.waitForTimeout(50);

    // Array display should contain some numbers
    const arrText = await radix.getArrayDisplayText();
    expect(arrText.length).toBeGreaterThan(0);

    // Start button should be enabled
    expect(await radix.isDisabled('#startSort')).toBe(false);

    // Verify sortState maxDigits reflects current array (read via page evaluate)
    const state = await radix.getSortState();
    expect(state).not.toBeNull();
    // maxDigits should be at least 1
    expect(state.maxDigits).toBeGreaterThanOrEqual(1);

    // Step description should be ready to sort
    const step = await radix.getStepDescription();
    expect(step.toLowerCase()).toContain('ready to sort');

    // No page-level errors should have occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ManualInput toggles input area and SubmitManualArray processes valid and invalid input', async () => {
    // Toggle manual input area visible
    await radix.click('#manualInput');
    expect(await radix.isVisible('#manualInputArea')).toBe(true);

    // Submit invalid manual input: expect an error message in stepDescription
    await radix.fill('#manualArray', 'a, b, , ');
    await radix.click('#submitManual');

    // Wait briefly for the handler to run
    await radix.page.waitForTimeout(20);

    let stepText = await radix.getStepDescription();
    expect(stepText.toLowerCase()).toContain('invalid input');

    // Now submit a valid manual array and expect resetSort to take effect
    await radix.fill('#manualArray', '3, 1, 2');
    await radix.click('#submitManual');

    // Wait for resetSort side effects
    await radix.page.waitForTimeout(50);

    // The manual input area should be hidden after successful submit
    expect(await radix.isVisible('#manualInputArea')).toBe(false);

    // Array display should reflect the submitted numbers (order displayed as "3, 1, 2" with possible base suffix)
    const arrText = await radix.getArrayDisplayText();
    expect(arrText).toMatch(/3/);
    expect(arrText).toMatch(/1/);
    expect(arrText).toMatch(/2/);

    // Step description should be ready to sort
    stepText = await radix.getStepDescription();
    expect(stepText.toLowerCase()).toContain('ready to sort');

    // No uncaught page errors or console errors from these interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('StartSorting (S1_Sorting) sets isSorting and disables Start Sorting button', async () => {
    // Prepare by submitting a small manual array
    await radix.click('#manualInput');
    await radix.fill('#manualArray', '5, 2, 9');
    await radix.click('#submitManual');
    await radix.page.waitForTimeout(20);

    // Start sorting
    await radix.click('#startSort');

    // Wait for state changes
    await radix.page.waitForTimeout(20);

    // Verify startSort button is disabled
    expect(await radix.isDisabled('#startSort')).toBe(true);

    // Verify sortState.isSorting is true
    const state = await radix.getSortState();
    expect(state.isSorting).toBe(true);

    // Step description indicates sorting started
    const stepText = await radix.getStepDescription();
    expect(stepText.toLowerCase()).toContain('sorting started');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('PerformNextStep transitions: S1_Sorting -> S2_CountingPhase -> S3_BucketsPhase -> S4_Complete', async () => {
    // Use a one-digit array to exercise the full flow quickly: manual array 3,1,2 -> maxDigits = 1
    await radix.click('#manualInput');
    await radix.fill('#manualArray', '3,1,2');
    await radix.click('#submitManual');
    await radix.page.waitForTimeout(20);

    // Start sorting
    await radix.click('#startSort');
    await radix.page.waitForTimeout(20);

    // Sanity: ensure showCount checkbox is checked by default
    const showCountChecked = await radix.page.$eval('#showCount', el => el.checked);
    expect(showCountChecked).toBe(true);

    // FIRST Next Step: should show counting phase and NOT progress to buckets yet.
    await radix.click('#nextStep');
    await radix.page.waitForTimeout(20);

    // Counting phase should be visible and countArray should include the correct text
    expect(await radix.isVisible('#countingPhase')).toBe(true);
    const countHtml = await radix.getCountArrayHtml();
    expect(countHtml.toLowerCase()).toContain('counting digits at position');

    // The handler unchecks the showCount checkbox after showing counting, so ensure it's now unchecked
    const showCountNow = await radix.page.$eval('#showCount', el => el.checked);
    expect(showCountNow).toBe(false);

    // SECOND Next Step: should perform actual distribution into buckets and likely complete the sort (maxDigits=1)
    await radix.click('#nextStep');
    await radix.page.waitForTimeout(50);

    // Buckets phase should be visible
    expect(await radix.isVisible('#bucketsPhase')).toBe(true);

    // Verify buckets content contains digits 0..9 or at least the digits present
    const bucketsHtml = await radix.getBucketsHtml();
    expect(bucketsHtml.length).toBeGreaterThan(0);
    expect(bucketsHtml.toLowerCase()).toContain('digit');

    // Because maxDigits was 1, sorting should now be complete
    const stepText = await radix.getStepDescription();
    expect(stepText.toLowerCase()).toContain('sorting complete');

    // NextStep button should be disabled after completion
    expect(await radix.isDisabled('#nextStep')).toBe(true);
    expect(await radix.isDisabled('#autoStep')).toBe(true);

    // Confirm internal state reports not sorting
    const state = await radix.getSortState();
    expect(state.isSorting).toBe(false);

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ToggleAutoStep while sorting starts and stops automatic progression', async ({ page }) => {
    // Prepare slightly larger array to allow multiple passes: "12,34,56,78"
    await radix.click('#manualInput');
    await radix.fill('#manualArray', '12,34,56,78');
    await radix.click('#submitManual');
    await radix.page.waitForTimeout(20);

    // Start sorting
    await radix.click('#startSort');
    await radix.page.waitForTimeout(20);

    // Auto step button should be enabled (resetSort enabled it)
    expect(await radix.isDisabled('#autoStep')).toBe(false);

    // Click auto step to start automatic stepping
    await radix.click('#autoStep');

    // Wait a short moment for the auto step to set interval and change button text
    await radix.page.waitForTimeout(100);

    // Expect the autoStep button text to indicate it's running
    const autoText = await radix.getAutoStepText();
    expect(autoText.toLowerCase()).toContain('stop auto step');

    // There should be an interval present in sortState as a signal
    const stateWhileAuto = await radix.getSortState();
    expect(stateWhileAuto.hasAutoInterval).toBe(true);

    // Now click auto step again to stop it
    await radix.click('#autoStep');
    await radix.page.waitForTimeout(50);

    // Text should revert
    const autoTextStopped = await radix.getAutoStepText();
    expect(autoTextStopped.toLowerCase()).toContain('auto step');

    // Interval flag should be false
    const stateAfterStop = await radix.getSortState();
    expect(stateAfterStop.hasAutoInterval).toBe(false);

    // No uncaught page errors produced by toggling auto step
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ResetSorting (S1_Sorting exit action resetSort) clears intervals and returns to idle', async () => {
    // Start with a manual array and start sorting to create internal state
    await radix.click('#manualInput');
    await radix.fill('#manualArray', '7,8,9');
    await radix.click('#submitManual');
    await radix.page.waitForTimeout(20);
    await radix.click('#startSort');
    await radix.page.waitForTimeout(20);

    // Kick on autoStep to create an interval
    await radix.click('#autoStep');
    await radix.page.waitForTimeout(50);
    // Then reset
    await radix.click('#reset');
    await radix.page.waitForTimeout(50);

    // sortState should be not sorting
    const state = await radix.getSortState();
    expect(state.isSorting).toBe(false);
    expect(state.hasAutoInterval).toBe(false);

    // Visual panels should be hidden
    expect(await radix.isVisible('#countingPhase')).toBe(false);
    expect(await radix.isVisible('#bucketsPhase')).toBe(false);

    // Step description returns to ready
    const stepText = await radix.getStepDescription();
    expect(stepText.toLowerCase()).toContain('ready to sort');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: empty manual input and showBinary toggle affect display', async () => {
    // Open manual input
    await radix.click('#manualInput');

    // Submit completely empty input -> should trigger invalid input message
    await radix.fill('#manualArray', '');
    await radix.click('#submitManual');

    await radix.page.waitForTimeout(20);
    let step = await radix.getStepDescription();
    expect(step.toLowerCase()).toContain('invalid input');

    // Now submit a valid number and toggle binary display
    await radix.fill('#manualArray', '10, 2');
    await radix.click('#submitManual');
    await radix.page.waitForTimeout(20);

    // By default showBinary is checked. Verify the array display contains base-converted suffix "(...)"
    const displayWithBinary = await radix.getArrayDisplayText();
    expect(displayWithBinary).toMatch(/\(/);

    // Uncheck showBinary and verify the parentheses suffix disappears
    await radix.page.click('#showBinary'); // toggles it off
    await radix.page.waitForTimeout(20);
    const displayNoBinary = await radix.getArrayDisplayText();
    expect(displayNoBinary).not.toMatch(/\(/);

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe console and page errors during interactions (should be none)', async () => {
    // Interact with several controls to capture potential errors
    await radix.click('#randomize');
    await radix.page.waitForTimeout(20);
    await radix.click('#manualInput');
    await radix.page.waitForTimeout(20);
    await radix.click('#manualInput'); // toggle back
    await radix.page.waitForTimeout(20);

    // Assert there were no uncaught page errors or console.error events
    expect(pageErrors.length).toBe(0, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`);
    if (consoleErrors.length > 0) {
      // Provide informative failure message if any console errors were detected
      const msgs = consoleErrors.map(c => `${c.text} @ ${JSON.stringify(c.location)}`).join('\n');
      throw new Error(`Console error messages detected:\n${msgs}`);
    }
  });
});