import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cea951-fa79-11f0-8075-e54a10595dde.html';

// Page Object encapsulating interactions with the Bubble Sort page
class BubbleSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#startButton');
    this.stepButton = page.locator('#stepButton');
    this.resetButton = page.locator('#resetButton');
    this.arrayInput = page.locator('#arrayInput');
    this.arrayDisplay = page.locator('#arrayDisplay');
    this.speedSlider = page.locator('#speedSlider');
    this.speedValue = page.locator('#speedValue');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getArrayInputValue() {
    return await this.arrayInput.inputValue();
  }

  async getArrayDisplayText() {
    return await this.arrayDisplay.innerText();
  }

  async clickStart() {
    await this.startButton.click();
  }

  async clickStep() {
    await this.stepButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  // Set the slider value and dispatch an input event to simulate user interaction.
  async setSpeed(value) {
    // Use evaluate to set the value and dispatch the 'input' event in-page.
    await this.speedSlider.evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async getSpeedValueText() {
    return await this.speedValue.innerText();
  }
}

test.describe('Interactive Bubble Sort Visualization (FSM validation)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Collect uncaught page errors and console messages for assertions and diagnostics
    pageErrors = [];
    consoleMessages = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application under test
    const bsp = new BubbleSortPage(page);
    await bsp.goto();
  });

  test.afterEach(async ({ page }) => {
    // After each test ensure there were no unexpected runtime errors in the page
    // Tests below assert behavior; having zero uncaught page errors is an important invariant.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    // consoleMessages is kept for debugging; no failure asserted here (some pages log normally)
  });

  test.describe('Idle state (S0_Idle) validations', () => {
    test('Initial load shows input default and no array display (entry action mismatch)', async ({ page }) => {
      // This test validates the Idle state as observed on page load.
      // According to the FSM S0_Idle entry action should call displayArray(), but the implementation does not call it on load.
      // We assert the actual behavior (no display text) and capture that mismatch.
      const bsp = new BubbleSortPage(page);

      // Verify input default matches expected component definition
      const inputVal = await bsp.getArrayInputValue();
      expect(inputVal).toBe('64,34,25,12,22,11,90');

      // The implementation does NOT call displayArray() on initial load, so arrayDisplay should be empty.
      const displayText = await bsp.getArrayDisplayText();
      expect(displayText).toBe('', 'Expected arrayDisplay to be empty on initial load because displayArray() is not invoked by the implementation.');

      // No uncaught page errors during initial load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('StartSorting (Start -> Sorting -> Sorted transitions)', () => {
    test('Clicking Start triggers bubbleSort and subsequent Next Step shows "Sorting is complete." (S1 -> S2)', async ({ page }) => {
      // This test verifies that clicking start invokes the in-page startSorting() which calls bubbleSort().
      // Because bubbleSort() in the implementation sets isSorted = true at the end,
      // invoking Next Step afterwards should cause an immediate alert "Sorting is complete."
      const bsp = new BubbleSortPage(page);

      // Click Start to trigger parsing the input and running bubbleSort()
      await bsp.clickStart();

      // After start, the #arrayDisplay should show some "Current Array: ..." (implementation sets array to steps)
      const displayAfterStart = await bsp.getArrayDisplayText();
      expect(displayAfterStart.startsWith('Current Array:'), 'Expected arrayDisplay to start with "Current Array:" after Start').toBeTruthy();

      // The implementation's bubbleSort() mutates array into a sequence of indices (steps), so the display will not match the original input string.
      expect(displayAfterStart).not.toContain('64,34,25,12,22,11,90');

      // Now clicking Next Step should show the "Sorting is complete." alert because isSorted was set by bubbleSort().
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        bsp.clickStep()
      ]);
      expect(dialog.message()).toBe('Sorting is complete.');
      await dialog.accept();

      // Ensure no uncaught page errors during this interaction
      expect(pageErrors.length).toBe(0);
    });

    test('Reset after Start returns to Idle-like state (S1 -> S0) and displayArray shows empty array', async ({ page }) => {
      // This test validates that reset() clears internal state and resets the input to the default value.
      const bsp = new BubbleSortPage(page);

      // Start first to have non-empty arrayDisplay, then reset
      await bsp.clickStart();
      const displayAfterStart = await bsp.getArrayDisplayText();
      expect(displayAfterStart.startsWith('Current Array:')).toBeTruthy();

      // Click Reset
      await bsp.clickReset();

      // After reset, the input should be reset to the default value and the arrayDisplay should show "Current Array: " for an empty array
      const inputAfterReset = await bsp.getArrayInputValue();
      expect(inputAfterReset).toBe('64,34,25,12,22,11,90');

      const displayAfterReset = await bsp.getArrayDisplayText();
      // Implementation sets array = [] and calls displayArray(), so display should show the label but with empty content after colon.
      expect(displayAfterReset).toBe('Current Array: ');

      // Now, since isSorted was reset to false and array is empty, clicking Next Step should raise the "One pass completed." alert per implementation logic.
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        bsp.clickStep()
      ]);
      expect(dialog.message()).toBe('One pass completed.');
      await dialog.accept();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('NextStep and edge-case behaviors (S1 transitions)', () => {
    test('Clicking Next Step without starting demonstrates edge-case handling and triggers "One pass completed."', async ({ page }) => {
      // This test examines the behavior when Next Step is used without first calling Start.
      // The implementation uses the internal array variable (initially []) and currentStep logic which leads to the "One pass completed." alert.
      const bsp = new BubbleSortPage(page);

      // Ensure fresh state (we are on load). Click Step directly
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        bsp.clickStep()
      ]);
      // Implementation's nextStep() will set isSorted true and alert 'One pass completed.' in this edge-case.
      expect(dialog.message()).toBe('One pass completed.');
      await dialog.accept();

      expect(pageErrors.length).toBe(0);
    });

    test('Verify that Next Step swap logic is unreachable via normal UI because bubbleSort() sets isSorted immediately', async ({ page }) => {
      // This test documents the practical limitation: the implemented startSorting() immediately runs bubbleSort(),
      // which sets isSorted=true so the Next Step path that swaps neighbors within the array is never reached via the public UI.
      // We validate that starting and then clicking Next Step triggers "Sorting is complete." as evidence.
      const bsp = new BubbleSortPage(page);

      // Click start to run bubbleSort which marks isSorted = true
      await bsp.clickStart();

      // Now attempt Next Step - should show "Sorting is complete."
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        bsp.clickStep()
      ]);
      expect(dialog.message()).toBe('Sorting is complete.');
      await dialog.accept();

      // We cannot assert the internal swap path (it requires bypassing startSorting), so assert the observed behavior instead
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('ChangeSpeed event (ChangeSpeed)', () => {
    test('Changing the speed slider updates the displayed speed value', async ({ page }) => {
      // This test ensures the speed slider input event updates the #speedValue text as implemented.
      const bsp = new BubbleSortPage(page);

      // Change speed to a value within the allowed range
      await bsp.setSpeed(300);

      // The UI should reflect the change
      const speedText = await bsp.getSpeedValueText();
      expect(speedText).toBe('300 ms');

      // Change again to another value
      await bsp.setSpeed(750);
      expect(await bsp.getSpeedValueText()).toBe('750 ms');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Diagnostics: console and runtime errors observation', () => {
    test('No uncaught page errors and console messages are captured (for inspection)', async ({ page }) => {
      // This test explicitly confirms that no uncaught runtime errors occurred during page load.
      // It also asserts that we captured console messages into the consoleMessages array (which may be empty).
      const bsp = new BubbleSortPage(page);

      // Trigger a simple interaction to produce any console output (change speed)
      await bsp.setSpeed(500);

      // We assert there are zero uncaught page errors
      expect(pageErrors.length).toBe(0);

      // consoleMessages is captured for debugging. We assert it's an array (length can be zero).
      expect(Array.isArray(consoleMessages)).toBeTruthy();
    });
  });
});