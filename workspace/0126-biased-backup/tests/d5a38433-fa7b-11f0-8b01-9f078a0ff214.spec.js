import { test, expect } from '@playwright/test';

// Test file for application: d5a38433-fa7b-11f0-8b01-9f078a0ff214
// Served at: http://127.0.0.1:5500/workspace/0126-biased/html/d5a38433-fa7b-11f0-8b-01-9f078a0ff214.html
// Note: This suite verifies the FSM-defined Idle state and the ShowDemonstration transition.
// It also observes console messages and page errors, and deliberately triggers a missing entry action
// (renderPage) to ensure ReferenceError/pageerror events surface naturally (without patching the page).

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a38433-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object Model for the Symmetric Cryptography demo page
class SymmetricCryptoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Selectors used across tests
  async title() {
    return this.page.title();
  }

  headerSelector() {
    return 'h1';
  }

  showDemoButtonSelector() {
    return 'button[onclick]';
  }

  exampleSelector() {
    return '.example';
  }

  // Returns the button element handle
  async getShowDemoButton() {
    return this.page.locator(this.showDemoButtonSelector());
  }

  // Click the "Show Demonstration" button (handles dialog)
  async clickShowDemoAndAccept() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.click(this.showDemoButtonSelector()),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  // Get inner text of the example block
  async getExampleText() {
    return this.page.locator(this.exampleSelector()).innerText();
  }

  // Retrieve the onclick attribute of the show demo button
  async getShowDemoButtonOnclickAttribute() {
    return this.page.getAttribute(this.showDemoButtonSelector(), 'onclick');
  }
}

test.describe('Understanding Symmetric Cryptography - FSM verification', () => {
  // Arrays to collect console and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners for console and page errors for each test separately to avoid cross-test leakage
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', error => {
      // Capture page errors (uncaught exceptions in the page)
      pageErrors.push(error);
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown globally; listeners are scoped to the page and will be removed with the page
  });

  test('Idle state: initial render shows expected static content and button', async ({ page }) => {
    // This test validates the Idle state's entry rendering: page title, headers, content and presence of the button.
    const model = new SymmetricCryptoPage(page);
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Validate document title
    await expect(await model.title()).toContain('Understanding Symmetric Cryptography');

    // Validate header is present and correct
    const header = page.locator(model.headerSelector());
    await expect(header).toHaveCount(1);
    await expect(header).toHaveText('Understanding Symmetric Cryptography');

    // Validate example block content contains expected phrases
    const exampleText = await model.getExampleText();
    await expect(exampleText).toContain('SecretKey');
    await expect(exampleText).toContain('Hello World');

    // Validate the Show Demonstration button exists and has the onclick attribute as described in the FSM
    const button = model.getShowDemoButton();
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('Show Demonstration');

    const onclickAttr = await model.getShowDemoButtonOnclickAttribute();
    await expect(onclickAttr).toContain("Demonstration is not available in this static context");

    // Validate no fatal page errors were emitted during initial load
    expect(pageErrors.length).toBe(0);

    // Validate no console errors during initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: clicking Show Demonstration triggers alert with expected text (single click)', async ({ page }) => {
    // This test validates the ShowDemonstration event/transition: clicking the button shows an alert/dialog.
    const model = new SymmetricCryptoPage(page);
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Click the button and capture the dialog message
    const dialogMessage = await model.clickShowDemoAndAccept();

    // Assert the dialog message matches the FSM's specified alert text
    expect(dialogMessage).toContain('Demonstration is not available in this static context. Please read the content to understand Symmetric Cryptography.');

    // Ensure clicking the button did not produce uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Ensure no console error during the click
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: clicking Show Demonstration multiple times shows alert each time (repeated transition)', async ({ page }) => {
    // This test validates that the transition can be fired repeatedly without changing state (S0_Idle -> S0_Idle)
    const model = new SymmetricCryptoPage(page);
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Click twice, capturing both dialogs
    const messages = [];
    for (let i = 0; i < 2; i++) {
      const msg = await model.clickShowDemoAndAccept();
      messages.push(msg);
    }

    // Both alerts should have the same message
    expect(messages.length).toBe(2);
    for (const m of messages) {
      expect(m).toContain('Demonstration is not available in this static context. Please read the content to understand Symmetric Cryptography.');
    }

    // No page errors expected
    expect(pageErrors.length).toBe(0);
  });

  test('Entry action missing: invoking renderPage() directly causes ReferenceError (sync evaluate rejection)', async ({ page }) => {
    // The FSM lists an entry action renderPage(). The implementation does not define renderPage.
    // This test calls renderPage() synchronously in the page context and asserts a ReferenceError is thrown.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Attempting to call a non-existent function synchronously via evaluate should reject with a ReferenceError
    await expect(page.evaluate('renderPage()')).rejects.toThrow(/renderPage is not defined|ReferenceError/);
  });

  test('Entry action missing: invoking renderPage() asynchronously surfaces a pageerror event (async pageerror)', async ({ page }) => {
    // This test triggers a delayed call to renderPage so the error is thrown asynchronously inside the page,
    // allowing us to observe a pageerror event captured by the page.on('pageerror') listener.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Prepare a promise that resolves when a pageerror is observed
    const pageErrorPromise = new Promise(resolve => {
      const handler = err => {
        // Remove handler after first capture
        page.removeListener('pageerror', handler);
        resolve(err);
      };
      page.on('pageerror', handler);
    });

    // Schedule an asynchronous call to renderPage inside the page (this will throw and emit pageerror)
    await page.evaluate(() => {
      // Using setTimeout to create an asynchronous execution context so the error becomes an uncaught exception
      // inside the page (and will emit a pageerror event). This does not inject or patch anything on the page.
      setTimeout(() => {
        // Intentionally call the (non-existent) function
        try {
          // eslint-disable-next-line no-undef
          renderPage();
        } catch (e) {
          // Re-throw to ensure the exception is uncaught in async context; but because we're inside setTimeout,
          // this catch would swallow the error. We intentionally omit try/catch to let it bubble.
        }
      }, 0);
    });

    // Wait for the pageerror event to be captured (with a reasonable timeout)
    const err = await Promise.race([
      pageErrorPromise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('Timed out waiting for pageerror')), 2000)),
    ]);

    // Assert that the captured error is a ReferenceError mentioning renderPage (or similar)
    expect(String(err)).toMatch(/renderPage|ReferenceError/);
  });

  test('Edge case: clicking a non-existent selector should throw a Playwright error (invalid interaction)', async ({ page }) => {
    // This test validates proper failure behavior when attempting to interact with a non-existent element.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Attempt to click a selector that does not exist and assert that Playwright throws an error
    await expect(page.click('#non-existent-element', { timeout: 500 })).rejects.toThrow();
  });

  test('Edge case: ensure onclick attribute is exactly as specified in FSM (attribute integrity)', async ({ page }) => {
    // Validate the exact onclick attribute string matches the FSM evidence
    const model = new SymmetricCryptoPage(page);
    await page.goto(APP_URL, { waitUntil: 'load' });

    const onclick = await model.getShowDemoButtonOnclickAttribute();

    // The FSM evidence includes the exact onClick string; ensure it contains the key phrase and punctuation
    expect(onclick).toContain("alert('Demonstration is not available in this static context. Please read the content to understand Symmetric Cryptography.');");
  });

  test('Sanity: page contains common section headings describing symmetric cryptography', async ({ page }) => {
    // Additional verification that expected educational content headings exist as described by the FSM
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Check for presence of several key headings
    await expect(page.locator('h2', { hasText: 'What is Symmetric Cryptography?' })).toHaveCount(1);
    await expect(page.locator('h2', { hasText: 'How Does Symmetric Cryptography Work?' })).toHaveCount(1);
    await expect(page.locator('h2', { hasText: 'Key Characteristics' })).toHaveCount(1);
    await expect(page.locator('h2', { hasText: 'Common Symmetric Algorithms' })).toHaveCount(1);
  });
});