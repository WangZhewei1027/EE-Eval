import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0443bba3-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Relational Database - FSM states and transitions (0443bba3-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Helper to attach listeners for console and page errors and return arrays to inspect
  async function attachObservers(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      // Record console.log and others
      try {
        consoleMessages.push(msg.text());
      } catch {
        // ignore non-text console messages
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    return { consoleMessages, pageErrors };
  }

  test.beforeEach(async ({ page }) => {
    // Ensure a fresh navigation for each test
    await page.goto('about:blank');
  });

  test('Initial state (S0_Idle) - page renders and "View Data" button is present with expected attributes', async ({ page }) => {
    // Comments: Validate initial "Idle" state evidence: button exists and has onclick attribute.
    const { consoleMessages, pageErrors } = await attachObservers(page);

    await page.goto(APP_URL);

    // Basic page sanity checks
    await expect(page).toHaveTitle(/Relational Database/);

    // Check the main container and header exist
    await expect(page.locator('.container')).toBeVisible();
    await expect(page.locator('.header h1')).toHaveText('Relational Database');

    // The FSM expects a button with class .button and text "View Data"
    const viewButton = page.locator('.button');
    await expect(viewButton).toHaveCount(1);
    await expect(viewButton).toBeVisible();
    await expect(viewButton).toHaveText('View Data');

    // Verify the inline onclick attribute matches the FSM evidence
    const onclickAttr = await viewButton.getAttribute('onclick');
    // The implementation includes onclick="displayData()"
    expect(onclickAttr).toBe('displayData()');

    // Verify the displayData function exists on the page (S1 entry action is displayData())
    const displayDataType = await page.evaluate(() => typeof window.displayData);
    expect(displayDataType).toBe('function');

    // Verify the FSM's S0 entry action renderPage() is NOT implemented in the HTML (explicit check)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // We expect renderPage to be undefined (not implemented)
    expect(renderPageType).toBe('undefined');

    // Ensure no runtime page errors happened during initial load
    expect(pageErrors.length).toBe(0);

    // No console logs expected until user interaction
    expect(consoleMessages.length).toBe(0);
  });

  test('Transition ViewData_Click -> Data Displayed (S1_DataDisplayed) - clicking button logs expected lines', async ({ page }) => {
    // Comments: Validate that clicking the View Data button triggers displayData()
    const { consoleMessages, pageErrors } = await attachObservers(page);

    await page.goto(APP_URL);

    // Click the button to trigger displayData()
    await page.click('.button');

    // Wait briefly to ensure console events are delivered
    await page.waitForTimeout(100);

    // Expected console messages per FSM:
    // "Displaying data:", "John: 25", "Alice: 30"
    expect(consoleMessages).toContain('Displaying data:');
    expect(consoleMessages).toContain('John: 25');
    expect(consoleMessages).toContain('Alice: 30');

    // The order is expected but may not be strictly enforced across environments;
    // however, check that "Displaying data:" appears before the individual entries
    const idxHeader = consoleMessages.indexOf('Displaying data:');
    const idxJohn = consoleMessages.indexOf('John: 25');
    const idxAlice = consoleMessages.indexOf('Alice: 30');
    expect(idxHeader).toBeGreaterThanOrEqual(0);
    expect(idxJohn).toBeGreaterThan(idxHeader);
    expect(idxAlice).toBeGreaterThan(idxHeader);

    // Ensure no page errors occurred during transition
    expect(pageErrors.length).toBe(0);

    // The function should not alter the DOM per implementation; verify no new elements were added inside .content
    const contentInnerHTML = await page.locator('.content').innerHTML();
    // Ensure the string "Displaying data:" does not appear in DOM (it was logged to console)
    expect(contentInnerHTML).not.toContain('Displaying data:');
    // Still must contain the original paragraph and button
    expect(contentInnerHTML).toContain('Welcome to the relational database');
    expect(contentInnerHTML).toContain('View Data');
  });

  test('Edge case: clicking the button multiple times appends repeated console logs (idempotence/duplicates)', async ({ page }) => {
    // Comments: Validate behavior when user repeatedly triggers the same transition
    const { consoleMessages, pageErrors } = await attachObservers(page);

    await page.goto(APP_URL);

    // Click the button twice
    await page.click('.button');
    await page.click('.button');

    await page.waitForTimeout(150);

    // There should be two occurrences of each expected log line
    const countOccurrences = (arr, val) => arr.filter(x => x === val).length;

    expect(countOccurrences(consoleMessages, 'Displaying data:')).toBeGreaterThanOrEqual(2);
    expect(countOccurrences(consoleMessages, 'John: 25')).toBeGreaterThanOrEqual(2);
    expect(countOccurrences(consoleMessages, 'Alice: 30')).toBeGreaterThanOrEqual(2);

    // Ensure still no runtime page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Accessibility/interaction: keyboard activation (Enter) triggers displayData()', async ({ page }) => {
    // Comments: Validate that activating the button via keyboard triggers the same transition
    const { consoleMessages, pageErrors } = await attachObservers(page);

    await page.goto(APP_URL);

    const button = page.locator('.button');
    await button.focus();
    // Press Enter to activate the focused button
    await page.keyboard.press('Enter');

    await page.waitForTimeout(100);

    expect(consoleMessages).toContain('Displaying data:');
    expect(consoleMessages).toContain('John: 25');
    expect(consoleMessages).toContain('Alice: 30');

    expect(pageErrors.length).toBe(0);
  });

  test('Negative / error scenario checks: renderPage not present and no unexpected runtime errors on interactions', async ({ page }) => {
    // Comments: Validate FSM onEnter action renderPage() is not present, and confirm that no ReferenceError/SyntaxError/TypeError occurred
    const { consoleMessages, pageErrors } = await attachObservers(page);

    await page.goto(APP_URL);

    // Confirm renderPage is not implemented (so an FSM-specified entry_action is missing from the implementation)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Interact normally (click) to ensure missing renderPage did not cause runtime exceptions
    await page.click('.button');
    await page.waitForTimeout(100);

    // Confirm expected logs present
    expect(consoleMessages).toContain('Displaying data:');
    expect(consoleMessages).toContain('John: 25');
    expect(consoleMessages).toContain('Alice: 30');

    // There should be no page errors (no uncaught exceptions)
    expect(pageErrors.length).toBe(0);

    // Additionally assert that none of the captured page errors are ReferenceError/SyntaxError/TypeError
    for (const err of pageErrors) {
      const name = err.name || '';
      expect(['ReferenceError', 'SyntaxError', 'TypeError']).not.toContain(name);
    }
  });
});