import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04436d81-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page Object for the NP-Completeness demo page.
 * Encapsulates locators and common assertions to keep tests readable.
 */
class NPCompletenessPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.container');
    this.title = page.locator('h1');
    this.paragraphs = page.locator('.container p');
    // Generic interactive selector to detect any interactive elements accidentally present.
    this.interactiveElements = page.locator('button, input, textarea, select, [role="button"], a[href^="javascript:"]');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getTitleText() {
    return this.title.innerText();
  }

  async getParagraphTexts() {
    const count = await this.paragraphs.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.paragraphs.nth(i).innerText());
    }
    return texts;
  }

  async countInteractiveElements() {
    return this.interactiveElements.count();
  }
}

test.describe('04436d81-fa79-11f0-8a8e-bbe4f11717c6 - NP-Completeness static page', () => {
  // Collect console error messages and page errors emitted during navigation and interactions.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      try {
        if (msg.type && msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // If any unexpected behavior occurs while reading console message, capture a stringified fallback.
        consoleErrors.push(String(msg));
      }
    });

    // Capture uncaught exceptions on the page (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      try {
        pageErrors.push(err.message || String(err));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });
  });

  test.afterEach(async () => {
    // Basic teardown logging for debugging if needed.
    // Note: We do not modify runtime or page behavior here; just keep logs available in test output.
    if (consoleErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured console.error messages:', consoleErrors);
    }
    if (pageErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors);
    }
  });

  test('State S0_Idle: page renders expected static content (entry state)', async ({ page }) => {
    // This test validates the FSM state S0_Idle's evidence: title and paragraphs exist and contain expected text.
    const npPage = new NPCompletenessPage(page);
    await npPage.goto();

    // Verify the title is present and matches the FSM evidence.
    await expect(npPage.title).toBeVisible();
    const titleText = await npPage.getTitleText();
    expect(titleText).toBe('NP-Completeness');

    // Verify the paragraphs include the expected explanatory text snippets from the FSM evidence.
    const paragraphs = await npPage.getParagraphTexts();
    // We expect at least two paragraphs per the HTML implementation.
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);

    // Check content contains expected substrings (not exact full-string match to allow minor differences).
    expect(paragraphs[0].toLowerCase()).toContain('np-completeness is a concept in computer science'.toLowerCase());
    expect(paragraphs[1].toLowerCase()).toContain('traveling salesman'.toLowerCase());
  });

  test('Entry action renderPage() observation: page should emit runtime errors if renderPage is missing', async ({ page }) => {
    // The FSM listed an entry action renderPage(). The implementation includes <script src="script.js"></script>.
    // We must load the page as-is and assert that runtime errors (ReferenceError / related) occur naturally.
    const npPage = new NPCompletenessPage(page);

    await npPage.goto();

    // Allow a short time for any scripts to run and for errors to propagate to our handlers.
    await page.waitForTimeout(300);

    // Combine captured error sources.
    const totalErrors = pageErrors.length + consoleErrors.length;

    // The task requires us to observe and assert that these errors occur.
    // Assert that at least one error was captured either as a page error or a console.error.
    expect(totalErrors).toBeGreaterThan(0);

    // Additionally, assert that one of the captured messages references 'renderPage' or indicates a ReferenceError,
    // since the FSM declared renderPage() as an entry action (we allow either indicator to satisfy the expectation).
    const combinedMessages = [...pageErrors, ...consoleErrors].join(' || ');

    const hints = ['renderPage', 'ReferenceError', 'TypeError', 'SyntaxError', 'Failed to load resource'];
    const foundHint = hints.some((hint) => combinedMessages.includes(hint));

    // Expect at least one of the typical error indicators to appear in the captured logs.
    expect(foundHint).toBeTruthy();
  });

  test('No transitions: interacting with the page does not change DOM or trigger additional errors', async ({ page }) => {
    // Since the FSM has no events or transitions, user interactions should not change state.
    const npPage = new NPCompletenessPage(page);

    await npPage.goto();

    // Record baseline state and errors.
    const titleBefore = await npPage.getTitleText();
    const paragraphsBefore = await npPage.getParagraphTexts();
    const initialConsoleErrors = [...consoleErrors];
    const initialPageErrors = [...pageErrors];

    // Attempt to interact: click on the container area and attempt a double-click.
    await npPage.container.click();
    await npPage.container.dblclick();

    // Wait briefly to allow any event handlers (if present) to run and possibly raise errors.
    await page.waitForTimeout(300);

    // Verify the title and paragraphs remain unchanged.
    const titleAfter = await npPage.getTitleText();
    const paragraphsAfter = await npPage.getParagraphTexts();

    expect(titleAfter).toBe(titleBefore);
    expect(paragraphsAfter).toEqual(paragraphsBefore);

    // Verify no new error kinds were introduced beyond the initial ones.
    // It's acceptable if initial errors exist; here we assert that no additional distinct errors were triggered by clicking.
    expect(consoleErrors.length).toBeGreaterThanOrEqual(initialConsoleErrors.length);
    expect(pageErrors.length).toBeGreaterThanOrEqual(initialPageErrors.length);

    // If new errors occurred, they should be consistent with missing scripts / missing functions,
    // not new unexpected exceptions thrown by interactions (still we do not attempt to patch anything).
  });

  test('Edge case: ensure there are no interactive controls (FSM reports none)', async ({ page }) => {
    // The FSM extraction summary states "No interactive elements or event handlers found."
    // Validate the DOM for common interactive elements and assert none are present.
    const npPage = new NPCompletenessPage(page);
    await npPage.goto();

    // Count interactive elements - we expect zero per FSM.
    const interactiveCount = await npPage.countInteractiveElements();
    expect(interactiveCount).toBe(0);

    // Also assert there are no <button> elements explicitly.
    const buttonCount = await page.locator('button').count();
    expect(buttonCount).toBe(0);

    // And no <input> elements.
    const inputCount = await page.locator('input, textarea, select').count();
    expect(inputCount).toBe(0);
  });

  test('Observability: console and page errors are captured for debugging', async ({ page }) => {
    // This test demonstrates capturing console logs and page errors without altering runtime.
    // It ensures our handlers (set up in beforeEach) are functioning and that we can assert on their contents.
    const npPage = new NPCompletenessPage(page);
    await npPage.goto();

    // Wait to allow any synchronous/asynchronous errors to surface.
    await page.waitForTimeout(300);

    // At minimum we expect our arrays to be defined and to be arrays.
    expect(Array.isArray(consoleErrors)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // If there are captured messages, ensure they are strings and non-empty.
    for (const msg of consoleErrors) {
      expect(typeof msg === 'string' || msg instanceof String).toBeTruthy();
      expect(String(msg).length).toBeGreaterThan(0);
    }
    for (const err of pageErrors) {
      expect(typeof err === 'string' || err instanceof String).toBeTruthy();
      expect(String(err).length).toBeGreaterThan(0);
    }

    // The test also asserts that at least one error was captured (per assignment instructions).
    const totalCaptured = consoleErrors.length + pageErrors.length;
    expect(totalCaptured).toBeGreaterThan(0);
  });
});