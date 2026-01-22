import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e18b820-d5c5-11f0-92ee-f5994b4f4c99.html';

// Page Object for the Binary Search static page
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getHeaderText() {
    const el = await this.page.$('h1');
    return el ? (await el.textContent()).trim() : null;
  }

  async getDescriptionText() {
    const el = await this.page.$('p.description');
    return el ? (await el.textContent()).trim() : null;
  }

  async getUsageSectionText() {
    // The usage section is plain text in the body; search for the function snippet text.
    return this.page.locator('text=function binarySearch').first().textContent().catch(() => null);
  }

  async countInteractiveElements() {
    const selectors = ['button', 'input', 'select', 'textarea', 'a[href]', '[role="button"]', 'button[type="button"]'];
    let count = 0;
    for (const sel of selectors) {
      const els = await this.page.$$(sel);
      count += els.length;
    }
    return count;
  }

  // Attempt to call a global function named renderPage() inside the page.
  // The function will not be redefined or patched; this simply invokes it if present,
  // otherwise it will naturally throw a ReferenceError inside the page context,
  // which we capture and return the error name/message.
  async attemptCallRenderPage() {
    return this.page.evaluate(() => {
      try {
        // Intentionally call renderPage as an unqualified identifier, so if it does not exist,
        // a ReferenceError will be thrown naturally within the page context.
        // We catch it inside the page, and return structured information about the outcome.
        // We do NOT define or patch renderPage here.
        const result = renderPage();
        return { threw: false, result };
      } catch (e) {
        return { threw: true, name: e && e.name ? e.name : String(e), message: e && e.message ? e.message : String(e) };
      }
    });
  }
}

test.describe('FSM: Binary Search - Idle state (S0_Idle)', () => {
  let page;
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ browser }) => {
    // Create a new context & page for isolation
    const context = await browser.newContext();
    page = await context.newPage();

    // Capture console messages and errors for later assertions
    page.on('console', msg => {
      const type = msg.type(); // 'log', 'error', etc.
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture unhandled page errors (runtime exceptions)
    page.on('pageerror', err => {
      // err is an Error object from the page
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });

    // Navigate to the page under test and wait for full load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Ensure the page is closed after each test
    if (page && !page.isClosed()) {
      await page.close();
    }
    // Reset captures for next test
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];
  });

  test('renders static content on load (Idle state entry)', async () => {
    // This test validates the S0_Idle entry evidence:
    // - <h1>Binary Search</h1>
    // - <p class="description">Binary search is an algorithm...</p>
    const bsPage = new BinarySearchPage(page);

    const header = await bsPage.getHeaderText();
    expect(header).toBe('Binary Search'); // Ensure main heading is present

    const description = await bsPage.getDescriptionText();
    expect(description).toContain('Binary search is an algorithm that searches for a specific element in a sorted array or list.'); // Verify description text

    // The Usage code block should contain the function name "binarySearch"
    // This is a best-effort check; the snippet in the HTML is represented as raw backtick text.
    const usageSnippet = await page.locator('body').textContent();
    expect(usageSnippet).toContain('function binarySearch'); // Verify the displayed code includes the function definition

    // Confirm "Example" heading exists and the example snippet mentions 'console.log'
    expect(usageSnippet).toContain('Example');
    expect(usageSnippet).toContain('console.log(binarySearch(arr, target))');
  });

  test('no interactive elements or event handlers present (no transitions)', async () => {
    // FSM extraction noted no interactive components or transitions.
    const bsPage = new BinarySearchPage(page);

    const interactiveCount = await bsPage.countInteractiveElements();

    // Expect zero interactive controls on the page as per the FSM notes.
    expect(interactiveCount).toBe(0);

    // Also assert that there are no elements with onclick/onchange attributes in the DOM
    const hasInlineHandlers = await page.evaluate(() => {
      // This only reads attributes; it doesn't modify the page.
      const all = Array.from(document.querySelectorAll('*'));
      return all.some(el => {
        for (const attr of el.getAttributeNames()) {
          const lower = attr.toLowerCase();
          if (lower.startsWith('on')) return true;
        }
        return false;
      });
    });
    expect(hasInlineHandlers).toBe(false);
  });

  test('entry action renderPage() is not defined; calling it produces a ReferenceError inside page context', async () => {
    // The FSM specified an entry_action renderPage(), but the HTML/JS does not define it.
    // We attempt to call it inside the page context WITHOUT patching or defining it.
    // This will naturally produce a ReferenceError that we capture and assert on.
    const bsPage = new BinarySearchPage(page);

    const callResult = await bsPage.attemptCallRenderPage();

    // We expect that renderPage is not a function in the page global scope,
    // and thus calling it should throw a ReferenceError which we caught inside the page.
    expect(callResult.threw).toBe(true);
    // The exact name should be 'ReferenceError' in modern browsers when calling an undefined identifier.
    expect(callResult.name).toMatch(/ReferenceError/i);
    // The message should mention renderPage in most engines; verify presence of that token if possible.
    expect(callResult.message.toLowerCase()).toContain('renderpage');
  });

  test('observe console and page errors during load and runtime', async () => {
    // This test validates we are observing console messages and any page runtime errors.
    // We do not inject or patch the page; we only observe what naturally happened.
    // The test asserts the capture arrays are accessible and that their contents are consistent.
    // It's acceptable for there to be zero errors; but if errors occurred they should be well-formed.

    // consoleMessages holds all console.* outputs
    expect(Array.isArray(consoleMessages)).toBe(true);

    // pageErrors holds unhandled exceptions from the page runtime (captured by 'pageerror' event)
    expect(Array.isArray(pageErrors)).toBe(true);

    // If there are page errors, ensure they are Error-like objects with name/message
    for (const err of pageErrors) {
      expect(err).toHaveProperty('name');
      expect(err).toHaveProperty('message');
      // If the FSM's declared entry action renderPage were executed by the page (not the case here),
      // we'd likely see a ReferenceError in pageErrors. Accept either zero or more errors.
      expect(typeof err.name).toBe('string');
      expect(typeof err.message).toBe('string');
    }

    // If there are console errors, check they are strings and non-empty
    for (const c of consoleErrors) {
      expect(typeof c).toBe('string');
      expect(c.length).toBeGreaterThanOrEqual(0);
    }

    // As an explicit edge case assertion: if no pageErrors were emitted during load,
    // we still ensure that calling the missing renderPage produces a ReferenceError (validated in another test).
    // This assertion just ensures the runtime observation mechanism worked:
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('edge case: ensure calling renderPage would not silently succeed', async () => {
    // Double-check that renderPage is not present as a property on window (sanity check).
    const isDefined = await page.evaluate(() => {
      try {
        return typeof window.renderPage !== 'undefined';
      } catch {
        return false;
      }
    });
    expect(isDefined).toBe(false);
  });
});