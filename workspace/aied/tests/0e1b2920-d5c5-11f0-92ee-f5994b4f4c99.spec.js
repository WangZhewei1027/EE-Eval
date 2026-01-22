import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e1b2920-d5c5-11f0-92ee-f5994b4f4c99.html';

// Page Object for the KNN app
class KNNPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.x = page.locator('#x');
    this.y = page.locator('#y');
    this.k = page.locator('#k');
    this.distance = page.locator('#distance');
    this.result = page.locator('#result');
    this.showButton = page.locator('button[onclick="showKnn()"]');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillInputs({ x, y, k, distance }) {
    if (typeof x !== 'undefined') {
      await this.x.fill(String(x));
    }
    if (typeof y !== 'undefined') {
      await this.y.fill(String(y));
    }
    if (typeof k !== 'undefined') {
      await this.k.fill(String(k));
    }
    if (typeof distance !== 'undefined') {
      await this.distance.fill(String(distance));
    }
  }

  async clickShow() {
    await this.showButton.click();
  }

  async getResultValue() {
    // inputs use .value; innerHTML is incorrect in implementation, but we assert what actual DOM shows
    return await this.result.evaluate((el) => el.value);
  }

  async hasOnclickAttribute() {
    return await this.showButton.getAttribute('onclick');
  }

  async getPlaceholder(selector) {
    return await this.page.locator(selector).getAttribute('placeholder');
  }
}

test.describe('KNN FSM and Implementation Tests - 0e1b2920-d5c5-11f0-92ee-f5994b4f4c99', () => {
  let page;
  let knn;
  let consoleMessages;
  let pageErrors;

  // Setup: navigate to the app and collect console/pageerror events
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    knn = new KNNPage(page);
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await knn.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('S0_Idle: Page renders required inputs and button with expected placeholders and onclick evidence', async () => {
    // Verify all input fields are present
    await expect(knn.x).toBeVisible();
    await expect(knn.y).toBeVisible();
    await expect(knn.k).toBeVisible();
    await expect(knn.distance).toBeVisible();
    await expect(knn.result).toBeVisible();

    // Verify placeholders match the FSM evidence
    await expect(await knn.getPlaceholder('#x')).toBe('Enter X coordinates');
    await expect(await knn.getPlaceholder('#y')).toBe('Enter Y coordinates');
    await expect(await knn.getPlaceholder('#k')).toBe('Enter Number of neighbors');
    await expect(await knn.getPlaceholder('#distance')).toBe('Enter Distance from point to each neighbor');
    await expect(await knn.getPlaceholder('#result')).toBe('Enter Result');

    // Verify the Show KNN button exists and has the onclick handler evidence in the attribute
    const onclickAttr = await knn.hasOnclickAttribute();
    expect(onclickAttr).toBe('showKnn()');

    // The FSM entry action mentions renderPage(); the implementation does NOT define or call renderPage.
    // Validate that no global renderPage function exists (we do not inject anything).
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // On initial load, ensure no runtime errors occurred yet (showKnn not invoked)
    expect(pageErrors.length).toBe(0);

    // Also capture that console didn't log errors on load
    const errorConsole = consoleMessages.find((c) => c.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test('S1_ShowKnn: Clicking Show KNN with valid numeric inputs triggers runtime error (implementation bug) and does not set result value', async () => {
    // Comments: This test validates the transition from Idle -> ShowKnn. The implementation contains bugs:
    // - It treats x and y as arrays (x[i]) although they are numbers/strings
    // - calculateDistance references undefined variable d2
    // We therefore expect a runtime error to be emitted when Show KNN is clicked with values that cause loops to run.

    // Fill inputs with numeric values that will make the loops execute and lead to runtime errors.
    await knn.fillInputs({ x: 3, y: 3, k: 2, distance: '1,2,3' });

    // Prepare to await a pageerror event that the buggy code will emit when invoked.
    const waitForError = page.waitForEvent('pageerror');

    // Click the Show KNN button to trigger the faulty logic.
    await knn.clickShow();

    // Wait for the pageerror to be emitted
    const err = await waitForError;

    // Validate that an error occurred and contains information about the bug.
    // It could be a TypeError (accessing properties of undefined) or a ReferenceError (d2 undefined).
    expect(err).toBeTruthy();
    const errMessage = String(err.message || err);
    expect(
      /d2|ReferenceError|Cannot read properties|TypeError/i.test(errMessage)
    ).toBeTruthy();

    // The implementation attempts to set innerHTML on an input element. The input's value should remain unchanged.
    const resultValue = await knn.getResultValue();
    expect(resultValue).toBe('');

    // Ensure the console captured the error as well (at least one console error or page error exists)
    const consoleError = consoleMessages.find((c) => c.type === 'error');
    // consoleError may or may not be present depending on how the browser surfaces the error;
    // assert that at least the page error list contains at least one entry.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Edge case: Clicking Show KNN with empty inputs should not throw and should leave result unchanged', async () => {
    // Comments: When inputs are empty, Math.pow("" , 2) => 0, loops won't run and calculateDistance won't be called.
    // Therefore no runtime error should be produced, and the result input remains unchanged.

    // Ensure inputs are empty
    await knn.fillInputs({ x: '', y: '', k: '', distance: '' });

    // Clear any previously collected errors
    pageErrors.length = 0;
    consoleMessages.length = 0;

    // Click the button
    await knn.clickShow();

    // Wait a short time to allow any unexpected asynchronous errors to surface
    await page.waitForTimeout(250);

    // Assert no page errors occurred
    expect(pageErrors.length).toBe(0);

    // The implementation tries to set innerHTML on the input; input.value should remain empty string
    const resultValue = await knn.getResultValue();
    expect(resultValue).toBe('');
  });

  test('Direct invocation of calculateDistance with malformed args triggers ReferenceError for d2 (observed runtime bug)', async () => {
    // Comments: We directly call calculateDistance in an async timeout so that the function executes in the page context
    // and any uncaught exception becomes a pageerror which Playwright can observe.
    pageErrors.length = 0;

    // Schedule an asynchronous call that will throw (because it references d2)
    await page.evaluate(() => {
      setTimeout(() => {
        // Calling with mismatched objects (one has x only, the other has y only) will lead to d2 being referenced
        // inside the function and thus a ReferenceError.
        // We deliberately do not catch this to let it surface as a page-level uncaught error.
        window.calculateDistance({ x: 1 }, { y: 2 });
      }, 0);
    });

    // Await the pageerror that should be produced by the function
    const err = await page.waitForEvent('pageerror');

    // Validate the error message mentions d2 or a ReferenceError
    const errMessage = String(err.message || err);
    expect(/d2|ReferenceError/i.test(errMessage)).toBeTruthy();

    // Also ensure we captured an error in the pageErrors array via the listener
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('FSM transition evidence: ShowKnn event exists and is wired to the button (onclick attribute present)', async () => {
    // Comments: This test double-checks the FSM evidence that the button click event is present
    // and wired via onclick="showKnn()". We already asserted attribute earlier, but we also assert the function exists.
    const onclick = await knn.hasOnclickAttribute();
    expect(onclick).toBe('showKnn()');

    // Verify that the global showKnn function is defined (it should be, per implementation)
    const hasShowKnn = await page.evaluate(() => typeof window.showKnn === 'function');
    expect(hasShowKnn).toBe(true);
  });
});