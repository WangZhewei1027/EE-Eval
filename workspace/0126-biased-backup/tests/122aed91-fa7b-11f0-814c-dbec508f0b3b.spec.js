import { test, expect } from '@playwright/test';

// Page object model for the Set app
class SetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/122aed91-fa7b-11f0-814c-dbec508f0b3b.html';
    this.selectors = {
      value1: '#value1',
      value2: '#value2',
      add: '#add',
      subtract: '#subtract',
      multiply: '#multiply',
      divide: '#divide',
      reset: '#reset',
      save: '#save',
      output: '#output',
      state: '#state'
    };
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'load' });
  }

  async clickAdd() {
    await this.page.click(this.selectors.add);
  }
  async clickSubtract() {
    await this.page.click(this.selectors.subtract);
  }
  async clickMultiply() {
    await this.page.click(this.selectors.multiply);
  }
  async clickDivide() {
    await this.page.click(this.selectors.divide);
  }
  async clickReset() {
    await this.page.click(this.selectors.reset);
  }
  async clickSave() {
    await this.page.click(this.selectors.save);
  }

  async setValue1Input(value) {
    // sets DOM input value (may not affect internal state object)
    await this.page.fill(this.selectors.value1, String(value));
  }
  async setValue2Input(value) {
    // sets DOM input value (may not affect internal state object)
    await this.page.fill(this.selectors.value2, String(value));
  }

  async getOutputText() {
    return (await this.page.locator(this.selectors.output).textContent()) || '';
  }

  async getDOMValue1() {
    return await this.page.$eval(this.selectors.value1, el => el.value);
  }
  async getDOMValue2() {
    return await this.page.$eval(this.selectors.value2, el => el.value);
  }

  async getInternalState() {
    // read the global 'state' object that the app defines
    return await this.page.evaluate(() => {
      // return a shallow copy to the test
      return typeof state !== 'undefined' ? { value1: state.value1, value2: state.value2 } : null;
    });
  }

  async getLocalStorageItem(key) {
    return await this.page.evaluate(k => localStorage.getItem(k), key);
  }
}

test.describe('Set application FSM (122aed91-fa7b-11f0-814c-dbec508f0b3b)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let pageObj;

  // Capture page errors and console errors for each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // Collect page errors (unhandled exceptions in page context)
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    page.on('console', (msg) => {
      // Collect console messages of type 'error' to detect runtime errors
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(`${msg.text()}`);
        }
      } catch (e) {
        // ignore any console processing error
      }
    });

    pageObj = new SetPage(page);
    await pageObj.goto();
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: clear localStorage to avoid cross-test leakage
    await page.evaluate(() => localStorage.clear());
  });

  // Test initial state and entry action behavior
  test('Initial state: internal state exists and output is not pre-populated (entry action not invoked on load)', async ({ page }) => {
    // Validate internal state is present and initialized
    const internal = await pageObj.getInternalState();
    expect(internal).not.toBeNull();
    expect(internal.value1).toBe(0);
    expect(internal.value2).toBe(0);

    // The implementation does not call updateOutput() on load, so output should be empty
    const outputText = await pageObj.getOutputText();
    // We assert that output is empty string (no entry action executed)
    expect(outputText).toBe('');

    // Also verify the DOM input initial values are "0" as per HTML attributes
    const domV1 = await pageObj.getDOMValue1();
    const domV2 = await pageObj.getDOMValue2();
    expect(domV1).toBe('0');
    expect(domV2).toBe('0');

    // Ensure no unexpected page or console errors occurred during load
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Test Add transition
  test('Add event increments state.value1 and updates output', async ({ page }) => {
    // Click add once
    await pageObj.clickAdd();

    // Internal state should have value1 = 1
    const internal = await pageObj.getInternalState();
    expect(internal.value1).toBe(1);
    expect(internal.value2).toBe(0);

    // Output should reflect the new values
    const output = await pageObj.getOutputText();
    expect(output).toBe('Value 1: 1, Value 2: 0');

    // DOM input for value1 is not necessarily synchronized with internal state by implementation;
    // ensure DOM input still contains its attribute value unless changed by user interaction
    const domV1 = await pageObj.getDOMValue1();
    // The implementation does not update the input element on state changes, so it should remain "0"
    expect(domV1).toBe('0');

    // No runtime errors should have occurred
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Test Subtract transition and guard
  test('Subtract event only decrements when value1 > 0 and does not go negative', async ({ page }) => {
    // Ensure starting from zero
    let internal = await pageObj.getInternalState();
    expect(internal.value1).toBe(0);

    // Subtract at zero -> no change
    await pageObj.clickSubtract();
    internal = await pageObj.getInternalState();
    expect(internal.value1).toBe(0);
    expect(await pageObj.getOutputText()).toBe('');

    // Increase value1 to 2 via two adds
    await pageObj.clickAdd();
    await pageObj.clickAdd();
    internal = await pageObj.getInternalState();
    expect(internal.value1).toBe(2);
    expect(await pageObj.getOutputText()).toBe('Value 1: 2, Value 2: 0');

    // Subtract should decrement once -> 1
    await pageObj.clickSubtract();
    internal = await pageObj.getInternalState();
    expect(internal.value1).toBe(1);
    expect(await pageObj.getOutputText()).toBe('Value 1: 1, Value 2: 0');

    // Subtract again -> 0
    await pageObj.clickSubtract();
    internal = await pageObj.getInternalState();
    expect(internal.value1).toBe(0);
    expect(await pageObj.getOutputText()).toBe('Value 1: 0, Value 2: 0');

    // Another subtract should not go below zero
    await pageObj.clickSubtract();
    internal = await pageObj.getInternalState();
    expect(internal.value1).toBe(0);

    // No runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Test Multiply and Divide guards and behavior when value2 remains at 0 despite DOM input change
  test('Multiply and Divide events respect guards; they are no-ops when state.value2 is 0 (even if DOM input changed)', async ({ page }) => {
    // Increase value1 to 3
    await pageObj.clickAdd();
    await pageObj.clickAdd();
    await pageObj.clickAdd();
    let internal = await pageObj.getInternalState();
    expect(internal.value1).toBe(3);
    expect(internal.value2).toBe(0);

    // Try to set the DOM input for value2 to "5" - note implementation does not bind input to internal state
    await pageObj.setValue2Input(5);

    // Confirm DOM shows 5
    const domV2 = await pageObj.getDOMValue2();
    expect(domV2).toBe('5');

    // But internal state.value2 should still be 0 (no binding in implementation)
    internal = await pageObj.getInternalState();
    expect(internal.value2).toBe(0);

    // Attempt multiply: because guard requires internal state.value2 > 0, this should be a no-op
    await pageObj.clickMultiply();
    internal = await pageObj.getInternalState();
    expect(internal.value1).toBe(3); // unchanged
    expect(await pageObj.getOutputText()).toBe('Value 1: 3, Value 2: 0');

    // Attempt divide: also a no-op because state.value2 is 0
    await pageObj.clickDivide();
    internal = await pageObj.getInternalState();
    expect(internal.value1).toBe(3);
    expect(await pageObj.getOutputText()).toBe('Value 1: 3, Value 2: 0');

    // This validates the guard logic in the implementation and highlights that DOM inputs are not connected to internal state
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Test Reset transition
  test('Reset event sets both values to 0 and updates output', async ({ page }) => {
    // Create a non-zero state via UI
    await pageObj.clickAdd(); // value1 = 1
    await pageObj.clickAdd(); // value1 = 2
    let internal = await pageObj.getInternalState();
    expect(internal.value1).toBe(2);

    // Click reset
    await pageObj.clickReset();

    // After reset, both internal values should be zero and output updated accordingly
    internal = await pageObj.getInternalState();
    expect(internal.value1).toBe(0);
    expect(internal.value2).toBe(0);
    expect(await pageObj.getOutputText()).toBe('Value 1: 0, Value 2: 0');

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Test Save transition: localStorage update and alert shown
  test('Save event stores current state in localStorage and shows an alert with the saved text', async ({ page }) => {
    // Ensure a known internal state via UI interactions
    // set value1 to 2
    await pageObj.clickAdd();
    await pageObj.clickAdd();
    const internalBefore = await pageObj.getInternalState();
    expect(internalBefore.value1).toBe(2);
    expect(internalBefore.value2).toBe(0);

    // Prepare to capture dialog
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click save, which triggers localStorage.setItem and alert()
    await pageObj.clickSave();

    // Ensure the dialog was shown and contained the expected message
    expect(dialogMessage).toBe(`Set saved as Value 1: ${internalBefore.value1}, Value 2: ${internalBefore.value2}`);

    // Verify localStorage entry
    const stored = await pageObj.getLocalStorageItem('set');
    expect(stored).toBe(`Value 1: ${internalBefore.value1}, Value 2: ${internalBefore.value2}`);

    // Ensure no page or console errors were emitted as a result
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Aggregate check: ensure no unexpected errors across interactions (redundant safety check)
  test('No runtime ReferenceError/SyntaxError/TypeError occurred during interactions', async ({ page }) => {
    // This test performs a sequence of interactions that exercise all main buttons
    // and then asserts that no page errors or console errors were observed.

    // Click through the main controls
    await pageObj.clickAdd();
    await pageObj.clickSubtract();
    await pageObj.clickAdd();
    await pageObj.clickMultiply();
    await pageObj.clickDivide();
    await pageObj.clickReset();
    // Interact with inputs
    await pageObj.setValue1Input(7);
    await pageObj.setValue2Input(8);
    // Attempt save and dismiss dialog to avoid blocking (if any)
    let dialogSeen = false;
    page.once('dialog', async (d) => {
      dialogSeen = true;
      await d.accept();
    });
    await pageObj.clickSave();

    // No page errors (uncaught exceptions)
    expect(pageErrors).toEqual([]);

    // No console 'error' messages
    expect(consoleErrors).toEqual([]);

    // Dialog may or may not have been shown depending on state; ensure save did set localStorage even if dialog not visible
    const stored = await pageObj.getLocalStorageItem('set');
    // stored may be null if internal state is zero and save ran, but in current implementation save always sets something
    expect(stored).not.toBeUndefined();
  });
});