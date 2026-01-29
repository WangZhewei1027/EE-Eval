import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/ca7a0f80-fa75-11f0-9854-e7309e7cf385.html';

/**
 * Page object model for the Time Complexity static page.
 * Encapsulates common locators and helpers so tests remain readable.
 */
class TimeComplexityPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.header = page.locator('h1');
    this.paragraphs = page.locator('p');
    this.listItems = page.locator('ul li');
    this.buttons = page.locator('button');
    this.inputs = page.locator('input');
    this.links = page.locator('a');
    this.onclickElements = page.locator('[onclick]');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getAllParagraphTexts() {
    return this.paragraphs.allTextContents();
  }
}

test.describe('Time Complexity static page and FSM validation (S0_Idle)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors emitted during navigation.
    pageErrors = [];
    consoleMessages = [];

    page.on('console', (msg) => {
      // collect console messages as strings
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
    });

    page.on('pageerror', (err) => {
      // collect page errors
      pageErrors.push(err.message ?? String(err));
    });
  });

  test('renders static content expected for S0_Idle (entry evidence)', async ({ page }) => {
    // Validate static rendering: header and paragraphs that represent FSM evidence
    const model = new TimeComplexityPage(page);
    await model.goto();

    // Header should match FSM evidence
    await expect(model.header).toHaveText('Time Complexity');

    // The page should contain the introductory paragraph described in the FSM evidence.
    const firstParagraph = model.paragraphs.nth(0);
    await expect(firstParagraph).toContainText('The time complexity of an algorithm depends on how many operations it performs during execution');

    // Check for the example steps in the unordered list
    await expect(model.listItems.nth(0)).toHaveText('Divide two numbers');
    await expect(model.listItems.nth(1)).toHaveText('Add the results together');
    await expect(model.listItems.nth(2)).toHaveText('Print the result');

    // Verify presence of several specific sample outputs and complexity statements that exist in the HTML.
    // These assertions verify specific evidence strings repeated in the implementation.
    await expect(page.locator('text=The time complexity of this algorithm is O(4^2).')).toBeVisible();
    await expect(page.locator('text=16')).toBeVisible();
    await expect(page.locator('text=The time complexity of this algorithm is O(n log n).')).toBeVisible();
    await expect(page.locator('text=11128')).toBeVisible();
  });

  test('contains no interactive elements (as extracted by FSM)', async ({ page }) => {
    // This test asserts the extracted FSM claim: no buttons, inputs, or links were detected.
    const model = new TimeComplexityPage(page);
    await model.goto();

    // No interactive controls expected
    await expect(model.buttons).toHaveCount(0);
    await expect(model.inputs).toHaveCount(0);
    await expect(model.links).toHaveCount(0);

    // No inline onclick attributes expected
    await expect(model.onclickElements).toHaveCount(0);
  });

  test('verifies entry action "renderPage" is not implemented in the loaded page', async ({ page }) => {
    // FSM S0_Idle entry_actions lists renderPage(). The implementation does not define that function.
    // We assert that window.renderPage is undefined (i.e., not implemented).
    await page.goto(APP_URL);

    const typeOfRenderPage = await page.evaluate(() => typeof window.renderPage);
    // Expect that the function is not present (implementation lacks renderPage)
    expect(typeOfRenderPage).toBe('undefined');
  });

  test('observes console and page errors and validates their nature (if any)', async ({ page }) => {
    // This test collects console and page errors that occurred during navigation and asserts expectations:
    // - If errors occurred, at least one should be a common JS runtime error (ReferenceError/TypeError/SyntaxError).
    // - If no errors occurred, we assert that the arrays are empty (i.e., page loaded cleanly).
    await page.goto(APP_URL);

    // Allow a tick for any async console/page errors to be delivered
    await page.waitForTimeout(100);

    // Consolidate captured messages
    const consoleErrors = consoleMessages.filter(msg => /error|exception|ReferenceError|TypeError|SyntaxError/i.test(msg));
    const pageErrorsSnapshot = [...pageErrors];

    // If there are any messages, ensure they are runtime JS errors of expected classes.
    if (consoleErrors.length > 0 || pageErrorsSnapshot.length > 0) {
      const combined = [...consoleErrors, ...pageErrorsSnapshot].join('\n');
      // At least one of the combined messages should reference ReferenceError, TypeError, or SyntaxError.
      const hasExpectedError = /ReferenceError|TypeError|SyntaxError/i.test(combined);
      expect(hasExpectedError).toBe(true);
    } else {
      // No runtime errors observed during navigation; record that the page loaded without JS runtime issues.
      expect(consoleErrors.length).toBe(0);
      expect(pageErrorsSnapshot.length).toBe(0);
    }
  });

  test('edge case: page contains a large number of paragraph nodes (content repetition)', async ({ page }) => {
    // The HTML contains many repeated <p> lines. This test asserts that the page contains a large number of paragraph elements,
    // verifying that the renderer included the expected repeated content (and that the page did not truncate it).
    const model = new TimeComplexityPage(page);
    await model.goto();

    const paragraphCount = await model.paragraphs.count();

    // The provided HTML repeats content many times; assert that there are at least 50 <p> elements as an edge-case threshold.
    // This threshold confirms that the content bulk was loaded.
    expect(paragraphCount).toBeGreaterThanOrEqual(50);
  });

  test('FSM transitions and events: none expected in this implementation', async ({ page }) => {
    // The FSM describes no events or transitions. Verify that the implementation exposes no obvious interactive triggers.
    await page.goto(APP_URL);

    // There are no event handlers or interactive widgets discovered in the extraction summary.
    // Sanity check: ensure no elements with event-like attributes exist (onmouseover, onkeydown, oninput, etc.)
    const eventAttributes = [
      '[onclick]', '[onmouseover]', '[onmouseout]', '[onchange]', '[oninput]',
      '[onkeydown]', '[onkeyup]', '[onsubmit]', '[onfocus]', '[onblur]'
    ];
    for (const attr of eventAttributes) {
      const el = page.locator(attr);
      await expect(el).toHaveCount(0);
    }

    // Also ensure no <script> tags that might dynamically attach events are present in the DOM (per the extraction notes).
    const scripts = await page.locator('script').count();
    expect(scripts).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Final sanity: capture the console and page error state one last time and attach to test failure details if helpful.
    // (No modification of the page or environment is performed.)
    // Small pause to flush any pending console/pageerror events.
    await page.waitForTimeout(50);
  });
});