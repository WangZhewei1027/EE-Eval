import { test, expect } from '@playwright/test';

// Test file for Application ID: f18251e0-d366-11f0-9b19-a558354ece3e
// URL: http://127.0.0.1:5500/workspace/batch-1207/html/f18251e0-d366-11f0-9b19-a558354ece3e.html
// Filename requirement satisfied by external runner: f18251e0-d366-11f0-9b19-a558354ece3e.spec.js

// Page Object Model for the visualizer page
class VisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/batch-1207/html/f18251e0-d366-11f0-9b19-a558354ece3e.html';
    // Selectors
    this.originalArray = '#originalArray';
    this.searchArray = '#searchArray';
    this.generateButton = "button[onclick='generateArray()']";
    this.startMergeSortButton = "button[onclick='startMergeSort()']";
    this.startBinarySearchButton = "button[onclick='startBinarySearch()']";
    this.mergeSortSteps = '#mergeSortSteps';
    this.binarySearchSteps = '#binarySearchSteps';
    this.searchValueInput = 'input#searchValue';
  }

  // Navigate to page
  async goto() {
    await this.page.goto(this.url);
  }

  // Click generate new array
  async clickGenerate() {
    await this.page.click(this.generateButton);
  }

  // Click start merge sort
  async clickStartMergeSort() {
    await this.page.click(this.startMergeSortButton);
  }

  // Click start binary search
  async clickStartBinarySearch() {
    await this.page.click(this.startBinarySearchButton);
  }

  // Set search input value (string or number)
  async setSearchValue(val) {
    await this.page.fill(this.searchValueInput, String(val));
  }

  // Read array elements from a container (originalArray or searchArray)
  async readArray(containerSelector) {
    await this.page.waitForSelector(containerSelector);
    const texts = await this.page.$$eval(`${containerSelector} .array-element`, els =>
      els.map(e => e.textContent.trim())
    );
    // Convert to integers where possible
    return texts.map(t => {
      const n = parseInt(t, 10);
      return Number.isNaN(n) ? t : n;
    });
  }

  // Wait for at least one merge sort step to appear
  async waitForMergeSortStep(timeout = 5000) {
    await this.page.waitForSelector(`${this.mergeSortSteps} .step`, { timeout });
  }

  // Wait for merge sort final result
  async waitForMergeSortResult(timeout = 120000) {
    await this.page.waitForSelector(`${this.mergeSortSteps} .result`, { timeout });
  }

  // Wait for binary search to produce a step with text (substring)
  async waitForBinarySearchStepContaining(substring, timeout = 60000) {
    await this.page.waitForFunction(
      (selector, substr) => {
        const container = document.querySelector(selector);
        if (!container) return false;
        return Array.from(container.querySelectorAll('.step')).some(el => el.textContent.includes(substr));
      },
      this.binarySearchSteps,
      substring,
      { timeout }
    );
  }

  // Read binary search steps as text array
  async readBinarySearchSteps() {
    await this.page.waitForSelector(this.binarySearchSteps);
    const texts = await this.page.$$eval(`${this.binarySearchSteps} .step`, els =>
      els.map(e => e.textContent.trim())
    );
    return texts;
  }
}

// Global timeout adjustments if needed per test will be done inside tests.

// Group tests for readability
test.describe('Divide and Conquer Algorithm Visualizer - FSM and DOM validation', () => {
  // Shared per-test state for console and page errors
  let consoleErrors;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Capture dialogs (alerts used by the app)
    page.on('dialog', async dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      // Dismiss to avoid blocking tests (do not alter app logic)
      await dialog.dismiss();
    });
  });

  test.afterEach(async () => {
    // Assert there were no unexpected console or page errors during the test.
    // This validates that no ReferenceError, TypeError, SyntaxError, or other runtime errors occurred.
    expect(consoleErrors, `Console errors were logged during the test: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `Uncaught page errors occurred during the test: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test('S0 Idle -> S1 ArrayGenerated: page load triggers generateArray and displays 10 elements', async ({ page }) => {
    // Validate the initial onload behavior (Idle entry action generateArray())
    const viz = new VisualizerPage(page);
    await viz.goto();

    // After window.onload -> generateArray should have populated #originalArray
    await page.waitForSelector(`${viz.originalArray} .array-element`, { timeout: 5000 });

    const original = await viz.readArray(viz.originalArray);

    // The FSM expects size = 10 in generateArray()
    expect(Array.isArray(original), 'originalArray should be an array').toBeTruthy();
    expect(original.length, 'originalArray should contain 10 elements after generateArray on load').toBe(10);

    // mergeSortSteps should be empty initially
    const mergeStepsCount = await page.$$eval(`${viz.mergeSortSteps} .step`, els => els.length);
    expect(mergeStepsCount, 'mergeSortSteps should be empty immediately after generateArray on load').toBe(0);
  });

  test('Generate New Array button regenerates the array (S1 ArrayGenerated)', async ({ page }) => {
    const viz = new VisualizerPage(page);
    await viz.goto();

    const before = await viz.readArray(viz.originalArray);
    await viz.clickGenerate();

    // After clicking generate, there should still be 10 elements
    await page.waitForSelector(`${viz.originalArray} .array-element`, { timeout: 3000 });
    const after = await viz.readArray(viz.originalArray);
    expect(after.length, 'After clicking Generate New Array, there should be 10 elements').toBe(10);

    // It is likely that a new random array will differ from the previous one. We assert that either the arrays differ,
    // or at least the DOM content changed (this allows for rare collision where random result matches previous).
    const same = JSON.stringify(before) === JSON.stringify(after);
    // We don't force failure if it's identical (randomness), but we assert the DOM was updated (innerHTML may differ).
    const beforeHTML = await page.evaluate(sel => document.querySelector(sel).innerHTML, viz.originalArray);
    await viz.clickGenerate(); // click again to force DOM update
    const afterHTML = await page.evaluate(sel => document.querySelector(sel).innerHTML, viz.originalArray);
    expect(beforeHTML === afterHTML, 'At least one Generate New Array click should update the DOM').toBe(false);
  });

  test('S1 -> S2 Merge Sort: startMergeSort creates steps and completes with Array sorted successfully! (S4)', async ({ page }) => {
    // This test may take longer due to intentional delays in the implementation; increase timeout.
    test.setTimeout(180000); // 3 minutes

    const viz = new VisualizerPage(page);
    await viz.goto();

    // Ensure array exists
    await page.waitForSelector(`${viz.originalArray} .array-element`, { timeout: 5000 });

    // Start merge sort and verify at least one step is produced (S2_MergeSortStarted)
    // and that eventually 'Array sorted successfully!' appears (S4_ArraySorted).
    const waitForStepPromise = page.waitForSelector(`${viz.mergeSortSteps} .step`, { timeout: 10000 });
    await viz.clickStartMergeSort();
    // Wait for an initial step indicating merge sort started
    await waitForStepPromise;

    // Now wait for final result which is appended at the end of the async algorithm
    await viz.waitForMergeSortResult(150000);

    // Verify the result element exists and contains expected text
    const resultText = await page.$eval(`${viz.mergeSortSteps} .result`, el => el.textContent.trim());
    expect(resultText).toContain('Array sorted successfully!');

    // Verify that the searchArray was populated with the sorted array
    const searchArr = await viz.readArray(viz.searchArray);
    expect(searchArr.length, 'searchArray should be populated after merge sort complete').toBe(10);

    // Verify the searchArray is sorted in non-decreasing order
    for (let i = 1; i < searchArr.length; i++) {
      expect(searchArr[i] >= searchArr[i - 1], `searchArray should be sorted: element ${i} >= element ${i - 1}`).toBeTruthy();
    }
  });

  test('S1 -> S3 Binary Search start without sorting should alert (edge case)', async ({ page }) => {
    const viz = new VisualizerPage(page);
    await viz.goto();

    // Ensure sortedArray is empty on load; clicking Start Binary Search should show alert 'Please sort an array first using Merge Sort'
    await viz.setSearchValue(50); // arbitrary value
    await viz.clickStartBinarySearch();

    // The page.on('dialog') in beforeEach captures alerts. Assert that an alert occurred with the expected message.
    // We expect exactly one dialog to have been captured for this action.
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const found = dialogs.some(d => d.message.includes('Please sort an array first using Merge Sort'));
    expect(found, `Expected alert asking to sort array first. Dialogs: ${JSON.stringify(dialogs)}`).toBeTruthy();

    // binarySearchSteps should remain empty
    const stepsCount = await page.$$eval(`${viz.binarySearchSteps} .step`, els => els.length);
    expect(stepsCount, 'binarySearchSteps should remain empty when attempting search before sort').toBe(0);
  });

  test('S3 -> S5 Binary Search finds an existing element (ElementFound)', async ({ page }) => {
    // Binary search uses timeouts for recursive steps; allow extended timeout
    test.setTimeout(120000);

    const viz = new VisualizerPage(page);
    await viz.goto();

    // Sort first to populate sortedArray and searchArray
    await viz.clickStartMergeSort();
    await viz.waitForMergeSortResult(150000);

    // Read the searchArray and pick a value known to be present (first element)
    const searchArr = await viz.readArray(viz.searchArray);
    expect(searchArr.length).toBeGreaterThan(0);
    const target = searchArr[0];

    // Set input to the target and start binary search
    await viz.setSearchValue(target);
    await viz.clickStartBinarySearch();

    // Wait for a step indicating the element was found
    await viz.waitForBinarySearchStepContaining(`Found ${target} at index`, 60000);

    // Assert final binary search steps contain the expected "Found" message
    const steps = await viz.readBinarySearchSteps();
    const foundMessage = steps.find(s => s.includes(`Found ${target} at index`));
    expect(foundMessage, `Expected a Found message in binary search steps. Steps: ${JSON.stringify(steps)}`).toBeTruthy();
  });

  test('S3 -> S6 Binary Search handles element not found (ElementNotFound)', async ({ page }) => {
    // Allow extended time due to setTimeout recursion
    test.setTimeout(120000);

    const viz = new VisualizerPage(page);
    await viz.goto();

    // Sort the array first
    await viz.clickStartMergeSort();
    await viz.waitForMergeSortResult(150000);

    // Choose a value highly unlikely to be present (outside 1-100 range used to generate numbers)
    const missingValue = 999;
    await viz.setSearchValue(missingValue);
    await viz.clickStartBinarySearch();

    // Wait for the "not found" step to appear
    await viz.waitForBinarySearchStepContaining(`Element ${missingValue} not found in the array`, 60000);

    const steps = await viz.readBinarySearchSteps();
    const notFoundMessage = steps.find(s => s.includes(`Element ${missingValue} not found in the array`));
    expect(notFoundMessage, `Expected a not-found message for ${missingValue}. Steps: ${JSON.stringify(steps)}`).toBeTruthy();
  });

  test('Binary Search validates numeric input: non-number shows alert (edge case)', async ({ page }) => {
    const viz = new VisualizerPage(page);
    await viz.goto();

    // Input an empty string to trigger isNaN check -> should alert 'Please enter a valid number to search'
    await viz.setSearchValue(''); // clear input
    await viz.clickStartBinarySearch();

    // We expect an alert asking to enter a valid number
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const hasInvalidNumberAlert = dialogs.some(d => d.message.includes('Please enter a valid number to search'));
    expect(hasInvalidNumberAlert, `Expected invalid number alert. Dialogs: ${JSON.stringify(dialogs)}`).toBeTruthy();
  });
});