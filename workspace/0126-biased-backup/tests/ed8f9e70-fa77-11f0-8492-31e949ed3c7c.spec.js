import { test, expect } from '@playwright/test';

// Page Object for the Git Visual Concept page
class GitVisualPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f9e70-fa77-11f0-8492-31e949ed3c7c.html';
    this.container = '.container';
    this.heading = 'h1';
    this.paragraph = 'p';
    this.discoverButton = 'button[onclick="showInfo()"]';
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async getHeadingText() {
    return this.page.textContent(this.heading);
  }

  async getParagraphText() {
    return this.page.textContent(this.paragraph);
  }

  async isButtonVisible() {
    return this.page.isVisible(this.discoverButton);
  }

  async getButtonText() {
    return this.page.textContent(this.discoverButton);
  }

  async getButtonOnclickAttribute() {
    return this.page.getAttribute(this.discoverButton, 'onclick');
  }

  async clickDiscoverAndHandleDialog() {
    // Wait for the dialog that the button click triggers, validate it, then accept.
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.click(this.discoverButton),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}

test.describe('Git Visual Concept - FSM tests (ed8f9e70-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Collect console messages and page errors for observation in each test.
  test.beforeEach(async ({ page }) => {
    // Attach listeners for console and page errors to aid assertions.
    page.context()._collectedConsoleMessages = [];
    page.context()._collectedPageErrors = [];

    page.on('console', (msg) => {
      // Store console messages for later assertions.
      page.context()._collectedConsoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', (err) => {
      // Store page errors for later assertions.
      page.context()._collectedPageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Basic teardown assertions that help catch unexpected errors.
    const consoleMsgs = page.context()._collectedConsoleMessages || [];
    const pageErrors = page.context()._collectedPageErrors || [];

    // No unexpected console.error messages by default (the app does not log).
    const hasConsoleErrors = consoleMsgs.some(m => m.type === 'error');
    expect(hasConsoleErrors).toBeFalsy();

    // By default, the provided HTML should not produce unhandled page errors
    // during normal rendering and user interactions (we assert that here).
    expect(pageErrors.length).toBeLessThanOrEqual(0);
  });

  test.describe('State: Idle (S0_Idle) - initial rendering and DOM', () => {
    test('Initial state renders container, heading, paragraph, and Discover More button', async ({ page }) => {
      // Arrange
      const gitPage = new GitVisualPage(page);

      // Act
      await gitPage.goto();

      // Assert: Visual elements exist and contain expected text (Idle state evidence).
      await expect(page.locator(gitPage.container)).toBeVisible();
      await expect(page.locator(gitPage.heading)).toHaveText('Welcome to Git');
      await expect(page.locator(gitPage.paragraph)).toContainText('Git is a powerful version control system');
      await expect(page.locator(gitPage.discoverButton)).toBeVisible();
      await expect(gitPage.getButtonText()).resolves.toBe('Discover More');

      // Assert: onclick attribute exists and references showInfo()
      const onclickAttr = await gitPage.getButtonOnclickAttribute();
      expect(onclickAttr).toBe('showInfo()');

      // Verify the showInfo function is present in the window (entry to transition action).
      const showInfoType = await page.evaluate(() => typeof window.showInfo);
      expect(showInfoType).toBe('function');

      // Capture console and page error counts for this load - expected to be zero.
      const consoleMsgs = page.context()._collectedConsoleMessages;
      const pageErrors = page.context()._collectedPageErrors;
      expect(consoleMsgs.length).toBeGreaterThanOrEqual(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ButtonClick -> Info Shown (S0_Idle to S1_InfoShown)', () => {
    test('Clicking Discover More triggers an alert with the expected Git information', async ({ page }) => {
      // This validates the transition action showInfo() and the Info Shown state observable (alert).
      const gitPage = new GitVisualPage(page);
      await gitPage.goto();

      // Click the button and handle the alert dialog.
      const dialogMessage = await gitPage.clickDiscoverAndHandleDialog();

      // Assert dialog content matches FSM evidence.
      expect(dialogMessage).toBe(
        'Git allows for easy branching, merging, and distributed version control. Explore the world of code management!'
      );

      // After the alert is accepted, ensure the DOM still contains the button and content (app remains functional).
      await expect(page.locator(gitPage.discoverButton)).toBeVisible();
      await expect(page.locator(gitPage.heading)).toHaveText('Welcome to Git');

      // Ensure no unhandled page errors occurred during the click/alert flow.
      const pageErrors = page.context()._collectedPageErrors || [];
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking the button multiple times shows the alert each time (edge case)', async ({ page }) => {
      const gitPage = new GitVisualPage(page);
      await gitPage.goto();

      // Click twice and assert both dialogs occur and contain the expected text.
      const messages = [];
      for (let i = 0; i < 2; i++) {
        const message = await gitPage.clickDiscoverAndHandleDialog();
        messages.push(message);
      }

      expect(messages.length).toBe(2);
      for (const msg of messages) {
        expect(msg).toContain('Git allows for easy branching, merging');
      }

      // Still no page errors.
      const pageErrors = page.context()._collectedPageErrors || [];
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('FSM entry/exit actions and error observation', () => {
    test('Verify specified onEnter action renderPage() is not defined in the runtime (assert presence/absence of entry action)', async ({ page }) => {
      // The FSM mentioned renderPage() as an entry action for S0_Idle.
      // The HTML implementation does not define renderPage(), so we assert that it is undefined.
      const gitPage = new GitVisualPage(page);
      await gitPage.goto();

      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      // Confirm showInfo exists as it is referenced in the onclick attribute.
      const showInfoType = await page.evaluate(() => typeof window.showInfo);
      expect(showInfoType).toBe('function');
    });

    test('Edge scenario: an unhandled ReferenceError in the page should surface as a pageerror event', async ({ page }) => {
      // This test intentionally triggers an unhandled ReferenceError inside the page context
      // (without modifying or patching any existing functions) and asserts that the error is observed.
      await page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/ed8f9e70-fa77-11f0-8492-31e949ed3c7c.html');

      // Prepare to wait for a pageerror event which will be emitted for unhandled exceptions.
      const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 5000 });

      // Trigger an asynchronous unhandled error inside the page (so it is uncaught and reported).
      await page.evaluate(() => {
        // Schedule an async call that will cause a ReferenceError (no such function).
        setTimeout(() => {
          // eslint-disable-next-line no-undef
          nonexistentFunctionThatDoesNotExist(); // intentionally causes ReferenceError
        }, 0);
      });

      // Wait for the pageerror event and assert its message contains the function name or ReferenceError text.
      const pageError = await pageErrorPromise;
      expect(pageError).toBeTruthy();
      const errMsg = String(pageError.message || pageError);
      // The exact message varies by engine, but should reference the undefined function or ReferenceError.
      expect(
        errMsg.includes('nonexistentFunctionThatDoesNotExist') ||
        /ReferenceError/i.test(errMsg) ||
        /is not defined/i.test(errMsg)
      ).toBeTruthy();
    });
  });

  test.describe('Observability: console logs and page errors during typical usage', () => {
    test('No unexpected console errors and no page errors during normal navigation and interactions', async ({ page }) => {
      const gitPage = new GitVisualPage(page);
      await gitPage.goto();

      // Interact: click and handle the dialog once.
      await gitPage.clickDiscoverAndHandleDialog();

      // Evaluate collected console messages and page errors.
      const consoleMsgs = page.context()._collectedConsoleMessages || [];
      const pageErrors = page.context()._collectedPageErrors || [];

      // The page does not emit console.error or page errors as part of normal operation.
      const consoleErrorMsgs = consoleMsgs.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});