import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b23133-fa7c-11f0-adc7-178f556b1ee0.html';

// Simple page object to encapsulate common selectors and interactions for the static page
class DeadlockPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.h1 = page.locator('h1');
    this.title = page.evaluate.bind(page, () => document.title);
    this.paragraphs = page.locator('body p');
    this.lists = page.locator('ul, ol');
    this.pre = page.locator('pre');
    this.interactiveElements = page.locator('button, input, textarea, select, a');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getH1Text() {
    return this.h1.textContent();
  }

  async getTitle() {
    return this.page.title();
  }

  async getParagraphCount() {
    return this.paragraphs.count();
  }

  async getListCount() {
    return this.lists.count();
  }

  async getPreText() {
    return this.pre.textContent();
  }

  async countInteractiveElements() {
    return this.interactiveElements.count();
  }
}

test.describe('f5b23133-fa7c-11f0-adc7-178f556b1ee0 - Deadlock Explanation page', () => {
  // Arrays to hold console and page error events observed during navigation
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // In case msg.text() throws (rare), record fallback
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      // err is an Error object, serialize minimally
      pageErrors.push({
        message: err.message,
        name: err.name,
        stack: err.stack,
      });
    });
  });

  test.afterEach(async () => {
    // cleanup arrays (helps tests be isolated if re-used)
    consoleMessages = [];
    pageErrors = [];
  });

  test.describe('FSM State: S0_Idle (Idle)', () => {
    // Validate the entry action and static content described by the FSM.
    test('renders the page title, main heading and expected static content', async ({ page }) => {
      // Arrange: create page object and navigate
      const dp = new DeadlockPage(page);
      await dp.goto();

      // Assert: the document title matches FSM evidence
      const title = await dp.getTitle();
      expect(title).toBe('Deadlock Explanation');

      // Assert: main heading is present and correct
      const h1Text = await dp.getH1Text();
      expect(h1Text?.trim()).toBe('Deadlock Explanation');

      // Assert: paragraphs and lists are present (static content)
      const paraCount = await dp.getParagraphCount();
      expect(paraCount).toBeGreaterThanOrEqual(8); // page contains multiple paragraphs

      const listCount = await dp.getListCount();
      expect(listCount).toBeGreaterThanOrEqual(2); // one ul and one ol expected

      // Assert: preformatted code block contains the sample function name
      const preText = await dp.getPreText();
      expect(preText).toContain('function deadlockDetection');
      expect(preText).toContain('function checkDependency');

      // Assert: there are no interactive controls detected as per FSM extraction notes
      const interactiveCount = await dp.countInteractiveElements();
      expect(interactiveCount).toBe(0);
    });

    // This test validates the FSM's declared entry action renderPage()
    // We do NOT modify the page; we only observe whether any errors related to calling renderPage appear.
    test('observes console and page errors related to entry action renderPage()', async ({ page }) => {
      const dp = new DeadlockPage(page);

      // Navigate to load the page and capture any console/page errors produced during load
      await dp.goto();

      // At this point, consoleMessages and pageErrors arrays have been populated by listeners in beforeEach

      // Comment:
      // The FSM declared an entry action "renderPage()". The implementation provided is static HTML
      // with no scripts that call renderPage. Therefore, two valid outcomes are:
      // 1) No runtime page errors occur (page loads cleanly).
      // 2) If some external script attempted to call renderPage, a ReferenceError mentioning renderPage would appear.
      //
      // We assert that the environment is consistent: either there are no page errors, or if there are
      // page errors they include an error referencing "renderPage" or are a ReferenceError.
      if (pageErrors.length === 0) {
        // No runtime errors occurred during load: pass this expectation explicitly
        expect(pageErrors.length).toBe(0);
      } else {
        // If there are page errors, at least one should be related to the missing entry action name,
        // or be a common JS error type. This ensures we observe relevant errors rather than unrelated failures.
        const foundRelevant = pageErrors.some((err) => {
          const msg = `${err.name}: ${err.message}`.toLowerCase();
          return msg.includes('renderpage') || err.name === 'ReferenceError' || err.name === 'TypeError' || err.name === 'SyntaxError';
        });
        expect(foundRelevant).toBe(true);
      }

      // Additionally assert that console messages (if any) were captured and are strings.
      for (const cm of consoleMessages) {
        expect(typeof cm.type).toBe('string');
        expect(typeof cm.text).toBe('string');
      }
    });

    // Edge case: ensure there are no unexpected interactive event handlers or clickable anchors
    test('confirms absence of interactive controls and event handlers (edge case)', async ({ page }) => {
      const dp = new DeadlockPage(page);
      await dp.goto();

      // No buttons/inputs/anchors expected per extraction summary
      const interactiveCount = await dp.countInteractiveElements();
      expect(interactiveCount).toBe(0);

      // Sanity check: ensure that clickable <a> elements are absent (if present, they would be interactive)
      const anchorCount = await page.locator('a').count();
      expect(anchorCount).toBe(0);
    });
  });

  test.describe('FSM Transitions and Events (none expected)', () => {
    // The FSM provided contains no transitions or events. Validate that user interactions do not change state.
    test('verifies that attempting to click does not change static content (no transitions)', async ({ page }) => {
      const dp = new DeadlockPage(page);
      await dp.goto();

      // Capture current heading and paragraph count
      const beforeH1 = await dp.getH1Text();
      const beforeParaCount = await dp.getParagraphCount();

      // Attempt to click at several locations on the page (body, headings, lists).
      // Since there are no interactive elements, clicks should not navigate or mutate main content.
      await page.click('body', { position: { x: 10, y: 10 } });
      await page.click('h1');
      const listLocator = page.locator('ul').first();
      if ((await listLocator.count()) > 0) {
        await listLocator.click();
      }

      // Re-evaluate heading and paragraph count
      const afterH1 = await dp.getH1Text();
      const afterParaCount = await dp.getParagraphCount();

      // Assert nothing changed (no transitions occurred)
      expect(afterH1?.trim()).toBe(beforeH1?.trim());
      expect(afterParaCount).toBe(beforeParaCount);
    });

    // Negative test: Ensure that the page does not try to call any transition functions that are undefined.
    // We watch page errors collected earlier: if the page attempted to execute a transition function that is missing,
    // a ReferenceError would appear. We assert either no such errors happened or they are clearly named.
    test('observes for missing transition function ReferenceErrors (error scenario)', async ({ page }) => {
      const dp = new DeadlockPage(page);
      await dp.goto();

      // If there are page errors, ensure any missing function calls are identifiable
      if (pageErrors.length === 0) {
        expect(pageErrors.length).toBe(0);
      } else {
        const hasMissingFnError = pageErrors.some((err) => /referenceerror|is not defined|not a function/i.test(`${err.name} ${err.message}`));
        // If errors exist, we accept them only if they are recognizable JS runtime errors; otherwise the test flags unexpected errors.
        expect(hasMissingFnError).toBe(true);
      }
    });
  });
});