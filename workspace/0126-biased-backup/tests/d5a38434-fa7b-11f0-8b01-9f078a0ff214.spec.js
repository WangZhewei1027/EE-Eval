import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a38434-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object Model for the Asymmetric Cryptography page
class AsymmetricCryptoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.containerSelector = '.container';
    this.buttonSelector = '.btn';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getButton() {
    return this.page.locator(this.buttonSelector);
  }

  async clickViewExample() {
    const btn = await this.getButton();
    await btn.click();
  }

  async buttonAttribute(attr) {
    const btn = await this.getButton();
    return await btn.getAttribute(attr);
  }

  async buttonText() {
    const btn = await this.getButton();
    return await btn.innerText();
  }

  async isContainerVisible() {
    return await this.page.locator(this.containerSelector).isVisible();
  }
}

test.describe('d5a38434-fa7b-11f0-8b01-9f078a0ff214 - Asymmetric Cryptography Interactive Tests', () => {
  // Arrays to capture console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console 'error' messages emitted by the page
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture unhandled page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });
  });

  test.afterEach(async () => {
    // No global teardown needed; fixtures handle page/browser closing.
    // This hook exists to clearly separate test lifecycle activities.
  });

  test('Idle state: page renders correctly and "View Encryption Example" button is present', async ({ page }) => {
    // Arrange
    const app = new AsymmetricCryptoPage(page);

    // Act
    await app.goto();

    // Assert: container is visible (verifies the entry action renderPage() had the visible effect of rendering content)
    expect(await app.isContainerVisible()).toBeTruthy();

    // The button exists, has correct text, and has the expected onclick attribute
    const btn = await app.getButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('View Encryption Example');

    const onclickAttr = await app.buttonAttribute('onclick');
    // The FSM and HTML evidence indicate an onclick attribute "showDemonstration()"
    expect(typeof onclickAttr).toBe('string');
    expect(onclickAttr).toContain('showDemonstration');

    // Ensure there were no console.error or page-level exceptions during initial load
    // This asserts observed runtime errors (ReferenceError/SyntaxError/TypeError) did NOT occur on load.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: clicking the button triggers Demonstration state and displays alert dialog', async ({ page }) => {
    // This test validates the FSM transition from S0_Idle -> S1_Demonstration by clicking the .btn
    const app = new AsymmetricCryptoPage(page);
    await app.goto();

    // Prepare to capture the alert dialog
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({
        type: dialog.type(),
        message: dialog.message()
      });
      // Dismiss the alert to allow the page to continue (alert has no accept/confirm difference)
      await dialog.dismiss();
    });

    // Act: Click the button which should call showDemonstration() and produce an alert
    await app.clickViewExample();

    // Wait a short moment for the dialog handler to run
    await page.waitForTimeout(100);

    // Assert: exactly one dialog was shown and it is an alert with expected content
    expect(dialogs.length).toBe(1);
    const d = dialogs[0];
    expect(d.type).toBe('alert');
    expect(d.message).toContain('Demonstration: In this simplified example of RSA');
    // Check for presence of expected numeric details that are part of the demonstration message
    expect(d.message).toContain('p=61');
    expect(d.message).toContain('n=3233');
    expect(d.message).toMatch(/C=855/);

    // Ensure no unexpected runtime errors occurred during the interaction
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: multiple rapid clicks produce multiple alert dialogs sequentially', async ({ page }) => {
    // This test verifies robustness when the user clicks the button multiple times quickly.
    const app = new AsymmetricCryptoPage(page);
    await app.goto();

    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({
        type: dialog.type(),
        message: dialog.message()
      });
      // Dismiss each alert so the next can appear
      await dialog.dismiss();
    });

    // Rapidly click the button twice
    const btn = await app.getButton();
    await Promise.all([
      btn.click(), // first click
      btn.click()  // second click; the page will queue the second alert until the first is dismissed
    ]);

    // Wait to ensure both dialog events were processed
    await page.waitForTimeout(300);

    // Assert: two alerts were shown
    expect(dialogs.length).toBe(2);
    for (const dialog of dialogs) {
      expect(dialog.type).toBe('alert');
      expect(dialog.message).toContain('Demonstration: In this simplified example of RSA');
    }

    // Ensure no runtime errors or console errors happened during rapid interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: ensure the showDemonstration function exists on the global scope', async ({ page }) => {
    // Validate that the function referenced by the onclick attribute is actually defined in the page's JS
    const app = new AsymmetricCryptoPage(page);
    await app.goto();

    // Evaluate in page context whether the function exists and is a function
    const exists = await page.evaluate(() => {
      // Do not modify or patch anything; simply check type
      return typeof window.showDemonstration === 'function';
    });

    expect(exists).toBe(true);

    // Also validate that calling it via the DOM click triggers an alert (sanity double-check)
    const dialogMessages = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.dismiss();
    });

    await app.clickViewExample();
    await page.waitForTimeout(100);

    expect(dialogMessages.length).toBe(1);
    expect(dialogMessages[0]).toContain('Demonstration: In this simplified example of RSA');

    // Confirm no runtime errors were raised by the function invocation
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Error observation test: capture any runtime exceptions and assert their absence or presence explicitly', async ({ page }) => {
    // This test is designed to observe console and page errors passively and assert expectations.
    // The testing requirement is to observe and assert runtime exceptions (ReferenceError/SyntaxError/TypeError) if they happen.
    // In this implementation, we expect the page to not throw such exceptions. If they do occur, this test will fail and surface them.

    const app = new AsymmetricCryptoPage(page);
    await app.goto();

    // Perform a normal interaction
    await app.clickViewExample();

    // Wait a bit for any asynchronous errors to appear
    await page.waitForTimeout(200);

    // Build a concise summary of pageErrors for diagnostic messages if assertion fails
    if (pageErrors.length > 0) {
      const names = pageErrors.map(e => e.name).join(', ');
      // Fail with a helpful message that includes observed error types and their messages
      throw new Error(`Observed runtime page errors: ${names}. Details: ${JSON.stringify(pageErrors, null, 2)}`);
    }

    // Also fail if console.error messages were emitted
    if (consoleErrors.length > 0) {
      throw new Error(`Observed console.error messages: ${JSON.stringify(consoleErrors, null, 2)}`);
    }

    // If none observed, assert pass condition explicitly
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});