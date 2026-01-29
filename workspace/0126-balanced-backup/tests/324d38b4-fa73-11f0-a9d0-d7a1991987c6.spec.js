import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d38b4-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page object for the Merge Sort Visualization page.
 * Encapsulates common interactions and selectors.
 */
class MergeSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.containerSelector = '#arrayContainer';
    this.barSelector = '#arrayContainer .bar';
    this.buttonSelector = 'button[onclick="startMergeSort()"]';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the initial drawing of the array (entry action drawArray())
    await this.page.waitForSelector(this.barSelector);
  }

  getStartButton() {
    return this.page.locator(this.buttonSelector);
  }

  async clickStart() {
    await this.getStartButton().click();
  }

  async getBarCount() {
    return await this.page.locator(this.barSelector).count();
  }

  // Returns an array of inline style heights like ["190px", "135px", ...]
  async getBarHeights() {
    return await this.page.$$eval(this.barSelector, els => els.map(e => e.style.height));
  }

  async hasOnclickAttribute() {
    return await this.page.$eval(this.buttonSelector, el => el.getAttribute('onclick'));
  }
}

test.describe('Merge Sort Visualization FSM - Application ID 324d38b4-fa73-11f0-a9d0-d7a1991987c6', () => {
  // Containers for console and page errors to inspect in tests
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors (e.g., ReferenceError, TypeError surfaced to console)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught page errors (unhandled exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we will assert there were no uncaught page errors or console errors.
    // Individual tests may assert these explicitly as well; this is a safety net.
  });

  test('S0_Idle - Initial load draws the array and exposes Start Merge Sort button', async ({ page }) => {
    // This test validates the initial state (S0_Idle):
    // - drawArray() should have been called on load resulting in bars rendered
    // - The Start Merge Sort button should be present and contain the inline onclick handler
    const ui = new MergeSortPage(page);
    await ui.goto();

    // Verify button presence and its onclick attribute is exactly startMergeSort()
    const onclickAttr = await ui.hasOnclickAttribute();
    expect(onclickAttr).toBe('startMergeSort()', 'Button should have inline onclick="startMergeSort()"');

    const buttonText = await ui.getStartButton().innerText();
    expect(buttonText.trim()).toBe('Start Merge Sort');

    // Verify the initial array drawing: seven bars with expected heights based on the provided array
    const expectedInitial = [38, 27, 43, 3, 9, 82, 10].map(n => `${n * 5}px`);
    const barCount = await ui.getBarCount();
    expect(barCount).toBe(expectedInitial.length, 'Initial number of bars should match the initial array length');

    const heights = await ui.getBarHeights();
    expect(heights).toEqual(expectedInitial);

    // Ensure no uncaught runtime exceptions or console errors occurred during load
    expect(pageErrors.length, 'No uncaught page errors on initial load').toBe(0);
    expect(consoleErrors.length, 'No console.error messages on initial load').toBe(0);
  });

  test('S0 -> S1 transition on click: Start Merge Sort sorts the array and drawArray() is invoked', async ({ page }) => {
    // This test validates the transition from Idle to Sorting:
    // - Clicking the button triggers startMergeSort()
    // - The array becomes sorted and drawArray() is called to render the sorted array
    const ui = new MergeSortPage(page);
    await ui.goto();

    // Click the Start Merge Sort button to trigger the sorting transition
    await ui.clickStart();

    // Wait briefly to allow synchronous sorting & DOM updates to complete.
    // The implementation sorts synchronously and then calls drawArray().
    await page.waitForTimeout(100);

    // Expect heights correspond to the sorted array [3,9,10,27,38,43,82] scaled by 5
    const expectedSorted = [3, 9, 10, 27, 38, 43, 82].map(n => `${n * 5}px`);
    const heightsAfterSort = await ui.getBarHeights();
    expect(heightsAfterSort).toEqual(expectedSorted, 'Array should be rendered in sorted order after startMergeSort()');

    // Verify that the number of bars remains unchanged
    expect(await ui.getBarCount()).toBe(expectedSorted.length);

    // No page errors or console errors should have been produced by the click/sort operation
    expect(pageErrors.length, 'No uncaught page errors after sorting').toBe(0);
    expect(consoleErrors.length, 'No console.error messages after sorting').toBe(0);
  });

  test('S1 -> S0 transition: Clicking Start Merge Sort again calls drawArray() and remains stable', async ({ page }) => {
    // This test validates the transition from Sorting back to Idle:
    // - Clicking the same button when the array is already sorted should call drawArray() again
    // - No change in order but DOM should be re-drawn; no errors should occur
    const ui = new MergeSortPage(page);
    await ui.goto();

    // First click to sort
    await ui.clickStart();
    await page.waitForTimeout(100);

    const heightsAfterFirstSort = await ui.getBarHeights();
    const expectedSorted = [3, 9, 10, 27, 38, 43, 82].map(n => `${n * 5}px`);
    expect(heightsAfterFirstSort).toEqual(expectedSorted);

    // Click again to exercise the transition back to Idle (drawArray() on exit)
    await ui.clickStart();
    await page.waitForTimeout(100);

    const heightsAfterSecondClick = await ui.getBarHeights();
    // The heights should remain the same (stable sorted result), demonstrating drawArray was invoked without errors
    expect(heightsAfterSecondClick).toEqual(expectedSorted);

    // Ensure still no errors occurred
    expect(pageErrors.length, 'No uncaught page errors after second click').toBe(0);
    expect(consoleErrors.length, 'No console.error messages after second click').toBe(0);
  });

  test('Edge case: Rapid multiple clicks do not crash the page and result in a sorted array', async ({ page }) => {
    // This test exercises an edge case: clicking the Start button many times quickly
    // We assert no runtime errors occur and the final result is a correctly sorted array
    const ui = new MergeSortPage(page);
    await ui.goto();

    // Rapidly click the button multiple times
    for (let i = 0; i < 5; i++) {
      // Fire-and-forget clicks to simulate rapid user input
      await ui.clickStart();
    }

    // Wait to let synchronous sorts & redraws complete
    await page.waitForTimeout(200);

    // Final state should be sorted
    const expectedSorted = [3, 9, 10, 27, 38, 43, 82].map(n => `${n * 5}px`);
    const finalHeights = await ui.getBarHeights();
    expect(finalHeights).toEqual(expectedSorted, 'Final array after rapid clicks should be sorted');

    // Confirm no console or page errors were produced
    expect(pageErrors.length, 'No uncaught page errors after rapid clicks').toBe(0);
    expect(consoleErrors.length, 'No console.error messages after rapid clicks').toBe(0);
  });

  test('Observability: capture and assert any ReferenceError/SyntaxError/TypeError if they occur', async ({ page }) => {
    // This test intentionally collects runtime errors (if any) and asserts on them.
    // Per instructions we must observe console logs and page errors and let any ReferenceError/SyntaxError/TypeError happen naturally.
    // Because the provided implementation is syntactically correct and self-contained, we expect no such errors.
    const ui = new MergeSortPage(page);
    await ui.goto();

    // Perform a normal operation to potentially trigger runtime issues
    await ui.clickStart();
    await page.waitForTimeout(100);

    // Assert there were no uncaught exceptions (ReferenceError, TypeError, etc.) and no console.error messages
    expect(pageErrors.length, 'No uncaught page errors (ReferenceError/TypeError/etc.) should have occurred').toBe(0);
    expect(consoleErrors.length, 'No console.error messages should have been emitted').toBe(0);

    // If there were errors, provide detailed diagnostics via failing assertion messages above.
  });
});