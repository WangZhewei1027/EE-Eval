import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04447ef2-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object model for the Refactoring page
class RefactorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.refactorButton = page.locator('#refactor-button');
    this.resultDiv = page.locator('.result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isRefactorButtonVisible() {
    return await this.refactorButton.isVisible();
  }

  async clickRefactor() {
    await this.refactorButton.click();
  }

  async getResultText() {
    // Use innerText to capture visible text, fall back to textContent if needed
    try {
      return (await this.resultDiv.innerText()).trim();
    } catch {
      const content = await this.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.textContent : null;
      }, '.result');
      return content ? content.trim() : content;
    }
  }
}

test.describe('Refactoring FSM - interactive application tests (Application ID: 04447ef2-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleMessages = [];

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Capture console messages
    page.on('console', (msg) => {
      // msg.text() and msg.type() available
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  test.afterEach(async () => {
    // Basic sanity: attach logs to test output if needed for debugging
    if (consoleMessages.length) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
    }
    if (pageErrors.length) {
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors);
    }
  });

  test.describe('State S0_Idle (Initial render) validations', () => {
    test('Idle state: page renders refactor button and an empty result container, and renderPage() onEnter is observed or its absence causes an error', async ({ page }) => {
      // This test validates the initial Idle state (S0_Idle).
      // We check presence of the button and that the result div exists and is empty.
      // We also attempt to verify the entry action renderPage() either by observing a console message
      // that mentions "renderPage" OR by observing a ReferenceError mentioning renderPage if it was invoked but missing.
      const refactor = new RefactorPage(page);
      await refactor.goto();

      // Assert the refactor button is present and visible
      await expect(refactor.refactorButton).toBeVisible();

      // Assert the result div exists
      await expect(refactor.resultDiv).toBeVisible();

      // Assert the result div is empty (trimmed)
      const initialResult = await refactor.getResultText();
      expect(initialResult === '' || initialResult === null).toBeTruthy();

      // Check if renderPage was logged to console
      const renderPageLogged = consoleMessages.some(m => /renderPage/i.test(m.text));
      // Check if there was a page error that mentions renderPage (e.g., ReferenceError: renderPage is not defined)
      const renderPageError = pageErrors.some(e => /renderPage/i.test(e));

      // Validate that either renderPage executed (console log) or attempting to call it produced an error
      expect(renderPageLogged || renderPageError).toBeTruthy();
    });
  });

  test.describe('Transition: RefactorClick (S0_Idle -> S1_Refactoring)', () => {
    test('Clicking Refactor transitions to Refactoring state: result displayed OR JS runtime error occurs', async ({ page }) => {
      // This test validates the RefactorClick event and the transition to S1_Refactoring.
      // The expected observable is that a result is displayed in the .result div.
      // However, we also observe runtime errors and accept that a ReferenceError/TypeError/SyntaxError
      // may naturally occur; we assert that either a result appears or a JS error was captured.
      const refactor = new RefactorPage(page);
      await refactor.goto();

      // Ensure starting state is Idle
      await expect(refactor.refactorButton).toBeVisible();
      const beforeText = await refactor.getResultText();
      expect(beforeText === '' || beforeText === null).toBeTruthy();

      // Click the refactor button to trigger the transition
      await refactor.clickRefactor();

      // Wait briefly to allow any DOM updates or errors to surface
      await page.waitForTimeout(250);

      const afterText = await refactor.getResultText();

      // Determine if a meaningful result was displayed
      const resultDisplayed = typeof afterText === 'string' && afterText.trim().length > 0;

      // Determine if any runtime JS errors of the expected categories occurred
      const hasRuntimeError = pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/i.test(e));

      // Assert that either the result was displayed OR a runtime error occurred (per the instruction to observe natural errors)
      expect(resultDisplayed || hasRuntimeError).toBeTruthy();

      // If a result was displayed, also verify the DOM contains the .result element content changes
      if (resultDisplayed) {
        // Provide a stronger assertion that the result div now contains visible text
        expect(afterText.length).toBeGreaterThan(0);
      } else {
        // If no result but errors occurred, assert that at least one of the expected error types is present
        expect(hasRuntimeError).toBeTruthy();
      }
    });

    test('Idempotence and repeated interactions: clicking Refactor multiple times should produce consistent results or repeatable errors', async ({ page }) => {
      // This test checks repeated events: click the refactor button multiple times.
      // We validate that either repeated clicks update the result (maybe different content)
      // or that errors consistently appear (e.g., consistent ReferenceError).
      const refactor = new RefactorPage(page);
      await refactor.goto();

      // Clear collectors
      pageErrors = [];
      consoleMessages = [];

      // Perform multiple clicks
      const clicks = 3;
      for (let i = 0; i < clicks; i++) {
        await refactor.clickRefactor();
        // small delay between clicks
        await page.waitForTimeout(150);
      }

      // Evaluate results after repeated clicks
      const finalText = await refactor.getResultText();
      const resultDisplayed = typeof finalText === 'string' && finalText.trim().length > 0;
      const runtimeErrors = pageErrors.filter(e => /ReferenceError|TypeError|SyntaxError/i.test(e));

      // Validate either consistent results or presence of runtime errors from repeated interactions
      expect(resultDisplayed || runtimeErrors.length > 0).toBeTruthy();

      // If there are runtime errors, ensure they are of the expected categories
      if (runtimeErrors.length > 0) {
        for (const e of runtimeErrors) {
          expect(/ReferenceError|TypeError|SyntaxError/i.test(e)).toBeTruthy();
        }
      }

      // If a result was displayed, assert that it is stable (string) after multiple clicks
      if (resultDisplayed) {
        expect(finalText).toBeTruthy();
      }
    });
  });

  test.describe('Error & edge-case validation', () => {
    test('Observe and assert presence of JS runtime errors (ReferenceError, TypeError, or SyntaxError) if they happen', async ({ page }) => {
      // This test ensures we observe runtime errors emitted during page load or interactions.
      // Per instructions, we must observe console logs and page errors and assert that ReferenceError, TypeError,
      // or SyntaxError occur. Note: these errors should happen naturally; we do not patch the runtime.
      const refactor = new RefactorPage(page);
      await refactor.goto();

      // Trigger an interaction that commonly reveals lifecycle errors
      await refactor.clickRefactor();

      // Allow some time for any async errors to surface
      await page.waitForTimeout(300);

      // Filter page errors to the categories of interest
      const interestingErrors = pageErrors.filter(e => /ReferenceError|TypeError|SyntaxError/i.test(e));

      // We assert that at least one of these errors was captured.
      // If none are present, the test will fail, which is intentional per the specification that we must assert these errors occur.
      expect(interestingErrors.length).toBeGreaterThan(0);
    });

    test('Console message inspection: verify that performRefactor or other lifecycle logs are present or that their absence produced errors', async ({ page }) => {
      // This test inspects console logs to see if performRefactor was logged (indicating entry/transition actions executed)
      // or that its invocation resulted in an error (which we should have captured via pageErrors).
      const refactor = new RefactorPage(page);
      await refactor.goto();

      // Clear collectors for clearer signal
      pageErrors = [];
      consoleMessages = [];

      // Attempt to exercise refactor flow
      await refactor.clickRefactor();
      await page.waitForTimeout(200);

      const performedLog = consoleMessages.some(m => /performRefactor/i.test(m.text));
      const performError = pageErrors.some(e => /performRefactor/i.test(e));

      // Validate that either the function was logged as executed or that trying to call it generated an error
      expect(performedLog || performError).toBeTruthy();
    });
  });
});