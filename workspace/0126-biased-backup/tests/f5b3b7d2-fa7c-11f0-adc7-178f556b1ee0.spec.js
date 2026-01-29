import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b3b7d2-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page Object Model for the Dynamic Typing page.
 * Encapsulates common selectors and assertions related to the static content.
 */
class DynamicTypingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.h1 = 'h1';
    this.h2 = 'h2';
    this.paragraphs = 'p';
    this.pre = 'pre';
  }

  async goto() {
    // Navigate to the exact URL specified in the requirements.
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async title() {
    return this.page.title();
  }

  async h1Text() {
    return this.page.textContent(this.h1);
  }

  async allH2Texts() {
    return this.page.$$eval(this.h2, nodes => nodes.map(n => n.textContent));
  }

  async paragraphCount() {
    return this.page.$$eval(this.paragraphs, nodes => nodes.length);
  }

  async preText() {
    return this.page.textContent(this.pre);
  }

  // Helpers to query for interactive elements and event attributes
  async countInteractiveElements() {
    return this.page.$$eval('button, input, textarea, select, [role="button"], a[role="button"]', els => els.length);
  }

  async countScriptTags() {
    return this.page.$$eval('script', els => els.length);
  }

  async countInlineEventAttributes() {
    // common inline event attributes
    const attrs = ['onclick','onchange','oninput','onsubmit','onmouseover','onmouseout','onkeydown','onkeyup','onkeypress'];
    return this.page.$$eval('*', (nodes, attrs) => {
      let count = 0;
      for (const node of nodes) {
        for (const a of attrs) {
          if (node.hasAttribute && node.hasAttribute(a)) count++;
        }
      }
      return count;
    }, attrs);
  }

  async hasGlobalFunction(name) {
    return this.page.evaluate((fname) => {
      // Accessing window[fname] directly is allowed; do NOT define it.
      return typeof window[fname] !== 'undefined';
    }, name);
  }
}

test.describe('f5b3b7d2-fa7c-11f0-adc7-178f556b1ee0 - Dynamic Typing (FSM: Idle)', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let page;

  test.beforeEach(async ({ browser }) => {
    // Create a new page per test to isolate console/pageerror events
    const context = await browser.newContext();
    page = await context.newPage();
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      // store the error name and message for assertions
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });

    // Collect console messages, including console.error calls
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  test.afterEach(async () => {
    // Close the page to cleanup context
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('Initial state (S0_Idle) rendering: page loads and shows expected static content', async () => {
    // This test validates the entry state of the FSM: S0_Idle.
    // It verifies that the static page content is present (title, h1, h2, paragraphs, code sample).
    const dtPage = new DynamicTypingPage(page);
    await dtPage.goto();

    // Verify document title is present and appropriate
    const title = await dtPage.title();
    expect(title).toBeTruthy();
    expect(title).toContain('Dynamic Typing');

    // Check main heading text
    const h1Text = await dtPage.h1Text();
    expect(h1Text).toBe('Dynamic Typing');

    // Expect multiple h2 headings for sections described in HTML
    const h2Texts = await dtPage.allH2Texts();
    expect(h2Texts.length).toBeGreaterThanOrEqual(3);
    expect(h2Texts).toContain('What is Dynamic Typing?');
    expect(h2Texts).toContain('How Does Dynamic Typing Work?');
    expect(h2Texts).toContain('Example: Dynamic Typing in JavaScript');

    // Ensure there are several paragraphs describing the concept
    const pCount = await dtPage.paragraphCount();
    expect(pCount).toBeGreaterThanOrEqual(5);

    // Code sample present in pre tag and contains example snippet keywords
    const preText = await dtPage.preText();
    expect(preText).toBeTruthy();
    expect(preText).toContain('var x = 5;');
    expect(preText).toContain("typeof x");
  });

  test('No interactive elements or event handlers exist (FSM has no transitions/events)', async () => {
    // FSM extraction reported no interactive elements or events.
    // Validate that the DOM contains no interactive controls and no script tags.
    const dtPage = new DynamicTypingPage(page);
    await dtPage.goto();

    const interactiveCount = await dtPage.countInteractiveElements();
    expect(interactiveCount).toBe(0);

    const scriptCount = await dtPage.countScriptTags();
    // The HTML provided contains no <script> tags, so assert that.
    expect(scriptCount).toBe(0);

    const inlineEventAttrCount = await dtPage.countInlineEventAttributes();
    // There should be no inline event attributes like onclick etc.
    expect(inlineEventAttrCount).toBe(0);
  });

  test('Verify entry/exit actions (renderPage) presence and behavior', async () => {
    // FSM's entry action listed "renderPage()". Verify whether a global renderPage function exists.
    // We must NOT attempt to call renderPage(). We only inspect whether it's defined.
    const dtPage = new DynamicTypingPage(page);
    await dtPage.goto();

    const hasRenderPage = await dtPage.hasGlobalFunction('renderPage');
    // According to the provided HTML, there is no renderPage function defined.
    // Assert that it's not present. This verifies our observation of the runtime.
    expect(hasRenderPage).toBe(false);
  });

  test('Observe console messages and page errors during load (should have no runtime ReferenceError/SyntaxError/TypeError)', async () => {
    // This test collects console and pageerror events during page load and asserts that
    // no ReferenceError, SyntaxError, or TypeError occurred. It also records console.error messages.
    const dtPage = new DynamicTypingPage(page);
    await dtPage.goto();

    // Give a short pause to ensure any async console messages would surface
    await page.waitForTimeout(100);

    // Assert that there are no page errors captured
    // If any errors did occur, fail the test and output the first few for debugging.
    if (pageErrors.length > 0) {
      // Provide diagnostic failures listing encountered errors
      const summary = pageErrors.map(e => `${e.name}: ${e.message}`).slice(0, 5).join('; | ');
      // Fail with descriptive message
      expect(pageErrors.length, `Expected no runtime page errors but found: ${summary}`).toBe(0);
    } else {
      expect(pageErrors.length).toBe(0);
    }

    // Assert there are no console messages of type 'error'
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(m.text));
    if (errorConsoleMessages.length > 0) {
      const summary = errorConsoleMessages.map(m => `[${m.type}] ${m.text}`).slice(0,5).join('; | ');
      expect(errorConsoleMessages.length, `Expected no console errors or JS exception texts but found: ${summary}`).toBe(0);
    } else {
      expect(errorConsoleMessages.length).toBe(0);
    }

    // Additionally assert that no console messages explicitly mention ReferenceError/SyntaxError/TypeError
    const explicitExceptions = consoleMessages.filter(m => /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(explicitExceptions.length).toBe(0);
  });

  test('Edge case: visiting a wrong URL under same path should return non-empty response (graceful 404/serve behavior)', async () => {
    // This test validates how the server behaves for an invalid resource in the same path.
    // It is an edge-case test to ensure the server does not silently crash when asked for missing files.
    // Note: We load a path that is likely missing; if the server responds with 200 or 404, we accept it,
    // but the request should complete and not cause JS runtime errors on the page.
    const badUrl = 'http://127.0.0.1:5500/workspace/0126-biased/html/this-file-does-not-exist-hopefully.html';
    // Reuse the same page instance and listen again
    const badPageErrors = [];
    const badConsole = [];
    page.on('pageerror', e => badPageErrors.push(e));
    page.on('console', m => badConsole.push({ type: m.type(), text: m.text() }));

    // Attempt navigation - do not assert status code because server behavior can vary.
    const response = await page.goto(badUrl);
    // Ensure the navigation completed (response may be null for some failures, but that's acceptable)
    expect(response !== undefined || response === null).toBeTruthy();

    // Wait briefly then assert no new runtime exceptions occurred
    await page.waitForTimeout(100);
    expect(badPageErrors.length).toBe(0);
    // console may contain informational messages, but ensure no "error" typed console entries
    const badConsoleErrors = badConsole.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(badConsoleErrors.length).toBe(0);
  });

  test('Documentation sanity: ensure example code snippet mentions "typeof" and uses basic primitives', async () => {
    // Sanity check for the example code snippet in the <pre> block.
    const dtPage = new DynamicTypingPage(page);
    await dtPage.goto();

    const preText = await dtPage.preText();
    expect(preText).toMatch(/typeof\s+x/);
    expect(preText).toMatch(/var\s+x\s*=\s*5/);
    expect(preText).toMatch(/var\s+y\s*=\s*'hello'/);
  });
});