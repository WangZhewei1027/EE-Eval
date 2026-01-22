import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79ceec1-d361-11f0-8438-11a56595a476.html';

// Page Object Model for interacting with the Radix Sort demo
class RadixSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pageErrors = [];
    this.consoleErrors = [];

    // Capture page errors and console errors for assertions
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') this.consoleErrors.push(msg.text());
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial UI to be ready (input and array created by init)
    await this.page.waitForSelector('#inputArray');
    await this.page.waitForSelector('#arrayContainer .array-element');
  }

  async setSpeed(ms) {
    // Set the range input and dispatch input event so UI updates
    await this.page.evaluate((v) => {
      const el = document.getElementById('speedRange');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, ms);
    // reflect update
    await this.page.waitForFunction((expected) => document.getElementById('speedLabel').textContent.includes(String(expected)), ms);
  }

  async getSpeedLabel() {
    return this.page.locator('#speedLabel').textContent();
  }

  async getInputValue() {
    return this.page.locator('#inputArray').inputValue();
  }

  async setInputValue(val) {
    await this.page.fill('#inputArray', val);
  }

  async clickStart() {
    await this.page.click('#startBtn');
  }

  async clickReset() {
    await this.page.click('#resetBtn');
  }

  async isStartDisabled() {
    return this.page.$eval('#startBtn', (b) => b.disabled);
  }

  async isResetDisabled() {
    return this.page.$eval('#resetBtn', (b) => b.disabled);
  }

  async isInputDisabled() {
    return this.page.$eval('#inputArray', (b) => b.disabled);
  }

  async isSpeedDisabled() {
    return this.page.$eval('#speedRange', (b) => b.disabled);
  }

  async getErrorText() {
    return this.page.locator('#error').textContent();
  }

  async getArrayValues() {
    return this.page.$$eval('#arrayContainer .array-element', (els) => els.map(e => e.textContent.trim()));
  }

  async getBucketContents() {
    return this.page.$$eval('#buckets .bucket', (buckets) => {
      return buckets.map(bucket => {
        // skip label child (first child)
        const items = Array.from(bucket.querySelectorAll('.bucket-element'));
        return items.map(i => i.textContent.trim());
      });
    });
  }

  async getBucketChildCounts() {
    return this.page.$$eval('#buckets .bucket', (buckets) => buckets.map(b => b.children.length));
  }

  // Helper to wait until 'Array is sorted!' appears in the error element
  async waitForSortedMessage(timeout = 30000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('error');
      return el && el.textContent.trim() === 'Array is sorted!';
    }, { timeout });
  }

  // Expose captured errors for assertions
  getPageErrors() {
    return this.pageErrors;
  }
  getConsoleErrors() {
    return this.consoleErrors;
  }
}

test.describe('Radix Sort Visualization (FSM) - d79ceec1-d361-11f0-8438-11a56595a476', () => {
  // Each test will create a new page and POM
  test('Idle State: initial UI and onEnter(init) are correct', async ({ page }) => {
    // This test validates the initial S0_Idle state:
    // - init() should populate the input with sample values
    // - originalArray should be set (we observe DOM)
    // - array elements should be rendered
    const app = new RadixSortPage(page);
    await app.goto();

    // Verify the input contains the sample numbers
    const inputVal = await app.getInputValue();
    expect(inputVal).toBe('170, 45, 75, 90, 802, 24, 2, 66');

    // Verify array elements match the sample and number of elements
    const arr = await app.getArrayValues();
    expect(arr).toEqual(['170', '45', '75', '90', '802', '24', '2', '66']);
    expect(arr.length).toBe(8);

    // Reset button should be disabled in Idle
    expect(await app.isResetDisabled()).toBe(true);

    // Buckets should be present with labels only (initialization performed)
    const bucketChildCounts = await app.getBucketChildCounts();
    // each bucket contains at least the label (1 child)
    expect(bucketChildCounts.length).toBe(10);
    for (const count of bucketChildCounts) {
      expect(count).toBeGreaterThanOrEqual(1);
    }

    // Ensure no unexpected page or console errors happened during load
    expect(app.getPageErrors().length).toBe(0);
    expect(app.getConsoleErrors().length).toBe(0);
  });

  test('ChangeSpeed event updates speed label and affects sorting delay', async ({ page }) => {
    // Validate ChangeSpeed event: adjusting speedRange updates UI label
    const app = new RadixSortPage(page);
    await app.goto();

    // Decrease speed to minimum (fast)
    await app.setSpeed(100);
    const speedLabel = await app.getSpeedLabel();
    expect(speedLabel).toContain('100 ms');

    // Increase speed to 1500 and verify update
    await app.setSpeed(1500);
    const speedLabel2 = await app.getSpeedLabel();
    expect(speedLabel2).toContain('1500 ms');

    // No errors emitted while changing speed
    expect(app.getPageErrors().length).toBe(0);
    expect(app.getConsoleErrors().length).toBe(0);
  });

  test('StartSort transition (S0_Idle -> S1_Sorting) runs and completes, verifying onEnter and onExit behaviors', async ({ page }) => {
    // This test validates starting the sort:
    // - Start button disables during sorting
    // - Input and speed controls are disabled during sorting
    // - Error element shows sorting progress messages
    // - On completion, buckets are cleared and error shows "Array is sorted!"
    // - Final array is sorted ascending
    test.setTimeout(60000); // allow more time for full sorting animation

    const app = new RadixSortPage(page);
    await app.goto();

    // Make sorting faster to keep test time reasonable
    await app.setSpeed(100);

    // Click Start Sort to transition to Sorting state
    await app.clickStart();

    // Immediately after clicking, start should be disabled and reset enabled, inputs disabled
    await page.waitForFunction(() => document.getElementById('startBtn').disabled === true);
    expect(await app.isStartDisabled()).toBe(true);
    expect(await app.isInputDisabled()).toBe(true);
    expect(await app.isSpeedDisabled()).toBe(true);

    // During sorting we expect error element to show a "Sorting by digit place" message at least once
    await page.waitForFunction(() => {
      const txt = document.getElementById('error').textContent || '';
      return txt.includes('Sorting by digit place');
    }, { timeout: 10000 });

    // Wait for sorting to finish: 'Array is sorted!' message
    await app.waitForSortedMessage(45000);

    // After completion, verify controls are re-enabled appropriately
    expect(await app.isStartDisabled()).toBe(false);
    // resetBtn becomes enabled (code sets to false)
    expect(await app.isResetDisabled()).toBe(false);
    // inputs enabled again
    expect(await app.isInputDisabled()).toBe(false);
    expect(await app.isSpeedDisabled()).toBe(false);

    // Verify onExit actions: buckets should be cleared (only labels present, no .bucket-element children)
    const bucketContents = await app.getBucketContents();
    for (const b of bucketContents) {
      expect(b.length).toBe(0); // no bucket-element children remain
    }

    // Verify the array container shows the sorted array
    const finalArray = await app.getArrayValues();
    expect(finalArray).toEqual(['2', '24', '45', '66', '75', '90', '170', '802']);

    // Verify error element exactly shows sorted message
    const err = await app.getErrorText();
    expect(err.trim()).toBe('Array is sorted!');

    // No page or console errors emitted during sorting
    expect(app.getPageErrors().length).toBe(0);
    expect(app.getConsoleErrors().length).toBe(0);
  });

  test('ResetSort transition from post-sort state resets to original array (S1_Sorting -> S2_Reset / S0_Idle expected outcomes)', async ({ page }) => {
    // Validate Reset behavior after sorting completes:
    // - Clicking Reset when not sorting should restore input value and array elements to originalArray
    const app = new RadixSortPage(page);
    await app.goto();

    // Speed up sorting and run it
    await app.setSpeed(100);
    await app.clickStart();
    await app.waitForFunction(() => document.getElementById('error').textContent.trim() === 'Array is sorted!', { timeout: 45000 });

    // After sorting, click Reset to go to Reset state and then idle
    await app.clickReset();

    // After reset, input should equal original sample again
    const inputVal = await app.getInputValue();
    expect(inputVal).toBe('170, 45, 75, 90, 802, 24, 2, 66');

    // The displayed array should be back to original sample
    const arr = await app.getArrayValues();
    expect(arr).toEqual(['170', '45', '75', '90', '802', '24', '2', '66']);

    // resetBtn should be disabled again per reset handler
    expect(await app.isResetDisabled()).toBe(true);

    // No page or console errors emitted
    expect(app.getPageErrors().length).toBe(0);
    expect(app.getConsoleErrors().length).toBe(0);
  });

  test('Edge case: starting with empty input shows validation error and prevents sorting', async ({ page }) => {
    // Validate input validation behavior:
    // - Empty input should produce error 'Please enter some numbers to sort.'
    // - Sorting should not start
    const app = new RadixSortPage(page);
    await app.goto();

    // Clear input and click Start
    await app.setInputValue('');
    await app.clickStart();

    // Expect the validation message
    await page.waitForFunction(() => (document.getElementById('error').textContent || '').includes('Please enter some numbers to sort.'));
    const err = await app.getErrorText();
    expect(err).toContain('Please enter some numbers to sort.');

    // Ensure sorting did not begin: start button should still be enabled
    expect(await app.isStartDisabled()).toBe(false);

    // No page or console errors emitted
    expect(app.getPageErrors().length).toBe(0);
    expect(app.getConsoleErrors().length).toBe(0);
  });

  test('Edge case: invalid input (non-integer) shows proper error and prevents sorting', async ({ page }) => {
    // Validate invalid token handling:
    // - Input with non-digit token should be rejected with 'Only positive integers are allowed.'
    const app = new RadixSortPage(page);
    await app.goto();

    // Input invalid numbers and click Start
    await app.setInputValue('12, abc, 34');
    await app.clickStart();

    // Expect the validation message
    await page.waitForFunction(() => (document.getElementById('error').textContent || '').includes('Only positive integers are allowed.'));
    const err = await app.getErrorText();
    expect(err).toContain('Only positive integers are allowed.');

    // Ensure sorting did not begin
    expect(await app.isStartDisabled()).toBe(false);

    // No page or console errors emitted
    expect(app.getPageErrors().length).toBe(0);
    expect(app.getConsoleErrors().length).toBe(0);
  });

  test('Attempting Reset during active sorting is ignored (ResetSort event while in S1_Sorting should return early)', async ({ page }) => {
    // Validate that clicking reset while sorting will not interrupt sorting (handler returns if sorting)
    test.setTimeout(60000);
    const app = new RadixSortPage(page);
    await app.goto();

    // Speed up and start sorting
    await app.setSpeed(100);
    await app.clickStart();

    // Wait until sorting is in progress (startBtn disabled)
    await page.waitForFunction(() => document.getElementById('startBtn').disabled === true);

    // Click Reset while sorting - per code this should return early and do nothing
    // Use page.click directly (resetBtn is enabled after sorting begins)
    await page.click('#resetBtn');

    // Ensure sorting still completes normally
    await app.waitForSortedMessage(45000);
    const err = await app.getErrorText();
    expect(err.trim()).toBe('Array is sorted!');

    // No page or console errors emitted
    expect(app.getPageErrors().length).toBe(0);
    expect(app.getConsoleErrors().length).toBe(0);
  });
});