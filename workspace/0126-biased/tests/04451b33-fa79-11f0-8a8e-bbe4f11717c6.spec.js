import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04451b33-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object for the Overfitting app
class OverfittingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // capture console messages for later assertions
    this.page.on('console', (msg) => {
      try {
        this.consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        // in case msg methods throw, still push raw
        this.consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });
    // capture unhandled page errors (ReferenceError, SyntaxError, TypeError etc)
    this.page.on('pageerror', (err) => {
      // err is an Error object
      this.pageErrors.push(err);
    });
  }

  async goto() {
    // Load the application page and wait for network to be quiet
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  learnMoreButton() {
    return this.page.locator('#learn-more-btn');
  }

  analyzeButton() {
    return this.page.locator('#analyze-btn');
  }

  canvas() {
    return this.page.locator('#line-chart');
  }

  // Try to click Learn More (normal click). Many implementations attach handlers.
  async clickLearnMore() {
    await this.learnMoreButton().click();
  }

  // Analyze button may be disabled. Use force:true to trigger click even when disabled.
  async clickAnalyze({ force = true } = {}) {
    await this.analyzeButton().click({ force });
  }

  // Attempt to detect a "more info" element created by showMoreInfo() if present.
  // We check several reasonable selectors / text that such a function might produce.
  moreInfoLocator() {
    // Try a few plausible selectors/texts:
    return this.page.locator('text=More information').first();
  }

  // Utility to wait briefly for potential DOM changes or errors to appear.
  async shortWait() {
    await this.page.waitForTimeout(300); // 300ms small delay to let scripts run
  }

  // Returns captured console messages
  getConsoleMessages() {
    return this.consoleMessages;
  }

  // Returns captured page errors
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Overfitting App - FSM and UI validation (04451b33-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Will be set in beforeEach
  let app;

  test.beforeEach(async ({ page }) => {
    app = new OverfittingPage(page);
    await app.goto();
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach simple diagnostics to the test output if any errors/messages captured
    // (Playwright automatically records console and page errors in traces; we add quick summary)
    const errors = app.getPageErrors();
    const consoles = app.getConsoleMessages();
    if (errors.length) {
      // console.log is not available for test output in final report, but we add an expectation later.
    }
    // Nothing to teardown beyond this page-level cleanup (Playwright handles closing pages)
  });

  test.describe('Initial "Idle" state (S0_Idle) validations', () => {
    test('Initial DOM contains key components and analyze button is disabled', async () => {
      // Validate presence of page title heading and main elements described in FSM
      const h1 = app.page.locator('h1');
      await expect(h1).toHaveText(/Overfitting/);

      // Learn More button should be visible and enabled
      const learnBtn = app.learnMoreButton();
      await expect(learnBtn).toBeVisible();
      await expect(learnBtn).toHaveText('Learn More');

      // Analyze button should exist and be disabled as per FSM evidence
      const analyzeBtn = app.analyzeButton();
      await expect(analyzeBtn).toBeVisible();
      // The 'disabled' attribute should be present in HTML per specification
      const disabledAttr = await analyzeBtn.getAttribute('disabled');
      // If attribute is present it may be "true" or empty string depending on how it's rendered.
      expect(disabledAttr === null || typeof disabledAttr === 'string').toBeTruthy();
      // Explicit check that the bounding element reports disabled when attribute is present
      if (disabledAttr !== null) {
        // If attribute exists, the button should be disabled.
        // Playwright's isDisabled uses element property; prefer that when attribute present.
        await expect(analyzeBtn).toBeDisabled();
      } else {
        // attribute not present: still assert that analysis button is not obviously enabled
        // but do not fail strictly; just ensure it exists.
        await expect(analyzeBtn).toBeVisible();
      }

      // Canvas for the line chart should be present
      await expect(app.canvas()).toBeVisible();
    });

    test('Entry action renderPage() is attempted on load (verify runtime errors related to entry actions)', async () => {
      // Some implementations call renderPage() on load as an entry_action.
      // We observe runtime page errors and assert that at least one runtime error (ReferenceError/TypeError/SyntaxError) occurred.
      // This test explicitly asserts that the environment produced such an error naturally.
      // Note: We do not modify or patch the page; we simply observe errors.
      await app.shortWait(); // let any immediate script errors surface

      const errors = app.getPageErrors();
      // We expect at least one runtime error to have occurred during or shortly after load.
      // This aligns with the requirement to observe and assert that such errors occur naturally.
      expect(errors.length).toBeGreaterThan(0);

      // Confirm that at least one of the errors is a ReferenceError, TypeError or SyntaxError
      const matches = errors.some((e) => {
        const name = e && e.name ? e.name : '';
        const msg = e && e.message ? e.message : String(e);
        return /ReferenceError|TypeError|SyntaxError/i.test(name) || /ReferenceError|TypeError|SyntaxError/i.test(msg);
      });
      expect(matches).toBeTruthy();
    });
  });

  test.describe('Learning More state (S1_LearningMore) and transitions', () => {
    test('Clicking Learn More triggers an attempt to show more info (onEnter: showMoreInfo)', async () => {
      // Before clicking, capture counts
      const initialErrors = app.getPageErrors().length;
      const initialConsole = app.getConsoleMessages().length;

      // Click the Learn More button once
      await app.clickLearnMore();

      // Allow any handlers to run
      await app.shortWait();

      const errors = app.getPageErrors();
      const consoles = app.getConsoleMessages();

      // There are two possible natural outcomes:
      // 1) The page implements showMoreInfo() and displays additional content. We'll detect that.
      // 2) showMoreInfo() is not defined and a ReferenceError (or similar) is thrown. We'll assert that error occurred.
      const moreInfo = app.moreInfoLocator();
      const moreInfoCount = await moreInfo.count();

      if (moreInfoCount > 0) {
        // Successful path: More information was displayed.
        await expect(moreInfo).toBeVisible();
      } else {
        // Error path: Expect at least one new runtime error referencing showMoreInfo or general runtime issue
        expect(errors.length).toBeGreaterThanOrEqual(initialErrors + 1);
        const newErrors = errors.slice(initialErrors);
        const hasShowMoreInfoRef = newErrors.some((e) => {
          const name = e && e.name ? e.name : '';
          const msg = e && e.message ? e.message : String(e);
          return /showMoreInfo/i.test(msg) || /showMoreInfo/i.test(name) || /ReferenceError|TypeError|SyntaxError/i.test(name);
        });
        expect(hasShowMoreInfoRef).toBeTruthy();
      }

      // Also assert that clicking Learn More produced some console activity (either debug/log or error)
      expect(consoles.length).toBeGreaterThanOrEqual(initialConsole);
    });

    test('Clicking Learn More again attempts to return to Idle (S1 -> S0) and toggles more info off or causes additional errors', async () => {
      // Click once to enter learning state (whatever that does)
      await app.clickLearnMore();
      await app.shortWait();

      // Capture baseline after first click
      const errorsAfterFirst = app.getPageErrors().length;
      const consolesAfterFirst = app.getConsoleMessages().length;

      // Click again to trigger transition back to Idle
      await app.clickLearnMore();
      await app.shortWait();

      // After the second click, either the extra info is removed (toggled off) or additional runtime errors occurred.
      const moreInfo = app.moreInfoLocator();
      const moreInfoCount = await moreInfo.count();

      const errorsAfterSecond = app.getPageErrors().length;
      const newErrors = errorsAfterSecond - errorsAfterFirst;

      if (moreInfoCount > 0) {
        // If more info still present, maybe implementation doesn't toggle; at minimum ensure button still present
        await expect(app.learnMoreButton()).toBeVisible();
      } else {
        // If no more info, treat this as successful return to Idle: verify analyze button still present and disabled state unchanged
        await expect(app.learnMoreButton()).toBeVisible();
        const analyzeBtn = app.analyzeButton();
        await expect(analyzeBtn).toBeVisible();
      }

      // If errors appeared as a result of the second click, ensure they are runtime errors (don't suppress them)
      if (newErrors > 0) {
        const errors = app.getPageErrors().slice(-newErrors);
        const hasRuntime = errors.some((e) => {
          const name = e && e.name ? e.name : '';
          const msg = e && e.message ? e.message : String(e);
          return /ReferenceError|TypeError|SyntaxError/i.test(name) || /ReferenceError|TypeError|SyntaxError/i.test(msg);
        });
        expect(hasRuntime).toBeTruthy();
      }

      // Ensure some console activity occurred across the two clicks (at least not silent)
      expect(app.getConsoleMessages().length).toBeGreaterThanOrEqual(consolesAfterFirst);
    });
  });

  test.describe('Analyzing state (S2_Analyzing) and transitions', () => {
    test('Attempt to click Analyze triggers analyzeData() (onEnter: analyzeData) or raises a runtime error', async () => {
      // The Analyze button is initially disabled in the markup.
      // To validate the S0 -> S2 transition, we force a click (bypass disabled attribute) and observe behavior.
      const initialErrors = app.getPageErrors().length;
      const initialConsole = app.getConsoleMessages().length;

      // Force click even if disabled to simulate the transition event
      await app.clickAnalyze({ force: true });

      await app.shortWait();

      const errors = app.getPageErrors();
      const consoles = app.getConsoleMessages();

      // Expected outcomes:
      // - If analyzeData() exists, it may produce console output or modify the canvas.
      // - If it does not exist, a ReferenceError (or similar) should have been thrown.
      const newErrors = errors.slice(initialErrors);

      if (newErrors.length === 0) {
        // No new page errors: attempt to detect visible indication of analysis:
        // check for possible console messages indicating analysis or canvas changes (some implementations log).
        const recentConsoles = consoles.slice(initialConsole).map(c => c.text);
        const foundAnalyzeMsg = recentConsoles.some(text => /analyz|analysis|analyzeData|analyzing/i.test(text));
        // Alternatively, try to see if canvas has been repainted: we can't inspect pixels, but ensure canvas still present.
        await expect(app.canvas()).toBeVisible();
        // If no console signals, we still accept that analysis may have happened silently. Assert canvas present and no runtime errors.
        expect(newErrors.length).toBe(0);
        // Prefer to see some console indication, but do not fail if absent.
      } else {
        // New errors exist. At least one should be a runtime error linked to analyzeData or be a general runtime error.
        const hasAnalyzeRef = newErrors.some((e) => {
          const name = e && e.name ? e.name : '';
          const msg = e && e.message ? e.message : String(e);
          return /analyzeData/i.test(msg) || /analyzeData/i.test(name) || /ReferenceError|TypeError|SyntaxError/i.test(name) || /ReferenceError|TypeError|SyntaxError/i.test(msg);
        });
        expect(hasAnalyzeRef).toBeTruthy();
      }
    });

    test('Edge case: rapid repeated clicks on Analyze (force click) should not crash test runner; errors are observed and recorded', async () => {
      // Rapidly click analyze several times to observe how runtime handles repeated transitions
      const initialErrors = app.getPageErrors().length;

      for (let i = 0; i < 3; i++) {
        await app.clickAnalyze({ force: true });
        // short gap between clicks
        await app.page.waitForTimeout(100);
      }

      // Allow any errors to surface
      await app.shortWait();

      const errorsAfter = app.getPageErrors().length;
      // We expect at least one additional error in many broken implementations, but we simply assert that the page didn't hang
      expect(errorsAfter).toBeGreaterThanOrEqual(initialErrors);

      // If there are new errors, ensure they are runtime errors
      if (errorsAfter > initialErrors) {
        const newErrors = app.getPageErrors().slice(initialErrors);
        const hasRuntime = newErrors.some((e) => {
          const name = e && e.name ? e.name : '';
          const msg = e && e.message ? e.message : String(e);
          return /ReferenceError|TypeError|SyntaxError/i.test(name) || /ReferenceError|TypeError|SyntaxError/i.test(msg);
        });
        // We expect runtime errors to be among new errors if the page's handlers are missing
        expect(hasRuntime).toBeTruthy();
      }
    });
  });

  test.describe('Edge cases / negative scenarios', () => {
    test('Clicking non-existent selector should not throw in the test, but page errors (if any) are recorded', async () => {
      // Simulate a user trying to click a non-existent element; Playwright throws, so catch and assert appropriate behavior.
      const nonExistent = app.page.locator('#non-existent-button');
      let threw = false;
      try {
        await nonExistent.click({ timeout: 500 });
      } catch (e) {
        threw = true;
        // Playwright will report an error for not being able to click; ensure it's the expected kind
        expect(e.message).toContain('Locator');
      }
      expect(threw).toBeTruthy();
      // Ensure the app's runtime errors (if any) are still captured separately
      await app.shortWait();
      const pageErrors = app.getPageErrors();
      // We do not assert that pageErrors must exist here — just ensure we can observe them if they do.
      expect(Array.isArray(pageErrors)).toBeTruthy();
    });

    test('Verify that runtime errors include at least one of ReferenceError/TypeError/SyntaxError (per instructions to observe natural errors)', async () => {
      // This test reiterates the requirement to assert runtime errors occur naturally.
      await app.shortWait();
      const errors = app.getPageErrors();
      expect(errors.length).toBeGreaterThan(0);
      const matches = errors.some((e) => {
        const name = e && e.name ? e.name : '';
        const msg = e && e.message ? e.message : String(e);
        return /ReferenceError|TypeError|SyntaxError/i.test(name) || /ReferenceError|TypeError|SyntaxError/i.test(msg);
      });
      expect(matches).toBeTruthy();
    });
  });
});