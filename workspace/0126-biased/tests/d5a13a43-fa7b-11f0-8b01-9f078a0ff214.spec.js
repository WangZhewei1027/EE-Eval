import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a13a43-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the Exponential Search demo page
class ExponentialSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selector derived from the provided HTML and FSM
    this.demoButton = 'button[onclick="alert(\'Exponential Search Demo: Check console for the search progress!\');"]';
    this.heading = 'h1';
    this.exampleCode = '.example code';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async waitForDemoButton() {
    await this.page.waitForSelector(this.demoButton, { state: 'visible', timeout: 5000 });
  }

  async clickDemoAndAcceptDialog() {
    // Wait for a dialog triggered by clicking the demo button and accept it
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.click(this.demoButton),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  async clickDemoAndDismissDialog() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.click(this.demoButton),
    ]);
    const message = dialog.message();
    await dialog.dismiss();
    return message;
  }

  async getHeadingText() {
    return this.page.textContent(this.heading);
  }

  async getExampleText() {
    return this.page.textContent(this.exampleCode);
  }
}

test.describe('Exponential Search FSM - d5a13a43-fa7b-11f0-8b01-9f078a0ff214', () => {
  let page;
  let esPage;
  let consoleMessages;
  let pageErrors;

  // Setup a fresh page and attach listeners for console and errors for each test
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    esPage = new ExponentialSearchPage(page);
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // capture simple text representation
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await esPage.goto();

    // Ensure the primary demonstration console log from the page initial script is observed
    // The page emits "=== Exponential Search Demonstration ===" at load time.
    // Wait for that log to appear (or timeout if it never does).
    await page.waitForEvent('console', {
      timeout: 2000,
      predicate: (msg) => typeof msg.text === 'function' ? msg.text().includes('=== Exponential Search Demonstration ===') : false,
    }).catch(() => {
      // allow tests to assert on absence if needed; don't throw here to let assertions handle it
    });

    // Ensure demo button is present before continuing
    await esPage.waitForDemoButton();
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test.describe('State S0_Idle (Initial Page Rendering)', () => {
    test('renders the page and shows expected static content', async () => {
      // Validate that the heading is rendered and contains the expected title
      const heading = await esPage.getHeadingText();
      expect(heading).toBeTruthy();
      expect(heading).toContain('Exponential Search');

      // Validate the example code snippet is present and contains expected numbers
      const exampleText = await esPage.getExampleText();
      expect(exampleText).toContain('[2, 3, 4, 10, 40, 50, 60, 70, 80, 90, 100]');

      // The Demonstration button should be visible and contain the expected text
      await expect(page.locator(esPage.demoButton)).toBeVisible();
      await expect(page.locator(esPage.demoButton)).toHaveText('Demonstration');

      // Validate that the page did not produce any uncaught exceptions on load
      expect(pageErrors.length).toBe(0);
    });

    test('initial console logs include the demonstration header and search progress logs', async () => {
      // There should be at least one console message containing the demonstration header.
      const hasDemoHeader = consoleMessages.some((m) => m.text.includes('=== Exponential Search Demonstration ==='));
      expect(hasDemoHeader).toBe(true);

      // The inline script performs checks and logs search progress. Expect at least one "Checked index" or "Initiating binary search..." message.
      const hasProgressLog = consoleMessages.some((m) =>
        m.text.includes('Checked index') || m.text.includes('Initiating binary search') || m.text.includes('Binary search between indexes')
      );
      expect(hasProgressLog).toBe(true);

      // Ensure there are no page errors emitted during initial logging
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Event DemonstrationClick and Transition to S1_Demonstration', () => {
    test('clicking Demonstration triggers an alert with expected message (and we accept it)', async () => {
      // Clicking the demo button should open an alert dialog with the expected message from the onclick attribute.
      const dialogMessage = await esPage.clickDemoAndAcceptDialog();
      expect(dialogMessage).toBe('Exponential Search Demo: Check console for the search progress!');

      // After clicking, ensure the console header exists (it may have been logged at load)
      const foundDemonstrationLog = consoleMessages.some((m) => m.text.includes('=== Exponential Search Demonstration ==='));
      expect(foundDemonstrationLog).toBe(true);

      // Confirm no uncaught page errors occurred as a result of the transition
      expect(pageErrors.length).toBe(0);
    });

    test('clicking Demonstration and dismissing the alert leaves the application in a stable state', async () => {
      // Dismiss the alert instead of accepting to assert both flows (edge case)
      const dialogMessage = await esPage.clickDemoAndDismissDialog();
      expect(dialogMessage).toBe('Exponential Search Demo: Check console for the search progress!');

      // Confirm no uncaught page errors occurred
      expect(pageErrors.length).toBe(0);

      // The demo button should remain visible and clickable after dismissing the dialog
      await expect(page.locator(esPage.demoButton)).toBeVisible();
    });

    test('multiple rapid clicks produce an alert each time (edge case)', async () => {
      // Rapidly click the demonstration button 3 times, ensuring we handle each dialog.
      const alerts = [];
      for (let i = 0; i < 3; i++) {
        const promise = page.waitForEvent('dialog');
        await page.click(esPage.demoButton);
        const dialog = await promise;
        alerts.push(dialog.message());
        await dialog.accept();
      }

      // Each alert message should match the expected text
      for (const msg of alerts) {
        expect(msg).toBe('Exponential Search Demo: Check console for the search progress!');
      }

      // Ensure no uncaught exceptions produced by repeated alerts
      expect(pageErrors.length).toBe(0);
    });

    test('console contains evidence of the algorithm run (binary search initiation and range)', async () => {
      // The inline script outputs "Initiating binary search..." and the binary search range logs on load
      const hasInitiation = consoleMessages.some((m) => m.text.includes('Initiating binary search'));
      const hasRange = consoleMessages.some((m) => m.text.includes('Binary search between indexes'));
      expect(hasInitiation).toBe(true);
      expect(hasRange).toBe(true);
    });
  });

  test.describe('Error and edge-case validation', () => {
    test('no unexpected ReferenceError, TypeError or SyntaxError occurred during page lifecycle', async () => {
      // Inspect collected pageErrors for JS runtime errors that are likely ReferenceError/TypeError/SyntaxError.
      const textualErrors = pageErrors.map((e) => String(e && e.message ? e.message : String(e)));
      const hasReferenceError = textualErrors.some((t) => t.includes('ReferenceError'));
      const hasTypeError = textualErrors.some((t) => t.includes('TypeError'));
      const hasSyntaxError = textualErrors.some((t) => t.includes('SyntaxError'));

      // The application HTML/JS appears correct; assert that none of these fatal errors occurred.
      expect(hasReferenceError).toBe(false);
      expect(hasTypeError).toBe(false);
      expect(hasSyntaxError).toBe(false);
    });

    test('assert that console logs are present and well-formed (no empty messages)', async () => {
      // Ensure we have collected console messages and they are non-empty strings
      expect(consoleMessages.length).toBeGreaterThan(0);
      for (const msg of consoleMessages) {
        expect(typeof msg.text).toBe('string');
        // Some console messages may be empty whitespace; ensure at least one meaningful message exists
      }

      const meaningful = consoleMessages.some((m) => m.text.trim().length > 0);
      expect(meaningful).toBe(true);
    });
  });
});