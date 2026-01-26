import { test, expect } from '@playwright/test';

// Test file: d5a001c1-fa7b-11f0-8b01-9f078a0ff214.spec.js
// URL under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/d5a001c1-fa7b-11f0-8b01-9f078a0ff214.html

// Page Object Model for the Circular Linked List demo page
class CircularLinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Use the exact selector from the FSM/HTML. Use backticks to preserve nested quotes.
    this.showDemoButton = page.locator(
      `button[onclick="alert('Demonstration of Circular Linked List coming soon!')"]`
    );
    this.contentContainer = page.locator('.content');
  }

  // Navigate to the page under test
  async goto() {
    await this.page.goto(
      'http://127.0.0.1:5500/workspace/0126-biased/html/d5a001c1-fa7b-11f0-8b01-9f078a0ff214.html',
      { waitUntil: 'domcontentloaded' }
    );
  }

  // Click the Show Demonstration button
  async clickShowDemo() {
    await this.showDemoButton.click();
  }

  // Focus the button and press Enter to simulate keyboard activation
  async pressEnterOnButton() {
    await this.showDemoButton.focus();
    await this.page.keyboard.press('Enter');
  }

  // Get the button's text content
  async getButtonText() {
    return (await this.showDemoButton.textContent())?.trim();
  }

  // Get the onclick attribute value
  async getButtonOnClickAttribute() {
    return await this.showDemoButton.getAttribute('onclick');
  }

  // Check whether the content container contains expected header text
  async getHeaderText() {
    return (await this.contentContainer.locator('h1').textContent())?.trim();
  }

  // Count of matching button(s)
  async buttonCount() {
    return await this.showDemoButton.count();
  }
}

test.describe('Circular Linked List - FSM and UI validations', () => {
  // Shared arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors for console messages and page errors
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Collect console messages with type and text for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Capture runtime exceptions thrown in the page context
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid cross-test leakage
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial render matches Idle state (S0_Idle) and DOM contains expected content', async ({ page }) => {
    // This test validates that when the page loads it reflects the Idle state:
    // - The main content exists
    // - The "Show Demonstration" button is present with the exact onclick attribute
    // - The page title and header are correct
    const app = new CircularLinkedListPage(page);
    await app.goto();

    // Page title should match the document title
    await expect(page).toHaveTitle('Circular Linked List - Comprehensive Guide');

    // Header presence and text check
    const header = await app.getHeaderText();
    expect(header).toBe('Circular Linked List');

    // The button should exist exactly once and be visible
    const count = await app.buttonCount();
    expect(count).toBe(1);

    // Validate button text
    const buttonText = await app.getButtonText();
    expect(buttonText).toBe('Show Demonstration');

    // Validate the inline onclick attribute exactly matches FSM evidence
    const onclickAttr = await app.getButtonOnClickAttribute();
    expect(onclickAttr).toBe("alert('Demonstration of Circular Linked List coming soon!')");

    // Ensure no unexpected page errors were emitted during initial render
    expect(pageErrors.length).toBe(0);

    // Ensure console did not log errors (info logs allowed)
    const consoleErrorCount = consoleMessages.filter((m) => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Entry action renderPage() is not defined - invoking it produces a ReferenceError', async ({ page }) => {
    // FSM metadata mentioned an entry action renderPage().
    // The HTML/JS does not implement renderPage. We validate that:
    // - typeof renderPage === "undefined"
    // - attempting to call renderPage() in the page context throws a ReferenceError (or similar)
    const app = new CircularLinkedListPage(page);
    await app.goto();

    // Confirm the function is not defined on the window
    const typeofRender = await page.evaluate(() => typeof window.renderPage);
    expect(typeofRender).toBe('undefined');

    // Attempting to invoke the missing function should cause the page evaluate to reject with an error.
    // We assert that attempting to call the function throws and that the message references "renderPage".
    await expect(page.evaluate(() => {
      // Intentionally invoke the missing function to allow the natural ReferenceError to occur
      // This call should reject the promise returned by page.evaluate
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow(/renderPage/);
  });

  test('Clicking the "Show Demonstration" button triggers an alert with the expected message (transition ShowDemonstration)', async ({ page }) => {
    // This test validates the FSM event/transition:
    // - User click on the button should trigger an alert dialog
    // - The alert text must match the FSM expected observable
    // - The page remains in Idle state (button still present) after the alert
    const app = new CircularLinkedListPage(page);
    await app.goto();

    // Collect dialog messages
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      // Accept the alert so it does not block further interactions
      await dialog.accept();
    });

    // Perform the click which should open an alert
    await app.clickShowDemo();

    // Wait briefly to ensure dialog handlers run
    await page.waitForTimeout(100);

    // Exactly one alert should have been shown with the expected message
    expect(dialogs.length).toBe(1);
    expect(dialogs[0].type).toBe('alert');
    expect(dialogs[0].message).toBe('Demonstration of Circular Linked List coming soon!');

    // After the alert, the button and content should still be present (state remains Idle)
    expect(await app.buttonCount()).toBe(1);
    const buttonText = await app.getButtonText();
    expect(buttonText).toBe('Show Demonstration');

    // No new runtime errors should have been emitted during the click/alert
    expect(pageErrors.length).toBe(0);
  });

  test('Keyboard activation (Enter) on the button triggers the same alert', async ({ page }) => {
    // Validates that keyboard interaction (Enter key) on the button triggers the same event/transition.
    const app = new CircularLinkedListPage(page);
    await app.goto();

    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    // Use keyboard activation to trigger the button
    await app.pressEnterOnButton();

    // Ensure the dialog was triggered and had the expected message
    await page.waitForTimeout(100);
    expect(dialogs.length).toBe(1);
    expect(dialogs[0]).toBe('Demonstration of Circular Linked List coming soon!');

    // Confirm still in Idle state (button present)
    expect(await app.buttonCount()).toBe(1);
  });

  test('Multiple clicks produce multiple alerts (transition repeated) and are handled sequentially', async ({ page }) => {
    // Validates repeated events: clicking multiple times triggers multiple alerts,
    // and each alert can be accepted sequentially without leaving the Idle state.
    const app = new CircularLinkedListPage(page);
    await app.goto();

    const dialogMessages = [];
    // Use on to gather multiple dialogs
    page.on('dialog', async (dialog) => {
      dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Click twice in quick succession
    await app.clickShowDemo();
    await app.clickShowDemo();

    // Allow time for both dialogs to be handled
    await page.waitForTimeout(200);

    // Expect two alerts, each with identical expected message
    expect(dialogMessages.length).toBe(2);
    for (const d of dialogMessages) {
      expect(d.type).toBe('alert');
      expect(d.message).toBe('Demonstration of Circular Linked List coming soon!');
    }

    // Page should still contain the button (state unchanged)
    expect(await app.buttonCount()).toBe(1);
  });

  test('Edge cases: missing selector and non-existent element operations', async ({ page }) => {
    // This test checks robustness of selectors and behavior when expected elements are absent.
    const app = new CircularLinkedListPage(page);
    await app.goto();

    // Confirm the expected button exists
    expect(await app.buttonCount()).toBe(1);

    // Query a selector that does not exist - should be zero
    const missing = page.locator('#this-button-does-not-exist');
    expect(await missing.count()).toBe(0);

    // Trying to click a non-existent element should throw - assert that an appropriate error is raised
    // We intentionally attempt to click via a locator that resolves to 0 elements to trigger Playwright's error
    await expect(missing.click()).rejects.toThrow();
  });

  test('Observe console messages and page errors across interactions', async ({ page }) => {
    // Validate that interactions do not produce unexpected console.error or pageerror events.
    const app = new CircularLinkedListPage(page);
    await app.goto();

    // Interact with the page: click the demo button once
    page.on('dialog', async (d) => await d.accept());
    await app.clickShowDemo();

    // Small delay to allow console/pageerror events to be collected
    await page.waitForTimeout(100);

    // Ensure we did not capture any page.error events during this interaction
    expect(pageErrors.length).toBe(0);

    // Filter console messages for errors - there should be none
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // It's acceptable to have info or log messages; assert that we at least received some console messages (if any)
    // Not a strict requirement - just demonstrate observability
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});