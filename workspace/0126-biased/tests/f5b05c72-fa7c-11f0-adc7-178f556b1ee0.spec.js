import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b05c72-fa7c-11f0-adc7-178f556b1ee0.html';

// Page object encapsulating common selectors and actions for the Suffix Tree page
class SuffixTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      demoButton: '#suffix-tree-demo',
      suffixTreeDiv: '#suffix-tree'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async demoButton() {
    return this.page.locator(this.selectors.demoButton);
  }

  async suffixTreeDiv() {
    return this.page.locator(this.selectors.suffixTreeDiv);
  }

  async clickDemo() {
    await this.page.click(this.selectors.demoButton);
  }

  async getSuffixTreeDivContent() {
    return this.page.$eval(this.selectors.suffixTreeDiv, el => el.innerHTML);
  }

  async getSuffixTreeObjectKeys() {
    // Safely retrieve keys of the suffixTree object defined in the page, if any.
    return this.page.evaluate(() => {
      try {
        if (typeof window.suffixTree === 'object' && window.suffixTree !== null) {
          return Object.keys(window.suffixTree);
        }
        return null;
      } catch (e) {
        // propagate error message for assertions if needed
        return { __error: e && e.message ? e.message : String(e) };
      }
    });
  }

  async callPrintSuffixTreeAndCaptureError() {
    // Call printSuffixTree directly in the page context and return the thrown error message (if any).
    return this.page.evaluate(() => {
      try {
        printSuffixTree(suffixTree);
        return { success: true };
      } catch (err) {
        return { success: false, message: err && err.message ? err.message : String(err) };
      }
    });
  }
}

test.describe('Suffix Tree FSM and UI - f5b05c72-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Each test will create fresh listeners to capture runtime errors and console output.
  test('Initial Idle state: button and div are present and initial script invocation causes a runtime error (onEnter behavior)', async ({ page }) => {
    // Collect page errors and console messages for assertions
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', (err) => {
      // record page error messages (uncaught exceptions)
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    page.on('console', (msg) => {
      // record console messages (for additional evidence)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    const suffixPage = new SuffixTreePage(page);
    // Navigate to the application page (entry action: renderPage / initial load)
    await suffixPage.goto();

    // Validate presence of the interactive components as per FSM S0_Idle evidence
    const demoButton = await suffixPage.demoButton();
    await expect(demoButton).toBeVisible({ timeout: 2000 });
    await expect(demoButton).toHaveText('Click to Demonstrate');

    const treeDiv = await suffixPage.suffixTreeDiv();
    await expect(treeDiv).toBeVisible();

    // The implementation attempts to run printSuffixTree on load.
    // The code contains a reassignment to a const variable inside printSuffixTree,
    // which will generate a runtime TypeError. Assert that a page error is observed.
    // Give a small timeout for the error to fire during load
    await page.waitForTimeout(100); // short pause to allow any onload exceptions to surface

    // There should be at least one page error captured due to the buggy printSuffixTree call on load
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The exact message can vary across browsers, but commonly contains 'Assignment to constant' or 'Assignment to constant variable'
    const pageErrorsJoined = pageErrors.join(' | ');
    expect(
      /Assignment to constant/i.test(pageErrorsJoined) ||
      /Assignment to constant variable/i.test(pageErrorsJoined) ||
      /Assignment to constant variable\./i.test(pageErrorsJoined) ||
      /cannot assign to/i.test(pageErrorsJoined) ||
      /reassignment to constant variable/i.test(pageErrorsJoined)
    ).toBeTruthy();

    // Because printSuffixTree failed on initial call, the suffix-tree div content should remain empty (no successful rendering)
    const content = await suffixPage.getSuffixTreeDivContent();
    // Accept empty string or whitespace-only content as "no rendering happened"
    expect(content.trim()).toBe('');

    // Also confirm that we saw console-level information (optional, but useful for debugging)
    // There may or may not be console.error messages depending on runtime, so assert that consoleMessages is an array
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('ClickDemonstrate event transitions from Idle to Demonstrating and re-invokes printSuffixTree (expect another runtime error)', async ({ page }) => {
    // Fresh listeners for this test
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', (err) => pageErrors.push(err && err.message ? err.message : String(err)));
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    const suffixPage = new SuffixTreePage(page);
    await suffixPage.goto();

    // Ensure the interactive button exists before clicking
    const demoButton = await suffixPage.demoButton();
    await expect(demoButton).toBeVisible();

    // Clear-out any initial errors captured from onload so we can focus on errors produced by the click
    // (Since this test uses a fresh page instance, the initial load will still produce an error — we'll account for that)
    // Capture initial count
    const initialPageErrorsCount = pageErrors.length;

    // Clicking the button should trigger the event handler that calls printSuffixTree(suffixTree).
    // Because printSuffixTree contains a bug (assignment to const), clicking should produce another page error.
    await Promise.all([
      // Wait for a pageerror event to be emitted as a result of the click. Use a timeout to avoid hanging tests.
      page.waitForEvent('pageerror', { timeout: 2000 }).catch((e) => null),
      suffixPage.clickDemo()
    ]);

    // Give a tiny pause to ensure event handlers and console handlers run
    await page.waitForTimeout(50);

    // After clicking, total page errors should be greater than or equal to initial count + 1
    expect(pageErrors.length).toBeGreaterThanOrEqual(initialPageErrorsCount + 1);

    // Verify that one of the new errors corresponds to the const reassignment TypeError
    const newErrors = pageErrors.slice(initialPageErrorsCount);
    const newErrorsJoined = newErrors.join(' | ');
    expect(
      /Assignment to constant/i.test(newErrorsJoined) ||
      /cannot assign to/i.test(newErrorsJoined) ||
      /reassignment to constant variable/i.test(newErrorsJoined)
    ).toBeTruthy();

    // The click is intended to re-render the suffix tree into the div.
    // Because of the runtime error, innerHTML should still be empty (no successful render).
    const contentAfterClick = await suffixPage.getSuffixTreeDivContent();
    expect(contentAfterClick.trim()).toBe('');

    // Additional check: calling the print function directly in page context should also return an error message (edge-case validation)
    const directCallResult = await suffixPage.callPrintSuffixTreeAndCaptureError();
    expect(directCallResult).toBeTruthy();
    expect(directCallResult.success).toBeFalsy();
    expect(directCallResult.message).toMatch(/Assignment to constant|cannot assign|reassignment/i);
  });

  test('Suffix tree constructed object exists despite printSuffixTree failing (validate constructSuffixTree output)', async ({ page }) => {
    // This test checks that constructSuffixTree executed and produced the "suffixTree" object in the page context,
    // even though printSuffixTree (called immediately after) throws an error.
    const suffixPage = new SuffixTreePage(page);
    await suffixPage.goto();

    // Retrieve keys of the suffixTree object produced by constructSuffixTree
    const keys = await suffixPage.getSuffixTreeObjectKeys();

    // Expect keys to be an array containing expected suffixes for "banana"
    // Valid suffix keys for "banana": banana, anana, nana, ana, na, a
    expect(Array.isArray(keys)).toBeTruthy();

    // Ensure at least one expected suffix is present
    const expectedSuffixes = ['banana', 'anana', 'nana', 'ana', 'na', 'a'];
    const hasExpected = expectedSuffixes.some(suf => keys.includes(suf));
    expect(hasExpected).toBeTruthy();
  });

  test('Robustness: multiple clicks repeatedly invoke the event handler and produce repeated errors', async ({ page }) => {
    // Ensure repeated interactions are handled (i.e., the handler runs every time, producing errors each time)
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err && err.message ? err.message : String(err)));

    const suffixPage = new SuffixTreePage(page);
    await suffixPage.goto();

    const demoButton = await suffixPage.demoButton();
    await expect(demoButton).toBeVisible();

    // Clear any initial page errors we don't want to count for this multiple-click test
    const baseline = pageErrors.length;

    // Click multiple times
    const clicks = 3;
    for (let i = 0; i < clicks; i++) {
      // Each click should trigger a pageerror due to the broken printSuffixTree implementation
      await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        demoButton.click()
      ]);
      // small pause between clicks
      await page.waitForTimeout(30);
    }

    // Verify that at least `clicks` new errors were recorded
    expect(pageErrors.length).toBeGreaterThanOrEqual(baseline + clicks);

    // Ensure the page's suffix-tree div was not successfully populated after any of these clicks
    const content = await suffixPage.getSuffixTreeDivContent();
    expect(content.trim()).toBe('');
  });

  test('Edge-case: invoking printSuffixTree via page.evaluate throws and error message is inspectable', async ({ page }) => {
    // This test explicitly demonstrates that calling the buggy function in the page context throws an error we can assert on.
    const suffixPage = new SuffixTreePage(page);
    await suffixPage.goto();

    // Directly evaluate and capture thrown error message
    const result = await suffixPage.callPrintSuffixTreeAndCaptureError();

    // Expect an object describing the failure
    expect(result).toHaveProperty('success');
    expect(result.success).toBe(false);
    expect(result).toHaveProperty('message');
    expect(typeof result.message).toBe('string');
    expect(result.message).toMatch(/Assignment to constant|cannot assign|reassignment/i);
  });
});