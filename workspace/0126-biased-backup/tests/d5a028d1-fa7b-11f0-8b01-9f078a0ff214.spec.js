import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a028d1-fa7b-11f0-8b01-9f078a0ff214.html';

/**
 * Page Object for the Hash Table Demo page.
 * Encapsulates common interactions and assertions.
 */
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = 'button[onclick="showHashingDemo()"]';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButton() {
    return this.page.locator(this.buttonSelector);
  }

  async clickDemoButton() {
    const btn = await this.getButton();
    await btn.click();
  }

  async waitForAlertAndAccept() {
    const dialog = await this.page.waitForEvent('dialog', { timeout: 3000 });
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  async buttonText() {
    return this.page.locator(this.buttonSelector).innerText();
  }

  async buttonAttribute(attr) {
    return this.page.locator(this.buttonSelector).getAttribute(attr);
  }

  async isButtonVisible() {
    return this.page.locator(this.buttonSelector).isVisible();
  }

  async hasGlobalFunction(fnName) {
    return this.page.evaluate((name) => typeof window[name], fnName);
  }
}

test.describe('Understanding Hash Tables - FSM and UI Integration Tests', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err can be Error object
      pageErrors.push(err && err.message ? err.message : String(err));
    });
  });

  test.afterEach(async () => {
    // No automatic assertions here; individual tests will assert collected data as needed.
  });

  test.describe('State S0_Idle (Initial state) validations', () => {
    test('renders the page and exposes Idle state UI (button present) and no fatal JS errors on load', async ({ page }) => {
      // This test validates the Idle (S0_Idle) state:
      // - Page loads successfully
      // - Main heading present
      // - "View Demonstration" button exists with expected onclick attribute
      // - The FSM entry action renderPage() is not injected in the HTML; confirm it is undefined
      // - No uncaught ReferenceError/TypeError/SyntaxError occurred during load

      const obj = new HashTablePage(page);
      await obj.goto();

      // Check main heading exists
      await expect(page.locator('h1')).toHaveText('Understanding Hash Tables');

      // Button must exist and be visible
      const btn = await obj.getButton();
      await expect(btn).toBeVisible();

      // Validate button text and onclick attribute exactly match the FSM evidence
      await expect(btn).toHaveText('View Demonstration');
      const onclickAttr = await obj.buttonAttribute('onclick');
      expect(onclickAttr).toBe('showHashingDemo()');

      // The FSM lists an entry action renderPage() for S0_Idle.
      // The HTML does not define renderPage; assert that window.renderPage is undefined.
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      // Ensure no uncaught page errors of typical JS runtime error types happened on load
      const problematicErrors = pageErrors.filter(msg =>
        /ReferenceError|TypeError|SyntaxError/.test(msg)
      );
      expect(problematicErrors.length).toBe(0);

      // Also assert no console.error messages were emitted during load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition: View Demonstration (S0_Idle -> S1_Demonstration)', () => {
    test('clicking the View Demonstration button invokes showHashingDemo and displays an alert', async ({ page }) => {
      // This test validates the transition from Idle to Demonstration:
      // - The showHashingDemo function exists on the window
      // - Clicking the button triggers an alert with the expected message (FSM observable)
      // - After dismissing the alert the page remains stable and the button is still present
      // - No uncaught ReferenceError/TypeError/SyntaxError occurred during the interaction

      const obj = new HashTablePage(page);
      await obj.goto();

      // Confirm the function exists on the window before interaction
      const fnType = await obj.hasGlobalFunction('showHashingDemo');
      expect(fnType).toBe('function');

      // Click and wait for alert dialog triggered by showHashingDemo()
      const clickPromise = obj.clickDemoButton();
      const dialogPromise = page.waitForEvent('dialog', { timeout: 3000 });

      await clickPromise;
      const dialog = await dialogPromise;
      try {
        // Validate the alert message content
        const expectedMessage = 'This is a simple demonstration of how a hash function maps keys to hash codes!';
        expect(dialog.message()).toBe(expectedMessage);
      } finally {
        await dialog.accept();
      }

      // After closing alert, the button should remain visible and enabled
      await expect(page.locator(obj.buttonSelector)).toBeVisible();

      // Ensure no uncaught runtime errors of major types happened during the click
      const problematicErrors = pageErrors.filter(msg =>
        /ReferenceError|TypeError|SyntaxError/.test(msg)
      );
      expect(problematicErrors.length).toBe(0);

      // Also assert no console.error messages emitted during the interaction
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('multiple rapid clicks produce multiple alerts sequentially (edge case)', async ({ page }) => {
      // This test validates behavior when the user clicks the demo button repeatedly and rapidly.
      // Expected: each click triggers an alert; alerts must be handled sequentially.
      // We will perform two rapid clicks and assert we receive two dialogs with correct messages.

      const obj = new HashTablePage(page);
      await obj.goto();

      // We'll perform two clicks and handle two dialogs sequentially.
      const messages = [];
      for (let i = 0; i < 2; i++) {
        // Initiate the click and wait for dialog
        const clickPromise = obj.clickDemoButton();
        const dialog = await page.waitForEvent('dialog', { timeout: 3000 });
        await clickPromise; // ensure click finished
        messages.push(dialog.message());
        await dialog.accept();
      }

      // Validate both messages are exactly as expected
      const expectedMessage = 'This is a simple demonstration of how a hash function maps keys to hash codes!';
      expect(messages.length).toBe(2);
      for (const msg of messages) {
        expect(msg).toBe(expectedMessage);
      }

      // Ensure no uncaught runtime errors occurred during rapid interactions
      const problematicErrors = pageErrors.filter(msg =>
        /ReferenceError|TypeError|SyntaxError/.test(msg)
      );
      expect(problematicErrors.length).toBe(0);
    });
  });

  test.describe('Error scenarios and edge checks', () => {
    test('clicking a non-existent selector throws a Playwright error (edge case for missing elements)', async ({ page }) => {
      // This test intentionally attempts to click a non-existent selector to exercise error handling.
      // We assert that Playwright throws an error when trying to click something that does not exist.

      const obj = new HashTablePage(page);
      await obj.goto();

      const missingSelector = 'button[onclick="nonExistentFunction()"]';

      // Ensure the selector is indeed absent
      const count = await page.locator(missingSelector).count();
      expect(count).toBe(0);

      // Attempting to click should result in a rejection from Playwright; assert it throws.
      await expect(page.click(missingSelector)).rejects.toThrow();
    });

    test('no unexpected console or page errors captured throughout full scenario', async ({ page }) => {
      // This test performs a full happy-path interaction (load + single demo click)
      // and then asserts that there are no console.error messages or uncaught page errors.
      const obj = new HashTablePage(page);
      await obj.goto();

      // perform the main interaction
      await obj.clickDemoButton();
      const dialog = await page.waitForEvent('dialog', { timeout: 3000 });
      await dialog.accept();

      // Now assert no severe runtime errors were captured
      // (This also follows the developer instructions to observe errors and let them happen naturally.)
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      const pageErrorSevere = pageErrors.filter(msg =>
        /ReferenceError|TypeError|SyntaxError/.test(msg)
      );

      // Assert none occurred
      expect(consoleErrors.length).toBe(0);
      expect(pageErrorSevere.length).toBe(0);

      // For completeness, also assert no other page errors were recorded
      expect(pageErrors.length).toBe(0);
    });
  });
});