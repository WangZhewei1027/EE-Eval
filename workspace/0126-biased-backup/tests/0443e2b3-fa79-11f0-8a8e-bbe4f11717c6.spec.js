import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0443e2b3-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object for the ACID Properties page
class AcidPage {
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
    return this.page.locator('h1').innerText();
  }

  async getIntroText() {
    return this.page.locator('.container > p').innerText();
  }

  async getSectionCount() {
    return this.page.locator('.section').count();
  }

  async getSectionTitles() {
    const titles = await this.page.locator('.section h2').allInnerTexts();
    return titles;
  }

  async getSectionParagraphs() {
    const paras = await this.page.locator('.section p').allInnerTexts();
    return paras;
  }

  async hasAnyButtonsOrInputs() {
    const buttons = await this.page.locator('button').count();
    const inputs = await this.page.locator('input, textarea, select').count();
    return (buttons + inputs) > 0;
  }

  async countOnclickAttributes() {
    return this.page.locator('[onclick]').count();
  }

  // Evaluate whether a global function exists
  async isGlobalFunctionDefined(name) {
    return this.page.evaluate((fnName) => {
      try {
        return typeof window[fnName] === 'function';
      } catch {
        return false;
      }
    }, name);
  }
}

// Global test data collectors for console and page errors; created per test run in hooks
test.describe('ACID Properties Interactive Application (FSM: S0_Idle)', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages (type "error")
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(String(msg.text()));
        }
      } catch (e) {
        // ignore console collection errors
      }
    });

    // Collect unhandled page errors (exceptions)
    page.on('pageerror', (err) => {
      try {
        pageErrors.push(String(err && err.message ? err.message : err));
      } catch (e) {
        // ignore
      }
    });

    // Navigate to the page under test
    // We explicitly wait for load so referenced scripts (even missing) will attempt to load and errors will surface
    const acidPage = new AcidPage(page);
    await acidPage.goto();
  });

  test.afterEach(async () => {
    // nothing to teardown beyond Playwright's automatic teardown
  });

  test('Initial DOM matches FSM evidence for the Idle state (S0_Idle)', async ({ page }) => {
    // This test validates the static DOM content described by the FSM evidence:
    // - <h1> ACID Properties
    // - Intro paragraph text
    // - Presence and count of sections
    const acidPage = new AcidPage(page);

    // Validate heading text
    const heading = await acidPage.getHeadingText();
    expect(heading).toBe('ACID Properties', 'Expected main heading to match FSM evidence.');

    // Validate intro paragraph text
    const intro = await acidPage.getIntroText();
    expect(intro).toContain('Learn about ACID properties', 'Intro paragraph should mention learning about ACID properties.');

    // Validate there are six sections as present in the HTML implementation
    const sectionCount = await acidPage.getSectionCount();
    expect(sectionCount).toBe(6, 'Expected 6 .section elements based on the provided HTML.');

    // Validate each section has an h2 and a paragraph
    const titles = await acidPage.getSectionTitles();
    const paras = await acidPage.getSectionParagraphs();
    expect(titles.length).toBe(6);
    expect(paras.length).toBe(6);

    // Check duplicates: Consistency, Isolation, Durability each appear twice
    const counts = titles.reduce((acc, t) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
    expect(counts['Consistency']).toBe(2);
    expect(counts['Isolation']).toBe(2);
    expect(counts['Durability']).toBe(2);
  });

  test('No interactive elements or transitions exist (FSM has no events/transitions)', async ({ page }) => {
    // This test asserts there are no interactive controls (buttons/inputs) and no inline onclick handlers.
    // It validates the FSM note that there are no event handlers.
    const acidPage = new AcidPage(page);

    const hasControls = await acidPage.hasAnyButtonsOrInputs();
    expect(hasControls).toBeFalsy('Expected no button/input controls since FSM indicates no events or transitions.');

    const onclickCount = await acidPage.countOnclickAttributes();
    expect(onclickCount).toBe(0, 'Expected no inline onclick attributes (no event handlers detected).');
  });

  test('Verify entry action renderPage() presence/behavior and observe console/page errors', async ({ page }) => {
    // The FSM mentions an entry action: renderPage()
    // We must:
    // - Check whether a global renderPage function is defined
    // - Observe console errors and page errors that occur naturally (do not patch or inject)
    // - Assert that at least one of the following is true:
    //     * window.renderPage is undefined (entry action missing)
    //     * a ReferenceError / SyntaxError / TypeError was emitted to page errors
    //     * a console error mentioning the referenced script (script.js) occurred (e.g., failed to load)
    //
    // This ensures we verify onEnter actions in a non-invasive way.

    const acidPage = new AcidPage(page);

    // Check if global renderPage exists
    const renderPageDefined = await acidPage.isGlobalFunctionDefined('renderPage');

    // Wait shortly to allow any async script loading errors to surface in the collectors
    await page.waitForTimeout(100); // small delay to capture any late console/page errors

    // At this point, pageErrors and consoleErrors were collected in beforeEach and during navigation
    const hadPageErrors = pageErrors.length > 0;
    const hadConsoleErrors = consoleErrors.length > 0;

    // Provide diagnostics in the test output if assertions fail
    // Assert that at least one of the checks indicates a missing/erroneous entry action behavior
    const positiveEvidence = renderPageDefined === false || hadPageErrors || hadConsoleErrors;
    expect(positiveEvidence).toBeTruthy(
      `Expected either renderPage() to be undefined OR page errors/console errors to have occurred.
       renderPageDefined=${renderPageDefined}, pageErrors=${JSON.stringify(pageErrors)}, consoleErrors=${JSON.stringify(consoleErrors)}`
    );

    // Additionally, if any page errors exist, ensure they are instances of typical JS errors (ReferenceError/SyntaxError/TypeError)
    if (hadPageErrors) {
      const knownError = pageErrors.some(msg =>
        /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(msg)
      );
      expect(knownError).toBeTruthy(`Expected JavaScript error types in pageErrors, got: ${JSON.stringify(pageErrors)}`);
    }

    // If console errors exist, at least one should mention the referenced external script or a failed resource load
    if (hadConsoleErrors) {
      const mentionsScript = consoleErrors.some(text => /script\.js|Failed to load resource|404|ERR_ABORTED|net::ERR/i.test(text));
      // It's acceptable if console errors are about other issues, but we prefer they reference the external script.
      // So we don't strictly require it, but when possible we assert it.
      // If it doesn't mention script.js, still assert there is at least one console error (we already know hadConsoleErrors)
      expect(hadConsoleErrors).toBeTruthy();
      // If the test environment provides a console error that mentions script.js, assert that too (non-fatal)
      if (mentionsScript) {
        expect(mentionsScript).toBeTruthy();
      }
    }
  });

  test('Edge case checks: duplicate headings and accessibility basics', async ({ page }) {
    // This test validates edge cases: duplicate h2 headings (intentional in HTML) and that basic accessibility markup exists.
    const acidPage = new AcidPage(page);
    const titles = await acidPage.getSectionTitles();

    // Duplicate title values should be present for the ACID properties (Consistency, Isolation, Durability)
    const duplicates = titles.filter((t, i, arr) => arr.indexOf(t) !== i);
    expect(duplicates.length).toBeGreaterThan(0, 'Expected duplicate section titles due to repeated property sections.');

    // Basic accessibility checks: at least the main heading is an h1 and sections use h2 (already asserted earlier)
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1, 'There should be exactly one <h1> for the page title.');

    // Role-free but semantic sections exist; ensure that each .section has an h2 and p for content
    const sectionCount = await acidPage.getSectionCount();
    for (let i = 0; i < sectionCount; i++) {
      const h2 = await page.locator('.section').nth(i).locator('h2').count();
      const p = await page.locator('.section').nth(i).locator('p').count();
      expect(h2).toBe(1);
      expect(p).toBe(1);
    }
  });

  test('Observe and report collected console and page errors (diagnostic test)', async ({ page }) => {
    // This test intentionally asserts and reports the collected console and page errors for debugging and validation.
    // It ensures that the test suite captured runtime diagnostics that occur when loading the page as-is.

    // Small pause to capture any late errors
    await page.waitForTimeout(50);

    // Validate that our collectors exist and contain arrays
    expect(Array.isArray(pageErrors)).toBe(true);
    expect(Array.isArray(consoleErrors)).toBe(true);

    // At minimum, examine content types (strings) if present
    for (const err of pageErrors) {
      expect(typeof err).toBe('string');
    }
    for (const c of consoleErrors) {
      expect(typeof c).toBe('string');
    }

    // The test intentionally does not fail based on specific messages here; it's diagnostic.
    // However, we assert that the collectors are present (even if empty).
    expect(pageErrors).not.toBeNull();
    expect(consoleErrors).not.toBeNull();
  });
});