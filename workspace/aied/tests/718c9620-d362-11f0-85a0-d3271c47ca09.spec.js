import { test, expect } from '@playwright/test';

// URL of the static HTML to test
const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/718c9620-d362-11f0-85a0-d3271c47ca09.html';

// Page Object to encapsulate selectors and common checks for the Two Pointers page
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Selectors
  h1() { return this.page.locator('h1'); }
  paragraph() { return this.page.locator('p'); }
  image() { return this.page.locator('img[alt="Two Pointers"]'); }

  // Returns a list of common interactive elements present on the page
  async interactiveElementsCount() {
    // Buttons, inputs, selects, textareas, anchors with href, and any element with role="button"
    const selectors = [
      'button',
      'input',
      'select',
      'textarea',
      'a[href]',
      '[role="button"]',
      '[tabindex]:not([tabindex="-1"])'
    ];
    let total = 0;
    for (const sel of selectors) {
      total += await this.page.locator(sel).count();
    }
    return total;
  }

  // Check if any inline onclick attributes exist (simple heuristic)
  async inlineOnClickCount() {
    return await this.page.locator('[onclick]').count();
  }

  // Returns the evaluated value of window.renderPage (if any)
  async renderPageType() {
    return await this.page.evaluate(() => {
      // Accessing a property is allowed. We do not define anything.
      return typeof window.renderPage;
    });
  }

  // Return whether the image has loaded (naturalWidth > 0)
  async imageLoaded() {
    return await this.page.evaluate(() => {
      const img = document.querySelector('img[alt="Two Pointers"]');
      if (!img) return null;
      return {
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt')
      };
    });
  }
}

test.describe('Two Pointers static page and FSM validation (S0_Idle)', () => {
  // Arrays to capture console messages and page errors during each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset capture arrays
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events so we can assert on them later
    page.on('console', msg => {
      // Capture all console messages with their type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen to page errors (unhandled exceptions)
    page.on('pageerror', error => {
      // Capture the Error object (message + stack)
      pageErrors.push(error);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // detach listeners (Playwright will generally clean up, but keep explicit)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial render should match S0_Idle evidence: h1, paragraph, and image are present', async ({ page }) => {
    // Arrange
    const twoPointers = new TwoPointersPage(page);

    // Assert H1 text equals expected evidence
    await expect(twoPointers.h1()).toHaveCount(1);
    await expect(twoPointers.h1()).toHaveText('Two Pointers');

    // Assert paragraph text matches the FSM evidence
    await expect(twoPointers.paragraph()).toHaveCount(1);
    await expect(twoPointers.paragraph()).toHaveText('Two pointers are two small, round pieces of metal that are usually used to represent the center of a triangle.');

    // Assert image element exists with the expected alt text and src contains the image filename
    await expect(twoPointers.image()).toHaveCount(1);
    const imgMeta = await twoPointers.imageLoaded();
    // Check alt and src attributes
    expect(imgMeta.alt).toBe('Two Pointers');
    expect(imgMeta.src).toEqual(expect.stringContaining('two-pointers.jpg'));

    // Image load state: the image might or might not have loaded depending on server assets.
    // We assert that the element exists, and report on its load state.
    // naturalWidth may be 0 if resource missing; ensure the DOM element is present.
    expect(typeof imgMeta.complete).toBe('boolean');
    expect(typeof imgMeta.naturalWidth).toBe('number');
  });

  test('FSM onEnter entry action "renderPage()" is not defined in the runtime (verify expected missing action)', async ({ page }) => {
    // Arrange
    const twoPointers = new TwoPointersPage(page);

    // The FSM lists an entry action "renderPage()". The HTML page has no scripts defining renderPage.
    // Verify that renderPage is not defined on the window (i.e., typeof === "undefined").
    const typeOfRenderPage = await twoPointers.renderPageType();
    expect(typeOfRenderPage).toBe('undefined');
  });

  test('No interactive elements or transitions exist on the page (as per extraction notes)', async ({ page }) => {
    // Arrange
    const twoPointers = new TwoPointersPage(page);

    // There should be no interactive elements (buttons/inputs/anchors) as per the FSM extraction notes
    const interactiveCount = await twoPointers.interactiveElementsCount();
    expect(interactiveCount).toBe(0);

    // No inline onclick attributes should be present
    const onclickCount = await twoPointers.inlineOnClickCount();
    expect(onclickCount).toBe(0);
  });

  test('Console and page errors observation: ensure no unexpected runtime errors occurred during load', async ({ page }) => {
    // At this point, consoleMessages and pageErrors have been collected during navigation.
    // This test validates there were no uncaught exceptions or console.error messages.

    // Filter console messages for error types
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');

    // Assert there are no page errors (unhandled exceptions)
    // If the page contained SyntaxError/ReferenceError/etc. they would be captured here.
    expect(pageErrors.length).toBe(0);

    // Assert there are no console errors/warnings reported during load
    expect(consoleErrors.length).toBe(0);

    // For transparency in test output, attach details when present (these expectations will fail the test if non-empty)
    if (consoleErrors.length > 0) {
      // Log the first few console errors for debugging (this will only run if the assertion above fails and the test runner prints the following)
      for (const err of consoleErrors.slice(0, 5)) {
        // No side effects: just ensure we can inspect them in test traces
        console.log('Console Error Observed:', err);
      }
    }
    if (pageErrors.length > 0) {
      for (const err of pageErrors.slice(0, 5)) {
        console.log('Page Error Observed:', err.message);
      }
    }
  });

  test('Edge case: verify that there are no scripts or event handlers present in the DOM (no interactivity)', async ({ page }) => {
    // Verify that there are no <script> tags (the page is static HTML without JS)
    const scriptCount = await page.locator('script').count();
    expect(scriptCount).toBe(0);

    // Verify that no elements have data-event or similar attributes typically used for handlers (heuristic)
    const handlerAttrCount = await page.locator('[data-event], [data-onclick], [data-handler]').count();
    expect(handlerAttrCount).toBe(0);
  });

  test('FSM coverage: confirm S0_Idle evidence is the active representation (no transitions to test)', async ({ page }) => {
    // The FSM only contains one initial state S0_Idle with static evidence.
    // This test asserts that the page DOM contains exactly the pieces of evidence described.
    const twoPointers = new TwoPointersPage(page);

    // Evidence check: H1 exists
    await expect(twoPointers.h1()).toHaveCount(1);
    // Evidence check: paragraph exists
    await expect(twoPointers.paragraph()).toHaveCount(1);
    // Evidence check: image exists
    await expect(twoPointers.image()).toHaveCount(1);

    // Since FSM defines no transitions, verify that there are no clickable elements that would cause transitions
    const interactiveCount = await twoPointers.interactiveElementsCount();
    expect(interactiveCount).toBe(0);
  });
});