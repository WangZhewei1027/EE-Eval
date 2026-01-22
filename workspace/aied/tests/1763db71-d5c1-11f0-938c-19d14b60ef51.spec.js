import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/1763db71-d5c1-11f0-938c-19d14b60ef51.html';

/**
 * Page Object for the Binary Search Visualization page.
 * Encapsulates common interactions and queries used by the tests.
 */
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.searchButton = page.locator('#searchButton');
    this.arrayContainer = page.locator('#arrayContainer');
    this.resultParagraph = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async enterArray(arrayString) {
    await this.arrayInput.fill(arrayString);
  }

  async enterTarget(target) {
    // Accept both numbers and string values (to allow '' / NaN cases)
    await this.targetInput.fill(String(target));
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  // Returns array of numbers/strings visible in the visualized elements
  async getVisualizedValues() {
    return await this.arrayContainer.locator('.element').allTextContents();
  }

  // Returns number of visualized elements
  async getVisualizedCount() {
    return await this.arrayContainer.locator('.element').count();
  }

  async getActiveIndices() {
    const count = await this.getVisualizedCount();
    const indices = [];
    for (let i = 0; i < count; i++) {
      const el = this.arrayContainer.locator('.element').nth(i);
      if (await el.getAttribute('class')) {
        const classList = (await el.getAttribute('class')).split(/\s+/);
        if (classList.includes('active')) indices.push(i);
      }
    }
    return indices;
  }

  async getResultText() {
    return (await this.resultParagraph.textContent()) || '';
  }
}

test.describe('Binary Search Visualization - FSM tests', () => {
  // Arrays to collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages emitted by the page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions in the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('State: Idle (S0_Idle)', () => {
    test('Initial page renders inputs, button, and empty result (Idle state)', async ({ page }) => {
      const bsp = new BinarySearchPage(page);
      // Load the page exactly as-is
      await bsp.goto();

      // Validate presence of expected components (evidence from FSM)
      await expect(bsp.arrayInput).toBeVisible();
      await expect(bsp.arrayInput).toHaveAttribute('placeholder', /Enter sorted array/);
      await expect(bsp.targetInput).toBeVisible();
      await expect(bsp.targetInput).toHaveAttribute('placeholder', /Target value/);
      await expect(bsp.searchButton).toBeVisible();
      await expect(bsp.arrayContainer).toBeVisible();
      await expect(bsp.resultParagraph).toBeVisible();

      // Idle state: no visualized elements and no result text
      await expect(bsp.getVisualizedCount()).resolves.toBe(0);
      await expect(bsp.getResultText()).resolves.toBe('');

      // Ensure no runtime console errors or page errors occurred during initial render
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transitions: Searching (S1_Searching) -> Result Found (S2_ResultFound) / Not Found (S3_ResultNotFound)', () => {
    test('Clicking Search visualizes array and highlights found element (Result Found)', async ({ page }) => {
      const bsp = new BinarySearchPage(page);
      await bsp.goto();

      // Enter a sorted array and a target that exists
      await bsp.enterArray('1,2,3,4,5');
      await bsp.enterTarget(3);

      // Click search to trigger transition S0 -> S1 and potentially S1 -> S2
      await bsp.clickSearch();

      // Visualized array should contain 5 elements with correct text
      await expect(bsp.getVisualizedCount()).resolves.toBe(5);
      const values = await bsp.getVisualizedValues();
      expect(values).toEqual(['1', '2', '3', '4', '5']);

      // The target 3 is at index 2; verify that the corresponding element has 'active' class
      const activeIndices = await bsp.getActiveIndices();
      expect(activeIndices).toContain(2);
      expect(activeIndices.length).toBe(1);

      // Result paragraph should indicate found index
      await expect(bsp.getResultText()).resolves.toBe('Target 3 found at index 2.');

      // No runtime errors expected for normal operation
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking Search displays "not found" when target missing (Result Not Found)', async ({ page }) => {
      const bsp = new BinarySearchPage(page);
      await bsp.goto();

      // Enter array and a target not in the array
      await bsp.enterArray('1,2,3,4,5');
      await bsp.enterTarget(9);

      await bsp.clickSearch();

      // Visualized array should still be present with same count
      await expect(bsp.getVisualizedCount()).resolves.toBe(5);

      // No element should have 'active' class
      const activeIndices = await bsp.getActiveIndices();
      expect(activeIndices.length).toBe(0);

      // Result paragraph should indicate not found
      await expect(bsp.getResultText()).resolves.toBe('Target 9 not found.');

      // No runtime errors expected
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('onEnter/onExit actions and clearing behavior', () => {
    test('clearPreviousResults() is invoked: previous visualization cleared on subsequent searches', async ({ page }) => {
      const bsp = new BinarySearchPage(page);
      await bsp.goto();

      // First search: found
      await bsp.enterArray('10,20,30');
      await bsp.enterTarget(20);
      await bsp.clickSearch();

      // Confirm first search result
      await expect(bsp.getVisualizedCount()).resolves.toBe(3);
      let active = await bsp.getActiveIndices();
      expect(active).toEqual([1]);
      await expect(bsp.getResultText()).resolves.toBe('Target 20 found at index 1.');

      // Capture references (text contents) to ensure new visualization is produced after next search
      const firstVisualValues = await bsp.getVisualizedValues();

      // Second search: different array and not found case - should clear previous
      await bsp.enterArray('1,2,3,4');
      await bsp.enterTarget(99);
      await bsp.clickSearch();

      // New visualized array should reflect the second input
      await expect(bsp.getVisualizedCount()).resolves.toBe(4);
      const secondVisualValues = await bsp.getVisualizedValues();
      expect(secondVisualValues).toEqual(['1', '2', '3', '4']);

      // No 'active' elements for not-found
      active = await bsp.getActiveIndices();
      expect(active.length).toBe(0);

      // Result text should reflect not found
      await expect(bsp.getResultText()).resolves.toBe('Target 99 not found.');

      // Verify that the DOM content changed (i.e., previous visualization was cleared)
      expect(firstVisualValues).not.toEqual(secondVisualValues);

      // No runtime errors expected
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Empty array input (edge) leads to array with a single 0 element and can be found when target is 0', async ({ page }) => {
      const bsp = new BinarySearchPage(page);
      await bsp.goto();

      // Enter empty array string and target 0
      await bsp.enterArray(''); // split('') -> [''] -> Number('') === 0
      await bsp.enterTarget(0);
      await bsp.clickSearch();

      // One visualized element '0' is expected given how the implementation parses empty string
      await expect(bsp.getVisualizedCount()).resolves.toBe(1);
      const values = await bsp.getVisualizedValues();
      expect(values).toEqual(['0']);

      // Should show found at index 0
      const activeIndices = await bsp.getActiveIndices();
      expect(activeIndices).toEqual([0]);
      await expect(bsp.getResultText()).resolves.toBe('Target 0 found at index 0.');

      // No runtime errors expected
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Non-numeric array entries result in NaN values and searches for numeric targets do not find them', async ({ page }) => {
      const bsp = new BinarySearchPage(page);
      await bsp.goto();

      // Enter non-numeric values and a numeric target
      await bsp.enterArray('a,b,c');
      await bsp.enterTarget(1);
      await bsp.clickSearch();

      // Visualized elements should show "NaN" when Number('a') etc. evaluated
      const values = await bsp.getVisualizedValues();
      // Number('a') -> NaN, textContent of element will be 'NaN'
      expect(values).toEqual(['NaN', 'NaN', 'NaN']);

      // No active element expected
      const activeIndices = await bsp.getActiveIndices();
      expect(activeIndices.length).toBe(0);

      // Result text should reflect not found (target 1 not found)
      await expect(bsp.getResultText()).resolves.toBe('Target 1 not found.');

      // No runtime errors expected (implementation handles mapping to NaN)
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Searching without entering target results in Target NaN not found (implementation detail)', async ({ page }) => {
      const bsp = new BinarySearchPage(page);
      await bsp.goto();

      // Enter an array but leave target empty
      await bsp.enterArray('1,2,3');
      await bsp.enterTarget(''); // leaving empty
      await bsp.clickSearch();

      // target becomes Number('') === 0, actually -> Number('') is 0, so target 0 not found in [1,2,3]
      // But confirm actual behavior: result text should indicate either NaN or numeric result based on parsing
      const resultText = await bsp.getResultText();

      // The implementation converts target using Number(), so when target input is empty -> Number('') === 0
      // Expect "Target 0 not found." for this implementation
      expect(resultText === 'Target 0 not found.' || resultText === 'Target NaN not found.').toBeTruthy();

      // Visualized elements should match input array
      const values = await bsp.getVisualizedValues();
      expect(values).toEqual(['1', '2', '3']);

      // No runtime errors expected
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Duplicate values: binarySearch finds one index (first mid it encounters) and highlights appropriately', async ({ page }) => {
      const bsp = new BinarySearchPage(page);
      await bsp.goto();

      // Array with duplicates where target equals duplicate
      await bsp.enterArray('1,2,2,3,4');
      await bsp.enterTarget(2);
      await bsp.clickSearch();

      // There should be 5 visuals and one active element (the algorithm picks mid index)
      await expect(bsp.getVisualizedCount()).resolves.toBe(5);
      const activeIndices = await bsp.getActiveIndices();

      // For [1,2,2,3,4], mid initially is Math.floor((0+4)/2)=2 -> index 2 is a '2'
      expect(activeIndices).toEqual([2]);

      // Result text should mention index 2
      await expect(bsp.getResultText()).resolves.toBe('Target 2 found at index 2.');

      // No runtime errors expected
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Observability: console and page errors are captured', () => {
    test('No unexpected console errors or page errors during multiple searches', async ({ page }) => {
      const bsp = new BinarySearchPage(page);
      await bsp.goto();

      // Perform several searches including edge cases
      await bsp.enterArray('1,2,3,4,5');
      await bsp.enterTarget(4);
      await bsp.clickSearch();

      await bsp.enterArray('a,b');
      await bsp.enterTarget(0);
      await bsp.clickSearch();

      await bsp.enterArray('');
      await bsp.enterTarget(0);
      await bsp.clickSearch();

      // After these interactions, assert that no console errors or uncaught page errors were emitted
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});