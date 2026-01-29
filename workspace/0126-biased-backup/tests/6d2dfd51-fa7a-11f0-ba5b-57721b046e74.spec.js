import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2dfd51-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the Bucket Sort interactive application
class BucketSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Controls
    this.selectors = {
      arrayInput: '#arrayInput',
      setArray: '#setArray',
      arraySize: '#arraySize',
      arraySizeValue: '#arraySizeValue',
      generateRandom: '#generateRandom',
      bucketCount: '#bucketCount',
      bucketCountValue: '#bucketCountValue',
      minValue: '#minValue',
      maxValue: '#maxValue',
      startSort: '#startSort',
      nextStep: '#nextStep',
      autoStep: '#autoStep',
      reset: '#reset',
      showPseudocode: '#showPseudocode',
      stepDescription: '#stepDescription',
      originalArray: '#originalArray',
      bucketsSection: '#bucketsSection',
      bucketsContainer: '#bucketsContainer',
      sortedArraySection: '#sortedArraySection',
      sortedArray: '#sortedArray',
      pseudocode: '#pseudocode'
    };
  }

  // Navigation helper
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Basic interactions
  async clickSetArray() {
    await this.page.click(this.selectors.setArray);
  }
  async clickGenerateRandom() {
    await this.page.click(this.selectors.generateRandom);
  }
  async clickStartSort() {
    await this.page.click(this.selectors.startSort);
  }
  async clickNextStep() {
    await this.page.click(this.selectors.nextStep);
  }
  async clickAutoStep() {
    await this.page.click(this.selectors.autoStep);
  }
  async clickReset() {
    await this.page.click(this.selectors.reset);
  }
  async clickShowPseudocode() {
    await this.page.click(this.selectors.showPseudocode);
  }

  // Element getters / state inspectors
  async getStepDescriptionText() {
    return (await this.page.locator(this.selectors.stepDescription).innerText()).trim();
  }

  async getOriginalArrayItemsText() {
    return await this.page.$$eval(`${this.selectors.originalArray} .item`, nodes => nodes.map(n => n.textContent.trim()));
  }

  async getOriginalArrayInputValue() {
    return await this.page.$eval(this.selectors.arrayInput, el => el.value);
  }

  async setArrayInput(value) {
    await this.page.fill(this.selectors.arrayInput, value);
  }

  async setArraySize(value) {
    // range input - set via evaluate to ensure proper event
    await this.page.evaluate((sel, v) => {
      const el = document.querySelector(sel);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, this.selectors.arraySize, String(value));
  }

  async getArraySizeValueText() {
    return await this.page.locator(this.selectors.arraySizeValue).innerText();
  }

  async setBucketCount(value) {
    await this.page.evaluate((sel, v) => {
      const el = document.querySelector(sel);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, this.selectors.bucketCount, String(value));
  }

  async getBucketCountValueText() {
    return await this.page.locator(this.selectors.bucketCountValue).innerText();
  }

  async setMinValue(value) {
    await this.page.fill(this.selectors.minValue, String(value));
    // trigger change event
    await this.page.$eval(this.selectors.minValue, el => el.dispatchEvent(new Event('change', { bubbles: true })));
  }

  async setMaxValue(value) {
    await this.page.fill(this.selectors.maxValue, String(value));
    await this.page.$eval(this.selectors.maxValue, el => el.dispatchEvent(new Event('change', { bubbles: true })));
  }

  async getBucketsVisible() {
    return await this.page.$eval(this.selectors.bucketsSection, el => getComputedStyle(el).display !== 'none');
  }

  async getSortedArrayVisible() {
    return await this.page.$eval(this.selectors.sortedArraySection, el => getComputedStyle(el).display !== 'none');
  }

  async getPseudocodeVisible() {
    return await this.page.$eval(this.selectors.pseudocode, el => getComputedStyle(el).display !== 'none');
  }

  async getBucketsCount() {
    return await this.page.$$eval(`${this.selectors.bucketsContainer} .bucket`, nodes => nodes.length);
  }

  async getBucketsItemsText() {
    // returns array of arrays: each bucket's items as number strings
    return await this.page.$$eval(`${this.selectors.bucketsContainer} .bucket`, buckets => {
      return buckets.map(bucket => {
        const items = Array.from(bucket.querySelectorAll('.bucket-items .item'));
        return items.map(i => i.textContent.trim());
      });
    });
  }

  async getSortedArrayItemsText() {
    return await this.page.$$eval(`${this.selectors.sortedArray} .item`, nodes => nodes.map(n => n.textContent.trim()));
  }

  async getWindowVar(varName) {
    return await this.page.evaluate(name => {
      // return global variable if present, otherwise undefined
      // Note: This does not inject new globals; it only reads existing ones.
      return window[name];
    }, varName);
  }
}

test.describe('Interactive Bucket Sort - FSM / UI tests', () => {
  let page;
  let bucketPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    bucketPage = new BucketSortPage(page);
    // Navigate to the application before each test
    await bucketPage.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Initial Idle state (S0_Idle) and Array Set (S1_ArraySet)', () => {
    test('Initial state should be Idle with empty original array display (entry action updateOriginalArrayDisplay invoked)', async () => {
      // Verify step description is the idle message
      const stepText = await bucketPage.getStepDescriptionText();
      expect(stepText).toContain('Click "Start Bucket Sort" to begin the visualization.');

      // The script calls updateOriginalArrayDisplay() on init but originalArray is an empty array initially,
      // so the original array display should be empty (no .item elements).
      const originalItems = await bucketPage.getOriginalArrayItemsText();
      expect(Array.isArray(originalItems)).toBe(true);
      expect(originalItems.length).toBe(0);
    });

    test('Clicking Set Array transitions to Array Set (S1_ArraySet) and updates original array display', async () => {
      // Ensure the input contains the provided CSV value
      const initialInput = await bucketPage.getOriginalArrayInputValue();
      expect(initialInput).toBeTruthy();

      // Click Set Array
      await bucketPage.clickSetArray();

      // After Set Array, the original array display should show items parsed from the input
      const items = await bucketPage.getOriginalArrayItemsText();
      expect(items.length).toBeGreaterThan(0);

      // Validate that window.originalArray was set correctly (onEnter evidence: parseInt conversion)
      const originalArray = await bucketPage.getWindowVar('originalArray');
      // originalArray should be an array of numbers whose string representations match displayed items
      expect(Array.isArray(originalArray)).toBe(true);
      expect(originalArray.length).toBe(items.length);
      // Compare as strings to avoid subtle formatting differences
      const originalStrings = originalArray.map(n => String(n));
      expect(originalStrings).toEqual(items);
    });

    test('Generate Random Array produces an array of requested size and updates display', async () => {
      // Set desired size
      await bucketPage.setArraySize(7);
      const sizeText = await bucketPage.getArraySizeValueText();
      expect(sizeText).toBe('7');

      // Also set range min/max to known values to avoid surprises
      await bucketPage.setMinValue(0);
      await bucketPage.setMaxValue(20);

      // Click Generate
      await bucketPage.clickGenerateRandom();

      // Input should now be filled with comma-separated random numbers
      const inputVal = await bucketPage.getOriginalArrayInputValue();
      expect(typeof inputVal).toBe('string');
      const arr = inputVal.split(',').filter(s => s.trim().length > 0);
      expect(arr.length).toBe(7);

      // The displayed original array items must match the input array length
      const displayed = await bucketPage.getOriginalArrayItemsText();
      expect(displayed.length).toBe(7);

      // window.originalArray should be an array of numbers of length 7
      const originalArray = await bucketPage.getWindowVar('originalArray');
      expect(Array.isArray(originalArray)).toBe(true);
      expect(originalArray.length).toBe(7);
    });
  });

  test.describe('Bucket Sort transitions (S2 -> S3 -> S4 -> S5) and visual updates', () => {
    test('StartBucketSort creates buckets and updates state to Buckets Created (S2_BucketsCreated)', async () => {
      // Prepare array by setting from input
      await bucketPage.clickSetArray();

      // Set bucket count to 5 (default is 5 but set explicitly)
      await bucketPage.setBucketCount(5);
      const bucketCountText = await bucketPage.getBucketCountValueText();
      expect(bucketCountText).toBe('5');

      // Click Start Bucket Sort
      await bucketPage.clickStartSort();

      // Step description should indicate Step 1 - Created empty buckets
      const stepText = await bucketPage.getStepDescriptionText();
      expect(stepText).toContain('Step 1: Created empty buckets');

      // Buckets section should be visible
      const visible = await bucketPage.getBucketsVisible();
      expect(visible).toBe(true);

      // There should be 5 bucket elements shown
      const bucketCount = await bucketPage.getBucketsCount();
      expect(bucketCount).toBe(5);

      // Each bucket title should include a numeric range (e.g., "Bucket 1: 0.0-10.0")
      const bucketTitles = await page.$$eval('#bucketsContainer .bucket .bucket-title', nodes => nodes.map(n => n.textContent.trim()));
      expect(bucketTitles.length).toBe(5);
      // At least one title should contain 'Bucket 1'
      expect(bucketTitles[0]).toMatch(/Bucket\s*1/);
    });

    test('NextStep scatters elements into buckets (S3_ElementsScattered)', async () => {
      await bucketPage.clickSetArray();
      await bucketPage.clickStartSort();

      // Click Next Step to scatter elements into buckets
      await bucketPage.clickNextStep();

      const stepText = await bucketPage.getStepDescriptionText();
      expect(stepText).toContain('Step 2: Scattered elements into buckets');

      // Buckets should now contain items; collect items per bucket
      const bucketsItems = await bucketPage.getBucketsItemsText();
      // Concatenate all bucket items and ensure count equals original array length
      const flattened = bucketsItems.flat();
      const originalArray = await bucketPage.getWindowVar('originalArray');
      expect(flattened.length).toBe(originalArray.length);

      // Each displayed bucket item should be present in original array string forms
      const originalStrings = originalArray.map(n => String(n));
      flattened.forEach(item => expect(originalStrings).toContain(item));
    });

    test('NextStep sorts each bucket (S4_BucketsSorted) - verify bucket-level ordering', async () => {
      await bucketPage.clickSetArray();
      await bucketPage.clickStartSort();
      // scatter
      await bucketPage.clickNextStep();
      // sort buckets
      await bucketPage.clickNextStep();

      const stepText = await bucketPage.getStepDescriptionText();
      expect(stepText).toContain('Step 3: Sorted each bucket');

      // Verify each bucket's items are in non-decreasing order
      const bucketsItems = await bucketPage.getBucketsItemsText();
      for (const bucket of bucketsItems) {
        // convert to numbers
        const nums = bucket.map(s => Number(s));
        for (let i = 1; i < nums.length; i++) {
          expect(nums[i]).toBeGreaterThanOrEqual(nums[i - 1]);
        }
      }
    });

    test('NextStep concatenates buckets to form sorted array (S5_ArrayConcatenated) and final sorting', async () => {
      await bucketPage.clickSetArray();
      await bucketPage.clickStartSort();
      // scatter
      await bucketPage.clickNextStep();
      // sort buckets
      await bucketPage.clickNextStep();
      // gather
      await bucketPage.clickNextStep();

      const stepText = await bucketPage.getStepDescriptionText();
      expect(stepText).toContain('Step 4: Concatenated all buckets to form sorted array');

      // Sorted array section should be visible
      const sortedVisible = await bucketPage.getSortedArrayVisible();
      expect(sortedVisible).toBe(true);

      const sortedItems = await bucketPage.getSortedArrayItemsText();
      expect(sortedItems.length).toBeGreaterThan(0);

      // Validate that the final sorted array is non-decreasing
      const nums = sortedItems.map(s => Number(s));
      for (let i = 1; i < nums.length; i++) {
        expect(nums[i]).toBeGreaterThanOrEqual(nums[i - 1]);
      }

      // After one more Next Step it should mark sorting complete and reset currentStep to 0
      await bucketPage.clickNextStep();
      const completeText = await bucketPage.getStepDescriptionText();
      expect(completeText).toContain('Sorting complete!');

      // currentStep should be 0 in the window scope
      const currentStep = await bucketPage.getWindowVar('currentStep');
      expect(currentStep).toBe(0);

      // Now click Reset to transition back to Idle (S0_Idle)
      await bucketPage.clickReset();
      const resetStepText = await bucketPage.getStepDescriptionText();
      expect(resetStepText).toContain('Click "Start Bucket Sort" to begin the visualization.');

      // Buckets and sorted sections should be hidden again
      const bucketsVisible = await bucketPage.getBucketsVisible();
      const sortedSectionVisible = await bucketPage.getSortedArrayVisible();
      expect(bucketsVisible).toBe(false);
      expect(sortedSectionVisible).toBe(false);

      // window.buckets and window.sortedArray should be emptied
      const bucketsVar = await bucketPage.getWindowVar('buckets');
      const sortedVar = await bucketPage.getWindowVar('sortedArray');
      expect(Array.isArray(bucketsVar)).toBe(true);
      expect(bucketsVar.length).toBe(0);
      expect(Array.isArray(sortedVar)).toBe(true);
      expect(sortedVar.length).toBe(0);
    });
  });

  test.describe('AutoStep, pseudocode toggle, and edge cases', () => {
    test('ShowPseudocode toggles visibility and button text', async () => {
      // Initially pseudocode hidden
      let visible = await bucketPage.getPseudocodeVisible();
      expect(visible).toBe(false);

      // Click to show pseudocode
      await bucketPage.clickShowPseudocode();
      visible = await bucketPage.getPseudocodeVisible();
      expect(visible).toBe(true);

      // The button text should now say 'Hide Pseudocode'
      const btnText = await page.locator('#showPseudocode').innerText();
      expect(btnText).toContain('Hide Pseudocode');

      // Click again should hide
      await bucketPage.clickShowPseudocode();
      visible = await bucketPage.getPseudocodeVisible();
      expect(visible).toBe(false);
      const btnText2 = await page.locator('#showPseudocode').innerText();
      expect(btnText2).toContain('Show Pseudocode');
    });

    test('Edge case: minValue >= maxValue gets corrected by change handlers', async () => {
      // Set max to 10 and min to 10 and expect min to be adjusted to 9
      await bucketPage.setMaxValue(10);
      await bucketPage.setMinValue(10); // triggers change handler that should reduce min to max-1

      const minVal = await page.$eval('#minValue', el => el.value);
      const maxVal = await page.$eval('#maxValue', el => el.value);

      expect(Number(maxVal)).toBeGreaterThan(Number(minVal));
      expect(Number(minVal)).toBe(Number(maxVal) - 1);
    });

    test('Auto Step should progress through steps and surface runtime error (ReferenceError) due to implementation bug', async () => {
      // We'll capture page errors. The application contains an intentional bug:
      // inside toggleAutoStep() setInterval callback it references `autoStep` variable (not defined),
      // which should raise a ReferenceError when the interval attempts to set autoStep.textContent.
      // We must allow the error to happen naturally and assert that it occurs.

      // Prepare a small array so auto-stepping completes quickly. Set array input to 4 numbers.
      await bucketPage.setArrayInput('4,2,7,1');
      await bucketPage.clickSetArray();

      // Ensure bucketCount is small so steps are quick
      await bucketPage.setBucketCount(3);

      // Monitor page errors
      let capturedError = null;
      const errorPromise = page.waitForEvent('pageerror').then(e => {
        capturedError = e;
        return e;
      });

      // Click Auto Step - this will start the process and set up a setInterval
      await bucketPage.clickAutoStep();

      // Wait for an uncaught page error (the ReferenceError) with generous timeout
      const e = await errorPromise;
      expect(e).toBeTruthy();
      // The message should indicate autoStep is not defined or similar ReferenceError
      expect(e.message).toMatch(/autoStep is not defined|ReferenceError/);

      // Additionally, verify that the app attempted to progress: stepDescription should have changed from idle
      const stepText = await bucketPage.getStepDescriptionText();
      // After starting auto step, Step 1 text should have been set at least
      expect(stepText.length).toBeGreaterThan(0);
      expect(stepText).toMatch(/Step 1|Step 2|Step 3|Step 4|Sorting complete!/);
    }, 20000); // allow more time for auto steps to run and error to surface
  });
});