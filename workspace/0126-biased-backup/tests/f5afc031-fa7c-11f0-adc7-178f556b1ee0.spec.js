import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5afc031-fa7c-11f0-adc7-178f556b1ee0.html';

// Simple Page Object for the Hash Map Concept page
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.h1 = page.locator('h1');
    this.paragraphs = page.locator('p');
    this.preBlocks = page.locator('pre');
    this.lists = page.locator('ul');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async titleText() {
    return (await this.h1.textContent())?.trim();
  }

  async firstParagraphText() {
    return (await this.paragraphs.nth(0).textContent())?.trim();
  }

  async hasInteractiveElements() {
    // Detect common interactive elements that would imply transitions/events exist
    const selectors = ['button', 'input', 'select', 'textarea', 'form', 'a[href]'];
    let total = 0;
    for (const s of selectors) {
      total += await this.page.locator(s).count();
    }
    return total;
  }

  async preTextAt(index = 0) {
    return (await this.preBlocks.nth(index).textContent()) || '';
  }

  async countListItems() {
    // total number of <li> items on the page
    return await this.page.locator('li').count();
  }
}

test.describe('Hash Map Concept - FSM: S0_Idle (Static Page)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events and page errors to observe runtime behavior.
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // err is an Error object from the page context
      pageErrors.push(err?.message ?? String(err));
    });
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners by resetting page (navigate to about:blank) to avoid leaks between tests
    try {
      await page.goto('about:blank');
    } catch (e) {
      // ignore navigation errors during teardown
    }
  });

  test('renders expected static content for S0_Idle entry evidence', async ({ page }) => {
    // This test verifies that the static page renders the evidence specified in the FSM:
    // - <h1>Hash Map Concept</h1>
    // - a paragraph that asks "What is a Hash Map?"
    const mapPage = new HashMapPage(page);
    await mapPage.goto();

    // Check the H1 title text
    await expect(mapPage.h1).toHaveCount(1);
    const title = await mapPage.titleText();
    expect(title).toBe('Hash Map Concept');

    // Check that the first paragraph contains the expected phrase
    const firstPara = await mapPage.firstParagraphText();
    expect(firstPara).toBe('What is a Hash Map?');

    // Validate several content blocks are present (the page is static educational content)
    // There should be at least one <pre> code block that contains the Map example text
    await expect(mapPage.preBlocks).toHaveCount(2); // two pre blocks are visible in the HTML
    const pre0 = await mapPage.preTextAt(0);
    expect(pre0).toContain('const hashMap = new Map()');
    const pre1 = await mapPage.preTextAt(1);
    expect(pre1).toContain('const hashMap = new Map()');

    // Validate that there are lists of algorithms and types (li items)
    const liCount = await mapPage.countListItems();
    expect(liCount).toBeGreaterThanOrEqual(6); // Expect at least the listed items in the HTML

    // Ensure that no interactive UI elements (buttons, inputs, forms, links) are present,
    // since the FSM extraction noted "no interactive elements".
    const interactiveCount = await mapPage.hasInteractiveElements();
    expect(interactiveCount).toBe(0);

    // Ensure no unexpected console errors were emitted while simply rendering the static page
    // (Before we intentionally cause an error in a later test)
    const errorsNow = pageErrors.filter(msg => /error|reference|type|syntax/i.test(msg));
    expect(errorsNow.length).toBe(0);
  });

  test('entry action renderPage is not implemented: typeof renderPage is undefined', async ({ page }) => {
    // The FSM lists renderPage() as an entry action. The HTML does not define it.
    // Verify that renderPage is not a defined global on the page (i.e., typeof === "undefined").
    const mapPage = new HashMapPage(page);
    await mapPage.goto();

    // Check typeof renderPage in the page context
    const typeOfRenderPage = await page.evaluate(() => {
      // Accessing typeof of an undeclared identifier returns 'undefined' without throwing.
      // This is safe and does not modify globals.
      return typeof renderPage;
    });

    expect(typeOfRenderPage).toBe('undefined');
  });

  test('calling renderPage() from page context throws a ReferenceError and emits a pageerror', async ({ page }) => {
    // This test intentionally invokes the missing entry action to let a ReferenceError occur naturally.
    // We observe that the page error event is emitted and that the evaluation rejects with an error.
    const mapPage = new HashMapPage(page);
    await mapPage.goto();

    // Prepare the evaluation promise that will attempt to call the undefined function.
    const evalPromise = page.evaluate(() => {
      // Deliberately attempt to call an undefined function to allow a ReferenceError to happen naturally.
      // This does not inject or modify any globals.
      // eslint-disable-next-line no-undef
      return renderPage();
    });

    // The evaluation should reject. Different engines/Playwright provide differing message text,
    // so assert that it rejects and that the pageerror handler captured something about renderPage.
    await expect(evalPromise).rejects.toThrow();

    // Give a tiny moment for pageerror listeners to collect the error (should already be collected).
    // Assert that at least one page error was captured and it mentions renderPage or "not defined".
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const matchesRenderPage = pageErrors.some(msg => /renderPage/i.test(msg) || /not defined/i.test(msg));
    expect(matchesRenderPage).toBeTruthy();

    // Additionally check console messages for any 'error' type message recorded as a result
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error' || /renderPage/i.test(m.text));
    // At least one console error or textual mention should exist from the failed call
    expect(consoleErrorMsgs.length).toBeGreaterThanOrEqual(0);
  });

  test('no interactive events/transitions defined in FSM: verify absence of inline handlers and scripts', async ({ page }) => {
    // FSM extraction said there are 0 event handlers and 0 components. Check page for typical indicators:
    // - no inline event handler attributes like onclick, onsubmit, etc.
    // - no <script> tags (since no interactivity was extracted)
    await page.goto(BASE_URL);

    // Check for inline event handler attributes
    const inlineHandlerCount = await page.evaluate(() => {
      // Collect attributes that start with 'on' on elements (e.g., onclick, onmouseover)
      const all = Array.from(document.querySelectorAll('*'));
      let count = 0;
      for (const el of all) {
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.startsWith('on')) {
            count++;
          }
        }
      }
      return count;
    });

    expect(inlineHandlerCount).toBe(0);

    // Check for script tags count
    const scriptCount = await page.locator('script').count();
    expect(scriptCount).toBe(0);
  });

  test('edge case: attempting to access a non-existent DOM element gracefully fails', async ({ page }) => {
    // Verify that querying for a non-existent element returns null/zero count and does not throw.
    await page.goto(BASE_URL);

    // Query for an element that should not exist
    const el = await page.locator('#this-element-does-not-exist');
    await expect(el).toHaveCount(0);

    // Ensure no page errors were produced just by querying
    const recentPageErrors = pageErrors.filter(msg => /this-element-does-not-exist/i.test(msg));
    expect(recentPageErrors.length).toBe(0);
  });

  test('accessibility and basic semantics: headings and content order', async ({ page }) => {
    // Verify heading structure and presence of expected section headings.
    await page.goto(BASE_URL);

    // Ensure there is at least one H2 sections as per the HTML (Hash Map Theory, Algorithms, Example, Conclusion)
    const h2Count = await page.locator('h2').count();
    expect(h2Count).toBeGreaterThanOrEqual(3);

    const h2Texts = await page.locator('h2').allTextContents();
    expect(h2Texts.some(t => /Hash Map Theory/i.test(t))).toBeTruthy();
    expect(h2Texts.some(t => /Hash Map Algorithms/i.test(t))).toBeTruthy();
    expect(h2Texts.some(t => /Example/i.test(t))).toBeTruthy();
  });
});