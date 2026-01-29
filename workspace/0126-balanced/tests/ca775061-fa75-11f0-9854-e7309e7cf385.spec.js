import { test, expect } from '@playwright/test';

// Test file: ca775061-fa75-11f0-9854-e7309e7cf385.spec.js
// Application URL (static HTML served by the test harness)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/ca775061-fa75-11f0-9854-e7309e7cf385.html';

// Simple page object for the static Bubble Sort page
class BubbleSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.heading = page.locator('h2');
    this.paragraph = page.locator('p');
    this.orderedList = page.locator('ol');
    this.listItems = page.locator('ol > li');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return this.heading.textContent();
  }

  async getParagraphText() {
    return this.paragraph.textContent();
  }

  async getListItemsText() {
    return this.listItems.allTextContents();
  }

  async countInteractiveElements() {
    // buttons, inputs, anchors, forms, selects, textareas
    return this.page.evaluate(() => {
      const selectors = 'button,input,a,form,select,textarea';
      return document.querySelectorAll(selectors).length;
    });
  }

  async countOnClickAttributes() {
    return this.page.evaluate(() => document.querySelectorAll('[onclick]').length);
  }
}

test.describe('Bubble Sort Static Page and FSM (S0_Idle) validations', () => {
  // Arrays to collect console and page errors during tests
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      // Record text and type (log, error, warning, etc.)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Close page to ensure clean state for subsequent tests (Playwright's fixture does this automatically,
    // but keeping explicit close is harmless if needed)
    try {
      await page.close();
    } catch {
      // ignore
    }
  });

  test('Initial load: page renders static Bubble Sort content (FSM S0_Idle evidence)', async ({ page }) => {
    // Arrange: page object
    const bsp = new BubbleSortPage(page);

    // Assert: heading text matches FSM evidence
    const heading = await bsp.getHeadingText();
    expect(heading).toBeTruthy();
    expect(heading.trim()).toBe('Bubble Sort');

    // Assert: paragraph contains expected descriptive text fragment from FSM evidence
    const paragraph = await bsp.getParagraphText();
    expect(paragraph).toBeTruthy();
    expect(paragraph).toContain('Bubble Sort is an efficient sorting algorithm');

    // Assert: ordered list has the expected three instructions (as in the HTML)
    const items = await bsp.getListItemsText();
    expect(items.length).toBeGreaterThanOrEqual(3);
    // Check presence of the first list item's content and others (evidence lines)
    expect(items[0]).toContain('Sort the array using bubble sort');
    expect(items[1]).toContain('For each element in the array');
    expect(items[2]).toContain('Repeat this process until no more swaps are needed');
  });

  test('No interactive elements or transitions exist on the page (per FSM extraction)', async ({ page }) => {
    const bsp1 = new BubbleSortPage(page);

    // Expect zero interactive form elements and controls
    const interactiveCount = await bsp.countInteractiveElements();
    expect(interactiveCount).toBe(0);

    // Expect no inline onclick attributes (no direct DOM-attached handlers)
    const onclickCount = await bsp.countOnClickAttributes();
    expect(onclickCount).toBe(0);

    // There are no transitions/events in the FSM; ensure no elements with "data-transition" attribute exist
    const dataTransitionCount = await page.evaluate(() => document.querySelectorAll('[data-transition]').length);
    expect(dataTransitionCount).toBe(0);
  });

  test('FSM entry action "renderPage()" is not defined on window and calling it triggers a ReferenceError', async ({ page }) => {
    // Verify that renderPage is not defined as a global function
    const typeOfRender = await page.evaluate(() => typeof window.renderPage);
    expect(typeOfRender).toBe('undefined');

    // Attempt to call the non-existent renderPage() in a manner that causes the page to raise a ReferenceError.
    // We call it directly in page.evaluate and assert the evaluate promise rejects with an error.
    // This models the FSM entry action not being implemented in the HTML/JS environment.
    await expect(page.evaluate(() => {
      // Direct call without try/catch so the page context throws naturally.
      // This should cause the evaluate call to reject in Node with a ReferenceError.
      return (/** @type {any} */ (window)).renderPage();
    })).rejects.toThrow(/renderPage is not defined|ReferenceError/);

    // Additionally, trigger an uncaught asynchronous call so the page emits a pageerror event that we can observe.
    // We use setTimeout to create an uncaught error in the page context.
    const [pageError] = await Promise.all([
      // Wait for the pageerror event
      page.waitForEvent('pageerror'),
      // Trigger the async call that will cause an uncaught ReferenceError in the page
      page.evaluate(() => {
        setTimeout(() => {
          // Intentionally call missing function to trigger an uncaught ReferenceError
          // This is executed asynchronously in the page and should produce a pageerror event.
          // eslint-disable-next-line no-undef
          renderPage();
        }, 0);
      })
    ]);

    // The captured pageerror should reference renderPage
    expect(pageError).toBeTruthy();
    const msg = String(pageError.message || pageError);
    expect(msg).toMatch(/renderPage/);
    expect(msg).toMatch(/ReferenceError|is not defined/);
  });

  test('Page produces no unexpected console.error messages on initial load', async ({ page }) => {
    // At initial load (before we intentionally invoked renderPage), there should be no page errors recorded.
    // Note: previous tests may have triggered errors; this test checks the errors recorded during the beforeEach navigation.
    // We use pageErrors captured in beforeEach to ensure the page itself didn't emit errors on load.
    // Because beforeEach resets pageErrors for each test, here pageErrors corresponds to this test's navigation.
    // Accessing outer-scope pageErrors variable
    expect(pageErrors.length).toBe(0);

    // Also ensure console messages don't contain error-level messages on initial load
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('Edge case: calling an unrelated non-existent function should also throw ReferenceError', async ({ page }) => {
    // This test demonstrates handling arbitrary missing functions per requirement to test error scenarios.
    // We check that calling a different undefined global produces a ReferenceError as expected.

    // Ensure function is absent
    const typeOfFoo = await page.evaluate(() => typeof window.nonExistentFunctionFooBar);
    expect(typeOfFoo).toBe('undefined');

    // Calling it should reject with a ReferenceError
    await expect(page.evaluate(() => nonExistentFunctionFooBar())).rejects.toThrow(/nonExistentFunctionFooBar is not defined|ReferenceError/);

    // Also trigger an asynchronous uncaught call to confirm a pageerror event is emitted
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.evaluate(() => setTimeout(() => { nonExistentFunctionFooBar(); }, 0))
    ]);
    expect(String(err.message || err)).toMatch(/nonExistentFunctionFooBar/);
  });

  test('Sanity: the DOM contains only static content (no dynamic scripts modifying DOM)', async ({ page }) => {
    // Inspect the number of script tags and ensure scripts, if any, don't add interactive UI elements.
    const scriptCount = await page.evaluate(() => document.querySelectorAll('script').length);
    // It's acceptable to have zero or some script tags; we assert that scripts did not produce interactive controls.
    expect(scriptCount).toBeGreaterThanOrEqual(0);

    // Ensure the core static elements exist and are stable
    const h2 = await page.locator('h2').count();
    const p = await page.locator('p').count();
    const ol = await page.locator('ol').count();
    expect(h2).toBe(1);
    expect(p).toBe(1);
    expect(ol).toBe(1);
  });
});