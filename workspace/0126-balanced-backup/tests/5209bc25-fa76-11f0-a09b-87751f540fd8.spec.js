import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5209bc25-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the Big-O Notation page
class BigOPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Returns the main <h1> element text
  async headerText() {
    const el = await this.page.locator('h1').first();
    return el.textContent();
  }

  // Returns the primary description paragraph (first <p>)
  async primaryParagraphText() {
    const el = await this.page.locator('p').first();
    return el.textContent();
  }

  // Returns an array of list item texts under the first <ul>
  async listItemsText() {
    return this.page.locator('ul li').allTextContents();
  }

  // Returns the code block text inside the <pre><code>
  async codeBlockText() {
    return this.page.locator('pre code').textContent();
  }

  // Counts interactive form controls and links on the page
  async interactiveControlCount() {
    // buttons, inputs, selects, textareas, anchors
    return this.page.locator('button, input, select, textarea, a').count();
  }

  // Check if a given selector is present
  async hasSelector(selector) {
    return this.page.locator(selector).count().then(c => c > 0);
  }
}

test.describe('Big-O Notation page - FSM S0_Idle and static content validation', () => {
  // Arrays to collect console messages and page errors
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', msg => {
      // store the message type and text for debugging/assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the provided static HTML page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // detach listeners to avoid memory leaks across tests (Playwright test fixtures handle pages,
    // but we clear arrays to ensure per-test isolation)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial render (Idle state) - header and description are present', async ({ page }) => {
    // This test validates the FSM S0_Idle evidence:
    // - <h1>Big-O Notation</h1>
    // - the primary descriptive paragraph exists
    const bigO = new BigOPage(page);

    const header = (await bigO.headerText())?.trim();
    expect(header).toBe('Big-O Notation');

    const paragraph = (await bigO.primaryParagraphText())?.trim();
    expect(paragraph).toContain('Big-O Notation is a measure of the time or space an algorithm requires');

    // The entry action for S0_Idle is "renderPage()". We cannot call or inspect internal functions,
    // but the presence of the header and paragraph is evidence that the page content is rendered.
    // Assert that the expected evidence from the FSM state is present in the DOM.
    expect(header.length).toBeGreaterThan(0);
    expect(paragraph.length).toBeGreaterThan(0);
  });

  test('Static content - list of Big-O types and example code are present', async ({ page }) => {
    // This test validates the static informational content and the example code block.
    const bigO = new BigOPage(page);

    const listItems = await bigO.listItemsText();
    // There should be several bullet points describing Big-O types.
    expect(listItems.length).toBeGreaterThanOrEqual(6);

    // Confirm presence of some known Big-O descriptions in the list
    const joined = listItems.join(' ');
    expect(joined).toContain('O(1)');
    expect(joined).toContain('O(n)');
    expect(joined).toContain('O(n^2)');
    expect(joined).toContain('O(2^n)');

    // Verify example code contains fibonacci function and a console.log call
    const codeText = (await bigO.codeBlockText()) || '';
    expect(codeText).toContain('function fibonacci');
    expect(codeText).toContain('console.log(fibonacci(30))');
  });

  test('No interactive elements or transitions exist (FSM has no events/transitions)', async ({ page }) => {
    // The FSM definition shows zero transitions and no interactive components.
    // Confirm the page contains no interactive controls like buttons, inputs, anchors, selects, textareas.
    const bigO = new BigOPage(page);
    const interactiveCount = await bigO.interactiveControlCount();
    expect(interactiveCount).toBe(0);

    // Additionally assert there are no visible buttons or links by more explicit selectors
    const hasButton = await bigO.hasSelector('button');
    const hasAnchor = await bigO.hasSelector('a');
    const hasInput = await bigO.hasSelector('input, select, textarea');
    expect(hasButton).toBe(false);
    expect(hasAnchor).toBe(false);
    expect(hasInput).toBe(false);
  });

  test('Page does not emit console errors or uncaught exceptions on load', async ({ page }) => {
    // Collect console messages and page errors captured in beforeEach
    // Validate that there are no console messages of type "error" and no page errors.
    const errors = consoleMessages.filter(m => m.type === 'error');
    // For debugging, include the text if any; but expect none.
    expect(errors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case checks: absent elements and resilience', async ({ page }) => {
    // Validate the page gracefully lacks interactive UI elements and certain expected-but-absent selectors
    // Query for elements that should not exist and assert they are absent
    const bigO = new BigOPage(page);

    // These selectors represent interactive or stateful controls that the FSM did not provide
    expect(await bigO.hasSelector('#nonexistent-state')).toBe(false);
    expect(await bigO.hasSelector('.interactive-control')).toBe(false);
    expect(await bigO.hasSelector('#renderPageFunctionOutputMarker')).toBe(false);

    // Attempt to read a deeply nested selector that doesn't exist and ensure Playwright returns count 0
    const deepSelectorCount = await page.locator('main .container .controls button').count();
    expect(deepSelectorCount).toBe(0);
  });

  test('Accessibility and semantics basic checks', async ({ page }) => {
    // Basic checks to ensure core semantic elements are present as expected for educational content
    const h1Count = await page.locator('h1').count();
    const h2Count = await page.locator('h2').count();
    const preCount = await page.locator('pre').count();

    expect(h1Count).toBe(1); // one main heading
    expect(h2Count).toBeGreaterThanOrEqual(1); // at least one subheading (Example Code)
    expect(preCount).toBeGreaterThanOrEqual(1); // code example exists
  });
});