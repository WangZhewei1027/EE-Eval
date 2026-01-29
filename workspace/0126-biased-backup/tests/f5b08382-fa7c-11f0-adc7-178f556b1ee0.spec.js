import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b08382-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object Model for the Selection Sort page
class SelectionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return this.page.textContent('h1');
  }

  async getTitle() {
    return this.page.title();
  }

  async countParagraphs() {
    return this.page.locator('p').count();
  }

  async preContains(text) {
    const pres = this.page.locator('pre');
    const count = await pres.count();
    for (let i = 0; i < count; i++) {
      const content = await pres.nth(i).textContent();
      if (content && content.includes(text)) return true;
    }
    return false;
  }

  // Returns number of interactive elements commonly used (buttons, inputs, anchors, selects, textareas)
  async countInteractiveElements() {
    const selector = 'button, input, select, textarea, a';
    return this.page.locator(selector).count();
  }

  // Attempt to call a global function by name inside the page context.
  // This deliberately does not define the function; it is used to let ReferenceError/SyntaxError happen naturally.
  async callGlobalFunction(name) {
    // Execute in the page and rethrow error to the test so it can be asserted.
    return this.page.evaluate((fnName) => {
      // This call is intentionally direct to provoke natural JS errors if the function does not exist.
      // Do not catch or patch errors here; let them bubble up.
      // eslint-disable-next-line no-eval
      return eval(`${fnName}()`); // using eval so that a call to an undefined identifier triggers ReferenceError
    }, name);
  }

  // Get typeof a global name in the page context (e.g., to confirm selectionSort is not defined)
  async typeofGlobal(name) {
    return this.page.evaluate((n) => {
      return typeof window[n];
    }, name);
  }
}

test.describe('Selection Sort Static Page - FSM State and Error Observations', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Setup before each test: navigate to the page and attach listeners to capture console and errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      try {
        const type = msg.type();
        const text = msg.text();
        consoleMessages.push({ type, text });
      } catch (e) {
        // if reading message fails, still store a fallback
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page runtime errors (e.g. ReferenceError, TypeError)
    page.on('pageerror', (err) => {
      // err is an Error object from the page context
      pageErrors.push(err);
    });

    // Navigate to the application under test.
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Attach any final info to test output if helpful (Playwright captures console on failure).
    // No teardown modifications to the page environment are made.
    // Ensure page closed by Playwright fixtures.
  });

  test('Idle state renders static content (FSM: S0_Idle evidence)', async ({ page }) => {
    // This test validates the initial (Idle) state content described in the FSM.
    const app = new SelectionSortPage(page);

    // Verify page title is set
    const title = await app.getTitle();
    expect(title).toContain('Selection Sort');

    // Verify the main heading exists and matches the expected evidence
    const heading = (await app.getHeadingText())?.trim();
    expect(heading).toBe('Selection Sort');

    // Verify there are explanatory paragraphs on the page
    const paragraphCount = await app.countParagraphs();
    expect(paragraphCount).toBeGreaterThanOrEqual(1);

    // Verify the page includes the selectionSort implementation in a pre block (static code sample)
    const hasSelectionSortCode = await app.preContains('function selectionSort');
    expect(hasSelectionSortCode).toBe(true);

    // Verify there are no interactive elements reported by the FSM (the FSM said page is static)
    const interactiveCount = await app.countInteractiveElements();
    expect(interactiveCount).toBe(0);

    // On initial load we expect no runtime page errors (no scripts executed). Assert that initial pageErrors is empty.
    // This asserts that any errors we will later provoke (e.g., by calling undefined functions) do not exist at load time.
    expect(pageErrors.length).toBe(0);

    // Also record that no console errors are present at load.
    const consoleErrs = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('FSM entry action "renderPage" is not present; calling it produces a ReferenceError propagated to the page', async ({ page }) => {
    // This test checks onEnter action from the FSM: entry_actions included "renderPage()".
    // The HTML/JS does not define renderPage. We must not patch or define it; instead we call it to allow a natural ReferenceError.
    const app = new SelectionSortPage(page);

    // Confirm that the global identifier 'renderPage' is not defined
    const typeofRender = await app.typeofGlobal('renderPage');
    expect(typeofRender).toBe('undefined');

    // Attempt to call renderPage() inside the page context.
    // We expect this to throw; capture the thrown error and also ensure a pageerror event was emitted.
    let caughtError = null;
    try {
      await app.callGlobalFunction('renderPage');
      // If the function call unexpectedly succeeds, explicitly fail the test.
      throw new Error('renderPage() unexpectedly existed and executed without throwing.');
    } catch (err) {
      // err is the Playwright/Evaluation error wrapper. Ensure it references renderPage and ReferenceError.
      caughtError = err;
      const message = String(err && err.message ? err.message : err);
      // Message should indicate that renderPage is not defined or a ReferenceError occurred.
      expect(message).toMatch(/renderPage/);
      // Different browser engines might include "is not defined" or "not defined" wording.
      expect(message).toMatch(/not defined|ReferenceError/i);
    }

    // After the attempted call, ensure that we observed at least one pageerror event corresponding to the ReferenceError.
    // pageErrors were being collected starting at navigation; the call to renderPage should produce a runtime error captured as pageerror.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Verify that at least one of the captured page errors mentions renderPage or ReferenceError
    const match = pageErrors.some((e) => {
      const msg = String(e && e.message ? e.message : e);
      return /renderPage/.test(msg) || /ReferenceError/.test(msg);
    });
    expect(match).toBe(true);

    // Also capture console error messages related to this call, if any
    const consoleErrMatch = consoleMessages.some((m) => /renderPage|ReferenceError/i.test(m.text));
    // It's acceptable that console may or may not log; assert that either we saw a pageerror or a console message about it.
    expect(consoleErrMatch || pageErrors.length > 0).toBeTruthy();
  });

  test('selectionSort function is presented as static text only; calling it triggers ReferenceError if invoked', async ({ page }) => {
    // The page shows a code sample for selectionSort inside a <pre> block, but does not define it at runtime.
    const app = new SelectionSortPage(page);

    // Confirm the code sample exists in the page's <pre> content
    const hasCode = await app.preContains('selectionSort(arr)');
    expect(hasCode).toBe(true);

    // Confirm typeof selectionSort is 'undefined' (i.e., it's not a runtime function)
    const typeofSelectionSort = await app.typeofGlobal('selectionSort');
    expect(typeofSelectionSort).toBe('undefined');

    // Attempt to call selectionSort() to allow a natural ReferenceError to occur and be observed.
    let caught = null;
    try {
      await app.callGlobalFunction('selectionSort');
      // If it doesn't throw, that means selectionSort exists unexpectedly; fail explicitly.
      throw new Error('selectionSort() unexpectedly executed without throwing.');
    } catch (err) {
      caught = err;
      const message = String(err && err.message ? err.message : err);
      expect(message).toMatch(/selectionSort/);
      expect(message).toMatch(/not defined|ReferenceError/i);
    }

    // Ensure at least one pageerror was emitted (the call should have produced a ReferenceError captured in pageErrors)
    const errFound = pageErrors.some((e) => {
      const msg = String(e && e.message ? e.message : e);
      return /selectionSort/.test(msg) || /ReferenceError/.test(msg);
    });
    expect(errFound).toBe(true);
  });

  test('Edge case checks: ensure no links/buttons exist and list content describes algorithm steps', async ({ page }) => {
    // This test validates additional FSM notes: page contains only static content, steps listed in ordered lists.
    const app = new SelectionSortPage(page);

    // No interactive anchors or buttons should be present on the static page
    const interactiveCount = await app.countInteractiveElements();
    expect(interactiveCount).toBe(0);

    // Verify that there are multiple ordered lists on the page describing steps and use-cases
    const olCount = await page.locator('ol').count();
    expect(olCount).toBeGreaterThanOrEqual(2);

    // Verify that the first ordered list includes a step about comparing elements
    const firstOlText = await page.locator('ol').first().textContent();
    expect(firstOlText).toMatch(/compare/i);

    // Ensure that console and page runtime errors prior to any explicit provoking remain empty
    // (This double-check demonstrates that the page itself is static and only our deliberate calls created errors.)
    // We already asserted this in another test, but we check again at this point in the test lifecycle.
    // Note: pageErrors might contain errors from earlier tests in the same worker; therefore we only assert that
    // the page emitted no errors during initial load within this test run by reloading and checking the captured arrays.
    // To do this reliably, reload and clear collectors, then check again.
    consoleMessages = [];
    pageErrors = [];
    await page.reload();
    expect(pageErrors.length).toBe(0);
    const consoleErrs = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('FSM transitions: none exist - assert there are no interactive transitions to trigger', async ({ page }) => {
    // Since FSM defines no events or transitions, the test ensures there are no controls that could trigger transitions.
    const app = new SelectionSortPage(page);

    // Assert that no elements have click handlers attached that could be transitions.
    // We cannot introspect listeners directly without modifying the page environment; instead, we assert no typical interactive elements exist.
    const interactiveCount = await app.countInteractiveElements();
    expect(interactiveCount).toBe(0);

    // Also scan for any inline onclick attributes (static transition hooks) - there should be none.
    const onclickCount = await page.locator('[onclick]').count();
    expect(onclickCount).toBe(0);
  });
});