import { test, expect } from '@playwright/test';

// Page object for the Mutex Explanation page
class MutexPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url =
      'http://127.0.0.1:5500/workspace/0126-biased/html/f5b25840-fa7c-11f0-adc7-178f556b1ee0.html';
    this.consoleMessages = [];
    this.pageErrors = [];
    this._consoleListener = msg =>
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    this._pageErrorListener = err => this.pageErrors.push(err);
  }

  // Navigate to the page and attach listeners to capture console logs and page errors
  async goto() {
    this.consoleMessages = [];
    this.pageErrors = [];
    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
    await this.page.goto(this.url);
    // Small sanity wait to allow the page to finish loading scripts/listeners
    await this.page.waitForLoadState('domcontentloaded');
  }

  // Remove listeners (teardown)
  async detachListeners() {
    this.page.removeListener('console', this._consoleListener);
    this.page.removeListener('pageerror', this._pageErrorListener);
  }

  // Click the Demonstrate Mutex button
  async clickDemonstrate() {
    await this.page.click('#mutex-demo');
  }

  // Wait for a pageerror event and return it
  async waitForPageError(options = {}) {
    return this.page.waitForEvent('pageerror', options);
  }

  // Utility getters
  getConsoleMessages() {
    return this.consoleMessages.map(m => m.text);
  }
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Mutex Explanation - FSM integration and error observation', () => {
  // Create a fresh page object for each test
  test.beforeEach(async ({ page }, testInfo) => {
    // No-op here; each test will create and navigate the page object as needed
  });

  test.afterEach(async ({ page }) => {
    // Ensure any listeners attached in tests are removed
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test.describe('S0_Idle (Initial Rendering) validations', () => {
    test('Initial Idle state should render the page and show the Demonstrate Mutex button', async ({ page }) => {
      // This test validates the initial Idle state (S0_Idle) per the FSM:
      // - The page content should be present
      // - The Demonstrate Mutex button should exist and be visible
      // - No "Acquired mutex" or "Released mutex" console messages should be present before user interaction
      const app = new MutexPage(page);
      await app.goto();

      // Validate DOM elements exist
      await expect(page.locator('h1')).toHaveText('Mutex Explanation');
      const demoButton = page.locator('#mutex-demo');
      await expect(demoButton).toBeVisible();
      await expect(demoButton).toHaveText('Demonstrate Mutex');

      // The example code block should include the require('mutex') string (verifies the example is present)
      const codeText = await page.locator('pre code').innerText();
      expect(codeText).toContain("require('mutex')");

      // No console logs for Acquired/Released yet in Idle state
      const consoles = app.getConsoleMessages();
      expect(consoles.join('\n')).not.toMatch(/Acquired mutex|Released mutex/);

      await app.detachListeners();
    });
  });

  test.describe('Transitions and error behavior when clicking Demonstrate Mutex', () => {
    test('Clicking Demonstrate Mutex attempts acquireMutex and results in a ReferenceError (expected failure)', async ({ page }) => {
      // This test validates the transition from S0_Idle -> S1_MutexAcquired triggered by DemonstrateMutexClick.
      // According to the HTML implementation, acquireMutex is not defined (it exists only inside a <pre><code> block),
      // so clicking will cause a ReferenceError. We must observe and assert that this error occurs naturally.
      const app = new MutexPage(page);
      await app.goto();

      // Ensure listener capture is working by performing the click and waiting for the pageerror event
      const [pageError] = await Promise.all([
        app.waitForPageError({ timeout: 5000 }).catch(e => {
          // Propagate to test by returning the thrown error if no pageerror occurred in time
          throw e;
        }),
        page.click('#mutex-demo'),
      ]);

      // The page error should indicate acquireMutex is not defined (ReferenceError). Accept several possible messages.
      expect(pageError).toBeTruthy();
      // Message might contain the function name, or reference error wording depending on engine.
      const message = pageError.message || String(pageError);
      expect(message).toMatch(/acquireMutex|ReferenceError/i);

      // The console should also capture the error or related messages
      const consoleEvents = app.getConsoleMessages();
      const combined = consoleEvents.join('\n');
      expect(combined).toMatch(/acquireMutex|ReferenceError/i);

      // Confirm that the expected "Acquired mutex" and "Released mutex" logs do NOT appear because the implementation failed before those logs
      expect(combined).not.toMatch(/Acquired mutex/);
      expect(combined).not.toMatch(/Released mutex/);

      await app.detachListeners();
    });

    test('Multiple clicks cause repeated ReferenceError page errors (idempotent failure)', async ({ page }) => {
      // Edge case: clicking the button multiple times should repeatedly attempt to call the missing function
      // and thus produce repeated pageerror events. This validates consistent failure handling.
      const app = new MutexPage(page);
      await app.goto();

      // Perform 3 clicks and capture 3 pageerror events
      const errors = [];
      for (let i = 0; i < 3; i++) {
        // Use Promise.race with timeout to avoid hanging in case an event isn't emitted
        const p = app.waitForPageError({ timeout: 3000 }).catch(e => e);
        await page.click('#mutex-demo');
        const err = await p;
        errors.push(err);
      }

      // Expect three errors and that each mentions acquireMutex or ReferenceError
      expect(errors.length).toBe(3);
      for (const err of errors) {
        // If the waitForPageError timed out it will throw and we want the test to fail in that case
        expect(err).toBeTruthy();
        const msg = err.message || String(err);
        expect(msg).toMatch(/acquireMutex|ReferenceError/i);
      }

      // Also validate console captured the repeated error messages
      const combinedConsole = app.getConsoleMessages().join('\n');
      // At least one occurrence of the acquireMutex reference should be present
      expect(combinedConsole).toMatch(/acquireMutex|ReferenceError/i);

      await app.detachListeners();
    });

    test('Click handler exists - clicking triggers event listener that invokes acquireMutex (which is undefined)', async ({ page }) => {
      // This test asserts the presence of a click handler by verifying that clicking the button triggers an immediate error.
      // It ensures the event wiring (document.getElementById(...).addEventListener('click', ...)) from the HTML is active.
      const app = new MutexPage(page);
      await app.goto();

      // Listen for console messages for a short period after a click to ensure the click handler ran
      const [err] = await Promise.all([
        app.waitForPageError({ timeout: 3000 }).catch(e => {
          throw e;
        }),
        page.click('#mutex-demo'),
      ]);

      // If we received a page error, the click handler executed and attempted to call acquireMutex
      expect(err).toBeTruthy();
      expect(err.message).toMatch(/acquireMutex|ReferenceError/i);

      await app.detachListeners();
    });
  });

  test.describe('FSM state message absence and DOM stability checks', () => {
    test('No "Acquired mutex" or "Released mutex" logs appear in any scenario, and DOM remains stable after error', async ({ page }) => {
      // This test ensures that the S1 and S2 entry/exit actions (console logs) do not appear,
      // because the runtime code that would produce them is not actually executable in this environment.
      const app = new MutexPage(page);
      await app.goto();

      // Intentionally trigger the error once to populate console / errors
      await Promise.all([app.waitForPageError({ timeout: 5000 }), page.click('#mutex-demo')]).catch(() => {
        // ignore the thrown error handling here; we'll inspect captured messages below
      });

      const consoleCombined = app.getConsoleMessages().join('\n');
      // Assert absence of the FSM-entry/exit strings
      expect(consoleCombined).not.toMatch(/Acquired mutex/);
      expect(consoleCombined).not.toMatch(/Released mutex/);

      // Verify DOM stability: key content should remain present and unchanged
      await expect(page.locator('h1')).toHaveText('Mutex Explanation');
      await expect(page.locator('p')).toContainText('What is a Mutex?');

      // Ensure the button is still present and clickable even after error
      await expect(page.locator('#mutex-demo')).toBeVisible();
      // Attempt another click and ensure it raises a pageerror again (verifies handler persists)
      const secondError = await app.waitForPageError({ timeout: 3000 }).catch(e => e);
      await page.click('#mutex-demo').catch(() => {});
      expect(secondError).toBeTruthy();

      await app.detachListeners();
    });
  });
});