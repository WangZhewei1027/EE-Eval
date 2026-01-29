import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/ca78d700-fa75-11f0-9854-e7309e7cf385.html';

// Page Object for the interactive page
class FloydWarshallPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // locator for the button that has the onclick attribute: the main action in FSM
    this.mainPrintButton = page.locator('button[onclick="printDistance()"]');
    // locator for the table-embedded button that does NOT have onclick
    this.tablePrintButton = page.locator('table button[type="button"]');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickMainPrint() {
    await this.mainPrintButton.click();
  }

  async clickTablePrint() {
    await this.tablePrintButton.click();
  }

  async hasMainPrintButton() {
    return await this.mainPrintButton.count();
  }

  async hasTablePrintButton() {
    return await this.tablePrintButton.count();
  }

  async hasOutputNode() {
    return await this.page.evaluate(() => document.getElementById('output_node') !== null);
  }

  async isPrintDistanceDefined() {
    return await this.page.evaluate(() => typeof window.printDistance === 'function');
  }

  async isRenderPageDefined() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }
}

test.describe('FSM: Floyd-Warshall Application (ca78d700-fa75-11f0-9854-e7309e7cf385)', () => {
  // Collect console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // no-op here; individual tests set up listeners to capture errors/messages as needed
  });

  // Test the initial Idle state (S0_Idle)
  test('Initial state S0_Idle: page loads and Print Distance button is present; renderPage is not defined', async ({ page }) => {
    // Collect page errors and console messages that happen during load
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => {
      // capture page-level unhandled exceptions
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    const pageModel = new FloydWarshallPage(page);
    await pageModel.goto();

    // Verify the main Print Distance button (the one wired to printDistance()) exists exactly once
    const mainButtonCount = await pageModel.hasMainPrintButton();
    expect(mainButtonCount).toBe(1);

    // Verify there's a table-embedded Print Distance button as well (different control)
    const tableButtonCount = await pageModel.hasTablePrintButton();
    expect(tableButtonCount).toBeGreaterThanOrEqual(1);

    // FSM specified an onEnter renderPage() for S0_Idle. The implementation does NOT define renderPage.
    // Assert that renderPage is not defined (i.e., the onEnter action is missing in the implementation).
    const renderPageDefined = await pageModel.isRenderPageDefined();
    expect(renderPageDefined).toBe(false);

    // No errors should have occurred just from loading the page (renderPage absence is allowed but not invoked).
    expect(pageErrors.length).toBe(0);

    // There may be console logs but we assert there were no console messages of type 'error' emitted during load.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test the transition triggered by clicking the Print Distance button (PrintDistance event)
  test('Transition: clicking Print Distance invokes printDistance() and results in a page error due to missing DOM nodes (S0_Idle -> S1_DistancePrinted)', async ({ page }) => {
    // Collect page errors and console messages
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    const pageModel = new FloydWarshallPage(page);
    await pageModel.goto();

    // Ensure printDistance function exists on the page (the onclick attribute points to it)
    const printDistanceDefined = await pageModel.isPrintDistanceDefined();
    expect(printDistanceDefined).toBe(true);

    // Confirm output_node does not exist before clicking (implementation lacks it)
    const outputExistsBefore = await pageModel.hasOutputNode();
    expect(outputExistsBefore).toBe(false);

    // Click the main button and wait for the pageerror event that the broken implementation will generate.
    // The implementation attempts to set innerHTML on a non-existent #output_node resulting in a TypeError.
    const [error] = await Promise.all([
      // Wait for the pageerror event that is expected when the function runs.
      page.waitForEvent('pageerror'),
      // Trigger the transition by clicking the button
      pageModel.clickMainPrint(),
    ]);

    // Validate that an error happened and it is a TypeError about setting innerHTML on null/missing element
    // The exact message varies across engines, check for common patterns.
    expect(error).toBeDefined();
    expect(typeof error.message).toBe('string');
    const message = error.message;
    // Accept either "Cannot set properties of null (setting 'innerHTML')" or
    // "Cannot set property 'innerHTML' of null" or similar.
    const matchesExpected = /innerHTML/i.test(message) && /null/i.test(message) || /Cannot set properties of null/i.test(message) || /Cannot read properties of null/i.test(message) || /Cannot set property 'innerHTML' of null/i.test(message);
    expect(matchesExpected).toBe(true);

    // After the error, confirm that #output_node still does not exist (so FSM expected observable is not achieved).
    const outputExistsAfter = await pageModel.hasOutputNode();
    expect(outputExistsAfter).toBe(false);

    // Also check captured console messages for an error-level entry related to the problem (if any)
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error' || /error/i.test(m.text));
    // It's acceptable for there to be 0 or more; when present, ensure they reference 'innerHTML' or 'output_node' or 'printDistance'
    if (errorConsoleMessages.length > 0) {
      const someRelevant = errorConsoleMessages.some((m) =>
        /innerHTML|output_node|printDistance|TypeError/i.test(m.text)
      );
      expect(someRelevant).toBe(true);
    }
  });

  // Edge case: clicking the other Print Distance button (the one without onclick) should NOT invoke printDistance nor cause errors
  test('Edge case: clicking the table Print Distance button (no onclick) does not invoke printDistance and causes no page errors', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const pageModel = new FloydWarshallPage(page);
    await pageModel.goto();

    // Confirm the table button exists
    const tableButtonCount = await pageModel.hasTablePrintButton();
    expect(tableButtonCount).toBeGreaterThanOrEqual(1);

    // Record current page error count
    const beforeErrors = pageErrors.length;

    // Click the table button (it has no onclick attribute in the HTML provided)
    await pageModel.clickTablePrint();

    // Allow a small delay for any potential asynchronous errors to surface
    await page.waitForTimeout(200);

    // Assert no new page errors were produced by clicking the inert table button
    const afterErrors = pageErrors.length;
    expect(afterErrors).toBe(beforeErrors);
  });

  // Verify that invoking the missing renderPage() on enter would produce a ReferenceError (the FSM mentioned renderPage on enter)
  test('FSM onEnter action renderPage(): invoking missing renderPage() throws ReferenceError', async ({ page }) => {
    const pageModel = new FloydWarshallPage(page);
    await pageModel.goto();

    // Attempt to call renderPage() in page context and capture the thrown error
    const result = await page.evaluate(() => {
      try {
        // Intentionally call the non-existent renderPage to observe the natural ReferenceError
        // We do not patch or define anything; we let the runtime produce the error naturally.
        // This is to validate that the declared onEnter action in the FSM is not present in the implementation.
        renderPage();
        return { succeeded: true };
      } catch (e) {
        // Return the error details so the test can assert on them.
        return { succeeded: false, name: e.name, message: e.message, toString: e.toString() };
      }
    });

    // Expect the call to have failed with a ReferenceError indicating renderPage is not defined
    expect(result.succeeded).toBe(false);
    expect(result.name).toBe('ReferenceError');
    // message should include 'renderPage' or 'is not defined'
    expect(/renderPage/i.test(result.message) || /is not defined/i.test(result.message)).toBe(true);
  });

  // Direct invocation of printDistance should reproduce the same runtime error as clicking the button (TypeError due to missing #output_node)
  test('Direct invocation of printDistance() throws a runtime TypeError due to missing output_node', async ({ page }) => {
    const pageModel = new FloydWarshallPage(page);
    await pageModel.goto();

    // Sanity: ensure printDistance exists
    const exists = await pageModel.isPrintDistanceDefined();
    expect(exists).toBe(true);

    // Invoke printDistance directly and capture exception details
    const result = await page.evaluate(() => {
      try {
        printDistance();
        return { succeeded: true };
      } catch (e) {
        // Return structured error data for assertions
        return { succeeded: false, name: e.name, message: e.message, toString: e.toString() };
      }
    });

    expect(result.succeeded).toBe(false);
    // The broken implementation should attempt to write to document.getElementById('output_node').innerHTML, causing TypeError
    expect(result.name).toBe('TypeError');
    // The message should indicate null and innerHTML reference
    expect(/innerHTML/i.test(result.message) || /null/i.test(result.message) || /Cannot read properties of null/i.test(result.message)).toBe(true);
  });
});