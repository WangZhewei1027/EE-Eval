import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122a7860-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Dynamic Array page to encapsulate common interactions and queries
class DynamicArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for assertions
    this.page.on('console', msg => {
      try {
        // Store textual representation of the console message
        this.consoleMessages.push(msg.text());
      } catch (e) {
        this.consoleMessages.push(String(msg));
      }
    });

    this.page.on('pageerror', err => {
      this.pageErrors.push(err.message || String(err));
    });
  }

  // Load the page and wait for network idle to allow inline script to run (and potentially throw)
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  // Returns the innerHTML of #array (or null if element missing)
  async getArrayInnerHTML() {
    return this.page.$eval('#array', el => el.innerHTML).catch(() => null);
  }

  // Check presence of an element by selector. Returns boolean.
  async hasSelector(selector) {
    const handle = await this.page.$(selector);
    return handle !== null;
  }

  // Safely attempt to call a named global function in the page and return its result or error message
  async callFunctionSafe(functionName, ...args) {
    return this.page.evaluate(
      (fnName, fnArgs) => {
        try {
          // Access function from global scope (window)
          const fn = window[fnName];
          if (typeof fn !== 'function') {
            return { ok: false, error: `Function ${fnName} is not defined` };
          }
          const result = fn.apply(null, fnArgs);
          return { ok: true, result };
        } catch (err) {
          return { ok: false, error: err.message || String(err) };
        }
      },
      functionName,
      args
    );
  }

  // Convenience: set the global array variable to a given array
  async setGlobalArray(arr) {
    return this.page.evaluate(a => {
      window.array = a;
      return true;
    }, arr);
  }

  // Retrieves captured console messages
  getConsoleMessages() {
    return this.consoleMessages.slice();
  }

  // Retrieves captured page errors
  getPageErrors() {
    return this.pageErrors.slice();
  }
}

test.describe('Dynamic Array App - FSM tests (Application ID: 122a7860-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Use a fresh page per test
  test.beforeEach(async ({ page }) => {
    // Nothing global to set up beyond default Playwright fixtures
  });

  test('S0_Idle: initial render contains #array and page prints the initial array to console', async ({ page }) => {
    // Validate the initial idle state: the array container exists and initial console log occurs
    const app = new DynamicArrayPage(page);
    await app.goto();

    // The FSM evidence for Idle state includes <div id="array"></div>
    const arrayExists = await app.hasSelector('#array');
    expect(arrayExists).toBe(true);

    // The page script calls printArray() which does console.log(array);
    // We expect at least one console message that includes "[]"
    const consoleMessages = app.getConsoleMessages();
    // Wait a short moment to ensure console handlers captured synchronous logs
    await page.waitForTimeout(50);

    const logs = app.getConsoleMessages();
    // Check that some console message shows the empty array representation
    const hasEmptyArrayLog = logs.some(msg => msg.includes('[]') || msg.includes('Array'));
    expect(hasEmptyArrayLog).toBe(true);
  });

  test('Runtime error due to missing buttons: assert uncaught TypeError is reported', async ({ page }) => {
    // The HTML references elements by id that do not exist (#addButton, #removeButton, #inputField)
    // This should lead to a runtime TypeError when the script attempts to call addEventListener on null.
    const app = new DynamicArrayPage(page);
    await app.goto();

    // Wait a tick to ensure runtime errors are captured
    await page.waitForTimeout(50);

    const errors = app.getPageErrors();
    // There should be at least one runtime page error
    expect(errors.length).toBeGreaterThanOrEqual(1);

    // At least one of the errors should mention addEventListener or cannot read properties of null
    const matches = errors.some(e => /addEventListener/.test(e) || /Cannot read (properties|property)/i.test(e) || /null/.test(e));
    expect(matches).toBe(true);
  });

  test.describe('FSM events and transitions (as can be observed given the broken DOM)', () => {
    test('AddElement transition: #addButton is missing and clicking it should fail', async ({ page }) => {
      // Attempt to trigger AddElement event by clicking #addButton.
      // Because the button is missing, Playwright should throw an error when trying to click.
      const app = new DynamicArrayPage(page);
      await app.goto();

      const exists = await app.hasSelector('#addButton');
      // Ensure the test environment indeed lacks the button (as in the provided HTML)
      expect(exists).toBe(false);

      // Attempting to click should reject; assert that a click attempt fails
      await expect(page.click('#addButton')).rejects.toThrow();
    });

    test('RemoveElement transition: #removeButton is missing and clicking it should fail', async ({ page }) => {
      // Attempt to trigger RemoveElement event by clicking #removeButton.
      // Because the button is missing, Playwright should throw an error when trying to click.
      const app = new DynamicArrayPage(page);
      await app.goto();

      const exists = await app.hasSelector('#removeButton');
      expect(exists).toBe(false);

      // Attempting to click should reject; assert that a click attempt fails
      await expect(page.click('#removeButton')).rejects.toThrow();
    });

    test('InputChange transition: #inputField is missing and input cannot be filled', async ({ page }) => {
      // Attempt to trigger InputChange by filling #inputField.
      const app = new DynamicArrayPage(page);
      await app.goto();

      const exists = await app.hasSelector('#inputField');
      expect(exists).toBe(false);

      // Attempting to fill should reject; assert that a fill attempt fails
      await expect(page.fill('#inputField', '42')).rejects.toThrow();
    });
  });

  test.describe('S1_ArrayUpdated behaviour via direct function calls (updateArray, add, remove)', () => {
    test('updateArray function exists and can update DOM when invoked directly', async ({ page }) => {
      // Even though event listeners failed to attach, the functions (add, remove, updateArray) are declared in the global scope.
      // This test invokes updateArray directly to validate the Array Updated state rendering.
      const app = new DynamicArrayPage(page);
      await app.goto();

      // Ensure updateArray is defined as a function in the page
      const updateType = await page.evaluate(() => typeof window.updateArray);
      expect(updateType).toBe('function');

      // Set the global array to known values and call updateArray to simulate the S1_ArrayUpdated entry action
      await app.setGlobalArray([10, 20, 30]);

      const callResult = await app.callFunctionSafe('updateArray');
      // Ensure the call succeeded from the callFunctionSafe wrapper
      expect(callResult.ok).toBe(true);

      // Verify DOM updated accordingly
      const inner = await app.getArrayInnerHTML();
      expect(inner).toContain('Array: 10, 20, 30');
    });

    test('add() pushes a random integer to the array and updateArray updates the DOM', async ({ page }) => {
      // Directly call add to validate the transition from Idle -> ArrayUpdated when add() runs.
      const app = new DynamicArrayPage(page);
      await app.goto();

      // Set a deterministic starting array for test clarity
      await app.setGlobalArray([1]);

      // Ensure add exists
      const addType = await page.evaluate(() => typeof window.add);
      expect(addType).toBe('function');

      // Call add() and then read the DOM
      const callResult = await app.callFunctionSafe('add');
      expect(callResult.ok).toBe(true);

      // After add, the array should have length >= 2 and DOM updated
      const inner = await app.getArrayInnerHTML();
      expect(inner).toMatch(/Array:\s*1,\s*\d+/); // expect "Array: 1, <some number>"

      // Also verify that the global array has a numeric value added by inspecting it
      const arr = await page.evaluate(() => window.array);
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBeGreaterThanOrEqual(2);
      expect(typeof arr[arr.length - 1]).toBe('number');
    });

    test('remove() filters array to positive numbers and updateArray updates the DOM', async ({ page }) => {
      // Validate remove() action described in FSM: array = array.filter(x => x > 0)
      const app = new DynamicArrayPage(page);
      await app.goto();

      // Set a global array with negatives and zeros
      await app.setGlobalArray([0, -5, 7, 3, -1]);

      // Ensure remove exists
      const removeType = await page.evaluate(() => typeof window.remove);
      expect(removeType).toBe('function');

      // Call remove()
      const callResult = await app.callFunctionSafe('remove');
      expect(callResult.ok).toBe(true);

      // After remove, only positive numbers should remain
      const arr = await page.evaluate(() => window.array);
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.every(x => x > 0)).toBe(true);

      // DOM should reflect the filtered array
      const inner = await app.getArrayInnerHTML();
      // Make sure the numbers 7 and 3 are present and negatives are absent
      expect(inner).toContain('7');
      expect(inner).toContain('3');
      expect(inner).not.toContain('-5');
      expect(inner).not.toContain('-1');
    });

    test('InputChange transition (updateArray) can be simulated even without input field by calling updateArray', async ({ page }) => {
      // Although the input field is missing (so input events cannot be fired), updateArray is still callable.
      const app = new DynamicArrayPage(page);
      await app.goto();

      // Pre-populate array and call updateArray to simulate user-provided input effecting the array display
      await app.setGlobalArray([42, 43]);
      const callResult = await app.callFunctionSafe('updateArray');
      expect(callResult.ok).toBe(true);

      const inner = await app.getArrayInnerHTML();
      expect(inner).toContain('Array: 42, 43');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Calling undefined functions reports appropriate errors via callFunctionSafe', async ({ page }) => {
      // Ensure that attempting to call a non-existent function is reported gracefully by our wrapper
      const app = new DynamicArrayPage(page);
      await app.goto();

      const callResult = await app.callFunctionSafe('nonExistentFunction');
      expect(callResult.ok).toBe(false);
      expect(callResult.error).toMatch(/not defined|is not a function|nonExistentFunction/);
    });

    test('DOM remains stable after runtime error: #array element still present and usable', async ({ page }) => {
      // Confirm that despite runtime errors in the script, the primary visualization element (#array) exists and can be updated via functions
      const app = new DynamicArrayPage(page);
      await app.goto();

      // Ensure #array exists
      const arrayExists = await app.hasSelector('#array');
      expect(arrayExists).toBe(true);

      // Try to set and update the array to ensure DOM is manipulable
      await app.setGlobalArray([99]);
      const callResult = await app.callFunctionSafe('updateArray');
      expect(callResult.ok).toBe(true);

      const inner = await app.getArrayInnerHTML();
      expect(inner).toContain('Array: 99');
    });
  });
});