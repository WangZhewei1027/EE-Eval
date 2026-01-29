import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b03562-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Heap (Min) explanation application
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.textSelector = '#text';
    this.buttonSelector = '#demonstration-button';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getTextTrimmed() {
    // innerText/innerHTML includes trailing space in implementation; trim for stable assertions
    const content = await this.page.locator(this.textSelector).innerText();
    return content.trim();
  }

  async clickDemonstration() {
    await this.page.click(this.buttonSelector);
  }

  async isButtonVisible() {
    return this.page.locator(this.buttonSelector).isVisible();
  }

  async waitForText() {
    await this.page.waitForSelector(this.textSelector);
  }
}

test.describe('Heap (Min) Explanation - FSM and UI tests', () => {
  // Expected outputs derived from the provided implementation:
  // After initial buildMinHeap + printMinHeap on the supplied array:
  const EXPECTED_INITIAL_HEAP = '1 2 9 6 4 12 13 10 7 5 23';
  // After clicking demonstration button, printMinHeap(newArray) prints newArray as-is:
  const EXPECTED_NEW_HEAP = '1 5 3 6 7 8 2 4';

  test('Initial state (S0_Initial) on page load prints the built min heap', async ({ page }) => {
    // Validate that entry actions buildMinHeap(array) and printMinHeap(array) have executed on load.
    const heapPage = new HeapPage(page);

    // Collect any page errors or console messages during navigation
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    const consoleMessages = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    await heapPage.goto();

    // Wait for the #text element to be present and populated
    await heapPage.waitForText();

    // The application should show the min heap produced by buildMinHeap(array) then printMinHeap(array)
    const displayed = await heapPage.getTextTrimmed();
    expect(displayed).toBe(EXPECTED_INITIAL_HEAP);

    // The demonstration button should be present and visible
    expect(await heapPage.isButtonVisible()).toBe(true);

    // Assert that no unexpected uncaught page errors occurred during normal load
    expect(pageErrors.length, 'No uncaught page errors should occur during initial load').toBe(0);

    // There may be no console output; ensure no severe console errors were emitted
    const severeConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(severeConsole.length, 'No severe console messages expected on normal load').toBe(0);
  });

  test('Transition (DemonstrateMinHeap): clicking the button enters S1_Demonstrating and prints new min heap', async ({ page }) => {
    // Validate the transition from S0_Initial -> S1_Demonstrating when the button is clicked.
    const heapPage = new HeapPage(page);

    // Track page errors and console messages during the interaction
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    const consoleMessages = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    await heapPage.goto();
    await heapPage.waitForText();

    // Precondition: initial heap shown
    const before = await heapPage.getTextTrimmed();
    expect(before).toBe(EXPECTED_INITIAL_HEAP);

    // Trigger the event described in the FSM: click #demonstration-button
    await heapPage.clickDemonstration();

    // After click, the page should show the new array printed by printMinHeap(newArray)
    // The implementation prints the array as provided (no heapify performed on newArray)
    const after = await heapPage.getTextTrimmed();
    expect(after).toBe(EXPECTED_NEW_HEAP);

    // No uncaught page errors should have occurred as part of this normal transition
    expect(pageErrors.length, 'No uncaught page errors during transition').toBe(0);

    // No severe console messages expected during this user action
    const severeConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(severeConsole.length, 'No severe console messages during transition').toBe(0);
  });

  test('Clicking the Demonstrate button multiple times is idempotent for the printed output', async ({ page }) => {
    // Edge case: ensure repeated clicks produce the same printed newArray and do not accumulate or corrupt the display.
    const heapPage = new HeapPage(page);

    await heapPage.goto();
    await heapPage.waitForText();

    // First click
    await heapPage.clickDemonstration();
    const first = await heapPage.getTextTrimmed();
    expect(first).toBe(EXPECTED_NEW_HEAP);

    // Second click: should print the same content again (overwriting the same element)
    await heapPage.clickDemonstration();
    const second = await heapPage.getTextTrimmed();
    expect(second).toBe(EXPECTED_NEW_HEAP);

    // Ensure no unexpected trailing characters beyond what printMinHeap produces
    // (trimmed comparisons above ensure no leading/trailing whitespace issues)
  });

  test('DOM structure verification: #text and #demonstration-button exist and have expected roles', async ({ page }) => {
    // Verify presence and basic properties of the two main components described in the FSM.
    const heapPage = new HeapPage(page);

    await heapPage.goto();
    await heapPage.waitForText();

    const textHandle = page.locator('#text');
    const buttonHandle = page.locator('#demonstration-button');

    await expect(textHandle).toBeVisible();
    await expect(buttonHandle).toBeVisible();
    await expect(buttonHandle).toHaveText('Demonstrate Min Heap');
  });

  test('Error scenario: invoking a nonexistent global causes a ReferenceError and is observable via pageerror', async ({ page }) => {
    // This test intentionally invokes a missing function in the page context to validate that
    // ReferenceError/uncaught exceptions are observed by the test harness and reported via pageerror.
    const heapPage = new HeapPage(page);

    await heapPage.goto();
    await heapPage.waitForText();

    const pageErrors = [];
    page.on('pageerror', (err) => {
      // Capture the serialized error message for assertions
      try {
        pageErrors.push(err && err.message ? String(err.message) : String(err));
      } catch {
        pageErrors.push(String(err));
      }
    });

    // Attempt to evaluate a call to an undefined function in the page context.
    // This should naturally raise a ReferenceError in the page and cause page.evaluate to reject.
    let evaluationError = null;
    try {
      // This call intentionally references an identifier that does not exist in the page.
      await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        return nonexistentFunction();
      });
      // If no error thrown, force a failure
      throw new Error('Expected page.evaluate to throw a ReferenceError for nonexistentFunction, but it did not.');
    } catch (err) {
      // Capture the thrown error from Playwright's evaluation
      evaluationError = err;
    }

    // The evaluation should have thrown an error
    expect(evaluationError, 'page.evaluate should throw when calling an undefined function').not.toBeNull();

    // The error message coming from the page context typically mentions ReferenceError and "not defined"
    const errMsg = String(evaluationError && evaluationError.message ? evaluationError.message : evaluationError);
    // Validate that it is a ReferenceError originating from the page context
    expect(
      errMsg.toLowerCase(),
      'Evaluation error message should indicate a ReferenceError or "not defined"'
    ).toMatch(/referenceerror|not defined|is not defined/);

    // The pageerror listener should have captured at least one error event from the page
    expect(pageErrors.length, 'pageerror should be triggered for uncaught ReferenceError in page context').toBeGreaterThanOrEqual(1);

    // Confirm the captured page error message also references the undefined identifier
    const captured = pageErrors.join(' ');
    expect(captured.toLowerCase()).toMatch(/nonexistentfunction|not defined|referenceerror/);
  });
});