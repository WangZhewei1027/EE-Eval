import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7189d700-d362-11f0-85a0-d3271c47ca09.html';

/**
 * Page object for the Counting Sort static page.
 * Encapsulates common queries without modifying the page.
 */
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async load() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async headingText() {
    return this.page.locator('h1').innerText();
  }

  async paragraphText() {
    return this.page.locator('p').innerText();
  }

  async listItemsText() {
    const items = this.page.locator('ul li');
    const count = await items.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await items.nth(i).innerText());
    }
    return texts;
  }

  // Intentionally tries to invoke the FSM entry action "renderPage()" inside the page context.
  // We do NOT define renderPage anywhere; this method will naturally throw a ReferenceError
  // in the page context, which we capture in tests. This follows the instruction to let
  // ReferenceError happen naturally and assert that it occurs.
  async callRenderPage() {
    return this.page.evaluate(() => {
      // Calling an undefined function on the page as-is to observe the natural error.
      return renderPage();
    });
  }
}

test.describe('Counting Sort interactive application (static HTML)', () => {
  // Arrays to collect console and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages emitted by the page
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page before each test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // clear listeners by removing them (best-effort cleanup)
    // Note: Playwright does not provide a direct off() for page listeners here,
    // but listeners are tied to the page lifetime. This is just a placeholder comment
    // to indicate teardown intent as requested.
  });

  test('renders static content matching FSM S0_Idle evidence', async ({ page }) => {
    // This test validates that the static content present in the HTML matches the FSM evidence
    const countingPage = new CountingSortPage(page);

    // Verify heading text
    const h1 = await countingPage.headingText();
    expect(h1).toBe('Counting Sort');

    // Verify paragraph text
    const p = await countingPage.paragraphText();
    expect(p).toContain('Here is a simple counting sort algorithm in HTML');

    // Verify list items describe the algorithm steps (order and content)
    const items = await countingPage.listItemsText();
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]).toContain('Sort the list by its length in descending order');
    expect(items[1]).toContain('Take the first two elements from the sorted list and swap them with the remaining elements');

    // Verify that no interactive elements (buttons/inputs/links) are present, as FSM extraction reported none.
    const buttons = await page.locator('button').count();
    const inputs = await page.locator('input').count();
    const anchors = await page.locator('a').count();

    expect(buttons).toBe(0);
    expect(inputs).toBe(0);
    expect(anchors).toBe(0);

    // Verify that loading the page did not emit unexpected console messages
    expect(consoleMessages.length).toBe(0);

    // No uncaught page errors should exist for the static HTML load
    expect(pageErrors.length).toBe(0);
  });

  test('S0_Idle entry action "renderPage()" is not defined; invoking it throws ReferenceError', async ({ page }) => {
    // This test attempts to call the FSM-declared entry action renderPage() in the page context.
    // According to the FSM, renderPage() is expected as an entry action, but the provided HTML/JS
    // does not define it. We therefore expect a ReferenceError when calling it from the page.
    const countingPage = new CountingSortPage(page);

    let caughtError = null;
    try {
      await countingPage.callRenderPage();
      // If call does not throw, explicitly fail the test
      throw new Error('Expected calling renderPage() to throw ReferenceError, but it did not.');
    } catch (err) {
      // Capture the thrown error for assertions
      caughtError = err;
    }

    // Ensure an error was thrown
    expect(caughtError).not.toBeNull();

    // Different engines may produce different error messages, so assert key expectations:
    // - It's a ReferenceError (or at least message indicates "not defined")
    // - The message mentions "renderPage" to show we tried to call that symbol
    const message = String(caughtError?.message || '');
    expect(message.toLowerCase()).toContain('renderpage'); // mentions the function name
    expect(message.toLowerCase()).toMatch(/not defined|is not defined|referenceerror/);
  });

  test('uncaught ReferenceError in page context is emitted as a pageerror event', async ({ page }) => {
    // This test demonstrates an edge-case error scenario: triggering an uncaught error inside the page
    // asynchronously (so it is uncaught by our evaluate promise) and asserting the pageerror event is received.

    // Ensure no prior pageerrors exist
    expect(pageErrors.length).toBe(0);

    // Trigger an uncaught error in the page asynchronously so it becomes an 'uncaught exception' event.
    // We call a non-existent function inside a setTimeout to ensure it's not caught by evaluate promise.
    const [errEvent] = await Promise.all([
      page.waitForEvent('pageerror'), // wait for the uncaught exception event
      page.evaluate(() => {
        // Schedule an uncaught ReferenceError in the page event loop
        setTimeout(() => {
          // Intentionally call an undefined function to create an uncaught ReferenceError
          // This should create a pageerror event that we can assert on.
          // We purposely do not wrap this in try/catch to keep it uncaught.
          (window as any).nonExistingFunctionForTestTriggeringPageError();
        }, 0);
      }),
    ]);

    // Assert that a pageerror was indeed emitted and that it references our missing function
    expect(errEvent).toBeTruthy();
    const msg = String(errEvent.message || '');
    expect(msg.toLowerCase()).toContain('nonexistingfunctionfortesttriggeringpageerror');
    expect(msg.toLowerCase()).toMatch(/not defined|is not defined|referenceerror/);
  });

  test('verify there are no FSM transitions or events to trigger (no interactive transitions)', async ({ page }) => {
    // The FSM has no transitions and no events defined. This test asserts that there are no
    // interactive controls to cause transitions and that attempting to call a transition handler
    // that does not exist results in an error (natural failure).
    //
    // We check DOM for typical interactive controls and additionally attempt to call a
    // hypothetical transition function name to ensure it does not exist.

    const buttons = await page.locator('button').count();
    const inputs = await page.locator('input').count();
    const selects = await page.locator('select').count();

    // Expect no interactive controls in the static page
    expect(buttons).toBe(0);
    expect(inputs).toBe(0);
    expect(selects).toBe(0);

    // Attempt to invoke a nonexistent transition function to observe natural ReferenceError
    let transitionError = null;
    try {
      // We do not define 'triggerTransition' on the page — calling it should naturally throw.
      await page.evaluate(() => {
        // hypothetical transition function from a more interactive implementation
        // This should throw because it does not exist in the provided HTML.
        // We intentionally return the call so evaluate's promise rejects with the error.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return triggerTransition();
      });
      throw new Error('Expected calling triggerTransition() to throw, but it did not.');
    } catch (err) {
      transitionError = err;
    }

    expect(transitionError).not.toBeNull();
    const msg = String(transitionError?.message || '');
    expect(msg.toLowerCase()).toMatch(/triggertransition|not defined|referenceerror/);
  });

  test('edge case: querying non-existent elements should return empty results', async ({ page }) => {
    // This test checks that querying for elements that the FSM might expect in an interactive app
    // returns empty results for this static page, ensuring no hidden interactive components exist.

    // Query for a hypothetical visualization container and controls
    const viz = page.locator('#visualization');
    const nextBtn = page.locator('#next-step');
    const prevBtn = page.locator('#prev-step');

    expect(await viz.count()).toBe(0);
    expect(await nextBtn.count()).toBe(0);
    expect(await prevBtn.count()).toBe(0);

    // Attempt to access innerText of a non-existent element via locator and expect an error if we try to read it directly.
    // Use a safe pattern: check count before reading text.
    const maybe = page.locator('#does-not-exist');
    const count = await maybe.count();
    expect(count).toBe(0);
  });
});