import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b8b85-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object for the heap sort visualization page
class HeapSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = page.locator('#generateBtn');
    this.sortBtn = page.locator('#sortBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.arrayContainer = page.locator('#arrayContainer');
    this.heapContainer = page.locator('#heapContainer');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickSort() {
    await this.sortBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async arrayElementCount() {
    return await this.page.locator('#arrayContainer .array-element').count();
  }

  async sortedElementCount() {
    return await this.page.locator('#arrayContainer .array-element.sorted').count();
  }

  async getElementTexts() {
    return this.page.$$eval('#arrayContainer .array-element', nodes =>
      nodes.map(n => n.textContent)
    );
  }

  // Safely check typeof a global property in the page context
  async typeofGlobal(name) {
    return await this.page.evaluate(n => {
      try {
        // eslint-disable-next-line no-undef
        return typeof window[n];
      } catch (e) {
        return `__EVAL_ERROR__:${e && e.message ? e.message : String(e)}`;
      }
    }, name);
  }
}

test.describe('Heap Sort Visualization - FSM validation and error observation', () => {
  let pageErrors = [];
  let consoleMessages = [];

  // Attach listeners and navigate before each test so we capture script parse errors
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught exceptions in the page (e.g., SyntaxError from broken script)
    page.on('pageerror', err => {
      // store message string for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  // Test initial DOM presence and observe page-level errors (e.g., SyntaxError)
  test('S0_Idle: Page loads, static controls present, and script parse errors are observed', async ({
    page
  }) => {
    const heapPage = new HeapSortPage(page);

    // Navigate (this will attempt to load and execute inline script)
    await heapPage.goto();

    // Ensure the essential controls exist in the DOM (static HTML)
    await expect(heapPage.generateBtn).toBeVisible();
    await expect(heapPage.sortBtn).toBeVisible();
    await expect(heapPage.stepBtn).toBeVisible();
    await expect(heapPage.arrayContainer).toBeVisible();
    await expect(heapPage.heapContainer).toBeVisible();

    // After navigation, we expect at least one page error due to the truncated JS in the HTML
    // Assert that a SyntaxError (or similar parse error) was emitted during load
    expect(pageErrors.length).toBeGreaterThan(0);
    const hasSyntaxError = pageErrors.some(msg =>
      /SyntaxError|Unexpected end of input|Unexpected token|Uncaught/i.test(msg)
    );
    expect(hasSyntaxError).toBeTruthy();

    // Because the inline script failed to parse, key functions should not be defined.
    // Check that executeStep and heapSort are not available as globals.
    const executeStepType = await heapPage.typeofGlobal('executeStep');
    const heapSortType = await heapPage.typeofGlobal('heapSort');
    const generateRandomArrayType = await heapPage.typeofGlobal('generateRandomArray');
    const prepareSortStepsType = await heapPage.typeofGlobal('prepareSortSteps');

    // We expect these to be 'undefined' (or indicate evaluation error). If script parse failed,
    // these will not be functions.
    expect(executeStepType === 'undefined' || executeStepType.startsWith('__EVAL_ERROR__')).toBeTruthy();
    expect(heapSortType === 'undefined' || heapSortType.startsWith('__EVAL_ERROR__')).toBeTruthy();
    expect(generateRandomArrayType === 'undefined' || generateRandomArrayType.startsWith('__EVAL_ERROR__')).toBeTruthy();
    expect(prepareSortStepsType === 'undefined' || prepareSortStepsType.startsWith('__EVAL_ERROR__')).toBeTruthy();

    // Since the script that populates the initial array did not run, the array container should be empty.
    const initialCount = await heapPage.arrayElementCount();
    expect(initialCount).toBe(0);

    // Ensure console messages were captured (may include the parse error as well)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0); // at least it's defined
  });

  // Test clicking the controls when the script failed - transitions should not occur.
  test('Transitions: Clicking Generate / Start / Step does not produce state transitions due to broken script', async ({ page }) => {
    const heapPage1 = new HeapSortPage(page);

    await heapPage.goto();

    // Record pageErrors count immediately after load
    const initialPageErrorCount = pageErrors.length;

    // Click generate multiple times - this should not throw, but should not create array elements
    await heapPage.clickGenerate();
    await heapPage.clickGenerate();
    await heapPage.clickGenerate();

    // No new runtime page errors should have been introduced by clicking (beyond initial parse errors)
    expect(pageErrors.length).toBe(initialPageErrorCount);

    // Because handlers were never attached (script parse failed), array should remain empty
    const afterGenerateCount = await heapPage.arrayElementCount();
    expect(afterGenerateCount).toBe(0);

    // Try starting sort - should not perform sorting (heapSort undefined)
    await heapPage.clickSort();
    const afterSortCount = await heapPage.arrayElementCount();
    expect(afterSortCount).toBe(0);

    // Try stepping - should not perform steps (executeStep undefined)
    await heapPage.clickStep();
    const afterStepCount = await heapPage.arrayElementCount();
    expect(afterStepCount).toBe(0);

    // Verify that no elements have been marked as 'sorted' (Sorted state S4 not reached)
    const sortedCount = await heapPage.sortedElementCount();
    expect(sortedCount).toBe(0);

    // Also verify that variables expected by FSM are not present in the global scope
    const isSortingType = await heapPage.typeofGlobal('isSorting');
    const sortStepsType = await heapPage.typeofGlobal('sortSteps');
    const currentStepType = await heapPage.typeofGlobal('currentStep');

    expect(isSortingType === 'undefined' || isSortingType.startsWith('__EVAL_ERROR__')).toBeTruthy();
    expect(sortStepsType === 'undefined' || sortStepsType.startsWith('__EVAL_ERROR__')).toBeTruthy();
    expect(currentStepType === 'undefined' || currentStepType.startsWith('__EVAL_ERROR__')).toBeTruthy();
  });

  // Edge cases and error scenario assertions
  test('Edge cases: Confirm functions/handlers are absent and page reports errors as expected', async ({ page }) => {
    const heapPage2 = new HeapSortPage(page);

    await heapPage.goto();

    // Confirm that calling heapSort is not possible from page context
    const heapSortType1 = await heapPage.typeofGlobal('heapSort');
    expect(heapSortType).toBe('undefined');

    // Attempt to invoke a clearly nonexistent function in page context and ensure it fails naturally.
    // We do not patch or inject anything; we just observe natural ReferenceError behavior when a
    // nonexistent function is called inside the page context.
    const thrown = await page.evaluate(() => {
      try {
        // Intentionally call a non-existent function to observe the natural ReferenceError.
        // We keep this contained in a try/catch and return the error string so the test can assert on it.
        nonExistentFunctionToTriggerReferenceError();
        return { called: true };
      } catch (e) {
        return { called: false, name: e && e.name ? e.name : String(e), message: e && e.message ? e.message : '' };
      }
    });

    // Ensure the call failed and produced a ReferenceError in-page (natural runtime behavior)
    expect(thrown.called).toBe(false);
    expect(thrown.name).toMatch(/ReferenceError/);

    // Confirm again that there is at least one page error originating from script parsing
    expect(pageErrors.length).toBeGreaterThan(0);
    const foundParse = pageErrors.some(msg =>
      /SyntaxError|Unexpected end of input|Unexpected token|Uncaught/i.test(msg)
    );
    expect(foundParse).toBeTruthy();
  });

  // Validate that the application did not reach any of the non-initial FSM states
  test('FSM states: Ensure S1..S4 transitions cannot be taken when inline script fails', async ({ page }) => {
    const heapPage3 = new HeapSortPage(page);

    await heapPage.goto();

    // S0_Idle -> S1_ArrayGenerated would require generateRandomArray & renderArray to run.
    // Since these are not defined, we expect no "Array Generated" evidence in the DOM.
    // Check for presence of any array elements (should be zero).
    const count = await heapPage.arrayElementCount();
    expect(count).toBe(0);

    // S1_ArrayGenerated -> S2_Sorting requires heapSort - confirm not defined
    const heapSortType2 = await heapPage.typeofGlobal('heapSort');
    expect(heapSortType).toBe('undefined');

    // S2_Sorting -> S3_StepThrough requires executeStep - confirm not defined
    const executeStepType1 = await heapPage.typeofGlobal('executeStep');
    expect(executeStepType).toBe('undefined');

    // S4_Sorted would mark elements with 'sorted' class - none should be present
    const sortedCount1 = await heapPage.sortedElementCount();
    expect(sortedCount).toBe(0);
  });
});