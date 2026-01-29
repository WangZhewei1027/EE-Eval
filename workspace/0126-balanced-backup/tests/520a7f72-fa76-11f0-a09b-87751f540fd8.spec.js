import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a7f72-fa76-11f0-a09b-87751f540fd8.html';

test.describe('520a7f72-fa76-11f0-a09b-87751f540fd8 - Indexing Example (FSM: Idle)', () => {
  // Shared storage for console and page errors for each test run
  test.beforeEach(async ({ page }) => {
    // No-op here; each test will set up its own listeners as needed and navigate.
  });

  // Validate the initial Idle state rendering and static DOM content.
  test('renders Idle state: page structure and static lists are present', async ({ page }) => {
    // Capture console messages and page errors emitted during page load
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });

    // 1) Verify initial top-level header and #indexing container exist (FSM Idle evidence)
    const topHeader = page.locator('h2').first();
    await expect(topHeader).toHaveText('Indexing Example');
    await expect(page.locator('#indexing')).toBeVisible();

    // 2) Verify the "Original List" UL contains the expected three items (static DOM)
    const originalItems = await page.locator('#indexing ul li').allTextContents();
    expect(originalItems).toEqual(['Item 1', 'Item 2', 'Item 3']);

    // 3) Verify the "Indexed List" OL contains the expected three items (static DOM)
    const indexedItemsInDOM = await page.locator('#indexing ol li').allTextContents();
    expect(indexedItemsInDOM).toEqual(['Item 1', 'Item 2', 'Item 3']);

    // 4) Ensure the page produced expected console log entries from its inline script
    // The script logs: 'Original List:', 'Indexed List:', 'Updated Original List:'
    const hasOriginalLog = consoleMessages.some(m => m.text.includes('Original List:'));
    const hasIndexedLog = consoleMessages.some(m => m.text.includes('Indexed List:'));
    const hasUpdatedLog = consoleMessages.some(m => m.text.includes('Updated Original List:'));
    expect(hasOriginalLog, 'Expected console log "Original List:"').toBeTruthy();
    expect(hasIndexedLog, 'Expected console log "Indexed List:"').toBeTruthy();
    expect(hasUpdatedLog, 'Expected console log "Updated Original List:"').toBeTruthy();

    // 5) On initial load, the page should not have raised runtime page errors (script is well-formed)
    expect(pageErrors.length, 'No pageerror events expected on initial load').toBe(0);
  });

  // Validate the JS runtime variables produced by the inline script and window property behavior.
  test('verifies script variables: originalList updated to indexed values and window property behavior', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // The inline script uses `let originalList = [...]` and later reassigns it to indexedList.
    // Evaluate the variable "originalList" in page context (should be accessible) and compare values.
    const originalListValue = await page.evaluate(() => {
      // Accessing the top-level `originalList` declared with `let` should be possible in this context.
      try {
        return originalList; // returns the current value after the script ran
      } catch (e) {
        // If it's not accessible, return a sentinel value
        return { __error: String(e) };
      }
    });

    // The script sets originalList = indexedList, so expect entries prefixed with "1. ", "2. ", "3. "
    expect(Array.isArray(originalListValue), 'originalList should be an array after script runs').toBeTruthy();
    expect(originalListValue).toEqual(['1. Item 1', '2. Item 2', '3. Item 3']);

    // Because `let` does not create a property on window, verify window.originalList is undefined.
    const windowHasProperty = await page.evaluate(() => {
      return Object.prototype.hasOwnProperty.call(window, 'originalList') ? window.originalList : undefined;
    });
    expect(windowHasProperty).toBeUndefined();
  });

  // Validate that FSM entry action renderPage() is mentioned but not implemented;
  // calling it should produce a ReferenceError in the page context.
  test('entry action renderPage() is not defined -> calling it results in ReferenceError (observed as pageerror)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Attempt to invoke the non-existent renderPage() function in the page context.
    // This is intended to let a ReferenceError happen naturally and observe it.
    let caughtError = null;
    try {
      await page.evaluate(() => {
        // Intentionally call undefined function to trigger ReferenceError in page scope
        // Do not define or patch the function; allow the error to occur naturally.
        // eslint-disable-next-line no-undef
        renderPage();
      });
    } catch (e) {
      // Playwright will surface the exception here; capture it for assertions.
      caughtError = e;
    }

    // We expect an error to have been thrown when trying to call renderPage
    expect(caughtError, 'Calling undefined renderPage should throw an error in page.evaluate').toBeTruthy();

    // Message should indicate renderPage is not defined or ReferenceError
    const message = String(caughtError.message || caughtError);
    // The exact text may vary across engines — check for indicative substrings.
    expect(
      /renderPage|is not defined|ReferenceError|not defined/i.test(message),
      'Error message should indicate renderPage is not defined'
    ).toBeTruthy();

    // Also assert that the page emitted a pageerror for the same issue
    // There may be one or more pageerror events; at least one should reference renderPage
    const anyPageErrorMatches = pageErrors.some(err => {
      const m = String(err.message || err);
      return /renderPage|is not defined|ReferenceError|not defined/i.test(m);
    });
    expect(anyPageErrorMatches, 'A pageerror referencing renderPage should have been emitted').toBeTruthy();
  });

  // Validate that there are no interactive controls and no transitions: FSM had no events/transitions.
  test('FSM transitions/events: verify absence of interactive controls and event handlers', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // No buttons or inputs are expected as per FSM extraction notes.
    const buttonCount = await page.locator('button').count();
    const inputCount = await page.locator('input, textarea, select').count();
    expect(buttonCount, 'No <button> elements expected').toBe(0);
    expect(inputCount, 'No form controls expected').toBe(0);

    // Try to detect inline onclick attributes or elements with 'role=button' that might indicate interactions.
    const onclickCount = await page.evaluate(() => {
      const elems = Array.from(document.querySelectorAll('[onclick]'));
      return elems.length;
    });
    expect(onclickCount, 'No inline onclick attributes expected').toBe(0);

    // No event listeners attached to the document/body should be assumed; at minimum ensure there's no obvious interactive UI:
    const interactiveSelectors = await page.evaluate(() => {
      const clickable = Array.from(document.querySelectorAll('a,button,[role="button"],[tabindex]'));
      // Filter out anchors that have href set to '#' or empty; still count them as interactive if present
      return clickable.map(el => el.outerHTML).slice(0, 10); // return up to 10 for debugging if any exist
    });
    expect(interactiveSelectors.length, 'Expected no interactive elements in this simple demo').toBe(0);
  });

  // Edge-case test: deliberately invoke another undefined function to observe multiple ReferenceErrors
  test('error scenario: invoking another undefined function results in ReferenceError and is captured', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Intentionally call a different non-existent global to ensure ReferenceError behavior is consistent
    let thrown = null;
    try {
      await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        nonexistentFunctionThatDoesNotExist();
      });
    } catch (e) {
      thrown = e;
    }

    expect(thrown, 'Expected a thrown error when calling an undefined function').toBeTruthy();
    const thrownMsg = String(thrown.message || thrown);
    expect(/nonexistentFunctionThatDoesNotExist|is not defined|ReferenceError/i.test(thrownMsg)).toBeTruthy();

    // Ensure pageerror captured at least one related error
    const found = pageErrors.some(err => /nonexistentFunctionThatDoesNotExist|is not defined|ReferenceError/i.test(String(err.message || err)));
    expect(found, 'A pageerror corresponding to the undefined function should have been emitted').toBeTruthy();
  });
});