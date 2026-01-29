import { test, expect } from '@playwright/test';

// Test file: 63b21193-fa74-11f0-bb9a-db7e6ecdeeaa.spec.js
// Application URL (served externally as per requirements)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b21193-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object for the Sliding Window Visualization app
class SlidingWindowPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      arrayContainer: '#arrayContainer',
      windowSize: '#windowSize',
      startBtn: '#startBtn',
      nextStepBtn: '#nextStepBtn',
      resetBtn: '#resetBtn',
      outputArea: '#outputArea'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async start() {
    await this.page.click(this.selectors.startBtn);
  }

  async nextStep() {
    await this.page.click(this.selectors.nextStepBtn);
  }

  async reset() {
    await this.page.click(this.selectors.resetBtn);
  }

  async setWindowSize(value) {
    await this.page.fill(this.selectors.windowSize, String(value));
  }

  async getArrayElements() {
    return await this.page.$$eval(
      `${this.selectors.arrayContainer} .array-element`,
      els => els.map(el => {
        return {
          text: el.textContent.trim(),
          hasWindowClass: el.classList.contains('window'),
          hasPointer: !!el.querySelector('div')
        };
      })
    );
  }

  async getOutputText() {
    return await this.page.$eval(this.selectors.outputArea, el => el.textContent);
  }

  async isDisabled(selector) {
    return await this.page.$eval(selector, el => el.disabled === true);
  }

  async getWindowSizeValue() {
    return await this.page.$eval(this.selectors.windowSize, el => el.value);
  }
}

// Group related tests
test.describe('Sliding Window Visualization - FSM validation', () => {
  // Collect console and page errors for each test to assert later
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events and page errors (uncaught exceptions)
    page.on('console', msg => {
      // Capture console error level messages for later assertions
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });

    // Navigate to the application page
    const sw = new SlidingWindowPage(page);
    await sw.goto();
  });

  test.afterEach(async () => {
    // After each test, assert that there were no unexpected console errors or uncaught page errors.
    // These assertions ensure the app runs without runtime exceptions during interactions.
    // If any console errors or page errors are present, they will be included in the assertion messages.
    expect(pageErrors.length, `Expected no uncaught page errors, got: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages, got: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
  });

  test('Initial state (S0_Idle): renderArray called and controls initial state', async ({ page }) => {
    // Validate the initial UI matches expected Idle state rendering
    const sw1 = new SlidingWindowPage(page);

    // The page's script calls renderArray() on load. Verify array elements are present.
    const elements = await sw.getArrayElements();
    // The provided data array length in the implementation is 10
    expect(elements.length).toBe(10);

    // Verify texts of first few elements to confirm correct rendering (sample)
    const expectedStart = ['2', '1', '5', '1', '3'];
    for (let i = 0; i < expectedStart.length; i++) {
      expect(elements[i].text).toBe(expectedStart[i]);
    }

    // Verify no window highlighting initially (Idle)
    const anyWindowClass = elements.some(el => el.hasWindowClass);
    expect(anyWindowClass).toBe(false);

    // Verify initial control states
    expect(await sw.isDisabled(sw.selectors.startBtn)).toBe(false);
    expect(await sw.isDisabled(sw.selectors.nextStepBtn)).toBe(true);
    expect(await sw.isDisabled(sw.selectors.resetBtn)).toBe(true);

    // Verify default window size value
    expect(await sw.getWindowSizeValue()).toBe('3');

    // Verify output area is initially empty
    expect(await sw.getOutputText()).toBe('');
  });

  test('Transition S0_Idle -> S1_Sliding on StartClick: initial window computed and UI updates', async ({ page }) => {
    // Comment: This test validates the Start transition: resets and renders initial window and output text
    const sw2 = new SlidingWindowPage(page);

    // Click Start and ensure initial sums and UI changes happen
    await sw.start();

    // After start, startBtn should be disabled, nextStep and reset enabled, window size disabled
    expect(await sw.isDisabled(sw.selectors.startBtn)).toBe(true);
    expect(await sw.isDisabled(sw.selectors.nextStepBtn)).toBe(false);
    expect(await sw.isDisabled(sw.selectors.resetBtn)).toBe(false);
    const wsDisabled = await sw.page.$eval(sw.selectors.windowSize, el => el.disabled === true);
    expect(wsDisabled).toBe(true);

    // Output should show initial window [0..2] sum = 8. Max sum so far = 8.
    const output = await sw.getOutputText();
    expect(output).toContain('Initial window [0..2] sum = 8. Max sum so far = 8.');

    // Array elements: indices 0,1,2 should have class 'window'; index 2 should show a pointer (arrow)
    const elements1 = await sw.getArrayElements();
    expect(elements[0].hasWindowClass).toBe(true);
    expect(elements[1].hasWindowClass).toBe(true);
    expect(elements[2].hasWindowClass).toBe(true);
    // The pointer is appended as a child to the last window element - check presence
    expect(elements[2].hasPointer).toBe(true);
  });

  test('Transition S1_Sliding -> S1_Sliding on NextStepClick: advance window by one position', async ({ page }) => {
    // Comment: This validates one Next Step advances window and updates sums but remains in Sliding state
    const sw3 = new SlidingWindowPage(page);

    // Start the visualization first
    await sw.start();

    // Click Next Step once
    await sw.nextStep();

    // Output should reflect window [1..3] sum and the max sum remains 8
    const output1 = await sw.getOutputText();
    expect(output).toContain('Window [1..3] sum = 7. Max sum so far = 8.');

    // Array elements: indices 1,2,3 should have window class; check pointer at index 3
    const elements2 = await sw.getArrayElements();
    expect(elements[1].hasWindowClass).toBe(true);
    expect(elements[2].hasWindowClass).toBe(true);
    expect(elements[3].hasWindowClass).toBe(true);
    expect(elements[3].hasPointer).toBe(true);

    // Ensure we are still in sliding: nextStepBtn should still be enabled (unless end reached)
    const nextDisabled = await sw.isDisabled(sw.selectors.nextStepBtn);
    expect(nextDisabled).toBe(false);
  });

  test('Transition S1_Sliding -> S2_Completed: advance until end and final message appears', async ({ page }) => {
    // Comment: This validates repeated NextStep clicks lead to Completed state with final message
    const sw4 = new SlidingWindowPage(page);

    await sw.start();

    // Keep clicking Next Step until the button disables (end reached)
    // We will click up to 20 times defensively to avoid infinite loop in case of issues
    for (let i = 0; i < 20; i++) {
      const nextDisabled1 = await sw.isDisabled(sw.selectors.nextStepBtn);
      if (nextDisabled) break;
      await sw.nextStep();
    }

    // After completion, Next Step should be disabled
    expect(await sw.isDisabled(sw.selectors.nextStepBtn)).toBe(true);

    // Output area should contain the completion message with max sum and k
    const output2 = await sw.getOutputText();
    expect(output).toContain('Reached end of array. Maximum sum of subarray of size 3 is 8.');

    // Also validate that the "pointer" may be on the last valid window element (if rendered)
    const elements3 = await sw.getArrayElements();
    // At completion there may still be a window highlight depending on final render; ensure no unexpected errors
    // Confirm start button remains disabled (since sliding finished but startBtn was disabled when started)
    expect(await sw.isDisabled(sw.selectors.startBtn)).toBe(true);
  });

  test('Transition S1_Sliding -> S0_Idle on ResetClick: resets to initial Idle state', async ({ page }) => {
    // Comment: This validates Reset returns UI to idle: clears output, disables next/reset, enables start & window input
    const sw5 = new SlidingWindowPage(page);

    await sw.start();

    // Ensure we are in sliding
    expect(await sw.isDisabled(sw.selectors.startBtn)).toBe(true);

    // Click Reset to return to Idle
    await sw.reset();

    // After reset: start enabled, next & reset disabled, windowSize enabled
    expect(await sw.isDisabled(sw.selectors.startBtn)).toBe(false);
    expect(await sw.isDisabled(sw.selectors.nextStepBtn)).toBe(true);
    expect(await sw.isDisabled(sw.selectors.resetBtn)).toBe(true);
    const wsDisabled1 = await sw.page.$eval(sw.selectors.windowSize, el => el.disabled === true);
    expect(wsDisabled).toBe(false);

    // Output area should be empty
    expect(await sw.getOutputText()).toBe('');

    // Array should no longer have any 'window' classes
    const elements4 = await sw.getArrayElements();
    const anyWindowClass1 = elements.some(el => el.hasWindowClass);
    expect(anyWindowClass).toBe(false);
  });

  test('Edge case: invalid window size triggers alert and prevents start', async ({ page }) => {
    // Comment: Test invalid input k > data.length shows alert and does not start sliding
    const sw6 = new SlidingWindowPage(page);

    const dialogs = [];
    page.on('dialog', async dialog => {
      // Capture alert message and accept it
      dialogs.push({
        message: dialog.message(),
        type: dialog.type()
      });
      await dialog.accept();
    });

    // Enter invalid window size (too large, > data.length which is 10)
    await sw.setWindowSize('20');

    // Click Start - reset() should validate and trigger alert
    await sw.start();

    // We expect an alert to have been shown
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const dialogMsg = dialogs[0].message;
    expect(dialogMsg).toContain('Please enter a valid window size between 1 and 10');

    // Since reset() returned false, the app should not have started sliding:
    expect(await sw.isDisabled(sw.selectors.startBtn)).toBe(false);
    expect(await sw.isDisabled(sw.selectors.nextStepBtn)).toBe(true);
    expect(await sw.isDisabled(sw.selectors.resetBtn)).toBe(true);

    // Output should remain empty
    expect(await sw.getOutputText()).toBe('');
  });

  test('Edge case: minimum window size k=1 and behavior across array', async ({ page }) => {
    // Comment: Validate behavior when k=1 (window of single element) and that maxSum tracks correctly
    const sw7 = new SlidingWindowPage(page);

    // Set k=1
    await sw.setWindowSize('1');

    // Start
    await sw.start();

    // Initial window should be first element value 2
    let output3 = await sw.getOutputText();
    expect(output).toContain('Initial window [0..0] sum = 2. Max sum so far = 2.');

    // Repeatedly step through all elements to ensure final max is found
    // Click until disabled
    for (let i = 0; i < 20; i++) {
      const nextDisabled2 = await sw.isDisabled(sw.selectors.nextStepBtn);
      if (nextDisabled) break;
      await sw.nextStep();
    }

    // After completion, final message should reflect largest element in data (which is 8)
    output = await sw.getOutputText();
    expect(output).toContain('Reached end of array. Maximum sum of subarray of size 1 is 8.');
  });
});