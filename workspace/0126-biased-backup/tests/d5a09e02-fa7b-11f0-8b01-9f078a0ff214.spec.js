import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a09e02-fa7b-11f0-8b-01-9f078a0ff214.html';

// Page Object for the Suffix Tree demo page
class SuffixTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButtonSelector = '.demo-button';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  demoButton() {
    return this.page.locator(this.demoButtonSelector);
  }

  async clickDemoButton() {
    await this.page.click(this.demoButtonSelector);
  }

  async focusDemoButton() {
    await this.page.focus(this.demoButtonSelector);
  }

  async demoButtonText() {
    return this.page.textContent(this.demoButtonSelector);
  }

  async demoButtonOnClickAttr() {
    return this.page.getAttribute(this.demoButtonSelector, 'onclick');
  }

  async existsDemoButton() {
    return await this.demoButton().count() > 0;
  }
}

test.describe('Suffix Tree Interactive Application (FSM validation)', () => {
  // Shared state for capturing runtime observations
  let consoleMessages;
  let consoleErrors;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors for each test to get clean state
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Collect console messages and errors
    page.on('console', msg => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') consoleErrors.push(entry);
    });

    // Collect unhandled page errors (runtime exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Auto-accept dialogs and record their messages so tests can assert on them.
    page.on('dialog', async dialog => {
      try {
        dialogs.push({ message: dialog.message(), type: dialog.type() });
      } finally {
        // Accept the dialog so it doesn't block execution
        await dialog.accept();
      }
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: remove listeners by creating a new page in Playwright test harness is automatic between tests,
    // but ensure we are not leaving dialogs open. Nothing to explicitly teardown here.
    // We still assert no unexpected persistent errors occurred (see individual tests).
    // Close page-level resources if desired (Playwright test runner will handle this).
  });

  test.describe('Idle State (S0_Idle) - Initial render and component existence', () => {
    test('renders page content and shows the demonstration button (Idle state entry)', async ({ page }) => {
      // Arrange
      const app = new SuffixTreePage(page);

      // Assert - page loaded and heading present (basic render verification)
      const title = await page.textContent('h1');
      expect(title).toContain('Suffix Trees');

      // The FSM S0_Idle entry action mentions renderPage(); we validate that the page content exists
      // and the expected demonstration button is present in the DOM.
      const buttonExists = await app.existsDemoButton();
      expect(buttonExists).toBe(true);

      // Verify button text and onclick attribute evidence as per FSM/component extraction
      const buttonText = (await app.demoButtonText())?.trim();
      expect(buttonText).toBe('Show Demonstration');

      const onclickAttr = await app.demoButtonOnClickAttr();
      expect(onclickAttr).toBe("alert('This is where a demonstration of a suffix tree would occur.');");

      // Ensure no page errors were emitted on initial load
      expect(pageErrors.length).toBe(0);
      // Ensure no console errors were emitted on initial load
      expect(consoleErrors.length).toBe(0);
    });

    test('has accessible demo button and is focusable via keyboard (Idle state accessibility)', async ({ page }) => {
      const app = new SuffixTreePage(page);

      // Focus the button and ensure it receives focus
      await app.focusDemoButton();
      // Evaluate that the active element is our button (no injection, just reading DOM)
      const activeTag = await page.evaluate(() => document.activeElement?.className || '');
      expect(activeTag).toContain('demo-button');

      // Still no runtime errors after focusing
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ShowDemonstration (S0_Idle -> S1_DemonstrationShown)', () => {
    test('clicking the demo button triggers the expected alert (S1 entry action)', async ({ page }) => {
      // This test validates the FSM transition: clicking the button (ShowDemonstration event)
      // should execute the S1_DemonstrationShown entry action which is an alert with a specific message.
      const app = new SuffixTreePage(page);

      // Pre-assert: no dialogs have been observed yet
      expect(dialogs.length).toBe(0);

      // Act: click the demo button
      await app.clickDemoButton();

      // The page.on('dialog') handler accepted the dialog and recorded the message into dialogs.
      // Validate that exactly one dialog was shown and that its message matches the FSM entry action.
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogs[dialogs.length - 1];
      expect(lastDialog.type).toBe('alert');
      expect(lastDialog.message).toBe("This is where a demonstration of a suffix tree would occur.");

      // After the transition, the demo button should still exist (no exit action removed it)
      const stillExists = await app.existsDemoButton();
      expect(stillExists).toBe(true);

      // Ensure no unexpected page errors were emitted during the transition
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('activating the demo button via keyboard (Enter) also triggers the alert (event robustness)', async ({ page }) => {
      // Validate that the event handler is triggered by keyboard activation as well as mouse click.
      const app = new SuffixTreePage(page);

      // Focus and press Enter
      await app.focusDemoButton();
      await page.keyboard.press('Enter');

      // One more dialog should have been recorded
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogs[dialogs.length - 1];
      expect(lastDialog.type).toBe('alert');
      expect(lastDialog.message).toBe("This is where a demonstration of a suffix tree would occur.");

      // No runtime exceptions occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('multiple rapid clicks produce multiple alerts (robustness to repeated transitions)', async ({ page }) => {
      // Validate repeated transition triggers and that each alert is produced.
      const app = new SuffixTreePage(page);

      // Clear any dialogs captured so far for a clean count in this test
      dialogs = [];

      // Perform multiple quick clicks
      const clickCount = 3;
      for (let i = 0; i < clickCount; i++) {
        await app.clickDemoButton();
      }

      // The dialog handler accepted each alert and recorded them
      expect(dialogs.length).toBe(clickCount);
      for (const d of dialogs) {
        expect(d.type).toBe('alert');
        expect(d.message).toBe("This is where a demonstration of a suffix tree would occur.");
      }

      // Button remains present after repeated transitions
      expect(await app.existsDemoButton()).toBe(true);

      // Runtime should still be error-free
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios (observational, non-invasive)', () => {
    test('non-existent selector is not present (edge case validation)', async ({ page }) => {
      // Validate that clicking a selector that does not exist would not silently succeed.
      // We will assert the non-existence (without attempting to cause an exception by clicking).
      const missingLocator = page.locator('.this-selector-does-not-exist-hopefully');
      const count = await missingLocator.count();
      expect(count).toBe(0);

      // No runtime errors introduced by checking for non-existent elements
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('page console and runtime error observation (must capture any exceptions)', async ({ page }) => {
      // This test is dedicated to ensuring we observed console messages and page errors during interactions.
      // We assert that our collectors are working; it's acceptable for there to be zero errors.
      // The testing harness requires that we observe and report these — not to inject faults.
      // Confirm that consoleMessages is an array and pageErrors is an array.
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // If there were any console errors or page errors, fail the test to indicate a problem in runtime.
      // This ensures we detect ReferenceError/SyntaxError/TypeError if they naturally occur.
      if (consoleErrors.length > 0 || pageErrors.length > 0) {
        // Provide detailed failure context
        const consoleErrorTexts = consoleErrors.map(e => e.text).join(' | ');
        const pageErrorTexts = pageErrors.map(e => (e && e.message) || String(e)).join(' | ');
        throw new Error(`Observed runtime issues. consoleErrors: [${consoleErrorTexts}] pageErrors: [${pageErrorTexts}]`);
      }

      // If no errors, explicitly assert zero observed errors to make the expectation clear.
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('FSM evidence and DOM verification', () => {
    test('component evidence (onclick attribute and inner text) matches FSM extraction', async ({ page }) => {
      const app = new SuffixTreePage(page);

      // Validate the evidence snippets extracted in the FSM: the button markup and attributes.
      const onclickAttr = await app.demoButtonOnClickAttr();
      expect(onclickAttr).toBe("alert('This is where a demonstration of a suffix tree would occur.');");

      const buttonText = (await app.demoButtonText())?.trim();
      expect(buttonText).toBe('Show Demonstration');

      // The body should include descriptive headings and example sections per the HTML content
      const hasExampleHeading = (await page.locator('h3', { hasText: 'Example: Searching for Substring' }).count()) > 0;
      expect(hasExampleHeading).toBe(true);

      // No runtime errors introduced by examining elements
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});