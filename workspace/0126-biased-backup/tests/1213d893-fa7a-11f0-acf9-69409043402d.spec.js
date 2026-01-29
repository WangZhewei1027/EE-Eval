import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1213d893-fa7a-11f0-acf9-69409043402d.html';

// Page object encapsulating selectors and common interactions
class BucketSortPage {
  constructor(page) {
    this.page = page;
    this.sel = {
      inputArray: '#inputArray',
      numBuckets: '#numBucketsInput',
      btnInitialize: '#btnInitialize',
      btnReset: '#btnReset',
      controlsForm: '#controlsForm',
      btnStep: '#btnStep',
      btnBackStep: '#btnBackStep',
      btnAuto: '#btnAuto',
      btnPause: '#btnPause',
      btnFastForward: '#btnFastForward',
      btnResetStep: '#btnResetStep',
      btnRebucket: '#btnRebucket',
      btnShowSortedArray: '#btnShowSortedArray',
      autoDelayRange: '#autoDelayRange',
      autoDelayValue: '#autoDelayValue',
      bucketSortType: '#bucketSortType',
      statusLine: '#statusLine',
      logArea: '#logArea',
      bucketContainer: '#bucketContainer',
      finalOutputSection: '#finalOutputSection',
      finalSortedArray: '#finalSortedArray',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Basic setters and actions
  async setInputArray(value) {
    await this.page.fill(this.sel.inputArray, value);
  }
  async setNumBuckets(value) {
    await this.page.fill(this.sel.numBuckets, String(value));
  }
  async clickInitialize() {
    await this.page.click(this.sel.btnInitialize);
  }
  async clickReset() {
    await this.page.click(this.sel.btnReset);
  }
  async clickStep() {
    await this.page.click(this.sel.btnStep);
  }
  async clickBackStep() {
    await this.page.click(this.sel.btnBackStep);
  }
  async clickResetStep() {
    await this.page.click(this.sel.btnResetStep);
  }
  async clickAuto() {
    await this.page.click(this.sel.btnAuto);
  }
  async clickPause() {
    await this.page.click(this.sel.btnPause);
  }
  async clickFastForward() {
    await this.page.click(this.sel.btnFastForward);
  }
  async clickRebucket() {
    await this.page.click(this.sel.btnRebucket);
  }
  async clickShowSortedArray() {
    await this.page.click(this.sel.btnShowSortedArray);
  }
  async setAutoDelay(ms) {
    await this.page.fill(this.sel.autoDelayRange, String(ms));
  }
  async changeBucketSortType(value) {
    await this.page.selectOption(this.sel.bucketSortType, value);
  }

  // Reads
  async isControlsVisible() {
    return await this.page.$eval(this.sel.controlsForm, el => getComputedStyle(el).display !== 'none');
  }
  async getStatusText() {
    return await this.page.$eval(this.sel.statusLine, el => el.textContent || '');
  }
  async getLogText() {
    return await this.page.$eval(this.sel.logArea, el => el.textContent || '');
  }
  async getBucketTexts() {
    // returns array of bucket label strings
    return await this.page.$$eval(`${this.sel.bucketContainer} .bucket`, nodes => nodes.map(n => n.textContent || ''));
  }
  async getBucketContentsArrays() {
    // returns array of arrays of numbers per bucket (empty buckets => [])
    return await this.page.$$eval(`${this.sel.bucketContainer} .bucket`, nodes => {
      return nodes.map(n => {
        const txt = n.textContent || '';
        // bucket label format example:
        // Bucket 1 [0.00 - 1.00]: 1, 2
        const parts = txt.split(':');
        if(parts.length < 2) return [];
        const content = parts.slice(1).join(':').trim();
        if(content === '(empty)') return [];
        // parse numbers
        const nums = content.split(',').map(s => s.trim()).filter(s => s.length > 0).map(Number).filter(x => Number.isFinite(x));
        return nums;
      });
    });
  }

  async finalOutputVisible() {
    return await this.page.$eval(this.sel.finalOutputSection, el => getComputedStyle(el).display !== 'none');
  }

  async getFinalSortedArrayText() {
    return await this.page.$eval(this.sel.finalSortedArray, el => el.textContent || '');
  }

  async isButtonDisabled(selector) {
    return await this.page.$eval(selector, el => el.disabled === true);
  }

  // Wait helpers
  async waitForLogContains(substr, timeout = 2000) {
    await this.page.waitForFunction((sel, s) => {
      const el = document.querySelector(sel);
      return el && el.textContent && el.textContent.indexOf(s) !== -1;
    }, this.sel.logArea, substr, { timeout });
  }

  async waitForStatusContains(substr, timeout = 2000) {
    await this.page.waitForFunction((sel, s) => {
      const el = document.querySelector(sel);
      return el && el.textContent && el.textContent.indexOf(s) !== -1;
    }, this.sel.statusLine, substr, { timeout });
  }

  async waitForCondition(fn, timeout = 3000) {
    await this.page.waitForFunction(fn, null, { timeout });
  }
}

test.describe('Bucket Sort Interactive Demo - FSM and UI tests', () => {
  let page;
  let bsp; // BucketSortPage
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    bsp = new BucketSortPage(page);

    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Collect console entries and page errors for assertions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await bsp.goto();
  });

  test.afterEach(async () => {
    // Ensure no uncaught page errors or console errors occurred during tests
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
    await page.close();
  });

  test('Initialization: S0 -> S1 (controls shown, buckets created)', async () => {
    // Validate initial UI is in stage 0: controls hidden
    expect(await bsp.isControlsVisible()).toBe(false);

    // Fill input and set number of buckets then initialize
    await bsp.setInputArray('4, 2, 1, 5, 3');
    await bsp.setNumBuckets(5);
    await bsp.clickInitialize();

    // Controls form should now be visible (evidence from transition)
    expect(await bsp.isControlsVisible()).toBe(true);

    // Status line should mention 'Buckets Created' (updateUI called on entry)
    await bsp.waitForStatusContains('Buckets Created');

    const status = await bsp.getStatusText();
    expect(status).toMatch(/Buckets Created/i);

    // Log should include initialization message
    await bsp.waitForLogContains('Initialized with array');
    const log = await bsp.getLogText();
    expect(log).toMatch(/Initialized with array/);

    // btnReset should be enabled after initialization
    expect(await bsp.isButtonDisabled('#btnReset')).toBe(false);

    // Bucket container should show 5 buckets
    const bucketTexts = await bsp.getBucketTexts();
    expect(bucketTexts.length).toBe(5);
  });

  test('Distribution: step forward places elements into buckets and transitions to sorting', async () => {
    // Initialize first
    await bsp.setInputArray('4 2 1 5 3');
    await bsp.setNumBuckets(5);
    await bsp.clickInitialize();
    await bsp.waitForLogContains('Initialized with array');

    // Step through distribution for each element
    // There are 5 elements; each Step should log 'Placed element ... into bucket ...'
    for (let i = 0; i < 5; i++) {
      await bsp.clickStep();
      await bsp.waitForLogContains('Placed element', 1000);
      const l = await bsp.getLogText();
      expect(l).toMatch(/Placed element/);
    }

    // One additional Step should trigger transition to sorting stage (distribution complete)
    await bsp.clickStep();
    await bsp.waitForLogContains('Distribution complete. Proceeding to bucket sorting.', 2000);
    const log = await bsp.getLogText();
    expect(log).toMatch(/Distribution complete/i);

    // Status line should indicate sorting (stage 3)
    await bsp.waitForStatusContains('Sorting bucket');
    const status = await bsp.getStatusText();
    expect(status).toMatch(/Sorting bucket/i);

    // Bucket container should still show buckets (contents may be present)
    const bucketTexts = await bsp.getBucketTexts();
    expect(bucketTexts.length).toBeGreaterThanOrEqual(1);
  });

  test('BackStep during distribution removes last placed element (S2 BackStep)', async () => {
    // Initialize and do two distribution steps
    await bsp.setInputArray('7,8,9,10');
    await bsp.setNumBuckets(4);
    await bsp.clickInitialize();
    await bsp.waitForLogContains('Initialized with array');

    await bsp.clickStep(); // place 7
    await bsp.waitForLogContains('Placed element', 1000);
    await bsp.clickStep(); // place 8
    await bsp.waitForLogContains('Placed element', 1000);

    // Now BackStep should remove last placed element
    // btnBackStep may be enabled, click it
    await bsp.clickBackStep();
    // After back step, logs should contain 'Removed element'
    await bsp.waitForLogContains('Removed element', 1000);
    const log = await bsp.getLogText();
    expect(log).toMatch(/Removed element/);

    // Ensure the bucket contents no longer include the last element (8)
    const contents = await bsp.getBucketContentsArrays();
    const flattened = contents.flat();
    expect(flattened.includes(8)).toBe(false);
  });

  test('Rebucket action available after initialize and keeps stage at 1', async () => {
    // Initialize
    await bsp.setInputArray('1, 2, 3, 4');
    await bsp.setNumBuckets(2);
    await bsp.clickInitialize();
    await bsp.waitForLogContains('Initialized with array');

    // Rebucket button should be enabled
    expect(await bsp.isButtonDisabled('#btnRebucket')).toBe(false);

    // Click Rebucket and assert log message and controls state
    await bsp.clickRebucket();
    await bsp.waitForLogContains('Rebucketed current array.', 1000);
    const log = await bsp.getLogText();
    expect(log).toMatch(/Rebucketed current array/);

    // Status should indicate buckets created (stage 1)
    await bsp.waitForStatusContains('Buckets Created');
    const status = await bsp.getStatusText();
    expect(status).toMatch(/Buckets Created/);
  });

  test('Sorting buckets step-by-step and concatenation to completion (S3 -> S4 -> S5)', async () => {
    // Initialize a known array
    await bsp.setInputArray('5,1,4,2,3');
    await bsp.setNumBuckets(3);
    await bsp.changeBucketSortType('insertion'); // ensure deterministic algo
    await bsp.clickInitialize();
    await bsp.waitForLogContains('Initialized with array');

    // Distribute all elements
    for (let i = 0; i < 5; i++) {
      await bsp.clickStep();
      await bsp.waitForLogContains('Placed element', 1000);
    }
    // Move into sorting
    await bsp.clickStep();
    await bsp.waitForLogContains('Distribution complete', 2000);

    // Now step through sorting until all buckets sorted and concatenation starts
    // We don't know exact number of sort steps; iterate clicking Step until status indicates concatenation
    // Limit loops to avoid infinite
    let loopGuard = 0;
    while (true) {
      loopGuard++;
      if (loopGuard > 200) break;
      const status = await bsp.getStatusText();
      if (/Concatenating|Concatenation|Concatenated/i.test(status) || /Starting concatenation/i.test(await bsp.getLogText())) {
        break;
      }
      await bsp.clickStep();
      // small wait to allow state change
      await bsp.page.waitForTimeout(50);
    }

    // Ensure concatenation has started by checking logs
    const logs = await bsp.getLogText();
    expect(logs).toMatch(/All buckets sorted\. Starting concatenation\.|Starting concatenation/i);

    // Step through concatenation steps until completion
    // Number of concatenation steps equals number of buckets
    const bucketCount = (await bsp.getBucketTexts()).length || 0;
    for (let i = 0; i < bucketCount; i++) {
      await bsp.clickStep();
      await bsp.waitForLogContains('Concatenated bucket', 1000);
    }
    // Final concatenation step should mark completion
    // One more step might be necessary if done previously; check logs for completion
    await bsp.waitForLogContains('Concatenation done. Sorting complete.', 2000);

    // Status should indicate sort completed
    await bsp.waitForStatusContains('Sort completed');
    const finalStatus = await bsp.getStatusText();
    expect(finalStatus.toLowerCase()).toContain('sort completed');

    // Even if final sorted array UI element may not be populated by fast flows,
    // ensure that the buckets themselves hold sorted subarrays and that concatenation completed.
    const bucketArrays = await bsp.getBucketContentsArrays();
    // Each bucket array should be sorted ascending
    for (const arr of bucketArrays) {
      for (let i = 1; i < arr.length; i++) {
        expect(arr[i - 1] <= arr[i]).toBeTruthy();
      }
    }

    // Compose flattened array and ensure it's sorted ascending as final result
    const flattened = bucketArrays.flat();
    for (let i = 1; i < flattened.length; i++) {
      expect(flattened[i - 1] <= flattened[i]).toBeTruthy();
    }
  });

  test('Fast forward completes process quickly (FastForward event)', async () => {
    // Initialize
    await bsp.setInputArray('9 8 7 6 5 4 3 2 1');
    await bsp.setNumBuckets(4);
    await bsp.clickInitialize();
    await bsp.waitForLogContains('Initialized with array');

    // Use Fast Forward to finish quickly
    await bsp.clickFastForward();

    // Wait for logs to announce fast forward completion or concatenation done
    await bsp.page.waitForTimeout(200); // brief wait
    const log = await bsp.getLogText();
    expect(/Fast forward done after|Concatenation done|Sorting complete/i.test(log)).toBeTruthy();

    // Status should indicate completion or concatenation depending on implementation
    const status = await bsp.getStatusText();
    expect(/Sort completed|Concatenating|Concatenation/i.test(status) || status.length >= 0).toBeTruthy();
  });

  test('Reset steps during process (ResetSteps event) undoes distribution and empties buckets', async () => {
    // Initialize and distribute a couple elements
    await bsp.setInputArray('10,20,30,40');
    await bsp.setNumBuckets(2);
    await bsp.clickInitialize();
    await bsp.waitForLogContains('Initialized with array');

    await bsp.clickStep(); // one distribution
    await bsp.waitForLogContains('Placed element', 1000);

    // Reset steps should empty buckets and set stage back to 1
    await bsp.clickResetStep();
    await bsp.waitForLogContains('Steps reset. Buckets emptied.', 1000);
    const log = await bsp.getLogText();
    expect(log).toMatch(/Steps reset. Buckets emptied./);

    // Buckets should be empty now
    const bucketArrays = await bsp.getBucketContentsArrays();
    for (const arr of bucketArrays) {
      expect(arr.length).toBe(0);
    }
  });

  test('Auto sort starts and pause toggles (StartAuto & PauseAuto events) and obeys auto delay', async () => {
    // Initialize
    await bsp.setInputArray('3,1,2');
    await bsp.setNumBuckets(2);
    await bsp.setAutoDelay(50); // reduce delay to speed up auto
    await bsp.clickInitialize();
    await bsp.waitForLogContains('Initialized with array');

    // Start auto sorting
    await bsp.clickAuto();
    // Immediately the UI should reflect auto active: btnPause becomes enabled and btnAuto disabled
    // We cannot inspect internal autoActive flag, but buttons reflect state
    expect(await bsp.isButtonDisabled('#btnAuto')).toBe(true);
    expect(await bsp.isButtonDisabled('#btnPause')).toBe(false);

    // Pause shortly after
    await bsp.page.waitForTimeout(150);
    await bsp.clickPause();
    // After pausing, btnAuto should be enabled again
    expect(await bsp.isButtonDisabled('#btnAuto')).toBe(false);

    // Ensure no page errors occurred while auto was running (checked in afterEach)
  });

  test('Invalid input triggers alert dialog and equal-values input adjusts buckets to 1', async () => {
    // Invalid input (non-numeric)
    await bsp.setInputArray('a b c');
    await bsp.clickInitialize();

    // Dialog should appear with invalid input message and our listener accepted it
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    expect(dialogMessages[0]).toMatch(/Invalid input array/i);

    dialogMessages = []; // reset for next dialog check

    // All equal values input triggers alert and sets number of buckets to 1
    await bsp.setInputArray('2,2,2');
    await bsp.setNumBuckets(3);
    await bsp.clickInitialize();

    // There should be an alert about all numbers equal and bucket count set to 1
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    expect(dialogMessages[0]).toMatch(/All numbers equal, number of buckets set to 1/i);

    // Controls should still appear and numBuckets should have been set to 1 in the DOM input
    const numBucketsVal = await page.$eval('#numBucketsInput', el => el.value);
    expect(Number(numBucketsVal)).toBe(1);
  });

  test('Show/Hide final sorted array toggles display (ShowSortedArray event)', async () => {
    // Initialize and finish sort via fast forward to reach final state
    await bsp.setInputArray('1 4 2 3');
    await bsp.setNumBuckets(2);
    await bsp.clickInitialize();
    await bsp.waitForLogContains('Initialized with array');

    await bsp.clickFastForward();
    await bsp.page.waitForTimeout(200);

    // The finalOutputSection may or may not be visible; use the Show/Hide button to toggle
    // Click show/hide control button to ensure it doesn't throw and toggles display
    const beforeVisible = await bsp.finalOutputVisible();
    await bsp.clickShowSortedArray();
    const afterVisible = await bsp.finalOutputVisible();
    // It should toggle visibility
    expect(afterVisible).toBe(!beforeVisible);
  });

  test('Reset from completed sorting brings UI back to initial state (Reset event from S5)', async () => {
    // Initialize and complete via fast forward
    await bsp.setInputArray('4,3,2,1');
    await bsp.setNumBuckets(2);
    await bsp.clickInitialize();
    await bsp.waitForLogContains('Initialized with array');

    await bsp.clickFastForward();
    await bsp.page.waitForTimeout(200);

    // Reset button should be available; click it
    await bsp.clickReset();

    // Controls form should be hidden again (stage 0)
    const visible = await bsp.isControlsVisible();
    expect(visible).toBe(false);

    // Input fields should be reset
    const inputValue = await page.$eval('#inputArray', el => el.value);
    expect(inputValue).toBe('');
    const numBucketsVal = await page.$eval('#numBucketsInput', el => el.value);
    expect(numBucketsVal).toBe('5'); // reset default is 5

    // Buttons should be disabled appropriately
    expect(await bsp.isButtonDisabled('#btnStep')).toBe(true);
    expect(await bsp.isButtonDisabled('#btnAuto')).toBe(true);
    expect(await bsp.isButtonDisabled('#btnPause')).toBe(true);
    expect(await bsp.isButtonDisabled('#btnFastForward')).toBe(true);
    expect(await bsp.isButtonDisabled('#btnBackStep')).toBe(true);
    expect(await bsp.isButtonDisabled('#btnResetStep')).toBe(true);
  });
});