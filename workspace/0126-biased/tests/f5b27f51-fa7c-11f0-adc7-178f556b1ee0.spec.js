import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b27f51-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Paging Example page
class PagingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#paging-button';
    this.exampleSelector = '#paging-example';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getButton() {
    return this.page.locator(this.buttonSelector);
  }

  async getExample() {
    return this.page.locator(this.exampleSelector);
  }

  async clickExploreButton() {
    await this.page.click(this.buttonSelector);
  }

  // Returns the inline style attribute string (may be null)
  async exampleStyleAttribute() {
    return this.page.getAttribute(this.exampleSelector, 'style');
  }

  // Returns the computed display property ('none' or 'block')
  async exampleDisplayComputed() {
    return this.page.$eval(this.exampleSelector, el => getComputedStyle(el).display);
  }

  // Returns text content of the example container
  async exampleText() {
    return this.page.$eval(this.exampleSelector, el => el.innerText);
  }

  // Check whether a global function exists on window
  async hasGlobalFunction(name) {
    return this.page.evaluate((n) => typeof window[n] === 'function', name);
  }
}

test.describe('Paging FSM - Application f5b27f51-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages; we will inspect types and texts in tests
    page.on('console', (msg) => {
      // store an object with type and text for easier assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled/page errors that bubble to the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Initial state S0_Idle: button is present and example is hidden (entry rendering)', async ({ page }) => {
    // This test validates the initial FSM state S0_Idle:
    // - The "Explore Paging in Action" button exists and is visible.
    // - The paging example container is present but hidden (display: none).
    // - There are no uncaught page errors or console errors on initial load.
    const paging = new PagingPage(page);
    await paging.goto();

    // Ensure the button is attached to DOM and visible
    const button = await paging.getButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Explore Paging in Action');

    // The example container exists
    const example = await paging.getExample();
    await expect(example).toBeAttached();

    // Inline style attribute should indicate it starts hidden per the HTML (display: none;)
    const styleAttr = await paging.exampleStyleAttribute();
    // The HTML explicitly sets style="display: none;"
    expect(styleAttr).toBeTruthy();
    expect(styleAttr).toContain('display: none');

    // The computed display should be 'none'
    const computed = await paging.exampleDisplayComputed();
    expect(computed).toBe('none');

    // The FSM's S0 entry action mentions renderPage(); check that no global function renderPage exists.
    // Note: We do not call or inject anything; we only assert presence/absence.
    const hasRender = await paging.hasGlobalFunction('renderPage');
    expect(hasRender).toBe(false);

    // Assert there were no uncaught page errors or console errors on initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Transition ExplorePaging: clicking the button shows the example (S0 -> S1)', async ({ page }) => {
    // This test validates the transition defined by the FSM:
    // - User clicks #paging-button (ExplorePaging event)
    // - Expected observable: #paging-example[style="display: block;"] (i.e., becomes visible)
    // - Also verifies S1 entry action (pagingExample.style.display = 'block') manifested as computed style
    const paging = new PagingPage(page);
    await paging.goto();

    // Click the button to trigger the transition
    await paging.clickExploreButton();

    // Wait for the element's computed style to become 'block'
    await page.waitForFunction(
      selector => getComputedStyle(document.querySelector(selector)).display === 'block',
      paging.exampleSelector
    );

    // Assert inline style attribute is updated to include display: block;
    const styleAttr = await paging.exampleStyleAttribute();
    expect(styleAttr).toBeTruthy();
    // The implementation sets pagingExample.style.display = 'block', so attribute may be "display: block;"
    expect(styleAttr.replace(/\s+/g, '')).toContain('display:block;');

    // Assert computed style is 'block'
    const computed = await paging.exampleDisplayComputed();
    expect(computed).toBe('block');

    // Verify content exists after showing
    const text = await paging.exampleText();
    expect(text).toContain('Paging Example');
    expect(text).toContain('This is an example of how paging works in action.');

    // Ensure the click did not cause unhandled errors nor console errors of type error
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Edge cases: clicking the button multiple times and idempotency', async ({ page }) => {
    // This test checks robustness for repeated user interactions:
    // - Clicking the Explore Paging button multiple times should not throw or produce unexpected side effects.
    // - The example should remain visible and style should remain 'block'.
    const paging = new PagingPage(page);
    await paging.goto();

    // First click
    await paging.clickExploreButton();
    await page.waitForFunction(
      selector => getComputedStyle(document.querySelector(selector)).display === 'block',
      paging.exampleSelector
    );

    // Second click (when already visible) - should be idempotent in current app (simply set style to block again)
    await paging.clickExploreButton();

    // Wait briefly to allow any potential handlers to run
    await page.waitForTimeout(100);

    // Confirm it is still visible and computed style remains 'block'
    const computedAfter = await paging.exampleDisplayComputed();
    expect(computedAfter).toBe('block');

    // Confirm inline style attribute still indicates display:block
    const styleAfter = await paging.exampleStyleAttribute();
    expect(styleAfter.replace(/\s+/g, '')).toContain('display:block;');

    // No unhandled errors produced by repeated interaction
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Content and accessibility checks of the example container once visible', async ({ page }) => {
    // This test ensures that when S1_ExampleVisible is entered:
    // - The example element contains expected headings and paragraphs
    // - The element is reachable via the selector in the FSM evidence
    const paging = new PagingPage(page);
    await paging.goto();

    await paging.clickExploreButton();
    await page.waitForFunction(
      selector => getComputedStyle(document.querySelector(selector)).display === 'block',
      paging.exampleSelector
    );

    // Ensure heading exists
    const headingText = await page.$eval('#paging-example h2', el => el.textContent.trim());
    expect(headingText).toBe('Paging Example');

    // Ensure at least one of the expected paragraphs is present
    const paragraphs = await page.$$eval('#paging-example p', nodes => nodes.map(n => n.textContent.trim()));
    expect(paragraphs.length).toBeGreaterThanOrEqual(1);
    expect(paragraphs.join(' ')).toContain('This is an example of how paging works in action.');

    // The FSM expected observable is the inline style; verify attribute exactly equals or contains display: block
    const attr = await paging.exampleStyleAttribute();
    expect(attr).toBeTruthy();
    expect(attr.replace(/\s+/g, '')).toContain('display:block;');

    // No console errors and no page errors after normal content checks
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Observability test: capture console output and page errors across navigation and interactions', async ({ page }) => {
    // This test demonstrates collecting console messages and page errors across flows.
    // It asserts that there are no ReferenceError / TypeError / SyntaxError instances emitted from the page.
    const paging = new PagingPage(page);
    await paging.goto();

    // Interact normally
    await paging.clickExploreButton();
    await page.waitForFunction(
      selector => getComputedStyle(document.querySelector(selector)).display === 'block',
      paging.exampleSelector
    );

    // Inspect captured pageErrors for specific error types
    const errorTypes = pageErrors.map(e => (e && e.name) || 'UnknownError');
    // We expect the provided HTML/JS to be valid and not produce ReferenceError/SyntaxError/TypeError
    // Assert that none of those error types occurred
    const forbidden = ['ReferenceError', 'SyntaxError', 'TypeError'];
    for (const t of forbidden) {
      expect(errorTypes).not.toContain(t);
    }

    // Inspect console messages for textual indicators of serious errors
    const severeConsoleTexts = consoleMessages.filter(m =>
      m.type === 'error' ||
      /ReferenceError|TypeError|SyntaxError|Unhandled/i.test(m.text)
    );
    expect(severeConsoleTexts).toEqual([]);
  });
});