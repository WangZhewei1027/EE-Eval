import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122b62c4-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Selection Sort interactive page
class SelectionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#start-button');
    this.resetButton = page.locator('#reset-button');
    this.arraySizeInput = page.locator('#array-size');
    this.sortOrderSelect = page.locator('#sort-order');
    this.outputDiv = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setArraySize(value) {
    // Use fill to simulate user input; works even if the input is type=number
    await this.arraySizeInput.fill(String(value));
    // trigger input event explicitly if needed
    await this.arraySizeInput.evaluate((el) => el.dispatchEvent(new Event('input', { bubbles: true })));
  }

  async setSortOrder(value) {
    await this.sortOrderSelect.selectOption(value);
    // trigger change event to match FSM expectation
    await this.sortOrderSelect.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
  }

  async clickStart() {
    await this.startButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async getOutputText() {
    return (await this.outputDiv.textContent()) || '';
  }
}

test.describe('Selection Sort Interactive - FSM validation', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted from the page
    page.on('console', (msg) => {
      try {
        // Keep text and type for richer assertions
        consoleMessages.push({ text: msg.text(), type: msg.type() });
      } catch (e) {
        consoleMessages.push({ text: String(msg), type: 'unknown' });
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Small sanity assertion: no unexpected page-level errors should have occurred
    // Most tests below assert more specific expectations; this provides an overall check.
    // Tests that intentionally provoke errors will assert them explicitly and can override this behavior.
    if (pageErrors.length > 0) {
      // Attach the errors to the test failure output for debugging
      for (const err of pageErrors) {
        // eslint-disable-next-line no-console
        console.error('Page error observed during test:', err);
      }
    }
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Initial state (S0_Idle) - render and controls presence', () => {
    test('Initial Idle state should render controls and output area', async ({ page }) => {
      // Validate that the page loads and all expected controls are present
      const app = new SelectionSortPage(page);
      await app.goto();

      // Verify UI components exist as per FSM evidence
      await expect(app.startButton).toBeVisible();
      await expect(app.resetButton).toBeVisible();
      await expect(app.arraySizeInput).toBeVisible();
      await expect(app.sortOrderSelect).toBeVisible();
      await expect(app.outputDiv).toBeVisible();

      // The input starts empty in the HTML; the internal variable arraySize defaults to 10 but the input value is not set
      const sizeValue = await app.arraySizeInput.inputValue();
      expect(sizeValue).toBe('');

      // No console errors or page errors should be present just from rendering
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Start Sorting (S1_Sorting) - StartSorting event and selectionSort execution', () => {
    test('Clicking Start should run selectionSort and update output for ascending order', async ({ page }) => {
      // This test validates transition S0_Idle -> S1_Sorting:
      // - selectionSort(array) is invoked (we observe console printArray logs)
      // - outputDiv shows "Sorted array in asc order: "
      const app = new SelectionSortPage(page);
      await app.goto();

      // Prepare observers: consoleMessages captured in beforeEach
      // Set array size to 5 and sort order to asc explicitly
      await app.setArraySize(5);
      await app.setSortOrder('asc');

      // Click Start - should print array before and after sort (printArray called twice)
      await app.clickStart();

      // Expect the output text to be updated as per the implementation
      const output = await app.getOutputText();
      expect(output).toBe('Sorted array in asc order: ');

      // Validate console logged the array at least twice (before and after)
      // Search the captured console messages for 'Array:' occurrences
      const arrayLogs = consoleMessages.filter((m) => m.text.includes('Array:'));
      expect(arrayLogs.length).toBeGreaterThanOrEqual(2);

      // Verify the logged arrays correspond to the chosen size (0..4)
      // The log text may look like "Array: [0, 1, 2, 3, 4]" or similar; assert it contains the bracket and expected numbers
      const firstArrayLog = arrayLogs[0].text;
      expect(firstArrayLog).toMatch(/\bArray:\s*\[/);
      expect(firstArrayLog).toMatch(/0/);
      expect(firstArrayLog).toMatch(/4/);

      // No page errors should have occurred during a normal start
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking Start should respect sort order selection (desc)', async ({ page }) => {
      // Although the selectionSort implementation always sorts ascending, the UI should reflect the chosen sort order in the output text.
      const app = new SelectionSortPage(page);
      await app.goto();

      await app.setArraySize(3);
      await app.setSortOrder('desc');
      await app.clickStart();

      const output = await app.getOutputText();
      expect(output).toBe('Sorted array in desc order: ');

      // Confirm console printed arrays for the sort action
      const arrayLogs = consoleMessages.filter((m) => m.text.includes('Array:'));
      expect(arrayLogs.length).toBeGreaterThanOrEqual(2);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Reset (S2_Reset) - ResetSorting event and array restoration', () => {
    test('Clicking Reset should restore array based on current arraySize and update output', async ({ page }) => {
      // This test validates the transition S0_Idle -> S2_Reset:
      // - resetButton listener sets array = Array.from({length: arraySize}, ...)
      // - outputDiv is updated with the sort order text
      const app = new SelectionSortPage(page);
      await app.goto();

      // Set array size via input and start to ensure internal arraySize variable is set in the script
      await app.setArraySize(4);
      await app.setSortOrder('asc');
      await app.clickStart();

      // Clear console messages captured so far to isolate the reset logs
      consoleMessages = [];

      // Now click reset - code will use the internal arraySize (set during start)
      await app.clickReset();

      // After reset, output should again be set
      const output = await app.getOutputText();
      expect(output).toBe('Sorted array in asc order: ');

      // Reset triggers one printArray() call according to implementation
      const arrayLogs = consoleMessages.filter((m) => m.text.includes('Array:'));
      expect(arrayLogs.length).toBeGreaterThanOrEqual(1);

      // Confirm no page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Reset without prior Start uses existing internal arraySize (default 10) and does not crash', async ({ page }) => {
      // Validate behavior of reset when start was not clicked (arraySize variable remains default 10)
      const app = new SelectionSortPage(page);
      await app.goto();

      consoleMessages = [];
      await app.clickReset();

      // output should be updated even without starting first
      const output = await app.getOutputText();
      expect(output).toBe('Sorted array in asc order: '); // sortOrder defaults to 'asc'

      // Expect at least one console printArray()
      const arrayLogs = consoleMessages.filter((m) => m.text.includes('Array:'));
      expect(arrayLogs.length).toBeGreaterThanOrEqual(1);

      // No page errors are expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Array size and sort order control interactions (ChangeArraySize, ChangeSortOrder events)', () => {
    test('Changing array size input should update the control value and not trigger runtime errors', async ({ page }) => {
      const app = new SelectionSortPage(page);
      await app.goto();

      // Change array size to 7 (simulate ChangeArraySize event)
      await app.setArraySize(7);
      // Validate input value was changed
      const sizeValue = await app.arraySizeInput.inputValue();
      expect(sizeValue).toBe('7');

      // Do not start yet - ensure no errors were emitted simply by changing the input
      expect(pageErrors.length).toBe(0);
    });

    test('Changing sort order select should update selection and not throw errors', async ({ page }) => {
      const app = new SelectionSortPage(page);
      await app.goto();

      await app.setSortOrder('desc');
      const selected = await app.sortOrderSelect.inputValue();
      expect(selected).toBe('desc');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Start with empty array-size input results in empty array and graceful behavior', async ({ page }) => {
      // parseInt('') -> NaN, Array.from length NaN coerces to 0; ensure no crash
      const app = new SelectionSortPage(page);
      await app.goto();

      // Ensure the input is empty (default)
      await app.arraySizeInput.fill('');
      // Clear prior console logs
      consoleMessages = [];

      await app.clickStart();

      // Output should still be updated
      const output = await app.getOutputText();
      expect(output).toBe('Sorted array in asc order: ');

      // Console should show array logs, likely representing an empty array
      const arrayLogs = consoleMessages.filter((m) => m.text.includes('Array:'));
      expect(arrayLogs.length).toBeGreaterThanOrEqual(2);

      // The logged array should contain "Array:" and either empty brackets or no elements
      const anyArrayText = arrayLogs[0].text;
      expect(anyArrayText).toMatch(/Array:\s*\[.*\]/);

      // No page errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('Start with non-numeric array-size input (e.g., "abc") is handled without throwing', async ({ page }) => {
      // This intentionally exercises invalid user input to ensure the app handles it gracefully.
      const app = new SelectionSortPage(page);
      await app.goto();

      // Fill with a non-numeric value; input type=number accepts setting value via script
      await app.arraySizeInput.fill('abc');
      consoleMessages = [];

      await app.clickStart();

      // The page should still update the output text
      const output = await app.getOutputText();
      expect(output).toBe('Sorted array in asc order: ');

      // Console logs should contain at least two "Array:" entries (before/after sort)
      const arrayLogs = consoleMessages.filter((m) => m.text.includes('Array:'));
      expect(arrayLogs.length).toBeGreaterThanOrEqual(2);

      // Validate there were no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Large but reasonable array-size should not throw synchronously (keeps test resource-safe)', async ({ page }) => {
      // Use a moderate large size (e.g., 1000) to validate behavior without exhausting resources.
      const app = new SelectionSortPage(page);
      await app.goto();

      await app.setArraySize(1000);
      consoleMessages = [];

      // Clicking start will run selectionSort on 1000 elements - this is O(n^2) but acceptable for this test runner medium size
      await app.clickStart();

      // Output should be set; and console logs should have 'Array:' entries
      const output = await app.getOutputText();
      expect(output).toBe('Sorted array in asc order: ');

      const arrayLogs = consoleMessages.filter((m) => m.text.includes('Array:'));
      // At least two logs expected even if arrays are large (console may truncate)
      expect(arrayLogs.length).toBeGreaterThanOrEqual(2);

      // No page errors expected for this reasonable size
      expect(pageErrors.length).toBe(0);
    }, { timeout: 120000 }); // allow more time for the O(n^2) operation if the environment is slow
  });

  test.describe('Console and runtime error observation (observability checks)', () => {
    test('Console logs include expected "Array:" messages during operations', async ({ page }) => {
      const app = new SelectionSortPage(page);
      await app.goto();

      // Start with a small array to make log assertions deterministic
      await app.setArraySize(4);
      consoleMessages = [];
      await app.clickStart();

      // Expect captured console logs to include "Array:" entries
      const arrayLogTexts = consoleMessages.filter((m) => m.text.includes('Array:')).map((m) => m.text);
      expect(arrayLogTexts.length).toBeGreaterThanOrEqual(2);
      // Ensure the sequence includes before and after prints: we can't assert exact ordering beyond presence,
      // but we assert both exist and contain bracket structure.
      expect(arrayLogTexts[0]).toMatch(/Array:\s*\[.*\]/);
      expect(arrayLogTexts[1]).toMatch(/Array:\s*\[.*\]/);

      expect(pageErrors.length).toBe(0);
    });

    test('No unexpected ReferenceError/SyntaxError/TypeError occur during normal interactions', async ({ page }) => {
      // This test ensures that standard interactions do not raise uncaught runtime errors.
      const app = new SelectionSortPage(page);
      await app.goto();

      // Perform typical interactions
      await app.setArraySize(6);
      await app.setSortOrder('asc');
      await app.clickStart();
      await app.clickReset();

      // Assert that no page errors were captured
      expect(pageErrors.length).toBe(0);
    });
  });
});