import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8fc583-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object representing the Compiler Showcase page.
 * Encapsulates common interactions and queries used across tests.
 */
class ShowcasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async titleText() {
    return this.page.textContent('h1');
  }

  async paragraphText() {
    return this.page.textContent('p');
  }

  async buttonText() {
    return this.page.textContent('.button');
  }

  async isButtonVisible() {
    return this.page.isVisible('.button');
  }

  async buttonOnclickAttr() {
    return this.page.getAttribute('.button', 'onclick');
  }

  async clickLearnMore() {
    await this.page.click('.button');
  }

  async typeOfShowAlert() {
    return this.page.evaluate(() => typeof window.showAlert);
  }
}

test.describe('Compiler Visual Showcase - FSM Integration Tests', () => {

  // Each test will create its own page fixture (isolated). We capture console messages,
  // page errors and dialog events for assertions.
  test.describe('FSM States: Idle and AlertShown', () => {

    test('Idle state renders correctly: title, description and Learn More button are present', async ({ page }) => {
      // Track console messages and page errors for this test
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));

      const app = new ShowcasePage(page);
      await app.goto();

      // Validate DOM evidence for S0_Idle state per FSM
      // - <h1>Compiler Showcase</h1>
      // - <button class="button" onclick="showAlert()">Learn More</button>
      const title = (await app.titleText())?.trim();
      const para = (await app.paragraphText())?.trim();
      const btnText = (await app.buttonText())?.trim();

      // Assertions for visible elements and expected text content
      expect(title).toBe('Compiler Showcase');
      expect(para).toContain('Experience the beauty of compilers');
      expect(btnText).toBe('Learn More');
      expect(await app.isButtonVisible()).toBe(true);

      // There should be no uncaught page errors simply from rendering the Idle state
      expect(pageErrors).toHaveLength(0);

      // Ensure console did not log any severe errors on load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(consoleErrors.length).toBe(0);
    });

    test('Transition LearnMoreClick -> shows alert and moves to AlertShown state', async ({ page }) => {
      // Capture dialogs and page errors
      const dialogs = [];
      const pageErrors = [];
      page.on('dialog', async (dialog) => {
        // record message then accept so the page can proceed
        dialogs.push(dialog.message());
        await dialog.accept();
      });
      page.on('pageerror', (err) => pageErrors.push(err));

      const app = new ShowcasePage(page);
      await app.goto();

      // Click the Learn More button to trigger the alert
      await app.clickLearnMore();

      // Wait briefly to allow dialog handler to run
      await page.waitForTimeout(100);

      // FSM expects an alert box with a specific message
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[0]).toBe('Thank you for your interest in compilers!');

      // After showing the alert, the page DOM should still contain the original elements (no navigation)
      expect(await app.titleText()).toBe('Compiler Showcase');
      expect(await app.buttonText()).toBe('Learn More');

      // No uncaught page errors should have occurred due to this normal interaction
      expect(pageErrors).toHaveLength(0);
    });

    test('Clicking Learn More twice shows two sequential alerts', async ({ page }) => {
      // Collect all dialog messages
      const dialogs = [];
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog.message());
        // accept immediately so subsequent clicks can proceed
        await dialog.accept();
      });

      const app = new ShowcasePage(page);
      await app.goto();

      // Click twice; we await each click which will trigger the dialog and be accepted by the handler
      await app.clickLearnMore();
      // small pause to let accept happen
      await page.waitForTimeout(50);
      await app.clickLearnMore();
      await page.waitForTimeout(50);

      expect(dialogs).toHaveLength(2);
      expect(dialogs[0]).toBe('Thank you for your interest in compilers!');
      expect(dialogs[1]).toBe('Thank you for your interest in compilers!');
    });

  });

  test.describe('FSM Evidence & onEnter/onExit Actions checks', () => {

    test('Button has onclick attribute pointing to showAlert() and showAlert is a function', async ({ page }) => {
      const app = new ShowcasePage(page);
      await app.goto();

      const onclickAttr = await app.buttonOnclickAttr();
      expect(onclickAttr).toBe('showAlert()');

      // The page includes a function showAlert() - verify it exists in page context
      const typeofShowAlert = await app.typeOfShowAlert();
      expect(typeofShowAlert).toBe('function');
    });

    test('FSM entry action renderPage() is not defined in the implementation - invoking it should cause ReferenceError', async ({ page }) => {
      // Capture page errors caused by invoking an undefined function
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      const app = new ShowcasePage(page);
      await app.goto();

      // The FSM mentions renderPage() as an entry action, but the HTML does NOT define renderPage.
      // Attempting to call renderPage() from page.evaluate will result in a ReferenceError.
      // We assert that calling it rejects with a ReferenceError and that a page error is recorded.
      await expect(page.evaluate(() => {
        // We deliberately call the (missing) function so the runtime triggers the error naturally.
        // Do not catch here - allow the evaluate to reject so the test can assert the rejection.
        // This mirrors "let ReferenceError happen naturally".
        // Note: Playwright will serialize the rejection as an error in the test.
        // eslint-disable-next-line no-undef
        return renderPage();
      })).rejects.toThrow(/renderPage is not defined|ReferenceError/);

      // The pageerror event should have captured the ReferenceError as well
      // Wait a short time to ensure pageerror handler has been invoked
      await page.waitForTimeout(50);
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const messages = pageErrors.map(e => String(e.message || e));
      const found = messages.some(m => /renderPage is not defined|ReferenceError/.test(m));
      expect(found).toBe(true);
    });

  });

  test.describe('Edge cases and robustness', () => {

    test('Ensure calling showAlert via evaluate triggers a dialog we can intercept', async ({ page }) => {
      // This validates that programmatic calls to the function behave the same as clicking the button.
      const dialogs = [];
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      const app = new ShowcasePage(page);
      await app.goto();

      // Call showAlert() from page context. Because the function exists, this should trigger a dialog.
      await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        window.showAlert();
      });

      // Give time for dialog to be captured and accepted
      await page.waitForTimeout(50);

      expect(dialogs).toHaveLength(1);
      expect(dialogs[0]).toBe('Thank you for your interest in compilers!');
    });

    test('No unexpected console errors on interaction sequence: multiple clicks + DOM checks', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));

      const app = new ShowcasePage(page);
      await app.goto();

      // Perform a series of interactions to exercise UI: hover title, click button, inspect graphics element
      await page.hover('h1');
      // Interact with the graphic-shape to ensure it's present
      expect(await page.isVisible('.graphic-shape')).toBe(true);

      // Handle dialog(s) resulting from clicks
      page.on('dialog', async dialog => await dialog.accept());

      // Click multiple times with small delays
      await app.clickLearnMore();
      await page.waitForTimeout(50);
      await app.clickLearnMore();
      await page.waitForTimeout(50);

      // After interactions, ensure no page errors accumulated
      expect(pageErrors).toHaveLength(0);

      // Console should not have error-level messages
      const severe = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(severe.length).toBe(0);
    });
  });

});