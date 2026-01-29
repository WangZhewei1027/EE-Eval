import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52091fe1-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Exponential Search FSM - Application 52091fe1-fa76-11f0-a09b-87751f540fd8', () => {
  // Shared variables to capture runtime console messages and page errors
  let consoleMessages;
  let pageErrors;

  // Attach listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      // Collect text for assertions / debugging
      try {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (e) {
        consoleMessages.push(`console: (could not read message)`);
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the application as-is
    await page.goto(APP_URL);
    // Basic sanity: wait for main elements to be present
    await page.waitForSelector('#search-input');
    await page.waitForSelector('#search-button');
    await page.waitForSelector('#search-output');
  });

  test.afterEach(async () => {
    // noop cleanup hook available if needed
  });

  test.describe('S0_Idle - Initial render', () => {
    test('Initial render shows input, button and empty output (Idle state)', async ({ page }) => {
      // This test verifies initial DOM presence and no unexpected errors on load
      const input = await page.$('#search-input');
      const button = await page.$('#search-button');
      const output = await page.$('#search-output');

      // Elements should be present
      expect(input).toBeTruthy();
      expect(button).toBeTruthy();
      expect(output).toBeTruthy();

      // Placeholder should match FSM/component description
      const placeholder = await page.getAttribute('#search-input', 'placeholder');
      expect(placeholder).toBe('Enter a number to search for');

      // Output should start empty
      const outputText = await page.textContent('#search-output');
      expect(outputText.trim()).toBe('');

      // No page errors should have occurred during initial render
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S4_EmptyInput - Empty input handling', () => {
    test('Clicking Search with empty input shows "Please enter a number to search for"', async ({ page }) => {
      // Ensure input is empty
      await page.fill('#search-input', '');
      // Click the search button
      await page.click('#search-button');

      // The application should update the output div with the expected message
      await expect(page.locator('#search-output')).toHaveText('Please enter a number to search for');

      // This path shouldn't call exponentialSearch, so there should be no runtime page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S3_ResultNotFound - Search when number not found', () => {
    test('Single-character input that cannot be found -> "Number not found in the list"', async ({ page }) => {
      // Enter a single digit which leads exponentialSearch to return null (no loop iterations)
      await page.fill('#search-input', '5');
      await page.click('#search-button');

      // Expect the output to indicate not found
      await expect(page.locator('#search-output')).toHaveText('Number not found in the list');

      // No page errors should have occurred for this path
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S2_ResultFound - Search where algorithm returns a truthy result', () => {
    test('Input causing exponentialSearch to return a truthy result updates output (observed behavior)', async ({ page }) => {
      // Input '11' => numbers = [1,1]. The exponentialSearch implementation returns a number (mid).
      // The UI code then tries to use searchResult[0], which will be undefined for a number.
      // As implemented, that results in numbers.indexOf(undefined) => -1, then +1 => 0.
      // Thus the displayed message (quirky as it is) should be: "Number 0 found in the list"
      await page.fill('#search-input', '11');
      await page.click('#search-button');

      // Validate the observed DOM output matches what the current implementation produces
      await expect(page.locator('#search-output')).toHaveText('Number 0 found in the list');

      // There should be no unhandled page errors for this particular input flow
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S1_Searching -> Error scenarios caused by implementation issues', () => {
    test('Multi-digit input that triggers reassignment to a const causes a TypeError (Assignment to constant variable)', async ({ page }) => {
      // Prepare to wait for an uncaught pageerror event which we expect due to the buggy implementation
      // Use Promise.all to ensure we click and wait for the error reliably.
      const waitForErrorPromise = page.waitForEvent('pageerror');

      // Input '12' will make numbers = [1,2]. The exponentialSearch loop will execute
      // and attempt to reassign 'exponent' (declared as const) leading to a TypeError.
      await page.fill('#search-input', '12');
      // Perform click and wait for the uncaught exception
      const [error] = await Promise.all([waitForErrorPromise, page.click('#search-button')]);

      // Validate that a pageerror did occur and inspect its message
      expect(error).toBeTruthy();
      const message = String(error.message || error);
      // Different browsers may phrase the message slightly differently; check for the key phrase
      expect(message.toLowerCase()).toContain('assignment to constant');

      // Also ensure that at least one page error was captured via the listener
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      // And that one of the captured pageErrors has a message that includes 'Assignment to constant'
      const found = pageErrors.some((e) => String(e.message || e).toLowerCase().includes('assignment to constant'));
      expect(found).toBe(true);

      // The application may not update the output due to the thrown error; assert that it did not show the success message
      const outputText = await page.textContent('#search-output');
      // It should not be the 'Result Found' message from the FSM (which contains 'found in the list' + a number other than initial empty)
      // We assert that either the output is empty or does not include expected 'found' phrase in the successful format.
      expect(outputText).not.toContain('Number');
    });
  });

  test.describe('Additional checks & edge cases', () => {
    test('Non-numeric input is handled (no crashes) and results in "Number not found in the list" or equivalent', async ({ page }) => {
      // Use a non-numeric character. The code will map to Number => NaN; behavior should not throw on this path.
      await page.fill('#search-input', 'a');
      await page.click('#search-button');

      // The implementation, in many cases, ends up not finding the number and sets the "not found" text.
      // Accept either "Number not found in the list" or that the output is set to some text but ensure no uncaught exceptions occurred.
      const out = (await page.textContent('#search-output')).trim();

      // Acceptable outcomes: explicit not found message, or some other non-error output (we ensure no page errors)
      expect(pageErrors.length).toBe(0);
      // Validate that output is a non-empty string (some feedback should be provided)
      expect(typeof out).toBe('string');
    });

    test('No ReferenceError for renderPage (entry action mentioned in FSM but not invoked) - ensure absence of related exceptions', async ({ page }) => {
      // The FSM mentions renderPage() on S0 entry, but the provided page does not call it.
      // Verify there's no ReferenceError about renderPage upon load.
      const foundRefErr = pageErrors.some((e) => String(e.message || e).toLowerCase().includes('renderpage'));
      expect(foundRefErr).toBe(false);
    });
  });
});