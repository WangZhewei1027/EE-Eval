import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3bb291-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object for the Radix Sort visualization page
class RadixPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      generateBtn: '#generateBtn',
      sortBtn: '#sortBtn',
      stepBtn: '#stepBtn',
      arrayContainer: '#arrayContainer',
      bucketsContainer: '#bucketsContainer',
      stepInfo: '#stepInfo',
      arrayElements: '.array-element',
      buckets: '.bucket'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickGenerate() {
    await this.page.click(this.selectors.generateBtn);
  }

  async clickStart() {
    await this.page.click(this.selectors.sortBtn);
  }

  async clickNext() {
    await this.page.click(this.selectors.stepBtn);
  }

  async getStepInfoText() {
    return (await this.page.locator(this.selectors.stepInfo).textContent()) || '';
  }

  async getArrayValues() {
    return this.page.$$eval(`${this.selectors.arrayContainer} ${this.selectors.arrayElements}`, els =>
      els.map(e => {
        const t = e.textContent || '';
        const n = Number(t.trim());
        return Number.isFinite(n) ? n : t.trim();
      })
    );
  }

  async getBucketCounts() {
    return this.page.$$eval(`${this.selectors.bucketsContainer} ${this.selectors.buckets}`, els =>
      els.map(bucket => bucket.querySelectorAll('.array-element').length)
    );
  }

  async getMaxDigits() {
    // read global variable maxDigits from page
    return this.page.evaluate(() => window.maxDigits);
  }

  async getCurrentDigit() {
    return this.page.evaluate(() => window.currentDigit);
  }

  async getIsSorting() {
    return this.page.evaluate(() => window.isSorting);
  }

  async waitForStepInfoContains(substring, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return !!el && el.textContent.includes(substr);
      },
      this.selectors.stepInfo,
      substring,
      { timeout }
    );
  }

  async waitForIsSorting(value, timeout = 5000) {
    await this.page.waitForFunction(
      (v) => window.isSorting === v,
      value,
      { timeout }
    );
  }

  async waitForCurrentDigitAtLeast(n, timeout = 5000) {
    await this.page.waitForFunction(
      (val) => window.currentDigit >= val,
      n,
      { timeout }
    );
  }
}

// Capture console errors and page errors for assertions in afterEach
test.describe('Radix Sort Visualization FSM - de3bb291-fa74-11f0-a1b6-4b9b8151441a', () => {
  let page;
  let radix;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    // Listen for console errors
    consoleErrors = [];
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore listener errors
      }
    });

    // Listen for uncaught exceptions on the page
    pageErrors = [];
    page.on('pageerror', error => {
      try {
        pageErrors.push(error.message);
      } catch (e) {
        // ignore
      }
    });

    radix = new RadixPage(page);
    await radix.goto();
    // Wait a short moment for initial generateNewArray entry action to finish updating the DOM
    await page.waitForTimeout(100);
  });

  test.afterEach(async () => {
    // Assert that no page-level JS errors or console errors were emitted during the test.
    // This verifies that the application ran without uncaught exceptions in the browser context.
    expect(pageErrors, `Expected no window.onerror/pageerror, saw: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(consoleErrors, `Expected no console.error messages, saw: ${JSON.stringify(consoleErrors)}`).toEqual([]);

    // Close page after each test to isolate tests
    await page.close();
  });

  test('Initial state (S0_Idle) entry action generateNewArray() should run on load and transition to Array Generated (S1)', async () => {
    // Verify that the entry action generateNewArray() executed on page load:
    // The step info text should reflect a newly generated array message (entry_action sets this text)
    const stepText = await radix.getStepInfoText();
    expect(stepText).toContain("New array generated. Click 'Start Radix Sort' to begin.");

    // There should be 10 elements in the array (generateNewArray generates 10 numbers)
    const arrayValues = await radix.getArrayValues();
    expect(Array.isArray(arrayValues)).toBe(true);
    expect(arrayValues.length).toBe(10);

    // Verify that sorting is not active after initial generation
    const isSorting = await radix.getIsSorting();
    expect(isSorting).toBe(false);

    // maxDigits should be a positive integer
    const maxDigits = await radix.getMaxDigits();
    expect(typeof maxDigits).toBe('number');
    expect(Number.isInteger(maxDigits)).toBe(true);
    expect(maxDigits).toBeGreaterThanOrEqual(1);
  });

  test('GenerateNewArray event (click #generateBtn) triggers array regeneration and resets sorting state (S0 -> S1)', async () => {
    // Capture current array to compare with new one
    const prevArray = await radix.getArrayValues();

    // Click Generate New Array
    await radix.clickGenerate();

    // Wait for stepInfo update
    await radix.waitForStepInfoContains("New array generated. Click 'Start Radix Sort' to begin.");

    const newArray = await radix.getArrayValues();
    expect(newArray.length).toBe(10);

    // It's possible (though unlikely) that random generation produces identical arrays;
    // therefore do not assert inequality but assert that currentDigit was reset and isSorting is false.
    const currentDigit = await radix.getCurrentDigit();
    const isSorting1 = await radix.getIsSorting();
    expect(currentDigit).toBe(0);
    expect(isSorting).toBe(false);

    // Verify maxDigits is recomputed and >= 1
    const maxDigits1 = await radix.getMaxDigits();
    expect(Number.isInteger(maxDigits)).toBe(true);
    expect(maxDigits).toBeGreaterThanOrEqual(1);
  });

  test('StartSorting event (click #sortBtn) begins sorting (S1 -> S2) and performs first step', async () => {
    // Ensure initial state is array generated
    const initialStep = await radix.getStepInfoText();
    expect(initialStep).toContain("New array generated. Click 'Start Radix Sort' to begin.");

    // Click Start Radix Sort
    await radix.clickStart();

    // Immediately the code sets "Starting Radix Sort..." then calls performSortStep() which updates step info
    // Wait for either starting text or step text
    await radix.page.waitForTimeout(50); // small tick to let initial sync set text

    // Expect that we eventually see the processing "Step 1: Sorting by digit 1 from the right"
    await radix.waitForStepInfoContains('Step 1: Sorting by digit 1 from the right');

    // After first performSortStep call, currentDigit should be at least 1 and isSorting should be true (until completion)
    await radix.waitForCurrentDigitAtLeast(1);
    const isSorting2 = await radix.getIsSorting();
    expect(isSorting).toBe(true);
  });

  test('NextStep event (click #stepBtn) advances sorting by digits and eventually reaches Sorting Complete (S2 -> S3)', async () => {
    // Start sorting first
    await radix.clickStart();

    // Wait for first step to be visible
    await radix.waitForStepInfoContains('Step 1: Sorting by digit 1 from the right');

    // Determine how many digit-steps are required
    const maxDigits2 = await radix.getMaxDigits();
    expect(Number.isInteger(maxDigits)).toBe(true);
    expect(maxDigits).toBeGreaterThanOrEqual(1);

    // After the initial performSortStep during startSorting(), currentDigit is already 1.
    // We'll click the Next Step button repeatedly until sorting is complete.
    // To guard against asynchronous auto-advances (setTimeout in implementation), wait for stable changes between clicks.

    // Safety cap to avoid infinite loops
    const maxClicks = maxDigits + 3;
    let clicks = 0;
    let done = false;

    while (clicks < maxClicks && !done) {
      // If sorting already completed, break
      const isSorting3 = await radix.getIsSorting();
      if (!isSorting) {
        done = true;
        break;
      }

      // Click Next Step to prompt an immediate performSortStep()
      await radix.clickNext();
      clicks++;

      // Wait until currentDigit increments or sorting completes
      // compute a target: currentDigit should be at least clicks (since initial step increment already occurred)
      const expectedMinDigit = Math.max(1, clicks); // conservative
      try {
        await radix.waitForCurrentDigitAtLeast(expectedMinDigit, 2000);
      } catch (e) {
        // If waiting times out, continue loop; might be because setTimeout scheduled automatic steps
      }

      // Check if sorting completed
      const stepText1 = await radix.getStepInfoText();
      if (stepText.includes('Sorting complete! The array is now sorted.')) {
        done = true;
        break;
      }

      // Small pause to let queued timers run if any
      await radix.page.waitForTimeout(100);
    }

    // After looping, ensure sorting completed
    const finalStepText = await radix.getStepInfoText();
    expect(finalStepText).toContain('Sorting complete! The array is now sorted.');

    // Verify isSorting is false
    const finalIsSorting = await radix.getIsSorting();
    expect(finalIsSorting).toBe(false);

    // Verify the array appears sorted numerically (non-decreasing)
    const finalArray = await radix.getArrayValues();
    const numericArray = finalArray.map(x => Number(x));
    for (let i = 1; i < numericArray.length; i++) {
      expect(numericArray[i]).toBeGreaterThanOrEqual(numericArray[i - 1]);
    }
  }, { timeout: 30000 });

  test('Edge case: Clicking Next Step when not sorting should be a no-op (no errors, no state transition)', async () => {
    // Ensure we're in not-sorting state
    const isSortingBefore = await radix.getIsSorting();
    expect(isSortingBefore).toBe(false);

    const beforeStepInfo = await radix.getStepInfoText();
    // Click Next Step while not sorting
    await radix.clickNext();

    // Give a short moment for any unexpected behavior
    await radix.page.waitForTimeout(150);

    const afterStepInfo = await radix.getStepInfoText();
    // The stepInfo should remain unchanged when not sorting
    expect(afterStepInfo).toBe(beforeStepInfo);
  });

  test('Edge case: Clicking Start Sorting when already sorting should not restart/throw (idempotent)', async () => {
    // Start sorting
    await radix.clickStart();
    await radix.waitForStepInfoContains('Step 1: Sorting by digit 1 from the right');

    // Record currentDigit and stepInfo
    const currentDigitBefore = await radix.getCurrentDigit();
    const stepInfoBefore = await radix.getStepInfoText();

    // Click Start again while sorting
    await radix.clickStart();

    // Wait briefly for any changes
    await radix.page.waitForTimeout(200);

    // After clicking start again, ensure the sorting wasn't reset to initial state and no exceptions thrown
    const currentDigitAfter = await radix.getCurrentDigit();
    const stepInfoAfter = await radix.getStepInfoText();

    // currentDigit should be >= before (it may have advanced due to async steps). It should not be reset to 0.
    expect(currentDigitAfter).toBeGreaterThanOrEqual(currentDigitBefore);
    expect(stepInfoAfter.length).toBeGreaterThan(0);
  });

  test('Edge case: Clicking Generate New Array during sorting should stop sorting and reset state', async () => {
    // Start sorting
    await radix.clickStart();
    await radix.waitForStepInfoContains('Step 1: Sorting by digit 1 from the right');

    // Ensure sorting active
    expect(await radix.getIsSorting()).toBe(true);

    // Click Generate to interrupt
    await radix.clickGenerate();

    // Wait for generate to set the "New array generated..." message
    await radix.waitForStepInfoContains("New array generated. Click 'Start Radix Sort' to begin.");

    // Sorting should be stopped
    expect(await radix.getIsSorting()).toBe(false);

    // currentDigit should be reset to 0
    const cd = await radix.getCurrentDigit();
    expect(cd).toBe(0);

    // Array should have 10 elements
    const arr = await radix.getArrayValues();
    expect(arr.length).toBe(10);
  });
});