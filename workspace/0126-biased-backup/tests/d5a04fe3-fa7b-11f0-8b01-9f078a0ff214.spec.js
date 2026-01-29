import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a04fe3-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the BST demo page
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.container');
    this.showDemoButton = page.locator("button[onclick='showDemo()']");
  }

  // Navigate to the app URL
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the "Show BST Demonstration" button and wait for the alert dialog
  async clickShowDemoAndGetDialogText() {
    // Start listening for the dialog before clicking to avoid races
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.showDemoButton.click();
    const dialog = await dialogPromise;
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  // Get the onclick attribute of the button
  async getButtonOnClickAttribute() {
    return await this.showDemoButton.getAttribute('onclick');
  }

  // Check visibility/presence of main container
  async isContainerVisible() {
    return await this.container.isVisible();
  }
}

test.describe('Binary Search Tree (BST) interactive page - FSM validation', () => {
  // Collect console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught errors from the page
    page.on('pageerror', (err) => {
      // err is Error object from page context
      pageErrors.push(String(err.message || err));
    });
  });

  test('S0 Idle state: page loads, UI elements present, and entry action renderPage is not defined', async ({ page }) => {
    // Purpose:
    // - Validate initial Idle state (S0_Idle)
    // - Ensure main content and button are present
    // - Verify that renderPage entry action is missing (i.e., undefined)
    const bst = new BSTPage(page);
    await bst.goto();

    // Verify main container is visible
    expect(await bst.isContainerVisible()).toBe(true);

    // Verify button exists and is visible
    await expect(bst.showDemoButton).toBeVisible();

    // Verify the button text content includes expected label
    await expect(bst.showDemoButton).toHaveText(/Show BST Demonstration/);

    // Verify onclick attribute is exactly "showDemo()"
    const onclickAttr = await bst.getButtonOnClickAttribute();
    expect(onclickAttr).toBe('showDemo()');

    // Confirm that showDemo function exists in the page context
    const showDemoType = await page.evaluate(() => typeof window.showDemo);
    expect(showDemoType).toBe('function');

    // Confirm that renderPage (mentioned in FSM entry actions) is NOT defined on the page
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // No page errors should have occurred just from loading the page (we will assert that)
    expect(pageErrors.length).toBe(0);

    // No 'error' level console messages on initial load
    const consoleErrors = consoleMessages.filter(msg => msg.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition ShowDemo (S0 -> S1): clicking the button triggers alert dialog with expected text', async ({ page }) => {
    // Purpose:
    // - Validate the ShowDemo event/transition
    // - Confirm the S1_DemoShown entry action (alert) runs with exact message
    // - Ensure no page errors occur while handling the dialog
    const bst = new BSTPage(page);
    await bst.goto();

    // Prepare to capture the dialog and click the button
    const expectedAlertText = 'This would trigger a demo for visualizing BST insertion and traversal, though currently no interactive demo implemented.';

    // Click and get dialog text
    const dialogText = await bst.clickShowDemoAndGetDialogText();
    expect(dialogText).toBe(expectedAlertText);

    // After dismissing the alert, ensure the page remains intact and no errors were emitted
    expect(await bst.isContainerVisible()).toBe(true);
    expect(pageErrors.length).toBe(0);

    // Confirm console has no error messages related to the alert
    const consoleErrors = consoleMessages.filter(msg => msg.type === 'error' || msg.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: multiple clicks produce multiple alerts sequentially and the page remains stable', async ({ page }) => {
    // Purpose:
    // - Clicking the ShowDemo button multiple times should produce an alert each time
    // - We assert both alerts occur with the same expected message
    const bst = new BSTPage(page);
    await bst.goto();

    const expectedAlertText = 'This would trigger a demo for visualizing BST insertion and traversal, though currently no interactive demo implemented.';

    // First click
    {
      const dialogPromise = page.waitForEvent('dialog');
      await bst.showDemoButton.click();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe(expectedAlertText);
      await dialog.accept();
    }

    // Second click
    {
      const dialogPromise2 = page.waitForEvent('dialog');
      await bst.showDemoButton.click();
      const dialog2 = await dialogPromise2;
      expect(dialog2.message()).toBe(expectedAlertText);
      await dialog2.accept();
    }

    // After both interactions, the page should not have accumulated unexpected errors
    expect(pageErrors.length).toBe(0);
  });

  test('Verify FSM entry action "renderPage" missing produces a ReferenceError when invoked (observing page error)', async ({ page }) => {
    // Purpose:
    // - FSM S0 mentions an entry action renderPage()
    // - The implementation does not define renderPage
    // - We deliberately attempt to invoke renderPage in the page context asynchronously
    //   so that a ReferenceError occurs in the page and is captured via pageerror listener.
    const bst = new BSTPage(page);
    await bst.goto();

    // Trigger an asynchronous call to renderPage so that it produces an uncaught ReferenceError in the page
    await page.evaluate(() => {
      // Schedule for next event loop turn so the evaluate call does not itself throw
      setTimeout(() => {
        // This will throw "ReferenceError: renderPage is not defined" in the page context
        // We do not catch it here because we want it to surface as a pageerror event
        // (This aligns with the instruction to observe natural errors without patching.)
        // eslint-disable-next-line no-undef
        renderPage();
      }, 0);
    });

    // Give the page a short moment to emit the pageerror event
    await page.waitForTimeout(100);

    // Confirm that at least one page error was recorded and that it mentions renderPage or ReferenceError
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    const joinedErrors = pageErrors.join('\n').toLowerCase();
    expect(
      joinedErrors.includes('renderpage') || joinedErrors.includes('referenceerror'),
    ).toBeTruthy();
  });

  test('Observe console output and ensure no unexpected runtime errors during standard flows', async ({ page }) => {
    // Purpose:
    // - Validate that normal usage (load and single click) does not emit unexpected console errors
    // - Also ensure that expected behaviors (alert) are observed and accepted
    const bst = new BSTPage(page);
    await bst.goto();

    // Clear any previously collected messages/errors within this test's scope
    consoleMessages = [];
    pageErrors = [];

    // Perform the normal flow: click button and accept alert
    const dialogPromise = page.waitForEvent('dialog');
    await bst.showDemoButton.click();
    const dialog = await dialogPromise;
    await dialog.accept();

    // Short wait to allow any async console logs/errors to appear
    await page.waitForTimeout(50);

    // Assert no page errors occurred
    expect(pageErrors.length).toBe(0);

    // Assert there are no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});