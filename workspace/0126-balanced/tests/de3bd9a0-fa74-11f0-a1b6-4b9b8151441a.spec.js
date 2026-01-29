import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3bd9a0-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Jump Search Interactive Application - de3bd9a0-fa74-11f0-a1b6-4b9b8151441a', () => {
  // Shared variables to collect console and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collections for errors for each test
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Load the application page exactly as provided
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // No teardown modifications required; errors are asserted in individual tests
  });

  test.describe('Idle State (S0_Idle) - Initial render checks', () => {
    test('should render inputs, button, and empty display areas on load', async ({ page }) => {
      // Validate presence and default values of inputs and button, matching FSM component evidence
      const arrayInput = page.locator('#array-input');
      const targetInput = page.locator('#target-input');
      const searchButton = page.locator("button[onclick='performJumpSearch()']");
      const arrayDisplay = page.locator('#array-display');
      const stepsDiv = page.locator('#steps');

      // Inputs and button exist
      await expect(arrayInput).toHaveCount(1);
      await expect(targetInput).toHaveCount(1);
      await expect(searchButton).toHaveCount(1);

      // Default values match the HTML implementation / FSM extracted components
      await expect(arrayInput).toHaveValue('1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25');
      await expect(targetInput).toHaveValue('13');

      // Display areas are initially empty
      await expect(arrayDisplay).toBeEmpty();
      await expect(stepsDiv).toBeEmpty();

      // Ensure no console or page errors were emitted during initial load
      expect(consoleErrors, 'No console.error messages should be present on load').toEqual([]);
      expect(pageErrors, 'No page errors should be present on load').toEqual([]);
    });
  });

  test.describe('Searching State (S1_Searching) and Result States (S3_ResultFound, S4_ResultNotFound)', () => {
    test('should perform jump search and find existing element (Result Found - S3)', async ({ page }) => {
      const arrayInput1 = page.locator('#array-input');
      const targetInput1 = page.locator('#target-input');
      const searchButton1 = page.locator("button[onclick='performJumpSearch()']");
      const arrayDisplay1 = page.locator('#array-display');
      const stepsDiv1 = page.locator('#steps');

      // Ensure starting from defaults (array contains 13 at index 6)
      await expect(arrayInput).toHaveValue(/13/);
      await expect(targetInput).toHaveValue('13');

      // Click the Search button to transition from Idle -> Searching
      await searchButton.click();

      // After clicking, the Searching state's function should populate steps and array display.
      await expect(stepsDiv).toContainText('Starting Jump Search for 13', { timeout: 2000 });
      await expect(arrayDisplay).toContainText('Array: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25]');

      // Final result: element found message should appear (Result Found S3 evidence)
      await expect(stepsDiv).toContainText('Element 13 found at index 6.', { timeout: 2000 });

      // Also expect the internal jump/linear search messages to appear (evidence of algorithm steps)
      await expect(stepsDiv).toContainText('Jump step:', { timeout: 2000 });
      await expect(stepsDiv).toContainText('Found target at index', { timeout: 2000 });

      // Confirm no console or page errors during the search flow
      expect(consoleErrors, 'No console.error messages should occur during successful search').toEqual([]);
      expect(pageErrors, 'No page errors should occur during successful search').toEqual([]);
    });

    test('should perform jump search and report not found for missing element (Result Not Found - S4)', async ({ page }) => {
      const targetInput2 = page.locator('#target-input');
      const searchButton2 = page.locator("button[onclick='performJumpSearch()']");
      const stepsDiv2 = page.locator('#steps');
      const arrayDisplay2 = page.locator('#array-display');

      // Set a target that is not in the default array
      await targetInput.fill('14'); // 14 is not present
      await searchButton.click();

      // Expect the algorithm to display search steps and eventual not-found message
      await expect(stepsDiv).toContainText('Starting Jump Search for 14', { timeout: 2000 });
      await expect(arrayDisplay).toContainText('Array: [', { timeout: 2000 });
      await expect(stepsDiv).toContainText('not found in the array', { timeout: 2000 });
      await expect(stepsDiv).toContainText('Element 14 not found in the array.', { timeout: 2000 });

      // Confirm no console or page errors during the not-found search flow
      expect(consoleErrors, 'No console.error messages should occur during not-found search').toEqual([]);
      expect(pageErrors, 'No page errors should occur during not-found search').toEqual([]);
    });
  });

  test.describe('Error State (S2_Error) - Input Validation', () => {
    test('should display error when array contains non-numeric entries (Error - S2)', async ({ page }) => {
      const arrayInput2 = page.locator('#array-input');
      const searchButton3 = page.locator("button[onclick='performJumpSearch()']");
      const stepsDiv3 = page.locator('#steps');

      // Introduce invalid array content that will cause arr.some(isNaN) to be true
      await arrayInput.fill('1, 2, foo, 4');
      await searchButton.click();

      // Expect the steps div to contain the specific error string from implementation evidence
      await expect(stepsDiv).toHaveText('Error: Please enter a valid array of numbers.');

      // Confirm no console or page errors were emitted — the app handles validation internally
      expect(consoleErrors, 'No console.error messages should occur for validation error').toEqual([]);
      expect(pageErrors, 'No page errors should occur for validation error').toEqual([]);
    });

    test('should display error when target is invalid or empty (Error - S2)', async ({ page }) => {
      const targetInput3 = page.locator('#target-input');
      const searchButton4 = page.locator("button[onclick='performJumpSearch()']");
      const stepsDiv4 = page.locator('#steps');

      // Clear the target input to produce NaN when parsed
      await targetInput.fill('');
      await searchButton.click();

      // Expect the specific target error message to be displayed
      await expect(stepsDiv).toHaveText('Error: Please enter a valid target number.');

      // Confirm no console or page errors were emitted — the app handles validation internally
      expect(consoleErrors, 'No console.error messages should occur for target validation error').toEqual([]);
      expect(pageErrors, 'No page errors should occur for target validation error').toEqual([]);
    });
  });

  test.describe('Transitions and Edge Cases', () => {
    test('clicking the Search button triggers the searching flow (S0 -> S1) and appends steps', async ({ page }) => {
      const searchButton5 = page.locator("button[onclick='performJumpSearch()']");
      const stepsDiv5 = page.locator('#steps');

      // Ensure steps area is empty then click
      await expect(stepsDiv).toBeEmpty();
      await searchButton.click();

      // Immediately after click, we should observe Searching state evidence in steps
      await expect(stepsDiv).toContainText('Starting Jump Search', { timeout: 2000 });

      // Confirm that multiple appended messages exist (jump phase and linear phase evidence)
      await expect(stepsDiv).toContainText('Jump step:', { timeout: 2000 });
      await expect(stepsDiv).toContainText('Performing linear search in this range', { timeout: 2000 });

      // No console or page errors expected during normal transition
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('edge case: array of length 1 and searching for that element', async ({ page }) => {
      const arrayInput3 = page.locator('#array-input');
      const targetInput4 = page.locator('#target-input');
      const searchButton6 = page.locator("button[onclick='performJumpSearch()']");
      const stepsDiv6 = page.locator('#steps');

      // Replace array with a single element and search for it
      await arrayInput.fill('42');
      await targetInput.fill('42');
      await searchButton.click();

      // Expect search to start and find the element at index 0
      await expect(stepsDiv).toContainText('Starting Jump Search for 42', { timeout: 2000 });
      await expect(stepsDiv).toContainText('Element 42 found at index 0.', { timeout: 2000 });

      // No console or page errors expected for this edge case
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Observability: Console and Page Errors (must be observed, if any)', () => {
    test('should record console and page errors emitted during interactions (if any)', async ({ page }) => {
      // This test purposefully exercises the page and then asserts that we've captured any console/page errors.
      // It does NOT attempt to alter the runtime environment or fix errors. It simply verifies the captured logs.

      const searchButton7 = page.locator("button[onclick='performJumpSearch()']");
      const arrayInput4 = page.locator('#array-input');

      // Introduce a scenario that could produce unexpected behavior: extremely malformed input
      await arrayInput.fill(',,, , , ,');
      await searchButton.click();

      // Allow a short time for any potential runtime errors to surface
      await page.waitForTimeout(200);

      // We will assert that we successfully captured console and page errors collections (they may be empty)
      // The test must not fail just because there are no errors; it validates that error observation works.
      expect(Array.isArray(consoleErrors)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // If errors exist, include them in assertion messages to aid debugging
      if (consoleErrors.length > 0) {
        // Fail the test if unexpected console.error messages are present (explicitly report them)
        throw new Error('Console errors detected during execution: ' + JSON.stringify(consoleErrors));
      }

      if (pageErrors.length > 0) {
        // Fail the test if unexpected page errors are present (explicitly report them)
        throw new Error('Page errors detected during execution: ' + JSON.stringify(pageErrors));
      }
    });
  });
});