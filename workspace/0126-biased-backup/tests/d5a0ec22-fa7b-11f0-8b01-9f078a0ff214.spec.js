import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a0ec22-fa7b-11f0-8b01-9f078a0ff214.html';

// Page object for the Counting Sort demo page
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '.button';
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Return the demo button element handle
  async getDemoButton() {
    return await this.page.$(this.buttonSelector);
  }

  // Click the demo button
  async clickDemo() {
    await this.page.click(this.buttonSelector);
  }

  // Check if showDemo function is present on the page
  async showDemoExists() {
    return await this.page.evaluate(() => typeof window.showDemo === 'function');
  }

  // Check if renderPage function is present on the page
  async renderPageExists() {
    return await this.page.evaluate(() => typeof window.renderPage === 'function');
  }

  // Get the onclick attribute text of the button
  async getButtonOnclickAttribute() {
    const btn = await this.getDemoButton();
    if (!btn) return null;
    return await btn.getAttribute('onclick');
  }

  // Get button text content
  async getButtonText() {
    const btn = await this.getDemoButton();
    if (!btn) return null;
    return (await this.page.evaluate(el => el.textContent, btn)).trim();
  }
}

test.describe('Counting Sort Explained - FSM and UI tests', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Setup listeners before each test to capture console and page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture the text and type for inspection in assertions
      consoleMessages.push({ text: msg.text(), type: msg.type() });
    });

    page.on('pageerror', (err) => {
      // capture error objects thrown in the page context
      pageErrors.push(err);
    });
  });

  // Clean up listeners after each test to avoid cross-test bleed
  test.afterEach(async ({ page }) => {
    // remove listeners (safe even if not previously attached)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  // Test the Idle state (S0_Idle): page initial render and presence of button
  test('Idle state: initial render shows demo button and expected attributes', async ({ page }) => {
    // Arrange: navigate to page
    const countingPage = new CountingSortPage(page);
    await countingPage.goto();

    // Act & Assert:
    // - Button should be present
    const btn = await countingPage.getDemoButton();
    expect(btn, 'Demo button should be present in Idle state').not.toBeNull();

    // - Button text should match FSM evidence
    const text = await countingPage.getButtonText();
    expect(text).toBe('See a Simple Demonstration');

    // - onclick attribute should reference showDemo()
    const onclickAttr = await countingPage.getButtonOnclickAttribute();
    expect(onclickAttr).toBe('showDemo()');

    // - showDemo function should be defined on the page (entry action for S1)
    const showDemoExists = await countingPage.showDemoExists();
    expect(showDemoExists).toBe(true);

    // - renderPage (entry action for S0 in FSM) is not present in the actual HTML/JS
    const renderPageExists = await countingPage.renderPageExists();
    // We assert that renderPage is not defined on the page (the implementation did not include it)
    expect(renderPageExists).toBe(false);

    // - No unexpected page errors during initial load
    expect(pageErrors.length).toBe(0);

    // - No console error-level messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test the transition ShowDemo: clicking button should trigger an alert with specific text
  test('Transition ShowDemo: clicking demo button triggers alert (S0 -> S1)', async ({ page }) => {
    const countingPage = new CountingSortPage(page);
    await countingPage.goto();

    // Listen for the dialog that the page's showDemo() should produce
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      // Accept the alert to continue test execution
      await dialog.accept();
    });

    // Click the demo button to trigger the alert
    await countingPage.clickDemo();

    // Ensure the dialog was shown with the expected message
    expect(dialogMessage).toBe('Demonstration of Counting Sort would be shown here!');

    // Clicking the button should not have produced any uncaught page errors
    expect(pageErrors.length).toBe(0, `Unexpected page errors: ${pageErrors.map(e => e.message).join(', ')}`);

    // No console error messages produced by the action
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test repeated interactions: clicking multiple times should produce multiple dialogs
  test('Repeated ShowDemo clicks produce alerts each time', async ({ page }) => {
    const countingPage = new CountingSortPage(page);
    await countingPage.goto();

    // We'll count the number of dialogs fired
    let dialogCount = 0;
    const expectedMessage = 'Demonstration of Counting Sort would be shown here!';

    // Attach a handler that accepts all dialogs and increments counter
    const dialogHandler = async (dialog) => {
      try {
        expect(dialog.message()).toBe(expectedMessage);
      } finally {
        dialogCount += 1;
        await dialog.accept();
      }
    };
    page.on('dialog', dialogHandler);

    // Click three times
    await countingPage.clickDemo();
    await countingPage.clickDemo();
    await countingPage.clickDemo();

    // Allow any pending dialog handlers to run
    await page.waitForTimeout(100); // small wait to ensure all dialogs processed

    // Clean up dialog listener
    page.off('dialog', dialogHandler);

    // Verify three dialogs were observed
    expect(dialogCount).toBe(3);

    // Ensure no unexpected page errors were produced by repeated clicks
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: clicking a non-existent selector should cause Playwright to throw an error
  test('Edge case: attempting to click a non-existent selector throws', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Attempt to click a selector that does not exist on the page and assert it rejects
    // We expect Playwright to reject the click promise since the element cannot be found
    await expect(page.click('.does-not-exist', { timeout: 500 })).rejects.toThrow();
  });

  // Verify the FSM onEnter action renderPage is not defined and that calling it would produce a ReferenceError in the page context
  test('FSM onEnter renderPage: calling undefined renderPage produces ReferenceError in page context', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure renderPage is indeed not defined according to the page
    const renderExists = await page.evaluate(() => typeof window.renderPage === 'function');
    expect(renderExists).toBe(false);

    // If we attempt to call renderPage in the page context, it should throw a ReferenceError.
    // We assert that the page.evaluate rejects with an error mentioning renderPage (this lets the ReferenceError occur naturally).
    await expect(page.evaluate(() => {
      // The following call should cause a ReferenceError because renderPage is not defined
      // We do not catch it here so that Playwright receives the thrown exception.
      return renderPage();
    })).rejects.toThrow(/renderPage/);

    // Additionally, such an exception should be captured by the pageerror listener
    // Note: give a small delay to ensure pageerror events (if any) are propagated
    await page.waitForTimeout(50);

    // There should be at least one page error captured that mentions the missing function
    const matchingPageErrors = pageErrors.filter(err => String(err).includes('renderPage') || String(err).includes('ReferenceError'));
    expect(matchingPageErrors.length).toBeGreaterThanOrEqual(1);
  });

  // Validate that the showDemo function is accessible and can be called directly from the page context
  test('Direct invocation of showDemo in page context triggers alert dialog', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Setup dialog capture
    let dialogSeen = false;
    page.once('dialog', async (dialog) => {
      try {
        expect(dialog.message()).toBe('Demonstration of Counting Sort would be shown here!');
        dialogSeen = true;
      } finally {
        await dialog.accept();
      }
    });

    // Call showDemo directly from the page context; this should trigger the same alert
    const result = await page.evaluate(() => {
      // showDemo is defined by the page's script; calling it should show an alert
      // We return true from the evaluate if the call was initiated (alerts are handled via dialog)
      if (typeof showDemo === 'function') {
        showDemo();
        return true;
      }
      return false;
    });

    expect(result).toBe(true);
    // wait a tick to ensure dialog handler runs
    await page.waitForTimeout(50);
    expect(dialogSeen).toBe(true);

    // No uncaught errors should have been produced by calling showDemo directly
    expect(pageErrors.length).toBe(0);
  });
});