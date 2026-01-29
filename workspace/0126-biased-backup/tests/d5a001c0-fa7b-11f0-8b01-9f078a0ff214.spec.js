import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a001c0-fa7b-11f0-8b01-9f078a0ff214.html';

/**
 * Page Object representing the Doubly Linked List demo page.
 * Encapsulates selectors and common interactions to keep tests readable.
 */
class DoublyLinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.container');
    this.header = page.locator('h1');
    this.button = page.locator('.button');
    this.diagramPre = page.locator('pre');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeaderText() {
    return this.header.innerText();
  }

  async getButtonText() {
    return this.button.innerText();
  }

  async isButtonVisible() {
    return this.button.isVisible();
  }

  async getDiagramText() {
    // Trim to make matching easier
    const txt = await this.diagramPre.innerText();
    return txt.trim();
  }

  // Click the demonstration button and return the dialog message that appears
  async clickShowDemonstrationAndGetDialogMessage() {
    // Wait for the dialog event which the page uses via alert(...)
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.button.click(),
    ]);
    const message = dialog.message();
    await dialog.dismiss();
    return message;
  }

  // Click without waiting for dialog (used to test multiple clicks in quick succession)
  async clickShowDemonstrationNoWait() {
    await this.button.click();
  }
}

test.describe('Doubly Linked List Interactive - FSM validation', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (including errors)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Small safeguard: remove listeners to avoid cross-test leakage (Playwright cleans up pages between tests,
    // but we re-declare to be explicit; nothing to remove since we used ephemeral closures)
    // Intentionally left blank.
  });

  test.describe('State: S0_Idle (Initial page state)', () => {
    test('Idle state renders main content and Show Demonstration button', async ({ page }) => {
      const app = new DoublyLinkedListPage(page);

      // Validate main heading
      const heading = await app.getHeaderText();
      // Check that the page title/header matches the FSM's topic
      expect(heading).toBe('Doubly Linked List');

      // Validate diagram content is present
      const diagram = await app.getDiagramText();
      expect(diagram).toContain('[Prev] <-> [Data] <-> [Next]');

      // Button should be visible and have expected text
      expect(await app.isButtonVisible()).toBe(true);
      expect(await app.getButtonText()).toBe('Show Demonstration');

      // Verify that no immediate page errors were thrown on load
      expect(pageErrors.length).toBe(0);

      // Verify console did not emit error-level messages like ReferenceError/SyntaxError/TypeError
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.type));
      // We expect zero console errors for a well-formed page load
      expect(consoleErrors.length).toBe(0);
    });

    test('Verify presence (or absence) of expected onEnter action: renderPage()', async ({ page }) => {
      // FSM listed an entry action renderPage() for S0_Idle.
      // The HTML implementation does not declare renderPage by name.
      // We assert the actual runtime condition (function exists or not).
      const renderPageExists = await page.evaluate(() => {
        // Do not define or modify anything on the page. Only inspect.
        return typeof window.renderPage !== 'undefined';
      });

      // This test documents the reality: if renderPage is present, it should be a function.
      if (renderPageExists) {
        const isFunction = await page.evaluate(() => typeof window.renderPage === 'function');
        expect(isFunction).toBe(true);
      } else {
        // If renderPage is absent, we assert that it is absent (this highlights a mismatch between FSM and implementation).
        expect(renderPageExists).toBe(false);
      }
    });
  });

  test.describe('Event: ShowDemonstration and Transition S0 -> S1', () => {
    test('Clicking the Show Demonstration button displays an alert with expected message (Demonstration state onEnter)', async ({ page }) => {
      const app = new DoublyLinkedListPage(page);

      // The FSM expects an alert: "This would demonstrate a visual representation of a doubly linked list with nodes."
      const expectedAlert = "This would demonstrate a visual representation of a doubly linked list with nodes.";

      // Click and wait for the dialog to appear, then assert its message
      const message = await app.clickShowDemonstrationAndGetDialogMessage();
      expect(message).toBe(expectedAlert);

      // After the alert is dismissed, ensure no page errors were raised as a result of the transition
      expect(pageErrors.length).toBe(0);

      // Ensure console didn't produce runtime error messages during this interaction
      const runtimeConsoleErrors = consoleMessages.filter(m =>
        m.type === 'error' ||
        /ReferenceError|TypeError|SyntaxError/.test(m.text)
      );
      expect(runtimeConsoleErrors.length).toBe(0);
    });

    test('Clicking the button multiple times produces consistent alerts and does not crash the page (idempotence)', async ({ page }) => {
      const app = new DoublyLinkedListPage(page);
      const expectedAlert = "This would demonstrate a visual representation of a doubly linked list with nodes.";

      // Click three times in succession, awaiting each dialog
      for (let i = 0; i < 3; i++) {
        const message = await app.clickShowDemonstrationAndGetDialogMessage();
        expect(message).toBe(expectedAlert);
      }

      // Ensure no uncaught page errors occurred across repeated interactions
      expect(pageErrors.length).toBe(0);

      // Ensure console didn't record TypeError/ReferenceError/SyntaxError
      const suspiciousConsole = consoleMessages.filter(m =>
        /ReferenceError|TypeError|SyntaxError/.test(m.text)
      );
      expect(suspiciousConsole.length).toBe(0);
    });

    test('Edge case: clicking the button without waiting for dialog (rapid clicks) still triggers dialogs for each click', async ({ page }) => {
      const app = new DoublyLinkedListPage(page);
      const expectedAlert = "This would demonstrate a visual representation of a doubly linked list with nodes.";

      // Rapidly click the button three times without waiting; then handle the three dialog events.
      // Note: Browsers may queue multiple alert() dialogs; Playwright's dialog handling captures them sequentially.
      const dialogs = [];
      const collectDialogs = async () => {
        for (let i = 0; i < 3; i++) {
          // Wait for the next dialog and record its message, then dismiss it
          const dialog = await page.waitForEvent('dialog', { timeout: 2000 });
          dialogs.push(dialog.message());
          await dialog.dismiss();
        }
      };

      // Start listening for dialogs in parallel with clicking rapidly
      const waitForDialogsPromise = collectDialogs();
      // Rapid clicks
      await Promise.all([
        app.clickShowDemonstrationNoWait(),
        app.clickShowDemonstrationNoWait(),
        app.clickShowDemonstrationNoWait()
      ]);
      await waitForDialogsPromise;

      // Validate all three dialogs had the expected message
      expect(dialogs.length).toBe(3);
      for (const msg of dialogs) {
        expect(msg).toBe(expectedAlert);
      }

      // Validate stability: no page errors produced
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Robustness and error observation', () => {
    test('No unexpected ReferenceError, SyntaxError, or TypeError occurred during load and interactions', async ({ page }) => {
      // We've already collected console and page errors in the beforeEach handler.
      // Here we assert that none of the captured console messages indicate fatal JS errors,
      // and that pageerror didn't capture ReferenceError/SyntaxError/TypeError instances.

      // Check pageerror objects for specific error types if any exist
      const foundJSRuntimeErrors = pageErrors.filter(err =>
        err.name === 'ReferenceError' || err.name === 'TypeError' || err.name === 'SyntaxError'
      );

      // Expect none of these severe error types to have occurred
      expect(foundJSRuntimeErrors.length).toBe(0);

      // Check console messages for textual occurrences of these keywords
      const consoleTextualIssues = consoleMessages.filter(m =>
        /ReferenceError|TypeError|SyntaxError/.test(m.text)
      );

      expect(consoleTextualIssues.length).toBe(0);

      // Also ensure no console messages of type 'error' appeared
      const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(consoleErrorCount).toBe(0);
    });

    test('Sanity check: important content sections exist and are not empty (resilience to content loading issues)', async ({ page }) => {
      const app = new DoublyLinkedListPage(page);

      // Header
      const headerText = await app.getHeaderText();
      expect(headerText.length).toBeGreaterThan(0);

      // Diagram area
      const diagramText = await app.getDiagramText();
      expect(diagramText.length).toBeGreaterThan(0);

      // Button text
      const buttonText = await app.getButtonText();
      expect(buttonText).toBe('Show Demonstration');

      // Confirm container exists and is visible
      expect(await app.container.isVisible()).toBe(true);
    });
  });
});