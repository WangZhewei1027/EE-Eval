import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04434670-fa79-11f0-8a8e-bbe4f11717c6.html';

// Simple page object for the Big-O Notation page
class BigOPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      timeBtn: '#time-btn',
      spaceBtn: '#space-btn',
      headerTitle: '.header h1',
      container: '.container',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickTimeAndGetDialog() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.click(this.selectors.timeBtn),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  async clickSpaceAndGetDialog() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.click(this.selectors.spaceBtn),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}

test.describe('Big-O Notation interactive application (FSM: Idle, TimeComplexity, SpaceComplexity)', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners before each test and navigate to the application
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to all console events (info, warn, error, etc.)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (runtime exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Individual test verifying the Idle state UI is rendered correctly
  test('Idle state: initial render shows header, content and buttons (S0_Idle)', async ({ page }) => {
    const bigO = new BigOPage(page);

    // Navigate to the page (renderPage() mentioned in FSM should NOT be injected by the test)
    await bigO.goto();

    // Verify container is visible
    const container = await page.locator(bigO.selectors.container);
    await expect(container).toBeVisible();

    // Verify header text
    await expect(page.locator(bigO.selectors.headerTitle)).toHaveText('Big-O Notation');

    // Verify presence and text of the two buttons described in the FSM
    const timeBtn = page.locator(bigO.selectors.timeBtn);
    const spaceBtn = page.locator(bigO.selectors.spaceBtn);
    await expect(timeBtn).toBeVisible();
    await expect(timeBtn).toHaveText('Time Complexity');
    await expect(timeBtn).toBeEnabled();

    await expect(spaceBtn).toBeVisible();
    await expect(spaceBtn).toHaveText('Space Complexity');
    await expect(spaceBtn).toBeEnabled();

    // Verify that the FSM's stated "renderPage()" function is not present on the window
    // The FSM listed renderPage() as an entry action for S0_Idle; the implementation does not define it.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage === 'function');
    // We assert that renderPage is not implemented (expected given the provided HTML)
    expect(hasRenderPage).toBe(false);

    // Assert there were no uncaught page errors during initial render
    expect(pageErrors.length).toBe(0);

    // Optionally log console messages for debugging; ensure there are no console.error entries
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test the Time Complexity button triggers the expected alert and FSM transition S0 -> S1
  test('Transition: clicking Time Complexity button triggers alert with expected message (S1_TimeComplexity)', async ({ page }) => {
    const bigO = new BigOPage(page);
    await bigO.goto();

    // Click the time button and capture the dialog message
    const message = await bigO.clickTimeAndGetDialog();

    // Verify dialog text exactly matches FSM expectation
    expect(message).toBe('Time complexity: O(n) or O(n^2)');

    // There should be no uncaught runtime errors as a result of the click
    expect(pageErrors.length).toBe(0);

    // Ensure console didn't produce errors during the interaction
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test the Space Complexity button triggers the expected alert and FSM transition S0 -> S2
  test('Transition: clicking Space Complexity button triggers alert with expected message (S2_SpaceComplexity)', async ({ page }) => {
    const bigO = new BigOPage(page);
    await bigO.goto();

    // Click the space button and capture the dialog message
    const message = await bigO.clickSpaceAndGetDialog();

    // Verify dialog text exactly matches FSM expectation
    expect(message).toBe('Space complexity: O(1) or O(n)');

    // Assert no uncaught runtime errors occurred
    expect(pageErrors.length).toBe(0);

    // Ensure console didn't produce errors during the interaction
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: rapid sequential clicks produce repeated alerts
  test('Edge case: multiple rapid clicks on Time Complexity produce multiple alerts (message captured each time)', async ({ page }) => {
    const bigO = new BigOPage(page);
    await bigO.goto();

    // Collect dialog messages as they appear and accept them automatically
    const dialogMessages = [];
    const dialogHandler = async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    };
    page.on('dialog', dialogHandler);

    // Click the time button twice rapidly
    await page.click(bigO.selectors.timeBtn);
    await page.click(bigO.selectors.timeBtn);

    // Small wait to ensure dialogs were delivered and handled
    await page.waitForTimeout(100); // allow events to process

    // Remove handler to avoid leaking between tests
    page.off('dialog', dialogHandler);

    // Expect two dialogs were shown with the correct message
    expect(dialogMessages.length).toBeGreaterThanOrEqual(2);
    dialogMessages.forEach(msg => expect(msg).toBe('Time complexity: O(n) or O(n^2)'));

    // No uncaught runtime errors should be present
    expect(pageErrors.length).toBe(0);
  });

  // Edge/error scenario: attempting to click a non-existent selector should surface an error in the test (Playwright will throw)
  test('Error scenario: clicking a non-existent element should throw an exception from the Playwright API', async ({ page }) => {
    const bigO = new BigOPage(page);
    await bigO.goto();

    // Attempt to click a selector that does not exist. This is expected to reject.
    const nonexistentSelector = '#non-existent-btn';
    let threw = false;
    try {
      await page.click(nonexistentSelector, { timeout: 500 });
    } catch (err) {
      threw = true;
      // Ensure the thrown error is meaningful (contains the selector)
      expect(err.message).toContain(nonexistentSelector);
    }
    expect(threw).toBe(true);

    // No uncaught runtime errors should appear on the page itself as a result of this failed click
    expect(pageErrors.length).toBe(0);
  });

  // Combined interactions: verify sequential transitions and absence of unexpected errors
  test('Sequential interactions: Time -> Space produces the two expected alerts in order', async ({ page }) => {
    const bigO = new BigOPage(page);
    await bigO.goto();

    // Capture dialog messages in sequence
    const messages = [];
    const handler = async dialog => {
      messages.push(dialog.message());
      await dialog.accept();
    };
    page.on('dialog', handler);

    // Trigger time then space
    await page.click(bigO.selectors.timeBtn);
    await page.click(bigO.selectors.spaceBtn);

    // Allow time for events
    await page.waitForTimeout(100);
    page.off('dialog', handler);

    // Validate the order and content of the alerts
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[0]).toBe('Time complexity: O(n) or O(n^2)');
    expect(messages[1]).toBe('Space complexity: O(1) or O(n)');

    // Ensure no uncaught runtime errors appeared during the sequence
    expect(pageErrors.length).toBe(0);
  });

  // Verify that there are no unexpected SyntaxError / ReferenceError / TypeError emitted during normal usage
  test('Sanity: no uncaught runtime exceptions (SyntaxError/ReferenceError/TypeError) during page lifecycle', async ({ page }) => {
    const bigO = new BigOPage(page);
    await bigO.goto();

    // Perform a small interaction to exercise event handlers
    const dialog = await Promise.all([
      page.waitForEvent('dialog'),
      page.click(bigO.selectors.timeBtn),
    ]);
    // Accept and ignore the dialog
    await dialog[0].accept();

    // Validate there were no page errors captured
    // If any ReferenceError/SyntaxError/TypeError occur on the page they will appear in pageErrors and cause this assertion to fail
    expect(pageErrors.length).toBe(0);

    // Also ensure console does not contain 'error' messages
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });
});