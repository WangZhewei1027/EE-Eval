import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b8b83-fa74-11f0-a1b6-4b9b8151441a.html';

class MergeSortPage {
  /**
   * Page object for the Merge Sort Visualization app
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#arrayInput');
    this.sortButton = page.locator("button[onclick='startSorting()']");
    this.randomButton = page.locator("button[onclick='generateRandom()']");
    this.originalArray = page.locator('#originalArray');
    this.steps = page.locator('#steps');
    this.sortedArray = page.locator('#sortedArray');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getInputValue() {
    return (await this.input.inputValue()).trim();
  }

  async fillInput(value) {
    await this.input.fill(value);
  }

  async clickSort() {
    await this.sortButton.click();
  }

  async clickRandom() {
    await this.randomButton.click();
  }

  async getArrayItemsText(containerLocator) {
    // returns array of texts for .array-item children inside the provided container locator
    const items = containerLocator.locator('.array-item');
    const count = await items.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await items.nth(i).innerText()).trim());
    }
    return texts;
  }

  async getStepsLines() {
    // returns array of step lines (innerText of children of #steps)
    const children = this.steps.locator('div');
    const count = await children.count();
    const lines = [];
    for (let i = 0; i < count; i++) {
      lines.push((await children.nth(i).innerText()).trim());
    }
    return lines;
  }
}

test.describe('Merge Sort Visualization - FSM tests', () => {
  let page;
  let app;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors
    page.on('console', msg => {
      // Record type and text for diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    app = new MergeSortPage(page);
    await app.goto();

    // Wait until the input has been updated by generateRandom() invoked on load.
    // generateRandom creates a comma separated list of numbers; wait until we see a digit in the input.
    await page.waitForFunction(() => {
      const el = document.getElementById('arrayInput');
      return !!(el && el.value && /\d/.test(el.value));
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial Idle State (S0_Idle) - generateRandom() invoked on load', async () => {
    // This test validates the S0 initial state entry action generateRandom() ran on window.onload.
    // It asserts the input contains a comma-separated numeric list of length between 5 and 14 (inclusive)
    // and that the app has not yet rendered original/steps/sorted arrays.
    const inputVal = await app.getInputValue();

    // Ensure input is non-empty and appears numeric
    expect(inputVal).toBeTruthy();
    // Validate pattern: numbers separated by commas (allow spaces)
    expect(/^\s*\d+(\s*,\s*\d+\s*)*$/.test(inputVal)).toBeTruthy();

    // Parse numbers
    const numbers = inputVal.split(',').map(s => parseInt(s.trim(), 10));
    expect(numbers.length).toBeGreaterThanOrEqual(5);
    expect(numbers.length).toBeLessThanOrEqual(14);
    for (const n of numbers) {
      expect(Number.isInteger(n)).toBeTruthy();
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(100);
    }

    // Ensure originalArray, steps, sortedArray are empty on load (no sorting yet)
    const originalChildren = await app.originalArray.locator('.array-item').count();
    const stepChildren = await app.steps.locator('div').count();
    const sortedChildren = await app.sortedArray.locator('.array-item').count();

    expect(originalChildren).toBe(0);
    expect(stepChildren).toBe(0);
    expect(sortedChildren).toBe(0);

    // Assert no unexpected page errors occurred during load
    expect(pageErrors.length).toBe(0);

    // Also assert there are no console messages of 'error' type
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Random Array event (S0_Idle -> S0_Idle) - clicking Random Array updates the input', async () => {
    // Validate clicking the Random Array button triggers generateRandom() and updates the input's value.
    const before = await app.getInputValue();
    await app.clickRandom();

    // Wait for the input value to change from previous
    await page.waitForFunction(prev => {
      const el = document.getElementById('arrayInput');
      return !!el && el.value.trim() !== prev;
    }, before);

    const after = await app.getInputValue();
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);

    // Validate the new value is a numeric comma-separated list with 5-14 numbers
    expect(/^\s*\d+(\s*,\s*\d+\s*)*$/.test(after)).toBeTruthy();
    const nums = after.split(',').map(s => parseInt(s.trim(), 10));
    expect(nums.length).toBeGreaterThanOrEqual(5);
    expect(nums.length).toBeLessThanOrEqual(14);

    // Ensure no uncaught exceptions or console errors happened as a result
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Sort event (S0_Idle -> S1_Sorting) - displays original, steps and sorted array', async () => {
    // Validate that clicking Sort triggers startSorting(), shows the original array,
    // displays merge sort steps and presents the final sorted array with "sorted" class.
    const testArray = '5,3,8,4,2,7,1,10';
    await app.fillInput(testArray);

    // Click Sort to start sorting
    await app.clickSort();

    // Wait for original array to be populated
    await page.waitForFunction(() => {
      return document.querySelectorAll('#originalArray .array-item').length > 0;
    });

    const originalTexts = await app.getArrayItemsText(app.originalArray);
    const expectedOriginal = testArray.split(',').map(s => s.trim());
    expect(originalTexts).toEqual(expectedOriginal);

    // Steps should contain at least one Splitting and one Merged line
    const steps = await app.getStepsLines();
    expect(steps.length).toBeGreaterThan(0);
    const hasSplitting = steps.some(line => /Splitting:/.test(line) || /Splitting/.test(line));
    const hasMerged = steps.some(line => /Merged:/.test(line) || /Merged/.test(line));
    const hasMerging = steps.some(line => /Merging:/.test(line) || /Merging/.test(line));
    expect(hasSplitting).toBeTruthy();
    expect(hasMerging).toBeTruthy();
    expect(hasMerged).toBeTruthy();

    // Sorted array should be present and contain sorted numbers
    const sortedTexts = await app.getArrayItemsText(app.sortedArray);
    expect(sortedTexts.length).toBe(expectedOriginal.length);

    // Convert to numbers and ensure sorted ascending
    const sortedNums = sortedTexts.map(s => parseInt(s, 10));
    for (let i = 1; i < sortedNums.length; i++) {
      expect(sortedNums[i]).toBeGreaterThanOrEqual(sortedNums[i - 1]);
    }

    // Ensure each sorted item has class 'sorted'
    const firstSortedItemClass = await app.sortedArray.locator('.array-item').first().getAttribute('class');
    expect(firstSortedItemClass).toContain('sorted');

    // Ensure steps and displays were updated without uncaught exceptions
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Edge case: invalid input values produce NaN entries but do not crash (error scenario)', async () => {
    // This test fills the input with non-numeric entries, triggers sorting,
    // and asserts the app produces NaN displays rather than throwing unhandled exceptions.
    await app.fillInput('a,b,c');

    await app.clickSort();

    // Wait for display to update
    await page.waitForFunction(() => {
      return document.querySelectorAll('#originalArray .array-item').length === 3;
    });

    const originalTexts = await app.getArrayItemsText(app.originalArray);
    // parseInt('a') => NaN, the display uses String(NaN) => 'NaN'
    expect(originalTexts).toEqual(['NaN', 'NaN', 'NaN']);

    // Steps should exist and contain NaN in some lines (Splitting/Merging)
    const steps = await app.getStepsLines();
    expect(steps.length).toBeGreaterThan(0);
    const containsNaNInSteps = steps.some(line => /NaN/.test(line));
    expect(containsNaNInSteps).toBeTruthy();

    // Sorted array should also render NaN items
    const sortedTexts = await app.getArrayItemsText(app.sortedArray);
    expect(sortedTexts.length).toBe(3);
    expect(sortedTexts.every(t => t === 'NaN')).toBeTruthy();

    // Assert there are no uncaught exceptions (pageerror) despite invalid input
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Repeated sorting resets previous results and updates DOM appropriately', async () => {
    // Perform first sort
    await app.fillInput('4,1,3');
    await app.clickSort();

    await page.waitForFunction(() => {
      return document.querySelectorAll('#sortedArray .array-item').length === 3;
    });

    const firstSorted = await app.getArrayItemsText(app.sortedArray);
    expect(firstSorted).toEqual(['1', '3', '4']);

    // Now change input and sort again
    await app.fillInput('10,2,9,5');
    await app.clickSort();

    // Wait for new sorted array
    await page.waitForFunction(() => {
      return document.querySelectorAll('#sortedArray .array-item').length === 4;
    });

    const secondOriginal = await app.getArrayItemsText(app.originalArray);
    expect(secondOriginal).toEqual(['10', '2', '9', '5']);

    const secondSorted = await app.getArrayItemsText(app.sortedArray);
    // ensure length matches and is sorted ascending
    expect(secondSorted.length).toBe(4);
    const secondNums = secondSorted.map(s => parseInt(s, 10));
    for (let i = 1; i < secondNums.length; i++) {
      expect(secondNums[i]).toBeGreaterThanOrEqual(secondNums[i - 1]);
    }

    // Steps should be refreshed (at least one merging/merged line should be present)
    const steps = await app.getStepsLines();
    expect(steps.length).toBeGreaterThan(0);
    const hasMerged = steps.some(line => /Merged:/.test(line));
    expect(hasMerged).toBeTruthy();

    // No uncaught exceptions
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });
});