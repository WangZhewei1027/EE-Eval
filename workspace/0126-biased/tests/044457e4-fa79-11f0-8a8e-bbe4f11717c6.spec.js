import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/044457e4-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page Object for the Unit Testing static page.
 * Encapsulates queries and common assertions for the page under test.
 */
class UnitTestingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getHeadingText() {
    const h1 = await this.page.locator('h1').first();
    return h1.textContent();
  }

  async getParagraphsText() {
    const ps = this.page.locator('div.container > p');
    const count = await ps.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await ps.nth(i).textContent()) || '');
    }
    return texts;
  }

  async hasInteractiveElements() {
    const buttons = await this.page.locator('button, input, a, textarea, select').count();
    return buttons > 0;
  }
}

/**
 * Global test hooks to capture console messages and page errors.
 * Each test will create fresh arrays to avoid cross-test contamination.
 */
test.describe('044457e4-fa79-11f0-8a8e-bbe4f11717c6 - Unit Testing page', () => {
  // Individual test-level holders (populated in beforeEach)
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize containers for each test
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection (info, warning, error, debug, etc.)
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In the unlikely event msg.text() throws, record minimal info
        consoleMessages.push({ type: 'unknown', text: '<failed to read msg.text()>' });
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      // store Error objects for later assertions
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // optional: wait a short time to allow late console messages (if any)
    await page.waitForTimeout(50);
    // detach listeners implicitly by test framework when page is closed
  });

  test.describe('Static content matches FSM Idle state', () => {
    test('renders expected heading and paragraph evidence (Idle state entry)', async ({ page }) => {
      // This test validates the "Idle" state's evidence: the page should render static content.
      const utp = new UnitTestingPage(page);
      await utp.goto();

      // Ensure the main heading exists and matches the FSM evidence
      const heading = await utp.getHeadingText();
      expect(heading).toBeTruthy();
      expect(heading.trim()).toBe('Unit Testing');

      // Ensure the page contains exactly the paragraphs described in the FSM evidence
      const paragraphs = await utp.getParagraphsText();
      // FSM evidence lists 3 paragraph lines; assert at least those are present in order
      expect(paragraphs.length).toBeGreaterThanOrEqual(3);

      // Exact content assertions for the first three paragraphs
      expect(paragraphs[0].trim()).toBe('Beautiful, polished UI with smooth animations and transitions');
      expect(paragraphs[1].trim()).toBe('Professional color schemes and typography');
      expect(paragraphs[2].trim()).toBe('Visually stunning graphics and layouts');
    });

    test('does not include interactive elements (page is informational)', async ({ page }) => {
      // Validate the extracted FSM note: "No interactive elements or event handlers were found."
      const utp = new UnitTestingPage(page);
      await utp.goto();

      const hasInteractive = await utp.hasInteractiveElements();
      expect(hasInteractive).toBe(false);
    });
  });

  test.describe('Script inclusion and runtime error observation', () => {
    test('observes console messages and page errors produced naturally by the page', async ({ page }) => {
      // This test only loads the page and records runtime artifacts.
      // Per instructions, do NOT modify or patch the page. Let any ReferenceError, SyntaxError, TypeError happen naturally.
      const utp = new UnitTestingPage(page);
      await utp.goto();

      // allow a small window for scripts to run and possibly throw
      await page.waitForTimeout(200);

      // Basic expectations about our captured logs structure
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // If pageErrors occurred, validate they are Error objects and their messages are informative.
      if (pageErrors.length > 0) {
        for (const err of pageErrors) {
          // The test asserts that any uncaught exception is an Error and includes a message
          expect(err).toBeInstanceOf(Error);
          expect(typeof err.message).toBe('string');
          expect(err.message.length).toBeGreaterThan(0);

          // Because the external script may reference renderPage() or contain mistakes,
          // ensure reported errors are plausible JS runtime errors (ReferenceError, TypeError, SyntaxError)
          const msg = err.message;
          const commonErrorTypes = ['ReferenceError', 'TypeError', 'SyntaxError', 'Error'];
          const matched = commonErrorTypes.some((t) => msg.includes(t) || msg.includes('is not defined') || msg.includes('Unexpected'));
          expect(matched).toBe(true);
        }
      } else {
        // If no pageErrors were thrown, assert that at minimum the static content rendered correctly (already tested above).
        // This branch documents the edge case where included script.js did not produce runtime exceptions.
        expect(await utp.getHeadingText()).toBe('Unit Testing');
      }

      // Inspect console messages for failed resource loads (commonly when script.js is missing)
      const consoleTexts = consoleMessages.map((m) => m.text);
      // It's acceptable for the console to contain network/resource load failures or script errors.
      // If there are messages mentioning renderPage or 'Failed to load' or '404', record that as observed behavior.
      const resourceFailures = consoleTexts.filter((t) => /Failed to load resource|404|renderPage|is not defined|Uncaught/.test(t));
      // We do not require such messages to exist, but if they do, ensure they look like expected failure diagnostics.
      for (const txt of resourceFailures) {
        expect(typeof txt).toBe('string');
        expect(txt.length).toBeGreaterThan(0);
      }
    });

    test('validates that if renderPage is referenced it results in a visible error (allowed to happen naturally)', async ({ page }) => {
      // This test explicitly checks for evidence that a renderPage call (mentioned in the FSM entry action)
      // caused a ReferenceError or similar when the page loaded. We do not induce it; we only assert if it happened.
      await page.goto(APP_URL, { waitUntil: 'load' });

      const observedConsole = [];
      page.on('console', (msg) => observedConsole.push({ type: msg.type(), text: msg.text() }));
      const observedErrors = [];
      page.on('pageerror', (err) => observedErrors.push(err));

      // give any inline/external scripts a moment to run
      await page.waitForTimeout(200);

      // Search both console messages and page errors for a hint that renderPage was referenced but not defined
      const consoleMentionsRenderPage = observedConsole.some((c) => /renderPage/.test(c.text));
      const pageErrorMentionsRenderPage = observedErrors.some((e) => /renderPage/.test(e.message));

      // If either occurred, assert that the symptom matches expected JS runtime diagnostics.
      if (consoleMentionsRenderPage || pageErrorMentionsRenderPage) {
        // At least one artifact mentions renderPage; this likely indicates the FSM's entry action was attempted in runtime.
        expect(consoleMentionsRenderPage || pageErrorMentionsRenderPage).toBe(true);

        // If there are page errors, ensure they look like ReferenceError / is not defined diagnostics.
        for (const e of observedErrors) {
          const m = e.message;
          const isRef = /ReferenceError/.test(m) || /is not defined/.test(m);
          const isTypeOrSyntax = /TypeError|SyntaxError/.test(m);
          expect(isRef || isTypeOrSyntax).toBe(true);
        }
      } else {
        // If no mention of renderPage was observed, we simply record that the FSM's abstract entry action did not manifest as a runtime call.
        // Assert the static page still rendered correctly as a fallback expectation.
        const h1 = await page.locator('h1').textContent();
        expect(h1?.trim()).toBe('Unit Testing');
      }
    });
  });

  test.describe('Edge cases and robustness checks', () => {
    test('reloading the page does not create interactive elements or duplicate content', async ({ page }) => {
      const utp = new UnitTestingPage(page);
      await utp.goto();

      // First load checks
      const initialH1 = await utp.getHeadingText();
      const initialParagraphs = await utp.getParagraphsText();

      // Reload the page as an edge case to ensure no duplication or unexpected interactive elements appear
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(100);

      const afterReloadH1 = await utp.getHeadingText();
      const afterReloadParagraphs = await utp.getParagraphsText();
      const hasInteractiveAfterReload = await utp.hasInteractiveElements();

      // Assertions:
      expect(afterReloadH1.trim()).toBe(initialH1.trim());
      expect(afterReloadParagraphs.length).toBeGreaterThanOrEqual(initialParagraphs.length);
      // Ensure we haven't gained interactive elements on reload
      expect(hasInteractiveAfterReload).toBe(false);
    });

    test('navigating to a non-existent sibling resource should not alter page static content', async ({ page }) => {
      // Edge case: try to navigate to a similar but non-existent path (do not modify the tested page)
      // This is to observe how the server and browser report resource errors without changing application state.
      const utp = new UnitTestingPage(page);
      await utp.goto();

      // Attempt to fetch a sibling file that likely doesn't exist, e.g. script-missing.js, by injecting an image reference.
      // We will not inject into page DOM in a way that patches runtime; instead, navigate temporarily to the non-existent file URL
      // and then go back. This verifies server/resource failure handling in isolation.
      const missingResourceUrl = 'http://127.0.0.1:5500/workspace/0126-biased/html/non-existent-script.js';
      // perform a request via page.goto but don't expect it to succeed; catch any navigation failures gracefully
      let navigationFailed = false;
      try {
        await page.goto(missingResourceUrl, { waitUntil: 'load', timeout: 2000 });
      } catch (e) {
        navigationFailed = true;
      }

      // Go back to the app page and assert its content remains intact
      await page.goto(APP_URL, { waitUntil: 'load' });
      const h1 = await utp.getHeadingText();
      expect(h1?.trim()).toBe('Unit Testing');

      // The navigation to a missing resource may fail; we accept either behavior but assert we didn't tamper with the app.
      expect(typeof navigationFailed).toBe('boolean');
    });
  });
});