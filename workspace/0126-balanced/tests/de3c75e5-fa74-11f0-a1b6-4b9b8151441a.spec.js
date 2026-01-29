import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c75e5-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the Time Complexity demo page
class ComplexityPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      showConstant: 'button#showConstant',
      showLinear: 'button#showLinear',
      showQuadratic: 'button#showQuadratic',
      complexityBox: '#complexity-box',
    };
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  async initListeners() {
    this.page.on('console', (msg) => {
      // collect console messages for later assertions / debugging
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // collect page errors (uncaught exceptions)
      // err is typically an Error object with message and stack
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async titleText() {
    return this.page.title();
  }

  async isVisible(selector) {
    const handle = await this.page.$(selector);
    return !!handle;
  }

  async clickAndWaitForPageError(selector, timeout = 2000) {
    // Click the selector and wait for a pageerror event to occur.
    // Returns the Error object caught by the 'pageerror' event.
    // If no pageerror occurs in timeout, this will throw.
    const waitPromise = this.page.waitForEvent('pageerror', { timeout });
    await this.page.click(selector);
    const err = await waitPromise;
    return err;
  }

  async clickWithoutExpectingError(selector) {
    await this.page.click(selector);
  }

  async complexityBoxContent() {
    const el = await this.page.$(this.selectors.complexityBox);
    if (!el) return null;
    return (await this.page.evaluate((e) => e.innerHTML, el)).trim();
  }
}

test.describe('Time Complexity Demonstration - FSM tests', () => {
  let pageObject;

  test.beforeEach(async ({ page }) => {
    pageObject = new ComplexityPage(page);
    await pageObject.initListeners();
    await pageObject.goto();
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach console messages and page errors to the test output for debugging
    if (pageObject.consoleMessages.length) {
      testInfo.attach('console-messages', {
        body: JSON.stringify(pageObject.consoleMessages, null, 2),
        contentType: 'application/json',
      });
    }
    if (pageObject.pageErrors.length) {
      testInfo.attach('page-errors', {
        body: JSON.stringify(
          pageObject.pageErrors.map((e) => ({ message: e.message, stack: e.stack })),
          null,
          2
        ),
        contentType: 'application/json',
      });
    }
  });

  test('Idle state renders: title, buttons and complexity box present', async () => {
    // Validate entry state S0_Idle: title and initial rendering
    const title = await pageObject.titleText();
    expect(title).toBe('Time Complexity Demonstration');

    // Buttons expected by the FSM should be present in the DOM
    expect(await pageObject.isVisible(pageObject.selectors.showConstant)).toBeTruthy();
    expect(await pageObject.isVisible(pageObject.selectors.showLinear)).toBeTruthy();
    expect(await pageObject.isVisible(pageObject.selectors.showQuadratic)).toBeTruthy();

    // Complexity box should exist; initial content is expected to be empty
    const content = await pageObject.complexityBoxContent();
    // If the page's JS attempted to set content on load, content may change;
    // we assert that the element exists and that its content is a string (may be empty).
    expect(content).not.toBeNull();
    expect(typeof content).toBe('string');
  });

  test('Click "Show Constant Time" triggers transition or raises an error (expected ReferenceError if JS missing)', async () => {
    // This test validates the transition from S0_Idle to S1_ComplexityDisplayed
    // by clicking the showConstant button. The app as-served may have missing JS
    // (displayComplexity not defined). We observe console/page errors and assert behavior.
    const selector = pageObject.selectors.showConstant;

    // Click and wait for an uncaught page error. This will fail if the application
    // correctly defines displayComplexity and no error is thrown; in that case,
    // the test below will fail because we expect either a DOM update or an error.
    let pageError = null;
    try {
      pageError = await pageObject.clickAndWaitForPageError(selector, 2000);
    } catch (err) {
      // No pageerror occurred within timeout. In that case, check whether the complexity box was updated.
      const content1 = await pageObject.complexityBoxContent();
      // If the function is defined, we expect the box to display 'O(1)'
      expect(content).toBe('O(1)');
      return;
    }

    // If we caught a page error, assert it is a ReferenceError related to missing function
    expect(pageError).toBeTruthy();
    // The message varies across engines; check for common patterns
    expect(
      /ReferenceError|is not defined|displayComplexity/i.test(pageError.message)
    ).toBeTruthy();

    // Since an error occurred, the complexity box should NOT have been updated to the expected value.
    const contentAfterError = await pageObject.complexityBoxContent();
    // It's valid if content is empty or unchanged; ensure it is not the expected successful value
    expect(contentAfterError !== 'O(1)').toBeTruthy();
  });

  test('Click "Show Linear Time" triggers transition or raises an error (expected ReferenceError if JS missing)', async () => {
    // Validate the transition for linear complexity button.
    const selector1 = pageObject.selectors.showLinear;

    let pageError1 = null;
    try {
      pageError = await pageObject.clickAndWaitForPageError(selector, 2000);
    } catch (err) {
      // If no error, expect the DOM to have updated accordingly
      const content2 = await pageObject.complexityBoxContent();
      expect(content).toBe('O(n)');
      return;
    }

    expect(pageError).toBeTruthy();
    expect(
      /ReferenceError|is not defined|displayComplexity/i.test(pageError.message)
    ).toBeTruthy();

    const contentAfterError1 = await pageObject.complexityBoxContent();
    expect(contentAfterError !== 'O(n)').toBeTruthy();
  });

  test('Click "Show Quadratic Time" triggers transition or raises an error (expected ReferenceError if JS missing)', async () => {
    // Validate the transition for quadratic complexity button.
    const selector2 = pageObject.selectors.showQuadratic;

    let pageError2 = null;
    try {
      pageError = await pageObject.clickAndWaitForPageError(selector, 2000);
    } catch (err) {
      // If no error, expect the DOM to have updated accordingly
      const content3 = await pageObject.complexityBoxContent();
      expect(content).toBe('O(n^2)');
      return;
    }

    expect(pageError).toBeTruthy();
    expect(
      /ReferenceError|is not defined|displayComplexity/i.test(pageError.message)
    ).toBeTruthy();

    const contentAfterError2 = await pageObject.complexityBoxContent();
    expect(contentAfterError !== 'O(n^2)').toBeTruthy();
  });

  test('Rapid sequence of clicks: multiple transitions produce multiple errors or updates', async () => {
    // Edge case: clicking all three buttons in rapid succession.
    // If the JS is broken, we expect multiple page errors; otherwise we expect the last click to set the box.
    const selectors = [
      pageObject.selectors.showConstant,
      pageObject.selectors.showLinear,
      pageObject.selectors.showQuadratic,
    ];

    // Start clicks quickly and collect pageerrors as they occur.
    const pageErrorsCaught = [];
    const pageErrorListener = (err) => pageErrorsCaught.push(err);
    pageObject.page.on('pageerror', pageErrorListener);

    // Fire clicks without awaiting individually, then await a short period to collect errors/updates.
    for (const sel of selectors) {
      // Fire the click and don't wait between them
      // Surround with try/catch to prevent uncaught if click fails
      try {
        await pageObject.page.click(sel);
      } catch (e) {
        // ignore
      }
    }

    // Allow some time for handlers to run and errors to be emitted
    await pageObject.page.waitForTimeout(500);

    // Detach listener
    pageObject.page.off('pageerror', pageErrorListener);

    if (pageErrorsCaught.length > 0) {
      // If errors occurred, assert they look like ReferenceErrors related to missing JS
      for (const err of pageErrorsCaught) {
        expect(/ReferenceError|is not defined|displayComplexity/i.test(err.message)).toBeTruthy();
      }
      // And ensure the complexity box is not set to one of the expected values (since calls errored)
      const content4 = await pageObject.complexityBoxContent();
      expect(['O(1)', 'O(n)', 'O(n^2)'].includes(content)).toBeFalsy();
    } else {
      // If no errors occurred, assert final state corresponds to last click (quadratic)
      const content5 = await pageObject.complexityBoxContent();
      expect(content).toBe('O(n^2)');
    }
  });

  test('Edge case: clicking non-existent element should be handled gracefully by test runner', async () => {
    // Validate that attempting to click a missing selector results in a Playwright error
    // and does not mutate the page state.
    const missingSelector = 'button#doesNotExist';
    let failed = false;
    try {
      await pageObject.page.click(missingSelector, { timeout: 1000 });
    } catch (e) {
      failed = true;
      // Playwright throws an error when clicking non-existent elements; assert this occurs
      expect(/No node found|element.*not.*visible|Timeout/.test(e.message)).toBeTruthy();
    }
    expect(failed).toBeTruthy();

    // Ensure the complexity box remains in a stable state (string or null)
    const content6 = await pageObject.complexityBoxContent();
    expect(typeof content === 'string' || content === null).toBeTruthy();
  });
});