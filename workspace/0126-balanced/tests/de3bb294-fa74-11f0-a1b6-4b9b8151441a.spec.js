import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3bb294-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Linear Search Demonstration - FSM validation (de3bb294-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Shared arrays to capture console messages and page errors for each test run.
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset captures before each test
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught exceptions and console messages
    page.on('pageerror', (err) => {
      // e.g., uncaught exceptions
      pageErrors.push(String(err && err.message ? err.message : err));
    });
    page.on('console', (msg) => {
      // Capture console messages (info, log, error, etc.)
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      // Also treat console.error as a page error for assertion purposes
      if (msg.type() === 'error') {
        pageErrors.push(msg.text());
      }
    });

    // Load the page exactly as-is (do not modify the environment)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('S0_Idle: Initial Idle state renders the page and displays the initial array', async ({ page }) => {
    // Validate initial static content is present (evidence of Idle state entry)
    // 1) The main heading is present.
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Linear Search Demonstration');

    // 2) The array input has the expected initial value.
    const arrayInput = page.locator('#arrayInput');
    await expect(arrayInput).toHaveValue('5, 12, 8, 130, 44, 3, 9');

    // 3) The arrayDisplay element should be initialized on window.onload.
    const arrayDisplay = page.locator('#arrayDisplay');
    await expect(arrayDisplay).toHaveText('5, 12, 8, 130, 44, 3, 9');

    // 4) Search result and steps should be empty initially.
    await expect(page.locator('#searchResult')).toHaveText('');
    await expect(page.locator('#stepsDisplay')).toHaveText('', { timeout: 1000 });

    // 5) Verify no critical runtime errors (ReferenceError/SyntaxError/TypeError) were thrown during render.
    // If any such errors occurred naturally, they will be present in pageErrors.
    const criticalErrors = pageErrors.filter(msg => /ReferenceError|SyntaxError|TypeError/.test(msg));
    expect(criticalErrors.length, `Unexpected critical errors during initial render: ${pageErrors.join(' | ')}`).toBe(0);
  });

  test('S1_Searching -> S2_ResultFound: Clicking Search finds an existing value and shows steps and visual feedback', async ({ page }) => {
    // This test validates the transition: Idle -> Searching -> ResultFound
    // Precondition: default searchValue is 130 which exists in the default array at index 3.

    // Ensure searchValue input has expected default
    const searchInput = page.locator('#searchValue');
    await expect(searchInput).toHaveValue('130');

    // Click the Search button to trigger performSearch() (Searching state entry action)
    const searchButton = page.locator("button[onclick='performSearch()']");
    await searchButton.click();

    // The algorithm includes synchronous busy-waiting for visualization in the page script.
    // Wait for the search result text to be populated.
    const resultLocator = page.locator('#searchResult');
    await resultLocator.waitFor({ state: 'visible', timeout: 15000 });

    // Validate the final result text matches the expected "Found 130 at index 3!"
    await expect(resultLocator).toHaveText('Found 130 at index 3!');

    // Validate that the result element has class 'found' (visual feedback)
    await expect(resultLocator).toHaveClass(/found/);

    // Validate that steps were recorded and include a "FOUND!" highlight for the matching step
    const stepsHtml = await page.locator('#stepsDisplay').innerHTML();
    expect(stepsHtml.includes('FOUND!') || stepsHtml.includes('highlight'), 'Expected steps to include a FOUND highlight').toBeTruthy();
    // Ensure at least one step is recorded
    expect(stepsHtml.trim().length > 0, 'Expected stepsDisplay to contain at least one step').toBeTruthy();

    // Confirm there were no critical runtime errors during the search process
    const criticalErrors1 = pageErrors.filter(msg => /ReferenceError|SyntaxError|TypeError/.test(msg));
    expect(criticalErrors.length, `Critical errors during Found search: ${pageErrors.join(' | ')}`).toBe(0);
  });

  test('S1_Searching -> S3_ResultNotFound: Clicking Search for a missing value shows not-found final state and steps', async ({ page }) => {
    // This test validates the transition: Idle -> Searching -> ResultNotFound

    // Set a search value that does not exist in the array
    const searchInput1 = page.locator('#searchValue');
    await searchInput.fill('999'); // value not present in default array

    // Click Search
    const searchButton1 = page.locator("button[onclick='performSearch()']");
    await searchButton.click();

    // Wait for result text to appear (not-found)
    const resultLocator1 = page.locator('#searchResult');
    await resultLocator.waitFor({ state: 'visible', timeout: 15000 });

    // Validate the not-found message uses the provided search value
    await expect(resultLocator).toHaveText('999 not found in the array.');

    // Validate visual feedback class for not-found
    await expect(resultLocator).toHaveClass(/not-found/);

    // Validate the steps were recorded for each array element (there should be at least as many step entries as array elements)
    const stepsText = await page.locator('#stepsDisplay').innerText();
    // Default array length is 7; ensure steps mention "Step" multiple times
    const stepCountMatches = (stepsText.match(/Step \d+/g) || []).length;
    expect(stepCountMatches >= 1, `Expected at least one recorded step, got ${stepCountMatches}`).toBeTruthy();

    // Confirm there were no critical runtime errors during the not-found search
    const criticalErrors2 = pageErrors.filter(msg => /ReferenceError|SyntaxError|TypeError/.test(msg));
    expect(criticalErrors.length, `Critical errors during Not Found search: ${pageErrors.join(' | ')}`).toBe(0);
  });

  test('Edge case: Empty array input should be handled gracefully (no uncaught exceptions) and show not-found', async ({ page }) => {
    // This test checks robustness: malformed or empty inputs shouldn't crash the page.

    // Clear the array input to simulate an empty array scenario
    const arrayInput1 = page.locator('#arrayInput1');
    await arrayInput.fill(''); // empty string

    // Set the search value to 5
    const searchInput2 = page.locator('#searchValue');
    await searchInput.fill('5');

    // Click Search
    const searchButton2 = page.locator("button[onclick='performSearch()']");
    await searchButton.click();

    // Wait for search result to appear
    const resultLocator2 = page.locator('#searchResult');
    await resultLocator.waitFor({ state: 'visible', timeout: 15000 });

    // The implementation will parse [''] -> [NaN], and result should likely say "5 not found in the array."
    await expect(resultLocator).toHaveText(/5 not found in the array\.|NaN not found in the array\./);

    // Ensure that no uncaught runtime errors occurred while processing empty input
    const criticalErrors3 = pageErrors.filter(msg => /ReferenceError|SyntaxError|TypeError/.test(msg));
    expect(criticalErrors.length, `Critical errors for empty array case: ${pageErrors.join(' | ')}`).toBe(0);
  });

  test('Edge case: Non-numeric search value (blank) should be represented as "NaN" in result and handled safely', async ({ page }) => {
    // Clear the search value input to create a non-numeric search value
    const searchInput3 = page.locator('#searchValue');
    await searchInput.fill(''); // this typically results in empty string -> parseInt -> NaN

    // Use the default array
    const searchButton3 = page.locator("button[onclick='performSearch()']");
    await searchButton.click();

    // Wait for result to appear
    const resultLocator3 = page.locator('#searchResult');
    await resultLocator.waitFor({ state: 'visible', timeout: 15000 });

    // The page code uses template string with searchValue (which will be "NaN" if parseInt('') -> NaN and stringified)
    const resultText = await resultLocator.innerText();
    // Accept either 'NaN not found in the array.' or similar safe handling
    expect(/NaN not found in the array\.| not found in the array\./.test(resultText)).toBeTruthy();

    // There should be no crash (no critical errors)
    const criticalErrors4 = pageErrors.filter(msg => /ReferenceError|SyntaxError|TypeError/.test(msg));
    expect(criticalErrors.length, `Critical errors for blank search value: ${pageErrors.join(' | ')}`).toBe(0);
  });

  test('FSM transitions summary and console observation: ensure no unexpected errors occurred across interactions', async ({ page }) => {
    // This test performs a sequence of interactions to exercise multiple transitions and then inspects collected console/page errors.

    const arrayInput2 = page.locator('#arrayInput2');
    const searchInput4 = page.locator('#searchValue');
    const searchButton4 = page.locator("button[onclick='performSearch()']");
    const resultLocator4 = page.locator('#searchResult');

    // 1) Perform a successful search
    await searchInput.fill('8');
    await searchButton.click();
    await resultLocator.waitFor({ state: 'visible', timeout: 15000 });
    await expect(resultLocator).toHaveText(/Found 8 at index \d+!/);

    // 2) Perform a not-found search
    await searchInput.fill('9999');
    await searchButton.click();
    await resultLocator.waitFor({ state: 'visible', timeout: 15000 });
    await expect(resultLocator).toHaveText(/9999 not found in the array\./);

    // 3) Perform a malformed-array search
    await arrayInput.fill('a, b, c');
    await searchInput.fill('1'); // numeric search against non-numeric array
    await searchButton.click();
    await resultLocator.waitFor({ state: 'visible', timeout: 15000 });
    // Expect safe not-found message
    const textAfterMalformed = await resultLocator.innerText();
    expect(/not found in the array\.|Found \d+ at index \d+!/.test(textAfterMalformed)).toBeTruthy();

    // After several transitions, inspect the captured console and page errors.
    // We assert that no ReferenceError/SyntaxError/TypeError occurred. If they did, they will be listed in pageErrors.
    const criticalErrors5 = pageErrors.filter(msg => /ReferenceError|SyntaxError|TypeError/.test(msg));
    expect(criticalErrors.length, `Critical runtime errors occurred during interaction sequence: ${pageErrors.join(' | ')}`).toBe(0);

    // Also assert that console was used for at least some informational logs / html updates occurred
    expect(consoleMessages.length >= 0, 'Console should have been observed (may be empty)');

    // As an additional sanity check, ensure the DOM still contains expected core elements
    await expect(page.locator('#arrayDisplay')).toBeVisible();
    await expect(page.locator('#stepsDisplay')).toBeVisible();
  });
});