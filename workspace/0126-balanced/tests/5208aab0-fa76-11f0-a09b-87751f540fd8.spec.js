import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5208aab0-fa76-11f0-a09b-87751f540fd8.html';

// Page object for the suffix tree page
class SuffixTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = page.locator(`button[onclick="generateSuffixTree('word', 'word')"]`);
    this.tree = page.locator('#tree');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async getTreeInnerHTML() {
    return await this.tree.evaluate((el) => el.innerHTML);
  }

  async countHeaderSpans() {
    return await this.tree.locator('span.header').count();
  }

  async hasNestedTreeElement() {
    // Check for nested element with id="tree" inside the outer #tree
    return await this.tree.locator('#tree').count() > 0;
  }

  async hasRenderPageFunction() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }

  async hasGenerateSuffixTreeFunction() {
    return await this.page.evaluate(() => typeof window.generateSuffixTree === 'function');
  }

  async callGenerateSuffixTree(word, suffix) {
    return await this.page.evaluate(
      (w, s) => {
        try {
          // Call the function as-is and return its result
          // Let any runtime exceptions bubble up naturally
          return window.generateSuffixTree(w, s);
        } catch (e) {
          // Return a serializable representation of the thrown error
          return { __thrown: true, name: e.name, message: e.message };
        }
      },
      word,
      suffix
    );
  }
}

test.describe('Suffix Tree FSM - Full E2E validations', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors (and other console messages for debugging)
    page.on('console', (msg) => {
      // store console errors for assertions
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
      // You can also log other console types if needed during debugging
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('S0_Idle: Initial page render - button exists and tree container present', async ({ page }) => {
    // This test validates the initial (Idle) state:
    // - The "Generate Suffix Tree" button is present with the exact onclick attribute.
    // - The tree container (#tree) is present in the DOM.
    // - The renderPage entry action mentioned in the FSM is NOT present in the runtime (we assert its absence).
    // - No console errors or page errors occurred during page load.

    const app = new SuffixTreePage(page);
    await app.goto();

    // Button should be visible and match the onclick attribute from the FSM
    await expect(app.generateBtn).toBeVisible();
    const attr = await app.generateBtn.getAttribute('onclick');
    expect(attr).toBe("generateSuffixTree('word', 'word')");

    // Tree container should exist
    await expect(app.tree).toBeVisible();

    // As the FSM declared an entry action renderPage(), verify whether that function exists.
    // The implementation did not define renderPage(), so we expect it to be undefined.
    const hasRenderPage = await app.hasRenderPageFunction();
    expect(hasRenderPage).toBe(false);

    // The page should define generateSuffixTree function
    const hasGenerateFunction = await app.hasGenerateSuffixTreeFunction();
    expect(hasGenerateFunction).toBe(true);

    // Capture any synchronous page errors or console errors that may have fired during load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S1_TreeGenerated: Suffix tree is present in DOM after initial script execution and remains after clicking button', async ({ page }) => {
    // This test validates the "Tree Generated" state and the transition:
    // - The page's script runs on load and populates #tree.
    // - Clicking the "Generate Suffix Tree" button should not throw errors (the inline onclick returns a string but does not modify DOM further).
    // - The tree container contains header spans (visual feedback).
    // - The nested #tree element (duplicate id) that the script intentionally injects exists.
    // - No unexpected console/page errors occur during click.

    const app = new SuffixTreePage(page);
    await app.goto();

    // After initial load the script has already attempted to populate #tree.
    // Validate that there are some visual spans representing the tree.
    const initialSpanCount = await app.countHeaderSpans();
    expect(initialSpanCount).toBeGreaterThan(0);

    // The implementation writes a nested <div id="tree"></div> into the #tree element.
    // Verify the nested element exists (this checks a quirky implementation detail).
    const nested = await app.hasNestedTreeElement();
    expect(nested).toBe(true);

    // Save current innerHTML for comparison after click
    const beforeClickHTML = await app.getTreeInnerHTML();

    // Click the button (this calls generateSuffixTree but the inline handler just returns a string).
    await app.clickGenerate();

    // Allow microtasks to run - small delay to ensure no async errors are missed
    await page.waitForTimeout(50);

    // After click, the DOM should still contain the tree content (no unexpected removal).
    const afterClickHTML = await app.getTreeInnerHTML();
    expect(afterClickHTML).toBe(beforeClickHTML);

    // There should still be header spans and the count should not have decreased.
    const afterSpanCount = await app.countHeaderSpans();
    expect(afterSpanCount).toBeGreaterThan(0);
    expect(afterSpanCount).toBe(initialSpanCount);

    // No console or page errors should have been thrown during the click
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition behavior: calling generateSuffixTree directly and edge cases', async ({ page }) => {
    // This test verifies direct function behavior and edge cases:
    // - Calling generateSuffixTree with empty strings returns an empty string as per function base-case.
    // - Calling with regular inputs returns a string (or nested HTML string), and does not throw.
    // - Ensure that calling it from the test harness is allowed and any thrown exceptions are observed.

    const app = new SuffixTreePage(page);
    await app.goto();

    // Edge case 1: empty word and suffix - should return empty string ''
    const resultEmpty = await app.callGenerateSuffixTree('', '');
    expect(resultEmpty).toBe('');

    // Typical case: small inputs - should return a string (could be HTML string)
    const resultTypical = await app.callGenerateSuffixTree('ab', 'a');
    // The function should either return a string or an object documenting a thrown error.
    expect(typeof resultTypical === 'string' || (resultTypical && resultTypical.__thrown)).toBe(true);

    // If an exception was thrown when invoking, fail the test intentionally to surface runtime errors.
    if (resultTypical && resultTypical.__thrown) {
      // If an unexpected exception occurred, ensure it is represented as an Error-like object
      throw new Error(`generateSuffixTree threw during evaluation: ${resultTypical.name} - ${resultTypical.message}`);
    }

    // Re-assert that no console/page errors were raised during these evaluations
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: multiple rapid clicks do not cause uncaught exceptions', async ({ page }) => {
    // This test simulates a user clicking the button rapidly multiple times to test robustness.
    // The implementation's onclick returns a value but does not mutate the DOM further, so repeated clicks
    // should not throw or cause inconsistent DOM states.

    const app = new SuffixTreePage(page);
    await app.goto();

    const beforeSpanCount = await app.countHeaderSpans();

    // Rapid sequence of clicks
    for (let i = 0; i < 5; i++) {
      await app.clickGenerate();
    }

    // small wait to allow any potential errors to surface
    await page.waitForTimeout(100);

    const afterSpanCount = await app.countHeaderSpans();
    expect(afterSpanCount).toBe(beforeSpanCount);

    // Ensure no page errors or console errors occurred
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('FSM completeness checks: existence of expected components and evidence strings', async ({ page }) => {
    // This test checks that the elements described in the FSM exist and match the evidence text.
    const app = new SuffixTreePage(page);
    await app.goto();

    // Evidence: button HTML should include the exact clickable text "Generate Suffix Tree"
    const btnText = await app.generateBtn.innerText();
    expect(btnText).toContain('Generate Suffix Tree');

    // Evidence: #tree exists (visual component)
    await expect(app.tree).toBeVisible();

    // Sanity: the page did define the #tree contents at load time (the FSM expects tree displayed)
    const html = await app.getTreeInnerHTML();
    expect(html.length).toBeGreaterThan(0);

    // No runtime errors detected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});