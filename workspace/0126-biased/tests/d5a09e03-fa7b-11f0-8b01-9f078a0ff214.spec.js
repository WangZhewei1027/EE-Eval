import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a09e03-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the Directed Graph demo page
class DirectedGraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showButton = page.locator('button[onclick]');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the Show Demonstration button and wait for the alert/dialog
  // Returns the dialog object so tests can assert its message and accept/dismiss
  async clickShowDemonstration() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.showButton.click(),
    ]);
    return dialog;
  }

  async getShowButtonOnclickAttribute() {
    return await this.showButton.getAttribute('onclick');
  }

  async getHeaderText() {
    return await this.header.textContent();
  }
}

test.describe('Understanding Directed Graphs - FSM validation and UI tests', () => {
  // Each test will set up its own listeners to capture console messages and page errors.
  // We intentionally do NOT modify the page or inject globals — tests will observe natural behavior.

  test('Idle state rendering: page shows expected content and Show Demonstration button exists', async ({ page }) => {
    // Collect console messages and page errors during navigation
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const pg = new DirectedGraphPage(page);
    // Navigate to the page (Idle state should be the initial state)
    await pg.goto();

    // Validate main content is present (verifies the page is rendered)
    const headerText = await pg.getHeaderText();
    // Comment: Ensure the primary title is correct as part of Idle state's render
    expect(headerText).toContain('Understanding Directed Graphs');

    // Validate the Show Demonstration button exists and has an onclick attribute invoking alert
    const onclickAttr = await pg.getShowButtonOnclickAttribute();
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("Demonstration of a Directed Graph");

    // Validate there are no unexpected page errors on initial render
    expect(pageErrors.length).toBe(0);

    // Validate there are no console errors emitted during load
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: clicking Show Demonstration triggers alert (Demonstration Shown state entry action)', async ({ page }) => {
    // Capture console messages and page errors to assert no hidden failures
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const pg = new DirectedGraphPage(page);
    await pg.goto();

    // Click the button and verify a dialog (alert) is shown with the exact expected text
    const dialog = await pg.clickShowDemonstration();
    const expectedMessage = "Demonstration of a Directed Graph can be visualized by using graphical tools available online.";
    // Comment: The FSM expects an alert on entering S1_DemonstrationShown; assert the alert message.
    expect(dialog.message()).toBe(expectedMessage);

    // Accept the alert to continue
    await dialog.accept();

    // After handling the alert, ensure no unexpected page errors were recorded
    expect(pageErrors.length).toBe(0);

    // Ensure no console error messages were emitted as part of this interaction
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Verify onEnter action "renderPage()" is not implemented: invoking it throws ReferenceError', async ({ page }) => {
    // We will intentionally attempt to call the renderPage() function in the page context.
    // The FSM lists renderPage() as an entry action for the Idle state, but the HTML/JS does not
    // define it. This test confirms that calling it results in a ReferenceError in the page.
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const pg = new DirectedGraphPage(page);
    await pg.goto();

    // Attempt to call renderPage() inside the page; this should naturally throw a ReferenceError.
    let caughtError = null;
    try {
      // The function is expected not to exist; calling it should throw in page context.
      await page.evaluate(() => {
        // Intentionally call the missing function. We do NOT define it — we want the natural error.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (e) {
      caughtError = e;
    }

    // Assert that an error was indeed thrown
    expect(caughtError).toBeTruthy();

    // The error message should indicate that renderPage is not defined or be a ReferenceError.
    // We accept several possible message forms across environments.
    const errorText = String(caughtError);
    expect(/renderPage|not defined|ReferenceError/i.test(errorText)).toBe(true);

    // Additionally, the page may have emitted a pageerror event for the ReferenceError.
    // Assert that at least one pageerror mentions renderPage (if such an event was fired).
    const hasRenderPagePageError = pageErrors.some((err) => {
      const msg = String(err && (err.message || err));
      return /renderPage|not defined|ReferenceError/i.test(msg);
    });
    // It's valid if a pageerror was emitted; if not, we still succeed because we observed the thrown error.
    // We assert that either the thrown error contains renderPage or a pageerror was recorded.
    expect(
      hasRenderPagePageError || /renderPage|not defined|ReferenceError/i.test(errorText)
    ).toBe(true);
  });

  test('Edge case: clicking a non-existent selector throws (error scenario)', async ({ page }) => {
    // This test verifies behavior when interacting with selectors that do not exist on the page.
    const pg = new DirectedGraphPage(page);
    await pg.goto();

    // Attempt to click a non-existent element and assert that Playwright throws an error.
    // We use a short timeout to fail fast.
    await expect(page.click('#non-existent-button', { timeout: 1000 })).rejects.toThrow();
  });

  test('Observability: console and pageerror streams capture runtime issues during interactions', async ({ page }) => {
    // This test validates that tests can observe console and page errors as they happen.
    // It does not assume errors will happen; it simply demonstrates observability for edge cases.

    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const pg = new DirectedGraphPage(page);
    await pg.goto();

    // Perform a normal interaction (click the button) which should raise a dialog but not a pageerror
    const dialog = await pg.clickShowDemonstration();
    await dialog.accept();

    // After the interaction, assert that observability streams are available and contain data (at least console info)
    expect(Array.isArray(consoleMessages)).toBe(true);
    // We do not assert a specific count; we assert we can inspect them.
    // Also ensure that there are no runtime pageerrors from this normal flow.
    const runtimeErrors = pageErrors.filter((e) => !!e);
    expect(runtimeErrors.length).toBe(0);
  });
});