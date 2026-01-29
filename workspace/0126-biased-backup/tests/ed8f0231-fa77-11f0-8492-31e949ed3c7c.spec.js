import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f0231-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object Model for the Indexing Visualization page
class IndexingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = '#container';
    this.title = 'h1';
    this.description = 'p';
    this.indexingBoxes = '.indexing-box';
    // Use the exact attribute selector as present in the DOM (matches FSM)
    this.learnMoreButton = `button[onclick="alert('Embrace the elegance of indexing!')"]`;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async isVisible(selector) {
    return await this.page.isVisible(selector);
  }

  async getTitleText() {
    return await this.page.textContent(this.title);
  }

  async getDescriptionText() {
    return await this.page.textContent(this.description);
  }

  async getIndexingBoxCount() {
    return await this.page.locator(this.indexingBoxes).count();
  }

  async clickLearnMore() {
    await this.page.click(this.learnMoreButton);
  }
}

test.describe('Indexing Visualization - FSM: S0_Idle and ButtonClick', () => {
  // Collections to observe runtime issues and console activity
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize capture arrays before each test
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture unhandled page errors (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async ({ page }) => {
    // Provide some debugging output in case of test failures (Playwright will show this).
    // No modifications or fixes to the page are performed here.
    if (pageErrors.length > 0) {
      // Log the errors to help diagnose if any occurred during the test run.
      console.error('Page errors captured:', pageErrors.map(e => e.message));
    }
    if (consoleMessages.length > 0) {
      console.info('Console messages captured:', consoleMessages);
    }
  });

  test('Initial render (Idle state): page loads and renders expected elements', async ({ page }) => {
    // This test validates the FSM initial state S0_Idle:
    // - renderPage() is expected as entry action (we validate that core elements exist)
    // - the Learn More button (with the exact onclick attribute) is present
    // - the 3x3 indexing visual grid is rendered (9 boxes)
    const indexing = new IndexingPage(page);
    await indexing.goto();

    // Ensure main container and title are visible
    await expect(page.locator(indexing.container)).toBeVisible();

    // Validate title text
    const titleText = await indexing.getTitleText();
    expect(titleText).toBe('Indexing');

    // Validate description contains expected keyword
    const desc = await indexing.getDescriptionText();
    expect(desc.toLowerCase()).toContain('indexing');

    // Validate the 3x3 grid of indexing boxes is rendered with 9 items
    const boxCount = await indexing.getIndexingBoxCount();
    expect(boxCount).toBe(9);

    // Validate the Learn More button exists with the exact onclick attribute
    const buttonLocator = page.locator(indexing.learnMoreButton);
    await expect(buttonLocator).toBeVisible();
    await expect(buttonLocator).toHaveText('Learn More');

    // Assert that no runtime page errors occurred during initial render.
    // The application is minimal and should not produce ReferenceError/SyntaxError/TypeError.
    expect(pageErrors.length, 'Expected no page errors on initial render').toBe(0);

    // Also assert there are no console.error messages emitted during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'Expected no console.error messages on initial render').toBe(0);
  });

  test('ButtonClick transition: clicking Learn More shows alert with expected message', async ({ page }) => {
    // This test validates the FSM transition triggered by ButtonClick:
    // - clicking the button should invoke alert('Embrace the elegance of indexing!')
    // - we capture the dialog and assert its message
    const indexing = new IndexingPage(page);
    await indexing.goto();

    // Prepare to capture the dialog; assert message equals expected text
    let dialogSeen = false;
    page.once('dialog', async (dialog) => {
      dialogSeen = true;
      expect(dialog.message()).toBe('Embrace the elegance of indexing!');
      await dialog.accept();
    });

    // Trigger the event by clicking the button
    await indexing.clickLearnMore();

    // Give a small moment for the dialog event handler to run
    // (Playwright's dialog handler above will be called synchronously with click)
    expect(dialogSeen, 'Expected alert dialog to be shown and handled').toBe(true);

    // Verify that no page errors appeared as a result of the click
    expect(pageErrors.length, 'Expected no page errors after clicking Learn More').toBe(0);

    // Verify no console.error messages emitted as a result of the click
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'Expected no console.error after clicking Learn More').toBe(0);
  });

  test('Repeated ButtonClick: multiple clicks produce multiple alerts (edge case)', async ({ page }) => {
    // Validate that repeated invocations of the transition behave consistently.
    // We will click the button 3 times and ensure each produces an alert with the expected message.
    const indexing = new IndexingPage(page);
    await indexing.goto();

    let dialogCount = 0;
    page.on('dialog', async (dialog) => {
      dialogCount += 1;
      // All dialogs should carry the same message
      expect(dialog.message()).toBe('Embrace the elegance of indexing!');
      await dialog.accept();
    });

    // Click the button multiple times
    await indexing.clickLearnMore();
    await indexing.clickLearnMore();
    await indexing.clickLearnMore();

    // Allow some time for dialogs to be processed (should be immediate)
    expect(dialogCount, 'Expected three alert dialogs after three clicks').toBe(3);

    // Ensure no page errors resulted from repeated interactions
    expect(pageErrors.length, 'Expected no page errors after repeated clicks').toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'Expected no console.error after repeated clicks').toBe(0);
  });

  test('Edge case: attempting to click a non-existent selector throws an error', async ({ page }) => {
    // This test intentionally triggers a failure scenario by trying to click an element
    // that does not exist on the page. We assert that Playwright throws an error
    // (natural behavior) and we do not patch or modify the page to make it exist.
    const indexing = new IndexingPage(page);
    await indexing.goto();

    // Attempt to click a selector that does not exist. Playwright will throw a timeout error.
    // We assert that an error is thrown (natural error scenario) and inspect its type/message.
    const nonexistentSelector = '#this-element-does-not-exist';

    // Use expect(...).rejects to assert that the promise rejects
    await expect(page.click(nonexistentSelector, { timeout: 1000 })).rejects.toThrow();

    // Confirm that no unexpected page runtime errors (ReferenceError/SyntaxError/TypeError) were produced
    // as a direct result of attempting the invalid click (the failure is from Playwright's action, not the page runtime).
    expect(pageErrors.length, 'Expected no JS runtime page errors due to clicking a non-existent element').toBe(0);
  });

  test('Observability: capture console messages and page errors when loading the page', async ({ page }) => {
    // This test focuses on observability:
    // - we load the page and assert the arrays capturing console and page errors behave as expected
    // - we assert that there are no unexpected runtime exceptions introduced by the page itself
    const indexing = new IndexingPage(page);
    await indexing.goto();

    // At minimum the page should have produced zero serious runtime errors; assert that.
    expect(pageErrors.length, 'No page errors should be present on a correct minimal page load').toBe(0);

    // Check the console messages: there may be none, or informational logs. We assert there are no console.error types.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'Console should not contain error-level messages on load').toBe(0);

    // Additionally, verify that expected informational elements were rendered and thus the page executed its render flow.
    await expect(page.locator(indexing.learnMoreButton)).toBeVisible();
    const boxes = await indexing.getIndexingBoxCount();
    expect(boxes).toBe(9);
  });
});