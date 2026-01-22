import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/batch-1207/html/0e14c080-d5c5-11f0-92ee-f5994b4f4c99.html';

// Page object for the simple Hash Map example page
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.header = page.locator('h1');
    this.paragraph = page.locator('p');
  }

  async goto() {
    // Wait for full load so inline script executes (or throws) naturally
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }
}

test.describe('Hash Map Example - FSM (Idle state) validations', () => {
  // Basic smoke test: page renders the expected static content from the FSM entry evidence.
  test('renders header and explanatory paragraph (Idle state evidence)', async ({ page }) => {
    // Arrange
    const hp = new HashMapPage(page);

    // Act
    await hp.goto();

    // Assert: header exists and has the expected text
    await expect(hp.header).toHaveCount(1);
    await expect(hp.header).toHaveText('Hash Map Example');

    // Assert: paragraph exists and contains expected explanatory text
    await expect(hp.paragraph).toHaveCount(1);
    await expect(hp.paragraph).toContainText(
      "Here's an example of how to use a hash map:"
    );
  });

  // Verify that there are no interactive elements (matches FSM: no events/transitions)
  test('contains no interactive elements (no events / no transitions)', async ({ page }) => {
    // Arrange
    const hp = new HashMapPage(page);

    // Act
    await hp.goto();

    // Assert: No typical interactive form controls or buttons present
    const interactiveSelector = 'button, input, select, textarea, [role="button"]';
    const interactiveCount = await page.locator(interactiveSelector).count();
    expect(interactiveCount).toBe(0);

    // Also assert there are no anchors with href (no navigation elements)
    const anchorsWithHref = await page.locator('a[href]').count();
    expect(anchorsWithHref).toBe(0);
  });

  // Capture console logs and page errors to assert the runtime behavior of the inline script.
  test('logs expected values and naturally throws a TypeError from map.pop (observe console and page errors)', async ({ page }) => {
    // Collect console messages and page errors for assertions
    const consoleMessages = [];
    page.on('console', (msg) => {
      // Capture both type and text for richer assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    const pageErrors = [];
    page.on('pageerror', (err) => {
      // pageerror receives an Error object
      pageErrors.push(err);
    });

    // Navigate to the page (inline script will execute automatically)
    const hp = new HashMapPage(page);
    await hp.goto();

    // Wait a short while to ensure console/pageerror events have been emitted
    // (script runs on load; this ensures we capture async event deliveries)
    await page.waitForTimeout(250);

    // --- Assertions about console output from inline script ---

    // Expect at least one console message contains the initially logged value 'value1'
    const loggedValue1 = consoleMessages.some((m) =>
      m.text.includes('value1')
    );
    expect(loggedValue1).toBeTruthy();

    // The inline script attempts to log the full map after updating 'b' => should appear as some object/log
    const loggedMap = consoleMessages.some((m) =>
      /value1/.test(m.text) && /new_value|value2|value3/.test(m.text)
    );
    // It's acceptable if the object serialization differs; just check that we have multiple log entries including the updated value
    expect(loggedMap).toBeTruthy();

    // The inline script uses map.pop('b') which is not a function on plain objects.
    // We expect a page-level error (TypeError) to have been thrown naturally.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const hasPopTypeError = pageErrors.some((err) =>
      /pop is not a function/i.test(err.message)
    );
    expect(hasPopTypeError).toBeTruthy();

    // Because the TypeError occurs, subsequent script lines should not execute.
    // In particular, the later console log writing 'value4' should NOT appear.
    const loggedValue4 = consoleMessages.some((m) =>
      m.text.includes('value4')
    );
    expect(loggedValue4).toBeFalsy();

    // The page references an external script URL that contains a whitespace in the URL:
    // we expect the resource load to fail or at least a console message referencing 'hashing' or 'hashing.min.js'
    // This check is tolerant of message differences across browser engines.
    const hasHashingResourceMessage = consoleMessages.some((m) =>
      /hashing|hashing\.min\.js|failed to load/i.test(m.text)
    );
    // It's acceptable if the browser reports the failure differently; we assert at least that either a failed resource or error was reported.
    expect(hasHashingResourceMessage).toBeTruthy();
  });

  // Edge case: reload the page and confirm the same error scenario repeats and that the page still renders static content.
  test('reloading the page reproduces the TypeError and preserves static DOM evidence', async ({ page }) => {
    // Collect page errors and console messages across reload
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    const hp = new HashMapPage(page);
    await hp.goto();

    // Ensure initial assertions: header present
    await expect(hp.header).toHaveText('Hash Map Example');

    // Reload and wait for load to let scripts run again
    await page.reload({ waitUntil: 'load' });

    // Small pause to allow events to be delivered
    await page.waitForTimeout(250);

    // Expect at least one TypeError again after reload
    const hasPopTypeError = pageErrors.some((err) =>
      /pop is not a function/i.test(err.message)
    );
    expect(hasPopTypeError).toBeTruthy();

    // After reload the header and paragraph should still be present (entry evidence is rendered in DOM)
    await expect(hp.header).toHaveCount(1);
    await expect(hp.paragraph).toContainText("Here's an example of how to use a hash map:");
  });

  // Verify that no helper function named renderPage was injected/executed on window,
  // but the FSM "entry evidence" is present in DOM (renderPage isn't required for the evidence to appear).
  test('renderPage() entry action is not defined globally but FSM evidence exists', async ({ page }) => {
    const hp = new HashMapPage(page);
    await hp.goto();

    // Check DOM evidence present (again)
    await expect(hp.header).toHaveText('Hash Map Example');
    await expect(hp.paragraph).toContainText("Here's an example of how to use a hash map:");

    // Do NOT attempt to define or patch renderPage; only observe whether it exists
    // If it does not exist, that's an acceptable observation of the current implementation.
    const renderPageExists = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(renderPageExists).toBeFalsy();
  });
});