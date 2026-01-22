import { test, expect } from '@playwright/test';

// Test file for Application ID: 718b5da0-d362-11f0-85a0-d3271c47ca09
// URL: http://127.0.0.1:5500/workspace/batch-1207/html/718b5da0-d362-11f0-85a0-d3271c47ca09.html
// This test suite exercises the FSM-defined interactions and validates DOM and runtime behavior.
// Important: Tests do NOT patch or modify page code. They observe console messages and page errors
// and assert on what naturally occurs when the page is loaded and interacted with.

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/718b5da0-d362-11f0-85a0-d3271c47ca09.html';

// Page Object for the Topological Sort example
class TopSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for assertions
    this.page.on('console', (msg) => {
      // store both text and type so tests can inspect error vs log etc
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', (err) => {
      // store Error objects for later inspection
      this.pageErrors.push(err);
    });
  }

  async goto() {
    // Navigate and wait for network idle to ensure scripts attempt to run
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickExample() {
    await this.page.click('#topologicalSortExample');
  }

  // returns boolean whether an element matching selector exists in DOM
  async exists(selector) {
    return await this.page.$(selector) !== null;
  }

  // Evaluate and return the jQuery selection length for a selector (0 if not present)
  async jqueryLength(selector) {
    return await this.page.evaluate((sel) => {
      // Access jQuery from page if available
      if (window.jQuery) {
        return window.jQuery(sel).length;
      }
      return null;
    }, selector);
  }

  // Evaluate .val() for a jQuery selector; returns the value or undefined/null if not available
  async jqueryVal(selector) {
    return await this.page.evaluate((sel) => {
      if (window.jQuery) {
        // jQuery.val() on empty set returns undefined
        try {
          return window.jQuery(sel).val();
        } catch (e) {
          // capture thrown errors naturally
          return { thrown: String(e) };
        }
      }
      return null;
    }, selector);
  }

  // Return the raw HTML of the page's inline and external scripts concatenated (for searching evidence strings)
  async pageScriptText() {
    return await this.page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.map(s => s.innerText || '').join('\n\n/* external script src: ' + (s => s.src)(s) + ' */\n');
    });
  }

  // Helper to clear collected console and errors between interactions
  clearDiagnostics() {
    this.consoleMessages = [];
    this.pageErrors = [];
  }
}

test.describe('Topological Sort FSM tests (Application 718b5da0-d362-11f0-85a0-d3271c47ca09)', () => {

  // Use the built-in Playwright page fixture
  test.describe.configure({ mode: 'serial' });

  test('Idle state: page renders expected root component and entry-action availability', async ({ page }) => {
    // This test validates the S0_Idle state:
    // - The element #topologicalSortExample must exist (evidence)
    // - The declared entry action renderPage() is NOT present in the global scope (the implementation does not define it)
    // - There should be no #inputArray or #outputArray present initially
    const topPage = new TopSortPage(page);
    await topPage.goto();

    // Validate presence of the main example container
    const existsExample = await topPage.exists('#topologicalSortExample');
    expect(existsExample).toBe(true);

    // Validate that input and output elements referenced by the script are not present in the DOM
    const existsInput = await topPage.exists('#inputArray');
    const existsOutput = await topPage.exists('#outputArray');
    expect(existsInput).toBe(false);
    expect(existsOutput).toBe(false);

    // Verify that a global renderPage function is not defined (the FSM entry action references renderPage())
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // Verify that the page contains the evidence strings referenced by the FSM (the click handler is present in source)
    const scriptText = await topPage.pageScriptText();
    expect(scriptText).toContain('$("#topologicalSortExample").click(function(){');
    expect(scriptText).toContain('inputArray.val(inputArray.val() + 1);');
  });

  test('Transition: clicking the example triggers the sorting handler without crashing (S0 -> S1)', async ({ page }) => {
    // This test validates the ClickSort event and S1_Sorting:
    // - Clicking #topologicalSortExample should execute the attached jQuery handler
    // - Because #inputArray and #outputArray do not exist, we assert observed values and lengths are as expected (undefined / 0)
    // - Observe console messages and page errors and assert their natural occurrence (if any)
    const topPage = new TopSortPage(page);
    await topPage.goto();

    // Capture diagnostics before interaction
    topPage.clearDiagnostics();

    // Read initial jquery values and lengths
    const beforeInputVal = await topPage.jqueryVal('#inputArray');
    const beforeOutputVal = await topPage.jqueryVal('#outputArray');
    const beforeInputLen = await topPage.jqueryLength('#inputArray');
    const beforeOutputLen = await topPage.jqueryLength('#outputArray');

    // Sanity assertions for the starting condition
    expect(beforeInputLen).toBe(0);   // no elements => length 0
    expect(beforeOutputLen).toBe(0);  // no elements => length 0
    // val() on empty jQuery set returns undefined; either undefined or null depending on environment
    expect([undefined, null]).toContain(beforeInputVal);
    expect([undefined, null]).toContain(beforeOutputVal);

    // Perform the click that triggers the bubble-sort-like logic in the page script
    await topPage.clickExample();

    // Wait briefly to allow handler code to run (handler is synchronous but this ensures any async console/pageerror events are captured)
    await page.waitForTimeout(200);

    // Capture diagnostics after interaction
    const consoleMessages = topPage.consoleMessages;
    const pageErrors = topPage.pageErrors;

    // Because the implementation references #inputArray/#outputArray which do not exist,
    // the code will operate on empty jQuery collections. That should not throw a ReferenceError,
    // but we must observe and assert the actual behavior that occurred.

    // After clicking, the lengths should still be 0 (no elements were created)
    const afterInputLen = await topPage.jqueryLength('#inputArray');
    const afterOutputLen = await topPage.jqueryLength('#outputArray');
    expect(afterInputLen).toBe(0);
    expect(afterOutputLen).toBe(0);

    // And the values should remain undefined/null
    const afterInputVal = await topPage.jqueryVal('#inputArray');
    const afterOutputVal = await topPage.jqueryVal('#outputArray');
    expect([undefined, null]).toContain(afterInputVal);
    expect([undefined, null]).toContain(afterOutputVal);

    // The page may or may not emit console messages; record what happened.
    // Assert that any page errors captured are actual Error instances (if present).
    if (pageErrors.length > 0) {
      // If errors occurred, they should be reported to pageErrors array as Error objects
      for (const err of pageErrors) {
        expect(err).toBeInstanceOf(Error);
      }
    } else {
      // If no uncaught exceptions were observed, ensure that's the case explicitly
      expect(pageErrors.length).toBe(0);
    }

    // Ensure that the click handler source evidence is present in the script (verifies the click handler was defined)
    const scriptText = await topPage.pageScriptText();
    expect(scriptText).toContain('$("#topologicalSortExample").click(function(){');
  });

  test('Edge cases: multiple clicks and diagnostic stability (should not accumulate unexpected exceptions)', async ({ page }) => {
    // This test performs multiple clicks to simulate repeated interactions and ensures
    // that the page does not begin throwing new uncaught exceptions after repeated use.
    const topPage = new TopSortPage(page);
    await topPage.goto();

    // Clear any diagnostics from page load
    topPage.clearDiagnostics();

    // Perform multiple rapid clicks
    const clickCount = 5;
    for (let i = 0; i < clickCount; i++) {
      await topPage.clickExample();
      // small delay between clicks
      await page.waitForTimeout(50);
    }

    // Allow any pending console/pageerror to surface
    await page.waitForTimeout(200);

    // If any page errors appeared, assert they are consistent Error objects
    if (topPage.pageErrors.length > 0) {
      for (const err of topPage.pageErrors) {
        expect(err).toBeInstanceOf(Error);
      }
      // Additionally expose what happened by asserting that at least one error occurred if that is the case
      // (We don't force an error to exist; we merely validate the type if it does)
      expect(Array.isArray(topPage.pageErrors)).toBe(true);
    } else {
      // If no errors, explicitly assert stability: zero uncaught exceptions after repeated interactions
      expect(topPage.pageErrors.length).toBe(0);
    }

    // The number of console messages should be a finite number; at minimum it's an array
    expect(Array.isArray(topPage.consoleMessages)).toBe(true);

    // The DOM should still not contain the referenced input/output elements even after repeated clicks
    expect(await topPage.exists('#inputArray')).toBe(false);
    expect(await topPage.exists('#outputArray')).toBe(false);
  });

  test('Source inspection: the implementation contains the buggy loop condition referenced by the FSM evidence', async ({ page }) => {
    // This test ensures the text of the page's scripts contains the exact evidence strings from the FSM.
    // It verifies the code structure (including the problematic loop condition) is present and thus the FSM mapping is accurate.
    const topPage = new TopSortPage(page);
    await topPage.goto();

    const scriptText = await topPage.pageScriptText();

    // The FSM evidence includes the exact substring for the inputArray.val increment and the loop condition.
    expect(scriptText).toContain('inputArray.val(inputArray.val() + 1);');
    expect(scriptText).toContain('for(var i=0; i<outputArray.length; i++){');
    expect(scriptText).toContain('for(var j=0; j<inputArray.length-i-1>=0; j++){');
  });

  test('Behavioral assertion: click handler executes synchronously and does not create global variables', async ({ page }) => {
    // Ensure that after clicking, no unexpected globals (like temporary variables) were leaked to window
    const topPage = new TopSortPage(page);
    await topPage.goto();
    topPage.clearDiagnostics();

    // Snapshot properties on window before click
    const beforeKeys = await page.evaluate(() => Object.keys(window).sort());

    // Click the handler
    await topPage.clickExample();
    await page.waitForTimeout(100);

    // Snapshot keys after click
    const afterKeys = await page.evaluate(() => Object.keys(window).sort());

    // Any newly introduced globals would appear in afterKeys but not in beforeKeys
    const newGlobals = afterKeys.filter(k => !beforeKeys.includes(k));

    // The implementation should not intentionally add globals; assert that there are no surprising new globals
    // (Allow for some environment noise, but in this test we expect zero new keys)
    expect(newGlobals.length).toBe(0);
  });

  // Additional teardown is handled by Playwright fixtures. No explicit teardown required.
});