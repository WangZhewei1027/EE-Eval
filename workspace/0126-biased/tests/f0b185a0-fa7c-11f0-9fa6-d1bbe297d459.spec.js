import { test, expect } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b185a0-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object Model for the Binary Trees page
class BinaryTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleSelector = "button[onclick='showTraversalDemo()']";
    this.demoSelector = '#traversal-demo';
  }

  async goto() {
    await this.page.goto(PAGE_URL);
  }

  async clickToggle() {
    await this.page.click(this.toggleSelector);
  }

  async getInlineDisplay() {
    // Returns the inline style.display value (may be '' if not set)
    return await this.page.$eval(this.demoSelector, el => el.style.display);
  }

  async getComputedDisplay() {
    return await this.page.$eval(this.demoSelector, el => {
      return window.getComputedStyle(el).getPropertyValue('display');
    });
  }

  async isVisible() {
    return await this.page.$eval(this.demoSelector, el => {
      const cs = window.getComputedStyle(el);
      return cs && cs.getPropertyValue('display') !== 'none' && cs.getPropertyValue('visibility') !== 'hidden' && el.offsetParent !== null;
    });
  }

  async traversalText() {
    return await this.page.$eval(this.demoSelector, el => el.innerText);
  }

  async buttonHasOnclick() {
    return await this.page.$eval(this.toggleSelector, btn => btn.getAttribute('onclick'));
  }

  async hasFunction(fnName) {
    return await this.page.evaluate(name => typeof window[name] !== 'undefined', fnName);
  }
}

test.describe('FSM: Comprehensive Guide to Binary Trees - Traversal Demo', () => {
  let page;
  let model;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // Create a fresh context and page for each test to isolate console/pageerror events
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // Store minimal info: type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // Store the error message
      pageErrors.push(err);
    });

    model = new BinaryTreePage(page);
    await model.goto();
  });

  test.afterEach(async () => {
    // Close the page's context to clean up
    await page.context().close();
  });

  test('Initial Idle state (S0_Idle) - page loads and demo is hidden by default', async () => {
    // This test validates S0_Idle evidence: the button exists and the traversal demo is not visible.
    // Also verifies that showTraversalDemo exists and renderPage does not (as per implementation).
    // Capture initial DOM and script state.

    // Button exists with expected onclick attribute
    const onclickAttr = await model.buttonHasOnclick();
    expect(onclickAttr).toBe("showTraversalDemo()");

    // The traversal demo element exists
    const demoHandle = await page.$('#traversal-demo');
    expect(demoHandle).not.toBeNull();

    // Inline style.display should initially be empty (no inline style set)
    const inlineDisplay = await model.getInlineDisplay();
    expect(inlineDisplay).toBe(''); // no inline style initially

    // Computed display should be 'none' because CSS class .hidden-demo sets display:none
    const computedDisplay = await model.getComputedDisplay();
    expect(computedDisplay).toBe('none');

    // isVisible should be false
    const visible = await model.isVisible();
    expect(visible).toBe(false);

    // showTraversalDemo should exist as a function
    const hasShowFn = await model.hasFunction('showTraversalDemo');
    expect(hasShowFn).toBe(true);

    // renderPage is referenced in FSM but not implemented in this HTML; ensure it's not present
    const hasRenderPage = await model.hasFunction('renderPage');
    expect(hasRenderPage).toBe(false);

    // No runtime page errors should have occurred on initial load
    expect(pageErrors.length).toBe(0);

    // There should be no console.error messages emitted during load (only possible console types should be present)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0 -> S1: clicking toggle displays traversal demo', async () => {
    // Validate the first transition: clicking the Show Traversal Orders button should show the demo.
    await model.clickToggle();

    // After click, inline style.display should be set to 'block' by the function
    const inlineDisplay = await model.getInlineDisplay();
    expect(inlineDisplay).toBe('block');

    // Computed display should now be 'block' and visible
    const computedDisplay = await model.getComputedDisplay();
    expect(computedDisplay).toBe('block');

    const visible = await model.isVisible();
    expect(visible).toBe(true);

    // Verify that the demo contains expected traversal text lines
    const text = await model.traversalText();
    expect(text).toContain('In-order traversal:');
    expect(text).toContain('Pre-order traversal:');
    expect(text).toContain('Post-order traversal:');
    expect(text).toContain('Level-order traversal:');

    // No page errors or console errors should be emitted during the click transition
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1 -> S2: clicking toggle hides the traversal demo', async () => {
    // Start by making sure it is visible
    await model.clickToggle();
    expect(await model.isVisible()).toBe(true);

    // Click again to hide
    await model.clickToggle();

    // Inline style.display should be set to 'none'
    const inlineDisplay = await model.getInlineDisplay();
    expect(inlineDisplay).toBe('none');

    // Computed display should be 'none'
    const computedDisplay = await model.getComputedDisplay();
    expect(computedDisplay).toBe('none');

    // Not visible
    const visible = await model.isVisible();
    expect(visible).toBe(false);

    // No JS errors during these interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S2 -> S1: toggling again shows the demo (repeatability)', async () => {
    // Ensure hidden state
    // Click once to show, twice to hide, third to show again
    await model.clickToggle(); // show
    await model.clickToggle(); // hide
    await model.clickToggle(); // show again

    // Should be visible again
    expect(await model.isVisible()).toBe(true);

    // Inline style should be 'block'
    const inlineDisplay = await model.getInlineDisplay();
    expect(inlineDisplay).toBe('block');

    // No JS errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid multiple clicks result in consistent toggle behavior', async () => {
    // Rapidly click the button 5 times and verify final state matches expected toggle parity.
    // Starting hidden (S0), 5 clicks => S1 (visible) because odd number of toggles.

    for (let i = 0; i < 5; i++) {
      // Use click with small delay to simulate rapid user clicks
      await model.clickToggle();
    }

    // With 5 clicks, expected visible (odd toggles)
    const isVisibleAfter5 = await model.isVisible();
    expect(isVisibleAfter5).toBe(true);

    // Now click once more (6th) to make it hidden
    await model.clickToggle();
    expect(await model.isVisible()).toBe(false);

    // Verify demo text exists when visible, and hidden state removes visibility but element still present
    // Show again and check contents
    await model.clickToggle();
    expect(await model.traversalText()).toContain('In-order traversal:');

    // Confirm no pageerrors were thrown during rapid interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case & error scenario checks: ensure no unexpected global mutations or missing function calls', async () => {
    // FSM references renderPage as an entry action for S0. Confirm that calling it is not possible (not present).
    const hasRenderPage = await model.hasFunction('renderPage');
    expect(hasRenderPage).toBe(false);

    // Confirm showTraversalDemo exists and is the function used by the button
    const hasShow = await model.hasFunction('showTraversalDemo');
    expect(hasShow).toBe(true);

    // Ensure the button's onclick attribute references the expected function (evidence in FSM)
    const onclickAttr = await model.buttonHasOnclick();
    expect(onclickAttr).toMatch(/showTraversalDemo/);

    // Observe console and page errors: there should be none from this page
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);

    // Also assert that there are some console messages array (maybe empty) but the test inspects them
    // This ensures we observed logging without modifying runtime behavior
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('Sanity: DOM structural checks related to traversal demo content', async () => {
    // Validate the textual lines are semantically correct when visible.
    await model.clickToggle(); // show
    const text = await model.traversalText();

    // Check the ordering lines include expected numeric sequences for the demo tree in the HTML
    expect(text).toContain('4, 2, 5, 1, 3'); // In-order expected sequence present in the content
    expect(text).toContain('1, 2, 4, 5, 3'); // Pre-order
    expect(text).toContain('4, 5, 2, 3, 1'); // Post-order
    expect(text).toContain('1, 2, 3, 4, 5'); // Level-order

    // Verify that the traversal-demo element remains in the DOM even when hidden (structural requirement)
    await model.clickToggle(); // hide
    const demoExists = await page.$('#traversal-demo');
    expect(demoExists).not.toBeNull();
  });
});