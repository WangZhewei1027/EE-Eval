import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5aefce0-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Array example page
class ArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = "button[onclick='displayArray()']";
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isButtonVisible() {
    return await this.page.isVisible(this.buttonSelector);
  }

  async getButtonText() {
    return await this.page.textContent(this.buttonSelector);
  }

  async clickViewButton() {
    await this.page.click(this.buttonSelector);
  }

  async hasDisplayArrayFunction() {
    // Check presence of global function displayArray without modifying page
    return await this.page.evaluate(() => {
      // typeof is allowed; this does not create/patch any functions
      return typeof window.displayArray === 'function';
    });
  }
}

// Utility: wait until predicate or timeout
async function waitForPredicate(predicateFn, timeout = 1000, interval = 50) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await predicateFn();
    if (result) return true;
    if (Date.now() - start > timeout) return false;
    await new Promise((r) => setTimeout(r, interval));
  }
}

test.describe('Array Interactive Application (f5aefce0-fa7c-11f0-adc7-178f556b1ee0)', () => {
  let page;
  let arrayPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // Setup: open new page and attach listeners for console and page errors
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // capture text representation; include type for easier debugging
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In unexpected cases, push minimal info
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect thrown errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    arrayPage = new ArrayPage(page);
    await arrayPage.goto();
  });

  test.afterEach(async () => {
    // Teardown: close page
    await page.close();
  });

  test('S0_Idle: initial render shows the View Array Example button and displayArray exists (entry_actions: renderPage)', async () => {
    // This test validates the initial Idle state (S0_Idle)
    // - The page should render the "View Array Example" button
    // - The displayArray function should be defined (so entry/available for transition)
    // - No console logs or page errors should be present on initial load

    // Button is visible
    const visible = await arrayPage.isButtonVisible();
    expect(visible).toBe(true);

    // Button text contains expected label
    const text = await arrayPage.getButtonText();
    expect(text).toBeTruthy();
    expect(text.trim()).toContain('View Array Example');

    // displayArray function should exist on the page (entry action for S1 is available)
    const hasFunc = await arrayPage.hasDisplayArrayFunction();
    expect(hasFunc).toBe(true);

    // On initial load we expect no console messages emitted by clicking (page may still output non-related logs)
    // But specifically, before interaction we do not expect the array example logs to be present.
    const joined = consoleMessages.map(m => m.text).join(' ');
    expect(joined).not.toContain('15'); // sum log should not yet be present

    // Ensure no runtime page errors happened during initial render
    expect(pageErrors.length).toBe(0);
  });

  test('ViewArrayExample event: clicking the button triggers displayArray and logs expected outputs (transition S0_Idle -> S1_ArrayDisplayed)', async () => {
    // This test validates the transition triggered by the ViewArrayExample event:
    // - Clicking the button should invoke displayArray()
    // - displayArray() logs sum (15) and multiple arrays/objects to console
    // - No runtime errors should occur during/after invocation

    // Click the button to transition to S1_ArrayDisplayed (invoke displayArray)
    await arrayPage.clickViewButton();

    // Wait until we observe logs that include the sum (15) or timeout
    const observed = await waitForPredicate(() => {
      return consoleMessages.some(m => m.text.includes('15'));
    }, 1500);

    // Assert that sum log was observed
    expect(observed).toBe(true);

    // Aggregate console texts for easier assertions
    const texts = consoleMessages.map(m => m.text).join('\n');

    // Check for expected outputs produced by displayArray()
    // sum log
    expect(texts).toContain('15');

    // numeric array log (could be printed as "[1, 2, 3, 4, 5]" or similar)
    expect(texts).toMatch(/1\s*,\s*2\s*,\s*3\s*,\s*4\s*,\s*5/);

    // floats log
    expect(texts).toMatch(/1\.1\s*,\s*2\.2\s*,\s*3\.3\s*,\s*4\.4\s*,\s*5\.5/);

    // strings log contains 'hello' and 'world'
    expect(texts).toContain('hello');
    expect(texts).toContain('world');

    // booleans log contains 'true' (at least once)
    expect(texts.toLowerCase()).toContain('true');

    // object data log contains "John" (verifies complex object logged)
    expect(texts).toContain('John');

    // Ensure no page errors occurred as a result of clicking/calling displayArray
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: multiple rapid clicks should result in multiple sets of logs (idempotency / repeated transition behavior)', async () => {
    // This test validates repeated triggering of the ViewArrayExample event:
    // - Clicking the button multiple times should call displayArray multiple times
    // - Each invocation should log the sum (15); we assert at least two occurrences after two clicks

    // Click twice quickly
    await arrayPage.clickViewButton();
    await arrayPage.clickViewButton();

    // Wait until we see at least two occurrences of the sum log, or timeout
    const observedTwo = await waitForPredicate(() => {
      const sumLogs = consoleMessages.filter(m => m.text.includes('15'));
      return sumLogs.length >= 2;
    }, 2000);

    expect(observedTwo).toBe(true);

    // Confirm that the UI (button) remained present after multiple invocations (no exit action removed it)
    const stillVisible = await arrayPage.isButtonVisible();
    expect(stillVisible).toBe(true);

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('S1_ArrayDisplayed: verify entry action executed and no exit actions affected the DOM (button still present)', async () => {
    // This test explicitly checks the S1 entry action (displayArray) was executable and that there were no exit actions that remove the button.
    // - Ensure displayArray exists and can be called (sanity)
    // - After invoking it, the button still exists (no exit actions removed it)

    // Confirm function exists
    const existsBefore = await arrayPage.hasDisplayArrayFunction();
    expect(existsBefore).toBe(true);

    // Invoke via click
    await arrayPage.clickViewButton();

    // Wait for any logs to appear (indicating function ran)
    await waitForPredicate(() => consoleMessages.length > 0, 1500);

    // The button should still be present (no exit action)
    expect(await arrayPage.isButtonVisible()).toBe(true);

    // displayArray should still be defined after running it
    const existsAfter = await arrayPage.hasDisplayArrayFunction();
    expect(existsAfter).toBe(true);

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Error observation: assert there are no ReferenceError/SyntaxError/TypeError page errors during load and interactions', async () => {
    // This test explicitly observes any page errors and asserts that none of the common error types happened.
    // It also performs an interaction to ensure errors don't appear on usage.

    // Interact
    await arrayPage.clickViewButton();

    // Wait briefly for potential errors to surface
    await new Promise(r => setTimeout(r, 500));

    // If any pageErrors are present, fail the test with their messages for debugging clarity
    if (pageErrors.length > 0) {
      // Build a summary message of errors encountered
      const errSummary = pageErrors.map(e => `${e.name}: ${e.message}`).join('; ');
      // Fail with the summary to show what happened
      expect(pageErrors.length, `Page errors were detected: ${errSummary}`).toBe(0);
    } else {
      // Explicitly assert none of the specific error types occurred
      const foundNames = pageErrors.map(e => e.name);
      expect(foundNames.includes('ReferenceError')).toBeFalsy();
      expect(foundNames.includes('TypeError')).toBeFalsy();
      expect(foundNames.includes('SyntaxError')).toBeFalsy();
    }
  });

  test('Robustness: ensure calling displayArray directly from page context behaves as expected (no injection/patching by test)', async () => {
    // This test ensures we do not inject/patch functions and simply call existing function to validate behavior.
    // We do not redefine any functions; we call the existing displayArray and observe logs.

    // Validate the function exists before direct call
    const hasFn = await arrayPage.hasDisplayArrayFunction();
    expect(hasFn).toBe(true);

    // Call the function directly inside page context (no patching from test side)
    await page.evaluate(() => {
      // Call the existing function; if it does not exist this will throw and become a pageerror
      if (typeof window.displayArray === 'function') {
        window.displayArray();
      }
    });

    // Wait for logs
    const saw = await waitForPredicate(() => consoleMessages.some(m => m.text.includes('15')), 1500);
    expect(saw).toBe(true);

    // Ensure no page errors were introduced by direct call
    expect(pageErrors.length).toBe(0);
  });
});