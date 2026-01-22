import { test, expect } from '@playwright/test';

// Test file: 17636642-d5c1-11f0-938c-19d14b60ef51.spec.js
// Tests for Selection Sort Demo interactive application
// URL: http://127.0.0.1:5500/workspace/batch-1207/html/17636642-d5c1-11f0-938c-19d14b60ef51.html

// Page Object for the Selection Sort page
class SelectionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/batch-1207/html/17636642-d5c1-11f0-938c-19d14b60ef51.html';
    this.arraySelector = '#array';
    this.barSelector = '#array .bar';
    this.buttonSelector = "button[onclick='selectionSort()']";
    // expected initial array from the page script
    this.initialArray = [5, 3, 6, 2, 10, 8, 1, 4, 7, 9];
    this.sortedArray = [...this.initialArray].sort((a, b) => a - b);
    this.scale = 10; // height scale used in the page script
  }

  async goto() {
    await this.page.goto(this.url);
    // wait for the array container to be present
    await this.page.waitForSelector(this.arraySelector);
  }

  async getBars() {
    return this.page.$$(this.barSelector);
  }

  // Returns numeric values deduced from bar heights (reverse of height = value * scale)
  async getValuesFromBars() {
    const heights = await this.page.$$eval(this.barSelector, (bars) =>
      bars.map((b) => {
        // the implementation sets style.height = value * 10 + 'px'
        // getComputedStyle to get the rendered height value in px
        const h = window.getComputedStyle(b).height;
        return h;
      })
    );
    // Convert '50px' => numeric 50 / scale => original value
    return heights.map((h) => Math.round(parseFloat(h) / 10));
  }

  async getRawHeights() {
    return this.page.$$eval(this.barSelector, (bars) =>
      bars.map((b) => window.getComputedStyle(b).height)
    );
  }

  async clickSortButton() {
    await this.page.click(this.buttonSelector);
  }

  async hasSortButton() {
    return (await this.page.$(this.buttonSelector)) !== null;
  }

  async getButtonOnclickAttribute() {
    const btn = await this.page.$(this.buttonSelector);
    if (!btn) return null;
    return btn.getAttribute('onclick');
  }
}

// Group tests for the Selection Sort demo
test.describe('Selection Sort Demo - FSM and DOM validation', () => {
  // Basic smoke test: page loads, initial state (S0_Idle) is correct
  test('S0_Idle: initial display shows the original array and no page errors', async ({ page }) => {
    // Capture console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const p = new SelectionSortPage(page);
    await p.goto();

    // Verify the Sort Array button exists and has the expected onclick evidence
    expect(await p.hasSortButton()).toBe(true);
    const onclick = await p.getButtonOnclickAttribute();
    expect(onclick).toBe('selectionSort()');

    // Verify initial array DOM (S0 entry action: displayArray(array))
    const values = await p.getValuesFromBars();
    expect(values.length).toBe(p.initialArray.length);
    expect(values).toEqual(p.initialArray);

    // Verify the number of bars equals the array length
    const bars = await p.getBars();
    expect(bars.length).toBe(p.initialArray.length);

    // Ensure no runtime page errors were emitted during load
    expect(pageErrors.length).toBe(0);

    // Optionally inspect console - there should be no errors
    const errorConsole = consoleMessages.find((m) => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  // Transition tests: S0_Idle -> S1_Sorting (click) -> S2_Display_Sorted (final display)
  test('S0->S1->S2: clicking Sort Array sorts the DOM representation to ascending order', async ({ page }) => {
    // Capture console messages and page errors during the interaction
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const p = new SelectionSortPage(page);
    await p.goto();

    // Confirm initial first bar corresponds to value 5 (sanity)
    const initialHeights = await p.getRawHeights();
    expect(initialHeights[0]).toBeDefined();
    const initialValues = await p.getValuesFromBars();
    expect(initialValues[0]).toBe(5);

    // Click the Sort Array button to trigger selectionSort() (S1 entry action)
    await p.clickSortButton();

    // selectionSort is synchronous; waitForFunction to ensure the DOM reflects the sorted array (S2)
    await page.waitForFunction(
      (selector, scale, expected) => {
        const bars = Array.from(document.querySelectorAll(selector));
        if (bars.length !== expected.length) return false;
        const values = bars.map((b) => Math.round(parseFloat(window.getComputedStyle(b).height) / scale));
        return values.every((v, i) => v === expected[i]);
      },
      p.barSelector,
      p.scale,
      p.sortedArray,
      { timeout: 2000 }
    );

    // After sorting, verify final DOM matches the sorted array (S2 entry action: displayArray(sortedArray))
    const finalValues = await p.getValuesFromBars();
    expect(finalValues).toEqual(p.sortedArray);

    // Verify all bars are present and heights correspond
    const bars = await p.getBars();
    expect(bars.length).toBe(p.sortedArray.length);

    // Verify no page runtime errors occurred
    expect(pageErrors.length).toBe(0);

    // No console error messages expected
    const anyConsoleError = consoleMessages.find((m) => m.type === 'error');
    expect(anyConsoleError).toBeUndefined();
  });

  // Edge case: clicking the Sort Array button multiple times - idempotency / stability check
  test('Edge case: repeated clicks do not cause errors and keep the array sorted', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const p = new SelectionSortPage(page);
    await p.goto();

    // Click the button once and wait for sorted
    await p.clickSortButton();
    await page.waitForFunction(
      (selector, scale, expected) => {
        const bars = Array.from(document.querySelectorAll(selector));
        if (bars.length !== expected.length) return false;
        const values = bars.map((b) => Math.round(parseFloat(window.getComputedStyle(b).height) / scale));
        return values.every((v, i) => v === expected[i]);
      },
      p.barSelector,
      p.scale,
      p.sortedArray,
      { timeout: 2000 }
    );

    // Click again rapidly multiple times
    await Promise.all([
      p.clickSortButton(),
      p.clickSortButton(),
      p.clickSortButton()
    ]);

    // After repeated clicks, final state should still be sorted
    const finalValues = await p.getValuesFromBars();
    expect(finalValues).toEqual(p.sortedArray);

    // No runtime errors produced by repeated interactions
    expect(pageErrors.length).toBe(0);
  });

  // Error scenario test: interacting with a non-existent element should raise an error on the test side
  test('Error scenario: clicking a non-existent selector should throw', async ({ page }) => {
    const p = new SelectionSortPage(page);
    await p.goto();

    // Attempt to click a selector we know does not exist and assert that Playwright throws
    const missingSelector = 'button#this-does-not-exist';
    // We expect the click attempt to reject/throw due to timeout/no element
    let caught = false;
    try {
      await page.click(missingSelector, { timeout: 1000 });
    } catch (err) {
      caught = true;
      // Ensure error message mentions the selector or that element is not found
      expect(String(err)).toContain(missingSelector);
    }
    expect(caught).toBe(true);
  });

  // Validate that the page's entry and exit actions (displayArray on load and after sorting) are observable via DOM differences
  test('Validate entry/exit actions: displayArray called on load and after sorting (observable via DOM)', async ({ page }) => {
    const p = new SelectionSortPage(page);

    await p.goto();

    // On load (S0 entry action: displayArray(array)), the DOM should reflect the initial array
    const initialValues = await p.getValuesFromBars();
    expect(initialValues).toEqual(p.initialArray);

    // Now click to sort (S1 entry action triggers selectionSort), and final S2 should display sorted array
    // To observe that the DOM changed as part of exit action, capture the first bar's height before and after
    const beforeFirst = (await p.getRawHeights())[0];
    await p.clickSortButton();

    // Wait for the final sorted array to be displayed
    await page.waitForFunction(
      (selector, scale, expectedFirst) => {
        const bars = document.querySelectorAll(selector);
        if (!bars || bars.length === 0) return false;
        const first = Math.round(parseFloat(window.getComputedStyle(bars[0]).height) / scale);
        return first === expectedFirst;
      },
      p.barSelector,
      p.scale,
      p.sortedArray[0],
      { timeout: 2000 }
    );

    const afterFirst = (await p.getRawHeights())[0];
    expect(beforeFirst).not.toBe(afterFirst);
    // Validate that after display the first value equals the smallest value (1)
    const finalValues = await p.getValuesFromBars();
    expect(finalValues[0]).toBe(1);
    expect(finalValues).toEqual(p.sortedArray);
  });
});