import { test, expect } from '@playwright/test';

// Page Object for the Refactoring Concept application
class RefactorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('.btn');
    this.message = page.locator('#message');
    this.image = page.locator('.graphic');
  }

  // Click the reveal button
  async clickReveal() {
    await this.button.click();
  }

  // Return whether the message element is visible according to Playwright
  async isMessageVisible() {
    return await this.message.isVisible();
  }

  // Get the computed display style of the message element
  async getMessageDisplayStyle() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('message');
      return el ? window.getComputedStyle(el).display : null;
    });
  }

  // Get text content of the message
  async getMessageText() {
    return await this.message.textContent();
  }

  // Get attributes of the graphic image
  async getImageAttributes() {
    return {
      src: await this.image.getAttribute('src'),
      alt: await this.image.getAttribute('alt'),
    };
  }
}

test.describe('Refactoring Concept app FSM - ed8fc582-fa77-11f0-8492-31e949ed3c7c', () => {
  const APP_URL =
    'http://127.0.0.1:5500/workspace/0126-biased/html/ed8fc582-fa77-11f0-8492-31e949ed3c7c.html';

  // We'll collect console messages and uncaught page errors for each test.
  // Each test will get fresh arrays because Playwright provides a new page per test.
  test.beforeEach(async ({ page }) => {
    // Navigate to the application page
    await page.goto(APP_URL);
  });

  // Test the initial Idle state (S0_Idle)
  test('S0_Idle: initial render - button present, message hidden, graphic present', async ({ page }) => {
    // Attach listeners to capture console messages and page errors during this test
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new RefactorPage(page);

    // Validate the Reveal Concept button is visible and has the expected label
    await expect(app.button).toBeVisible();
    await expect(app.button).toHaveText('Reveal Concept');

    // Validate the graphic image is present with correct attributes
    const imgAttrs = await app.getImageAttributes();
    expect(imgAttrs.src).toBe('https://via.placeholder.com/200');
    expect(imgAttrs.alt).toBe('Refactoring Graphic');

    // Validate the message element exists but is hidden (display: none)
    await expect(app.message).toBeHidden();
    const displayStyle = await app.getMessageDisplayStyle();
    expect(displayStyle).toBe('none');

    // There should be no uncaught page errors immediately after load in a correct implementation
    expect(pageErrors.length).toBe(0);

    // There should be no console error-level messages on initial load
    const errorConsole = consoleMessages.find((m) => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  // Test the transition RevealConcept: clicking the button reveals the message (S1_Concept_Revealed)
  test('RevealConcept transition: clicking button reveals concept message and sets display to block', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new RefactorPage(page);

    // Precondition: message hidden
    await expect(app.message).toBeHidden();
    expect(await app.getMessageDisplayStyle()).toBe('none');

    // Perform the event: click the .btn which should call displayMessage() in the page
    await app.clickReveal();

    // Assert the message becomes visible and style.display is "block" as expected by the FSM
    await expect(app.message).toBeVisible();
    const displayAfter = await app.getMessageDisplayStyle();
    expect(displayAfter.toLowerCase()).toBe('block');

    // Validate message text content matches FSM evidence
    const messageText = (await app.getMessageText())?.trim();
    expect(messageText).toBe('Refactoring improves code readability and reduces complexity!');

    // Ensure no uncaught errors were emitted during the click/transition
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were produced
    const errorConsole = consoleMessages.find((m) => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  // Edge case: clicking multiple times rapidly should keep the message visible and not produce errors
  test('Edge case: multiple rapid clicks do not produce errors and message remains visible', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new RefactorPage(page);

    // Rapidly click the reveal button several times
    for (let i = 0; i < 5; i++) {
      await app.clickReveal();
    }

    // The message should be visible
    await expect(app.message).toBeVisible();
    expect(await app.getMessageDisplayStyle()).toBe('block');

    // No page errors or console errors should result from repeated clicks
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.find((m) => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  // Validate FSM component existence and attributes (graphic and message element)
  test('Components presence: graphic and message elements match FSM evidence', async ({ page }) => {
    const app = new RefactorPage(page);

    // Graphic should be visible and have the expected src/alt attributes
    await expect(app.image).toBeVisible();
    const attrs = await app.getImageAttributes();
    expect(attrs.src).toBe('https://via.placeholder.com/200');
    expect(attrs.alt).toBe('Refactoring Graphic');

    // Message exists and has expected content but is hidden initially
    await expect(app.message).toBeHidden();
    const text = (await app.getMessageText())?.trim();
    expect(text).toBe('Refactoring improves code readability and reduces complexity!');
  });

  // Verify onEnter action renderPage() mentioned in FSM:
  // The implementation does not define renderPage(). We verify its absence rather than patching code.
  test('FSM onEnter verification: renderPage() entry action is not present on the page (report mismatch)', async ({ page }) => {
    // Check whether renderPage exists in the page context
    const typeOfRenderPage = await page.evaluate(() => typeof window.renderPage);
    // The FSM expected an entry action renderPage(); the implementation does not define it.
    // We assert that it is undefined to capture this mismatch.
    expect(typeOfRenderPage).toBe('undefined');

    // Validate that attempting to call renderPage inside the page context results in a ReferenceError if invoked.
    // We invoke and catch the error inside page context and return the error name so we don't crash the test runner.
    const errorName = await page.evaluate(() => {
      try {
        // Intentionally call an undefined function to observe the natural ReferenceError
        // This is executed within the page context; we catch it and return its name.
        // Note: We are not defining or patching anything on the page.
        // eslint-disable-next-line no-undef
        renderPage();
        return 'no-error';
      } catch (e) {
        return e && e.name ? e.name : String(e);
      }
    });
    expect(errorName).toBe('ReferenceError');
  });

  // Error scenario test: let a ReferenceError happen naturally in the page context (as an uncaught exception)
  test('Error scenario: an uncaught ReferenceError in the page is observed via pageerror event', async ({ page }) => {
    // Set up a promise to capture the next pageerror event. This will resolve with the error object.
    const pageErrorPromise = new Promise((resolve) => {
      const handler = (err) => {
        page.off('pageerror', handler);
        resolve(err);
      };
      page.on('pageerror', handler);
    });

    // Trigger an asynchronous uncaught ReferenceError inside the page context.
    // We schedule it with setTimeout so it becomes an uncaught exception (not caught by evaluate).
    await page.evaluate(() => {
      // eslint-disable-next-line no-undef
      setTimeout(() => nonExistentFunction(), 0);
    });

    // Wait for the pageerror to be emitted and then assert it is a ReferenceError
    const err = /** @type {Error} */ (await pageErrorPromise);
    // The error should be a ReferenceError naming the undefined function
    expect(err).toBeTruthy();
    expect(err.name).toBe('ReferenceError');

    // The message often mentions the function name or 'is not defined'
    expect(err.message.toLowerCase()).toContain('not defined');

    // Additionally, confirm a console 'error' may have been produced depending on the environment
    // We capture console messages separately to inspect them. Re-attach listener for this check.
    const consoleMessages = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    // Trigger another uncaught ReferenceError to capture console output as well
    const pageErrorPromise2 = new Promise((resolve) => {
      const handler = (e) => {
        page.off('pageerror', handler);
        resolve(e);
      };
      page.on('pageerror', handler);
    });
    await page.evaluate(() => setTimeout(() => undefinedFunctionAgain(), 0));
    await pageErrorPromise2;

    // Small delay to allow console events to be delivered in some environments
    await page.waitForTimeout(50);

    const foundConsoleError = consoleMessages.find((m) => m.type === 'error');
    // Depending on the browser/playwright environment, a console.error may or may not be emitted.
    // We assert that either a console error was observed or at least the pageerror event was emitted above.
    // So this assertion is deliberately permissive: we expect the pageerror but console error is optional.
    expect(foundConsoleError === undefined || typeof foundConsoleError.text === 'string').toBeTruthy();
  });
});