import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/718ce440-d362-11f0-85a0-d3271c47ca09.html';

// Page Object for the KNN page
class KNNPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async distanceInput() {
    return this.page.locator('#distance');
  }

  async queryInput() {
    return this.page.locator('#query');
  }

  async submitButton() {
    // The button has no id but is a submit button in the form
    return this.page.locator("button[type='submit']");
  }

  async resultDiv() {
    return this.page.locator('#result');
  }

  // Helper to set inputs
  async fillInputs(distance, query) {
    await (await this.distanceInput()).fill(String(distance));
    await (await this.queryInput()).fill(query);
  }

  // Click the calculate button. It may trigger a navigation (form submit),
  // so caller can await navigation if desired.
  async clickCalculate() {
    await (await this.submitButton()).click();
  }

  // Dispatch an input event on a selector (simulate typing or change)
  async dispatchInputEventOn(selector) {
    await this.page.$eval(selector, (el) => {
      const evt = new Event('input', { bubbles: true, cancelable: true });
      el.dispatchEvent(evt);
    });
  }
}

test.describe('K-Nearest Neighbors Application (FSM validation)', () => {
  // Arrays to capture page errors and console messages across each test run
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture unhandled errors from the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // Save the Error object for assertions
      pageErrors.push(err);
    });

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the app
    const knn = new KNNPage(page);
    await knn.goto();

    // Wait a short moment to let any synchronous script errors surface
    await page.waitForTimeout(200);
  });

  test.afterEach(async ({ page }) => {
    // ensure page listeners are cleared by closing the page frame context if needed
    // (Playwright takes care of cleaning up, this is just to signal end of test)
    await page.close();
  });

  test('Initial Idle state: form and UI elements are present and well-formed', async ({ page }) => {
    // Validate that the initial Idle state's evidence exists in the DOM:
    // - form with id knn-form
    // - distance input (#distance) with type/attributes
    // - query textarea (#query)
    // - submit button with text "Calculate"
    // - result div (#result)
    const knn = new KNNPage(page);

    const distance = await knn.distanceInput();
    const query = await knn.queryInput();
    const button = await knn.submitButton();
    const result = await knn.resultDiv();

    // Assert DOM nodes exist
    await expect(distance).toBeVisible();
    await expect(query).toBeVisible();
    await expect(button).toBeVisible();
    await expect(result).toBeVisible();

    // Assert attributes match FSM component evidence
    await expect(distance).toHaveAttribute('type', 'number');
    await expect(distance).toHaveAttribute('min', '1');
    await expect(distance).toHaveAttribute('max', '100');

    // Button text should match the evidence in FSM
    await expect(button).toHaveText('Calculate');

    // Result should be empty initially (Idle state)
    await expect(result).toHaveText('');
  });

  test('Page script contains runtime errors on load (expected broken JS)', async ({ page }) => {
    // This application has a script that references an element by id 'calculate' that does not exist,
    // causing a TypeError during initial script execution. We must observe and assert those errors occur.
    // Validate that at least one pageerror was captured and that it mentions addEventListener / cannot read property.
    // We do not attempt to patch or fix the runtime; we assert the broken behavior as-is.

    // Wait a short while to ensure errors are captured
    await page.waitForTimeout(100);

    // There should be at least one page error
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Validate the first error message includes text indicating failure to attach addEventListener to null
    const errorMessage = String(pageErrors[0].message || pageErrors[0]);
    const expectedSubstrings = [
      'addEventListener', // the failing call
      'Cannot read',      // common phrasing in some engines
      'null',             // reading of null
      'of null',          // alternate phrasing
    ];

    // At least one of the substrings should be present in the message
    const containsExpected = expectedSubstrings.some((s) => errorMessage.includes(s));
    expect(containsExpected).toBeTruthy();

    // Also assert console may have logged errors (some errors surface in console as well)
    const consoleErrorTexts = consoleMessages.map((m) => m.text).join('\n');
    const consoleHasAddListener = consoleErrorTexts.includes('addEventListener') || consoleErrorTexts.includes('Cannot read');
    // It's acceptable if console doesn't include it, but prefer it to; so we assert either pageError already proved the problem.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1); // reaffirm
  });

  test('Submitting the form (Calculate) does not produce valid results due to broken script and preserves DOM', async ({ page }) => {
    // This test validates the CalculateSubmit event path in the FSM. The implementation is broken
    // (no calculateButton element with id 'calculate' -> TypeError at load). Submitting should not produce valid nearest neighbor output.
    // We assert that:
    // - attempting to submit the form does not populate #result with computed neighbors
    // - the calculate button text remains unchanged (since the input handler that would set it never attached)
    // - the original page error remains observable (or reoccurs on reload)

    const knn = new KNNPage(page);

    // Fill inputs with plausible values
    await knn.fillInputs(5, 'some-query');

    // Sanity check: inputs contain our values before submit
    await expect(await knn.distanceInput().then(l => l.inputValue())).resolves.toBe('5');
    await expect(await knn.queryInput().then(l => l.inputValue())).resolves.toBe('some-query');

    // Click the calculate button. It is a submit button; clicking may trigger navigation (form submit).
    // We attempt to capture navigation but guard against timeout if it doesn't navigate.
    let navigated = false;
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 1500 }).then(() => { navigated = true; }).catch(() => {}),
        knn.clickCalculate(),
      ]);
    } catch (e) {
      // If click triggers nothing special, ignore and continue to assertions.
    }

    // Wait briefly to let any script (including re-run on navigation) emit errors
    await page.waitForTimeout(200);

    // The result div should remain empty (no valid nearestNeighbors computed)
    const resultText = await (await knn.resultDiv()).innerText();
    expect(resultText).toBe('', 'Expected no computed nearest neighbors due to broken implementation');

    // The submit button should still display "Calculate" (the input handler that would change it was never attached)
    await expect(await knn.submitButton()).toHaveText('Calculate');

    // Ensure at least one page error exists (initial load or reload)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // If navigation occurred (page reloaded on submit), the same TypeError should reappear on the new load
    if (navigated) {
      // Wait a bit to capture any new errors from the reload
      await page.waitForTimeout(100);
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('Changing inputs does not trigger reset behavior (input handler never attached)', async ({ page }) => {
    // According to the FSM, input changes should trigger a resetInputs() and clear the inputs.
    // The actual implementation attempted to attach a form input listener after a critical TypeError
    // and thus the input listener was never attached. Validate that changing inputs does NOT clear them.

    const knn = new KNNPage(page);

    // Set values
    await knn.fillInputs(42, 'test-query');

    // Dispatch an 'input' event on #distance (would have triggered handler if attached)
    await knn.dispatchInputEventOn('#distance');

    // Wait briefly to allow any handler to run (if it existed)
    await page.waitForTimeout(100);

    // Assert the inputs still contain our values (i.e., they were not reset)
    const distanceValue = await (await knn.distanceInput()).inputValue();
    const queryValue = await (await knn.queryInput()).inputValue();

    expect(distanceValue).toBe('42', 'Distance input should remain unchanged because input handler is not attached');
    expect(queryValue).toBe('test-query', 'Query textarea should remain unchanged because input handler is not attached');

    // Also, the submit button text should not have been overwritten by the non-existent handler
    await expect(await knn.submitButton()).toHaveText('Calculate');
  });

  test('Reloading the page produces the same runtime error again (regression check)', async ({ page }) => {
    // Reload the page and assert that the same TypeError (attempt to call addEventListener on null) occurs again.
    // This validates the onEnter action of the Calculating state is not reachable and the initial script error is reproducible.

    // Clear previous captures
    pageErrors.length = 0;
    consoleMessages.length = 0;

    // Reload
    await page.reload({ waitUntil: 'load' });

    // Give some time for synchronous script execution and errors to appear
    await page.waitForTimeout(200);

    // Expect at least one error upon reload
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    const msg = String(pageErrors[0].message || pageErrors[0]);
    // The message should indicate the failure to attach addEventListener to a missing element
    const hasAddEventListener = msg.includes('addEventListener') || msg.includes('addEventListe') || msg.includes('Cannot read');
    expect(hasAddEventListener).toBeTruthy();
  });
});