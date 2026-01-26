import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3bb292-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object Model for the Bucket Sort demo page
class BucketSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputArray = page.locator('#inputArray');
    this.sortedArray = page.locator('#sortedArray');
    this.generateBtn = page.locator("button[onclick='generateArray()']");
    this.runBtn = page.locator("button[onclick='runBucketSort()']");
    this.bucketsContainer = page.locator('#bucketsContainer');
    this.sortingSteps = page.locator('#sortingSteps');
  }

  // Helper to parse a comma-separated list of numbers from an element's textContent
  async parseNumberList(locator) {
    const text = (await locator.textContent()) || '';
    // If the element contains 'Not sorted yet' or similar, return empty array
    if (!text.trim() || /not sorted yet/i.test(text) || /generating/i.test(text)) {
      return [];
    }
    return text
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(Number);
  }

  // Utility to check if an array is sorted (non-decreasing)
  isSorted(arr) {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i - 1] > arr[i]) return false;
    }
    return true;
  }
}

test.describe('Bucket Sort Demonstration - FSM validation and UI tests', () => {
  let page;
  let model;
  let pageErrors;
  let consoleMessages;

  // Set up a fresh page for each test and capture console and page errors.
  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    pageErrors = [];
    consoleMessages = [];

    // Capture runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // Store the error message for assertions later
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Capture console messages (info/warn/error)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL);

    model = new BucketSortPage(page);
  });

  test.afterEach(async () => {
    // Close the page to clean up context
    await page.close();
  });

  test('Initial State S0_Idle -> On load generateArray() should run and show generated array', async () => {
    // This test validates the initial "Idle" state entry action generateArray() executed on load.
    // The inputArray should have been populated with a random array of 20 numbers,
    // sortedArray should be reset to 'Not sorted yet', and visualization containers empty.

    // Validate inputArray text was updated from the placeholder text
    const inputText = await model.inputArray.textContent();
    expect(inputText).not.toBeNull();
    expect(inputText).not.toMatch(/Generating random array/i);

    // Parse the generated array and verify length is 20
    const parsed = await model.parseNumberList(model.inputArray);
    expect(Array.isArray(parsed)).toBeTruthy();
    expect(parsed.length).toBeGreaterThanOrEqual(1); // there should be numbers
    // The implementation uses arraySize = 20; assert at least 20 entries if comma-separated
    // Some whitespace issues could occur; ensure at least 20 numbers are present.
    expect(parsed.length).toBeGreaterThanOrEqual(20);

    // sortedArray should be the reset value
    const sortedText = (await model.sortedArray.textContent()) || '';
    expect(sortedText.trim()).toMatch(/Not sorted yet/i);

    // Visualization containers should be empty initially
    const bucketsHtml = await model.bucketsContainer.innerHTML();
    const stepsHtml = await model.sortingSteps.innerHTML();
    expect(bucketsHtml.trim()).toBe('');
    expect(stepsHtml.trim()).toBe('');

    // Assert there were no runtime page errors during initial load
    expect(pageErrors, `Expected no page errors on load, but saw: ${JSON.stringify(pageErrors)}`).toHaveLength(0);

    // Ensure no console errors of type 'error' were emitted on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors, `Expected no console.error messages on load, but saw: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
  });

  test('Transition S0_Idle -> S1_ArrayGenerated: clicking "Generate New Array" updates the input array and clears outputs', async () => {
    // This test validates the GenerateArray event and transition to "Array Generated" state.

    // Capture previous array value
    const beforeText = await model.inputArray.textContent();
    expect(beforeText).not.toBeNull();

    // Click generate button to trigger generateArray()
    await model.generateBtn.click();

    // After clicking expect inputArray to update to a new array string
    const afterText = await model.inputArray.textContent();
    expect(afterText).not.toBeNull();
    expect(afterText).not.toEqual(beforeText);

    // Parse and assert array length and content format
    const parsed = await model.parseNumberList(model.inputArray);
    expect(parsed.length).toBeGreaterThanOrEqual(20);

    // sortedArray should be reset to 'Not sorted yet' after generating a new array
    const sortedText = (await model.sortedArray.textContent()) || '';
    expect(sortedText.trim()).toMatch(/Not sorted yet/i);

    // Buckets and steps remain cleared after generation
    expect((await model.bucketsContainer.innerHTML()).trim()).toBe('');
    expect((await model.sortingSteps.innerHTML()).trim()).toBe('');

    // Ensure no runtime errors occurred during generation
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toHaveLength(0);
  });

  test('Transition S1_ArrayGenerated -> S2_Sorting and S3_Sorted: clicking "Run Bucket Sort" sorts the array and shows visualization', async () => {
    // This test validates running the bucket sort: sortedArray should display a sorted list,
    // visualization containers should show buckets and steps, and the sorted output should be correctly ordered.

    // Ensure we have a fresh array
    await model.generateBtn.click();
    const original = await model.parseNumberList(model.inputArray);
    expect(original.length).toBeGreaterThanOrEqual(20);

    // Click Run Bucket Sort
    await model.runBtn.click();

    // After running, sortedArray should contain comma-separated numbers
    const sortedText = (await model.sortedArray.textContent()) || '';
    expect(sortedText.trim()).not.toMatch(/Not sorted yet/i);

    // Parse sorted array and validate length and sorting order
    const sortedParsed = (sortedText.length ? sortedText.split(',').map(s => Number(s.trim())).filter(n => !Number.isNaN(n)) : []);
    expect(sortedParsed.length).toBe(original.length);

    // Check sortedness (non-decreasing)
    const isSorted = model.isSorted(sortedParsed);
    expect(isSorted).toBeTruthy();

    // Validate multiset equality: sortedParsed should contain same elements as original (possibly reordered)
    const freq = (arr) => {
      const map = new Map();
      for (const n of arr) map.set(n, (map.get(n) || 0) + 1);
      return map;
    };
    const fOriginal = freq(original);
    const fSorted = freq(sortedParsed);
    expect(fOriginal.size).toBeGreaterThan(0);
    expect(fOriginal.size).toEqual(fSorted.size);
    for (const [k, v] of fOriginal) {
      expect(fSorted.get(k)).toBe(v);
    }

    // Visualization should have at least one bucket element and at least one step description
    const bucketCount = await model.bucketsContainer.locator('.bucket').count();
    expect(bucketCount).toBeGreaterThanOrEqual(1);

    const stepCount = await model.sortingSteps.locator('p').count();
    expect(stepCount).toBeGreaterThanOrEqual(1);

    // Ensure no runtime page errors occurred during sorting
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toHaveLength(0);
  });

  test('Running RunBucketSort again should re-run visualization and preserve sorted result (S2 -> S3 transition behavior)', async () => {
    // This test validates running the sort twice: ensures second run does not break the UI,
    // sorted output remains sorted and steps are appended / re-created.

    // Generate a fresh array and run sort once
    await model.generateBtn.click();
    const original = await model.parseNumberList(model.inputArray);
    expect(original.length).toBeGreaterThanOrEqual(20);

    await model.runBtn.click();

    const afterFirstRunSorted = (await model.sortedArray.textContent()) || '';
    const stepsAfterFirst = await model.sortingSteps.locator('p').count();
    expect(afterFirstRunSorted.trim()).not.toMatch(/Not sorted yet/i);
    expect(stepsAfterFirst).toBeGreaterThanOrEqual(1);

    // Run the sort again (simulate S2 -> S3 RunBucketSort)
    await model.runBtn.click();

    const afterSecondRunSorted = (await model.sortedArray.textContent()) || '';
    const stepsAfterSecond = await model.sortingSteps.locator('p').count();

    // Sorted array should remain a sorted list and likely match previous sorted output
    expect(afterSecondRunSorted.trim()).toEqual(afterFirstRunSorted.trim());

    // Sorting steps should be repopulated (count could be same or greater depending on implementation),
    // but there should still be at least 1 step description after second run.
    expect(stepsAfterSecond).toBeGreaterThanOrEqual(1);

    // Verify no runtime errors during repeated sort
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toHaveLength(0);
  });

  test('UI elements and evidence: buttons have onclick attributes and key DOM ids exist', async () => {
    // This test verifies evidence strings expected by the FSM are present in the DOM:
    // - Buttons have onclick attributes referencing generateArray() and runBucketSort()
    // - inputArray and sortedArray elements exist and have expected ids

    // Validate generate button has onclick attribute
    const genHandle = await page.$("button[onclick='generateArray()']");
    expect(genHandle).not.toBeNull();

    // Validate run button has onclick attribute
    const runHandle = await page.$("button[onclick='runBucketSort()']");
    expect(runHandle).not.toBeNull();

    // Validate inputArray and sortedArray exist and contain the expected initial markers or content
    const inputExists = await page.$('#inputArray');
    const sortedExists = await page.$('#sortedArray');
    expect(inputExists).not.toBeNull();
    expect(sortedExists).not.toBeNull();

    // The initial HTML had evidence text "Generating random array..." which is immediately replaced,
    // but the DOM id remains. Ensure IDs are present and accessible.
    const inputId = await (await inputExists.getAttribute('id'));
    const sortedId = await (await sortedExists.getAttribute('id'));
    expect(inputId).toBe('inputArray');
    expect(sortedId).toBe('sortedArray');

    // No runtime errors observed
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toHaveLength(0);
  });

  test('Edge case observation: ensure bucketSort does not throw when array has values across range (behavioral smoke test)', async () => {
    // We cannot modify page internals or inject variables per instructions.
    // This is a smoke test to run the existing functionality and ensure no exceptions are thrown
    // for typical random arrays created by the page (covers some edge value distributions as generated).

    // Trigger multiple generate+sort cycles quickly to exercise code paths (distribution, sorting)
    for (let i = 0; i < 3; i++) {
      await model.generateBtn.click();
      // Immediately run the sort after generation
      await model.runBtn.click();

      // After each run, ensure sortedArray is present and sorted
      const sortedParsed = await model.parseNumberList(model.sortedArray);
      if (sortedParsed.length > 0) {
        expect(model.isSorted(sortedParsed)).toBeTruthy();
      } else {
        // If sortedArray is empty string for some reason, that's unexpected
        expect(sortedParsed.length).toBeGreaterThan(0);
      }
    }

    // Confirm no page errors across these repeated operations
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toHaveLength(0);
  });
});