import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ced065-fa79-11f0-8075-e54a10595dde.html';

test.describe('Linear Search Demo (FSM ID: 99ced065-fa79-11f0-8075-e54a10595dde)', () => {
  // Collect console messages and page errors per test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is (do not modify or patch)
    await page.goto(APP_URL);
  });

  // S0_Idle: Initial state - validate UI elements rendered and initial state values.
  test('S0_Idle - initial render displays inputs, placeholders and empty outputs', async ({ page }) => {
    // Verify the array input exists and has the expected placeholder
    const arrayInput = page.locator('#arrayInput');
    await expect(arrayInput).toBeVisible();
    await expect(arrayInput).toHaveAttribute('placeholder', 'e.g. 1, 2, 3, 4, 5');

    // Verify the target input exists and has the expected placeholder
    const targetInput = page.locator('#targetInput');
    await expect(targetInput).toBeVisible();
    await expect(targetInput).toHaveAttribute('placeholder', 'Target number');

    // Verify the search button exists
    const searchButton = page.locator('#searchButton');
    await expect(searchButton).toBeVisible();
    await expect(searchButton).toHaveText('Search');

    // Verify result and steps outputs are present and initially empty
    const resultOutput = page.locator('#resultOutput');
    const stepsOutput = page.locator('#stepsOutput');
    await expect(resultOutput).toBeVisible();
    await expect(resultOutput).toBeEmpty();
    await expect(stepsOutput).toBeVisible();
    await expect(stepsOutput).toBeEmpty();

    // Assert that loading the page did not produce uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  // S1_Searching -> S2_ResultDisplayed: Successful search where target exists in the array.
  test('S1_Searching -> S2_ResultDisplayed - finds a present target and lists steps up to the found index', async ({ page }) => {
    // Fill inputs with a known array and target that exists
    await page.fill('#arrayInput', '1, 2, 3, 4, 5');
    await page.fill('#targetInput', '3');

    // Trigger the Search event (SearchButtonClick)
    await page.click('#searchButton');

    // Expect the result to indicate the found index (index 2 for value 3)
    const resultOutput = page.locator('#resultOutput');
    await expect(resultOutput).toHaveText('Found at index 2');

    // Expect steps to list the checks up to and including index 2 (3 steps)
    const stepItems = page.locator('#stepsOutput li');
    await expect(stepItems).toHaveCount(3);
    await expect(stepItems.nth(0)).toHaveText('Checking index 0: value 1');
    await expect(stepItems.nth(1)).toHaveText('Checking index 1: value 2');
    await expect(stepItems.nth(2)).toHaveText('Checking index 2: value 3');

    // Verify no uncaught errors were emitted during the interaction
    expect(pageErrors.length).toBe(0);

    // Also verify that there are no console error messages
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  // Transition: clicking search when target is not present -> should show "Not Found" and all steps.
  test('Transition: target not present results in "Not Found" and lists all steps', async ({ page }) => {
    // Provide an array where the target does not exist
    await page.fill('#arrayInput', '10,20,30');
    await page.fill('#targetInput', '5');

    // Trigger search
    await page.click('#searchButton');

    // Result should be "Not Found"
    await expect(page.locator('#resultOutput')).toHaveText('Not Found');

    // Steps should list all elements (3 checks)
    const stepItems = page.locator('#stepsOutput li');
    await expect(stepItems).toHaveCount(3);
    await expect(stepItems.nth(0)).toHaveText('Checking index 0: value 10');
    await expect(stepItems.nth(1)).toHaveText('Checking index 1: value 20');
    await expect(stepItems.nth(2)).toHaveText('Checking index 2: value 30');

    // No uncaught runtime errors expected
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  // Edge case: empty array input — verify behavior (likely parseInt('') => NaN, steps will show NaN)
  test('Edge case: empty array input results in a Not Found result and shows NaN in steps', async ({ page }) => {
    // Empty array string and a numeric target
    await page.fill('#arrayInput', '');
    await page.fill('#targetInput', '0');

    // Trigger search
    await page.click('#searchButton');

    // Expect "Not Found" because array element parsed as NaN won't equal 0
    await expect(page.locator('#resultOutput')).toHaveText('Not Found');

    // Steps: the implementation will create one step "Checking index 0: value NaN"
    const stepItems = page.locator('#stepsOutput li');
    await expect(stepItems).toHaveCount(1);
    await expect(stepItems.nth(0)).toHaveText(/Checking index 0: value\s+NaN/);

    // Ensure no uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: non-numeric array elements and non-numeric target — ensure no crashes and consistent behavior
  test('Edge case: non-numeric array elements and non-numeric target do not crash the page', async ({ page }) => {
    // Non-numeric array values and a target that is a non-numeric string (parsed to NaN)
    await page.fill('#arrayInput', 'a, b, c');
    await page.fill('#targetInput', 'b'); // parseInt('b') -> NaN

    // Trigger search
    await page.click('#searchButton');

    // Expect Not Found (since comparisons are numeric and become NaN)
    await expect(page.locator('#resultOutput')).toHaveText('Not Found');

    // Steps should reflect NaN values
    const stepItems = page.locator('#stepsOutput li');
    await expect(stepItems).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(stepItems.nth(i)).toHaveText(new RegExp(`Checking index ${i}: value\\s+NaN`));
    }

    // Confirm there were no uncaught page errors during this interaction
    expect(pageErrors.length).toBe(0);

    // And no console-level errors
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  // Verify onEnter/onExit actions from the FSM are not defined in the page implementation.
  // The FSM mentions renderPage() and executeSearch() as entry actions; ensure these are not present
  // (we do not attempt to call them — only inspect their existence).
  test('Verify FSM onEnter actions (renderPage, executeSearch) are not implemented as global functions', async ({ page }) => {
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    const executeSearchType = await page.evaluate(() => typeof window.executeSearch);

    // If these functions were implemented, type would be 'function'. The implementation provided
    // does not define these functions, so we expect 'undefined'.
    expect(renderPageType).toBe('undefined');
    expect(executeSearchType).toBe('undefined');

    // No uncaught runtime errors from just checking globals
    expect(pageErrors.length).toBe(0);
  });

  // Observe console output and page errors over a typical sequence of interactions.
  // This test focuses on collecting any ReferenceError/SyntaxError/TypeError that might surface.
  test('Observe console and page errors during multiple interactions', async ({ page }) => {
    // Perform multiple searches with different inputs to exercise the code paths
    await page.fill('#arrayInput', '1,2,3');
    await page.fill('#targetInput', '2');
    await page.click('#searchButton');

    await page.fill('#arrayInput', '100,200,300,400');
    await page.fill('#targetInput', '400');
    await page.click('#searchButton');

    await page.fill('#arrayInput', '');
    await page.fill('#targetInput', '');
    await page.click('#searchButton');

    // Collect any console error-level messages and page errors
    const errorConsole = consoleMessages.filter(m => m.type === 'error');

    // For the provided implementation, we expect no uncaught exceptions or console errors.
    // If any ReferenceError, SyntaxError, or TypeError occurred naturally, they would be present
    // in pageErrors or in consoleMessages of type 'error' and this assertion would fail,
    // surfacing the runtime issues as required by the testing mandate.
    expect(pageErrors.length).toBe(0);
    expect(errorConsole.length).toBe(0);
  });
});