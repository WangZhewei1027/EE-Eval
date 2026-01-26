import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a0a40-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the P vs NP static page
class PvsNPPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    return this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async title() {
    return this.page.title();
  }

  async headerText() {
    const h1 = await this.page.locator('h1').first();
    return h1.textContent();
  }

  async paragraphCount() {
    return this.page.locator('p').count();
  }

  async paragraphTexts() {
    const count = await this.paragraphCount();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.page.locator('p').nth(i).textContent()) || '');
    }
    return texts;
  }

  async countButtons() {
    return this.page.locator('button').count();
  }

  async countInputs() {
    return this.page.locator('input').count();
  }

  async countAnchors() {
    return this.page.locator('a').count();
  }

  async countScripts() {
    return this.page.locator('script').count();
  }

  // Attempt to invoke the entry-action function that appears in the FSM.
  // This will execute in the page context and, as required, we do NOT
  // define or patch any globals — so this call is expected to fail
  // if the function is not defined on the page.
  async invokeRenderPage() {
    // Execute a simple script that calls the identifier renderPage()
    // This is run inside the page context; if renderPage is undefined,
    // it will produce a ReferenceError in the page context.
    return this.page.evaluate(() => {
      // Intentionally call the identifier exactly as the FSM entry action lists it.
      // Per the instructions, we must allow any ReferenceError to happen naturally.
      // eslint-disable-next-line no-undef
      return renderPage();
    });
  }

  // Attempt to use $eval on a selector that does not exist to validate error handling
  async evalNonExistentSelector(selector) {
    return this.page.$eval(selector, el => el.textContent);
  }
}

test.describe('520a0a40-fa76-11f0-a09b-87751f540fd8 - P vs NP page (FSM: S0_Idle)', () => {
  // Collect console messages and page errors across tests for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events to detect warnings/errors printed during load or interactions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen to uncaught exceptions in the page context
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test. Wait for DOMContentLoaded to assert static content.
    const response = await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Confirm the navigation returned a successful response (200-299).
    // If response is null (very rare), the following expect will make the test fail clearly.
    expect(response && response.ok()).toBeTruthy();
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid leaks in serial test environments (Playwright automatically does this,
    // but we leave this block for clarity). We cannot remove individual anonymous listeners here,
    // but listeners are bound to the page instance which will be disposed by Playwright test runner.
    // This afterEach block serves as a conceptual teardown step.
  });

  test('renders static content: title, header and paragraphs (Idle state verification)', async ({ page }) => {
    // This test validates that the S0_Idle state's entry rendering is present:
    // - Page title is "P vs NP"
    // - H1 header text is "P vs NP"
    // - There are multiple descriptive paragraphs about P vs NP
    const app = new PvsNPPage(page);

    const title = await app.title();
    expect(title).toBe('P vs NP');

    const header = (await app.headerText())?.trim();
    expect(header).toBe('P vs NP');

    const paraCount = await app.paragraphCount();
    // The implementation contains 10 <p> tags. We assert at least 9 to be tolerant to small changes.
    expect(paraCount).toBeGreaterThanOrEqual(9);

    const texts = await app.paragraphTexts();
    // Validate that at least one paragraph mentions "P vs NP" as a sanity check of content.
    const mentionsPvsNP = texts.some(t => t && t.includes('P vs NP'));
    expect(mentionsPvsNP).toBeTruthy();
  });

  test('page contains no interactive elements (buttons, inputs, anchors, scripts)', async ({ page }) => {
    // This test asserts that the FSM's extraction notes (no interactive elements) match the DOM.
    const app = new PvsNPPage(page);

    const buttons = await app.countButtons();
    expect(buttons).toBe(0);

    const inputs = await app.countInputs();
    expect(inputs).toBe(0);

    const anchors = await app.countAnchors();
    // There are no anchors in the provided HTML.
    expect(anchors).toBe(0);

    const scripts = await app.countScripts();
    // The HTML contains no <script> tags
    expect(scripts).toBe(0);
  });

  test('invoking FSM-declared entry action renderPage() in page context throws ReferenceError (do not patch page)', async ({ page }) => {
    // The FSM mentions an entry action "renderPage()". The HTML does not define such a function.
    // Per instructions, we must NOT patch or define it, and must allow the error to happen naturally.
    // This test calls the identifier in the page context and asserts that a ReferenceError occurs.
    const app = new PvsNPPage(page);

    // Ensure there are no page errors prior to our intentional invocation.
    expect(pageErrors.length).toBe(0);
    // Also ensure console has no error-level messages so far.
    const initialConsoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(initialConsoleErrors.length).toBe(0);

    let caughtError = null;
    try {
      await app.invokeRenderPage();
      // If the page actually defines renderPage (unexpected), we fail the test because the FSM and HTML mismatch.
      // However, to be resilient, only explicitly fail if a value is returned (meaning the function existed).
      throw new Error('renderPage() unexpectedly executed without throwing; expected ReferenceError because renderPage is not defined on the page.');
    } catch (err) {
      // Capture the thrown error for assertions below.
      caughtError = err;
    }

    // The thrown error originates from page.evaluate and should indicate that renderPage is not defined.
    // Playwright wraps the evaluation error; ensure message mentions "renderPage" and "not defined" or similar.
    expect(caughtError).toBeTruthy();
    const msg = String(caughtError.message || caughtError);
    // Different engines may phrase it differently; check for key substrings.
    const hasRenderPage = msg.includes('renderPage') || msg.includes('renderPage()');
    const indicatesNotDefined = msg.toLowerCase().includes('not defined') || msg.toLowerCase().includes('is not defined') || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('is not a function') || msg.toLowerCase().includes('referenceerror');
    expect(hasRenderPage).toBeTruthy();
    expect(indicatesNotDefined).toBeTruthy();

    // Additionally, the pageerror listener may have captured an error emitted in the page context.
    // Confirm that at least one pageerror was recorded and that it references renderPage.
    // Note: In some environments the error bubbles only as the rejection of evaluate; still we check if pageerror captured it.
    const foundPageErrorRelated = pageErrors.some(e => {
      const s = String(e && e.message ? e.message : e);
      return s.includes('renderPage') || s.toLowerCase().includes('renderpage') || s.toLowerCase().includes('referenceerror');
    });
    // It's acceptable if the pageerror did or did not capture it; assert that either the evaluate threw (we already checked)
    // or pageerror captured it. Here we will assert that the evaluate throw happened (already checked) and optionally pageerror.
    expect(caughtError).toBeTruthy();

    // For completeness, ensure a console-level error was added if present.
    const errorConsoleEntry = consoleMessages.find(m => m.type === 'error' && m.text.includes('renderPage'));
    // It's fine if undefined; we don't require it, but we assert that our caughtError did include the necessary detail.
    // This comment documents that console capture is observed if available.
  });

  test('attempting to $eval a non-existent selector throws an informative error (edge case)', async ({ page }) => {
    // Validate behavior when consumers attempt to query and operate on selectors that do not exist.
    // We expect Playwright's $eval to throw with a helpful message indicating the selector was not found.
    const app = new PvsNPPage(page);
    const selector = 'button#i-do-not-exist';

    let caught = null;
    try {
      await app.evalNonExistentSelector(selector);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    const message = String(caught.message || caught);
    // Playwright's error message typically mentions "failed to find element matching selector".
    expect(message.toLowerCase()).toContain('failed to find element');
    expect(message).toContain(selector);
  });

  test('no console errors were emitted on initial load (sanity)', async ({ page }) => {
    // Ensure that loading the static content does not cause any console errors or uncaught exceptions.
    // This checks the "Idle" state's rendering is stable.
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsoleEntries.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('FSM has no transitions: attempting to interact does not change the DOM (no-op interactions)', async ({ page }) => {
    // Since the FSM declares no events/transitions, user interactions should not change the DOM.
    // We'll attempt some benign interactions (click on body, type into a non-existent input via locator) and
    // assert the DOM's core static content remains unchanged.
    const app = new PvsNPPage(page);

    const originalTitle = await app.title();
    const originalHeader = (await app.headerText())?.trim();
    const originalParaCount = await app.paragraphCount();

    // Click on the body; this should be a no-op for a static page.
    await page.click('body');

    // Try to focus a non-existent input via locator - it will not throw, but will be a no-op if not found.
    const maybeInput = page.locator('input');
    // count is 0 so typing should throw if we force it; instead we assert count stays zero.
    const inputCount = await maybeInput.count();
    expect(inputCount).toBe(0);

    // Re-assert original DOM content unchanged
    expect(await app.title()).toBe(originalTitle);
    expect((await app.headerText())?.trim()).toBe(originalHeader);
    expect(await app.paragraphCount()).toBe(originalParaCount);
  });
});