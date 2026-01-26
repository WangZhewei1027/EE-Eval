import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b14e44-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Exponential Search demo
class ExponentialSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.startButton = page.locator('#startSearch');
    this.arrayContainer = page.locator('#arrayContainer');
    this.steps = page.locator('#steps');
    this.result = page.locator('#result');
    this.explanation = page.locator('#explanation');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for key elements to be present
    await Promise.all([
      this.arrayInput.waitFor(),
      this.targetInput.waitFor(),
      this.startButton.waitFor(),
      this.arrayContainer.waitFor(),
      this.steps.waitFor(),
      this.result.waitFor()
    ]);
  }

  async setArray(value) {
    await this.arrayInput.fill(value);
  }

  async setTarget(value) {
    // value as string or number
    await this.targetInput.fill(String(value));
  }

  async clickStart() {
    await this.startButton.click();
  }

  async getResultText() {
    return (await this.result.textContent()) || '';
  }

  async getStepsText() {
    return (await this.steps.textContent()) || '';
  }

  async getArrayItemClasses() {
    return this.page.$$eval('.array-item', els => els.map(e => e.className));
  }

  // Helper that waits until result contains expectedText (with timeout)
  async waitForResultText(expectedText, timeout = 20000) {
    await this.page.waitForFunction(
      (expected) => {
        const el = document.getElementById('result');
        return el && el.textContent.includes(expected);
      },
      expectedText,
      { timeout }
    );
  }

  async waitForStepsContain(expectedSubstring, timeout = 20000) {
    await this.page.waitForFunction(
      (expected) => {
        const el = document.getElementById('steps');
        return el && el.textContent.includes(expected);
      },
      expectedSubstring,
      { timeout }
    );
  }
}

test.describe('Exponential Search Demo - FSM validation and UI behavior', () => {
  // Containers to collect console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      try {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (e) {
        consoleMessages.push(`console: <could not read message>`);
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });
  });

  test.afterEach(async ({ page }) => {
    // For debugging during failures, attach console output to test trace
    if (consoleMessages.length) {
      // eslint-disable-next-line no-console
      console.log('Collected console messages:', consoleMessages);
    }
    if (pageErrors.length) {
      // eslint-disable-next-line no-console
      console.log('Collected page errors:', pageErrors);
    }
    // Ensure no stray dialogs remain
    try {
      await page.close();
    } catch (e) {
      // ignore
    }
  });

  test.describe('Initial (Idle) state checks', () => {
    test('renders initial UI elements and default values (Idle state entry)', async ({ page }) => {
      // This test verifies the initial "Idle" state: DOM loaded with default inputs and elements present.
      const app = new ExponentialSearchPage(page);
      await app.goto();

      // Verify default array and target input values as specified in FSM/components
      await expect(app.arrayInput).toHaveValue('1,3,5,7,9,12,15,18,21,24,27,30,33,36,39,42,45,48,51,54');
      await expect(app.targetInput).toHaveValue('27');

      // Ensure visualization containers are empty or present
      await expect(app.arrayContainer).toBeVisible();
      await expect(app.steps).toBeVisible();
      await expect(app.result).toBeVisible();

      // There should be no uncaught page errors on load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Successful search (S0_Idle -> S1_Searching -> S2_Completed)', () => {
    test('searches for default target 27 and completes with found state and visual highlight', async ({ page }) => {
      // This test validates the transition Idle -> Searching (on button click) -> Completed (when found).
      const app = new ExponentialSearchPage(page);
      await app.goto();

      // Start search and wait for completion result text
      await app.clickStart();

      // Wait until the result text indicates the target was found
      await app.waitForResultText('Target 27 found at index 10.');

      // Assert final result string is exact
      const result = await app.getResultText();
      expect(result.trim()).toBe('Target 27 found at index 10.');

      // Steps should contain a "Found target" message
      const stepsText = await app.getStepsText();
      expect(stepsText).toContain('Found target 27 at index 10');

      // Array visualization should have one element with 'found' class at index 10
      const classes = await app.getArrayItemClasses();
      expect(classes.length).toBeGreaterThan(10);
      // The found class should be present at index 10
      expect(classes[10]).toMatch(/found/);

      // No uncaught page errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('search for target at index 0 resolves immediately and marks index 0 as found', async ({ page }) => {
      // Validate exponentialSearch early-return when arr[0] === target
      const app = new ExponentialSearchPage(page);
      await app.goto();

      await app.setTarget('1'); // first element in default array
      await app.clickStart();

      // When arr[0] === target, function logs "Target is at index 0." and returns 0
      // It may not update resultEl in that branch - but code does render found and logs step, then returns 0.
      // Wait for steps to include "Target is at index 0."
      await app.waitForStepsContain('Target is at index 0.');

      // The array visualization should mark index 0 as found
      const classes = await app.getArrayItemClasses();
      expect(classes[0]).toMatch(/found/);

      // Depending on implementation, resultEl might not be updated in early return; ensure either steps or result indicates success.
      const stepsText = await app.getStepsText();
      expect(stepsText).toContain('Target is at index 0.');

      // Confirm no page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Not found scenario and steps verification', () => {
    test('search for a missing target displays not-found message and logs steps', async ({ page }) => {
      // Validate Searching -> Completed when target is not present
      const app = new ExponentialSearchPage(page);
      await app.goto();

      await app.setTarget('999'); // value not in default array
      await app.clickStart();

      // Wait until result text reflects not found
      await app.waitForResultText('Target 999 not found in the array.');

      const result = (await app.getResultText()).trim();
      expect(result).toBe('Target 999 not found in the array.');

      // Steps should include a "not found" message from binary search path
      const stepsText = await app.getStepsText();
      expect(stepsText).toMatch(/not found/i);

      // Ensure no array item is marked as 'found'
      const classes = await app.getArrayItemClasses();
      const anyFound = classes.some(c => /found/.test(c));
      expect(anyFound).toBe(false);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and input validation (alerts and error paths)', () => {
    test('empty array input triggers an alert and does not throw page errors', async ({ page }) => {
      // When array is empty, startSearch onclick should alert "Please enter a valid sorted array."
      const app = new ExponentialSearchPage(page);
      await app.goto();

      await app.setArray(''); // empty array
      // Listen once for dialog
      const dialogPromise = page.waitForEvent('dialog');

      await app.clickStart();

      const dialog = await dialogPromise;
      // Capture alert message and accept it
      expect(dialog.message()).toBe('Please enter a valid sorted array.');
      await dialog.accept();

      // Ensure no uncaught exceptions
      expect(pageErrors.length).toBe(0);
    });

    test('unsorted array input triggers an alert about sorting', async ({ page }) => {
      // When array is not ascending, should alert user
      const app = new ExponentialSearchPage(page);
      await app.goto();

      await app.setArray('5,3,1'); // unsorted
      const dialogPromise = page.waitForEvent('dialog');

      await app.clickStart();

      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Array must be sorted in ascending order for Exponential Search.');
      await dialog.accept();

      expect(pageErrors.length).toBe(0);
    });

    test('invalid target (non-numeric) triggers an alert', async ({ page }) => {
      // Clear target input to make it invalid (NaN)
      const app = new ExponentialSearchPage(page);
      await app.goto();

      await app.setTarget(''); // empty -> NaN
      const dialogPromise = page.waitForEvent('dialog');

      await app.clickStart();

      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Please enter a valid number for the target.');
      await dialog.accept();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Instrumentation: observe console logs and page errors during a normal search', () => {
    test('collects console logs and ensures no unexpected page errors during search', async ({ page }) => {
      const app = new ExponentialSearchPage(page);
      await app.goto();

      // Run a normal search
      await app.setTarget('27');

      await app.clickStart();

      // Wait for completion
      await app.waitForResultText('Target 27 found at index 10.');

      // There should be console messages from the page (steps are logged to DOM, but the page might also log)
      // We assert that any captured console messages exist (could be none), but critically that there are no page errors.
      expect(Array.isArray(consoleMessages)).toBe(true);
      // Ensure no uncaught page errors happened
      expect(pageErrors.length).toBe(0);
    });
  });
});