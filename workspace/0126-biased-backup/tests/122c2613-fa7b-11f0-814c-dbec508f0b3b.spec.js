import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122c2613-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Recursion app
class RecursionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.getByRole('button', { name: 'Start' });
    this.stopButton = page.getByRole('button', { name: 'Stop' });
    this.resetButton = page.getByRole('button', { name: 'Reset' });
    this.numInput = page.locator('#num-input');
    this.stepSelect = page.locator('#step-select');
    this.resultText = page.locator('#result-text');
    this.resultTextarea = page.locator('#result-textarea');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async fillNumber(value) {
    // Use fill to set the value and trigger input event
    await this.numInput.fill(String(value));
    // Dispatch input event explicitly to be sure listeners run
    await this.page.evaluate(() => {
      const el = document.getElementById('num-input');
      if (el) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  async selectStep(value) {
    await this.stepSelect.selectOption(String(value));
    // Dispatch change event explicitly
    await this.page.evaluate((val) => {
      const el = document.getElementById('step-select');
      if (el) {
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, value);
  }

  async clickStart() {
    await this.startButton.click();
  }

  async clickStop() {
    await this.stopButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async getNumInputValue() {
    return this.numInput.evaluate((el) => el.value);
  }

  async getStepSelectValue() {
    return this.stepSelect.evaluate((el) => el.value);
  }

  // Read both innerHTML and value for result-text (app uses innerHTML incorrectly on input)
  async getResultTextInnerAndValue() {
    return this.resultText.evaluate((el) => ({ innerHTML: el.innerHTML, value: el.value }));
  }

  async getTextareaValue() {
    return this.resultTextarea.evaluate((el) => el.value);
  }
}

test.describe('Recursion FSM - Application 122c2613-fa7b-11f0-814c-dbec508f0b3b', () => {
  // Collector arrays to inspect page errors and console messages
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // store message for assertions
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Capture console output for debugging and assertions
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // No navigation here; each test will navigate after setting up listeners
  });

  test.afterEach(async () => {
    // no-op: Playwright will clean up pages automatically
  });

  test('Initial Idle state: DOM elements exist and default values are present; runtime error during script execution is observable', async ({ page }) => {
    // This test validates initial UI elements as described by the FSM Idle state,
    // and also asserts that a runtime error (due to incorrect element IDs in the script)
    // occurs while the page script runs.
    const app = new RecursionPage(page);

    // Navigate to the app; the page script will run and produce errors which we capture
    await app.goto();

    // Verify visible UI elements exist (buttons located by accessible name)
    await expect(app.startButton).toBeVisible();
    await expect(app.stopButton).toBeVisible();
    await expect(app.resetButton).toBeVisible();

    // Verify numeric input default value per FSM "value='0'"
    const numVal = await app.getNumInputValue();
    expect(numVal).toBe('0');

    // Verify step select default value is "1"
    const stepVal = await app.getStepSelectValue();
    expect(stepVal).toBe('1');

    // Result text (input) should be empty initially
    const result = await app.getResultTextInnerAndValue();
    // Both innerHTML and value should be empty strings initially
    expect(result.innerHTML === '' || result.value === '').toBeTruthy();

    // Textarea should be empty and readonly
    const taVal = await app.getTextareaValue();
    expect(taVal).toBe('');

    // Because the HTML script references elements by IDs that don't exist
    // (document.getElementById('start') etc.), a runtime TypeError is expected.
    // Assert that at least one page error was recorded and it references 'addEventListener'
    // which indicates trying to call addEventListener on null/undefined.
    // Wait briefly to ensure pageerror events had time to arrive.
    await page.waitForTimeout(100);

    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const foundRelevant = pageErrors.some((m) => /addEventListener/i.test(m) || /Cannot read properties of null/i.test(m) || /Cannot read properties of undefined/i.test(m));
    expect(foundRelevant).toBeTruthy();
  });

  test('InputNumber event updates internal result (listener attached) and updates DOM innerHTML/value as possible', async ({ page }) => {
    // This test validates the InputNumber transition while acknowledging the app uses
    // innerHTML on an input element (which may not affect the input.value). We assert
    // that either innerHTML or value contains the expected string after input.
    const app = new RecursionPage(page);
    await app.goto();

    // Ensure we have captured the expected page error from script (see previous test)
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Enter a valid number (5) into the number input
    await app.fillNumber(5);

    // The app's handler builds "Step {step}: {num}" where step defaults to 1
    const expected = 'Step 1: 5';

    // Read both innerHTML and value to be robust against the incorrect DOM manipulation
    const result = await app.getResultTextInnerAndValue();

    // It is acceptable if either innerHTML or value contains the expected string
    const ok = result.innerHTML === expected || result.value === expected;
    expect(ok).toBeTruthy();

    // Also verify the numeric input's value indeed reflects what we entered
    const numValAfter = await app.getNumInputValue();
    expect(numValAfter === '5' || numValAfter === '5.0' || numValAfter === '5').toBeTruthy();
  });

  test('ChangeStep event updates result text to reflect new step and current number', async ({ page }) => {
    // This test validates selecting a different step updates the result text according
    // to the FSM transition. It uses the current number previously set.
    const app = new RecursionPage(page);
    await app.goto();

    // Wait for script error to arrive (non-blocking)
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Set number to 7 to have a visible change when selecting a new step
    await app.fillNumber(7);

    // Change to step 3
    await app.selectStep(3);

    const expected = 'Step 3: 7';
    const result = await app.getResultTextInnerAndValue();

    const ok = result.innerHTML === expected || result.value === expected;
    expect(ok).toBeTruthy();
  });

  test('Start/Stop/Reset handlers are not attached due to script error: clicking buttons does not perform resets', async ({ page }) => {
    // This test asserts that the missing element IDs in the script produced a runtime error
    // and as a consequence the Start/Stop/Reset handlers were not attached. Therefore,
    // clicking the UI buttons should NOT reset inputs (i.e., no transition back to Idle occurs).
    const app = new RecursionPage(page);
    await app.goto();

    // Wait a moment to allow pageerror capture
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Set number to 42 and change step to 2 to ensure non-default state
    await app.fillNumber(42);
    await app.selectStep(2);

    // Confirm the non-default state
    const beforeNum = await app.getNumInputValue();
    const beforeStep = await app.getStepSelectValue();
    expect(beforeNum).toBe('42');
    expect(beforeStep).toBe('2');

    // Click Start - the handler was supposed to reset to defaults but is not attached
    await app.clickStart();

    // Wait briefly for any potential handlers (none expected)
    await page.waitForTimeout(50);

    // Values should remain unchanged because the start handler was not attached (due to earlier error)
    const afterNum = await app.getNumInputValue();
    const afterStep = await app.getStepSelectValue();
    // We expect them to still be the previously set values
    expect(afterNum).toBe(beforeNum);
    expect(afterStep).toBe(beforeStep);

    // Likewise, click Stop and Reset and assert no change
    await app.clickStop();
    await page.waitForTimeout(30);
    expect(await app.getNumInputValue()).toBe(beforeNum);
    expect(await app.getStepSelectValue()).toBe(beforeStep);

    await app.clickReset();
    await page.waitForTimeout(30);
    expect(await app.getNumInputValue()).toBe(beforeNum);
    expect(await app.getStepSelectValue()).toBe(beforeStep);
  });

  test('Entering invalid number triggers alert dialog from input listener (edge case)', async ({ page }) => {
    // This test validates the error handling branch in InputNumber:
    // when the user inputs a non-number, the app calls alert('Please enter a number.')
    // We accept the dialog and assert the message matches expectation.
    const app = new RecursionPage(page);
    await app.goto();

    // Wait for script error to be captured (non-blocking)
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Prepare to capture dialog
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    // Fill a non-numeric value into the number input to trigger parseInt -> NaN -> alert
    // Using fill with 'abc' which will cause the input handler to produce NaN
    await app.fillNumber('abc');

    // allow time for dialog to appear and be handled
    await page.waitForTimeout(100);

    // Assert that we received a dialog and the message matches the expected text
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const dialogFound = dialogs.some(d => d.message === 'Please enter a number.');
    expect(dialogFound).toBeTruthy();
  });

  test('Script runtime error details are present in page errors for diagnosis', async ({ page }) => {
    // This test ensures that the test harness observes the exact runtime exception(s)
    // that occurred while loading the page. This is important for diagnosing broken event binding.
    const app = new RecursionPage(page);
    await app.goto();

    // Give time for errors to be delivered
    await page.waitForTimeout(50);

    // Ensure we captured at least one error and include the relevant stack/message snippet
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Provide diagnostic assertions to ensure the error refers to attempting to use addEventListener on a null target
    const hasAddEventListenerReference = pageErrors.some((m) => /addEventListener/i.test(m));
    const hasNullRef = pageErrors.some((m) => /Cannot read properties of null/i.test(m) || /Cannot read properties of undefined/i.test(m));
    // At least one of these heuristics should match in a typical browser environment
    expect(hasAddEventListenerReference || hasNullRef).toBeTruthy();
  });
});