import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b27f54-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the NoSQL demo page
class NoSQLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages and page errors for assertions
    this._consoleHandler = (msg) => {
      try {
        this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // in rare cases msg.type() might throw in some browsers; fall back
        this.consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    };
    this._pageErrorHandler = (err) => {
      // err is an Error object from the page context
      this.pageErrors.push({ message: err.message, stack: err.stack });
    };
  }

  // Attach listeners to the page
  async attachListeners() {
    this.page.on('console', this._consoleHandler);
    this.page.on('pageerror', this._pageErrorHandler);
  }

  // Detach listeners to avoid leakage between tests
  async detachListeners() {
    this.page.off('console', this._consoleHandler);
    this.page.off('pageerror', this._pageErrorHandler);
  }

  // Navigate to the application page
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Return the demo button element handle (if present)
  async getDemoButtonHandle() {
    return await this.page.$('#demonstration-button');
  }

  // Click the demo button using Playwright click (will throw if not found)
  async clickDemoButton() {
    await this.page.click('#demonstration-button');
  }

  // Return a snapshot of captured console messages' texts
  getConsoleTexts() {
    return this.consoleMessages.map((m) => m.text);
  }

  // Return the captured page errors
  getPageErrors() {
    return this.pageErrors;
  }

  // Try to invoke renderPage() in page context and return observed error information.
  // We intentionally call this in a try/catch inside the browser context so the error is observed
  // and returned rather than causing the test to crash. This validates the FSM's mentioned entry action
  // for the Idle state (renderPage) without injecting or defining anything on the page.
  async tryInvokeRenderPage() {
    return await this.page.evaluate(() => {
      try {
        // Attempt to call the mentioned entry action in FSM.
        // If it doesn't exist this will throw and we capture the thrown error properties.
        renderPage();
        return { invoked: true, error: null };
      } catch (err) {
        return {
          invoked: false,
          error: {
            name: err && err.name ? err.name : 'UnknownError',
            message: err && err.message ? err.message : String(err),
            // include a simple stack if available
            stack: err && err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : undefined,
          },
        };
      }
    });
  }

  // Remove the demonstration button from the DOM (edge-case simulation)
  async removeDemoButtonFromDOM() {
    await this.page.evaluate(() => {
      const btn = document.getElementById('demonstration-button');
      if (btn && btn.parentElement) btn.parentElement.removeChild(btn);
    });
  }
}

test.describe('NoSQL Demo FSM (f5b27f54-fa7c-11f0-adc7-178f556b1ee0)', () => {
  let noSqlPage;
  // Ensure each test gets a fresh page and fresh listeners
  test.beforeEach(async ({ page }) => {
    noSqlPage = new NoSQLPage(page);
    await noSqlPage.attachListeners();
    await noSqlPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Detach listeners to avoid cross-test interference and clear any page-level state we created.
    await noSqlPage.detachListeners();
    // reload the page to reset any DOM modifications that a test might have made
    try {
      await page.goto('about:blank');
    } catch (e) {
      // ignore navigation errors during teardown
    }
  });

  test.describe('State S0_Idle (Initial render)', () => {
    test('Idle state renders the Run the NoSQL Demo button and page static content', async () => {
      // This test verifies the initial Idle state evidence: the button must be present,
      // visible, and have the expected accessible text. Also verifies surrounding content exists.

      const btn = await noSqlPage.getDemoButtonHandle();
      expect(btn, 'The demonstration button should be present in the DOM').not.toBeNull();

      // Verify the button's text content
      const buttonText = await noSqlPage.page.locator('#demonstration-button').innerText();
      expect(buttonText).toContain('Run the NoSQL Demo');

      // Verify other static text content (one sample check)
      const headerText = await noSqlPage.page.locator('h2').first().innerText();
      expect(headerText).toBe('NoSQL');

      // Verify there are no runtime page errors immediately after load
      expect(noSqlPage.getPageErrors().length, 'No unexpected page errors on initial load').toBe(0);
    });

    test('Verify Idle state entry action "renderPage()" is not defined and invoking it reports a ReferenceError', async () => {
      // The FSM lists an entry action renderPage(). The HTML/JS does not define it.
      // We attempt to invoke it inside the page and capture the thrown error information,
      // returning it to the test. This validates the expected missing action scenario (edge case)
      // without altering the page or defining the function.

      const result = await noSqlPage.tryInvokeRenderPage();

      // Since the function is not defined in the provided implementation, we expect invocation to fail.
      expect(result.invoked).toBe(false);
      expect(result.error, 'An error object should be returned when calling non-existent renderPage()').not.toBeNull();
      // Confirm that the error is a ReferenceError or similarly named error indicating missing identifier
      expect(result.error.name).toBe('ReferenceError');
      expect(result.error.message).toMatch(/renderPage is not defined|renderPage is not defined/i);
    });
  });

  test.describe('Event: RunDemo and State S1_DemoRunning (on button click)', () => {
    test('Clicking the demonstration button emits console log "NoSQL Demo started!" and no page errors', async () => {
      // This test confirms the transition from Idle -> DemoRunning:
      // clicking the button should trigger a console.log exactly as the FSM evidence.

      // Sanity: ensure no console logs so far contain the target message
      const before = noSqlPage.getConsoleTexts().filter(t => t.includes('NoSQL Demo started!'));
      expect(before.length).toBe(0);

      // Perform the click that should cause the console.log
      await noSqlPage.clickDemoButton();

      // Allow microtasks in page to flush (console messages are synchronous here but be safe)
      await noSqlPage.page.waitForTimeout(50);

      const consoleTexts = noSqlPage.getConsoleTexts();
      // Find occurrences of the expected log
      const matches = consoleTexts.filter((t) => t.includes('NoSQL Demo started!'));
      expect(matches.length).toBeGreaterThanOrEqual(1);

      // Also assert that no page errors were emitted as a result of this interaction
      expect(noSqlPage.getPageErrors().length, 'No page errors should be emitted when running the demo').toBe(0);
    });

    test('Clicking the demonstration button multiple times produces multiple console log entries (idempotent logging)', async () => {
      // Clicking multiple times should produce repeated console logs; verify counting behavior.

      // Click the button three times
      await noSqlPage.clickDemoButton();
      await noSqlPage.clickDemoButton();
      await noSqlPage.clickDemoButton();

      await noSqlPage.page.waitForTimeout(50);

      const matches = noSqlPage.getConsoleTexts().filter((t) => t.includes('NoSQL Demo started!'));
      // Expect at least three occurrences (one per click)
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Attempting to click after removing the button from the DOM should fail', async () => {
      // Simulate an edge case where the button is removed and then a user/program tries to click it.
      // We remove the element and then assert that a Playwright click will throw because the element is not found.

      // Remove the button from the DOM
      await noSqlPage.removeDemoButtonFromDOM();

      // Confirm the element is no longer present
      const btn = await noSqlPage.getDemoButtonHandle();
      expect(btn).toBeNull();

      // Attempting to click via Playwright should reject; assert that it throws an error.
      let clickThrew = false;
      try {
        await noSqlPage.clickDemoButton();
      } catch (err) {
        clickThrew = true;
        // Validate the thrown error contains helpful message about element not being found
        const msg = String(err.message || err);
        expect(msg).toMatch(/No node found|Element is not attached|cannot find|waiting for selector/i);
      }
      expect(clickThrew, 'Playwright click should throw when the element is missing').toBe(true);
    });

    test('No unexpected runtime exceptions on load or user interactions (pageerror listener remains empty)', async () => {
      // A catch-all to ensure there are no unhandled page errors for normal sequences:
      // load, single click, and multiple clicks.

      // Single click
      await noSqlPage.clickDemoButton();
      // Multiple clicks
      await noSqlPage.clickDemoButton();
      await noSqlPage.clickDemoButton();

      // Small wait to allow any async errors to surface
      await noSqlPage.page.waitForTimeout(100);

      // Assert no page errors captured
      const errors = noSqlPage.getPageErrors();
      expect(errors.length, 'There should be no unhandled page errors after interactions').toBe(0);
    });

    test('Console output types include "log" for the demo message (validate logging type)', async () => {
      // Validate that the demo emits a console.log (type 'log') rather than console.error etc.

      // Clear any prior messages captured
      noSqlPage.consoleMessages = [];

      // Click the button once
      await noSqlPage.clickDemoButton();
      await noSqlPage.page.waitForTimeout(50);

      // Find the first console entry for our message
      const entry = noSqlPage.consoleMessages.find(m => m.text.includes('NoSQL Demo started!'));
      expect(entry, 'A console entry for demo start should be present').toBeDefined();
      expect(entry.type, 'The message should be logged with console.log type').toBe('log');
    });
  });
});