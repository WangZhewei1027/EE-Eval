import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed9061c4-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page object for the Elegant Encryption Visuals app.
 * Encapsulates common selectors and interactions used by the tests.
 */
class EncryptionAppPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      container: '.container',
      title: 'h1',
      paragraph: 'p',
      button: '.button',
      graphic: '.graphic'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for main container to be present and visible
    await this.page.waitForSelector(this.selectors.container, { state: 'visible', timeout: 5000 });
  }

  async clickLearnMore() {
    await this.page.click(this.selectors.button);
  }

  async getButtonText() {
    return this.page.locator(this.selectors.button).innerText();
  }

  async getTitleText() {
    return this.page.locator(this.selectors.title).innerText();
  }

  async getGraphicAttributes() {
    const img = this.page.locator(this.selectors.graphic);
    return {
      src: await img.getAttribute('src'),
      alt: await img.getAttribute('alt')
    };
  }

  async isButtonVisible() {
    return this.page.locator(this.selectors.button).isVisible();
  }
}

test.describe('Elegant Encryption Visuals - FSM and UI validation', () => {
  let pageErrors;
  let consoleMessages;

  // Attach observers for each test to capture console and page errors.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Collect page-level uncaught exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Collect console messages for inspection (log, error, warn, info)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity teardown: ensure page is closed/idle - Playwright handles it,
    // but keep this hook for explicitness and future expansion.
    try {
      await page.close();
    } catch (e) {
      // ignore errors closing page in runner environments
    }
  });

  test('S0_Idle: Initial render shows expected UI elements (button & graphic)', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) per FSM:
    // - The page renders title, paragraph, graphic and the "Learn More" button.
    const app = new EncryptionAppPage(page);
    await app.goto();

    // Validate title and button presence and content
    const title = await app.getTitleText();
    expect(title).toBeTruthy();
    expect(title).toContain('Encryption');

    const buttonVisible = await app.isButtonVisible();
    expect(buttonVisible).toBe(true);

    const buttonText = await app.getButtonText();
    expect(buttonText).toBe('Learn More');

    // Validate graphic element is present and has expected attributes
    const graphicAttrs = await app.getGraphicAttributes();
    expect(graphicAttrs.src).toContain('https://via.placeholder.com/300/00ffff/ffffff?text=Encrypted');
    expect(graphicAttrs.alt).toBe('Encryption Graphic');

    // Confirm that loading the page produced no uncaught page errors by default
    expect(pageErrors.length).toBe(0);

    // There should be no console error messages upon initial render
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_AlertShown: Clicking "Learn More" displays an alert with the correct message', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_AlertShown triggered by LearnMoreClick
    // It asserts that the alert dialog appears and its message matches FSM evidence.

    const app = new EncryptionAppPage(page);
    await app.goto();

    const dialogMessages = [];
    page.on('dialog', async dialog => {
      // Capture dialog text and accept it so execution continues
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Click the button which uses onclick="showAlert()" to call alert(...)
    await app.clickLearnMore();

    // Give a short time for the dialog event to be handled
    await page.waitForTimeout(100);

    // We expect exactly one alert to have appeared with the exact message
    expect(dialogMessages.length).toBe(1);
    expect(dialogMessages[0]).toBe('Embracing the art of encryption!');

    // Ensure no unexpected page errors occurred as result of clicking
    expect(pageErrors.length).toBe(0);
  });

  test('Transition robustness: rapid consecutive clicks produce corresponding alerts', async ({ page }) => {
    // Edge-case: ensure multiple rapid user interactions each trigger alerts
    // This test clicks the button multiple times while programmatically accepting each alert.

    const app = new EncryptionAppPage(page);
    await app.goto();

    const dialogMessages = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      // Accept immediately to allow further interactions
      await dialog.accept();
    });

    // Rapidly trigger the button multiple times
    const clicks = 3;
    for (let i = 0; i < clicks; i++) {
      await app.clickLearnMore();
      // small delay to allow internal processing and dialog emission/acceptance
      await page.waitForTimeout(50);
    }

    // Give a moment to ensure all dialogs were processed
    await page.waitForTimeout(100);

    // Verify all clicks produced an alert with expected message
    expect(dialogMessages.length).toBe(clicks);
    dialogMessages.forEach(msg => expect(msg).toBe('Embracing the art of encryption!'));

    // Confirm no fatal page errors occurred during this rapid interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invoking undefined renderPage() as an identifier triggers a ReferenceError on the page', async ({ page }) => {
    // The FSM mentions renderPage() in entry_actions, but the HTML does not define it.
    // This test intentionally invokes renderPage() as an unbound identifier to let a ReferenceError occur
    // and then asserts that the browser emitted the corresponding page error.

    const app = new EncryptionAppPage(page);
    await app.goto();

    // Clear any previously captured page errors
    pageErrors = [];

    // Execute code that will attempt to call an undeclared identifier.
    // This will throw in the page context and generate a pageerror event.
    let evaluateThrew = false;
    try {
      // renderPage() is not defined in the page's global scope, so this should raise a ReferenceError.
      await page.evaluate(() => {
        // Intentionally call an undefined identifier to produce a ReferenceError.
        // We purposely do NOT guard this call so the error surfaces to the page context.
        // eslint-disable-next-line no-undef
        renderPage();
      });
    } catch (err) {
      // Playwright will surface the thrown exception from evaluate; capture that this happened.
      evaluateThrew = true;
      // swallow - we will assert about the page error below
    }

    // At least one of evaluate throwing or pageerror being emitted is expected.
    expect(evaluateThrew).toBe(true);

    // Wait briefly to ensure pageerror listeners processed the event.
    await page.waitForTimeout(50);

    // There should be at least one page error captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The error message should reference renderPage and indicate it's not defined (ReferenceError)
    const matched = pageErrors.some(err => {
      const msg = String(err?.message || err);
      return /renderPage/.test(msg) && /ReferenceError|not defined|is not defined/i.test(msg);
    });
    expect(matched).toBe(true);
  });

  test('Edge case: invoking window.renderPage() (call on undefined property) triggers a TypeError on the page', async ({ page }) => {
    // Calling window.renderPage() when renderPage is undefined should result in a TypeError:
    // "window.renderPage is not a function" in many browsers. This test asserts a TypeError is emitted.

    const app = new EncryptionAppPage(page);
    await app.goto();

    // Reset error collection
    pageErrors = [];

    let evaluateThrew = false;
    try {
      // Attempt to call window.renderPage() which should throw a TypeError in the page context.
      await page.evaluate(() => {
        // If renderPage is undefined, invoking it should throw.
        // Use parentheses to ensure invocation rather than just reading undefined.
        return window.renderPage();
      });
    } catch (err) {
      evaluateThrew = true;
      // swallow - we'll check the page error(s)
    }

    expect(evaluateThrew).toBe(true);

    // Wait a bit for pageerror to be emitted/collected
    await page.waitForTimeout(50);

    // There should be at least one page error captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The error message should indicate a "not a function" style message referencing renderPage or window.renderPage
    const matched = pageErrors.some(err => {
      const msg = String(err?.message || err);
      return /renderPage/.test(msg) && /(is not a function|not a function|is not callable|not defined|is not defined)/i.test(msg);
    });
    expect(matched).toBe(true);
  });

  test('Diagnostics: no unexpected console error messages during normal usage flow', async ({ page }) => {
    // This test performs common usage flows and then asserts there were no console.error messages,
    // while still acknowledging that intentionally invoked page errors (in other tests) are captured separately.

    const app = new EncryptionAppPage(page);
    await app.goto();

    // Perform normal interactions: read UI, click alert and accept it
    const dialogMessages = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await app.clickLearnMore();
    await page.waitForTimeout(100);

    // Validate expected dialog was shown
    expect(dialogMessages.length).toBe(1);
    expect(dialogMessages[0]).toBe('Embracing the art of encryption!');

    // Verify that console.error was not produced during normal flow
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Confirm there were no page-level uncaught errors in the normal usage flow
    expect(pageErrors.length).toBe(0);
  });
});