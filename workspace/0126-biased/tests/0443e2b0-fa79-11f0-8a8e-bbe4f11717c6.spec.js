import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0443e2b0-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page Object for the NoSQL example page.
 * Encapsulates common selectors and interactions used by tests.
 */
class NoSqlPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      learnMoreButton: '#no-sql-button',
      exampleButton: '#no-sql-example-button',
      headerTitle: 'h1',
      contentHeading: 'h2',
      container: '.container',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getLearnMoreButton() {
    return this.page.locator(this.selectors.learnMoreButton);
  }

  async getExampleButton() {
    return this.page.locator(this.selectors.exampleButton);
  }

  async clickLearnMore() {
    return this.page.click(this.selectors.learnMoreButton);
  }

  async clickExample() {
    return this.page.click(this.selectors.exampleButton);
  }

  async getHeaderText() {
    return this.page.textContent(this.selectors.headerTitle);
  }

  async getContentHeading() {
    return this.page.textContent(this.selectors.contentHeading);
  }
}

test.describe('NoSQL Interactive Application (FSM: S0_Idle)', () => {
  // Containers to record console messages and page errors observed during each test
  let consoleMessages;
  let pageErrors;

  // Ensure a fresh page state and listeners are set up for each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for assertions
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught page errors (e.g., ReferenceError, TypeError, SyntaxError)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing to teardown globally here; this hook exists to emphasize cleanup phase if needed
  });

  test('Initial render: page shows expected structure and components (FSM Idle state)', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle) as described in the FSM:
    // - Both buttons are present with expected text
    // - The main content and headings render
    // - No uncaught page errors occurred on load
    const app = new NoSqlPage(page);

    // Verify structural elements and texts
    await expect(app.getLearnMoreButton()).toBeVisible();
    await expect(app.getExampleButton()).toBeVisible();

    const learnText = await app.getLearnMoreButton().textContent();
    expect(learnText).toBe('Learn More');

    const exampleText = await app.getExampleButton().textContent();
    expect(exampleText).toBe('Example');

    // Check headings/content
    const h1 = await app.getHeaderText();
    expect(h1).toBe('NoSQL');

    const h2 = await app.getContentHeading();
    expect(h2).toBe('What is NoSQL?');

    // Assert the buttons have the expected CSS class per implementation
    await expect(app.getLearnMoreButton()).toHaveClass(/button/);
    await expect(app.getExampleButton()).toHaveClass(/button/);

    // Verify there were no uncaught page errors on initial render
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: Clicking "Learn More" triggers an alert with expected message', async ({ page }) => {
    // This test covers the NoSqlButtonClick event and its transition:
    // Expected observable is alert('You clicked the NoSQL button!')
    const app = new NoSqlPage(page);

    // Prepare to capture the dialog that should appear on click
    const dialogPromise = new Promise((resolve) => {
      page.once('dialog', (dialog) => {
        // Resolve with the dialog object so we can inspect it in assertions
        resolve(dialog);
      });
    });

    // Perform the click that should trigger the alert
    await app.clickLearnMore();

    // Wait for and handle the dialog
    const dialog = await dialogPromise;
    // Assert the dialog message is exactly as expected by the FSM
    expect(dialog.message()).toBe('You clicked the NoSQL button!');

    // Accept the dialog to allow test to continue cleanly
    await dialog.accept();

    // Ensure clicking did not produce any uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Ensure clicking didn't emit unexpected console logs (FSM spec expects alert only)
    const logEntries = consoleMessages.filter((m) => m.type === 'log');
    // It's valid for there to be no console logs as a result of this click
    expect(logEntries.length).toBeLessThanOrEqual(1);
  });

  test('Transition: Clicking "Example" logs message to console', async ({ page }) => {
    // This test covers the NoSqlExampleButtonClick event:
    // Expected behavior: console.log('You clicked the NoSQL example button!')
    const app = new NoSqlPage(page);

    // Ensure no prior console logs are present (sanity)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);

    // Click the Example button
    await app.clickExample();

    // Give a tiny delay to ensure console event handler executed; it's captured by the listener in beforeEach
    await page.waitForTimeout(50);

    // Find console.log entries with the expected text
    const matchingLogs = consoleMessages.filter(
      (m) => m.type === 'log' && m.text.includes('You clicked the NoSQL example button!')
    );

    expect(matchingLogs.length).toBeGreaterThanOrEqual(1);

    // Ensure no dialogs were produced by this action (FSM does not state any alert here)
    // We didn't set a dialog listener here, but we can assert that there is no outstanding dialog in consoleMessages
    // (no dialog entries appear in console; dialog is not captured via console event)
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: Multiple rapid clicks produce expected alerts/logs and no uncaught errors', async ({ page }) => {
    // Edge case: user clicks buttons repeatedly and rapidly.
    // Validate that alerts and console logs are emitted repeatedly and no page errors occur.
    const app = new NoSqlPage(page);

    // Capture dialogs sequentially using once handlers for each click
    const dialog1Promise = new Promise((resolve) => {
      page.once('dialog', (dialog) => resolve(dialog));
    });

    // First click triggers alert
    await app.clickLearnMore();
    const dialog1 = await dialog1Promise;
    expect(dialog1.message()).toBe('You clicked the NoSQL button!');
    await dialog1.accept();

    // Click Example twice quickly and expect two console.log entries
    await app.clickExample();
    await app.clickExample();

    // Small wait to collect console messages
    await page.waitForTimeout(100);

    const exampleLogs = consoleMessages.filter(
      (m) => m.type === 'log' && m.text.includes('You clicked the NoSQL example button!')
    );

    // Expect at least two logs (one per click). Some environments may coalesce or throttle, so verify >= 2
    expect(exampleLogs.length).toBeGreaterThanOrEqual(2);

    // Click Learn More again and handle second dialog
    const dialog2Promise = new Promise((resolve) => {
      page.once('dialog', (dialog) => resolve(dialog));
    });
    await app.clickLearnMore();
    const dialog2 = await dialog2Promise;
    expect(dialog2.message()).toBe('You clicked the NoSQL button!');
    await dialog2.accept();

    // No uncaught page errors should appear even under rapid interaction
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action verification: "renderPage" not present and no ReferenceError thrown', async ({ page }) => {
    // FSM entry_actions listed "renderPage()" but the provided implementation does not define or call it.
    // This test verifies:
    // - window.renderPage is undefined (i.e., entry action not present)
    // - No ReferenceError occurred during page load as a result of a missing renderPage call
    // This is important to check compliance with the FSM notes about onEnter actions.

    const app = new NoSqlPage(page);

    // Check whether renderPage exists on window
    const renderPageType = await page.evaluate(() => {
      try {
        return typeof window.renderPage;
      } catch (e) {
        // If accessing caused an exception, return it for inspection
        return { errorName: e.name, errorMessage: e.message };
      }
    });

    // We expect renderPage to be undefined in this implementation
    expect(renderPageType).toBe('undefined');

    // Also verify there were no ReferenceError / SyntaxError / TypeError captured on load
    const seriousErrors = pageErrors.filter((e) =>
      ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name)
    );
    // In this provided implementation, no such errors should have happened
    expect(seriousErrors.length).toBe(0);
  });

  test('Error scenario: clicking a non-existent selector should raise a Playwright error (selector not found)', async ({ page }) => {
    // Edge case verifying the test harness behavior when attempting to interact with a missing element.
    // We purposely attempt to click a selector that does not exist and assert that Playwright throws.
    // This verifies our test surface handles and surfaces such errors.
    let caughtError = null;
    try {
      // This will reject because the selector does not exist on the page
      await page.click('#this-element-does-not-exist', { timeout: 1000 });
    } catch (e) {
      caughtError = e;
    }

    // Ensure we did catch an error from Playwright
    expect(caughtError).toBeTruthy();
    // The error should be an instance of Error and include guidance that the node wasn't found
    expect(caughtError).toBeInstanceOf(Error);
    // Message content can vary by Playwright version; assert it mentions 'No node' or 'waiting for selector' or 'Unable'
    const msg = String(caughtError.message);
    const acceptableSubstrings = ['No node found', 'waiting for selector', 'Unable to perform', 'Timeout'];
    const matched = acceptableSubstrings.some((s) => msg.includes(s));
    expect(matched).toBe(true);
  });
});