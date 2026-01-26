import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a2e7f0-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the Agile demo page
class AgilePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Selector for the demo link/button
  demoButton() {
    return this.page.locator('.demo-button');
  }

  // Click the demo button and wait for the alert dialog
  async clickDemoAndAccept() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.demoButton().click()
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  // Get the onclick attribute value
  async demoButtonOnclickAttr() {
    return await this.demoButton().getAttribute('onclick');
  }

  // Focus and press Enter on the demo button (keyboard interaction)
  async focusAndPressEnter() {
    await this.demoButton().focus();
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.keyboard.press('Enter')
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}

test.describe('Agile Methodology Interactive Application - FSM Validation', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize arrays to capture runtime messages and errors
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Listen to uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // err is an Error object (could be ReferenceError/TypeError/SyntaxError)
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack || ''
      });
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing to teardown explicitly here; listeners are per-page and will be cleaned up by Playwright
  });

  test('State S0_Idle: Page renders static content and demo button is present', async ({ page }) => {
    // Validate entry state UI: header, main content and demo button exist
    const agile = new AgilePage(page);

    // Check main heading exists and has expected text
    const h1 = page.locator('header h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(/Understanding Agile Methodology/i);

    // Ensure article contains "What is Agile Methodology?"
    const sectionHeading = page.locator('article h2').first();
    await expect(sectionHeading).toHaveText(/What is Agile Methodology\?/i);

    // Demo button/link presence and visual attributes
    await expect(agile.demoButton()).toHaveCount(1);
    await expect(agile.demoButton()).toHaveText('Show Simple Demo');

    // Check CSS class exists
    await expect(agile.demoButton()).toHaveClass(/demo-button/);

    // Check the onclick attribute contains the expected alert code (evidence of transition action)
    const onclick = await agile.demoButtonOnclickAttr();
    expect(typeof onclick).toBe('string');
    expect(onclick).toContain("alert('This is a simple demonstration of Agile principles in action!");
  });

  test('Event ShowDemo: clicking the demo button triggers an alert with expected message', async ({ page }) => {
    // This test validates the transition defined in the FSM:
    // From S0_Idle to S0_Idle on ShowDemo -> alert displayed
    const agile = new AgilePage(page);

    // Click and capture dialog
    const dialogMessage = await agile.clickDemoAndAccept();

    // Assert the alert message matches the FSM's message
    expect(dialogMessage).toContain('This is a simple demonstration of Agile principles in action!');
    expect(dialogMessage).toContain('Agile promotes incremental delivery and continuous feedback.');

    // After interaction, verify that no uncaught page errors (ReferenceError/TypeError/SyntaxError) happened
    // The FSM lists entry_actions: ["renderPage()"] but the HTML does not define renderPage;
    // verify that no runtime ReferenceError occurred during page load or interaction in this environment.
    expect(pageErrors.length).toBe(0);

    // Also ensure console error messages are not present
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition is repeatable: multiple clicks produce alerts and do not produce runtime errors', async ({ page }) => {
    // Edge case: user clicks the demo button repeatedly
    const agile = new AgilePage(page);

    // Click multiple times sequentially and accept each dialog
    for (let i = 0; i < 3; i++) {
      const msg = await agile.clickDemoAndAccept();
      expect(msg).toContain('This is a simple demonstration of Agile principles in action!');
    }

    // Ensure no uncaught page errors after repeated interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Keyboard interaction: pressing Enter while focused triggers the same alert', async ({ page }) => {
    // Validate accessibility / alternative input pathway
    const agile = new AgilePage(page);

    const msg = await agile.focusAndPressEnter();
    expect(msg).toContain('This is a simple demonstration of Agile principles in action!');

    // Assert no page errors resulted from keyboard-triggered event
    expect(pageErrors.length).toBe(0);
  });

  test('Href behavior: clicking anchor may update URL hash and should not navigate away', async ({ page }) => {
    // Clicking an anchor with href="#" can affect URL hash; ensure we remain on same origin/page
    const agile = new AgilePage(page);

    // Record URL before click
    const beforeUrl = page.url();

    // Perform click that triggers dialog and potentially hash change
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      agile.demoButton().click()
    ]);
    await dialog.accept();

    const afterUrl = page.url();

    // The URL may add a '#' fragment. Ensure origin/path remain same.
    const normalize = (u) => {
      try {
        const parsed = new URL(u);
        return parsed.origin + parsed.pathname;
      } catch {
        return u;
      }
    };

    expect(normalize(afterUrl)).toBe(normalize(beforeUrl));

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('Verify "renderPage" onEnter action: function not present in global scope (as implemented)', async ({ page }) => {
    // The FSM lists an entry action renderPage(). The HTML implementation does not define renderPage.
    // This test verifies whether renderPage exists; it intentionally does NOT attempt to call or mock it.
    const exists = await page.evaluate(() => {
      // Intentionally check global without defining or calling renderPage.
      return typeof window.renderPage !== 'undefined';
    });

    // Expectation: based on provided HTML, renderPage() is not defined.
    expect(exists).toBe(false);

    // Because we did not call renderPage, there should be no ReferenceError caused by it.
    expect(pageErrors.length).toBe(0);
  });

  test('Inspect console and page errors arrays: assert no unexpected runtime exceptions', async ({ page }) => {
    // This test explicitly reports any console messages or page errors observed during page load.
    // It asserts that there are zero uncaught JS exceptions (ReferenceError/TypeError/SyntaxError) in this implementation.

    // Provide contextual assertions:
    const errorPageErrors = pageErrors.filter(e =>
      /ReferenceError|TypeError|SyntaxError/.test(e.name)
    );

    // If any such errors exist, we will fail the test and include diagnostic info.
    expect(errorPageErrors.length).toBe(0);

    // Also ensure there are no console.error messages
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });
});