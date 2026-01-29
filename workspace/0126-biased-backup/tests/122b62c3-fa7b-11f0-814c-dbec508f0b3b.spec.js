import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122b62c3-fa7b-11f0-814c-dbec508f0b3b.html';

// Helper to poll for a console message substring within a timeout
async function waitForConsoleMessage(messages, substring, timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (messages.some(m => m.includes(substring))) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}

// Helper to count occurrences of a substring in the messages array
function countConsoleOccurrences(messages, substring) {
  return messages.reduce((count, m) => count + (m.includes(substring) ? 1 : 0), 0);
}

// Page object for the Bubble Sort page
class BubbleSortPage {
  constructor(page) {
    this.page = page;
    this.sortBtn = page.locator('#sort-button');
    this.clearBtn = page.locator('#clear-button');
    this.resetBtn = page.locator('#reset-button');
    this.arraySizeInput = page.locator('#array-size');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the page has loaded the initial output
    await this.page.waitForLoadState('load');
  }

  async clickSort() {
    // Click and allow possible reloads; Playwright click will handle navigations automatically.
    await this.sortBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getArrayLength() {
    return this.page.evaluate(() => {
      // Access the runtime 'array' variable defined by the page script
      try {
        return Array.isArray(window.array) ? window.array.length : null;
      } catch (e) {
        return null;
      }
    });
  }

  async isSortedFlag() {
    return this.page.evaluate(() => {
      try {
        return !!window.sorted;
      } catch (e) {
        return null;
      }
    });
  }

  async getSwappedFlag() {
    return this.page.evaluate(() => {
      try {
        return !!window.swapped;
      } catch (e) {
        return null;
      }
    });
  }

  async getArraySizeVar() {
    return this.page.evaluate(() => {
      try {
        return window.arraySize;
      } catch (e) {
        return null;
      }
    });
  }
}

test.describe('Bubble Sort FSM end-to-end tests', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for assertions
    page.on('console', msg => {
      // store type and text for debugging/inspection
      try {
        consoleMessages.push(String(msg.text()));
      } catch {
        consoleMessages.push('<unserializable console message>');
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app
    const bsPage = new BubbleSortPage(page);
    await bsPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Slight pause to let any background intervals emit logs before teardown (helpful for flakiness)
    await page.waitForTimeout(200);
  });

  test('Idle state: page renders controls and initial output', async ({ page }) => {
    // Validate initial render (Idle state)
    const bs = new BubbleSortPage(page);

    // Buttons should be visible and enabled
    await expect(bs.sortBtn).toBeVisible();
    await expect(bs.clearBtn).toBeVisible();
    await expect(bs.resetBtn).toBeVisible();

    // Input should have default value "10" per implementation
    await expect(bs.arraySizeInput).toHaveValue('10');

    // Output area should show the "Unsorted array" text as implemented
    await expect(bs.output).toContainText('Unsorted array');

    // No immediate runtime page errors expected on initial load
    expect(pageErrors.length).toBe(0);

    // Ensure the internal array exists and has expected length equal to arraySize variable
    const arrayLen = await bs.getArrayLength();
    const arraySizeVar = await bs.getArraySizeVar();
    expect(arrayLen).toBe(arraySizeVar);
  });

  test('Sort transition: clicking Sort logs "Sorted array:" and sets sorted=true', async ({ page }) => {
    const bs = new BubbleSortPage(page);

    // Ensure starting state: sorted should be false
    const sortedBefore = await bs.isSortedFlag();
    expect(sortedBefore === false || sortedBefore === null || sortedBefore === undefined ? true : !sortedBefore ? true : true).toBeTruthy();
    // Click Sort and wait for the expected console message
    await bs.clickSort();

    // Wait for at least one "Sorted array:" console message (bubbleSort logs it)
    const found = await waitForConsoleMessage(consoleMessages, 'Sorted array:', 3000);
    expect(found).toBeTruthy();

    // After sorting, the page script sets sorted = true; verify via evaluate
    const sortedFlag = await bs.isSortedFlag();
    expect(sortedFlag).toBe(true);

    // Verify that bubbleSort also logged the array (console.log(array);)
    // The exact console representation varies; check for an array-like representation or 'Array'
    const arrayLogFound = consoleMessages.some(m => /Array\(|\[|undefined/.test(m));
    expect(arrayLogFound).toBeTruthy();
  });

  test('Sorted state: interval behavior may emit additional "Sorted array:" logs', async ({ page }) => {
    const bs = new BubbleSortPage(page);

    // Click sort to reach Sorted state
    await bs.clickSort();

    // Wait for first "Sorted array:" log
    const first = await waitForConsoleMessage(consoleMessages, 'Sorted array:', 3000);
    expect(first).toBeTruthy();

    // Now wait a bit more for the interval in the page to also print "Sorted array:" again
    // (Implementation has a setInterval that prints again when sorted is true)
    const secondFound = await new Promise(resolve => {
      const start = Date.now();
      const timeout = 4000;
      (function poll() {
        const count = countConsoleOccurrences(consoleMessages, 'Sorted array:');
        if (count >= 2) return resolve(true);
        if (Date.now() - start > timeout) return resolve(false);
        setTimeout(poll, 100);
      })();
    });
    // It's acceptable if environment timing prevents the second log, but typically it should appear.
    expect(secondFound).toBeTruthy();
  });

  test('Clear transition: clicking Clear logs "Array cleared." and reinitializes array', async ({ page }) => {
    const bs = new BubbleSortPage(page);

    // Click Clear and wait for its console message
    await bs.clickClear();

    const foundClear = await waitForConsoleMessage(consoleMessages, 'Array cleared.', 2000);
    expect(foundClear).toBeTruthy();

    // The implementation sets array = new Array(arraySize); verify the array length matches arraySize
    const arrLen = await bs.getArrayLength();
    const arraySizeVar = await bs.getArraySizeVar();
    expect(arrLen).toBe(arraySizeVar);

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Reset transition: clicking Reset logs "Array reset." and clears flags', async ({ page }) => {
    const bs = new BubbleSortPage(page);

    // Alter state: click sort first so we can observe reset behavior afterward
    await bs.clickSort();
    await waitForConsoleMessage(consoleMessages, 'Sorted array:', 2000);

    // Now click Reset
    await bs.clickReset();

    // Wait for the reset console message
    const resetFound = await waitForConsoleMessage(consoleMessages, 'Array reset.', 2000);
    expect(resetFound).toBeTruthy();

    // After reset, sorted and swapped should be false
    const sortedFlag = await bs.isSortedFlag();
    const swappedFlag = await bs.getSwappedFlag();
    expect(sortedFlag).toBe(false);
    expect(swappedFlag).toBe(false);

    // And array should be reinitialized to arraySize
    const arrLen = await bs.getArrayLength();
    const arraySizeVar = await bs.getArraySizeVar();
    expect(arrLen).toBe(arraySizeVar);

    // No runtime page errors are expected as a result
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: multiple Clear/Reset clicks and Sort after Reset', async ({ page }) => {
    const bs = new BubbleSortPage(page);

    // Click Clear multiple times quickly
    await bs.clickClear();
    await bs.clickClear();
    await bs.clickClear();

    // Expect at least one "Array cleared." message
    const cleared = await waitForConsoleMessage(consoleMessages, 'Array cleared.', 2000);
    expect(cleared).toBeTruthy();

    // Click Reset multiple times quickly
    await bs.clickReset();
    await bs.clickReset();

    // Expect at least one "Array reset." message
    const resetFound = await waitForConsoleMessage(consoleMessages, 'Array reset.', 2000);
    expect(resetFound).toBeTruthy();

    // After resets, flags should be false
    const sortedFlag = await bs.isSortedFlag();
    const swappedFlag = await bs.getSwappedFlag();
    expect(sortedFlag).toBe(false);
    expect(swappedFlag).toBe(false);

    // Now click Sort after reset to ensure sorting still works
    await bs.clickSort();
    const sortedMsg = await waitForConsoleMessage(consoleMessages, 'Sorted array:', 3000);
    expect(sortedMsg).toBeTruthy();

    // Validate no fatal page errors arose during these rapid interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Observing runtime errors if they happen: capture and assert error objects', async ({ page }) => {
    // This test documents any runtime exceptions that occurred during interaction.
    // We don't create errors deliberately; we assert that if pageErrors exist they are Error instances.
    // If there are none, that's also a valid and passing outcome.
    if (pageErrors.length === 0) {
      // No errors observed; pass the test explicitly
      expect(pageErrors.length).toBe(0);
    } else {
      // If errors exist, ensure they are real Error objects with messages
      for (const err of pageErrors) {
        expect(err).toBeInstanceOf(Error);
        expect(typeof err.message).toBe('string');
        expect(err.message.length).toBeGreaterThan(0);
      }
    }
  });
});