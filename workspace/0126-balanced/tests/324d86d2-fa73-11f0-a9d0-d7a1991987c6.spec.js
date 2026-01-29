import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d86d2-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Binary Search Visualization page
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.searchButton = page.locator('#searchButton');
    this.arrayContainer = page.locator('#array');
    this.result = page.locator('#result');
    this.elementItems = page.locator('#array .element');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillArray(value) {
    await this.arrayInput.fill(value);
  }

  async fillTarget(value) {
    await this.targetInput.fill(String(value));
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async getArrayTexts() {
    return this.elementItems.allTextContents();
  }

  async elementHasClassAt(index, className) {
    const locator = this.elementItems.nth(index);
    return await locator.evaluate((el, cls) => el.classList.contains(cls), className);
  }

  async waitForResultText(expectedText, timeout = 10000) {
    await expect(this.result).toHaveText(expectedText, { timeout });
  }
}

test.describe('Binary Search Visualization - FSM state & transitions tests', () => {
  // Collect console messages and page errors for each test to validate runtime behavior
  test.beforeEach(async ({ page }) => {
    // nothing global here; individual tests will create BinarySearchPage and listeners
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected navigation state left behind
    // (No global teardown required beyond Playwright fixtures)
  });

  test('Initial state (S0_Idle): inputs, button, and empty visualization present', async ({ page }) => {
    // Validate initial UI rendered as described by the Idle state entry action (renderPage())
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const bs = new BinarySearchPage(page);
    await bs.goto();

    // Verify the presence of the expected components (evidence in S0_Idle)
    await expect(bs.arrayInput).toBeVisible();
    await expect(bs.targetInput).toBeVisible();
    await expect(bs.searchButton).toBeVisible();
    await expect(bs.arrayContainer).toBeVisible();
    await expect(bs.result).toBeVisible();

    // The array visualization should be empty at initial render
    await expect(bs.elementItems).toHaveCount(0);

    // No result text initially
    await expect(bs.result).toHaveText('', { timeout: 1000 });

    // Assert that there are no console errors or uncaught page errors on initial load
    expect(consoleErrors.length, `No console.error on load, found: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `No uncaught page errors on load`).toBe(0);
  });

  test('Transition S0_Idle -> S1_Searching then S1_Searching -> S2_Found (element found on first mid)', async ({ page }) => {
    // This test validates:
    // - Clicking the search button triggers displayArray and binarySearch (S0 -> S1)
    // - When the mid equals target, markAsFound is invoked and the element is highlighted (S1 -> S2)
    // - The result paragraph shows the found index
    const consoleErrors1 = [];
    const pageErrors1 = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const bs1 = new BinarySearchPage(page);
    await bs.goto();

    // Use a small array where the initial mid will hit the target immediately.
    // For array [1,2,3], mid = 1 -> target = 2 will be found immediately.
    await bs.fillArray('1,2,3');
    await bs.fillTarget(2);
    await bs.clickSearch();

    // After clicking, displayArray should have created 3 elements
    await expect(bs.elementItems).toHaveCount(3);

    // Verify the texts match the input array values
    const texts = await bs.getArrayTexts();
    expect(texts).toEqual(['1', '2', '3']);

    // The found element should be highlighted with the 'found' class.
    // For this input, index 1 should be found.
    // Because updateCurrentElement is called before the equality check, the element may have both 'current' and 'found'.
    // We assert that the found class is present.
    const foundAt1 = await bs.elementHasClassAt(1, 'found');
    expect(foundAt1).toBe(true);

    // The result paragraph should reflect the found index
    await bs.waitForResultText('Target found at index: 1', 3000);

    // Ensure no console errors or uncaught exceptions occurred during the interaction
    expect(consoleErrors.length, `No console.error during found search, found: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `No uncaught page errors during found search`).toBe(0);
  });

  test('Transition S1_Searching -> S3_NotFound (target not in array)', async ({ page }) => {
    // This test validates:
    // - Search proceeds through binarySearch iterations
    // - When target is not found, the result shows "Target not found" (S3_NotFound)
    // - No element should end up with the "found" class
    const consoleErrors2 = [];
    const pageErrors2 = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const bs2 = new BinarySearchPage(page);
    await bs.goto();

    // Use array where target 2 is not present
    await bs.fillArray('1,3,5');
    await bs.fillTarget(2);
    await bs.clickSearch();

    // Wait for the result to become "Target not found". This may take several iterations due to sleep(1000).
    await bs.waitForResultText('Target not found', 10000);

    // No element should have the 'found' class
    const count = await bs.elementItems.count();
    for (let i = 0; i < count; i++) {
      const hasFound = await bs.elementHasClassAt(i, 'found');
      expect(hasFound).toBe(false);
    }

    // Ensure no console errors or uncaught exceptions occurred during the not-found search
    expect(consoleErrors.length, `No console.error during not-found search`).toBe(0);
    expect(pageErrors.length, `No uncaught page errors during not-found search`).toBe(0);
  });

  test('Edge case: malformed array input (non-numeric entries) - display and search behavior', async ({ page }) => {
    // This test validates how the app handles non-numeric inputs in the array:
    // - displayArray should show "NaN" texts for each invalid number
    // - binarySearch should eventually return -1 and display "Target not found" without throwing exceptions
    const consoleErrors3 = [];
    const pageErrors3 = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const bs3 = new BinarySearchPage(page);
    await bs.goto();

    // Provide invalid numeric input
    await bs.fillArray('a,b,c');
    await bs.fillTarget(1); // arbitrary target
    await bs.clickSearch();

    // The displayed elements should show 'NaN' since parseInt('a') => NaN
    await expect(bs.elementItems).toHaveCount(3);
    const texts1 = await bs.getArrayTexts();
    // Depending on environment, NaN prints as 'NaN' when converted to text
    expect(texts).toEqual(['NaN', 'NaN', 'NaN']);

    // The search should finish and show "Target not found"
    await bs.waitForResultText('Target not found', 10000);

    // Ensure no runtime console errors or page errors occurred (the app should handle bad input gracefully)
    expect(consoleErrors.length, `No console.error for malformed array input`).toBe(0);
    expect(pageErrors.length, `No uncaught page errors for malformed array input`).toBe(0);
  });

  test('Visual feedback during search: current class updates before marking found', async ({ page }) => {
    // This test inspects the visual transitions during search:
    // - updateCurrentElement should apply 'current' class to the mid element
    // - If not found on first try, resetCurrentElement should remove 'current' before next iteration
    // We choose an input where multiple iterations happen to observe 'current' toggling.
    const consoleErrors4 = [];
    const pageErrors4 = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const bs4 = new BinarySearchPage(page);
    await bs.goto();

    // Choose array of 5 elements and a target that requires multiple iterations but not immediate first-hit.
    // For array [1,2,3,4,5], searching for 5:
    // mid0 = 2 -> current on index 2, not 5 -> reset after 1s
    // mid1 = 3 -> index 3, not -> reset
    // mid2 = 4 -> index 4 -> found
    await bs.fillArray('1,2,3,4,5');
    await bs.fillTarget(5);
    await bs.clickSearch();

    // Immediately after clicking, the first 'current' should appear at the initial mid (index 2).
    // Give a small allowance for microtask scheduling.
    const midIndex = 2;
    const currentApplied = await bs.elementHasClassAt(midIndex, 'current');
    // It's possible the search runs very quickly; but the code applies 'current' synchronously before comparisons.
    expect(currentApplied).toBe(true);

    // Wait until the final result shows 'Target found at index: 4' - allow ample timeout because of sleep delays
    await bs.waitForResultText('Target found at index: 4', 10000);

    // Final found element should have 'found' class
    const foundAt4 = await bs.elementHasClassAt(4, 'found');
    expect(foundAt4).toBe(true);

    // Intermediate elements should not retain 'current' class (they should have been reset)
    const count1 = await bs.elementItems.count1();
    for (let i = 0; i < count; i++) {
      if (i === 4) continue; // final found element may still have 'current' from update step
      const hasCurrent = await bs.elementHasClassAt(i, 'current');
      expect(hasCurrent).toBe(false);
    }

    // Ensure no runtime console errors or page errors occurred during the visualized search
    expect(consoleErrors.length, `No console.error during visual feedback test`).toBe(0);
    expect(pageErrors.length, `No uncaught page errors during visual feedback test`).toBe(0);
  });
});